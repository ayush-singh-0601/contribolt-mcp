import type { IssueEvidence, Repository, Preferences } from '../core/models.js';
import { defaults } from '../core/models.js';
import { searchLanguages } from '../onboarding/preferences.js';
export const weights = {
  language: 0.2,
  clarity: 0.2,
  testability: 0.2,
  maintenance: 0.15,
  policy: 0.15,
  recency: 0.1,
} as const;
export function weightedScore(dimensions: Record<keyof typeof weights, number>): number {
  return (
    Math.round(
      Object.entries(weights).reduce((sum, [key, weight]) => {
        const v = dimensions[key as keyof typeof weights];
        if (!Number.isFinite(v) || v < 0 || v > 1)
          throw new Error('Score dimensions must be normalized');
        return sum + weight * v;
      }, 0) * 10000,
    ) / 100
  );
}
export function scoreCandidate(
  repo: Repository,
  issue: IssueEvidence,
  preferences: Preferences,
): IssueEvidence {
  if (issue.eligibility !== 'ELIGIBLE') throw new Error('Hard gates must pass before scoring');
  const requested = searchLanguages(preferences),
    body = issue.body;
  const reproducible = /```|steps to reproduce|reproduction|expected.+actual/is.test(body);
  const focused = !/\b(rewrite|redesign|architecture overhaul|breaking change)\b/i.test(body);
  const dimensions = {
    language:
      !requested.length ||
      repo.languages.some((l) => requested.some((r) => r.toLowerCase() === l.toLowerCase()))
        ? 1
        : 0.2,
    clarity: reproducible ? 1 : body.length > 100 ? 0.65 : 0.25,
    testability: reproducible && focused ? 0.9 : focused ? 0.65 : 0.2,
    maintenance: repo.health,
    policy: issue.repositoryPolicy === 'ALLOWED_WITH_DISCLOSURE' ? 0.9 : 0.85,
    recency: Date.now() - Date.parse(repo.updatedAt) < 90 * 86400000 ? 1 : 0.4,
  };
  if (preferences.difficulty === 'small' && !focused) dimensions.testability = 0.1;
  return { ...issue, dimensions, score: weightedScore(dimensions) };
}
export function selectCandidate(
  candidates: IssueEvidence[],
  threshold: number = defaults.minScore,
) {
  const ranked = candidates
    .filter(
      (c) => c.eligibility === 'ELIGIBLE' && c.confidence !== 'low' && (c.score ?? 0) >= threshold,
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.url.localeCompare(b.url));
  if (ranked[0])
    return {
      selected: ranked[0],
      ranked,
      message: `No known competing PR found as of ${ranked[0].checkedAt}. Score is a heuristic, not a merge probability.`,
    };
  const rejectionCounts: Record<string, number> = {};
  for (const c of candidates)
    for (const reason of c.rejectReasons)
      rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
  return {
    selected: undefined,
    ranked,
    rejectionCounts,
    message: 'No verified matches',
    options: [
      'expand repositories',
      'try later',
      'request explicit relaxation of one selected filter',
    ],
  };
}
