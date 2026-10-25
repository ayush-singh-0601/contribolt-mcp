import { it, expect } from 'vitest';
import { runProcess } from '../src/execution/runner.js';
import { CommandSchema } from '../src/core/models.js';
it('captures real output and reports missing executables honestly', async () => {
  const command = CommandSchema.parse({
    id: 'test',
    name: 'test',
    kind: 'test',
    executable: 'git',
    args: ['--version'],
    cwd: process.cwd(),
    source: 'test fixture',
  });
  const result = await runProcess(command);
  expect(result.exitCode).toBe(0);
  expect(result.output).toMatch(/^git version /);
  expect(
    (await runProcess({ ...command, executable: 'mergepilot-missing-compiler' })).unavailable,
  ).toBe(true);
});
