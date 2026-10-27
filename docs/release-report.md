# ContriBolt MCP release checks

**ContriBolt — From open issue to pull request.**

Your AI-powered open-source contribution agent.

This product is branded ContriBolt throughout its CLI, MCP server identity, client configuration, environment variables, state paths, dashboard, deployment examples, GitHub repository and npm release metadata. The npm package is `contribolt-mcp`, the command is `contribolt`, and the GitHub source is [ayush-singh-0601/contribolt-mcp](https://github.com/ayush-singh-0601/contribolt-mcp).

## Rebrand validation

The rebrand uses local formatting, type checks, unit/integration tests, builds, STDIO checks and tarball audits. [Current local evidence](evidence/rebrand-local.json) records 118 passing tests, one sandbox socket skip, the cached toolchain and the compatibility transport check. **CI/CD is disabled at the user's request.** Historical CI evidence under `evidence/` predates the rename and is explicitly labelled; it does not certify a new CI run under this brand. Registry publication is a separate operation and must be verified before claiming the new npm package is available.

The 236-item [requirements audit](requirements-matrix.md) retains implementation scope and host responsibilities. The original source specification is preserved outside the project with SHA-256 `b6c0bdd2aca25827dac3cbe10a48e0e3a9467e13b5648fab81757bb2aa89b4b7`; the current PRD changes branding only. The package auditor verifies that adaptation when the original is available.

## Remaining user and service checks

Actual Cursor sessions, complete model-driven contributions, live public forge publication/permissions and alternative-forge instance capabilities remain user acceptance checks. Production TLS and deployment operations require the selected environment. Beta metrics are not inferred from fixtures.

The host must isolate untrusted repository scripts from credentials and private state. The execution wrapper records approved execution and output; it does not create an OS sandbox. See [security.md](security.md).
