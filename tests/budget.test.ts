import { it, expect } from 'vitest';
import { SearchBudget, EvidenceCache } from '../src/discovery/budget.js';
import { Store } from '../src/state/store.js';
import { fixture } from './helpers.js';
it('bounds requests and never uses cache for a fresh recheck', async () => {
  const b = new SearchBudget(1);
  b.take();
  expect(() => b.take()).toThrow('budget');
  const f = fixture(),
    db = new Store(f.root);
  try {
    const c = new EvidenceCache(db, 'actor');
    let n = 0;
    expect(await c.read('key', async () => ++n)).toBe(1);
    expect(await c.read('key', async () => ++n)).toBe(1);
    expect(await c.read('key', async () => ++n, true)).toBe(2);
  } finally {
    db.close();
    f.cleanup();
  }
});
