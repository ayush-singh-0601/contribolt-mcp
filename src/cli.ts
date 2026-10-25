#!/usr/bin/env node
import {serveStdio} from './mcp/transport.js';
import {VERSION} from './index.js';
import {Application} from './mcp/application.js';
import {Store} from './state/store.js';
import {serveOfficialSdk} from './mcp/sdk.js';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {registerDiscovery} from './mcp/discovery-tools.js';
import {registerAnalysis} from './mcp/analysis-tools.js';
import {registerExecution} from './mcp/execution-tools.js';
import {executeCheck} from './execution/runner.js';
import {registerQuality} from './mcp/quality-tools.js';
import {registerPreparation} from './mcp/preparation-tools.js';
import {registerApprovals} from './mcp/approval-tools.js';
import {Approvals} from './security/approvals.js';
import {createInterface} from 'node:readline/promises';
async function main(){
  const command=process.argv[2]??'mcp';
  if(command==='--version'){console.log(VERSION);return;}
  if(command==='--help'||command==='help'){console.log('MergePilot MCP\n  mergepilot mcp       Start STDIO server\n  mergepilot --version\nState and approvals remain local.');return;}
  if(!['mcp','run-check','approve'].includes(command))throw new Error('Unknown command; use --help');
  const store=new Store(process.env.MERGEPILOT_DATA_DIR??join(homedir(),'.local','share','mergepilot'));
  if(command==='approve'){
    if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Approval requires a human interactive terminal; piped confirmations are refused');
    const approvals=new Approvals(store),request=approvals.get(process.argv[3]??'');
    console.log(JSON.stringify(request.payload,null,2));
    const terminal=createInterface({input:process.stdin,output:process.stdout});
    try{const answer=await terminal.question(`Review this exact ${request.action} action, including limitations and legal requirements. Type approve ${request.id} to authorize: `);if(answer!==`approve ${request.id}`)throw new Error('Approval declined');await approvals.confirmFromHuman(request.id);console.log('Recorded explicit authorization for this action.');}finally{terminal.close();store.close();}return;
  }
  if(command==='run-check'){
    const [id,check,...flags]=process.argv.slice(3);
    if(!id||!check||!flags.includes('--host-approved')||flags.some(f=>!['--host-approved','--allow-network'].includes(f)))throw new Error('run-check requires session id, check id and --host-approved from an approved host environment');
    try{const result=await executeCheck(store,id,check,{source:'host-approved-execution',network:flags.includes('--allow-network')});console.log(JSON.stringify({executionId:result.id,check:result.check}));}finally{store.close();}return;
  }
  const application=new Application(store);
  registerDiscovery(application);
  registerAnalysis(application);
  registerExecution(application);
  registerQuality(application);
  registerPreparation(application);
  registerApprovals(application);
  process.once('SIGTERM',()=>{store.close();process.exit(0);});
  if(await serveOfficialSdk(application))return;
  console.error('Official MCP SDK v2 unavailable; using the tested 2025-06-18 compatibility transport. Install @modelcontextprotocol/server for the 2026 protocol.');
  try{await serveStdio(application);}finally{store.close();}
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
