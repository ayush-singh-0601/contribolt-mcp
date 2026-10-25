import { issueAcceptance } from '../repository/manifests.js';
import type { Store } from '../state/store.js';
import {
  RepoSchema,
  type Preferences,
  type Repository,
  type IssueEvidence,
  type Proposal,
  type Session,
} from '../core/models.js';
import { JsonForgeClient } from './http.js';
import { GitHubClient, ForgeError } from '../github/client.js';
import { policySources } from '../repository/policy-sources.js';
import { policyKey } from '../repository/policy-store.js';
import { classifyPolicy } from '../repository/policies.js';
import { mapIssue, type RawIssue } from '../discovery/issues.js';
import { officialAuthor } from '../discovery/authorship.js';
import { eligibility, reservation, type Relaxable } from '../discovery/eligibility.js';
import { similarity } from '../discovery/similarity.js';
import { scoreCandidate, selectCandidate } from '../discovery/ranking.js';
import {
  GitHubPublicationBackend,
  type Fork,
  type PublicationBackend,
  type PublishedPR,
} from '../contribution/publisher.js';
import type { Credentials } from '../github/auth.js';
import { git } from '../git/workspace.js';
import { safeHttps } from '../security/boundaries.js';
interface FRepo {
  id: number;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  has_issues: boolean;
  stars_count: number;
  updated_at: string;
  language: string;
  owner: { login: string };
  parent?: { full_name: string };
}
interface FPull {
  number: number;
  html_url: string;
  title: string;
  body: string;
  merged_at: string | null;
  head: { sha: string };
  base: { ref: string };
  draft?: boolean;
}
export class ForgejoFacade extends GitHubClient {
  constructor(readonly api: JsonForgeClient) {
    super({ kind: 'token', token: async () => api.token });
  }
  override async request<T>(
    method: string,
    path: string,
    params: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    if (method === 'POST' && path === '/graphql')
      throw new ForgeError('Forgejo has no GitHub GraphQL API', 404);
    const branch = path.match(/^\/repos\/(.+)\/commits\/([^/]+)$/);
    if (branch) {
      const raw = await this.api.request<{ commit: { id: string } }>(
        'GET',
        `/repos/${branch[1]}/branches/${branch[2]}`,
        undefined,
        {},
        signal,
      );
      return { sha: raw.commit.id } as T;
    }
    const reference = path.match(/^\/repos\/(.+)\/git\/ref\/heads\/(.+)$/);
    if (reference) {
      const raw = await this.api.request<{ commit: { id: string } }>(
        'GET',
        `/repos/${reference[1]}/branches/${reference[2]}`,
        undefined,
        {},
        signal,
      );
      return { object: { sha: raw.commit.id } } as T;
    }
    if (path.endsWith('/check-runs')) {
      try {
        return await this.api.request<T>(method, path, undefined, params, signal);
      } catch (error) {
        if (!(error instanceof ForgeError && error.status === 404)) throw error;
        return { total_count: 0, check_runs: [], unavailable: true } as T;
      }
    }
    if (path.endsWith('/requested_reviewers')) {
      const result = await this.api.request<unknown>(
        method,
        path,
        method === 'GET' ? undefined : params,
        method === 'GET' ? { ...params, limit: params.per_page ?? 100 } : {},
        signal,
      );
      if (Array.isArray(result)) return { users: result, teams: [] } as T;
      return result as T;
    }
    const role = path.match(/\/collaborators\/[^/]+\/permission$/);
    if (role) {
      const raw = await this.api.request<{ permission: string; role_name?: string }>(
        'GET',
        path,
        undefined,
        {},
        signal,
      );
      return { ...raw, role_name: raw.role_name ?? raw.permission } as T;
    }
    const raw = await this.api.request<unknown>(
      method,
      path,
      method === 'GET' ? undefined : params,
      method === 'GET' ? { ...params, limit: params.per_page ?? 100 } : {},
      signal,
    );
    if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && raw && typeof raw === 'object') {
      const repo = raw as FRepo;
      return {
        ...repo,
        owner: { ...repo.owner, type: 'User' },
        stargazers_count: repo.stars_count,
        pushed_at: repo.updated_at,
      } as T;
    }
    if (/\/issues\/\d+$/.test(path) && raw && typeof raw === 'object')
      return {
        ...raw,
        author_association:
          (raw as { author_association?: string }).author_association ?? 'UNKNOWN',
      } as T;
    if (/\/reviews$/.test(path) && Array.isArray(raw))
      return raw.map((r) => ({
        ...r,
        state: r.state === 'REQUEST_CHANGES' ? 'CHANGES_REQUESTED' : r.state,
      })) as T;
    return raw as T;
  }
  override async pages<T>(
    path: string,
    params: Record<string, unknown> = {},
    limit = 1000,
    signal?: AbortSignal,
  ): Promise<{ items: T[]; complete: boolean }> {
    const comments = path.match(/^(\/repos\/.+\/pulls\/\d+)\/comments$/);
    if (comments) {
      const reviews = await this.api.pages<{ id: number }>(
        comments[1] + '/reviews',
        {},
        500,
        signal,
      );
      const items: T[] = [];
      let complete = reviews.complete;
      for (const review of reviews.items) {
        const notes = await this.api.pages<T>(
          comments[1] + '/reviews/' + review.id + '/comments',
          {},
          limit - items.length,
          signal,
        );
        items.push(...notes.items);
        complete &&= notes.complete;
        if (items.length >= limit) {
          complete = false;
          break;
        }
      }
      return { items, complete };
    }
    return super.pages(path, params, limit, signal);
  }
}
export class ForgejoEngine {
  readonly facade: ForgejoFacade;
  constructor(
    readonly api: JsonForgeClient,
    readonly store: Store,
  ) {
    this.facade = new ForgejoFacade(api);
  }
  async repositories(p: Preferences, signal?: AbortSignal): Promise<Repository[]> {
    const found = p.preferredRepository
      ? {
          data: [
            await this.api.request<FRepo>(
              'GET',
              '/repos/' + p.preferredRepository,
              undefined,
              {},
              signal,
            ),
          ],
        }
      : await this.api.request<{ data: FRepo[] }>(
          'GET',
          '/repos/search',
          undefined,
          {
            q: p.optionalDomain ?? p.languages[0] ?? '',
            limit: 30,
            sort: 'updated',
            order: 'desc',
          },
          signal,
        );
    const repos: Repository[] = [];
    for (const raw of found.data) {
      if (raw.private || raw.archived || !raw.has_issues) continue;
      const languages = await this.api.request<Record<string, number>>(
        'GET',
        `/repos/${raw.full_name}/languages`,
        undefined,
        {},
        signal,
      );
      repos.push(
        RepoSchema.parse({
          forge: 'forgejo',
          host: this.api.config.host,
          id: String(raw.id),
          fullName: raw.full_name,
          url: raw.html_url,
          cloneUrl: raw.clone_url,
          defaultBranch: raw.default_branch,
          public: !raw.private,
          archived: raw.archived,
          fork: raw.fork,
          hasIssues: raw.has_issues,
          languages: Object.keys(languages),
          stars: raw.stars_count,
          updatedAt: raw.updated_at,
          health: Date.now() - Date.parse(raw.updated_at) < 90 * 86400000 ? 0.7 : 0.2,
        }),
      );
    }
    return repos;
  }
  async verify(
    repo: Repository,
    number: number,
    signal?: AbortSignal,
    relaxed: Relaxable[] = [],
  ): Promise<IssueEvidence> {
    const raw = await this.facade.request<RawIssue>(
        'GET',
        `/repos/${repo.fullName}/issues/${number}`,
        {},
        signal,
      ),
      metadata = await this.api.request<FRepo>(
        'GET',
        `/repos/${repo.fullName}`,
        undefined,
        {},
        signal,
      );
    let issue = mapIssue(repo, raw);
    const source = await policySources(this.facade, repo, signal),
      decision = classifyPolicy(source.documents, source.complete, repo),
      author = await officialAuthor(this.facade, repo, issue, signal);
    this.store.put('policies', policyKey(repo), { ...source, decision });
    let complete = true,
      linked: string[] = [],
      events: string[] = [];
    try {
      const timeline = await this.api.pages<{
        type?: string;
        body?: string;
        source?: { issue?: { pull_request?: unknown; html_url: string } };
      }>(`/repos/${repo.fullName}/issues/${number}/timeline`, {}, 1000, signal);
      complete &&= timeline.complete;
      for (const event of timeline.items) {
        if (event.source?.issue?.pull_request) linked.push(event.source.issue.html_url);
        const urls = (event.body ?? '').match(/https:\/\/[^\s)>]+\/pulls\/\d+/g) ?? [];
        linked.push(...urls);
        if (
          event.type &&
          /ref|pull|connect/.test(event.type) &&
          !urls.length &&
          !event.source?.issue?.pull_request
        )
          complete = false;
        if (event.body && /reserved|claimed|working on this/i.test(event.body))
          events.push(event.body);
      }
    } catch {
      signal?.throwIfAborted();
      complete = false;
    }
    const pulls = await this.api.pages<FPull>(
      `/repos/${repo.fullName}/pulls`,
      { state: 'all' },
      300,
      signal,
    );
    complete &&= pulls.complete;
    const references = new RegExp(`(?:^|\\s)#${number}(?!\\d)`),
      confirmed = pulls.items.filter((p) => references.test(p.body) || p.body?.includes(issue.url)),
      possible = pulls.items.filter(
        (p) =>
          !confirmed.includes(p) &&
          similarity(issue, { title: p.title, body: p.body ?? '', files: [] }).verdict ===
            'possible_overlap',
      );
    if (possible.length) complete = false;
    issue = {
      ...issue,
      officialProvenance: author.verdict,
      knownLinkedPRs: [...new Set(linked)],
      competingPRs: confirmed.map((p) => p.html_url),
      competingPRScanComplete: complete,
      reserved: reservation(issue.body, issue.labels, events),
      repositoryPolicy: issueAcceptance(decision, issue.labels),
      evidence: [...author.evidence, ...decision.evidence],
      evidenceUrls: [
        ...issue.evidenceUrls,
        ...author.evidence.map((e) => e.source),
        ...decision.evidence.map((e) => e.source),
        ...possible.map((p) => p.html_url),
      ],
      confidence: 'medium',
    };
    return eligibility(
      { ...repo, public: !metadata.private, archived: metadata.archived },
      issue,
      relaxed,
    );
  }
  async find(repos: Repository[], p: Preferences, signal?: AbortSignal) {
    const candidates: IssueEvidence[] = [];
    for (const repo of repos) {
      const issues = await this.api.pages<RawIssue>(
        `/repos/${repo.fullName}/issues`,
        { state: 'open', type: 'issues' },
        100,
        signal,
      );
      for (const raw of issues.items.filter(
        (i) => !i.pull_request && i.comments === 0 && !i.assignees.length,
      )) {
        if (candidates.length >= 20) break;
        try {
          const checked = await this.verify(repo, raw.number, signal);
          candidates.push(
            checked.eligibility === 'ELIGIBLE' ? scoreCandidate(repo, checked, p) : checked,
          );
        } catch (error) {
          signal?.throwIfAborted();
          this.store.event(repo.id, 'verification-failed', {
            forge: 'forgejo',
            error: String(error),
          });
        }
      }
    }
    return { candidates, ...selectCandidate(candidates) };
  }
}
export class ForgejoPublication implements PublicationBackend {
  private native: GitHubPublicationBackend;
  constructor(
    readonly engine: ForgejoEngine,
    readonly auth: Credentials,
  ) {
    this.native = new GitHubPublicationBackend(engine.facade, auth);
  }
  async preflight(p: Proposal): Promise<void> {
    if (p.draft && !(await this.engine.api.supportsDraftPullRequests()))
      throw new Error(
        'Draft PR support could not be verified; publication is blocked before public writes',
      );
  }
  async fork(p: Proposal): Promise<Fork> {
    const name = p.repository.split('/').at(-1)!;
    let raw: FRepo;
    try {
      raw = await this.engine.api.request('GET', `/repos/${p.actor}/${name}`);
    } catch (error) {
      if (!(error instanceof ForgeError && error.status === 404)) throw error;
      raw = await this.engine.api.request('POST', `/repos/${p.repository}/forks`, {});
    }
    if (raw.parent?.full_name !== p.repository)
      throw new Error('Fork ancestry differs from selected project');
    safeHttps(raw.clone_url, [this.engine.api.config.host]);
    return { fullName: raw.full_name, cloneUrl: raw.clone_url };
  }
  commit(s: Session, p: Proposal, date: string) {
    return this.native.commit(s, p, date);
  }
  async push(s: Session, fork: Fork, sha: string, branch: string) {
    if (!s.workspace) throw new Error('Workspace required');
    try {
      const ref = await this.engine.facade.request<{ object: { sha: string } }>(
        'GET',
        `/repos/${fork.fullName}/git/ref/heads/${encodeURIComponent(branch)}`,
      );
      if (ref.object.sha === sha) return;
      throw new Error('Existing fork branch would be overwritten');
    } catch (error) {
      if (!(error instanceof ForgeError && error.status === 404)) throw error;
    }
    const actor = (await this.engine.api.request<{ login: string }>('GET', '/user')).login;
    await git(
      s.workspace,
      ['-c', 'credential.helper=', 'push', '--', fork.cloneUrl, `${sha}:refs/heads/${branch}`],
      undefined,
      {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `http.https://${this.engine.api.config.host}/.extraheader`,
        GIT_CONFIG_VALUE_0:
          'AUTHORIZATION: basic ' +
          Buffer.from(actor + ':' + (await this.auth.token())).toString('base64'),
      },
    );
  }
  async findExisting(p: Proposal, fork: Fork, sha: string): Promise<PublishedPR | undefined> {
    const pulls = await this.engine.api.pages<FPull>(
      `/repos/${p.repository}/pulls`,
      { state: 'all' },
      300,
    );
    if (!pulls.complete) throw new Error('Existing-PR scan incomplete');
    const matches = pulls.items.filter(
      (raw) =>
        raw.base.ref === p.base &&
        (raw as FPull & { head: { ref?: string; repo?: { full_name: string } } }).head.ref ===
          p.branch &&
        (raw as FPull & { head: { repo?: { full_name: string } } }).head.repo?.full_name ===
          fork.fullName,
    );
    if (matches.length > 1) throw new Error('Multiple PRs match the publication intent');
    const match = matches[0];
    if (!match) return;
    if (match.head.sha !== sha) throw new Error('Existing PR content differs');
    return { number: match.number, url: match.html_url, sha };
  }
  async open(p: Proposal, fork: Fork, sha: string): Promise<PublishedPR> {
    const existing = await this.findExisting(p, fork, sha);
    if (existing) return existing;
    await this.preflight(p);
    const raw = await this.engine.api.request<FPull>('POST', `/repos/${p.repository}/pulls`, {
      title: p.title,
      body: p.body,
      base: p.base,
      head: fork.fullName.split('/')[0] + ':' + p.branch,
      draft: p.draft,
    });
    if (raw.head.sha !== sha || (p.draft && raw.draft !== true))
      throw new Error('PR head is unconfirmed');
    return { number: raw.number, url: raw.html_url, sha };
  }
}
