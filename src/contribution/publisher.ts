import {randomUUID} from 'node:crypto';
import type {Store} from '../state/store.js';
import type {Session,Proposal} from '../core/models.js';
import {Approvals,publicationPayload,digest} from '../security/approvals.js';
import {git} from '../git/workspace.js';
import {safeHttps,safeBranch} from '../security/boundaries.js';
import type {GitHubClient} from '../github/client.js';
import {ForgeError} from '../github/client.js';
import type {Credentials} from '../github/auth.js';
import {preSubmissionRecheck} from './recheck.js';
export interface PublishedPR {number:number;url:string;sha:string;}
export interface Fork {fullName:string;cloneUrl:string;}
export interface PublishIntent {id:string;sessionId:string;approvalId:string;payloadDigest:string;createdAt:string;date:string;stage:'planned'|'forked'|'committed'|'pushed'|'opened';fork?:Fork;commitSha?:string;pr?:PublishedPR;}
export interface PublicationBackend {fork(proposal:Proposal):Promise<Fork>;commit(session:Session,proposal:Proposal,date:string):Promise<string>;push(session:Session,fork:Fork,sha:string,branch:string):Promise<void>;open(proposal:Proposal,fork:Fork,sha:string):Promise<PublishedPR>;}
export class GitHubPublicationBackend implements PublicationBackend {
  constructor(readonly client:GitHubClient,private auth:Credentials){}
  async fork(p:Proposal):Promise<Fork>{
    const name=p.repository.split('/')[1]!;let raw:{full_name:string;clone_url:string;parent?:{full_name:string}};
    try{raw=await this.client.request('GET',`/repos/${p.actor}/${name}`);}catch(error){if(!(error instanceof ForgeError&&error.status===404))throw error;raw=await this.client.request('POST',`/repos/${p.repository}/forks`,{});}
    if(raw.parent?.full_name!==p.repository)throw new Error('Fork destination is not an authorized fork of the selected repository');
    return {fullName:raw.full_name,cloneUrl:raw.clone_url};
  }
  async commit(s:Session,p:Proposal,date:string):Promise<string>{
    if(!s.workspace)throw new Error('Isolated workspace required');safeBranch(p.branch);
    await git(s.workspace,['add','-A','--',...p.files]);
    const staged=(await git(s.workspace,['diff','--cached','--no-renames','--name-only','-z',p.baseSha,'--'])).split('\0').filter(Boolean).sort();
    if(JSON.stringify(staged)!==JSON.stringify([...p.files].sort()))throw new Error('Staged changes differ from the approved file list');
    const tree=(await git(s.workspace,['write-tree'])).trim();
    const env={GIT_AUTHOR_NAME:p.authorName,GIT_AUTHOR_EMAIL:p.authorEmail,GIT_COMMITTER_NAME:p.authorName,GIT_COMMITTER_EMAIL:p.authorEmail,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date};
    const sha=(await git(s.workspace,['commit-tree',tree,'-p',p.baseSha,'-m',p.commitMessage],undefined,env)).trim();
    if(!/^[a-f0-9]{40,64}$/.test(sha))throw new Error('Invalid commit result');
    await git(s.workspace,['update-ref','refs/heads/'+p.branch,sha]);return sha;
  }
  async push(s:Session,fork:Fork,sha:string,branch:string):Promise<void>{
    if(!s.workspace)throw new Error('Workspace missing');safeHttps(fork.cloneUrl,['github.com']);safeBranch(branch);
    const token=await this.auth.token();
    await git(s.workspace,['-c','credential.helper=','push','--',fork.cloneUrl,`${sha}:refs/heads/${branch}`],undefined,{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+token).toString('base64')});
  }
  async open(p:Proposal,fork:Fork,sha:string):Promise<PublishedPR>{
    const pr=await this.client.request<{number:number,html_url:string,head:{sha:string}}>('POST',`/repos/${p.repository}/pulls`,{title:p.title,body:p.body,base:p.base,head:fork.fullName.split('/')[0]+':'+p.branch,draft:p.draft,maintainer_can_modify:true});
    if(pr.head.sha!==sha)throw new Error('Created PR head differs from approved commit');return {number:pr.number,url:pr.html_url,sha};
  }
}
export class Publisher {
  constructor(readonly store:Store,readonly backend:PublicationBackend,readonly recheck:(id:string)=>Promise<Session>){}
  async publish(id:string,approvalId?:string):Promise<PublishedPR|{dryRun:true;proposal:Proposal;plannedActions:string[]}>{
    let s=this.store.get(id);if(!s.proposal)throw new Error('Prepare a complete PR proposal first');
    if(s.dryRun)return {dryRun:true,proposal:s.proposal,plannedActions:['fresh eligibility recheck','human approval verification','fork','commit approved files','push approved branch','create PR','permission-aware review routing']};
    if(s.stopped||!approvalId)throw new Error('Explicit current publication approval required');
    const payload=await publicationPayload(this.store,s),approvals=new Approvals(this.store);
    const existing=this.store.read<PublishIntent>('publish-intents',id);
    const intent:PublishIntent=existing??{id:randomUUID(),sessionId:id,approvalId,payloadDigest:digest(payload),createdAt:new Date().toISOString(),date:new Date().toISOString(),stage:'planned'};
    if(intent.payloadDigest!==digest(payload))throw new Error('Publication intent differs from the approved patch');
    approvals.authorize(approvalId,id,'publish',payload,intent.id);approvals.reserve(approvalId,intent.id);intent.approvalId=approvalId;
    this.store.put('publish-intents',id,intent);
    s=await this.recheck(id);const p=s.proposal!;
    const save=(stage:PublishIntent['stage'])=>{intent.stage=stage;this.store.put('publish-intents',id,intent);this.store.event(id,'publication-stage',{stage,approvalId,intentId:intent.id});};
    this.store.mutate(id,x=>{x.state='FORK_BRANCH_PUSH_PR';});
    if(!intent.fork){approvals.authorize(approvalId,id,'publish',payload,intent.id);intent.fork=await this.backend.fork(p);save('forked');}
    if(!intent.commitSha){intent.commitSha=await this.backend.commit(s,p,intent.date);save('committed');}
    if(intent.stage==='committed'){await this.recheck(id);approvals.authorize(approvalId,id,'publish',await publicationPayload(this.store,this.store.get(id)),intent.id);await this.backend.push(s,intent.fork,intent.commitSha,p.branch);save('pushed');}
    if(!intent.pr){await this.recheck(id);approvals.authorize(approvalId,id,'publish',await publicationPayload(this.store,this.store.get(id)),intent.id);intent.pr=await this.backend.open(p,intent.fork,intent.commitSha);save('opened');}
    const pr=intent.pr;
    this.store.mutate(id,x=>{x.prUrl=pr.url;x.prNumber=pr.number;x.commitSha=pr.sha;x.state='REVIEW_ROUTING';x.publishApproved=false;});
    approvals.consume(approvalId,intent.id);return pr;
  }
}
export function githubPublisher(store:Store,client:GitHubClient,auth:Credentials):Publisher{return new Publisher(store,new GitHubPublicationBackend(client,auth),id=>preSubmissionRecheck(store,id,client));}
