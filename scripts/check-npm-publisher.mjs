if (!process.env.NODE_AUTH_TOKEN)
  throw new Error('Add an npm publishing token as the NPM_TOKEN repository Actions secret');
const expected = process.env.NPM_PUBLISHER;
if (!expected || !/^[a-z0-9][a-z0-9._-]*$/i.test(expected))
  throw new Error('Provide the npm account username that owns this release');
const response = await fetch('https://registry.npmjs.org/-/whoami', {
  headers: { authorization: 'Bearer ' + process.env.NODE_AUTH_TOKEN },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error('npm authentication failed: HTTP ' + response.status);
const identity = await response.json();
const actual = identity.username;
if (typeof actual !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(actual))
  throw new Error('npm returned an invalid account identity');
if (actual !== expected)
  throw new Error(`Authenticated npm account ${actual} does not match requested owner ${expected}`);
console.log('Verified npm publisher: ' + actual);
