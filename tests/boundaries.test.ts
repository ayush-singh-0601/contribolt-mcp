import { it, expect } from 'vitest';
import { symlinkSync } from 'node:fs';
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
