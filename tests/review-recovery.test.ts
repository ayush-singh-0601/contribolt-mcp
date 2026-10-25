import { it, expect } from 'vitest';
import { Store } from '../src/state/store.js';
import { PreferencesSchema, RepoSchema, ProposalSchema } from '../src/core/models.js';
import { Approvals } from '../src/security/approvals.js';
import { routeReview } from '../src/contribution/reviews.js';
import { ForgeError, type GitHubClient } from '../src/github/client.js';
import { fixture } from './helpers.js';

async function reviewFixture() {
  const f = fixture(),
    store = new Store(f.root),
    s = store.create(PreferencesSchema.parse({}), false);
  store.mutate(s.id, (x) => {
    x.repository = RepoSchema.parse({
      id: '1',
      fullName: 'o/r',
      url: 'https://github.com/o/r',
      cloneUrl: 'https://github.com/o/r.git',
      defaultBranch: 'main',
      public: true,
      archived: false,
      fork: false,
      hasIssues: true,
      updatedAt: new Date().toISOString(),
    });
    x.prUrl = 'https://github.com/o/r/pull/2';
    x.prNumber = 2;
    x.proposal = ProposalSchema.parse({
      repository: 'o/r',
      issueNumber: 1,
      actor: 'actor',
      authorName: 'Actor',
      authorEmail: 'actor@example.invalid',
      branch: 'fix/1',
      base: 'main',
      title: 'Fix increment',
      body: 'Refs #1',
      draft: false,
      patchHash: 'a'.repeat(64),
      baseSha: 'b'.repeat(40),
      commitMessage: 'fix',
      files: ['subject.py'],
    });
  });
  store.put('policies', 'o/r', {
    documents: [{ path: '.github/CODEOWNERS', text: '* @maintainer' }],
  });
  const approvals = new Approvals(store),
    grant = approvals.request(s.id, 'review', {
      prUrl: store.get(s.id).prUrl,
      actor: 'actor',
      reviewers: ['maintainer'],
      teams: [],
    });
  await approvals.confirmFromHuman(grant.id);
  return {
    store,
    id: s.id,
    approvalId: grant.id,
    cleanup() {
      store.close();
      f.cleanup();
    },
  };
}

it('suppresses an ambiguous reviewer retry without claiming it succeeded', async () => {
  const f = await reviewFixture();
  let posts = 0;
  const client = {
    request: async (method: string, path: string) => {
      if (path === '/user') return { login: 'actor' };
      if (method === 'POST') {
        posts++;
        throw new ForgeError('Response lost', 0);
      }
      return { users: [], teams: [] };
    },
  } as unknown as GitHubClient;
  try {
    await expect(routeReview(f.store, f.id, client, f.approvalId)).rejects.toThrow('Response lost');
    expect((await routeReview(f.store, f.id, client, f.approvalId)).status).toBe(
      'awaiting project triage',
    );
    expect(posts).toBe(1);
  } finally {
    f.cleanup();
  }
});
it('refuses a reviewer request under a different authenticated actor', async () => {
  const f = await reviewFixture();
  let posts = 0;
  const client = {
    request: async (method: string, path: string) => {
      if (path === '/user') return { login: 'different' };
      if (method === 'POST') posts++;
      return { users: [], teams: [] };
    },
  } as unknown as GitHubClient;
  try {
    await expect(routeReview(f.store, f.id, client, f.approvalId)).rejects.toThrow('identity');
    expect(posts).toBe(0);
  } finally {
    f.cleanup();
  }
});
