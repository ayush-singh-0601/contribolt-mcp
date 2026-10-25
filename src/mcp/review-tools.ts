import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {provider} from '../forges/router.js';
import {routeReview} from '../contribution/reviews.js';
export function registerReviews(app:Application){app.register({name:'route_review',description:'Observe review routing or request only human-approved, relevant reviewers with platform confirmation.',schema:sessionInput.extend({approvalId:z.uuid().optional()}),readOnly:false,publicWrite:true,handler:async a=>routeReview(app.store,String(a.sessionId),(await provider(app.store,app.store.get(String(a.sessionId)).repository)).client,a.approvalId as string|undefined)});}
