import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpService } from '../src/http/server.js';
export async function request(
  service: HttpService,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
) {
  const data =
    options.body === undefined
      ? ''
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  const input = Object.assign(Readable.from(data ? [Buffer.from(data)] : []), {
    url: path,
    method: options.method ?? 'GET',
    headers: { host: '127.0.0.1:5178', ...options.headers },
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage;
  let status = 200,
    body = '';
  const headers: Record<string, string> = {};
  const response = {
    headersSent: false,
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = String(value);
    },
    writeHead(code: number, values: Record<string, string> = {}) {
      status = code;
      Object.assign(headers, values);
      this.headersSent = true;
    },
    end(value?: string | Buffer) {
      if (value) body += value.toString();
    },
    destroy() {
      throw new Error('Response destroyed');
    },
  } as unknown as ServerResponse;
  await service.handle(input, response);
  return { status, headers, body, json: () => JSON.parse(body) };
}
