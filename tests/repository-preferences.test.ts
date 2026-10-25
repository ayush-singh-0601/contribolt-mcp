import { it, expect } from 'vitest';
import { rankRepositories } from '../src/discovery/engine.js';
import { PreferencesSchema, RepoSchema } from '../src/core/models.js';
it('uses repository preferences while preserving maintenance as the main signal', () => {
  const repo = RepoSchema.parse({
      id: '1',
      fullName: 'o/small',
      url: 'https://github.com/o/small',
      cloneUrl: 'https://github.com/o/small.git',
      defaultBranch: 'main',
      public: true,
      archived: false,
      fork: false,
      hasIssues: true,
      updatedAt: new Date().toISOString(),
      health: 0.9,
      stars: 10,
    }),
    popular = { ...repo, id: '2', fullName: 'o/popular', stars: 100000 };
  expect(
    rankRepositories(
      [repo, popular],
      PreferencesSchema.parse({ repositoryPreference: 'popular' }),
    )[0]?.id,
  ).toBe('2');
  expect(
    rankRepositories(
      [repo, popular],
      PreferencesSchema.parse({ repositoryPreference: 'small_active' }),
    )[0]?.id,
  ).toBe('1');
  expect(
    rankRepositories(
      [repo, { ...popular, health: 0 }],
      PreferencesSchema.parse({ repositoryPreference: 'popular' }),
    )[0]?.id,
  ).toBe('1');
});
