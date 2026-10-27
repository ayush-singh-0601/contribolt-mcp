import { it, expect } from 'vitest';
import { HttpAuth } from '../src/http/auth.js';
import { Store } from '../src/state/store.js';
import { fixture } from './helpers.js';
it('stores credential hashes, separates scopes and revokes browser sessions with their token', () => {
  const f = fixture(),
    db = new Store(f.root);
  try {
    const auth = new HttpAuth(db),
      issued = auth.issue('local', ['read']),
      login = auth.login(issued.token);
    const serialized = JSON.stringify(db.read('http-tokens', issued.id));
    expect(serialized).not.toContain(issued.token);
    expect(auth.authenticate('Bearer ' + issued.token, undefined)?.access.scopes).toEqual(['read']);
    expect(auth.authenticate(undefined, 'contribolt_session=' + login.session)?.access.csrf).toBe(
      login.access.csrf,
    );
    auth.revoke(issued.id);
    expect(auth.authenticate(undefined, 'contribolt_session=' + login.session)).toBeUndefined();
    expect(auth.token(issued.token)).toBeUndefined();
  } finally {
    db.close();
    f.cleanup();
  }
});
