# Verification layers

`npm run check` type-checks the server and dashboard, runs unit/integration tests, and builds distributable server/dashboard assets. The package targets Node.js 24. The controlled workflow test uses real temporary Git history and real Python regression executions, with mocked GitHub API responses and an injected public-push boundary. It verifies a failing baseline, a passing fix, approval rejection/confirmation, exactly one PR, a separately approved revision, and factual merge-state handling. Mock responses are fixtures, not live contribution evidence.

The edge cases in PRD section 11 are covered across eligibility, provenance, policy, reproduction, workspace, environment, execution, publication recovery, review-routing, monitoring, generic-adapter and end-to-end suites. Additional adversarial and distribution checks are part of release qualification. `tests/workflow-e2e.test.ts` exercises the complete registered MCP tool surface; overrides are constructor-only testing dependencies and are not exposed as tool arguments.

`npm run test:browser` checks login, filtering, detail inspection, mobile overflow, token storage and logout using the built dashboard. Browser API responses are controlled fixtures. The CI browser job captures screenshots as review artifacts. Rendering/XSS tests also run without a browser.

The loopback listener test runs on hosts that permit sockets and reports a skip when the managed environment denies listening. Chromium launch, live forge writes, real Codex/Claude/Cursor interaction and container/TLS startup are separate qualification checks. A build or mock test must not be reported as a passing live integration.

Public-write smoke tests belong only in explicitly authorized, contributor-controlled repositories, using the same recorded approval gates. Never use unrelated maintainers' repositories for release testing. External checks that cannot run are listed as unavailable in the release report.

The six native contribution dry runs in `tests/multilanguage-e2e.test.ts` cover Python, Rust, Java, C, Shell and Perl. Each runs real failing/passing regression commands through the evidence wrapper, uses controlled discovery responses, and reaches a zero-write PR preview. Their exported evidence is under `docs/evidence/native/`. Paths in displayed logs are normalized for privacy; normalized hashes identify the included text, while captured hashes identify the original wrapper logs. These generic native-command examples do not establish every dedicated toolchain or package-manager integration.
