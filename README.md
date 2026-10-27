# ContriBolt MCP

**ContriBolt — From open issue to pull request.**

Your AI-powered open-source contribution agent.

ContriBolt is a local TypeScript MCP server for Codex CLI, Claude Code, Cursor, and compatible clients. Your existing agent reads and edits code. ContriBolt handles discovery, dated eligibility evidence, contribution policies, native check plans, exact publication approvals, and a resumable journal. It needs no separate model subscription or mandatory hosted backend.

Version 0.1.0 is a development release for user acceptance testing. Historical qualification covered the three supported operating systems, SDK, clients, language adapters, browser and containers. This rename is checked locally; CI/CD is disabled. The renamed npm archive is prepared for direct publication; verify registry availability before using the npm commands below. Read [the release report](docs/release-report.md) for the exact evidence and remaining live-service/user checks.

## Install and connect

Requirements: Node.js 22.13+ or 24+, npm, Git, a coding client, and GitHub authentication through `gh auth login` or a scoped environment token. Install only the toolchains your chosen repository needs.

```sh
npx --yes contribolt-mcp@0.1.0 configure codex --project /absolute/path/to/your/project
```

Use `claude` or `cursor` instead of `codex` for those clients. Restart/enable the server in your client, then say **“Find me an open-source contribution.”** The generated configuration pins the npm release and stores private session data in your project's ignored `.contribolt` directory. [Client setup](docs/clients.md) explains configuration merging, the pinned SDK, and transport compatibility.

For a permanent CLI installation, run `npm install --global contribolt-mcp@0.1.0`, then use `contribolt doctor --json` or `contribolt configure codex --project /absolute/path/to/your/project`. The public npm package does not require access to the private GitHub source repository. For a source checkout, run `npm ci && npm run build` and configure with `node dist/cli.js configure codex --local --project /absolute/path/to/your/project`.

The three preferences are languages/stacks, challenge level, and repository preference/domain. “Any” defaults work throughout; a missing third answer gets a displayed default. Saved preferences require `remember: true`. You do not need to find a repository or supply an issue URL. The host follows `nextAction`, automatically selects a sufficiently strong verified candidate, investigates the repository, and applies a focused fix.

## Workflow and approval

Strict mode requires an open public issue with zero discussion comments, no assignee, verified official authorship, no known linked/competing PR, compatible policies, and resolved reservation evidence. Search results alone never prove eligibility. Scores are transparent heuristics, never merge probabilities. Unknown evidence excludes the candidate. If no verified match exists, expand the search, try later, or explicitly authorize one selected filter relaxation. AI prohibitions remain hard stops.

The host inspects scoped project instructions, reproduces the issue, records expected/actual behavior and a minimal plan, edits only the isolated contribution workspace, and runs applicable checks through its approved execution environment. `PASS`, `FAIL`, `SKIPPED`, and `UNAVAILABLE` remain distinct. A current independent host critique and unchanged execution evidence are required before PR preparation.

`get_execution_plan` returns exact check IDs and wrapper invocations. Run them only with the host's sandbox/approval controls. The wrapper captures results; it does not create an OS sandbox. Dependency installation and network access need their own approval. [Security](docs/security.md) describes the trust boundary and what the host must isolate.

For a real publication, start the contribution with `dryRun: false`. The default is a dry run. Inspect the proposed diff, branch, actor, commit identity, PR text, limitations, and CLA/DCO requirements. `request_approval` creates an expiring request; confirm it yourself in an interactive terminal using the same data directory:

```sh
CONTRIBOLT_DATA_DIR=/absolute/path/to/project/.contribolt contribolt approve REQUEST_ID
```

Confirmation is scoped to that exact action. Eligibility, project policy, upstream revision, patch identity, and log integrity are refreshed before public writes. A changed issue or new competing work halts publication. The server pushes the approved branch to a fork, creates one PR, and never merges automatically. Reviewer requests and invited comments have separate approval and permission checks. Revisions require renewed coding approval, fresh validation, and a separate public update approval.

Use the session controls for `stop`, `skip`, `find_another`, `change_preferences`, or `forget_preferences`. `resume_session` returns the next safe action and requires renewed approval for unfinished public writes. A read reconciliation can recover a PR that was already opened before an interrupted response. [Operations and recovery](docs/operations.md) covers common blockers.

## Inspect and monitor

```sh
contribolt sessions
contribolt status SESSION_ID
contribolt watch SESSION_ID
```

Set `CONTRIBOLT_DATA_DIR` consistently when using these commands. Monitoring separates observed CI, maintainer reviews, comments, closed PRs, and merges. A prepared PR is never counted as opened; opened is never counted as merged. [Testing](docs/testing.md) describes verification layers and [the example fixtures](examples/README.md) show native dry runs with recorded failures and passes.

The optional [dashboard and self-hosted deployment](docs/hosting.md) provide authenticated read-only summaries and explicit metadata sync. [GitLab/Forgejo configuration](docs/forges.md), [organization acceptance manifests](docs/acceptance-policies.md), and [opt-in maintainer webhooks](docs/maintainer-app.md) extend the local workflow. Each has documented capability limits.

## Development

```sh
npm run check
python3 scripts/smoke-stdio.py
npm run test:browser
npm pack
```

[Architecture](docs/architecture.md), [language adapters](docs/language-adapters.md), [distribution qualification](docs/distribution.md), and [PRD traceability](docs/requirements-matrix.md) describe the implementation. Tests use controlled forge responses unless explicitly identified as live. No real public PR was opened during local development qualification.

MIT licensed. The complete product specification is preserved in [docs/PRD.md](docs/PRD.md).
