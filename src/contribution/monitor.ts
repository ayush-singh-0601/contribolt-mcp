import type { Store } from '../state/store.js';
import type { GitHubClient } from '../github/client.js';
import { defaults } from '../core/models.js';
export interface Feedback {
  id: string;
  kind: 'ci' | 'review' | 'comment';
  author: string;
  bot: boolean;
  body: string;
  url: string;
  path?: string;
  line?: number;
  state?: string;
  commitSha?: string;
}
export interface MonitorSnapshot {
  checkedAt: string;
  nextPollAt: number;
  outcome: 'opened' | 'merged' | 'closed_without_merge';
  headSha: string;
  ci: { name: string; status: string; url: string }[];
  feedback: Feedback[];
  complete: boolean;
}
interface Comment {
  id: number;
  user: { login: string; type: string };
  body: string | null;
  html_url: string;
  path?: string;
  line?: number;
  state?: string;
  commit_id?: string;
}
export async function monitorPullRequest(
  store: Store,
  id: string,
  client: GitHubClient,
  force = false,
  signal?: AbortSignal,
): Promise<MonitorSnapshot> {
  const s = store.get(id);
  if (s.stopped || !s.prNumber || !s.repository)
    throw new Error('Active published session required');
  const cached = store.read<MonitorSnapshot>('monitor', id),
    now = Date.now();
  if (cached && now < (force ? Date.parse(cached.checkedAt) + 10000 : cached.nextPollAt))
    return cached;
  const base = `/repos/${s.repository.fullName}`,
    pull = `${base}/pulls/${s.prNumber}`;
  const pr = await client.request<{
    state: string;
    merged_at: string | null;
    head: { sha: string };
  }>('GET', pull, {}, signal);
  const safePages = async (path: string) => {
    try {
      return await client.pages<Comment>(path, {}, 500, signal);
    } catch {
      signal?.throwIfAborted();
      return { items: [] as Comment[], complete: false };
    }
  };
  const reviews = await safePages(pull + '/reviews'),
    inline = await safePages(pull + '/comments'),
    discussion = await safePages(`${base}/issues/${s.prNumber}/comments`);
  const feedback: Feedback[] = [
    ...reviews.items.map((c) => ({ ...c, kind: 'review' as const })),
    ...inline.items.map((c) => ({ ...c, kind: 'review' as const })),
    ...discussion.items.map((c) => ({ ...c, kind: 'comment' as const })),
  ].map((c) => ({
    id: c.kind + ':' + c.id,
    kind: c.kind,
    author: c.user.login,
    bot: c.user.type === 'Bot' || c.user.login.endsWith('[bot]'),
    body: c.body ?? '',
    url: c.html_url,
    path: c.path,
    line: c.line,
    state: c.state,
    commitSha: c.commit_id,
  }));
  let ci: MonitorSnapshot['ci'] = [],
    complete = reviews.complete && inline.complete && discussion.complete;
  try {
    const checks = await client.request<{
      unavailable?: boolean;
      total_count: number;
      check_runs: { name: string; status: string; conclusion: string | null; html_url: string }[];
    }>('GET', `${base}/commits/${pr.head.sha}/check-runs`, { per_page: 100 }, signal);
    const status = await client.request<{
      statuses: { context: string; state: string; target_url: string }[];
    }>('GET', `${base}/commits/${pr.head.sha}/status`, {}, signal);
    ci = [
      ...checks.check_runs.map((c) => ({
        name: c.name,
        status: c.conclusion ?? c.status,
        url: c.html_url,
      })),
      ...status.statuses.map((c) => ({ name: c.context, status: c.state, url: c.target_url })),
    ];
    if (checks.unavailable) {
      ci.push({ name: 'Additional CI checks', status: 'UNAVAILABLE', url: s.prUrl ?? '' });
      complete = false;
    }
    if (checks.total_count > checks.check_runs.length) complete = false;
  } catch {
    signal?.throwIfAborted();
    ci = [{ name: 'CI metadata', status: 'UNAVAILABLE', url: s.prUrl ?? '' }];
    complete = false;
  }
  const outcome = pr.merged_at
    ? 'merged'
    : pr.state === 'closed'
      ? 'closed_without_merge'
      : 'opened';
  const snapshot: MonitorSnapshot = {
    checkedAt: new Date().toISOString(),
    nextPollAt: now + Math.round(defaults.pollMs * (0.95 + Math.random() * 0.1)),
    outcome,
    headSha: pr.head.sha,
    ci,
    feedback,
    complete,
  };
  store.put('monitor', id, snapshot);
  store.put('outcomes', id, { outcome, checkedAt: snapshot.checkedAt, prUrl: s.prUrl });
  store.mutate(id, (x) => {
    if (outcome !== 'opened') x.state = 'DONE';
    else if (
      feedback.some(
        (f) => f.state === 'CHANGES_REQUESTED' && (!f.commitSha || f.commitSha === pr.head.sha),
      ) ||
      ci.some((c) => ['failure', 'timed_out', 'error', 'cancelled'].includes(c.status))
    )
      x.state = 'REVISIONS_IF_NEEDED';
    else x.state = 'REVIEW_MONITORING';
  });
  store.event(id, 'pr-monitored', {
    outcome,
    headSha: pr.head.sha,
    ciCount: ci.length,
    feedbackCount: feedback.length,
    complete,
  });
  return snapshot;
}
