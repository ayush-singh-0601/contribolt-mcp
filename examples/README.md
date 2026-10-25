# Controlled contribution examples

`dry-run-fixtures.json` contains six intentionally broken regression fixtures: Python, Rust, Java, C, Shell and Perl. Each includes contribution guidance, an explicit native test command, a failing baseline and the smallest focused source correction. There are no external dependencies or public-write commands. Java, Rust and C use their native compilers through documented commands; these examples exercise the generic command fallback rather than claiming Maven, Cargo or CMake ran.

From a source checkout, run:

```sh
MERGEPILOT_EVIDENCE_DIR=docs/evidence/native npx vitest run tests/multilanguage-e2e.test.ts
```

Each test uses a real temporary Git repository, controlled responses for two discovered repositories, strict eligibility, actual native failing/passing checks, host-applied source edits, an independent fixture diff review, PR preparation and a zero-write dry-run preview. Missing tools report a skip. Logs/statuses are exported only when the evidence directory is explicitly set. The six local results are under [docs/evidence/native](../docs/evidence/native/). They are fixture evidence, not real maintainer issues or PR outcomes.

Use `python3 examples/materialize.py Python /tmp/counter-baseline` to inspect one fixture. Its test is expected to fail. Add `--fixed` with a different empty destination to inspect the corrected version. Review every script before running it through your approved environment. No toolchain installation is performed.

## TypeScript example

A TypeScript repository may use Node 24's supported erasable type syntax and its own package scripts, or its established compiler/test runner. A minimal implementation could be `export const increment = (value: number) => value + 1`, with regression checks for positive, zero and negative inputs. MergePilot discovers scripts from package.json and honors packageManager/lockfiles; it does not replace the project's conventions. The JavaScript/TypeScript adapter fixture covers npm/pnpm/yarn/Bun/Deno planning. The local managed environment's nested Node execution needs separate native qualification; it is not included among the six successful examples.

## Short demonstration

The deterministic demonstration is [docs/demo.md](../docs/demo.md). The full publish-and-revise fixture is `tests/workflow-e2e.test.ts`: it asserts rejection before approval, no write when an issue changes, one confirmed fixture PR, separate revision approvals and a factual observed merge. Its public push boundary and forge responses are mocked. No live PR, maintainer ping, merge or real-host agent run is implied.
