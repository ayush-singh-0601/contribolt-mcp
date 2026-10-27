import { it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse as toml } from 'smol-toml';
import { parse as jsonc } from 'jsonc-parser';
import { configureClient, SDK_VERSION } from '../src/integrations/configure.js';
import { fixture } from './helpers.js';

it('merges all three project configurations idempotently and preserves other servers', () => {
  const f = fixture({
    '.codex/config.toml':
      '# Personal project setting\nmodel = "existing"\n[mcp_servers.other]\ncommand = "other-server"\n',
    '.mcp.json':
      '{\n // keep this comment\n "mcpServers": {"other": {"command":"other-server"}}\n}\n',
    '.cursor/mcp.json': '{"mcpServers":{"other":{"command":"other-server"}}}',
  });
  try {
    for (const client of ['codex', 'claude', 'cursor'] as const) {
      const first = configureClient(client, f.root),
        text = readFileSync(first.file, 'utf8'),
        parsed = client === 'codex' ? toml(text) : jsonc(text);
      expect(first.changed).toBe(true);
      expect((client === 'codex' ? parsed.mcp_servers : parsed.mcpServers).other.command).toBe(
        'other-server',
      );
      expect(text).toContain('@modelcontextprotocol/server@' + SDK_VERSION);
      expect(configureClient(client, f.root).changed).toBe(false);
      expect(configureClient(client, f.root, true).definition.command).toBe(process.execPath);
    }
    expect(readFileSync(f.root + '/.mcp.json', 'utf8')).toContain('// keep this comment');
    expect(readFileSync(f.root + '/.contribolt/.gitignore', 'utf8')).toBe('*\n');
  } finally {
    f.cleanup();
  }
});
it('forwards Codex credential names without writing secret values to project configuration', () => {
  const f = fixture();
  vi.stubEnv('CONTRIBOLT_GITHUB_TOKEN', 'private-credential-fixture');
  vi.stubEnv(
    'CONTRIBOLT_FORGES',
    JSON.stringify([{ kind: 'gitlab', host: 'gitlab.com', tokenEnv: 'CUSTOM_FORGE_TOKEN' }]),
  );
  try {
    const result = configureClient('codex', f.root, true),
      text = readFileSync(result.file, 'utf8'),
      entry = (toml(text).mcp_servers as any).contribolt;
    expect(entry.env_vars).toContain('CONTRIBOLT_GITHUB_TOKEN');
    expect(entry.env_vars).toContain('CUSTOM_FORGE_TOKEN');
    expect(text).not.toContain('private-credential-fixture');
    expect(text).not.toContain('"token":');
  } finally {
    vi.unstubAllEnvs();
    f.cleanup();
  }
});
it('refuses invalid files and unmanaged conflicting TOML without overwriting them', () => {
  const text = '[mcp_servers.contribolt]\ncommand="custom"\n',
    f = fixture({ '.codex/config.toml': text, '.mcp.json': '{"mcpServers": []}' });
  try {
    expect(() => configureClient('codex', f.root)).toThrow('unmanaged');
    expect(readFileSync(f.root + '/.codex/config.toml', 'utf8')).toBe(text);
    expect(() => configureClient('claude', f.root)).toThrow('object');
    writeFileSync(f.root + '/.mcp.json', '{broken');
    expect(() => configureClient('claude', f.root)).toThrow('Invalid');
  } finally {
    f.cleanup();
  }
});
