---
date: 2026-09-01T19:56:25+0100
author: Pedro Mesquita
commit: f4685df
branch: design/ticket-86-project-storage
repository: slopstop
topic: "Project Storage Opening Implementation Handoff"
tags: [implementation, handoff, storage, protocol, harness, electron]
status: complete
last_updated: 2026-09-03T00:24:14+0100
last_updated_by: OpenCode
last_updated_note: "Mark the original implementation handoff as superseded by the accepted prospective recovery plan."
type: implementation_strategy
---

# Handoff: Implement Project Storage Opening

> **Superseded 2026-09-03:** This handoff preserves the original planning and implementation record only. Its hashes, C51-C54 timing, authorization, and action items are superseded by `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md` and the current hash-stamped design and plan. Do not execute this handoff or treat the dirty Phase 1-5 Green state as authorized evidence.

## Task(s)

- **Completed**: Designed Project Storage identities, protocol, staged creation, opening health, retained sessions, trusted Electron bootstrap, native packaging, and packaged proof.
- **Completed**: Produced and finalized the six-phase implementation plan at `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`. It is `status: ready` with stamped hash `a10335861e264be23592455b7da74ff14a75324e24e52fbcdd0540b263cc8a80`.
- **Completed**: Finalized the source design at `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md`. It is `status: ready` with stamped hash `5497a76a2975465f9326ca6703a3c2a77796f7f9c955e16e971934cec34e813e`.
- **Not started**: Production implementation. No source, test, package, or lockfile changes were made in this planning session.
- **Next**: Implement the ready plan sequentially, beginning with Phase 1. Use `/rpiv:implement .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md Phase 1` after resuming this handoff.

## Critical References

- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` - implement-ready source of truth; six phases, exact code shape, Test Contracts, Success Criteria, and triaged review table.
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md` - locked architectural decisions and final merged code shape.
- `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md` - validated storage/opening research and rationale.

## Recent changes

- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md:9-13` - marked design `ready` and stamped its final content hash.
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md:10606-11124` - synchronized the six approved slices and their red-green contracts.
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:9-13` - marked plan `ready` and stamped its final content hash.
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:104-11390` - finalized six sequential phases, emitted code, tests, wiring, package proof, and success criteria.
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11391-11489` - recorded all review outcomes; C48-C50 are applied and C51-C54 are explicitly deferred implementation obligations.

## Learnings

- Architecture boundaries are binding: Kernel owns framework-independent behavior; Protocol owns versioned Zod process contracts; Harness owns persistence, Drizzle, libSQL, process execution, and Project sessions; Desktop accesses Harness only over protocol/session boundaries.
- Project Storage behavior is deliberately fail-closed. `project.open` never creates, migrates, repairs, deletes, or compares mutable database bytes with activation checksums. Genuine broken state must never degrade to clean absence.
- Creation is staged and durable. `createRequestId` is part of replay authority; any registry/filesystem witness blocks fresh allocation unless the exact active request can be replayed.
- Shutdown is asynchronous end-to-end inside the Harness. Owner, application, runtime, process entry, supervisor, and Desktop quit paths must preserve cleanup completion/failure rather than killing the child immediately.
- Package smoke uses one marker-authorized temporary root, an unpredictable token, a negative authorization matrix, and three valid launches. Electron main remains bridge-only for Storage scenarios; the external E2E fixture prepares persistence witnesses only after child close.
- The planning review became intentionally bounded. Do not restart an open-ended architecture audit. Implement the approved plan and use each phase's Test Contract and Success Criteria as the execution gate.

## Artifacts

- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md`
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`
- `.rpiv/artifacts/handoffs/2026-09-01_19-56-25_proximo-agente-implementacao.md`

## Action Items & Next Steps

1. Read root `AGENTS.md`, `PRODUCT.md`, `CONTEXT.md`, `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`, and applicable ADRs before editing boundaries.
2. Confirm branch `design/ticket-86-project-storage`, base commit `f4685df`, and current worktree. The design and plan are currently untracked; preserve them and do not overwrite them.
3. Load `rpiv-implement` and start exactly at Phase 1: `/rpiv:implement .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md Phase 1`.
4. Before Phase 1 green, resolve C51 at plan line 11486: add exhaustive `already-registered`, `prior-state-witness`, and `idempotency-conflict` reason-to-diagnostic success/contradiction tests.
5. Before Phase 3 green, resolve C52-C54 at plan lines 11487-11489: compare normalized authoritative CHECK expressions, compare partial-index predicates, and test same-name altered CHECK/index/foreign-key definitions.
6. Work one vertical phase at a time. For every Behavior, first create the named public-seam test, observe and record the exact Expected red, implement minimally to green, then perform a separate review/refactor gate.
7. Run the smallest named Vitest command during red-green. Run each phase's complete Automated and Manual Success Criteria before marking it complete.
8. Preserve phase order: identities/protocol; application/dispatch; staged creation; opening/session lifecycle; Electron bridge/bootstrap; native packaging/package proof.
9. On terminal Phase 6, run the plan's deep gates, including `pnpm check`, integration tests, architecture validation, generated migration checks, and `pnpm package:smoke`. Never weaken a gate.
10. After implementation, run `/rpiv:validate .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` for the final phase-by-phase proof audit.

## Other Notes

- Official artifact validation succeeded with `validate-artifact.mjs --finalizing --stamp` for both design and plan. The ordinary RPIV write hooks often reported Node unavailable, but explicit `node` invocation succeeded.
- Both finalized artifacts are currently untracked (`??`) in Git. No commit was requested or created.
- Do not import Harness source into Desktop, add renderer/preload Project Storage APIs, expose filesystem paths, leak caught error text, or place project databases under the source repository.
- Expected failures cross boundaries as stable discriminated results. Unexpected failures are caught once at process boundaries and use generic path-free diagnostics.
- New persistence tests should use temporary roots outside the source repository and real libSQL integration seams where the plan specifies them.
