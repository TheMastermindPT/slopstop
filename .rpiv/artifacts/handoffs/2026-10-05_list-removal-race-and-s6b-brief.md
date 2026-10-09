---
date: 2026-10-05
author: coordenador-claude (Claude Code), for the implementer agent
repository: slopstop
status: complete
status_note: "2026-10-10: both items landed on main, the race fix at 7058508 and S6b at bb83ad2 (15 cases, coordinator-agreed set)."
tags: [pc-s1, remove-from-list, race, tests, s6b]
---

# Brief: close the list-removal race, then cut the S6b permutation tests

Authority: `.rpiv/artifacts/evidence/2026-10-03_pc-s1-guarantee-scope-decision.md`, section 16 (user decisions of 2026-10-05).

## 1. Check-then-hide race (option A, first)

- **Fault.** `createListRemoval` (`apps/harness/src/registration/list-visibility.ts:69-80`) reads `activeProjectId()` and then opens the registry transaction that hides the Project. An activation of the same Project can land between the two, so the open Project ends up hidden from the list.
- **Required behaviour.** Remove-from-list of a Project that is active, or whose activation is admitted before the removal settles, answers `rejected` / `PROJECT_ACTIVE` and leaves the list unchanged. An activation requested after a removal settles proceeds normally. Busy and broken stay distinct.
- **Approach.** Run the active check and the hide inside the coordinator's existing serialisation (the queue that orders activation), so nothing can land between them. Keep the guard in one place. Do not add a new lock beside the coordinator.
- **Proof.** First a failing behaviour test at the harness runtime seam that reproduces the interleaving deterministically (hold the activation or the removal at a controllable point; no sleeps). Then the minimal fix, green run, separate review/refactor. If the test needs the real registry database, it lives under `apps/harness/tests/integration/`.

## 2. S6b: native permutation tests, about 32 to about 8

- Keep one case per distinct behaviour; drop cases that only repeat a behaviour through another permutation.
- Kept cases keep their exact assertions. Report the before and after case lists, and for every dropped case, which kept case covers its behaviour.
- No oracle, timeout or threshold changes. Coverage thresholds must still pass.

## Method and gates

- Feature branch from current main. One slice at a time, red then green then review/refactor. New harness code follows the Effect conventions (`handoffs/2026-10-04_pc-s1-completion-brief.md`, Method).
- Send the coordinator a short plan (seam, files, risks) before code.
- Run `pnpm check`, the touched suites and the integration project for touched areas. CodeScene on touched files; jscpd at 0. No `--no-verify`.
- Report to `coordenador-claude`.
