import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc, modify, applyEdits, type ParseError } from 'jsonc-parser';
import { randomUUID } from 'node:crypto';
import { within } from '../security/boundaries.js';
import { digest } from '../security/approvals.js';
export const SDK_VERSION = '2.4.0';
export const clients = ['codex', 'claude', 'cursor'] as const;
export type Client = (typeof clients)[number];
export function forwardedCredentialVariables(): string[] {
  const names = [
    'CONTRIBOLT_GITHUB_TOKEN',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'CONTRIBOLT_APP_ID',
    'CONTRIBOLT_APP_KEY',
    'CONTRIBOLT_INSTALLATION_ID',
    'CONTRIBOLT_FORGES',
    'GITLAB_TOKEN',
    'FORGEJO_TOKEN',
  ];
  if (process.env.CONTRIBOLT_FORGES) {
    try {
      const forges = JSON.parse(process.env.CONTRIBOLT_FORGES) as { tokenEnv?: unknown }[];
      if (Array.isArray(forges))
        for (const forge of forges)
          if (typeof forge.tokenEnv === 'string' && /^[A-Z][A-Z0-9_]+$/.test(forge.tokenEnv))
            names.push(forge.tokenEnv);
    } catch {
      throw new Error(
        'CONTRIBOLT_FORGES must be valid JSON before configuring credential forwarding',
      );
    }
  }
  return [...new Set(names)];
}
export function serverDefinition(project: string, local = false) {
  return {
    command: local ? process.execPath : 'npx',
    args: local
      ? [fileURLToPath(new URL('../cli.js', import.meta.url)), 'mcp']
      : [
          '--yes',
          '--package',
          `@modelcontextprotocol/server@${SDK_VERSION}`,
          '--package',
          'contribolt-mcp@0.1.0',
          'contribolt',
          'mcp',
        ],
    env: { CONTRIBOLT_DATA_DIR: join(project, '.contribolt') },
  };
}
export function configureClient(
  client: Client,
  project: string,
  local = false,
): { file: string; changed: boolean; definition: ReturnType<typeof serverDefinition> } {
  if (!clients.includes(client)) throw new Error('Choose codex, claude or cursor');
  const root = resolve(project);
  const relative =
      client === 'codex'
        ? '.codex/config.toml'
        : client === 'claude'
          ? '.mcp.json'
          : '.cursor/mcp.json',
    file = within(root, relative),
    definition = serverDefinition(root, local);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (Buffer.byteLength(current) > 1048576)
    throw new Error('Client configuration exceeds size limit');
  let next: string;
  if (client === 'codex') {
    const before = current ? parseToml(current) : {},
      servers = (before.mcp_servers ?? {}) as Record<string, unknown>,
      existing = servers.contribolt as Record<string, unknown> | undefined;
    const begin = '# BEGIN CONTRIBOLT MANAGED CONFIG',
      end = '# END CONTRIBOLT MANAGED CONFIG';
    const block = `${begin}\n[mcp_servers.contribolt]\ncommand = ${JSON.stringify(definition.command)}\nargs = ${JSON.stringify(definition.args)}\nenv = { CONTRIBOLT_DATA_DIR = ${JSON.stringify(definition.env.CONTRIBOLT_DATA_DIR)} }\nenv_vars = ${JSON.stringify(forwardedCredentialVariables())}\n${end}\n`;
    if (current.includes(begin) && current.includes(end)) {
      const start = current.indexOf(begin),
        finish = current.indexOf(end, start) + end.length;
      next = current.slice(0, start) + block + current.slice(finish).replace(/^\r?\n/, '');
      const after = parseToml(next),
        without = (value: Record<string, unknown>) => {
          const copy = structuredClone(value),
            tables = (copy.mcp_servers ?? {}) as Record<string, unknown>;
          delete tables.contribolt;
          copy.mcp_servers = tables;
          return copy;
        };
      if (digest(without(before)) !== digest(without(after)))
        throw new Error(
          'Managed config markers would alter unrelated settings; manual review required',
        );
    } else if (existing) {
      const env = existing.env as Record<string, unknown> | undefined;
      if (
        existing.command !== definition.command ||
        digest(existing.args) !== digest(definition.args) ||
        env?.CONTRIBOLT_DATA_DIR !== definition.env.CONTRIBOLT_DATA_DIR
      )
        throw new Error(
          'An unmanaged ContriBolt configuration already exists; review and merge the generated example manually',
        );
      next = current;
    } else {
      next = current + (current.endsWith('\n') || !current ? '' : '\n') + '\n' + block;
      parseToml(next);
    }
  } else {
    const errors: ParseError[] = [],
      parsed = current ? parseJsonc(current, errors, { allowTrailingComma: true }) : {};
    if (errors.length || !parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Invalid JSON/JSONC client configuration');
    if (
      parsed.mcpServers !== undefined &&
      (!parsed.mcpServers ||
        typeof parsed.mcpServers !== 'object' ||
        Array.isArray(parsed.mcpServers))
    )
      throw new Error('mcpServers must be an object');
    const old = parsed.mcpServers?.contribolt ?? {};
    if (typeof old !== 'object' || Array.isArray(old))
      throw new Error('Existing ContriBolt configuration is invalid');
    const value = { ...old, ...definition, env: { ...(old.env ?? {}), ...definition.env } };
    next = applyEdits(
      current || '{}\n',
      modify(current || '{}\n', ['mcpServers', 'contribolt'], value, {
        formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
      }),
    );
  }
  if (next !== current) {
    mkdirSync(dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID();
    writeFileSync(temp, next, { mode: 0o600, flag: 'wx' });
    renameSync(temp, file);
  }
  const data = within(root, '.contribolt');
  mkdirSync(data, { recursive: true, mode: 0o700 });
  const ignore = within(root, '.contribolt/.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', { mode: 0o600, flag: 'wx' });
  return { file, changed: next !== current, definition };
}
