import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import type {CheckCommand,QualityCheck} from '../core/models.js';
export interface RepositoryContext {root:string;files:string[];content:Record<string,string>;scope:string;}
export interface Detection {matched:boolean;confidence:number;manifests:string[];}
export interface EnvironmentPlan {tools:string[];requirements:string[];bootstrap:CheckCommand[];}
export interface LanguageAdapter {id:string;detect(repo:RepositoryContext):Detection;planEnvironment(repo:RepositoryContext):EnvironmentPlan;commands(repo:RepositoryContext):CheckCommand[];parseResults(output:{exitCode:number|null;available:boolean;cancelled?:boolean}):QualityCheck['status'];}
export interface AdapterDefinition {id:string;matches:(file:string)=>boolean;tools:string[];commands:(repo:RepositoryContext)=>CheckCommand[];requirements?:(repo:RepositoryContext)=>string[];bootstrap?:(repo:RepositoryContext)=>CheckCommand[];}
export function command(repo:RepositoryContext,adapter:string,kind:CheckCommand['kind'],executable:string,args:string[],source:string,required=true):CheckCommand {
  const suffix=createHash('sha256').update(repo.scope+'\0'+executable+'\0'+args.join('\0')).digest('hex').slice(0,10);
  return {id:`${adapter}:${kind}:${suffix}`,name:`${adapter} ${kind}${repo.scope?' ('+repo.scope+')':''}`,kind,executable,args,cwd:resolve(repo.root,repo.scope),required,network:kind==='bootstrap',timeoutMs:600000,source};
}
export function scopedFiles(repo:RepositoryContext):string[]{return repo.files.filter(f=>!repo.scope||f.startsWith(repo.scope+'/')).map(f=>relative(repo.scope||'.',f).replaceAll('\\','/'));}
export function text(repo:RepositoryContext,file:string):string{return repo.content[[repo.scope,file].filter(Boolean).join('/')]??'';}
export function has(repo:RepositoryContext,file:string):boolean{return repo.files.includes([repo.scope,file].filter(Boolean).join('/'));}
export function defineAdapter(def:AdapterDefinition):LanguageAdapter {return {id:def.id,detect:r=>{const manifests=scopedFiles(r).filter(f=>!f.includes('/')&&def.matches(f));return {matched:manifests.length>0,confidence:manifests.length?1:0,manifests};},planEnvironment:r=>({tools:def.tools,requirements:def.requirements?.(r)??[],bootstrap:def.bootstrap?.(r)??[]}),commands:def.commands,parseResults:r=>!r.available?'UNAVAILABLE':r.cancelled?'SKIPPED':r.exitCode===0?'PASS':'FAIL'};}
