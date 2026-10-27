# ContriBolt 0.1.1 presentation and distribution

Version 0.1.1 brings a cohesive visual identity and clearer onboarding to the existing contribution workflow. The public package remains `contribolt-mcp`, the executable is `contribolt`, and the supported engine remains `^22.13.0 || >=24.0.0`.

## Included in this release

| Area | Files and behavior |
| --- | --- |
| Main presentation | [README](../README.md), [documentation index](README.md), [getting started](getting-started.md), [demo](demo.md), [feature status](feature-status.md) |
| Visual identity | [Logo](assets/logo.svg), [mark](assets/mark.svg), [social preview](assets/social-preview.png), [workflow](assets/workflow.svg), [recorded fixture demo](assets/demo.svg) |
| Client setup | Generated [Codex](snippets/codex.toml), [Claude Code](snippets/claude.json) and [Cursor](snippets/cursor.json) configuration examples, with the same release pin as the CLI |
| Community | [Contributing](../CONTRIBUTING.md), [security reporting](../SECURITY.md), [community standards](../CODE_OF_CONDUCT.md), issue forms and PR template |
| Distribution | Searchable npm metadata, bundled version-pinned images, matching CLI/MCP/HTTP version identification, and public presentation verification |

The dashboard uses the same branch-and-bolt mark. Contribution schemas, dry-run behavior, approval requirements and runtime dependencies are preserved.

## Reproducible validation

```sh
npm ci
npm run check
python3 -m unittest discover -s scripts -p test_registry_install.py
python3 scripts/smoke-stdio.py --require-sdk
python3 scripts/smoke-stdio.py --require-sdk --modern
npm pack --dry-run --ignore-scripts
```

`npm run check` includes formatting, documentation validation, server/dashboard type checks, unit/integration tests and both builds. Documentation checks validate local targets and anchors, SVG safety/accessibility, recorded demo hashes, package identity and the 1280 × 640 social image. Client configuration tests check merging and idempotence.

The [qualification workflow](https://github.com/ayush-singh-0601/contribolt-mcp/actions/workflows/ci.yml) covers Node 22 and 24 across Linux, macOS and Windows, along with SDK, client, browser, container and selected native-adapter checks. The [release workflow](https://github.com/ayush-singh-0601/contribolt-mcp/actions/workflows/npm-release.yml) requires passing qualification on its exact source commit, audits the archive, verifies fresh public installations on Node 22/24, and checks npm metadata and versioned image delivery.

The package includes compiled runtime/dashboard files, documentation, examples and community policies. Private state, credentials, source/tests, node_modules and maintainer scripts are excluded. Build/qualification artifacts stay in GitHub Actions rather than becoming public runtime files.

## Evidence and scope

The [demo evidence](assets/demo-evidence.json) and [transcript](assets/demo-transcript.txt) record real native Python checks against a temporary repository and controlled forge responses. They show a failing baseline, a passing fix and a zero-write PR preview, not a live issue or public contribution.

Published compatibility claims retain their [documented boundaries](feature-status.md#qualification-boundaries). Host coding agents implement changes; ContriBolt provides workflow tools, evidence and approval gates. The host supplies the execution sandbox.

## Maintainer resources

[Branding and regeneration](branding.md) · [Launch copy and release maintenance](launch-kit.md) · [Distribution](distribution.md) · [Security reporting](../SECURITY.md)
