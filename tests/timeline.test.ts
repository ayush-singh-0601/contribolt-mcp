import { it, expect } from 'vitest';
import { linkedPullRequests } from '../src/discovery/timeline.js';
import type { GitHubClient } from '../src/github/client.js';
import type { Repository } from '../src/core/models.js';
it('records incomplete evidence instead of claiming there are no linked PRs', async () => {
  const client = {
    graphql: async () => {
      throw new Error('forbidden');
    },
    pages: async () => ({ items: [], complete: true }),
  } as unknown as GitHubClient;
  expect((await linkedPullRequests(client, { fullName: 'o/r' } as Repository, 1)).complete).toBe(
    false,
  );
});
