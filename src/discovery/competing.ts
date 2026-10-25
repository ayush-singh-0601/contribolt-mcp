import type {GitHubClient} from '../github/client.js';
import type {IssueEvidence} from '../core/models.js';
export interface CompetingScan {confirmed:string[];possible:string[];complete:boolean;alreadyFixed:boolean;}
export function referencesIssue(text:string,repo:string,number:number):boolean {const escaped=repo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:https://github\\.com/${escaped}/issues/${number}(?!\\d)|(?:^|[\\s(])#${number}(?!\\d)|${escaped}#${number}(?!\\d))`,'i').test(text);}
export async function competingWork(client:GitHubClient,issue:IssueEvidence,signal?:AbortSignal):Promise<CompetingScan>{
  const result:CompetingScan={confirmed:[],possible:[],complete:true,alreadyFixed:false};
  const words=issue.title.replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(x=>x.length>3).slice(0,4).join(' ');
  const queries=[`repo:${issue.repoFullName} is:pr "#${issue.issueNumber}"`,...(words?[`repo:${issue.repoFullName} is:pr ${words}`]:[])];
  for(const q of queries){try{const scan=await client.pages<{number:number,html_url:string,title:string,body:string|null,pull_request?:{merged_at?:string|null}}>('/search/issues',{q},200,signal);result.complete&&=scan.complete;
    for(const pr of scan.items){const text=pr.title+'\n'+(pr.body??'');if(referencesIssue(text,issue.repoFullName,issue.issueNumber)){result.confirmed.push(pr.html_url);if(pr.pull_request?.merged_at)result.alreadyFixed=true;}else if(words&&words.split(' ').every(w=>text.toLowerCase().includes(w.toLowerCase())))result.possible.push(pr.html_url);}
  }catch{signal?.throwIfAborted();result.complete=false;}}
  result.confirmed=[...new Set(result.confirmed)];result.possible=[...new Set(result.possible)].filter(x=>!result.confirmed.includes(x));return result;
}
