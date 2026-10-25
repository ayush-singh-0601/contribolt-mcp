import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {RevisionPlanSchema,planRevision,publishRevision,type RevisionPush} from '../contribution/revisions.js';
import {provider} from '../forges/router.js';
export function registerRevisions(app:Application,pushOverride?:RevisionPush){
  app.register({name:'plan_revision',description:'Record a feedback-linked revision plan; apply it only after renewed human authorization for coding.',schema:sessionInput.extend({plan:RevisionPlanSchema,approvalId:z.uuid().optional()}),readOnly:false,publicWrite:false,handler:async a=>planRevision(app.store,String(a.sessionId),a.plan,(await provider(app.store,app.store.get(String(a.sessionId)).repository)).client,a.approvalId as string|undefined)});
  app.register({name:'publish_revision',description:'Push a validated, human-approved revision and update the existing PR without creating another PR.',schema:sessionInput.extend({approvalId:z.uuid()}),readOnly:false,publicWrite:true,handler:async a=>{const id=String(a.sessionId),p=await provider(app.store,app.store.get(id).repository);return publishRevision(app.store,id,String(a.approvalId),p.client,p.auth,()=>p.recheck(id),pushOverride);}});
}
