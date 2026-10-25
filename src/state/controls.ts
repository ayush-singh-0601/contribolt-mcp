import type {Store} from './store.js';
import type {Session} from '../core/models.js';
import {nextAction} from '../core/workflow.js';
export class SessionControls {
  private cancellations=new Map<string,AbortController>();
  constructor(private store:Store){}
  signal(id:string):AbortSignal {const previous=this.cancellations.get(id);if(previous)return previous.signal;const controller=new AbortController();this.cancellations.set(id,controller);return controller.signal;}
  stop(id:string):Session {this.cancellations.get(id)?.abort();this.store.put('approval-revocations',id,Date.now());return this.store.mutate(id,s=>{s.stopped=true;s.publishApproved=false;});}
  resume(id:string):Session {this.cancellations.delete(id);return this.store.mutate(id,s=>{s.stopped=false;s.publishApproved=false;if(s.state==='FAILED'&&s.previousState)s.state=s.previousState;});}
  skip(id:string):Session {this.cancellations.get(id)?.abort();this.cancellations.delete(id);this.store.put('approval-revocations',id,Date.now());return this.store.mutate(id,s=>{if(s.prUrl)throw new Error('Published sessions must be monitored or stopped, not replaced');if(s.selectedIssue)s.candidates=s.candidates.map(c=>c.url===s.selectedIssue?.url?{...c,eligibility:'INELIGIBLE',rejectReasons:[...c.rejectReasons,'Skipped by user']}:c);s.selectedIssue=undefined;s.repository=undefined;s.workspace=undefined;s.analysis=undefined;s.validation=[];s.commands=[];s.proposal=undefined;s.publishApproved=false;s.policyDecision='UNKNOWN';s.requiredDisclosures=[];s.state='ISSUE_DISCOVERY';s.blockers=[];});}
  status(id:string){const session=this.store.get(id);return {session,monitor:this.store.read('monitor',id),outcome:this.store.read('outcomes',id),nextAction:nextAction(session),offlineNotice:'Cached observations are readable offline; publication always requires fresh forge verification.'};}
  assertWritable(id:string):Session {const s=this.store.get(id);if(s.stopped)throw new Error('Session stopped');if(s.dryRun)throw new Error('Dry run prohibits public writes');return s;}
}
