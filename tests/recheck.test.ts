import {it,expect} from 'vitest';
import {assertFreshEligibility} from '../src/contribution/recheck.js';
import type {IssueEvidence} from '../src/core/models.js';
it('halts when issue eligibility or the upstream revision changes',()=>{expect(()=>assertFreshEligibility({eligibility:'INELIGIBLE',rejectReasons:['New discussion comment']} as IssueEvidence,'base','base')).toThrow('New discussion');expect(()=>assertFreshEligibility({eligibility:'ELIGIBLE'} as IssueEvidence,'old','new')).toThrow('Upstream changed');});
