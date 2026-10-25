import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createSign} from 'node:crypto';
const exec=promisify(execFile);
export interface Credentials {kind:'token'|'gh'|'app';token():Promise<string>;}
export function appJwt(appId:string,key:string,now=Date.now()):string {
  if(!/^\d+$/.test(appId))throw new Error('Invalid GitHub App id');
  const encoded=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const text=encoded({alg:'RS256',typ:'JWT'})+'.'+encoded({iat:Math.floor(now/1000)-60,exp:Math.floor(now/1000)+540,iss:appId});
  return text+'.'+createSign('RSA-SHA256').update(text).sign(key).toString('base64url');
}
export async function credentials(env:NodeJS.ProcessEnv=process.env):Promise<Credentials>{
  const configured=env.MERGEPILOT_GITHUB_TOKEN??env.GH_TOKEN??env.GITHUB_TOKEN;
  if(configured)return {kind:'token',token:async()=>configured};
  if(env.MERGEPILOT_APP_ID&&env.MERGEPILOT_APP_KEY&&env.MERGEPILOT_INSTALLATION_ID){
    let cached:{token:string,expires_at:string}|undefined;
    return {kind:'app',token:async()=>{if(cached&&Date.parse(cached.expires_at)>Date.now()+60000)return cached.token;
      const id=env.MERGEPILOT_INSTALLATION_ID!;if(!/^\d+$/.test(id))throw new Error('Invalid installation id');
      const response=await fetch(`https://api.github.com/app/installations/${id}/access_tokens`,{method:'POST',headers:{Authorization:`Bearer ${appJwt(env.MERGEPILOT_APP_ID!,env.MERGEPILOT_APP_KEY!)}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`GitHub App authentication failed (${response.status})`);cached=await response.json() as typeof cached;if(!cached?.token)throw new Error('Invalid installation token response');return cached.token;
    }};
  }
  try{const {stdout}=await exec('gh',['auth','token','--hostname','github.com'],{timeout:5000,maxBuffer:8192});const token=stdout.trim();if(token)return {kind:'gh',token:async()=>token};}catch{/* Authentication failure is a hard blocker, not anonymous provenance. */}
  throw new Error('GitHub authentication required: use gh auth login or a scoped token in the environment');
}
