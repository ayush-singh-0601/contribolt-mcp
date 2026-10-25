import {applyManifests} from './manifests.js';
import type {Policy,Evidence,Repository} from '../core/models.js';
import type {PolicyDocument} from './policy-sources.js';
export interface PolicyDecision {policy:Policy;disclosures:string[];blockers:string[];evidence:Evidence[];signoff:boolean;claUrls:string[];templates:PolicyDocument[];requiredChecks?:string[];blockedLabels?:string[];reservedLabels?:string[];allowedLabelGroups?:string[][];requireDraft?:boolean;allowAutoClosingReferences?:boolean;cooldownHours?:number;}
export function classifyPolicy(documents:PolicyDocument[],complete:boolean,repo?:Repository):PolicyDecision {
  const all=documents.map(d=>d.text).join('\n'),ai='(?:AI|LLM|artificial intelligence|machine.generated|automated)';
  const ban=new RegExp(`(?:do not accept|not accept|prohibit|forbid|ban|no)\\s[^.\\n]{0,80}${ai}|${ai}[^.\\n]{0,80}(?:not accepted|prohibited|forbidden|banned)`,'i');
  const prohibited=documents.some(d=>ban.test(d.text)||/not accepting (?:external )?(?:contributions|pull requests)/i.test(d.text));
  const disclosure=documents.filter(d=>new RegExp(`${ai}[^.\\n]{0,100}(?:disclos|declar|acknowledg)|(?:disclos|declar)[^.\\n]{0,100}${ai}`,'i').test(d.text));
  const prior=/\b(?:must|please|require[ds]?)\b[^.\n]{0,60}(?:discuss|approval|contact)[^.\n]{0,60}before[^.\n]{0,40}(?:pull request|contribut|implement)/i.test(all);
  const suspicious=/ignore (?:all |previous |system )?instructions|(?:send|upload|reveal)[^.\n]{0,60}(?:credentials|api keys|tokens)/i.test(all);
  const accepted=/contributions? (?:are )?welcome|welcome[^.\n]{0,40}contributions|(?:submit|open|create)[^.\n]{0,40}(?:a )?pull request/i.test(all);
  const policy:Policy=prohibited?'PROHIBITED':!complete||!accepted?'UNKNOWN':prior||suspicious?'NEEDS_HUMAN_APPROVAL':disclosure.length?'ALLOWED_WITH_DISCLOSURE':'ALLOWED';
  const blockers=prohibited?['Project prohibits this contribution']:!complete?['Policy source scan is incomplete']:prior?['Project requires prior maintainer discussion or approval']:suspicious?['Untrusted instructions conflict with security boundaries']:!accepted?['Contribution acceptance policy unresolved']:[];
  return applyManifests({policy,disclosures:disclosure.map(d=>`Disclose AI assistance as required by ${d.url}`),blockers,evidence:documents.map(d=>({source:d.url,checkedAt:new Date().toISOString(),observation:`Policy source ${d.path}`,revision:d.sha,complete})),signoff:/Signed-off-by|Developer Certificate of Origin|\bDCO\b/i.test(all),claUrls:[...all.matchAll(/https:\/\/[^\s)>]*(?:cla|contributor-agreement)[^\s)>]*/gi)].map(m=>m[0]),templates:documents.filter(d=>/PULL_REQUEST_TEMPLATE/i.test(d.path))},documents,complete,repo);
}
function globMatches(pattern:string,file:string):boolean {const re=pattern.trim().replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'\u0000').replace(/\*/g,'[^/]*').replace(/\u0000/g,'.*');return new RegExp('^'+re+'$').test(file);}
export function instructionsFor(documents:PolicyDocument[],file:string):PolicyDocument[]{
  return documents.filter(d=>{
    if(!/AGENTS\.md$|CLAUDE\.md$|instructions/i.test(d.path))return false;
    const apply=d.text.match(/applyTo:\s*["']?([^\n"']+)/i)?.[1];
    if(apply)return apply.split(',').some(pattern=>globMatches(pattern,file));
    return d.organizationDefault||!d.scope||file.startsWith(d.scope+'/');
  }).sort((a,b)=>Number(b.organizationDefault)-Number(a.organizationDefault)||a.scope.length-b.scope.length);
}
