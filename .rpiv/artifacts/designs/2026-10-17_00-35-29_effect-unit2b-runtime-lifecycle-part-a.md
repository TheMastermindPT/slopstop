---
date: 2026-10-17T00:35:29+0100
author: Pedro Mesquita
commit: cb84fe8
branch: main
repository: slopstop
topic: "#123 Part A: Effect Unit 2b runtime and lifecycle (fair lock, bounded authority close, one ManagedRuntime per process, desktop bridge core, #96)"
tags: [design, effect, harness, electron-main, managed-runtime, layer, shutdown, fair-lock, project-storage-locks, application-database, desktop-bridge, harness-supervisor]
parent: .rpiv/artifacts/research/2026-10-16_23-40-39_effect-unit2b-runtime-lifecycle-part-a.md
lane: normal
lane_reasons: ["slices: 6 > 1", "files: 16 > 5", "diagnostic: lines unknown", "diagnostic: hub signal unavailable", "design: 8 slices"]
status: in-review
last_updated: 2026-10-22T21:45:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "s9 built (Q1 (a), harness-only; forwarding deferred to #133), evidence linked. Earlier: s9 u2b-s9-harness-fatal-diagnostics added after the Part A deep review (§140: I1 (a) with Q24/Q27, Q25 cheap ordering pin, Q33 (b)): U2B-FD-B1..B3, lane normal, Q1 visibility for Pedro; awaits Pedro approval. Earlier: s8 detailed just in time (§138): U2B-SD-B1..B4, lane normal proposed, Q1-Q4 for Pedro; awaits Pedro approval. Earlier: s7 candidate round 2 closed (§137): K12 c8a72d1-intent mapping ratified by Pedro, L2/L3 residuals, records only; next scoped mutation, Manual Windows check, acceptance. Earlier: s7 candidate round-1 fix round (§137, D1 (a) ratified): S7-K1 records, K2-K18 rows, bindings, refactors and the default Stryker cleanup, step 10; awaits Pedro approval. Earlier: s7 intent cap (§137): S1-S11 applied without a third round (unreviewed residual), S1 (a) core observer; awaits Pedro approval. Earlier: s7 intent round-1 fixes S7-R1..R29 applied (§137, R7 accepted): BC-B1..B10; intent round 2 (last). Earlier: s7 decisions recorded (§137): P-S7-1 (b), P-S7-2 (a) B9 in, P-S7-3 (a), P-S7-4 (a); intent review round 1. Earlier: s7 detailed just in time (§136), BC-B1..B9, lane rigorous. Earlier: s6 mutation closed (§135): 94.23, 3 killed by restructure, 10 declared equivalents, post-review delta residual; awaiting Manual checks and Pedro acceptance. Earlier: s6 short review decisions (§135, b051fa3): F1 ratified, M1 (b) reportFailure required, K16 reading, M4/M5 residuals, step 10. Earlier: s6 candidate round-2 cap (§135): fix round 2 for L1-L11, L3 (a), short confirming review scope (step 9); awaits Pedro approval. Earlier: s6 candidate round-1 fix round (§135): K1-K6, K8-K12 rows, K13 check, step 8; K7/K14/K15 records; awaits Pedro approval. Earlier: s6 intent cap (§135): J1-J22 applied without a third round (unreviewed delta), J7 mutation exception, candidate review = round 1 + one fix round + round 2; awaits Pedro approval. Earlier: s6 intent round-1 fixes S6-I1..I28 applied (§135: I12 (a), I15 (a), I10 (a)); intent round 2 (last). Earlier: s6 decisions folded in (§135): P-S6-1..5, measure-first dispose bound (opening step 0), Architecture correction; intent review round 1. Earlier: s6 detailed just in time, DR-B1..B7, lane raised to rigorous (ipc). Earlier: s5b round 2 closed at the cap (§134, accept with risks): R2-3 B12 red, R2-4 CodeScene debt, R2-6 mutation scope, residuals R2-1/R2-2/R2-7; awaits Pedro approval. Earlier: s5b candidate round 1 (§134): B2 re-observation, B10-B13, AGENTS.md:78 wording, R1-10, round-1 order of work; awaits Pedro approval. Earlier: s5b Test lines for U2B-EG-B6, B7, B9 added (format only, slice-preflight no-test-line); awaits Pedro re-approval. Earlier: s5b u2b-s5b-effect-gate added just in time (§134: curated Effect config, tsc-mode gate in pnpm check with canary and waiver register, 13 error-level fixes, 9 newPromise waivers); awaits Pedro approval. Earlier: s5 mutation rows M1 (kill harness-runtime.ts:344 survivor) and M2 (throwing workspace unsubscribe, NoCoverage :438-439) added, test-only, scoped rerun (§132 follow-up); awaits Pedro approval. Earlier: s5 candidate round-2 triage applied (§132: V1 settleClose without concurrency + exception, V2/V5/V6 test pins, V3 eager startStop settle, V4 residual; no third round, unreviewed delta residual); awaits Pedro approval. Earlier: candidate round-1 triage (17:35); document fixes (17:05)."
content_hash: e0cf6effc94a0d6e65425dd4fa5652bd0f4e811173c786d3b42458207ac4c299
---

# Design: #123 Part A — Effect Unit 2b runtime and lifecycle

Lane: feature lane normal. The research measured it with `lane.mjs --paths` (16 files, 6 slices), and the design raises the slice estimate to 8, which keeps it normal. Pedro raised slices s1, s3 and s5 to **rigorous** (decisions log §104 P6, as for #110 in §73); the other slices stay normal. For slice 1, `lane.mjs --paths` reports `fast` (4 source files; tests are not counted), so its lane is the user raise: **rigorous**.

## Intent

**Outcome.** The harness and the Electron main process each get one Effect runtime. That runtime is the real owner of each process's lifecycle, not just the place that builds its services. A slow or broken close never hangs either process. The FIFO order between callers is guaranteed inside Effect, not only at the Promise edges. C2 (streaming and cancellation) can then build on one Effect bridge core instead of three Promise copies.

**Scope.** The scope is #123 Part A as decided in decisions log §102 and §103 (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:890-908`):
1. A fair lock, so the FIFO order holds inside Effect. It fixes two barging defects: one in `inSlot` (the canonical writer) and one in the registration flow steps. The #110 order pins are ported. The `ProjectStorageLocks` surface is narrowed.
2. One storage-failure guard (shared-vocab-union).
3. A bounded close for the ApplicationDatabase authority, with a truthful "close not confirmed" outcome. The authority is never stopped when Storage was withheld. The Layer safety-net release is order-free.
4. The test-only standalone authority leak is closed.
5. One harness `ManagedRuntime` that runs the explicit shutdown program and the transport edge, then disposes. The listing stop chain moves to Effect and its facade is removed. Disposal is observed and bounded.
6. One Electron-main `ManagedRuntime` built from Layers: logger, supervisor and session, and the bridges. Disposal finishes before quit or exit. An IPC request after disposal answers `unavailable` and never hangs.
7. One Effect desktop bridge core, with the drift between the three bridges removed. A read during a protocol error answers `broken`.
8. #96: a bounded wait for the harness stdout to end on quit.

**Non-goals.**
- The SQL-body pass, and every facade whose callers this part does not fully migrate. That includes the four-level conversation-save nesting, the Storage owner stop (which has three Promise callers), `retryable-attempt`, `project-storage-application-client`, and the authority's Promise admission interface (§103.4). They go to Part B.
- A protocol cancel command and multi-event replies (§103.6), which belong to C2.
- Product-contract changes beyond the decided envelopes.

**Constraints.**
- AGENTS.md "Effect Usage (effect 4)".
- `.rpiv/decisions/degrade-distinguishes-broken.md`.
- `.rpiv/decisions/shared-vocab-union.md`.
- The lifecycle plan rules: no guessed universal order, same-turn admission closure, remove replaced coordination rather than wrap it (`.rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md:25, 38-40`).
- The settlement timing of the bridges and of desktop shutdown is a tested contract (precedent `f810132`).

## Architecture

### Ownership after Part A
- **Harness process.**
  - One `ManagedRuntime`, built from the existing Layer graph (`apps/harness/src/process-bootstrap.ts:262-269`).
  - Owners at real ownership boundaries:
    - `ApplicationDatabase`: one per process.
    - `ProjectStorage`, the shared owner, with its own lock set.
    - `ProjectRegistration`.
    - `CanonicalProjects`.
  - The per-call listing and registration-bootstrap Storage owners stay plain per-call values with their own locks. They are never Layer-provided, so memoization cannot merge them with the shared owner (research §4).
  - The shutdown program stays explicit (§103.1). It is `shutdownAfterIntake` (`apps/harness/src/harness-runtime.ts:143-164`), unchanged in its order rules and now run with `runtime.runFork`. Because `runtime.runFork` starts synchronously once the context is cached (`node_modules/effect/src/ManagedRuntime.ts:348-351`), same-turn admission closure is kept.
  - `dispose` runs after the program settles, and it only runs order-free releases.
- **Electron main process.**
  - One `ManagedRuntime` built from Layers: `DesktopLogger`, `HarnessSupervision` (the supervisor and the session it owns), and the bridges, which become one `HarnessBridges` service over one core. Today these are module-level variables (`apps/desktop/src/main/main.ts:53-74`).
  - *Corrected by S6-I15 (Pedro, §135):* s6 builds the three bridges as three services (`ProjectEntryBridge`, `ProjectStorageBridge`, `WorkspaceBridge`). s7's bridge core merges them into the one `HarnessBridges` service.
  - `createDesktopShutdown` keeps its controller contract (`desktop-shutdown.ts:5-20`) and its pinned timing (`desktop-shutdown.test.ts:20-43`).
  - Its stop program runs on the runtime and then awaits `dispose` before `finish` calls `quit`/`exit`, because the `preventDefault` window (`desktop-shutdown.ts:79-84`) is the only window that is held open.
  - *Corrected by P-S6-5 (coordinator, §135):* the stop program does not run on the runtime. It keeps its own requirement-free `Effect.runPromise` edge (`desktop-shutdown.ts:47`), because running it on a runtime that was never built would build the whole Layer, logger and supervisor included, during a failure exit. Dispose is the program's last step, before `finish` calls `quit`/`exit` (s6 design point 2).
  - The writer-proof and lock-refusal paths never build the runtime, because the layer is built lazily (`ManagedRuntime.ts:310-325`).
- **Renderer:** unchanged. It runs no runtime.

### Fair lock (slice 1)
- **Owner:** `apps/harness/src/storage/permit-lock.ts`, which already owns "a single-permit lock in arrival order" (:3).
- **State:** a held flag and a FIFO array of waiter `Deferred`s. The waiter is registered in the same synchronous step that checks the lock.
- **Release:** if a waiter exists, release completes the head waiter with `Deferred.doneUnsafe`. Ownership passes without ever exposing a free permit. Otherwise it clears the held flag. `Deferred.doneUnsafe` resumes waiters inline and in order (`node_modules/effect/src/Deferred.ts:1649-1663`), so the hand-off does not depend on the releasing fiber's dispatcher. Effect's `Semaphore` does depend on it (`Semaphore.ts:264-275`).
- **Hand-off invariant (Q3, §106):** release removes the head waiter from the queue and completes its `Deferred` in one synchronous step. No caller can observe or interrupt a dequeued waiter whose `Deferred` is still pending, and this is what keeps the R6 branch unreachable. A non-nesting hand-off (for B8 (b)) may defer the *resumption* of the next holder, but never the dequeue and completion.
- **Interruption:**
  - A waiter interrupted before hand-off removes itself from the queue.
  - A waiter interrupted after hand-off releases the lock again, so the permit passes on. This branch is defensive. Because `Deferred.doneUnsafe` resumes the waiter inline, the only window between hand-off and resumption is the waiter's own finalizers, which the public seam cannot reach. It has no oracle, and its mutants are triaged as expected survivors (residual R6, decisions log §105; precedent: the #110 lock-table cleanup residual).
- **Re-entry and depth:** a holder that starts a non-awaited `withPermitEffect` on the same lock queues behind itself. An awaited re-entrant call deadlocks itself; that is by design, and callers must not do it. Hand-off must not grow the stack with the queue length, so a long queue of synchronously completing holders must finish without a `RangeError` (U2B-FL-B8).
- **Surface (shape only):**
  - `createPermitLock(): PermitLock` (unchanged name);
  - `withPermitEffect(lock)(effect): Effect<A, E, R>` for in-fiber callers;
  - `withPermit(lock, operation): Promise<A>` kept as the Promise facade for the callers that Part A does not migrate. These are the coordinator lifecycle queue (`active-project-coordinator.ts:507, 540-549`) and the store's Promise `locks` (`project-storage-store.ts:253-257`). The facade keeps the start deferral pinned at `project-storage-locks.test.ts:97-113`.
- **Users moved onto it:**
  - `ProjectStorageLocks` `forCreate`/`afterCreateDrain`/`forProject` (`project-storage-locks.ts:55-64`) and its facade (:81-91);
  - the canonical writer slot (`canonical-project-writer.ts:112-118, 129-130`);
  - the registration flow `steps` (`registration/project-registration-flow.ts:185, 194`).
- **Not moved:** the authority's two semaphores (`application-database-authority.ts:127-128`) are already FIFO through `runSync` release. They stay until the authority's Promise interface migrates in Part B.
- **Surface narrowing:** `ProjectStorageLocks` exposes only `forCreate`, `afterCreateDrain` and `forProject`. `createPermit` and `retainProject` (:51-54) become module-private helpers that serve the facade. Each retain is released exactly once by construction (`acquireUseRelease`, or the facade's single `finally`). No idempotent-release flag is added, because no seam could observe it (R13, §105). This closes #110 U6.

### Storage-failure guard (slice 2)
One exported `isKnownStorageFailure` in `apps/harness/src/storage/project-storage-node-errors.ts` replaces three copies:
- `isKnownStorageError` (:37-42);
- `isStorageFailure` (`project-storage-node-registry.ts:60-64`);
- the inline pair in `project-storage-upgrade-node-adapter.ts:558-559`.

Identity is proven first (research §6). Its value is the union, which is the same predicate.

### Bounded authority close (slices 3–4)
- **Stop outcome:** `ApplicationDatabaseAuthority.stop` becomes memoized (at the base, each call returns a new promise; T12, §114). It now resolves only with a confirmed close. When the drain misses the deadline, it rejects with a new typed `ApplicationDatabaseCloseUnconfirmed` (pattern: `RegistrationCleanupUnconfirmed`, `registration/registration-listing.ts:13-25`). It never reports "closed" late (§103.2).
- **Deadline:** an Effect timeout inside the authority, with the deadline as an input that defaults to `APPLICATION_DATABASE_CLOSE_DEADLINE_MS` = 1 000 ms (§104 P1). Slice 3 opens by measuring the close, idle and under the #94 burst, with the coordinator's GO. If the measured p99 is above 500 ms, the slice stops and Pedro decides.
- **Withhold:** the runtime keeps today's rule: when Storage was withheld, it does not call `stop` (`harness-runtime.ts:153-155`). The runtime aggregate keeps the order intake, Storage, listing, database (:156-161).
- **Layer safety net:** the `ApplicationDatabase` Layer gets an `acquireRelease`. The acquire stays synchronous, so `runtime.runSync` extraction keeps working (research §1). The release asks the authority to `closeIfNeverStopped`. That is a no-op when the program stopped the authority or withheld it. Only when no shutdown program ran (the bootstrap-failure path) does it run a bounded stop. The release reads only the authority's own state, so it does not depend on the order of other finalizers (§103.1).
- **Standalone authorities (slice 4):** a registry that created a standalone authority through `applicationDatabaseFor` (`registration/registry-database.ts:44-67`) owns it. `registry.stop` stops it with the bound and removes its WeakMap entry, so a restart that reuses the same options object gets a fresh authority. This addresses the restart hazard in the seam inventory: `registration-repository-trust-cases.ts:533-535` and `registration-preparation.integration.test.ts:97-103`. Injected authorities are never stopped by the registry (the precedent is `project-storage-node-adapters.ts:156, 348`).

### Harness runtime (slice 5)
- **Runtime edges:**
  - The stop facade's fork (`harness-runtime.ts:395`) runs on the process runtime, and so does the transport edge (:300). `startHarnessRuntime` receives a run function.
  - The returned `StopHarnessRuntime` keeps its type, its promise identity and its re-entry contract (`harness-runtime-shutdown.test.ts:23, 90`).
- **Listing stop chain:**
  - `createRegistrationListing.stop` becomes an Effect that fails with `RegistrationCleanupUnconfirmed`. Its only production caller is `harness-runtime.ts:148`, so its facade (`registration-listing.ts:52-56`) is removed.
  - Its observer close moves from `Promise.race` and `setTimeout` (`project-registration-observer.ts:90-113`) to `Effect.timeoutOrElse`, the pattern already used at `project-registration-preparation.ts:257-279`. That close also has one caller (`registration-listing.ts:34`).
  - The listing cleanup on shutdown uses its own budget, `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` = 3 000 ms (D17, §104 P1). With the 1 000 ms database deadline after it, the whole harness stop ends before the 5 000 ms desktop grace (`apps/desktop/src/main/harness-supervisor.ts:25`). The per-request `REGISTRATION_CLEANUP_BUDGET_MS` = 5 000 ms (`registration/observer-limits.ts:2`) is unchanged for its other users.
  - The listing `startStop` stays eager (:148), because same-turn closure depends on it (seam inventory).
- **Disposal:**
  - `stopped.finally(dispose)` (`process-bootstrap.ts:135`) becomes: run the program, then a bounded dispose, and aggregate both failures. A dispose failure never replaces a stop failure.
  - The bootstrap-failure path awaits a bounded dispose before `failStartup` exits (`process-entry.ts:32-35, 86-87`).
- **Seam:** a disposal seam is exported so that unit tests can provide fake Layers. Today `harnessServicesLayer` and the services are module-private (`process-bootstrap.ts:152-179, 262`).

### Desktop bridge core (slice 7)
- **Ownership:** one pending-request owner per session. It replaces `harness-pending-request.ts:10-77` and the three bookkeeping copies (`project-entry-bridge.ts:38-149`, `project-storage-bridge.ts:27-240`, `workspace-bridge.ts:22-307`).
- **Per request:**
  - one `Deferred` keyed by message id;
  - registration and send in one synchronous step;
  - a throwing or refused send settles the request and frees its id.
- **Fault taxonomy:** one taxonomy, the typed `ProjectRequestFault` (`project-upgrade-failure.ts:17-21`), used by every bridge. Each bridge maps a fault to its own envelope, so the `broken`/`unavailable`/`uncertain` result envelopes stay unchanged (§103.6).
- **Drift removed** (checkpoint P4 for the choices):
  - A null-correlated result fails all pending requests as `protocol`.
  - `system.failure` fails all pending requests with fixed text and never forwards the raw message.
  - A decode failure settles the request as `protocol` and never escapes the listener.
  - `stop` always settles pending requests, even when unsubscribe throws.
- **Ordering:** `HarnessSession` queues a nested emit until the outer emit has reached every listener (`harness-session.ts:98-110`). A `protocol-error` then reaches the bridges before the supervisor's quarantine `disconnected` does (`harness-supervisor.ts:443`). So a read during a protocol error answers `broken` (§103.6).
  - *Corrected by the s7 detail (2026-10-19):* at `54d30da`, `HarnessSession` delivers a nested emit immediately: `harness-session.ts:98-110` is a plain loop over the listeners, with no queue. The line above describes the design target. s7 builds the queue (s7 design point 7). Until it does, a read during a protocol error answers `unavailable`.
- **Shape for C2:** the core's `Deferred`-per-id shape is what C2 extends with a stream of replies and an interruption that maps to a cancel. Neither is built here.

### Electron main runtime (slice 6) and #96 (slice 8)
- **Slice 6, main runtime:**
  - Each bridge group stops independently, which fixes the skip at `main.ts:60-63`.
  - After dispose, every IPC handler answers its `unavailable` envelope from a disposed flag and never calls the runtime. A `runtime.runPromise` after dispose dies with "ManagedRuntime disposed" (`ManagedRuntime.ts:344`), so the handlers must not reach it.
- **Slice 8, #96:**
  - `HarnessSupervisor.stop` resolves only after the child's stdout ends, or after `HARNESS_STDOUT_DRAIN_MS` = 1 000 ms past `exit` (§104 P2), whichever comes first.
  - On the bound, `remove()` ends forwarding, the existing path (`harness-supervisor.ts:160-162, 386-389`).
  - The pre-exit grace, kill and grace stay as they are (`harness-supervisor.test.ts:596, 1078`).

## Decisions

- **D1 Shutdown shape** (§103.1, inherited). An explicit program runs before dispose. Finalizers are used only for order-free releases. Rejected: putting owner stops into Scope finalizers, which would lose same-turn closure, the withheld rule, not-held concurrency and aggregation (research §2).
- **D2 Fair lock primitive.** A project-owned single-permit lock on a `Deferred` hand-off, in `permit-lock.ts`. Rejected:
  - effect `Semaphore`, Queue, TxSemaphore and Latch, which all barge or have no ordering guarantee (research §5);
  - keeping a `runSync` release as the only ordering point. AGENTS.md keeps `run*` at the edges, so in-fiber callers cannot rely on a `runSync` release (R14, §105).
- **D3 Barging is a defect** (§103.3, inherited). `inSlot` and the registration steps move onto the fair lock in slice 1.
- **D4 Facade cut line** (§103.4, inherited).
  - Removed in Part A: the listing stop facade (slice 5) and the raw `ProjectStorageLocks` surface (slice 1).
  - Kept: the Promise `withPermit`, the store `locks` facade, the authority admission interface, `retryable-attempt`, the Storage owner stop, and the conversation-save chain.
- **D5 Authority close outcome.** It is a rejection with `ApplicationDatabaseCloseUnconfirmed`, aggregated by `runtimeShutdownFailure` (`harness-runtime.ts:66-70`), never a "closed". The bound is 1 000 ms after measurement (§104 P1).
- **D6 Withheld means untouched** (§103.2, inherited). Neither the program nor the Layer safety net stops a withheld authority.
- **D7 Standalone authorities are owned by their registry** (§103.8, inherited). Stop is bounded, and the WeakMap entry is removed on stop.
- **D8 One harness runtime edge.** The transport handler and the shutdown fork run on the process runtime. Other global `run*` sites are facades or SQL-adjacent and stay until their callers migrate (research §7).
- **D9 Bridge core and drift** (§103.6, §104 P4, inherited). The unified behaviours are the ones listed under Architecture. They change the workspace pin at `workspace-bridge.test.ts:586`, and the project-entry bridge stops ignoring null-correlated results and `system.failure`.
- **D10 Nested-emit ordering in `HarnessSession`.** Rejected: deferring the supervisor's quarantine to a later turn, which would change the supervisor's pinned status timing (`harness-supervisor.test.ts:326, 707`).
- **D11 IPC after dispose** (§103.5, §104 P3, inherited). Answers reuse existing `unavailable` codes, with no new protocol code: list `PROJECT_LIST_UNAVAILABLE`; registration `PROJECT_REGISTRATION_UNAVAILABLE`; workspace `WORKSPACE_CAPABILITY_UNAVAILABLE`; upgrade, read and save their `unavailable` `connectionLost`; activate `PROJECT_COORDINATOR_UNAVAILABLE`; switch `coordinator-unavailable`.
- **D12 #96 in Part A** (§103.5, §104 P2, inherited). The drain bound is 1 000 ms after `exit`.
- **D13 Gates** (§103.7, inherited).
  - The #123 baseline is refreshed. It is now 121 .ts files / 64 importing effect / 286 `throw new` / 6 `new Promise` / 36 `run*` calls in 20 files / 1 `ManagedRuntime` (research summary).
  - `package:launch-smoke` and mutation are heavy runs, each with the coordinator's GO.
  - Mutation (§105 R9 (a)): a scoped mutation run once on the final candidate of each rigorous slice (s1, s3, s5), before that slice's acceptance, plus one run on the final combined candidate for the normal slices. Each run needs the coordinator's GO.

- **D14 Slice order** (§104 P5, inherited). The harness slices s1 to s5 come first, then the Electron main slices s6 to s8.
- **D15 Lanes** (§104 P6, inherited). s1, s3 and s5 are rigorous: intent review, the code and coverage reviewer pair, and per-slice human acceptance. s2, s4, s6, s7 and s8 are normal.
- **D16 Nested emits** (D10, noted by the coordinator in §104). No change.
- **D17 Listing shutdown cleanup budget** (designer value under §104 P1). `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` = 3 000 ms applies only to the shutdown listing stop chain (owner close, observer close, registry stop). 3 000 ms of listing cleanup plus the 1 000 ms database deadline ends before the 5 000 ms desktop grace, with 1 000 ms of margin for the log line and exit. Rejected: lowering the shared 5 000 ms `REGISTRATION_CLEANUP_BUDGET_MS`, which also bounds per-request registration work (`project-registration-preparation.ts:275`, `repository-identity-query-owner.ts:334`, `windows-version-child.ts:73`).

Standing decisions: 17 recorded feature-local, none promoted. If any must bind future work, tag it (scope: standing + key: + rule:) before the status flip.

## Next Slice

- **slice_id:** `u2b-s1-fair-lock`
- **Lane:** rigorous (user raise, decisions log §104 P6). The feature lane is normal; `lane.mjs --paths` reports fast for this slice's source files.
- **Behaviour IDs:** U2B-FL-B1 … U2B-FL-B8.
- **Deliverable:**
  - The fair lock in `permit-lock.ts`, with its Effect and Promise surfaces.
  - `ProjectStorageLocks` on it, with the raw surface removed.
  - The canonical writer slot and the registration flow steps on it.
- **Affected source:**
  - `apps/harness/src/storage/permit-lock.ts`
  - `apps/harness/src/storage/project-storage-locks.ts`
  - `apps/harness/src/canonical-project-writer.ts`
  - `apps/harness/src/registration/project-registration-flow.ts`
  - `stryker.project-storage.config.json` and `apps/harness/vitest.project-storage-mutation.config.ts` (mutation scope, R2)
- **Affected tests:**
  - `apps/harness/src/storage/permit-lock.test.ts` (new)
  - `apps/harness/src/storage/project-storage-locks-service.test.ts`
  - `apps/harness/src/storage/project-storage-locks.test.ts` (pins, unchanged)
  - `apps/harness/src/canonical-project-writer.test.ts`
  - `apps/harness/src/registration/project-registration-flow.test.ts` (new)
- **Dependencies:** none. This is the first slice.
- **Callers that keep their API:** `active-project-coordinator.ts:57, 507, 540-549` (Promise `withPermit`), `project-storage-node-adapters.ts:52, 408` (the facade), and the test consumer `project-storage-store.test.ts:14, 766-771` (the real `createPermitLock`/`withPermit`).

### Test Contract: u2b-s1-fair-lock

- **Definitions (Q8, §106):** a holder "starts" and "ends" at the start and exit of the effect passed to `withPermitEffect` (or to the service operation), never at the holder fiber's own start or exit. The running-holders counter goes up when that effect starts and down in an `Effect.onExit` inside it, never in an outer `ensuring` and never at the fiber's exit.
- **Order of behaviours (Q10, §106):** B2 runs first: scaffold `withPermitEffect` as a pass-through to `Semaphore.withPermits(1)`, observe the red, then build the fair lock and turn it green. B1, B5 and B6 follow, each with its red observed while its consumer still uses `Semaphore`, before that consumer moves onto the fair lock.

- **Behavior U2B-FL-B1**: Inside Effect, a caller that arrives after a release queues behind the caller that was already waiting. This holds for the create permit and for one Project's permit.
  - Seam: the `ProjectStorageLocks` service value from `ProjectStorageLocks.layer` (`forCreate` / `forProject`).
  - Test: `hands a released %s permit to the waiting fiber before a later fiber` -> `apps/harness/src/storage/project-storage-locks-service.test.ts`
  - Oracle: rows `create` and `Project`.
    1. Fiber `held` holds the permit behind a gate, and fiber `waiting` is forked and settled so it is queued.
    2. The gate opens. Right after `Fiber.join(held)`, with no settle, fiber `late` is forked with `Effect.forkChild(…, { startImmediately: true })`, so it arrives inside the window between the release and the wake-up. A default `forkChild` would start after the wake (`node_modules/effect/src/internal/effect.ts:5531-5535`) and could not show the defect.
    3. The recorded start order is exactly `held,waiting,late`, and every fiber completes.
  - Expected red: at cb84fe8, `withPermits` releases on `held`'s async dispatcher (`node_modules/effect/src/Semaphore.ts:264-275`), and the immediately started `late` takes the free permit first. The order is `held,late,waiting`. This red must be observed at cb84fe8. The #110 row (`.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md:249, 259`) does not record how `late` was started.
- **Behavior U2B-FL-B2**: The fair lock passes the permit in strict arrival order to any number of waiters, whichever fiber releases it. A waiter interrupted while queued gives up its place.
  - Seam: `createPermitLock` + `withPermitEffect` (`apps/harness/src/storage/permit-lock.ts`).
  - Test: `passes the permit in arrival order and skips an interrupted waiter` -> `apps/harness/src/storage/permit-lock.test.ts`
  - Oracle:
    1. A holds the lock. B, C and D queue in that order, and C is interrupted while it waits.
    2. A runs in its own `Effect.runPromise` fiber and releases from it. E is started with `Effect.runFork` inside the continuation of A's promise, so E starts synchronously in the turn after A's release.
    3. The start order is exactly `A,B,D,E`. C never starts. After E completes, a new `withPermitEffect` on the same lock starts within the same turn, so the lock is free.
  - Expected red: with `withPermitEffect` scaffolded as a pass-through to `Semaphore.withPermits(1)` (minimal interface scaffolding only), the dispatcher-scheduled wake lets E start before B (order `A,E,B,D`).
  - Further rows (Q7, §106), test `gives up the place of an interrupted %s waiter` in the same file:
    - `head`: A holds the lock, and B then C queue. B is interrupted, then A ends. The start order is exactly `A,C`.
    - `only`: A holds the lock, and B queues and is interrupted, then A ends. A fresh caller then starts in the same turn.
  - Expected red for the further rows: none — pin. The scaffolded `Semaphore` removes an interrupted observer (`node_modules/effect/src/Semaphore.ts:227-229`); the rows guard index-0 and empty-queue removal in the fair lock.
- **Behavior U2B-FL-B3**: The lock is never held twice and never leaked, whatever happens to its holder.
  - Seam: `createPermitLock` + `withPermitEffect`.
  - Test: `leaves the lock free after a holder %s` -> `apps/harness/src/storage/permit-lock.test.ts`
  - Oracle: rows `succeeds` (value kept), `fails` (the typed error is the identical value), `dies` (the defect is kept), and `is interrupted while holding` (the holder's exit is an interruption cause, with no failure and no success value), each with one queued waiter W.
    1. W starts exactly once, only after the holder ends.
    2. At no point do two holders run at once; a running-holders counter never exceeds 1.
    3. After W ends, a fresh caller starts in the same turn.
  - Expected red: none — pin. This guards the new implementation; the scaffolded `Semaphore` already satisfies it.
  - Binding observation (Q14, §106): during the slice, record once that this test fails against a temporary fair lock whose release skips the hand-off on a failed holder. Then restore the source, verified by digest, as #110 T3 did (`.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md:265`).
- **Behavior U2B-FL-B4**: The Promise facades keep today's contract: arrival order, hand-off before a later arrival, start deferral, independent permits, separate lock sets per Storage adapter, and error identity.
  - Seam: `createNodeProjectStorageDependencies(...).locks` and `withPermit`.
  - Test: every existing title in `apps/harness/src/storage/project-storage-locks.test.ts`, run unchanged. These are :51-54, :69-73 (`hands a released %s permit to the waiting caller before a later arrival`), :97-101 (`starts a free %s operation only after the caller's synchronous code`, exact `sync,tick1,op,tick2,tick3,tick4`), :116, :142, :169-176, :188 and :204.
  - Oracle: as asserted today, unchanged.
  - Expected red: none — pin.
- **Behavior U2B-FL-B5**: In the canonical writer, Conversation work submitted after a settlement has completed runs after the work that was already queued behind that settlement.
  - Seam: `createCanonicalProjectWriter(...)` (`settle`, `conversation`).
  - Test: `runs Conversation work queued behind a settlement before work that arrives after it` -> `apps/harness/src/canonical-project-writer.test.ts`
  - Oracle:
    1. A settlement S holds the slot behind a gate. Save A is submitted only after the fake settlement has signalled that it entered the slot (a `started` deferred, as in `canonical-project-writer.test.ts:300-305`), so A is queued behind S.
    2. Save B is submitted inside the `.then` of S's pending result.
    3. The repository records exactly `S,A,B`. S's result is asserted with `toEqual(expectedResult("settled"))`, and A and B with `toMatchObject(completedWith("A"))` and `toMatchObject(completedWith("B"))` (Q11, §106). `_tag` sits on the `Result` prototype (`node_modules/effect/src/internal/result.ts:27-29`), so `toEqual` would fail for A and B; the file already uses `toMatchObject` this way (`canonical-project-writer.test.ts:560-563, 616`).
  - Expected red: `inSlot` releases inside its own `runPromiseExit` fiber (`canonical-project-writer.ts:112-118`), so B finds the free permit before A wakes. The order is `S,B,A`.
- **Behavior U2B-FL-B6**: The registration flow handles requests one step at a time in arrival order, including a request that arrives right after an earlier one completes.
  - Seam: `createProjectRegistrationFlow(...).handle`, run as the transport edge runs it (`Effect.runPromise` per request).
  - Test: `handles a registration request that arrives after a completed one behind the queued request` -> `apps/harness/src/registration/project-registration-flow.test.ts`
  - Oracle:
    1. The flow uses the real `createDirectoryHandoff()` (`project-registration-flow.ts:32-41`). The fake registry's `selectRepository()` reads the offered directory through the handoff port, records it, and answers `prepared` with a selection id derived from that directory (Q12, §106). The fake is a complete `RegistrationRegistry` whose unused members reject when called, or the flow's `registry` dependency is narrowed to a `Pick` of the methods it calls; implement chooses, with no casts.
    2. Three `select-repository` requests use directories `d1`, `d2` and `d3`. Only request 1's registry call is gated. Request 2 is submitted while request 1 holds the steps lock.
    3. Request 3 is started inside the `.then` of request 1's promise.
    4. The recorded directory order is exactly `d1,d2,d3`, and each answer is `repository-selected` with the selection id derived from its own directory.
  - Expected red: `Semaphore.withPermit(steps)` (`project-registration-flow.ts:185, 194`) releases on the async dispatcher, so request 3 overtakes request 2. The order is `d1,d3,d2`.
- **Behavior U2B-FL-B7**: The existing service, writer and coordinator contracts are kept.
  - Seam: the existing tests.
  - Test: every existing test in these files, run unchanged (B1 and B5 add new tests to two of them; Q13, §106): `project-storage-locks-service.test.ts` (including :139 `shares no permit between two service values`), `canonical-project-writer.test.ts`, `active-project-coordinator.test.ts` (including :297-300 `closes command admission in the same turn as lifecycle enqueue`), `project-storage-store.test.ts` (including :764 `retains delayed asynchronous registry failure in the shared stop promise`, which drives the real `withPermit`), and `tests/integration/conversation-writer-serialization.integration.test.ts`.
  - Oracle: as asserted today, unchanged.
  - Expected red: none — pin.
- **Behavior U2B-FL-B8**: The hand-off stays correct under re-entry and on a long queue.
  - Seam: `createPermitLock` + `withPermitEffect`.
  - Test: `queues a non-awaited re-entrant caller behind its holder` and `hands the permit through a long queue of synchronous holders` -> `apps/harness/src/storage/permit-lock.test.ts`
  - Oracle:
    - (a) (Q2, §106) A queued holder H, once handed the permit, starts R inside its body with `Effect.forkDetach(withPermitEffect(lock)(…), { startImmediately: true })`, so R asks for the lock while H still holds it. R is detached so that H's exit does not interrupt it. H then ends. The recorded events are exactly `H start, R requested, H end, R start, R end`. The running-holders counter never exceeds 1, and R's exit is a success.
    - (b) (Q4, §106) 10 000 waiters whose bodies complete synchronously run in exact arrival order (0 … 9 999). Every waiter exit is `Exit.succeed(i)`, with no defect; a stack overflow would surface as a defect, not a throw (`node_modules/effect/src/internal/effect.ts:685-689`). The join of all waiters is bounded, and the lock is free afterwards (a fresh caller starts in the same turn).
  - Expected red: none — pin. The scaffolded `Semaphore` satisfies both, because its wake runs on a scheduled task. These pins guard the inline `Deferred` hand-off that replaces it, which would nest each hand-off inside the previous release unless it avoids that.
  - Binding observation (Q14, §106): during the slice, record once that (b) fails against a temporary hand-off without the anti-nesting guard, and that (a) fails against a temporary lock that lets a request from inside a holder take the lock at once. Then restore the source, verified by digest.
- **TDD-exempt**: removing `createPermit` and `retainProject` from the `ProjectStorageLocks` service surface (`project-storage-locks.ts:51-54`). They have no users outside the facade (research §6, seam inventory). This changes the type surface without changing any reachable behaviour. The proof is `pnpm typecheck` plus a type-level assertion, in `apps/harness/src/storage/project-storage-locks-service.test.ts` (which already uses `ProjectStorageLocks["Service"]` at :9), that the keys of `ProjectStorageLocks["Service"]` are exactly `forCreate`, `afterCreateDrain` and `forProject` (R12, §105; location Q13, §106). U2B-FL-B4 and U2B-FL-B7 prove the behaviour is unchanged.

### Success Criteria:

**Automated:**
- `pnpm exec vitest run --project harness apps/harness/src/storage/permit-lock.test.ts apps/harness/src/storage/project-storage-locks-service.test.ts apps/harness/src/storage/project-storage-locks.test.ts apps/harness/src/storage/project-storage-store.test.ts apps/harness/src/canonical-project-writer.test.ts apps/harness/src/registration/project-registration-flow.test.ts apps/harness/src/active-project-coordinator.test.ts` — red, then green, per behaviour.
- Integration (the root is `apps/harness`; any run longer than 2 min needs the coordinator's GO at run time, R7, §105):
  - `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts tests/integration/conversation-writer-serialization.integration.test.ts tests/integration/registry-witness-race.integration.test.ts tests/integration/project-storage-lifecycle.integration.test.ts`;
  - the registration integration files (`apps/harness/vitest.registration-files.ts:2-6`), with `pnpm exec vitest run --config apps/harness/vitest.registration.config.ts`. `apps/harness/vitest.integration.config.ts:12-15` excludes these files (Q1, §106).
- `pnpm check`. CodeScene scores 10 on every changed file (AGENTS.md).
- Mutation (R2, R9 (a), §105; Q5, §106): before the run, add `apps/harness/src/storage/permit-lock.ts` and the line range `apps/harness/src/registration/project-registration-flow.ts:184-196` to the `mutate` list of `stryker.project-storage.config.json`. Add `apps/harness/src/storage/permit-lock.test.ts` and `apps/harness/src/registration/project-registration-flow.test.ts` to the include of `apps/harness/vitest.project-storage-mutation.config.ts`. On s1's final candidate, before s1's acceptance, with the coordinator's GO, run the two scoped scripts once each, limited with `--mutate`:
  - `pnpm test:mutation:project-storage:harness --mutate apps/harness/src/storage/permit-lock.ts,apps/harness/src/storage/project-storage-locks.ts,apps/harness/src/registration/project-registration-flow.ts:184-196`;
  - `pnpm test:mutation:conversation:harness --mutate apps/harness/src/canonical-project-writer.ts:111-118`.
  - Pass: every mutant is killed, except the triaged survivors of the R6 defensive branch.

**Manual:**
- None for this slice.

## Test Contracts
This brief owns the slice 1 contract above. Later slices' contracts are written just in time from the behaviour outlines in Deferred Work.

### Slice u2b-s2-storage-failure-guard (detailed 2026-10-17)

- **slice_id:** `u2b-s2-storage-failure-guard`
- **Lane:** normal (D15). There is no intent review. The candidate gets the slice-verifier, and Pedro accepts the combined result once, before integration (shared **Lanes**).
- **Parent:** the s1 candidate on `refactor/123-effect-lifecycle-part-a`, HEAD `7462116`, accepted in §109. s2 does not use s1's code.
- **Behaviour IDs:** U2B-SG-B1 … U2B-SG-B3.
- **Deliverable:** one exported `isKnownStorageFailure` in `apps/harness/src/storage/project-storage-node-errors.ts`, with a TSDoc that names it the single owner (`.rpiv/decisions/shared-vocab-union.md`). The registry and the upgrade adapter call it, and the three copies are gone.
- **Affected source:**
  - `apps/harness/src/storage/project-storage-node-errors.ts`
  - `apps/harness/src/storage/project-storage-node-registry.ts`
  - `apps/harness/src/storage/project-storage-upgrade-node-adapter.ts`
- **Affected tests:**
  - `apps/harness/src/storage/project-storage-node-errors.test.ts`
  - `apps/harness/src/storage/project-storage-node-registry.test.ts` (new)
  - `apps/harness/src/storage/project-storage-upgrade-node-adapter.test.ts` (pin, unchanged)
- **Dependencies:** none.

#### Identity proof (first, before any code change)

Record it in `.rpiv/artifacts/evidence/2026-10-17_123-s2-tdd-evidence.md`, at `7462116`:
1. **The three copies.** Each one is true exactly when the value is `instanceof ProjectStorageBrokenError` or `instanceof ProjectStorageUnavailableError`:
   - `isKnownStorageError`, `apps/harness/src/storage/project-storage-node-errors.ts:37-42`, which feeds `storageFailureFor` (:67);
   - `isStorageFailure`, `apps/harness/src/storage/project-storage-node-registry.ts:60-64`, which feeds `keepStorageFailure` (:75-77);
   - the inline pair in `markerQueryFailure`, `apps/harness/src/storage/project-storage-upgrade-node-adapter.ts:558-559`.
2. **No custom `Symbol.hasInstance`.** Neither class defines one (`apps/harness/src/storage/project-storage-errors.ts:1-12`), and neither do their subclasses:
   - `ProjectStorageApplicationClientInitializationError` (:12);
   - `ProjectStorageUpgradeBusyError` (`apps/harness/src/storage/project-storage-upgrade.ts:18`).
   The union of the copies is therefore the same predicate, and no consumer loses a case.
3. **Not copies.** These checks use a different vocabulary and are out of scope:
   - `apps/harness/src/storage/project-storage-application-client.ts:77-80`: Unavailable, or an unavailable code;
   - `isBusyStorageError` (`apps/harness/src/storage/project-storage-node-errors.ts:51-61`);
   - the status mappings, which test ClientInitialization first: `apps/harness/src/storage/project-storage-store.ts:493-499, 543-551` and `apps/harness/src/storage/project-storage-upgrade-pipeline.ts:466-476`;
   - `isDefiniteSchemaMismatch` (`apps/harness/src/storage/application-database-migration.ts:311-312`).
4. **Order kept.** In `markerQueryFailure` the pair runs before `isBusyStorageError`. The migrated guard stays in that place, so a typed Unavailable, `ProjectStorageUpgradeBusyError` included, still passes through unchanged and is never wrapped again.

### Test Contract: u2b-s2-storage-failure-guard

- **Order of work:**
  1. Do the identity proof.
  2. Rename the private `isKnownStorageError` to the exported `isKnownStorageFailure`. This is minimal interface scaffolding.
  3. Write B1.
  4. Write B3 and see it green while the registry still uses its own copy, then move the registry onto the guard.
  5. Move the upgrade adapter onto the guard under B2.
- **Behavior U2B-SG-B1**: the guard knows a storage failure only by its class.
  - Seam: `isKnownStorageFailure`, exported from `project-storage-node-errors.ts`.
  - Test: `knows a storage failure only by its class: $name` -> `apps/harness/src/storage/project-storage-node-errors.test.ts` (`it.each`).
  - Oracle (exact `toBe`):
    - `true` for `ProjectStorageBrokenError`, `ProjectStorageApplicationClientInitializationError`, `ProjectStorageUnavailableError` and `ProjectStorageUpgradeBusyError`;
    - `false` for a plain `Error`, an `Error` with code `SQLITE_BUSY`, an `Error` with code `SQLITE_CORRUPT`, the plain object `{ code: "SQLITE_BUSY" }`, the plain object `{ name: "ProjectStorageBrokenError" }`, the string `"ProjectStorageBrokenError"`, `undefined` and `null`.
    - The busy and corrupt rows pin that the guard is not the code-based classifier.
  - Expected red: none — pin. With the rename as scaffolding, the table holds at once; it is the identity proof at the seam.
- **Behavior U2B-SG-B2**: the upgrade marker lookup still passes known failures through unchanged, and still classifies everything else as before.
  - Seam: `createProjectStorageUpgradeSteps(...).findUnfinished`.
  - Tests, unchanged:
    - `passes a typed unavailable registry through the marker lookup unchanged` -> `apps/harness/src/storage/project-storage-upgrade-node-adapter.test.ts:12-28` (`toBe` the same instance);
    - the three `finds an unfinished upgrade only from a readable marker: …` tests -> `apps/harness/tests/integration/project-storage-upgrade-steps.integration.test.ts:100-155`: a ClientInitialization failure passes through, a busy registry gives `ProjectStorageUpgradeBusyError`, and an unreadable marker gives the exact broken message.
  - Expected red: none — pin.
- **Behavior U2B-SG-B3**: the registry keeps a typed storage failure on the error channel and leaves anything else a defect.
  - Seam: `createNodeRegistryOperations(input).registryWitnesses`, with an `existingApplicationClient` that rejects. Input members the call does not use throw "Not used", as at `project-storage-upgrade-node-adapter.test.ts:8-10`.
  - Test: `keeps a typed storage failure and leaves anything else a defect: $name` -> `apps/harness/src/storage/project-storage-node-registry.test.ts` (new, `it.each`).
  - Oracle on the `Exit`:
    - Broken, ClientInitialization and Unavailable each give a failure whose error is the same instance (`toBe`), with no defect;
    - a plain `Error` gives a defect that is that same `Error`, with no failure.
  - The kept pins on the `storageFailureFor` path stay unchanged: the `declareStaging`/`activate` checkpoint cases at `apps/harness/tests/integration/project-storage-node-adapters.integration.test.ts:457-480`. A plain error becomes broken with its message and cause, a busy error becomes unavailable, and a known failure is kept as is.
  - Expected red: none — pin. It is written and green before the registry moves.
- **TDD-exempt**: removing the private `isStorageFailure`, the inline pair and the private `isKnownStorageError` name - a consolidation with no change in behaviour, proven identical above and guarded by B1-B3; `pnpm typecheck` proves that nothing else used them.

### Success Criteria: u2b-s2-storage-failure-guard

**Automated:**
- `pnpm exec vitest run --project harness apps/harness/src/storage/project-storage-node-errors.test.ts apps/harness/src/storage/project-storage-node-registry.test.ts apps/harness/src/storage/project-storage-upgrade-node-adapter.test.ts`.
- Integration, with the coordinator's GO if it runs longer than 2 min: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts tests/integration/project-storage-node-adapters.integration.test.ts tests/integration/project-storage-upgrade-steps.integration.test.ts`.
- `pnpm typecheck` and `pnpm check`. CodeScene scores 10 on every changed file (AGENTS.md).
- Mutation: none in s2 (D13, normal lane). The s2 code goes into the combined run on the final candidate. That run's scope is set at that point. `project-storage-node-registry.ts` is already in `stryker.project-storage.config.json`; `project-storage-node-errors.ts` and `project-storage-upgrade-node-adapter.ts:556-564` are not.

**Manual:**
- None for this slice.

### Slice u2b-s3-authority-bounded-close (detailed 2026-10-17)

- **slice_id:** `u2b-s3-authority-bounded-close`
- **Lane:** rigorous (§104 P6, D15). It gets intent review (the slice-verifier in intent mode plus the code and coverage reviewer pair), the same three on the candidate, and Pedro's per-slice acceptance.
- **Parent:** `fb7bde7` (s2, which passed its gate in §112). s3 does not use s1's or s2's code.
- **Behaviour IDs:** U2B-AC-B1 … U2B-AC-B6. The outline's IDs are kept; B6 is new (T6, §114).
- **Deliverable:**
  - `ApplicationDatabaseAuthority.stop` is bounded by an Effect deadline. Its single outcome is either a confirmed close or a rejection with a new typed `ApplicationDatabaseCloseUnconfirmed`; it is never "closed" late.
  - The runtime tells the authority when it withholds it.
  - The `ApplicationDatabase` Layer gets an order-free `acquireRelease` safety net, and s3 proves that the bootstrap Layer runs it (U2B-AC-B6; T6, §114).
- **Affected source:**
  - `apps/harness/src/storage/application-database-authority.ts`: the error class, `APPLICATION_DATABASE_CLOSE_DEADLINE_MS`, the `closeDeadlineMs` input, the bounded `stop`, `withhold`, `closeIfNeverStopped` and the exported `acquireApplicationDatabaseAuthority`;
  - `apps/harness/src/harness-runtime.ts`: the withheld branch (:153-155) calls `withhold`, and the `applicationDatabase` option type (:46) gains it;
  - `apps/harness/src/process-bootstrap.ts`: `applicationDatabaseLayer` (:181-186) builds through `acquireApplicationDatabaseAuthority`. `harnessServicesLayer` (:262-269) and the `ApplicationDatabase` service (:158-161) are exported, with TSDoc naming them the process's application Layer and its database service, so U2B-AC-B6 can build and dispose that Layer (T6, §114).
- **Affected tests:**
  - `apps/harness/src/storage/application-database-authority.test.ts` (new; a fake client, no disk);
  - `apps/harness/src/harness-runtime-shutdown.test.ts`;
  - `apps/harness/src/harness-runtime.test.ts`;
  - `apps/harness/src/process-bootstrap.test.ts` (new; U2B-AC-B6, no disk);
  - `apps/harness/tests/integration/application-database-authority-cases.integration.test.ts` (pins with unchanged assertions; its `withAuthority` helper at :21-24 passes `closeDeadlineMs: 15_000`, T5, §114; U8, §115).
- **Dependencies:** none on s1 or s2 code. s4 builds on the bounded stop; s5 builds on the safety net (U2B-HR-B4 keeps its own runtime-level checks). The wiring is proven in s3 by U2B-AC-B6 (T6, §114).
- **D17 is not in s3.** The shutdown listing budget (`REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` = 3 000 ms) belongs to the listing stop chain, which s5 moves to Effect (U2B-HR-B6). s3 supplies only the 1 000 ms database deadline that D17's sum counts on.

#### Design points fixed for s3

1. **What "close" means.** The authority owns no client of its own. Its close is the drain: `stop` refuses new work at once and is confirmed when no accepted work remains (`application-database-authority.ts:129-149, 434-438`). A lease whose transaction or client never confirms termination keeps it unconfirmed (:105-112, :177-182).
2. **One outcome, memoized.** The first `stop()` starts one Effect: `Deferred.await(closed)` under `Effect.timeoutOrElse` with `closeDeadlineMs` (pattern: `registration/project-registration-preparation.ts:257-279`).
   - Every later `stop()` returns that same promise.
   - If the deadline passes first, the outcome is a rejection with `ApplicationDatabaseCloseUnconfirmed`. A drain after that does not turn it into "closed".
3. **The error.** `ApplicationDatabaseCloseUnconfirmed` is a `Data.TaggedError("ApplicationDatabaseCloseUnconfirmed")` with the fixed message "Project Storage application database close is unconfirmed." and a `deadlineMs` field. It is the outcome a caller handles, never a defect, and never an interruption. No seam can tell a fail from a die through the `stop()` Promise (`node_modules/effect/src/internal/effect.ts:303-312, 5778-5781`), so the fail-not-die clause is proven by static inspection at candidate review (T15, §114).
4. **Withheld.** `withhold()` records that the shutdown program deliberately keeps the authority alive. It does not refuse work and does not drain. The runtime calls it only in the withheld branch (`harness-runtime.ts:153-155`) and still never calls `stop` there (D6).
   - `withhold(): void` joins the public `ApplicationDatabaseAuthority` type (`application-database-authority.ts:38-47`) and the runtime's `applicationDatabase` option type (`harness-runtime.ts:46`) (T10, §114).
   - It only sets a synchronous flag and cannot throw, so the withheld branch needs no catch and no extra row (T18, §114).
5. **Safety net (order-free, §103.1).** `acquireApplicationDatabaseAuthority(input)` is `Effect.acquireRelease` with a synchronous acquire (so the `runtime.runSync` extraction at `process-bootstrap.ts:103-112` keeps working) and the release `closeIfNeverStopped`. The release reads only the authority's own state:
   - after `stop` or `withhold`, it does nothing;
   - otherwise it runs the bounded stop, and an unconfirmed close becomes a defect of the release (`Effect.orDie`), so `dispose` reports it instead of swallowing it (`.rpiv/decisions/degrade-distinguishes-broken.md`).
   - `closeIfNeverStopped` is a module-internal Effect that awaits the same memoized outcome as the `stop()` facade, with no nested `runPromise` (AGENTS.md: `run*` only at the edges; T10, §114).
   In s3 that defect cannot reach the unobserved `void runtime.dispose()` at `process-bootstrap.ts:139`. That path runs only when building or starting fails synchronously, before any work could be admitted, so the drain is immediate. s5 awaits that dispose (U2B-HR-B4). That the bootstrap Layer runs the safety net at all is proven in s3 by U2B-AC-B6 (T6, §114).
6. **The deadline.** `APPLICATION_DATABASE_CLOSE_DEADLINE_MS` = 1 000 (D5, §104 P1), unless the opening measurement stops the slice. `closeDeadlineMs` is an input with that default, so tests can bound it.
7. **Residual: queued admissions.** An admission queued behind a lease that never confirms stays queued after an unconfirmed stop, because the single permit is never released (`application-database-authority.ts:151-171`). The kept pin refuses a queued admission once it is granted (`application-database-authority-cases.integration.test.ts:65-104`), and that pin stays as it is. The process exits after the stop, so this is recorded as a residual, not changed.
8. **Residual: a stop during a first migration (T5 (a), §114).** An accepted `ensureCurrent` that is still migrating (its admitted migration transaction plus a worker client close, `application-database-authority.ts:354-360`, `application-database-migration.ts:461-478`) can drain for longer than M-drain. A shutdown during a first migration may therefore be reported as unconfirmed. Pedro accepted this as a residual. The first-migration integration pins keep their assertions, and their authority gets `closeDeadlineMs: 15_000`, so their deadline does not depend on load.

#### Opening measurement (first, before any code change; needs the coordinator's GO)

- **What is measured:** the time from `stop()` to its settlement, on a real worker-backed authority, at the parent `fb7bde7`. There are two shapes:
  - **M-idle:** a fresh authority over the shape's migrated root, after `ensureCurrent({ createIfMissing: false })`, with no work in flight (U5, §115).
  - **M-drain:** one admitted write transaction is in flight when `stop()` is called. That transaction runs three statements on a scratch table, then commits and closes; `stop()` is called after its first statement settles. A stop during a first migration can drain longer; that is design point 8's residual (T5 (a), §114).
  - **Setup outside the timing (T3, §114):** one root per shape is migrated once, before any timed window. Each sample opens a fresh authority over that migrated root (`ensureCurrent({ createIfMissing: false })`), sets up its shape, and only `stop()` is timed.
- **Conditions:**
  - quiet: three CPU readings under 30%, as in §111;
  - the #94 synthetic burst: `.rpiv/artifacts/evidence/2026-10-10_94-tools/burst-rg-git.sh`, 180 s per window, with every timed `stop()` inside a burst window (`.rpiv/artifacts/evidence/2026-10-10_94-timeouts-under-load.md:90-93`). Repeated burst windows are allowed; each sample records the window it ran in (T3, §114).
- **Samples:** 200 per shape and condition, each bounded at 15 s. The whole run is bounded at 30 min (T3, §114; it replaces the 10 min approved in §113).
- **Report:** p50, p95, p99 and max, plus the burst window timestamps.
- **Where:** the tool and the raw results go in `.rpiv/artifacts/evidence/2026-10-17_123-s3-close-measurement/`. The tool is outside `apps/` and is not part of the candidate; implement chooses how to run it.
- **Rule (§104 P1):**
  - If the highest p99 across the four cells is at most 500 ms, `APPLICATION_DATABASE_CLOSE_DEADLINE_MS` = 1 000.
  - If it is above 500 ms, the slice stops and Pedro decides; the coordinator relays.
  - A sample that hits its 15 s bound counts as 15 000 ms. A cell left incomplete (by the run bound or by a failed sample), or with a timed `stop()` outside its burst window, is `broken`: it is recorded with its diagnostic and stops the slice for Pedro, as above (T4, §114; `.rpiv/decisions/degrade-distinguishes-broken.md`).
  - The result is recorded in the s3 evidence file, `.rpiv/artifacts/evidence/2026-10-17_123-s3-tdd-evidence.md`.

### Test Contract: u2b-s3-authority-bounded-close

- **Fake client (unit tests):** a `LocalLibsqlClient` whose `transaction` returns a fake transaction that stays open (`closed` is `false`) until the test closes it. Variants:
  - its `close` rejects, so the lease is kept (`application-database-authority.ts:179-182`);
  - its `close` resolves, which releases the lease.
  The authority's `admitClient` and `stop` touch no disk. Time uses `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })` and `vi.advanceTimersByTimeAsync`, the precedent for Effect deadlines at a Promise seam (`registration/project-registration-preparation.test.ts:61-65`).
  - Why not `TestClock` (AGENTS.md; T16, §114): the bounded stop runs in its own `runPromise` behind the `stop()` facade, which a `TestClock` in the test's fiber cannot reach. B5's release and B6's dispose await that same outcome, so one clock drives every row.
- **Order of work:**
  1. The measurement.
  2. B1 and B3, both red at `fb7bde7` (T1, §114).
  3. Minimal implementation of the bounded, memoized stop, which turns B1 and B3 green.
  4. B2, as pins, with its binding observation.
  5. B4: add the real authority's `withhold` and the option type at `harness-runtime.ts:46` (T11, §114); the extended rows are red until the runtime calls `withhold` (T12, §114).
  6. B5: scaffold `acquireApplicationDatabaseAuthority` as `Effect.sync(create)` with no release, observe the red, then add the release; then its binding observation.
  7. B6: first add the two exports, `harnessServicesLayer` and the `ApplicationDatabase` service, with their TSDoc, as minimal interface scaffolding with no behaviour change (U3, §115). Then write B6 while `applicationDatabaseLayer` still uses `createApplicationDatabaseAuthority`, observe the Expected red (not an import error), and wire the Layer through `acquireApplicationDatabaseAuthority` (T6, §114).
- **Behavior U2B-AC-B1**: a stop that cannot confirm the close rejects at the deadline with `ApplicationDatabaseCloseUnconfirmed`, and never resolves later.
  - Seam: `createApplicationDatabaseAuthority({ …, closeDeadlineMs })`, then `admitClient(fake).transaction("write")` and `stop()`.
  - Test: `rejects an unconfirmed close at the deadline: $name` -> `apps/harness/src/storage/application-database-authority.test.ts` (`it.each`).
  - Rows: `transaction left open`, `client close rejects`, `custom deadline 50 ms`.
  - Oracle:
    - With the default deadline, `stop()` is still pending after 999 ms and rejects at 1 000 ms with an `ApplicationDatabaseCloseUnconfirmed` (`_tag`, the exact message, `deadlineMs` 1 000). With `closeDeadlineMs` 50, it is pending at 49 ms and rejects at 50 ms with `deadlineMs` 50 (T13, §114).
    - The test then releases the lease, and a second `stop()` returns the same promise (`toBe`) and rejects with the same error instance. No later settlement is ever "closed".
  - Expected red, at `fb7bde7`: `stop()` is still pending at the deadline, because it awaits `closed` with no bound (`application-database-authority.ts:434-438`).
- **Behavior U2B-AC-B2**: a confirmed close still resolves, a stop with no work resolves at once, and admission stays refused after any stop.
  - Seam: the same.
  - Test: `confirms a close that drains before the deadline and keeps refusing work after stop: $name` -> `apps/harness/src/storage/application-database-authority.test.ts` (`it.each`). Rows:
    - `no work`: `stop()` resolves after `advanceTimersByTimeAsync(0)`, with no deadline elapsed;
    - `drained at 500 ms`: the lease is released at 500 ms, and `stop()` resolves then, not at 1 000 ms;
    - `after an unconfirmed stop`: a new `transaction("write")` and `ensureCurrent` both reject with "Project Storage application database is stopped.".
  - Kept integration pins, with unchanged assertions (their `withAuthority` helper at :21-24 passes `closeDeadlineMs: 15_000`; T5 (a), §114; U8, §115): `application-database-authority-cases.integration.test.ts:65-104` (a failed commit is drained before stop resolves, and a queued admission is refused once granted) and :130-147 (every stop request settles with the one drained shutdown).
  - Expected red: none — pin. It guards the bounded stop against early rejection and against reopening admission.
  - Binding observation (T13, §114): record once that `after an unconfirmed stop` fails against a temporary stop that reopens admission after an unconfirmed close. Then restore the source, verified by digest.
- **Behavior U2B-AC-B3**: a runtime whose database close is unconfirmed rejects with that error, and in an aggregate the database failure comes after the listing failure (U7, §115).
  - Seam: `startHarnessRuntime`, with a real `createApplicationDatabaseAuthority` holding a fake lease as `applicationDatabase`, and fakes for the other owners (the fixture at `harness-runtime-shutdown.test.ts:185-218`).
  - Test: `reports an unconfirmed application database close: $name` -> `apps/harness/src/harness-runtime-shutdown.test.ts` (`it.each`).
  - Shared setup for both rows (U4, §115): the authority uses `closeDeadlineMs` 50, and the deadline counts from the authority's `stop()` call. A spy around the real authority's `stop` records that call, and the test observes it before it advances the timers. Then the runtime stop is pending at 49 ms and settles at 50 ms (T9, §114; the database stop starts only after Storage and the listing settle, `harness-runtime.ts:150-155`).
  - Rows:
    - `alone`: the runtime stop rejects with the authority's `ApplicationDatabaseCloseUnconfirmed` instance (`toBe`; a single failure is not wrapped, `harness-runtime.ts:66-70`);
    - `with a listing failure`: it rejects with an `AggregateError` whose `errors` are exactly `[listingFailure, unconfirmed]`.
  - Static proof at candidate review (U7, §115): the full aggregate order (intake, Storage, listing, database) is the `failures` literal at `harness-runtime.ts:156-161`, which s3 leaves unchanged; the reviewer confirms it is unchanged.
  - Expected red, at `fb7bde7`: the runtime stop is still pending at the deadline.
- **Behavior U2B-AC-B4**: a withheld Storage leaves the database untouched, apart from `withhold`; a listing failure does not withhold the database.
  - Seam: `startHarnessRuntime`.
  - Tests:
    - The pin `keeps the shared application database when canonical release withholds Storage` (`harness-runtime-shutdown.test.ts:230-239`) is extended. The fake gains `withhold`, recorded apart from `calls`: `calls` stays exactly `["listing-started", "listing"]` and `withhold` is called once.
    - The rows at `harness-runtime.test.ts:254-281` gain `withhold` on the fake: it is called exactly when `databaseStops` is false and Storage was withheld.
    - New row there: `listing fails`: the database stop is called once, `withhold` never, and the error is the listing failure (`toBe`). `canonicalRuntimeFixture` (:97-130) gains an optional listing that does not write to `calls`, so the exact `calls` pins stay unchanged (T12, §114).
  - Expected red, at `fb7bde7`: `withhold` is never called. The `listing fails` row is a characterization and is green at once.
- **Behavior U2B-AC-B5**: the Layer safety net closes a never-stopped authority, bounded, and leaves one that was stopped or withheld alone.
  - Seam: `acquireApplicationDatabaseAuthority(input)`, acquired with `Effect.runSync` into a `Scope` made by the test and released with `Scope.close(scope, Exit.void)`. The `runSync` acquire also pins that the acquire stays synchronous.
  - Test: `closes a never-stopped authority when its scope closes: $name` -> `apps/harness/src/storage/application-database-authority.test.ts` (`it.each`). Rows:
    - `never stopped, no work`: the close succeeds without advancing timers, and a later `transaction("write")` rejects with "…is stopped.";
    - `never stopped, lease held`: the close is pending at 999 ms and settles at 1 000 ms with an `Exit` that is a defect whose value is an `ApplicationDatabaseCloseUnconfirmed`, with no failure; admission is refused. Then a `stop()` called after the release settled rejects after `advance(0)`, with no further deadline, with the same `ApplicationDatabaseCloseUnconfirmed` instance as the Exit's defect value (`toBe`; V1, §118);
    - `stopped and confirmed`: the close succeeds, and `stop()` still returns its first promise;
    - `stopped, unconfirmed`: the close succeeds; the outcome was already reported by `stop`;
    - `withheld`: the close succeeds, and a new `transaction("write")` is still admitted.
  - Expected red, with the scaffold, per row (T2, §114):
    - `never stopped, no work`: a later `transaction("write")` is admitted instead of refused;
    - `never stopped, lease held`: the close succeeds at once with no defect, instead of staying pending at 999 ms and then dying;
    - the `stopped` and `withheld` rows are pins against the release.
  - Binding observation (T14, §114): record once that `stopped, unconfirmed` and `withheld` fail against a temporary release that ignores the stopped and withheld flags. Then restore the source, verified by digest, as s1 did (Q14, §106).
  - Expected red of the late-`stop()` oracle (V1, §118): it is added after the release exists, at the candidate `25183e3`, where it is green at once, because `close` already guards a second run (`application-database-authority.ts:257-258`). Its red is therefore a binding observation, recorded once against each of two temporary sources:
    - without the `if (closeStarted) return Deferred.await(closeOutcome);` guard (:257);
    - without `closeStarted = true` (:258).
    In both, the late `stop()` is still pending after `advance(0)`, because it starts a second deadline wait. Then restore the source, verified by digest.
- **Behavior U2B-AC-B6** (T6, §114): the harness process's application Layer runs the safety net when its runtime is disposed.
  - Seam: `ManagedRuntime.make(harnessServicesLayer(roots, silentLogger))` from `process-bootstrap.ts`, with roots under a temporary path that does not exist. The test reads `ApplicationDatabase` with `runtime.runSync`, as `process-bootstrap.ts:103-112` does, admits the B1 fake client through `admitClient`, and calls `runtime.dispose()`. The building constructors are lazy, so no disk is touched; if one does touch the disk, the test moves to `tests/integration/` under the reclassification rule.
  - Test: `runs the application database safety net when the process runtime is disposed: $name` -> `apps/harness/src/process-bootstrap.test.ts` (new, `it.each`). Rows:
    - `never stopped, no work`: `dispose()` resolves without advancing timers, and a later `transaction("write")` on the authority rejects with "Project Storage application database is stopped.";
    - `never stopped, lease held`: `dispose()` is pending at 999 ms and rejects at 1 000 ms with an `ApplicationDatabaseCloseUnconfirmed` (`_tag`, `deadlineMs` 1 000; `runPromise` squashes the release's defect to its value);
    - `withheld`: after `authority.withhold()`, `dispose()` resolves at once, and a later `transaction("write")` is still admitted;
    - `stopped`: after `authority.stop()` resolves, `dispose()` resolves, and `stop()` still returns its first promise.
    - In every row, the temporary roots still do not exist after `dispose()`.
  - Expected red, with the Layer still built by `createApplicationDatabaseAuthority` (`process-bootstrap.ts:181-186`):
    - `never stopped, no work`: a later write is admitted;
    - `never stopped, lease held`: `dispose()` resolves at once.
    - The `withheld` and `stopped` rows are pins: they are green before and after the wiring. B5's binding observation covers the flags they guard.
  - `pnpm check:dead-code` (Knip) must not report the two new exports as unused. It runs once on the final candidate, before acceptance (Success Criteria). If it reports them, the slice stops and the fault is reported; the gate is not weakened (U2, §115).
- **TDD-exempt**: none. The `applicationDatabaseLayer` wiring, which the approved 882c905a… contract exempted, is now proven by U2B-AC-B6 (T6, §114).

### Success Criteria: u2b-s3-authority-bounded-close

**Automated:**
- `pnpm exec vitest run --project harness apps/harness/src/storage/application-database-authority.test.ts apps/harness/src/harness-runtime-shutdown.test.ts apps/harness/src/harness-runtime.test.ts apps/harness/src/process-bootstrap.test.ts` — red, then green, per behaviour.
- Integration (the root is `apps/harness`; any run longer than 2 min needs the coordinator's GO at run time): `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts tests/integration/application-database-authority-cases.integration.test.ts tests/integration/application-database-authority.integration.test.ts tests/integration/process-bootstrap.integration.test.ts tests/integration/project-storage-node-adapters.integration.test.ts`. The last file covers the standalone Storage owner, whose `stop` awaits its own authority's stop (`project-storage-node-adapters.ts:346-348`). These four are the red-green loop.
- Whole integration suites (T7, §114): once on s3's final candidate, before s3's acceptance, with the coordinator's GO (a heavy run): `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts`, `pnpm exec vitest run --config apps/harness/vitest.registration.config.ts` and `pnpm exec vitest run --config apps/harness/vitest.native-long.config.ts`. The native-long project is excluded from the integration config (`apps/harness/vitest.integration.config.ts:12-16`) and holds a process-runtime suite under busy load and standalone Storage owners, so it runs under the same GO and the same stop rule (U1, §115). The bounded stop reaches every standalone Storage owner and every process-runtime suite, and `pnpm check` runs unit tests only (the `check` script of the root package manifest). Any failure, including an `ApplicationDatabaseCloseUnconfirmed` under load, stops the slice for triage.
- `pnpm typecheck` and `pnpm check`. CodeScene scores 10 on every changed file (AGENTS.md).
- `pnpm check:dead-code` (Knip): once on s3's final candidate, before s3's acceptance; it must not report the two new `process-bootstrap.ts` exports as unused (U2B-AC-B6). Any finding stops the slice; the gate is not weakened (U2, §115).
- Mutation (§105 R9 (a), D13): on s3's final candidate, before s3's acceptance, with the coordinator's GO, one scoped run.
  - Before the run, add to the `mutate` list of `stryker.project-storage.config.json` the line ranges, on the final candidate, of:
    - `application-database-authority.ts`: the error class, `APPLICATION_DATABASE_CLOSE_DEADLINE_MS`, the `closeDeadlineMs` default, the bounded `stop`, `withhold`, `closeIfNeverStopped` and `acquireApplicationDatabaseAuthority` (T17, §114);
    - `harness-runtime.ts`: the withheld branch;
    - `process-bootstrap.ts`: `applicationDatabaseLayer` (T6, §114).
  - The exact ranges, resolved at `25183e3` (V5, §118). They are re-resolved on the final candidate if the V-fixes move a line, and the coordinator checks them before the GO:
    - `apps/harness/src/storage/application-database-authority.ts:51-64` (the constant and the error class);
    - `apps/harness/src/storage/application-database-authority.ts:155-170` (`acquireApplicationDatabaseAuthority`);
    - `apps/harness/src/storage/application-database-authority.ts:179-185` (the state initializers: the `closeDeadlineMs` default, `closeOutcome`, `closeStarted`, `withheld`, `stopping`, `stopped`);
    - `apps/harness/src/storage/application-database-authority.ts:254-268` (the bounded, memoized `close`);
    - `apps/harness/src/storage/application-database-authority.ts:481-484` (`closeIfNeverStopped`);
    - `apps/harness/src/storage/application-database-authority.ts:509-515` (`stop` and `withhold`);
    - `apps/harness/src/harness-runtime.ts:154-157` (the `withhold` call and the withheld branch);
    - `apps/harness/src/process-bootstrap.ts:182-188` (`applicationDatabaseLayer`).
  - Writing these ranges and the includes below into the two config files is a config-only change on the final candidate. Its identity is recorded with the run (V5, §118).
  - Add `apps/harness/src/storage/application-database-authority.test.ts`, `apps/harness/src/harness-runtime-shutdown.test.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/src/process-bootstrap.test.ts` and `apps/harness/tests/integration/application-database-authority-cases.integration.test.ts` to the include of `apps/harness/vitest.project-storage-mutation.config.ts`.
  - Run `pnpm test:mutation:project-storage:harness --mutate <those ranges>`, with the eight ranges above, comma-separated.
  - `process-bootstrap.ts` is no longer left out: its wiring now has U2B-AC-B6 (T6, §114).
  - Pass: every mutant is killed; a Stryker `Timeout` counts as killed, as in s1 (§109; T17, §114). Any survivor stops the slice for triage by Pedro.
  - Pre-registered 0-mutant note (U6, §115; as s1 did, §108): `APPLICATION_DATABASE_CLOSE_DEADLINE_MS` and the `ApplicationDatabaseCloseUnconfirmed` class are expected to yield no counted mutants, because StrykerJS has no numeric-literal mutator and `ignoreStatic: true` (`stryker.project-storage.config.json:32`) skips the module-load tag. "Every mutant is killed" says nothing about them; their guard is B1's exact oracle (`_tag` "ApplicationDatabaseCloseUnconfirmed", the exact message, and `deadlineMs` 1 000 with the default deadline).
  - Correction of that note (V2, §118): only the constant (`application-database-authority.ts:52`) and the `Data.TaggedError("ApplicationDatabaseCloseUnconfirmed")` tag argument (:55-57) are pre-registered at 0 counted mutants. The class constructor (:61-63) runs for each new error, not at module load, so `ignoreStatic` does not skip it: its StringLiteral, ObjectLiteral and BlockStatement mutants are counted, and B1's exact message and `deadlineMs` oracle must kill them. A survivor there stops the slice like any other.

**Manual:**
- None for this slice.

### Slice u2b-s4-standalone-authority (detailed 2026-10-18)

- **slice_id:** `u2b-s4-standalone-authority`
- **Lane:** normal (D15). `lane.mjs --paths` over the planned files says fast; the lane only rises, so it stays normal. There is no intent review. The candidate gets the slice-verifier, and Pedro accepts the combined result once, before integration (shared **Lanes**).
- **Parent:** the accepted s3 on `refactor/123-effect-lifecycle-part-a`, HEAD `95ba184` (the mutation evidence commit after s3's final candidate `12aa956`, §121). s4 builds on s3's bounded, memoized `stop` (`application-database-authority.ts:509-512`).
- **Behaviour IDs:** U2B-SA-B1 … U2B-SA-B3. The outline's IDs are kept.
- **Deliverable:** under D7, a registry owns the standalone authority that `applicationDatabaseFor` keeps for the registry's options object. `registry.stop` stops that authority with s3's bound after its own admissions drain, and then removes its WeakMap entry. An injected authority is never stopped.
- **Product reach: none.** Production always injects the shared authority (`process-bootstrap.ts:209-215`; the only `createRegistrationRegistry` in `src`). The standalone path is test-only (Intent, scope item 4). The change closes the test-only leak, and B3 protects the shared authority's withhold rule (D6, `harness-runtime.ts:154-157`).
- **Affected source:**
  - `apps/harness/src/registration/registry-database.ts`: the one owner of the `standaloneAuthorities` WeakMap (:42-47) gains one export that stops and releases the entry for an options object. It never creates an authority; it does nothing for injected options or when no entry exists. `applicationDatabaseFor` (:49-68) is unchanged.
  - `apps/harness/src/registration/registration-registry.ts`: `stop` (:180-194) runs that release after the pending admissions settle, inside its existing `Effect.runPromise`, with no new `run*` (AGENTS.md).
- **Affected tests:**
  - `apps/harness/src/registration/registration-registry.test.ts` (new; no disk). It uses the s3 fakes `fakeClient`, `track` and `advance` from `apps/harness/tests/integration/application-database-close-fixture.ts:14, 37, 49`.
  - Kept integration pins, unchanged: `apps/harness/tests/integration/registration-repository-trust-cases.ts:524-544` ("keeps native repository-trust cancellation and absent native capability explicit") and :666-712 ("admits exact repository-trust only after persisted native selection and both decisions"; the restarts at :694 and :706). Both stop a registry, then build a new one over the same options object, so they now get a fresh authority. They run in `project-registration.integration.test.ts:131`.
  - Injected-authority integration pins, unchanged: `application-database-authority.integration.test.ts:96-123, 128, 186`.
- **Citation corrections at `95ba184`** (they amend Architecture "Standalone authorities" and the Deferred Work outline, which keep their text):
  - The WeakMap is at `registry-database.ts:42-47` and `applicationDatabaseFor` at :49-68 (cited as :44-67).
  - `registration-preparation.integration.test.ts:97-103` is not a same-object restart. Its `restart` stops the fixture's `scenario.registry`, which `createControlledIdentityConsent` builds over its own `consentRegistryOptions(root)` object (`registration-consent-fixture.ts:23-28, 80`), not the test's `options` (:53). So its restarted registry keeps the existing authority, and its behaviour is unchanged.
  - The same-object restarts are the trust-cases sites above.
- **Dependencies:** s3's bounded `stop`. s5 owns the listing stop chain and D17's 3 000 ms budget around `registry.stop` (U2B-HR-B2, U2B-HR-B6); s4 adds no budget.

#### Design points fixed for s4

1. **Owner and key.** The standalone authority is keyed by the options object's identity (`registry-database.ts:42-47`). Owners that share one options object share its authority, whichever of them created it. Under D7 the registry is its owner and the one that stops it. In every fixture that shares an object, the other owners are closed before `registry.stop`, and production never uses the path. Evidence: the impact scan of 2026-10-18 (Developer Context).
2. **Order inside `registry.stop`:**
   1. refuse new registry work (the existing `stopped = true`);
   2. let the pending admissions settle (unchanged);
   3. stop the standalone authority, if there is an entry;
   4. remove the entry after that stop settles, whatever its outcome, and only if the entry is still that authority.
   During the drain, other owners that share the object get the old, stopped authority and are refused ("Project Storage application database is stopped."). They never get a second authority over the same database file while the first is draining. After the stop settles, `applicationDatabaseFor` creates a fresh one.
3. **No creation at stop.** The release reads the WeakMap and never calls `applicationDatabaseFor`. A registry whose options never had an authority creates none at stop. A second `registry.stop` during the drain awaits the same memoized authority outcome (s3). A second `registry.stop` after the entry is gone resolves, because the outcome was already reported by the first.
4. **How an unconfirmed close surfaces.** It is typed and aggregated in the registry's existing stop contract: `registry.stop` rejects with `AggregateError("Registration registry did not stop cleanly.")`. Its `errors` are the failed pending admissions in admission order, then the authority's `ApplicationDatabaseCloseUnconfirmed`, which is the same instance as the authority's memoized rejection. The authority stop runs even when a pending admission failed. The listing stop already reports any registry rejection as the part `registry`, with that aggregate as its cause (`registration-listing.ts:13-25, 31-43`). So no new cleanup part and no protocol change are needed.
   - Rejected: a new `CleanupPart` "database", which only standalone (test) wiring could ever produce; and an unwrapped single error, which would split the registry's one stop contract.
5. **Deadline.** The standalone authority keeps the default 1 000 ms (s3; `applicationDatabaseFor` passes no `closeDeadlineMs`). The impact scan found that at the point of the authority stop, every registry admission has already drained (`registration-registry.ts:68-93, 180-190`), and no fixture injects a failing worker close. So in every existing test the authority stop sees no accepted work and settles at once. `RegistrationDatabaseOptions` gains no `closeDeadlineMs`. No kept pin needs a `15_000` override (unlike T5, §114), because the first migration runs inside a registry admission, which drains before the stop.
6. **Injected is untouched.** When `options.applicationDatabase` is defined, the release returns at once: it does not stop or await the injected authority, and it does not touch the WeakMap (precedent: `project-storage-node-adapters.ts:156-159, 345-348`). If this check were wrong, production `registry.stop` would stop the shared authority before `harness-runtime.ts:157` and break D6.
7. **Residual (existing, not changed):** the pending admissions are awaited with no bound before the authority stop (`registration-registry.ts:181-190`). An admission queued behind a lease that another owner never releases keeps `registry.stop` pending. The shutdown chain gets D17's budget in s5.

### Test Contract: u2b-s4-standalone-authority

- **Fakes and time:** options `{ applicationStorageRoot, migrationResourcesRoot }` under a temporary path that is never created. The standalone authority is read with the exported `applicationDatabaseFor(options)` before the registry stops. Constructing it touches no disk (s3 B6). A write lease is held with `authority.admitClient(fakeClient()).transaction("write")`, and released by the test. Time uses `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })` with `advance`, as in s3 (T16, §114). Every row also asserts that the temporary root still does not exist at the end; if one touches the disk, the test moves to `tests/integration/` under the reclassification rule.
- **Order of work:**
  1. B3 rows first, as pins. They are green at the parent.
  2. B1 red; then the minimal stop of the standalone authority, with no removal of the entry; B1 green.
  3. B2 red against that minimal implementation; then remove the entry after the stop settles; B2 green.
  4. The binding observations; then the kept integration pins.
- **Behavior U2B-SA-B1**: `registry.stop()` stops the standalone authority of its options object, after its own admissions, bounded, and reports an unconfirmed close typed inside its aggregate.
  - Seam: `createRegistrationRegistry(options)` and `registry.stop()`, with the authority from `applicationDatabaseFor(options)`.
  - Test: `stops the standalone authority of its options: $name` -> `apps/harness/src/registration/registration-registry.test.ts` (`it.each`). Rows:
    - `idle`: `registry.stop()` resolves after `advance(0)`, and a later `authority.admitClient(fakeClient()).transaction("write")` rejects with "Project Storage application database is stopped.";
    - `lease held`: `registry.stop()` is still pending at 999 ms and rejects at 1 000 ms with an `AggregateError` whose message is "Registration registry did not stop cleanly." and whose `errors` have length 1, with `errors[0]` `toBe` the rejection of `authority.stop()` (an `ApplicationDatabaseCloseUnconfirmed` with `deadlineMs` 1 000). Releasing the lease afterwards does not change that outcome;
    - `no standalone authority`: no owner ever read the authority. `registry.stop()` resolves after `advance(0)`, and the first `applicationDatabaseFor(options)` after it returns an authority that still admits a write. So stop created and stopped none.
  - Oracle: as in the rows. `stopped` refusal of new registry work is unchanged (the existing "Registration registry is stopped.").
  - Expected red, at `95ba184`:
    - `idle`: the later write is admitted, because `stop` never stops the authority (`registration-registry.ts:180-194`);
    - `lease held`: `registry.stop()` resolves at once, without waiting or rejecting;
    - `no standalone authority`: none — pin (it guards design point 3 against a stop that creates an authority to stop it).
  - Pin added (2026-10-18, decisions §123 addendum, Pedro: "Acrescentar teste leve"): `refuses registry work after stop` -> `apps/harness/src/registration/registration-registry.test.ts` (one `it`).
    - Row: after `registry.stop()` resolves (idle, with no authority read), `registry.hasUnsettled()` rejects with an `Error` whose message is "Registration registry is stopped." (`registration-registry.ts:70`), and the temporary root still does not exist.
    - Operation: `hasUnsettled()` takes no arguments and goes straight through `run` with no `catch` (`observer-journal.ts:283-284, 293`), so the refusal surfaces unchanged. `prepareExecutable` and `decideVersion` are not used, because they map the rejection through `registryFailure` (`registration-registry.ts:126-128, 162-164`). The refusal happens in `track` before `operation()` runs (:70-71), so the row uses no disk.
    - Expected red: none — pin (green at `95ba184` and on `f1ffe93`). Binding observation (M3, M4 in the s4 evidence): record once that the row fails against a temporary source with `stopped = true` replaced by `stopped = false`, and once against a temporary source with the `stopped = true;` statement removed (:182 on `f1ffe93`), because `hasUnsettled()` is admitted and does not reject with that message. Then restore the source, verified by digest. Under those sources the call may reach the disk under the temporary root; that root is removed after the observation, and the root assertion is not the oracle of the observation.
  - Pin added (2026-10-18, decisions §124, Pedro: "Mais um teste leve"): `waits for an in-flight admission before the database` -> `apps/harness/src/registration/registration-registry.test.ts` (one `it`, fake timers as above).
    - Setup: read `authority = applicationDatabaseFor(options)` and hold a write lease on it (`holdLease`). Call `authority.stop()` directly; it stays pending on the lease. Then, in the same synchronous turn, call `admission = registry.hasUnsettled()` and `stopping = registry.stop()`.
    - Why it is off disk: the admission enters `withRegistrationDatabase` (`registry-database.ts:114-130`). Its only filesystem contact is the read-only `lstat` of the absent root and `application.db` (`requirePlainEntries`, :95-112). It then fails in `openCurrent`'s `accept()` with "Project Storage application database is stopped." (`application-database-authority.ts:193-194, 501-503`), before any open or write. The admission is still in flight when `stop()` takes its snapshot, because the `lstat` awaits real I/O.
    - Row:
      - await the admission's rejection with real I/O, before any `advance`;
      - `stopping` is still pending at 999 ms;
      - at 1 000 ms it rejects with `AggregateError("Registration registry did not stop cleanly.")`, whose `errors` have length 2;
      - `errors[0]` is `toBe` the admission's rejection (message "…is stopped.");
      - `errors[1]` is `toBe` the rejection of `authority.stop()` (`ApplicationDatabaseCloseUnconfirmed`, `deadlineMs` 1 000);
      - the lease is released afterwards, and the temporary root still does not exist.
      This makes T-F executable: the pending failures come before the database failure.
    - Expected red: none — pin (green on `a664b19`). Binding observations, each recorded once against a temporary source and then restored, verified by digest:
      - `[...pending.values()]` replaced by `[]` (`registration-registry.ts:185`): the row fails, because `errors` has length 1 and `errors[0]` is the unconfirmed close;
      - the drain callback replaced by `() => undefined` (:185-186; Stryker reports it NoCoverage today): the row fails, because `stopping` does not reject with that `AggregateError`.
- **Behavior U2B-SA-B2**: once the stop settles, the same options object gets a fresh, working authority; during the drain it gets the old, stopped one.
  - Seam: the same, plus a new `createRegistrationRegistry(options)` and `applicationDatabaseFor(options)` after the stop.
  - Test: `gives the same options a fresh authority once the stop settles: $name` -> `apps/harness/src/registration/registration-registry.test.ts` (`it.each`). Rows:
    - `after a confirmed stop`: after `registry.stop()` resolves, `applicationDatabaseFor(options)` is a different instance (`not.toBe`) whose write is admitted;
    - `after an unconfirmed stop`: the same, after `registry.stop()` rejected at 1 000 ms;
    - `during the drain`: at 500 ms, while `registry.stop()` is pending on a held lease, `applicationDatabaseFor(options)` is still the old instance (`toBe`), and a new write through it rejects with "…is stopped.".
  - Expected red:
    - `after a confirmed stop` and `after an unconfirmed stop`: at `95ba184`, the same instance is returned (`toBe` instead of `not.toBe`). Against step 2's minimal implementation, the same, stopped instance is returned and its write rejects with "…is stopped.". The red is recorded against step 2's implementation.
    - `during the drain`: it fails at `95ba184`, because `registry.stop()` is not pending (B1's red).
  - Binding observation (the removal order, design point 2): record once that `during the drain` fails against a temporary source that removes the entry before stopping the authority, because a fresh instance is returned at 500 ms. Then restore the source, verified by digest.
  - Kept integration pins: the two trust-cases sites (Affected tests), with unchanged assertions. Expected red: none — pin.
- **Behavior U2B-SA-B3**: an injected authority is never stopped, awaited or replaced by the registry.
  - Seam: `createRegistrationRegistry({ ...options, applicationDatabase: injected })`, with `injected = createApplicationDatabaseAuthority({ applicationStorageRoot, migrationResourcesRoot })` on the same root. A spy around `injected.stop` records calls.
  - Test: `never stops an injected authority: $name` -> `apps/harness/src/registration/registration-registry.test.ts` (`it.each`). Rows:
    - `idle`: `registry.stop()` resolves after `advance(0)`; the spy saw no call; a write through `injected` is still admitted; `applicationDatabaseFor` of the injected options is still `injected` (`toBe`);
    - `lease held`: with a lease held on `injected`, `registry.stop()` resolves after `advance(0)`, without waiting for that lease; the spy saw no call.
  - Expected red: none — pin. The binding observation: record once that both rows fail against a temporary release that ignores the injected check. Then restore the source, verified by digest.
  - Kept integration pins: the injected-authority sites (Affected tests). Expected red: none — pin.
- **TDD-exempt**: none.

### Success Criteria: u2b-s4-standalone-authority

**Automated:**
- `pnpm exec vitest run --project harness apps/harness/src/registration/registration-registry.test.ts`: red, then green, per behaviour.
- Kept pins, the focused loop (the root is `apps/harness`; any run longer than 2 min needs the coordinator's GO at run time):
  - `pnpm exec vitest run --config apps/harness/vitest.registration.config.ts tests/integration/project-registration.integration.test.ts -t "repository-trust"`;
  - `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts tests/integration/application-database-authority.integration.test.ts`.
- Whole registration suite (the T7 analogue): once on s4's final candidate, before its gate, with the coordinator's GO (a heavy run, about 3 min in §117): `pnpm exec vitest run --config apps/harness/vitest.registration.config.ts`.
  - Every standalone registry in the repository is in this project (the impact scan). The integration project's only affected file, `project-entry-ui-seed.integration.test.ts`, is skipped without `PC_UI_USER_DATA`. No native-long file is affected, so neither of those two whole suites is required.
  - Any failure, including an `ApplicationDatabaseCloseUnconfirmed` or a "…is stopped." refusal, stops the slice for triage.
- `pnpm typecheck`, `pnpm check` and `pnpm check:dead-code` (the new export must have a caller). CodeScene scores 10 on every changed file (AGENTS.md).
- Mutation: none in s4 (D13, normal lane). s4 joins the one combined run for the normal slices on the final combined candidate, with the coordinator's GO:
  - `mutate`: the new release in `registry-database.ts`, and `registration-registry.ts` `stop`, as line ranges resolved on the final combined candidate;
  - include: `apps/harness/src/registration/registration-registry.test.ts` in `apps/harness/vitest.project-storage-mutation.config.ts`. The registration integration files stay out of the mutation include, because they spawn Git and harness children; the unit rows are the killing tests.
  - Expected 0-mutant lines: none known.

**Manual:**
- None for this slice.

### Slice u2b-s5-harness-runtime (detailed 2026-10-18)

- **slice_id:** `u2b-s5-harness-runtime`
- **Lane:** rigorous (§104 P6, D15). After Pedro approves this contract, it gets intent review: the slice-verifier in intent mode plus the code and coverage reviewer pair. The same three review the candidate, and Pedro accepts the slice on its own. `lane.mjs --paths` over the six source files says normal; the lane only rises.
- **Parent:** the s4 tip `df16fb7` on `refactor/123-effect-lifecycle-part-a` (s4 closed, §124). s5 uses s3's bounded authority stop and safety net, and s4's registry stop. It does not change their code.
- **Behaviour IDs:** U2B-HR-B1 … U2B-HR-B6. The outline's IDs are kept. Their seams and rows are refined below; the mapping is in the Follow-up of 2026-10-18T04:30.
- **Deliverable:**
  - The harness's two `run*` edges, the registration request edge and the shutdown fork, run on the process `ManagedRuntime`. `startHarnessRuntime` gets an edge runner.
  - The listing stop chain becomes an Effect that fails with a typed `RegistrationCleanupUnconfirmed`. It is bounded by `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` = 3 000 ms (D17), and its Promise facade is removed (D4).
  - The observer close uses an Effect deadline.
  - The process stop runs the program, then a bounded dispose, and aggregates both failures. A startup failure awaits a bounded dispose and aggregates it.
- **Affected source (at `df16fb7`):**
  - `apps/harness/src/harness-runtime.ts`:
    - the options type (:42-54) gains the edge runner, and the `projectListing.stop` type (:43) becomes an Effect;
    - `startStop` (:76-89) gets a sibling that starts an Effect stop in the caller's turn;
    - the listing call (:148);
    - the registration request edge (:299-305, its `Effect.runPromise` at :302);
    - the stop facade (:377-403, with the `runPromise` at :385 and the `runFork` at :397).
  - `apps/harness/src/process-bootstrap.ts`: `startHarnessProcessRuntime` (:80-142) becomes async and runs through a new exported disposal seam. This replaces the stop-then-dispose at :132-137 and the unawaited dispose at :138-141.
  - `apps/harness/src/process-entry.ts`: the bootstrap call (:79-88) awaits the startup, and `failStartup` (:32-35) runs only after the bounded dispose settled.
  - `apps/harness/src/registration/registration-listing.ts`:
    - the error class (:13-25) becomes a `Data.TaggedError`;
    - the chain (:31-44) gets the shutdown budget;
    - the facade (:51-56) is removed, and `stop` becomes the Effect.
  - `apps/harness/src/project-registration-observer.ts`: `settleClose` (:90-113) uses `Effect.timeoutOrElse` instead of `Promise.race` and `setTimeout`. Its Promise `close` surface (:146-152) and its 5 000 ms per-request budget are unchanged.
  - `apps/harness/src/registration/observer-limits.ts`: adds `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` = 3 000. `REGISTRATION_CLEANUP_BUDGET_MS` (:2) is unchanged.
- **Affected tests:**
  - `apps/harness/src/harness-runtime.test.ts`: B1 and B5 rows. The fixture `canonicalRuntimeFixture` (:97-168) and its listing type (:100) take an Effect stop.
  - `apps/harness/src/harness-runtime-shutdown.test.ts`: a B1 row. The fixtures at :198-234 (listing at :212) and at :275 take an Effect stop; their assertions are unchanged.
  - `apps/harness/src/process-bootstrap.test.ts`: B3 and B4, through the disposal seam. The s3 row at :63-96 is kept.
  - `apps/harness/src/registration/registration-listing.test.ts`: the B2 port and the B6 rows.
  - `apps/harness/src/project-registration-observer.test.ts`: the B2 pin at :154-197, unchanged.
  - Integration changes are mechanical and keep their assertions (the reclassification-rule category, which the coordinator approves):
    - every `startHarnessProcessRuntime(` call gets `await`. These are 10 call sites in 7 files: `process-bootstrap.integration.test.ts` (:215, :335, :363; the last two assert a throw, which becomes a rejection), `canonical-project-activation.integration.test.ts`, `project-conversation-runtime-fixture.ts`, `project-list-runtime.integration.test.ts`, `project-upgrade-runtime-fixture.ts`, `registered-project-selection.integration.test.ts` and `registration-flow-fixture.ts`;
    - `project-upgrade-runtime-fixture.ts:192` takes an Effect listing stop.
- **Citation re-resolution at `df16fb7`** (V8, §118). It amends Architecture "Harness runtime (slice 5)" and the Deferred Work outline, which keep their text:
  - the stop fork is at `harness-runtime.ts:397` (cited :395), the stop promise at :385, and the registration request edge at :302 (cited :300). The withheld branch is at :153-157 and the failures literal at :158-163;
  - "`harnessServicesLayer` and the services are module-private (`process-bootstrap.ts:152-179, 262`)" is stale. s3 exported `ApplicationDatabase` (:158-162) and `harnessServicesLayer` (:264-275); the other services stay private;
  - test pins:
    - `harness-runtime-shutdown.test.ts`: :23 → :36-101, :90 → :103-141, :130 → :143-196, :220 → :236-244, :230 → :246-256; s3's U2B-AC-B3 is at :258-314;
    - `harness-runtime.test.ts`: :201 → :207-230, :226 → :232-245, :241 → :247-258, :254-283 → :260-315, :914 → :948-956, :950 → :984-987;
    - `registration-listing.test.ts:75-95, 105-107` and `project-registration-observer.test.ts:154-197` are unchanged.
  - The second half of V8 is design point 9.
- **Dependencies:** s3's bounded `stop`, `withhold`, safety net and the `ApplicationDatabase` export; s4's bounded registry stop. s6 builds on nothing here, because it is in Electron main.
- **Round-1 amendment (§126, Y16): the integration inventory.** "10 call sites in 7 files" is corrected to 9 direct test calls in 7 files, plus the production call at `process-entry.ts:81`. Four sync helpers that wrap the call also become async, and their callers get `await`. All of these changes are mechanical, and their assertions are unchanged:
  - `startTrustedBootstrap` (`process-bootstrap.integration.test.ts:211`; the call at :215 is its `return`) is awaited at :233 and :288;
  - `startConversationProcessRuntime` (`project-conversation-runtime-fixture.ts:148`) is awaited in `project-conversation-runtime.integration.test.ts` (:168, :217, :306, :321, :412), a file not listed above;
  - `startRealUpgradeRuntime` (`project-upgrade-runtime-fixture.ts:103`) is awaited in `project-upgrade-runtime.integration.test.ts` (:62, :546, :567), a file not listed above;
  - `runtime()` (`registered-project-selection.integration.test.ts:42`) is awaited at :173, :257, :258, :305, :337, :407, :431, :443 and :464;
  - `registrationSession` (`registration-flow-fixture.ts:57`) is already async, so only its inner call at :65 gets `await`.
- **Round-2 amendment (§127, W8): further mechanical sites.** These are also mechanical, and their assertions are unchanged; typecheck enforces them:
  - `registered-project-selection.integration.test.ts`: the `runtime()` callers at :501 and :502, and the `ReturnType<typeof runtime>` uses at :70, :95 and :128, which become `Awaited<ReturnType<typeof runtime>>`;
  - `project-conversation-runtime-fixture.ts:165-168`: the `ConversationProcessRuntime` type becomes `Awaited<…>`;
  - `project-conversation-runtime.integration.test.ts:46-56`: the `inRuntime` `start` parameter and its call become async. The synchronous composed runtime that it receives at :589 is wrapped to match;
  - `project-conversation-runtime-busy.integration.test.ts` (:27-37, :49, :68): a native-long file (`vitest.native-long-files.ts:9`) that was not listed before.

#### Design points fixed for s5

1. **The edge runner.** `startHarnessRuntime` takes an optional `runtime: Readonly<{ runFork; runPromiseExit }>`, which is the part of `ManagedRuntime` it uses.
   - It defaults to the global `Effect.runFork` and `Effect.runPromiseExit`, so the 28 unit and integration callers that build no runtime keep their code.
   - `startHarnessProcessRuntime` passes its `ManagedRuntime`. Every runtime fiber is then attached to the runtime's fiber scope, which `dispose` interrupts and awaits (`node_modules/effect/src/ManagedRuntime.ts:290-297`; `node_modules/effect/src/internal/effect.ts:5700-5720`).
2. **Same-turn closure is kept.** The listing stop Effect is forked with `runtime.runFork` in the caller's turn, at the same point as today (:148). `runFork` evaluates synchronously until the first async boundary (effect.ts:5681), so `owner.close()` is called in the same turn as `stopMessages()`.
   - The pins `harness-runtime-shutdown.test.ts:36-101` (`calls` at :88) and `harness-runtime.test.ts:984-987` guard this.
   - The eager calls at :117-118 are unchanged.
3. **The stop promise always settles.** The program's `completion` is completed in an `Effect.onExit` of the forked program, not by a `flatMap` after `Effect.exit`. If the program fiber is interrupted, for example by a dispose while it runs, the stop promise still rejects and never hangs. Promise identity and re-entry are unchanged (:381-384; pins :36-101, :103-141).
4. **The listing stop chain (D17).**
   - `createRegistrationListing(...).stop` is an `Effect.Effect<void, RegistrationCleanupUnconfirmed>`.
   - Its chain stays sequential: owner close, observer close, registry stop (:33-37). It runs under one `Effect.timeoutOrElse` of `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` = 3 000 ms.
   - The bound holds because the racer is interruptible: each part is an `Effect.promise`, which an interruption abandons at once (`effect.ts:1686-1706`).
   - When the budget runs out:
     - the part in progress and every part not yet started are named unconfirmed, in the existing order (registry, observer, listing);
     - a part not yet started is not started, so the registry is not stopped after the budget;
     - there is no cause unless the registry stop itself failed.
   - The owner's own 5 000 ms drain (`project-registration-preparation.ts:273-277`) and the observer's 5 000 ms close stay as they are for their per-request users. Inside the shutdown chain, the 3 000 ms bound is the shorter one.
   - The facade (:51-56) is removed, because its only production caller was `harness-runtime.ts:148` (D4).
5. **The error.** `RegistrationCleanupUnconfirmed` becomes a `Data.TaggedError("RegistrationCleanupUnconfirmed")` with `parts`, the same message, and `cause` only when there is one.
   - Effect 4 sets `name` to the tag and passes `cause` only when it is given (`node_modules/effect/src/internal/core.ts:615-643`).
   - So the CNV-B37 oracle (`registration-listing.test.ts:85-91`: `name`, `parts`, `message`, `cause`, `hasCause`) holds unchanged.
6. **The disposal seam.** `process-bootstrap.ts` exports `launchOnProcessRuntime({ layer, start, disposeDeadlineMs? })`, which returns `Promise<StopHarnessRuntime>`.
   - `startHarnessProcessRuntime` validates the bootstrap as today. It then calls the seam with `harnessServicesLayer` and a `start` that extracts the services and calls `startHarnessRuntime` with the runtime as its edge runner.
   - When `start` succeeds, the returned stop runs the program, then a bounded dispose. One promise is shared by every call (the `??=` at :135).
   - The stop rejects with one of:
     - the program's failure alone;
     - the dispose's failure alone;
     - `AggregateError([programFailure, disposeFailure], "Harness process shutdown failed.")`, program first. Neither failure is flattened or replaced (U2B-HR-B3).
   - When `start` throws, the returned promise rejects only after a bounded dispose settled: with the startup error alone, or with `AggregateError([startupError, disposeFailure], "Harness startup failed.")` (U2B-HR-B4).
   - Bootstrap validation errors (decode, roots, overlap: :88-96) are thrown before any runtime exists. They become rejections of the async function.
7. **The bounded dispose.**
   - `Effect.timeoutOrElse(runtime.disposeEffect, …)` would not be bounded. `disposeEffect` closes its scope uninterruptibly (effect.ts:3947-3953), and a timeout waits for the loser's interruption to finish (effect.ts:1691, 940-951).
   - So the seam forks `runtime.disposeEffect` detached (`Effect.forkDetach`) and awaits that fiber under `Effect.timeoutOrElse`. Awaiting a fiber never interrupts it (effect.ts:812-821).
   - If the deadline passes, the failure is a new `HarnessRuntimeDisposeUnconfirmed` (a `Data.TaggedError` with the fixed message "Harness runtime dispose is unconfirmed." and `deadlineMs`). The dispose keeps running in the background while the process exits.
   - The deadline is `HARNESS_RUNTIME_DISPOSE_DEADLINE_MS`, Pedro's decision (P-S5-1; proposed 500 ms).
   - The seam runs on the global runtime, because it outlives the process runtime.
8. **Interruption is not a failure reply.** The registration edge runs `runtime.runPromiseExit`.
   - An exit that is only an interruption sends no reply. An example is a request still in flight when `dispose` interrupts it. It is not converted into the internal failure (AGENTS.md: do not turn an interruption into a domain error).
   - Any other failure or defect keeps today's path: the handler's `.catch` sends the neutral internal failure (:361-365).
   - After a normal stop the subscription is gone, so a later request reaches no handler (pin `harness-runtime.test.ts:948-956`).
9. **V8 (§118): `close` stays off interruptible callers.** s5 adds no caller of the authority's internal `close` (`application-database-authority.ts:256-268`). It is still run only:
   - by `stop()` (:509-512), on its own root fiber through `Effect.runPromise`, which is not attached to the process runtime and has no interrupt handle;
   - by `closeIfNeverStopped` (:481-484), inside the uninterruptible layer release.

   Moving the program onto the process runtime puts the *awaiting* of `stop()`'s promise on an interruptible fiber, never `close` itself. This is a static check at candidate review: every `close` reference in that file is searched.
   - Any later slice that runs `close` on an interruptible fiber must first make it interruption-safe (T-S5-D).
   - Even if that broke, design point 7 keeps the process stop bounded.
10. **Residuals (existing, not changed):**
    - the Storage and canonical stops are unbounded (`harness-runtime.ts:114-141`; Part B), so the D17 sum holds only while they settle;
    - the registry's pending-admission wait is unbounded (s4 design point 7). It now sits inside the 3 000 ms budget, so the shutdown chain is bounded and the registry is reported unconfirmed.
11. **Round-1 amendments to the design points (§126). Where they differ from the points above, these govern:**
    - **DP3 (Y12).** The stop promise (:385) stays on the global `Effect.runPromise`. Only the program fork (:397) moves to the edge runner. So `dispose` can interrupt the program, but never the fiber that awaits `completion`.
    - **DP4 (Y6).** When the budget runs out, the named parts are, in the existing order (registry, observer, listing):
      - every part that already completed unconfirmed;
      - the part in progress;
      - every part not yet started.
    - **The Effect-stop starter (Y9).** It maps every exit of the listing stop that is not an interruption into the failures list: a typed failure, or a defect squashed to its value. This is how `startStop` already collects any rejection (:76-89). So a listing defect is aggregated, and the database still stops.
    - **The option type (Y17).**
      - `projectListing.stop` is typed `Effect.Effect<void, unknown>`. The kept fixtures that fail with a plain `Error` (`harness-runtime-shutdown.test.ts:279`) therefore keep their `toBe` assertions.
      - `createRegistrationListing(...).stop` itself is `Effect.Effect<void, RegistrationCleanupUnconfirmed>`, which fits that type.
    - **DP8 (Y23).** An interruption-only exit sends no reply only once stop has begun (`stopPromise !== undefined`, :380-385). Before that, it takes today's path and gets the neutral internal failure. A self-interruption that no dispose caused is never silent.
    - **The observer close (Y10).**
      - `settleClose` drops the `performance.now() >= deadline` clause, because the `Effect.timeoutOrElse` race decides lateness. It keeps the `pending-recovery` check.
      - The existing `Promise.all(work)` stays inside the temporary Promise facade (T-S5-G). It runs over inspections that are already running and starts no work, the same case as §124 X3.
      - Disclosed: if a reviewer requires `Effect.forEach` instead, an explicit `concurrency` option is an equivalent mutant. The choice then goes to Pedro as an AGENTS.md:69 exception, as X3 did.
    - **process-entry (Y20).** The candidate-review static check also confirms:
      - on the success path, the awaited launch is followed by `port.on("close", …)` and `port.start()` with no macrotask boundary, because the launch settles in a microtask;
      - on the failure path, `failStartup` is called only after the launch promise settled.
    - **DP10 (Y24).** Storage and the canonical application run in parallel with the listing (`harness-runtime.ts:150-152`), and the database stop waits for both. So the D17 sum of 4 500 ms holds only while they settle within the 3 000 ms listing window.
12. **Round-2 amendments to the design points (§127). Where they differ from the points above, these govern:**
    - **The Effect-stop starter, interruption (W2).** A listing exit that is only an interruption is re-raised as the program's own interruption, not mapped into the failures list. The program then ends interrupted, so the stop rejects through DP3's `onExit` with the squashed interruption, and the database stop is not called. The database is left to the layer safety net (`closeIfNeverStopped`), which runs at dispose. An interrupted listing is never reported as clean (`.rpiv/decisions/degrade-distinguishes-broken.md`).
    - **Seam routing, static check (W5).** The candidate-review static check also confirms the following in `process-bootstrap.ts`:
      - `startHarnessProcessRuntime` validates the bootstrap, then returns `launchOnProcessRuntime({ layer: harnessServicesLayer(…), start })`;
      - it has no dispose of its own, no `catch` around `start`, and no `disposeDeadlineMs`;
      - `dispose` and `disposeEffect` are used only inside `launchOnProcessRuntime`.

      The Y14 row proves the edge-runner wiring, and this static check proves the routing through the seam. That supersedes the wording "fully covered by … the Y14 row" in the TDD exemption above, and "Its wiring is proven by the Y14 row instead" in the Success Criteria amendments.
13. **Candidate round-1 amendments to the design points (§131). Where they differ from the points above, these govern:**
    - **Completion outside the forked effect (Z2).**
      - `stop()` still forks the shutdown program with `runtime.runFork`. It completes `completion` from that fiber's exit, observed on the global runtime (for example `Effect.runFork` of `Fiber.await(fiber)` feeding `Deferred.done`), not from an `Effect.onExit` inside the forked effect.
      - The reason: on a disposed runtime, `ManagedRuntime.runFork` runs `flatMap(contextEffect, …)` with `contextEffect = Effect.die("ManagedRuntime disposed")` (`node_modules/effect/src/ManagedRuntime.ts:343-351, 389-396`). The forked effect, and any `onExit` inside it, then never runs.
      - So the stop promise always settles (DP3). A first `stop()` after the dispose rejects with that defect instead of hanging.
    - **One branch decides the registry outcome (Z5, Pedro §131 (b)).**
      - In `stopWithinBudget` (`registration-listing.ts:57-61` on `1ab1762`), the registry `Result` decides both the registry flag and the cause in one branch. For example: `Result.isFailure(registry) ? { parts: unconfirmedParts(progress, true), cause: registry.failure } : { parts: unconfirmedParts(progress, false), cause: undefined }`.
      - No mutant can then read `.failure` from a Success, which would be an equivalent mutant (`node_modules/effect/src/internal/result.ts:92-95`).
      - Behaviour does not change: the B2 and B6 rows stay as pins.
    - **The observer close is an Effect (Z6, Pedro §131 (b)). This reverses T-S5-G and the round-1 Y10 facade.**
      - `ProjectRegistrationObserver` gains `closeEffect: Effect.Effect<ObserverCloseResult>`.
      - Its first evaluation marks the observer closed and aborts every active inspection. It then settles their work with `Effect.forEach(work, (w) => Effect.promise(() => w), { concurrency: "unbounded" })`, under `Effect.timeoutOrElse(REGISTRATION_CLEANUP_BUDGET_MS)`. The mapping is unchanged: any `pending-recovery` result, or the deadline, gives the unconfirmed answer.
      - `settleClose` no longer calls `Effect.runPromise`, and no `Promise.all` remains.
      - **Re-entry.** The outcome is kept in a `Deferred` made at construction (`Deferred.makeUnsafe`), and later evaluations await it.
        - If the first evaluation is interrupted (for example by the listing's 3 000 ms budget), the interrupted caller stays interrupted.
        - The `Deferred` is then completed with the unconfirmed answer. So a later close answers `pending-recovery` / `OBSERVER_CLEANUP_UNCONFIRMED` at once.
        - An interrupted close is never reported as confirmed.
      - `RegistrationListingPorts.observer` becomes `Readonly<{ closeEffect: Effect.Effect<Closed> }>`. The listing chain yields it directly, with no `Effect.promise` bridge, so the budget interrupts it.
      - **The Promise `close()` stays, as `Effect.runPromise(closeEffect)`, for the Promise callers.**
        - At `1ab1762` these are tests only: 52 sites in 20 files under `apps/harness/tests/` plus the unit file, and `tests/integration/registration-observer-peer.mjs`.
        - No production caller of this observer's `close` remains. `project-registration-preparation.ts:83` closes the physical-identity observer, which is a different one.
        - Under AGENTS.md this is a temporary Promise facade. Its removal trigger is recorded in the Follow-up.
      - Unchanged: `inspectGitVersion`, the physical-identity observer and `REGISTRATION_CLEANUP_BUDGET_MS`.
      - The production listing gets the observer through `projectRegistrationLayer` (`process-bootstrap.ts:209`), which has `closeEffect`, so it needs no other change.
      - The frozen measurement tool (evidence at `f7c11a5`) is not changed.
14. **Candidate round-2 amendments to the design points (§132). Where they differ from the points above, these govern:**
    - **No explicit concurrency in `settleClose` (V1, Pedro §132 (b); as s4 X3, §124).**
      - `settleClose` awaits the inspections with `Effect.forEach(work, (inspection) => Effect.promise(() => inspection))`, with no `concurrency` option.
      - Above it goes an AGENTS.md:69 exception comment in the style of `registration-registry.ts:185`. For example: "Only awaits inspections already running and starts no work, so no `concurrency`."
      - Why a sequential await is equivalent: the work promises are already running and never reject (`project-registration-observer.ts:132-145`), so awaiting them one by one gives the same results at the same time under the same `timeoutOrElse`.
      - This replaces design point 13's "`Effect.forEach(work, …, { concurrency: "unbounded" })`". It removes the two equivalent mutants (`{}` and `""`), so nothing is pre-registered.
    - **`startStop` settles eagerly (V3, Pedro §132 (b)).**
      - `startStop` (`harness-runtime.ts:87-100` on `a17a2ac`) attaches the settlement handlers in the caller's turn: `const settled = Promise.resolve(started).then(() => [], (error: unknown) => [error])`. It returns `Effect.promise(() => settled)`.
      - A cleanup that was started eagerly therefore never leaves an unhandled rejection, even when the program never runs. That happens on a disposed runtime: a `stop()` first called after `runtime.dispose()` calls the canonical stop eagerly (:147), but the program dies before it runs (DP13 Z2).
      - Unchanged: the result values, the same-turn call, and the order. On the normal path the program reads the same settled value.
      - Not changed by V3: on that never-run path the stop still rejects with the "ManagedRuntime disposed" defect alone. The canonical outcome is now settled, but it is not aggregated into the rejection. That part stays in the Z4 residual (Follow-up).

### Test Contract: u2b-s5-harness-runtime

- **Fakes and time:**
  - Fake timers are `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })` with `advance` from `tests/integration/application-database-close-fixture.ts:37, 49`, as in s3 and s4 (T16, §114). The observer pin keeps its own plain `vi.useFakeTimers()` (:154-197).
  - Process runtimes in unit rows are `ManagedRuntime.make(...)` over in-memory Layers: `Layer.empty`, or a test Layer whose `acquireRelease` release is a controlled Effect.
  - No row touches the disk.
- **Order of work:**
  1. Scaffold the new surfaces with today's behaviour, then observe each red below against the scaffold:
     - the `runtime` option, accepted and ignored;
     - `launchOnProcessRuntime` as today's code moved verbatim: stop, then `stopped.finally(dispose)`; on a start throw, an unawaited dispose and a rethrow;
     - the Effect-typed listing `stop` as a wrapper of today's chain.
  2. B2 (port and pins), B6, B1 and B5, B3, B4, in that order.
  3. The heavy runs and the mutation run last (Success Criteria).
- **Behavior U2B-HR-B1**: the shutdown program and the registration edge run on the process runtime, and the same-turn, re-entry, withheld, not-held and aggregation pins hold.
  - Seam: `startHarnessRuntime({ ..., runtime })` with `runtime = ManagedRuntime.make(Layer.empty)`.
  - Test: `settles the stop when the process runtime is disposed during the program` -> `apps/harness/src/harness-runtime-shutdown.test.ts` (one `it`). Row:
    - the listing stop is an Effect that records "listing-started", then waits forever and records its interruption;
    - `stop()` is still pending after `advance(0)`;
    - `runtime.dispose()` then resolves after `advance(0)`;
    - the listing stop recorded its interruption, the stop promise is rejected, and a second `stop()` returns the same promise.
  - Expected red, against the scaffold at `df16fb7`: the program runs on the global runtime, so the dispose does not interrupt it. The listing stop records no interruption, and `stop()` stays pending.
  - Kept pins, with their assertions unchanged and the listing fixtures taking an Effect stop:
    - `harness-runtime-shutdown.test.ts:36-101, 103-141, 143-196, 236-244, 246-256, 258-314`;
    - `harness-runtime.test.ts:207-230, 232-245, 247-258, 260-315, 984-987`.

    Expected red: none — pin.
  - The registration edge is proven by B5's row.
- **Behavior U2B-HR-B2**: the listing stop is an Effect that fails with the typed `RegistrationCleanupUnconfirmed`, and the observer close uses an Effect deadline.
  - Seam: `createRegistrationListing(ports).stop`, run with `Effect.runPromiseExit`; and `createProjectRegistrationObserver(...).close()`.
  - Test: `names every unconfirmed part: $name (CNV-B37)` and `stops when every part is confirmed (CNV-B37)` -> `apps/harness/src/registration/registration-listing.test.ts` (:75-95, :105-107), ported. The `stopFailure` helper (:25-39) reads the failure from the Exit. The oracle is unchanged and gains `_tag` "RegistrationCleanupUnconfirmed".
  - Test: `closes by the cleanup deadline and refuses a late successful observation` -> `apps/harness/src/project-registration-observer.test.ts` (:154-197), unchanged.
  - Expected red: none — pin. These are ported, and the behaviour is unchanged. The facade's removal is checked by `pnpm check:dead-code` and typecheck.
- **Behavior U2B-HR-B3**: a dispose failure after a failed stop is aggregated, not substituted, and the dispose is bounded.
  - Seam: `launchOnProcessRuntime({ layer, start, disposeDeadlineMs: 500 })`. Its `start` returns a stop that resolves, or rejects with `S`. Its test Layer's release is `Effect.void`, `Effect.die(D)` or `Effect.never`.
  - Test: `aggregates the program and the dispose: $name` -> `apps/harness/src/process-bootstrap.test.ts` (`it.each`). Rows:
    - `both fail`: rejects with `AggregateError("Harness process shutdown failed.")`, whose `errors` have length 2: `errors[0]` `toBe` `S` and `errors[1]` `toBe` `D`;
    - `only the dispose fails`: rejects with `D` (`toBe`);
    - `only the program fails`: rejects with `S` (`toBe`);
    - `the dispose never ends, the program fails`: still pending at 499 ms. At 500 ms it rejects with an aggregate whose `errors[0]` is `toBe` `S` and whose `errors[1]` is a `HarnessRuntimeDisposeUnconfirmed` with `deadlineMs` 500;
    - `both succeed`: resolves after `advance(0)`, and a second call returns the same promise.
  - Expected red, against the scaffold:
    - `both fail`: rejects with `D` alone, because `finally` replaces the failure (:135);
    - `the dispose never ends, the program fails`: still pending at 500 ms;
    - the other three rows: none — pin.
- **Behavior U2B-HR-B4**: on a startup failure, a bounded dispose completes before the failure is reported, and its failure is aggregated, not lost.
  - Seam: `launchOnProcessRuntime` with a `start` that throws `E`.
  - Test: `reports a startup failure after a bounded dispose: $name` -> `apps/harness/src/process-bootstrap.test.ts` (`it.each`). Rows:
    - `the dispose dies with ApplicationDatabaseCloseUnconfirmed`: the test Layer's release dies with an `ApplicationDatabaseCloseUnconfirmed` instance `U`. The launch rejects with `AggregateError("Harness startup failed.")`, whose `errors` are exactly `[E, U]` (`toBe` each);
    - `the dispose succeeds`: rejects with `E` (`toBe`), and only after the release ran: a flag set in the release is `true` when the rejection is observed;
    - `the dispose never ends`: still pending at 499 ms; at 500 ms it rejects with `[E, HarnessRuntimeDisposeUnconfirmed]`.
  - Expected red, against the scaffold (the unawaited dispose and the rethrow, :138-141):
    - `the dispose dies…`: rejects with `E` alone, and `U` is lost;
    - `the dispose succeeds`: the rejection is observed before the release ran;
    - `the dispose never ends`: rejects at once with `E`.
  - `process-entry.ts` awaits the launch before `failStartup`. The entry is a script with no unit seam, so this is a static check at candidate review. Its packaged path is covered by `package:launch-smoke`.
- **Behavior U2B-HR-B5**: a registration request in flight at dispose is interrupted, gets no reply, and causes no unhandled rejection. After a stop, a request gets no reply.
  - Seam: `startHarnessRuntime({ ..., runtime, projectRegistration })` with `runtime = ManagedRuntime.make(Layer.empty)`. The fake flow's `handle` is an Effect that never ends and records its interruption. The request is `createProjectRegistrationCommand(...)`, as at `harness-runtime.test.ts:766-769`.
  - Test: `interrupts an in-flight registration request at dispose without a reply` -> `apps/harness/src/harness-runtime.test.ts` (one `it`). Row:
    - emit the request; then `await stop()` and `await runtime.dispose()`;
    - the handle recorded its interruption, and `transport.sent` is `[]`;
    - a `process.on("unhandledRejection")` listener, added for the test and removed after it, saw nothing after one more macrotask.
  - Expected red, against the scaffold at `df16fb7`: the request runs on the global runtime, so `dispose` does not interrupt it, and the handle records no interruption.
  - Binding observation (design point 8): record once that the row fails against a temporary source whose edge sends the internal failure on an interruption-only exit (`transport.sent` then has one `request.failure`). Then restore the source, verified by digest.
  - Kept pin: `stops receiving messages after disposal` (`harness-runtime.test.ts:948-956`). Expected red: none — pin.
- **Behavior U2B-HR-B6**: the shutdown listing cleanup ends within `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` and names the parts left unconfirmed.
  - Seam: `createRegistrationListing(ports).stop`, with fake ports, fake timers and `Effect.runPromiseExit`.
  - Test: `bounds the shutdown cleanup by its budget: $name` -> `apps/harness/src/registration/registration-listing.test.ts` (`it.each`). Rows:
    - `the owner close never settles`: still pending at 2 999 ms. At 3 000 ms it fails with `parts` `["registry", "observer", "listing"]` and no cause. The observer close and the registry stop were never called;
    - `the observer close never settles`: the owner closed. At 3 000 ms `parts` are `["registry", "observer"]`, and the registry stop was never called;
    - `the registry stop never settles`: at 3 000 ms `parts` are `["registry"]`, with no cause;
    - `the registry stop fails at 2 999 ms`: it settles at 2 999 ms with `parts` `["registry"]` and that failure as the cause. This is the boundary just under the budget.
  - Expected red, against the scaffold at `df16fb7`:
    - the first three rows are still pending at 3 000 ms, because the chain has no budget (`registration-listing.ts:31-44`);
    - the last row: none — pin.
- **TDD-exempt**: none.
- **Round-1 amendments to the Test Contract (§126). Where they differ from the rows above, these govern:**
  - **Fakes and time (Y22).**
    - `vi` fake timers stay instead of `TestClock`. The listing and observer ports are Promise fakes, they must share one clock with the Effect budget, and `TestClock` does not drive `setTimeout`-based Promise fakes (T16, §114).
    - If the rewrite needs Effect's `setImmediate` scheduler to run, the observer pin may narrow its `vi.useFakeTimers()` to `toFake: ["setTimeout", "clearTimeout", "performance"]`. That is a fixture change; its assertions stay unchanged.
  - **Order of work, step 1 (Y18).** The scaffold also changes `projectListing.stop` to an Effect (:43), and starts it eagerly on the global runner at :148. So the B1 red is "stays pending", not a TypeError.
  - **Runtimes in rows (Y12, Y13).**
    - Every unit `ManagedRuntime` is built before the behaviour under test, as production does (`process-bootstrap.ts:103-112`): `runtime.runSync(Effect.void)`, or `runtime.runSync(TestService)` for a test Layer.
    - `launchOnProcessRuntime`'s `start` receives the runtime. Every test `start` builds the Layer first, then returns its stop or throws. Without that, the release of the lazily built Layer never runs (`ManagedRuntime.ts:310-325`).
  - **B1, sharpened (Y12).**
    - In `settles the stop when the process runtime is disposed during the program`, the stop promise rejects with an `Error` whose message is "All fibers interrupted without error" (the squashed interrupt-only cause, `node_modules/effect/src/internal/effect.ts:303-311`).
    - Binding observation (DP3): record once that the row fails against a temporary source that keeps today's completion, a `flatMap` after `Effect.exit` (:397-400), on the edge runner; there `stop()` stays pending. Then restore the source, verified by digest.
  - **B1, same-turn pin (Y2).** Test: `starts the listing stop in the caller's turn: $runner` -> `apps/harness/src/harness-runtime-shutdown.test.ts` (`it.each` over `default` and `process runtime`, the latter pre-built).
    - The listing fixture records "listing-started" when its Effect starts.
    - Synchronously after `stop()` returns, before any `await`, `calls` contains "listing-started".
    - Expected red: none — pin (the scaffold starts it eagerly).
    - Binding observation: record once that the row fails against a temporary source that starts the listing stop inside the program, after an async boundary. Then restore the source, verified by digest.
  - **B1, a listing defect (Y9).** A row in `shutdown failures while no Project is held` (`harness-runtime.test.ts:260-315`) whose listing stop is `Effect.die(defect)`.
    - Oracle: the database stop is called once, `withhold` is never called, and the stop rejects with exactly `defect` (`toBe`).
    - The scaffold already collects every rejection, so this is recorded as a binding observation. Against a starter that collects only typed failures, the defect kills the program, the database stop is not called, and the stop rejects with the defect without the database step.
  - **B2, the `_tag` red (Y7).** The ported CNV-B37 rows are red against the scaffold on `_tag` alone, because today's class has none (`registration-listing.ts:17-25`). They turn green with DP5. That red is recorded in the s5 TDD evidence; the rest of the oracle is a pin.
  - **B2, observer rows (Y10)**, in `apps/harness/src/project-registration-observer.test.ts`:
    - `answers cleanup unconfirmed when aborted work prepares before the deadline`: `version.inspect` resolves `prepared` after `close()` aborted it, before the deadline. `close()` answers `{ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }` at that moment, not at 5 000 ms.
    - `answers cleanup unconfirmed when one of two inspections is pending recovery`: two inspections are in flight, and both end before the deadline, one `cancelled` and one `pending-recovery`. `close()` answers `OBSERVER_CLEANUP_UNCONFIRMED`.
    - Expected red: none — pin (today's `settleClose` already answers this way, :97-104).
  - **B3 (Y5, Y13, Y19).**
    - The bounded row `the dispose never ends, the program fails` uses `disposeDeadlineMs: 50`. It is still pending at 49 ms. At 50 ms its `errors[1]` is a `HarnessRuntimeDisposeUnconfirmed` with `_tag` "HarnessRuntimeDisposeUnconfirmed", the message "Harness runtime dispose is unconfirmed." and `deadlineMs` 50. The other B3 rows keep 500 ms.
    - New row `waits for the program before the dispose`: the program settles at 100 ms. At 99 ms the stop is pending and the release flag is `false`; at 100 ms the release has run and the stop resolves. Expected red: none — pin (the scaffold's `finally` already orders them).
  - **B4 (Y1, Y5, Y21).** Every B4 row omits `disposeDeadlineMs`, so the default `HARNESS_RUNTIME_DISPOSE_DEADLINE_MS` applies.
    - `the dispose succeeds` is replaced by `the dispose takes 10 ms`:
      - the release is `Effect.sleep(10 ms)` followed by setting a flag;
      - the launch is still pending at 9 ms; at 10 ms it rejects with `E` (`toBe`), and the flag is `true` when the rejection is observed;
      - Expected red, against the scaffold: it rejects at once, and the flag is `false`.
    - `the dispose never ends`: still pending at 499 ms. At 500 ms it rejects with `[E, HarnessRuntimeDisposeUnconfirmed]`; the latter has the `_tag`, the exact message and `deadlineMs` 500. This row guards the constant.
    - `the dispose dies with ApplicationDatabaseCloseUnconfirmed`: against the scaffold, its Expected red also produces an unhandled rejection from `void runtime.dispose()` (:139). Vitest reports it beside the assertion failure. It is part of the red, not a setup error.
  - **B5, the other exits at the edge (Y8, Y23).** Test: `answers registration exits on the process runtime: $name` -> `apps/harness/src/harness-runtime.test.ts` (`it.each`, on a pre-built `ManagedRuntime.make(Layer.empty)`). Rows:
    - `handle succeeds`: one `project.registration.result` with the handle's value, correlated to the request;
    - `handle fails`: one correlated `request.failure` with `HARNESS_INTERNAL_FAILURE`;
    - `handle dies`: the same;
    - `handle interrupts itself before any stop` (Y23): the same.
    - Expected red: none — pin (today's path) for the first three. For the last, a binding observation: record once that it fails against a temporary edge that stays silent on every interruption-only exit. Then restore the source, verified by digest.
    - Kept integration pin (Y8): `registration-list-removal-race.integration.test.ts:184-198`, which is win32-only and runs in the registration suite.
  - **B6 rows (Y3, Y4, Y6)**, added to `bounds the shutdown cleanup by its budget: $name`:
    - `the owner closes at 2 000 ms, the observer never settles`: still pending at 2 999 ms. At 3 000 ms `parts` are `["registry", "observer"]`, with no cause. This row tells one deadline over the chain apart from a deadline per part.
    - `the observer closes "closed" at 3 500 ms`: at 3 000 ms `parts` are `["registry", "observer"]`. After advancing to 4 000 ms, the registry stop was never called, and the failure is unchanged.
    - `the owner is pending recovery, the observer never settles`: at 3 000 ms `parts` are `["registry", "observer", "listing"]`, with no cause.
    - Expected red, against the scaffold: still pending at 3 000 ms.
  - **Y14 (Pedro, §126 (a)): the process wiring.** Test: `routes the process runtime through its edges: unsubscribe throws` -> `apps/harness/src/process-bootstrap.test.ts` (one `it`).
    - Seam: `startHarnessProcessRuntime({ bootstrap, transport, logger: silentHarnessLogger })`.
      - The bootstrap's two roots lie under a temporary path that is never created, and they do not overlap. `trustedRoot` only reads their ancestors, and building the services touches no disk (s3 B6).
      - The fake transport's `subscribe` returns an unsubscribe that throws `X`.
    - Row:
      - `await stop()` rejects with `X` (`toBe`): the intake failure alone, so the dispose succeeded;
      - then the transport emits `createProjectRegistrationCommand(...)` with `{ step: "prepare-git" }`. The subscription is still in place, because unsubscribe threw;
      - `transport.sent` gets exactly one correlated `request.failure` with `HARNESS_INTERNAL_FAILURE`. This proves the edge ran the request on the process runtime, which is disposed, so it died ("ManagedRuntime disposed", `ManagedRuntime.ts:344`);
      - the temporary root still does not exist.
    - Expected red, against the scaffold (`startHarnessProcessRuntime` passes no edge runner, so the global default applies): the request runs the real flow on the stopped services, and the reply is not that single `request.failure`. On the red path only, the flow may read `PATH` directories during Git discovery; those reads change nothing, and the root-absent assertion still holds.
- **TDD-exempt** (Y14, Pedro §126): `apps/harness/src/process-entry.ts`, that is, the bootstrap call that awaits the launch before `failStartup`, and the port wiring after it.
  - Reason: it is a side-effect entry script with no public seam (it reads `process.parentPort` at module load).
  - Its order is checked statically at candidate review (design point 11, process-entry), and `pnpm package:launch-smoke` runs its success path on the packaged harness.
  - The seam it calls is fully covered by B3, B4 and the Y14 row.
  - This supersedes "TDD-exempt: none" above for this one item.
- **Round-2 amendments to the Test Contract (§127). Where they differ from the rows above, these govern:**
  - **B6, observer completed unconfirmed (W1).** Add a row to `bounds the shutdown cleanup by its budget: $name`: `the observer is pending recovery, the registry stop never settles`.
    - The owner closes `closed` at once; the observer answers `pending-recovery` at once; the registry stop never settles.
    - The stop is still pending at 2 999 ms. At 3 000 ms `parts` are `["registry", "observer"]`, with no cause.
    - Expected red, against the scaffold: still pending at 3 000 ms.
  - **B1, a listing stop that interrupts itself (W2).** Add a row to `shutdown failures while no Project is held` (`harness-runtime.test.ts:260-315`), on the default runner: `the listing stop interrupts itself`.
    - The listing stop is `Effect.interrupt`, and there is no dispose.
    - The stop rejects with an `Error` whose message is "All fibers interrupted without error".
    - The application-database stop is never called, and `withhold` is never called.
    - Expected red, against the scaffold: the database stop is called once. The scaffold runs the listing Effect on the global runner, so its rejection is collected as a failure (`harness-runtime.ts:76-89`).
  - **Order of work for the Y14 row (W4).** Step 2 becomes: B2, B6, B1 and B5, B3, B4, then Y14.
    - During B3 and B4, `startHarnessProcessRuntime` is routed through `launchOnProcessRuntime` but passes no edge runner, so the default stays in place.
    - Then the Y14 row is written, and its red is observed: the reply is not a single `request.failure`.
    - Only after that does `startHarnessProcessRuntime` pass the runtime, and the row turns green.
    - Binding observation: record once that the row fails against a temporary source in which `startHarnessProcessRuntime` omits the runtime option. Then restore the source, verified by digest.
    - The reason the disposed runtime dies instead of interrupting: a fiber that exits synchronously skips `onFiberStart` (`node_modules/effect/src/internal/effect.ts:5681-5682`), and `contextEffect` is `Effect.die("ManagedRuntime disposed")` (`ManagedRuntime.ts:344`).
  - **B5, the `handle fails` row is dropped (W7).** `ProjectRegistrationFlow.handle` has the error type `never` (`project-registration-flow.ts:47-49`), so a typed failure cannot reach this edge, and a failing fake would need a double cast, which AGENTS.md forbids. The `handle dies` row covers the non-interruption branch. The remaining exit rows are `handle succeeds`, `handle dies` and `handle interrupts itself before any stop`.
  - **The scaffold for the listing stop (W9).** In step 1, the Effect-typed listing `stop` is `Effect.tryPromise` over today's facade, with `catch` returning the rejection as the typed failure. So the B2 red is the `_tag` difference alone, not a Die.
  - **Wording (W11):**
    - "Process runtimes in unit rows are `ManagedRuntime.make(...)` over in-memory Layers" holds for every row except the Y14 row, which uses the real `harnessServicesLayer` with roots that do not exist (off disk, as in s3 B6).
    - B5's "After a stop, a request gets no reply" holds when the unsubscribe succeeded (pin :948-956). When the unsubscribe threw, the subscription stays, and a request after the dispose gets one `request.failure` (the Y14 row).
    - The B3 bounded row's Expected red is "still pending at 50 ms", because the row now uses `disposeDeadlineMs: 50`.
- **Candidate round-1 amendments to the Test Contract (§131). Where they differ from the rows above, these govern.**
  - **B1, the program runs on the process runtime (Z1).** Add to `apps/harness/src/harness-runtime-shutdown.test.ts`: `settles the stop when the process runtime is disposed while Storage stops`.
    - Setup: a pre-built process runtime (as `builtProcessRuntime`), with no listing and no Project held. The Storage stop returns a promise that never settles.
    - `stop()` is still pending after `advance(0)`.
    - `runtime.dispose()` then resolves after `advance(0)`.
    - The stop is then rejected with an `Error` whose message is "All fibers interrupted without error", and a second `stop()` returns the same promise.
    - Expected red: none — pin. At `1ab1762` the program is already forked on the runtime.
    - Binding observation: record once that the row fails against a temporary source in which the program fork in `stop()` uses the global `Effect.runFork`; there, the stop stays pending after the dispose. Then restore the source, verified by digest.
  - **B1, a stop after the dispose (Z2).** Add to the same file: `rejects a stop first called after the process runtime is disposed`.
    - Setup: a pre-built process runtime and a listing stop `Effect.void`. `await runtime.dispose()`, then call `stop()`.
    - After `advance(0)` the stop is rejected. Its reason (or the reason's `message`, when it is an `Error`) contains "ManagedRuntime disposed".
    - Both unsubscribe fakes were called once, and a second `stop()` returns the same promise.
    - Expected red, against `1ab1762`: the stop is still pending after `advance(0)`.
  - **B6, the owner close in the same turn (Z3).** In `bounds the shutdown cleanup by its budget: $name` (`registration-listing.test.ts:248`), add an assertion right after the synchronous `Effect.runPromiseExit(adapter.stop)` call and before any `await`: the owner close was called once.
    - Expected red: none — pin.
    - Binding observation: record once that every row fails at this assertion against a temporary source with an `Effect.yieldNow` before the owner close in `stopWithinBudget`. Then restore the source, verified by digest.
  - **B2 and B6, the restructured registry branch (Z5).** The CNV-B37 rows and the B6 rows run unchanged against the restructure. Expected red: none — pin.
  - **B2 and B6, the observer close as an Effect (Z6).**
    - **Fixtures.** The listing tests' fake observer becomes `closeEffect: Effect.suspend(() => Effect.promise(observerClose))` over the row's answer. The `observerClose` call counts keep their meaning, and every assertion is unchanged.
    - **New B6 row.** Add `the observer close is interrupted at the budget` to `bounds the shutdown cleanup by its budget: $name`, or as its own `it` beside it:
      - the owner closes `closed` at once;
      - the observer's `closeEffect` is `Effect.never` and records its interruption;
      - the stop is still pending at 2 999 ms;
      - at 3 000 ms, `parts` are `["registry", "observer"]`, with no cause, and the registry stop was not called;
      - the observer recorded its interruption.
      - Expected red, against the scaffold: no interruption is recorded. In the step-1 scaffold the port takes `closeEffect`, but the chain still bridges it with `Effect.promise(() => Effect.runPromise(registration.observer.closeEffect))`.
    - **New observer row.** Add `answers cleanup unconfirmed after an interrupted Effect close` to `apps/harness/src/project-registration-observer.test.ts`:
      - one inspection is in flight, and its version inspection never settles;
      - fork `observer.closeEffect` with `Effect.runFork` and `advance(0)`, then interrupt that fiber;
      - `observer.close()` then resolves after `advance(0)` with `{ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }`.
      - Expected red, against the scaffold: the later close is still pending after `advance(0)`, because the first settle runs on to the 5 000 ms deadline. In the step-1 scaffold, `closeEffect` is `Effect.promise(() => close())` over the unchanged Promise `close`.
    - **Kept pins**, through the Promise `close()`, with their assertions unchanged: the observer close rows at `project-registration-observer.test.ts:106-146, 154-197, 199-239, 241-274`. Expected red: none — pin.
    - **Static checks at candidate review:**
      - `settleClose` has no `Promise.all` and no `Effect.runPromise`;
      - the Promise `close()` is the only `runPromise` in the observer;
      - the listing chain has no `Effect.promise` around the observer close.
  - **Order of work (§131).** Z5, Z3, Z1, Z2, Z6 scaffold, then the Z6 reds and green. Each step records its red, or its pin plus binding, in the evidence. The gates follow, as listed in the Success Criteria.
- **Candidate round-2 amendments to the Test Contract (§132).** Where these differ from the rows above, these govern. Rows go in this order: V1, then V2 + V5 + V6, then V3.
  - **V1, `settleClose` without explicit concurrency.**
    - The observer close rows run unchanged against the change: the kept pins (`project-registration-observer.test.ts:108-154, 156-199, 201-241, 243-276` on `a17a2ac`), the Z6 observer row (:278-303) and the B6 rows. Expected red: none — pin.
    - Static check at acceptance: `settleClose` has no `concurrency` option and carries the exception comment.
  - **V2, re-entry after a confirmed close.** Add `answers closed again to a second close after a confirmed close` to `apps/harness/src/project-registration-observer.test.ts`.
    - Setup: no inspection is in flight.
    - `close()` resolves `{ status: "closed" }`. Then a second `close()` resolves `{ status: "closed" }`.
    - Expected red: none — pin.
    - Binding observation: record once that the row fails against a temporary source where `Exit.isSuccess(exit)` in the close outcome (:155 on `a17a2ac`) is `false`. There, the second close answers `pending-recovery`. Then restore the source, verified by digest.
  - **V5, the Z2 oracle.** In `rejects a stop first called after the process runtime is disposed` (`harness-runtime-shutdown.test.ts:458-459` on `a17a2ac`), replace the either-shape check with `expect(seen.value).toBe("ManagedRuntime disposed")`. The rejection is the plain string (`probe-z2.log`). Expected red: none — pin.
  - **V6, the interrupted caller stays interrupted.** In `answers cleanup unconfirmed after an interrupted Effect close` (`project-registration-observer.test.ts:278-303`), after `Fiber.interrupt(closing)`, await the `closing` fiber's exit with `Fiber.await`.
    - Assert `Exit.isFailure(exit)` and `Cause.hasInterruptsOnly(exit.cause)`.
    - Expected red: none — pin.
    - No binding is required: an external interruption always ends the fiber interrupted. If the implementer can show a wrong form that this assertion catches, record it.
  - **V3, no unhandled rejection after the dispose.** Add `leaves no unhandled rejection when a stop first called after the dispose meets a failing canonical stop` to `apps/harness/src/harness-runtime-shutdown.test.ts`.
    - Setup: a pre-built process runtime; no Project held; the canonical stop returns a promise that rejects with a failure `C`; the listing stop is `Effect.void`.
    - Add a `process.on("unhandledRejection")` listener for the test and remove it after the test, as in B5. Then `await runtime.dispose()` and call `stop()`.
    - After `advance(0)` and one more macrotask:
      - the stop is rejected with `"ManagedRuntime disposed"` (`toBe`);
      - the canonical stop was called once;
      - the listener saw nothing.
    - Expected red, against `a17a2ac`: the listener sees one rejection, `C`.
    - If that red cannot be shown in Vitest (for example, Vitest reports the unhandled rejection as a run error before the listener's assertion), record the failing run as the red. If no red can be shown at all, the row becomes a pin plus a binding against the `a17a2ac` form of `startStop`, as §132 allows.
  - **Order of work (§132).** Do V1, then V2 + V5 + V6, then V3. Each step records its red, or its pin plus binding, in the evidence. These are new commits on top of `d48cb47`; nothing is amended.
  - **Mutation rows after the scoped run on `d38d9a3` (§132 follow-up, evidence `.rpiv/artifacts/evidence/2026-10-18_123-s5-mutation/`, commit `de9966a`).** Test-only; no app code changes. Each row is a pin plus a binding against the exact Stryker mutant, applied to a temporary source and restored, verified by digest.
    - **M1, kill the survivor `harness-runtime.ts:344:9` ConditionalExpression `true`.**
      - What the mutant does (read on `d38d9a3`): with `Exit.isSuccess(exit)` forced true, a failed or interrupted registration calls `sendResult(exit.value)` with `undefined`. `nextMetadata` (:248-256) first takes the next sequence and id. Then `createProjectRegistrationResultEvent` → `createEvent` → `decodeStrict` (`packages/protocol/src/protocol.ts:503-515`) throws on the missing payload. The handler rejects, and the intake catch (:406-409) sends `HARNESS_INTERNAL_FAILURE` for the request. So a die still gets one internal failure (with sequence 2, not 1). An interruption after stop began gets an internal failure where it should get no reply. That reply arrives after the row's current `transport.sent` check (`harness-runtime.test.ts:1302` on `d38d9a3`), which is why all 7 covering tests passed.
      - Change the row `interrupts an in-flight registration request at dispose without a reply` (`apps/harness/src/harness-runtime.test.ts:1280-1308` on `d38d9a3`): after the existing `await nextTurn()`, assert again that `transport.sent` equals `[]`.
      - Change the rows `answers registration exits on the process runtime: 'handle dies'` and `'handle interrupts itself before any stop'` (:1320-1350, through the shared `internalFailure` reply :1309-1318): the expected reply also pins `sequence: 1`. This proves the request got exactly one internal failure and no attempted registration result.
      - Expected red: none — pin.
      - Binding observation: record once that the dispose row fails (it sees one `request.failure`) and the two exit rows fail (`sequence` 2) against a temporary source where `Exit.isSuccess(exit)` at :344 is `true`. Then restore the source, verified by digest. If the dispose row does not fail within the one macrotask, record that; the exit-row `sequence` pins alone must still kill the mutant.
    - **M2, a throwing workspace unsubscribe is a stop failure (NoCoverage `harness-runtime.ts:438:21` BlockStatement and `:439:7` CallExpression).**
      - Add `retains a throwing workspace unsubscribe as a stop failure while attempting every cleanup` to `apps/harness/src/harness-runtime-shutdown.test.ts`, beside `retains synchronous shutdown failures while attempting every cleanup` (:144-197 on `d38d9a3`).
      - Setup: the transport unsubscribe records `stopMessages` and returns; the workspace unsubscribe records `stopNotifications` and throws a failure `N`; the canonical stop and the Project Storage stop record their calls and succeed.
      - Assert: `stop()` does not throw in the caller's turn; it rejects with exactly `N` (`toBe`: one failure is reported as itself, `runtimeShutdownFailure` :76-80); the calls are `stopMessages`, `stopNotifications`, `canonicalProjectApplication.stop`, `projectStorageApplication.stop`, in that order; each unsubscribe was called once.
      - Expected red: none — pin.
      - Binding observation: record once that the row fails (the stop resolves) against each of the two mutants on a temporary source: the catch body at :438 emptied, and the `intakeFailures.push(error)` call at :439 removed. Restore after each, verified by digest.
    - **Mutation rerun.** After M1 and M2, the scoped mutation reruns on the new candidate, limited to `harness-runtime.ts` 335-351 and 425-446, re-resolved on that candidate (the registration edge and the stop closure). Pass rule P-S5-3: every counted mutant is killed (a `Timeout` counts as killed), with no `NoCoverage` and no pre-registered mutant.

### Success Criteria: u2b-s5-harness-runtime

**Automated:**
- `pnpm exec vitest run --project harness apps/harness/src/harness-runtime.test.ts apps/harness/src/harness-runtime-shutdown.test.ts apps/harness/src/process-bootstrap.test.ts apps/harness/src/registration/registration-listing.test.ts apps/harness/src/project-registration-observer.test.ts apps/harness/src/process-shutdown.test.ts`: red, then green, per behaviour.
- Integration loop (the root is `apps/harness`; any run longer than 2 min needs the coordinator's GO at run time): `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts tests/integration/process-bootstrap.integration.test.ts tests/integration/project-list-runtime.integration.test.ts tests/integration/harness-runtime.integration.test.ts`.
- Heavy runs. Each runs once on s5's final candidate, before s5's acceptance, with the coordinator's GO:
  - the whole suites (the T7 analogue, §114). s5 changes every caller of `startHarnessProcessRuntime`, and changes how every process runtime runs its edges and its dispose, so all three are required:
    - `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts`;
    - `pnpm exec vitest run --config apps/harness/vitest.registration.config.ts`;
    - `pnpm exec vitest run --config apps/harness/vitest.native-long.config.ts`.

    Any failure stops the slice for triage. That includes a `RegistrationCleanupUnconfirmed`, an `ApplicationDatabaseCloseUnconfirmed` or a `HarnessRuntimeDisposeUnconfirmed` under load.
  - `pnpm package:launch-smoke`, which is the outline's trigger (precedent `ff162f5`). The packaged harness is the only place `process-entry.ts` runs.
- `pnpm typecheck`, `pnpm check`, `pnpm check:duplicates` and `pnpm check:dead-code`: the removed facade leaves no unused export, and the new exports have callers. CodeScene scores 10 on every changed file (AGENTS.md).
- Opening measurement: only if Pedro chooses it (P-S5-2). It runs before any code change, with the coordinator's GO, in the shape of s3's: quiet and under the #94 burst, 200 samples per cell, every sample bounded.
  - M-listing: the production listing stop chain over a real registration on a real process runtime, with nothing in flight.
  - M-dispose: `runtime.dispose()` after a completed program.
  - Rule: if the highest p99 is at most half its bound (1 500 ms for the 3 000 ms budget, 250 ms for the 500 ms dispose deadline), the values stand. Otherwise the slice stops for Pedro, and a broken cell stops it too.
  - The tool and the results go in `.rpiv/artifacts/evidence/2026-10-18_123-s5-shutdown-measurement/`.
- Mutation (D13, §105 R9 (a)): one scoped run on s5's final candidate, before s5's acceptance, with the coordinator's GO.
  - Add these line ranges, resolved on the final candidate, to the `mutate` list of `stryker.project-storage.config.json` (:3-32):
    - `harness-runtime.ts`: the edge runner default, the Effect-stop starter, the listing call, the registration edge and the stop facade;
    - `process-bootstrap.ts`: `launchOnProcessRuntime`, the bounded dispose, the two aggregates, the error class and its deadline constant, and the call in `startHarnessProcessRuntime`;
    - `registration/registration-listing.ts`: the error class and `stop`;
    - `project-registration-observer.ts`: `settleClose`.
  - Add `apps/harness/src/registration/registration-listing.test.ts` and `apps/harness/src/project-registration-observer.test.ts` to the include of `apps/harness/vitest.project-storage-mutation.config.ts` (:9-36). `harness-runtime.test.ts`, `harness-runtime-shutdown.test.ts` and `process-bootstrap.test.ts` are already there (:32-34).
  - Writing the ranges and includes is a config-only change on the final candidate, and its identity is recorded with the run (V5, §118).
  - Pass rule: Pedro's decision (P-S5-3). Proposed, as in s1 and s3: every counted mutant is killed, a Stryker `Timeout` counts as killed, and any survivor stops the slice for Pedro's triage. No survivors are pre-registered.
  - Pre-registered at 0 counted mutants:
    - the numeric constants `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` and `HARNESS_RUNTIME_DISPOSE_DEADLINE_MS`, because StrykerJS has no numeric-literal mutator and `ignoreStatic` applies. The rows at 2 999, 3 000, 499 and 500 ms are their guard;
    - the `Data.TaggedError` tag arguments (V2, §118). The error constructors are counted.
  - `process-entry.ts` is not mutated: it is a script with no unit seam. Its order is a static check, and `package:launch-smoke` runs it.
- **Round-1 amendments to the Success Criteria (§126):**
  - **Mutation command and scope (Y11).**
    - The command is `pnpm test:mutation:project-storage:harness --mutate <s5 ranges>`, with the ranges above resolved on the final candidate and comma-separated, as in s3. The run is judged only on those ranges.
    - On the same final candidate, the s3 entries `harness-runtime.ts:154-157` and `process-bootstrap.ts:182-188` in `stryker.project-storage.config.json` (:30-31) are re-resolved to the lines that then hold the withheld branch and `applicationDatabaseLayer`. This is recorded with the config change.
    - The range "the call in `startHarnessProcessRuntime`" is dropped from the s5 ranges (coordinator decision, §126). The Y14 row proves that wiring.
  - **Constant guards (Y5).**
    - `HARNESS_RUNTIME_DISPOSE_DEADLINE_MS` is guarded by B4 `the dispose never ends` (499 and 500 ms, with the default deadline).
    - `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` is guarded by the B6 rows (2 999 and 3 000 ms).
    - `observer-limits.ts` is not in the mutate list, so its 0-mutant note does not apply.
  - **Opening measurement (Y15, Pedro §126; P-S5-2; the §116 burst).** Three cells, each run quiet and under the burst:
    - **M-listing:** the production listing stop chain on a real process runtime, with nothing in flight.
    - **M-listing-drain** (Pedro, §126): the same chain, with one registration step admitted and still in flight when stop is called, for example a `project.registration` `prepare-git` request whose registry admission is still pending. The time runs from the stop call until it settles.
    - **M-dispose:** `runtime.dispose()` after a completed program.
  - **Bounds and rules** (restated from s3, §114 T3/T4):
    - 200 samples per cell and condition;
    - each sample bounded at 15 s; a sample that hits its bound counts as 15 000 ms;
    - the whole run bounded at about 30 min;
    - quiet means three CPU readings under 30%;
    - every timed burst sample falls inside its burst window;
    - outside the timed window: building the runtime and the registration, migrating the root, admitting the in-flight step, and running the program before M-dispose;
    - a cell left incomplete (by the run bound or a failed sample), or with a sample outside its window, is `broken` and stops the slice for Pedro (`.rpiv/decisions/degrade-distinguishes-broken.md`);
    - M-listing and M-listing-drain keep the 3 000 ms budget if their p99 ≤ 1 500 ms. M-dispose keeps the 500 ms deadline if its p99 ≤ 250 ms. Otherwise the slice stops for Pedro.
- **Round-2 amendments to the Success Criteria (§127).** Where these and the round-1 amendments above differ from the earlier s5 Success Criteria, the amendments govern (W11).
  - **M-listing-drain in-flight proof (W3).**
    - The in-flight step is a real registry admission started in the same synchronous turn as the listing stop: for example `registry.hasUnsettled()` on the measured registry, called right before `listing.stop`. `track` records it as pending at once (`registration-registry.ts:69-74`), as in s4's X1 row, so `registry.stop` must await it (:186-188). A transport `prepare-git` is not used, because Git discovery runs before any admission (`project-registration-flow.ts:102-110`).
    - Each sample records two facts:
      - the admission was still pending when the stop was called (a settled flag read synchronously after the call is `false`);
      - the admission had settled by the time the stop settled.

      A sample without both facts is a failed sample, and its cell is `broken`.
  - **Bound and access path (W10).**
    - The whole measurement run is bounded at 30 min, a hard bound as in s3. A cell that is cut short by it is `broken`.
    - The access path needs no product code change. The tool builds `ManagedRuntime.make(harnessServicesLayer(roots, logger))` over a migrated root and extracts the exported `ApplicationDatabase`. It then builds the registration ports with their exported constructors (`createRegistrationRegistry`, `createProjectRegistrationObserver`, `createProjectRegistrationOwner`, `createRegistrationListing`), mirroring `projectRegistrationLayer` (`process-bootstrap.ts:205-244`), over options that inject that authority.
    - M-dispose: the tool stops the extracted authority (`authority.stop()`) and the registration listing, so the program is complete. Only then does it time `runtime.dispose()`.
    - The tool stays outside `apps/`, in `.rpiv/artifacts/evidence/2026-10-18_123-s5-shutdown-measurement/`.
- **Candidate round-1 amendments to the Success Criteria (§131).** Where these differ from the criteria and amendments above, they govern.
  - **Mutation ranges (Z7).** Resolve every range on the final candidate and record it with the run:
    - `registration/registration-listing.ts`: from the `RegistrationCleanupUnconfirmed` class through `stop`. This includes `cleanupUnconfirmed`, `unconfirmedParts` and `stopWithinBudget` (`:18-82` on `1ab1762`) and replaces "the error class and `stop`".
    - `project-registration-observer.ts`: `settleClose`, `closeEffect` and `close`. This replaces "`settleClose`".
    - `harness-runtime.ts` and `process-bootstrap.ts`: as planned.
      - On `1ab1762` they resolved to `harness-runtime.ts:107-118, 178, 241-244, 335-351, 425-449` and `process-bootstrap.ts:84-93, 98-100, 107-119, 126-166`, according to the slice-verifier.
      - Re-resolve them after the Z2 change.
    - The s3 entries (Y11) re-resolve to the withheld branch (`harness-runtime.ts:183-187` on `1ab1762`) and to `applicationDatabaseLayer` (`process-bootstrap.ts:262-268` on `1ab1762`).
    - With Z5 in place, no equivalent mutant is pre-registered, and P-S5-3 is unchanged.
  - **Evidence duties on the final candidate (Z9).** Each one gets a log bound to the commit SHA:
    - the s5 unit set, run with the smallest Vitest command: the B1-B6 files, the Y14 file and the observer file;
    - `pnpm check`, `pnpm typecheck`, `pnpm check:dead-code` and `pnpm check:duplicates`;
    - CodeScene on every changed file;
    - the heavy suites, as the coordinator decides and with the coordinator's GO. The new delta touches the observer close, which the registration and native-long suites exercise, and the runtime stop, which the integration suite exercises. Then `package:smoke`, which replaces `package:launch-smoke` in the worktree (§130).
    - the slice preflight on the final candidate. The designer saves it as `u2b-s5-harness-runtime-preflight-r2.log` in the slopstop evidence folder of this brief.
- **Candidate round-2 amendments to the Success Criteria (§132).** Where these differ from the criteria and amendments above, they govern.
  - **Light gates on the final candidate, in the Z9 style.** Each log is bound to the commit SHA:
    - the s5 unit set, with the command line recorded in the log;
    - `pnpm check`, `pnpm typecheck`, `pnpm check:dead-code` and `pnpm check:duplicates`;
    - CodeScene on every changed file;
    - the slice preflight. The designer saves it as `u2b-s5-harness-runtime-preflight-r3.log`.
  - **Heavy runs, with the coordinator's GO, once on the final candidate:** `pnpm package:smoke` and the registration suite, because V3 touches the process stop. The other suites are not rerun unless the coordinator decides otherwise.
  - **Scoped mutation.** It runs after the heavy runs, on the final candidate, with the coordinator's GO.
    - Use the Z7 ranges, re-resolved on the final candidate. They now include `startStop` in `harness-runtime.ts` (V3) and `settleClose` without its concurrency option (V1).
    - Pass rule P-S5-3: every counted mutant is killed, and a `Timeout` counts as killed. No equivalent mutant is pre-registered: V1 removes the two concurrency mutants, and the V2 row kills `Exit.isSuccess` → `false`.
  - **Evidence fixes (for the implementer, §132):**
    - commit the t7 heavy-run logs (`.rpiv/artifacts/evidence/2026-10-18_123-s5-r1/t7/`);
    - correct the Z6 scaffold count from "7 unit files" to 6;
    - label `z9/codescene.log` as a hand-written summary of the MCP calls;
    - record the command line for `z9/unit-set.log`.
  - No third review round runs (cap, §132). The round-2 delta is recorded as unreviewed (Follow-up 18:30).
  - **Mutation rows M1 and M2 (§132 follow-up).** On the candidate that adds them:
    - the s5 unit set, `pnpm check`, `pnpm typecheck`, `pnpm check:dead-code` and `pnpm check:duplicates`, each log bound to the commit SHA; CodeScene on the two changed test files;
    - the slice preflight, saved by the designer as `u2b-s5-harness-runtime-preflight-r4.log`;
    - the M1 and M2 binding logs with their restore digests;
    - the scoped mutation over `harness-runtime.ts` 335-351 and 425-446 (re-resolved), with the coordinator's GO. All counted mutants killed; 0 Survived, 0 NoCoverage.
    - No heavy suite reruns: the change is test-only. No review round runs (cap); the M1/M2 delta is recorded as unreviewed (Follow-up 19:30).

**Manual:**
- None for this slice.

### Slice u2b-s5b-effect-gate (detailed 2026-10-18)

- **slice_id:** `u2b-s5b-effect-gate`
- **Lane:** normal. `lane.mjs --paths` over the planned files says normal ("files: 28 > 5", "manifest: package.json", "diagnostic: lines unknown", "diagnostic: hub signal unavailable"), and the feature lane is normal. So there is no intent review. The candidate gets the slice-verifier, and Pedro accepts the combined result once, before integration (shared **Lanes**).
- **Parent:** the accepted s5 on `refactor/123-effect-lifecycle-part-a`, HEAD `1c33122` (the evidence after s5's final candidate `cef7554`, §133).
- **Behaviour IDs:** U2B-EG-B1 … U2B-EG-B9.
- **Source of scope:** decisions log §134. #105 research: `.rpiv/artifacts/research/2026-10-18_20-08-00_typescript-7-and-effect-tsgo-gate.md` (main `1da633b`), §4 for the counts and §5 for the rule set.
- **Deliverable:**
  1. The curated Effect language service configuration (research §5, §134.3) in the plugin entry of `tsconfig.base.json`.
  2. A gate, `pnpm check:effect`, that runs the Effect build of TypeScript-Go over the four packages and fails on every `error`-level Effect diagnostic. It runs inside `pnpm check`, so it runs on Windows (pre-push) and in both CI jobs.
  3. Every `error`-level hit in the Part A tree's `src` is fixed: 11 `unknownInEffectCatch`, 1 `runEffectInsideEffect` and 1 `globalErrorInEffectFailure`.
  4. The 9 legacy `newPromise` sites carry registered waivers with removal triggers.
  The gate passes when it lands. It fails visibly if the binary is missing or killed, or if the plugin is not active (`.rpiv/decisions/degrade-distinguishes-broken.md`).
- **Product reach: none at the user surface.** The fixes change error types on internal Effect channels and keep every value that leaves those channels identical (B6), except the harness-supervisor timeout. That timeout keeps its message, but its class changes (B8, decision P-S5B-1).

#### Facts measured on 2026-10-18 (Windows, slopstop-123 at `1c33122`; Defender exclusion in place, §134)

These facts come from small commands only: the Windows binary, a temporary tsconfig outside the repo, and no repo change.
- **How effect-tsgo is invoked.**
  - `effect-tsgo diagnostics` refuses to start without an installed TypeScript ≥ 7 package (`typescript` or `@typescript/native`). Part A has neither (`node_modules/@effect/tsgo/dist/effect-tsgo.cjs`, `discoverTypeScript`). Adding one is the compiler switch, which §134.1 defers until after Part A.
  - The gate therefore runs the Effect build directly in **tsc mode**: `node_modules/@effect/tsgo-<platform>-<arch>/lib/tsc[.exe] --noEmit -p <package>/tsconfig.json`. The `lib/tsc` alias is documented in the package README ("Version Pinning"). The Effect diagnostics then come out as ordinary TypeScript diagnostics, with the suffix `effect(<rule>)`.
  - In tsc mode, the exit code follows `ignoreEffect{Suggestions,Warnings,Errors}InTscExitCode`.
  - With the curated options, an `error`-level hit exits 1, and a canary run reproduced that. With the default options, warnings exit 1 too: harness at `1c33122` exits 1 with 9 warnings.
- **Current hits** (default config, tsc mode): harness 9 `unknownInEffectCatch`, 1 `runEffectInsideEffect`, 6 `schemaNumber`, 2 `unnecessaryFailYieldableError`, 2 `preferUnsafeConstructor`, 1 `unnecessaryEffectGen`, 1 `runOfExitToRunExit`; desktop 2 `unknownInEffectCatch`, 1 `globalErrorInEffectFailure`; kernel and protocol 0. These match the research counts.
- **The curated config at `1c33122`** (research §5): harness exits 1 with 9 `unknownInEffectCatch`, 1 `runEffectInsideEffect` and 108 `newPromise` errors; desktop exits 1 with 2 `unknownInEffectCatch`, 1 `globalErrorInEffectFailure` and 21 `newPromise` errors; kernel and protocol exit 0.
  - The `newPromise` totals include test files, because the trial override globs did not match (see the next point).
  - Warnings that stay advisory: harness 33 `anyUnknownInErrorContext`, 15 `extendsNativeError`, 6 `schemaNumber`, 2 `unnecessaryFailYieldableError`; desktop 2 `anyUnknownInErrorContext`, 4 `extendsNativeError`.
- **The `overrides` include globs resolve relative to a base directory, which s5b must establish.**
  - Globs relative to a tsconfig outside the repo matched nothing.
  - Absolute globs matched `*.test.ts(x)` files, but `<root>/**/tests/**` did not match `apps/desktop/tests/e2e/conversation-window.ts`.
  - So the test-file override is a contract row (B3), not an assumption.
- **Suppression directive:** `// @effect-diagnostics-next-line newPromise:off` on the line above suppresses that one hit; this was observed on a canary file.
- **The nine `newPromise` src sites** (none in a `*.test.*` file or under `tests/`):
  - EW1: `apps/harness/src/registration/repository-identity-query-owner.ts:333`.
  - EW2: `apps/harness/src/registration/repository-physical-observation.ts:192`.
  - EW3: `apps/harness/src/registration/windows-version-child.ts:92`.
  - EW4: `apps/harness/src/storage/local-libsql-worker-client.ts:522`.
  - EW5: `apps/harness/src/storage/local-libsql-worker-client.ts:542`.
  - EW6: `apps/desktop/src/main/canonical-writer-package-smoke.ts:298`.
  - EW7: `apps/desktop/src/main/harness-pending-request.ts:68` (the G28 core).
  - EW8: `apps/desktop/src/main/main.ts:81`.
  - EW9: `apps/desktop/src/renderer/conversation/conversation-test-harness.tsx:28` (renderer test support inside `src`).
- **CI:** both jobs already run `pnpm check`: `ubuntu-deep-check` through `check:deep:portable`, and `windows-process-and-package` directly (`.github/workflows/ci.yml`). So the gate reaches CI through `pnpm check`, and `ci.yml` does not change. The frozen-lockfile install brings `@effect/tsgo-linux-x64` on Linux; the Docker run of 2026-10-18 proved that.

#### Design points fixed for s5b

1. **Configuration (§134.3).** The plugin entry in `tsconfig.base.json` holds:
   - `diagnosticSeverity`, `error`: `unknownInEffectCatch`, `globalErrorInEffectFailure`, `runEffectInsideEffect`, `tryCatchInEffectGen`, `multipleEffectProvide`, `leakingRequirements`, `scopeInLayerEffect` and `newPromise`.
   - `diagnosticSeverity`, `warning`: `anyUnknownInErrorContext`, `schemaNumber`, `unnecessaryFailYieldableError` and `extendsNativeError`.
   - Every other rule keeps its default.
   - Options: `includeSuggestionsInTsc: false`, `ignoreEffectSuggestionsInTscExitCode: true`, `ignoreEffectWarningsInTscExitCode: true` and `ignoreEffectErrorsInTscExitCode: false`. `refactors`, `quickinfo`, `completions`, `goto` and `renames` stay at their defaults (true).
   - `overrides`: `newPromise` is `off` in every `*.test.ts`, every `*.test.tsx` and every file under a package's `tests/` folder. The globs use whatever base B3 proves.
   - `pnpm typecheck` (TS 6.0.2) stays the type-checking authority. TS 6 ignores the plugin block.
2. **One gate, in tsc mode, with a positive control.** `apps/harness/scripts/check-effect-diagnostics.mjs` follows the `check-golden-sql.mjs` precedent: an exported function with injectable ports, a CLI that prints one stable code, and its test beside it in `scripts/*.test.mjs` (harness project, `apps/harness/vitest.config.ts:7`). From the repository root it does three things in order:
   1. It resolves the binary from `@effect/tsgo-${process.platform}-${process.arch}/package.json` and then `lib/tsc` or `lib/tsc.exe`.
   2. It runs the canary project (point 3), and stops if the result differs from the expected set.
   3. It runs `packages/kernel`, `packages/protocol`, `apps/harness` and `apps/desktop`.
   It exits 0 only if the canary matched and every package exited 0 with no `error`-level line. It prints a count of the advisory warnings.
   - Stable failure codes: `EFFECT_GATE_BINARY_MISSING`, `EFFECT_GATE_BINARY_FAILED` (spawn error, signal or kill), `EFFECT_GATE_BROKEN` (an exit status other than 0 or 1, exit 1 with no parseable diagnostic line, or exit 0 with an `error` line), `EFFECT_GATE_CANARY_MISMATCH`, `EFFECT_GATE_VIOLATIONS` (each listed as `file(line,col) rule`), `EFFECT_GATE_WAIVER_UNREGISTERED` and `EFFECT_GATE_WAIVER_STALE`. The code is never a clean pass.
   - Rejected alternatives: `effect-tsgo diagnostics`, which needs a TS 7 package and therefore the compiler switch (§134.1); and parsing the text without a canary, which would pass silently if the plugin were inactive.
3. **The canary** is `apps/harness/scripts/effect-diagnostics-canary/` (its own `tsconfig.json`, which extends the root `tsconfig.base.json`, plus `src/` files). It holds, each at a fixed line:
   - one `newPromise` (expected: error);
   - one `Effect.tryPromise` with `catch: (cause) => cause` (expected: `unknownInEffectCatch` error, and `anyUnknownInErrorContext` warnings that do not fail);
   - one waived `newPromise` behind the directive (expected: absent);
   - one `newPromise` in `src/planted.test.ts` and one in `tests/planted.ts` (expected: absent, which proves the override).
   The expected set is exact. It lives in the script beside the canary, and any added, missing or moved diagnostic is a mismatch. Because the canary inherits the real plugin block, a missing, renamed or inactive plugin makes the canary mismatch, never pass. The harness, desktop and package tsconfigs do not include `scripts/`, so the canary never enters `pnpm typecheck`. knip ignores the canary folder.
4. **Waiver register.** `apps/harness/scripts/effect-diagnostics-waivers.json` lists EW1-EW9, each with `id`, `file`, `rule`, `reason` and `removeWhen`. Each waived line carries two lines above it: `// Effect waiver EW<n>: <reason>.` and then the directive. The gate scans `apps/*/src` and `packages/*/src` for `@effect-diagnostics` directives:
   - a directive with no matching register entry, or with no `Effect waiver EW<n>` line, fails `EFFECT_GATE_WAIVER_UNREGISTERED`;
   - a register entry with no directive fails `EFFECT_GATE_WAIVER_STALE`.
   Proposed removal triggers (decision P-S5B-2):
   - EW1-EW3: "the Part B migration of the registration per-request races (Deferred beyond Part A)";
   - EW4-EW5: "the SQL-to-Effect pass, when the libSQL worker client becomes an Effect service";
   - EW6 and EW8: "u2b-s6-desktop-runtime";
   - EW7: "u2b-s7-bridge-core";
   - EW9: see P-S5B-3.
5. **How the `unknownInEffectCatch` fixes are made** (11 sites).
   - Each pass-through `catch: (cause) => cause` becomes a typed failure. Each app has one owner: a `Data.TaggedError` `UntypedRejection` with a `cause` field, in `apps/harness/src/effect-rejection.ts` and `apps/desktop/src/main/effect-rejection.ts`. Apps never import each other (AGENTS.md). The protocol package owns process-boundary schemas, not in-process errors. So there are two owners, and this is recorded as a `shared-vocab-union` exception.
   - Where the original value leaves the Effect (a rethrow, a `cause`, an aggregate's `errors`, or `keepStorageFailure`'s fail/die decision), the code unwraps `cause`, so every public value stays identical (`toBe`). A rejection never turns into a defect to silence the rule (AGENTS.md: expected failures stay typed).
   - Sites:
     - `canonical-project-writer.ts:115`;
     - `process-bootstrap.ts:138` and `:151`;
     - `registration/project-registration-preparation.ts:267`;
     - `registration/registration-listing.ts:55`;
     - `registration/registry-database.ts:85`;
     - `storage/project-storage-node-registry.ts:71` and `:78`;
     - `storage/project-storage-store.ts:158`;
     - `apps/desktop/src/main/desktop-shutdown.ts:32` and `:37`.
6. **The `runEffectInsideEffect` fix** (`process-bootstrap.ts:156`). The returned stop closure is built at the Promise edge, after the startup Effect has been run, and not inside `Effect.gen`. Its `disposal ??=` memo and its outcome are unchanged (s5 pins). No new `run*` is added.
7. **The `globalErrorInEffectFailure` fix** (`apps/desktop/src/main/harness-supervisor.ts:171`). It fails with a `Data.TaggedError` `HarnessShutdownTimeout` whose `message` stays "Harness shutdown timed out.". The `degraded` status and its diagnostic code `HARNESS_SHUTDOWN_TIMEOUT` are unchanged.
8. **Advisory warnings are not fixed in s5b.** That covers `anyUnknownInErrorContext`, `extendsNativeError`, `schemaNumber` and `unnecessaryFailYieldableError`. The fixes in point 5 are expected to remove some `anyUnknownInErrorContext` hits. The gate prints the count, and it never blocks on a warning.
9. **AGENTS.md:78** gains one sentence: "`pnpm check:effect` (Effect build of TypeScript-Go, tsc mode) blocks on `error`-level Effect diagnostics; `pnpm typecheck` (TS 6.0.2) stays the type-checking authority." This is a documentation item (TDD-exempt below).

### Test Contract: u2b-s5b-effect-gate

- **Fixtures:** the gate tests build temporary project folders under `os.tmpdir()`, as `check-golden-sql.test.mjs` does. Each folder's tsconfig extends the repository `tsconfig.base.json` and points `typeRoots` and `paths.effect` at the repository `node_modules`; this setup was proven on 2026-10-18. Rows that need the real binary spawn it once per project (about 1 s). Rows about failure modes inject a fake `spawn` that returns the given `{ status, signal, error, stdout, stderr }`, and inject a fake `resolve`. All folders are removed after each test.
  - Classification: these tests spawn a process and use temporary disk, like the golden-SQL precedent, so they stay in `scripts/*.test.mjs` unless the coordinator reclassifies them (memory rule: real process → integration needs the coordinator's call). The assertions do not depend on where they live.
- **Order of work:**
  1. Scaffold `checkEffectDiagnostics` returning `{ ok: true }`, and wire `check:effect` into `pnpm check`. Then B1 red.
  2. The minimal gate; B1 green.
  3. B2, B3 and B4, each red against the gate as it stands at that point, then green.
  4. The configuration (design point 1). At that point the real-tree run fails with exactly the 13 errors plus 9 waivable `newPromise` hits. Record that run as the opening evidence of B5.
  5. The fixes: B6, B7 and B8.
  6. The waivers (B9).
  7. B5 green on the real tree.
- **Behavior U2B-EG-B1**: a planted `error`-level Effect violation fails the gate and names itself.
  - Seam: `checkEffectDiagnostics({ root, projects })` and the CLI `node apps/harness/scripts/check-effect-diagnostics.mjs`.
  - Test: `fails on a planted Effect error: $name` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs` (`it.each`, real binary). Rows:
    - `unknownInEffectCatch`: a temporary project whose `src/a.ts` holds `Effect.tryPromise({ try: () => p, catch: (cause) => cause })` at line 4;
    - `newPromise`: the same, with `new Promise<number>((resolve) => resolve(1))` at line 3;
    - `clean`: a file with no violation.

    Both violation shapes were observed as `error` on a canary on 2026-10-18. A `runEffectInsideEffect` row is not added, because its minimal shape was not observed. The real-tree site is covered by B5's red.
  - Oracle:
    - each violation row returns `{ ok: false, code: "EFFECT_GATE_VIOLATIONS" }` with exactly one violation `{ file: "src/a.ts", line, rule }` at the planted line, and the CLI exits 1 with that line on stderr;
    - `clean` returns `{ ok: true }`, and the CLI exits 0.
  - Expected red: against the scaffold, every violation row returns `{ ok: true }`. The `clean` row: none — pin.
- **Behavior U2B-EG-B2**: every failure of the binary is distinct, and none is clean.
  - Seam: `checkEffectDiagnostics` with injected `resolve` and `spawn`.
  - Test: `distinguishes a broken binary run: $name` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs` (`it.each`, fakes). Rows → code:
    - `missing package` (resolve throws `MODULE_NOT_FOUND`) → `EFFECT_GATE_BINARY_MISSING`;
    - `missing executable` (the package resolves, but `lib/tsc[.exe]` does not exist) → `EFFECT_GATE_BINARY_MISSING`;
    - `spawn error` (`error.code` `EPERM`, as a quarantine produces) → `EFFECT_GATE_BINARY_FAILED`;
    - `killed` (`status: null`, `signal: "SIGKILL"`) → `EFFECT_GATE_BINARY_FAILED`;
    - `exit 2` → `EFFECT_GATE_BROKEN`;
    - `exit 1, no diagnostic line` → `EFFECT_GATE_BROKEN`;
    - `exit 0 with an error line` → `EFFECT_GATE_BROKEN`.
  - Oracle: `{ ok: false, code }` exactly as listed, and no later project is run after the first failure (the fake `spawn` call count).
  - Expected red: the gate from B1 green reports `ok: true` for `exit 0 with an error line`, and throws instead of returning a code for `missing package`, `missing executable`, `spawn error` and `killed`. If B1's minimal gate already returns one of these codes, that row is recorded as `none — pin` with its observation.
  - Re-observation (round 1, finding S5B-R1-1, Pedro's choice (a), decisions log §134): the recorded B2 red does not count, because the gate it ran against did not take the injected ports, so no fake was consumed. The red is observed again, once, before any round-1 change:
    - State: HEAD `7270a5a` (code identical to `54d2e12`), with `apps/harness/scripts/check-effect-diagnostics.mjs` temporarily replaced by a scaffold-only copy. The copy takes and uses `resolve`, `exists` and `spawn` exactly as `54d2e12` does, and has no classification: no `EFFECT_GATE_BINARY_MISSING` return, a resolve failure is not caught, `didNotFinish`/`isTscExit` return no code, and `runProject` has no `EFFECT_GATE_BROKEN` check. Everything else, including the canary, register and violation steps, is as at `54d2e12`. The test file is unchanged.
    - Command: `pnpm exec vitest run --project harness apps/harness/scripts/check-effect-diagnostics.test.mjs -t "distinguishes a broken binary run"`.
    - Log: the command, HEAD, the scaffold copy's sha256 and its full text (so a reviewer can see that it consumes the ports), and the per-row result. Then the gate is restored by copy, its blob equal to `54d2e12`'s, and `git status` shows the tracked tree clean except the brief.
    - Valid red: every one of the 8 rows fails its oracle against the scaffold. `missing package` fails by a throw from the fake `resolve`, which proves that port is consumed. A row that returns `{ ok: true }` instead of its code is the silent-clean case and also counts: the scaffold's text shows that it reads the fake. The contract's predicted throws for `missing executable`, `spawn error` and `killed` described the real binary, not the fakes, so the observed shape is recorded per row as it comes. A row that passes against the scaffold is recorded as `none — pin`, with its observation, and is reported to the coordinator.
    - This changes no code and makes no new candidate. The log replaces `b2-red.log` as B2's red evidence; `b2-red.log` stays in the record, marked as not counted.
- **Behavior U2B-EG-B3**: the canary proves that the real configuration is active, including the test-file override and the directive.
  - Seam: `checkEffectDiagnostics({ root })` (default projects, canary first).
  - Test: `runs the canary before any package: $name` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`. Rows:
    - `real canary` (real binary, the repository canary) → the canary step matches its exact expected set;
    - `plugin removed` (a temporary copy of the canary whose tsconfig sets `plugins: []`) → `EFFECT_GATE_CANARY_MISMATCH`;
    - `extra diagnostic` (fake `spawn` output with the expected set plus one line) → `EFFECT_GATE_CANARY_MISMATCH`;
    - `missing diagnostic` (the expected set minus the waived-line check, that is, the waived line reported) → `EFFECT_GATE_CANARY_MISMATCH`;
    - `override not applied` (fake output that includes the `src/planted.test.ts` line) → `EFFECT_GATE_CANARY_MISMATCH`.
  - Oracle: as listed. On a mismatch, the packages are not run (the fake `spawn` call count is 1).
  - Expected red: before the canary step exists, `plugin removed` returns `{ ok: true }`. This is the silent-clean case. The other rows fail the same way.
  - The `real canary` row is also where the override's glob base is established. Its pass, with the test-file lines absent, is the proof required by the measured facts.
- **Behavior U2B-EG-B4**: the waiver register and the code agree.
  - Seam: `checkEffectDiagnostics` with an injected file reader over a temporary tree.
  - Test: `keeps the waiver register exact: $name` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`. Rows:
    - `registered` → passes the register step;
    - `directive without entry` → `EFFECT_GATE_WAIVER_UNREGISTERED`;
    - `directive without waiver line` → `EFFECT_GATE_WAIVER_UNREGISTERED`;
    - `entry without directive` → `EFFECT_GATE_WAIVER_STALE`.
  - Expected red: before the register step, the three failure rows pass. `registered`: none — pin.
- **Behavior U2B-EG-B5**: on the real tree, `pnpm check:effect` passes, and `pnpm check` runs it.
  - Seam: the CLI from the repository root, and the `check` script.
  - Test: `passes on the repository` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs` (real binary, the real root and the default projects). Oracle: `{ ok: true }`; the canary matched; all four packages exited 0.
  - Expected red: at step 4 of the order of work, `EFFECT_GATE_VIOLATIONS` lists exactly the 11 `unknownInEffectCatch`, the 1 `runEffectInsideEffect`, the 1 `globalErrorInEffectFailure` and the 9 `newPromise` hits, at the measured sites.
  - Binding observation (the coordinator's "planted violation fails check"): on the final candidate, record once that `pnpm check:effect` and `pnpm check` both exit non-zero, with `EFFECT_GATE_VIOLATIONS` naming the planted line, against a temporary `catch: (cause) => cause` added to `apps/harness/src/storage/project-storage-store.ts`. Then restore the file, verified by digest.
- **Behavior U2B-EG-B6**: every `unknownInEffectCatch` fix keeps the value that leaves the Effect identical.
  - Seam: each site's existing public seam. Pins, unchanged in assertion (Expected red: none — pin):
    - `canonical-project-writer.ts:115`: `canonical-project-writer.test.ts:528, 578, 774, 793` (`rejects.toBe(failure)`).
    - `process-bootstrap.ts:138, 151`: `process-bootstrap.test.ts:158, 208, 337, 397`.
    - `project-registration-preparation.ts:267`: `project-registration-preparation.test.ts:69` (CNV-B37). Only the failure flag matters there; the value is not exposed.
    - `registration-listing.ts:55`: `registration-listing.test.ts:60-94` (the registry failure is the `cause`).
    - `registry-database.ts:85`: `registration-registry.test.ts:88, 235-236` (`errors[n]` `toBe`).
    - `project-storage-node-registry.ts:71`: `project-storage-node-registry.test.ts:40-52` (fail versus die, and `Cause.squash` `toBe(error)`).
    - `project-storage-node-registry.ts:78` (`storageSyncStep`): the implementer names the row that reaches `:126`. If there is none, add one row to that `it.each` with a throwing synchronous step: a typed storage failure is kept, and a plain error dies, with `Cause.squash` `toBe` it. Expected red: none — pin.
    - `project-storage-store.ts:158`: `project-storage-store.test.ts:686, 726-732, 805`.
    - `desktop-shutdown.ts:32, 37`: `desktop-shutdown.test.ts:129, 150`.
  - Binding observation: for each site, record once that its pin fails against a temporary fix that does not unwrap `cause`, so the wrapper reaches the seam. Then restore the source, verified by digest. A site whose pin cannot fail that way (preparation: only the failure flag is read) records that fact instead.
  - The gate (B5) proves that the rule is satisfied.
  - Test: `answers writer-unavailable for a save queued behind a failing settlement` and `answers writer-unavailable without the repository after close() and after a failure` and `refuses Conversation work arriving at any point after the settlement failure` and `rethrows a non-busy repository rejection on save and read` -> `apps/harness/src/canonical-project-writer.test.ts`; `aggregates the program and the dispose: $name` and `reports a startup failure after a bounded dispose: $name` and `routes the process runtime through its edges: unsubscribe throws` -> `apps/harness/src/process-bootstrap.test.ts`; `answers cleanup unconfirmed when a listing rejects while close drains it (CNV-B37)` -> `apps/harness/src/registration/project-registration-preparation.test.ts`; `names every unconfirmed part: $name (CNV-B37)` -> `apps/harness/src/registration/registration-listing.test.ts`; `stops the standalone authority of its options: $name` and `waits for an in-flight admission before the database` -> `apps/harness/src/registration/registration-registry.test.ts`; `keeps a typed storage failure and leaves anything else a defect: $name` and `keeps a typed storage failure from the synchronous witness step` -> `apps/harness/src/storage/project-storage-node-registry.test.ts`; `retains Project Storage sessions until close succeeds` and `retains a late activation release across shutdown (%i failures)` and `retains delayed asynchronous registry failure in the shared stop promise` -> `apps/harness/src/storage/project-storage-store.test.ts`; `attempts every cleanup and preserves failures in order` and `falls back exactly once when quit shutdown fails` -> `apps/desktop/src/main/desktop-shutdown.test.ts`
- **Behavior U2B-EG-B7**: the stop closure keeps its memo and its outcome after it moves to the edge.
  - Pins (Expected red: none — pin): the s5 rows in `process-bootstrap.test.ts` that call the returned stop twice and assert the same settled outcome, and that aggregate a stop failure with a dispose failure (:158, :208). Binding observation: record once that a temporary closure without `disposal ??=` fails the same-outcome row; then restore the source, verified by digest.
  - Test: `aggregates the program and the dispose: $name` -> `apps/harness/src/process-bootstrap.test.ts`
- **Behavior U2B-EG-B8**: the supervisor shutdown timeout is a typed failure with the same message and status.
  - Seam: `HarnessSupervisor.stop()`, through the existing grace and kill row.
  - Test: the row at `apps/desktop/src/main/harness-supervisor.test.ts:615-640`. Its outcome assertion changes by decision P-S5B-1 from `toEqual(new Error("Harness shutdown timed out."))` to:
    - `outcome` is an instance of `HarnessShutdownTimeout`;
    - `_tag` is `"HarnessShutdownTimeout"`;
    - `message` is "Harness shutdown timed out.";
    - it is an instance of `Error`.
    The `getStatus()` assertion (`degraded`, `HARNESS_SHUTDOWN_TIMEOUT`) stays unchanged.
  - Expected red: at `1c33122` the outcome is a plain `Error`, so the instance and `_tag` checks fail.
- **Behavior U2B-EG-B9**: the nine legacy sites are waived, registered and otherwise unchanged.
  - Oracle: B5 passes with 0 `newPromise` errors; the register lists EW1-EW9 with a `removeWhen` each; and no line other than the two comment lines above each site changes in those 8 files (the diff is checked in candidate review).
  - Test: `passes on the repository` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`
  - Expected red: none — pin (B5 at step 4 is the red for the whole set).
- **Behavior U2B-EG-B10**: (round 1, S5B-R1-2) the canary never passes a run whose exit status or diagnostic count differs from the expected set, including an inactive language service.
  - Seam: `checkEffectDiagnostics` with fake `resolve`, `exists` and `spawn` (canary first), as in the existing canary rows. The canary rows take a per-row exit status, which stays 1 for the existing rows.
  - Test: `runs the canary before any package: $name` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`. New rows:
    - `exit 0 with the expected set` (status 0, the 4 expected lines) → `EFFECT_GATE_CANARY_MISMATCH`;
    - `missing the last expected diagnostic` (status 1, the expected lines without `src/canary.ts(4,24): warning … effect(anyUnknownInErrorContext)`, which is last in sorted order) → `EFFECT_GATE_CANARY_MISMATCH`;
    - `inactive language service` (status 0, empty output) → `EFFECT_GATE_CANARY_MISMATCH`.
  - Oracle: the code as listed, and no package runs (the fake `spawn` call count is 1).
  - Expected red: none — pin (the gate at `54d2e12` already returns the mismatch for all three).
  - Binding observation, once each, restored by digest: removing `run.status === 1 &&` (`check-effect-diagnostics.mjs:124` at `54d2e12`) fails `exit 0 with the expected set`; removing the length check (:125) fails `missing the last expected diagnostic`; removing both fails `inactive language service`.
- **Behavior U2B-EG-B11**: (round 1, S5B-R1-3) every failure names its cause.
  - Seam: `checkEffectDiagnostics` and the CLI (which already prints `code` followed by `lines`).
  - Test: `distinguishes a broken binary run: $name` and `runs the canary before any package: $name` and `runs the canary before any package: plugin removed` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`
  - Assertions: each row's result assertion becomes `toMatchObject({ ok: false, code })` plus a `lines` assertion, and the call-count assertions stay. Every failure result carries `lines`, at most 20, and each fragment below appears in `lines.join("\n")`:
    - `missing package`: `@effect/tsgo-<platform>-<arch>` with the running platform and architecture;
    - `missing executable`: the executable path the gate looked for;
    - `spawn error`: the project (`first`) and `EPERM`;
    - `killed`: `first` and `SIGKILL`;
    - `exit 2`: `first` and `exit 2`;
    - `exit 1, no diagnostic line`: `first`, `exit 1` and `something went wrong`;
    - `exit 1 with a non-Effect error`: `first` and `src/a.ts(1,7)`;
    - `exit 0 with an error line`: `first`, `exit 0` and `src/a.ts(3,18)`;
    - every canary mismatch: each differing key, prefixed `extra ` or `missing ` (for example `extra src/canary.ts(1,1) error newPromise`), and `canary exit <status>` when the status is not 1. The `plugin removed` row asserts at least one `extra ` or `missing ` line, since its exact lines come from the real binary's defaults.
  - Oracle: as listed; the stop-at-first-failure rule is unchanged.
  - Expected red: at `54d2e12` the failure results have no `lines`, so every new `lines` assertion fails, while the codes still match.
- **Behavior U2B-EG-B12**: (round 1, S5B-R1-6) the waiver register covers every file the gate checks, and each entry is complete.
  - Seam: `checkEffectDiagnostics({ root, projects: [], register: true })` over a temporary tree, as in the existing register rows; the temporary tree gains a file path per row.
  - Test: `keeps the waiver register exact: $name` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`. New rows:
    - `directive under tests without entry` (`apps/sample/tests/a.ts`) → `EFFECT_GATE_WAIVER_UNREGISTERED`;
    - `directive under build without entry` (`apps/sample/build/a.ts`) → `EFFECT_GATE_WAIVER_UNREGISTERED`;
    - `directive in a root config without entry` (`apps/sample/vite.main.config.ts`) → `EFFECT_GATE_WAIVER_UNREGISTERED`;
    - `registered under tests` (the same directive and waiver line under `apps/sample/tests/a.ts`, with its entry) → passes the register step;
    - `entry without reason` and `entry without removeWhen` (otherwise `registered`) → `EFFECT_GATE_BROKEN`, with a line naming the entry id and the missing field.
  - Scope: the scan covers the folders and root files that the four checked tsconfigs include. These are each package's `src`, `tests` and `build` folders and its root-level `.ts` files, for `.ts`, `.tsx`, `.mts`, `.cts` and `.mjs`. The scan skips `node_modules`. It never reaches `apps/harness/scripts/`, which holds the canary's own waived line, the gate and its tests. If a real tree has a directive under these roots, it needs an entry or the gate fails. The implementer records the count of directives found on the real tree, which is expected to be the 9 in `src`.
  - Oracle: as listed; the existing four rows are unchanged.
  - Expected red: at `54d2e12` the three `… without entry` rows outside `src` and the two incomplete-entry rows return `{ ok: true }`; `registered under tests` passes (none — pin for that row).
- **Behavior U2B-EG-B13**: (round 1, S5B-R1-7) the repository run checks exactly the four packages.
  - Seam: `checkEffectDiagnostics({ root })`; a passing result also carries `projects`, the list of packages it checked, in order.
  - Test: `passes on the repository` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`. The assertion adds `projects: ["packages/kernel", "packages/protocol", "apps/harness", "apps/desktop"]` (exact, with `toEqual` on that field).
  - Oracle: `{ ok: true, canary: "matched", projects }` as listed; the 15 s timeout is unchanged.
  - Expected red: at `54d2e12` the result has no `projects`, so the new assertion fails.
- **TDD-exempt:**
  - The AGENTS.md sentence (design point 9) — documentation only.
  - The knip ignore entry for the canary folder — it changes no behaviour, and `pnpm check:dead-code` passing is its check.
  - Round 1, S5B-R1-4 (Pedro's choice (a), §134): `AGENTS.md:78` is reworded. Documentation only. The whole bullet becomes exactly this sentence group:
    "- Type checking authority: `pnpm typecheck` (the project's TypeScript, currently 6.0.2) is the type-checking authority. The editor and agent LSP is Effect tsgo (TypeScript-Go 7 plus the Effect language service, enabled by the `@effect/language-service` plugin in `tsconfig.base.json`). In the editor, an error that only the LSP reports is advisory: investigate it. `pnpm check:effect`, which runs inside `pnpm check`, runs the same Effect build in tsc mode and blocks on every error it reports: each `error`-level Effect diagnostic, and any other error, including a type error that only TypeScript-Go reports, which the gate reports as a broken run and never as clean. Effect `warning` diagnostics stay advice unless a reviewer and the user promote one to a rule."
  - Round 1, S5B-R1-10: one TSDoc sentence in the module header of `apps/harness/src/effect-rejection.ts` and of `apps/desktop/src/main/effect-rejection.ts`. Each sentence names the twin module and the accepted `shared-vocab-union` exception: apps never import each other, and the tag never crosses a process boundary. Comment only.
- **Order of work, round 1** (findings in `review-candidate-s5b-round1.md`; coordinator triage, §134):
  1. The B2 re-observation (S5B-R1-1), on `7270a5a`, before any other change; the log goes in the s5b TDD evidence folder.
  2. B10 pins and their three bindings.
  3. B11 red, then green; B12 red, then green; B13 red, then green. Each red uses the smallest Vitest command, against the gate as it stands at that point.
  4. The TDD-exempt items S5B-R1-4 and S5B-R1-10.
  5. The review/refactor gate on the new tree:
     - the gate tests;
     - `pnpm check`, `pnpm typecheck`, `pnpm check:effect` (warning count recorded), `pnpm check:dead-code` and `pnpm check:duplicates`;
     - CodeScene `code_health_score` on every source and test file changed in `1c33122..<new candidate>`, with the tool output saved (S5B-R1-5), and refactoring until each file scores 10.
  6. New commits on top of `7270a5a`, the round-1 fix commit first, then its evidence. Nothing is amended. The new candidate is the fix commit.
  7. The designer runs the slice preflight on `1c33122..<new candidate>` and saves it as `u2b-s5b-effect-gate-preflight-r3.log`.
  8. No heavy reruns (coordinator, §134): only the gate script, its tests and two comments change, besides `AGENTS.md`.
  9. Candidate review round 2, the last (slice-verifier, normal lane), over `1c33122..<new candidate>` with the incremental view `54d2e12..<new candidate>`.

### Success Criteria: u2b-s5b-effect-gate

**Automated:**
- `pnpm exec vitest run --project harness apps/harness/scripts/check-effect-diagnostics.test.mjs`: red, then green, per behaviour.
- The B6/B7 pins, with the smallest Vitest commands:
  - `pnpm exec vitest run --project harness apps/harness/src/canonical-project-writer.test.ts apps/harness/src/process-bootstrap.test.ts apps/harness/src/registration/project-registration-preparation.test.ts apps/harness/src/registration/registration-listing.test.ts apps/harness/src/registration/registration-registry.test.ts apps/harness/src/storage/project-storage-node-registry.test.ts apps/harness/src/storage/project-storage-store.test.ts`;
  - the desktop main project with `apps/desktop/src/main/desktop-shutdown.test.ts apps/desktop/src/main/harness-supervisor.test.ts` (the project name as in `vitest.config.ts`).
- `pnpm check:effect` on the final candidate: exit 0, with the advisory warning count recorded. `pnpm check`, `pnpm typecheck`, `pnpm check:dead-code` and `pnpm check:duplicates` also pass. CodeScene scores 10 on every changed file (AGENTS.md).
- The B5 binding observation and the B6/B7 binding observations, each with its restore digest.
- Heavy runs: none are planned. The fixes keep every public value, and the pins cover them. Whether to rerun the registration suite (the listing and registry-database stop chain) is the coordinator's call at run time.
- Mutation: none in s5b (D13, normal lane). s5b joins the combined run on the final combined candidate. Its entries are added then:
  - `mutate`: the gate script's classification and canary comparison;
  - include: `apps/harness/scripts/check-effect-diagnostics.test.mjs`, if the harness mutation config can include scripts. Otherwise this is recorded as not mutated, with the reason.
- The slice preflight on the committed candidate, saved by the designer as `u2b-s5b-effect-gate-preflight.log`.
- Round 1 (§134):
  - the B2 re-observation log;
  - B10-B13 red/pin and binding logs;
  - the light gates above on the new candidate;
  - the CodeScene tool output for every changed source and test file, each scoring 10, not a hand-written summary;
  - preflight r3. No heavy reruns.

**Manual:**
- On Windows, outside the agent, once: `pnpm check` runs the gate, and Defender raises no detection (`Get-MpThreatDetection` shows nothing newer than 2026-10-18 19:57:17).
- On CI: the first push with s5b shows the gate's pass line in both jobs. This is recorded when Part A is pushed.

### Slice u2b-s6-desktop-runtime (detailed 2026-10-18)

- **slice_id:** `u2b-s6-desktop-runtime`
- **Lane:** rigorous. `lane.mjs --paths` over the planned files reports "files: 9 > 5" and "sensitive word: ipc" (for `project-entry-ipc.ts`, `project-registration-ipc.ts` and their tests). D15 planned this slice as normal, but a lane only rises; the raise is recorded in Developer Context. The rigorous lane brings:
  - intent review: the slice-verifier plus the code and coverage reviewers, a fan-out that needs the coordinator's GO;
  - the same reviewer pair at candidate review;
  - Pedro's acceptance of this slice;
  - a scoped mutation run on its final candidate (D13).
- **Parent:** s5b, which passed its gates with accepted residuals (§134 round cap), on `refactor/123-effect-lifecycle-part-a`. Code at `010ee05`. HEAD is `de29eec`, the round-2 brief commit, which follows the R2-5 evidence in `d28aad0`.
- **Behaviour IDs:** U2B-DR-B1 … U2B-DR-B7.
  - B1-B5 come from the outline in Deferred Work.
  - B6 is the Layer safety net (Architecture, Electron main process).
  - B7 is the R1-8 carry (EW6/EW8).
- **Source of scope:**
  - Intent item 6;
  - Architecture: "Ownership after Part A, Electron main process", with its two correction lines, and "Electron main runtime (slice 6)";
  - D1, D11, D13 and D15;
  - research §8;
  - decisions log §135: the s6 start, P-S6-1 to P-S6-5, and the intent round-1 decisions;
  - Follow-ups at 22:30 (R1-8) and 23:02;
  - `review-intent-s6-round1.md`.
- **Affected source:**
  - `apps/desktop/src/main/desktop-runtime.ts` (new);
  - `apps/desktop/src/main/main.ts`;
  - `apps/desktop/src/main/desktop-shutdown.ts`;
  - `apps/desktop/src/main/project-entry-ipc.ts`;
  - `apps/desktop/src/main/project-registration-ipc.ts`;
  - `apps/desktop/src/main/project-entry-bridge.ts`, which exports its two coordinator-unavailable builders;
  - `apps/desktop/src/main/workspace-bridge.ts`, which exports `capabilityForIntent`;
  - `apps/desktop/src/main/canonical-writer-package-smoke.ts`;
  - `apps/harness/scripts/effect-diagnostics-waivers.json`;
  - the s6 mutation configs `stryker.desktop-s6.config.json` and `apps/desktop/vitest.desktop-s6-mutation.config.ts` (new).
- **Affected tests:**
  - `apps/desktop/src/main/desktop-runtime.test.ts` (new);
  - `apps/desktop/src/main/desktop-shutdown.test.ts`;
  - `apps/desktop/src/main/project-entry-ipc.test.ts`;
  - `apps/desktop/src/main/project-registration-ipc.test.ts` (new);
  - `apps/desktop/src/main/workspace-bridge.test.ts`;
  - `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`;
  - `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`;
  - `apps/harness/scripts/check-effect-diagnostics.test.mjs`.
  - The measurement tool is not part of the candidate.
- **Deliverable:**
  1. One `ManagedRuntime` in Electron main, built lazily from Layers: `DesktopLogger`, `HarnessSupervision` (the supervisor and the session it owns), and the three bridges as services.
     - Each service exposes one latched `stop`. The explicit program and the Layer release share it, so each owner stops at most once.
     - The module-level owner variables (`main.ts:53-56`) are replaced by services, read from the runtime once in `bootstrap()`.
  2. Shutdown keeps its controller contract and adds two steps: each bridge stops on its own, which fixes the skip at `main.ts:60-63`; and the runtime is disposed, within a bound, before `quit()` or `exit()`.
  3. From the turn shutdown starts (P-S6-1), and for the rest of the process's life, every renderer IPC handler that would reach a bridge answers its D11 `unavailable` envelope. It never calls the bridge or the runtime, and never hangs. This includes a folder dialog that is still open when shutdown starts (S6-I12).
  4. The paths for writer-proof, lock refusal and authorization refusal build no runtime, including the quit each path ends in.
  5. EW6 and EW8 become Effect code, and their waivers leave the code and the register.
- **Measured facts (2026-10-18, at `de29eec`; read, not run):**
  - `createDesktopShutdown` (`desktop-shutdown.ts:12-90`) runs a requirement-free Effect program through the global `Effect.runPromise` (:47). It takes `stopProjectStorageBridge` and `stopWorkspaceBridge`.
    - `main.ts:60-63` stops the workspace bridge and then the entry bridge in one callback, so a workspace throw skips the entry stop.
  - The installed `ManagedRuntime` (`node_modules/effect/src/ManagedRuntime.ts:285-375`) builds its Layer lazily, on the first `run*` or `context()`.
    - `dispose` of a runtime that was never built only closes its scope.
    - Any `run*` after dispose dies with "ManagedRuntime disposed" (:344).
  - After `stop()`, the bridges answer as follows:
    - list: `broken` `PROJECT_LIST_TRANSPORT_FAILED` (`project-entry-bridge.ts:82, 156`);
    - registration: `broken` `PROJECT_REGISTRATION_TRANSPORT_FAILED` (:166-169);
    - workspace query and intent: `broken` with "Workspace bridge is stopped." (`workspace-bridge.ts:151-152`);
    - activate, switch, upgrade, read and save: already their `unavailable` connection-lost results, through the `unsent` fault (`project-entry-bridge.ts:104-118`, `project-upgrade-failure.ts:52-53`, `project-conversation-failure.ts:57-58, 74-75`).
    - So list, registration and workspace are the real D11 gap. The other channels' rows pin the D11 envelopes at the IPC edge.
  - `chooseRepository` (`project-registration-ipc.ts:28-45`) does three things in order:
    - it answers `IDENTITY_CAPABILITY_UNAVAILABLE` off Windows (:32-33);
    - it opens the folder dialog (:35-37);
    - it calls `bridge.register` only after the dialog returns (:40).
  - The harness IPC handlers (`main.ts:228-233`) call the supervisor directly. After stop, the supervisor answers `getStatus()` with `stopped` and `retry()` with `HARNESS_RETRY_UNAVAILABLE` (`harness-supervisor.ts:91-104, 119-130`). They reach neither a bridge nor the runtime.
  - `HarnessSupervisor.stop()` memoizes its promise (`harness-supervisor.ts:120, 134`). After a timeout, that promise stays rejected with `HarnessShutdownTimeout` (:180), so a second `stop()` returns the same rejection. The supervisor resets `#stopping` once its stop has settled (:128, :159, :200).
  - The ordinary lock-refused launch calls `app.quit()` (`main.ts:351`). In Electron that emits `before-quit`, whose listener is registered at module load (:425-431), so the shutdown program and dispose run on that path too. The authorization-refused path ends in `desktopShutdown.requestExit(1)` (:461-468).
  - `harness-supervisor.ts:14` imports named exports from `electron`. Under plain Node, `electron` exports only a path string (`node_modules/electron/index.js:52`).
  - The cleanup that an `Effect.callback` registration returns runs only on interruption (`node_modules/effect/src/internal/effect.ts:1185-1218`; `Effect.ts:1781-1782`).
  - EW8 (`main.ts:80-89`, `writeWriterProofReport`) is a `new Promise` around `process.stderr.write`. Its only caller is `runPrivateWriterProof` (:124), an async function on the writer-proof path.
  - EW6 (`canonical-writer-package-smoke.ts:297-327`, `OwnedUtility.wait`) is a `new Promise` polling wait, driven by a timer and the proof's change listeners. Its own `finish` (:303-311) clears the timer and the listener on success and on failure. It has 11 `await …wait(` call sites (:345, :433, :490, :496, :503, :529, :531, :532, :675, :678, :696).
- **Design points:**
  1. **Layers and services** (`apps/desktop/src/main/desktop-runtime.ts`, new).
     - `makeDesktopRuntime(ports)` returns a `ManagedRuntime` over one Layer graph:
       - `DesktopLogger`, built with `Layer.sync` from `createLogger()`. It has no release, because the logger has no close (research §8; S6-J17);
       - `HarnessSupervision`, which depends on the logger;
       - `ProjectEntryBridge`, `ProjectStorageBridge` and `WorkspaceBridge`, which depend on the session.
     - Each service is a `Context.Service`. Its operations have no requirements; the dependencies are wired in the Layers.
     - **Ports** (S6-I7, S6-J1):
       - The value ports are thunks: `createLogger()`, `harnessEntryPath()`, `harnessBootstrap()`, `createId()` and `now()`. They are evaluated inside the Layer build, never at module load.
       - The owner ports are factories: `createSupervisor(logger, entryPath, bootstrap)`, `createProjectEntryBridge(session)`, `createProjectStorageBridge(session)` and `createWorkspaceBridge(session)`. `main.ts` passes the real constructors. Tests pass fakes that record their stops.
     - **Once-latched stop** (S6-I1, S6-I8). Every owner is acquired with `Effect.acquireRelease`, and its service exposes `stop`.
       - The first call to `stop` runs the owner's own stop and records it. Later calls return that first outcome.
       - The Layer release runs the owner's stop only when no `stop` call came first. This is the `closeIfNeverStopped` pattern from s3's authority.
       - So after the explicit program, dispose stops nothing again, and a supervisor stop that already failed is not reported a second time. Without the program, the releases stop every owner, and a failure surfaces through dispose.
     - **Release order** (S6-I24, S6-J18): the bridges release before the supervisor.
       - The order comes from the Layer dependencies (the bridges depend on the session). There is no separate ordering rule.
       - Either order would be harmless, because the explicit program stops the bridges before the supervisor, and after it the releases are no-ops.
       - B6 pins the order as built. This refines D1.
     - **Partial build** (S6-I18): if a constructor throws during the build (for example the supervisor's strict bootstrap decode), the read fails. `dispose()` then releases only the owners already built and constructs nothing again.
     - **Where the services are read** (S6-I7, S6-I19): `main.ts` builds the runtime at module load, which builds no Layer. In `bootstrap()` it reads the services once with `runtime.runSync`, where `createMainLogger` runs today (`main.ts:368`). That point comes after `setAppLogsPath()`, `configureSessionSecurity()` and the package-smoke `setPath`. Every acquire is synchronous, so the read keeps the current turn order.
  2. **Explicit shutdown program** (D1).
     - The program stays explicit and keeps its own requirement-free `Effect.runPromise` edge (`desktop-shutdown.ts:47`). It does not run on the runtime (P-S6-5).
     - Its order: project-storage bridge, workspace bridge, project-entry bridge, harness, then dispose. Every step runs even when an earlier one fails.
     - Failures are kept in the order they happen, and the dispose failure comes last (S6-I4). One failure is thrown as itself. Several are thrown as `AggregateError("Desktop shutdown failed.")` with all of them, so no failure replaces another.
     - `createDesktopShutdown` gains a required `stopProjectEntryBridge(): void` and a required `dispose(): Promise<void>`. `main.ts` passes the services' latched stops and `() => runtime.dispose()`.
     - Dispose is the program's last step, inside the memoized `stop()` promise. So `stop()` settles only after dispose, and `finish` calls `quit`/`exit` only after `stop()` settles. That keeps the pinned timing (`desktop-shutdown.test.ts:48-50`).
  3. **Dispose bound** (P-S6-3).
     - Dispose runs under `Effect.timeoutOrElse` with `DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS` = 1 000 ms.
     - A miss is a typed `DesktopRuntimeDisposeUnconfirmed` (`Data.TaggedError`, with `deadlineMs`) in the failures. A dispose rejection is kept as its own value.
     - Either way `stop()` rejects, so `finish` calls `exit(1)` and never a clean `quit`.
     - The bound sits inside the `preventDefault` window. The harness stop before it keeps its own grace, kill and grace.
     - **Measured first** (Pedro, P-S6-3 "Medir primeiro, depois 1 s", §135). The 1 000 ms value is fixed only after step 0 of the order of work, under the half-the-bound rule: p99 ≤ 500 ms in every cell. Otherwise the slice stops for Pedro.
  4. **IPC gate** (D11, P-S6-1, P-S6-2, S6-I12).
     - The controller gains `accepting(): boolean`. It is true until the first call to `stop()`, `beforeQuit` or `requestExit`. From that same synchronous turn it is false, and it never becomes true again in that process (S6-I2).
     - `registerProjectEntryIpc`, `registerProjectRegistrationIpc` and `registerWorkspaceIpc` each take a second argument, `gate: Readonly<{ accepting(): boolean }>`.
     - Each handler first decodes its value strictly, so malformed input still throws, then reads the gate. When the gate is closed, the handler answers without calling the bridge:
       - `listProjects` → `{ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" }`;
       - `registerProject` → `{ status: "unavailable", code: "PROJECT_REGISTRATION_UNAVAILABLE" }`;
       - `chooseRepository`:
         - it reads the gate before the platform capability check, so a closed gate answers that same `unavailable` result on every platform, without opening the dialog (P-S6-2);
         - it reads the gate again after the dialog returns, and if the gate has closed in the meantime, it answers the same result and registers nothing (S6-I12 (a));
       - `activateProject` and `switchProject` → the results of the two coordinator-unavailable builders that `project-entry-bridge.ts` owns (:105-120; S6-I22, S6-J12):
         - today `unavailable(...)` is a closure inside `createProjectEntryBridge`; it and its two applications are hoisted to module scope and exported, and the bridge's own `activate` and `switchProject` reuse those exports, with no change in behaviour;
         - `activateProject` gives `unavailable` with `retryable: true`, and `switchProject` gives `coordinator-unavailable` with `retryable: false`, each with `PROJECT_COORDINATOR_UNAVAILABLE` and `projectAvailabilityMessages.connectionLost`;
       - `upgradeProject`, `readConversation` and `saveConversationMessage` → their `unavailable` connection-lost results, from the existing `projectUpgradeFailure`, `readConversationFailure` and `saveConversationFailure` with the `unsent` fault;
       - `queryWorkspace` → `{ status: "unavailable", query, diagnostic: { code: "WORKSPACE_CAPABILITY_UNAVAILABLE", message: "The workspace is unavailable while SlopStop closes." } }`;
       - `submitWorkspaceIntent` → the same, with `capability: capabilityForIntent(intent)`, which `workspace-bridge.ts` exports (S6-I22).
     - No protocol code is new. `getRegistrationCapability` and the two harness channels are not gated (measured facts).
  5. **No runtime on the early paths** (S6-I3, S6-I13). These branches return before any service is read, and the quit or exit each of them ends in runs the program over services that were never read, so the lazy runtime is never built:
     - the writer-proof branch (`main.ts:358-362`);
     - the lock-refusal branch (:350-354);
     - the authorization-refused exit (:461-468).
     - The program's stop callbacks read services only through the runtime's cached context, never through `run*`. Before the build, they stop nothing, and dispose only closes the scope.
     - **Quit before ready** (S6-J11): `bootstrap()` returns before reading the services when `desktopShutdown.accepting()` is false, for example after a `before-quit` that came before `whenReady`. A runtime that was disposed before it was built is then never read, so no false "SlopStop failed to start." is printed.
  6. **EW8** becomes `writeWriterProofReport(text): Effect<void, WriterProofReportFailed>`, an `Effect.callback` over `process.stderr.write` with the same error text. `runPrivateWriterProof` runs it with `Effect.runPromise` at the entrypoint edge. The writer-proof path builds no runtime (point 5), and the effect has no requirements.
  7. **EW6** (P-S6-4 (a), S6-I9). `OwnedUtility.wait` becomes an Effect, an `Effect.callback`.
     - Its success and failure cleanup stays where it is today, in the resume path (`finish`): it clears the timer and removes the change listener before resuming.
     - The canceler the registration returns repeats that cleanup for interruption only. It is defensive, because the facade passes no signal.
     - The method keeps its Promise signature, as a temporary facade (`Effect.runPromise`) for its 11 call sites in the same module.
     - The facade is recorded in two places (S6-I27, S6-J2):
       - a TSDoc line on `wait`, written at build: "Temporary Promise facade; remove when the writer package smoke migrates to Effect, Part B";
       - a Part B line under Deferred Work ("Deferred beyond Part A"), added in this revision.
  8. **Waiver register.** The EW6 and EW8 waiver lines, their directives and their register entries are removed. The register's ids are then exactly `EW1`-`EW5`, `EW7` and `EW9` (7 waivers), and a test asserts them (S6-I14).
- **Non-goals:**
  - the bridge core and the drift fixes, including merging the three bridge services into one `HarnessBridges` service (s7; S6-I15, Architecture correction);
  - the supervisor's own global `Effect.runFork` timers and the stdout drain (s8);
  - removing IPC handlers on shutdown (`ipcMain.removeHandler` stays unused; D11 answers instead);
  - migrating the rest of the writer package smoke (Part B).
  - requests already in flight when shutdown starts (S6-J10). The gate covers only requests that arrive after shutdown starts. In-flight requests keep their bridge-stop answers until s7's core (`project-entry-bridge.ts:205-210`):
    - list and registration: `broken …_TRANSPORT_FAILED`;
    - workspace: `broken`;
    - save: `uncertain`.

### Test Contract: u2b-s6-desktop-runtime

- **Fixtures:**
  - **Shutdown rows:** they use `createDesktopShutdown` with recording callbacks, as the existing rows do. The B1 order rows give `stopProjectEntryBridge` a callback that records nothing, so B1 does not depend on B2 (S6-I25).
  - **Bounded-dispose rows:** they use `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })`, the s5 precedent. The program runs on Effect's default clock, which fake timers drive.
  - **IPC rows:** they capture `ipcMain.handle` through an `electron` mock, and every bridge fake gives an open-path answer that differs from the D11 envelope. The existing switch fake in `project-entry-ipc.test.ts:27-31` answers exactly the gated envelope, so it changes, for example to a `switched` result (S6-I23).
    - The gated rows get their own fakes. The shared `registered()` fake in `project-entry-ipc.test.ts` and its existing row `list, activate and switch as before` stay unchanged (S6-J13, which supersedes the S6-I23 wording above).
  - **Registration test** (S6-I11): `project-registration-ipc.test.ts` is new. Its `electron` mock provides `ipcMain.handle`, a `dialog.showOpenDialog` spy with controllable resolution, and `BrowserWindow.fromWebContents`. Its rows pin `process.platform` to `win32`, except the one non-Windows row.
    - Its fakes answer schema-valid open-path results that `RepositoryChoiceResultSchema` decodes (for example `repository-selected` with a UUID), so the scaffold red is the stated one and not a decode throw (S6-J21).
  - **Main rows:** they use `canonical-writer-package-smoke-main.test.ts` and its mocks. The test gains:
    - ports for the project-entry bridge's `stop`, `list` and `register`, and for the workspace bridge's `query`;
    - a construction counter for `HarnessSupervisor`;
    - order recorders for `app.setAppLogsPath`, `createMainLogger` and `createProjectStorageHarnessBootstrap`, which also records its argument;
    - a `vi.mock("./desktop-runtime.js", importOriginal)` wrapper around the real `makeDesktopRuntime`, which records `dispose` in the shared order (S6-I5).
    - The owner fakes stay plain `vi.fn`, and the once-latch keeps each of them called at most once.
    - `project-entry-bridge.js` and `workspace-bridge.js` are mocked with `vi.mock(importOriginal)`, and only their factories are overridden. The new exports (the builders and `capabilityForIntent`) stay real (S6-J19).
    - The B5 path row uses a stateful `getPath`. It returns a sentinel for `"logs"` until `setAppLogsPath` runs, and a sentinel for `"userData"` until `setPath("userData", root)` runs (S6-J3).
  - **Runtime rows:** they build `makeDesktopRuntime` with fake value thunks and fake owner factories (S6-J1). The owners record their stops.
  - **Timer allowance** (S6-J16, the s5 allowance): narrowing `toFake`, or adding a macrotask step to the main test's `flush()`, is allowed as a fixture-only change with the assertions unchanged. It is recorded if used.
- **Order of work:**
  0. **Opening measurement** (P-S6-3, S6-I10). It runs before any code change, it has no red, and it needs the coordinator's GO at run time.
     - The tool lives in `.rpiv/artifacts/evidence/2026-10-18_123-s6-dispose-measurement/`, outside `apps/` and not part of the candidate.
     - It runs as an Electron main script, so every owner is real (the coordinator chose S6-I10 (a)).
       - Electron cannot load the TypeScript owners directly: `@slopstop/protocol` exports `./src/index.ts`, and the sources import with `.js` specifiers.
       - So the tool is bundled with esbuild into the evidence folder and run with `pnpm --filter @slopstop/desktop exec electron <bundle>`. The filter is needed because `electron` is a dependency of `apps/desktop` only.
       - The bundle command, the bundle's sha256 and the run command are recorded with the results (S6-J5).
     - It builds a `ManagedRuntime` over the same owners as design point 1, using today's constructors:
       - the real main logger, writing to a temporary folder;
       - the real `HarnessSupervisor`, never started, so there is no child;
       - the three real bridges over the supervisor's real session.
     - Each sample builds a fresh runtime and reads its services. Only `dispose()` is timed. Two cells:
       - **M-dispose-after-program:** the s6 program's stops (the three bridges, then the supervisor) have already run, outside the timing, so every release is a no-op;
       - **M-dispose-safety-net:** no program ran, so the releases stop every owner.
     - **Rules** (restated from s3 and s5; §114 T3/T4, §116):
       - each cell runs quiet and under the §116 burst: the six #94 loops with `node_modules` excluded from the `rg`/`git` search, and the tool waits for each burst process, so windows never overlap;
       - 200 samples per cell and condition, each bounded at 15 s; a sample that hits its bound counts as 15 000 ms;
       - the whole run is bounded at about 30 min;
       - quiet means three CPU readings under 30%;
       - every timed burst sample falls inside its burst window;
       - a cell left incomplete, or with a sample outside its window, is `broken` and stops the slice for Pedro (`.rpiv/decisions/degrade-distinguishes-broken.md`).
     - **Report:** p50, p95, p99 and max per cell and condition, plus the burst-window timestamps, in the s6 TDD evidence.
     - **Rule (half the bound):** if every cell's p99 is ≤ 500 ms, `DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS` = 1 000. Otherwise the slice stops and Pedro decides; the coordinator relays.
     - The B1 bound rows (999 ms and 1 000 ms) are written only after this result.
  1. **Scaffold** the new signatures without the behaviour (S6-I17):
     - `accepting: () => true`;
     - the `stopProjectEntryBridge` and `dispose` options, accepted but unused;
     - the `gate` argument, accepted but unread;
     - `makeDesktopRuntime`, which builds the Layers, with an unlatched `stop` and releases that do nothing;
     - in `main.ts`: a no-op `stopProjectEntryBridge` and `dispose`, and an always-open gate, until step 4.
     - Adapt the existing fixtures to the required options; their assertions do not change.
     - Then observe the B1, B2, B3 and B6 reds, and the red of the B7 register-ids row.
  2. B1, B2 and B3 green, in that order.
  3. B6 green: the latch and the releases.
  4. Wire `main.ts` onto the runtime: B4 (pins plus binding), and the B2, B3 and B1 main rows.
  5. B7: EW8, then EW6, with the register red, then green. Then the timer-leak pins.
  6. B5 pins throughout.
  7. **Candidate review** (Pedro, §135, after the intent cap):
     - round 1 runs over the final candidate;
     - if it has findings, ONE fix round follows, then a confirming round 2 over the fixed candidate;
     - any finding left after round 2 goes to the cap choices (shared **Lanes**);
     - the scoped mutation runs once, on the candidate after the last review round's fixes.
  8. **Fix round 1** (candidate review round 1, §135; `review-candidate-s6-round1.md`):
     - a fix commit on top of `feeab30`, then its evidence, with nothing amended;
     - the fixes S6-K1 to S6-K6 and S6-K8 to S6-K12, plus the S6-K13 check, each with its rows and bindings as written in B1, B3, B4, B5, B6 and B7;
     - every binding is re-run on the fix candidate, and its digest is recorded against that candidate's patch digest (S6-K15);
     - the light gates: the s6 test files, `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code` and `pnpm check:duplicates`;
     - CodeScene `code_health_score` on every source and test file changed in `de29eec..<fix candidate>`, with the tool output saved;
     - heavy runs with the coordinator's GO: e2e and `package:smoke`, because S6-K9 touches startup;
     - the designer's preflight `de29eec..<fix candidate>`;
     - candidate review round 2, the confirming round;
     - then the scoped mutation, where S6-K16 is checked: the mutants that span the canceler gap must exist in the report.
  9. **Fix round 2** (candidate review round 2, `review-candidate-s6-round2.md`; Pedro, §135, "Mais uma ronda curta"):
     - a second fix commit on top of `b4fc9ed`, then its evidence, with nothing amended;
     - the fixes S6-L1 to S6-L11, each with its row, pin or binding as written in B1, B2, B5, B6, B7 and the Success Criteria;
     - the bindings changed or added in this round are run on the new candidate, with digests recorded against its patch;
     - the light gates: the s6 test files, `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code` and `pnpm check:duplicates`;
     - CodeScene `code_health_score` on every file changed in this round, with the tool output saved;
     - heavy runs only if the coordinator judges them affected. L1 changes only the failure branch of `finish`, which `package:smoke` does not reach.
     - the designer's preflight `de29eec..<new candidate>`;
     - **a short confirming review**, limited to the S6-L1 to S6-L11 rows and to regressions in the delta `34641bc..<new candidate>`:
       - it runs on the incremental diff;
       - reviewers: the slice-verifier (contract and decisions, including L1's terminal-action guarantee) and the coverage reviewer (oracles and mutation fitness: L2, L3, L4, L5, L7, L11);
       - the code reviewer is not run, because the delta has no new design. L1's code is a try/finally that both remaining reviewers check;
       - any finding left after it goes to Pedro, with no further fix round;
     - then the scoped mutation.
- **Behavior U2B-DR-B1**: shutdown disposes the main runtime before `quit()` or `exit()`, within a bound. A failed or unconfirmed dispose is never a clean quit, and no failure replaces another.
  - Seam: `createDesktopShutdown` with the `dispose` port, and the `main.ts` wiring.
  - Test: `disposes the runtime before the terminal action: $name` -> `apps/desktop/src/main/desktop-shutdown.test.ts`; `disposes the main runtime before quit` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Rows (shutdown), each recording `order` (the entry stop records nothing here):
    - `quit`: `beforeQuit`, with the harness stop held on a deferred. While the deferred is pending, `order` has no `"dispose"`. After it resolves, `order` is `["project-storage", "workspace", "harness", "dispose", "quit"]` (S6-J4);
    - `requested exit`: `requestExit(0)` → the same, ending in `"exit:0"`;
    - `failed harness stop`: the harness stop rejects → `[…, "harness", "dispose", "exit:1"]`, and `stop()` rejects with that error itself;
    - `dispose rejects` → `[…, "dispose", "exit:1"]`; `quit` is never called, and `stop()` rejects with the dispose error;
    - `harness and dispose both fail`: `stop()` rejects with an `AggregateError` whose `errors` are `[harnessFailure, disposeFailure]`, followed by `exit(1)`;
    - `harness fails and dispose never settles`: `stop()` rejects with an `AggregateError` whose `errors` are `[harnessFailure, DesktopRuntimeDisposeUnconfirmed]`, followed by `exit(1)` at 1 000 ms;
    - `dispose never settles`: at 999 ms there is no terminal action; at 1 000 ms comes `exit(1)`, and `stop()` rejects with `DesktopRuntimeDisposeUnconfirmed` (`_tag`, `deadlineMs: 1000`).
  - Row (main): an ordinary launch, then `before-quit` (S6-J15).
    - The `importOriginal` wrapper holds the real dispose's promise on a deferred.
    - The `dispose` of the runtime that `main.ts` built is recorded after the harness stop, and only once.
    - `app.quit` is not called until the deferred is released.
  - Oracle: the exact order, with `dispose` called once and one terminal action.
  - Expected red: against the scaffold, `dispose` is never called.
    - The `quit`, `requested exit` and `failed harness stop` rows lack `"dispose"`.
    - `dispose rejects` quits with no failure.
    - The two aggregation rows reject with the harness error alone.
    - `dispose never settles` reaches its terminal action at once.
    - In the main row there is no `dispose` in the order.
  - Fix round 1 (candidate round 1, S6-K10, §135):
    - `createDesktopShutdown` gains an optional `reportFailure(error)` port. `finish` calls it once with the `stop()` rejection, before `exit(1)`.
    - In `main.ts` the port logs the failure once through the main logger (`logger.error`).
    - New shutdown rows in the same `it.each`:
      - `reports a failure once before exit`: the harness stop rejects. `reportFailure` is called once with that error, before `exit(1)`.
      - `reports an unconfirmed dispose`: dispose never settles. At 1 000 ms, `reportFailure` gets `DesktopRuntimeDisposeUnconfirmed`, then `exit(1)`.
      - `reports nothing on a clean quit`: `reportFailure` is never called.
    - Expected red: `reportFailure` is never called (at `b0e92fc` the rejection handler is `() => options.exit(1)`). The clean-quit row is none — pin.
  - Fix round 2 (candidate round 2, S6-L1, S6-L4; Pedro, §135, "Mais uma ronda curta"):
    - S6-L1. `finish` runs the report inside `try { options.reportFailure?.(error) } finally { options.exit(1) }`, so a report that throws never skips the exit.
      - New shutdown row in the same `it.each`: `a throwing report still exits 1`. The harness stop rejects and `reportFailure` throws; `exit(1)` is still called exactly once, and `quit` is never called.
      - Expected red at `34641bc`: `exit` is never called, because the throw escapes before it.
    - S6-L4 (this changes an existing assertion, decided at the cap). The main fixture's bridge-stop fakes (`storageStop`, `workspaceStop`, `entryStop`) record their names into `ports.order`.
      - The B1 main row `disposes the main runtime before quit` now asserts that `ports.order`, filtered to those names plus `"harness"` and `"dispose"`, equals `["project-storage", "workspace", "project-entry", "harness", "dispose"]`, before the dispose hold is released.
      - Expected red: none — pin (the program's order holds at `34641bc`).
      - Binding, restored by digest: replacing the program's entry stop at `main.ts:102` (at `34641bc`) with `() => undefined` makes the row fail, because the entry stop then comes after `"harness"`, through the release.
- **Behavior U2B-DR-B2**: every bridge stops even when an earlier bridge stop throws.
  - Seam: `createDesktopShutdown` with `stopProjectEntryBridge`, and the `main.ts` wiring.
  - Test: `keeps stopping after a bridge stop throws: $name` -> `apps/desktop/src/main/desktop-shutdown.test.ts`; `stops every bridge when the workspace stop throws` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Rows (shutdown): `project storage throws`, `workspace throws` and `project entry throws`. In each:
    - every other bridge stop, the harness stop and dispose are called once, in the order project-storage, workspace, project-entry, harness, dispose;
    - `exit(1)` follows;
    - `stop()` rejects with the thrown error.
  - Row (main): an ordinary launch (`SLOPSTOP_PACKAGE_SMOKE` `0`) whose workspace bridge `stop` throws. After `before-quit`:
    - the project-entry bridge's `stop` and the harness `stop` are each called once, the latch included;
    - `app.exit(1)` is called, not `app.quit`.
  - Expected red: against the scaffold, `stopProjectEntryBridge` is never called in any shutdown row. In the main row the entry bridge's `stop` is skipped (`main.ts:60-63`).
  - Fix round 2 (S6-L2): the B2 main row `stops every bridge when the workspace stop throws` keeps the thrown error. It asserts that `ports.logError` was called exactly once with `({ err: <that error> }, "SlopStop shutdown failed.")`.
    - Expected red: none — pin (the wiring at `main.ts:105-106` logs at `34641bc`).
    - Binding, restored by digest: making the reporter read `builtDesktopServices(runtime)` instead of the snapshot makes the row fail, because `cachedContext` is cleared by dispose.
- **Behavior U2B-DR-B3**: from the turn shutdown starts, and from then on, every gated IPC handler answers its D11 envelope without calling the bridge, and never hangs.
  - Seam: the controller's `accepting()`; `registerProjectEntryIpc`, `registerProjectRegistrationIpc` and `registerWorkspaceIpc` with a gate; and the `main.ts` wiring.
  - Test: `closes the IPC gate in the turn shutdown starts: $name` -> `apps/desktop/src/main/desktop-shutdown.test.ts`; `answers unavailable after the IPC gate closes: $channel` -> `apps/desktop/src/main/project-entry-ipc.test.ts`; `answers registration unavailable after the IPC gate closes: $channel` -> `apps/desktop/src/main/project-registration-ipc.test.ts`; `answers workspace unavailable after the IPC gate closes: $channel` -> `apps/desktop/src/main/workspace-bridge.test.ts`; `answers unavailable after quit starts: $channel` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Rows (controller): `beforeQuit then quit`, `requestExit`, and `stop` alone. In each, `accepting()` is:
    - true before the call;
    - false right after it, in the same turn;
    - still false after `stop()` settles, and also after the terminal action in `beforeQuit then quit` and `requestExit` (S6-I2, S6-J22).
  - Rows (project entry): `listProjects`, `activateProject`, `switchProject`, `upgradeProject`, `readConversation` and `saveConversationMessage`. Each gives its envelope from design point 4, checked with `toEqual`.
  - Rows (registration):
    - `registerProject` → its envelope;
    - `chooseRepository` (on `win32`) → the same envelope, and `dialog.showOpenDialog` is never called;
    - `chooseRepository off Windows` (`process.platform` is `linux`) → the same envelope, because the gate is read before the capability check;
    - `chooseRepository while the dialog is open`: the gate is open on entry; it closes while `showOpenDialog` is still pending; the dialog then resolves with a directory. The answer is the same envelope, and `register` is never called (S6-I12);
    - `getRegistrationCapability` → unchanged (`none — pin` for that row).
  - Rows (workspace): `queryWorkspace` and `submitWorkspaceIntent` → their envelopes.
  - In every gated row the bridge fake is never called. Every gated channel that takes a value (all of them except `chooseRepository`) also throws on a malformed value while the gate is closed, and its fake is still not called (S6-I28).
  - Rows (main), `$channel` = `listProjects`, `registerProject` or `queryWorkspace` (S6-I6). On an ordinary launch, the captured handler is called twice:
    - in the turn of `before-quit`;
    - again after the flush, once dispose has completed.
    - Both answers are its D11 envelope, and the bridge's `list`, `register` or `query` is never called (S6-I2).
  - Expected red: against the scaffold:
    - `accepting()` stays true;
    - every gated handler calls its bridge fake and returns the fake's open-path answer;
    - the dialog-open row calls `register`;
    - in the main rows each handler reaches its bridge.
  - Fix round 1 (S6-K1, S6-K4, S6-K5, S6-K12, §135):
    - S6-K1: `chooseRepository` reads the gate again before the cancel check.
      - New registration row: `chooseRepository cancelled while closing`. The gate closes while `showOpenDialog` is pending, then the dialog returns `{ canceled: true }`. The answer is `PROJECT_REGISTRATION_UNAVAILABLE`, and `register` is never called.
      - Expected red at `b0e92fc`: `{ status: "cancelled" }`.
    - S6-K4: open-gate rows.
      - `registerProject` forwards the decoded request to `register` and returns its answer.
      - `chooseRepository`, on `win32` with a selected directory, calls `register({ step: "select-repository", directory })` once and returns the decoded result.
      - Expected red: none — pin, because the open path works at `b0e92fc`.
      - Binding, restored by digest: replacing either gate read with an always-closed answer makes the matching row fail.
  - Test: `forwards registration while the IPC gate is open: $channel` -> `apps/desktop/src/main/project-registration-ipc.test.ts`
    - S6-K5: in the B3 main rows, `app.quit` is asserted called once before the second handler call. The terminal quit follows only a completed dispose.
    - S6-K12: the gated workspace row's query fake answers a `ready` result, so its open-path answer differs from the envelope in `status`.
- **Behavior U2B-DR-B4**: the paths for writer-proof, lock refusal and authorization refusal build no runtime, including the quit or exit they end in.
  - Seam: `main.ts` through `canonical-writer-package-smoke-main.test.ts`.
  - Test: `builds no desktop runtime: $path` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Rows:
    - `writer proof`;
    - `package smoke without the lock`;
    - `ordinary launch without the lock`, which fires `before-quit` and then flushes. `app.quit` is called exactly twice, once for the lock quit at `main.ts:351` and once for the terminal quit, and `app.exit` is never called (S6-I3, S6-J8);
    - `authorization refused`: `applyPackageSmokeAuthorization` throws, then comes the flush (S6-I13).
    - `before-quit before ready`: an ordinary launch whose `before-quit` comes before `whenReady` resolves. No stderr line is written (S6-J11).
    - In each row, `createMainLogger` is never called and `HarnessSupervisor` is constructed 0 times.
  - Expected red: none — pin. This is true today, because those paths return before any owner exists.
  - Binding observation, once, restored by digest: reading the services (`runtime.runSync`) at the start of `bootstrap()` makes the `writer proof` row fail. Separately, a program stop callback that reads the services through `runtime.runSync` makes the `ordinary launch without the lock` row fail.
  - Fix round 1 (S6-K6): one more binding, restored by digest. Removing `if (!desktopShutdown.accepting()) return` (`main.ts:427` at `b0e92fc`) makes `before-quit before ready` fail on `writes`.
- **Behavior U2B-DR-B5**: the existing shutdown and main characterizations hold, and the services read after the logs and userData paths are set.
  - Test: `retains ordered shutdown and allows only the post-stop quit re-entry` and `retains package exit until the same shutdown chain settles` and `maps a pending package smoke quit to one nonzero exit` and `attempts every cleanup and preserves failures in order` and `falls back exactly once when quit shutdown fails` and `maps a failed retained package shutdown to one nonzero exit` and `lets an explicit exit supersede a pending quit without duplicating terminal action` and `uses one nonzero fallback when quit and explicit exit share a failed stop` -> `apps/desktop/src/main/desktop-shutdown.test.ts`; `retains %s shutdown` and `retains %s quit ownership` and `quits an ordinary launch that does not hold the lock` and `reads the desktop services after their paths are set` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Oracle:
    - The existing assertions do not change. The shutdown fixtures add `stopProjectEntryBridge: () => {}` and `dispose: () => Promise.resolve()`, which record nothing, so each `order` assertion is unchanged. In the main pins, the latch keeps `ports.stop` called once.
    - `reads the desktop services after their paths are set` (S6-I7, S6-J3) runs in scenario `bootstrap`, with an authorized root and the stateful `getPath`. It asserts two things:
      - `createMainLogger`'s first argument is the logs path set by `setAppLogsPath`, not the sentinel;
      - `createProjectStorageHarnessBootstrap` receives `userDataRoot` equal to the root set by `setPath`.
      - Binding: a value thunk evaluated at module load makes the row fail.
  - Expected red: none — pin, for all of them. The order row also holds today; it guards the move behind the Layer ports.
  - Fix round 1 (S6-K9, §135): the startup log and crash reporting run first again.
    - The `DesktopLogger` acquire creates the logger, then emits `logger.info({ crashReporting: initializeCrashReporting() }, "SlopStop desktop starting.")`. This happens before any other owner is constructed, which is the `de29eec` order.
    - New main row, `logs the desktop start before building the owners`: in scenario `bootstrap`, the start log call comes before the `HarnessSupervisor` construction (call order).
    - Expected red at `b0e92fc`: the log comes after the owners are built.
  - Test: `logs the desktop start before building the owners` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Fix round 2 (S6-L11): the K9 row also asserts that `initializeCrashReporting` (`ports.sentry`) is called once, before the `HarnessSupervisor` construction (call order).
    - Expected red: none — pin.
    - Binding, restored by digest: removing the `crashReporting` field from the start log makes the row fail.
- **Behavior U2B-DR-B6**: the runtime stops each owner at most once, with the program or as a safety net. The bridges stop before the supervisor, and a partial build releases only what was built.
  - Seam: `makeDesktopRuntime(ports)`, with fake thunks.
  - Test: `releases every owner on dispose: $name` -> `apps/desktop/src/main/desktop-runtime.test.ts`
  - Rows:
    - `built, never stopped`: read the services, then `dispose()`. Each bridge's owner stop and the supervisor's owner stop are called once, and the three bridge stops come before the supervisor's.
    - `program then dispose`: read the services, call each service's `stop` as the program does, then `dispose()`. Each owner stop is called once in total, and `dispose()` resolves (S6-I1).
    - `supervisor stop rejects, no program`: `dispose()` rejects with that failure.
    - `supervisor stop rejects, program first`: the service `stop` rejects with that failure, and a later `dispose()` resolves without calling the owner's stop again (S6-I8).
    - `never built`: `dispose()` alone calls no thunk and no stop.
    - `a release throws`: a bridge's owner stop throws. The other owners are still stopped, and `dispose()` rejects.
    - `build fails after the logger`: `createSupervisor` throws (S6-J1). Reading the services fails; `dispose()` resolves, stops no owner that was never built, and calls no factory twice (S6-I18).
    - `stop twice`: the supervisor owner stop rejects once. Both calls to the service `stop` reject with that same failure, and the owner stop is called once (S6-J9).
  - Expected red: against the scaffold (an unlatched stop and empty releases):
    - `built, never stopped` records no stop;
    - `program then dispose` and `supervisor stop rejects, program first` pass only through empty releases. The latch row is proven with its binding: an unlatched stop whose release always calls the owner makes both rows fail;
    - `supervisor stop rejects, no program` resolves;
    - `a release throws` resolves.
    - `never built` and `build fails after the logger` are none — pin.
  - Fix round 1 (S6-K2, S6-K3, S6-K11, §135):
    - S6-K2: a new row in the same `it.each`, `build fails after the supervisor`. `createWorkspaceBridge` throws after the supervisor and the other two bridges are built. Four things must hold:
      - reading the services fails with that factory's own error, pinned by identity;
      - across the failed read plus `dispose()`, every built owner is stopped exactly once, the bridges before the supervisor;
      - `dispose()` resolves;
      - no factory runs twice.
    - The implementer makes it pass so that the read never hits the async boundary. Two ways: releases that do not suspend when the owner stop settles synchronously, or a service read that handles the build failure before the scope's async finalizers run.
    - Expected red at `b0e92fc`: the read dies with `AsyncFiberError` (`effect/src/internal/effect.ts:5799-5802`).
    - The existing row `build fails after the logger` now pins its thrown value: the `createSupervisor` error.
    - S6-K3: a new test checks the factory inputs. Each bridge factory is called once with `{ session, createId: ports.createId, now: ports.now }`, where `session` is the fake supervisor's `getSession()` value. Expected red: none — pin. Binding: passing `{}` to one factory makes it fail.
  - Test: `passes each bridge its session, id and clock` -> `apps/desktop/src/main/desktop-runtime.test.ts`
    - S6-K11: a TSDoc note on `builtDesktopServices` names its dependency on `ManagedRuntime.cachedContext` (marked internal by effect), and names the tests that catch drift (the B2 main row and `package:smoke`).
  - Fix round 2 (S6-L6, S6-L7, S6-L8, S6-L10):
    - S6-L7: the `build fails after the supervisor` row pins its premise exactly.
      - `builtBridges(ports)` equals `["project-entry", "project-storage"]`.
      - `createSupervisor`, `createProjectEntryBridge` and `createProjectStorageBridge` are each called exactly once, and `createWorkspaceBridge` once (it throws).
      - The stops are `["project-entry", "project-storage"]` in either order, followed by `"supervisor"`.
      - Expected red: none — pin. The `toBeLessThanOrEqual(1)` bounds become exact `toHaveBeenCalledOnce()`.
    - S6-L8: the K11 TSDoc on `builtDesktopServices` names the rows that catch `cachedContext` drift: `disposes the main runtime before quit`, `retains %s shutdown` and `package:smoke`. It no longer names the B2 main row, because the release safety net hides the drift there. Comment only.
    - S6-L10: a TSDoc note on the owners-scope line (`desktop-runtime.ts:213` at `34641bc`) names its dependency on `runtime.scope`, which effect marks internal, and on `ManagedRuntime.make` forking the layer and fiber scopes first (`ManagedRuntime.ts:292-294`). That is what makes the owners close first. Comment only.
    - S6-L6: `Scope.forkUnsafe(runtime.scope, "sequential")` drops the explicit `"sequential"`, which is the default (`effect/src/internal/effect.ts:4092`). Behaviour is unchanged, and the B6 order rows are its check.
- **Behavior U2B-DR-B7**: EW6 and EW8 are Effect code without waivers, the register lists exactly the remaining waivers, and the writer proof behaves as before, with no timer left behind.
  - Seam: the gate on the real tree, the register file, and the writer-proof tests.
  - Test: `passes on the repository` and `keeps exactly the registered waivers` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`; `fails an active wait when another owned process fails` and `bounds spawn completion at %sms` and `bounds actual handshake response at %sms` and `bounds whole proof at monotonic %sms` and `leaves no timer after a wait: $outcome` -> `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`; `owns quit during %s` and `uses unconfirmed fallback for %s exception` and `flushes exact %s terminal result before exit` -> `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`
  - Oracle:
    - `pnpm check:effect` passes.
    - `keeps exactly the registered waivers` reads `effect-diagnostics-waivers.json` and asserts that its ids equal `["EW1", "EW2", "EW3", "EW4", "EW5", "EW7", "EW9"]` (S6-I14).
    - `leaves no timer after a wait: $outcome` (S6-I9, S6-J6), with rows `passed proof` and `failed wait`:
      - both rows advance time in bounded `vi.advanceTimersByTimeAsync` steps, never through `settle()`, because its `runAllTimersAsync` would fire a leaked timer and hide it;
      - `failed wait` fails through another owned process's failure notification, as in `fails an active wait when another owned process fails`;
      - after the runner settles, `vi.getTimerCount()` is 0.
      - The removal of the change listener has no oracle, because the listener set is internal.
    - The other writer-proof tests' assertions do not change.
  - Expected red:
    - `keeps exactly the registered waivers` fails at `de29eec`, where the register lists nine ids.
    - After each site is converted and its two comment lines are removed while its entry is still registered, `pnpm check:effect` fails with `EFFECT_GATE_WAIVER_STALE` naming EW8, then EW6. Removing the entries turns both green.
    - `leaves no timer after a wait`: none — pin, because `finish` clears the timer today; observed at base. Binding: without the `clearTimeout` in the resume path, `passed proof` fails.
    - The other writer-proof tests: none — pin.
  - Fix round 1 (S6-K13, Pedro, §135, "Tirar se sobrarem"): the implementer first checks in the installed Effect source whether a second resume of an `Effect.callback` is ignored, and records the source lines.
    - If it is ignored, the `settled` guards in `polling` (`canonical-writer-package-smoke.ts:311`, `:318` at `b0e92fc`) are removed as redundant (s4 §123 precedent). The B7 pins stay green.
    - If it is not ignored, a new writer-smoke test kills each guard's removal. Its title is recorded in the evidence.
    - Nothing is declared in advance.
  - Fix round 1 (S6-K8): `project-entry-ipc.ts` imports the single `unsent` fault constant, which `project-entry-bridge.ts` exports; the copy is removed. This is a refactor, and the existing B3 rows are its check.
  - Fix round 2 (S6-L9): the K13 citation is corrected to `effect/src/internal/effect.ts:1169-1170`, the `if (resumed) return` / `resumed = true` guard in effect 4.0.0. It is corrected in three places: the comment at `canonical-writer-package-smoke.ts:310` (at `34641bc`), the fix evidence `2026-10-19_123-s6-fix-evidence.md` line 43, and the decisions log `2026-10-05_conversation-decisions.md` line 1596 (§135, the K13 entry), which today says `:1167-1168`. Record only.
- **TDD-exempt:**
  - The EW6 facade's TSDoc line and the s6 mutation configuration files: documentation and gate configuration, checked by the scoped run. The Part B line is already in Deferred Work (S6-J2).

### Success Criteria: u2b-s6-desktop-runtime

**Automated:**
- The smallest Vitest commands, red then green per behaviour: `pnpm exec vitest run --project desktop-main` (as in `apps/desktop/vitest.main.config.ts`) with the s6 test files in the desktop main folder, and `pnpm exec vitest run --project harness apps/harness/scripts/check-effect-diagnostics.test.mjs` for B7's register row.
- On the final candidate: `pnpm check:effect` (B7 red, then green), `pnpm check`, `pnpm typecheck`, `pnpm check:dead-code` and `pnpm check:duplicates`.
- CodeScene `code_health_score` on every changed source and test file, with the tool output saved. Each file scores 10, or its pre-existing score is recorded with its debt.
- The bindings, each with its restore digest: B4 (two), B6 (the latch), B7 (the timer), and any the implementer adds for B1-B3.
- Heavy runs, each with the coordinator's GO:
  - `package:smoke`, because it launches the packaged main, its quit and the writer proof;
  - the desktop e2e journeys, if the coordinator judges the quit path affects them.
- **Scoped mutation** on the final candidate (rigorous lane, D13), with the coordinator's GO (S6-I16).
  - Config: `stryker.desktop-s6.config.json`, whose Vitest config is `apps/desktop/vitest.desktop-s6-mutation.config.ts`.
  - `mutate`:
    - `apps/desktop/src/main/desktop-shutdown.ts` (whole file);
    - `apps/desktop/src/main/desktop-runtime.ts` (whole file);
    - the gate branches in `project-entry-ipc.ts` and `project-registration-ipc.ts`;
    - `registerWorkspaceIpc` in `main.ts`;
    - `OwnedUtility.wait` and its facade in `canonical-writer-package-smoke.ts`, except the lines of the defensive interruption canceler, which no test can reach because the facade passes no signal (Pedro, S6-J7);
    - `writeWriterProofReport` in `main.ts`.
    - Fix round 1 (S6-K6): the program's stop and dispose wiring (`main.ts:87-92` at `b0e92fc`) and the J11 guard (`:427`). Ranges are re-resolved on the fix candidate.
    - Fix round 2 (S6-L3 (a), Pedro, §135; S6-L5):
      - the two ranges `canonical-writer-package-smoke.ts:300-331` and `:338-339` become one range, `:300-339`, so that Stryker can place the BlockStatement mutants of the `polling` body and of the `Effect.callback` register body, which span the canceler;
      - the canceler itself (`:333-337` at `34641bc`) is excluded in the source with `// Stryker disable all` before it and `// Stryker restore all` after it. Each directive comment carries the reason "S6-J7: defensive interruption canceler, unreachable through the facade";
      - `apps/desktop/src/main/project-entry-bridge.ts:79-79` (the single `unsent` owner after K8) is added to `mutate`;
      - the "all killed" rule stays, with the J7 exception and the K14 correction only;
      - at the run, S6-K16 is satisfied when the report lists the `polling` and register-body BlockStatement mutants, and no mutant inside `:333-337`.
    - The ranges are resolved on the final candidate.
  - Test include:
    - `desktop-shutdown.test.ts`;
    - `desktop-runtime.test.ts`;
    - `project-entry-ipc.test.ts`;
    - `project-registration-ipc.test.ts`;
    - `workspace-bridge.test.ts`;
    - `canonical-writer-package-smoke.test.ts`;
    - `canonical-writer-package-smoke-main.test.ts`.
  - Command: `pnpm exec stryker run stryker.desktop-s6.config.json`.
  - Pass rule (the s1, s3 and s5 rule): every counted mutant is killed, a `Timeout` counts as killed, and any survivor stops the run for triage. `ignoreStatic` is on, so the B1 999 ms and 1 000 ms rows are the guard for `DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS`.
  - **s6 exception to "all killed"** (Pedro, §135, S6-J7; s1 R6 precedent). These survivors are declared in advance, each with its reason:
    - the listener-removal mutant in `wait` (`this.proof.changes.delete(check)`): the listener set is internal, so no public seam observes it;
    - the StringLiteral and `_tag` mutants of the `writeWriterProofReport` error: they cannot be observed, because `reportUnconfirmedWriterProof` replaces that rejection with fixed lines (`main.ts:456-459`).
    - Every other mutant counts, and any other survivor stops the run for triage.
- The slice preflight on the committed candidate, saved by the designer.

**Manual:**
- On Windows, outside the agent, once: start the app, then quit it three ways: the window close button, `Alt+F4`, and the window menu's File → Exit (Electron's default menu). Each quit finishes within the harness grace plus the bound, and the main log shows no error.
- Request during quit (S6-I26, S6-J14), observed once, in a development build:
  - Before File → Exit, start a repeating `listProjects` call through the preload API in devtools (for example every 50 ms), logging each answer.
  - Quit with the window open.
  - While the harness stop is pending, the answers turn to `{ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" }`, and the window does not hang.
  - Attach a screen recording or the logged answers.

### Slice u2b-s7-bridge-core (detailed 2026-10-19)

- **slice_id:** `u2b-s7-bridge-core`
- **Lane:** rigorous. `lane.mjs --paths` over the planned files reports "files: 11 > 5", "sensitive word: session" and "sensitive word: ipc". D15 planned normal; a lane only rises, and the raise is recorded in Developer Context. So the slice gets:
  - intent review (slice-verifier and the code and coverage reviewers; a fan-out that needs the coordinator's GO);
  - the reviewer pair at candidate review;
  - Pedro's acceptance of this slice;
  - a scoped mutation run on its final candidate (D13).
- **Parent:** s6, accepted by Pedro at code `54d30da` (decisions log §136), on `refactor/123-effect-lifecycle-part-a`. HEAD is `829c3cf`, which adds the s6 acceptance docs.
- **Behaviour IDs:** U2B-BC-B1 … U2B-BC-B10.
  - B1-B6 come from the outline in Deferred Work, re-checked against s6 as built.
  - B7: one `HarnessBridges` service (S6-I15).
  - B8: EW7 removal.
  - B9: in-flight requests at shutdown (S6-J10; P-S7-2 (a), in scope).
  - B10: the shared core's own behaviour (round-1 S7-R4).
- **Source of scope:**
  - Intent item 7;
  - Architecture "Desktop bridge core (slice 7)" and "Ordering", with its correction line;
  - D9, D10, D16;
  - P4 (decisions log §104) and §103.6;
  - research §9;
  - the S6-I15 line in the s7 outline;
  - decisions log §137: P-S7-1 (b), P-S7-2 (a), P-S7-3 (a), P-S7-4 (a), and R7 accepted;
  - `review-intent-s7-round1.md` (S7-R1 … R29);
  - the s6 carries S6-J10, S6-K8 and S6-K11/L10.
- **Affected source:**
  - `apps/desktop/src/main/harness-request-core.ts` (new; replaces `harness-pending-request.ts`, which is deleted);
  - `apps/desktop/src/main/harness-bridges.ts` (new; owns `createHarnessBridges`);
  - `project-entry-bridge.ts`, `project-storage-bridge.ts` and `workspace-bridge.ts`;
  - `harness-session.ts` (the nested-emit queue);
  - `project-upgrade-failure.ts` and `project-conversation-failure.ts` (the fault union gains reasons and `stopped`);
  - `desktop-runtime.ts` (one `HarnessBridges` service);
  - `project-entry-ipc.ts`, `project-registration-ipc.ts` and `main.ts` (the D11 envelope owners move into the bridges; the wiring);
  - `apps/harness/scripts/effect-diagnostics-waivers.json` (EW7 removed);
  - `stryker.desktop-s7.config.json` and `apps/desktop/vitest.desktop-s7-mutation.config.ts` (new).
  - `knip.jsonc`: an entry for `apps/desktop/vitest.desktop-s7-mutation.config.ts`, as at `knip.jsonc:19` for s6 (S7-S10).
- **Affected tests:**
  - `harness-request-core.test.ts` and `harness-bridges.test.ts` (new);
  - `project-entry-bridge.test.ts`, `project-storage-bridge.test.ts` and `workspace-bridge.test.ts`;
  - `harness-session.test.ts` and `harness-supervisor.test.ts`;
  - `desktop-runtime.test.ts`, `canonical-writer-package-smoke-main.test.ts`, `project-entry-ipc.test.ts` and `project-registration-ipc.test.ts`;
  - `apps/harness/scripts/check-effect-diagnostics.test.mjs`.
- **Deliverable:**
  1. One Effect request core per harness session:
     - a `Deferred` per message id;
     - registration and send in one synchronous step;
     - a throwing or refused send settles its request and frees its id;
     - one fault taxonomy, `ProjectRequestFault`, that carries reasons.
  2. The three bridges become thin mappings from fault to envelope over that core, with the P4 drift removed:
     - a null-correlated **result** and `system.failure` fail all pending requests as `protocol`, with fixed text;
     - a decode failure settles as `protocol` and never escapes the listener;
     - `stop` always settles pending requests, even when unsubscribe throws.
  3. `HarnessSession` queues a nested emit until the outer emit has reached every listener. A read pending during a protocol error, or during `system.failure`, then answers `broken` `protocolMessageInvalid` (§103.6).
  4. One `HarnessBridges` service (S6-I15), built by `createHarnessBridges` over one shared core, with per-bridge latched stops. The s6 shutdown and IPC contracts keep their behaviour.
  5. EW7 leaves the code and the register; `pnpm check:effect` passes with 6 registered waivers.
- **Measured facts (2026-10-19, at `829c3cf`; read, not run):**
  - `requestHarness` (`harness-pending-request.ts:55-79`) is the shared Promise core: `new Promise` under EW7 (:68-70), with registration and send inside the executor.
  - **Send.**
    - Project entry sends without a guard (`project-entry-bridge.ts:133-136`) and workspace likewise (`workspace-bridge.ts:161-167`): a throw escapes the executor, so the promise rejects and the pending entry leaks.
    - Project Storage catches the throw and frees the id (`project-storage-bridge.ts:176-186`; pin `maps a thrown send failure and releases the request identity`).
    - The real `HarnessSession.send` turns a throwing `postMessage` into a refusal (`harness-session.ts:80-88`), so the entry red needs a fake session.
  - **Null correlation.**
    - Project entry ignores a null-correlated message (`project-entry-bridge.ts:101`).
    - Project Storage fails all on a null-correlated result, with "Harness returned an uncorrelated Project Storage response." (`:231-233`; pinned in `rejects mismatched, uncorrelated, disconnected, and stopped requests`, `project-storage-bridge.test.ts:334-338`).
    - Workspace does the same with "Harness returned an uncorrelated workspace response." (`:297-299`; pin `rejects invalid response correlation`, `:645-651`).
    - The harness sends every `workspace.projection.invalidated` with `causationId: null` (`apps/harness/src/harness-runtime.ts:414-415`), and a null-correlated `system.ready` must leave pending work pending (pin `ignores system readiness while a workspace request is pending`, `workspace-bridge.test.ts:535-562`).
  - **`system.failure`.** Project entry ignores it. Project Storage fails all with "Harness reported a failure." (`:196-198`). Workspace forwards the raw text (`:221-222`), pinned by the `failure` case of `fails all pending work on %s` (`workspace-bridge.test.ts:591`). That row uses one `message` value both as the payload and as the expected text (`:620`, `:632`).
  - **Decode.**
    - Project Storage and workspace decode inside the listener (`project-storage-bridge.ts:66-73`; `workspace-bridge.ts:255`, `:283`). A failure throws out of the listener after the entry was removed, so the request never settles.
    - Project entry catches it as `desktop` (`project-entry-bridge.ts:124-130`).
    - The real session decodes whole messages first (`parseHarnessMessage`), so a payload-level decode failure reaches a bridge only through a fake session or schema drift.
  - **Stop.**
    - Project Storage settles in a `finally` after unsubscribe and rethrows the unsubscribe error (`project-storage-bridge.ts:136-144`; pin `settles pending operations even when session unsubscribe throws`, `:296-307`: `toThrow("unsubscribe failed")`, then "Project Storage bridge is stopped.", with `unsubscribeCalls` 1).
    - Project entry and workspace unsubscribe first, so a throw leaves requests unsettled (`project-entry-bridge.ts:223-228`; `workspace-bridge.ts:178-186`).
    - The workspace pin `stops once and rejects later requests without observing the session` expects `listenerCount` 0 after stop (`:491-502`).
  - **Cross-bridge replies.** Project Storage ignores a correlated reply whose event belongs to another bridge (`project-storage-bridge.ts:208-212`).
  - **Notifications.** The workspace bridge decodes `workspace.projection.invalidated`, keeps revision floors and notifies listeners (`workspace-bridge.ts:226-248`), and `main.ts:456` broadcasts them. Stop clears the listeners (`:185`).
  - **`HarnessSession` does not queue nested emits** (`harness-session.ts:98-110` is a plain loop).
    - The supervisor subscribes first (`harness-supervisor.ts:78-80`). On `protocol-error` (`:248-261`) and on `system.failure` (`:216-230`), it sets its status, then quarantines, and `detach` emits `disconnected` re-entrantly (`harness-session.ts:55-64`).
    - So the bridges see `disconnected` first: a read answers `unavailable` `connectionLost`, and storage and workspace answer "Harness session disconnected.".
  - **Timing.** `Effect.runPromise` is `runPromiseExit(...).then(...)` (`node_modules/effect/src/internal/effect.ts:5778`), so a facade over it settles one microtask later than today's inline-resolved Promise. Two pins assert after one flush: `request failure settles only its correlated Project Storage operation` (`project-storage-bridge.test.ts:212-213`) and `request failure settles only its correlated Workspace request` (`workspace-bridge.test.ts:348-349`).
  - **D11 envelope owners today.** `PROJECT_LIST_UNAVAILABLE` is in `project-entry-ipc.ts:43`, `PROJECT_REGISTRATION_UNAVAILABLE` in `project-registration-ipc.ts:20`, and the workspace closing text in `main.ts:294-297`. `project-entry-ipc.ts` imports `project-entry-bridge.ts`. `main.ts` imports `project-entry-bridge.ts` (:42) and `workspace-bridge.ts` (:59-63). `project-registration-ipc.ts` declares its own structural bridge type (S7-S11).
  - **Exhaustive fault matches.** `project-upgrade-failure.ts:50-66` and `project-conversation-failure.ts:33-47` match every fault kind.
  - **The s6 build-failure rows** (`desktop-runtime.test.ts:204-233`) depend on three separate bridge factories. The main test's supervisor mock returns `getSession() { return {}; }` (`canonical-writer-package-smoke-main.test.ts:95-97`).
  - **Already fixed:** the S6-M4 TSDoc is in place (`desktop-runtime.ts:94-97`); s7 does not touch it.
- **Design points:**
  1. **Fault taxonomy** (`harness-request-core.ts` owns it; `project-upgrade-failure.ts` re-exports the type). `ProjectRequestFault` is one of:
     - `{ kind: "transport" }`;
     - `{ kind: "protocol"; reason: "invalid-message" | "uncorrelated" | "system-failure" | "undecodable" }`;
     - `{ kind: "harness"; code; message }`;
     - `{ kind: "send"; code }`;
     - `{ kind: "unsent" }`;
     - `{ kind: "stopped" }`;
     - `{ kind: "desktop"; reason: "invalid-command" | "identity-collision" | "mismatched-event" | "mismatched-echo" }`.

     It stays a plain discriminated union (S7-R8). It is a value that the bridges map into envelopes, and it is never thrown. The Effect error channel carries it as typed data, as `PendingFailure` does today; it is not a `Data.TaggedError`, because no caller handles it as an error class.

     Fix round 1 (S7-K13): the re-export of `ProjectRequestFault` from `project-upgrade-failure.ts` is removed. No module imports the type from there; every consumer imports it from `harness-request-core.ts`, its owner. Typecheck and `pnpm check:dead-code` are the check.
  2. **Core** (`makeHarnessRequestCore(session)`): one subscription, plus one `Map<messageId, Entry>`. Each entry holds its bridge tag, its expected event and a `Deferred<unknown, ProjectRequestFault>`. `request(bridge, createCommand, expectedEvent)` returns `Effect<unknown, ProjectRequestFault>`:
     - an unbuildable command fails `desktop` `invalid-command`, and nothing is sent;
     - it registers the entry and sends in one `Effect.sync` step, so a reply delivered synchronously inside `send` finds its entry;
     - a colliding id fails `desktop` `identity-collision`, and the original entry is kept;
     - a refused send fails `send` with its code, and a throwing send fails `send` `HARNESS_SESSION_SEND_FAILED`; either way the entry is removed;
     - it then awaits the `Deferred`; on interruption, it removes its entry (the C2 hook).
  3. **Core event rules** (S7-R1). Only **reply events** are correlated: every `*.result` event and `request.failure`.
     - `disconnected` fails all as `transport`.
     - `protocol-error` fails all as `protocol` `invalid-message`.
     - `request.failure` fails its entry as `harness`, with its code and message.
     - A reply event with null correlation fails all as `protocol` `uncorrelated`.
     - `system.failure` fails all as `protocol` `system-failure`.
     - A reply whose event differs from its entry's expected event fails that entry as `desktop` `mismatched-event`.
     - **Stated widenings, which apply to every bridge (S7-R29, S7-S9).** Today Project Storage (`project-storage-bridge.ts:208-212`) and workspace (`workspace-bridge.ts:218-234`) ignore a reply of another bridge's kind, and each fails only on its own null-correlated results. The core now does two things in every bridge, standalone or shared:
       - a correlated reply of another kind fails its entry as `desktop` `mismatched-event`;
       - a null-correlated reply of any kind fails every pending entry as `protocol` `uncorrelated`, each with the receiving bridge's own uncorrelated text.
     - Otherwise the raw payload completes the `Deferred`.
     - `system.ready` and `workspace.projection.invalidated` are not reply events. The core ignores them whatever their correlation.
     - The core listener never throws: every rule is total.
     - Fix round 1 correction (S7-K1, §137): the sentence above holds for the reply rules only. Every reply rule is total. An observer's failure (design point 4, S7-S3: an undecodable `workspace.projection.invalidated`) propagates out of the core listener, as built (`harness-request-core.ts:80-83` at `f3d2c8f`). Design point 4 governs where the two differ.
  4. **Notifications** (S7-R1, S7-R27; S7-S1 (a), S7-S3).
     - The core has one session subscription only. It offers an observer hook for non-reply events: `core.observe(listener)` returns an unsubscribe function.
     - The workspace bridge registers its notification handler through that hook, so a workspace bridge never opens a second session subscription. Its revision floors and listeners are unchanged.
     - An undecodable `workspace.projection.invalidated` still throws, as `decodeStrict` does today (`workspace-bridge.ts:238`). The core rethrows it from its listener, and the design-point-7 session queue has already delivered the event to every listener, so the parse failure stays visible (`degrade-distinguishes-broken`).
     - On stop, the workspace bridge removes its observer and clears its listeners, as today.
     - Fix round 1 correction (S7-K1): the property "every listener received the event before the throw" comes from `HarnessSession#deliver`, which collects each listener's failure (already so at `829c3cf`), not from the design-point-7 queue. The behaviour is unchanged.
  5. **Bridges, envelopes and text.** Each bridge decodes its reply payload with its result schema. A decode failure is `protocol` `undecodable` (P-S7-3); an echo mismatch is `desktop` `mismatched-echo`. The bridges map faults as follows:
     - **Project entry.** It uses the existing `projectUpgradeFailure`, `readConversationFailure` and `saveConversationFailure`, the coordinator-unavailable builders, and the list/registration `TRANSPORT_FAILED` results. Every `protocol` reason maps like today's `protocol`, so a read answers `broken` and a save `uncertain`. Every `desktop` reason maps like today's `desktop`. `stopped` maps by operation, as in design point 8.
     - **Project Storage and workspace.** Both answer their `broken` `…_TRANSPORT_FAILED` envelope. Workspace keeps `WORKSPACE_PROJECTION_INVALID` for the stale-projection rule. The text is fixed per fault:

       | Fault | Project Storage | Workspace |
       | --- | --- | --- |
       | `transport` | "Harness session disconnected." | the same |
       | `protocol` `invalid-message` | "Harness session received an invalid protocol message." | the same |
       | `protocol` `uncorrelated` | "Harness returned an uncorrelated Project Storage response." (unchanged) | "Harness returned an uncorrelated workspace response." (unchanged) |
       | `protocol` `system-failure` | "Harness reported a failure." (P-S7-4) | the same |
       | `protocol` `undecodable` | "Harness returned an invalid Project Storage response." | "Harness returned an invalid workspace response." |
       | `harness` | the harness's own message (unchanged) | the same |
       | `send` | `harnessSendFailureMessage` | the same |
       | `unsent` | "Project Storage bridge is stopped." | "Workspace bridge is stopped." |
       | `stopped` | "Project Storage bridge is stopped." (unchanged, S7-R14) | the D11 envelope (design point 8) |
       | `desktop` | the existing text for its reason (mismatched response, invalid command, identity collision) | the same |
     - The bridge methods keep their Promise signatures (P-S7-1 (b)). Each runs `Effect.runPromise(core.request(...).pipe(mapToEnvelope))`.
       - This is a recorded temporary facade. Its removal trigger: C2 streaming moves the IPC edge and the package-smoke callers onto the runtime (Deferred Work line added now; S7-R23).
       - Settlement moves one microtask later. Pedro accepted this (R7, §137), so the two timing pins gain one flush step.
     - `unsent` keeps its single owner in `project-entry-bridge.ts` (S6-K8).
     - Fix round 1 (S7-K11, shared-vocab-union): the bridge-neutral texts get one owner. Identity first: the strings below are byte-identical in `project-storage-bridge.ts:39-56` and `workspace-bridge.ts:117-133` at `f3d2c8f`.
       - `harness-request-core.ts` exports one table of the bridge-neutral texts: `transport` "Harness session disconnected.", `protocol` `invalid-message` "Harness session received an invalid protocol message.", `protocol` `system-failure` "Harness reported a failure.", and `desktop` `identity-collision` "Harness request identity collided.".
       - `desktop` `invalid-command` takes its text from `harnessSendFailureMessage` for `HARNESS_SESSION_MESSAGE_INVALID` ("Desktop created an invalid harness message."), its owner at the base (`harness-send-failure.ts:10`), so the string exists once.
       - The bridge-specific texts stay local: `uncorrelated`, `undecodable`, `mismatched-event`, `mismatched-echo`, and the stopped texts.
       - This is a refactor. Its check is the existing pins that assert each text (B6), unchanged, plus `rg` over `apps/desktop/src` showing each neutral string once outside tests (saved in the evidence).
     - Fix round 1 (S7-K15): the workspace `faultText` no longer has the unreachable `stopped` arm. Its parameter type excludes `{ kind: "stopped" }`, which both callers already map to the closing envelope first (`workspace-bridge.ts:223-224`, `:238-239` at `f3d2c8f`). This is a type-level refactor; typecheck and the B9 rows are its check.
     - Fix round 1 (S7-K16): the `faultMeaning` TSDoc in `project-conversation-failure.ts` names the `protocol` reasons (`invalid-message`, `uncorrelated`, `system-failure`, `undecodable`) instead of "a malformed reply arrives as a session protocol error". Documentation only.
  6. **Two construction paths** (S7-R3).
     - **Standalone.** `createProjectEntryBridge`, `createProjectStorageBridge` and `createWorkspaceBridge` keep their `{ session, createId, now }` input, and each owns a private core with one session subscription.
       - Fix round 1 (S7-K14): the `{ createId, now }` clock shape is declared once and exported from `harness-request-core.ts`, replacing the three identical `type Clock` declarations (`project-entry-bridge.ts:93`, `project-storage-bridge.ts:86`, `workspace-bridge.ts:144` at `f3d2c8f`). `HarnessBridgesInput` and the runtime's bridge input reuse it where their shape is the same. A type-only refactor; typecheck is the check.
       - Its `stop` is idempotent. It marks the bridge stopped, settles its pending requests with its stop answer, removes its notification observer (workspace only), and then unsubscribes its core. If the unsubscribe throws, the error is rethrown after the settlement.
       - A second `stop()` does nothing, and later requests answer `unsent`.
       - The existing bridge tests and B5 use this path. With one subscription per bridge, the workspace pin `stops once and rejects later requests without observing the session` (`listenerCount` 1, `unsubscribeCalls` 1) holds unchanged.
     - **Shared.** `createHarnessBridges({ session, createId, now })`, in `harness-bridges.ts`, builds one core and the three bridges over it, and returns `{ projectEntry, projectStorage, workspace, release }`.
       - A shared bridge's `stop` is latched per bridge. It settles only that bridge's own entries (by tag) and never unsubscribes the core. The workspace bridge removes its observer. After its stop, a shared bridge answers `unsent` without sending, while the other bridges still send (S7-S11).
       - `release()` stops each bridge that is not yet stopped (storage, workspace, entry), each one isolated. It then unsubscribes the core in a `finally` that settles any entry left as `transport`, and raises the first failure after everything has run (S7-R10).
       - Build order: the core subscribes first, then project entry, Project Storage and workspace are built. If a bridge constructor throws, the core is unsubscribed (which removes any observer already added) and the error propagates (S7-R5, S7-S5).
       - Fix round 1 correction (S7-K1; D1 option (a), coordinator §137, ratified by Pedro §137): the constructor-throw cleanup in the sentence above is withdrawn. Under S7-S1 (a) the only session subscribe in `createHarnessBridges` is the core's, and the three bridge constructors only build closures and call `core.observe` (a `Set.add`), so no constructor throw is reachable at the public seam. No defensive branch is kept. The only partial-construction case is a throwing core subscribe: `createHarnessBridges` throws that error, and nothing is subscribed or built. The parenthesis "(which removes any observer already added)" was also wrong: the core's unsubscribe ends the session subscription and does not clear its observer set.
  7. **Nested emits in `HarnessSession`** (D10, D16; S7-R16).
     - An `#emit` called while another `#emit` is delivering is queued.
     - The queue always drains, in order and in the same synchronous turn, before any listener failure is rethrown. Failures from the outer and queued deliveries are collected and thrown once at the end: alone, or as `AggregateError("Harness session subscribers failed.")`.
     - The "delivering" flag resets in a `finally`.
     - A failure in a queued event no longer throws into the nested caller (`detach` inside the supervisor's listener). The supervisor's status timing is unchanged, because it sets its status before it detaches.
  8. **In-flight requests at shutdown** (S6-J10, P-S7-2 (a)). A bridge stop fails its in-flight entries with `stopped`:
     - list → `{ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" }`;
     - registration → `{ status: "unavailable", code: "PROJECT_REGISTRATION_UNAVAILABLE" }`;
     - workspace query and intent → their `unavailable` `WORKSPACE_CAPABILITY_UNAVAILABLE` envelope, with the s6 closing text;
     - read and upgrade → `unavailable` `connectionLost`, unchanged;
     - activate and switch → their coordinator-unavailable results, unchanged;
     - save → `uncertain` (G25), unchanged;
     - Project Storage → "Project Storage bridge is stopped.", unchanged.
     - **Single owners** (S7-R15): the list and registration closing envelopes move to `project-entry-bridge.ts`, and the workspace closing envelope builder moves to `workspace-bridge.ts`. `project-entry-ipc.ts`, `project-registration-ipc.ts` and `main.ts` import them. The two closing values are not copied anywhere.
  9. **`HarnessBridges` service** (S6-I15). `desktop-runtime.ts` replaces the three bridge services and their three owner ports with one service and one port.
     - The service is `HarnessBridges`; its value is `{ projectEntry, projectStorage, workspace }`. The port is `createHarnessBridges`.
     - Its `acquireRelease` release always calls `release()`, exactly once, at dispose (S7-S4). `release()` skips the bridges whose latched stop already ran, so after the s6 program it stops nothing again, but it always unsubscribes the core.
     - `DesktopServices` keeps its field names, so `main.ts:100-102`, `:186`, `:212` and `:448-456` keep working with the per-bridge latched stops.
     - The S6-K11/L10 TSDoc notes on `builtDesktopServices` and on the owners-scope line in `desktop-runtime.ts` are kept (S7-S11).
  10. **EW7.** The core uses `Deferred`, not `new Promise`. The EW7 waiver line, its directive and its register entry are removed. The register ids become `EW1`-`EW5` and `EW9`.
  11. **Effect gate.** `pnpm check:effect` stays green with no new waiver. Any new `error`-level Effect diagnostic is fixed, never waived.
- **Non-goals:**
  - a protocol cancel command and multi-event replies (C2);
  - moving the IPC edge onto the runtime (P-S7-1 (b));
  - the supervisor's global `Effect.runFork` timers and the stdout drain (s8);
  - the raw-text forwarding of `request.failure` in storage and workspace (unchanged).

### Test Contract: u2b-s7-bridge-core

- **Fixtures** (S7-R18):
  - **Core rows and `harness-bridges.test.ts`:** a fake `HarnessSessionClient` (S7-S5). It:
    - records sends;
    - can throw on send, refuse a send, throw on the n-th `subscribe`, or throw on the unsubscribe of a chosen subscription (a per-subscription selector);
    - emits any event on demand;
    - counts subscriptions.
  - **Project entry:** the new fake session above, for the B1, B3, B5 and B9 entry rows. The existing real-session fixture stays for the B6 pins.
  - **Workspace:** the existing fake gains a throwing send and a throwing unsubscribe.
    - Fix round 1 correction (S7-K1): as built, the workspace fake extends the shared `RecordingHarnessSession` (`harness-session-test-peers.ts`). Its `emit` now delivers to every listener, collects their failures and rethrows the first, mirroring `HarnessSession#deliver`. At `829c3cf` it stopped at the first throwing listener. Every existing workspace row has one session listener, so their assertions are unaffected. The S7-S3 row relies on this fake behaviour for "every listener received it"; the real session's equivalent is pinned in `harness-session.test.ts`.
  - **B4:** the supervisor test's mocked utility process and message channel, with a real `HarnessSession` and a real `createProjectEntryBridge` over `supervisor.getSession()`.
  - **Main test:** mocks `./harness-bridges.js` so that `createHarnessBridges` returns the same port-backed bridges the s6 rows use (`entryStop`, `storageStop`, `workspaceStop`, `entryList`, `entryRegister`, `workspaceQuery`), plus a `release`. This is a fixture-only change (S7-R11).
    - The mock's `release` is a no-op `vi.fn`, so the latched s6 stop ports are never called twice (S7-S4).
  - **Timing:** the two rows named in the Timing fact gain one `await Promise.resolve()` step, as Pedro accepted (R7, §137). This is fixture-only; their order and content assertions are unchanged.
  - **No timeouts as reds:** rows whose red is "leaves pending" assert a `settled` flag after a bounded flush, never a test timeout (S7-R20).
- **Order of work:**
  1. Scaffold, adapting fixtures only:
     - `harness-request-core.ts` exporting `makeHarnessRequestCore` (with today's `requestHarness` semantics) and the fault type with reasons;
     - `harness-bridges.ts` exporting `createHarnessBridges` over the three existing bridges, with a no-op `release` (S7-S7).
     - `makeDesktopRuntime` stays on its three bridge ports until B7 is green (S7-R20). The B7 fakes provide both shapes (the three factory ports and `createHarnessBridges`) during the scaffold, so no red is a "not a function" error (S7-S7).
     - Then observe the B1, B2, B3, B4, B5, B7, B8, B9 and B10 reds.
  2. B1, then B2 and B3 green (core and bridges).
  3. B9 green, with the envelope owners moved; then B5 green, because B5's stop answers come from design point 8 (S7-S8).
  4. B10 green (the shared core and release).
  5. B4 green (the session queue).
  6. B7 green (`HarnessBridges` in the runtime; fixture changes as stated).
  7. B8: EW7, with the register red, then green.
  8. B6 pins throughout.
  9. The review/refactor gate:
     - light gates: the s7 test files, `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code` and `pnpm check:duplicates`;
     - CodeScene on every changed file;
     - heavy runs with the coordinator's GO;
     - the designer's preflight;
     - candidate review round 1, ONE fix round and a confirming round 2;
     - then the scoped mutation.
  10. **Fix round 1** (candidate review round 1, `review-candidate-s7-round1.md`; Pedro, §137: D1 (a) ratified, one fix round for all of S7-K1 to S7-K18):
      - fix commits on top of `2cf479d`, then their evidence, with nothing amended;
      - the fixes S7-K2 to S7-K18, each with its row, pin and binding, or refactor check, as written in design points 1, 5 and 6, the Fixtures, B4, B6, B9, B10 and the Success Criteria; S7-K1 is records only (the correction lines in this brief, plus the evidence corrections in B10);
      - each new row that is a pin is observed passing at the fix candidate, and its binding is observed failing that row and restored by digest; no red is claimed for a pin;
      - every binding, the 10 from the first build and the new ones, is re-run on the fix candidate, with its digest recorded against that candidate's tree;
      - the light gates: the s7 test files, `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code` and `pnpm check:duplicates`;
      - CodeScene `code_health_score` on every source and test file changed in `829c3cf..<fix candidate>`, with the raw tool output saved (not only a transcribed table);
      - heavy runs with the coordinator's GO, each alone under the CPU rule: the FULL desktop e2e (also the #138 rerun), then `package:smoke`;
      - the designer's preflight `829c3cf..<fix candidate>`;
      - **a confirming candidate review round 2**, scoped to the S7-K1 to S7-K18 rows and to regressions in the delta `f3d2c8f..<fix candidate>`: slice-verifier, the code reviewer (K11 to K16 change code design) and the coverage reviewer, on one packet; findings left after it go to Pedro (cap), with no further fix round unasked;
      - then the scoped mutation (`stryker.desktop-s7.config.json`, ranges re-resolved on the final candidate), once.
- **Behavior U2B-BC-B1**: one core settles each request exactly once by id. An unbuildable command, a colliding id, a refused send and a throwing send each settle the request with its fault and free its id.
  - Seam: `makeHarnessRequestCore(session)` with the fake session.
  - Test: `settles each harness request once by id: $name` -> `apps/desktop/src/main/harness-request-core.test.ts`
  - Rows:
    - `reply`: completes with the payload; a second reply for the same id is ignored;
    - `reply during send` (S7-R26): the fake emits the reply synchronously inside `send`, and the request completes with it;
    - `unbuildable command`: fails `desktop` `invalid-command`, and nothing is sent;
    - `colliding id`: fails `desktop` `identity-collision`, and the original still completes with its own reply;
    - `refused send`: fails `send` with the code, and a later request with that id registers and is sent;
    - `throwing send`: fails `send` `HARNESS_SESSION_SEND_FAILED`, and the id is free in the same way;
    - `interrupted` (S7-R17): interrupt the waiting effect; a new request with the same id then registers and is sent (no collision), and it completes with its own reply.
  - Test: `answers its own envelope when send throws` -> `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers its own envelope when send throws` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Bridge rows, over the fake sessions:
    - entry list → `broken` `PROJECT_LIST_TRANSPORT_FAILED`; entry read → `unavailable` `connectionLost`;
    - workspace query → `broken` `WORKSPACE_TRANSPORT_FAILED` "Harness session send failed.".
  - Expected red against the scaffold:
    - `throwing send` rejects and leaves the id registered;
    - `interrupted` leaves the entry, so the second request fails as a collision;
    - the entry and workspace bridge rows reject.
    - The other core rows: none — pin, observed at the scaffold.
- **Behavior U2B-BC-B2**: in every bridge, a null-correlated **result** and `system.failure` fail all pending requests as `protocol` with fixed text. Non-reply events never fail anything.
  - Test: `fails all pending work as protocol on $case` -> `apps/desktop/src/main/project-entry-bridge.test.ts`; `fails all pending work as protocol on $case` -> `apps/desktop/src/main/project-storage-bridge.test.ts`; `fails all pending work on %s` -> `apps/desktop/src/main/workspace-bridge.test.ts`; `ignores non-reply events whatever their correlation: $event` -> `apps/desktop/src/main/harness-request-core.test.ts`
  - Rows for `$case` = `uncorrelated result` and `system failure`:
    - project entry: read → `broken` `protocolMessageInvalid`; save → `uncertain`; list → `broken` `PROJECT_LIST_TRANSPORT_FAILED`;
    - Project Storage: `uncorrelated result` → "Harness returned an uncorrelated Project Storage response." (the existing text, S7-R2); `system failure` → "Harness reported a failure.".
  - Workspace, existing row `fails all pending work on %s`, case `failure`. This is a stated assertion change (D9, P4, P-S7-4; S7-R9):
    - the emitted `system.failure` payload text stays `"Harness failed pending work."`;
    - the expected envelope text becomes `"Harness reported a failure."`;
    - the row adds `not.toContain("Harness failed pending work.")`.
    - The row's tuple is split so that the payload and the expected text differ.
  - Core rows for `$event`:
    - `system.ready` with null correlation;
    - `workspace.projection.invalidated` with null correlation;
    - `system.ready` whose `causationId` equals the pending id (S7-S9).
    - In each, the pending request stays pending (`settled` false after a flush) and then completes with its own reply.
  - Expected red at `829c3cf`:
    - project entry leaves every request pending;
    - workspace answers the raw text.
    - Project Storage: none — pin (its texts are unchanged).
    - Against the scaffold, the core `$event` rows: none — pin.
- **Behavior U2B-BC-B3**: a reply payload that cannot be decoded never escapes the listener. It settles its request as `protocol` `undecodable`, and other requests are unaffected.
  - Test: `settles an undecodable reply as protocol` -> `apps/desktop/src/main/project-storage-bridge.test.ts`; `settles an undecodable reply as protocol` -> `apps/desktop/src/main/workspace-bridge.test.ts`; `settles an undecodable reply as protocol: $operation` -> `apps/desktop/src/main/project-entry-bridge.test.ts`
  - Oracle:
    - the emit does not throw;
    - the request settles with the bridge's envelope: storage "Harness returned an invalid Project Storage response.", workspace "Harness returned an invalid workspace response.", entry read → `broken` `protocolMessageInvalid`, entry save → `uncertain` (P-S7-3), entry list → `broken` `PROJECT_LIST_TRANSPORT_FAILED`;
    - a second pending request still settles with its own reply.
  - Expected red at `829c3cf`:
    - storage and workspace throw out of `emit`, and the request never settles (the `settled` flag stays false);
    - entry save answers `broken`.
    - Entry read and list: none — pin (S7-R25).
- **Behavior U2B-BC-B4**: with the real supervisor and session, a read pending during a protocol error or a `system.failure` answers `broken` `protocolMessageInvalid`. A nested emit is delivered only after the outer event has reached every listener, also when a listener throws.
  - Test: `answers broken for a read during $failure` -> `apps/desktop/src/main/harness-supervisor.test.ts`; `delivers a nested emit after the outer event reached every listener` -> `apps/desktop/src/main/harness-session.test.ts`; `drains queued emits before rethrowing a listener failure` -> `apps/desktop/src/main/harness-session.test.ts`
  - Rows (supervisor, S7-R13): `$failure` = `a protocol error` and `a system failure`. Each read result is `{ status: "broken", request, diagnostic: protocolMessageInvalid }`.
  - Rows (session):
    - with two listeners, the second receives `protocol-error` before `disconnected`;
    - listener 1 detaches and then throws on `protocol-error`; both listeners receive `[protocol-error, disconnected]`, and the emit throws listener 1's error after the drain;
    - right after the throwing row's emit, on the same session, a later emit is delivered at once, which proves the flag reset. Expected red: none — pin at `829c3cf`, because there is no flag. Binding: resetting the flag outside a `finally` makes this row fail (S7-S11).
  - Expected red at `829c3cf`:
    - both reads answer `unavailable` `connectionLost`;
    - the second listener receives `disconnected` first;
    - in the throwing row, listener 2 receives `disconnected` before `protocol-error`.
  - Pins, unchanged (S7-R12):
    - `keeps request failure status-neutral and reserves recovery for system failure`;
    - `queues a protocol-failed child retry until confirmed exit`;
    - `blocks automatic recovery for malformed and explicit protocol failures` (`harness-supervisor.test.ts`).
  - Test: `keeps request failure status-neutral and reserves recovery for system failure` and `queues a protocol-failed child retry until confirmed exit` and `blocks automatic recovery for malformed and explicit protocol failures` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Fix round 1 (S7-K3, degrade-distinguishes-broken): several listener failures are thrown together.
    - Test: `throws every listener failure at once after the drain` -> `apps/desktop/src/main/harness-session.test.ts`
    - Row, on a real `HarnessSession` with an attached fake port: listener 1 detaches and then throws error A on `protocol-error`; listener 2 throws error B on `disconnected`. The emit throws one `AggregateError` whose message is "Harness session subscribers failed." and whose `errors` equal `[A, B]`, in that order; both listeners received `[protocol-error, disconnected]`.
    - Expected red: none — pin at the fix candidate (the branch exists at `f3d2c8f`, but no row ran it). Binding: replacing the `failures.length > 1` branch with `throw failures[0]` makes this row fail.
  - Fix round 1 (S7-K9): the queue is first-in, first-out.
    - Test: `delivers queued emits in the order they were queued` -> `apps/desktop/src/main/harness-session.test.ts`
    - Row, through the public seam: on `protocol-error`, listener 1 calls `session.attach(port2)`. The attach detaches the old port (queuing `disconnected`), and the fake `port2.start()` synchronously delivers one valid harness message (queuing a `message` event). Listener 2 receives `[protocol-error, disconnected, message]` in that order.
    - Expected red: none — pin. Binding: taking queued events from the end (`pop` instead of `shift`) makes this row fail.
- **Behavior U2B-BC-B5**: a standalone bridge's `stop` settles every pending request, even when unsubscribe throws, in one exact form.
  - Test: `settles pending work even when session unsubscribe throws` -> `apps/desktop/src/main/project-entry-bridge.test.ts`; `settles pending work even when session unsubscribe throws` -> `apps/desktop/src/main/workspace-bridge.test.ts`; `settles pending operations even when session unsubscribe throws` -> `apps/desktop/src/main/project-storage-bridge.test.ts`
  - Oracle, in the storage pin's form (S7-R19). The fake's unsubscribe throws.
    - `stop()` throws the unsubscribe error;
    - by then every pending request has settled with the bridge's stop answer (design point 8);
    - a second `stop()` does not throw;
    - unsubscribe was called once.
  - Expected red at `829c3cf`: entry and workspace leave the requests pending, and the `settled` flag stays false. Storage: none — pin.
- **Behavior U2B-BC-B6**: every existing bridge surface keeps its envelope, except the stated changes.
  - Test: `returns a real list response and does not confuse disconnect with an empty installation` and `rejects activation replies for a different Project even with a matching message correlation` and `keeps list and registration transport results unchanged on request.failure` and `maps a send refused as an invalid message to broken for both operations` -> `apps/desktop/src/main/project-entry-bridge.test.ts`; `request failure settles only its correlated Project Storage operation` and `correlates out-of-order open, create, and close results` and `maps a thrown send failure and releases the request identity` and `rejects mismatched, uncorrelated, disconnected, and stopped requests` and `rejects invalid local metadata and identity collision without losing the original` -> `apps/desktop/src/main/project-storage-bridge.test.ts`; `request failure settles only its correlated Workspace request` and `correlates out-of-order workspace responses` and `releases request identities after failure and settlement` and `rejects a colliding intent without replacing the original` and `rejects stale ready query projections` and `keeps a connected pending request until response or lifecycle failure` and `publishes only increasing projection revisions per scope` and `ignores system readiness while a workspace request is pending` and `rejects invalid response correlation` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: every assertion of every existing row in the three bridge files is unchanged, except these, each stated:
    - (a) workspace `fails all pending work on %s`, case `failure`: the B2 change above;
    - (b) the same row, case `stop` (B9; S7-R6): the expected result becomes `unavailable`, `WORKSPACE_CAPABILITY_UNAVAILABLE`, with the s6 closing text, for both the queries and the intent;
    - (c) `request failure settles only its correlated Project Storage operation` and `request failure settles only its correlated Workspace request`: one extra flush step each (R7), with their assertions unchanged.
  - Expected red: none — pin, for the unchanged rows. (a) and (b) are red at `829c3cf`.
- **Behavior U2B-BC-B7**: one `HarnessBridges` service in the runtime. The s6 runtime and main contracts keep their behaviour, with the assertion changes stated.
  - Seam: `makeDesktopRuntime(ports)`, with `createHarnessBridges` faked; `main.ts` through the main test.
  - Test: `releases every owner on dispose: $name` -> `apps/desktop/src/main/desktop-runtime.test.ts`; `passes the bridges their session, id and clock` -> `apps/desktop/src/main/desktop-runtime.test.ts`
  - Oracle:
    - `createHarnessBridges` is called once with `{ session, createId: ports.createId, now: ports.now }`.
    - The s6 rows `built, never stopped`, `program then dispose`, `supervisor stop rejects, …`, `a release throws`, `never built` and `stop twice` keep their assertions unchanged, including s6's sorted bridge comparison (S7-S2). Their bridge stops are read from the faked service's three latched stops. The faked `release` calls each stop that has not run yet.
    - New assertion (S7-S4): the faked `release` is called exactly once in `built, never stopped` and in `program then dispose`.
    - The exact release order is proven in B10, over the real `createHarnessBridges`, and not here.
    - **Stated assertion changes (S7-R5):**
      - `build fails after the logger` now asserts that `createHarnessBridges` was not called, instead of the three factories.
      - `build fails after the supervisor` becomes: `createHarnessBridges` throws, the read fails with that error, `dispose()` resolves, only the supervisor stops, and no port is called twice.
      - The s6 K3 row `passes each bridge its session, id and clock` is replaced by the row above.
    - The s6 main rows (B1-B5, the L4 order, B3 handlers) keep their assertions through the fixture change (S7-R11).
  - Expected red against the scaffold (still three ports):
    - the single-factory row fails, because `createHarnessBridges` is not called;
    - `build fails after the supervisor` fails, because the throwing `createHarnessBridges` is never called;
    - `release` called once fails, because the runtime never calls it.
    - `build fails after the logger`: none — pin at the scaffold (S7-S7).
- **Behavior U2B-BC-B8**: EW7 is gone, and the register lists exactly the remaining waivers.
  - Test: `keeps exactly the registered waivers` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`; `passes on the repository` -> `apps/harness/scripts/check-effect-diagnostics.test.mjs`
  - Oracle:
    - the register ids equal `["EW1", "EW2", "EW3", "EW4", "EW5", "EW9"]`; this is a stated change to the s6 row's expected list;
    - `pnpm check:effect` passes.
  - Expected red:
    - the register row fails at `829c3cf` (7 ids);
    - after the core drops `new Promise` and its two comment lines, with the entry still registered, `pnpm check:effect` fails with `EFFECT_GATE_WAIVER_STALE` naming EW7.
- **Behavior U2B-BC-B9**: a request in flight when its bridge stops answers the D11 envelope for list, registration and workspace. Every other operation keeps its answer.
  - Test: `answers the closing envelope for work in flight at stop: $operation` -> `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers the closing envelope for work in flight at stop: $operation` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Rows, as in design point 8:
    - list and registration: their D11 envelopes;
    - workspace query and intent: the closing envelope;
    - read and upgrade: `unavailable` `connectionLost`;
    - activate and switch: their coordinator-unavailable results;
    - save: `uncertain`.
  - The IPC rows keep their envelopes, which are now imported from the bridge modules. Both gated sets are pins (S7-S11): `answers unavailable after the IPC gate closes: $channel` (`project-entry-ipc.test.ts`) and `answers registration unavailable after the IPC gate closes: $channel` (`project-registration-ipc.test.ts`).
  - Test: `answers unavailable after the IPC gate closes: $channel` -> `apps/desktop/src/main/project-entry-ipc.test.ts`; `answers registration unavailable after the IPC gate closes: $channel` -> `apps/desktop/src/main/project-registration-ipc.test.ts`
  - Expected red at `829c3cf`: list, registration and workspace answer `broken` `…_TRANSPORT_FAILED`. Read, upgrade, activate, switch and save: none — pin.
  - Fix round 1 (S7-K17): exact envelopes instead of partial matches. These are stated assertion strengthenings; each row stays a pin.
    - Workspace `answers the closing envelope for work in flight at stop: $operation`: `toEqual` with `workspaceQueryClosing(<the row's query>)` for the query and `workspaceIntentClosing("memory")` for the intent, instead of `toMatchObject(s7Closing)`.
    - The same change in the workspace B5 row `settles pending work even when session unsubscribe throws` and in B6 (b), the `stop` case of `fails all pending work on %s`, wherever they match `s7Closing`.
    - Project Storage `fails all pending work as protocol on $case` (B2): `toEqual` with the exact broken result built from each pending request (open and close), including the echoed `request`, instead of `toMatchObject({ status, diagnostic })`.
    - Binding: none new; a wrong echo would now fail these rows, which the review asked for.
- **Behavior U2B-BC-B10**: the shared core's own behaviour (S7-R4). A shared stop settles only its own bridge's work, the session gets one subscription, and the release settles everything before an unsubscribe failure surfaces.
  - Seam: the real `createHarnessBridges` over the fake session.
  - Test: `shares one core across the three bridges: $name` -> `apps/desktop/src/main/harness-bridges.test.ts`
  - Rows:
    - `one subscription` (S7-S1 (a)): building the bridges subscribes the session exactly once.
    - `stop scoped to its bridge`: a project-entry **read** and a workspace query are pending. Stopping project entry settles only the read, with `unavailable` `connectionLost`. The workspace query is still sent and completes with its reply. After the stop, a project-entry request answers `unsent` and nothing is sent.
    - `release answers and order` (S7-S2): a project-entry list, a Project Storage open and a workspace query are pending. `release()` settles each with its exact stop answer from design point 8: list → `{ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" }`; storage → `broken` "Project Storage bridge is stopped."; query → the workspace closing envelope. The order of the stops is Project Storage, workspace, project entry. Then the core is unsubscribed.
    - `a throwing shared stop` (S7-S2): the workspace stop throws inside `release()`. The entry and storage requests still get their exact stop answers, the core is still unsubscribed, and `release()` throws the workspace error.
    - `release settles before unsubscribe fails`: the fake throws only on the core's unsubscribe. `release()` gives each request its exact stop answer (as in `release answers and order`), then throws the unsubscribe error.
    - `partial construction` (S7-S5): the fake throws on the subscribe that the workspace constructor triggers, so the workspace observer cannot be added. `createHarnessBridges` throws that error, and the session ends with 0 subscriptions.
    - `cross-bridge uncorrelated result` (S7-S9): a Project Storage open is pending. A null-correlated `workspace.query.result` fails it with "Harness returned an uncorrelated Project Storage response.".
    - `notifications after stop` (S7-R27): after workspace `stop()`, a projection notification reaches no listener.
  - Test: `throws an undecodable notification after every listener received it` -> `apps/desktop/src/main/workspace-bridge.test.ts`
    - (S7-S3) A standalone workspace bridge with one pending query sits on the fake session, which has a second listener. An undecodable `workspace.projection.invalidated` reaches both listeners, then `emit` throws the decode error. The pending query is unaffected and still completes with its reply. Expected red: none — pin, because today's decode throws in the same way.
  - Expected red against the scaffold:
    - `one subscription`: 3 subscriptions, expected 1;
    - `release answers and order`, `a throwing shared stop` and `release settles before unsubscribe fails`: the scaffold's `release` is a no-op, so the requests stay pending (the `settled` flag is false) and nothing throws;
    - `partial construction`: the subscriptions already made stay behind;
    - `cross-bridge uncorrelated result`: the standalone Project Storage bridge ignores the workspace result, so the open stays pending.
    - `stop scoped to its bridge` and `notifications after stop`: none — pin (S7-S6).
  - Fix round 1 correction (S7-K1; D1 option (a), ratified by Pedro, §137): the `partial construction` row above and its Expected red are superseded as written. As built (`harness-bridges.test.ts:165-176` at `f3d2c8f`), the fault is injected on the core's own subscribe, the first subscribe in `createHarnessBridges`. `createHarnessBridges` throws that error, the session ends with 0 subscriptions, and no bridge is built. It is a pin at the scaffold, not a red, and it cannot catch a wrong cleanup; that cleanup is withdrawn (design point 6 correction).
  - Fix round 1 (S7-K1, evidence corrections, by the implementer, appended to `2026-10-19_123-s7-tdd-evidence.md` without rewriting it):
    - the "storage echo" attempt was an implementation attempt on the way to green, caught by the unchanged B6 pin `correlates against the validated command payload instead of caller mutation`, not a fixture fault;
    - the B8 register red log `b8-register-red.log` ran at tree `2bdad823` (scaffold attempt 1), not `a6d50f87`; the register file is the same in both trees, and the evidence shows it.
  - Fix round 1 (S7-K2, S7-K4, S7-K5, S7-K6, S7-K7, S7-K8, S7-K10): new `$name` rows and stated strengthenings in `shares one core across the three bridges: $name` (`harness-bridges.test.ts`), over the real `createHarnessBridges` and the fake session. Each is a pin at the fix candidate, proven by its binding (restored by digest):
    - **S7-K2**, `a throwing shared stop` (stated strengthening): after the flush, the pending workspace query, which the throwing workspace stop did not settle, has the exact `broken` `WORKSPACE_TRANSPORT_FAILED` envelope with its query echo and the text "Harness session disconnected.". Binding: removing `core.failAll({ kind: "transport" })` from `release()`'s `finally` makes it fail (the query stays pending: `settled` false).
    - **S7-K5**, `stop scoped to its bridge` (stated strengthening): after `projectEntry.stop()`, a new workspace query and a new Project Storage open are started. Each is sent (the fake records both sends) and completes with its own reply. Binding: one request gate (a "stopped" flag that answers `unsent`) shared by the three shared bridges, with the per-bridge stop latches kept, makes it fail.
    - **S7-K4**, `notifications after stop` (stated strengthening): after the workspace `stop()`, an undecodable `workspace.projection.invalidated` is emitted, and `emit` does not throw (besides no listener being called). Binding: removing the workspace stop's `removeObserver()` makes it fail.
    - **S7-K6**, new row `release with two failures`: the workspace stop throws error W and the core's unsubscribe throws error U. `release()` throws W (the first), and the list, open and query requests each have their exact answer (entry and storage: their stop answers; the query: the `transport` envelope as in S7-K2). Binding: raising the last failure instead of the first makes it fail.
    - **S7-K7**, new row `release twice`: a second `release()` returns without throwing, calls no bridge stop again, and the core's unsubscribe was called exactly once. Binding: removing the `released` guard makes it fail (unsubscribe called twice).
    - **S7-K8**, new row `release after the program` (S7-S4 over the real factory): Project Storage, workspace and project entry are stopped first, in the s6 order; then `release()` does not throw, no request's answer changes, and the session has 0 subscriptions. Binding: none new; it pins the production order the s6 program uses.
    - **S7-K10**, new rows `cross-bridge correlated reply` (design point 3, stated widening, S7-S9): (i) a Project Storage open is pending, and a `workspace.query.result` whose `causationId` is the open's id fails it with "Harness returned a mismatched Project Storage response."; (ii) a workspace query is pending, and a Project Storage result event correlated to its id fails it with the `broken` `WORKSPACE_TRANSPORT_FAILED` envelope and "Harness returned a mismatched workspace response.". In both, the other pending requests are unaffected. At `829c3cf` each standalone bridge ignored such a reply and the request stayed pending (the stated widening); that base behaviour is not re-observed. Binding: a core that skips (leaves pending) a correlated reply whose event differs from the expected one makes both rows fail.
  - Fix round 1 (S7-K18), `throws an undecodable notification after every listener received it` (stated strengthening): `toThrow` matches the decode failure that `decodeStrict` raises (its class or its schema message, as the protocol source names it, recorded in the evidence), not any error. The row's TSDoc or comment states that delivery to every listener is the fake's behaviour (Fixtures correction) and that the real session's is pinned in `harness-session.test.ts`. Binding: none new.
- **TDD-exempt:**
  - The Promise-facade record (TSDoc on the facade, plus the C2 line already in Deferred Work) and the s7 mutation configuration files. They are documentation and gate configuration, and the scoped run checks them.

### Success Criteria: u2b-s7-bridge-core

**Automated:**
- The smallest Vitest commands, red then green per behaviour: `pnpm exec vitest run --project desktop-main` with the s7 test files, plus the harness project for `check-effect-diagnostics.test.mjs`.
- On the final candidate:
  - `pnpm check:effect` (B8 red then green, with no new waiver);
  - `pnpm check`, `pnpm typecheck`, `pnpm check:dead-code` and `pnpm check:duplicates`.
- CodeScene `code_health_score` on every changed source and test file, with the tool output saved.
- Bindings, each restored by digest:
  - B1: an unguarded send makes `throwing send` fail;
  - B2: a null-correlation rule for all events makes the core `$event` rows fail;
  - B3: an unguarded decode makes the storage row fail;
  - B4: immediate nested delivery makes the session rows fail;
  - B5: unsubscribing before settling makes the workspace row fail;
  - B7: a dispose that does not call `release()` makes the release-called-once assertion fail;
  - B10: skipping one bridge stop in the real `release()` makes `release answers and order` fail (S7-S2);
  - B10: a `release()` that stops at the first throw makes `a throwing shared stop` fail;
  - B10: a stop that settles every bridge's entries makes `stop scoped to its bridge` fail.
  - Fix round 1 (S7-K2 to S7-K10): the new bindings named in B4 and B10 (no `failAll` in the release `finally`; `throw failures[0]` for several failures; no `removeObserver()`; a shared request gate; the last failure raised; no `released` guard; `pop` instead of `shift`; a core that skips a mismatched correlated reply), each run on the fix candidate and restored by digest, together with the ten above.
- Fix round 1 (S7-K12): the default mutation configuration `stryker.config.json` (`pnpm test:mutation`) is cleaned up in the fix round, as gate configuration (TDD-exempt, like the s7 mutation files):
  - drop `apps/desktop/src/main/harness-pending-request.ts`, which s7 deleted;
  - add `apps/desktop/src/main/harness-request-core.ts` and `apps/desktop/src/main/harness-bridges.ts` (whole files), the code that replaced it;
  - re-anchor the three `project-entry-bridge.ts` ranges (`:44-44`, `:82-82`, `:191-204`): the implementer resolves, by content at `829c3cf`, what each range covered, and gives the ranges that cover the same code at the fix candidate; the old-to-new mapping is recorded in the evidence. A range whose code no longer exists is removed, and the evidence says why.
  - Check: the file parses as JSON and every listed path exists, and every range falls inside its file, at the fix candidate (a short script's output saved in the evidence). The default mutation run itself is not part of this slice.
- Heavy runs, each with the coordinator's GO:
  - the desktop e2e journeys, which reach every bridge;
  - `package:smoke`, which covers Project Storage and registration.
- **Scoped mutation** on the final candidate (rigorous lane, D13), with the coordinator's GO:
  - config `stryker.desktop-s7.config.json`;
  - `mutate` (S7-R24): `harness-request-core.ts` and `harness-bridges.ts` (whole files); the fault mapping and event handling in the three bridges; the fault arms in `project-upgrade-failure.ts` and `project-conversation-failure.ts`; `harness-session.ts` `#emit` and its queue; the `HarnessBridges` layer in `desktop-runtime.ts`;
  - include: the s7 test files, including `project-registration-ipc.test.ts`;
  - command: `pnpm exec stryker run stryker.desktop-s7.config.json`;
  - pass rule: every counted mutant is killed, and a `Timeout` counts as killed. Survivors go to Pedro's triage; nothing is declared in advance.
- The slice preflight on the committed candidate, saved by the designer.

**Manual:**
- On Windows, outside the agent, once, in a development build: open a Project, read and save a conversation message, list Projects and query a workspace capability. Each answers as before the slice, and the main log shows no new error.

### Slice u2b-s8-stdout-drain (detailed 2026-10-22)

- **slice_id:** `u2b-s8-stdout-drain`
- **Lane:** normal (proposed; Pedro decides, Q1). D15 planned normal. `lane.mjs --paths` over the planned files answers `fast` ("within fast limits"), and a slice never runs below its feature lane (`normal`). So: no intent review, slice-verifier at candidate review, full deep-review, and Pedro's acceptance of the combined Part A result.
- **Parent:** s7, accepted by Pedro at code `03a50c8`, evidence up to `347c0fd`, brief `9f11fb36…` (decisions log §138), on `refactor/123-effect-lifecycle-part-a`.
- **Behaviour IDs:** U2B-SD-B1 … U2B-SD-B4. They replace the outline in Deferred Work (its line numbers predate s6 and s7; re-checked below against `347c0fd`).
- **Source of scope:** Intent item 8; Architecture "Slice 8, #96"; D12 (§104 P2: 1 000 ms after `exit`, worst-case quit 10 s → 11 s); issue #96 (acceptance: on quit the supervisor waits a bounded time for stdout to end; a supervisor test shows a line written just before exit reaches the log).
- **Affected source:** `apps/desktop/src/main/harness-supervisor.ts` (`#stopChild`, `#watchOutput`); `stryker.desktop-s8.config.json` and `apps/desktop/vitest.desktop-s8-mutation.config.ts` (new); a `knip.jsonc` entry for the new Vitest config, as for s6 and s7.
- **Affected tests:** `apps/desktop/src/main/harness-supervisor.test.ts`.
- **Deliverable:** on quit, `HarnessSupervisor.stop()` resolves only after the stopped child's stdout ends (or closes), or 1 000 ms after its `exit`, whichever comes first. On the bound, the upgrade-line forwarder is removed. Nothing else in the stop changes.
- **Measured facts (2026-10-22, at `347c0fd`; read, not run):**
  - `#stopChild` (`harness-supervisor.ts:154-205`) awaits `exit` with `harnessShutdownGraceMs` = 5 000 (:34), kills, awaits one more grace, and otherwise fails `HarnessShutdownTimeout` after removing the observation (:169-181). On `exit` it sets `stopped` and clears `#stopping` (:197-202). So `stop()` resolves at `exit`: the #96 gap.
  - `#observeChild`'s `exit` handler calls the observation's `drain()` (:360-364). `drain()` forgets the observation (removes it from `#observations`) and ends the forwarder only when there is no stdout (:391-394). With stdout, the forwarder stays on `data` until stdout `end` or `close` (:381-384, :400), with no bound.
  - `stop()` is memoized through `#stopPromise` (:119-136). `start()` returns while `#stopping` is set (:113). `desktop-runtime.ts:159` releases the supervisor with `supervisor.stop()`, and the shutdown program stops the harness before the runtime dispose (`desktop-shutdown.ts:60-78`), so the memoized promise is awaited once by the program and returned again by the release.
  - Tests that await a stop after `exit` without emitting stdout `end` (the test `FakeChild` has stdout by default, `harness-supervisor.test.ts:71-74`): `detaches once and stops cleanly after natural child exit` (:605-606), `kills after grace and rejects after the terminal exit deadline` (the replacement stop, :680-682), `does not connect a child that spawns after shutdown starts` (:690-697, real timers), `does not retry a protocol-failed child while shutdown is active` (:711-721, real timers), `cancels pending handshake and restart timers when stopped` (:841-857). The implementer re-derives this list from the scaffold run.
  - The upgrade-line forwarding rows (`forwards upgrade lines written during shutdown until stdout ends`, :1046; `forwards an upgrade line that arrives after exit until stdout ends`, :1073; `stops forwarding when a stopping child never exits`, :1096) already pin the forwarder; they do not await the stop's timing.
- **Design points:**
  1. **One drain signal per child.** `#watchOutput` exposes, with the observation, a signal that completes when the forwarder finishes (stdout `end` or `close`, or no stdout). `#stopChild` keeps a handle to it before `exit` (the `exit` handler forgets the observation).
  2. **Bounded wait after exit.** After the `exited` wait succeeds (either grace), the stop awaits the drain signal with a timeout of `harnessStdoutDrainMs` = 1 000 (a module constant beside `harnessShutdownGraceMs`). On the timeout it removes the forwarder for that child (the existing `finish`), then completes. It never fails because of the bound: a missed drain is not a shutdown failure (only log lines can be lost, #96).
  3. **State during the drain.** `stopped` is set and `#stopping` is cleared only when the drain ends (stdout ended or the bound), so `start()` during the drain spawns nothing.
  4. **Unchanged.** The grace, kill and terminal timeout; the timeout path (no `exit`) still removes the observation and rejects at 10 000 ms with no drain wait; the late-exit handling; the quiet/remove logging; crash-exit forwarding outside a stop (Q2).
  5. **Effect.** The wait is part of the existing `graceful` Effect (`Deferred` plus `Effect.timeoutOrElse`), run by the existing `Effect.runPromise` facade. No new `new Promise`, no new waiver; `pnpm check:effect` stays green.
- **Non-goals:** the supervisor's `#after` `Effect.runFork` timers (Q4); a bound on the forwarder after a crash exit with no stop (Q2); an e2e for #96 (Q3); the dev-mode blank window (#137).

### Test Contract: u2b-s8-stdout-drain

- **Fixtures:** the supervisor test's `FakeChild` (stdout and stderr `EventEmitter`s, `new FakeChild(false)` for none), its mocked utility process and logger, and `vi.useFakeTimers()` as the file already uses for the grace rows. Rows observe the stop through a `settled` flag after `await vi.advanceTimersByTimeAsync(n)`, never through a test timeout. The upgrade line is the file's existing upgrade-line fixture, and its log entry is asserted exactly as in `forwards an upgrade line that arrives after exit until stdout ends`.
- **Existing rows that await a stop after `exit`** (the measured list): each gains one fixture step, the child's stdout `end` right after its `exit` (fake or real timers alike). This is fixture-only; their assertions are unchanged, stated per row in the evidence.
- **Order of work:** scaffold the constant and the drain signal with today's behaviour (the stop still resolves at `exit`); observe the B1, B2 and B4 reds; make B1, B2 and B4 green; B3 pins throughout; then the review/refactor gate: light gates, CodeScene, bindings, heavy runs with the coordinator's GO, the designer's preflight, candidate review by the lane, and the scoped mutation once after the last review round's fixes.
- **Behavior U2B-SD-B1**: on quit, the stop waits after `exit` for stdout to end, and a line written in that window reaches the log.
  - Seam: `HarnessSupervisor` `start` / `stop` with `FakeChild`.
  - Test: `waits after exit until stdout $event before the stop resolves` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Rows `$event` = `end`, `close`. A started, ready child; `stop()`; `exit 0`; `advanceTimersByTimeAsync(500)`. Then:
    - the stop is not settled; `getStatus()` is not yet `{ state: "stopped" }`; `start()` does not call `fork` again;
    - an upgrade line emitted on stdout is logged exactly once, as the existing upgrade-line row asserts;
    - stdout emits `$event`: the stop resolves (no rejection), the status is `{ state: "stopped" }`, and stdout has 0 `data` listeners.
  - Expected red at `347c0fd`: the stop is already settled at 500 ms (it resolves at `exit`).
- **Behavior U2B-SD-B2**: with no stdout end, the stop resolves exactly 1 000 ms after `exit`, and forwarding stops there.
  - Test: `resolves the stop at the drain bound when stdout never ends` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: `stop()`; `exit 0`; after 999 ms the stop is not settled and stdout has 1 `data` listener; after 1 more ms the stop resolves (no rejection), status `{ state: "stopped" }`, stdout has 0 `data` listeners, and an upgrade line emitted afterwards is not logged.
  - Expected red at `347c0fd`: settled at 999 ms; after 1 000 ms stdout still has 1 `data` listener.
- **Behavior U2B-SD-B3**: when there is nothing to drain, the stop resolves at `exit`.
  - Test: `resolves at exit when stdout is $case` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Rows `$case` = `absent` (`new FakeChild(false)`), `already ended` (stdout `end` before `exit`), `already closed` (stdout `close` before `exit`): after `exit` and `advanceTimersByTimeAsync(0)`, the stop has resolved and the status is `{ state: "stopped" }`.
  - Expected red: none — pin.
- **Behavior U2B-SD-B4**: the drain adds at most 1 000 ms to the worst case and never turns a timeout into a success.
  - Test: `bounds the worst-case quit at the kill grace plus the drain` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: `stop()`; no `exit` for 5 000 ms → `kill` once; `exit 0` at 9 999 ms; the stop is not settled at 10 998 ms and resolves at 10 999 ms (no stdout `end`).
  - Expected red at `347c0fd`: settled at 9 999 ms.
  - Pins, unchanged: `kills after grace and rejects after the terminal exit deadline` (the timeout path rejects at 10 000 ms with no drain wait; only its replacement-stop fixture step changes), `stops forwarding when a stopping child never exits`, `forwards upgrade lines written during shutdown until stdout ends`, `forwards an upgrade line that arrives after exit until stdout ends`, `removes child process observers on stop, the forwarder once stdout ends`, and `detaches once and stops cleanly after natural child exit` (fixture step only).
  - Test: `kills after grace and rejects after the terminal exit deadline` and `stops forwarding when a stopping child never exits` and `forwards upgrade lines written during shutdown until stdout ends` and `forwards an upgrade line that arrives after exit until stdout ends` and `removes child process observers on stop, the forwarder once stdout ends` and `detaches once and stops cleanly after natural child exit` -> `apps/desktop/src/main/harness-supervisor.test.ts`
- **TDD-exempt:** the s8 mutation configuration files and the `knip.jsonc` entry — gate configuration, checked by the scoped run and `pnpm check:dead-code`.

### Success Criteria: u2b-s8-stdout-drain

**Automated:**
- Red then green per behaviour: `pnpm exec vitest run --project desktop-main apps/desktop/src/main/harness-supervisor.test.ts [-t <name>]`.
- Bindings, each restored by digest:
  - B1: the stop completing right after `exit` (the drain wait skipped) makes the B1 rows fail;
  - B2: a bound of 999 makes the B2 row fail (settled at 999 ms); a bound of 1 001 makes it fail (not settled at 1 000 ms);
  - B2: not removing the forwarder at the bound makes the B2 row fail (1 `data` listener);
  - B1: setting `stopped` and clearing `#stopping` at `exit` instead of after the drain makes the B1 row fail (status, or a second `fork`).
- On the final candidate: the s8 test file, `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code`, `pnpm check:duplicates`; CodeScene `code_health_score` on every changed file with the raw tool output saved; the designer's preflight.
- Heavy runs, each with the coordinator's GO and the CPU rule: the full desktop e2e (every journey quits the app; also a #138 data point) and `package:smoke` (it starts and stops the packaged harness).
- **Scoped mutation** on the final candidate, once, with the coordinator's GO: config `stryker.desktop-s8.config.json`; `mutate` = `harness-supervisor.ts` `#stopChild` and `#watchOutput` (ranges resolved on the final candidate); include `harness-supervisor.test.ts`; pass rule as in s7 (every counted mutant killed, a `Timeout` counts as killed; survivors to Pedro's triage).

**Manual:**
- On Windows, outside the agent, once, on the **packaged** build (`pnpm dev` renders a blank window, #137): open a Project, then quit. The app closes without a visible extra delay; reopen it and the Project and its conversation are intact; the main log of that run shows the harness shutdown with no new error.

### Slice u2b-s9-harness-fatal-diagnostics (detailed 2026-10-22)

- **slice_id:** `u2b-s9-harness-fatal-diagnostics`
- **Lane:** normal (coordinator, from Pedro's §140 decision). `lane.mjs --paths` over the planned source files answers `normal` ("files: 6 > 5"), equal to the feature lane. So: linked worktree (`slopstop-123`), no intent review, slice-verifier at candidate review, full deep-review, and Pedro's acceptance of the combined Part A result.
- **Parent:** the Part A candidate under deep review, `d7a0e22` on `refactor/123-effect-lifecycle-part-a` (review `.rpiv/artifacts/reviews/2026-10-22_19-44-49_fdda65e-d7a0e22-123-part-a.md`, base `fdda65e`). s8 is gate-passed there.
- **Behaviour IDs:** U2B-FD-B1 … U2B-FD-B3.
- **Source of scope:** deep-review finding I1, option (a), with Q24 and Q27 folded in; Q25 option (b) except the cheap ordering pin; Q33 option (b). Pedro's decisions, decisions log §140. Standing decision `degrade-distinguishes-broken`: a broken stop or start already exits 1 with a fatal code; s9 keeps the distinct diagnostic the earlier slices built.
- **Affected source:**
  - `apps/harness/src/process-fatal-diagnostics.ts`: the redacted failure summary (exported) and the shared fatal sink type.
  - `apps/harness/src/process-shutdown.ts`: the port-close handler reports through the sink with the summary.
  - `apps/harness/src/process-connection.ts` (new): the startup exit paths, extracted from `process-entry.ts` `connect`.
  - `apps/harness/src/process-bootstrap.ts`: `startHarnessProcessRuntime` is split into a synchronous bootstrap check and the launch; `startHarnessProcessRuntime` stays as their composition, so its integration callers do not change.
  - `apps/harness/src/registration/registration-listing.ts`: exports its cleanup-part names as one constant list (the summary's only allowed part values; `shared-vocab-union`, one owner).
  - `apps/harness/src/process-entry.ts`: wiring only, to the functions above.
  - Mutation scope: `stryker.project-storage.config.json` and `apps/harness/vitest.project-storage-mutation.config.ts` (s5 precedent).
- **Affected tests:** `apps/harness/src/process-fatal-diagnostics.test.ts`, `apps/harness/src/process-shutdown.test.ts`, `apps/harness/src/process-connection.test.ts` (new).
- **Deliverable:** both harness fatal sinks log, beside their code, a redacted summary of the failure value. A runtime start or dispose failure at startup has its own fatal code, `HARNESS_RUNTIME_START_FAILED`, distinct from `HARNESS_START_FAILED` (invalid bootstrap message, kept). The startup and shutdown exit paths are small exported functions tested through a fake sink.
- **Measured facts (2026-10-22, at `d7a0e22`; read, not run):**
  - `process-shutdown.ts:15-20`: a rejected or thrown `stopRuntime` calls `failed("Harness shutdown failed.")` without the value; `process-entry.ts:37-40` logs `{ code: "HARNESS_SHUTDOWN_FAILED" }` and exits 1.
  - `process-entry.ts:74-84`: `connect` awaits `startHarnessProcessRuntime`; its `catch` drops the value and calls `failStartup("Harness received an invalid bootstrap message.")` (`{ code: "HARNESS_START_FAILED" }`, exit 1) for every failure: decode, root checks, layer build, start and dispose alike (Q24).
  - `process-bootstrap.ts:178-186` throws, before any runtime exists, for an invalid bootstrap (strict decode, `trustedRoot`, overlapping roots). `launchOnProcessRuntime` (:127-168) rejects with the start failure alone, or `AggregateError("Harness startup failed.", [start, ...dispose])`, only after its bounded dispose settled (pinned by `reports a startup failure after a bounded dispose: $name`, `process-bootstrap.test.ts:355`).
  - The shutdown value can nest: `AggregateError("Harness process shutdown failed.", [program, dispose])` (:99-101, :146), where the program failure can itself be `AggregateError("Harness runtime shutdown failed.", …)` (`harness-runtime.ts:77-81`) holding `RegistrationCleanupUnconfirmed` (`registration-listing.ts:19-23`, `parts` ⊆ `registry`, `observer`, `listing`, optional `cause`), `ApplicationDatabaseCloseUnconfirmed` (`application-database-authority.ts:55`), `HarnessRuntimeDisposeUnconfirmed` (`process-bootstrap.ts:85`) or an untyped value.
  - `process-fatal-diagnostics.ts` already reports uncaught values as `{ code, valueKind }` only; its `FatalValueKind` is reused for untagged values.
  - **Where the line goes:** the harness logs JSON lines on its stdout (`harness-logger.ts:4-14`). The desktop logs only each stdout chunk's byte size (`harness-supervisor.ts:437-443`) and forwards only valid upgrade lines (`harness-log-lines.ts:17-46`). So the s9 summary is written to the harness's own stdout and does **not** reach the desktop main log today. See Q1.
- **Protocol vocabulary:** the new fatal code does **not** touch `packages/protocol`. Harness fatal codes are harness log metadata, not a protocol value: no schema decodes them. `HarnessDiagnosticCodeSchema` (`protocol.ts:347-354`) holds a `HARNESS_START_FAILED` too, but that literal is the desktop supervisor's own status diagnostic (`harness-supervisor.ts:370`, `:378`, `:514`), a separate vocabulary that only shares the spelling; s9 neither adds to nor changes it. Forwarding harness fatal lines into the desktop log (Q1 (b)) would need a protocol line schema like `HarnessUpgradeLogLineSchema`, and so would touch the protocol.
- **Design points:**
  1. **One summary, metadata only.** `summarizeHarnessFailure(value)` is a pure function that answers `{ failures, omittedFailures }`. It walks an `AggregateError`'s `errors` in order, depth first, and flattens nested aggregates. Each other value becomes one entry: `{ tag }` when it has a string `_tag` that is an identifier (`/^[A-Za-z][A-Za-z0-9]{0,63}$/`); for `RegistrationCleanupUnconfirmed`, `{ tag, parts }`, where `parts` keeps only the names in the listing's constant list, in their order; otherwise `{ kind }` with the existing `FatalValueKind`. No message, path, `cause`, stack or other field is ever read into the summary. An aggregate with no `errors` counts as one `{ kind: "error" }` entry, so a failure never summarizes as empty.
  2. **Bounded.** At most 16 entries; the rest, and any aggregate met again (a cycle), are counted in `omittedFailures`. Pino logs stay bounded (AGENTS.md Safety And Privacy).
  3. **One sink type.** `HarnessFatalSink = { fatal(metadata, message): void; exit(code: 1): void }`, the shape `createHarnessFatalHandlers` already takes. Each exported exit path calls `fatal` once, then `exit(1)` once.
  4. **Shutdown.** `createHarnessPortCloseHandler({ stopRuntime, succeeded, sink })`: a failed stop reports `{ code: "HARNESS_SHUTDOWN_FAILED", failures, omittedFailures }` with "Harness shutdown failed.". The one-observation-per-handler behaviour is unchanged.
  5. **Startup.** `connectHarnessProcess({ bootstrap, prepare, launch, attach, sink })` in `process-connection.ts`. `prepare` throwing: `{ code: "HARNESS_START_FAILED", … }`, "Harness received an invalid bootstrap message.", and `launch` is not called. `launch` rejecting: `{ code: "HARNESS_RUNTIME_START_FAILED", … }`, "Harness runtime failed to start.", reported only after that rejection, so after `launchOnProcessRuntime`'s bounded dispose settled; `attach` is not called. Success: `attach(stop)` once, no fatal. `process-entry.ts` wires `prepare`/`launch` to the two `process-bootstrap.ts` exports and `attach` to today's port-close wiring, `port.start()` and the "connected" log.
  6. **Unchanged.** The missing-parent-port and missing-port exits in `process-entry.ts` keep `HARNESS_START_FAILED` with no summary (no failure value exists). The uncaught and unhandled handlers. `launchOnProcessRuntime`, the dispose deadline, the 3 s registration budget and its sequential order (Q33 (b)). The desktop supervisor and the protocol.
  7. **Effect.** The summary is pure (a plain function, AGENTS.md Effect Usage). `connectHarnessProcess` stays a Promise function at the process edge, as `connect` is today; no new `new Promise`, no new waiver; `pnpm check:effect` stays green.
- **Non-goals:** Q33 (observer inspections not aborted when the owner close outruns 3 s; accepted residual, §140); the rest of Q25 (`process-entry.ts` stays TDD-exempt for its wiring, named at acceptance); Q26 (the 500 ms dispose bound still hides the 1 000 ms authority safety-net diagnostic, W13); all other blue and discussion findings of the deep review; forwarding harness fatal lines to the desktop log (Q1).
- **Open question for Pedro:**
  - Q1 visibility: (a) keep s9 harness-only, as the coordinator scoped it; the summary is written on harness stdout, which the desktop drops today, so I1 is fixed at the harness edge but the main log still shows only exit code 1 and the desktop's own diagnostic; record forwarding as Deferred Work (recommended for this slice, because (b) touches the protocol and the desktop); (b) also forward harness fatal lines in s9 through a new protocol line schema and `harness-log-lines.ts`.

### Test Contract: u2b-s9-harness-fatal-diagnostics

- **Fixtures:** fake sinks `{ fatal: vi.fn(), exit: vi.fn() }`; real failure classes `ApplicationDatabaseCloseUnconfirmed` and `HarnessRuntimeDisposeUnconfirmed`; `RCU(parts)` is a plain object `{ _tag: "RegistrationCleanupUnconfirmed", name: "RegistrationCleanupUnconfirmed", message: P, parts }` (the class is not exported; `registration-listing.test.ts:90` builds the same shape), which the summary reads only by `_tag` and `parts`; `ADCU` is `new ApplicationDatabaseCloseUnconfirmed(1000)`; private strings `P = "C:\\private\\project\\slopstop.db"` used as messages, causes and `_tag`/part values where a row says so. Every row also asserts `JSON.stringify` of all `fatal` calls (or of the summary) contains neither `P` nor any fixture message.
- **Order of work:** scaffold with today's behaviour (the summary answers `{ failures: [], omittedFailures: 0 }`; the handler and `connectHarnessProcess` report today's codes and texts without the summary; every startup failure is `HARNESS_START_FAILED` with the invalid-bootstrap text); observe the B1, B2 and B3 reds; make them green; then the review/refactor gate.
- **Behavior U2B-FD-B1**: a failure value is summarized as tags, cleanup part names and value kinds only, in order, bounded.
  - Seam: `summarizeHarnessFailure` from `process-fatal-diagnostics.ts`.
  - Test: `summarizes a fatal failure as metadata only: $name` -> `apps/harness/src/process-fatal-diagnostics.test.ts` (`it.each`). Rows (`omittedFailures` is 0 unless stated):
    - `one tagged failure`: `new ApplicationDatabaseCloseUnconfirmed(1000)` → `failures` `[{ tag: "ApplicationDatabaseCloseUnconfirmed" }]`;
    - `cleanup parts`: `RegistrationCleanupUnconfirmed` with `parts` `["observer", "listing"]` and `cause` `new Error(P)` → `[{ tag: "RegistrationCleanupUnconfirmed", parts: ["observer", "listing"] }]`;
    - `unknown parts dropped`: `parts` `["registry", P]` → `parts: ["registry"]`;
    - `nested aggregates in order`: `AggregateError([AggregateError([RCU(["registry"]), ADCU]), new HarnessRuntimeDisposeUnconfirmed(500)])` → `[{ tag: "RegistrationCleanupUnconfirmed", parts: ["registry"] }, { tag: "ApplicationDatabaseCloseUnconfirmed" }, { tag: "HarnessRuntimeDisposeUnconfirmed" }]`;
    - `untagged values`: `new Error(P)` → `[{ kind: "error" }]`; `P` → `[{ kind: "string" }]`; `null` → `[{ kind: "null" }]`; `{ token: P }` → `[{ kind: "object" }]`;
    - `a non-identifier tag`: `{ _tag: P }` → `[{ kind: "object" }]`; `{ _tag: "A".repeat(65) }` → `[{ kind: "object" }]`; `{ _tag: "A".repeat(64) }` → `[{ tag: "A".repeat(64) }]`;
    - `an empty aggregate`: `new AggregateError([])` → `[{ kind: "error" }]`;
    - `the bound`: an aggregate of 16 tagged failures → 16 entries, `omittedFailures` 0; of 17 → the first 16 in order, `omittedFailures` 1;
    - `a cycle`: an aggregate whose `errors` are `[ADCU, itself]` → `[{ tag: "ApplicationDatabaseCloseUnconfirmed" }]`, `omittedFailures` 1, and the call returns.
  - Expected red: against the scaffold (`{ failures: [], omittedFailures: 0 }`), every row fails on `failures`; the 17-entry and cycle rows also fail on `omittedFailures`.
- **Behavior U2B-FD-B2**: a failed shutdown is logged once with its code and summary, then exits 1; a clean one is not.
  - Seam: `createHarnessPortCloseHandler({ stopRuntime, succeeded, sink })`.
  - Test: `reports a failed shutdown with its summary, then exits: $name` -> `apps/harness/src/process-shutdown.test.ts` (`it.each`). Rows `rejects` (`stopRuntime` returns `Promise.reject(F)`) and `throws` (`stopRuntime` throws `F`), with `F = AggregateError([new Error(P), new HarnessRuntimeDisposeUnconfirmed(500)], "Harness process shutdown failed.")`. The handler is called twice. Then: `stopRuntime` once; `succeeded` never; `sink.fatal` exactly once with `({ code: "HARNESS_SHUTDOWN_FAILED", failures: [{ kind: "error" }, { tag: "HarnessRuntimeDisposeUnconfirmed" }], omittedFailures: 0 }, "Harness shutdown failed.")`; `sink.exit` exactly once with `1`, after `fatal` (`invocationCallOrder`); no `P`.
  - Test: `logs a clean shutdown without a fatal` -> `apps/harness/src/process-shutdown.test.ts`. Oracle: `stopRuntime` resolves; `succeeded` once with "Harness message port closed."; `sink.fatal` and `sink.exit` never.
  - The two existing rows (`observes one runtime shutdown rejection without forwarding its cause`, `converts a synchronous runtime shutdown throw once`) are replaced by the `rejects` and `throws` rows, which keep their once-only and no-cause assertions.
  - Expected red: against the scaffold, `fatal` is called without `failures` and `omittedFailures`.
- **Behavior U2B-FD-B3**: at startup, an invalid bootstrap and a runtime start or dispose failure exit with distinct codes and a summary, the latter only after the launch settled; a good start attaches.
  - Seam: `connectHarnessProcess({ bootstrap, prepare, launch, attach, sink })` from `process-connection.ts`.
  - Test: `reports a startup failure with its code and summary: $name` -> `apps/harness/src/process-connection.test.ts` (`it.each`). Rows:
    - `invalid bootstrap`: `prepare` throws `new Error(P)` → `launch` and `attach` never called; `sink.fatal` once with `({ code: "HARNESS_START_FAILED", failures: [{ kind: "error" }], omittedFailures: 0 }, "Harness received an invalid bootstrap message.")`; then `sink.exit(1)` once;
    - `runtime start and dispose fail`: `prepare` returns `R`; `launch` is called once with `R` (`toBe`) and rejects with `AggregateError([new Error(P), new HarnessRuntimeDisposeUnconfirmed(500)], "Harness startup failed.")` → `attach` never; `sink.fatal` once with `({ code: "HARNESS_RUNTIME_START_FAILED", failures: [{ kind: "error" }, { tag: "HarnessRuntimeDisposeUnconfirmed" }], omittedFailures: 0 }, "Harness runtime failed to start.")`; then `sink.exit(1)` once;
    - `runtime start fails alone`: `launch` rejects with `new ApplicationDatabaseCloseUnconfirmed(1000)` → code `HARNESS_RUNTIME_START_FAILED`, `failures` `[{ tag: "ApplicationDatabaseCloseUnconfirmed" }]`.
    - Every row: `exit` after `fatal` (`invocationCallOrder`); no `P` in the `fatal` calls; the returned promise resolves.
  - Test: `reports a runtime start failure only after the launch settled` -> `apps/harness/src/process-connection.test.ts`. Oracle: `launch` returns a promise the test rejects later; after `connectHarnessProcess` is called and pending callbacks are flushed (test-side `await new Promise(setImmediate)`, which the Effect rules allow in tests), `sink.fatal` and `sink.exit` have not been called; after the test rejects it with `E`, `fatal` then `exit(1)` are called once each. With `launchOnProcessRuntime`'s existing pin (`process-bootstrap.test.ts:355`, the rejection comes only after the bounded dispose), this pins "the bounded dispose settles before the startup exit" (Q25, the cheap part).
  - Test: `attaches the stop of a good start` -> `apps/harness/src/process-connection.test.ts`. Oracle: `launch` resolves with `stop` → `attach` once with `stop` (`toBe`), after `launch` resolved; `sink.fatal` and `sink.exit` never.
  - Expected red: against the scaffold, the two runtime rows fail on the code (`HARNESS_START_FAILED`) and the message, and every failure row fails on `failures`. `reports … only after the launch settled` and `attaches the stop of a good start`: Expected red: none — pin (today's `connect` already awaits and attaches; s9 moves it).
- **TDD-exempt:**
  - `apps/harness/src/process-entry.ts` wiring (Y14, Pedro §126; Q25 (b), §140): the parent-port listener, the transport, the `prepare`/`launch`/`attach` wiring and the fatal sink built on the process logger and `process.exit`. Static check at candidate review; packaged path covered by `package:launch-smoke`.
  - The split of `startHarnessProcessRuntime` into the bootstrap check and the launch, with `startHarnessProcessRuntime` kept as their composition: no reachable behaviour changes; proven by `pnpm typecheck`, the unchanged `process-bootstrap.test.ts` rows and the harness integration tests that call `startHarnessProcessRuntime`.
  - Exporting the cleanup-part list from `registration-listing.ts` (type and value move, no behaviour change; the listing's existing rows guard it).
  - The mutation scope entries — gate configuration, checked by the scoped run and `pnpm check:dead-code`.

### Success Criteria: u2b-s9-harness-fatal-diagnostics

**Automated:**
- Red then green per behaviour: `pnpm exec vitest run --project harness apps/harness/src/process-fatal-diagnostics.test.ts apps/harness/src/process-shutdown.test.ts apps/harness/src/process-connection.test.ts [-t <name>]`.
- Pins unchanged: `pnpm exec vitest run --project harness apps/harness/src/process-bootstrap.test.ts apps/harness/src/registration/registration-listing.test.ts`.
- Bindings, each restored by digest:
  - B1: reading `message` (or `cause`) into an entry makes the `cleanup parts` and `untagged values` rows fail (`P` found); not flattening nested aggregates makes `nested aggregates in order` fail; a bound of 15 or 17 makes `the bound` fail;
  - B2: calling `exit` before `fatal` makes the B2 rows fail on call order;
  - B3: mapping a `launch` rejection to `HARNESS_START_FAILED` makes the runtime rows fail; calling `fatal` before awaiting `launch` makes `reports … only after the launch settled` fail.
- On the final candidate: `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code`, `pnpm check:duplicates`; CodeScene `code_health_score` on every changed file with the raw tool output saved (target 10, AGENTS.md); the designer's preflight.
- Heavy runs, each with the coordinator's GO and the CPU rule: `package:smoke` (it starts and stops the packaged harness, so it covers the `process-entry.ts` wiring).
- **Scoped mutation** on the final candidate, once, with the coordinator's GO: add the s9 ranges of `process-fatal-diagnostics.ts` (already listed whole), `process-shutdown.ts` and `process-connection.ts` to `stryker.project-storage.config.json`, and `process-shutdown.test.ts` and `process-connection.test.ts` to `apps/harness/vitest.project-storage-mutation.config.ts`; run limited with `--mutate` to those files; pass rule as in s7 (every counted mutant killed, a `Timeout` counts as killed; survivors to Pedro's triage).

**Manual:**
- None beyond the combined Part A acceptance. The fatal summary is visible only on harness stdout (Q1); a manual check of the desktop log would show no change.

## Deferred Work
These are later slices, in order. Their behaviour IDs are stable. Seams, oracles and Expected red reasons are provisional; they are refined just in time and re-checked against the predecessor.

- **`u2b-s2-storage-failure-guard`** (after s1; independent of it).
  - U2B-SG-B1: one exported guard with the same truth table as all three copies, rows Broken / Unavailable / ClientInitialization (a subclass) / other Error / non-Error. Seam: `isKnownStorageFailure`, in `project-storage-node-errors.test.ts`. Expected red: none — pin (identity proof first).
  - U2B-SG-B2: the existing pass-through pins are kept: `project-storage-node-adapters.integration.test.ts:457-477` and `project-storage-upgrade-steps.integration.test.ts:100-151`. Pin.
  - Trigger: none.
  - Detailed just in time on 2026-10-17: the executable contract is `### Test Contract: u2b-s2-storage-failure-guard` under Test Contracts. Where the two differ, that contract governs.
- **`u2b-s3-authority-bounded-close`** (after s1; lane rigorous, §104 P6).
  - U2B-AC-B1: with a lease that is never confirmed, `stop()` rejects with `ApplicationDatabaseCloseUnconfirmed` at the deadline and never resolves later. Seam: `createApplicationDatabaseAuthority` with a fake client whose `close` rejects, in a new `application-database-authority.test.ts`, with fake timers. Expected red: `stop()` is still pending past the deadline (`application-database-authority.ts:434-438`).
  - U2B-AC-B2: admission stays refused after a timed-out stop (pin), and a stop with no leases resolves at once (pin, `application-database-authority-cases.integration.test.ts:106, 130`).
  - U2B-AC-B3: a runtime whose database stop is unconfirmed rejects with an aggregate that contains `ApplicationDatabaseCloseUnconfirmed`, in the order intake, Storage, listing, database. Seam: `startHarnessRuntime`, in `harness-runtime-shutdown.test.ts`. Expected red: the runtime stop never settles.
  - U2B-AC-B4: a withheld Storage leaves the database untouched (pin, `harness-runtime-shutdown.test.ts:230`). A listing failure does not withhold the database (a new characterization; green at once).
  - U2B-AC-B5: the Layer safety net stops a never-stopped authority, bounded, and does nothing to one that was stopped or withheld. Seam: the exported disposal seam (slice 5) or a bootstrap integration test. Expected red: dispose never stops the authority.
  - Trigger: the opening measurement, with the coordinator's GO. The default is 1 000 ms; if the measured p99 is above 500 ms, the slice stops for Pedro (§104 P1).
  - Detailed just in time on 2026-10-17: the executable contract is `### Test Contract: u2b-s3-authority-bounded-close` under Test Contracts. Where the two differ, that contract governs.
- **`u2b-s4-standalone-authority`** (after s3).
  - U2B-SA-B1: `registry.stop()` drains and stops the standalone authority it created, so a later admission through the same options is refused with "…is stopped.". Seam: `createRegistrationRegistry` (integration, disk). Expected red: admission still succeeds (`registry-database.ts:44-67`, `registration-registry.ts:180-194`).
  - U2B-SA-B2: a restart with the same options object gets a fresh, working authority. Expected red: none today. It becomes red if B1 is implemented without removing the WeakMap entry; the order is pinned with B1.
  - U2B-SA-B3: an injected authority is never stopped by the registry. Pin.
  - Detailed just in time on 2026-10-18: the executable contract is `### Test Contract: u2b-s4-standalone-authority` under Test Contracts. Where the two differ, that contract governs.
- **`u2b-s5-harness-runtime`** (after s3, s4; lane rigorous, §104 P6).
  - U2B-HR-B1: the shutdown program and the transport edge run on the process runtime, and the same-turn, re-entry, withheld, not-held and aggregation pins hold (`harness-runtime-shutdown.test.ts:23, 90, 130, 220, 230`; `harness-runtime.test.ts:201, 226, 241, 254-283, 950`). Pins.
  - U2B-HR-B2: the listing stop is an Effect that fails with `RegistrationCleanupUnconfirmed` (CNV-B37 rows ported, `registration-listing.test.ts:75, 105`), and the observer close uses an Effect deadline (`project-registration-observer.test.ts:154`, ported).
  - U2B-HR-B3: a dispose failure after a failed stop is aggregated, not substituted. Seam: the exported disposal seam. Expected red: the dispose error replaces the stop error (`process-bootstrap.ts:135`).
  - U2B-HR-B4: on a bootstrap failure, a bounded dispose completes before `failStartup` exits. Expected red: the dispose is not awaited (:139).
    - Carried from s3 (2026-10-17), revised by T6 (§114): s3 now proves the wiring itself (U2B-AC-B6), so HR-B4 no longer carries that proof. HR-B4 keeps its own runtime-level check: a dispose that dies with `ApplicationDatabaseCloseUnconfirmed` is aggregated with the startup failure and does not replace it.
    - When s5 is detailed, its HR-B1 pins s3's extended versions of `harness-runtime-shutdown.test.ts:230` and `harness-runtime.test.ts:254-281` (T19, §114).
  - U2B-HR-B5: a transport request after dispose gets no reply and causes no unhandled rejection (`harness-runtime.test.ts:914` extended).
  - U2B-HR-B6: the shutdown listing cleanup ends within `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` and reports `RegistrationCleanupUnconfirmed` for the parts left unconfirmed. Seam: `createRegistrationListing(...).stop`, with fake timers. Expected red: the observer still waits the 5 000 ms per-request budget (`project-registration-observer.ts:93, 107`).
  - Trigger: `package:launch-smoke` GO (precedent `ff162f5`).
  - Detailed just in time on 2026-10-18: the executable contract is `### Test Contract: u2b-s5-harness-runtime` under Test Contracts. Where the two differ, that contract governs.
- **`u2b-s6-desktop-runtime`** (after s5; it is in Electron main, so it does not depend on s1–s5 code but is ordered after them).
  - U2B-DR-B1: the main runtime disposes before `quit()`/`exit()`. Seam: `createDesktopShutdown` with a dispose port. Expected red: `quit` is called before dispose (there is no port today).
  - U2B-DR-B2: a workspace-bridge stop throw still stops the project-entry bridge. Seam: `canonical-writer-package-smoke-main.test.ts` with an exposed entry-stop port. Expected red: entry stop is skipped (`main.ts:60-63`).
  - U2B-DR-B3: every IPC handler answers its `unavailable` envelope after dispose and never hangs (mapping D11). Expected red: workspace and list answer `broken` (seam inventory §5).
  - U2B-DR-B4: the writer-proof and lock-refusal paths build no runtime (characterization).
  - U2B-DR-B5: the desktop-shutdown pins hold (`desktop-shutdown.test.ts:20-199`). Pins.
- **`u2b-s7-bridge-core`** (after s6).
  - U2B-BC-B1: one core settles each request once by id. A throwing send settles the request and frees the id. Seam: a new core module test with a fake `HarnessSessionClient`. Expected red: entry and workspace reject and leak the entry (`harness-pending-request.ts:68-76`).
  - U2B-BC-B2: a null-correlated result and `system.failure` fail all pending requests as `protocol`, with fixed text, in every bridge. Expected red: entry ignores both (`project-entry-bridge.ts:66`); workspace forwards the raw text (`workspace-bridge.ts:220-221`; its pin at `workspace-bridge.test.ts:586` changes by decision).
  - U2B-BC-B3: a decode failure never escapes the listener. Expected red: storage and workspace throw from the listener (`project-storage-bridge.ts:66-73`).
  - U2B-BC-B4: a read during a protocol error, with the real supervisor, answers `broken` `protocolMessageInvalid`. Seam: the real `HarnessSupervisor` + `createProjectEntryBridge({session: supervisor.getSession()})`. Expected red: `unavailable` `connectionLost` (`harness-supervisor.ts:443`).
  - U2B-BC-B5: stop settles pending requests even when unsubscribe throws, in every bridge. Expected red: entry and workspace leave them pending.
  - U2B-BC-B6: every existing bridge surface row keeps its envelope (`project-entry-bridge.test.ts:68-634`, `project-storage-bridge.test.ts:180-370`, `workspace-bridge.test.ts:316-919`). Pins, except the rows changed by B2.
  - S6-I15 (Pedro, §135): the bridge core also merges the three s6 bridge services into one `HarnessBridges` service.
- **`u2b-s8-stdout-drain`** (#96, after s6).
  - U2B-SD-B1: `stop()` stays pending after `exit` until stdout ends. Expected red: it resolves at `exit` (`harness-supervisor.ts:148-152`).
  - U2B-SD-B2: with no `end` within `HARNESS_STDOUT_DRAIN_MS`, `stop()` resolves and the forwarder is removed. Expected red: the stdout `data` listener is still attached.
  - U2B-SD-B3: a child without stdout resolves at `exit` (characterization).
  - U2B-SD-B4: the grace, kill and grace pins hold (`harness-supervisor.test.ts:596, 1078`). The tests that await a stop after `exit` without stdout `end` (:553, :596, :815, :846, :667) are updated to emit `end` or to advance by the bound; their assertions do not change.
  - Bound: 1 000 ms (D12).

**After Part A, on main (decisions log §134.1):** the TS 7 compiler switch, a separate small slice. Its alias layout is `typescript` → `npm:@typescript/typescript6@6.0.2` and `@typescript/native` → `npm:typescript@7.0.2` (research `2026-10-18_20-08-00_typescript-7-and-effect-tsgo-gate.md`, Open Questions, migration steps). The trigger is Part A integrated into main. If that slice adds a TS 7 package, `effect-tsgo diagnostics` becomes usable; whether the s5b gate then moves from tsc mode to `diagnostics --format json` is decided there.

**Deferred beyond Part A:** the facades listed in D4 as kept; `repository-identity-query-owner` drain and the `repository-physical-observation` / `windows-version-child` races (per request, not on the shutdown chain); the authority semaphores. Each moves when its callers become Effects (Part B).
- **Deferred beyond Part A, added by S6-J2 (s6, §135):** the writer package smoke migrates to Effect, and the `OwnedUtility.wait` Promise facade that s6 leaves is removed. That facade is EW6's successor.
- **Deferred beyond Part A, added by S7-R23 (s7, §137):** C2 streaming moves the IPC edge and the package-smoke callers onto the main runtime. The s7 bridge-method Promise facades (`Effect.runPromise` over the core) are then removed.

## Verification Notes
- **Ordering risks** (precedents `00f4a23` → `ff162f5`, `43bc303`, Unit 2a re-entry):
  - The fair lock must keep the facade start-deferral pin exact (`project-storage-locks.test.ts:113`).
  - `Deferred.doneUnsafe` resumes the next holder inside the releaser's stack. Re-entry and stack depth are pinned by U2B-FL-B8 (R3, §105).
- **Same-turn closure** depends on the eager calls at `harness-runtime.ts:117-118, 148` (seam inventory). Slice 5 must not move them inside a suspended Effect.
- **Budget conflict (resolved by D17):** `REGISTRATION_CLEANUP_BUDGET_MS` = 5 000 (`registration/observer-limits.ts:2`) equals the desktop grace `harnessShutdownGraceMs` = 5 000 (`apps/desktop/src/main/harness-supervisor.ts:25`). The shutdown chain now uses 3 000 ms for the listing and 1 000 ms for the database, which fits inside the grace.
- **Packaged load order:** `package:launch-smoke` caught what the source tests missed in `ff162f5` and `c417342`. It is planned after slices 5 and 6, with the coordinator's GO. **Residual at s1 (Q9 (a), §106):** s1 adds import edges into the canonical writer graph and runs no package smoke before its acceptance. The risk is low, because the writer-proof entry loads Storage dynamically (`apps/harness/tests/integration/canonical-writer-package-smoke-entry.ts:313`), and the push runs launch-smoke.
- **Fail versus die:** facades squash both into one error (#110 evidence :114, :132, :414). U2B-FL-B3 asserts each outcome at the Effect level.
- **CodeScene:** it dropped after each migration batch (`c87727d`, `29f7224`). Budget a refactor pass per touched file.
- **Mutation scope:** `stryker.project-storage.config.json:19-20`, `stryker.conversation.config.json:9`, and the `apps/desktop/vitest.project-storage-mutation.config.ts:7-13` (which includes `harness-supervisor.test.ts` and `desktop-shutdown.test.ts`).
- **Final combined mutation scope (R-MUT, decisions log §112):** before the one combined run for the normal slices (D13):
  - add `apps/harness/src/storage/project-storage-node-errors.ts` and `apps/harness/src/storage/project-storage-upgrade-node-adapter.ts:558-564` to the `mutate` list of `stryker.project-storage.config.json`;
  - add `apps/harness/src/storage/project-storage-node-registry.test.ts` and `apps/harness/src/storage/project-storage-node-errors.test.ts` to the include of `apps/harness/vitest.project-storage-mutation.config.ts`;
  - also add `apps/harness/src/storage/project-storage-upgrade-node-adapter.test.ts` and `apps/harness/tests/integration/project-storage-upgrade-steps.integration.test.ts`, the only tests that reach `markerQueryFailure`; with `related: true` (`stryker.project-storage.config.json:29`) its mutants would otherwise have no killing test (T8, §114, widening the §112 text).
  - The ranges are rewritten on the final combined candidate if the lines moved. s4 and s6-s8 add their own entries when they are detailed.
- **Evidence locations:**
  - research `.rpiv/artifacts/research/2026-10-16_23-40-39_effect-unit2b-runtime-lifecycle-part-a.md`;
  - the seam inventory (workflow `wf_d6d996c4-7a3`, summarized here);
  - decisions log §102-§106;
  - intent review round 1: `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-round1.md`;
  - intent review round 2: `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-round2.md`;
  - s3 intent review round 1: `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-s3-round1.md`;
  - s3 intent review round 2 (the last): `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-s3-round2.md`.

## Developer Context

**Q (research checkpoints, decisions log §103, 2026-10-17): the eight research open questions.**
A: Pedro chose the recommended option for all eight, recorded as D1, D3, D4, D6, D7, D9, D11, D12 and D13. The bounds were left to the design, so they appear below as P1 and P2.

**Q (design checkpoints P1-P6, decisions log §104, 2026-10-17): the bounds, codes, bridge behaviour, order and lanes below.**
A: Pedro chose the recommended option for all six, recorded as D5, D9, D11, D12, D14, D15 and D17. P6 raised s1, s3 and s5 to rigorous; the brief's `Lane:` line for s1 records that raise. The coordinator noted D10 with no change (D16). The checkpoint texts below are kept as they were asked.

**Design checkpoints as asked** (answered in §104):
- **P1 — authority close deadline** (`application-database-authority.ts:434-438`). No authority close has ever been measured. The only measurements are a single 18 ms worker close (`.rpiv/artifacts/research/2026-10-03_effect-sql-windows-experiment.md:36`) and a whole-runtime stop of about 2.7 ms on older code (`2026-09-10_canonical-project-writer-s7.md:713`). The proposal:
  1. Slice 3 opens with a bounded measurement: idle, and under the #94 burst, with the coordinator's GO.
  2. The default is set to 1 000 ms unless the measured p99 exceeds 500 ms; if it does, the slice stops and Pedro decides.
  
  A second, linked choice: the listing budget (5 000 ms) equals the desktop grace (5 000 ms). Should the listing budget shrink so that the whole harness stop fits inside the grace, or is a kill after the grace accepted?
- **P2 — #96 stdout drain bound** (`harness-supervisor.ts:25, 148-152`). Proposal: `HARNESS_STDOUT_DRAIN_MS` = 1 000 ms after `exit`. That raises the worst-case quit from 10 s to 11 s inside the `preventDefault` window.
- **P3 — the `unavailable` codes after dispose** (§103.5, `packages/protocol/src/*`). Proposal, reusing existing codes with no protocol change:
  - list: `PROJECT_LIST_UNAVAILABLE`;
  - registration: `PROJECT_REGISTRATION_UNAVAILABLE`;
  - workspace: `WORKSPACE_CAPABILITY_UNAVAILABLE`;
  - upgrade, read and save: their existing `unavailable` `connectionLost`;
  - activate: `PROJECT_COORDINATOR_UNAVAILABLE`;
  - switch: `coordinator-unavailable`.
  
  The alternative is a new protocol code for "desktop shutting down", which is a protocol change.
- **P4 — the unified bridge behaviour** (`project-entry-bridge.ts:66`, `project-storage-bridge.ts:196-198, 231-233`, `workspace-bridge.ts:220-221, 296-298`). Proposal:
  - a null-correlated result and `system.failure` fail all as `protocol`, with fixed text;
  - a throwing send answers its envelope;
  - a decode failure settles as `protocol`.
  
  This changes the workspace pin at `workspace-bridge.test.ts:586` (the raw text stops being forwarded) and makes project entry stop ignoring both events.
- **P5 — slice order** (s1 … s8 above). The proposal puts the harness first, because the fair lock and bounded close are foundations, and then Electron main.
- **P6 — lane.** The classifier says normal. Pedro raised #110 to rigorous because every Project open goes through it (§73). Slices 1, 3 and 5 sit on the same paths. Should they run rigorous, which adds intent review, the code and coverage reviewer pair, and per-slice acceptance?

**Lane raise (§104 P6, 2026-10-17):** the s1 `Lane:` line goes from normal to rigorous by Pedro's decision. The feature lane in the frontmatter stays normal, because s2, s4, s6, s7 and s8 stay normal. The intent review for s1 (rigorous) follows: the slice-verifier in intent mode, plus the code and coverage reviewer pair.

**Intent review round 1 (decisions log §105, 2026-10-17):** the slice-verifier and the code and coverage reviewers all failed the gate: 4 blockers, 5 concerns and 5 suggestions (the table is in the evidence file named under Verification Notes).
- Pedro chose R9 (a): one scoped mutation on the final candidate of each rigorous slice.
- The coordinator approved R1-R8 and R10-R14 as proposed. R7: integration runs over 2 min need the coordinator's GO at run time. R6 is recorded as residual.
- Applied: B1 starts `late` immediately; B2 names E's start; B3 checks the interruption exit; B5 has exact values and a `started` gate; B7 pins whole files and the store test; B8 is new; the mutation commands and scope are corrected; the integration guards are added; the TDD-exempt proof is a type-level assertion; the idempotent flag is dropped; D2 is reworded.
- Round 2 is the last round.

**Ratification (Q6, decisions log §105:931 and §106):** the coordinator approved the round-1 resolutions R1-R8 and R10-R14, the R6 residual and the R7 rule without asking Pedro (§105:931). Pedro ratified all of them in §106.

**Intent review round 2 (decisions log §106, 2026-10-17):** round 2, the last, failed with 2 blockers, 7 concerns and 5 suggestions (`.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-round2.md`). Pedro chose:
- Q5: limit the s1 mutation to the four changed areas;
- Q9 (a): record the packaged load-order residual;
- apply Q1-Q14 as proposed, without a third round.

**Residual risk: the unreviewed delta.** The changes made for Q1-Q14 have had no independent review. The coordinator checks each item against this brief; this residual stands until then.

Intent approval of this brief is not build authority. The workspace, branch and commands are agreed separately in implement.

**Implementation (u2b-s1-fair-lock, 2026-10-17):** built in the worktree `slopstop-123` on `refactor/123-effect-lifecycle-part-a` (parent `fdda65e`), as Pedro approved directly (decisions log §106). The red and green evidence is in `.rpiv/artifacts/evidence/2026-10-17_123-s1-tdd-evidence.md`.
- B2, B1, B5 and B6 each showed their Expected red, then went green. B3, B4, B7 and B8 hold as pins, and the three Q14 binding observations were recorded, with the source restored by digest.
- Implementation choices: the flow `registry` is narrowed to a `Pick` (Q12). The pre-existing `dispatch` switch is split so that CodeScene scores 10.
- On the candidate, the mutation ranges are `project-registration-flow.ts:204-216` and `canonical-project-writer.ts:112-119`; the base ranges were `:184-196` and `:111-118`.
- The registration integration run predates the `dispatch` split.

**Registration rerun (2026-10-17):** the registration integration suite was rerun once on the candidate `1dd7c7c`: 22 files, 238/238 passed, recorded in the evidence-only commit `cd28809`. That run supersedes the pre-split run.

**Candidate review round 1 (decisions log §107, 2026-10-17):** the table S1-S8 is in `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s1-round1.md`; all three reviewers failed it, and none found a code defect.
- Pedro (S2): one oracle in B8(b) checks that the first hand-off runs inline (`order` is exactly `[0]`), with a binding observation.
- Pedro (S3): the flow mutation scope is narrowed to the two lock lines, `project-registration-flow.ts:205` and `:214`. These replace `:204-216`, and they supersede the s1 mutation range under Success Criteria for the final run.
- The coordinator decided S1 and S4-S8; they are recorded in the evidence file.

**Candidate review round 2 (decisions log §108, 2026-10-17):** the table T1-T5 is in `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s1-round2.md`; no reviewer found a code defect, and there is no third round.
- T1: B2 also asserts that interrupting a queued waiter grants nobody while A holds, with a binding observation.
- Pedro (T2): B8(b) adds a reuse oracle: after the long queue drains, a second gated hand-off on the same lock runs inline, with a binding observation against the `#handing` decrement mutant.
- Pedro (T3): the mutation pass rule under Success Criteria also accepts the recorded #110 lock-table cleanup survivors in `project-storage-locks.ts`, which are unobservable at the public surface (#110 evidence `.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md:391-407`). Their new places are 20:3, 29:9, 30:3, 31:7, 31:28 (two, one of them equivalent), 31:62, 32:5, 45:16 and 66:13; the #110 facade arrow at 88:61 no longer exists. Any other survivor in that file fails the rule.
- T5: the flow ranges are written `project-registration-flow.ts:205-205` and `:214-214`. They are expected to yield 0 mutants, and B6's re-observed red is the flow guard.
- T4: the identity bindings are in the evidence file, section "Fix round 2".

**Follow-up (2026-10-17T13:48, /rpiv:revise, s2 just in time):**
- **What changed.** The coordinator asked for `u2b-s2-storage-failure-guard` to be detailed in the worktree copy. What was added: the slice block, the identity proof, the contract U2B-SG-B1 … B3 and the s2 Success Criteria, all under Test Contracts. The Deferred Work entry for s2 now points to them, and its outline lines are kept as they were.
- **Mapping.**
  - B1 keeps its ID and outline, and now has an exact oracle (four true rows, eight false rows).
  - B2 keeps its ID. Its pins are named exactly, and the unit pin `project-storage-upgrade-node-adapter.test.ts:12-28` is added.
  - B3 is new: the registry's fail-or-defect split had no direct pin.
- **Identities.**
  - Prior approved copy: `approved-02d9420f1c6b366e232a93ca38cd6913e8f82099c85ce4740e31c23e85df0f75.md`. The append-only check against it is `keep`.
  - The stamp on the worktree copy before this revision was stale (`3650751d…`): the round-2 candidate block was appended after stamping. This revision restamps it.
  - The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** nothing. The s1 contract, its evidence and its acceptance (§109) are unchanged. The s2 contract is a contract change that needs Pedro's approval before implement.

**Follow-up (2026-10-17T16:30, /rpiv:revise, s3 just in time):**
- **What changed.** The coordinator asked for `u2b-s3-authority-bounded-close` to be detailed (rigorous lane). Added under Test Contracts:
  - the slice block, the design points, the opening measurement, the contract U2B-AC-B1 … B5 and the s3 Success Criteria;
  - under Deferred Work: a pointer on the s3 entry, and on U2B-HR-B4 the s5 proof of the safety-net wiring;
  - under Verification Notes: the final combined mutation scope carrying R-MUT (§112).
  Existing lines are unchanged.
- **Mapping.**
  - B1 and B2 keep their IDs. The fake client replaces "a fake client whose `close` rejects" with two variants, and B2 is made exact.
  - B3 keeps its ID. Its oracle is corrected: a single database failure is the error itself, not an aggregate (`harness-runtime.ts:66-70`).
  - B4 keeps its ID and adds `withhold`.
  - B5 keeps its ID. Its seam is the new `acquireApplicationDatabaseAuthority`, because the s5 disposal seam does not exist yet.
- **Identities.**
  - Prior approved copy: `approved-1347547fc7704f021435d82c71c3ccc13fe165d50e3a76cea216ae200037c4c6.md`.
  - The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** nothing. s1 (accepted, §109) and s2 (gate passed, §112) are unchanged. The s3 contract is a contract change: Pedro approves it, then the rigorous intent review runs on it.

**Follow-up (2026-10-17T18:30, /rpiv:revise, s3 intent review round 1 triage):**
- **What changed.** The s3 intent review round 1 failed (2 blockers, 8 concerns, 9 suggestions; `review-intent-s3-round1.md`). Pedro and the coordinator triaged all of it (decisions log §114), and every item T1-T19 is applied in place in the s3 sections and their pointers:
  - Pedro: T3 (setup outside the timing, repeated bursts, run bound 30 min), T5 (a) (residual, and `closeDeadlineMs: 15_000` for the first-migration pins), and T6, which is not an exception: the Layer wiring is tested in s3 by the new U2B-AC-B6;
  - the coordinator: T1, T2, T4, T7, T8, T9 and T10-T19, as proposed.
- **Mapping.**
  - B1-B5 keep their IDs.
  - B6 is new. It replaces the TDD exemption of the `applicationDatabaseLayer` wiring, and the s5 HR-B4 carry of that proof is withdrawn.
  - `process-bootstrap.ts` and `process-bootstrap.test.ts` join the s3 mutation scope.
- **Identities.**
  - Prior approved copy: `approved-882c905a0e270e03788cb315bdf5c6c067affd0f3107b81e83cd0fe97187597c.md`.
  - The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** the s3 intent review round 1 reviewed 882c905a…; it stays the record of round 1. Pedro's §113 approval covered 882c905a… only. The new contract needs his approval, then intent review round 2, the last. s1 and s2 are unchanged.

**Follow-up (2026-10-17T17:28, /rpiv:revise, s3 intent review round 2 fixes, no third round):**
- **What changed.** The s3 intent review round 2 (the last) failed with 0 blockers, 2 concerns and 6 suggestions (`review-intent-s3-round2.md`, table U1-U8). Pedro chose "Aplicar tudo, sem 3ª ronda" (decisions log §115). U1-U8 are applied in place, as proposed:
  - U1: the native-long project joins the one-time whole-suite run, same GO and stop rule;
  - U2: the B6 Knip rule names `pnpm check:dead-code`, and Success Criteria schedules it once on the final candidate before acceptance (it replaces `pnpm check:deep`);
  - U3: order of work step 7 adds the two exports first, as interface scaffolding;
  - U4: the B3 timing text is a shared setup for both rows;
  - U5: M-idle uses the shape's migrated root with `createIfMissing: false`;
  - U6: a pre-registered 0-mutant note for the deadline constant and the error class;
  - U7: B3's wording is narrowed to listing-then-database, with `harness-runtime.ts:156-161` as the static proof;
  - U8: the `withAuthority` citation is :21-24.
  The Verification Notes gain the round-2 review path.
- **Mapping.** B1-B6 keep their IDs. No behaviour is added or removed; B3's promise is narrowed (U7), and its full order moves to a static check at candidate review.
- **Identities.**
  - Prior approved copy: `approved-7894dee84091e43d9bbd34964e63fd7dcb8b6618de8fcf00ec32c1ffa0f4ccc7.md`.
  - The new identity is the `content_hash` in the frontmatter.
- **Residual risk (§115):** this delta was not reviewed by any independent reviewer. The round-2 cap is reached, and Pedro chose no third round. The coordinator checks each item U1-U8 against this text instead.
- **Invalidated:** the round-2 review reviewed 7894dee8…; it stays the record of round 2. Pedro's §114 approval covered 7894dee8… only, so the new contract needs his approval before implement. s1 and s2 are unchanged.

**Implementation (u2b-s3-authority-bounded-close, 2026-10-17):** built in the worktree `slopstop-123` on `refactor/123-effect-lifecycle-part-a` (parent `fb7bde7`). The evidence is in `.rpiv/artifacts/evidence/2026-10-17_123-s3-tdd-evidence.md`.
- The opening measurement (run 2, §116) gave a highest p99 of 81 ms, so the deadline stays at 1 000 ms. The burst ran without `node_modules`, a recorded deviation from the #94 burst.
- B1, B3, B4, B5 and B6 each showed their Expected red, then went green. B2 holds as a pin. The B2 and B5 binding observations were recorded, with the source restored by digest.
- Implementation choices:
  - The shared unit fakes live in `apps/harness/tests/integration/application-database-close-fixture.ts`.
  - In the opening measurement's M-drain shape, the scratch table is a `TEMP` table, because the application schema verifier refuses an extra main-schema table.
- Still pending, each with the coordinator's GO: T7, `check:dead-code` and the scoped mutation.

**Follow-up (2026-10-17T23:53, /rpiv:revise, s3 candidate review round 1 triage):**
- **What changed.** The s3 candidate review round 1 on `25183e3` failed with 0 blockers, 1 concern and 8 suggestions (`review-candidate-s3-round1.md`, table V1-V9). Triage is in the decisions log §118. Applied in the contract:
  - V1 (Pedro: "Acrescentar o teste"): the B5 `never stopped, lease held` row gains the late-`stop()` oracle (same instance, after `advance(0)`), with its Expected red as a binding observation against the two `closeStarted` guard mutants;
  - V2: the U6 0-mutant note is corrected; the error-class constructor yields counted mutants, which B1 must kill;
  - V5: the exact s3 mutation ranges, resolved at `25183e3`, including the state initializers (:179-185) and `process-bootstrap.ts:182-188`; writing them into the config is a config-only change whose identity is recorded with the run.
- **Implementation fixes, no contract change** (the oracles already require them; the fix candidate carries them):
  - V3: the B3 `with a listing failure` row checks `errors` length 2, `errors[0]` `toBe(listingFailure)` and `errors[1]` `toBe(unconfirmed)` (`harness-runtime-shutdown.test.ts:306`);
  - V4: the B5 `stopped and confirmed` row keeps the first `stop()` promise and compares later calls with it (`application-database-authority.test.ts:124, 134, 173`);
  - V6: the T7 and `check:dead-code` results on the reviewed candidate, with their logs or log paths and digests, are appended to `.rpiv/artifacts/evidence/2026-10-17_123-s3-tdd-evidence.md` before acceptance;
  - V9: the comments at `application-database-authority.ts:47` and `:139` become TSDoc.
- **Residual (V7):** the deadline margin under load is thin. Under the contract's #94 burst, the invalid run 1 had a raw M-drain max of 779 ms against the 1 000 ms deadline (p99 398 ms, so the rule is still met). T7 ran at quiet CPU. A close under heavy load may be reported unconfirmed; this is watched under the #94 class, with no change now.
- **Carried to s5 (V8):** re-resolve the s5 citations that s3 shifted (`harness-runtime-shutdown.test.ts`, about :36/:103/:143/:236/:246; `harness-runtime.test.ts:258-315`). Before any interruptible caller runs `close`, require an interruption-safe close or a pin, because `closeStarted` is set before `closeOutcome` is guaranteed to complete (`application-database-authority.ts:257-266`).
- **Mapping.** B1-B6 keep their IDs. B5 gains one oracle; no behaviour is removed.
- **Identities.**
  - Prior approved copy: `approved-54eb35f4ea243ee414c85e60271c24c72e37a493acf92eaa5b67385a99e82bbe.md`.
  - This revision also restamps the stale stamp left by the Implementation note above, which was appended without a restamp.
  - The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** the round-1 review reviewed `25183e3` against 54eb35f4…; it stays the record of round 1. The new contract needs Pedro's approval. The fix candidate then needs fresh gates and the candidate review round 2 (the last). The mutation runs after it, on the final candidate. s1 and s2 are unchanged.

**Follow-up (2026-10-18, implementation, s3 V6 and candidate review round 2, decisions log §118-§120):**
- **Fix candidate.** `f124758` on `25183e3` (V1, V3, V4, V9), then evidence-only commits; the final candidate is `ac4e735` plus this evidence-only commit. The apps patch from `25183e3` is `2b1d52ec62e80a5d`. Production changes are only two TSDoc comment lines, with no line shift, so the V5 ranges hold.
- **V6.** These results are in `.rpiv/artifacts/evidence/2026-10-17_123-s3-tdd-evidence.md`, with the logs and their sha256 in `.rpiv/artifacts/evidence/2026-10-17_123-s3-t7/`:
  - T7 on `25183e3`: integration 696 passed, 3 skipped; registration 238/238; native-long 1133/1133; all exit 0.
  - `check:dead-code`: clean on `25183e3` (no log; terminal only) and clean on `ac4e735` (log kept).
  - The `pnpm check` attempts on the evidence commit: one failure under load (66/65/71 % CPU), then the one rerun the user approved (§119), which passed.
- **Round 2** (§120): no defects. W1 and W3 are recorded in the evidence, and W2 records that V9's scope is :47 and :139, with no source change.
- **Residual for acceptance.** T7 ran on `25183e3`, not on the final candidate. The only later change in code that T7 runs is the two TSDoc lines.
- **Still pending.** The scoped mutation needs a separate coordinator GO. After it comes Pedro's acceptance.
- This entry is appended without a restamp. The `content_hash` stays `523fff74…`.

**Follow-up (2026-10-18T00:48, s3 accepted, decisions log §121):** the scoped mutation ran once on `12aa956` (config digest `42c03ba512c26f2e`; evidence commit `95ba184`, `.rpiv/artifacts/evidence/2026-10-17_123-s3-mutation/mutation.log`). It counted 41 mutants and killed all 41 (score 100), with 0 timeouts, 0 survivors and 0 NoCoverage. The static tag at :56 was ignored, as pre-registered. Pedro accepted `u2b-s3-authority-bounded-close` ("Aceito") with these named residuals:
  1. T7 ran on `25183e3`; after it only two TSDoc lines changed;
  2. the thin deadline margin under the #94 burst (V7: raw max 779 ms against 1 000 ms);
  3. the measurement burst excluded `node_modules` (§116);
  4. the intent round-2 delta was checked only by the coordinator (§115).
  V8 is carried to s5. This restamp also covers the §118-§120 implementation entry above. The approved s3 contract is unchanged (append-only against `approved-523fff74…`). Next: s4.

**Follow-up (2026-10-18T01:02, /rpiv:revise, s4 just in time):**
- **What changed.** Pedro asked to continue with part 4. The coordinator asked for `u2b-s4-standalone-authority` to be detailed (normal lane, D15). Added under Test Contracts:
  - the slice block, its design points 1-7, the contract U2B-SA-B1 … B3 and the s4 Success Criteria;
  - the citation corrections at `95ba184`;
  - under Deferred Work, a pointer on the s4 entry.
  Existing lines are unchanged.
- **Mapping.**
  - B1 keeps its ID. Its seam is now a unit test with no disk, and it gains a `lease held` row (the bound and the typed aggregate) and a `no standalone authority` pin.
  - B2 keeps its ID. Its red is real at the parent (the same instance is returned), and the removal order is pinned by the `during the drain` row and a binding observation.
  - B3 keeps its ID. It gains a `lease held` row and a binding observation.
- **Impact scan (2026-10-18, read-only, verified at key points against source).** Every caller of `applicationDatabaseFor`, `withRegistrationDatabase` and `createRegistrationRegistry` in `apps/harness/src` and `tests/integration` was checked, including the `.mjs` peers and the fixtures. Findings:
  - no test or production path breaks, slows down or is newly refused;
  - captured authorities are short-lived, per call (`project-listing.ts:209, 222-227`; `registration-storage-bootstrap.ts:102-121`) and closed before `registry.stop`;
  - `consentRegistryOptions` returns a new object on each call (`registration-consent-fixture.ts:23-28`), so most apparent sharing uses two authorities;
  - no two live registries share one options object;
  - the double stops are benign;
  - the only same-object restarts are the trust-cases sites;
  - production always injects.
  This scan is the evidence for design points 1 and 5, and for the scope of the whole-suite run.
- **For Pedro** (product, authority or mutation rule):
  - **P-M (mutation rule for the combined normal-slice run).** s4 adds `registry-database.ts` and `registration-registry.ts` ranges to the one combined run (D13). That run's pass rule is not yet written. Proposed: every counted mutant killed, and any survivor stops for Pedro's triage, as in s3 (§113, §121), with no pre-registered survivors for s4.
  - No product or authority decision is needed. There is no product reach, and the ownership is already D7.
- **Technical choices** (for the coordinator, disclosed to Pedro):
  - T-A: the unconfirmed close is surfaced inside the registry's existing `AggregateError`, after the pending failures (design point 4); a new cleanup part was rejected.
  - T-B: the entry is removed after the stop settles, not before (design point 2).
  - T-C: no `closeDeadlineMs` on `RegistrationDatabaseOptions`, and no `15_000` override on kept pins (design point 5).
  - T-D: B1-B3 are unit tests with no disk, plus the kept integration pins.
  - T-E: the whole registration suite runs once on the final candidate with the coordinator's GO; the integration and native-long whole suites are not required.
  - T-F: the order of pending failures before the database failure is guarded only by an `errors` array with one entry. A row with both a failed pending admission and an unconfirmed close needs disk, so the literal order is a static check at candidate review.
- **Identities.**
  - The newest approved copy is `approved-523fff7418bc0b965a9efa8f5d8c5a698375cfc7dd50c278eed539e9d84e0a81.md`. The s3 acceptance restamp, `61337020…`, passed append-only `keep` against it and was not saved as a new approved copy.
  - The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** nothing accepted. s1 (§109) and s3 (§121) are accepted, and s2 passed its gate (§112). The s4 contract is a contract change that needs Pedro's approval before implement.

**Implementation (u2b-s4-standalone-authority, 2026-10-18):** built in the worktree `slopstop-123` on `refactor/123-effect-lifecycle-part-a` (parent `95ba184`). The evidence is in `.rpiv/artifacts/evidence/2026-10-18_123-s4-tdd-evidence.md`.
- The work followed the contract's order. The B3 pins were green at the parent. B1 showed its Expected red, then went green with the minimal stop. B2 showed its Expected red against that minimal stop, then went green with the removal after the stop settles. The B2 `during the drain` red was also observed against the parent's sources.
- Binding observations:
  - removal before the stop fails `during the drain`, as the contract expects;
  - a release that treats the injected authority as its own fails both B3 rows;
  - a release with only the `options.applicationDatabase` check deleted stays green. That check is redundant, because `applicationDatabaseFor` never writes an injected authority into the WeakMap. This is reported to the coordinator for the combined mutation run's pass rule (P-M).
- The kept integration pins are green: repository-trust 10/10 and the injected authority 2/2.
- Still pending:
  - the whole registration suite, with the coordinator's GO;
  - the slice-verifier;
  - the combined mutation run.

**Implementation fix (u2b-s4, 2026-10-18, decisions log §123):** the injected check in `stopStandaloneAuthority` was removed, because it was equivalent (I1). The removal guard was simplified to an unconditional delete, because it was equivalent too (an unconditional delete stays green, and no path replaces the entry during the stop). The TSDoc was updated. This is a new commit on `509b205`, and the evidence is in the s4 evidence file. M1-M4 (the `forEach` concurrency is equivalent; `stopped = true` has no unit row) are reported to the coordinator for the combined mutation run.

**Follow-up (2026-10-18T02:19, /rpiv:revise, s4 §123 addendum):**
- **What changed.** One unit pin row is added to U2B-SA-B1 (`refuses registry work after stop`, in the s4 Test Contract), with its binding observation against M3 (`stopped = false`) and M4 (the `stopped = true;` statement removed). Pedro decided it ("Acrescentar teste leve", §123). Existing lines are unchanged. The intent IDs are unchanged: the row pins B1's existing oracle ("`stopped` refusal of new registry work is unchanged").
- **Recorded decisions and changes (§123):**
  - **Coordinator decision (technical, disclosed; Pedro may contest it):** drop the `concurrency: "unbounded"` option from `stop`'s `Effect.forEach` (`registration-registry.ts:185-191` on `f1ffe93`). M1 and M2 are equivalent mutants: the default is sequential, and the results and their order for the in-flight admissions are the same. This removes them from the combined run instead of pre-registering survivors, which keeps P-M.
  - **Removed (coordinator decision, equivalent mutants):** the injected check `if (options.applicationDatabase !== undefined) return Effect.void;` in `stopStandaloneAuthority` (`registry-database.ts:81` on `509b205`; I1). `applicationDatabaseFor` never stores an injected authority in the WeakMap, so the map miss already returns. Design point 6 still holds: B3 binds it with I2 and I2'.
  - **Removed:** the removal guard `if (standaloneAuthorities.get(options) === authority)` (`registry-database.ts:87` on `509b205`; §123 cites :89). The finalizer is now an unconditional delete (`f1ffe93`). Design point 2, step 4 ("only if the entry is still that authority") is superseded by this: the order stays, the identity check goes. R' still fails `during the drain`.
- **Residual (new):** the guard removal rests on the observed ordering of Effect fibers, not on a guarantee written in the code. A scratch probe showed that every fiber waiting on the one memoized authority stop runs its finalizer before the first caller's continuation can create a fresh authority, so nothing replaces the entry during the stop. If a later change lets another path write the WeakMap during a stop, or Effect changes that scheduling, an unconditional delete could drop a fresh authority. Watch it at the s4 slice-verifier and at any later change to `registry-database.ts`.
- **Build order for the addendum:** the new row first, green on `f1ffe93`; then the binding observation against M3 and M4, restored by digest; then the `forEach` option drop, with the unit file still green. Per §123, the whole registration suite is rerun on the final candidate only if a production line other than the `forEach` option changes.
- **Mutation:** the combined run's `registration-registry.ts` `stop` range now covers `stopped = true` through this row, inside the existing include (`registration-registry.test.ts`). No other change to the s4 Success Criteria.
- **Identities.** Prior approved copy: `approved-3f8bf65de896312b5d7b962db68c1f938c920ce33f3b4ceb7b4e52cec1e0991d.md`. The new identity is the `content_hash` in the frontmatter. This restamp also covers the two implementer lines above ("Implementation" and "Implementation fix").
- **Invalidated:** nothing accepted. The s4 candidate `f1ffe93` is not accepted yet. The new row and the `forEach` drop are a contract change that needs Pedro's approval of the new hash before the build (§123).

**Follow-up (2026-10-18T03:10, /rpiv:revise, s4 round-1 triage, decisions §124):**
- **What changed.** One unit pin row is added to U2B-SA-B1, the second §124 pin (Test Contract): `waits for an in-flight admission before the database`. It answers X1 of `review-candidate-s4-round1.md`: the drain at `registration-registry.ts:185-187` had no row with an admission in flight at stop. It also makes T-F executable, which supersedes T-F's "static check only" (Follow-up 01:02). Pedro's decision: "Mais um teste leve". Existing lines are unchanged, and the intent IDs are unchanged.
- **Off-disk failure on demand (the coordinator's STOP condition): one exists, so no stop was needed.**
  - Every registry admission enters `withRegistrationDatabase` (`registry-database.ts:114-130`). An admission fails before any write when the options' authority is already stopped: `openCurrent` calls `accept()` first (`application-database-authority.ts:501-503`), which throws "Project Storage application database is stopped." (:193-194).
  - The one filesystem contact before that is `requirePlainEntries` (`registry-database.ts:95-112`). It runs read-only `lstat` calls on the absent root and on the absent `application.db`, so it creates nothing and the root-absent assertion still holds.
  - No registry admission can avoid that read. Disclosed to the coordinator: if a read-only `lstat` of an absent path counts as disk under the reclassification rule, this row instead moves to `tests/integration/`, out of the mutation include. Option (b) of X1 would then apply.
- **X3, AGENTS.md:69 exception (Pedro: "Exceção com comentário"):** the `stop` drain keeps no explicit `concurrency`. It only awaits admissions that are already running and launches no new work, and any explicit option would be an equivalent mutant against P-M. This is a recorded exception for this one loop, not a change to the rule. The implementer adds a one-line code comment at the drain saying why. The comment is not a behaviour change and needs no red.
- **X2 (coordinator decision):** on the final candidate, from `apps/harness`, rerun `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/application-database-authority.integration.test.ts`. It takes about 4 s and is not a heavy run. Record it in the evidence file, together with the final candidate's typecheck, check, dead-code and CodeScene results (D-20). It is required before the s4 gate.
- **X4 (coordinator decision):** the three-commit slice (`509b205`, `f1ffe93`, `a664b19`, plus the fix commit for this row) is an accepted deviation from one commit per slice, as in s3. The combined acceptance covers the whole chain.
- **Build order:**
  1. the row, green on `a664b19`;
  2. the two binding observations, each restored by digest;
  3. the X3 comment, with the unit file still green;
  4. X2 and the gates.
  The whole registration suite is not rerun: the production change is a comment only (§123 rule).
- **Mutation:** the `stop` range is unchanged. The drain mutants are now bound to this row, so P-M stays without pre-registered survivors.
- **Identities.** Prior approved copy: `approved-9051298c8095574234ae1a95abb1ee798dd54991f518eff41f3c2b71eae326f2.md`. The new identity is the `content_hash` in the frontmatter. The round-1 review (`a664b19`) stays in evidence. The fix candidate gets round 2 of 2 (slice-verifier).
- **Invalidated:** nothing accepted. The round-1 review is bound to `a664b19` and is not reused for the fix candidate.

**Follow-up (2026-10-18T04:30, /rpiv:revise, s5 just in time):**
- **What changed.** s4 is closed (§124; tip `df16fb7`, whose W1/W2 commit is comment and evidence only). The coordinator asked for `u2b-s5-harness-runtime` to be detailed (rigorous lane, §104 P6). Added under Test Contracts:
  - the slice block, its design points 1-10, the contract U2B-HR-B1 … B6 and the s5 Success Criteria;
  - the citation re-resolution at `df16fb7`;
  - under Deferred Work, a pointer on the s5 entry.
  Existing lines are unchanged.
- **Mapping (IDs kept):**
  - **B1:** the pins are re-resolved, and one row proves the program runs on the process runtime. The registration edge is proven by B5.
  - **B2:** the CNV-B37 rows are ported to the Effect `stop`, and the observer pin is kept.
  - **B3:** now goes through the disposal seam, and also covers the dispose bound.
  - **B4:** now goes through the disposal seam (T6, §114), with the s3 carry-over (`ApplicationDatabaseCloseUnconfirmed` is aggregated with the startup failure).
  - **B5:** refined. The outline said "a transport request after dispose gets no reply". After a stop, no handler is subscribed (pin :948-956). So the new row is the in-flight request that `dispose` interrupts.
  - **B6:** its Expected red is restated against the listing seam, because the chain has no budget of its own. Its rows cover each part that might hang.
- **V8 (§118), carried from s3.** The citations are re-resolved above. On the interruption-safe close: s5 adds no interruptible caller of `close`, so design point 9 applies a static check at candidate review. Design point 7 bounds the process stop regardless.
- **Scan (2026-10-18, one read-only agent; the parent re-checked the Effect sources it relied on: `ManagedRuntime.ts:290-297, 337-347` and `internal/effect.ts:940-951, 1686-1706, 5700-5720`):**
  - 1 production caller of `startHarnessRuntime` and 28 test callers. 1 production caller of `startHarnessProcessRuntime` and 10 test call sites in 7 integration files;
  - `createRegistrationListing(...).stop` has one production caller (`harness-runtime.ts:148`). Observer `close` is called in production only at `registration-listing.ts:34`;
  - `Effect.timeout` around `disposeEffect` is unbounded (design point 7);
  - no test reaches today's startup-failure dispose (`process-bootstrap.ts:138-141`);
  - the shutdown chain holds two 5 000 ms inner budgets and one unbounded wait (design point 4).
- **For Pedro** (budgets, heavy runs, mutation rule):
  - **P-S5-1, the dispose deadline.** Proposed: `HARNESS_RUNTIME_DISPOSE_DEADLINE_MS` = 500 ms. With D17, the worst case is listing 3 000 ms + database 1 000 ms + dispose 500 ms = 4 500 ms, inside the 5 000 ms desktop grace. That shrinks D17's margin for the log line and exit from 1 000 ms to 500 ms.
    - Alternative: 250 ms, which keeps a margin of 750 ms.
    - After a completed program, the dispose only interrupts finished fibers and runs a safety net that does nothing, so it is expected to take a few milliseconds.
  - **P-S5-2, an opening measurement.** D17's 3 000 ms was a designer value and has never been measured.
    - Recommended: measure the listing chain and the dispose first (Success Criteria; about 30 min, a heavy run with the coordinator's GO), with the same half-the-bound rule as s3.
    - Alternative: no measurement. D17 is then recorded as unmeasured, and the whole-suite runs are its only check under load.
  - **P-S5-3, the mutation pass rule.** Proposed as in s1 and s3: every counted mutant is killed, a `Timeout` counts as killed, any survivor stops for Pedro, and there are no pre-registered survivors.
  - No product or authority decision is needed. Nothing visible to the user changes: the envelopes and the protocol are unchanged, and the in-flight request at dispose belongs to a desktop that has already closed its port. The ownership is already D1, D8 and D17.
- **Technical choices** (for the coordinator, disclosed to Pedro):
  - **T-S5-A:** the edge runner is optional, with the global default (design point 1). The alternative was to make it required, which changes 28 test call sites. The risk is a production caller that forgets it; `startHarnessProcessRuntime` is the only production caller, so this is a static check at candidate review.
  - **T-S5-B:** the bounded dispose uses a detached fork plus a timed `Fiber.await`, because `Effect.timeout` is unbounded around an uninterruptible effect (design point 7).
  - **T-S5-C:** `startHarnessProcessRuntime` becomes async. That adds `await` at 10 integration call sites, and the two validation tests turn a sync throw into a rejection, with their assertions unchanged.
    - Rejected: keeping it synchronous, with an error that carries the disposal promise.
  - **T-S5-D:** V8 is handled by a static check and no change to the authority (design point 9).
    - Alternative: make the critical section of `close` uninterruptible now (bounded by its deadline). It has no public seam that could observe it, so it would carry no red, and it would add a range in s3's accepted file.
  - **T-S5-E:** the stop promise is completed in `onExit`, so it settles even if the program is interrupted (design point 3).
  - **T-S5-F:** one 3 000 ms deadline over the whole listing chain. Parts not yet started are not started, and are named unconfirmed (design point 4).
  - **T-S5-G:** the observer keeps its Promise `close` and its 5 000 ms budget. Internally it uses `Effect.timeoutOrElse` in its own `runPromise`, a temporary facade allowed by AGENTS.md (precedent `project-registration-preparation.ts:273`).
  - **T-S5-H:** `RegistrationCleanupUnconfirmed` becomes a `Data.TaggedError` and keeps the CNV-B37 oracle (design point 5).
  - **T-S5-I:** an interruption-only exit at the registration edge sends no reply (design point 8), with a binding observation.
- **Identities.** Prior approved copy: `approved-4ed6baee86bd8874225ebaa62e1f27de67aad03e834d25c11b642a07045fcf07.md`. The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** nothing accepted. s1 and s3 are accepted, and s2 and s4 passed their gates. The s5 contract needs Pedro's approval, then the 3-reviewer intent review, before implement.

**Follow-up (2026-10-18T05:10, s5 picks, decisions §125):**
- **Pedro's decisions:**
  - P-S5-1: `HARNESS_RUNTIME_DISPOSE_DEADLINE_MS` = 500 ms (design point 7). The worst case is 3 000 + 1 000 + 500 = 4 500 ms, against the 5 000 ms desktop grace.
  - P-S5-2: measure first. The opening measurement in the s5 Success Criteria (M-listing and M-dispose) is now required. It runs before any code change, for about 30 min, with the coordinator's GO. The half-the-bound rule applies: 1 500 ms and 250 ms. A miss or a broken cell stops the slice for Pedro.
  - P-S5-3: the s1/s3 mutation pass rule. Every counted mutant is killed, a `Timeout` counts as killed, and any survivor stops the run. Nothing is pre-registered beyond the 0-mutant constants and the tag arguments.
  - Pedro approved the s5 contract for intent review: `content_hash b4d8eb20b604c3f20b5e5820daf7b9374e2e0f014dcadc4fd80f6e217a8c2b48`, approved copy `approved-b4d8eb20….md`.
- **Coordinator decisions (technical, disclosed):**
  - T-S5-A … T-S5-I are accepted as proposed (Follow-up 04:30).
  - The s5 opening measurement uses the §116 burst instead of the raw #94 burst, for the Defender and load reason Pedro accepted in §116. That burst runs the same 6 loops with `node_modules` excluded from the search, and the tool waits for each burst process to end, so windows never overlap. This amends the measurement line of the s5 Success Criteria ("quiet and under the #94 burst"), which keeps its text. Every timed sample must still fall inside its burst window, or its cell is broken.
- **Identities.** This entry is append-only against `approved-b4d8eb20….md`. The intent review runs on the restamped hash.

**Follow-up (2026-10-18T15:20, /rpiv:revise, s5 intent round-1 triage, decisions §126):**
- **What changed.** The round-1 findings Y1-Y24 (`review-intent-s5-round1.md`) are applied as inserted lines only; no existing line changed. The inserts:
  - a Y16 inventory amendment after the s5 Dependencies line;
  - design point 11, which amends DP3, DP4, the starter, the option type, DP8, the observer close, process-entry and DP10;
  - a Test Contract amendment block with the new and sharpened rows and the process-entry TDD exemption;
  - a Success Criteria amendment block: the mutation command and scope, the constant guards, the measurement cells and the bounds.
- **Pedro's decisions (§126):**
  - **Y14 (a):** an off-disk unit row in `process-bootstrap.test.ts` (`routes the process runtime through its edges: unsubscribe throws`) proves the `startHarnessProcessRuntime` wiring. `process-entry.ts` is `TDD-exempt`, with its reason.
  - **Y15:** the M-listing-drain cell is added (one registration step in flight at stop), within the same ~30 min bound.
- **Coordinator decisions (§126):**
  - Y1-Y13 and Y16-Y24 are applied as proposed.
  - The `startHarnessProcessRuntime` mutation range is dropped, because the Y14 row covers the wiring.
  - Disclosed for Y10: the `Promise.all` in `settleClose` stays inside the temporary facade. If a reviewer requires `Effect.forEach`, the equivalent `concurrency` mutant makes it an X3-style choice for Pedro.
- **Mapping.** The intent IDs are unchanged (U2B-HR-B1 … B6).
  - B1 gains the same-turn pin, the listing-defect row and the DP3 binding. The Y14 wiring row also belongs to B1, because it shows the process runtime running the edges.
  - B2 gains the `_tag` red and two observer pins.
  - B3 gains the 50 ms row and the ordering row.
  - B4's `dispose succeeds` row becomes `the dispose takes 10 ms`, and B4 uses the default deadline.
  - B5 gains the exit rows.
  - B6 gains three rows.
- **Identities.** The prior approved copy is `approved-b4d8eb20b604c3f20b5e5820daf7b9374e2e0f014dcadc4fd80f6e217a8c2b48.md`. Round 1 reviewed `4636ed4e…`, which added only the 05:10 Follow-up to it. The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** the round-1 intent review is bound to `4636ed4e…`. Round 2 (the last) runs on the new hash, after Pedro approves it.

**Follow-up (2026-10-18T15:50, /rpiv:revise, s5 intent round-2 triage, decisions §127):**
- **What changed.** The round-2 findings W1-W13 (`review-intent-s5-round2.md`) are applied as inserted lines only; no existing line changed. The inserts:
  - a W8 inventory amendment after the round-1 Y16 amendment;
  - design point 12 (W2, W5);
  - a round-2 Test Contract amendment block (W1, W2, W4, W7, W9, W11);
  - a round-2 Success Criteria amendment block (W3, W10, W11);
  - this entry (W6, W12, W13 and the residual).
- **W6 (Pedro, §127 (a): the mechanism stands).** The Y14 row (Test Contract round-1 amendments) replaced the §126 wording. §126 recorded "a registration request in flight at `stop()` plus dispose, and the handle interrupted". The approved row instead emits a request after the stop and the dispose, on a subscription kept alive because the unsubscribe throws, and the request dies on the disposed runtime.
  - The reason: the real `prepare-git` flow cannot be held in flight off disk, and the real handle has no interruption recorder. The in-flight, interrupted shape is proven at the `startHarnessRuntime` seam by B5.
  - **Disclosure:** the designer made this change in the 15:20 revise without disclosing it. The round-2 intent review found it (verifier Z3, coverage N7), and the parent confirmed it against decisions log §126 (:1242).
- **Residuals recorded (§127):**
  - **W12:** `failStartup` logs the fixed "Harness received an invalid bootstrap message." for every startup failure (`process-entry.ts:86-87`). B4's aggregate, including a dispose failure, therefore has no distinct diagnostic at the process boundary. This existed before the amendments. A distinct log field would change the TDD-exempt `process-entry.ts` with no red, so it is not done.
  - **W13:** on the real startup-failure path, the safety net's 1 000 ms close deadline outlasts the 500 ms dispose bound. Production would report `HarnessRuntimeDisposeUnconfirmed`, so B4's `ApplicationDatabaseCloseUnconfirmed` row proves only the seam's aggregation. No work is admitted on that path, so the close is immediate (s3 DP5).
  - **The unreviewed delta (§127, cap reached, no third intent round):** this whole revise, from `e46c3b8e…` to the new hash, has had no intent review. It is a residual risk. The s5 candidate review (round 1, all three reviewers) is its first independent check, and it must include these round-2 amendments in its scope.
- **Deviations from the round-2 table.** These are disclosed one by one:
  - **W3:** the table offered two shapes: a same-turn registry admission, or a held write lease. The registry admission is chosen, with `registry.hasUnsettled()` named as the example, because it is the realistic drain the D17 budget bounds.
  - **W10:** the access path is spelled out concretely: rebuild the registration ports with their exported constructors over the authority extracted from `harnessServicesLayer`. For M-dispose, both the authority and the listing are stopped before the timing. The table named only the authority.
  - **W4:** the table said "right after B4"; it is placed exactly there.
  - **W2:** the row runs on the default runner, so it is independent of the process runtime.
  - None of the other items deviates.
- **Mapping.** The intent IDs are unchanged.
  - B1 gains the self-interrupting listing row.
  - B5 loses `handle fails`.
  - B6 gains the observer-pending-recovery row.
  - The Y14 row gets its place in the order of work and its binding.
- **Identities.** Prior approved copy: `approved-e46c3b8ed61216820a39a0cc51cf8cb02d020a23d5055f296cbb9524190865bb.md`. The new identity is the `content_hash` in the frontmatter.
- **Invalidated:** the round-2 intent review is bound to `e46c3b8e…`. No third intent round runs (§127). The new hash needs Pedro's approval before implement.

**Implementation (u2b-s5-harness-runtime, 2026-10-18):** built in the worktree `slopstop-123` on `refactor/123-effect-lifecycle-part-a` (parent `f7c11a5`), as candidate `1ab1762`, frozen (decisions §130). The evidence is in `.rpiv/artifacts/evidence/2026-10-18_123-s5-tdd-evidence.md`.
- Still pending, by that evidence file: the whole suites, `pnpm package:launch-smoke` and the scoped mutation run (each with the coordinator's GO), then the s5 candidate review and Pedro's acceptance.

**Follow-up (2026-10-18T17:05, /rpiv:revise, s5 document fixes, decisions §130):**
- **What changed.** Two document fixes; no intent, row or oracle changed.
  - **B2 test lines (format only).** `slice-preflight` reported `no-test-line: U2B-HR-B2`, because its parser reads only `  - Test:` lines and B2 used a `Tests:` label with sub-bullets. The two sub-bullets are now two `Test:` lines with the same text. One more format change was needed, and it is disclosed: the observer path `project-registration-observer.test.ts:154-197` became `project-registration-observer.test.ts` (:154-197), because the parser takes the whole ticked text as the file path.
  - **Implementation pointer.** The `Implementation (u2b-s5-harness-runtime)` entry above points to the s5 evidence for candidate `1ab1762`.
- **Identities.** Prior approved copy: `approved-1a915533f3e62e1e7b6aa43576ce2d26fed4ebb206506dda81a1bbcc9a0b8ff3.md`. The new identity is the `content_hash` in the frontmatter. The candidate `1ab1762` was built against `1a915533…`, and this revision does not change what it must satisfy.
- **Invalidated:** nothing. The new hash needs Pedro's re-approval, because the append-only check reports the changed B2 lines.

**Follow-up (2026-10-18T17:35, /rpiv:revise, s5 candidate round-1 triage, decisions §131):**
- **What changed.** The candidate round-1 findings Z1-Z9 (`review-candidate-s5-round1.md`) are applied as inserted lines only; no existing line changed. The inserts:
  - design point 13 (Z2, Z5, Z6);
  - a candidate round-1 Test Contract amendment block (Z1, Z2, Z3, Z5, Z6, and the order of work);
  - a candidate round-1 Success Criteria amendment block (Z7, Z9);
  - this entry (Z4, Z8, the Z6 removal trigger, and the deviations).
- **Decisions.**
  - Pedro: Z4 (a), Z5 (b), Z6 (b).
  - Coordinator: Z1, Z2, Z3, Z7, Z8 (as a residual) and Z9, as proposed.
- **Residuals recorded (§131):**
  - **Z4 (Pedro, (a)).**
    - What happens: when the program is interrupted (a self-interrupting listing, W2, or a dispose during the program), the stop rejects only with the squashed interruption.
      - The intake, canonical and Storage failures are dropped, and the Storage outcome is discarded.
      - Neither `withhold()` nor the database stop runs.
      - At dispose, the s3 safety net closes the authority, even after a failed Storage stop. This is in tension with D6.
    - Why it is a residual: production does not reach this path today. The real listing never interrupts itself, and `launchOnProcessRuntime` disposes only after the program settled. The stop still rejects, so it is never reported clean.
  - **Z8.**
    - What happens: the §128 W3 in-flight proof could not fail. The settled flag is set in a `.finally` callback, so it is always read before it is set. The M-listing-drain cell proves timing, but not the drain.
    - Why it is a residual: the §128 values stand, with a wide margin (p99 397 ms against 1 500 ms). Any reuse of the tool needs a falsifiable proof.
  - **Z6, the remaining facade.** The Promise `close()` (`Effect.runPromise(closeEffect)`) stays for its test callers only.
    - Removal trigger: when those callers move to `closeEffect`. At the latest, that is the next slice that touches the registration integration fixtures.
    - No production caller of the Promise `close()` remains.
- **Deviations from the table, each disclosed:**
  - **Z6, the wording "remove its facade".**
    - The table's option (b), which Pedro chose, says "keeping the Promise wrapper for tests". What is removed is the T-S5-G facade inside `settleClose` and the listing's Promise bridge. The Promise `close()` wrapper stays for 52 test sites in 20 files plus `registration-observer-peer.mjs`.
    - Removing that wrapper too would change all of those sites, and the registration and native-long suites with them. That would be a further decision for Pedro.
  - **Z6, re-entry after an interrupted close.** A later close answers unconfirmed, and the interrupted caller stays interrupted. The table did not specify this. It follows degrade-distinguishes-broken: an unfinished settle is never reported as closed.
  - **Z1 and Z3 are pins with binding observations, not reds,** because the candidate already behaves as required. The binding is the proof.
  - **Z2's oracle** asserts the "ManagedRuntime disposed" text in the reason or its `message`. The exact rejection shape is recorded in the evidence.
  - **Z9:** which heavy suites to rerun is left to the coordinator.
  - None of the other items deviates.
- **Identities.**
  - The prior approved copy is `approved-94e1f491b480658fe64f3d95416e97a92fdab3dd391df2b88569880aa3b9ac59.md`. The new identity is the `content_hash` in the frontmatter.
  - Candidate `1ab1762` is superseded by a new candidate, which gets the round-2 candidate review, the last one (cap). The scoped mutation runs after that review.
- **Invalidated:**
  - the candidate round-1 review, which is bound to `1ab1762`;
  - the heavy-run and gate results on `1ab1762`, as evidence for the new candidate, except where the coordinator reuses them;
  - T-S5-G and the round-1 Y10 facade note, which Z6 supersedes.

**Follow-up (2026-10-18T18:30, /rpiv:revise, s5 candidate round-2 triage, decisions §132):**
- **What changed.** The candidate round-2 findings (`review-candidate-s5-round2.md`) are applied as inserted lines only; no existing line changed. The inserts:
  - design point 14 (V1, V3);
  - a candidate round-2 Test Contract amendment block (V1, V2, V5, V6, V3, and the order of work);
  - a candidate round-2 Success Criteria amendment block (gates, heavy runs, mutation, evidence fixes);
  - this entry.
- **Decisions.**
  - Pedro: V1 (b), V2 (a), V3 (b) "Corrigir já". V3 is a production change after the review cap.
  - Coordinator: V5, V6 (bundled with V2), V4 as a residual, and the evidence fixes.
- **Residuals recorded (§132):**
  - **The unreviewed delta.** The production changes for V1 (`settleClose`) and V3 (`startStop`) and the V2/V5/V6 test changes get no review round (cap), as in §127. Their checks are:
    - the rows and bindings above;
    - the light gates;
    - `package:smoke` and the registration suite;
    - the scoped mutation.
    The acceptance record names this delta.
  - **V4.** `closeEffect` runs its first-evaluation side effects (`project-registration-observer.ts:149-151` on `a17a2ac`) before it installs the `onExit` that completes the close outcome (:153).
    - The risk: an interruption that lands on a scheduler yield between those two steps would leave the `Deferred` unset, and later closes would hang.
    - Why it is a residual: in practice it cannot be reached. A yield needs 2 048 operations in one run loop, and production closes the observer once (claim-verifier: Weakened).
    - The fix belongs to the next slice that touches the observer: `Effect.uninterruptibleMask((restore) => Effect.suspend(() => …restore(settleClose(…)).pipe(Effect.onExit(…))))`.
  - **Z4, extended by V3.** After V3, a `stop()` first called after the dispose no longer leaves an unhandled rejection. But it still rejects with the "ManagedRuntime disposed" defect alone, and its canonical outcome is settled and then dropped. The listing does not run on that path either. Production cannot reach this path (`launchOnProcessRuntime` stops before it disposes).
  - **The non-Error rejection.** A stop after the dispose rejects with the plain string. This is accepted at this internal edge (round 2, Z2). If a later slice exposes that path to a real caller, a typed error should replace the string.
- **Acceptance-record note (V7).** The fixture that the §131 amendments did not list, `project-registration-flow.test.ts:54-58` (`closeEffect: Effect.die(...)`, needed for typecheck), is accepted. It matches the sibling `discoverGit` die-fake.
- **Deviations from the §132 instructions, each disclosed:**
  - **V3:**
    - The row's Expected red names the listener seeing `C`. If Vitest's own unhandled-rejection report fails the run first, that failing run is recorded as the red.
    - The canonical outcome is not aggregated: §132 asked for no unhandled rejection, not for aggregation. That part stays in Z4.
  - **V6:** this is a pin with no binding required, because an externally interrupted fiber always ends interrupted.
  - **V5:** this is a pin; it tightens an oracle that already passes.
  - **Heavy runs:** §132 names `package:smoke` and the registration suite. I add no other suite.
  - None of the other items deviates.
- **Identities.**
  - The prior approved copy is `approved-4057f6d14ef30210d4aedd9094ef6b3d756f5e0a40b4092e1ab6064780aaf735.md`. The new identity is the `content_hash` in the frontmatter.
  - Candidate `a17a2ac` will be superseded by new commits on top of `d48cb47`.
- **Invalidated:**
  - the "no equivalent mutant is pre-registered" premise as it stood on `a17a2ac` (V1 and V2 now restore it);
  - design point 13's explicit `concurrency: "unbounded"` (V1);
  - the gates and heavy runs on `a17a2ac`, as evidence for the final candidate, except where §132 keeps them (integration and native-long are not rerun).

**Follow-up (2026-10-18T19:30, /rpiv:revise, s5 mutation rows, decisions §132 follow-up):**
- **What changed.** Inserted lines only; no existing line changed. The inserts: a mutation-rows block at the end of the round-2 Test Contract amendments (M1, M2, rerun), a matching Success Criteria entry, and this entry.
- **Why.** The scoped mutation on `d38d9a3` (commit `de9966a`) found 173 killed, 1 Survived (`harness-runtime.ts:344:9`) and 2 NoCoverage (`:438:21`, `:439:7`). Pedro decided: add two light, test-only rows.
- **Mapping.** M1 → the survivor at :344; M2 → the two NoCoverage mutants at :438-439. Both belong to slice u2b-s5-harness-runtime.
- **Residual.** The M1/M2 test delta gets no review round (cap), as in §127. Its checks are the bindings, the light gates and the scoped mutation rerun.
- **Deviations, each disclosed:**
  - M1 goes beyond the one case named in the instruction: it adds the `sequence: 1` pin to the two exit rows. The reason: the die case alone cannot tell the mutant apart by event, payload or count (the mutant also ends in one internal failure); only the consumed sequence shows the attempted registration result. The dispose row's extra check depends on the reply arriving within one macrotask, so the `sequence` pins are the deterministic kill.
  - M1 and M2 are pins (the code already behaves correctly), so there is no red to observe; the bindings are the proof.
  - No heavy suite reruns, because no app code changes.
- **Identities.**
  - The prior approved copy is `approved-394f724bd7735d7dc4b1cd5b571b9deeb1f4315f825fb2ff721149f5837fef77.md`. The new identity is the `content_hash` in the frontmatter.
  - Candidate `d38d9a3` will be superseded by a new test-only commit on top of `de9966a`.
- **Invalidated:** the scoped mutation result on `d38d9a3` as the final pass (it stays as evidence of the survivor and the NoCoverage mutants). The gates and heavy runs on `d38d9a3` remain valid for the app code, which does not change.

**Follow-up (2026-10-18T20:45, /rpiv:revise, s5b just in time, decisions §134):**
- **What changed.** Inserted lines only; no existing line changed. The inserts:
  - the new slice `u2b-s5b-effect-gate`, with its facts, its design points, its `### Test Contract: u2b-s5b-effect-gate` and its `### Success Criteria: u2b-s5b-effect-gate`, placed before Deferred Work;
  - one Deferred Work paragraph for the TS 7 compiler switch after Part A (§134.1);
  - frontmatter `last_updated` and `last_updated_note`;
  - this entry.
- **Why.** Pedro's §134 decisions: the Effect gate runs in `pnpm check` on Windows and in CI (§134.2); the curated set as proposed (§134.3); a slice of its own before s6 (§134.4). The coordinator's s5b scope is in §134.
- **Mapping.** New behaviour IDs U2B-EG-B1 … B9, in slice u2b-s5b-effect-gate, between s5 (accepted, `cef7554` / `1c33122`) and s6. No existing ID changes. The s6-s8 outlines are unchanged; EW6-EW8 name s6 and s7 as removal triggers.
- **Lane.** normal, from `lane.mjs --paths` over the planned files (output in the slice's Lane line). This equals the feature lane, so there is no raise.
- **Deviations from the coordinator's instruction, each disclosed:**
  - The gate runs the Effect build in tsc mode, not `effect-tsgo diagnostics`. That command needs an installed TS ≥ 7 package, which is the compiler switch that §134.1 places after Part A. This was measured on 2026-10-18 (slice facts).
  - "Add the gate to the CI job": no `ci.yml` change is needed, because both jobs already run `pnpm check`. That puts the gate on the Windows runner as well. Whether Defender on that runner flags the binary is unknown; if it does, the failure is visible (B2), never clean.
  - The waivers get a machine-checked register (B4), which goes beyond "register with removal triggers". It is there so that a new directive cannot silently waive a hit.
- **Decisions for Pedro (P-S5B):**
  - **P-S5B-1:** the supervisor shutdown timeout becomes `HarnessShutdownTimeout` (same message, same status), and the pin's assertion at `harness-supervisor.test.ts:632` changes accordingly (B8). The alternative is a registered waiver for `globalErrorInEffectFailure`, which §134 does not allow.
  - **P-S5B-2:** the EW1-EW8 removal triggers in design point 4.
  - **P-S5B-3:** EW9 (`conversation-test-harness.tsx`, renderer test support in `src`). The choices are: (a) a waiver whose removal trigger is the React port moving test support out of `src`; or (b) widen the test override to `**/*-test-harness.tsx`, which leaves 8 waivers instead of the 9 that §134 names. Recommended: (a), which keeps §134 exact.
  - **Coordinator call:** the gate tests spawn a real binary and use temporary disk, as `check-golden-sql.test.mjs` does. Do they stay in `scripts/*.test.mjs` (unit project), or move to integration? The assertions do not change.
- **Identities.** The prior approved copy is `approved-b5fe4a70bbdb86d83b150232ebb8d6f06b4966ecc99b170217755374f0ccbdcf.md`. The new identity is the `content_hash` in the frontmatter. This revision adds normative content (a new slice), so it reopens approval: Pedro approves the new hash before build.
- **Invalidated:** none. s1-s5 acceptances and their evidence are untouched.

**Follow-up (2026-10-18T21:57, /rpiv:revise, s5b Test lines, format only):**
- **What changed (lines added only).** `slice-preflight 1c33122..54d2e12` reported `no-test-line` for U2B-EG-B6, B7 and B9, because its parser reads only `  - Test:` lines and those behaviours listed "Pins" or an "Oracle" (as with s5 B2). Each now has one `  - Test:` line naming, at candidate `54d2e12`, the existing tests that hold the pins already cited:
  - B6: the enclosing test of each cited pin line; `registration-registry.test.ts:88` resolves to `stops the standalone authority of its options: $name`, the row that failed in the s5b binding (`b6-registry.log`). The `storageSyncStep` row is the one the implementer added as the brief allowed (`keeps a typed storage failure from the synchronous witness step`).
  - B7: `aggregates the program and the dispose: $name` (the :158 and :208 rows; the `b7-memo.log` binding fails all six).
  - B9: `passes on the repository`, the B5 test whose real-tree run checks the register and the waived sites.
- **Meaning:** unchanged. No behaviour, oracle, expected red or pin is added or altered; the existing Pins, Oracle and Binding lines stay verbatim. The B9 diff check stays in candidate review.
- **Proof:** the preflight `1c33122..54d2e12` now exits 0 (`preflight: partial`). The remaining `unchecked` lines (B5 :1312 prose clauses, B8 :1334 row reference) predate this change and are not findings.
- **Identities.** Prior approved copy: `approved-5d6aed56f5216620041a3322e5d19d6ad8e7bf2d32021679a89702356524c8c6.md`. The new identity is the frontmatter `content_hash`; Pedro re-approves it before the candidate review.
- **Invalidated:** none.

**Follow-up (2026-10-18T22:30, /rpiv:revise, s5b candidate review round 1, decisions §134):**
- **Review.** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s5b-round1.md`.
  - Reviewed: slice-verifier, candidate `54d2e12`, contract `54feb32c…`.
  - Outcome: failed, with 1 blocker (S5B-R1-1), 4 concerns (R1-2 to R1-5) and 5 suggestions (R1-6 to R1-10). Each was verified by claim-verifier.
- **What changed (lines added only):**
  - B2: a Re-observation sub-bullet (S5B-R1-1);
  - new behaviours U2B-EG-B10 (R1-2), B11 (R1-3), B12 (R1-6) and B13 (R1-7);
  - two TDD-exempt items: R1-4, with the exact AGENTS.md:78 wording, and R1-10;
  - the round-1 order of work;
  - a round-1 Success Criteria bullet (R1-5 included);
  - frontmatter;
  - this entry.
- **Decisions:**
  - Pedro: R1-1 (a), re-observe the B2 red on a scaffold-only copy, with no code change; R1-4 (a), reword AGENTS.md:78 so that the gate blocks every error it reports, with `pnpm typecheck` (TS 6) as the type-checking authority.
  - Coordinator: R1-2, R1-3, R1-6, R1-7 and R1-10 are fixed in a new candidate, with pins and bindings. For R1-5, CodeScene scores every changed file and its tool output is saved. No heavy reruns.
- **Disclosed in the re-observation.** The contract's predicted throws for `missing executable`, `spawn error` and `killed` describe the real binary, not the fakes. Against the scaffold, those rows are expected to return `{ ok: true }`, the silent-clean case. That counts as red because the scaffold's text, which is logged, shows it consumes the fakes. Only `missing package` can throw (from the fake `resolve`).
- **R1-8, carried to s6:** EW6 (`canonical-writer-package-smoke.ts:298`) and EW8 (`main.ts:81`) name `u2b-s6-desktop-runtime` as their removal trigger, but the s6 outline has no removal item. When s6 is detailed just in time, its contract adds one behaviour: the two Promise sites become Effect code, their waiver lines and directives are removed, and EW6/EW8 leave the register. A stale entry fails the gate, so the register itself is the red. The s6 outline lines stay unchanged until then.
- **Residuals (coordinator, §134), no change:**
  - R1-9: `b5-opening.log` has no command or digest; its per-site counts match the #105 Docker counts.
  - W4: the canary pins 2 of the 8 error rules (brief-sanctioned).
  - W7: the `storageSyncStep` row checks only the kept half, by class and message; the dies half is unreachable.
  - W8: the B4 seam is an injected `root`, not an injected reader; the oracle is unaffected.
  - W10: the CLI main-module guard exits 0 on a path mismatch, as in `check-golden-sql.mjs:58`.
  - W13: the registry also unwraps admission failures (identical today).
- **Identities.** The prior approved copy is `approved-54feb32c9f7534357833ad52516aaae4c0854fbdf7484d26d2343d2120976c68.md`, and the new identity is the frontmatter `content_hash`. The new behaviours reopen approval, so Pedro approves the new hash before the round-1 build.
- **Invalidated:**
  - the B2 red evidence `b2-red.log`, which is replaced by the re-observation log and kept, marked as not counted;
  - candidate `54d2e12` as the slice's final candidate: the round-1 fix commit replaces it. Its B1-B9 evidence stays valid for the code it covers; round 2 reviews the incremental change.

**Follow-up (2026-10-18T23:02, /rpiv:revise, s5b candidate review round 2, the last, decisions §134):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s5b-round2.md`.
  - Reviewed: the slice-verifier, on candidate `010ee05` (base `1c33122`, incremental from `54d2e12`), against contract `9ce8bef7…`.
  - Outcome: completed, with no blocker. There is 1 concern (S5B-R2-1), 6 suggestions and 1 info. The claim-verifier checked them, and `convergence: keep` (blockers went from 1 to 0).
  - Round-1 findings: all are resolved, except that the R1-5 "each scoring 10" is met only in part (below).
- **Decisions at the round cap:**
  - Pedro chose "Aceitar com riscos": the open findings are accepted as residuals, with the triggers below.
  - The coordinator chose S5B-R2-5 (a): the implementer re-observes the B5 binding once on `010ee05`, with `pnpm check:effect` only, as evidence. This brief does not record that result; the TDD evidence does.
- **S5B-R2-3 (the B12 red observed):** the B12 Expected red said `registered under tests` would be "none — pin". It was observed red instead (`2026-10-18_123-s5b-r1/b12-red.log:39-49`):
  - At `54d2e12` the register scan reads only `apps/*/src`, so the entry for `apps/sample/tests/a.ts` found no directive and returned `EFFECT_GATE_WAIVER_STALE`.
  - That red fails for exactly the behaviour B12 adds, and the row's oracle is unchanged. It is more proof, not less.
  - The contract line stays as approved; this entry is the correction of record.
- **S5B-R2-4 (CodeScene criterion):** the round-1 Success Criteria say every changed source and test file scores 10. That holds for 24 of the 27 files in `1c33122..010ee05` (`2026-10-18_123-s5b-r1/codescene-scores.log`). The exceptions:
  - `apps/harness/src/registration/project-registration-preparation.ts` scores 8.03. This is pre-existing debt: the four findings are the same before and after s5b, each moved down by one line by the added import (`codescene-preparation-pre-existing.log`). Pedro deferred it to Part B (§134), so it is a debt item, not an s5b defect.
  - `apps/harness/scripts/effect-diagnostics-canary/src/planted.test.ts` and `tests/planted.ts` cannot be scored ("Could not determine Code Health score."). They are planted one-line fixtures, recorded as they are and never as 10.
- **S5B-R2-6 (combined mutation scope):** the s5b entries for the combined run are extended. These ranges are at `010ee05`; the run re-resolves them on the final combined candidate.
  - `mutate`:
    - besides the classification and canary comparison, the round-1 logic in `apps/harness/scripts/check-effect-diagnostics.mjs`;
    - `failure()` and its 20-line cap (:19-22);
    - the canary comparison and `canaryMismatch` (:157-175);
    - the success result's `projects` (:191);
    - the register scan (:215-253), including the extension filter (:221) and the `node_modules` exclusion (:242);
    - `incompleteEntries` (:256-262).
  - Pin first: before the run, a register row pins the `node_modules` exclusion, `directive under node_modules is ignored`, in `keeps the waiver register exact: $name`. A directive in `apps/sample/node_modules/x/a.ts` with no entry passes the register step. Its binding: removing the exclusion makes the row fail with `EFFECT_GATE_WAIVER_UNREGISTERED`. A row for a widened extension filter is optional; a survivor there is triaged at the run.
  - Survivors follow the combined run's rules.
- **Residuals (Pedro, §134), each with its trigger:**
  - **S5B-R2-1:** the 20-line cap in `failure()` also cuts `EFFECT_GATE_VIOLATIONS`. With more than 20 hits, stderr shows 19 of them plus "… N more", and the full list is never printed. DP2 says each violation is listed, while B11 caps every failure at 20 lines.
    - Harmless today, with 0 hits.
    - Trigger: the TS 7 compiler switch slice (§134.1). There, only excerpts of tool output are capped, and every violation is printed, with a row of more than 20 planted violations.
  - **S5B-R2-2:** a canary run with exit 1 and one duplicated expected line is a `CANARY_MISMATCH`, through the length check, but it has empty `lines`: `extra` and `missing` use `includes`, so they ignore counts.
    - Trigger: the same slice. The comparison becomes count-aware, with one row.
  - **S5B-R2-7:** the round-1 logs (`b10-pin`, `bind-b10-*`, `b11-*`, `b12-*`, `b13-*`) carry no HEAD, command or digest. Their identities are only in the TDD evidence, and B12 green has no digest. This is the same class as R1-9.
    - Trigger: none. It is accepted as is; later logs start with HEAD and their command, as the `final/` logs do.
- **Not a finding:** S5B-R2-8. The fixes landed as a new commit rather than an amend, as this brief's round-1 order of work approved. This is noted for the combined acceptance.
- **Slice state:** s5b's gates are passed under the normal lane, with these residuals. Once the R2-5 evidence is recorded, `010ee05` becomes the predecessor for s6. The two Manual criteria stay pending and block the combined acceptance.
- **Identities:**
  - Prior approved copy: `approved-9ce8bef74cbe96ab62bff3c491e328266d4f4a42dabbc64e335f9e8172ec0e8d.md`.
  - New identity: the frontmatter `content_hash`.
  - This entry changes no s5b behaviour; it adds one mutation-time pin row for the combined run. Pedro approves the new hash.
- **Invalidated:** none.

**Lane raise, s6 (2026-10-18):** `lane.mjs --paths` over the s6 planned files gives rigorous ("files: 9 > 5", "sensitive word: ipc"). D15 had s6 normal. A lane only rises, so the s6 `Lane:` line records rigorous. The feature lane in the frontmatter stays normal, because s7 and s8 are still planned normal; each is re-checked when it is detailed.
- What rigorous adds for s6:
  - intent review (the slice-verifier and the code and coverage reviewer pair, a fan-out that needs the coordinator's GO);
  - the pair at candidate review;
  - Pedro's per-slice acceptance;
  - a scoped mutation run on the final candidate (D13).
- The slice still runs in the linked worktree `slopstop-123`.

**Follow-up (2026-10-18T23:07, /rpiv:revise, s6 detailed just in time, decisions §135):**
- **What changed (lines added only):**
  - `### Slice u2b-s6-desktop-runtime`, with its facts and design points, `### Test Contract: u2b-s6-desktop-runtime` (U2B-DR-B1 … B7) and `### Success Criteria: u2b-s6-desktop-runtime`, placed after s5b and before Deferred Work;
  - the lane-raise entry above;
  - frontmatter;
  - this entry.
  - The s6 outline in Deferred Work stays as written. Where the two differ, the detailed contract governs.
- **Mapping:**
  - DR-B1 to B5 keep their outline IDs. Refinements:
    - B1 adds the dispose bound;
    - B2 gets a shutdown seam as well as the main seam;
    - B3 adds the controller gate and the exact D11 envelopes;
    - B4 is the characterization with a binding;
    - B5 names the pins.
  - DR-B6 is new: the Layer safety net, which the outline lacked.
  - DR-B7 is new: the R1-8 carry, from the Follow-up at 22:30.
- **Deviations from the outline and the Architecture, each disclosed:**
  - DR-B3's outline red named "workspace and list answer `broken`". The measured gap is list, registration and workspace. The other channels already answer their D11 envelope through the `unsent` fault, so their rows are reds only against the scaffold, at the new IPC edge.
  - The Architecture says the stop program "runs on the runtime". In this design it keeps its own requirement-free edge (P-S6-5).
- **Decisions for Pedro (P-S6):**
  - **P-S6-1, when IPC starts answering `unavailable`:**
    - (a) **Recommended:** from the turn shutdown starts. Without it, a request during the harness stop (up to 15 s) answers `broken` `…_TRANSPORT_FAILED` for list and registration, and `broken` for workspace.
    - (b) Only after dispose, which is D11's literal text. Requests during the stop window would then keep today's `broken` answers.
  - **P-S6-2, `chooseRepository` after close:**
    - (a) **Recommended:** answer `PROJECT_REGISTRATION_UNAVAILABLE` without opening the folder dialog.
    - (b) Open the dialog and let the gated `registerProject` answer.
    - Also the workspace text: "The workspace is unavailable while SlopStop closes."
  - **P-S6-3, the dispose bound:**
    - (a) **Recommended:** 1 000 ms (`DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS`). A miss is `DesktopRuntimeDisposeUnconfirmed`, followed by `exit(1)`.
    - (b) Unbounded, which can hold quit open forever if a release hangs.
  - **P-S6-4, the EW6 scope:**
    - (a) **Recommended:** `OwnedUtility.wait` becomes `Effect.callback` behind a recorded Promise facade for its 15 callers, with the removal trigger "the writer package smoke migrates to Effect (Part B)".
    - (b) Migrate the whole 923-line writer smoke now. That is larger and riskier, and it touches the package proof.
    - (c) Keep the EW6 waiver and retarget its trigger to Part B. That contradicts the R1-8 carry as written.
  - **P-S6-5, where the stop program runs:**
    - (a) **Recommended:** its own requirement-free `Effect.runPromise` edge, as today. Running it on a runtime that was never built would build the whole Layer, logger and supervisor included, during a failure exit.
    - (b) On the runtime, as the Architecture text says. That would need a guard that skips the program when the runtime was never built.
  - **Lane:** rigorous (above). The coordinator's GO is needed for the intent review fan-out before build.
- **Identities:**
  - Prior approved copy: `approved-f013ea5f37192ff37c73eee0f60f6c713b597e94783c267c5d7e6f7546b9d3e6.md`.
  - New identity: the frontmatter `content_hash`.
  - The new slice reopens approval. Intent review runs on that hash, and Pedro approves the result before build.
- **Invalidated:** none. The s1-s5b acceptances and their evidence are untouched.

**Follow-up (2026-10-18T23:24, /rpiv:revise, s6 decisions §135):**
- **Decisions:**
  - Pedro: P-S6-1 (a), so IPC answers `unavailable` from the turn shutdown starts.
  - Pedro: P-S6-2 (a), so `chooseRepository` opens no dialog. The workspace text is "The workspace is unavailable while SlopStop closes.".
  - Pedro: P-S6-3, "Medir primeiro, depois 1 s". The dispose bound is 1 000 ms and a miss exits 1, but the bound is measured first, as in s5.
  - Pedro: P-S6-4 (a), the `wait` facade, with its removal trigger in Part B.
  - Coordinator: P-S6-5 (a), the program keeps its own requirement-free `Effect.runPromise` edge.
- **What changed (lines added only, on the unapproved `14883cde…` draft):**
  - a "Measured first" line in design point 3;
  - the opening measurement as step 0 of the s6 order of work: two cells, quiet and burst, 200 samples, the §116 burst, the half-the-bound rule at 500 ms, the coordinator's GO at run time;
  - a correction line under the Architecture's Electron main process, which supersedes "runs on the runtime";
  - frontmatter;
  - this entry.
- **Identities:**
  - Prior approved copy: `approved-f013ea5f….md`.
  - New identity: the frontmatter `content_hash`.
  - Intent review round 1 (coordinator GO, §135) runs on this hash, and Pedro approves after it.
- **Invalidated:** none.

**Follow-up (2026-10-18T23:51, /rpiv:revise, s6 intent round-1 fixes, decisions §135):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-s6-round1.md`.
  - The three reviewers reviewed `f96a6b4b…`, and all three failed it.
  - The merged findings are 6 blockers, 12 concerns and 10 suggestions, numbered S6-I1 to S6-I28. claim-verifier verified them.
- **Decisions:**
  - Pedro: S6-I12 (a), the gate is re-read after the folder dialog, so the answer is unavailable and nothing is registered.
  - Pedro: S6-I15 (a), the Architecture is corrected, and s7's core merges the three bridge services into one `HarnessBridges` service.
  - Coordinator: S6-I10 (a), step 0 runs as an Electron main script with the real supervisor.
  - Coordinator: every other row is applied as proposed. For S6-I21, the wait call sites number 11.
- **What changed:**
  - The s6 section (slice, Test Contract and Success Criteria) is rewritten as a whole. All of it is new against `approved-f013ea5f…`, so the append-only check still sees added lines only.
  - One correction line is added under the Architecture's Electron main process (S6-I15), and one line to the s7 outline.
  - Frontmatter and this entry.
- **Row mapping:**
  - **I1 and I8:** the once-latched service `stop` and the `closeIfNeverStopped` release (design point 1). New B6 rows: `program then dispose`, and `supervisor stop rejects` with and without the program.
  - **I2:** `accepting()` never reopens. The B3 controller rows check it after `stop()` settles, and the main rows call each handler again after dispose.
  - **I3 and I13:** two B4 rows, the lock-refused ordinary launch with `before-quit`, and `authorization refused`. Design point 5 states that the stop callbacks read only the cached context.
  - **I4:** two B1 aggregation rows. Design point 2 states the failure order.
  - **I5:** the B1 main row `disposes the main runtime before quit`, observed through a `vi.mock(importOriginal)` wrapper.
  - **I6:** the B3 main rows become a `$channel` table: list, register and workspace query.
  - **I7 and I19:** the ports are thunks. The services are read with `runtime.runSync` where `createMainLogger` runs today. New B5 row: `reads the desktop services after their paths are set`.
  - **I9:** design point 7 is corrected, so the resume path does the cleanup and the canceler only covers interruption. New B7 pin with a binding: `leaves no timer after a wait: $outcome`.
  - **I10:** the Electron main script for step 0.
  - **I11:** the registration test is new, with its own mock. The platform is pinned, there is a row off Windows, the gate is read before the capability check, and the citation is now `:28-45`.
  - **I12:** a B3 row with the dialog open.
  - **I14:** `keeps exactly the registered waivers`. Its red is the 9 ids at `de29eec`.
  - **I16:** the s6 mutation config, its include list, its command and its pass rule. `registerWorkspaceIpc` and `writeWriterProofReport` are named.
  - **I17:** the `main.ts` scaffold in step 1.
  - **I18:** the B6 row `build fails after the logger`.
  - **I20:** the Affected source and Affected tests lists.
  - **I21:** the facts are fixed (`:344`; 11 call sites). §135's "15" refers to the same 11 sites.
  - **I22:** the bridges export their envelope builders and `capabilityForIntent`.
  - **I23:** the switch fake changes.
  - **I24:** the release order follows the Layer dependencies, a D1 refinement.
  - **I25:** B1's order rows leave out the entry stop.
  - **I26:** the manual trigger is File → Exit, with a devtools list request.
  - **I27:** the facade record is a TSDoc line plus a Part B line.
  - **I28:** every gated channel with a value is also checked with malformed input.
- **Intent round:** under the 2-round cap (coordinator, §135) the confirming review is round 2, the last. If it still finds a blocker, the cap choices apply (shared **Lanes**).
- **Identities:**
  - The prior approved copy is `approved-f013ea5f….md`.
  - Reviewed in round 1: `f96a6b4b…`.
  - The new identity is the frontmatter `content_hash`.
- **Invalidated:** the round-1 review of `f96a6b4b…`, which is superseded by round 2. s1-s5b are untouched.

**Follow-up (2026-10-19T00:17, /rpiv:revise, s6 intent cap: J1-J22 applied without a third round, decisions §135):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-s6-round2.md`.
  - Round 2, the last, reviewed `e7e6fd09…`. It found no blocker, 9 concerns and 13 suggestions (S6-J1 to S6-J22).
  - claim-verifier verified the findings.
- **Pedro's decisions at the cap (§135):**
  - (1) "Aplicar sem 3a ronda": J1 to J22 are applied by this revision, with no further intent review.
  - (2) S6-J7, "Declarar ja os 3": the defensive canceler's lines leave the s6 `mutate` ranges. The listener-removal mutant and the EW8 error-text and tag mutants are declared in advance as survivors, each with its written reason. This is the s6 exception to "all killed", following the s1 R6 precedent.
  - (3) The candidate review after build gets round 1, ONE fix round, and a confirming round 2. This is written into the s6 order of work as step 7.
- **What changed:**
  - In the s6 section, which is entirely new against `approved-f013ea5f…`:
    - design point 1: ports with owner factories (J1); the logger is built with `Layer.sync` and has no release (J17); the release-order wording (J18); the `unavailable` builders are hoisted to module level (J12); a quit before ready returns early (J11); the facade record (J2);
    - Non-goals: in-flight requests (J10);
    - Fixtures: separate gated fakes (J13), schema-valid registration fakes (J21), `importOriginal` bridge mocks (J19), a stateful `getPath` (J3), fake owner factories (J1), the timer allowance (J16);
    - step 0: the esbuild bundle and the run command (J5);
    - step 7: the candidate review rounds (decision 3);
    - B1 rows: a deferred harness stop (J4), a deferred dispose in the main row (J15);
    - B3: the controller wording (J22);
    - B4 rows: `app.quit` called twice (J8), a new `before-quit before ready` row (J11);
    - B5: the path row, now with a scenario, the stateful `getPath` and a binding (J3);
    - B6: the `createSupervisor` throw (J1), a new `stop twice` row (J9);
    - B7: the timer pin, driven by bounded steps (J6);
    - TDD-exempt wording (J2);
    - mutation: the canceler is excluded and the survivors are pre-declared (J7);
    - the manual request-during-quit check (J14).
    - J20 is covered by J3's binding.
  - Outside the s6 section, one line is added under Deferred Work, "Deferred beyond Part A": the writer package smoke migrates to Effect and the `wait` facade is removed (J2).
  - Frontmatter and this entry.
- **Unreviewed delta (residual risk, Pedro's decision (1)):** no independent review has checked this revision against `e7e6fd09…`. The candidate review rounds after build (step 7) are the next independent check of these contract lines.
- **Identities:**
  - Prior approved copy: `approved-f013ea5f….md`.
  - Reviewed drafts: `f96a6b4b…` in round 1 and `e7e6fd09…` in round 2.
  - The new identity is the frontmatter `content_hash`, which Pedro approves before build.
- **Invalidated:** none beyond the earlier drafts. The s1-s5b acceptances and their evidence are untouched.

**Follow-up (2026-10-19T14:20, /rpiv:revise, s6 candidate review round 1, decisions §135):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s6-round1.md`.
  - Candidate `b0e92fc` against contract `1f402a8f…`.
  - No blocker. 1 low-impact Decisions violation (S6-K1), 3 concerns (K2, K3, K4) and 12 suggestions. claim-verifier verified them.
  - All of the implementer's D1-D8 disclosures were accepted.
- **Decisions:**
  - Pedro, S6-K13 ("Tirar se sobrarem"): check the Effect source first. If a second resume is ignored, remove the `settled` guards; otherwise a test kills them. Nothing is declared in advance.
  - Coordinator: S6-K1 to K6 and S6-K8 to K12, plus the K13 check, are the ONE fix round, with rows and bindings. S6-K7, K14 and K15 go in this Follow-up. S6-K16 is checked at the mutation run. Heavy runs: e2e and `package:smoke` on the fix candidate.
- **What changed (lines added only against `approved-1f402a8f…`):**
  - "Fix round 1" sub-bullets under B1 (K10), B3 (K1, K4, K5, K12), B4 (K6), B5 (K9), B6 (K2, K3, K11) and B7 (K13, K8);
  - three new Test lines: `forwards registration while the IPC gate is open: $channel`, `logs the desktop start before building the owners` and `passes each bridge its session, id and clock`;
  - the K6 mutate ranges in Success Criteria;
  - order-of-work step 8;
  - frontmatter;
  - this entry.
- **S6-K7 (corrections of record):**
  - The B4 row `before-quit before ready` (S6-J11) is a behaviour row, not a pin. Its Expected red was observed at the scaffold, digest `04c55d0c…`: `createMainLogger` was called once (`2026-10-19_123-s6-tdd/main-red.log:126-127`). Then it went green.
  - The B6 row `stop twice` (S6-J9) has the Expected red observed at the scaffold: "expected … to be called once, but got 2 times" (`scaffold-red.log:116`).
  - These two entries correct B4's "none — pin" and B6's missing red. The contract lines stay as approved.
- **S6-K14 (correction to J7):**
  - StrykerJS has no mutator for the bare call `this.proof.changes.delete(check)`. It is removed only when the BlockStatement mutant empties the whole `finish` body, and that mutant counts normally.
  - The pre-declared listener-removal survivor therefore has no individual mutant to cover.
  - The EW8 `_tag` and message StringLiteral mutants are generated (hybrid, since `main.js` is imported per test). They stay pre-declared, with the J7 reason.
- **S6-K15 (evidence identity):**
  - The five `final-bind-*.log` files on `b0e92fc` record digest `2e499324f4df0389`, while the final gates record `037fd9e87a6cfca8`. The likely cause is untracked files that were staged in between.
  - Step 8 re-runs every binding on the fix candidate and records them against that candidate's digest. The `b0e92fc` bindings stay as history.
- **Identities:**
  - Prior approved copy: `approved-1f402a8f….md`.
  - The new identity is the frontmatter `content_hash`.
  - The fix-round rows add contract lines, so approval reopens: Pedro approves the new hash before the fix round is built.
- **Invalidated:** candidate `b0e92fc` as the final candidate, which the fix candidate replaces. Its reds, greens and heavy runs stay as history for the code they cover.

**Follow-up (2026-10-19T15:55, /rpiv:revise, s6 candidate review round 2, cap decisions §135):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s6-round2.md`.
  - Candidate `34641bc`, against contract `491da0ba…`.
  - Result: failed, with 1 blocker (S6-L3, the mutation gate), 4 concerns (L1, L2, L4, L7) and 6 suggestions. claim-verifier verified R1 to R10. `convergence: keep`.
  - L1 is a real hang that the fix introduced: a throwing failure report skips `exit(1)` after `preventDefault`.
- **Pedro's decisions at the cap (§135):**
  - (1) "Mais uma ronda curta": one more fix round for L1 to L11, then a short confirming review limited to those rows.
  - (2) S6-L3 option (a): one mutate range, `canonical-writer-package-smoke.ts:300-339`, with `// Stryker disable all` / `// Stryker restore all` around the canceler (`:333-337`), citing J7. The "all killed" rule stays.
- **What changed (lines added only against `approved-491da0ba…`):** "Fix round 2" sub-bullets under:
  - B1: L1, with a new row `a throwing report still exits 1`; and L4, an assertion change in the B1 main row;
  - B2: L2, which asserts `logError` in the B2 main row;
  - B5: L11, which asserts crash reporting in the K9 row;
  - B6: L7, which pins exactly two bridges; L8 and L10, TSDoc notes; and L6, which drops the default `"sequential"`;
  - B7: L9, the citation, including decisions-log line 1596 (§135, K13), which says `:1167-1168` and should say `:1169-1170`;
  - Success Criteria: L3 (a) and L5, the mutate ranges.
  - Also added: order-of-work step 9, with the scope of the short confirming review; frontmatter; and this entry.
- **Assertion changes, stated:**
  - L4 changes what the B1 main row asserts: it adds the program's bridge-stop order.
  - L2, L7 and L11 strengthen existing rows.
  - No existing assertion is relaxed.
- **Scope of the short confirming review (proposed in step 9):**
  - The slice-verifier and the coverage reviewer, on the incremental diff `34641bc..<new candidate>`, limited to S6-L1 to S6-L11 and to regressions in that delta.
  - The code reviewer is not run.
  - Findings left after it go to Pedro, with no further fix round.
- **Identities:**
  - Prior approved copy: `approved-491da0ba….md`.
  - The new identity is the frontmatter `content_hash`.
  - The new row and the changed assertion reopen approval, so Pedro approves the new hash before fix round 2 is built.
- **Invalidated:** candidate `34641bc` as the final candidate. Its evidence stays as history for the code it covers.

**Follow-up (2026-10-19T17:37, /rpiv:revise, s6 short confirming review: Pedro's decisions, §135, main `b051fa3`):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s6-round3-short.md`.
  - The slice-verifier and the coverage reviewer checked candidate `01280f1` (tree `5b696627…`) against contract `c006beb3…`.
  - All of S6-L1 to S6-L11 are resolved, and no product defect was found.
  - One blocker remains, on the mutation gate (S6-M1), with suggestions M2-M7. claim-verifier verified W1-W5 and L9.
- **Decisions (Pedro, §135, committed on main `b051fa3`, which also closes S6-M6):**
  - F1 is ratified: the L1 choice (a) stands.
  - S6-M1 option (b): `reportFailure` becomes required.
  - S6-M5 is accepted as a residual.
  - No further review follows. The M1 (b) change gets light gates only, and the change made without review is a named residual.
- **S6-M7, correction of record for L1:** the B1 "Fix round 2" line describes `try { options.reportFailure?.(error) } finally { options.exit(1) }`. That literal form is superseded by `try { options.reportFailure(error) } catch { } finally { options.exit(1) }` (`desktop-shutdown.ts:111-116` at `01280f1`, before M1 removes the optional chaining).
  - The coordinator chose this form (a) because the literal try/finally still let the report's throw escape as an unhandled rejection through `void finish()` (`2026-10-19_123-s6-fix2/l1-green-attempt1.log`). Pedro ratified it (F1).
  - The L1 row and its oracle are unchanged: a throwing report still exits 1, exactly once, and never quits.
  - The empty catch drops only the reporter's own error. `stop()` still rejects with the original failure, and `exit(1)` marks it (degrade-distinguishes-broken holds).
- **S6-M1 (b), what changes:** `createDesktopShutdown`'s `reportFailure(error): void` becomes a required option, and `finish` calls `options.reportFailure(error)` without optional chaining. This removes the equivalent OptionalChaining mutant by restructuring.
  - Callers: `main.ts:99` already passes the logger-backed reporter (no change). The test controllers are the eight B5 pins (`desktop-shutdown.test.ts:25`, `:62`, `:94`, `:110`, `:144`, `:171`, `:194`, `:216` at `01280f1`) and the `recording` fixture (`:246`). Those without a reporter gain `reportFailure: () => {}`. This is a fixture-only change: no assertion changes, and the B5 pins stay pins.
  - Rows: the three K10 rows and the L1 row keep their assertions. No new row is needed, because the required option is enforced by the type checker (`pnpm typecheck`).
  - Binding observation, once, restored by digest: putting `?.` back in front of the call while one fixture omits the reporter makes `pnpm typecheck` fail. This shows the option is required at the type level.
  - Expected red: none — pin. The behaviour is unchanged, and only the type contract tightens.
- **S6-M2 and S6-M3, how K16 is read at the scoped run.** Line numbers are at `01280f1`; M1 changes no line in `canonical-writer-package-smoke.ts`. K16 is met when the Stryker report shows all of the following:
  - the BlockStatement mutant of the `polling` body (`:306-341`) and the BlockStatement mutant of the `Effect.callback` register body (`:307-340`) are listed and counted (killed, or triaged under the pass rule);
  - every mutant inside the canceler (`:334-338`) is listed as `Ignored`, with the J7 reason taken from the `// Stryker disable all` directive at `:333`;
  - `// Stryker restore all` at `:339` is a trailing comment, which Stryker does not read (it reads only leading comments). It has no effect, and it is harmless here because only closing braces follow it inside the range. The run evidence records this. If code is ever added after the canceler within the range, the restore must move before the next statement.
- **S6-M4, TSDoc nit (residual, comment only):** the L8 TSDoc on `builtDesktopServices` (`desktop-runtime.ts:95-96`) still says the B2 main row does not catch `cachedContext` drift. Since L2, that row asserts `logError` exactly once, so it does catch it. The M1 (b) commit may correct this comment, since it touches no behaviour. If it does not, the comment stays a named residual.
- **S6-M5, residual (Pedro):** when the reporter itself throws, both the shutdown error and the reporter's error leave no trace beyond `exit(1)`. The risk is low, because the exit code still marks the failure.
- **Order of work, after the short review (step 10):**
  1. One M1 (b) commit on top of `1688a16`, then its evidence. Nothing is amended. It may include the S6-M4 comment fix.
  2. The M1 binding, with its digest recorded.
  3. Light gates: the s6 test files, `pnpm check`, `pnpm typecheck`, `pnpm check:effect`, `pnpm check:dead-code` and `pnpm check:duplicates`.
  4. CodeScene on the changed files.
  5. The designer's preflight `de29eec..<M1 candidate>`.
  6. No further review. The M1 change is a named residual, made after the last review round.
  7. Then the scoped s6 mutation, with the coordinator's GO: `stryker.desktop-s6.config.json`, the "all killed" rule with the J7 and K14 exceptions only, and K16 read as above.
  8. Then the two manual Windows checks, and Pedro's acceptance of the slice (rigorous lane).
- **Identities:**
  - The prior approved copy is `approved-c006beb3….md`.
  - The new identity is the frontmatter `content_hash`.
  - This entry sits in Developer Context, and M1 (b) restates a decision without adding a new test row. Whether it keeps approval is for the append-only check to say, and Pedro re-approves if it reopens.
- **Invalidated:** none. Candidate `01280f1` becomes the parent of the M1 commit.

**Follow-up (2026-10-19T18:23, /rpiv:revise, s6 scoped mutation closed, decisions §135):**
- **Runs:**
  - **First run:** candidate `5ed89e5` (the M1 (b) commit, tree `b67f0d2f`), in `.rpiv/artifacts/evidence/2026-10-19_123-s6-mutation/README.md`. Score 92.96: 217 mutants, of which 198 killed, 15 survived and 4 ignored. K16 was already met. The run stopped on 13 survivors outside the J7/K14 exceptions.
  - **Survivor fixes:** commit `54d30da` (tree `f93999ff5eca9169c6fd6f5d911826b9f46e4193`), in `.rpiv/artifacts/evidence/2026-10-19_123-s6-kill/README.md`.
  - **Rerun:** on `54d30da`, in `.rpiv/artifacts/evidence/2026-10-19_123-s6-mutation-2/README.md`. Score 94.23: 212 mutants, of which 196 killed, 12 survived, 0 timeout, 0 no coverage and 4 ignored. Every mutant not killed is in the allowed set. K16 is met (below).
- **Survivor triage (Pedro, §135: "Corrigir 6 + declarar 7", then "Declarar os 3"):** of the 13 survivors outside the exceptions, 3 were killed and 10 declared.
  - **Killed by restructuring `desktop-shutdown.ts`** (no assertion changed; the bindings are in the kill folder, each restored with blob and tree MATCH on `f93999ff`):
    - `:91` (now `:90`): the AggregateError branch comes first, so the equivalent `> 1` / `>= 1` comparison no longer exists. Binding `>= 1`: 9 rows fail.
    - `:132` (now `:129`): `requestedExitCode ??= options.requestedExitCodeOnQuit?.()` replaces the no-op `exitCode !== undefined` guard. Binding `&&=`: `maps a pending package smoke quit to one nonzero exit` fails.
    - `:9` (the `DesktopRuntimeDisposeUnconfirmed` tag): the test file imported the module once, so Stryker counted the class as static, and the `_tag` assertions never ran against that mutant. The `dispose never settles` row now uses a freshly imported module (`vi.resetModules()` plus a dynamic import, through a new `create` parameter of the `recording` fixture). This is a fixture change only. Binding `""`: the row fails.
  - **10 survivors declared equivalent by Pedro.** Their reasons are in `2026-10-19_123-s6-mutation-2/README.md`, "Allowed non-killed":
    - `desktop-runtime.ts:47`, `:52`, `:56`, `:60`, `:64`, StringLiteral on the five `Context.Service` keys. Any unique key behaves the same way, and each mutant empties one key, which still stays unique.
    - `main.ts:106`, OptionalChaining on `servicesAtShutdown()?.logger`. It differs only when the services were never built. There, the S6-L1 (a) catch swallows the TypeError, and `exit(1)` follows either way.
    - `main.ts:133`, ObjectLiteral `{ message }` → `{}`. It is in the same EW8 class as the pre-declared message text: `reportUnconfirmedWriterProof` replaces the rejection with fixed lines.
    - `canonical-writer-package-smoke.ts:302`, `:303` and `:316` (`Result.isFailure` → `false`, the trailing `checkWait` removed, `error === undefined` → `true`). These are equivalent at the public seam, for four reasons:
      - the checkWait state is monotonic, so the trailing check raises the same failure again;
      - every wait site is followed by an equivalent assert;
      - the trailing check predates s6 (`5f1bca3`);
      - the facade leaves in Part B (S6-J2).
      - An attempted gap row passed with and without `:303`, and was dropped (`2026-10-19_123-s6-kill/attempt-k303/`).
  - **Allowed set** (16 mutants not killed): these 10 declared equivalents; the EW8 pair already declared (`main.ts:123` tag, `main.ts:133` message; S6-J7, S6-K14); and 4 Ignored inside the canceler.
- **K16 at the rerun**, read as M3 specifies: the `polling` body BlockStatement (`:306-341`) is Killed, and so is the register-body BlockStatement (`:307-340`). The four mutants inside `:334-338` are Ignored with the S6-J7 reason. The trailing restore at `:339` is inert and harmless.
- **Note:** `project-entry-bridge.ts:79-79` (S6-L5) produces no mutant in either run. A single `as const` object holding a string literal generates none under the configured mutators; the claim of the L5 row stops there.
- **Named residual: the delta made after the last review.**
  - The short confirming review covered `34641bc..01280f1`.
  - The delta `01280f1..54d30da` had no independent review. It comprises:
    - the M1 (b) commit `5ed89e5`: `reportFailure` becomes required, and the test controllers get a no-op reporter, a fixture change only;
    - the survivor-fix commit `54d30da`: the `:90` and `:129` restructures and the `:9` fresh-import fixture.
  - Coverage: light gates on each tree (`pnpm check` with 3 207 tests, typecheck, dead-code, duplicates; s6 unit 402/402), CodeScene 10 on the changed files, the bindings above, and the mutation rerun.
  - Pedro accepted this as residual under §135. M1 (b): "no further review"; the survivor fixes: his triage decision.
- **Slice state:**
  - Final s6 code is `54d30da`, with evidence `623b3b0`.
  - Every automated gate of the s6 contract is met: reds and greens, bindings, light gates, CodeScene, heavy runs (e2e and `package:smoke` on `9e4a4814`, per the step-9 judgement since), preflight, candidate reviews (round 1, round 2, the short confirming review) and the scoped mutation.
  - **Awaiting Pedro:** the two Manual checks in the s6 Success Criteria, and then his acceptance of the slice (rigorous lane). The checks are:
    - quitting three ways on Windows: window close, `Alt+F4`, and File → Exit;
    - the request-during-quit check (S6-J14).
- **Identities:**
  - Prior approved copy: `approved-80dd3084….md`.
  - The new identity is the frontmatter `content_hash`.
  - This entry sits in Developer Context only; the append-only check decides whether the approval carries over.
- **Invalidated:** none.

**Lane raise, s7 (2026-10-19):** `lane.mjs --paths` over the s7 planned files gives rigorous ("files: 11 > 5", "sensitive word: session", "sensitive word: ipc"), while D15 had s7 normal. A lane only rises, so the s7 `Lane:` line records rigorous. The feature lane in the frontmatter stays normal. The raise brings intent review (a fan-out that needs the coordinator's GO), the reviewer pair at candidate review, Pedro's acceptance of the slice, and a scoped mutation run.

**Follow-up (2026-10-19T18:47, /rpiv:revise, s7 detailed just in time, decisions §136):**
- **What changed (lines added only against `approved-f61da9c1…`):**
  - `### Slice u2b-s7-bridge-core`, `### Test Contract: u2b-s7-bridge-core` (U2B-BC-B1 … B9) and `### Success Criteria: u2b-s7-bridge-core`, placed after s6 and before Deferred Work;
  - one correction line under the Architecture's "Ordering" line;
  - the lane-raise entry above;
  - frontmatter;
  - this entry.
  - The s7 outline in Deferred Work stays as written. Where the two differ, the detailed contract governs.
- **Re-check against s6 as built (`54d30da`):**
  - B1 holds: entry and workspace still let a throwing send escape.
  - B2 holds; the workspace pin is the `failure` case of `fails all pending work on %s` (`workspace-bridge.test.ts:591`).
  - B3 holds: storage and workspace decode inside the listener.
  - B5 holds: storage already settles in a `finally`, so its row is a pin.
  - B4 holds, but for a different reason than the Architecture gave. `HarnessSession` has no nested-emit queue today, so s7 must build it (design point 4), and the Architecture's "Ordering" line is corrected.
  - B6's ranges are re-resolved to test titles.
  - B7 (one `HarnessBridges` service, S6-I15), B8 (EW7) and B9 (S6-J10) are new.
- **s6 carries landing in s7:**
  - S6-I15: one service;
  - S6-J10: in-flight requests at shutdown, decided by P-S7-2;
  - S6-K8: the single `unsent` owner and the exported gate builders are kept;
  - S6-M4: the stale TSDoc clause is fixed;
  - S6-K11/L10: the internal-field notes are kept;
  - EW7's removal trigger is "u2b-s7-bridge-core".
- **Open questions for Pedro (P-S7):**
  - **P-S7-1, the Effect edge:**
    - (a) The bridge operations become Effects, and the IPC handlers and the package smoke run them through the main runtime (`runtime.runPromise`). This is the full AGENTS.md form, but it touches the three IPC modules, and every settlement goes through the runtime, which risks the pinned settlement timing (`f810132`).
    - (b) **Recommended:** an Effect core, with the bridge methods kept as recorded temporary Promise facades (`Effect.runPromise`) until C2 moves the IPC edge onto the runtime. The diff is smaller, the IPC contracts stay as they are, and the timing risk is lower.
  - **P-S7-2, requests in flight at shutdown (S6-J10):**
    - (a) **Recommended:** list, registration and workspace answer their D11 `unavailable` envelope, the same answer the s6 gate gives. Every other operation keeps today's answer, so an in-flight save stays `uncertain` (G25). This adds B9.
    - (b) Keep today's `broken …_TRANSPORT_FAILED`, and drop B9.
  - **P-S7-3, a payload decode failure is `protocol`** (P4). A project-entry save whose reply payload cannot be decoded changes from `broken` (the `desktop` fault) to `uncertain`, because the save may have been committed (G25).
    - (a) **Recommended:** accept.
    - (b) Keep `desktop` for project entry.
  - **P-S7-4, the fixed text for `system.failure`** in the Project Storage and workspace envelopes: "Harness reported a failure." This is Project Storage's existing text. It replaces workspace's forwarding of the raw text, a stated change to the pin at `:591`.
    - (a) **Recommended:** accept.
    - (b) Another fixed text.
  - **Lane:** rigorous, as recorded above.
  - **Candidate-review rounds:** round 1, then ONE fix round, then a confirming round 2, as in s6.
- **Identities:**
  - Prior approved copy: `approved-f61da9c1….md`.
  - The new identity is the frontmatter `content_hash`.
  - The new slice reopens approval. Intent review runs on that hash, and Pedro approves after it.
- **Invalidated:** none. The s1-s6 acceptances and their evidence are untouched.

**Follow-up (2026-10-19T18:53, /rpiv:revise, s7 decisions §137):**
- **Pedro's decisions (§137):**
  - P-S7-1 (b): an Effect core, with the bridge methods kept as recorded temporary Promise facades until C2 moves the IPC edge onto the runtime.
  - P-S7-2 (a): requests in flight when their bridge stops answer the D11 envelope for list, registration and workspace. Every other operation keeps today's answer, and a save stays `uncertain`. **B9 is in scope**: its "only under P-S7-2 (a)" condition is met.
  - P-S7-3 (a): a reply payload that cannot be decoded is the `protocol` fault, so a project-entry save with an undecodable reply answers `uncertain`.
  - P-S7-4 (a): the fixed `system.failure` text in the Project Storage and workspace envelopes is "Harness reported a failure.".
- **What changed:** only this entry and the frontmatter, with lines added only on top of `84d7d913…`.
  - Each decision matches the option the s7 slice section already wrote as recommended: design points 2 and 6, B2, B3 and B9. No contract line changes.
- **Identities:**
  - Prior approved copy: `approved-f61da9c1….md`.
  - Prior unapproved draft: `84d7d913…`.
  - The new identity is the frontmatter `content_hash`. Intent review round 1 runs on it (coordinator's GO, §137).
- **Invalidated:** none.

**Follow-up (2026-10-19T19:35, /rpiv:revise, s7 intent round-1 fixes, decisions §137):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-s7-round1.md`.
  - Reviewed draft: `5a762a64…`.
  - All three reviewers failed it, with 7 distinct blockers.
  - Findings S7-R1 … R29. The claim-verifier confirmed them (T10 only in part).
- **Decision:** Pedro accepted R7 (§137). The two rows `request failure settles only its correlated Project Storage operation` and `request failure settles only its correlated Workspace request` gain one flush step; their order and content assertions are unchanged.
- **What changed:**
  - The s7 section (slice, Test Contract, Success Criteria) is rewritten as a whole. It is still entirely new against `approved-f61da9c1…`, so the append-only check sees only added lines.
  - One C2 line is added under Deferred Work (S7-R23).
  - The frontmatter and this entry are updated. No earlier slice is touched.
- **Row mapping:**
  - **R1:** design point 3 limits the rule to reply events. New core rows `ignores non-reply events…`. Design point 4 keeps the workspace notification subscription. Two pins added: `publishes only increasing projection revisions per scope` and `ignores system readiness…`.
  - **R2:** `protocol` `uncorrelated` keeps the existing texts. B2's storage row is a real pin.
  - **R8:** the fault taxonomy has reasons, a `harness` message and `stopped` (design point 1). `project-conversation-failure.ts` is added. The plain-union choice is recorded.
  - **R9:** B2's workspace tuple is split and gains `not.toContain`.
  - **R3:** two construction paths (design point 6). B5 uses the standalone path.
  - **R4:** new B10 over the real `createHarnessBridges` (`harness-bridges.test.ts`).
  - **R5:** `createHarnessBridges` cleans up a partial construction. The two s6 build-failure rows are stated as assertion changes in B7.
  - **R10:** release isolation, first failure raised again, unconditional unsubscribe in a `finally`.
  - **R11:** `harness-bridges.ts` is named as the owner, and the main-test mock is a fixture change.
  - **R6:** the B9 `stop` case of `fails all pending work on %s` is stated in B6 (b).
  - **R7:** Fixtures and B6 (c).
  - **R14:** the storage stop text is unchanged (design point 5 table, design point 8).
  - **R15:** the closing-envelope owners move into the bridges. The IPC files and `main.ts` are added to Affected source.
  - **R12:** the D10 pins are named by title in B4.
  - **R16:** drain before rethrow, failures aggregated, the flag reset in a `finally`, plus a new session row.
  - **R13:** the B4 supervisor row covers `protocol-error` and `system.failure`.
  - **R17:** the `interrupted` row now checks that the id can be reused.
  - **R18:** the new entry fake, and the workspace fake gains its throw modes.
  - **R19:** one exact B5 form.
  - **R20:** the scaffold wording, and no timeouts as reds.
  - **R21:** the measured-fact lines are re-resolved.
  - **R22:** S6-M4 is recorded as already fixed.
  - **R23:** the C2 line is in Deferred Work now.
  - **R24:** the `mutate` additions.
  - **R25:** B9 covers every operation; B3's entry read and list are pins.
  - **R26:** new row `reply during send`.
  - **R27:** notifications after stop (design point 4, B10).
  - **R28:** the exact release order, as a stated strengthening.
  - **R29:** the cross-bridge widening is stated in design point 3.
- **Assertion changes to existing rows, all stated in the contract:**
  - B2 and B6 (a): the workspace `failure` case;
  - B6 (b): the workspace `stop` case;
  - B6 (c): two flush steps;
  - B7: the two s6 build-failure rows, the K3 replacement and the exact order;
  - B8: the register list.
  - Every other existing row is a pin.
- **Intent round:** round 2 is the last. Any blocker left after it goes to Pedro (the cap).
- **Identities:**
  - Prior approved copy: `approved-f61da9c1….md`.
  - Reviewed in round 1: `5a762a64…`.
  - The new identity is the frontmatter `content_hash`.
- **Invalidated:** the round-1 review of `5a762a64…` is superseded by round 2.

**Follow-up (2026-10-19T20:40, /rpiv:revise, s7 intent cap: S1-S11 applied without a third round, decisions §137):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-s7-round2.md`.
  - Round 2, the last, reviewed `fd612576…` and failed with 2 blockers (S7-S1, S7-S2), plus concerns and suggestions S7-S3 … S11.
  - claim-verifier verified V1-V9.
- **Pedro's decisions at the cap (§137):**
  - apply S1-S11 with no third intent round;
  - S1 option (a): workspace notifications go through the core's single subscription, a core observer for non-reply events, so every existing pin holds;
  - S2: B10 runs over the real `createHarnessBridges`, with exact per-bridge stop answers, the order, a throwing shared stop, and the binding moved there;
  - S3: an undecodable notification keeps today's throw (the queue drains first), with a row;
  - S4-S11 as proposed.
- **What changed (lines added only against `approved-f61da9c1…`; the unapproved s7 section and its draft lines are edited in place):**
  - **S1:** design point 4 adds the core observer hook. The standalone path has one subscription per bridge, and the workspace pin `stops once and rejects later requests without observing the session` holds unchanged. The shared workspace removes its observer on stop.
  - **S2:** new B10 rows over the real factory: `release answers and order`, `a throwing shared stop`, and `release settles before unsubscribe fails` with exact answers. The bindings move to B10. B7 keeps the s6 assertions as they were, including the sorted comparison. The round-1 "exact order in B7" strengthening is withdrawn there and moved to B10.
  - **S3:** design point 4 keeps the throw, and a new workspace row `throws an undecodable notification after every listener received it` is a pin.
  - **S4:** design point 9 now says that dispose always calls `release()` once and that the release skips latched bridges. B7 asserts `release` is called once. The main-test `release` mock is a no-op `vi.fn`.
  - **S5:** the fake session can throw on the n-th subscribe and on the unsubscribe of a chosen subscription. The build order is fixed.
  - **S6:** the B10 red labels are corrected: `one subscription` is red; `stop scoped to its bridge` is a pin and uses a read.
  - **S7:** the scaffold `release` is a no-op, the B7 fakes are dual-shaped, and `build fails after the logger` is a pin at the scaffold.
  - **S8:** the order of work puts B9 before B5.
  - **S9:** the cross-bridge widenings are stated for every bridge. New B10 row `cross-bridge uncorrelated result` and a new B2 core row with a correlated `system.ready`.
  - **S10:** a `knip.jsonc` entry, added to Affected source.
  - **S11:** the Architecture pointer now says design point 7; the `main.ts` import fact is corrected; the B4 flag-reset row gets its red and binding; the registration IPC pins are listed under Affected tests and in the mutation include; the K11/L10 notes are kept; shared bridges answer `unsent` after their stop.
- **Assertion changes to existing rows (complete list):**
  - B2/B6 (a): the workspace `failure` case;
  - B6 (b): the workspace `stop` case;
  - B6 (c): two flush steps (R7);
  - B7: the two s6 build-failure rows and the K3 replacement, plus the new release-called-once assertion;
  - B8: the register list.
  - Every other existing row is a pin, including the workspace subscription pin, now kept by S1 (a).
- **Named residual (Pedro, cap):** this revision of `fd612576…` had no independent intent review, so the delta is unreviewed contract change. The candidate review after build (round 1, one fix round, a confirming round 2) is the next independent check.
- **Identities:**
  - Prior approved copy: `approved-f61da9c1….md`.
  - Reviewed drafts: `5a762a64…` (round 1) and `fd612576…` (round 2).
  - New identity: the frontmatter `content_hash`. Pedro approves it before build.
- **Invalidated:** none beyond the reviewed drafts. s1-s6 are untouched.

**Follow-up (2026-10-20T10:53, /rpiv:revise, s7 candidate review round 1, decisions §137):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s7-round1.md`.
  - Candidate `f3d2c8f` (tree `94190546`) on `829c3cf`, against contract `3178bc4f…`.
  - Failed: 3 blockers (S7-K1 documentary, K2, K3), 6 concerns and 9 suggestions, grouped by root mechanism M1-M5. claim-verifier: C1-C21, 19 Verified, C1 and C7 Weakened, none Falsified.
  - Disclosed deviations D2-D5 accepted; D1 sound in code but unrecorded (K1). X2: no plausible s7 mechanism for #138.
- **Decisions (§137):**
  - Pedro ratified D1 = B10 option (a).
  - ONE fix round for all of S7-K1 to S7-K18, then a confirming round 2 scoped to the K rows, then the scoped mutation.
- **What changed (lines added only against `approved-3178bc4f…`):**
  - S7-K1 correction lines under design point 3, design point 4, design point 6 (shared path) and the workspace Fixtures line, and under B10 (the `partial construction` row as built, plus the two evidence corrections);
  - "Fix round 1" lines under design point 1 (K13), design point 5 (K11, K15, K16) and design point 6 (K14);
  - B4: two new Test lines and rows (K3, K9);
  - B9: the exact-envelope strengthenings (K17, including the B2 storage and the B5 and B6 (b) workspace rows);
  - B10: the new `$name` rows and strengthenings (K2, K4, K5, K6, K7, K8, K10) and the S3 row strengthening (K18);
  - Success Criteria: the new bindings and the default `stryker.config.json` cleanup (K12);
  - order-of-work step 10;
  - frontmatter;
  - this entry.
- **Proof classes.** Every new row is a pin at the fix candidate with its own binding, except K8 (it pins the production order) and the K17/K18 strengthenings (assertion changes, stated). No red is claimed for code that already exists at `f3d2c8f`. K10's base behaviour (stays pending at `829c3cf`) is the stated widening of design point 3, not re-observed. K11, K13, K14, K15 and K16 are refactors or documentation, checked by the unchanged pins, typecheck, dead-code and the saved `rg` output.
- **Assertion changes to existing rows (complete list for this round):** K2, K4 and K5 strengthen `a throwing shared stop`, `notifications after stop` and `stop scoped to its bridge`; K17 replaces partial matches with exact envelopes in the workspace B9, B5 and B6 (b) rows and the storage B2 `$case` row; K18 narrows the S3 row's `toThrow`. Nothing is weakened.
- **Identities:**
  - Prior approved copy: `approved-3178bc4f….md`.
  - The new identity is the frontmatter `content_hash`.
  - The fix-round rows add contract lines, so approval reopens: Pedro approves the new hash before the fix round is built.
- **Invalidated:** candidate `f3d2c8f` as the final candidate; the fix candidate replaces it. Its reds, greens, bindings, gates and heavy runs (including the 25/2 e2e and the passing `package:smoke`) stay as history for the code they cover.

**Follow-up (2026-10-20T13:30, /rpiv:revise, s7 candidate review round 2 and Pedro's cap decisions, decisions §137; records only):**
- **Review:** `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-candidate-s7-round2.md`, the confirming round, the last.
  - Fix candidate `cf95b0a` (tree `721a9622`; `4b37629` fixes plus the config-only `cf95b0a`) on `2cf479d`, against contract `ee3b1376…`. Delta `f3d2c8f..cf95b0a`, 14 files.
  - Outcome: failed, documentary only. S7-K1 to S7-K18 are all resolved in code and tests; no regression in the delta; Cross-slice OK; Research OK. claim-verifier: R1-R9 Verified.
  - Findings: S7-L1 (the K12 deviation not recorded in this brief; blocker, documentary), S7-L2 and S7-L3 (suggestions).
  - Fix-round evidence on `721a9622`: 18 bindings (on tree `43713afa`, valid for `721a9622` because only `stryker.config.json` changed after it), `pnpm check` 3259, typecheck, dead-code, duplicates, s7 unit 322/322, full e2e 27/27 (the #138 rerun passed), `package:smoke` exit 0, CodeScene 10.
- **S7-K12 resolution as built (S7-L1; coordinator decision, ratified by Pedro, §137 "Ratifico"):** this entry supersedes the K12 Success Criteria wording "by content at `829c3cf` … A range whose code no longer exists is removed".
  - The default `stryker.config.json` project-entry ranges were set in `c8a72d1` for the `unsent` owner (`:44`), the stopped check (`:82`) and `readConversation`/`saveConversationMessage` (`:191-204`).
  - They were already stale at `829c3cf`, where the same numbers fell on a `Pending` member, an options member and activate..upgrade. Mapping by content at `829c3cf` would have preserved that drift, so it was rejected.
  - At `cf95b0a` they are re-anchored to the `c8a72d1` intent: `project-entry-bridge.ts:80` (`export const unsent`), `:103` (the `isStopped()` check answering `unsent`) and `:189-202` (`readConversation` through `saveConversationMessage`). claim-verifier R1 verified all three points against the three commits.
  - The rest of K12 is met as written: the deleted `harness-pending-request.ts` is dropped, the core and `harness-bridges.ts` are added, and `k12-check.log` passes. The default mutation run is not part of this slice.
- **Named residuals (Pedro, §137):**
  - S7-L2: `ProjectStorageBridgeOptions` and `WorkspaceBridgeOptions` still spell `createId`/`now` inline instead of `{ session } & Clock`. Type-only; outside K14's named list.
  - S7-L3: the workspace B5 and B9 rows take their oracle from the production builders `workspaceQueryClosing`/`workspaceIntentClosing`. The closing text is still pinned literally in other rows (`workspace-bridge.test.ts:577`, `:969`; `harness-bridges.test.ts:63`), so no coverage is lost.
  - Notes, no action: the K8 row's "answers unchanged" re-check cannot fail (the row keeps its power through `not.toThrow` and 0 subscriptions); the K7 binding fails first on the stop count, not on the unsubscribe count the B10 line predicted.
- **Slice state:** the review rounds are closed at the cap; no further fix round. Next, in order: the scoped mutation once on `cf95b0a` (`stryker.desktop-s7.config.json`, with the coordinator's GO), then the Manual Windows check, then Pedro's acceptance of the slice.
- **Identities:**
  - Prior approved copy: `approved-ee3b1376….md`.
  - This entry adds Developer Context lines only, so the append-only check keeps that approval. The new identity is the frontmatter `content_hash`.
- **Invalidated:** none. No contract line changed; the candidate `cf95b0a` and its evidence stay current.

**Follow-up (2026-10-22T18:10, /rpiv:revise, s8 detailed just in time, decisions §138):**
- **Context:** Pedro accepted s7 at `03a50c8` (evidence to `347c0fd`, §138). s8 `u2b-s8-stdout-drain` (#96) is the last slice of Part A.
- **What changed (lines added only against `approved-9f11fb36…`):** the sections `### Slice u2b-s8-stdout-drain`, `### Test Contract: u2b-s8-stdout-drain` and `### Success Criteria: u2b-s8-stdout-drain`, before Deferred Work; frontmatter; this entry. The Deferred Work outline for s8 stays as history; the new sections replace it, with its stale line numbers re-checked at `347c0fd`.
- **Re-check against s6 and s7 as built:** the outline's U2B-SD-B1 to B4 hold. Changes: B1 adds the #96 acceptance (a line written after `exit` reaches the log) and the `close` variant; B2 pins the 999/1 000 ms edge and the forwarder removal; B3 adds stdout already ended or closed before `exit`; B4 now pins the worst case (exit at 9 999 ms → resolve at 10 999 ms) and keeps the timeout path. The stop's `stopped`/`#stopping` timing moves to the end of the drain (design point 3). s6's memoized stop and shutdown order are unaffected; s7 touched no supervisor stop code.
- **Residuals carried into s8 (§138):** #137 — the manual check runs on the packaged build; #138 — the s8 full e2e gives one more data point. The other s7 residuals (L2, L3, E1-E9, the post-round-2 delta, S1-S11) do not touch s8.
- **Open questions for Pedro:**
  - Q1 lane: normal (D15, lane.mjs `fast` raised to the feature lane), or rigorous like s6 and s7 (intent review, reviewer pair, per-slice acceptance). Recommended: normal; the change is one file and one timeout.
  - Q2 crash exits: outside a stop, a crashed child's forwarder still waits for stdout with no bound (a listener on a dead child until its stream ends). (a) leave it (recommended; #96 is about quit, and the stream ends when the pipe closes); (b) apply the same 1 000 ms bound to every exit.
  - Q3 e2e for #96 ("if feasible"): (a) no e2e, the unit rows prove it (recommended; a real upgrade line at quit needs an upgrade fixture); (b) add one.
  - Q4 the supervisor's `#after` `Effect.runFork` timers, named beside s8 in s6/s7 non-goals: (a) defer beyond Part A (recommended; they are interruptible fibers already, not #96); (b) move them onto the runtime in s8.
- **Identities:** prior approved copy `approved-9f11fb36….md`; the new identity is the frontmatter `content_hash`. New contract lines, so approval reopens: Pedro approves the new hash before s8 is built.
- **Invalidated:** none. s1-s7 are untouched.

**Follow-up (2026-10-22T20:58, /rpiv:revise, s9 added after the Part A deep review, decisions §140):**
- **Context:** the Part A deep review (`.rpiv/artifacts/reviews/2026-10-22_19-44-49_fdda65e-d7a0e22-123-part-a.md`, candidate `d7a0e22`, base `fdda65e`) raised I1, Q25 and Q33. Pedro decided (decisions log §140, via the coordinator): I1 (a), Q33 (b), Q25 (b).
- **What changed (lines added only against `approved-315e45b6…`):** the sections `### Slice u2b-s9-harness-fatal-diagnostics`, `### Test Contract: u2b-s9-harness-fatal-diagnostics` and `### Success Criteria: u2b-s9-harness-fatal-diagnostics`, before Deferred Work; frontmatter; this entry. No earlier line changed.
- **Finding → intent mapping:** I1 (a) with Q24 and Q27 folded in → U2B-FD-B1 (summary), U2B-FD-B2 (shutdown sink), U2B-FD-B3 (startup codes and sink). Q25: the cheap ordering pin → U2B-FD-B3 `reports a runtime start failure only after the launch settled`; the rest stays the Y14 exemption, named at acceptance. Q33 (b) and Q26: accepted residuals, s9 non-goals.
- **Protocol vocabulary:** the new fatal code `HARNESS_RUNTIME_START_FAILED` is harness log metadata and does not touch `packages/protocol` (details in the slice's "Protocol vocabulary" point).
- **New fact found while detailing:** the desktop drops harness stdout except upgrade lines, so the summary does not reach the desktop main log. Open question Q1 for Pedro (recommended (a): harness-only now, forwarding deferred).
- **Dependencies:** s9 builds on `d7a0e22`. It changes no s1-s8 contract line; the s5 process-entry exemption (Y14) narrows to wiring. The s5 rows in `process-shutdown.test.ts` are replaced by U2B-FD-B2 rows that keep their assertions.
- **Identities:** prior approved copy `approved-315e45b6….md`; the new identity is the frontmatter `content_hash`. New contract lines, so approval reopens: Pedro approves the new hash before s9 is built.
- **Invalidated:** the combined Part A deep review and the product mutation runs stay history for `d7a0e22`; the combined acceptance and final validation will need the s9 candidate. s1-s8 slice evidence is untouched.

**Implementation (u2b-s9-harness-fatal-diagnostics, 2026-10-22):** built in the worktree `slopstop-123` on `refactor/123-effect-lifecycle-part-a` (parent `d7a0e22`), against the approved brief `a62c7079…` (Pedro, decisions log §140-§141, via the coordinator). Q1: (a), harness-only; no protocol or desktop change; forwarding harness fatal lines to the desktop main log is deferred to #133. The red and green evidence is in `.rpiv/artifacts/evidence/2026-10-22_123-s9-tdd-evidence.md`.

## References
- Research: `.rpiv/artifacts/research/2026-10-16_23-40-39_effect-unit2b-runtime-lifecycle-part-a.md`
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` (§46 :490-491, §73 :677, §81-82 :729-736, §102-§103 :890-908)
- Lifecycle plan: `.rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md`
- #110 evidence: `.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md`
- #94 study: `.rpiv/artifacts/evidence/2026-10-10_94-timeouts-under-load.md`
- C1 local-save design (G25/G28): `.rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md`
- #110 split design: `.rpiv/artifacts/designs/2026-10-15_20-38-03_split-project-storage-node-adapters.md`
- Standing decisions: `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`
- GitHub: #123 (Part A scope and comments), #96, #110
- Effect 4 docs (Context7 `/websites/effect_website_v4`): ManagedRuntime, Semaphore, Scope; installed source `node_modules/effect` 4.0.0
