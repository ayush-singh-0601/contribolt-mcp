import { it, expect } from 'vitest';
import { assertTransition } from '../src/core/workflow.js';
import { SessionSchema } from '../src/core/models.js';
import { randomUUID } from 'node:crypto';
it('rejects skipped stages and ungated publication', () => {
  const s = SessionSchema.parse({
    id: randomUUID(),
    preferences: {},
    state: 'ONBOARDING',
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  });
  expect(() => assertTransition(s, 'FORK_BRANCH_PUSH_PR')).toThrow();
  s.state = 'USER_APPROVAL_TO_PUBLISH';
  expect(() => assertTransition(s, 'FORK_BRANCH_PUSH_PR')).toThrow('approval');
});
