import {it,expect} from 'vitest';
import {discoverRepositories} from '../src/discovery/repositories.js';
import {SearchBudget} from '../src/discovery/budget.js';
import {PreferencesSchema} from '../src/core/models.js';
import type {GitHubClient} from '../src/github/client.js';
it('diversifies repository and issue searches without a supplied repository',async()=>{const paths:string[]=[];const raw={id:1,full_name:'owner/repo',html_url:'https://github.com/owner/repo',clone_url:'https://github.com/owner/repo.git',default_branch:'main',private:false,archived:false,fork:false,has_issues:true,language:'Python',stargazers_count:10,pushed_at:new Date().toISOString(),owner:{login:'owner',type:'User'}};const client={request:async(_m:string,p:string)=>{paths.push(p);return {items:p.includes('/repositories')?[raw]:[]};}} as unknown as GitHubClient;const result=await discoverRepositories(client,PreferencesSchema.parse({languages:['Python']}),new SearchBudget());expect(result).toHaveLength(1);expect(paths).toContain('/search/issues');});
