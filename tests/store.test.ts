import { it, expect } from 'vitest';
import { Store } from '../src/state/store.js';
import { PreferencesSchema } from '../src/core/models.js';
import { fixture } from './helpers.js';
it('persists sessions and rejects stale writes atomically', () => {
  const f = fixture();
  let db = new Store(f.root);
  try {
    const s = db.create(PreferencesSchema.parse({}));
    db.mutate(
      s.id,
      (x) => {
        x.stopped = true;
      },
      0,
    );
    expect(() =>
      db.mutate(
        s.id,
        (x) => {
          x.stopped = false;
        },
        0,
      ),
    ).toThrow('concurrently');
    db.close();
    db = new Store(f.root);
    expect(db.get(s.id).stopped).toBe(true);
    expect(() => db.artifact(s.id, '../escape', 'bad')).toThrow();
  } finally {
    db.close();
    f.cleanup();
  }
});
