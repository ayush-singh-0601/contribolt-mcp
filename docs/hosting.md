# Optional hosting and synchronization

The local MCP server works independently of the dashboard. The hosted interface serves redacted metadata and read-only MCP tools; coding, execution evidence and public-action approvals remain local.

## Local dashboard

With Node.js 24 and dependencies installed:

```sh
npm run build
node dist/cli.js issue-token local read,sync
node dist/cli.js serve
```

Open `http://127.0.0.1:5178` and enter the **dashboard** token. Keep the printed token private. Browser authentication uses an HttpOnly, SameSite session cookie; the token is not placed in localStorage. `revoke-token <id>` invalidates both bearer and associated browser access. Tokens expire after 30 days by default.

## Self-hosted service

Set `CONTRIBOLT_DOMAIN` to your own DNS name and run `docker compose up --build -d` after reviewing the deployment configuration. The proxy handles HTTPS; the application port is exposed only inside the Compose network. Issue an owner-scoped token with `docker compose exec contribolt node dist/cli.js issue-token local read,sync`. Use a different principal name for a separate metadata tenant. Each principal has isolated session storage; read and sync scopes grant no publication rights.

`--origin` declares the exact HTTPS browser origin. `--trust-proxy` is for a deployment reachable through the configured trusted proxy. Keep direct application ingress private. The container deployment is an optional dashboard/metadata service, not a sandbox for contribution scripts.

## Explicit metadata export and sync

```sh
contribolt export <session-id> > selected-session.json
contribolt sync <session-id>
```

`sync` requires `CONTRIBOLT_DASHBOARD_URL` and `CONTRIBOLT_DASHBOARD_TOKEN` in the local CLI environment. Select session IDs explicitly. Export/sync includes issue/repository references, decisions, check summaries and outcomes. It excludes workspaces, source trees, command logs, credentials and approval grants. Imported records remain device-reported metadata and cannot be used to pass local quality gates or authorize public writes. Oversized selections must be split into smaller batches.

## Backup, restore and upgrade

Stop all processes writing to the selected data directory before taking an archive. For a Compose deployment, stop the application service and archive the `contribolt-data` volume using your normal volume-backup tooling. Preserve the entire directory, including SQLite files and any WAL/SHM files, artifacts and tenant folders. Keep backups private. GitHub/App secrets are supplied separately by the environment or secret manager.

Restore into an empty data directory or fresh volume; preserve ownership for the service user. Start the same application version first and verify `/healthz`, token access and session counts. Local contribution workspaces use absolute paths: restore to the original data path for seamless resume, or recreate/revalidate affected workspaces before publication. Publication always performs fresh remote checks and validates current approval scope/expiry.

Before upgrading, record the image digest/version and take a stopped-service backup. Build/pull the reviewed version, restart, then verify health and schema compatibility. Newer database schemas are refused by older binaries. Roll back by restoring the prior binary **and** its matching backup into a separate empty directory/volume. Do not overwrite an active database.

The package build and handler tests run locally. Container startup, TLS issuance and live socket/browser operation require a host that permits those operations; their verification status is recorded in the release report.
