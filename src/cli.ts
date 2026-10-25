#!/usr/bin/env node
import {serveStdio,type ProtocolHandler} from './mcp/transport.js';
import {VERSION} from './index.js';
export const emptyProtocol:ProtocolHandler={listTools:()=>[],callTool:async()=>{throw new Error('Unknown tool');}};
async function main(){
  const command=process.argv[2]??'mcp';
  if(command==='--version'){console.log(VERSION);return;}
  if(command==='--help'||command==='help'){console.log('MergePilot MCP\n  mergepilot mcp       Start STDIO server\n  mergepilot --version\nState and approvals remain local.');return;}
  if(command!=='mcp')throw new Error('Unknown command; use --help');
  await serveStdio(emptyProtocol);
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
