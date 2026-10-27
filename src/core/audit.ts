import type { Store } from '../state/store.js';
const sensitive =
  /^(authorization|cookie|token|password|secret|privateKey|apiKey|access_token|refresh_token)$/i;
export function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value.replace(
      /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|cb_[A-Za-z0-9_-]{43}|AKIA[0-9A-Z]{16}|Bearer\s+[^\s"']+|AUTHORIZATION:\s*basic\s+[^\s"']+|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----)/gi,
      '[REDACTED]',
    );
    for (const [key, secret] of Object.entries(process.env))
      if (
        /(?:TOKEN|PASSWORD|SECRET|API_KEY|PRIVATE_KEY)/i.test(key) &&
        secret &&
        secret.length >= 8
      )
        result = result.split(secret).join('[REDACTED]');
    return result;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '[REDACTED]' : redact(v)]),
    );
  return value;
}
export class Audit {
  constructor(
    private store: Store,
    private sink: (line: string) => void = (line) => process.stderr.write(line + '\n'),
  ) {}
  record(sessionId: string, kind: string, data: unknown): void {
    const clean = redact(data);
    this.store.event(sessionId, kind, clean);
    this.sink(JSON.stringify({ at: new Date().toISOString(), sessionId, kind, data: clean }));
  }
  async stage<T>(sessionId: string, name: string, work: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await work();
      this.record(sessionId, 'stage', { name, durationMs: Date.now() - start, status: 'complete' });
      return result;
    } catch (error) {
      this.record(sessionId, 'stage', {
        name,
        durationMs: Date.now() - start,
        status: 'failed',
        error: String(error),
      });
      throw error;
    }
  }
}
