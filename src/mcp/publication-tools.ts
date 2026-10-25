import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {credentials} from '../github/auth.js';
import {GitHubClient} from '../github/client.js';
import {githubPublisher} from '../contribution/publisher.js';
export function registerPublication(app:Application){app.register({name:'publish_pull_request',description:'Publish only the exact human-approved contribution; dry runs report planned actions without writing.',schema:sessionInput.extend({approvalId:z.uuid().optional()}),readOnly:false,publicWrite:true,handler:async a=>{const auth=await credentials(),client=new GitHubClient(auth);return githubPublisher(app.store,client,auth).publish(String(a.sessionId),a.approvalId as string|undefined);}});}
