import { it, expect } from 'vitest';
import { assessReproduction } from '../src/contribution/plan.js';
it('requires stronger evidence when reproduction is missing', () => {
  const a = {
    expected: 'a',
    actual: 'b',
    rootCause: 'A specific branch',
    strategy: 'Correct it',
    files: ['a.ts'],
    evidenceUrls: ['a.ts'],
    reproduced: false,
    reproductionExplanation: 'Cannot run',
    highRisk: false,
  };
  expect(assessReproduction(a).blocked).toBe(true);
  expect(
    assessReproduction({
      ...a,
      evidenceUrls: ['a.ts:1', 'test/a.ts:2'],
      reproductionExplanation:
        'The required proprietary service is unavailable; both code paths establish the incorrect condition.',
    }).blocked,
  ).toBe(false);
});
