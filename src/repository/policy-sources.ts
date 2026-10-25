import type {GitHubClient} from '../github/client.js';
import {ForgeError} from '../github/client.js';
import type {Repository} from '../core/models.js';
export interface PolicyDocument {path:string;text:string;url:string;sha:string;scope:string;organizationDefault:boolean;}
const categories=/(^|\/)(README[^/]*|CONTRIBUTING[^/]*|CODE_OF_CONDUCT[^/]*|SECURITY[^/]*|LICENSE[^/]*|AGENTS\.md|CLAUDE\.md|CODEOWNERS|MAINTAINERS[^/]*|GOVERNANCE[^/]*|PULL_REQUEST_TEMPLATE[^/]*|ISSUE_TEMPLATE[^/]*|.*instructions[^/]*)$/i;
export async function policySources(client:GitHubClient,repo:Repository,signal?:AbortSignal):Promise<{documents:PolicyDocument[],complete:boolean,commit:string}>{
  const head=await client.request<{sha:string}>('GET',`/repos/${repo.fullName}/commits/${encodeURIComponent(repo.defaultBranch)}`,{},signal);
  const tree=await client.request<{tree:{path:string,type:string,size?:number}[],truncated:boolean}>('GET',`/repos/${repo.fullName}/git/trees/${head.sha}`,{recursive:'1'},signal);
  const paths=tree.tree.filter(f=>f.type==='blob'&&(categories.test(f.path)||/^\.github\/(?:instructions|ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE)\//.test(f.path)));
  let complete=!tree.truncated&&paths.length<=80;
  const documents:PolicyDocument[]=[];
  const fetchDoc=async(fullName:string,path:string,ref:string,org=false)=>{
    try{const file=await client.request<{content:string,encoding:string,sha:string,html_url:string,size:number}>('GET',`/repos/${fullName}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,{ref},signal);if(file.encoding!=='base64'||file.size>200000){complete=false;return;}documents.push({path,text:Buffer.from(file.content,'base64').toString('utf8'),url:file.html_url,sha:file.sha,scope:path.includes('/')?path.slice(0,path.lastIndexOf('/')):'',organizationDefault:org});}
    catch(error){signal?.throwIfAborted();if(!(org&&error instanceof ForgeError&&error.status===404))complete=false;}
  };
  for(const path of paths.slice(0,80))await fetchDoc(repo.fullName,path.path,head.sha);
  if(!documents.some(d=>/CONTRIBUTING/i.test(d.path))){const owner=repo.fullName.split('/')[0]!;for(const path of ['CONTRIBUTING.md','.github/CONTRIBUTING.md','README.md'])await fetchDoc(owner+'/.github',path,'HEAD',true);}
  return {documents,complete,commit:head.sha};
}
