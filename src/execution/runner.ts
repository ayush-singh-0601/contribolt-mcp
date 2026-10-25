import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import type { Store } from '../state/store.js';
import { CommandSchema, type CheckCommand, type QualityCheck } from '../core/models.js';
import { within, sanitizedEnvironment } from '../security/boundaries.js';
import { patchFingerprint } from '../git/patch.js';
import { redact } from '../core/audit.js';
import { processInvocation } from './spawn.js';
export interface ExecutionConsent {
  source: 'host-approved-execution' | 'interactive-cli';
  network: boolean;
}
export interface ExecutionRecord {
  id: string;
  sessionId: string;
  consent: ExecutionConsent;
  check: QualityCheck;
  commandHash: string;
}
export async function executeCheck(
  store: Store,
  sessionId: string,
  checkId: string,
  consent: ExecutionConsent,
  signal?: AbortSignal,
): Promise<ExecutionRecord> {
  const session = store.get(sessionId);
  if (session.stopped || !session.workspace) throw new Error('Active isolated workspace required');
  const candidate = session.commands.find((c) => c.id === checkId);
  if (!candidate) throw new Error('Command is not in the recorded plan');
  const command = CommandSchema.parse(candidate);
  within(session.workspace, command.cwd);
  if (command.network && !consent.network)
    throw new Error('Network/bootstrap authorization required');
  if (!['host-approved-execution', 'interactive-cli'].includes(consent.source))
    throw new Error('Execution approval required');
  const before = await patchFingerprint(session.workspace, session.repositoryCommitSha),
    startedAt = new Date().toISOString();
  const result = await runProcess(command, signal);
  const after = await patchFingerprint(session.workspace, session.repositoryCommitSha),
    id = randomUUID();
  const output = String(redact(result.output)),
    outputPath = store.artifact(sessionId, `check-${id}.log`, output);
  const silentTest = command.kind === 'test' && result.exitCode === 0 && !result.output.trim();
  const check: QualityCheck = {
    id: command.id,
    name: command.name,
    status:
      result.unavailable || silentTest
        ? 'UNAVAILABLE'
        : result.cancelled
          ? 'SKIPPED'
          : result.exitCode === 0 &&
              before === after &&
              !(command.executable === 'gofmt' && result.output.trim())
            ? 'PASS'
            : 'FAIL',
    command,
    exitCode: result.exitCode,
    outputPath,
    outputHash: createHash('sha256').update(output).digest('hex'),
    patchHash: before,
    startedAt,
    finishedAt: new Date().toISOString(),
    explanation:
      before !== after
        ? 'Command changed the tested patch; rerun after inspection'
        : silentTest
          ? 'Test command produced no verifiable output; enable a test reporter and rerun'
          : result.reason,
    verified: true,
  };
  const record: ExecutionRecord = {
    id,
    sessionId,
    consent,
    check,
    commandHash: createHash('sha256').update(JSON.stringify(command)).digest('hex'),
  };
  store.put('executions', id, record);
  store.event(sessionId, 'command-executed', {
    executionId: id,
    commandId: command.id,
    status: check.status,
    consent,
  });
  return record;
}
export async function runProcess(
  command: CheckCommand,
  signal?: AbortSignal,
): Promise<{
  exitCode: number | null;
  output: string;
  unavailable: boolean;
  cancelled: boolean;
  reason?: string;
}> {
  signal?.throwIfAborted();
  let invocation: ReturnType<typeof processInvocation>;
  try {
    invocation = processInvocation(command);
  } catch (error) {
    return {
      exitCode: null,
      output: '',
      unavailable: true,
      cancelled: false,
      reason: String(error),
    };
  }
  return new Promise((resolve) => {
    let output = '',
      cancelled = false,
      unavailable = false,
      reason: string | undefined,
      finished = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(invocation.executable, invocation.args, {
      cwd: command.cwd,
      env: sanitizedEnvironment(process.env, ['RUSTUP_HOME']),
      shell: false,
      windowsVerbatimArguments:
        process.platform === 'win32' && /(?:^|[\\/])cmd(?:\.exe)?$/i.test(invocation.executable),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const stop = () => {
      cancelled = true;
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch {
        /* Process may already have exited. */
      }
      if (!forceTimer)
        forceTimer = setTimeout(() => {
          try {
            if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
            else child.kill('SIGKILL');
          } catch {
            /* Already exited. */
          }
        }, 2000);
    };
    const timer = setTimeout(() => {
      reason = 'Command timed out';
      stop();
    }, command.timeoutMs);
    const append = (chunk: Buffer) => {
      if (Buffer.byteLength(output) + chunk.length > 2 * 1024 * 1024) {
        reason = 'Output limit exceeded';
        stop();
      } else output += chunk.toString('utf8');
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    signal?.addEventListener('abort', stop, { once: true });
    const done = (exitCode: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      signal?.removeEventListener('abort', stop);
      resolve({ exitCode, output, unavailable, cancelled, reason });
    };
    child.on('error', (error: NodeJS.ErrnoException) => {
      unavailable = ['ENOENT', 'EACCES', 'EPERM'].includes(error.code ?? '');
      reason = error.message;
      output += error.message;
      done(null);
    });
    child.on('close', done);
  });
}
