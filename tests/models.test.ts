import { expect, it } from 'vitest';
import { PreferencesSchema, IssueSchema, CheckSchema } from '../src/core/models.js';
it('defaults preferences without requiring a repository', () => {
  expect(PreferencesSchema.parse({})).toEqual({
    languages: [],
    difficulty: 'auto',
    repositoryPreference: 'any',
  });
});
it('rejects impossible and incomplete evidence', () => {
  expect(IssueSchema.safeParse({ discussionComments: -1 }).success).toBe(false);
  expect(CheckSchema.safeParse({ id: 'test', name: 'test', status: 'SUCCESS' }).success).toBe(
    false,
  );
});
