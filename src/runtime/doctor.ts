import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { redact } from '../core/audit.js';
const exec = promisify(execFile);
export type DiagnosticStatus = 'PASS' | 'FAIL' | 'UNAVAILABLE' | 'NOT_RUN';
export interface Diagnostic {
  id: string;
  status: DiagnosticStatus;
  detail: string;
  scope: 'local' | 'publication' | 'qualification';
}
export interface DoctorReport {
  schemaVersion: 1;
  checkedAt: string;
  node: string;
  platform: string;
  canStartLocal: boolean;
  forgeAuthenticationVerified: boolean;
  checks: Diagnostic[];
}
export interface DoctorOptions {
  live?: boolean;
  dataDirectory?: string;
  socketProbe?: boolean;
}
export function supportedRuntime(version = process.versions.node): boolean {
  return Number(version.split('.')[0]) >= 24;
}
export async function socketCapability(): Promise<Diagnostic> {
  return new Promise((resolve) => {
    const server = createServer(),
      timer = setTimeout(() => {
        server.close();
        resolve({
          id: 'listener',
          status: 'UNAVAILABLE',
          scope: 'qualification',
          detail: 'Loopback probe timed out',
        });
      }, 3000);
    server.once('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({
        id: 'listener',
        status: 'UNAVAILABLE',
        scope: 'qualification',
        detail: 'Loopback listener is unavailable (' + (error.code ?? 'unknown') + ')',
      });
    });
    server.listen(0, '127.0.0.1', () =>
      server.close(() => {
        clearTimeout(timer);
        resolve({
          id: 'listener',
          status: 'PASS',
          scope: 'qualification',
          detail: 'Real loopback bind succeeded',
        });
      }),
    );
  });
}
export function stateCapability(directory: string): Diagnostic {
  let parent = resolve(directory);
  while (!existsSync(parent)) {
    const next = dirname(parent);
    if (next === parent) break;
    parent = next;
  }
  let temporary: string | undefined;
  try {
    accessSync(parent, constants.W_OK);
    temporary = mkdtempSync(join(parent, '.mergepilot-doctor-'));
    return {
      id: 'state',
      status: 'PASS',
      scope: 'local',
      detail: 'Private state parent accepts an actual temporary write',
    };
  } catch {
    return {
      id: 'state',
      status: 'UNAVAILABLE',
      scope: 'local',
      detail: 'State directory is not writable. Select a private writable MERGEPILOT_DATA_DIR',
    };
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
export function sdkCapability(): Diagnostic {
  try {
    const entry = fileURLToPath(import.meta.resolve('@modelcontextprotocol/server'));
    let directory = dirname(entry);
    for (let level = 0; level < 5; level++) {
      const file = join(directory, 'package.json');
      if (existsSync(file)) {
        const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === '@modelcontextprotocol/server')
          return {
            id: 'sdk',
            status: pkg.version === '2.4.0' ? 'PASS' : 'FAIL',
            scope: 'qualification',
            detail:
              pkg.version === '2.4.0'
                ? 'Pinned official MCP SDK 2.4.0 is installed'
                : 'Unsupported official SDK version; install exactly 2.4.0',
          };
      }
      directory = dirname(directory);
    }
    throw new Error('Missing metadata');
  } catch {
    return {
      id: 'sdk',
      status: 'UNAVAILABLE',
      scope: 'qualification',
      detail:
        'Official SDK 2.4.0 is missing from this installation. Run npm ci with registry access; the compatibility transport is available for offline development',
    };
  }
}
async function commandCapability(
  id: string,
  executable: string,
  args: string[],
  scope: Diagnostic['scope'],
): Promise<Diagnostic> {
  try {
    const result = await exec(executable, args, {
      timeout: 5000,
      maxBuffer: 8192,
      encoding: 'utf8',
    });
    return {
      id,
      status: result.stdout.trim() ? 'PASS' : 'UNAVAILABLE',
      scope,
      detail: result.stdout.trim()
        ? String(redact(result.stdout.trim().split('\n')[0]!.slice(0, 200)))
        : 'Executable returned no verifiable version output',
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      id,
      status: 'UNAVAILABLE',
      scope,
      detail:
        'Executable unavailable or unusable' + (typeof code === 'string' ? ' (' + code + ')' : ''),
    };
  }
}
export async function inspectEnvironment(options: DoctorOptions = {}): Promise<DoctorReport> {
  const checks: Diagnostic[] = [
    {
      id: 'node',
      status: supportedRuntime() ? 'PASS' : 'FAIL',
      scope: 'local',
      detail: 'Requires Node.js >=24; detected ' + process.versions.node,
    },
    stateCapability(
      options.dataDirectory ??
        process.env.MERGEPILOT_DATA_DIR ??
        join(homedir(), '.local', 'share', 'mergepilot'),
    ),
    sdkCapability(),
  ];
  checks.push(await commandCapability('git', 'git', ['--version'], 'local'));
  try {
    const name = 'node:sqlite',
      sqlite = (await import(name)) as { DatabaseSync: new (file: string) => { close(): void } };
    const db = new sqlite.DatabaseSync(':memory:');
    db.close();
    checks.push({
      id: 'sqlite',
      status: 'PASS',
      scope: 'local',
      detail: 'Built-in SQLite opened and closed successfully',
    });
  } catch {
    checks.push({
      id: 'sqlite',
      status: 'UNAVAILABLE',
      scope: 'local',
      detail: 'Built-in SQLite is unavailable in this Node runtime',
    });
  }
  const clients = await Promise.all([
    commandCapability('codex', 'codex', ['--version'], 'qualification'),
    commandCapability('claude', 'claude', ['--version'], 'qualification'),
    commandCapability('cursor', 'cursor-agent', ['--version'], 'qualification'),
  ]);
  checks.push(...clients);
  if (options.socketProbe !== false) checks.push(await socketCapability());
  if (options.live) {
    try {
      const { credentials } = await import('../github/auth.js'),
        { GitHubClient } = await import('../github/client.js');
      const client = new GitHubClient(await credentials());
      await client.request<{ login: string }>('GET', '/user');
      checks.push({
        id: 'github-auth',
        status: 'PASS',
        scope: 'publication',
        detail: 'GitHub authenticated identity was verified by the live API',
      });
    } catch {
      checks.push({
        id: 'github-auth',
        status: 'UNAVAILABLE',
        scope: 'publication',
        detail:
          'GitHub authentication could not be verified. Configure a valid scoped environment token or gh login and network access',
      });
    }
    try {
      const response = await fetch(
        'https://registry.npmjs.org/@modelcontextprotocol%2fserver/2.4.0',
        { signal: AbortSignal.timeout(5000) },
      );
      checks.push({
        id: 'registry',
        status: response.ok ? 'PASS' : 'FAIL',
        scope: 'qualification',
        detail: response.ok
          ? 'Pinned SDK registry metadata is reachable'
          : 'Registry returned HTTP ' + response.status,
      });
    } catch {
      checks.push({
        id: 'registry',
        status: 'UNAVAILABLE',
        scope: 'qualification',
        detail: 'npm registry network access is unavailable',
      });
    }
  } else
    checks.push({
      id: 'github-auth',
      status: 'NOT_RUN',
      scope: 'publication',
      detail:
        'Use doctor --live to verify credentials with GitHub; configured credentials alone are not verified authentication',
    });
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    node: process.versions.node,
    platform: process.platform,
    canStartLocal: checks.filter((c) => c.scope === 'local').every((c) => c.status === 'PASS'),
    forgeAuthenticationVerified: checks.some((c) => c.id === 'github-auth' && c.status === 'PASS'),
    checks,
  };
}
export async function doctorCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: 'boolean', default: false },
      live: { type: 'boolean', default: false },
    },
  });
  const report = await inspectEnvironment({ live: values.live });
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks)
      console.log(`${check.status.padEnd(11)} ${check.id}: ${check.detail}`);
    console.log(
      'Local startup: ' +
        (report.canStartLocal ? 'available' : 'blocked') +
        '; live forge authentication: ' +
        (report.forgeAuthenticationVerified ? 'verified' : 'not verified'),
    );
  }
  if (!report.canStartLocal || (values.live && !report.forgeAuthenticationVerified))
    process.exitCode = 1;
}
