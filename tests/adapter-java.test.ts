import { it, expect } from 'vitest';
import { java as adapter } from '../src/languages/adapters/java.js';
it('selects native Java commands and safe check modes', () => {
  const content = {
    'pom.xml': '<project><modelVersion>4.0.0</modelVersion></project>',
    mvnw: '#!/bin/sh\n',
  };
  const repo = { root: process.cwd(), scope: '', files: Object.keys(content), content };
  expect(adapter.detect(repo).matched).toBe(true);
  const checks = adapter.commands(repo);
  expect(checks[0]?.executable).toBe('./mvnw');
  expect(checks[0]?.args).toEqual(['test']);
  expect(adapter.parseResults({ exitCode: null, available: false })).toBe('UNAVAILABLE');
  expect(adapter.parseResults({ exitCode: 1, available: true })).toBe('FAIL');
});
