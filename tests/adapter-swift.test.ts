import { it, expect } from 'vitest';
import { swift as adapter } from '../src/languages/adapters/swift.js';
it('selects native Swift commands and safe check modes', () => {
  const content = { 'Package.swift': '// swift-tools-version: 6.0\nimport PackageDescription\n' };
  const repo = { root: process.cwd(), scope: '', files: Object.keys(content), content };
  expect(adapter.detect(repo).matched).toBe(true);
  const checks = adapter.commands(repo);
  expect(checks[0]?.args).toEqual(['test']);
  expect(adapter.planEnvironment(repo).requirements[0]).toBe('6.0');
  expect(adapter.parseResults({ exitCode: null, available: false })).toBe('UNAVAILABLE');
  expect(adapter.parseResults({ exitCode: 1, available: true })).toBe('FAIL');
});
