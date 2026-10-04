---
date: 2026-10-04
author: coordenador-claude (Claude Code), for the implementer agent
repository: slopstop
status: approved-to-plan
tags: [pc-s1, add-repository, ui, remove-from-list, windows]
---

# Brief: finish the reduced PC-S1

## Authority

- `.rpiv/artifacts/evidence/2026-10-03_pc-s1-guarantee-scope-decision.md`:
  - section 1: retained guarantees and changes B1–B4;
  - section 8 (UI additions): the default name and "Remove from list" option A.
- Approved prototype: `.rpiv/artifacts/prototypes/pc-s1-add-repository/` (commit `80a7256`, lint fix `81b22a1`). It defines the screens, states, wording and focus behaviour. Its notes (`Q1`…) map to the questions answered in the decision log.
- `PRODUCT.md`, `CONTEXT.md`, ADR 0006, the AGENTS.md architecture rules (the renderer reaches the harness only through the preload API) and the AGENTS.md test discipline.

## Remaining scope

1. **Add-repository UI**, in the real Electron renderer and following the prototype:
   - the add-existing-repository flow;
   - two-stage Git consent;
   - per-folder trust;
   - preparation and confirmation;
   - the outcomes `already-registered` (with an Open action), `belongs to Project P` for a linked worktree (B1), recovery-required shown but not actionable (B2), and the Linux refusal (B4);
   - the busy and broken registry states, kept distinct (PC-B7);
   - the default Project name, which is the worktree root folder name and is not editable.
2. **Remove from list (option A).**
   - It hides a non-active Project from the saved list, after an explicit confirmation.
   - The Project's Ragnarok data is kept, and the Git repository is never touched.
   - When the registry is busy or broken, the list stays unchanged and the error is shown distinctly.
   - Re-adding the same folder returns the same Project, without creating a duplicate.
   - This needs a harness command, a protocol schema, preload exposure and UI.
3. **Reduced observer limit matrices (B3).** Cover one case per limit and one precedence combination per family. The limits and precedence rules themselves stay identical.
4. **Packaged proof.** The packaged app must register a repository and list it. Use `package:launch-smoke` and extend it if needed.
5. **Authorized integration.** This happens at the end, through the coordinator and with the user's approval.

## Method

- **Effect conventions, as the migration set them.**
  - Harness: new code is written as Effect programs on the harness runtime and Layers, with typed errors.
  - Protocol: Effect Schema, decoded through the strict policy.
  - New SQL: written as Effect programs over the current libSQL worker, not as `async/await` bodies.
  - Promise boundaries: only those the migration already justified.
  - Desktop and renderer: keep their current pattern.

- **Plan first, without code.** Send the coordinator a vertical slice plan of 3–7 slices, each with:
  - its behaviour;
  - its public test seam;
  - its files;
  - its risks.

  Start building only after the coordinator approves the plan.
- **One slice at a time.** For each slice: a failing behaviour test at the agreed seam, the minimal implementation, a green run, and then a separate review/refactor step. Run CodeScene on the touched files and keep jscpd at 0.
- **E2E proof.** Electron journeys go in `apps/desktop/tests/e2e/` and drive the renderer through the real preload API.
- **Checkpoints.** Commit at every slice checkpoint, on a feature branch from current main.
- **Gates.** The libsql crash is parked, so do not run `check:deep`. Run `pnpm check`, the touched suites and the e2e tests, and report what was not run.
- **Rules.** Do not change oracles or timeouts. No `--no-verify`.
- **Product questions.** Bring every product question to the coordinator. Do not invent answers.
