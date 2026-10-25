import {RepoSchema,type Repository,type Preferences,defaults} from '../core/models.js';
import {GitHubClient} from '../github/client.js';
import {SearchBudget} from './budget.js';
import {searchLanguages} from '../onboarding/preferences.js';
import {repositoryName} from '../security/boundaries.js';
export interface GitHubRepository {id:number;full_name:string;html_url:string;clone_url:string;default_branch:string;private:boolean;archived:boolean;fork:boolean;has_issues:boolean;language:string|null;stargazers_count:number;pushed_at:string;owner:{login:string,type:string};permissions?:{push?:boolean};}
export function mapRepository(raw:GitHubRepository):Repository {return RepoSchema.parse({id:String(raw.id),fullName:raw.full_name,url:raw.html_url,cloneUrl:raw.clone_url,defaultBranch:raw.default_branch,public:!raw.private,archived:raw.archived,fork:raw.fork,hasIssues:raw.has_issues,languages:raw.language?[raw.language]:[],stars:raw.stargazers_count,updatedAt:raw.pushed_at});}
export async function discoverRepositories(client:GitHubClient,preferences:Preferences,budget:SearchBudget,excluded:string[]=[],signal?:AbortSignal):Promise<Repository[]> {
  const repos=new Map<string,Repository>();
  const add=(raw:GitHubRepository)=>{const r=mapRepository(raw);if(!excluded.includes(r.fullName)&&r.public&&!r.archived&&r.hasIssues)repos.set(r.id,r);};
  if(preferences.preferredRepository){budget.take(signal);add(await client.request<GitHubRepository>('GET','/repos/'+repositoryName(preferences.preferredRepository),{},signal));return [...repos.values()];}
  const languages=searchLanguages(preferences).slice(0,5),terms=languages.length?languages:[''];
  for(const language of terms){
    const qualifier=language?` language:"${language.replace(/"/g,'')}"`:'';
    const domain=preferences.optionalDomain?' '+preferences.optionalDomain.replace(/[^\w -]/g,''):'';
    for(const sort of ['updated','help-wanted-issues']){budget.take(signal);const result=await client.request<{items:GitHubRepository[]}>('GET','/search/repositories',{q:`is:public archived:false${qualifier}${domain}`,sort,per_page:15},signal);for(const raw of result.items)add(raw);}
    budget.take(signal);const issues=await client.request<{items:{repository_url:string}[]}>('GET','/search/issues',{q:`is:issue is:open comments:0 no:assignee${qualifier}${domain}`,sort:'updated',per_page:10},signal);
    for(const issue of issues.items){const fullName=issue.repository_url.replace('https://api.github.com/repos/','');if([...repos.values()].some(r=>r.fullName===fullName))continue;budget.take(signal);add(await client.request<GitHubRepository>('GET','/repos/'+repositoryName(fullName),{},signal));if(repos.size>=defaults.maxRepositories)break;}
    if(repos.size>=defaults.maxRepositories)break;
  }
  return [...repos.values()].slice(0,defaults.maxRepositories);
}
