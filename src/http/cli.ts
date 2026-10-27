import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Store } from '../state/store.js';
import { HttpService } from './server.js';
import { HttpAuth, Scope } from './auth.js';
import { exportMetadata, summaries } from './metadata.js';
export const httpCommands = new Set([
  'record-incident',
  'serve',
  'issue-token',
  'revoke-token',
  'export',
  'sync',
  'sessions',
  'status',
]);
export async function runHttpCommand(command: string, store: Store, args: string[]): Promise<void> {
  if (command === 'serve') {
    const { values } = parseArgs({
      args,
      options: {
        host: { type: 'string', default: '127.0.0.1' },
        port: { type: 'string', default: '5178' },
        origin: { type: 'string' },
        'trust-proxy': { type: 'boolean', default: false },
        assets: { type: 'string' },
      },
    });
    const assets = values.assets ?? fileURLToPath(new URL('../dashboard/', import.meta.url));
    const service = new HttpService(store, {
      host: values.host,
      port: z.coerce.number().int().min(0).max(65535).parse(values.port),
      externalOrigin: values.origin,
      trustProxy: values['trust-proxy'],
      dashboardRoot: existsSync(assets) ? assets : undefined,
      webhookSecret: process.env.CONTRIBOLT_WEBHOOK_SECRET,
      installationId: process.env.CONTRIBOLT_INSTALLATION_ID
        ? z.coerce.number().int().positive().parse(process.env.CONTRIBOLT_INSTALLATION_ID)
        : undefined,
    });
    const port = await service.listen();
    console.log(
      `ContriBolt HTTP service listening on ${values.host}:${port}. Access requires an issued token.`,
    );
    await new Promise<void>((resolve) => {
      const stop = () => resolve();
      process.once('SIGTERM', stop);
      process.once('SIGINT', stop);
    });
    await service.close();
    store.close();
    return;
  }
  try {
    if (command === 'record-incident') {
      const [id, kind, ...notes] = args;
      z.uuid().parse(id);
      const incident = z
          .enum(['duplicate_attempt', 'maintainer_complaint', 'policy_violation'])
          .parse(kind),
        note = z.string().min(10).max(2000).parse(notes.join(' '));
      store.get(id!);
      const counts = store.read<Record<string, number>>('negative-metrics', id!) ?? {};
      counts[incident] = (counts[incident] ?? 0) + 1;
      store.put('negative-metrics', id!, counts);
      store.event(id!, 'reported-incident', { kind: incident, note });
      console.log('Recorded a local incident with an audit note.');
      return;
    }
    if (command === 'issue-token') {
      const principal = args[0] ?? 'local',
        scopes = z.array(Scope).parse((args[1] ?? 'read').split(','));
      console.log(JSON.stringify(new HttpAuth(store).issue(principal, scopes)));
      return;
    }
    if (command === 'revoke-token') {
      new HttpAuth(store).revoke(args[0] ?? '');
      console.log('Token revoked.');
      return;
    }
    if (command === 'sessions') {
      console.log(JSON.stringify({ sessions: summaries(store) }));
      return;
    }
    if (command === 'status') {
      const summary = summaries(store).find((s) => s.id === args[0]);
      if (!summary) throw new Error('Session not found');
      console.log(JSON.stringify(summary));
      return;
    }
    const ids = z.array(z.uuid()).min(1).max(100).parse(args);
    let device = store.read<string>('config', 'syncDeviceId');
    if (!device) {
      device = randomUUID();
      store.put('config', 'syncDeviceId', device);
    }
    const payload = exportMetadata(store, device, ids);
    if (command === 'export') {
      console.log(JSON.stringify(payload));
      return;
    }
    const endpoint = process.env.CONTRIBOLT_DASHBOARD_URL,
      token = process.env.CONTRIBOLT_DASHBOARD_TOKEN;
    if (!endpoint || !token)
      throw new Error(
        'Set an explicit dashboard URL and scoped synchronization token before opting into sync',
      );
    const url = new URL('/api/sync', endpoint);
    if (
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    )
      throw new Error('Synchronization requires HTTPS or explicit loopback HTTP');
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Metadata synchronization failed (' + response.status + ')');
    console.log(JSON.stringify({ synced: payload.sessions.length, destination: url.origin }));
  } finally {
    store.close();
  }
}
