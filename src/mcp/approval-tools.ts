import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {Approvals,ApprovalAction,publicationPayload} from '../security/approvals.js';
export function registerApprovals(app:Application){app.register({name:'request_approval',description:'Prepare a concrete human approval request. This tool cannot approve it; confirm in an interactive user terminal.',schema:sessionInput.extend({action:ApprovalAction.default('publish'),reviewers:z.array(z.string().regex(/^[\w-]+$/)).max(10).default([]),teams:z.array(z.string().regex(/^[\w-]+$/)).max(10).default([]),comment:z.string().max(10000).optional(),filter:z.enum(['comments','assignees','provenance','linked_work']).optional()}),readOnly:false,publicWrite:false,handler:async a=>{
  const id=String(a.sessionId),s=app.store.get(id),action=ApprovalAction.parse(a.action);let payload:unknown;
  if(action==='publish'||action==='revision_publish')payload=await publicationPayload(app.store,s);
  else if(action==='review'){if(!s.prUrl)throw new Error('Confirmed PR required');payload={prUrl:s.prUrl,reviewers:a.reviewers,teams:a.teams};}
  else if(action==='comment'){if(!s.prUrl||!a.comment)throw new Error('Confirmed PR and exact comment required');payload={prUrl:s.prUrl,comment:a.comment};}
  else if(action==='relax_filter'){if(!a.filter)throw new Error('Choose exactly one relaxable filter');payload={filter:a.filter};}
  else {payload=app.store.read('revision-plans',id);if(!payload)throw new Error('Prepare a concrete revision plan first');}
  const request=new Approvals(app.store).request(id,action,payload);return {request,confirmation:{executable:'mergepilot',args:['approve',request.id]},notice:'Human confirmation records consent. Review disclosed limitations and satisfy CLA/DCO obligations before approving.'};
}});}
