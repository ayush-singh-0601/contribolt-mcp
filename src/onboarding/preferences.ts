import { PreferencesSchema, type Preferences } from '../core/models.js';
const aliases: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  js: 'JavaScript',
  javascript: 'JavaScript',
  py: 'Python',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  golang: 'Go',
  java: 'Java',
  kotlin: 'Kotlin',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  dart: 'Dart',
  flutter: 'Flutter',
  'c++': 'C++',
  'c#': 'C#',
  'f#': 'F#',
  react: 'React',
};
export function normalizePreferences(input: Record<string, unknown>): Preferences {
  const raw = input.languages ?? [];
  const languages = typeof raw === 'string' ? raw.split(/[,;/]/) : raw;
  if (!Array.isArray(languages) || !languages.every((x) => typeof x === 'string'))
    throw new Error('Languages must be a string or string array');
  const normalized = [
    ...new Set(
      languages
        .map((x) => x.trim())
        .filter((x) => x && !/^(any|anything|decide for me)$/i.test(x))
        .map((x) => aliases[x.toLowerCase()] ?? x),
    ),
  ];
  const difficultyAliases: Record<string, string> = {
    beginner: 'small',
    'beginner/small': 'small',
    'decide for me': 'auto',
    any: 'auto',
  };
  const repoAliases: Record<string, string> = {
    'well-known projects': 'popular',
    'smaller active projects': 'small_active',
    'highest realistic merge potential': 'merge_likelihood',
    'decide for me': 'any',
  };
  const difficulty = String(input.difficulty ?? 'auto').toLowerCase();
  const repositoryPreference = String(input.repositoryPreference ?? 'any').toLowerCase();
  return PreferencesSchema.parse({
    ...input,
    languages: normalized,
    difficulty: difficultyAliases[difficulty] ?? difficulty,
    repositoryPreference: repoAliases[repositoryPreference] ?? repositoryPreference,
  });
}
export function searchLanguages(preferences: Preferences): string[] {
  return [
    ...new Set(
      preferences.languages.map(
        (x) =>
          ({ React: 'TypeScript', Flutter: 'Dart', Vue: 'TypeScript', Angular: 'TypeScript' })[x] ??
          x,
      ),
    ),
  ];
}
