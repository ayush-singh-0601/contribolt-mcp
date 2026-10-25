import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { git } from './workspace.js';
import { within } from '../security/boundaries.js';
export async function patchFingerprint(root: string, base = 'HEAD'): Promise<string> {
  const hash = createHash('sha256').update(await git(root, ['rev-parse', base]));
  const changed = (await git(root, ['diff', '--no-renames', '--name-only', '-z', base, '--']))
    .split('\0')
    .filter(Boolean);
  const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const file of [...new Set([...changed, ...untracked])].sort()) {
    hash.update(file + '\0');
    try {
      const path = within(root, file);
      hash.update('file\0' + String(statSync(path).mode & 0o111) + '\0').update(readFileSync(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') hash.update('deleted\0');
      else throw error;
    }
  }
  return hash.digest('hex');
}
