import {states,type State,type Session} from './models.js';
import type {Store} from '../state/store.js';
const terminal=new Set<State>(['DONE','BLOCKED','SKIPPED','FAILED']);
export function assertTransition(session:Session,to:State):void {
  if(session.stopped)throw new Error('Session stopped; resume explicitly');
  if(terminal.has(session.state))throw new Error('Resume or select another issue before continuing');
  const index=states.indexOf(session.state);
  const revisionLoop=session.state==='REVISIONS_IF_NEEDED' && to==='IMPLEMENTATION_PLAN';
  if(!terminal.has(to) && states[index+1]!==to && !revisionLoop)throw new Error(`Invalid transition ${session.state} -> ${to}`);
  if(to==='PROJECT_POLICY_GATE' && session.selectedIssue?.eligibility!=='ELIGIBLE')throw new Error('Verified eligible issue required');
  if(to==='REPOSITORY_ANALYSIS' && !['ALLOWED','ALLOWED_WITH_DISCLOSURE'].includes(session.policyDecision))throw new Error('Policy unresolved or prohibited');
  if(to==='PATCH_IMPLEMENTATION' && !session.analysis)throw new Error('Reproduction and implementation plan required');
  if(to==='VALIDATION' && !session.workspace)throw new Error('Isolated workspace required');
  if(to==='USER_APPROVAL_TO_PUBLISH' && !session.proposal)throw new Error('Reviewable PR proposal required');
  if(to==='FORK_BRANCH_PUSH_PR' && !session.publishApproved)throw new Error('Human publication approval required');
  if(to==='REVIEW_ROUTING' && !session.prUrl)throw new Error('Confirmed PR URL required');
}
export function transition(store:Store,id:string,to:State):Session {return store.mutate(id,s=>{assertTransition(s,to);s.previousState=s.state;s.state=to;});}
export function block(store:Store,id:string,reasons:string[]):Session {return store.mutate(id,s=>{s.previousState=s.state;s.state='BLOCKED';s.blockers=reasons;s.publishApproved=false;});}
export function nextAction(session:Session):string {
  if(session.stopped)return 'resume_session';
  const actions:Partial<Record<State,string>>={ONBOARDING:'set_preferences',REPOSITORY_DISCOVERY:'discover_repositories',ISSUE_DISCOVERY:'find_eligible_issues',ELIGIBILITY_VERIFICATION:'verify_issue',PROJECT_POLICY_GATE:'analyze_repository',REPOSITORY_ANALYSIS:'analyze_repository',ISSUE_REPRODUCTION:'plan_fix',IMPLEMENTATION_PLAN:'plan_fix',PATCH_IMPLEMENTATION:'Host agent: implement the recorded plan',VALIDATION:'check_patch',PRE_SUBMISSION_RECHECK:'prepare_pull_request',USER_APPROVAL_TO_PUBLISH:'request_approval',FORK_BRANCH_PUSH_PR:'publish_pull_request',REVIEW_ROUTING:'route_review',REVIEW_MONITORING:'monitor_pull_request',REVISIONS_IF_NEEDED:'plan_revision',BLOCKED:'Resolve blockers or skip this issue'};
  return actions[session.state]??'get_status';
}
