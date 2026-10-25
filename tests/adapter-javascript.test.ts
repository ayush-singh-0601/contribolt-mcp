import { it, expect } from 'vitest';
import { javascript as adapter } from '../src/languages/adapters/javascript.js';
it('selects native JavaScript and TypeScript commands and safe check modes', () => {
  const content = {
    'package.json':
      '{"scripts": {"test": "vitest run", "format:check": "prettier --check .", "format": "prettier --write ."}}',
    'pnpm-lock.yaml': '',
  };
  const repo = { root: process.cwd(), scope: '', files: Object.keys(content), content };
  expect(adapter.detect(repo).matched).toBe(true);
  const checks = adapter.commands(repo);
  expect(checks.find((c) => c.kind === 'test')?.executable).toBe('pnpm');
  expect(checks.some((c) => c.args.includes('format'))).toBe(false);
  expect(checks.find((c) => c.kind === 'format_check')?.args).toEqual(['run', 'format:check']);
  expect(adapter.parseResults({ exitCode: null, available: false })).toBe('UNAVAILABLE');
  expect(adapter.parseResults({ exitCode: 1, available: true })).toBe('FAIL');
});
it('reads Deno JSONC tasks without losing comments or task definitions', () => {
  const content = {
      'deno.jsonc':
        '{ // project tasks\n "tasks":{"test":"deno test", "lint":"deno lint", "check":"deno check main.ts"}}',
    },
    repo = { root: process.cwd(), scope: '', files: Object.keys(content), content };
  expect(adapter.commands(repo).map((c) => c.kind)).toEqual(['test', 'lint', 'typecheck']);
  expect(() => adapter.commands({ ...repo, content: { 'deno.jsonc': '{broken' } })).toThrow(
    'Invalid Deno',
  );
});
