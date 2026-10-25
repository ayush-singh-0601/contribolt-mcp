import { IssueSchema, type IssueEvidence, type Repository } from '../core/models.js';
import type { GitHubClient } from '../github/client.js';
import type { Relaxable } from './eligibility.js';
export interface RawIssue {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: string;
  comments: number;
  assignees: { login: string }[];
  user: { login: string; type?: string };
  author_association: string;
  labels: ({ name: string } | string)[];
  pull_request?: unknown;
  milestone?: { title: string; description?: string };
}
export function mapIssue(repo: Repository, raw: RawIssue): IssueEvidence {
  return IssueSchema.parse({
    url: raw.html_url,
    repoFullName: repo.fullName,
    issueNumber: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    checkedAt: new Date().toISOString(),
    open: raw.state === 'open',
    isPullRequest: !!raw.pull_request,
    discussionComments: raw.comments,
    assignees: raw.assignees.map((a) => a.login),
    authorLogin: raw.user.login,
    authorAssociation: raw.author_association,
    officialProvenance: 'UNKNOWN',
    knownLinkedPRs: [],
    competingPRs: [],
    competingPRScanComplete: false,
    labels: raw.labels.map((l) => (typeof l === 'string' ? l : l.name)),
    repositoryPolicy: 'UNKNOWN',
    eligibility: 'UNKNOWN',
    rejectReasons: [],
    confidence: 'low',
    evidenceUrls: [raw.html_url],
  });
}
export async function issueCandidates(
  client: GitHubClient,
  repo: Repository,
  limit = 30,
  signal?: AbortSignal,
  relaxed: Relaxable[] = [],
): Promise<IssueEvidence[]> {
  const result = await client.pages<RawIssue>(
    '/search/issues',
    {
      q: `repo:${repo.fullName} is:issue is:open${relaxed.includes('comments') ? '' : ' comments:0'}${relaxed.includes('assignees') ? '' : ' no:assignee'}`,
      sort: 'updated',
    },
    limit,
    signal,
  );
  return result.items.map((i) => mapIssue(repo, i));
}
export async function refreshIssue(
  client: GitHubClient,
  repo: Repository,
  number: number,
  signal?: AbortSignal,
): Promise<IssueEvidence> {
  const issue = await client.request<RawIssue>(
    'GET',
    `/repos/${repo.fullName}/issues/${number}`,
    {},
    signal,
  );
  return mapIssue(repo, issue);
}
