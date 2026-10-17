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
last_updated: 2026-10-17T03:30:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Intent review round 2 findings Q1-Q14 applied without a third round (decisions log §106); the unreviewed delta is residual risk. Earlier: round 1 triage (§105), design checkpoints (§104)."
content_hash: 02d9420f1c6b366e232a93ca38cd6913e8f82099c85ce4740e31c23e85df0f75
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
  - `createDesktopShutdown` keeps its controller contract (`desktop-shutdown.ts:5-20`) and its pinned timing (`desktop-shutdown.test.ts:20-43`).
  - Its stop program runs on the runtime and then awaits `dispose` before `finish` calls `quit`/`exit`, because the `preventDefault` window (`desktop-shutdown.ts:79-84`) is the only window that is held open.
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
- **Stop outcome:** `ApplicationDatabaseAuthority.stop` stays memoized. It now resolves only with a confirmed close. When the drain misses the deadline, it rejects with a new typed `ApplicationDatabaseCloseUnconfirmed` (pattern: `RegistrationCleanupUnconfirmed`, `registration/registration-listing.ts:13-25`). It never reports "closed" late (§103.2).
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

## Deferred Work
These are later slices, in order. Their behaviour IDs are stable. Seams, oracles and Expected red reasons are provisional; they are refined just in time and re-checked against the predecessor.

- **`u2b-s2-storage-failure-guard`** (after s1; independent of it).
  - U2B-SG-B1: one exported guard with the same truth table as all three copies, rows Broken / Unavailable / ClientInitialization (a subclass) / other Error / non-Error. Seam: `isKnownStorageFailure`, in `project-storage-node-errors.test.ts`. Expected red: none — pin (identity proof first).
  - U2B-SG-B2: the existing pass-through pins are kept: `project-storage-node-adapters.integration.test.ts:457-477` and `project-storage-upgrade-steps.integration.test.ts:100-151`. Pin.
  - Trigger: none.
- **`u2b-s3-authority-bounded-close`** (after s1; lane rigorous, §104 P6).
  - U2B-AC-B1: with a lease that is never confirmed, `stop()` rejects with `ApplicationDatabaseCloseUnconfirmed` at the deadline and never resolves later. Seam: `createApplicationDatabaseAuthority` with a fake client whose `close` rejects, in a new `application-database-authority.test.ts`, with fake timers. Expected red: `stop()` is still pending past the deadline (`application-database-authority.ts:434-438`).
  - U2B-AC-B2: admission stays refused after a timed-out stop (pin), and a stop with no leases resolves at once (pin, `application-database-authority-cases.integration.test.ts:106, 130`).
  - U2B-AC-B3: a runtime whose database stop is unconfirmed rejects with an aggregate that contains `ApplicationDatabaseCloseUnconfirmed`, in the order intake, Storage, listing, database. Seam: `startHarnessRuntime`, in `harness-runtime-shutdown.test.ts`. Expected red: the runtime stop never settles.
  - U2B-AC-B4: a withheld Storage leaves the database untouched (pin, `harness-runtime-shutdown.test.ts:230`). A listing failure does not withhold the database (a new characterization; green at once).
  - U2B-AC-B5: the Layer safety net stops a never-stopped authority, bounded, and does nothing to one that was stopped or withheld. Seam: the exported disposal seam (slice 5) or a bootstrap integration test. Expected red: dispose never stops the authority.
  - Trigger: the opening measurement, with the coordinator's GO. The default is 1 000 ms; if the measured p99 is above 500 ms, the slice stops for Pedro (§104 P1).
- **`u2b-s4-standalone-authority`** (after s3).
  - U2B-SA-B1: `registry.stop()` drains and stops the standalone authority it created, so a later admission through the same options is refused with "…is stopped.". Seam: `createRegistrationRegistry` (integration, disk). Expected red: admission still succeeds (`registry-database.ts:44-67`, `registration-registry.ts:180-194`).
  - U2B-SA-B2: a restart with the same options object gets a fresh, working authority. Expected red: none today. It becomes red if B1 is implemented without removing the WeakMap entry; the order is pinned with B1.
  - U2B-SA-B3: an injected authority is never stopped by the registry. Pin.
- **`u2b-s5-harness-runtime`** (after s3, s4; lane rigorous, §104 P6).
  - U2B-HR-B1: the shutdown program and the transport edge run on the process runtime, and the same-turn, re-entry, withheld, not-held and aggregation pins hold (`harness-runtime-shutdown.test.ts:23, 90, 130, 220, 230`; `harness-runtime.test.ts:201, 226, 241, 254-283, 950`). Pins.
  - U2B-HR-B2: the listing stop is an Effect that fails with `RegistrationCleanupUnconfirmed` (CNV-B37 rows ported, `registration-listing.test.ts:75, 105`), and the observer close uses an Effect deadline (`project-registration-observer.test.ts:154`, ported).
  - U2B-HR-B3: a dispose failure after a failed stop is aggregated, not substituted. Seam: the exported disposal seam. Expected red: the dispose error replaces the stop error (`process-bootstrap.ts:135`).
  - U2B-HR-B4: on a bootstrap failure, a bounded dispose completes before `failStartup` exits. Expected red: the dispose is not awaited (:139).
  - U2B-HR-B5: a transport request after dispose gets no reply and causes no unhandled rejection (`harness-runtime.test.ts:914` extended).
  - U2B-HR-B6: the shutdown listing cleanup ends within `REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS` and reports `RegistrationCleanupUnconfirmed` for the parts left unconfirmed. Seam: `createRegistrationListing(...).stop`, with fake timers. Expected red: the observer still waits the 5 000 ms per-request budget (`project-registration-observer.ts:93, 107`).
  - Trigger: `package:launch-smoke` GO (precedent `ff162f5`).
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
- **`u2b-s8-stdout-drain`** (#96, after s6).
  - U2B-SD-B1: `stop()` stays pending after `exit` until stdout ends. Expected red: it resolves at `exit` (`harness-supervisor.ts:148-152`).
  - U2B-SD-B2: with no `end` within `HARNESS_STDOUT_DRAIN_MS`, `stop()` resolves and the forwarder is removed. Expected red: the stdout `data` listener is still attached.
  - U2B-SD-B3: a child without stdout resolves at `exit` (characterization).
  - U2B-SD-B4: the grace, kill and grace pins hold (`harness-supervisor.test.ts:596, 1078`). The tests that await a stop after `exit` without stdout `end` (:553, :596, :815, :846, :667) are updated to emit `end` or to advance by the bound; their assertions do not change.
  - Bound: 1 000 ms (D12).

**Deferred beyond Part A:** the facades listed in D4 as kept; `repository-identity-query-owner` drain and the `repository-physical-observation` / `windows-version-child` races (per request, not on the shutdown chain); the authority semaphores. Each moves when its callers become Effects (Part B).

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
- **Evidence locations:**
  - research `.rpiv/artifacts/research/2026-10-16_23-40-39_effect-unit2b-runtime-lifecycle-part-a.md`;
  - the seam inventory (workflow `wf_d6d996c4-7a3`, summarized here);
  - decisions log §102-§106;
  - intent review round 1: `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-round1.md`;
  - intent review round 2: `.rpiv/evidence/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a/review-intent-round2.md`.

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
