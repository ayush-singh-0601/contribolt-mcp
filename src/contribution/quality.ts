import { readFileSync, statSync } from 'node:fs';
import type { Session } from '../core/models.js';
import { git } from '../git/workspace.js';
import { patchFingerprint } from '../git/patch.js';
import { within } from '../security/boundaries.js';
export interface PatchInspection {
  patchHash: string;
  files: string[];
  blockers: string[];
  warnings: string[];
  stat: string;
}
export async function inspectPatch(session: Session): Promise<PatchInspection> {
  if (!session.workspace || !session.analysis)
    throw new Error('Analyzed isolated workspace required');
  const root = session.workspace,
    base = session.repositoryCommitSha ?? 'HEAD';
  const changed = (await git(root, ['diff', '--name-only', '-z', base, '--']))
    .split('\0')
    .filter(Boolean);
  const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
    .split('\0')
    .filter(Boolean);
  const files = [...new Set([...changed, ...untracked])].sort(),
    blockers: string[] = [],
    warnings: string[] = [];
  if (!files.length) blockers.push('Patch is empty');
  const allowed = new Set(session.analysis.files);
  for (const file of files) {
    if (!allowed.has(file)) blockers.push(`Unplanned changed file: ${file}`);
    if (
      /(^|\/)(?:\.env(?:\..*)?|\.aws|credentials|id_rsa|id_ed25519|node_modules|dist|build|coverage|test-results)(\/|$)|\.(?:pem|p12|key|sqlite|db|exe|dll|so|png|zip)$/i.test(
        file,
      )
    )
      blockers.push(`Sensitive or generated file: ${file}`);
    if (
      /(?:lock|package-lock\.json)$/i.test(file) &&
      !/dependenc|package|version/i.test(session.analysis.strategy)
    )
      blockers.push(`Unjustified lockfile change: ${file}`);
    try {
      const path = within(root, file);
      if (!statSync(path).isFile()) continue;
      if (statSync(path).size > 2 * 1024 * 1024) {
        blockers.push(`Large file requires explicit inspection: ${file}`);
        continue;
      }
      const content = readFileSync(path);
      if (content.includes(0)) {
        blockers.push(`Binary file: ${file}`);
        continue;
      }
      if (
        /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/.test(
          content.toString(),
        )
      )
        blockers.push(`Potential secret in ${file}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        blockers.push(`Unsafe or unreadable file: ${file}`);
    }
  }
  if (files.length > 20)
    warnings.push(
      'Large changed-file count requires careful scope review; line count is diagnostic',
    );
  try {
    await git(root, ['diff', '--check', base, '--']);
  } catch {
    blockers.push('Whitespace/conflict-marker check failed');
  }
  return {
    patchHash: await patchFingerprint(root, base),
    files,
    blockers,
    warnings,
    stat: await git(root, ['diff', '--stat', base, '--']),
  };
}
