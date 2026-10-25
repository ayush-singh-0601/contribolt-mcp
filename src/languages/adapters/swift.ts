import { defineAdapter, command, text, scopedFiles } from '../adapter.js';
export const swift = defineAdapter({
  id: 'swift',
  matches: (f) => f === 'Package.swift' || f.endsWith('.xcodeproj'),
  tools: ['swift'],
  requirements: (r) => [
    text(r, 'Package.swift').match(/swift-tools-version:\s*([^\n]+)/)?.[1] ?? 'Swift toolchain',
    ...(scopedFiles(r).some((f) => f.includes('.xcodeproj/'))
      ? ['Xcode checks require a supported macOS host and explicit project commands']
      : []),
  ],
  commands: (r) => [
    command(r, 'swift', 'test', 'swift', ['test'], 'Package.swift'),
    command(r, 'swift', 'build', 'swift', ['build'], 'Package.swift'),
  ],
});
