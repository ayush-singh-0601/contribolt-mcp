import type { Repository } from '../core/models.js';
import type { GitHubClient } from '../github/client.js';
export function healthScore(
  updatedAt: string,
  pulls: { merged_at: string | null; updated_at: string }[],
  now = Date.now(),
): number {
  const days = Math.max(0, (now - Date.parse(updatedAt)) / 86400000);
  const recency = days <= 30 ? 1 : days <= 90 ? 0.75 : days <= 180 ? 0.4 : 0;
  const merged = pulls.filter(
    (p) => p.merged_at && now - Date.parse(p.merged_at) < 180 * 86400000,
  ).length;
  return 0.5 * recency + 0.5 * Math.min(1, merged / 5);
}
export async function inspectHealth(
  client: GitHubClient,
  repo: Repository,
  signal?: AbortSignal,
): Promise<Repository> {
  const languages = await client.request<Record<string, number>>(
    'GET',
    `/repos/${repo.fullName}/languages`,
    {},
    signal,
  );
  const pulls = await client.request<{ merged_at: string | null; updated_at: string }[]>(
    'GET',
    `/repos/${repo.fullName}/pulls`,
    { state: 'closed', sort: 'updated', direction: 'desc', per_page: 30 },
    signal,
  );
  const exclusions = [...repo.exclusions];
  const healthObservations = [
    ...repo.healthObservations,
    `Default branch ${repo.defaultBranch}; ${repo.fork ? 'fork' : 'source repository'}; latest push ${repo.updatedAt}`,
    `Observed ${pulls.filter((p) => p.merged_at).length} merged PRs in the recent sample`,
  ];
  let latestReleaseAt: string | undefined;
  try {
    const release = await client.request<{ published_at: string | null }>(
      'GET',
      `/repos/${repo.fullName}/releases/latest`,
      {},
      signal,
    );
    latestReleaseAt = release.published_at ?? undefined;
    healthObservations.push(
      latestReleaseAt ? 'Latest release ' + latestReleaseAt : 'No published release timestamp',
    );
  } catch {
    signal?.throwIfAborted();
    healthObservations.push('Latest release unavailable or no published release');
  }
  if (!repo.public || repo.archived || !repo.hasIssues)
    exclusions.push('Repository does not accept public issues');
  if (
    Date.now() - Date.parse(repo.updatedAt) > 365 * 86400000 &&
    !pulls.some((p) => p.merged_at && Date.now() - Date.parse(p.merged_at) < 180 * 86400000)
  )
    exclusions.push('No recent maintenance evidence');
  return {
    ...repo,
    languages: Object.keys(languages),
    health: healthScore(repo.updatedAt, pulls),
    exclusions,
    healthObservations,
    latestReleaseAt,
  };
}
