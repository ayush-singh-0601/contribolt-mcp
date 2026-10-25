import { it, expect } from 'vitest';
import { ciCommandCandidates } from '../src/languages/ci.js';
import type { RepositoryIndex } from '../src/repository/indexing.js';
it('surfaces bounded CI command text for explicit host review without executing it', () => {
  const index = {
    content: {
      '.github/workflows/test.yml':
        'steps:\n  - run: npm test\n  - run: |\n      python3 test.py\n      make check\n  - uses: actions/upload-artifact@v4\n',
      'source.ts': 'run: dangerous()',
    },
  } as unknown as RepositoryIndex;
  expect(ciCommandCandidates(index).map((c) => [c.line, c.text, c.requiresHostReview])).toEqual([
    [2, 'npm test', true],
    [4, 'python3 test.py', true],
    [5, 'make check', true],
  ]);
});
