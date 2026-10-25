import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { isIP } from 'node:net';
export function within(root: string, requested: string): string {
  const declared = resolve(root),
    base = realpathSync(root),
    declaredTarget = resolve(declared, requested),
    declaredRelative = relative(declared, declaredTarget),
    target =
      declaredRelative !== '..' &&
      !declaredRelative.startsWith('..' + sep) &&
      !isAbsolute(declaredRelative)
        ? resolve(base, declaredRelative)
        : declaredTarget,
    rel = relative(base, target);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel))
    throw new Error('Path escapes approved workspace');
  let cursor = target;
  while (cursor !== base) {
    if (existsSync(cursor)) {
      if (lstatSync(cursor).isSymbolicLink())
        throw new Error('Symbolic links are not permitted for this operation');
      const resolved = realpathSync(cursor);
      if (resolved !== base && !resolved.startsWith(base + sep))
        throw new Error('Resolved path escapes workspace');
    }
    cursor = dirname(cursor);
  }
  return target;
}
export function safeHttps(input: string, allowedHosts: string[]): URL {
  const url = new URL(input);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    isIP(url.hostname) ||
    !allowedHosts.includes(url.hostname)
  )
    throw new Error('URL is not an approved HTTPS host');
  return url;
}
export function repositoryName(input: string): string {
  if (!/^[\w.-]+\/[\w.-]+$/.test(input) || input.includes('..'))
    throw new Error('Expected owner/repository');
  return input;
}
export function safeBranch(input: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,150}$/.test(input) ||
    input.includes('..') ||
    input.includes('//') ||
    input.endsWith('/')
  )
    throw new Error('Invalid branch name');
  return input;
}
export function sanitizedEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  allowed: string[] = [],
): NodeJS.ProcessEnv {
  const keys = new Set([
    'PATH',
    'SystemRoot',
    'SYSTEMROOT',
    'WINDIR',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'HOME',
    'USERPROFILE',
    'JAVA_HOME',
    'DOTNET_ROOT',
    'DOTNET_CLI_HOME',
    'PUB_CACHE',
    'GOCACHE',
    'XDG_CACHE_HOME',
    ...allowed,
  ]);
  return Object.fromEntries(
    Object.entries(source).filter(([k, v]) => keys.has(k) && v !== undefined),
  );
}
export function assertBounded(value: unknown, maxBytes = 1048576): void {
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes)
    throw new Error('Input exceeds size limit');
}
