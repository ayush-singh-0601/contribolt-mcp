import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdirSync,existsSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Repository} from '../core/models.js';
import {safeHttps,sanitizedEnvironment,within} from '../security/boundaries.js';
const exec=promisify(execFile);
export async function git(root:string,args:string[],signal?:AbortSignal):Promise<string>{
  if(existsSync(join(root,'.git'))&&lstatSync(join(root,'.git')).isSymbolicLink())throw new Error('Refusing symbolic-link Git metadata');
  const env={...sanitizedEnvironment(),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'};
  const result=await exec('git',['-c','core.hooksPath='+join(root,'.mergepilot-disabled-hooks'),'-c','protocol.ext.allow=never','-c','protocol.file.allow=never','-C',root,...args],{env,encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000,signal});return result.stdout;
}
export async function createWorkspace(dataRoot:string,repo:Repository,signal?:AbortSignal):Promise<{root:string,sha:string}>{
  safeHttps(repo.cloneUrl,[repo.host]);
  const parent=join(dataRoot,'workspaces');mkdirSync(parent,{recursive:true,mode:0o700});
  const root=within(parent,randomUUID());
  await git(parent,['clone','--depth','1','--no-recurse-submodules','--template=','--',repo.cloneUrl,root],signal);
  await git(root,['config','core.hooksPath',join(dataRoot,'disabled-hooks')],signal);
  return {root,sha:(await git(root,['rev-parse','HEAD'],signal)).trim()};
}
export async function assertClean(root:string):Promise<void>{if((await git(root,['status','--porcelain'])).trim())throw new Error('Workspace contains existing changes; use an isolated clone');}
export async function trackedFiles(root:string):Promise<string[]>{return (await git(root,['ls-files','-z'])).split('\0').filter(Boolean);}
