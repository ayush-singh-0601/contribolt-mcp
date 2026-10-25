import {
  command,
  scopedFiles,
  text,
  type LanguageAdapter,
  type RepositoryContext,
} from './adapter.js';
import type { CheckCommand } from '../core/models.js';
export function parseDocumentedCommand(
  line: string,
): { executable: string; args: string[] } | undefined {
  const input = line.trim().replace(/^\$ /, '');
  if (!input || /[;&|`<>$\n\r]/.test(input)) return;
  const tokens = input.match(/"[^"]*"|'[^']*'|[^\s"']+/g);
  if (!tokens || tokens.join(' ').replaceAll(' ', '') !== input.replaceAll(' ', '')) return;
  const values = tokens.map((t) => t.replace(/^(["'])(.*)\1$/, '$2'));
  if (!/^[\w./-]+$/.test(values[0]!)) return;
  return { executable: values[0]!, args: values.slice(1) };
}
export function documentedChecks(repo: RepositoryContext): CheckCommand[] {
  const checks: CheckCommand[] = [];
  for (const file of scopedFiles(repo).filter((f) => /^(?:README|CONTRIBUTING)[^/]*$/i.test(f))) {
    for (const block of text(repo, file).matchAll(
      /```(?:sh|shell|bash|console)?\s*\n([\s\S]*?)```/g,
    )) {
      for (const line of block[1]!.split('\n')) {
        const parsed = parseDocumentedCommand(line);
        if (!parsed) continue;
        const kind: CheckCommand['kind'] | undefined = /\b(test|pytest|rspec|phpunit|ctest)\b/.test(
          line,
        )
          ? 'test'
          : /\b(lint|clippy|ruff)\b/.test(line)
            ? 'lint'
            : /\bbuild\b/.test(line)
              ? 'build'
              : undefined;
        if (kind) checks.push(command(repo, 'generic', kind, parsed.executable, parsed.args, file));
      }
    }
  }
  return [...new Map(checks.map((c) => [c.id, c])).values()];
}
export const genericAdapter: LanguageAdapter = {
  id: 'generic',
  detect: () => ({ matched: true, confidence: 0.3, manifests: [] }),
  planEnvironment: () => ({
    tools: [],
    requirements: [
      'Use repository-documented commands; unavailable verification is reported explicitly',
    ],
    bootstrap: [],
  }),
  commands: documentedChecks,
  parseResults: (r) =>
    !r.available ? 'UNAVAILABLE' : r.cancelled ? 'SKIPPED' : r.exitCode === 0 ? 'PASS' : 'FAIL',
};
