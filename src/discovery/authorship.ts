import type {GitHubClient} from '../github/client.js';
import type {Repository,IssueEvidence,Evidence} from '../core/models.js';
import type {GitHubRepository} from './repositories.js';
export function listedMaintainer(text:string,login:string):boolean {
  if(!/^[A-Za-z0-9-]+$/.test(login))return false;
  let current=true;
  for(const line of text.split('\n')){
    if(/^#+ /.test(line))current=!/former|emeritus|alumni|past|retired/i.test(line);
    if(!current||/former|emeritus|retired|not a maintainer/i.test(line))continue;
    if(new RegExp(`(?:@${login}(?![\\w-])|https://github\\.com/${login}(?![\\w-]))`,'i').test(line))return true;
  }
  return false;
}
export async function officialAuthor(client:GitHubClient,repo:Repository,issue:IssueEvidence,signal?:AbortSignal):Promise<{verdict:IssueEvidence['officialProvenance'],evidence:Evidence[]}>{
  const evidence:Evidence[]=[],at=new Date().toISOString();
  const owner=await client.request<GitHubRepository>('GET',`/repos/${repo.fullName}`,{},signal);
  if(owner.owner.type==='User'&&owner.owner.login.toLowerCase()===issue.authorLogin.toLowerCase())return {verdict:'ELIGIBLE',evidence:[{source:repo.url,checkedAt:at,observation:'Issue author owns this repository',complete:true}]};
  try{const role=await client.request<{role_name:string,permission:string}>('GET',`/repos/${repo.fullName}/collaborators/${encodeURIComponent(issue.authorLogin)}/permission`,{},signal);if(['admin','maintain'].includes(role.role_name))return {verdict:'ELIGIBLE',evidence:[{source:repo.url,checkedAt:at,observation:`Author role: ${role.role_name}`,complete:true}]};}catch(error){signal?.throwIfAborted();evidence.push({source:repo.url,checkedAt:at,observation:'Author permission lookup unavailable: '+String(error),complete:false});}
  for(const path of ['MAINTAINERS.md','MAINTAINERS','.github/MAINTAINERS.md']){
    try{const file=await client.request<{content:string,encoding:string,sha:string,html_url:string}>('GET',`/repos/${repo.fullName}/contents/${path}`,{ref:repo.defaultBranch},signal);if(file.encoding==='base64'&&listedMaintainer(Buffer.from(file.content,'base64').toString('utf8'),issue.authorLogin))return {verdict:'ELIGIBLE',evidence:[{source:file.html_url,checkedAt:at,observation:'Explicit current maintainer listing',revision:file.sha,complete:true}]};}catch{signal?.throwIfAborted();}
  }
  return {verdict:'UNKNOWN',evidence:[...evidence,{source:issue.url,checkedAt:at,observation:`Association ${issue.authorAssociation} alone does not establish maintainership`,complete:false}]};
}
