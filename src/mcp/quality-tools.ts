import type {Application} from './application.js';
import {sessionInput} from './registry.js';
import {inspectPatch} from '../contribution/quality.js';
import {CritiqueSchema,recordCritique} from '../contribution/critique.js';
import {readiness} from '../contribution/readiness.js';
export function registerQuality(app:Application){
  app.register({name:'check_patch',description:'Inspect patch scope and record a separate host-agent critique tied to this patch.',schema:sessionInput.extend({critique:CritiqueSchema.optional()}),readOnly:false,publicWrite:false,handler:async a=>{
    const id=String(a.sessionId);if(a.critique)await recordCritique(app.store,id,a.critique);const s=app.store.get(id),inspection=await inspectPatch(s);
    const verdict=readiness(s,inspection);app.store.mutate(id,x=>{x.state=verdict.status==='BLOCKED'?'VALIDATION':'PRE_SUBMISSION_RECHECK';x.blockers=verdict.blockers;x.publishApproved=false;});
    return {inspection,readiness:verdict,critique:s.analysis?.critique,critiqueNeeded:s.analysis?.critique?.patchHash!==inspection.patchHash,nextAction:verdict.status==='BLOCKED'?'Resolve validation blockers':'prepare_pull_request',instruction:'Perform a separate review of correctness, risk surface, compatibility, project conventions and tests. Record unresolved findings; do not simply restate the implementation.'};
  }});
}
