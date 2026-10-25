import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {RevisionPlanSchema,planRevision,publishRevision} from '../contribution/revisions.js';
import {credentials} from '../github/auth.js';
import {GitHubClient} from '../github/client.js';
export function registerRevisions(app:Application){
  app.register({name:'plan_revision',description:'Record a feedback-linked revision plan; apply it only after renewed human authorization for coding.',schema:sessionInput.extend({plan:RevisionPlanSchema,approvalId:z.uuid().optional()}),readOnly:false,publicWrite:false,handler:async a=>planRevision(app.store,String(a.sessionId),a.plan,new GitHubClient(await credentials()),a.approvalId as string|undefined)});
  app.register({name:'publish_revision',description:'Push a validated, human-approved revision and update the existing PR without creating another PR.',schema:sessionInput.extend({approvalId:z.uuid()}),readOnly:false,publicWrite:true,handler:async a=>{const auth=await credentials();return publishRevision(app.store,String(a.sessionId),String(a.approvalId),new GitHubClient(auth),auth);}});
}
