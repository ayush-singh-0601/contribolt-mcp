# Your first ContriBolt session

ContriBolt connects an existing MCP coding agent to a contribution workflow. You supply the coding client and its model access. It needs no second model API key.

## Before you start

- Node.js 22.13+ in the 22.x line, or 24+. Node 22.0–22.12 needs an SQLite launch flag and is excluded; 23.x is outside the supported range.
- npm, Git, and a supported coding client.
- GitHub credentials and network access for live discovery.
- The selected repository's toolchains for native checks. Installing ContriBolt does not install compilers or project dependencies.

## A quick preview

These commands use the published release and require npm access. Neither needs a GitHub token or changes client configuration:

```sh
npx --yes contribolt-mcp@0.1.1 --version
npx --yes contribolt-mcp@0.1.1 configure codex --print --project .
```

Expected version: `0.1.1`. The second command prints JSON describing `npx`, the pinned packages, and `CONTRIBOLT_DATA_DIR`. This is a configuration preview, not a live issue search.

## Connect a client

Inside the project where you start your client, choose one:

```sh
npx --yes contribolt-mcp@0.1.1 configure codex --project .
npx --yes contribolt-mcp@0.1.1 configure claude --project .
npx --yes contribolt-mcp@0.1.1 configure cursor --project .
```

Run only the command for your client. Review its generated project file, enable the `contribolt` server, and restart the client when necessary. The installer resolves the project to an absolute state path. The `--print` preview can show a relative state path when given a relative project; use an absolute project path if copying that preview manually.

The `.contribolt` directory has its own ignore file and stores private records. Configuring a client does not authorize publication. See [client support and complete generated examples](clients.md).

## Credentials

The simplest setup is an existing GitHub CLI login:

```sh
gh auth login
```

Alternatively set `CONTRIBOLT_GITHUB_TOKEN` in your host environment using a scoped token. Resolution order is `CONTRIBOLT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`, an explicitly configured GitHub App, then `gh auth token`. A configured token is not proof of permissions; the live diagnostic verifies identity.

Start with the access needed to read the repositories and evidence you intend to inspect. Private membership/project evidence can require additional visibility. Fork, push, PR creation, and review requests need the corresponding forge permissions when you choose those actions. No single token permission set is guaranteed to suit every repository or organization. [GitHub's token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) explains repository selection and permissions.

Do not paste token values into prompts or commit them in MCP configuration. Codex configuration forwards credential variable names with `env_vars`; Claude Code and Cursor must launch with the intended server environment. Restart the host after changing environment variables.

## Start a contribution

Ask your coding agent:

> Find me an open-source contribution in Python. Start small, choose an active project, and keep this a dry run.

The host uses `start_contribution`, captures preferences, and follows `nextAction`. ContriBolt discovers candidates and verifies issue, authorship, competing-work, reservation, and policy evidence. If no verified issue exists, that is a valid result. It does not silently weaken strict mode.

Your agent inspects the isolated workspace, records reproduction and a focused plan, edits source, and executes approved checks. ContriBolt checks evidence and prepares a PR preview. Dry run means no public contribution writes; local cloning, edits, and approved command execution still occur.

To intend a real submission, start a new contribution with `dryRun: false`. After reviewing the exact proposal, use the generated approval command in your own trusted terminal and the same data directory. [Publication and trust boundaries](security.md).

## Diagnose the setup

```sh
npx --yes contribolt-mcp@0.1.1 doctor --json
npx --yes contribolt-mcp@0.1.1 doctor --live --json
```

The first probes runtime, storage, Git, SQLite, SDK and available client executables. The second also contacts GitHub and npm. `UNAVAILABLE` is not a passing check. Node 22 may print an SQLite experimental warning to stderr; it is distinct from an actual failed diagnostic.

If running `npx` with no subcommand seems to hang, the MCP server is waiting for JSON-RPC on STDIO. Use `--help` for CLI help or connect it through the coding client.

## Environment reference

| Variable | Purpose | Required? |
| --- | --- | --- |
| `CONTRIBOLT_DATA_DIR` | Private local ledger and artifacts. Generated configs use the project's `.contribolt`. Standalone CLI default is `~/.local/share/contribolt`. | Optional; keep it consistent across session commands. |
| `CONTRIBOLT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN` | Forge credentials, resolved in the order above. | One credential method is needed for live GitHub work. |
| `CONTRIBOLT_APP_ID`, `CONTRIBOLT_APP_KEY`, `CONTRIBOLT_INSTALLATION_ID` | Explicit GitHub App credentials; the key value is PEM text. | Only for App authentication. |
| `CONTRIBOLT_FORGES` | JSON array of explicitly enabled GitLab/Forgejo hosts and token variable names. | Only for [alternative forges](forges.md). |
| `CONTRIBOLT_REQUIRE_SDK` | Set to `1` to reject the offline compatibility fallback. | Qualification or strict transport checks. |
| `CONTRIBOLT_DASHBOARD_URL`, `CONTRIBOLT_DASHBOARD_TOKEN` | Explicit opt-in metadata synchronization. | Only for [hosted metadata](hosting.md). |
| `CONTRIBOLT_WEBHOOK_SECRET` | Verifies configured maintainer webhook requests. | Only for the [maintainer app](maintainer-app.md). |

Set environment variables using your shell's normal mechanism; do not put secrets into copied JSON examples. Network access and dependency installation remain subject to the host's own approval policy.
