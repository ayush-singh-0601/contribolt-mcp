import {policyKey} from '../repository/policy-store.js';
import type {Store} from '../state/store.js';
import type {GitHubClient} from '../github/client.js';
import {ForgeError} from '../github/client.js';
import {Approvals} from '../security/approvals.js';
import type {PolicyDocument} from '../repository/policy-sources.js';
export function codeOwners(text:string,files:string[]):string[]{
  const owners=new Set<string>();
  for(const file of files){let matched:string[]=[];for(const raw of text.split('\n')){const line=raw.replace(/\s+#.*$/,'').trim();if(!line||line.startsWith('#'))continue;const [pattern,...people]=line.split(/\s+/);if(!pattern||/[!\[\]\\]/.test(pattern))continue;const anchored=pattern.startsWith('/'),directory=pattern.endsWith('/');const literal=pattern.replace(/^\//,'').replace(/[.+^${}()|]/g,'\\$&').replace(/\*\*/g,'\u0000').replace(/\*/g,'[^/]*').replace(/\u0000/g,'.*');const regex=new RegExp((anchored||pattern.includes('/')?'^':'(?:^|.*/)')+literal+(directory?'.*':'$'));if(regex.test(file))matched=people.filter(p=>/^@[\w-]+(?:\/[\w-]+)?$/.test(p));}for(const owner of matched)owners.add(owner);}
  return [...owners];
}
export interface RoutingResult {status:'requested'|'auto-routed via CODEOWNERS'|'not possible due to permissions'|'awaiting project triage';reason:string;reviewers:string[];teams:string[];}
export async function routeReview(store:Store,id:string,client:GitHubClient,approvalId?:string):Promise<RoutingResult>{
  const s=store.get(id);if(!s.prUrl||!s.prNumber||!s.repository||!s.proposal||s.stopped)throw new Error('Active confirmed PR required');
  const repo=s.repository.fullName,path=`/repos/${repo}/pulls/${s.prNumber}`,policy=store.read<{documents:PolicyDocument[]}>('policies',policyKey(s.repository));
  const docs=policy?.documents??[],ownerFile=['.github/CODEOWNERS','CODEOWNERS','docs/CODEOWNERS','.gitlab/CODEOWNERS','.forgejo/CODEOWNERS'].map(p=>docs.find(d=>d.path===p)).find(Boolean);
  const legitimate=codeOwners(ownerFile?.text??'',s.proposal.files),ownerOrg=repo.split('/')[0];
  const result=(status:RoutingResult['status'],reason:string,reviewers:string[]=[],teams:string[]=[]):RoutingResult=>{store.mutate(id,x=>{x.state='REVIEW_MONITORING';});store.event(id,'review-routing',{status,reason,reviewers,teams});return {status,reason,reviewers,teams};};
  let requested:{users:{login:string}[],teams:{slug:string}[]};
  try{requested=await client.request('GET',path+'/requested_reviewers');}catch(error){if(error instanceof ForgeError&&[403,404].includes(error.status))return result('not possible due to permissions','Requested-reviewer state is unavailable; follow normal project triage');throw error;}
  if(!approvalId){if(requested.users.length||requested.teams.length)return result('requested','Confirmed existing GitHub review requests; automatic routing provenance is not asserted',requested.users.map(u=>u.login),requested.teams.map(t=>t.slug));return result('awaiting project triage',s.proposal.draft?'Draft PRs do not automatically request code-owner review':'No observed review request; use the project’s normal review process');}
  if(s.dryRun)throw new Error('Dry run prohibits reviewer requests');
  const approvals=new Approvals(store),grant=approvals.get(approvalId),payload=grant.payload as {prUrl:string,reviewers:string[],teams:string[]};
  if(payload.prUrl!==s.prUrl||!Array.isArray(payload.reviewers)||!Array.isArray(payload.teams))throw new Error('Review approval does not match this PR');
  const intent='review:'+id+':'+grant.digest;approvals.authorize(approvalId,id,'review',payload,intent);
  for(const login of payload.reviewers){if(legitimate.includes('@'+login))continue;try{const role=await client.request<{role_name:string}>('GET',`/repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`);if(!['write','maintain','admin'].includes(role.role_name))throw new Error('Reviewer has no verified project role');}catch{throw new Error('Reviewer must be a documented code owner or have verified repository privileges');}}
  if(payload.teams.some(team=>!legitimate.includes('@'+ownerOrg+'/'+team)))throw new Error('Team is not a relevant documented code owner');
  const previous=store.read<string[]>('review-targets',id)??[],targets=[...payload.reviewers.map(r=>'user:'+r),...payload.teams.map(t=>'team:'+t)];
  const users=payload.reviewers.filter(r=>!requested.users.some(u=>u.login===r)&&!previous.includes('user:'+r)),teams=payload.teams.filter(t=>!requested.teams.some(x=>x.slug===t)&&!previous.includes('team:'+t));
  if(!users.length&&!teams.length)return result('requested','Targets were already requested; repeated pings were suppressed',payload.reviewers,payload.teams);
  approvals.reserve(approvalId,intent);
  try{await client.request('POST',path+'/requested_reviewers',{reviewers:users,team_reviewers:teams});}catch(error){if(error instanceof ForgeError&&[403,404,422].includes(error.status))return result('not possible due to permissions','GitHub refused the reviewer request; awaiting normal triage');throw error;}
  store.put('review-targets',id,[...new Set([...previous,...targets])]);
  const confirmed=await client.request<{users:{login:string}[],teams:{slug:string}[]}>('GET',path+'/requested_reviewers');
  if(!users.every(u=>confirmed.users.some(r=>r.login===u))||!teams.every(t=>confirmed.teams.some(r=>r.slug===t)))return result('awaiting project triage','Reviewer-request write was not confirmed; no success is claimed');
  approvals.consume(approvalId,intent);return result('requested','GitHub confirmed the requested reviewers',payload.reviewers,payload.teams);
}
