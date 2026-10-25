import type { IssueEvidence, Repository } from '../core/models.js';
export type Relaxable = 'comments' | 'assignees' | 'provenance' | 'linked_work';
export function reservation(
  body: string,
  labels: string[],
  events: string[] = [],
  projectEvidenceComplete = true,
): boolean | null {
  if (
    events.length ||
    /\b(?:reserved for|claimed by|already working on|maintainers only|do not (?:open|submit) (?:a )?(?:pr|pull request))\b/i.test(
      body,
    ) ||
    labels.some((l) => /^(reserved|in progress|claimed|help not wanted)$/i.test(l))
  )
    return true;
  if (!projectEvidenceComplete || /github\.com\/[^\s]+\/projects\//i.test(body)) return null;
  return false;
}
export function eligibility(
  repo: Repository,
  issue: IssueEvidence,
  authorizedRelaxations: Relaxable[] = [],
): IssueEvidence {
  const failures: string[] = [],
    unknown: string[] = [],
    relaxed = new Set(authorizedRelaxations);
  if (!repo.public || repo.archived || !repo.hasIssues || repo.exclusions.length)
    failures.push('Repository is not an accessible contribution-accepting public project');
  if (!issue.open) failures.push('Issue is closed');
  if (issue.isPullRequest) failures.push('Candidate is a pull request');
  if (issue.discussionComments !== 0 && !relaxed.has('comments'))
    failures.push('Issue has discussion comments');
  if (issue.assignees.length && !relaxed.has('assignees')) failures.push('Issue is assigned');
  if (!relaxed.has('provenance')) {
    if (issue.officialProvenance === 'UNKNOWN') unknown.push('Maintainer provenance is unknown');
    else if (issue.officialProvenance !== 'ELIGIBLE')
      failures.push('Author is not verified official');
  }
  if (!relaxed.has('linked_work')) {
    if (issue.knownLinkedPRs.length || issue.competingPRs.length)
      failures.push('Linked or competing pull request exists');
    if (!issue.competingPRScanComplete)
      unknown.push('Competing-work scan is incomplete or unresolved');
  }
  if (
    issue.labels.some((l) =>
      /^(?:wont[ -]?fix|won't fix|duplicate|invalid|blocked|not planned|on hold|do not contribute)$/i.test(
        l,
      ),
    )
  )
    failures.push('Restrictive project label');
  if (issue.reserved === true) failures.push('Issue is reserved');
  else if (issue.reserved === null) unknown.push('Reservation evidence unresolved');
  if (issue.repositoryPolicy === 'PROHIBITED')
    failures.push('Project prohibits the planned contribution');
  else if (['UNKNOWN', 'NEEDS_HUMAN_APPROVAL'].includes(issue.repositoryPolicy))
    unknown.push('Contribution policy requires resolution');
  return {
    ...issue,
    eligibility: failures.length ? 'INELIGIBLE' : unknown.length ? 'UNKNOWN' : 'ELIGIBLE',
    rejectReasons: [...failures, ...unknown],
    confidence:
      failures.length || unknown.length ? 'low' : issue.confidence === 'high' ? 'high' : 'medium',
  };
}
