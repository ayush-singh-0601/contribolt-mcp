import {z} from 'zod';
import type {Store} from '../state/store.js';
import {inspectPatch} from './quality.js';
export const CritiqueSchema=z.object({patchHash:z.string().regex(/^[a-f0-9]{64}$/),findings:z.array(z.string().max(2000)).max(100),reviewedAt:z.iso.datetime(),reviewer:z.string().min(1).max(100)}).strict();
export async function recordCritique(store:Store,id:string,input:unknown){
  const critique=CritiqueSchema.parse(input),s=store.get(id),inspection=await inspectPatch(s);
  if(s.stopped||critique.patchHash!==inspection.patchHash)throw new Error('Critique does not apply to the current patch');
  if(Date.parse(critique.reviewedAt)>Date.now()+60000||Date.parse(critique.reviewedAt)<Date.parse(s.createdAt))throw new Error('Invalid critique timestamp');
  const session=store.mutate(id,x=>{if(!x.analysis)throw new Error('Analysis required');x.analysis.critique=critique;x.publishApproved=false;});
  store.event(id,'independent-critique-recorded',{patchHash:critique.patchHash,reviewer:critique.reviewer,findings:critique.findings.length});return {session,inspection};
}
