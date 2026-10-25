import { it, expect } from 'vitest';
import { symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './helpers.js';
import { within, safeHttps, sanitizedEnvironment } from '../src/security/boundaries.js';
it('rejects traversal symlinks and credential-bearing network targets', () => {
  const f = fixture();
  try {
    expect(() => within(f.root, '../x')).toThrow();
    symlinkSync(f.root, f.root + '/link', 'dir');
    expect(() => within(f.root, 'link/file')).toThrow();
    expect(() => safeHttps('https://secret@github.com', ['github.com'])).toThrow();
    expect(() => safeHttps('http://127.0.0.1', [])).toThrow();
    expect(sanitizedEnvironment({ PATH: '/bin', GITHUB_TOKEN: 'secret' })).toEqual({
      PATH: '/bin',
    });
  } finally {
    f.cleanup();
  }
});
it('accepts an approved root alias while continuing to reject nested symlink escapes', () => {
  const f = fixture({ 'actual/file.txt': 'fixture', 'outside/file.txt': 'outside' });
  try {
    const alias = join(f.root, 'alias');
    symlinkSync(join(f.root, 'actual'), alias, process.platform === 'win32' ? 'junction' : 'dir');
    expect(within(alias, join(alias, 'file.txt'))).toBe(join(realpathSync(alias), 'file.txt'));
    symlinkSync(
      join(f.root, 'outside'),
      join(alias, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(() => within(alias, join(alias, 'escape', 'file.txt'))).toThrow();
    expect(() => within(alias, '../outside/file.txt')).toThrow();
  } finally {
    f.cleanup();
  }
});
it('preserves existing toolchain locations without forwarding credential variables', () => {
  expect(
    sanitizedEnvironment({
      HOME: '/existing-user',
      PUB_CACHE: '/existing-cache',
      GH_TOKEN: 'secret',
    }),
  ).toEqual({ HOME: '/existing-user', PUB_CACHE: '/existing-cache' });
});
