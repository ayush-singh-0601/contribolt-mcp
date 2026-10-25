import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { gitFixture } from './helpers.js';
import { patchFingerprint } from '../src/git/patch.js';
it('keeps content approval stable through staging and local commits', async () => {
  const f = await gitFixture();
  try {
    const base = await f.git('rev-parse', 'HEAD');
    writeFileSync(f.root + '/new.ts', 'export const fix=true;\n');
    const original = await patchFingerprint(f.root, base);
    await f.git('add', 'new.ts');
    expect(await patchFingerprint(f.root, base)).toBe(original);
    await f.git('commit', '-m', 'fix');
    expect(await patchFingerprint(f.root, base)).toBe(original);
    writeFileSync(f.root + '/new.ts', 'export const fix=false;\n');
    expect(await patchFingerprint(f.root, base)).not.toBe(original);
  } finally {
    f.cleanup();
  }
});
