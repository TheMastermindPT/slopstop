---
date: 2026-10-04
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
status: open
tags: [testing, gate, vitest, coverage, pre-existing]
---

# Vitest coverage gate: pre-existing worker crash and baseline comparison

## Pre-existing defect: Vitest fork worker crash
- Symptom: `Error: [vitest-pool]: Worker forks emitted error` / `Caused by: Error: Worker exited unexpectedly`; the affected test file does not run, so the gate fails.
- Environment: Vitest 4.1.10, Node 24.20.0, Windows 11.
- Seen in 2 of 4 partial coverage runs of the three registration integration files: at `11b1989` (pre-Effect) it lost `registration-list.integration.test.ts`; at `667bc44` it lost `registration-bootstrap-guards` and `registered-project-selection`. Not seen in 1 full base coverage run nor in the full HEAD runs. Also seen on main's `pnpm check` (unit tests) under load on 2026-10-04.
- Classification: **pre-existing**, not caused by the Effect migration; root cause unknown (candidate class: native crash of a test process using the libSQL worker/native modules). Earlier native-handle fixes (2a "C") reduced, but did not eliminate, unexpected exits.
- Follow-up: diagnose with a bounded investigation after the merge; create a GitHub issue only when the user asks.

## Coverage gate baseline (`pnpm test:coverage`, machine free)

| Revision | Failed tests | Assertion failures | Timeouts | Duration |
| --- | --- | --- | --- | --- |
| `11b1989` (before Effect) | 187 in 11 files | ~180 (suites later fixed by the migration) | 2 test (15 s) + 3 hook (10 s) | 499 s |
| `667bc44` (Effect HEAD) | 4 in 3 files | 0 | 4 test (15 s) | ~471 s |

- The coverage gate was **never green** before the migration. The `registered-project-selection` "runtime switches between two registered Projects" timeout already existed at the base.
- The remaining four timeouts occur only with V8 coverage instrumentation and all 89 files in parallel; in isolation the same tests take ~7–11 s with coverage (HEAD 5–15% slower than base).
- User decision (2026-10-04): **option A**, i.e. reduce parallelism only for the coverage run, keeping every test, assertion, timeout and threshold. Making the heavy registration tests lighter (option C) stays as a later improvement. Raising timeouts was not chosen.
