import type {GitHubClient} from '../github/client.js';
import type {IssueEvidence} from '../core/models.js';
import {similarity,type SimilarityEvidence} from './similarity.js';
export interface CompetingScan {confirmed:string[];possible:string[];complete:boolean;alreadyFixed:boolean;similarity:Record<string,SimilarityEvidence>;}
export function referencesIssue(text:string,repo:string,number:number):boolean {const escaped=repo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:https://github\\.com/${escaped}/issues/${number}(?!\\d)|(?:^|[\\s(])#${number}(?!\\d)|${escaped}#${number}(?!\\d))`,'i').test(text);}
export async function competingWork(client:GitHubClient,issue:IssueEvidence,signal?:AbortSignal):Promise<CompetingScan>{
  const result:CompetingScan={confirmed:[],possible:[],complete:true,alreadyFixed:false,similarity:{}};
  const words=issue.title.replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(x=>x.length>3).slice(0,4).join(' ');
  const queries=[`repo:${issue.repoFullName} is:pr "#${issue.issueNumber}"`,...(words?[`repo:${issue.repoFullName} is:pr ${words}`]:[])];
  for(const q of queries){try{const scan=await client.pages<{number:number,html_url:string,title:string,body:string|null,pull_request?:{merged_at?:string|null}}>('/search/issues',{q},200,signal);result.complete&&=scan.complete;
    for(const pr of scan.items){const text=pr.title+'\n'+(pr.body??'');if(referencesIssue(text,issue.repoFullName,issue.issueNumber)){result.confirmed.push(pr.html_url);if(pr.pull_request?.merged_at)result.alreadyFixed=true;}else {let files:string[]=[];const preliminary=similarity(issue,{title:pr.title,body:pr.body??'',files});if(preliminary.textOverlap>.1&&Object.keys(result.similarity).length<5){try{const changed=await client.pages<{filename:string}>(`/repos/${issue.repoFullName}/pulls/${pr.number}/files`,{},300,signal);files=changed.items.map(f=>f.filename);if(!changed.complete)result.complete=false;}catch{signal?.throwIfAborted();result.complete=false;}}const evidence=similarity(issue,{title:pr.title,body:pr.body??'',files});result.similarity[pr.html_url]=evidence;if(evidence.verdict==='possible_overlap')result.possible.push(pr.html_url);}}
  }catch{signal?.throwIfAborted();result.complete=false;}}
  result.confirmed=[...new Set(result.confirmed)];result.possible=[...new Set(result.possible)].filter(x=>!result.confirmed.includes(x));return result;
}
