import { defineAdapter, command, has, text, type RepositoryContext } from '../adapter.js';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
function manager(r: RepositoryContext): string {
  const p = has(r, 'package.json') ? JSON.parse(text(r, 'package.json')) : {};
  const configured = String(p.packageManager ?? '').split('@')[0];
  if (configured && ['npm', 'pnpm', 'yarn', 'bun'].includes(configured)) return configured;
  return has(r, 'pnpm-lock.yaml')
    ? 'pnpm'
    : has(r, 'yarn.lock')
      ? 'yarn'
      : has(r, 'bun.lock') || has(r, 'bun.lockb')
        ? 'bun'
        : 'npm';
}
export const javascript = defineAdapter({
  id: 'javascript',
  matches: (f) => ['package.json', 'deno.json', 'deno.jsonc'].includes(f),
  tools: ['node'],
  requirements: (r) =>
    [
      text(r, '.nvmrc'),
      has(r, 'package.json')
        ? String(JSON.parse(text(r, 'package.json')).engines?.node ?? '')
        : 'Deno runtime required',
    ].filter(Boolean),
  bootstrap: (r) =>
    has(r, 'package.json')
      ? [
          command(
            r,
            'javascript',
            'bootstrap',
            manager(r),
            manager(r) === 'npm' ? [has(r, 'package-lock.json') ? 'ci' : 'install'] : ['install'],
            'package.json',
            false,
          ),
        ]
      : [],
  commands: (r) => {
    if (!has(r, 'package.json')) {
      const file = has(r, 'deno.json') ? 'deno.json' : 'deno.jsonc';
      const raw = text(r, file);
      let tasks: Record<string, string> = {};
      try {
        const errors: ParseError[] = [];
        tasks = parseJsonc(raw, errors)?.tasks ?? {};
        if (errors.length) throw new Error('Invalid Deno configuration');
      } catch {
        throw new Error('Invalid Deno configuration');
      }
      return ['test', 'lint', 'format_check', 'typecheck', 'build'].flatMap((kind) => {
        const task = kind === 'format_check' ? 'fmt:check' : kind === 'typecheck' ? 'check' : kind;
        if (tasks[task])
          return [command(r, 'javascript', kind as 'test', 'deno', ['task', task], file)];
        if (kind === 'test') return [command(r, 'javascript', 'test', 'deno', ['test'], file)];
        return [];
      });
    }
    const scripts = JSON.parse(text(r, 'package.json')).scripts ?? {},
      pm = manager(r);
    return Object.entries({
      test: ['test'],
      lint: ['lint'],
      format_check: ['format:check', 'fmt:check'],
      typecheck: ['typecheck', 'type-check'],
      build: ['build'],
    }).flatMap(([kind, names]) => {
      const name = names.find((n) => typeof scripts[n] === 'string');
      return name
        ? [command(r, 'javascript', kind as 'test', pm, ['run', name], 'package.json')]
        : [];
    });
  },
});
