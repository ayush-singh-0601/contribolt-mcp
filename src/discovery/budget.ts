import {createHash} from 'node:crypto';
import type {Store} from '../state/store.js';
import {defaults} from '../core/models.js';
export class SearchBudget {
  private start=Date.now();requests=0;
  constructor(readonly maxRequests=500,readonly maxMs:number=defaults.searchMs){}
  take(signal?:AbortSignal):void{signal?.throwIfAborted();if(this.requests>=this.maxRequests||Date.now()-this.start>=this.maxMs)throw new Error('Search budget exhausted; expand or resume explicitly');this.requests++;}
  snapshot(){return {requests:this.requests,elapsedMs:Date.now()-this.start,maxRequests:this.maxRequests,maxMs:this.maxMs};}
}
export class EvidenceCache {
  constructor(private store:Store,private identity:string){}
  async read<T>(key:string,loader:()=>Promise<T>,fresh=false,ttlMs=300000):Promise<T>{
    const hash=createHash('sha256').update(this.identity+'\0'+key).digest('hex');
    const entry=this.store.read<{value:T,expiresAt:number}>('cache',hash);
    if(!fresh&&entry&&entry.expiresAt>Date.now())return entry.value;
    const value=await loader();this.store.put('cache',hash,{value,expiresAt:Date.now()+ttlMs});return value;
  }
}
