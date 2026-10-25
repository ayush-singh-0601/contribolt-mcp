import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { gitFixture } from './helpers.js';
import { assertClean, trackedFiles } from '../src/git/workspace.js';
it('preserves and rejects pre-existing user changes', async () => {
  const f = await gitFixture();
  try {
    await assertClean(f.root);
    writeFileSync(f.root + '/README.md', 'user edit');
    await expect(assertClean(f.root)).rejects.toThrow('existing changes');
    expect(await trackedFiles(f.root)).toEqual(['README.md']);
    expect(await f.git('diff')).toContain('user edit');
  } finally {
    f.cleanup();
  }
});
