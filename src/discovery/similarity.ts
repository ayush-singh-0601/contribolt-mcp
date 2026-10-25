export interface SimilarityEvidence {
  textOverlap: number;
  fileOverlap: string[];
  symbolOverlap: string[];
  score: number;
  verdict: 'possible_overlap' | 'weak_similarity';
  explanation: string;
}
const stop = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'from',
  'when',
  'then',
  'have',
  'into',
  'issue',
  'fix',
  'bug',
]);
export function terms(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z_][a-z_0-9]{2,}/g) ?? []).filter((w) => !stop.has(w)),
  );
}
export function fileReferences(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/(?:`|\s|^)((?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+)(?::\d+)?/g)].map(
        (m) => m[1]!,
      ),
    ),
  ];
}
export function similarity(
  issue: { title: string; body: string },
  pr: { title: string; body: string; files: string[] },
): SimilarityEvidence {
  const a = terms(issue.title + ' ' + issue.body),
    b = terms(pr.title + ' ' + pr.body),
    intersection = [...a].filter((t) => b.has(t));
  const textOverlap = intersection.length / Math.max(1, new Set([...a, ...b]).size),
    referenced = fileReferences(issue.body),
    fileOverlap = pr.files.filter((f) => referenced.includes(f));
  const symbols = [...issue.body.matchAll(/`([A-Za-z_][A-Za-z_0-9]*)`/g)].map((m) => m[1]!),
    symbolOverlap = [
      ...new Set(symbols.filter((s) => pr.body.includes(s) || pr.title.includes(s))),
    ];
  const score = Math.min(
    1,
    0.6 * textOverlap + 0.3 * (fileOverlap.length ? 1 : 0) + 0.1 * (symbolOverlap.length ? 1 : 0),
  );
  return {
    textOverlap,
    fileOverlap,
    symbolOverlap,
    score,
    verdict: score >= 0.25 || fileOverlap.length > 0 ? 'possible_overlap' : 'weak_similarity',
    explanation:
      'Lexical, file and symbol overlap is advisory evidence. A similar title is not proof of competing implementation.',
  };
}
