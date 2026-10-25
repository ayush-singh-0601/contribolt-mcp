# Distribution qualification

Node.js 24 or newer is required, including its built-in SQLite support. Dependencies are exact versions in package-lock.json. `npm ci && npm run check && npm pack` builds the server, builds the React dashboard, copies static assets into dist/dashboard, and creates the npm tarball. The executable starts with a Node shebang. No native npm build step is required for SQLite.

Inspect the tarball before release. Only built files, prompts, documentation, examples, the license and README are included. State directories, tokens, source checkout internals, node_modules and test outputs must not ship. Install the resulting tarball into a clean temporary directory and run `mergepilot --version`, `mergepilot --help`, and `scripts/smoke-stdio.py /path/to/installed/dist/cli.js`. The STDIO check validates actual JSON-RPC replies, all 21 tools and all six prompts; an empty child-process output fails the check.

CI defines Node 24 checks on Linux, Windows and macOS and uploads tarballs for inspection. This configuration is not evidence that those remote jobs have run. Only the current Linux environment is locally qualified. The SDK job installs the pinned optional SDK and runs the same transport check; the local offline cache does not contain that SDK. Browser and hosting qualification are described in testing.md and hosting.md.

Use `npm run format:check` and `npm run typecheck` for formatting and static checks. Native commands use argument arrays rather than shell concatenation, scoped working directories, and platform-specific shell invocation only for documented generic commands. Dedicated adapters report missing runtime capabilities rather than interpreting missing output as a passing check.

This repository has not been published to npm, pushed to a public remote, or deployed. Publication requires a separate release decision after reviewing the release report and outstanding live integration checks.
