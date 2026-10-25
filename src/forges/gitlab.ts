import { issueAcceptance } from '../repository/manifests.js';
import {
  IssueSchema,
  RepoSchema,
  type Repository,
  type Preferences,
  type IssueEvidence,
  type Proposal,
  type Session,
} from '../core/models.js';
import { JsonForgeClient } from './http.js';
import type { Store } from '../state/store.js';
import { policyKey } from '../repository/policy-store.js';
import { classifyPolicy } from '../repository/policies.js';
import type { PolicyDocument } from '../repository/policy-sources.js';
import { eligibility, reservation, type Relaxable } from '../discovery/eligibility.js';
import { scoreCandidate, selectCandidate } from '../discovery/ranking.js';
import { listedMaintainer } from '../discovery/authorship.js';
import { similarity } from '../discovery/similarity.js';
import { GitHubClient, ForgeError } from '../github/client.js';
import type { Credentials } from '../github/auth.js';
import {
  GitHubPublicationBackend,
  type PublicationBackend,
  type Fork,
  type PublishedPR,
} from '../contribution/publisher.js';
import { git } from '../git/workspace.js';
import { safeHttps } from '../security/boundaries.js';
interface User {
  id: number;
  username: string;
  name?: string;
  bot?: boolean;
}
interface Project {
  id: number;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  default_branch: string;
  visibility: string;
  archived: boolean;
  issues_enabled: boolean;
  star_count: number;
  last_activity_at: string;
  namespace: { kind: string; path: string };
  forked_from_project?: { id: number };
}
interface GLIssue {
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  confidential: boolean;
  user_notes_count: number;
  assignees: User[];
  author: User;
  labels: string[];
}
interface MR {
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  merged_at: string | null;
  sha: string;
  source_project_id: number;
  source_branch: string;
  target_branch: string;
  reviewers?: User[];
}
interface Note {
  id: number;
  body: string;
  system: boolean;
  author: User;
  created_at: string;
  position?: { new_path: string; new_line: number };
}
const projectPath = (repo: Repository | string) =>
  '/projects/' + encodeURIComponent(typeof repo === 'string' ? repo : repo.id);
export class GitLabEngine {
  constructor(
    readonly api: JsonForgeClient,
    readonly store: Store,
  ) {}
  async repositories(p: Preferences, signal?: AbortSignal): Promise<Repository[]> {
    const projects = p.preferredRepository
      ? [
          await this.api.request<Project>(
            'GET',
            projectPath(p.preferredRepository),
            undefined,
            {},
            signal,
          ),
        ]
      : (
          await this.api.pages<Project>(
            '/projects',
            {
              visibility: 'public',
              archived: false,
              with_issues_enabled: true,
              order_by: 'last_activity_at',
              sort: 'desc',
              search: p.optionalDomain,
              with_programming_language: p.languages[0],
            },
            30,
            signal,
          )
        ).items;
    const result: Repository[] = [];
    for (const raw of projects) {
      const languages = await this.api.request<Record<string, number>>(
        'GET',
        projectPath(String(raw.id)) + '/languages',
        undefined,
        {},
        signal,
      );
      result.push(
        RepoSchema.parse({
          forge: 'gitlab',
          host: this.api.config.host,
          id: String(raw.id),
          fullName: raw.path_with_namespace,
          url: raw.web_url,
          cloneUrl: raw.http_url_to_repo,
          defaultBranch: raw.default_branch,
          public: raw.visibility === 'public',
          archived: raw.archived,
          fork: !!raw.forked_from_project,
          hasIssues: raw.issues_enabled,
          languages: Object.keys(languages),
          stars: raw.star_count,
          updatedAt: raw.last_activity_at,
          health: Date.now() - Date.parse(raw.last_activity_at) < 90 * 86400000 ? 0.7 : 0.2,
        }),
      );
    }
    return result;
  }
  async policies(repo: Repository, signal?: AbortSignal) {
    const branch = await this.api.request<{ commit: { id: string } }>(
        'GET',
        projectPath(repo) + '/repository/branches/' + encodeURIComponent(repo.defaultBranch),
        undefined,
        {},
        signal,
      ),
      commit = branch.commit.id;
    const tree = await this.api.pages<{ path: string; type: string }>(
      projectPath(repo) + '/repository/tree',
      { recursive: true, ref: commit },
      2000,
      signal,
    );
    const paths = tree.items.filter(
      (f) =>
        f.type === 'blob' &&
        (f.path === '.mergepilot/policy.json' ||
          /(^|\/)(?:README[^/]*|CONTRIBUTING[^/]*|LICENSE[^/]*|SECURITY[^/]*|CODE_OF_CONDUCT[^/]*|AGENTS\.md|CLAUDE\.md|MAINTAINERS[^/]*|CODEOWNERS|.*instructions.*|.*[Tt]emplate.*)$|^\.gitlab\/(?:merge_request_templates|issue_templates)\//i.test(
            f.path,
          )),
    );
    const documents: PolicyDocument[] = [];
    let complete = tree.complete && paths.length <= 80;
    for (const file of paths.slice(0, 80)) {
      try {
        const raw = await this.api.request<{
          content: string;
          encoding: string;
          blob_id: string;
          size: number;
        }>(
          'GET',
          projectPath(repo) + '/repository/files/' + encodeURIComponent(file.path),
          undefined,
          { ref: commit },
          signal,
        );
        if (raw.encoding !== 'base64' || raw.size > 200000) {
          complete = false;
          continue;
        }
        documents.push({
          path: file.path,
          text: Buffer.from(raw.content, 'base64').toString(),
          url: repo.url + '/-/blob/' + commit + '/' + file.path,
          sha: raw.blob_id,
          scope: file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '',
          organizationDefault: false,
        });
      } catch {
        signal?.throwIfAborted();
        complete = false;
      }
    }
    const decision = classifyPolicy(documents, complete, repo);
    decision.templates = documents.filter((d) =>
      /^\.gitlab\/merge_request_templates\//.test(d.path),
    );
    const bundle = { documents, complete, commit, decision };
    this.store.put('policies', policyKey(repo), bundle);
    return bundle;
  }
  async verify(
    repo: Repository,
    number: number,
    signal?: AbortSignal,
    relaxed: Relaxable[] = [],
  ): Promise<IssueEvidence> {
    const raw = await this.api.request<GLIssue>(
        'GET',
        projectPath(repo) + '/issues/' + number,
        undefined,
        {},
        signal,
      ),
      project = await this.api.request<Project>('GET', projectPath(repo), undefined, {}, signal);
    const policy = await this.policies(repo, signal);
    let provenance: IssueEvidence['officialProvenance'] = 'UNKNOWN';
    if (project.namespace.kind === 'user' && project.namespace.path === raw.author.username)
      provenance = 'ELIGIBLE';
    else
      try {
        const role = await this.api.request<{ access_level: number }>(
          'GET',
          projectPath(repo) + '/members/all/' + raw.author.id,
          undefined,
          {},
          signal,
        );
        if (role.access_level >= 40) provenance = 'ELIGIBLE';
      } catch {
        signal?.throwIfAborted();
      }
    if (
      policy.documents.some(
        (d) =>
          /MAINTAINERS/.test(d.path) &&
          listedMaintainer(
            d.text.replaceAll('https://' + repo.host + '/', 'https://github.com/'),
            raw.author.username,
          ),
      )
    )
      provenance = 'ELIGIBLE';
    const notes = await this.api.pages<Note>(
        projectPath(repo) + '/issues/' + number + '/notes',
        {},
        1000,
        signal,
      ),
      linked = await this.api.pages<MR>(
        projectPath(repo) + '/issues/' + number + '/related_merge_requests',
        {},
        1000,
        signal,
      );
    const searches = await this.api.pages<MR>(
      projectPath(repo) + '/merge_requests',
      {
        state: 'all',
        scope: 'all',
        search: raw.title
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 3)
          .join(' '),
      },
      200,
      signal,
    );
    const confirmed = searches.items.filter((m) =>
        new RegExp(`(?:^|\\s)#${number}(?!\\d)`).test(m.description ?? ''),
      ),
      possible = searches.items.filter(
        (m) =>
          !confirmed.includes(m) &&
          similarity(
            { title: raw.title, body: raw.description ?? '' },
            { title: m.title, body: m.description ?? '', files: [] },
          ).verdict === 'possible_overlap',
      );
    const issue = IssueSchema.parse({
      url: raw.web_url,
      repoFullName: repo.fullName,
      issueNumber: raw.iid,
      title: raw.title,
      body: raw.description ?? '',
      checkedAt: new Date().toISOString(),
      open: raw.state === 'opened' && !raw.confidential,
      discussionComments: notes.items.filter((n) => !n.system).length,
      assignees: raw.assignees.map((a) => a.username),
      authorLogin: raw.author.username,
      authorAssociation: provenance === 'ELIGIBLE' ? 'VERIFIED_MAINTAINER' : 'UNKNOWN',
      officialProvenance: provenance,
      knownLinkedPRs: linked.items.map((m) => m.web_url),
      competingPRs: confirmed.map((m) => m.web_url),
      competingPRScanComplete:
        notes.complete && linked.complete && searches.complete && !possible.length,
      reserved: reservation(
        raw.description ?? '',
        raw.labels,
        notes.items
          .filter((n) => n.system && /reserved|claimed|working on/i.test(n.body))
          .map((n) => n.body),
      ),
      labels: raw.labels,
      repositoryPolicy: issueAcceptance(policy.decision, raw.labels),
      eligibility: 'UNKNOWN',
      rejectReasons: [],
      confidence: 'medium',
      evidence: policy.decision.evidence,
      evidenceUrls: [
        raw.web_url,
        ...policy.documents.map((d) => d.url),
        ...possible.map((m) => m.web_url),
      ],
    });
    return eligibility(
      { ...repo, public: project.visibility === 'public', archived: project.archived },
      issue,
      relaxed,
    );
  }
  async find(
    repos: Repository[],
    p: Preferences,
    signal?: AbortSignal,
    relaxed: Relaxable[] = [],
    skipped: string[] = [],
  ) {
    const candidates: IssueEvidence[] = [];
    for (const repo of repos) {
      const issues = await this.api.pages<GLIssue>(
        projectPath(repo) + '/issues',
        { state: 'opened', scope: 'all' },
        30,
        signal,
      );
      for (const issue of issues.items.filter(
        (i) =>
          (relaxed.includes('comments') || i.user_notes_count === 0) &&
          (relaxed.includes('assignees') || !i.assignees.length) &&
          !skipped.includes(i.web_url),
      )) {
        if (candidates.length >= 20) break;
        try {
          const checked = await this.verify(repo, issue.iid, signal, relaxed);
          candidates.push(
            checked.eligibility === 'ELIGIBLE' ? scoreCandidate(repo, checked, p) : checked,
          );
        } catch (error) {
          signal?.throwIfAborted();
          this.store.event(repo.id, 'verification-failed', {
            forge: 'gitlab',
            error: String(error),
          });
        }
      }
    }
    return { candidates, ...selectCandidate(candidates) };
  }
}
export class GitLabFacade extends GitHubClient {
  constructor(readonly engine: GitLabEngine) {
    super({ kind: 'token', token: async () => engine.api.token });
  }
  override async request<T>(
    method: string,
    path: string,
    params: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const api = this.engine.api;
    if (path === '/user') {
      const user = await api.request<User>('GET', '/user', undefined, {}, signal);
      return { ...user, login: user.username } as T;
    }
    const branch = path.match(/^\/repos\/(.+)\/git\/ref\/heads\/(.+)$/);
    if (branch) {
      const raw = await api.request<{ commit: { id: string } }>(
        'GET',
        projectPath(branch[1]!) + '/repository/branches/' + branch[2],
        undefined,
        {},
        signal,
      );
      return { object: { sha: raw.commit.id } } as T;
    }
    const pulls = path.match(/^\/repos\/(.+)\/pulls\/(\d+)(.*)$/);
    if (pulls) {
      const base = projectPath(pulls[1]!),
        number = pulls[2]!,
        suffix = pulls[3]!,
        mrPath = base + '/merge_requests/' + number;
      if (!suffix) {
        const raw = await api.request<MR>(
          method === 'PATCH' ? 'PUT' : method,
          mrPath,
          method === 'PATCH' ? { title: params.title, description: params.body } : undefined,
          {},
          signal,
        );
        return {
          ...raw,
          number: raw.iid,
          html_url: raw.web_url,
          body: raw.description,
          head: { sha: raw.sha },
        } as T;
      }
      if (suffix === '/requested_reviewers') {
        let mr = await api.request<MR>('GET', mrPath, undefined, {}, signal);
        if (method === 'POST') {
          if ((params.team_reviewers as string[] | undefined)?.length)
            throw new ForgeError(
              'GitLab team review routing requires project-specific approval rules',
              422,
            );
          const ids = new Set((mr.reviewers ?? []).map((u) => u.id));
          for (const login of params.reviewers as string[]) {
            const users = await api.request<User[]>(
              'GET',
              '/users',
              undefined,
              { username: login },
              signal,
            );
            const exact = users.find((u) => u.username === login);
            if (!exact) throw new ForgeError('Reviewer not found', 404);
            ids.add(exact.id);
          }
          mr = await api.request<MR>('PUT', mrPath, { reviewer_ids: [...ids] }, {}, signal);
        }
        return { users: (mr.reviewers ?? []).map((u) => ({ login: u.username })), teams: [] } as T;
      }
      if (suffix === '/reviews') {
        const approvals = await api.request<{ approved_by: { user: User }[] }>(
          'GET',
          mrPath + '/approvals',
          undefined,
          {},
          signal,
        );
        return approvals.approved_by.map((a) => ({
          id: a.user.id,
          user: { login: a.user.username, type: a.user.bot ? 'Bot' : 'User' },
          body: 'Approval observed in GitLab approval state',
          html_url: `https://${api.config.host}/${pulls[1]}/-/merge_requests/${number}`,
          state: 'APPROVED',
        })) as T;
      }
      if (suffix === '/comments') {
        const discussions = await api.request<{ notes: Note[] }[]>(
          'GET',
          mrPath + '/discussions',
          undefined,
          params,
          signal,
        );
        return discussions.flatMap((d) =>
          d.notes
            .filter((n) => !n.system && n.position)
            .map((n) => this.note(n, number, pulls[1]!)),
        ) as T;
      }
    }
    const comments = path.match(/^\/repos\/(.+)\/issues\/(\d+)\/comments$/);
    if (comments) {
      const base = projectPath(comments[1]!) + '/merge_requests/' + comments[2] + '/notes';
      if (method === 'POST')
        return await api.request('POST', base, { body: params.body }, {}, signal);
      const notes = await api.request<Note[]>('GET', base, undefined, params, signal);
      return notes
        .filter((n) => !n.system && !n.position)
        .map((n) => this.note(n, comments[2]!, comments[1]!)) as T;
    }
    const privileges = path.match(/^\/repos\/(.+)\/collaborators\/(.+)\/permission$/);
    if (privileges) {
      const users = await api.request<User[]>(
          'GET',
          '/users',
          undefined,
          { username: decodeURIComponent(privileges[2]!) },
          signal,
        ),
        user = users[0];
      if (!user) throw new ForgeError('Unknown user', 404);
      const member = await api.request<{ access_level: number }>(
        'GET',
        projectPath(privileges[1]!) + '/members/all/' + user.id,
        undefined,
        {},
        signal,
      );
      return {
        role_name:
          member.access_level >= 40 ? 'maintain' : member.access_level >= 30 ? 'write' : 'read',
      } as T;
    }
    const ci = path.match(/^\/repos\/(.+)\/commits\/(.+)\/(check-runs|status)$/);
    if (ci) {
      if (ci[3] === 'status') return { statuses: [] } as T;
      const states = await api.request<{ name: string; status: string; target_url: string }[]>(
        'GET',
        projectPath(ci[1]!) + '/repository/commits/' + ci[2] + '/statuses',
        undefined,
        { per_page: 100 },
        signal,
      );
      return {
        total_count: states.length,
        check_runs: states.map((s) => ({
          name: s.name,
          status: s.status === 'pending' || s.status === 'running' ? 'in_progress' : 'completed',
          conclusion: s.status === 'success' ? 'success' : s.status === 'failed' ? 'failure' : null,
          html_url: s.target_url,
        })),
      } as T;
    }
    const repo = path.match(/^\/repos\/(.+)$/);
    if (repo) {
      const raw = await api.request<Project>('GET', projectPath(repo[1]!), undefined, {}, signal);
      return {
        archived: raw.archived,
        private: raw.visibility !== 'public',
        default_branch: raw.default_branch,
      } as T;
    }
    throw new ForgeError('This GitLab capability is unavailable', 404);
  }
  private note(n: Note, number: string, repository: string) {
    return {
      id: n.id,
      user: { login: n.author.username, type: n.author.bot ? 'Bot' : 'User' },
      body: n.body,
      html_url: `https://${this.engine.api.config.host}/${repository}/-/merge_requests/${number}#note_${n.id}`,
      path: n.position?.new_path,
      line: n.position?.new_line,
    };
  }
}
export class GitLabPublication implements PublicationBackend {
  private native: GitHubPublicationBackend;
  constructor(
    readonly engine: GitLabEngine,
    readonly auth: Credentials,
  ) {
    this.native = new GitHubPublicationBackend(new GitLabFacade(engine), auth);
  }
  async fork(p: Proposal): Promise<Fork> {
    const api = this.engine.api,
      base = await api.request<Project>('GET', projectPath(p.repository)),
      owned = await api.pages<Project>(
        '/projects',
        { owned: true, search: p.repository.split('/').at(-1) },
        200,
      );
    let fork = owned.items.find((r) => r.forked_from_project?.id === base.id);
    if (!fork) fork = await api.request<Project>('POST', projectPath(p.repository) + '/fork', {});
    safeHttps(fork.http_url_to_repo, [api.config.host]);
    return { fullName: fork.path_with_namespace, cloneUrl: fork.http_url_to_repo };
  }
  commit(s: Session, p: Proposal, date: string) {
    return this.native.commit(s, p, date);
  }
  async push(s: Session, fork: Fork, sha: string, branch: string): Promise<void> {
    if (!s.workspace) throw new Error('Workspace required');
    const api = this.engine.api;
    try {
      const ref = await api.request<{ commit: { id: string } }>(
        'GET',
        projectPath(fork.fullName) + '/repository/branches/' + encodeURIComponent(branch),
      );
      if (ref.commit.id === sha) return;
      throw new Error('Fork branch collision');
    } catch (error) {
      if (!(error instanceof ForgeError && error.status === 404)) throw error;
    }
    await git(
      s.workspace,
      ['-c', 'credential.helper=', 'push', '--', fork.cloneUrl, `${sha}:refs/heads/${branch}`],
      undefined,
      {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `http.https://${api.config.host}/.extraheader`,
        GIT_CONFIG_VALUE_0:
          'AUTHORIZATION: basic ' +
          Buffer.from('oauth2:' + (await this.auth.token())).toString('base64'),
      },
    );
  }
  async findExisting(p: Proposal, fork: Fork, sha: string): Promise<PublishedPR | undefined> {
    const result = await this.engine.api.pages<MR>(
      projectPath(p.repository) + '/merge_requests',
      { scope: 'all', state: 'all', source_branch: p.branch, target_branch: p.base },
      200,
    );
    const project = await this.engine.api.request<Project>('GET', projectPath(fork.fullName));
    const matching = result.items.filter((m) => m.source_project_id === project.id);
    if (matching.length > 1) throw new Error('Ambiguous existing merge requests');
    const match = matching[0];
    if (!match) return;
    if (match.sha !== sha) throw new Error('Existing merge request differs from approved commit');
    return { number: match.iid, url: match.web_url, sha };
  }
  async open(p: Proposal, fork: Fork, sha: string): Promise<PublishedPR> {
    const found = await this.findExisting(p, fork, sha);
    if (found) return found;
    const api = this.engine.api,
      source = await api.request<Project>('GET', projectPath(fork.fullName)),
      target = await api.request<Project>('GET', projectPath(p.repository));
    const mr = await api.request<MR>(
      'POST',
      projectPath(source.path_with_namespace) + '/merge_requests',
      {
        source_branch: p.branch,
        target_branch: p.base,
        target_project_id: target.id,
        title: p.draft ? 'Draft: ' + p.title : p.title,
        description: p.body,
        allow_collaboration: true,
      },
    );
    if (mr.sha !== sha) throw new Error('Merge request head is unconfirmed');
    return { number: mr.iid, url: mr.web_url, sha };
  }
}
