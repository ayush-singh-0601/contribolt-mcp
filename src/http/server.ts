import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { z } from 'zod';
import { Store } from '../state/store.js';
import { HttpAuth, Principal, type Access } from './auth.js';
import { summaries, aggregateMetadata, importMetadata } from './metadata.js';
import { WebhookReceiver } from '../github/webhooks.js';
import { redact } from '../core/audit.js';
import { within } from '../security/boundaries.js';
export interface HttpOptions {
  host?: string;
  port?: number;
  externalOrigin?: string;
  trustProxy?: boolean;
  dashboardRoot?: string;
  webhookSecret?: string;
  installationId?: number;
}
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody(request: IncomingMessage, limit = 1048576): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
export class HttpService {
  readonly server = createServer((req, res) => {
    void this.handle(req, res);
  });
  readonly auth: HttpAuth;
  private tenants = new Map<string, Store>();
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    readonly store: Store,
    readonly options: HttpOptions = {},
  ) {
    this.auth = new HttpAuth(store);
    this.server.requestTimeout = 30000;
    this.server.headersTimeout = 10000;
  }
  tenant(principal: string): Store {
    Principal.parse(principal);
    if (principal === 'local') return this.store;
    const cached = this.tenants.get(principal);
    if (cached) return cached;
    const data = new Store(within(this.store.root, join('tenants', principal)));
    this.tenants.set(principal, data);
    return data;
  }
  private json(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(JSON.stringify(redact(value)));
  }
  private origin(req: IncomingMessage): void {
    const address = this.server.address(),
      port = address && typeof address !== 'string' ? address.port : (this.options.port ?? 5178);
    const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
    if (this.options.externalOrigin) allowed.add(new URL(this.options.externalOrigin).host);
    if (!req.headers.host || !allowed.has(req.headers.host))
      throw new HttpError(403, 'Host not permitted');
    if (!req.headers.origin) return;
    const expected = this.options.externalOrigin ?? `http://${req.headers.host}`;
    if (req.headers.origin !== new URL(expected).origin)
      throw new HttpError(403, 'Origin not permitted');
  }
  private access(req: IncomingMessage, scope: 'read' | 'sync'): Access {
    const auth = this.auth.authenticate(req.headers.authorization, req.headers.cookie);
    if (!auth) throw new HttpError(401, 'Authentication required');
    if (!auth.access.scopes.includes(scope)) throw new HttpError(403, 'Scope not permitted');
    if (
      auth.cookie &&
      !['GET', 'HEAD'].includes(req.method ?? 'GET') &&
      req.headers['x-mergepilot-csrf'] !== auth.access.csrf
    )
      throw new HttpError(403, 'CSRF check failed');
    return auth.access;
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      this.origin(req);
      const url = new URL(req.url ?? '/', 'http://localhost'),
        method = req.method ?? 'GET';
      if (url.pathname === '/healthz' && method === 'GET') {
        this.json(res, 200, { status: 'ok' });
        return;
      }
      if (url.pathname === '/webhooks/github' && method === 'POST') {
        if (!this.options.webhookSecret || !this.options.installationId)
          throw new HttpError(404, 'Webhook integration is disabled');
        const raw = await readBody(req);
        let result;
        try {
          result = new WebhookReceiver(
            this.store,
            this.options.webhookSecret,
            this.options.installationId,
          ).receive(
            raw,
            String(req.headers['x-github-event'] ?? ''),
            String(req.headers['x-hub-signature-256'] ?? ''),
            String(req.headers['x-github-delivery'] ?? ''),
          );
        } catch {
          throw new HttpError(401, 'Webhook authentication or payload validation failed');
        }
        this.json(res, 200, result);
        return;
      }
      if (url.pathname === '/api/login' && method === 'POST') {
        const key = req.socket.remoteAddress ?? 'unknown',
          now = Date.now(),
          attempt = this.attempts.get(key);
        if (attempt && attempt.until > now && attempt.count >= 10)
          throw new HttpError(429, 'Login rate limit reached');
        if (this.attempts.size > 10000) this.attempts.clear();
        this.attempts.set(key, {
          count: attempt && attempt.until > now ? attempt.count + 1 : 1,
          until: attempt && attempt.until > now ? attempt.until : now + 60000,
        });
        const body = z
          .object({ token: z.string().max(200) })
          .strict()
          .parse(JSON.parse((await readBody(req, 4096)).toString()));
        let login;
        try {
          login = this.auth.login(body.token);
        } catch {
          throw new HttpError(401, 'Authentication failed');
        }
        const secure =
          this.options.externalOrigin?.startsWith('https:') ||
          (this.options.trustProxy && req.headers['x-forwarded-proto'] === 'https');
        res.setHeader(
          'Set-Cookie',
          `mergepilot_session=${login.session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? '; Secure' : ''}`,
        );
        this.json(res, 200, {
          principal: login.access.principal,
          scopes: login.access.scopes,
          csrf: login.access.csrf,
        });
        return;
      }
      if (url.pathname.startsWith('/api/') || url.pathname === '/mcp') {
        const scope = url.pathname === '/api/sync' ? 'sync' : 'read',
          access = this.access(req, scope),
          data = this.tenant(access.principal);
        if (url.pathname === '/api/profile' && method === 'GET') {
          this.json(res, 200, {
            principal: access.principal,
            scopes: access.scopes,
            csrf: access.csrf,
          });
          return;
        }
        if (url.pathname === '/api/logout' && method === 'POST') {
          this.auth.logout(req.headers.cookie);
          res.setHeader(
            'Set-Cookie',
            'mergepilot_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
          );
          this.json(res, 200, { loggedOut: true });
          return;
        }
        if (url.pathname === '/api/sync' && method === 'POST') {
          const count = importMetadata(data, JSON.parse((await readBody(req)).toString()));
          this.json(res, 200, { imported: count, source: 'synced' });
          return;
        }
        const items = summaries(data);
        if (url.pathname === '/api/sessions' && method === 'GET') {
          const offset = z.coerce
            .number()
            .int()
            .min(0)
            .max(1000)
            .parse(url.searchParams.get('offset') ?? 0);
          this.json(res, 200, {
            sessions: items.slice(offset, offset + 100),
            nextOffset: items.length > offset + 100 ? offset + 100 : null,
          });
          return;
        }
        if (url.pathname === '/api/metrics' && method === 'GET') {
          this.json(res, 200, aggregateMetadata(items));
          return;
        }
        const match = url.pathname.match(/^\/api\/sessions\/([a-f0-9-]+)$/);
        if (match && method === 'GET') {
          const found = items.find((s) => s.id === match[1]);
          if (!found) throw new HttpError(404, 'Session not found');
          this.json(res, 200, { session: found });
          return;
        }
        if (url.pathname === '/mcp' && method === 'POST') {
          const request = z
            .object({
              jsonrpc: z.literal('2.0'),
              id: z.union([z.string(), z.number(), z.null()]).optional(),
              method: z.string(),
              params: z.record(z.string(), z.unknown()).optional(),
            })
            .parse(JSON.parse((await readBody(req)).toString()));
          if (request.id === undefined) {
            res.writeHead(202);
            res.end();
            return;
          }
          const tools = [
            {
              name: 'get_status',
              description: 'Read a redacted session summary.',
              inputSchema: {
                type: 'object',
                properties: { sessionId: { type: 'string', format: 'uuid' } },
                required: ['sessionId'],
                additionalProperties: false,
              },
              annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
            },
            {
              name: 'list_sessions',
              description: 'List redacted contribution sessions.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
            },
            {
              name: 'get_metrics',
              description: 'Read observed contribution metrics.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
            },
          ];
          let result: unknown;
          if (request.method === 'initialize')
            result = {
              protocolVersion: '2025-06-18',
              capabilities: { tools: {} },
              serverInfo: { name: 'mergepilot-readonly', version: '0.1.0' },
              instructions:
                'Hosted access is read-only. Continue coding and action approvals through the local CLI.',
            };
          else if (request.method === 'ping') result = {};
          else if (request.method === 'tools/list') result = { tools };
          else if (request.method === 'tools/call') {
            const name = request.params?.name,
              args = request.params?.arguments ?? {};
            let value: unknown;
            if (name === 'list_sessions') value = { sessions: items.slice(0, 100) };
            else if (name === 'get_metrics') value = aggregateMetadata(items);
            else if (name === 'get_status') {
              const input = z.object({ sessionId: z.uuid() }).strict().parse(args);
              value = items.find((s) => s.id === input.sessionId);
              if (!value) throw new HttpError(404, 'Session not found');
            } else throw new HttpError(403, 'Hosted contribution actions are read-only');
            result = {
              structuredContent: value,
              content: [{ type: 'text', text: JSON.stringify(value) }],
            };
          } else {
            this.json(res, 200, {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32601, message: 'Method not found' },
            });
            return;
          }
          this.json(res, 200, { jsonrpc: '2.0', id: request.id, result });
          return;
        }
        throw new HttpError(404, 'Endpoint not found');
      }
      if (method === 'GET' && this.options.dashboardRoot) {
        const relative =
          url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, '');
        const file = within(this.options.dashboardRoot, relative);
        try {
          if (!statSync(file).isFile()) throw new Error();
        } catch {
          throw new HttpError(404, 'Asset not found');
        }
        const mime: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.svg': 'image/svg+xml',
        };
        res.writeHead(200, {
          'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        });
        res.end(readFileSync(file));
        return;
      }
      throw new HttpError(404, 'Endpoint not found');
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof z.ZodError || error instanceof SyntaxError
            ? 400
            : 500;
      this.json(res, status, {
        error:
          status === 500
            ? 'Request could not be completed'
            : String(error instanceof Error ? error.message : error),
      });
    }
  }
  async listen(): Promise<number> {
    const host = this.options.host ?? '127.0.0.1';
    if (
      !['127.0.0.1', '::1', 'localhost'].includes(host) &&
      !this.options.externalOrigin?.startsWith('https:')
    )
      throw new Error('Remote hosting requires an explicitly configured HTTPS external origin');
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.options.port ?? 5178, host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP listener unavailable');
    return address.port;
  }
  async close(): Promise<void> {
    if (this.server.listening)
      await new Promise<void>((resolve, reject) =>
        this.server.close((error) => (error ? reject(error) : resolve())),
      );
    for (const store of this.tenants.values()) store.close();
    this.tenants.clear();
  }
}
