import {it,expect} from 'vitest';
import {listedMaintainer,officialAuthor} from '../src/discovery/authorship.js';
import type {GitHubClient} from '../src/github/client.js';
import type {Repository,IssueEvidence} from '../src/core/models.js';
it('does not accept former maintainers or substring identities',()=>{expect(listedMaintainer('# Current\n- @alice\n# Former maintainers\n- @bob','alice')).toBe(true);expect(listedMaintainer('# Former maintainers\n- @alice','alice')).toBe(false);expect(listedMaintainer('@alice-other','alice')).toBe(false);});
it('does not treat MEMBER as proof when privileges and roster are unavailable',async()=>{const client={request:async(_m:string,p:string)=>{if(p==='/repos/o/r')return {owner:{type:'Organization',login:'o'}};throw new Error('403');}} as unknown as GitHubClient;expect((await officialAuthor(client,{fullName:'o/r',url:'https://github.com/o/r'} as Repository,{authorLogin:'alice',authorAssociation:'MEMBER',url:'https://github.com/o/r/issues/1'} as IssueEvidence)).verdict).toBe('UNKNOWN');});
