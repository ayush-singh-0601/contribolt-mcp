# Coding client setup

Build with Node 24 or newer: `npm ci && npm run build`. From the project in which your coding client runs, configure a local checkout:

```sh
node /absolute/path/to/mergepilot/dist/cli.js configure codex --local --project .
node /absolute/path/to/mergepilot/dist/cli.js configure claude --local --project .
node /absolute/path/to/mergepilot/dist/cli.js configure cursor --local --project .
```

Choose the command for your client. The installer merges project configuration, preserves unrelated servers and comments, and writes private files atomically. Codex uses `.codex/config.toml`, Claude Code `.mcp.json`, and Cursor `.cursor/mcp.json`. Review the changed file and enable the server in the host. An existing unmanaged conflicting Codex entry requires manual merging. `--print` shows a definition without writing it.

Without `--local`, the definition uses npx with exact package versions: `mergepilot-mcp@0.1.0` and `@modelcontextprotocol/server@2.4.0`. That form requires a published MergePilot package and registry access; this checkout has not been published. Keep using `--local` before publication. Install the SDK alongside the checkout with `npm install --no-save --package-lock=false @modelcontextprotocol/server@2.4.0` when registry access is available. The bridge uses the SDK's [`serveStdio` factory](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html), registers all tools, six prompts, and session resources.

If the optional SDK is absent, local operation reports a stderr warning and uses the tested legacy JSON-RPC STDIO transport (protocol 2025-06-18). Actual SDK interoperability and interactive Codex, Claude Code, and Cursor sessions still require external qualification. The unit contract test does not substitute for that check.

Metadata lives under the selected project's `.mergepilot` directory, with its own ignore file. Treat that directory as private. Keep credentials in the host environment or `gh auth`; avoid putting tokens in client configuration. Start with “Find me an open-source contribution”, answer the three preferences, and let the host follow the returned `nextAction`. The host edits source; MergePilot supplies evidence, commands, and gates.

Execution must use the host's approval and sandbox facilities. Enable network only when a dependency bootstrap needs it. Publishing and revisions require separate exact previews and an interactive `mergepilot approve <request-id>` in the same data directory. Enabling an MCP server does not authorize public actions.

## Client qualification checklist

For each supported host: inspect all 21 tools and six prompts; complete onboarding with a defaulted third preference; discover repositories without supplying a URL; analyze a disposable repository; have the host apply and test a patch; interrupt and resume the session; confirm publication is denied without an exact human grant; and inspect the final preview. Use a disposable public fixture for an explicitly authorized live publication test. Never use an unsuspecting project's maintainers as test recipients.
