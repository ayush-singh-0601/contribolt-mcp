import type {Session} from '../core/models.js';
import type {PatchInspection} from './quality.js';
export interface Readiness {status:'READY'|'READY_WITH_DISCLOSED_LIMITATIONS'|'BLOCKED';blockers:string[];limitations:string[];}
export function readiness(session:Session,inspection:PatchInspection):Readiness {
  const blockers=[...inspection.blockers],limitations=[...inspection.warnings];
  if(session.stopped)blockers.push('Session stopped');
  if(!['ALLOWED','ALLOWED_WITH_DISCLOSURE'].includes(session.policyDecision))blockers.push('Policy gate unresolved or prohibited');
  const critique=session.analysis?.critique;
  if(!critique||critique.patchHash!==inspection.patchHash)blockers.push('A current independent patch critique is required');
  if(critique?.findings.length)blockers.push(...critique.findings.map(f=>'Unresolved critique: '+f));
  for(const command of session.commands.filter(c=>c.required&&c.kind!=='bootstrap')){
    const check=session.validation.find(c=>c.id===command.id);
    if(!check){blockers.push(`Required check has not run: ${command.name}`);continue;}
    if(!check.verified||check.patchHash!==inspection.patchHash){blockers.push(`Unverified or stale check: ${command.name}`);continue;}
    if(check.status==='FAIL')blockers.push(`Required check failed: ${command.name}`);
    else if(check.status!=='PASS')limitations.push(`${command.name}: ${check.status}${check.explanation?' — '+check.explanation:''}`);
    else if(check.exitCode!==0||!check.outputPath||!check.outputHash)blockers.push(`Missing execution evidence: ${command.name}`);
  }
  if(!session.commands.some(c=>c.kind==='test'))limitations.push('No automated regression-test command discovered; review reproduction and code evidence explicitly');
  if(!session.analysis?.reproduced)limitations.push('Issue was not reproduced; stronger code evidence is required');
  if(session.analysis?.highRisk&&limitations.length)blockers.push('High-risk changes require complete validation');
  return {status:blockers.length?'BLOCKED':limitations.length?'READY_WITH_DISCLOSED_LIMITATIONS':'READY',blockers,limitations};
}
