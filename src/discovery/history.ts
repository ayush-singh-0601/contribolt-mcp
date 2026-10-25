import type {GitHubClient} from '../github/client.js';
import {defaults} from '../core/models.js';
export interface ClosedContribution {number:number;created_at:string;closed_at:string|null;merged_at:string|null;author_association:string;}
export interface HistoricalMetrics {sampleSize:number;merged:number;closedWithoutMerge:number;observedMergeRate:number|null;medianReviewHours:number|null;windowDays:number;checkedAt:string;complete:boolean;sources:string[];qualification:string;}
export function summarizeHistory(pulls:ClosedContribution[],reviews:{createdAt:string,reviewedAt:string}[]=[],complete=true,now=Date.now()):HistoricalMetrics{
  const sample=pulls.filter(p=>p.closed_at&&Date.parse(p.closed_at)>=now-defaults.historicalDays*86400000&&!['OWNER','MEMBER','COLLABORATOR'].includes(p.author_association));
  const merged=sample.filter(p=>p.merged_at).length,delays=reviews.map(r=>(Date.parse(r.reviewedAt)-Date.parse(r.createdAt))/3600000).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b),middle=Math.floor(delays.length/2);
  const median=delays.length?(delays.length%2?delays[middle]!:(delays[middle-1]!+delays[middle]!)/2):null;
  return {sampleSize:sample.length,merged,closedWithoutMerge:sample.length-merged,observedMergeRate:sample.length?merged/sample.length:null,medianReviewHours:median,windowDays:defaults.historicalDays,checkedAt:new Date(now).toISOString(),complete,sources:[],qualification:'Observed outcomes of closed external-author PRs; excludes open PRs and association-identified internal authors. This is a sampled historical observation, not an individual merge probability.'};
}
export function historicalHealth(base:number,history:HistoricalMetrics):number{return history.complete&&history.sampleSize>=defaults.minHistory&&history.observedMergeRate!==null?.75*base+.25*history.observedMergeRate:base;}
export async function collectHistory(client:GitHubClient,fullName:string):Promise<HistoricalMetrics>{
  const scan=await client.pages<ClosedContribution>(`/repos/${fullName}/pulls`,{state:'closed',sort:'updated',direction:'desc'},200);
  const reviewTimes:{createdAt:string,reviewedAt:string}[]=[];
  for(const pr of scan.items.slice(0,5)){try{const reviews=await client.request<{submitted_at:string|null}[]>('GET',`/repos/${fullName}/pulls/${pr.number}/reviews`,{per_page:100});const first=reviews.map(r=>r.submitted_at).filter((v):v is string=>!!v).sort()[0];if(first)reviewTimes.push({createdAt:pr.created_at,reviewedAt:first});}catch{/* Missing response data is excluded, never imputed. */}}
  const metrics=summarizeHistory(scan.items,reviewTimes,scan.complete);metrics.sources=[`https://github.com/${fullName}/pulls?q=is%3Apr+is%3Aclosed`];return metrics;
}
