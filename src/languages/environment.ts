import {accessSync,constants} from 'node:fs';
import {join,dirname,delimiter,resolve} from 'node:path';
import type {RepositoryIndex} from '../repository/indexing.js';
import type {CheckCommand} from '../core/models.js';
import type {EnvironmentPlan,RepositoryContext} from './adapter.js';
import {AdapterRegistry} from './registry.js';
export function executableAvailable(executable:string,cwd:string,env:NodeJS.ProcessEnv=process.env):boolean {
  const names=process.platform==='win32'?[executable,...(env.PATHEXT??'.EXE;.CMD;.BAT').split(';').map(ext=>executable+ext.toLowerCase())]:[executable];
  const paths=executable.includes('/')||executable.includes('\\')?[resolve(cwd,executable)]:(env.PATH??'').split(delimiter).flatMap(dir=>names.map(name=>join(dir,name)));
  return paths.some(path=>{try{accessSync(path,process.platform==='win32'?constants.F_OK:constants.X_OK);return true;}catch{return false;}});
}
export function projectScopes(index:RepositoryIndex,affected:string[]):string[]{
  const directories=[...new Set(index.manifests.map(f=>{const dir=dirname(f).replaceAll('\\','/');return dir==='.'?'':dir;}))];
  if(!affected.length)return directories.length?directories:[''];
  return [...new Set(affected.map(file=>directories.filter(dir=>!dir||file.startsWith(dir+'/')).sort((a,b)=>b.length-a.length)[0]??''))];
}
export function planEnvironment(root:string,index:RepositoryIndex,registry:AdapterRegistry,affected:string[]=[]):{commands:CheckCommand[],environments:{scope:string,adapter:string,plan:EnvironmentPlan,missing:string[]}[],limitations:string[]}{
  const commands:CheckCommand[]=[],environments:{scope:string,adapter:string,plan:EnvironmentPlan,missing:string[]}[]=[],limitations:string[]=[];
  for(const scope of projectScopes(index,affected)){
    const context:RepositoryContext={root,scope,files:index.files,content:index.content};
    for(const adapter of registry.detect(context)){const plan=adapter.planEnvironment(context),checks=adapter.commands(context);commands.push(...checks);const missing=plan.tools.filter(tool=>!executableAvailable(tool,join(root,scope)));environments.push({scope,adapter:adapter.id,plan,missing});if(!checks.length)limitations.push(`${adapter.id} (${scope||'root'}): no runnable repository-prescribed checks discovered`);if(missing.length)limitations.push(`${scope||'root'}: unavailable tools ${missing.join(', ')}`);}
  }
  return {commands:[...new Map(commands.map(c=>[c.id,c])).values()],environments,limitations};
}
