import { execFileSync } from 'node:child_process';

if (!process.env.NODE_AUTH_TOKEN)
  throw new Error('Add an npm publishing token as the NPM_TOKEN repository Actions secret');
const expected = process.env.NPM_PUBLISHER;
if (!expected || !/^[a-z0-9][a-z0-9._-]*$/i.test(expected))
  throw new Error('Provide the npm account username that owns this release');
const actual = execFileSync('npm', ['whoami', '--registry=https://registry.npmjs.org/'], {
  encoding: 'utf8',
  timeout: 30000,
}).trim();
if (actual !== expected)
  throw new Error('Authenticated npm account does not match the requested release owner');
console.log('Verified npm publisher: ' + actual);
