import {it,expect} from 'vitest';
import {RevisionPlanSchema,planRevision} from '../src/contribution/revisions.js';
import {Store} from '../src/state/store.js';
import {PreferencesSchema} from '../src/core/models.js';
import type {GitHubClient} from '../src/github/client.js';
import {fixture} from './helpers.js';
it('requires an active monitored PR and a concrete valid revision plan',async()=>{expect(RevisionPlanSchema.safeParse({approved:true}).success).toBe(false);const f=fixture(),db=new Store(f.root);try{const s=db.create(PreferencesSchema.parse({}));const plan={analysis:{expected:'a',actual:'b',rootCause:'c',strategy:'d',files:['a'],evidenceUrls:['a'],reproduced:true,reproductionExplanation:'fixture'},feedbackIds:['review:1'],reviewedHeadSha:'a'.repeat(40)};await expect(planRevision(db,s.id,plan,{} as GitHubClient)).rejects.toThrow('monitored');}finally{db.close();f.cleanup();}});
