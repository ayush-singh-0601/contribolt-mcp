// Inspect and install this trusted user code outside contribution repositories.
export default {
  id: 'example-project-command',
  detect: (repo) => ({
    matched: repo.files.includes('project-checks.json'),
    confidence: 1,
    manifests: ['project-checks.json'],
  }),
  planEnvironment: () => ({
    tools: ['make'],
    requirements: ['Project-maintained Makefile and approved sandbox'],
    bootstrap: [],
  }),
  commands: (repo) => [
    {
      id: 'example:test',
      name: 'Project native checks',
      kind: 'test',
      executable: 'make',
      args: ['test'],
      cwd: repo.root,
      required: true,
      network: false,
      timeoutMs: 600000,
      source: 'User-reviewed adapter configuration',
    },
  ],
  parseResults: (result) =>
    !result.available
      ? 'UNAVAILABLE'
      : result.cancelled
        ? 'SKIPPED'
        : result.exitCode === 0
          ? 'PASS'
          : 'FAIL',
};
