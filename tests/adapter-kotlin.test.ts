import { it, expect } from 'vitest';
import { kotlin as adapter } from '../src/languages/adapters/kotlin.js';
it('selects native Kotlin commands and safe check modes', () => {
  const content = {
    'build.gradle.kts': 'plugins { kotlin("jvm") version "2.0.0" }\nkotlin { jvmToolchain(21) }',
    gradlew: '#!/bin/sh\n',
  };
  const repo = { root: process.cwd(), scope: '', files: Object.keys(content), content };
  expect(adapter.detect(repo).matched).toBe(true);
  const checks = adapter.commands(repo);
  expect(checks[0]?.executable).toBe('./gradlew');
  expect(checks[0]?.args).toContain('--no-daemon');
  expect(adapter.parseResults({ exitCode: null, available: false })).toBe('UNAVAILABLE');
  expect(adapter.parseResults({ exitCode: 1, available: true })).toBe('FAIL');
});
