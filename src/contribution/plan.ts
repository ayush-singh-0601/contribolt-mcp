import {AnalysisSchema,type Analysis,type Session} from '../core/models.js';
export function assessReproduction(analysis:Analysis):{blocked:boolean,reasons:string[]}{
  const parsed=AnalysisSchema.parse(analysis),reasons:string[]=[];
  if(/already fixed|cannot determine|ambiguous|out.of.date|stale issue/i.test(parsed.rootCause))reasons.push('Issue requires clarification or is already resolved');
  if(!parsed.reproduced&&(parsed.reproductionExplanation.trim().length<30||parsed.evidenceUrls.length<2))reasons.push('Unavailable reproduction requires an explanation and stronger code evidence');
  return {blocked:reasons.length>0,reasons};
}
export function implementationPlan(session:Session):string {
  if(!session.analysis)throw new Error('Host analysis required');
  const a=session.analysis,assessment=assessReproduction(a);
  if(assessment.blocked)throw new Error(assessment.reasons.join('; '));
  return `# Fix plan\n\nIssue: ${session.selectedIssue?.url}\n\nExpected: ${a.expected}\n\nActual: ${a.actual}\n\nRoot cause hypothesis: ${a.rootCause}\n\nReproduction: ${a.reproduced?'Recorded':a.reproductionExplanation}\n\nStrategy: ${a.strategy}\n\nFiles:\n${a.files.map(f=>'- '+f).join('\n')}\n\nEvidence:\n${a.evidenceUrls.map(u=>'- '+u).join('\n')}\n\nImplement only this scope. Capture actual check output, then request an independent diff critique.\n`;
}
