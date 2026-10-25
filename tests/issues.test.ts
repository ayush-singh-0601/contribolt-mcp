import { it, expect } from 'vitest';
import { mapIssue } from '../src/discovery/issues.js';
import type { Repository } from '../src/core/models.js';
it('preserves direct comment counts and identifies pull requests', () => {
  const issue = mapIssue({ fullName: 'o/r' } as Repository, {
    number: 1,
    html_url: 'https://github.com/o/r/issues/1',
    title: 'Bug',
    body: null,
    state: 'open',
    comments: 1,
    assignees: [{ login: 'alice' }],
    user: { login: 'owner' },
    author_association: 'OWNER',
    labels: [],
    pull_request: {},
  });
  expect(issue.discussionComments).toBe(1);
  expect(issue.isPullRequest).toBe(true);
  expect(issue.officialProvenance).toBe('UNKNOWN');
});
