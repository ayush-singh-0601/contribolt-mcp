import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import type {Store} from '../state/store.js';
import {defaults,type Session} from '../core/models.js';
import {patchFingerprint} from '../git/patch.js';
import {git} from '../git/workspace.js';
import {within} from './boundaries.js';
export const ApprovalAction=z.enum(['publish','review','revision_implementation','revision_publish','comment','relax_filter']);
export type Action=z.infer<typeof ApprovalAction>;
export interface ApprovalRequest {id:string;sessionId:string;action:Action;payload:unknown;digest:string;createdAt:number;expiresAt:number;approvedAt?:number;approvedBy?:string;reservedFor?:string;consumedAt?:number;}
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export function digest(value:unknown):string{return createHash('sha256').update(canonical(value)).digest('hex');}
export async function publicationPayload(store:Store,s:Session):Promise<unknown>{
  if(!s.workspace||!s.proposal)throw new Error('Complete publication preview required');
  let diff='';
  for(const file of [...s.proposal.files].sort()){
    let before='',after='';try{before=await git(s.workspace,['show',`${s.proposal.baseSha}:${file}`]);}catch{/* Newly created file. */}
    try{after=readFileSync(within(s.workspace,file),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    diff+=`\ndiff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n`+before.split('\n').map(line=>'-'+line).join('\n')+'\n'+after.split('\n').map(line=>'+'+line).join('\n')+'\n';
  }
  const policy=store.read<{decision:{claUrls:string[],signoff:boolean}}>('policies',s.proposal.repository);
  return {proposal:s.proposal,relaxations:store.read<string[]>('relaxations',s.id)??[],requirements:{cla:policy?.decision.claUrls??[],signoff:policy?.decision.signoff??false},diff};
}
export class Approvals {
  constructor(private store:Store){}
  request(sessionId:string,action:Action,payload:unknown):ApprovalRequest {
    const s=this.store.get(sessionId);if(s.stopped)throw new Error('Session stopped');
    const createdAt=Date.now(),request:ApprovalRequest={id:randomUUID(),sessionId,action,payload,digest:digest(payload),createdAt,expiresAt:createdAt+defaults.approvalMs};
    this.store.put('approvals',request.id,request);this.store.event(sessionId,'approval-requested',{id:request.id,action,digest:request.digest});return request;
  }
  get(id:string):ApprovalRequest {const request=this.store.read<ApprovalRequest>('approvals',id);if(!request)throw new Error('Approval request not found');return request;}
  private active(request:ApprovalRequest):void {const s=this.store.get(request.sessionId),revoked=this.store.read<number>('approval-revocations',request.sessionId)??0;if(s.stopped||request.expiresAt<=Date.now()||request.createdAt<=revoked)throw new Error('Approval expired, revoked or stopped');}
  async confirmFromHuman(id:string):Promise<ApprovalRequest>{
    const request=this.get(id);this.active(request);if(request.approvedAt)throw new Error('Approval already decided');
    const s=this.store.get(request.sessionId);
    if(request.action==='publish'||request.action==='revision_publish'){
      if(!s.workspace||!s.proposal||digest(await publicationPayload(this.store,s))!==request.digest||await patchFingerprint(s.workspace,s.proposal.baseSha)!==s.proposal.patchHash)throw new Error('Reviewed publication content changed');
    }
    request.approvedAt=Date.now();request.approvedBy='interactive-cli';this.store.put('approvals',id,request);
    if(request.action==='publish'||request.action==='revision_publish')this.store.mutate(request.sessionId,x=>{x.publishApproved=true;});
    if(request.action==='relax_filter'){
      const payload=request.payload as {filter:string};if(!['comments','assignees','provenance','linked_work'].includes(payload.filter))throw new Error('Unsupported relaxation');
      const current=this.store.read<string[]>('relaxations',request.sessionId)??[];this.store.put('relaxations',request.sessionId,[...new Set([...current,payload.filter])]);request.consumedAt=Date.now();this.store.put('approvals',id,request);
    }
    this.store.event(request.sessionId,'human-approved',{requestId:id,action:request.action,digest:request.digest,source:'interactive-cli'});return request;
  }
  authorize(id:string,sessionId:string,action:Action,payload:unknown,intent?:string):ApprovalRequest {
    const request=this.get(id);this.active(request);
    if(!request.approvedAt||request.approvedBy!=='interactive-cli'||request.sessionId!==sessionId||request.action!==action||request.digest!==digest(payload))throw new Error('Missing human authorization for this exact action');
    if(request.consumedAt||request.reservedFor&&request.reservedFor!==intent)throw new Error('Approval already used');return request;
  }
  reserve(id:string,intent:string):void {
    const request=this.get(id);this.active(request);if(!request.approvedAt||request.consumedAt||request.reservedFor&&request.reservedFor!==intent)throw new Error('Approval unavailable');
    const result=this.store.db.prepare(`UPDATE records SET data=json_set(data,'$.reservedFor',?) WHERE namespace='approvals' AND key=? AND (json_extract(data,'$.reservedFor') IS NULL OR json_extract(data,'$.reservedFor')=?) AND json_extract(data,'$.consumedAt') IS NULL`).run(intent,id,intent);
    if(result.changes!==1)throw new Error('Approval claimed concurrently');
  }
  consume(id:string,intent:string):void {const r=this.get(id);if(r.reservedFor!==intent)throw new Error('Approval is not reserved for this operation');r.consumedAt=Date.now();this.store.put('approvals',id,r);}
}
