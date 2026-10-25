import { it, expect } from 'vitest';
import { eligibility, reservation } from '../src/discovery/eligibility.js';
import { IssueSchema, type Repository } from '../src/core/models.js';
const repo = { public: true, archived: false, hasIssues: true, exclusions: [] } as Repository;
export const eligibleIssue = () =>
  IssueSchema.parse({
    url: 'https://github.com/o/r/issues/1',
    repoFullName: 'o/r',
    issueNumber: 1,
    title: 'Reproduce a specific bug',
    body: '',
    checkedAt: new Date().toISOString(),
    open: true,
    discussionComments: 0,
    assignees: [],
    authorLogin: 'o',
    authorAssociation: 'OWNER',
    officialProvenance: 'ELIGIBLE',
    knownLinkedPRs: [],
    competingPRs: [],
    competingPRScanComplete: true,
    reserved: false,
    repositoryPolicy: 'ALLOWED',
    eligibility: 'ELIGIBLE',
    rejectReasons: [],
    confidence: 'high',
    evidenceUrls: ['https://github.com/o/r/issues/1'],
  });
it.each([
  { discussionComments: 1 },
  { assignees: ['someone'] },
  { officialProvenance: 'INELIGIBLE' },
  { knownLinkedPRs: ['https://github.com/o/r/pull/2'] },
  { competingPRs: ['https://github.com/o/r/pull/3'] },
  { repositoryPolicy: 'PROHIBITED' },
  { labels: ['wontfix'] },
  { reserved: true },
])('rejects strict gate violation %j', (change) => {
  expect(
    eligibility(repo, { ...eligibleIssue(), ...change } as ReturnType<typeof eligibleIssue>)
      .eligibility,
  ).toBe('INELIGIBLE');
});
it('keeps unknown evidence unknown and cannot relax a prohibition', () => {
  expect(
    eligibility(repo, { ...eligibleIssue(), competingPRScanComplete: false }).eligibility,
  ).toBe('UNKNOWN');
  expect(
    eligibility(repo, { ...eligibleIssue(), repositoryPolicy: 'PROHIBITED' }, [
      'comments',
      'linked_work',
      'provenance',
      'assignees',
    ]).eligibility,
  ).toBe('INELIGIBLE');
  expect(reservation('This is reserved for Alice', [])).toBe(true);
});
