import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Store } from '../state/store.js';
export const Principal = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/);
export const Scope = z.enum(['read', 'sync']);
export interface Access {
  principal: string;
  scopes: ('read' | 'sync')[];
  expiresAt: number;
  tokenId: string;
  csrf?: string;
}
interface TokenRecord extends Access {
  revoked: boolean;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class HttpAuth {
  constructor(private store: Store) {}
  issue(principal: string, scopes: ('read' | 'sync')[] = ['read'], days = 30) {
    Principal.parse(principal);
    z.array(Scope).min(1).parse(scopes);
    z.number().positive().max(365).parse(days);
    const token = 'mp_' + randomBytes(32).toString('base64url'),
      id = hash(token),
      record: TokenRecord = {
        principal,
        scopes: [...new Set(scopes)],
        expiresAt: Date.now() + days * 86400000,
        tokenId: id,
        revoked: false,
      };
    this.store.put('http-tokens', id, record);
    return { token, id, principal, scopes: record.scopes, expiresAt: record.expiresAt };
  }
  revoke(id: string): void {
    const record = this.store.read<TokenRecord>('http-tokens', id);
    if (!record) throw new Error('Token not found');
    record.revoked = true;
    this.store.put('http-tokens', id, record);
  }
  token(value: string): Access | undefined {
    if (!/^mp_[A-Za-z0-9_-]{43}$/.test(value)) return;
    const record = this.store.read<TokenRecord>('http-tokens', hash(value));
    if (record && !record.revoked && record.expiresAt > Date.now()) return record;
  }
  login(token: string) {
    const access = this.token(token);
    if (!access) throw new Error('Authentication failed');
    const session = randomBytes(32).toString('base64url'),
      csrf = randomBytes(24).toString('base64url');
    const record: Access = {
      ...access,
      csrf,
      expiresAt: Math.min(access.expiresAt, Date.now() + 8 * 3600000),
    };
    this.store.put('http-sessions', hash(session), record);
    return { session, access: record };
  }
  authenticate(
    authorization: string | undefined,
    cookie: string | undefined,
  ): { access: Access; cookie: boolean } | undefined {
    if (authorization?.startsWith('Bearer ')) {
      const access = this.token(authorization.slice(7));
      if (access) return { access, cookie: false };
      return;
    }
    const session = cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('mergepilot_session='))
      ?.slice('mergepilot_session='.length);
    if (!session) return;
    const access = this.store.read<Access>('http-sessions', hash(session));
    if (!access || access.expiresAt <= Date.now()) return;
    const token = this.store.read<TokenRecord>('http-tokens', access.tokenId);
    if (!token || token.revoked || token.expiresAt <= Date.now()) return;
    return { access, cookie: true };
  }
  logout(cookie: string | undefined): void {
    const value = cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('mergepilot_session='))
      ?.slice('mergepilot_session='.length);
    if (value) this.store.remove('http-sessions', hash(value));
  }
}
