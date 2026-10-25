import { defineAdapter, command, text } from '../adapter.js';
export const go = defineAdapter({
  id: 'go',
  matches: (f) => f === 'go.mod' || f === 'go.work',
  tools: ['go'],
  requirements: (r) => [text(r, 'go.mod').match(/^go\s+(.+)$/m)?.[1] ?? 'Go toolchain'],
  bootstrap: (r) => [command(r, 'go', 'bootstrap', 'go', ['mod', 'download'], 'go.mod', false)],
  commands: (r) => [
    command(r, 'go', 'test', 'go', ['test', './...'], 'go.mod'),
    command(r, 'go', 'lint', 'go', ['vet', './...'], 'go.mod'),
    command(r, 'go', 'format_check', 'gofmt', ['-l', '.'], 'go.mod'),
    command(r, 'go', 'build', 'go', ['build', './...'], 'go.mod'),
  ],
});
