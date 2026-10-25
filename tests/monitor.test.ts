import { it, expect } from 'vitest';
import { Store } from '../src/state/store.js';
import { PreferencesSchema, RepoSchema } from '../src/core/models.js';
import { monitorPullRequest } from '../src/contribution/monitor.js';
import type { GitHubClient } from '../src/github/client.js';
import { fixture } from './helpers.js';
it('records closed without merge and reuses a fresh polling snapshot', async () => {
  const f = fixture(),
    db = new Store(f.root);
  try {
    const s = db.create(PreferencesSchema.parse({}));
    db.mutate(s.id, (x) => {
      x.prNumber = 1;
      x.prUrl = 'https://github.com/o/r/pull/1';
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
    });
    let calls = 0;
    const client = {
      request: async (_m: string, path: string) => {
        calls++;
        return path.endsWith('/pulls/1')
          ? { state: 'closed', merged_at: null, head: { sha: 'abc' } }
          : path.endsWith('/status')
            ? { statuses: [] }
            : { total_count: 0, check_runs: [] };
      },
      pages: async () => ({ items: [], complete: true }),
    } as unknown as GitHubClient;
    expect((await monitorPullRequest(db, s.id, client)).outcome).toBe('closed_without_merge');
    const count = calls;
    await monitorPullRequest(db, s.id, client);
    expect(calls).toBe(count);
    expect(db.get(s.id).state).toBe('DONE');
  } finally {
    db.close();
    f.cleanup();
  }
});
