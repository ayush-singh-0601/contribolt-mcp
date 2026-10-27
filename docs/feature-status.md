# What ContriBolt can do today

This is an implementation audit, not a roadmap treated as a feature list. A native fixture is a real local execution against controlled project/API data; it is not a live contribution to an unrelated repository.

| Claim | Implementation and evidence | Honest boundary |
| --- | --- | --- |
| Find public repositories without a URL | `src/discovery/repositories.ts`, `src/discovery/engine.ts`; repository and workflow tests. | Authenticated network access and search budgets apply. A match is not guaranteed. |
| Enforce strict issue eligibility | `src/discovery/eligibility.ts`, authorship/timeline/competing/reservation modules; eligibility and security-recovery tests. | Zero discussion comments, no assignee, verified official author, no known linked/competing PR, resolved reservations/policy. Unknown evidence excludes a candidate. |
| Respect repository instructions | `src/repository/policy-sources.ts`, `policies.ts`, `indexing.ts`; policy and analysis tests. | The host still must read complete applicable instructions. Excerpts and indexes are bounded. |
| Guide a focused implementation | `src/mcp/analysis-tools.ts`, `src/contribution/plan.ts`; native/workflow tests. | The host coding agent reasons about and edits code. There is no standalone autonomous model inside the server. |
| Plan native verification | `src/languages/registry.ts`, built-in adapters and generic documented commands. | Twelve initial ecosystems have selected native fixture coverage, not every package manager/framework or third-party repository. Missing tools are reported. |
| Record actual checks | `src/execution/runner.ts`, `evidence.ts`, readiness and critique gates. | The wrapper records evidence and filters environments; the host must enforce OS/filesystem/network isolation. |
| Prepare a human-readable PR | `src/contribution/prepare.ts`; preparation, readiness, template and end-to-end tests. | Readiness can include disclosed limitations. The host must provide a current independent critique. |
| Publish with developer control | `src/security/approvals.ts`, publisher and recheck modules; approval/recovery tests. | Default is dry run. Real publication requires a non-dry-run session, exact interactive approval, fresh evidence, and forge permissions. No automatic merge. |
| Resume and follow reviews | Session controls, monitoring and revision modules; workflow/revision/recovery tests. | Resume revokes unfinished grants. Observed CI/review/merge state is distinct from predicted success. |
| Connect Codex CLI | Configuration tests and real app-server tool-call qualification. | A complete model-driven contribution remains a user acceptance check. |
| Connect Claude Code | Configuration tests and actual MCP connection-health qualification. | Connection health is not a complete model-driven workflow. |
| Generate Cursor configuration | `src/integrations/configure.ts` and client-config tests. | Generated configuration is contract-tested; interactive Cursor sessions are unverified. |
| Optional dashboard and sync | `src/http`, `dashboard`; authentication/tenant/CSRF/render/browser tests. | Metadata service, not a hosted coding agent or publication authority. Production TLS/operations depend on deployment. |
| GitLab and Forgejo adapters | `src/forges`; controlled contract tests. | Live instance behavior and public-write permissions require separate qualification. |

## Recorded qualification

- [Release-source CI](https://github.com/ayush-singh-0601/contribolt-mcp/actions/runs/40532036475): 25 successful jobs, including Node 22/24 across Linux/macOS/Windows, official SDK checks, selected native adapters, client probes, browser and container checks.
- [Published 0.1.0 verification](https://github.com/ayush-singh-0601/contribolt-mcp/actions/runs/40534187983): fresh public npm installs on Node 22.23.4 and 24.22.1, matching release archive integrity, both MCP protocol paths, and three registry-retry tests.
- [Native Python example](evidence/native/python.json): failing baseline, passing regression and a zero-write PR preview, with normalized output hashes.

These are dated observations of their recorded source commits and environments. Current release qualification is available in [GitHub Actions](https://github.com/ayush-singh-0601/contribolt-mcp/actions/workflows/ci.yml). Historical evidence remains associated with its original source commit.

Policy recognition uses conservative text classification and bounded source scans. It can reject legitimate candidates when guidance is ambiguous or matches too broadly; it is not a complete semantic interpretation of every repository policy.

## Qualification boundaries

- Guaranteed suitable issues, merge rates, speedups, or fully unattended contribution success.
- A completed live Cursor contribution, or full model-driven contribution qualification for every client.
- Verified live writes on every GitLab/Forgejo instance or every language/framework combination.
- An execution sandbox implemented by ContriBolt itself.
- Production hosting guarantees, a security response SLA, or unrestricted token-free GitHub discovery.
- Automatic merges, unapproved reviewer outreach, or background public contribution campaigns.

See [release scope](release-report.md), [testing layers](testing.md), and [the PRD traceability audit](requirements-matrix.md) for the underlying distinctions.
