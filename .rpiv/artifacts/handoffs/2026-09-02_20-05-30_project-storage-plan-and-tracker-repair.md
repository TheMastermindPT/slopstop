---
date: 2026-09-02T20:05:30+0100
author: Pedro Mesquita
commit: f4685df
branch: design/ticket-86-project-storage
repository: slopstop
topic: "Project Storage Plan And Tracker Repair Research Handoff"
tags: [research, project-storage, planning, verification, privacy, packaging]
status: complete
last_updated: 2026-09-03T00:24:14+0100
last_updated_by: OpenCode
last_updated_note: "Mark the interrupted repair handoff as superseded after accepted artifact finalization."
type: research
---

# Handoff: Repair Project Storage authorization before Phase 6

> **Superseded 2026-09-03:** This handoff preserves the interrupted verification state that preceded the developer's accepted recovery decisions. Its pending-review instructions are superseded by the completed hash-stamped recovery research and the current ready design and plan. The remaining live gate is artifact publication followed by the prepared tracker transition; no source implementation is authorized retroactively.

## Task(s)
- **Explain what the harness supports now and what should be implemented next**: research drafted. The live source shows supervised process/runtime infrastructure and persistent Project Storage in the dirty working tree, but Workspace producers and packaged persistence remain unavailable.
- **Correct the assumption that all Project Storage phases are complete**: completed. Phase 6 is absent, and prior Phase 4-5 evidence plus schema-authority/privacy obligations remain unresolved.
- **Choose the desired next outcome**: completed. The developer selected finishing Phase 6, but tracker and quality gates show that no implementation is currently authorized.
- **Finalize the research quality gate**: work in progress. Three adversarial rounds corrected several claims, but the latest round still found ordering, privacy-contract, deep-gate, and retention concerns. The developer stopped the review loop and requested this handoff so the next agent can finish it.
- **Implement Phase 6**: not started and currently blocked. Do not implement until the plan is revised, accepted, and issues `#86`/`#87` authorize the work.

## Critical References
- `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md`
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`
- `AGENTS.md`

## Recent changes
- Added `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md:1-205` with the full live-code capability trace, package gap, verification deficits, privacy risks, precedents, and provisional next sequence.
- Updated `.rpiv/artifacts/README.md:12-23` to index the new research artifact.
- No application source, tests, plan, issue, or configuration files were changed in this session.
- Existing Phase 1-5 implementation changes predate this session and remain uncommitted in the dirty worktree. They are not represented by commit `f4685df` alone.

## Learnings
- The live harness supervises an Electron utility process, validates strict trusted root URLs, performs a versioned handshake, correlates requests, distinguishes lifecycle paths, supports manual retry, and retains ordered shutdown (`apps/desktop/src/main/harness-supervisor.ts:60-178`, `apps/harness/src/process-bootstrap.ts:23-98`, `apps/harness/src/harness-runtime.ts:44-138`).
- Persistent Project Storage supports `project.create`, `project.open`, and `project.close`, installation/Project serialization, create idempotency, prior-state witness rejection, independent canonical/runtime health, safe mode, retained sessions, and awaited cleanup (`apps/harness/src/storage/project-storage-store.ts:210-601`, `apps/harness/src/storage/project-storage-opening.ts:192-235`).
- `opened/read-write` currently means a healthy retained Storage session, not a usable product workflow. The databases contain Storage foundation metadata; production Conversation, Frame, and Memory owners still return `WORKSPACE_CAPABILITY_UNAVAILABLE` (`apps/harness/src/storage/canonical-schema.ts:5-40`, `apps/harness/src/storage/runtime-schema.ts:5-40`, `apps/harness/src/workspace-application.ts:237-255`).
- Project Storage correctly remains main-process-only. The production renderer consumes only harness status/retry and does not expose Storage paths or operations (`apps/desktop/src/shared/desktop-api.ts:11-29`, `apps/desktop/src/renderer/app.tsx:63-141`).
- Phase 6 is not implemented. The harness build stages migrations only; Forge lacks native unpack/resource wiring; package smoke proves renderer isolation rather than persistent Storage; and no authorized package-smoke Storage root/scenario module exists (`apps/desktop/vite.harness.config.ts:7-32`, `apps/desktop/forge.config.ts:6-54`, `apps/desktop/tests/e2e/package-smoke.mjs:6-58`).
- Phase 4 still has one unchecked historical red-proof criterion and seven unchecked manual checks; Phase 5 also has an unchecked historical red-proof criterion (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:8683`, `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:8695-8701`, `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:10269`). Historical red evidence cannot be recreated or waived under current `AGENTS.md`; report it as unavailable/broken unless authority explicitly changes the gate.
- Plan concerns C52-C54 remain unresolved. The verifier does not prove exact CHECK expressions, exact partial-index `WHERE` predicates, or rejection of same-name mutated definitions (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11487-11489`, `apps/harness/src/storage/database-schema-verifier.ts:92-109`, `apps/harness/src/storage/database-schema-verifier.ts:192-199`). These concerns need an accepted test contract before coding.
- Privacy is not closed. Sentry sanitizes `frame.filename` but does not explicitly clear `frame.abs_path`; supervisor stdout/stderr and startup errors plus harness uncaught values are logged raw (`apps/desktop/src/main/crash-reporting.ts:35-46`, `apps/desktop/src/main/harness-supervisor.ts:262-285`, `apps/harness/src/process-entry.ts:101-108`).
- Bounded retention is also incomplete: `apps/desktop/src/main/logger.ts:8-15` rotates only at logger startup, so a long-running active log and the retained `.1` file can exceed the intended bound. A future contract must define sanitization, per-record bounds, and runtime rotation behavior before implementation.
- Issues `#86` and `#87` currently block implementation. `#87` remains `needs-info`, is blocked by open `#86`, and requires accepted artifacts, phase order, public seams, file map, and success criteria in its body. Native blockers define the actionable frontier (`docs/agents/issue-tracker.md:27-31`).
- The correct authorization order is: decide contracts, revise/validate/accept the plan, then update/unblock `#86` and `#87`. The current research artifact's numbered sequence reverses its first two steps and must be corrected.
- The accepted strategic solutions memo is not implementation authority. After Project Storage closure, GitHub issue `#85` controls order: canonical writer/fencing/Typed-command settlement, then Board admission/read positions, then real Conversation and Frame owners. Supervised Run/Worker execution is excluded from that issue.

## Artifacts
- `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md` - new research artifact; drafted but latest quality gate is not clean.
- `.rpiv/artifacts/README.md` - updated research index.
- `.rpiv/artifacts/handoffs/2026-09-02_20-05-30_project-storage-plan-and-tracker-repair.md` - this handoff.

## Action Items & Next Steps
1. Correct the research artifact's remaining findings:
   - State that contract decisions and plan revision/acceptance precede tracker unblocking.
   - Remove any suggestion that missing historical reds can receive a routine exception; report the evidence gap accurately.
   - Define the prerequisite closure as a revised pre-Phase-6 phase so “Phase 6 next” is not contradictory.
   - Add the startup-only rotation/retained-file growth risk.
   - Add `pnpm check:deep` to terminal verification expectations.
2. Obtain explicit decisions for the missing schema and privacy contracts. Do not invent CHECK normalization, partial-index predicate normalization, exception sanitization, output truncation, per-record limits, or runtime rotation thresholds.
3. Revise `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` using the plan-revision workflow. Add a prerequisite closure phase with public test seams and success criteria for C52-C54 and all privacy/bounded-log requirements; record Phase 4 manual checks and unavailable historical-red evidence truthfully.
4. Validate and accept the revised plan before changing tracker authorization.
5. Update issue `#86` with accepted artifacts and resolution, then revise issue `#87` with the accepted phase order, seams, file map, and success criteria. Confirm native blockers and `needs-info` are cleared.
6. Only after authorization, implement the prerequisite closure phase under strict red-green-review. Preserve the current dirty worktree; never reset, clean, or overwrite the existing Phase 1-5 changes.
7. Implement Phase 6 native packaging and packaged persistence proof from the revised plan.
8. Run all required terminal gates, including `pnpm check`, focused integration/package proof, `pnpm check:architecture`, `pnpm package:smoke`, and `pnpm check:deep`.
9. After Project Storage closure, return to issue `#85` rather than jumping directly to active-Project UX, Conversation-first assumptions, or Worker execution.

## Other Notes
- Current repository state: branch `design/ticket-86-project-storage`, commit `f4685df`, dirty worktree. A quality-gate reviewer counted 59 modified/untracked paths, including existing Project Storage source and tests. Verify with Git before editing, but do not revert unrelated or preexisting changes.
- The latest quality-gate evidence reviewer was cancelled while two other reviewers completed. Earlier evidence passes verified the main supervision, Storage, Workspace-unavailable, renderer-boundary, shutdown, privacy, and missing-Phase-6 claims.
- The current research artifact declares `status: complete`, but its quality gate is not clean and it has no final `Content Hash:`. Keep it provisional until the remaining findings are fixed and three fresh reviewers return no blockers or concerns.
- `system.failure` blocks automatic recovery and kills the child, but explicit manual retry remains available (`apps/desktop/src/main/harness-supervisor.ts:60-79`, `apps/desktop/src/main/harness-supervisor.ts:151-164`).
- Package smoke already requires packaged, non-prototype mode plus `SLOPSTOP_PACKAGE_SMOKE=1`; the missing control is authorization of the Storage root/token/marker/scenario, not the absence of all smoke gating (`apps/desktop/src/main/main.ts:46-80`).
- Do not describe Phase 5 or Project Storage as fully complete until privacy, prior evidence, schema-authority, and package-proof obligations are resolved.
