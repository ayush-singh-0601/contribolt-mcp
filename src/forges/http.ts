import {z} from 'zod';
import {SearchBudget} from '../discovery/budget.js';
import {ForgeError} from '../github/client.js';
export const ForgeConfigSchema=z.object({kind:z.enum(['gitlab','forgejo']),host:z.string().regex(/^(?!localhost$)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/),tokenEnv:z.string().regex(/^[A-Z][A-Z0-9_]+$/),enabled:z.boolean().default(true)}).strict();
export type ForgeConfig=z.infer<typeof ForgeConfigSchema>;
export class JsonForgeClient {
  private budget=new SearchBudget();
  constructor(readonly config:ForgeConfig,readonly token:string,private fetcher:typeof fetch=fetch){}
  async supportsDraftPullRequests():Promise<boolean>{
    this.budget.take();const response=await this.fetcher(`https://${this.config.host}/swagger.v1.json`,{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new ForgeError('Instance API capability schema unavailable',response.status);
    const text=await response.text();if(Buffer.byteLength(text)>8*1024*1024)throw new Error('Instance capability schema exceeds size limit');
    const schema=JSON.parse(text) as {definitions?:Record<string,{properties?:Record<string,unknown>}>;components?:{schemas?:Record<string,{properties?:Record<string,unknown>}>}};
    return !!(schema.definitions?.CreatePullRequestOption?.properties?.draft??schema.components?.schemas?.CreatePullRequestOption?.properties?.draft);
  }
  async request<T>(method:string,path:string,body?:unknown,params:Record<string,unknown>={},signal?:AbortSignal):Promise<T>{
    if(!path.startsWith('/')||path.startsWith('//')||path.includes('://'))throw new Error('Invalid forge API path');
    const url=new URL(`https://${this.config.host}${this.config.kind==='gitlab'?'/api/v4':'/api/v1'}${path}`);
    for(const [key,value]of Object.entries(params))if(value!==undefined)url.searchParams.set(key,String(value));
    for(let attempt=0;;attempt++){
      this.budget.take(signal);
      let response:Response;
      try{response=await this.fetcher(url,{method,redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json',...(this.config.kind==='gitlab'?{'PRIVATE-TOKEN':this.token}:{Authorization:'token '+this.token})},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}catch{signal?.throwIfAborted();if(method==='GET'&&attempt<2)continue;throw new ForgeError('Forge network request failed',0);}
      if(response.status===429)throw new ForgeError('Forge rate limit reached; resume later',429,Date.now()+Number(response.headers.get('retry-after')??60)*1000);
      if(method==='GET'&&response.status>=500&&attempt<2)continue;
      if(!response.ok)throw new ForgeError(`Forge operation failed (${response.status})`,response.status);
      if(response.status===204)return undefined as T;
      const text=await response.text();if(Buffer.byteLength(text)>4*1024*1024)throw new Error('Forge response exceeds size limit');return JSON.parse(text) as T;
    }
  }
  async pages<T>(path:string,params:Record<string,unknown>={},limit=1000,signal?:AbortSignal):Promise<{items:T[],complete:boolean}>{const items:T[]=[];for(let page=1;items.length<limit;page++){const values=await this.request<T[]>('GET',path,undefined,{...params,page,per_page:100,limit:100},signal);if(!Array.isArray(values))throw new Error('Invalid forge list response');items.push(...values.slice(0,limit-items.length));if(values.length<100)return {items,complete:true};}return {items,complete:false};}
}
