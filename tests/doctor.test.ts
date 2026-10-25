import { it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { supportedRuntime, stateCapability, inspectEnvironment } from '../src/runtime/doctor.js';
import { fixture } from './helpers.js';
it('requires Node 24 while allowing supported future runtimes', () => {
  expect(supportedRuntime('22.16.0')).toBe(false);
  expect(supportedRuntime('24.22.1')).toBe(true);
  expect(supportedRuntime('26.0.0')).toBe(true);
});
it('probes real storage without leaving temporary files or creating the ledger', () => {
  const f = fixture();
  try {
    const before = readdirSync(f.root);
    expect(stateCapability(f.root).status).toBe('PASS');
    expect(readdirSync(f.root)).toEqual(before);
  } finally {
    f.cleanup();
  }
});
it('does not turn configured credentials or missing external checks into verified authentication', async () => {
  const f = fixture();
  try {
    const report = await inspectEnvironment({ dataDirectory: f.root, socketProbe: false });
    expect(report.forgeAuthenticationVerified).toBe(false);
    expect(report.checks.find((c) => c.id === 'github-auth')?.status).toBe('NOT_RUN');
    expect(report.canStartLocal).toBe(
      report.checks.filter((c) => c.scope === 'local').every((c) => c.status === 'PASS'),
    );
  } finally {
    f.cleanup();
  }
});
