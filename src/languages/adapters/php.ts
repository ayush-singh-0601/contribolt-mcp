import { defineAdapter, command, text, has } from '../adapter.js';
export const php = defineAdapter({
  id: 'php',
  matches: (f) => f === 'composer.json',
  tools: ['php', 'composer'],
  requirements: (r) => [
    String(JSON.parse(text(r, 'composer.json')).require?.php ?? 'Project-supported PHP version'),
  ],
  bootstrap: (r) => [
    command(
      r,
      'php',
      'bootstrap',
      'composer',
      ['install', '--no-interaction'],
      'composer.json',
      false,
    ),
  ],
  commands: (r) => {
    const p = JSON.parse(text(r, 'composer.json')),
      scripts = p.scripts ?? {},
      deps = { ...p.require, ...p['require-dev'] };
    const checks = [
      typeof scripts.test === 'string' || Array.isArray(scripts.test)
        ? command(r, 'php', 'test', 'composer', ['run', 'test'], 'composer.json')
        : command(
            r,
            'php',
            'test',
            'php',
            [
              deps['pestphp/pest'] || has(r, 'tests/Pest.php')
                ? 'vendor/bin/pest'
                : 'vendor/bin/phpunit',
            ],
            'composer.json',
          ),
    ];
    for (const kind of ['lint', 'build'] as const)
      if (scripts[kind])
        checks.push(command(r, 'php', kind, 'composer', ['run', kind], 'composer.json'));
    return checks;
  },
});
