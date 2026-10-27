# ContriBolt launch kit

Reusable release copy, positioning and maintainer publication instructions for ContriBolt.

## Audience and terminology

The primary audience is developers who already use an MCP coding agent and want a small, appropriate contribution without starting from a repository URL. The useful use cases are checking an issue before investing in a fix, carrying unfamiliar repository rules into the work, and resuming a contribution with its evidence intact. “MCP server” describes the integration; “coding agent” is the host that reasons and edits; “pull request automation” describes the approved publication steps, not unattended outreach or guaranteed merges.

## GitHub About

**Description**

> MCP server that helps your coding agent find eligible open-source issues, make focused fixes, and prepare PRs with explicit approval.

**Homepage**

`https://www.npmjs.com/package/contribolt-mcp`

**Recommended topics**

`mcp`, `mcp-server`, `model-context-protocol`, `open-source`, `github-issues`, `pull-requests`, `coding-agent`, `codex-cli`, `claude-code`, `developer-tools`, `typescript`

These describe the implementation and qualified connection paths. Cursor belongs in the client compatibility table with its configuration-only qualification, rather than an unqualified compatibility badge. No popularity or performance claim is implied.

## npm listing

**Name:** `contribolt-mcp` — unchanged.

**Description:** MCP server for finding eligible GitHub issues, guiding focused fixes, and preparing pull requests with explicit approval.

**Sidebar metadata:** MIT license, supported Node range `^22.13.0 || >=24.0.0`, repository URL, homepage ending `#readme`, issue tracker, and the `contribolt` executable. Keywords are natural terms for the MCP, issue-discovery and coding-agent workflow. The package does not expose a supported library import API; no `main`/`exports` contract has been invented.

The npm README includes the logo, headline, public version/Node/license badges, one-command setup, controlled demo, workflow diagram, client support scope and security gates. npm supplies the page styling. The PNG/SVG assets are package files, not a custom npm website.

Metadata fields follow [npm's package.json reference](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/). No stars, downloads, dependent counts, testimonials, response times, or compatibility badges are fabricated.

Version 0.1.1 includes this presentation. npm versions are immutable. For subsequent releases, update package/lockfile, CLI `VERSION`, generated client pins, versioned image URLs, workflow archive names and installation examples together, then qualify the exact candidate. Previously published archives remain unchanged.

## Three-sentence pitch

ContriBolt is an MCP server that helps your existing coding agent turn an eligible open-source issue into a focused, reviewable pull request. It checks issue and contribution-policy evidence, carries repository context into implementation, and records native validation results. Dry runs are the default, and public actions need explicit approval of the exact change.

## Community announcement

> ContriBolt is an MCP contribution assistant for existing coding agents. It helps find eligible GitHub issues, inspect repository rules, guide a focused fix, and prepare a PR with recorded test evidence. It defaults to a dry run; submission needs your exact approval. Codex CLI tool calls and Claude Code connection health have been qualified, while Cursor has generated configuration and contract tests. I’d especially value setup feedback and small reproducible examples of where discovery or verification gets stuck. Package: https://www.npmjs.com/package/contribolt-mcp

Check the current release links before reusing this announcement. Share once in communities where the topic is relevant and allowed. Do not imply a full live client workflow, a merge, or a maintainer endorsement that has not happened.

## 30-second demo storyboard

| Time | Show | Say / label |
| --- | --- | --- |
| 0–5s | Logo and actual configuration preview | “Give your coding agent a contribution workflow.” |
| 5–10s | Initial request and preference answers | “Python, a small fix, dry run.” |
| 10–15s | Clearly labelled fixture eligibility and policy evidence | “Check ownership, discussion, competing work and project rules first.” |
| 15–22s | The one-line increment diff and recorded FAIL → PASS output | “Make a focused change; keep the regression evidence.” |
| 22–27s | PR dry-run preview | “Inspect the proposed PR before any public write.” |
| 27–30s | Setup command and package URL | “Try ContriBolt with your existing coding client.” |

Use the [real capture instructions](demo.md#capture-a-real-demonstration). If a full model-driven session is not recorded, label the story “illustrative workflow with controlled fixture data” throughout. Do not fabricate typing, a successful live PR, or a screenshot of an unavailable integration.

## Release maintenance

1. Review changes, select a new immutable version, and keep package, CLI, client pins and versioned image URLs synchronized.
2. Push a release branch and run [distribution qualification](distribution.md). Inspect the archive before publishing and require passing CI on the same source commit.
3. Verify fresh public installs and both MCP protocol paths on Node 22 and 24, together with the npm README, metadata and versioned images.
4. Promote the qualified source to the default branch and publish release notes. Keep the repository About/topics and [social-preview image](assets/social-preview.png) aligned with the release.
5. Keep [private vulnerability reporting](https://github.com/ayush-singh-0601/contribolt-mcp/security/advisories/new) available and check public source/documentation links before sharing an announcement.

## Five concrete adoption experiments

1. Recruit five consenting developers for first-run sessions. Record time to configuration, the first blocker, and whether they reach a dry-run preview; publish only consented, anonymized findings.
2. Record one complete real contribution in a contributor-controlled repository, with maintainer permission and all normal approval gates. Link the issue, tests, disclosed limitations and resulting PR without promising a merge.
3. Maintain a small, dated set of opt-in project examples. Explain why each contribution was eligible and remove examples when project policy or issue ownership changes.
4. Close the qualification gap with a real Cursor session and a full model-driven workflow in each intended client. Publish exact client versions and the tested scope.
5. Turn repeated setup failures into small fixes or clearer diagnostics, and write short case studies about those changes. Track genuine repeat use through voluntary feedback rather than hidden telemetry or download inflation.
