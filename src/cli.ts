#!/usr/bin/env node
import {serveStdio} from './mcp/transport.js';
import {VERSION} from './index.js';
import {Application} from './mcp/application.js';
import {Store} from './state/store.js';
import {serveOfficialSdk} from './mcp/sdk.js';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {registerDiscovery} from './mcp/discovery-tools.js';
async function main(){
  const command=process.argv[2]??'mcp';
  if(command==='--version'){console.log(VERSION);return;}
  if(command==='--help'||command==='help'){console.log('MergePilot MCP\n  mergepilot mcp       Start STDIO server\n  mergepilot --version\nState and approvals remain local.');return;}
  if(command!=='mcp')throw new Error('Unknown command; use --help');
  const store=new Store(process.env.MERGEPILOT_DATA_DIR??join(homedir(),'.local','share','mergepilot'));
  const application=new Application(store);
  registerDiscovery(application);
  process.once('SIGTERM',()=>{store.close();process.exit(0);});
  if(await serveOfficialSdk(application))return;
  console.error('Official MCP SDK v2 unavailable; using the tested 2025-06-18 compatibility transport. Install @modelcontextprotocol/server for the 2026 protocol.');
  try{await serveStdio(application);}finally{store.close();}
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
