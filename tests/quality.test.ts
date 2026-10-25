import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { gitFixture } from './helpers.js';
import { SessionSchema } from '../src/core/models.js';
import { inspectPatch } from '../src/contribution/quality.js';
import { randomUUID } from 'node:crypto';
it('blocks unrelated files and credentials while preserving a focused patch', async () => {
  const f = await gitFixture({ 'a.ts': 'export const value=1;\n' });
  try {
    writeFileSync(f.root + '/a.ts', 'export const value=2;\n');
    writeFileSync(f.root + '/.env', 'TOKEN=secret');
    const s = SessionSchema.parse({
      id: randomUUID(),
      preferences: {},
      state: 'VALIDATION',
      workspace: f.root,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      analysis: {
        expected: '2',
        actual: '1',
        rootCause: 'wrong value',
        strategy: 'correct value',
        files: ['a.ts'],
        evidenceUrls: ['a.ts'],
        reproduced: true,
        reproductionExplanation: 'fixture',
      },
    });
    const result = await inspectPatch(s);
    expect(result.blockers).toContain('Unplanned changed file: .env');
    expect(result.blockers).toContain('Sensitive or generated file: .env');
  } finally {
    f.cleanup();
  }
});
