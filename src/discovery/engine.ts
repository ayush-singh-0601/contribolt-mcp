import { issueAcceptance } from '../repository/manifests.js';
import { policyKey } from '../repository/policy-store.js';
import type { Store } from '../state/store.js';
import type { GitHubClient } from '../github/client.js';
import type { Repository, IssueEvidence, Preferences } from '../core/models.js';
import { SearchBudget, EvidenceCache } from './budget.js';
import { discoverRepositories } from './repositories.js';
import { inspectHealth } from './health.js';
import { issueCandidates, refreshIssue } from './issues.js';
import { officialAuthor } from './authorship.js';
import { linkedPullRequests } from './timeline.js';
import { competingWork } from './competing.js';
import { eligibility, reservation, type Relaxable } from './eligibility.js';
import { scoreCandidate, selectCandidate } from './ranking.js';
import { policySources } from '../repository/policy-sources.js';
import { classifyPolicy } from '../repository/policies.js';
import { collectHistory, historicalHealth, type HistoricalMetrics } from './history.js';
export class DiscoveryEngine {
  constructor(
    readonly client: GitHubClient,
    readonly store: Store,
  ) {}
  async repositories(preferences: Preferences, signal?: AbortSignal): Promise<Repository[]> {
    const excluded = this.store.read<string[]>('config', 'excludedRepositories') ?? [];
    signal?.throwIfAborted();
    return new EvidenceCache(this.store, 'github.com:public-repositories').read(
      JSON.stringify({ preferences, excluded }),
      () => this.loadRepositories(preferences, excluded, signal),
    );
  }
  private async loadRepositories(
    preferences: Preferences,
    excluded: string[],
    signal?: AbortSignal,
  ): Promise<Repository[]> {
    const repos = await discoverRepositories(
      this.client,
      preferences,
      new SearchBudget(),
      excluded,
      signal,
    );
    const result: Repository[] = [];
    for (const repo of repos) {
      try {
        const inspected = await inspectHealth(this.client, repo, signal);
        let history = this.store.read<HistoricalMetrics>('history', repo.fullName);
        if (
          result.length < 5 &&
          (!history || Date.now() - Date.parse(history.checkedAt) > 86400000)
        ) {
          try {
            history = await collectHistory(this.client, repo.fullName);
            this.store.put('history', repo.fullName, history);
          } catch {
            signal?.throwIfAborted();
          }
        }
        result.push({
          ...inspected,
          health: history ? historicalHealth(inspected.health, history) : inspected.health,
        });
      } catch {
        signal?.throwIfAborted();
        result.push({ ...repo, exclusions: ['Repository health evidence unavailable'] });
      }
    }
    return result;
  }
  async verify(
    repo: Repository,
    number: number,
    signal?: AbortSignal,
    relaxations: Relaxable[] = [],
  ): Promise<IssueEvidence> {
    let issue = await refreshIssue(this.client, repo, number, signal);
    const author = await officialAuthor(this.client, repo, issue, signal),
      linked = await linkedPullRequests(this.client, repo, number, signal),
      competing = await competingWork(this.client, issue, signal),
      sources = await policySources(this.client, repo, signal),
      policy = classifyPolicy(sources.documents, sources.complete, repo);
    this.store.put('policies', policyKey(repo), { ...sources, decision: policy });
    this.store.put('competing-evidence', issue.url, { ...competing, checkedAt: issue.checkedAt });
    issue = {
      ...issue,
      officialProvenance: author.verdict,
      knownLinkedPRs: linked.urls,
      competingPRs: competing.confirmed,
      competingPRScanComplete: linked.complete && competing.complete && !competing.possible.length,
      reserved: reservation(issue.body, issue.labels, linked.reservations),
      repositoryPolicy: issueAcceptance(policy, issue.labels),
      evidence: [...author.evidence, ...policy.evidence],
      evidenceUrls: [
        ...new Set([
          ...issue.evidenceUrls,
          ...author.evidence.map((e) => e.source),
          ...policy.evidence.map((e) => e.source),
          ...linked.urls,
          ...competing.confirmed,
          ...competing.possible,
        ]),
      ],
      confidence: policy.policy === 'ALLOWED' ? 'medium' : 'high',
    };
    return eligibility(repo, issue, relaxations);
  }
  async find(
    repos: Repository[],
    preferences: Preferences,
    signal?: AbortSignal,
    relaxed: Relaxable[] = [],
    skipped: string[] = [],
  ) {
    const candidates: IssueEvidence[] = [];
    let investigated = 0;
    for (const repo of repos.filter((r) => !r.exclusions.length)) {
      const found = await issueCandidates(
        this.client,
        repo,
        Math.min(30, 150 - candidates.length),
        signal,
        relaxed,
      );
      for (const initial of found) {
        signal?.throwIfAborted();
        if (skipped.includes(initial.url)) continue;
        if (investigated++ >= 20) break;
        try {
          const verified = await this.verify(repo, initial.issueNumber, signal, relaxed);
          candidates.push(
            verified.eligibility === 'ELIGIBLE'
              ? scoreCandidate(repo, verified, preferences)
              : verified,
          );
        } catch (error) {
          signal?.throwIfAborted();
          candidates.push({ ...initial, rejectReasons: ['Verification failed: ' + String(error)] });
        }
      }
      if (investigated >= 20) break;
    }
    return { candidates, ...selectCandidate(candidates) };
  }
}
