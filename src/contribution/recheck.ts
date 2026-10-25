import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import type {Store} from '../state/store.js';
import type {GitHubClient} from '../github/client.js';
import type {IssueEvidence,Session} from '../core/models.js';
import type {Relaxable} from '../discovery/eligibility.js';
import {DiscoveryEngine} from '../discovery/engine.js';
import {inspectPatch} from './quality.js';
import {readiness} from './readiness.js';
import {within} from '../security/boundaries.js';
export function assertFreshEligibility(issue:IssueEvidence,baseSha:string,currentBase:string):void {if(issue.eligibility!=='ELIGIBLE')throw new Error('Eligibility changed: '+issue.rejectReasons.join('; '));if(baseSha!==currentBase)throw new Error('Upstream changed since analysis; refresh the workspace and validation before publishing');}
export async function preSubmissionRecheck(store:Store,id:string,client:GitHubClient,signal?:AbortSignal):Promise<Session>{
  const s=store.get(id);if(s.stopped||s.dryRun||!s.proposal||!s.workspace||!s.repository||!s.selectedIssue)throw new Error('Publication requires a prepared active non-dry-run session');
  const inspection=await inspectPatch(s),verdict=readiness(s,inspection);
  if(verdict.status==='BLOCKED'||inspection.patchHash!==s.proposal.patchHash)throw new Error('Patch readiness changed: '+verdict.blockers.join('; '));
  for(const check of s.validation.filter(c=>c.verified)){
    if(!check.outputPath||!check.outputHash)throw new Error('Missing execution logs');
    const path=within(join(store.root,'artifacts',id),check.outputPath);
    if(createHash('sha256').update(readFileSync(path)).digest('hex')!==check.outputHash)throw new Error('Validation log was modified');
  }
  const actor=await client.request<{login:string}>('GET','/user',{},signal);if(actor.login!==s.proposal.actor)throw new Error('Authenticated actor differs from the approved publication identity');
  const metadata=await client.request<{archived:boolean,private:boolean,default_branch:string}>('GET',`/repos/${s.repository.fullName}`,{},signal);
  if(metadata.archived||metadata.private||metadata.default_branch!==s.proposal.base)throw new Error('Repository availability or base branch changed');
  const fresh=await new DiscoveryEngine(client,store).verify(s.repository,s.selectedIssue.issueNumber,signal,store.read<Relaxable[]>('relaxations',id)??[]);
  if(s.prUrl){fresh.knownLinkedPRs=fresh.knownLinkedPRs.filter(url=>url!==s.prUrl);fresh.competingPRs=fresh.competingPRs.filter(url=>url!==s.prUrl);}
  const policy=store.read<{commit:string}>('policies',s.repository.fullName);if(!policy)throw new Error('Fresh policy evidence unavailable');
  assertFreshEligibility(fresh,s.proposal.baseSha,policy.commit);
  store.event(id,'pre-submission-rechecked',{checkedAt:fresh.checkedAt,issueUrl:fresh.url,patchHash:inspection.patchHash});
  return store.mutate(id,x=>{x.selectedIssue=fresh;});
}
