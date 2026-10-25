import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Store } from '../src/state/store.js';
import { cachedIndex, affectedDependents } from '../src/repository/cache.js';
import { fixture, gitFixture } from './helpers.js';
it('updates dirty source overlays without poisoning the immutable revision cache', async () => {
  const repo = await gitFixture({
      'src/a.ts': "import {value} from './b.js';",
      'src/b.ts': 'export const value=1;',
    }),
    f = fixture(),
    db = new Store(f.root);
  try {
    const baseline = await cachedIndex(db, repo.root, 'repo');
    writeFileSync(repo.root + '/src/b.ts', 'export const value=2;');
    const changed = await cachedIndex(db, repo.root, 'repo');
    expect(changed.content['src/b.ts']).toContain('=2');
    expect(baseline.content['src/b.ts']).toContain('=1');
    expect(affectedDependents(changed, ['src/b.ts'])).toContain('src/a.ts');
  } finally {
    db.close();
    f.cleanup();
    repo.cleanup();
  }
});
