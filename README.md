<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/contribolt-mcp@0.1.1/docs/assets/logo.svg" width="420" alt="ContriBolt MCP — a branch-and-bolt mark">
</p>

<h1 align="center">From open issue to pull request.</h1>

<p align="center"><strong>Your AI-powered open-source contribution agent.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/contribolt-mcp"><img src="https://img.shields.io/npm/v/contribolt-mcp?style=flat-square&amp;color=237A57" alt="Published npm version"></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Node-22.13%2B%20%7C%2024%2B-237A57?style=flat-square" alt="Node.js 22.13+ in the 22.x line, or 24+"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-526876?style=flat-square" alt="MIT license"></a>
</p>

ContriBolt is an **MCP server for open-source contributions**. It finds eligible GitHub issues, checks contribution rules, and guides your existing coding agent through a focused fix, validation, and PR preparation. **Dry run by default. Public actions require your approval.**

Run this inside the project where you start your coding client:

```sh
npx --yes contribolt-mcp@0.1.1 configure codex --project .
```

<p align="center"><a href="#quick-start">Quick Start</a> · <a href="docs/README.md">Documentation</a> · <a href="docs/demo.md">Example walkthrough</a> · <a href="docs/feature-status.md">Verified capabilities</a></p>

## One minute to see it

Preview the server definition without credentials or configuration writes:

```sh
npx --yes contribolt-mcp@0.1.1 configure codex --print --project .
```

Then connect your client and ask:

> Find me an open-source contribution in Python. Start with a small fix and keep this a dry run.

The host follows ContriBolt's tools through discovery, repository analysis, edits, checks, and a PR preview. It asks about language, difficulty, and repository preference; “any” is supported.

<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/contribolt-mcp@0.1.1/docs/assets/demo.svg" width="720" alt="Controlled Python fixture: baseline fails, the focused fix passes two regression checks, and a PR dry-run preview is prepared with zero public writes.">
</p>

**Real recorded checks, controlled forge data.** This example uses a temporary repository and fixture API responses, not a live issue or a public PR. [Read the example, evidence, and capture instructions →](docs/demo.md)

## Why ContriBolt exists

Finding an issue is only the beginning. You still need to know whether someone owns it, whether the project accepts the contribution, what checks matter, and what you are about to publish.

ContriBolt carries that context through the contribution so your coding agent can work on a small, reviewable change.

- **Eligibility before effort.** Strict mode requires an open, unassigned issue with zero discussion comments, verified official authorship, and no known linked or competing PR. Incomplete evidence does not pass.
- **Repository rules travel with the work.** Scoped agent instructions, contribution guidance, templates, and AI policies inform the next step. Project AI prohibitions stop the workflow.
- **Checks have evidence.** Native command plans and captured results distinguish `PASS`, `FAIL`, `SKIPPED`, and `UNAVAILABLE`. Ranking scores are heuristics, not merge predictions.
- **You control publication.** Review the diff, identity, branch, PR text, and limitations before a separate, expiring terminal approval. No automatic merge.

## How it works

<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/contribolt-mcp@0.1.1/docs/assets/workflow.svg" width="500" alt="Discover an eligible issue; inspect policy and code; let the host agent implement a focused fix; run host-approved checks; inspect the PR preview; explicitly approve publication.">
</p>

| Stage | Who does the work |
| --- | --- |
| Discover and verify | ContriBolt reads forge evidence and records its decision. |
| Investigate and implement | Your coding agent reasons about the code and edits the isolated workspace. |
| Validate and prepare | The host runs approved commands; ContriBolt checks recorded evidence and prepares a proposal. |
| Publish and follow review | You approve the exact public action; ContriBolt rechecks eligibility and performs the approved write. |

## Quick Start

**Requirements:** Node.js **22.13+ in the 22.x line, or 24+**, npm, Git, and an MCP coding client. Live discovery needs GitHub authentication and network access; verification needs the target project's toolchains.

1. Authenticate with GitHub using `gh auth login`, or supply a scoped token through your host environment. [Credential setup](docs/getting-started.md#credentials).
2. Run the setup command for your client, inside its project:

   ```sh
   npx --yes contribolt-mcp@0.1.1 configure codex --project .
   ```

3. Restart or enable the `contribolt` server in that client. Review the generated configuration when the client asks.
4. Ask: **“Find me an open-source contribution. Keep this a dry run.”** Answer the three preferences and let the host follow the workflow.

The configuration uses the published package and pinned MCP SDK. Private session data goes in the project's ignored `.contribolt` directory. A dry run can still clone repositories, edit a local workspace, and run approved checks; it does not publish.

### Choose your installation

| Method | Command | What it gives you |
| --- | --- | --- |
| Try and configure | `npx --yes contribolt-mcp@0.1.1 configure codex --project .` | A project MCP configuration; no global install. |
| Global CLI | `npm install --global contribolt-mcp@0.1.1` | The `contribolt` command. Then run `contribolt configure codex --project .`. |
| Project dependency | `npm install contribolt-mcp@0.1.1` | A local executable, available with `npm exec -- contribolt --version`; it is not a JavaScript library API. |
| Source checkout | `npm ci` then `npm run build` | Development files and a local build. Configure with `node dist/cli.js configure codex --local --project /path/to/your/project`. |

Installing a package alone does not register an MCP server. Running `contribolt mcp` directly starts a STDIO server that waits for a client, not a chat interface.

### MCP clients

Replace `codex` in the setup command with the client below. The generator merges configuration and preserves unrelated server entries.

| Client | Argument | Configuration file | Verification scope |
| --- | --- | --- | --- |
| Codex CLI | `codex` | `.codex/config.toml` | Configuration tests and actual app-server tool calls. |
| Claude Code | `claude` | `.mcp.json` | Configuration tests and actual MCP connection health. |
| Cursor | `cursor` | `.cursor/mcp.json` | Configuration contract tests; interactive workflow is unverified. |

[Copy-ready configuration files and client details →](docs/clients.md)

## A complete example

This **illustrative walkthrough of the controlled Python fixture** shows the shape of a contribution. Names and issue metadata are test data; the failing and passing regression outputs are recorded executions.

```text
You       Find a small Python contribution. Keep it a dry run.
Discover  An open issue: increment returns the unchanged input.
Verify    Official author, no assignee, zero comments, no known PR.
Inspect   CONTRIBUTING.md, subject.py, test.py, and test.sh.
Plan      Add the missing increment; keep the existing focused tests.
Validate  Failing baseline → passing regression → diff critique.
Prepare   “Correct increment behavior” with recorded test results.
Result    PR dry-run preview. Zero public writes.
```

```diff
 def increment(value):
-    return value
+    return value + 1
```

Actual fixed output: `2 Python regression checks passed`. The [full walkthrough](docs/demo.md) explains selection, policy, test evidence, PR preparation, and the separate publication gate.

## Capabilities today

| Capability | Current scope |
| --- | --- |
| GitHub discovery | Repository search, issue inspection, author evidence, reservations, linked/competing work, and dated eligibility decisions. |
| Contribution preparation | Scoped repository analysis, reproduction records, focused plans, patch inspection, critique, PR templates, and required disclosures. |
| Validation | Twelve built-in language adapters, generic documented-command support, and captured native execution evidence. Toolchains must be available. |
| Developer control | Dry runs, stop/resume/skip, private SQLite sessions, and distinct approvals for public actions and revisions. |
| Follow-up | Permission-aware review requests, explicit comments, observed PR/CI state, and revision planning. |
| Optional services | Authenticated metadata dashboard, opt-in sync/webhooks, and GitLab/Forgejo adapters with instance-specific limits. |

There is no promise of an eligible match, an accepted contribution, or a merge. Recorded qualification covers the documented fixtures and client probes, rather than every model-driven workflow, alternative forge, or production deployment. [Implementation and qualification matrix →](docs/feature-status.md)

## Architecture

**Your coding client → local MCP server → forge APIs and a private session ledger.** The host agent edits an isolated contribution workspace and runs approved checks; ContriBolt records evidence and gates publication. The optional dashboard displays metadata and cannot authorize a contribution.

The server exposes **21 tools, six prompts, and session resources** through the official MCP SDK. It calls no separate model service; your existing host supplies the coding agent. [Architecture and workflow diagram →](docs/architecture.md)

## Security, permissions, and control

| Action | Effect and control |
| --- | --- |
| Search and verify | Reads remote evidence and writes local session records. |
| Analyze and edit | Creates a local clone; the host agent performs source edits. |
| Run project commands | Requires host execution approval and an appropriate host sandbox. |
| Open/update a PR or request review | Requires the corresponding exact, interactive human approval. |

Keep credentials in the host environment or `gh auth`, not in issues, config files, or the private session journal. Redaction is best effort. Repository text is untrusted input. **The execution wrapper records results; it is not an OS sandbox.**

For an intended real publication, start a new contribution with `dryRun: false`. A PR preview still requires review and a fresh approval request. In your own trusted terminal, using that session's data directory:

```sh
CONTRIBOLT_DATA_DIR=/absolute/path/to/project/.contribolt npx --yes contribolt-mcp@0.1.1 approve REQUEST_ID
```

Approvals expire and bind the exact action. A changed patch or stale eligibility can block publication. Review requests, comments, and revisions have separate gates. [Trust boundaries](docs/security.md) · [Security reporting](SECURITY.md)

## Troubleshooting and FAQ

**No issues matched.** Strict filters deliberately exclude unknown or conflicting evidence. Broaden preferences, try later, or explicitly approve one supported filter relaxation. An AI prohibition remains a stop.

**The command appears to wait forever.** With no subcommand, it is a STDIO MCP server. Try `npx --yes contribolt-mcp@0.1.1 --help`, or use `configure` and start it through your client.

**The client cannot connect.** Check Node version, enable/restart the server, and inspect the configuration with `configure codex --print --project .`. Run `npx --yes contribolt-mcp@0.1.1 doctor --json`; add `--live` to check GitHub authentication and registry reachability.

**Do I need another AI subscription?** ContriBolt does not call a second model service. Your coding client's own account, model access, and billing still apply.

**Can I run a different language or forge?** See [language adapters](docs/language-adapters.md) and [forge configuration](docs/forges.md). Support for a planner or API contract does not establish every toolchain or live instance.

[Setup and environment variables](docs/getting-started.md) · [Recovery and common blockers](docs/operations.md)

## Contribute

Useful first contributions include reproducing client setup problems, improving a focused regression test, clarifying an error message, or documenting a toolchain limitation. [CONTRIBUTING.md](CONTRIBUTING.md) covers development setup, verification, and PR expectations. Follow the [community standards](CODE_OF_CONDUCT.md).

## License and links

[MIT](LICENSE) · [npm package](https://www.npmjs.com/package/contribolt-mcp) · [Documentation](docs/README.md) · [Issue tracker](https://github.com/ayush-singh-0601/contribolt-mcp/issues) · [Examples](examples/README.md) · [Release evidence](docs/release-report.md)
