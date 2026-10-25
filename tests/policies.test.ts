import { it, expect } from 'vitest';
import { classifyPolicy, instructionsFor } from '../src/repository/policies.js';
import type { PolicyDocument } from '../src/repository/policy-sources.js';
const doc = (text: string, path = 'CONTRIBUTING.md', scope = ''): PolicyDocument => ({
  text,
  path,
  scope,
  url: 'https://github.com/o/r/blob/main/' + path,
  sha: 'abc',
  organizationDefault: false,
});
it('never converts a ban or incomplete scan into allowance', () => {
  expect(
    classifyPolicy(
      [doc('Contributions welcome. We do not accept AI generated contributions.')],
      true,
    ).policy,
  ).toBe('PROHIBITED');
  expect(classifyPolicy([doc('Contributions welcome')], false).policy).toBe('UNKNOWN');
  expect(
    classifyPolicy([doc('Contributions welcome. AI assistance must be disclosed.')], true).policy,
  ).toBe('ALLOWED_WITH_DISCLOSURE');
});
it('resolves only applicable nested instructions', () => {
  expect(
    instructionsFor([doc('root', 'AGENTS.md'), doc('nested', 'src/AGENTS.md', 'src')], 'docs/a.md'),
  ).toHaveLength(1);
  expect(
    instructionsFor(
      [doc('root', 'AGENTS.md'), doc('nested', 'src/AGENTS.md', 'src')],
      'src/a.ts',
    ).map((d) => d.path),
  ).toEqual(['AGENTS.md', 'src/AGENTS.md']);
});
