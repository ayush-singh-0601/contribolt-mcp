import {it,expect} from 'vitest';
import {classifyPolicy} from '../src/repository/policies.js';
import {issueAcceptance} from '../src/repository/manifests.js';
import type {PolicyDocument} from '../src/repository/policy-sources.js';
import type {Repository} from '../src/core/models.js';
const doc=(text:string,path:string,organizationDefault=false):PolicyDocument=>({text,path,organizationDefault,url:'https://github.com/o/r/blob/main/'+path,sha:'a',scope:''});
it('lets authoritative acceptance manifests clarify missing guidance without overriding bans',()=>{const manifest=doc(JSON.stringify({schemaVersion:1,ai:'allowed',externalPullRequests:true,requiredChecks:['test'],blockedLabels:['security-review'],requireDraft:true}),'.mergepilot/policy.json');const repo={fullName:'o/r'} as Repository;const policy=classifyPolicy([manifest],true,repo);expect(policy.policy).toBe('ALLOWED');expect(policy.requiredChecks).toContain('test');expect(policy.requireDraft).toBe(true);expect(issueAcceptance(policy,['security-review'])).toBe('PROHIBITED');expect(classifyPolicy([manifest,doc('We do not accept AI contributions.','CONTRIBUTING.md')],true,repo).policy).toBe('PROHIBITED');});
it('fails closed for malformed or out-of-allowlist manifests',()=>{expect(classifyPolicy([doc('{"schemaVersion":999}','.mergepilot/policy.json')],true).policy).toBe('UNKNOWN');expect(classifyPolicy([doc(JSON.stringify({schemaVersion:1,ai:'allowed',externalPullRequests:true,repositories:['different/repo']}),'.mergepilot/policy.json')],true,{fullName:'o/r'} as Repository).policy).toBe('PROHIBITED');});
