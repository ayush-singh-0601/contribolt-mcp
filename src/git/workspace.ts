import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../core/models.js';
import { safeHttps, sanitizedEnvironment, within } from '../security/boundaries.js';
const exec = promisify(execFile);
export async function git(
  root: string,
  args: string[],
  signal?: AbortSignal,
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<string> {
  const metadata = join(root, '.git');
  if (existsSync(metadata) && !lstatSync(metadata).isDirectory())
    throw new Error('Refusing linked or external Git metadata');
  const env = {
    ...sanitizedEnvironment(),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_LFS_SKIP_SMUDGE: '1',
    ...extraEnv,
  };
  const safeOptions = [
    '--no-pager',
    '-c',
    'core.hooksPath=' + (process.platform === 'win32' ? 'NUL' : '/dev/null'),
    '-c',
    'core.fsmonitor=false',
    '-c',
    'credential.helper=',
    '-c',
    'protocol.ext.allow=never',
    '-c',
    'protocol.file.allow=never',
    '-c',
    'diff.external=',
  ];
  if (existsSync(metadata)) {
    within(metadata, 'config');
    const config = await exec(
      'git',
      [...safeOptions, '-C', root, 'config', '--local', '--no-includes', '--null', '--list'],
      { env, encoding: 'utf8', maxBuffer: 1048576, timeout: 10000, signal },
    );
    for (const entry of config.stdout.split('\0').filter(Boolean)) {
      const key = entry.split('\n')[0]!.toLowerCase();
      if (
        /^(?:include\.|includeif\.|url\.|http\.|protocol\.|credential\.|filter\.|diff\.|merge\.|alias\.|remote\..*\.(?:proxy|uploadpack|receivepack|vcs)$|extensions\.worktreeconfig$|core\.(?:fsmonitor|sshcommand|gitproxy|worktree)$)/.test(
          key,
        )
      )
        throw new Error('Unsafe repository Git configuration; recreate the isolated workspace');
    }
  }
  const result = await exec('git', [...safeOptions, '-C', root, ...args], {
    env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120000,
    signal,
  });
  return result.stdout;
}
export async function createWorkspace(
  dataRoot: string,
  repo: Repository,
  signal?: AbortSignal,
): Promise<{ root: string; sha: string }> {
  safeHttps(repo.cloneUrl, [repo.host]);
  const parent = within(dataRoot, 'workspaces');
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const root = within(parent, randomUUID());
  await git(
    parent,
    ['clone', '--depth', '1', '--no-recurse-submodules', '--template=', '--', repo.cloneUrl, root],
    signal,
  );
  await git(
    root,
    ['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null'],
    signal,
  );
  return { root, sha: (await git(root, ['rev-parse', 'HEAD'], signal)).trim() };
}
export async function assertClean(root: string): Promise<void> {
  if ((await git(root, ['status', '--porcelain'])).trim())
    throw new Error('Workspace contains existing changes; use an isolated clone');
}
export async function trackedFiles(root: string): Promise<string[]> {
  return (await git(root, ['ls-files', '-z'])).split('\0').filter(Boolean);
}
