import {it,expect} from 'vitest';
import {policySources} from '../src/repository/policy-sources.js';
import type {GitHubClient} from '../src/github/client.js';
import type {Repository} from '../src/core/models.js';
it('marks truncated policy trees incomplete',async()=>{const client={request:async(_m:string,path:string)=>path.includes('/commits/')?{sha:'abc'}:path.includes('/git/trees/')?{tree:[],truncated:true}:{content:Buffer.from('Contributions welcome').toString('base64'),encoding:'base64',sha:'a',html_url:'https://github.com/o/r',size:21}} as unknown as GitHubClient;expect((await policySources(client,{fullName:'o/r',defaultBranch:'main'} as Repository)).complete).toBe(false);});
