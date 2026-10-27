# ContriBolt MCP — Product Requirements Document

**Version:** 1.0  
**Status:** Build-ready product specification  
**Date:** 25 October 2026  
**Product:** Open-source Model Context Protocol (MCP) server for AI coding CLIs  
**Initial integrations:** Codex CLI, Claude Code, Cursor, and other compatible MCP clients  
**Primary distribution:** npm; source hosted on GitHub  
**Implementation language:** TypeScript (for the MCP server)  
**Target repositories:** Public GitHub open-source repositories in **any programming language**

---

## 1. Executive summary

ContriBolt is an **autonomous open-source contribution workflow for AI coding agents**. It starts with **at most three short questions**, requiring the developer to supply **neither a repository nor an issue URL**. Based on those answers, ContriBolt independently searches GitHub for relevant repositories and **maintainer-originated, open issues that have zero discussion comments, no assignee, and no known linked or competing pull request**.

It then examines the project's contribution policies, instructions, architecture, tests, dependencies, issue details, and relevant code. The connected coding agent develops the smallest *clear, correct, well-tested* patch; ContriBolt validates it against project conventions and prepares a concise, natural-language pull request. With the developer's explicit authorization, it publishes the PR and follows the project's permitted review-request process. It can continue addressing review feedback after renewed approval for code and public changes.

**Product promise:** *Answer three questions. ContriBolt discovers a contribution opportunity and carries your coding agent through a review-ready pull request.*

**Non-promise:** No product can guarantee an issue is truly uncontested, a PR will merge, maintainers will review it, or every language toolchain will work on every machine. ContriBolt must expose uncertainty and stop when compliance or correctness cannot be established.

### Guiding principles

1. **Autonomous discovery:** Never make the developer find a repository or issue first.
2. **Maintainer respect:** Follow the repository's contribution and AI-assistance policies; avoid unsolicited PR floods.
3. **Verified evidence:** Back issue eligibility and implementation decisions with GitHub and repository evidence.
4. **Small, readable changes:** Optimize for maintainability, not code-golf line counts.
5. **Language-agnostic operation:** Detect each repository's language and build system and work through native commands or an adapter.
6. **Human authority over publication:** Local investigation can be automated; public actions require explicit consent.
7. **Truthful reporting:** Never invent passing tests, maintainer status, issue availability, or reviewer requests.

---

## 2. Target users and jobs to be done

**Primary:** Students, first-time contributors, individual developers, and engineers using Codex CLI or Claude Code who want meaningful merged open-source contributions without manually spending hours hunting for issues.

**Secondary:** Experienced developers exploring unfamiliar ecosystems; maintainers who want contributions that respect instructions and arrive with targeted tests.

### Core user story

> As a developer, I want to answer only two or three preference questions, then let my existing coding agent autonomously discover a legitimate, actionable issue in a repository I have never seen, understand that repository, implement and validate a high-quality fix, and prepare a PR that maintainers can review efficiently.

### Jobs to be done

- Find an *appropriate repository*, not just an issue in a repo the user already knows.
- Distinguish an official maintainer-origin issue from an ordinary community request.
- Detect obvious competing work before touching code and again before submission.
- Convert a confusing issue into a reproducible, testable change.
- Respect documented contribution, style, test, security, and AI-use policies.
- Keep review requests compliant and professional.

---

## 3. User experience: only 2–3 onboarding questions

### Required conversation

When the user types **“Find me an open-source contribution”** (or equivalent), ContriBolt asks the following **three questions in a single compact interaction**. All questions support `Any / decide for me` defaults.

**Q1 — Which programming languages or stacks are you comfortable contributing to?**  
Examples: `TypeScript, React`, `Python`, `Rust`, `Java`, `C++`, `Go`, `Anything`.

**Q2 — How challenging should the contribution be?**  
Choices: `Beginner/small (roughly 1–3 hours)`, `Intermediate (roughly 3–8 hours)`, `Advanced (multi-day)`, `Decide for me`. Time bands are estimates, not commitments.

**Q3 — What sort of repository should I prioritize?**  
Choices: `Well-known projects`, `Smaller active projects`, `Highest realistic merge potential`, `Any`; optionally a free-text domain such as `developer tools`, `AI`, `backend`, `web`, or `infrastructure`.

**Do not ask for a repository name, GitHub link, issue number, maintainer, or PR link.** The developer may voluntarily provide a preferred repository, but the default path must discover one independently.

The preferences are saved locally with permission for future sessions, so repeat sessions may skip onboarding. If the host CLI cannot render forms, ask the three questions in one plain-text message. If the user provides only two answers, use a clearly displayed default for the third and continue.

### Example interaction

```text
Developer: Find me an open-source issue I can contribute to.

ContriBolt:
1. Languages/stacks?       TypeScript and Python
2. Difficulty?             Intermediate
3. Repository preference?  Active projects, highest merge potential

ContriBolt:
Searching repositories and validating maintainers, comments,
assignments, linked PRs, contribution policies, and codebase fit...

Selected: <owner>/<repo> — Issue #<id>: <title>
Why: Official-author evidence, zero discussion comments, no assignee,
no known competing PR, clear test surface, active maintenance.
Confidence: High / Medium / Low, with evidence links.

I will inspect this repository, reproduce the issue, implement a focused
fix, and run the applicable checks. I'll ask before pushing or opening a PR.
```

Example identifiers are placeholders, not actual verified issues.

### Interaction rules

- After onboarding, **search and select automatically**; do not return only a list that forces the user to choose.
- Surface the chosen repo and issue with concise evidence, but proceed automatically to non-destructive analysis.
- Offer an escape hatch: `skip this issue`, `find another`, `change preferences`, `stop`.
- Ask additional questions **only** for hard blockers, missing authorization, ambiguity that could cause an incorrect change, or before a consequential GitHub action.
- Maintain a session journal so an interrupted coding CLI can resume without rescanning everything.

---

## 4. End-to-end state machine

```text
IDLE
  -> ONBOARDING (max 3 questions)
  -> REPOSITORY_DISCOVERY
  -> ISSUE_DISCOVERY
  -> ELIGIBILITY_VERIFICATION
  -> PROJECT_POLICY_GATE
  -> REPOSITORY_ANALYSIS
  -> ISSUE_REPRODUCTION
  -> IMPLEMENTATION_PLAN
  -> PATCH_IMPLEMENTATION (coding agent)
  -> VALIDATION
  -> PRE_SUBMISSION_RECHECK
  -> USER_APPROVAL_TO_PUBLISH
  -> FORK_BRANCH_PUSH_PR
  -> REVIEW_ROUTING
  -> REVIEW_MONITORING
  -> REVISIONS_IF_NEEDED (approval-gated)
  -> DONE | BLOCKED | SKIPPED | FAILED
```

Every transition records timestamp, inputs, evidence URLs, status, output artifact paths, command results, and confidence. Errors must be resumable where feasible. No transition may silently bypass a hard policy or permission gate.

---

## 5. Functional requirements

### FR-01: Autonomous GitHub repository discovery — P0

**Input:** language/stack preferences, difficulty, repository preference/domain, authenticated GitHub identity.

**Responsibilities:**

- Search across GitHub repositories without requiring a starting repo.
- Build diversified candidate sets from topic/language search, relevant issue search, and repositories with suitable open issues. Do not simply search the most-starred projects.
- For each candidate, inspect archive status, fork status, default branch, recent commits/releases, recent maintained PRs, issue usage, contribution documentation, and the developer's ability to contribute.
- Prefer projects with healthy review activity and clear contribution practices; avoid abandoned, archived, spam-prone, read-only, and inaccessible projects.
- Include stars as a secondary metadata signal, **not** a proxy for merge probability.
- Enforce configurable repo exclusions and blocklists, with local caching and GitHub rate-limit awareness.

**Output:** internally ranked repositories with URLs, language signals, maintenance observations, and reasons for inclusion/exclusion.

**Acceptance:** With preferences of `Python / intermediate / any`, the system can discover multiple real, distinct eligible repositories without the user naming any of them.

### FR-02: Official-author, zero-comment, unassigned issue discovery — P0

Search within ranked repositories (and optionally globally) using GitHub issue filters as **coarse discovery only**, then retrieve each issue directly and recheck its current state.

**Hard requirements (default strict mode):**

1. Issue is open and belongs to a non-archived, contribution-accepting public repository.
2. Issue is an actual issue, not a pull request.
3. Its **issue discussion comment count is exactly zero** at verification time. Other timeline events are tracked separately and do not count as discussion comments.
4. No assignee is present.
5. Author has verified official provenance: `OWNER`, `MEMBER`, or `COLLABORATOR` association is an initial positive signal. Check membership/current privileges when APIs allow; `MEMBER` by itself is **not proof of maintainership**. If provenance cannot be established, mark `UNKNOWN` and exclude from strict mode.
6. No known linked or competing pull request, from automated cross-references, closing references, timeline items, and additional repository PR searches by issue number/title/related code.
7. Not labelled `wontfix`, `duplicate`, `invalid`, `blocked`, or an equivalent project-specific restriction.
8. Not reserved via documentation, project board, milestone ownership, branch activity, or explicit issue body instructions.
9. No repository policy prohibits the planned use of AI-assisted contributions or external PRs.

**Important limitation:** GitHub does not provide a perfect globally exhaustive "no one is working on this" flag. The tool must say **"no known competing PR found as of <timestamp>"**, not make an absolute claim.

**Suggested discovery query (adapt by repo/language):**

```text
is:issue is:open comments:0 no:assignee
```

Optional qualifiers such as `-linked:pr` may be used where supported, but they must **never substitute for secondary verification**. Do not rely on undocumented GitHub search syntax as a hard invariant.

**Output per issue:** issue URL/id, title, author and verified author association, comment count, assignees, labels, discovered references and PR links, policy findings, source timestamps, estimated complexity, eligibility verdict, evidence links.

**Acceptance:** Seeded fixtures reject issues with a comment, assignee, community-authored nonofficial issue, linked PR, competing PR, or forbidden AI contribution policy.

### FR-03: Candidate scoring and autonomous selection — P0

Apply hard gates before scoring. Only eligible candidates may be ranked. Initial transparent heuristic:

| Dimension | Weight |
|---|---:|
| Fit to developer language/stack | 20% |
| Clarity and reproducibility of issue | 20% |
| Likelihood of small, testable change | 20% |
| Repository maintenance/review health | 15% |
| Contribution-policy compatibility | 15% |
| Recency and issue activity | 10% |

`score = Σ(weight × normalized_dimension_score)`; retain each dimension and an evidence trail. This is an **initial heuristic**, not a learned probability of merge.

- Select highest-ranked candidate automatically if it passes a confidence threshold.
- Use policy compatibility as both hard gate and scoring signal (missing policy evidence lowers confidence; explicit prohibition rejects).
- Avoid highly speculative issues; prioritize ones with a concrete testable outcome.
- Do not claim "good first issue" means genuinely easy; estimate complexity from files, build time, scope, and reproducibility.
- If no candidate passes **all hard requirements**, explicitly say so and offer either a later re-scan or a **user-authorized** relaxation. Never silently loosen `comments:0`, author provenance, assignee, or PR conditions.

### FR-04: Deep repository and policy analysis — P0

Inspect relevant files and project sources, as available:

- `README*`, `CONTRIBUTING*`, `CODE_OF_CONDUCT*`, `SECURITY*`, `LICENSE*`.
- `AGENTS.md`, `CLAUDE.md`, `.github/instructions/`, project-specific agent instructions, and nested scoped instruction files.
- `.github/CODEOWNERS`, `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE*`, `.github/ISSUE_TEMPLATE/`.
- `.github/workflows/`, CI config, formatting/lint/test settings, build manifests, lockfiles.
- Relevant source modules, call graph/import paths, tests, previous accepted PRs around the same files, and relevant decisions/discussions.

**Analysis method:** shallow clone or GitHub content access -> file tree and manifest detection -> targeted search -> dependency/import tracing -> exact related files -> nearby tests -> accepted patch examples -> implementation plan. Do not flood agent context with the whole repository.

**Policy gate:** classify `ALLOWED`, `ALLOWED_WITH_DISCLOSURE`, `NEEDS_HUMAN_APPROVAL`, `PROHIBITED`, or `UNKNOWN`. Explicit prohibitions are hard stops. Follow the applicable source-file instruction hierarchy and repository rules. Unknown or conflicting policies must be resolved before public submission.

**Outputs:** `repository_analysis.md` (local only), instructions digest, affected-file map, build/test command plan, and policy decision with references.

### FR-05: Issue understanding and reproduction — P0

- Read the full issue, issue forms, attachments/links if accessible, timeline activity, and the relevant code history.
- Write a precise statement of expected vs actual behavior and likely root cause.
- Prefer a failing regression test or a deterministic reproduction command before implementing.
- If reproduction is unavailable, document why and require stronger code evidence; do not fabricate it.
- Mark `BLOCKED` if the issue is ambiguous, stale, out-of-date, already fixed, or impossible to test with reasonable confidence.

**Outputs:** reproduction notes, failing/passing baseline, root-cause hypothesis, proposed minimal patch strategy.

### FR-06: Implement a minimal, maintainable fix — P0

ContriBolt is an **MCP orchestration and verification layer**; the host coding agent edits source files using its normal capabilities. It should not require a second paid model or separate agent backend.

Implementation standards:

- Follow style, architecture, naming, API compatibility, types, error handling and dependency rules already in the project.
- Change only files necessary to solve the issue and meet test/documentation requirements.
- Prefer an existing helper over a new abstraction; avoid unnecessary new dependencies.
- Prefer direct, readable logic to condensed clever code. **Line count is a diagnostic, not the objective.**
- Create focused regression tests, plus edge-case coverage where necessary.
- Do not refactor unrelated modules, reformat entire files, or modify unrelated lockfiles.
- Do not add decorative comments, redundant docstrings, autogenerated fluff or spurious configuration.
- Inspect baseline behavior before and after the patch; preserve backwards compatibility unless the issue requires a change.
- Never auto-commit generated secrets, private files, binaries, test artifacts, credentials or untracked developer work.

**Quality gate:** independent diff critique by the host agent; risk surface, changed-file count, code clarity, project conventions, regression tests, build/lint results, and hidden user workspace changes.

### FR-07: Language-agnostic build and test execution — P0

**Requirement:** The product must *accept repositories written in any programming language*. This does **not** mean every language can automatically be built without its compiler/toolchain installed. ContriBolt discovers the environment and delegates to the project's documented commands and/or an adapter.

1. Detect language mix from repository metadata and files, **not** GitHub's primary language alone.
2. Identify build, test, lint, format, and type-check commands from manifests, documentation and CI.
3. Detect installed runtimes/tools and lockfile-specified versions; prefer project-supported package managers.
4. Resolve root vs monorepo workspace/subproject targets.
5. Use a **language-adapter registry** with `detect`, `bootstrap_plan`, `test`, `lint`, `format_check`, `typecheck`, `build`, and `result_parser` capabilities.
6. Fall back to a **generic repository-command adapter** for languages without a dedicated adapter.
7. Never claim validation succeeded when a toolchain is missing or a command was skipped. Report `PASS`, `FAIL`, `SKIPPED`, or `UNAVAILABLE` per check.
8. Do not install global tools, execute opaque remote install scripts, modify system configuration or run project scripts outside an approved sandbox without explicit user consent.

**Initial tested adapters (release target):**

| Language/ecosystem | Discovery and native entry points |
|---|---|
| JavaScript / TypeScript | npm, pnpm, yarn, Bun, Deno; `package.json`, Deno/Bun configs |
| Python | pyproject, uv, pip, Poetry, tox, pytest, Ruff |
| Go | `go.mod`, Go tooling |
| Rust | Cargo manifests, clippy, rustfmt, cargo test |
| Java | Maven, Gradle, JUnit |
| Kotlin | Gradle, Maven |
| C / C++ | CMake, Make, Meson, Bazel, CTest |
| C# / F# / .NET | `.sln`, `.csproj`, `dotnet test` |
| Ruby | Bundler, Rake, RSpec, Minitest |
| PHP | Composer, PHPUnit, Pest |
| Swift | Swift Package Manager, Xcode requirements |
| Dart / Flutter | `pubspec.yaml`, `dart test`, `flutter test` |

**Additional supported through generic adapter or community adapters:** Scala, Groovy, Elixir, Erlang, Haskell, OCaml, Lua, Perl, R, Julia, Zig, Nim, Clojure, Objective-C, Solidity, Move, SQL, Shell, PowerShell, Terraform/HCL, Nix, YAML-heavy infrastructure repositories, and other languages. Support means safe discovery and attempts at repository-prescribed commands; the report must identify whether *actual verification* was possible.

**Plugin interface:** `LanguageAdapter { id; detect(repo): Detection; planEnvironment(repo): Plan; commands(repo, scope): Checks; parseResults(output): CheckResult[] }`.

**Acceptance:** Mixed-language monorepo chooses the correct subproject commands; unknown-language repo falls back without crashing or falsely reporting test success.

### FR-08: Validation and PR readiness gate — P0

Checks before recommending publication:

- Diff is scoped to the issue; no unrelated changes or secrets.
- Issue is still open, unassigned, comment-free, and without known competing PRs **immediately before publication**. If a maintainer has discussed or assigned it since discovery, halt and ask how to proceed rather than proceeding under the stale premise.
- Relevant regression tests pass; required lint/type/build checks pass where available.
- Required contribution forms, checklist items, DCO/CLA/sign-off requirements, issue linking and branch naming are respected.
- Existing CI commands or realistic equivalents run with explicit pass/fail/skipped status.
- Security and dependency concerns have been assessed; no fabricated results.
- Repo's AI contribution restrictions/disclosures have been applied.

**Readiness:** `READY`, `READY_WITH_DISCLOSED_LIMITATIONS`, or `BLOCKED` plus reasons. `READY_WITH_DISCLOSED_LIMITATIONS` requires explicit user review before publishing and may be prohibited for high-risk changes.

### FR-09: Natural, precise pull request preparation — P0

Use project PR templates when supplied. Otherwise produce a clear, short description:

```markdown
## Summary
Fixes pagination state when search filters change.

## Changes
- Reset the current page when filters change.
- Add a regression test for the transition.

## Testing
- <actual command>: passed

Closes #<issue-number>
```

**Style:** plain, human-readable words; no emojis, promotional phrasing, filler, exaggerated claims, or performative AI narration. **Do not conceal AI assistance if repository rules require disclosure, and never make false claims about manual work.** Only mention commands and results actually executed. Link exact issue if the repository permits auto-closing references.

Prepare branch, commit message, base/head selection, fork metadata, and preview of the full diff. **Request explicit publication authorization** before fork/push/PR creation, and do not merge automatically.

### FR-10: Publishing and reviewer routing — P0

- Prefer contributor's fork when direct upstream push is unavailable or inappropriate.
- Push only the specific approved branch/commits; preserve unrelated working-tree state.
- Open a PR only after all applicable gates and user approval.
- Prefer opening a draft PR when required checks or project practice demand it.
- Inspect CODEOWNERS and documented review conventions. GitHub can automatically route review requests to code owners for ready-for-review PRs under eligible repository settings.
- Use the `Request reviewers` API **only if authenticated actor permissions allow**, the target reviewer/team is legitimate, and the developer approved it.
- When lacking permissions, do **not** attempt privilege bypass. Rely on CODEOWNERS/normal repository triage; optionally draft a single polite message for the user to approve **only when the project's documented process invites such messages**.
- Never repeatedly ping maintainers, randomly tag maintainers, request reviews from unrelated people, or create duplicate PRs.
- Return actual PR URL and the factual review-routing outcome: `requested`, `auto-routed via CODEOWNERS`, `not possible due to permissions`, or `awaiting project triage`.

### FR-11: Post-submission feedback loop — P1

- Poll responsibly or use webhooks for PR CI status, reviews, comments and merge/close state.
- Distinguish bot CI feedback, maintainer review and casual comments.
- For each actionable review comment, explain issue, identify relevant files, propose a focused patch, run tests, and request approval before updating the public branch.
- Never argue with reviewers automatically, automatically dismiss reviews, or leave unsolicited comments.
- Stop monitoring on user request; permit `resume <session>`.

### FR-12: Session persistence and reporting — P0

Persist a local run ledger (SQLite or versioned JSON) containing preferences, candidate metadata, verified evidence, repository commit SHA, issue timestamp, selected branch, plan, quality checks, permission decisions, PR URL, review state, and structured errors. Redact all secrets.

**End-of-run report must distinguish:** `discovered`, `verified`, `implemented`, `tested`, `PR prepared`, `PR opened`, `review requested`, and `merged`. Never conflate them.

---

## 6. MCP interface and orchestration

### Public tools (proposed)

| Tool | Inputs | Key outputs | Side effects |
|---|---|---|---|
| `start_contribution` | optional preferences and overrides | session ID, onboarding state | local only |
| `set_preferences` | session ID, 2–3 answers | normalized preferences | local only |
| `discover_repositories` | session ID | ranked repositories and evidence | GitHub read |
| `find_eligible_issues` | session ID, repo candidates | candidates plus reject reasons | GitHub read |
| `verify_issue` | issue ID/URL, strict policy | eligibility evidence, as-of time | GitHub read |
| `analyze_repository` | session, chosen repo and issue | policy digest, code map, commands | read/clone with consent |
| `plan_fix` | session ID | reproduction and implementation plan | local only |
| `check_patch` | session ID, diff/check outcomes | quality verdict and blockers | approved local checks |
| `prepare_pull_request` | session ID | proposed branch, title, description, checklist | local only |
| `publish_pull_request` | session ID, authorization token/confirmation | PR URL and commit SHA | **GitHub write** |
| `route_review` | session ID, explicit permission | routing result and reason | conditional GitHub write |
| `get_status` / `resume_session` | session ID | run state, next safe action | local/GitHub read |

**Important implementation detail:** The MCP server does not itself need to run an LLM. It exposes tools and structured prompts to the host agent, which carries out reasoning and coding. Automatic progression depends on host-client capabilities and configured approvals; the server must not silently invent permission to execute local shell commands or perform network writes.

### Recommended orchestration architecture

```text
Coding CLI (Codex / Claude Code / Cursor / other MCP client)
    |
    | MCP tools, prompts, and structured results
    v
ContriBolt MCP server (TypeScript)
    |
    +-- Session & approval state machine
    +-- GitHub discovery & verification engine
    |     +-- REST search/read endpoints
    |     +-- GraphQL timeline/cross-reference checks
    |     +-- Cached PR similarity & ownership checks
    +-- Repository policy analyzer
    +-- Codebase & language adapter registry
    +-- Patch quality / PR readiness verifier
    +-- GitHub publisher / review router
    +-- Local evidence ledger / logs
    |
    v
Host agent local workspace and native code-edit/test capabilities
```

**Implementation:** TypeScript, Node.js current supported LTS, official MCP SDK compatible with the chosen protocol revision, Octokit REST + GraphQL, Zod/JSON Schema validation, native Git, structured logs, and SQLite or portable JSON for state. Favor STDIO MCP initially; optionally offer Streamable HTTP later with explicit authentication/authorization.

**Hosting:** Local-first, no mandatory SaaS backend or API key for a separate model. GitHub authentication uses the developer's existing authenticated environment, GitHub CLI credentials, GitHub App, or appropriately scoped token.

---

## 7. Data models

```typescript
// Illustrative contracts; refine with versioned JSON Schemas.
type Difficulty = 'small' | 'intermediate' | 'advanced' | 'auto';
type Eligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
type Policy = 'ALLOWED' | 'ALLOWED_WITH_DISCLOSURE'
  | 'NEEDS_HUMAN_APPROVAL' | 'PROHIBITED' | 'UNKNOWN';

interface Preferences {
  languages: string[];       // [] means any language
  difficulty: Difficulty;
  repositoryPreference: 'popular' | 'small_active' | 'merge_likelihood' | 'any';
  optionalDomain?: string;
}

interface IssueEvidence {
  url: string;
  repoFullName: string;
  issueNumber: number;
  checkedAt: string;
  open: boolean;
  discussionComments: number;
  assignees: string[];
  authorLogin: string;
  authorAssociation: string;
  officialProvenance: Eligibility;
  knownLinkedPRs: string[];
  competingPRs: string[];
  competingPRScanComplete: boolean;
  repositoryPolicy: Policy;
  eligibility: Eligibility;
  rejectReasons: string[];
  confidence: 'high' | 'medium' | 'low';
  evidenceUrls: string[];
}

interface QualityCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED' | 'UNAVAILABLE';
  command?: string;
  exitCode?: number;
  outputPath?: string;
  explanation?: string;
}

interface ContributionSession {
  id: string;
  preferences: Preferences;
  state: string;
  selectedIssue?: IssueEvidence;
  repositoryCommitSha?: string;
  policyDecision?: Policy;
  validation: QualityCheck[];
  publishApproved: boolean;
  prUrl?: string;
  lastUpdatedAt: string;
}
```

---

## 8. Issue discovery and verification algorithm

```text
INPUT: 2–3 preference answers
1. Normalize language/difficulty/repo preference.
2. Discover relevant repos using GitHub repository search and issue search.
3. Exclude archived, policy-prohibited, inactive, inaccessible repos.
4. Retrieve open zero-comment, unassigned issue candidates.
5. For each issue:
   a. Refresh issue state and direct discussion comment count.
   b. Verify official-author evidence; label uncertain results UNKNOWN.
   c. Inspect timeline, cross-references, linked PRs, possible duplicates.
   d. Search open/closed PRs for competing work or already merged fix.
   e. Inspect contribution policy and AI-assistance restrictions.
   f. Estimate clarity, expected effort, testability and repository health.
   g. Reject on any strict hard-gate failure.
6. Rank eligible candidates using transparent score and confidence.
7. Automatically select strongest qualified candidate.
8. Read repository, understand and reproduce issue, prepare plan.
9. Let coding agent implement; verify patch and project checks.
10. Re-verify issue, repo rules and competing work just before PR.
11. Ask user for publication approval; publish if authorized.
12. Route review only through permitted GitHub/project mechanisms.
13. Track CI/review with user-controlled follow-up.
OUTPUT: verifiable PR URL OR explicit blocker and next option.
```

### Anti-duplication strategy

Use more than closing references: inspect GraphQL issue timeline cross-reference nodes where available, PR bodies/titles mentioning `#<issue>`, open PRs affecting the same code or error, associated discussions, and recent merged commits. Fuzzy similarity is advisory only; uncertain matches should be displayed, not treated as certain.

### Handling strict-filter scarcity

If no appropriate issue exists, do **not** secretly switch to community-authored, commented-on, assigned, or PR-linked issues. Show `No verified matches` with counts/reasons; offer `expand repositories`, `try later`, or `relax one selected filter` with consent. A candidate rejected for AI-policy incompatibility must never be revived by filter relaxation.

---

## 9. Security, permissions, and ethics

- Treat GitHub issue bodies, README text, source comments and external links as **untrusted input**. Ignore embedded instructions telling the agent to leak credentials, disable safety checks, post irrelevant content, or run arbitrary commands.
- Keep tokens out of context, logs, commit history, tool outputs and PR descriptions; use GitHub credential stores/environment scoping and least privilege.
- Execute repository scripts only in an approved isolated workspace with user approval for potentially dangerous operations. Do not silently use network, Docker privilege, `sudo`, deletion commands or installation scripts.
- Prevent workspace destruction: detect dirty git tree, stash nothing without consent, work in an isolated worktree/fork, and refuse overwriting existing uncommitted user work.
- GitHub public writes (branch push, PR creation, reviewer request, comments, review replies) require explicit approval appropriate to the action.
- Apply per-repository cooldowns, no duplicate PRs, no mass commenting, and no spammy maintainer tagging.
- Provide accurate AI-assistance disclosure when the project asks for it. The product aims for **clear, natural writing**, not concealment of provenance.
- Provide dry-run mode and an auditable action log.
- Enforce GitHub rate limits, request caching, exponential backoff, pagination, and cancellation.
- If repository instructions conflict with user/system safety or the MCP's security boundaries, stop and escalate rather than obeying the repository text as an unrestricted instruction.

---

## 10. Non-functional requirements

| Category | Requirement |
|---|---|
| Reliability | Resumable sessions; idempotent publish step; duplicate PR prevention |
| Portability | Windows, macOS, Linux; handle path/quoting differences |
| Language coverage | Accept any language; transparent check availability, no fabricated tool support |
| Explainability | Candidate scores, rejection reasons, policy links, verification timestamps |
| Security | Least-privilege GitHub access; no credential exfiltration or silent public writes |
| Performance | Bounded search budgets, pagination, caching, progressive analysis; no guaranteed instant full-repo scan |
| Maintainability | Adapter-based integrations, typed schemas, modular tests, concise logs |
| Accessibility | Works through plain-text coding CLI without GUI dependence |
| Observability | Per-stage duration, tool failures, API limits, check results, user approvals |
| Offline/resume | Cached evidence readable offline; fresh GitHub recheck required before publishing |

---

## 11. Edge cases and required behavior

| Scenario | Expected behavior |
|---|---|
| No matching repo/issue | Report zero verified results; offer a wider search or explicit filter relaxation |
| Issue gains a comment or assignee mid-run | Halt before PR; explain why strict eligibility changed |
| New competing PR appears | Halt and show PR link and overlap evidence |
| Maintainer origin uncertain | Exclude in strict mode; never mislabel as official |
| Issue already fixed on default branch | Skip, record finding, choose next eligible issue |
| Project forbids autonomous/AI contributions | Reject repository or switch to allowed human-only mode only if policy permits |
| Missing `CONTRIBUTING.md` | Check related/docs/org defaults; mark policy unknown where appropriate |
| User lacks toolchain | Report unavailable checks; propose approved setup, never claim tests passed |
| Huge monorepo | Analyze scoped packages only; avoid full-repo ingestion |
| Build scripts require secrets/external services | Do not access secrets automatically; isolate and describe verification gap |
| Dirty working tree | Use new worktree/isolated clone; do not overwrite user edits |
| GitHub API timeout/rate limit | Back off, save state, resume without duplicate operations |
| Cannot fork/push | Explain permission or org restrictions; prepare patch locally |
| Cannot request reviewer | Use normal review flow/CODEOWNERS; report limitation; don't spam |
| Project PR template differs | Follow project template exactly |
| CI fails after PR | Diagnose with permissioned access; request approval before pushing corrections |
| PR closed without merge | Record factual outcome; never claim contribution merged |
| Unknown programming language | Generic adapter and project commands; truthful `UNAVAILABLE` checks |

---

## 12. Scope, milestones, and implementation plan

### MVP — P0 (ship first)

- STDIO MCP integration with Codex CLI and Claude Code; compatibility verification for other MCP clients.
- Three-question onboarding with defaults and local preference persistence.
- GitHub-wide repository + issue search; strict official-author/zero-comment/no-assignee/no-known-PR verification.
- Transparent scoring and **automatic** issue selection.
- Repository policy/AI policy scan; codebase analysis and issue reproduction plan.
- Agent-driven focused patch; generic command runner with tested adapters for main ecosystems.
- Test/lint/type/build evidence and pre-publish eligibility recheck.
- Natural, policy-compliant PR title/description and template completion.
- User-approved fork/branch/push/PR workflow.
- Permission-aware reviewer routing and report.
- Local state, resume, logs, dry run and safeguards.

### v1.1 — P1

- PR review comment and CI follow-up workflow.
- Cross-repository historical acceptance-rate heuristics (clearly labelled estimates).
- Richer competing-PR similarity analysis and duplicate-detection confidence.
- Better monorepo indexing and cached code maps.
- Expanded language-adapter CI tests and user-defined adapters.

### v2 — P2

- Optional hosted dashboard (not required for local-first core).
- Organization-maintained allowlists/acceptance policies and opt-in maintainer integration.
- GitLab/Forgejo support behind forge adapters; GitHub remains initial priority.
- Improved contribution analytics tied to actual merge outcomes.

### Suggested repository structure

```text
contribolt/
├── src/
│   ├── index.ts
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── tools.ts
│   │   └── schemas.ts
│   ├── onboarding/
│   ├── discovery/
│   │   ├── repositories.ts
│   │   ├── issues.ts
│   │   ├── authorship.ts
│   │   ├── linked-prs.ts
│   │   └── ranking.ts
│   ├── repository/
│   │   ├── policies.ts
│   │   ├── indexing.ts
│   │   └── instruction-resolution.ts
│   ├── languages/
│   │   ├── adapter.ts
│   │   ├── registry.ts
│   │   ├── generic.ts
│   │   └── adapters/
│   ├── contribution/
│   │   ├── plan.ts
│   │   ├── quality-gate.ts
│   │   ├── publisher.ts
│   │   └── reviews.ts
│   ├── git/
│   ├── github/
│   ├── security/
│   └── state/
├── prompts/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   ├── contract/
│   └── end-to-end/
├── examples/
├── docs/
│   ├── architecture.md
│   ├── security.md
│   └── language-adapters.md
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

---

## 13. Definition of done and acceptance tests

### Discovery tests

- [ ] New user can start with **no repository or issue URL**.
- [ ] Asks only three onboarding questions (or fewer when preferences exist).
- [ ] Searches multiple repositories matching the selected languages and difficulty.
- [ ] Automatically picks a verified issue rather than demanding a manual shortlist decision.
- [ ] Rejects seeded fixtures with comments, assignees, unofficial authors, linked/competing PRs, or project bans.
- [ ] Saves eligibility evidence and timestamp; unknown data never becomes "verified".

### Contribution tests

- [ ] Finds and follows repository contribution rules, project-specific agent instructions and PR templates.
- [ ] Identifies relevant code/tests and produces a concrete implementation plan.
- [ ] Supports agent implementation without adding a second paid model dependency.
- [ ] Prevents unrelated edits and checks secrets/dirty worktree before commit.
- [ ] Runs actual applicable project checks and reports skipped/unavailable honestly.
- [ ] Rechecks candidate eligibility immediately before publication.

### Language-coverage tests

- [ ] Detection fixtures cover the 12 initial adapter ecosystems plus mixed-language monorepos.
- [ ] Generic adapter works for an unknown-language fixture without crashing.
- [ ] Missing compilers or build dependencies produce accurate `UNAVAILABLE`, not `PASS`.
- [ ] Windows/macOS/Linux command handling covered by CI or documented compatibility tests.

### Publication/review tests

- [ ] Does not publish without approval.
- [ ] Can open a valid PR from an authorized fork with correct issue reference/template.
- [ ] Does not claim a reviewer request succeeded without API confirmation.
- [ ] Handles no reviewer-request permissions and CODEOWNERS gracefully.
- [ ] Never auto-pings unrelated maintainers.
- [ ] Resume after crash cannot accidentally open a duplicate PR.
- [ ] Reports PR `opened` separately from `merged`.

### Product success metrics

**North star:** Number of **review-ready, policy-compliant PRs** produced that pass project checks and are eventually merged (reported separately, not guaranteed).

Track funnel: onboarded sessions -> repositories discovered -> verified eligible issues -> reproducible issues -> validated patches -> user-approved PRs -> PRs passing CI -> maintainer reviews -> merges. Track rejection reasons, duplicate attempts, maintainer complaints and policy violations as **negative metrics**, not just PR volume.

**Initial launch targets (aspirational, to validate in beta):**
- 95%+ of sampled “verified eligible” claims match observed issue metadata at time of check.
- 100% of public GitHub write operations have recorded explicit consent.
- 100% of claimed test passes have verifiable command output.
- 0 deliberate policy-bypassing PRs or repeated unsolicited maintainer pings.
- Successful end-to-end dry-run contributions across at least 6 distinct language ecosystems before broad public marketing.

---

## 14. Product positioning and differentiator

**One-line pitch:** “Answer three questions. Find an unclaimed maintainer issue. Let your coding agent ship a clean PR.”

**Why it is different from an issue finder:** Repository discovery, verified official provenance and work availability, deep codebase investigation, per-repository AI-policy compliance, minimal patch validation, and permission-aware review routing live in one workflow.

**Why it is different from a generic coding agent:** It adds open-source-specific discovery, maintainer-origin filtering, contribution-process compliance, duplicate-PR avoidance, and evidence-based quality gates. The host agent remains the coding engine.

**Distribution:** Open-source GitHub repository, npm package, one-command MCP client configuration, short demo showcasing fully autonomous repo discovery, and clear examples for TypeScript, Python, Rust, Java and other ecosystems.

**What not to optimize:** Raw number of PRs opened, number of lines removed, automated maintainer mentions, undocumented “merge probability,” or superficial claims of invisible AI assistance.

---

## 15. Research references and implementation constraints

Use these live official specifications during implementation and pin/test exact SDK/API versions:

1. MCP tool model and client interaction patterns: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
2. Official MCP specification repository: https://github.com/modelcontextprotocol/modelcontextprotocol
3. GitHub repository contributor guidelines: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors
4. GitHub CODEOWNERS behavior: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
5. GitHub pull request review requests and permissions: https://docs.github.com/en/rest/pulls/review-requests
6. GitHub REST rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
7. GitHub GraphQL rate and query limits: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
8. GitHub pull request templates/standardization: https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests
9. GitHub search documentation: https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
10. GitHub GraphQL API explorer/reference: https://docs.github.com/en/graphql

**Implementation note:** GitHub endpoints, search qualifiers, review privileges and MCP SDK APIs can change. Validate them against live documentation and integration tests rather than copying illustrative queries or interfaces into production unchanged.
