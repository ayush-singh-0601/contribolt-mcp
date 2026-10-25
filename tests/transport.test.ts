import {it,expect} from 'vitest';
import {Readable,Writable} from 'node:stream';
import {serveStdio} from '../src/mcp/transport.js';
it('negotiates legacy protocol and reports actual tool failures',async()=>{let output='';const sink=new Writable({write(chunk,_,done){output+=String(chunk);done();}});await serveStdio({listTools:()=>[],callTool:async()=>{throw new Error('blocked');}},Readable.from(['{"jsonrpc":"2.0","id":1,"method":"initialize"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"x"}}\n']),sink);const results=output.trim().split('\n').map(x=>JSON.parse(x));expect(results[0].result.protocolVersion).toBe('2025-06-18');expect(results[1].result.isError).toBe(true);});
