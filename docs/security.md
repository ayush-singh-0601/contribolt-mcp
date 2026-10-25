# Security and trust boundaries

The trusted components are the user, coding host, MergePilot process, private state, and explicitly installed adapter code. Repository content and remote issue/review text are untrusted data. Legitimate contribution rules apply within their scope; requests to expose credentials, bypass approval, or post unrelated content do not. The host must preserve this distinction while reasoning about source text.

Use a least-privilege GitHub token, existing `gh` credentials, or an opt-in GitHub App. GitLab and Forgejo credentials are scoped to explicitly configured HTTPS hosts. Credentials are resolved in the server and stripped from repository-command environments. Known token/key formats, sensitive object fields and configured environment secrets are redacted from persisted session data, events, artifacts and MCP results. Pattern-based scanning cannot recognize every possible secret. Inspect the exact diff and PR body before approval.

The command environment preserves existing home and selected toolchain/cache locations needed by native tools, while removing credential variables. It does not relocate the user's home. The host sandbox must independently restrict filesystem access to credentials and the private ledger; environment filtering alone cannot enforce that boundary.

## Repository execution

`run-check --host-approved` records that the host approved execution; the flag itself is not an OS permission boundary. The wrapper does not enforce filesystem/network isolation. A child process can access anything the surrounding host sandbox permits. Use a host sandbox that limits repository scripts to the isolated workspace, denies credential and ledger access, and controls network independently. If that separation is unavailable, do not run untrusted project scripts; report verification unavailable or use a separately isolated runner. Running an unrestricted shell and adding the flag does not provide isolation.

Never pass build-service secrets automatically. Bootstrap/install commands have separate network consent and do not qualify as tests. No global tool installation, sudo, remote install script, privileged Docker mode, stash or deletion of unrelated work is part of the contribution workflow. Project scripts still require inspection and host approval. The optional dashboard container is not a contribution sandbox.

Native Git disables hooks through a non-directory null-device path, ignores system/global configuration, disables credential helpers and external/file transports, and rejects executable or redirecting local configuration before operating on a repository. Linked/external `.git` metadata and symlink escapes are refused. Patch inspection blocks unexpected files, known secrets, binary/generated artifacts, unplanned lockfiles and whitespace failures. This is a conservative automated check followed by human/host diff inspection, not a full malware analysis.

## Public actions

Only an interactive terminal can confirm an approval request through the public CLI; the MCP tool creates the request but cannot confirm it. Grants expire after 15 minutes and bind action, actor, repository, patch, branch, commit metadata, PR text and disclosed limitations. Stop/resume/skip and authenticated external events revoke unfinished grants. Exact content and fresh remote eligibility are checked again before public writes. Dry runs perform no public writes.

This protects the MCP workflow from untrusted input; it does not defend against a fully privileged local process deliberately rewriting the database or changing application code. Keep private state and approval commands outside untrusted scripts' permissions. Review the confirmation in a trusted user terminal. Installed executable adapters share the server's privileges and require independent review of their entire dependency graph.

## Hosted metadata

Hosted access is read-only for contribution actions. Read/sync tokens expire, are stored as hashes, and can be revoked; revocation invalidates browser sessions. Cookies are HttpOnly and SameSite, with Secure under HTTPS. Writes using browser cookies require a CSRF token. Host/origin allowlists and payload/rate bounds apply. Keep application ingress behind the declared HTTPS proxy when remotely hosted.

Synchronization is opt-in per selected session. It excludes source, workspaces, logs, credentials and grants. Synced data remains labelled metadata and cannot authorize publication. Backups contain private local records and should use the same access controls as the live ledger.

Report a suspected compromise through your organization's security channel, stop the affected session, revoke forge/dashboard credentials, preserve a private copy of relevant audit evidence, and re-create/revalidate workspaces from trusted sources. No public security-contact address has been configured for this unpublished project.
