# Distribution qualification

Node.js 24 or newer is required, including its built-in SQLite support. Dependencies are exact versions in package-lock.json. `npm ci && npm run check && npm pack` builds the server, builds the React dashboard, copies static assets into dist/dashboard, and creates the npm tarball. The executable starts with a Node shebang. No native npm build step is required for SQLite.

Inspect the tarball before release. Only built files, prompts, documentation, examples, the license and README are included. State directories, tokens, source checkout internals, node_modules and test outputs must not ship. Install the resulting tarball into a clean temporary directory and run `mergepilot --version`, `mergepilot --help`, and `scripts/smoke-stdio.py /path/to/installed/dist/cli.js`. The STDIO check validates actual JSON-RPC replies, all 21 tools and all six prompts; an empty child-process output fails the check.

The private repository is [ayush-singh-0601/mergepilot-mcp](https://github.com/ayush-singh-0601/mergepilot-mcp). Observed CI checks and clean archive installations pass on Linux, Windows and macOS using Node 24. All three OS jobs upload tarballs. The official SDK is a normal pinned dependency; its dedicated job forbids compatibility fallback and exercises legacy initialization and the current protocol. See [the machine evidence](evidence/ci-validation.json) and [release report](release-report.md) for exact scope. Browser and container startup checks also pass.

Use `npm run format:check` and `npm run typecheck` for formatting and static checks. Native commands use argument arrays rather than shell concatenation, scoped working directories, and platform-specific shell invocation only for documented generic commands. Dedicated adapters report missing runtime capabilities rather than interpreting missing output as a passing check.

The original implementation consists of 77 commits in the private repository. npm release preparation follows that implementation history. The repository remains private when publishing the public npm package; package visibility and GitHub visibility are independent.

## npm release

The manually dispatched `npm release` workflow in `.github/workflows/npm-release.yml` builds from a clean checkout, checks package-name/version availability, runs tests and the dependency audit, audits and installs the exact tarball, and exercises the modern SDK protocol. With `publish: false`, it only uploads the validated candidate and its manifest. A failed network lookup never counts as an available package name.

To publish, add a short-lived npm granular publishing token capable of creating this package as the repository's `NPM_TOKEN` Actions secret, with bypass 2FA enabled. Do not commit it or paste it into an issue or chat. Dispatch the workflow with `publish: true` and your expected npm username. It verifies the authenticated account and requires the complete `verify` CI workflow to have passed on that exact source commit, then publishes the already-audited tarball with lifecycle scripts disabled. A previously published version is never overwritten.

After publishing, the workflow compares the registry's SHA-512 integrity value with the candidate archive, installs `mergepilot-mcp@0.1.0` from the public npm registry into an empty directory, and checks version and both real MCP protocol paths. Publication is only reported successful after these checks pass. The source repository's privacy prevents npm provenance generation, so this workflow explicitly disables provenance; it does not change repository visibility. See [npm publishing authentication](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/) and [npm's private-repository provenance limitation](https://docs.npmjs.com/trusted-publishers/).

Users install with `npm install --global mergepilot-mcp@0.1.0` or configure a client using `npx --yes mergepilot-mcp@0.1.0 configure codex --project /path/to/project`. Both need Node 24 or newer. No npm publication has occurred until the publishing workflow completes successfully.
