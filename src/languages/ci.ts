import type { RepositoryIndex } from '../repository/indexing.js';
export function ciCommandCandidates(
  index: RepositoryIndex,
): { source: string; line: number; text: string; requiresHostReview: true }[] {
  const result: { source: string; line: number; text: string; requiresHostReview: true }[] = [];
  for (const [source, text] of Object.entries(index.content).filter(([path]) =>
    /(?:^|\/)(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.ya?ml|\.circleci\/config\.ya?ml)$/.test(
      path,
    ),
  )) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && result.length < 100; i++) {
      const match = lines[i]!.match(/^(\s*)(?:-\s*)?(?:run|script):\s*(.*)$/);
      if (!match) continue;
      if (/^[|>][-+]?\s*$/.test(match[2]!)) {
        const indentation = match[1]!.length;
        for (let n = i + 1; n < lines.length; n++) {
          if (lines[n]!.trim() && lines[n]!.search(/\S/) <= indentation) break;
          if (lines[n]!.trim() && result.length < 100)
            result.push({
              source,
              line: n + 1,
              text: lines[n]!.trim().slice(0, 2000),
              requiresHostReview: true,
            });
        }
      } else if (match[2]!.trim())
        result.push({
          source,
          line: i + 1,
          text: match[2]!.trim().slice(0, 2000),
          requiresHostReview: true,
        });
    }
  }
  return result;
}
