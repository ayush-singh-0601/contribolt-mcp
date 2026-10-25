import { it, expect } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { appJwt, credentials } from '../src/github/auth.js';
it('keeps tokens in providers and signs short-lived App JWTs', async () => {
  const c = await credentials({ GITHUB_TOKEN: 'secret' });
  expect(JSON.stringify(c)).not.toContain('secret');
  expect(await c.token()).toBe('secret');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const token = appJwt(
    '123',
    privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    1000000,
  );
  const [h, p, s] = token.split('.');
  expect(
    createVerify('RSA-SHA256')
      .update(h + '.' + p)
      .verify(publicKey, Buffer.from(s!, 'base64url')),
  ).toBe(true);
});
