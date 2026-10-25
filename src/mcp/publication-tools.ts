import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {provider,type Provider} from '../forges/router.js';
import {Publisher,type PublicationBackend} from '../contribution/publisher.js';
export function registerPublication(app:Application,factory?:(context:Provider)=>Publisher){app.register({name:'publish_pull_request',description:'Publish only the exact human-approved contribution; dry runs report planned actions without writing.',schema:sessionInput.extend({approvalId:z.uuid().optional()}),readOnly:false,publicWrite:true,handler:async a=>{const id=String(a.sessionId),s=app.store.get(id);if(s.dryRun)return new Publisher(app.store,{} as PublicationBackend,async()=>s).publish(id);const context=await provider(app.store,s.repository);return (factory?.(context)??context.publisher).publish(id,a.approvalId as string|undefined);}});}
