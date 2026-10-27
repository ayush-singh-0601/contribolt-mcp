# Contributing to ContriBolt

Small, well-explained improvements are useful: reproduce a setup failure, clarify a confusing command, add a regression case, or improve one adapter using a minimal native fixture. For a larger behavior change, discuss the problem in an issue before investing in an implementation.

## Development setup

Use Node.js 22.13+ in the 22.x line, or 24+, npm, Git and Python 3 for documentation/fixture checks. Native fixture tests also use locally available language tools.

```sh
git clone https://github.com/ayush-singh-0601/contribolt-mcp.git
cd contribolt-mcp
npm ci
npm run build
node dist/cli.js --help
```

Keep credentials outside the repository. The private `.contribolt` directory, `.env`, SQLite files and generated release archives are ignored.

## Before opening a PR

```sh
npm run check
python3 -m unittest discover -s scripts -p test_registry_install.py
python3 scripts/smoke-stdio.py
npm run docs:check
npm pack --dry-run --ignore-scripts
```

`check` runs formatting, server/dashboard type checks, unit/integration tests, and builds. Use `npm run format` to fix formatting. `smoke-stdio.py` reports the actual transport; with a complete installation, add `--require-sdk` and then `--require-sdk --modern` to verify the official SDK explicitly.

If changing the dashboard, run `npm run test:browser` after installing the official Playwright browser with `npx playwright install chromium` on a host that permits browser execution. If changing an adapter, run its relevant native fixture following [language adapters](docs/language-adapters.md). A missing tool or denied socket/browser must be reported as unavailable/skipped, not as a pass. [Testing layers](docs/testing.md).

## What makes a useful contribution

- Explain a concrete problem and the resulting behavior.
- Keep the diff focused and preserve existing MCP schemas, executable names, state contracts and supported Node range unless the behavior change is discussed.
- Add a regression test when behavior changes. Documentation-only changes need relevant link, example and package checks, not duplicate implementation tests.
- Record commands actually run, and distinguish controlled forge responses from live service checks.
- Preserve contribution-policy checks, dry-run defaults, exact approval gates, and the host sandbox boundary.

AI-assisted contributions are welcome. Describe the assistance in your PR, review the change yourself, verify its behavior, and take responsibility for the result. Respect the policy of any upstream repository used in an example. Use synthetic or contributor-controlled data for public-write tests; unrelated maintainers' repositories are not release fixtures.

## Reporting and collaboration

Use the bug/feature forms for ordinary issues. Remove credentials and private journal contents from reports. Handle suspected vulnerabilities through [SECURITY.md](SECURITY.md), and follow the [community standards](CODE_OF_CONDUCT.md). Avoid posting private incident details in public discussions.

By submitting a contribution, you agree that it can be distributed under the project's existing [MIT license](LICENSE). Acceptance and merging remain maintainer decisions.
