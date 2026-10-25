import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import type {Store} from '../state/store.js';
import type {QualityCheck} from '../core/models.js';
import type {ExecutionRecord} from './runner.js';
import {within} from '../security/boundaries.js';
import {patchFingerprint} from '../git/patch.js';
export async function ingestExecutions(store:Store,sessionId:string,ids:string[]):Promise<QualityCheck[]>{
  const session=store.get(sessionId);if(!session.workspace||session.stopped)throw new Error('Active workspace required');
  const patchHash=await patchFingerprint(session.workspace),checks:QualityCheck[]=[];
  for(const id of ids){
    const execution=store.read<ExecutionRecord>('executions',id);
    if(!execution||execution.sessionId!==sessionId)throw new Error('Unknown execution or wrong session');
    const planned=session.commands.find(c=>c.id===execution.check.id);
    if(!planned||createHash('sha256').update(JSON.stringify(planned)).digest('hex')!==execution.commandHash)throw new Error('Execution does not match the current command plan');
    const check=execution.check;
    if(!check.verified||!check.outputPath||!check.outputHash||!check.finishedAt)throw new Error('Execution evidence is incomplete');
    const path=within(join(store.root,'artifacts',sessionId),check.outputPath);
    if(createHash('sha256').update(readFileSync(path)).digest('hex')!==check.outputHash)throw new Error('Captured output was modified');
    if(check.patchHash!==patchHash)throw new Error('Patch changed after execution; rerun checks');
    if(check.status==='PASS'&&check.exitCode!==0)throw new Error('Passing check requires successful actual execution');
    checks.push(check);
  }
  store.mutate(sessionId,s=>{const merged=new Map(s.validation.map(c=>[c.id,c]));for(const check of checks)merged.set(check.id,check);s.validation=[...merged.values()];s.publishApproved=false;s.proposal=undefined;s.state='VALIDATION';});
  return checks;
}
