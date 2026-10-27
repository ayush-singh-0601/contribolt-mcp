import { it, expect } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { serveStdio } from '../src/mcp/transport.js';
import { VERSION } from '../src/index.js';
it('negotiates legacy protocol and reports actual tool failures', async () => {
  let output = '';
  const sink = new Writable({
    write(chunk, _, done) {
      output += String(chunk);
      done();
    },
  });
  await serveStdio(
    {
      listTools: () => [],
      callTool: async () => {
        throw new Error('blocked');
      },
    },
    Readable.from([
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"x"}}\n',
    ]),
    sink,
  );
  const results = output
    .trim()
    .split('\n')
    .map((x) => JSON.parse(x));
  expect(results[0].result.protocolVersion).toBe('2025-06-18');
  expect(results[0].result.serverInfo.version).toBe(VERSION);
  expect(results[1].result.isError).toBe(true);
});
it('rejects malformed JSON-RPC values without terminating the connection', async () => {
  let output = '';
  const sink = new Writable({
      write(chunk, _, done) {
        output += chunk;
        done();
      },
    }),
    frames = [
      'null',
      '[]',
      '{}',
      '{"jsonrpc":"2.0","id":{},"method":"ping"}',
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}',
      '{"jsonrpc":"2.0","id":2,"method":"ping","params":[]}',
      '{"jsonrpc":"2.0","id":3,"method":"ping"}',
    ];
  await serveStdio(
    { listTools: () => [], callTool: async () => ({}) },
    Readable.from([frames.join('\n') + '\n']),
    sink,
  );
  const replies = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(replies).toHaveLength(7);
  expect(replies.slice(0, 4).every((reply) => reply.error.code === -32600)).toBe(true);
  expect(replies[5].error.code).toBe(-32602);
  expect(replies[6].result).toEqual({});
});
it('preserves UTF-8 across chunks and limits frames rather than combined stream chunks', async () => {
  let output = '';
  const sink = new Writable({
      write(chunk, _, done) {
        output += chunk;
        done();
      },
    }),
    handler = { listTools: () => [], callTool: async (_name: string, args: unknown) => args };
  const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    message = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'echo', arguments: { text: 'café' } },
    }),
    bytes = Buffer.from(init + '\n' + message + '\n'),
    at = bytes.indexOf(Buffer.from('é')) + 1;
  await serveStdio(handler, Readable.from([bytes.subarray(0, at), bytes.subarray(at)]), sink);
  expect(JSON.parse(output.trim().split('\n')[1]!).result.structuredContent.text).toBe('café');
  output = '';
  const request = (id: number) =>
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'echo', arguments: { text: 'a'.repeat(600000) } },
    });
  await serveStdio(
    handler,
    Readable.from([init + '\n' + request(2) + '\n' + request(3) + '\n']),
    sink,
  );
  expect(output.trim().split('\n')).toHaveLength(3);
});
