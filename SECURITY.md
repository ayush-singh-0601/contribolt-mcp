# Security policy

ContriBolt executes locally with the permissions of its host process. Untrusted repository scripts need an independently enforced host sandbox. The command wrapper and approval ledger are workflow controls, not an OS isolation boundary. Read [the trust-boundary documentation](docs/security.md) before running untrusted project commands.

## Report a vulnerability privately

Sign in to GitHub and use [private vulnerability reporting](https://github.com/ayush-singh-0601/contribolt-mcp/security/advisories/new), also available through the repository's **Security → Report a vulnerability** page. Include the affected version, reproduction steps, impact and relevant redacted evidence. Keep exploit details and account data in that private report.

Do not open a public issue containing credentials, private repository data, exploit details or session journals. For ordinary setup problems, use the bug-report form with a minimal, redacted reproduction.

There is no fixed response SLA, bug bounty or independently audited security certification. The package is a development release; older versions do not have a guaranteed support window.

## If credentials or state may be exposed

Stop affected sessions, revoke the relevant forge/dashboard credentials, preserve necessary evidence privately, and recreate workspaces from trusted sources. Do not upload `.contribolt`, tokens, private patches, or raw account logs to a public issue.

Exact public-action approval does not protect against a fully privileged local process deliberately rewriting the ledger or application. Keep approval commands and private records outside untrusted scripts' access.
