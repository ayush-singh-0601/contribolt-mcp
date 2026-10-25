import type { Readable, Writable } from 'node:stream';
import { redact } from '../core/audit.js';
import { StringDecoder } from 'node:string_decoder';
import { stdioOutput } from './output.js';
export interface ProtocolHandler {
  listTools(): unknown[];
  callTool(name: string, args: unknown): Promise<unknown>;
  resources?(): unknown[];
  readResource?(uri: string): Promise<unknown>;
  prompts?(): unknown[];
  getPrompt?(name: string, args: unknown): unknown;
}
export async function serveStdio(
  handler: ProtocolHandler,
  input: Readable = process.stdin,
  output: Writable = stdioOutput(),
): Promise<void> {
  let buffer = '',
    initialized = false;
  const send = (value: unknown) => output.write(JSON.stringify(redact(value)) + '\n');
  async function dispatch(line: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid JSON-RPC request' },
      });
      return;
    }
    const request = parsed as Record<string, unknown>,
      id = request.id;
    if (
      request.jsonrpc !== '2.0' ||
      typeof request.method !== 'string' ||
      (id !== undefined && id !== null && typeof id !== 'string' && typeof id !== 'number')
    ) {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid JSON-RPC request' },
      });
      return;
    }
    if (id === undefined) return;
    try {
      if (request.jsonrpc !== '2.0' || typeof request.method !== 'string')
        throw new Error('Invalid JSON-RPC request');
      if (
        request.params !== undefined &&
        (!request.params || typeof request.params !== 'object' || Array.isArray(request.params))
      )
        throw new Error('Expected object parameters');
      const params = (request.params ?? {}) as Record<string, unknown>;
      let result: unknown;
      if (request.method === 'server/discover') {
        send({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: 'This compatibility transport supports the 2025-06-18 initialize handshake',
          },
        });
        return;
      }
      if (request.method === 'initialize') {
        if (initialized) throw new Error('Connection is already initialized');
        initialized = true;
        result = {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: 'mergepilot', version: '0.1.0' },
          instructions:
            'Use start_contribution. Follow nextAction. Public writes require a recorded human approval.',
        };
      } else if (!initialized) throw new Error('Initialize before invoking tools');
      else if (request.method === 'ping') result = {};
      else if (request.method === 'tools/list') result = { tools: handler.listTools() };
      else if (request.method === 'tools/call') {
        try {
          const value = await handler.callTool(String(params.name), params.arguments ?? {});
          result = {
            content: [{ type: 'text', text: JSON.stringify(redact(value)) }],
            structuredContent: redact(value),
          };
        } catch (error) {
          result = { isError: true, content: [{ type: 'text', text: String(error) }] };
        }
      } else if (request.method === 'resources/list')
        result = { resources: handler.resources?.() ?? [] };
      else if (request.method === 'resources/read')
        result = await handler.readResource?.(String(params.uri));
      else if (request.method === 'prompts/list') result = { prompts: handler.prompts?.() ?? [] };
      else if (request.method === 'prompts/get')
        result = handler.getPrompt?.(String(params.name), params.arguments);
      else {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
        return;
      }
      send({ jsonrpc: '2.0', id, result });
    } catch (error) {
      send({ jsonrpc: '2.0', id, error: { code: -32602, message: String(error) } });
    }
  }
  let queue = Promise.resolve();
  const decoder = new StringDecoder('utf8');
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (Buffer.byteLength(line) > 1048576) throw new Error('MCP message exceeds 1 MiB');
      if (line.trim()) queue = queue.then(() => dispatch(line));
    }
    if (Buffer.byteLength(buffer) > 1048576) throw new Error('MCP message exceeds 1 MiB');
  }
  buffer += decoder.end();
  if (buffer.trim()) queue = queue.then(() => dispatch(buffer));
  await queue;
  await new Promise<void>((resolve, reject) =>
    output.write('', (error) => (error ? reject(error) : resolve())),
  );
}
