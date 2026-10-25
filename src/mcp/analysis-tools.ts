import {policyKey} from '../repository/policy-store.js';
import {z} from 'zod';
import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {createWorkspace} from '../git/workspace.js';
import {analysisMarkdown} from '../repository/indexing.js';
import {cachedIndex} from '../repository/cache.js';
import {instructionsFor,type PolicyDecision} from '../repository/policies.js';
import type {PolicyDocument} from '../repository/policy-sources.js';
import {implementationPlan,assessReproduction} from '../contribution/plan.js';
import {nextAction} from '../core/workflow.js';
export function registerAnalysis(app:Application,workspaceFactory:typeof createWorkspace=createWorkspace){
  app.register({name:'analyze_repository',description:'Create an isolated workspace and inspect scoped project instructions and code. Invoking this tool authorizes this local clone; it does not execute repository scripts.',schema:sessionInput.extend({scope:z.string().default('')}),readOnly:false,publicWrite:false,handler:async a=>{
    const id=String(a.sessionId),s=app.store.get(id);if(s.stopped||!s.repository||s.selectedIssue?.eligibility!=='ELIGIBLE')throw new Error('A verified selected issue is required');
    const policy=app.store.read<{documents:PolicyDocument[],decision:PolicyDecision,commit:string}>('policies',policyKey(s.repository));
    if(!policy||!['ALLOWED','ALLOWED_WITH_DISCLOSURE'].includes(policy.decision.policy))throw new Error('Policy gate is unresolved or prohibited');
    const workspace=s.workspace?{root:s.workspace,sha:s.repositoryCommitSha!}:await workspaceFactory(app.store.root,s.repository,app.controls.signal(id));
    if(workspace.sha!==policy.commit)throw new Error('Repository changed since policy verification; verify the issue again');
    const index=await cachedIndex(app.store,workspace.root,s.repository.host+':'+s.repository.id,String(a.scope),s.selectedIssue.title.split(/\s+/).filter(w=>w.length>3));
    app.store.put('indexes',id,index);
    const updated=app.store.mutate(id,x=>{x.workspace=workspace.root;x.repositoryCommitSha=workspace.sha;x.policyDecision=policy.decision.policy;x.policySources=policy.decision.evidence;x.requiredDisclosures=policy.decision.disclosures;x.requiredChecks=policy.decision.requiredChecks??[];x.state='ISSUE_REPRODUCTION';},s.revision);
    const artifact=app.store.artifact(id,'repository_analysis.md',analysisMarkdown(index));
    const excerpts=Object.fromEntries(Object.entries(index.content).slice(0,12).map(([file,content])=>[file,content.slice(0,4000)]));
    return {workspace:workspace.root,revision:workspace.sha,artifact,policy:policy.decision,manifests:index.manifests,sourceExcerpts:excerpts,indexPartial:index.truncated,instructions:Object.fromEntries(Object.keys(excerpts).map(file=>[file,instructionsFor(policy.documents,file)])),nextAction:nextAction(updated),notice:'Read full applicable instructions and relevant files through the host workspace tools; excerpts are bounded.'};
  }});
  app.register({name:'plan_fix',description:'Validate recorded reproduction and persist a minimal implementation plan for the host agent.',schema:sessionInput,readOnly:false,publicWrite:false,handler:async a=>{
    const id=String(a.sessionId),s=app.store.get(id);if(s.stopped||!s.analysis||!s.workspace)throw new Error('Record repository analysis and reproduction evidence first');
    const assessment=assessReproduction(s.analysis);if(assessment.blocked){app.store.mutate(id,x=>{x.previousState=x.state;x.state='BLOCKED';x.blockers=assessment.reasons;});return assessment;}
    const plan=implementationPlan(s),artifact=app.store.artifact(id,'implementation_plan.md',plan);const updated=app.store.mutate(id,x=>{x.state='PATCH_IMPLEMENTATION';x.publishApproved=false;});
    return {artifact,plan,nextAction:nextAction(updated),implementationOwner:'host coding agent',standards:['Follow scoped instructions and existing architecture','Preserve compatibility','Add focused regression tests','Avoid unrelated edits and unnecessary dependencies','Never stage secrets or existing user work']};
  }});
}
