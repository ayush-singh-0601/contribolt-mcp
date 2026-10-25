import { it, expect } from 'vitest';
import { summarizeHistory, historicalHealth } from '../src/discovery/history.js';
it('excludes open and internal PRs and suppresses small or incomplete samples', () => {
  const now = new Date().toISOString(),
    metrics = summarizeHistory([
      { number: 1, created_at: now, closed_at: now, merged_at: now, author_association: 'NONE' },
      { number: 2, created_at: now, closed_at: null, merged_at: null, author_association: 'NONE' },
      { number: 3, created_at: now, closed_at: now, merged_at: null, author_association: 'MEMBER' },
    ]);
  expect(metrics.sampleSize).toBe(1);
  expect(metrics.observedMergeRate).toBe(1);
  expect(historicalHealth(0.5, metrics)).toBe(0.5);
  expect(historicalHealth(0.5, { ...metrics, sampleSize: 20, complete: false })).toBe(0.5);
  expect(historicalHealth(0.5, { ...metrics, sampleSize: 20 })).toBe(0.625);
});
