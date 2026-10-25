import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {dirname,posix} from 'node:path';
import type {Store} from '../state/store.js';
import {git} from '../git/workspace.js';
import {within} from '../security/boundaries.js';
import {indexRepository,manifestPattern,type RepositoryIndex} from './indexing.js';
export function affectedDependents(index:RepositoryIndex,changed:string[]):string[]{
  const impacted=new Set(changed),resolve=(path:string)=>[path,path.replace(/\.js$/,'.ts'),path+'.ts',path+'.js',path+'/index.ts'].find(p=>index.files.includes(p))??path;
  let progress=true;while(progress){progress=false;for(const [file,imports] of Object.entries(index.imports))if(!impacted.has(file)&&imports.some(path=>impacted.has(resolve(path)))){impacted.add(file);progress=true;}}
  return [...impacted];
}
export async function cachedIndex(store:Store,root:string,identity:string,scope='',keywords:string[]=[]):Promise<RepositoryIndex>{
  const sha=(await git(root,['rev-parse','HEAD'])).trim(),key=createHash('sha256').update(identity+'\0'+sha+'\0'+scope).digest('hex');
  const dirty=[...new Set([...(await git(root,['diff','--no-renames','--name-only','-z','HEAD','--'])).split('\0'),...(await git(root,['ls-files','--others','--exclude-standard','-z'])).split('\0')].filter(Boolean))];
  const cached=store.read<RepositoryIndex>('code-maps',key);
  if(!cached||dirty.some(f=>manifestPattern.test(f))){const fresh=await indexRepository(root,keywords,scope);if(!dirty.length)store.put('code-maps',key,fresh);return fresh;}
  for(const file of dirty.filter(f=>!scope||f.startsWith(scope+'/'))){try{const path=within(root,file);if(statSync(path).size>100000){delete cached.content[file];cached.truncated=true;continue;}const text=readFileSync(path,'utf8');if(text.includes('\0'))continue;cached.content[file]=text;cached.imports[file]=[...text.matchAll(/(?:from\s+|require\(|import\s*)["'](\.[^"']+)["']/g)].map(m=>posix.normalize(posix.join(dirname(file),m[1]!)));if(!cached.files.includes(file))cached.files.push(file);}catch{delete cached.content[file];delete cached.imports[file];cached.files=cached.files.filter(f=>f!==file);}}
  return cached;
}
