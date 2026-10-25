import { it, expect } from 'vitest';
import { HttpService } from '../src/http/server.js';
import { Store } from '../src/state/store.js';
import { PreferencesSchema } from '../src/core/models.js';
import { fixture } from './helpers.js';
import { request } from './http-helper.js';
it('requires authentication, isolates tenants and refuses hosted write tools', async () => {
  const f = fixture(),
    store = new Store(f.root),
    service = new HttpService(store);
  try {
    const s = store.create(PreferencesSchema.parse({})),
      local = service.auth.issue('local', ['read']),
      other = service.auth.issue('other', ['read']);
    expect((await request(service, '/api/sessions')).status).toBe(401);
    const response = await request(service, '/api/sessions', {
      headers: { authorization: 'Bearer ' + local.token },
    });
    expect(response.json().sessions).toHaveLength(1);
    expect(
      (
        await request(service, '/api/sessions/' + s.id, {
          headers: { authorization: 'Bearer ' + other.token },
        })
      ).status,
    ).toBe(404);
    const write = await request(service, '/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + local.token },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'publish_pull_request', arguments: { sessionId: s.id } },
      },
    });
    expect(write.status).toBe(403);
    expect(
      (
        await request(service, '/api/sessions', {
          headers: { authorization: 'Bearer ' + local.token, origin: 'https://evil.invalid' },
        })
      ).status,
    ).toBe(403);
  } finally {
    await service.close();
    store.close();
    f.cleanup();
  }
});
it('opens a real loopback listener when the environment permits it', async (context) => {
  const f = fixture(),
    store = new Store(f.root),
    service = new HttpService(store, { port: 0 });
  try {
    let port: number;
    try {
      port = await service.listen();
    } catch (error) {
      if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        context.skip();
        return;
      }
      throw error;
    }
    expect((await fetch(`http://127.0.0.1:${port}/healthz`)).status).toBe(200);
  } finally {
    await service.close();
    store.close();
    f.cleanup();
  }
});
