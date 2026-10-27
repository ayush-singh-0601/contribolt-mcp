# Release qualification report

This report records **pre-publication qualification of development release 0.1.0** for user acceptance testing. All 77 implementation commits are in the private [MergePilot repository](https://github.com/ayush-singh-0601/mergepilot-mcp). The complete 22-job qualification run [passed](https://github.com/ayush-singh-0601/mergepilot-mcp/actions/runs/40487993950). No npm publication, production deployment, paid model turn or live public contribution was performed during that qualification. Subsequent npm publication is recorded by the `npm release` workflow and the registry; see [distribution.md](distribution.md).

## Observed automated checks

| Check | Result and scope |
| --- | --- |
| Linux and macOS, Node 24 | Formatting, server/dashboard type checks, 119 passing tests, server/dashboard production builds, packaged assets and clean npm archive installation. |
| Windows, Node 24 | The captured candidate passed 118 tests with one explicitly skipped Unix symlink case, plus build and clean archive installation. That case now uses Windows junctions and runs in the final matrix. See the current Actions run for the final head. |
| Official MCP SDK 2.4.0 | Real STDIO passes with both legacy initialization and protocol 2026-07-28. Each checks all 21 tools, six prompts, resources, onboarding/defaults, refused unapproved publication and stop/resume. Fallback is forbidden in the SDK job. |
| Real coding clients | Codex 0.163.0 discovers tools and performs local onboarding/status/stop/resume calls. Claude Code 2.1.284 confirms an actual MCP connection. Disposable configuration; zero model turns and public actions. |
| Native language drivers | All 12 adapter jobs run a real failing regression, focused correction and all planned checks: npm, pip/pytest, Go, Cargo, Maven, Gradle/Kotlin, CMake/CTest, .NET, Bundler/Rake, Composer, SwiftPM and Dart. Alternate managers/frameworks remain outside these fixtures. |
| Six contribution dry runs | Python, Rust, Java, C, Shell and Perl execute failing/passing regressions, captured evidence, independent fixture critique and a zero-write PR preview. Forge responses are controlled fixtures. |
| Controlled publication/revision | Real temporary Git history and native checks, with controlled GitHub responses/push boundary. Tests reject missing consent, changed requirements and new discussion before writes, then exercise one fixture PR, separately approved revision, recovery and observed merge state. |
| Chromium | Two Playwright tests pass, covering authenticated dashboard interaction, filtering/detail, mobile overflow, token handling and logout; screenshots are CI artifacts. API responses are controlled fixtures. |
| Container hosting | Docker image builds and its real HTTP health endpoint responds. This does not claim a production domain, certificate or deployment. |
| Dependencies | Live npm audit reports **zero vulnerabilities**, including development dependencies. Versions are pinned; the lockfile includes platform packages and is checked for consistency before the matrix. |
| Package | Three OS jobs install the actual tarball into an empty directory and verify version/help, runtime diagnostics and real installed-package STDIO. Local archive/traceability/document-link/native-log-hash checks also pass. |

[ci-validation.json](evidence/ci-validation.json) records the exact captured source commit, run, job URLs and scope. [check.txt](evidence/check.txt) contains its normalized Linux check transcript. These records identify the tested candidate; the current branch's final checks are visible in [Actions](https://github.com/ayush-singh-0601/mergepilot-mcp/actions). The earlier restricted-host baseline remains in [local-validation.json](evidence/local-validation.json) and [local-check.txt](evidence/local-check.txt). Six contribution logs are under [evidence/native](evidence/native/), and local Cargo/CMake fixture output is under [evidence/native-adapters](evidence/native-adapters/).

The managed local host blocks registry access, browser launch and listening sockets, and initially supplies Node 22. Final locked-dependency/client/platform qualification therefore ran on network-enabled GitHub runners. For use, select Node 24, run `npm ci && npm run build`, then configure your client with `--local` as described in [clients.md](clients.md). `mergepilot doctor --json` checks local capabilities; `--live` separately verifies GitHub authentication and registry access.

## User and live-service checks

- Complete the model-driven discovery/edit/test/preview workflow in your own coding client. Cursor configuration has contract coverage, but an actual Cursor session was unavailable. Client connection checks do not establish semantic coding quality.
- Live public GitHub fork/push/PR/reviewer permission matrices require an explicitly authorized contributor-controlled public fixture. The private source repository upload is not a contribution-publication test. No unrelated maintainer received a test PR or message.
- GitLab/Forgejo instance-specific capabilities and opt-in maintainer integrations have contract/handler tests; live instance credentials and installation checks remain separate.
- Production TLS, Compose ingress, backup/restore operations and deployment-specific upgrades require the chosen deployment environment. The optional local dashboard is already exercised in browser/HTTP/container checks.
- Aspirational beta metrics require real consented samples. No 95% eligibility-accuracy, merge-rate or production-incident guarantee is inferred from fixtures.

## PRD and trust boundaries

[requirements.json](requirements.json) maps all 236 extracted source items to evidence and scope notes; [requirements-matrix.md](requirements-matrix.md) separates local implementation, observed CI/native fixtures, host responsibilities, live-service checks and unmeasured beta metrics. These are not 236 acceptance-test passes or an overall readiness percentage. The preserved PRD SHA-256 is `b6c0bdd2aca25827dac3cbe10a48e0e3a9467e13b5648fab81757bb2aa89b4b7`.

The existing coding host performs semantic policy/issue investigation, accessible attachment/discussion review, effort estimates, source edits and independent correctness critique. Automated maps and heuristics are bounded aids; unknown evidence excludes candidates. Prepared/opened/reviewed/merged remain separate factual stages.

The execution wrapper is not an OS sandbox. The host must isolate untrusted repository scripts from credentials and the private ledger and control network access. `--host-approved` records consent; it does not create isolation. Environment filtering preserves required existing home/toolchain locations while removing credential variables. See [security.md](security.md).
