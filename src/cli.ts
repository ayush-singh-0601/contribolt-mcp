#!/usr/bin/env node
import {createApplication} from './mcp/bootstrap.js';
import {serveStdio} from './mcp/transport.js';
import {VERSION} from './index.js';
import {Store} from './state/store.js';
import {serveOfficialSdk} from './mcp/sdk.js';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {executeCheck} from './execution/runner.js';
import {Approvals} from './security/approvals.js';
import {createInterface} from 'node:readline/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {adapterIntegrity,conformAdapter,type TrustedAdapter} from './languages/extensions.js';
import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {httpCommands,runHttpCommand} from './http/cli.js';
import {configureCommand} from './integrations/cli.js';
async function main(){
  const command=process.argv[2]??'mcp';
  if(command==='--version'){console.log(VERSION);return;}
  if(command==='configure'){configureCommand(process.argv.slice(3));return;}
  if(command==='--help'||command==='help'){console.log('MergePilot MCP\n  mergepilot mcp       Start STDIO server\n  mergepilot --version\nState and approvals remain local.');return;}
  if(!['mcp','run-check','approve','watch','trust-adapter',...httpCommands].includes(command))throw new Error('Unknown command; use --help');
  const store=new Store(process.env.MERGEPILOT_DATA_DIR??join(homedir(),'.local','share','mergepilot'));
  if(httpCommands.has(command)){await runHttpCommand(command,store,process.argv.slice(3));return;}
  if(command==='trust-adapter'){
    if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Adapter trust requires an interactive user terminal');const file=realpathSync(process.argv[3]??'');
    if(store.list().some(s=>s.workspace&&file.startsWith(s.workspace+'/')))throw new Error('Executable adapters must come from trusted user configuration outside contribution repositories');
    const hash=adapterIntegrity(file),terminal=createInterface({input:process.stdin,output:process.stdout});
    try{const answer=await terminal.question(`Trust executable adapter ${file} (sha256 ${hash}) with the MCP server’s privileges? Type trust to continue: `);if(answer!=='trust')throw new Error('Adapter trust declined');if(adapterIntegrity(file)!==hash)throw new Error('Adapter changed during review');const module=await import(pathToFileURL(file).href);const adapter=conformAdapter(module.default),entries=store.read<TrustedAdapter[]>('config','trustedAdapters')??[];store.put('config','trustedAdapters',[...entries.filter(e=>e.id!==adapter.id),{schemaVersion:1,id:adapter.id,file,sha256:hash,trustedAt:new Date().toISOString()}]);console.log('Trusted adapter recorded.');}finally{terminal.close();store.close();}return;
  }
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
  const application=createApplication(store);
  if(command==='watch'){
    const id=process.argv[3];if(!id)throw new Error('watch requires a published session id');const stop=new AbortController();process.once('SIGINT',()=>stop.abort());
    try{while(!stop.signal.aborted&&!store.get(id).stopped){const snapshot=await application.callTool('monitor_pull_request',{sessionId:id}) as {outcome:string,nextPollAt:number};console.log(JSON.stringify(snapshot));if(snapshot.outcome!=='opened')break;try{await delay(Math.max(1000,snapshot.nextPollAt-Date.now()),undefined,{signal:stop.signal});}catch{break;}}}finally{store.close();}return;
  }
  process.once('SIGTERM',()=>{store.close();process.exit(0);});
  if(await serveOfficialSdk(application))return;
  console.error('Official MCP SDK v2 unavailable; using the tested 2025-06-18 compatibility transport. Install @modelcontextprotocol/server for the 2026 protocol.');
  try{await serveStdio(application);}finally{store.close();}
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
