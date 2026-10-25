import { it, expect } from 'vitest';
import { ruby as adapter } from '../src/languages/adapters/ruby.js';
it('selects native Ruby commands and safe check modes', () => {
  const content = {
    Gemfile: "source 'https://rubygems.org'\ngem 'rspec'\n",
    'spec/example_spec.rb': 'describe "fixture" do; end',
  };
  const repo = { root: process.cwd(), scope: '', files: Object.keys(content), content };
  expect(adapter.detect(repo).matched).toBe(true);
  const checks = adapter.commands(repo);
  expect(checks[0]?.args).toEqual(['exec', 'rspec']);
  expect(checks[0]?.executable).toBe('bundle');
  expect(adapter.parseResults({ exitCode: null, available: false })).toBe('UNAVAILABLE');
  expect(adapter.parseResults({ exitCode: 1, available: true })).toBe('FAIL');
});
