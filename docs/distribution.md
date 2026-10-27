# ContriBolt MCP distribution

**ContriBolt — From open issue to pull request.**

Your AI-powered open-source contribution agent.

The package name is `contribolt-mcp`, its executable is `contribolt`, and Node.js 22.13+ or 24+ is required. The source repository is [ayush-singh-0601/contribolt-mcp](https://github.com/ayush-singh-0601/contribolt-mcp) and remains private. Publishing the public npm package does not change GitHub repository visibility.

Node 22.0–22.12 is excluded because the built-in SQLite module needs an experimental launch flag there. See the [Node SQLite version history](https://nodejs.org/download/release/latest-v22.x/docs/api/sqlite.html).

## Local release

For a direct local release, build and audit locally:

```sh
npm ci
npm run build
npm pack --ignore-scripts
python3 scripts/audit-package.py contribolt-mcp-0.1.0.tgz > release-manifest.json
```

The archive contains compiled server/dashboard files and bundled documentation, with no private state, credentials or node_modules. `publishConfig` targets the public npm registry. Clean builds remove stale modules left by deleted source files.

From a terminal with npm network access, authenticate as the publishing account and publish the audited archive:

```sh
npm login
python3 scripts/publish-local.py
```

The local publisher checks the audited archive hash, requires the npm account `neaoooo`, publishes directly, verifies a fresh public-registry installation and both MCP protocol paths, and only then marks the previous npm package as renamed. It does not use CI/CD.

New npm packages can take a few minutes to finish registry processing. Verify the public version before announcing availability:

```sh
npm view contribolt-mcp@0.1.0 version dist.integrity
npx --yes contribolt-mcp@0.1.0 --version
```

The GitHub Actions definitions are manual-only and repository Actions are enabled. Run the `verify` workflow on the source commit, then dispatch `npm release` with `publish=true` and `npm_username=neaoooo`. The release requires all qualification jobs to pass, verifies public installation with the official SDK on both Node 24 and 22, and only then marks the previous npm package as renamed. The token is read from the repository's `NPM_TOKEN` secret. npm provenance is disabled because the GitHub repository is private; see [npm's provenance limitation](https://docs.npmjs.com/trusted-publishers/).

## Installation

After publication:

```sh
npm install --global contribolt-mcp@0.1.0
contribolt configure codex --project /path/to/project
```

Alternatively use `npx --yes contribolt-mcp@0.1.0 configure codex --project /path/to/project`. Choose `claude` or `cursor` for those clients. Disable the previous server entry in your coding client before enabling the new `contribolt` entry. Existing session data is not deleted by this rename; set `CONTRIBOLT_DATA_DIR` explicitly if you want to reuse an existing private state directory.
