import { it, expect } from 'vitest';
import { weightedScore, selectCandidate } from '../src/discovery/ranking.js';
it('uses the specified weights and cannot rank an unknown candidate', () => {
  expect(
    weightedScore({
      language: 1,
      clarity: 0,
      testability: 0,
      maintenance: 0,
      policy: 0,
      recency: 0,
    }),
  ).toBe(20);
  expect(
    weightedScore({
      language: 1,
      clarity: 1,
      testability: 1,
      maintenance: 1,
      policy: 1,
      recency: 1,
    }),
  ).toBe(100);
  expect(selectCandidate([]).message).toBe('No verified matches');
});
