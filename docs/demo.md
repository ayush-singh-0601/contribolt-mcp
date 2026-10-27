# Reproducible demonstration

This is a controlled terminal demonstration with fixture forge responses. It shows the workflow and actual native checks; it does not discover live issues or publish a real PR.

```sh
npm run build
python3 scripts/smoke-stdio.py
CONTRIBOLT_EVIDENCE_DIR=docs/evidence/native npx vitest run tests/multilanguage-e2e.test.ts
npx vitest run tests/workflow-e2e.test.ts
```

The transport smoke test prints JSON with `status: "PASS"`, the actual transport, 21 tools, six prompts and zero public writes. It also checks onboarding defaults, resources, denied publication and stop/resume. Add `--require-sdk` to forbid compatibility fallback and `--require-sdk --modern` to exercise the current protocol. A successful language run prints, for example, `Python: FAIL baseline -> PASS regression -> PR dry-run preview; zero public writes`. Inspect the saved JSON for the actual failing/passing native output and the fixed source in the fixture. Test duration depends on available toolchains.

In an interactive supported client, start with “Find me an open-source contribution”, supply two or three preferences, and observe the selected repo/issue with its as-of time and evidence. The host follows the prompts into policy/code analysis, reproduction, a scoped source edit, actual tests and an independent diff critique. Inspect the full PR preview. A dry run ends there. A real publication requires a fresh exact approval in a human terminal and current remote checks.

Interrupt after analysis and use `resume_session` to inspect the saved plan and next safe action. Try publishing without a grant: it must be refused. The controlled workflow test also introduces a new comment and changed issue requirements after approval and asserts zero public writes. It then exercises recovery/publication and a separately approved revision against mocked API confirmations. Those observations remain distinct from live-host and live-forge qualification.
