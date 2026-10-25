import type { GitHubClient } from '../github/client.js';
import type { Repository } from '../core/models.js';
interface TimelineNode {
  source?: { __typename: string; url?: string };
}
export async function linkedPullRequests(
  client: GitHubClient,
  repo: Repository,
  number: number,
  signal?: AbortSignal,
): Promise<{ urls: string[]; complete: boolean; reservations: string[] }> {
  const [owner, name] = repo.fullName.split('/'),
    urls = new Set<string>(),
    reservations: string[] = [];
  let cursor: string | null = null,
    complete = false;
  try {
    for (let page = 0; page < 10; page++) {
      const data: {
        repository: {
          issue: {
            timelineItems: {
              nodes: TimelineNode[];
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            };
          } | null;
        };
      } = await client.graphql(
        `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){issue(number:$number){timelineItems(first:100,after:$cursor,itemTypes:[CROSS_REFERENCED_EVENT]){nodes{... on CrossReferencedEvent{source{__typename ... on PullRequest{url}}}}pageInfo{hasNextPage endCursor}}}}}`,
        { owner, name, number, cursor },
        signal,
      );
      const timeline = data.repository.issue?.timelineItems;
      if (!timeline) break;
      for (const node of timeline.nodes)
        if (node.source?.__typename === 'PullRequest' && node.source.url) urls.add(node.source.url);
      if (!timeline.pageInfo.hasNextPage) {
        complete = true;
        break;
      }
      cursor = timeline.pageInfo.endCursor;
    }
  } catch {
    signal?.throwIfAborted();
    complete = false;
  }
  try {
    const timeline = await client.pages<{
      event: string;
      body?: string;
      source?: { issue?: { pull_request?: unknown; html_url: string } };
    }>(`/repos/${repo.fullName}/issues/${number}/timeline`, {}, 1000, signal);
    complete = complete && timeline.complete;
    for (const event of timeline.items) {
      if (event.source?.issue?.pull_request) urls.add(event.source.issue.html_url);
      if (event.body && /\b(?:reserved|claimed|working on this)\b/i.test(event.body))
        reservations.push(event.body.slice(0, 500));
    }
  } catch {
    signal?.throwIfAborted();
    complete = false;
  }
  return { urls: [...urls], complete, reservations };
}
