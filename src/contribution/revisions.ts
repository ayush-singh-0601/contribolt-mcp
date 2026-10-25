import {z} from 'zod';
import type {Store} from '../state/store.js';
import {AnalysisSchema,type Session} from '../core/models.js';
import type {MonitorSnapshot} from './monitor.js';
import {Approvals,publicationPayload,digest} from '../security/approvals.js';
import {git,assertClean} from '../git/workspace.js';
import {within,safeHttps} from '../security/boundaries.js';
import type {GitHubClient} from '../github/client.js';
import type {Credentials} from '../github/auth.js';
import {GitHubPublicationBackend,type PublishIntent,type Fork} from './publisher.js';
import {preSubmissionRecheck} from './recheck.js';
import {withLease} from '../state/lease.js';
export const RevisionPlanSchema=z.object({analysis:AnalysisSchema,feedbackIds:z.array(z.string()).min(1),reviewedHeadSha:z.string().regex(/^[a-f0-9]{40,64}$/)}).strict();
export async function planRevision(store:Store,id:string,input:unknown,client:GitHubClient,approvalId?:string):Promise<unknown>{
  const plan=RevisionPlanSchema.parse(input),s=store.get(id),snapshot=store.read<MonitorSnapshot>('monitor',id);
  if(s.stopped||!s.workspace||!s.prUrl||!s.proposal||!s.commitSha||!snapshot)throw new Error('Active monitored contribution required');
  if(snapshot.outcome!=='opened'||snapshot.headSha!==plan.reviewedHeadSha)throw new Error('Review plan is stale or PR is closed');
  const allowed=new Set([...snapshot.feedback.map(f=>f.id),...snapshot.ci.map(c=>'ci:'+c.name)]);
  if(plan.feedbackIds.some(f=>!allowed.has(f)))throw new Error('Revision references unknown feedback');
  for(const file of plan.analysis.files)within(s.workspace,file);
  if(!approvalId){store.put('revision-plans',id,plan);return {plan,nextAction:'request_approval',action:'revision_implementation'};}
  const recorded=store.read('revision-plans',id);if(digest(recorded)!==digest(plan))throw new Error('Revision plan changed after review');
  const approvals=new Approvals(store),intent='revision-code:'+id+':'+digest(plan);approvals.authorize(approvalId,id,'revision_implementation',plan,intent);
  const pr=await client.request<{head:{sha:string}}>('GET',`/repos/${s.repository!.fullName}/pulls/${s.prNumber}`);if(pr.head.sha!==plan.reviewedHeadSha)throw new Error('PR changed after revision planning');
  if((await git(s.workspace,['diff','--name-only',s.commitSha,'--'])).trim()||(await git(s.workspace,['ls-files','--others','--exclude-standard'])).trim())throw new Error('Uncommitted local changes must be preserved and reviewed before revision setup');
  approvals.reserve(approvalId,intent);await git(s.workspace,['symbolic-ref','HEAD','refs/heads/'+s.proposal.branch]);await assertClean(s.workspace);
  if(s.commitSha!==pr.head.sha){const published=store.read<PublishIntent>('publish-intents',id);if(!published?.fork)throw new Error('Fork metadata missing');safeHttps(published.fork.cloneUrl,[s.repository!.host]);await git(s.workspace,['fetch','--no-tags','--',published.fork.cloneUrl,'refs/heads/'+s.proposal.branch]);const fetched=(await git(s.workspace,['rev-parse','FETCH_HEAD'])).trim();if(fetched!==pr.head.sha)throw new Error('Fetched branch changed');await git(s.workspace,['merge','--ff-only','FETCH_HEAD']);}
  store.mutate(id,x=>{x.repositoryCommitSha=pr.head.sha;x.commitSha=pr.head.sha;x.analysis={...plan.analysis,critique:undefined};x.commands=[];x.validation=[];x.proposal=undefined;x.publishApproved=false;x.state='PATCH_IMPLEMENTATION';});approvals.consume(approvalId,intent);
  return {plan,nextAction:'Host agent: implement the approved revision in the isolated workspace'};
}
interface RevisionIntent {approvalId:string;digest:string;date:string;sha?:string;finished?:boolean;}
export type RevisionPush=(session:Session,fork:Fork,sha:string,branch:string)=>Promise<void>;
export async function publishRevision(store:Store,id:string,approvalId:string,client:GitHubClient,auth:Credentials,recheck:()=>Promise<Session>=()=>preSubmissionRecheck(store,id,client),pushOverride?:RevisionPush):Promise<unknown>{return withLease(store,'publish:'+id,async assertLease=>{
  const s=store.get(id);if(s.stopped||s.dryRun||!s.prUrl||!s.prNumber||!s.proposal||!s.workspace)throw new Error('Active approved revision proposal required');
  const payload=await publicationPayload(store,s),approvals=new Approvals(store),key=id+':'+s.proposal.patchHash;
  const intent=store.read<RevisionIntent>('revision-intents',key)??{approvalId,digest:digest(payload),date:new Date().toISOString()};if(intent.finished)return {prUrl:s.prUrl,commitSha:intent.sha,recovered:true};
  if(intent.digest!==digest(payload))throw new Error('Revision content changed');approvals.authorize(approvalId,id,'revision_publish',payload,key);approvals.reserve(approvalId,key);
  const original=store.read<PublishIntent>('publish-intents',id);if(!original?.fork)throw new Error('Original fork metadata required');
  await recheck();const backend=new GitHubPublicationBackend(client,auth);
  if(!intent.sha){intent.sha=await backend.commit(s,s.proposal,intent.date);store.put('revision-intents',key,intent);}
  const ref=await client.request<{object:{sha:string}}>('GET',`/repos/${original.fork.fullName}/git/ref/heads/${encodeURIComponent(s.proposal.branch)}`);
  if(ref.object.sha!==intent.sha){if(ref.object.sha!==s.proposal.baseSha)throw new Error('Remote branch changed; refusing to overwrite review work');assertLease();approvals.authorize(approvalId,id,'revision_publish',await publicationPayload(store,store.get(id)),key);if(pushOverride)await pushOverride(s,original.fork,intent.sha,s.proposal.branch);else {const token=await auth.token();await git(s.workspace,['-c','credential.helper=','push','--',original.fork.cloneUrl,`${intent.sha}:refs/heads/${s.proposal.branch}`],undefined,{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:`http.https://${s.repository!.host}/.extraheader`,GIT_CONFIG_VALUE_0:'AUTHORIZATION: basic '+Buffer.from((s.repository!.forge==='gitlab'?'oauth2':s.repository!.forge==='forgejo'?s.proposal.actor:'x-access-token')+':'+token).toString('base64')});}}
  assertLease();const current=await client.request<{title:string,body:string,head:{sha:string}}>('GET',`/repos/${s.repository!.fullName}/pulls/${s.prNumber}`);if(current.head.sha!==intent.sha)throw new Error('Revision push was not confirmed');
  if(current.title!==s.proposal.title||current.body!==s.proposal.body){approvals.authorize(approvalId,id,'revision_publish',await publicationPayload(store,store.get(id)),key);await client.request('PATCH',`/repos/${s.repository!.fullName}/pulls/${s.prNumber}`,{title:s.proposal.title,body:s.proposal.body});}
  intent.finished=true;store.put('revision-intents',key,intent);store.mutate(id,x=>{x.commitSha=intent.sha;x.publishApproved=false;x.state='REVIEW_MONITORING';});store.remove('monitor',id);approvals.consume(approvalId,key);store.event(id,'revision-published',{approvalId,commitSha:intent.sha,prUrl:s.prUrl});return {prUrl:s.prUrl,commitSha:intent.sha};
});}
export function revisionContext(session:Session):string{return `Address feedback on ${session.prUrl}; code and public changes require their recorded approvals.`;}
