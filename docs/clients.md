# Coding client setup

Build with Node 24 or newer: `npm ci && npm run build`. From the project in which your coding client runs, configure a local checkout:

```sh
node /absolute/path/to/mergepilot/dist/cli.js configure codex --local --project .
node /absolute/path/to/mergepilot/dist/cli.js configure claude --local --project .
node /absolute/path/to/mergepilot/dist/cli.js configure cursor --local --project .
```

Choose the command for your client. The installer merges project configuration, preserves unrelated servers and comments, and writes private files atomically. Codex uses `.codex/config.toml`, Claude Code `.mcp.json`, and Cursor `.cursor/mcp.json`. Review the changed file and enable the server in the host. An existing unmanaged conflicting Codex entry requires manual merging. `--print` shows a definition without writing it.

To use the npm release, run `npx --yes mergepilot-mcp@0.1.0 configure codex --project /absolute/path/to/your/project` (or choose `claude` / `cursor`). Without `--local`, the definition uses npx with exact package versions: `mergepilot-mcp@0.1.0` and `@modelcontextprotocol/server@2.4.0`. This requires registry access and does not require cloning the source repository. Keep `--local` for an unpublished source checkout. The SDK is a pinned runtime dependency. The bridge uses the SDK's [`serveStdio` factory](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html), registers all 21 tools, six prompts, and session resources.

Normal installations use the official SDK. An incomplete offline development installation can report a stderr warning and use the compatibility JSON-RPC transport (protocol 2025-06-18); run `npm ci` to repair it. CI tests the real SDK using both legacy initialization and protocol 2026-07-28, without allowing fallback. Separate CI checks exercise real Codex tool discovery/calls and Claude Code connection health. Cursor configuration has contract coverage; a real Cursor session and complete model-driven contribution remain user acceptance checks.

Metadata lives under the selected project's `.mergepilot` directory, with its own ignore file. Treat that directory as private. Keep credentials in the host environment or `gh auth`; avoid putting tokens in client configuration. Start with “Find me an open-source contribution”, answer the three preferences, and let the host follow the returned `nextAction`. The host edits source; MergePilot supplies evidence, commands, and gates.

The Codex definition forwards credential **variable names** through `env_vars`, including the standard GitHub variables and any validated `tokenEnv` names in `MERGEPILOT_FORGES`. Values stay in the host environment. Restart the client after changing credentials. Run `mergepilot doctor --json` to check runtime, private storage, Git, SQLite, the SDK and client executables; `--live` separately verifies GitHub authentication and registry access. An installed executable or configured token is not a passing client session or verified authentication.

For a model-free Codex transport check on a writable host, run `python3 scripts/smoke-codex.py`. This checks the real app-server, local onboarding, stopping/resuming and approval state without starting a model turn. The script fails if the host cannot initialize; it does not replace the full interactive checklist below.

`python3 scripts/smoke-claude.py` checks Claude Code's actual MCP connection using a disposable approved configuration. Both scripts avoid login changes, model turns and public actions. The CI versions are Codex 0.163.0 and Claude Code 2.1.284.

Execution must use the host's approval and sandbox facilities. Enable network only when a dependency bootstrap needs it. Publishing and revisions require separate exact previews and an interactive `mergepilot approve <request-id>` in the same data directory. Enabling an MCP server does not authorize public actions.

## Client qualification checklist

For each supported host: inspect all 21 tools and six prompts; complete onboarding with a defaulted third preference; discover repositories without supplying a URL; analyze a disposable repository; have the host apply and test a patch; interrupt and resume the session; confirm publication is denied without an exact human grant; and inspect the final preview. Use a disposable public fixture for an explicitly authorized live publication test. Never use an unsuspecting project's maintainers as test recipients.
