import { defineAdapter, command, scopedFiles, text } from '../adapter.js';
export const dotnet = defineAdapter({
  id: 'dotnet',
  matches: (f) => /\.(sln|csproj|fsproj)$/.test(f),
  tools: ['dotnet'],
  requirements: (r) => [text(r, 'global.json') || 'Project-supported .NET SDK'],
  bootstrap: (r) => [
    command(r, 'dotnet', 'bootstrap', 'dotnet', ['restore'], 'global.json', false),
  ],
  commands: (r) => {
    const roots = scopedFiles(r).filter((f) => !f.includes('/') && /\.sln$/.test(f));
    if (roots.length > 1) throw new Error('Multiple solutions require explicit subproject scope');
    const target = roots[0];
    return [
      command(
        r,
        'dotnet',
        'test',
        'dotnet',
        ['test', ...(target ? [target] : []), '--no-restore'],
        target ?? 'project',
      ),
      command(
        r,
        'dotnet',
        'build',
        'dotnet',
        ['build', ...(target ? [target] : []), '--no-restore'],
        target ?? 'project',
      ),
    ];
  },
});
