# Distribution qualification

Node.js 24 or newer is required, including its built-in SQLite support. Dependencies are exact versions in package-lock.json. `npm ci && npm run check && npm pack` builds the server, builds the React dashboard, copies static assets into dist/dashboard, and creates the npm tarball. The executable starts with a Node shebang. No native npm build step is required for SQLite.

Inspect the tarball before release. Only built files, prompts, documentation, examples, the license and README are included. State directories, tokens, source checkout internals, node_modules and test outputs must not ship. Install the resulting tarball into a clean temporary directory and run `mergepilot --version`, `mergepilot --help`, and `scripts/smoke-stdio.py /path/to/installed/dist/cli.js`. The STDIO check validates actual JSON-RPC replies, all 21 tools and all six prompts; an empty child-process output fails the check.

The private repository is [ayush-singh-0601/mergepilot-mcp](https://github.com/ayush-singh-0601/mergepilot-mcp). Observed CI checks and clean archive installations pass on Linux, Windows and macOS using Node 24. All three OS jobs upload tarballs. The official SDK is a normal pinned dependency; its dedicated job forbids compatibility fallback and exercises legacy initialization and the current protocol. See [the machine evidence](evidence/ci-validation.json) and [release report](release-report.md) for exact scope. Browser and container startup checks also pass.

Use `npm run format:check` and `npm run typecheck` for formatting and static checks. Native commands use argument arrays rather than shell concatenation, scoped working directories, and platform-specific shell invocation only for documented generic commands. Dedicated adapters report missing runtime capabilities rather than interpreting missing output as a passing check.

This repository has not been published to npm or deployed. All 77 commits are pushed to the explicitly authorized private repository. Publication requires a separate release decision after reviewing the release report and outstanding live integration checks.
