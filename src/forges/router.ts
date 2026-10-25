import {z} from 'zod';
import type {Store} from '../state/store.js';
import type {Repository,Preferences,IssueEvidence} from '../core/models.js';
import type {Relaxable} from '../discovery/eligibility.js';
import {GitHubClient} from '../github/client.js';
import {credentials,type Credentials} from '../github/auth.js';
import {DiscoveryEngine} from '../discovery/engine.js';
import {Publisher,GitHubPublicationBackend} from '../contribution/publisher.js';
import {preSubmissionRecheck} from '../contribution/recheck.js';
import {ForgeConfigSchema,JsonForgeClient,type ForgeConfig} from './http.js';
import {GitLabEngine,GitLabFacade,GitLabPublication} from './gitlab.js';
import {selectCandidate} from '../discovery/ranking.js';
export interface DiscoveryProvider {repositories(p:Preferences,signal?:AbortSignal):Promise<Repository[]>;find(repos:Repository[],p:Preferences,signal?:AbortSignal):Promise<{candidates:IssueEvidence[],selected?:IssueEvidence,ranked:IssueEvidence[],message:string}>;verify(repo:Repository,number:number,signal?:AbortSignal,relaxations?:Relaxable[]):Promise<IssueEvidence>;}
export interface Provider {engine:DiscoveryProvider;client:GitHubClient;auth:Credentials;publisher:Publisher;recheck:(id:string)=>Promise<import('../core/models.js').Session>;}
export function forgeConfigurations(store:Store):ForgeConfig[]{return z.array(ForgeConfigSchema).max(10).parse(process.env.MERGEPILOT_FORGES?JSON.parse(process.env.MERGEPILOT_FORGES):store.read('config','forges')??[]).filter(c=>c.enabled);}
export async function provider(store:Store,repo?:Repository):Promise<Provider>{
  if(!repo||repo.forge==='github'){
    const auth=await credentials(),client=new GitHubClient(auth),engine=new DiscoveryEngine(client,store),recheck=(id:string)=>preSubmissionRecheck(store,id,client);return {engine,client,auth,recheck,publisher:new Publisher(store,new GitHubPublicationBackend(client,auth),recheck)};
  }
  const config=forgeConfigurations(store).find(c=>c.kind===repo.forge&&c.host===repo.host);if(!config)throw new Error('Forge instance is not explicitly configured');const token=process.env[config.tokenEnv];if(!token)throw new Error('Configured forge credential is unavailable');
  if(config.kind!=='gitlab')throw new Error('Forge adapter is unavailable');
  const engine=new GitLabEngine(new JsonForgeClient(config,token),store),client=new GitLabFacade(engine),auth:Credentials={kind:'token',token:async()=>token},recheck=(id:string)=>preSubmissionRecheck(store,id,client,undefined,engine.verify.bind(engine));
  return {engine,client,auth,recheck,publisher:new Publisher(store,new GitLabPublication(engine,auth),recheck)};
}
export async function discoverAcrossForges(store:Store,p:Preferences,signal?:AbortSignal){const groups:Repository[][]=[],errors:{forge:string,error:string}[]=[];
  try{groups.push(await (await provider(store)).engine.repositories(p,signal));}catch(error){signal?.throwIfAborted();errors.push({forge:'github',error:String(error)});}
  for(const config of forgeConfigurations(store)){try{if(config.kind!=='gitlab')continue;const token=process.env[config.tokenEnv];if(!token)throw new Error('Configured token missing');groups.push(await new GitLabEngine(new JsonForgeClient(config,token),store).repositories(p,signal));}catch(error){signal?.throwIfAborted();errors.push({forge:config.host,error:String(error)});}}
  const repositories:Repository[]=[];for(let i=0;i<30&&repositories.length<30;i++)for(const group of groups)if(group[i]&&repositories.length<30)repositories.push(group[i]!);
  if(!repositories.length&&errors.length)throw new Error(errors.map(e=>e.forge+': '+e.error).join('; '));return {repositories,errors};
}
export async function findAcrossForges(store:Store,repos:Repository[],p:Preferences,signal?:AbortSignal){const candidates:IssueEvidence[]=[];const groups=new Map<string,Repository[]>();for(const r of repos){const key=r.forge+':'+r.host;groups.set(key,[...(groups.get(key)??[]),r]);}for(const group of groups.values()){const result=await (await provider(store,group[0])).engine.find(group,p,signal);candidates.push(...result.candidates);}return {candidates,...selectCandidate(candidates)};}
