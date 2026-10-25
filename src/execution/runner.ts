import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import type {Store} from '../state/store.js';
import {CommandSchema,type CheckCommand,type QualityCheck} from '../core/models.js';
import {within,sanitizedEnvironment} from '../security/boundaries.js';
import {patchFingerprint} from '../git/patch.js';
import {redact} from '../core/audit.js';
export interface ExecutionConsent {source:'host-approved-execution'|'interactive-cli';network:boolean;}
export interface ExecutionRecord {id:string;sessionId:string;consent:ExecutionConsent;check:QualityCheck;commandHash:string;}
export async function executeCheck(store:Store,sessionId:string,checkId:string,consent:ExecutionConsent,signal?:AbortSignal):Promise<ExecutionRecord>{
  const session=store.get(sessionId);if(session.stopped||!session.workspace)throw new Error('Active isolated workspace required');
  const candidate=session.commands.find(c=>c.id===checkId);if(!candidate)throw new Error('Command is not in the recorded plan');
  const command=CommandSchema.parse(candidate);within(session.workspace,command.cwd);
  if(command.network&&!consent.network)throw new Error('Network/bootstrap authorization required');
  if(!['host-approved-execution','interactive-cli'].includes(consent.source))throw new Error('Execution approval required');
  const before=await patchFingerprint(session.workspace),startedAt=new Date().toISOString();
  const result=await runProcess(command,signal);
  const after=await patchFingerprint(session.workspace),id=randomUUID();
  const output=String(redact(result.output)),outputPath=store.artifact(sessionId,`check-${id}.log`,output);
  const check:QualityCheck={id:command.id,name:command.name,status:result.unavailable?'UNAVAILABLE':result.cancelled?'SKIPPED':result.exitCode===0&&before===after?'PASS':'FAIL',command,exitCode:result.exitCode,outputPath,outputHash:createHash('sha256').update(output).digest('hex'),patchHash:before,startedAt,finishedAt:new Date().toISOString(),explanation:before!==after?'Command changed the tested patch; rerun after inspection':result.reason,verified:true};
  const record:ExecutionRecord={id,sessionId,consent,check,commandHash:createHash('sha256').update(JSON.stringify(command)).digest('hex')};
  store.put('executions',id,record);store.event(sessionId,'command-executed',{executionId:id,commandId:command.id,status:check.status,consent});return record;
}
export async function runProcess(command:CheckCommand,signal?:AbortSignal):Promise<{exitCode:number|null;output:string;unavailable:boolean;cancelled:boolean;reason?:string}>{
  signal?.throwIfAborted();
  return new Promise(resolve=>{
    let output='',cancelled=false,unavailable=false,reason:string|undefined,finished=false;
    const child=spawn(command.executable,command.args,{cwd:command.cwd,env:sanitizedEnvironment(process.env,['RUSTUP_HOME']),shell:false,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
    const stop=()=>{cancelled=true;try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM');}catch{/* Process may already have exited. */}};
    const timer=setTimeout(()=>{reason='Command timed out';stop();},command.timeoutMs);
    const append=(chunk:Buffer)=>{if(Buffer.byteLength(output)+chunk.length>2*1024*1024){reason='Output limit exceeded';stop();}else output+=chunk.toString('utf8');};
    child.stdout.on('data',append);child.stderr.on('data',append);signal?.addEventListener('abort',stop,{once:true});
    const done=(exitCode:number|null)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);resolve({exitCode,output,unavailable,cancelled,reason});};
    child.on('error',(error:NodeJS.ErrnoException)=>{unavailable=error.code==='ENOENT';reason=error.message;output+=error.message;done(null);});child.on('close',done);
  });
}
