---
date: 2026-10-16T23:40:39+0100
author: Pedro Mesquita
commit: b08c3c1
branch: main
repository: slopstop
topic: "#123 Part A: Effect Unit 2b runtime and lifecycle (one ManagedRuntime per process, ApplicationDatabase finalizer, #110 lock carry-forwards, G28 desktop bridge core)"
tags: [research, codebase, effect, managed-runtime, layer, shutdown, semaphore, project-storage-locks, application-database, desktop-bridge, electron-main, harness-supervisor]
status: complete
lane: normal
lane_reasons: ["slices: 6 > 1", "files: 16 > 5", "diagnostic: lines unknown", "diagnostic: hub signal unavailable"]
last_updated: 2026-10-16T23:40:39+0100
last_updated_by: Pedro Mesquita
content_hash: 03ea3650265cc9eccf6e30f987d54363ae95c5d377e98a91531e7631f3ecefbc
---

# Research: #123 Part A — Effect Unit 2b runtime and lifecycle

## Research Question
For GitHub #123 Part A (decisions log §102: before C2; Part B, the SQL-body pass with before/after performance, comes after C2), map the current code for:
1. one `ManagedRuntime` per process, for the harness utility process and the Electron main process, built once from the application Layer and disposed on shutdown, with services at real ownership boundaries, explicit shutdown sequencing, and replaced handwritten coordination removed rather than wrapped (`.rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md:34-40`);
2. the ApplicationDatabase Layer finalizer gap;
3. the #110 carry-forwards: in-Effect lock order, the `ProjectStorageLocks` service surface, and the duplicate storage-failure guard;
4. the Electron-main desktop bridge Promise core accepted as temporary in C1 S4 (G28, decisions log §46), which C2 will stream through.

## Summary
- **The harness runtime is a constructor graph, not a lifecycle owner.** `ManagedRuntime.make` (`apps/harness/src/process-bootstrap.ts:99`) builds four `Layer.effect` services with no finalizers. They are extracted once with `runtime.runSync` (:103-112) and passed as plain objects. Every other `run*` call in `apps/harness/src` (35 of them) uses the global `Effect.run*` with an empty context, so `runtime.dispose()` interrupts nothing and releases nothing. Shutdown is a hand-coded program (`harness-runtime.ts:114-164`) forked on the global runtime.
- **Moving the stop into Layer finalizers would break four contracts that the explicit program keeps today.** These are: same-turn admission closure, withholding Storage and the database after a failed canonical release, concurrent canonical and Storage stop when no Project is held, and the aggregated failure report. Scope finalizers run later, in a fixed reverse-acquisition order, always continue after a failure, and surface one squashed error (`node_modules/effect/src/internal/effect.ts:3947-4011, :5778-5780`).
- **The ApplicationDatabase gap is larger than a missing finalizer.** `authority.stop()` waits for `closed` with no deadline (`storage/application-database-authority.ts:434-438`). An unconfirmed lease therefore hangs it forever, on today's explicit path as well. A naive `acquireRelease` around it would hang `dispose()` uninterruptibly and would also stop an authority that the explicit program deliberately keeps alive when Storage is withheld. The #123 citation `:197-202` is stale: the Layer is at `process-bootstrap.ts:181-186`.
- **Effect 4.0.0's `Semaphore` lets a late caller barge in when it is released inside a fiber.** `releaseUnsafe` schedules the wake-up on the releasing fiber's dispatcher (`node_modules/effect/src/Semaphore.ts:264-275`). Only an `Effect.runSync` release flushes that task inline (`internal/effect.ts:5799-5801`). So today's FIFO hand-off exists only at the Promise facades (`storage/permit-lock.ts:20`, `application-database-authority.ts:160,168,318`). Two in-fiber users already allow barging: `canonical-project-writer.ts:112-118` (despite its "One FIFO slot" comment at :129) and `registration/project-registration-flow.ts:194`. Queue, TxSemaphore and Latch are no fairer. Only `Deferred.doneUnsafe` resumes its waiters synchronously and in order (`Deferred.ts:1649-1663`).
- **The #110 carry-forwards hold.** `createPermit` and `retainProject` are exposed only for the facade (`storage/project-storage-locks.ts:51-54, 84-88`). `retainProject().release` is not idempotent (:25-34, :48). `isStorageFailure` (`project-storage-node-registry.ts:60-64`) and `isKnownStorageError` (`project-storage-node-errors.ts:37-42`) are proven identical, and a third inline copy sits at `project-storage-upgrade-node-adapter.ts:558-559`.
- **Electron main has no runtime and no Layer composition.** Its owners are module-level mutable variables (`apps/desktop/src/main/main.ts:53-74`). Shutdown is a never-failing Effect run on the global runtime one microtask late (`desktop-shutdown.ts:28-54`), and quit is held only by `preventDefault` (:79-84). A main `ManagedRuntime` would interrupt its runtime-forked fibers before it runs the Layer finalizers (`ManagedRuntime.ts:292-309, 337-347`). Disposal must therefore finish inside the window that `preventDefault` holds open.
- **The G28 bridge core is copied three times, and each copy behaves differently.** The core is `harness-pending-request.ts:55-77`, and its bookkeeping is copied in `project-entry-bridge.ts`, `project-storage-bridge.ts` and `workspace-bridge.ts`. There is no per-request timeout or cancellation, and protocol v8 has no cancel command and no multi-event reply (`packages/protocol/src/protocol.ts:87, 252-344`). The shape C2 needs is therefore not in the protocol yet.
- **The #123 baseline is stale.** Today there are 121 harness .ts files, 64 import `effect`, 286 `throw new`, 6 `new Promise`, and 36 `run*` calls in 20 files (against 103/52/287/6/24-in-14).

## Detailed Findings

### 1. Harness runtime build, extraction and disposal
- **Composition** (`apps/harness/src/process-bootstrap.ts:262-269`): `canonicalProjectsLayer` with `provideMerge` of `Layer.mergeAll(projectStorageLayer, projectRegistrationLayer)`, then `applicationDatabaseLayer`, then `HarnessRoots` and `UpgradeLog` (both `Layer.succeed`). `provideWith` builds the dependency first (`node_modules/effect/src/Layer.ts:1904-1923`), and `mergeAll` builds its members in parallel (:1593-1594). The resulting reverse order on dispose would be: Canonical; Storage ∥ Registration; ApplicationDatabase; HarnessRoots; UpgradeLog.
- **Layer bodies:** the four bodies at `:181-186`, `:188-201`, `:203-242` and `:244-260` are synchronous `Layer.effect` with no `acquireRelease` or `addFinalizer`. There is no `acquireRelease`, `addFinalizer` or `Layer.scoped` anywhere in non-test `apps/harness/src`.
- **Extraction:** `runtime.runSync` (`:103-112`) works only because every body is synchronous. An asynchronous acquire would raise `AsyncFiberError` (`node_modules/effect/src/internal/effect.ts:5799-5802`, `ManagedRuntime.ts:368-371`).
- **Handover:** the values passed to `startHarnessRuntime` (`harness-runtime.ts:207`) are plain objects with no runtime reference (`process-bootstrap.ts:114-131`). Fibers from global `Effect.run*` are not registered in the runtime's `fiberScope`, which only happens through `mergeRunOptions` (`ManagedRuntime.ts:294-309`).
- **Disposal:**
  - `disposal ??= stopped.finally(() => runtime.dispose())` (`process-bootstrap.ts:132-137`). If dispose fails, its error replaces the stop error.
  - On a bootstrap failure, `void runtime.dispose()` (:139) is cut off by the synchronous `process.exit(1)` in `failStartup` (`process-entry.ts:32-35, 86-87`). A dispose rejection on that path cannot even reach the `unhandledRejection` handler (verifier correction).
- **Stop trigger and failure mode:**
  - The trigger is the MessagePort `close`, handled by `createHarnessPortCloseHandler` (`process-shutdown.ts:9-22`, wired at `process-entry.ts:90-97`). It runs one microtask late and awaits the whole stop-plus-dispose chain.
  - On success nothing calls `process.exit`, so a dispose that never settles leaves the process with no log and no exit. A failed shutdown is final, because `stopPromise` is never reset (`harness-runtime.ts:378-383`), even though the owners' own stops can be retried.

### 2. The explicit shutdown contract (what a Layer/Scope design must preserve)
- **Same-turn invocation:** `startStop` (`harness-runtime.ts:74-89`) calls each owner's `stop()` in the caller's turn and turns throws into a failure list. This is how intake closes synchronously:
  - `retryableAttempt` → `enqueue` does `pendingLifecycle++` synchronously (`active-project-coordinator.ts:541, 669`), and `admitActiveWork` refuses while it is above 0 (`active-work-admission.ts:43`);
  - the Storage owner sets `stopped = true` synchronously (`storage/project-storage-store.ts:729`).
- **Held Project:** `heldProject` (:99-107) treats a throw as held. `holdsProject` is true for every coordinator state except `inactive` and `stopped` (`active-project-coordinator.ts:732`).
- **`stopCanonicalThenStorage`** (:114-141):
  - **Held:** Storage stops only after a successful canonical stop. A canonical failure gives `withheld: true` (:124-133).
  - **Not held:** canonical and Storage stop concurrently with unbounded `Effect.all` (:134-140). This is so a running upgrade "meets the owner stop" (:92-93; precedent `43bc303`).
- **`shutdownAfterIntake`** (:143-164): the listing stop runs in parallel. `applicationDatabase.stop()` runs only when Storage was not withheld (:153-155). A listing failure does not withhold it. Failures are aggregated through `runtimeShutdownFailure` (:66-70).
- **Stop closure** (:375-401): the `Deferred` completion is published before `stopMessages()`/`stopNotifications()`, so a re-entering caller gets the same promise (precedent: the Unit 2a stack overflow, lifecycle plan :66-68). Then `Effect.runFork` runs the program.
- **The owners' own stops:**
  - Coordinator: `stopOnce`, a retryable `enqueue(stop)` that drains the admitted command Deferreds, then `releaseOwnership`. On failure the state stays `release-failed` (`active-project-coordinator.ts:551-573, 657-669`).
  - Storage owner (`project-storage-store.ts:725-762`): drains in admission order, closes sessions one at a time, then runs `closeRegistry` behind `afterCreateDrain`. It reports an `AggregateError` and can be retried when sessions remain.
  - Listing (`registration/registration-listing.ts:28-57`): its `owner.close` and `observer.close` are wrapped in `Effect.promise`, so a rejection there is a defect and not `RegistrationCleanupUnconfirmed`.
- **What a Scope/`acquireRelease` move would change:**
  - Finalizers start only at dispose, in a later microtask, one after another.
  - A sequential close continues after a failure (`internal/effect.ts:4000-4011`), so Storage and the database would close even after a failed canonical release.
  - The not-held concurrency would become serial.
  - The listing would wait for canonical.
  - Aggregation would collapse to `causeSquash`.
  - Intake (`stopMessages`/`stopNotifications`) is not a Layer resource at all; the transport is passed in.

### 3. ApplicationDatabase Layer finalizer gap
- **The Layer** is `process-bootstrap.ts:181-186`. The #123 issue cites `:197-202`, which at b08c3c1 is the tail of `projectStorageLayer`. The gap is recorded in `.rpiv/artifacts/evidence/2026-10-10_94-timeouts-under-load.md:139-142`.
- **Authority accounting:**
  - `accept()`/`end` counters (`storage/application-database-authority.ts:139-149`). Leases come from `admit` (:151-171), `ensureCurrent`/`openCurrent` (:414-433) and `admittedTransaction` (:81-114).
  - A failed commit or an unconfirmed close keeps its lease (:93, :105). A failed client close keeps all of that client's leases (:179-182).
  - `stop` (:434-438) awaits `closed` with no deadline. A permanent lease also blocks every queued `admit` behind the single permit.
- **The three stop/skip paths:**
  1. The shared authority is stopped only when Storage is not withheld (`harness-runtime.ts:45-46, 153-155`).
  2. Storage's `registry.stop` closes its own retained application client, which frees that client's leases (`project-storage-application-client.ts:194-202`). It stops the authority only when it owns it (`project-storage-node-adapters.ts:156-159, 345-349`). In the harness the authority is injected (`process-bootstrap.ts:196`), so Storage never stops it.
  3. `applicationDatabaseFor` (`registration/registry-database.ts:44-67`) creates a standalone authority, cached in a WeakMap, only when none is injected, and `registration-registry.ts:180-194` never stops it. Every harness options object carries the shared authority (`process-bootstrap.ts:207-211, 249`), so this leak is reachable only from standalone owners and tests, not from the production graph.
- **Consequence for a finalizer:** a finalizer that awaits `stop()` would run inside the uninterruptible `scopeClose` (`internal/effect.ts:3947-3953`).
  - With an unconfirmed lease, `dispose()` never settles, and a timeout around `dispose` cannot cut it short.
  - With Storage withheld, the finalizer would stop an authority that the explicit program kept alive on purpose, and still-admitted Storage work would fail with `stoppedError`.
  - Neither path offers bounded close or truthful incomplete cleanup today, although lifecycle plan :38, :111 and :122 require both.

### 4. Owner separation and Layer memoization
- **Locks per owner:** every Storage owner gets its own lock set, because `createNodeAdapters` sets `locks: createProjectStorageLocksFacade()` (`project-storage-node-adapters.ts:408`), which calls `Effect.runSync(ProjectStorageLocks.make)` directly (`project-storage-locks.ts:81-82`). No Layer is involved.
- **The three owner kinds:**
  - the shared owner (`process-bootstrap.ts:188-201`);
  - one listing owner per `listRegisteredProjects` call (`registration/project-listing.ts:201-228`, stopped in `finally`);
  - one registration-bootstrap owner per registration (`registration-storage-bootstrap.ts:102-122`), whose per-call `initialRepositoryBinding` seed (:99, :108) rules out a single memoized value (verifier: `storageFailures` is fixed per bootstrap options).
  
  All three share the one authority. Listing and bootstrap get it through `applicationDatabaseFor`; the shared owner gets it straight from the service.
- **Memoization hazard:** a Layer is memoized by its object identity (`Layer.ts:401, 430-455, 1433-1437`). `Effect.provide` forks `CurrentMemoMap` and falls back to the runtime's map (`internal/layer.ts:15-19`, `Layer.ts:418-428, 583-586, 972-977`). So once the runtime builds `ProjectStorageLocks.layer` (`project-storage-locks.ts:69`, today used only by its service test), a per-call provide of it would reuse the runtime's instance. Only `{ local: true }`, `Layer.fresh` or a direct `make` keeps it separate.
  - Pins: `project-storage-locks.test.ts:188` and `project-storage-locks-service.test.ts:139`.
  - If listing resolved the shared `ProjectStorage`, its `open` would close the active Project's session (`project-storage-store.ts:530-534, 687`) and its `finally stop()` would close every session (:725-744). Lifecycle plan :23-25 and :109 forbid both.

### 5. Effect 4.0.0 Semaphore order and the existing FIFO pins
- **Version:** 4.0.0 (`node_modules/effect/package.json:4`, `pnpm-lock.yaml:3024`).
- **Wake-up path:**
  - Waiters are a `Set` kept in insertion order (`Semaphore.ts:214-233`).
  - `take` and `withPermits` take a free permit without checking for waiters (:247-251, :298-302).
  - `releaseUnsafe` schedules the wake loop with `currentDispatcher.scheduleTask(…, 0)` (:264-275).
  - The default dispatcher is the async `MixedScheduler`, which wakes on `setImmediate` (`Scheduler.ts:72-113, 166-172, 217-222`).
- **Why `runSync` keeps FIFO:** a `runSync` release uses `MixedScheduler("sync")` and flushes inline (`internal/effect.ts:5799-5801`, `Scheduler.ts:248-256`), and the woken waiter's resume runs synchronously (`internal/effect.ts:1168-1175`). That is the mechanism behind the comment at `project-storage-locks.ts:72-80` and the #110 evidence (`.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md:238-259, 309`).
- **Users that depend on this hand-off:**
  - Synchronous (FIFO): `permit-lock.ts:12-22`, used by the coordinator lifecycle queue (`active-project-coordinator.ts:507, 540-549`) and the Storage locks facade (`project-storage-locks.ts:84-88`); and the two authority semaphores (`application-database-authority.ts:127-128, 154/160/168, 314/318`).
  - In-fiber (barging possible): `forCreate`/`afterCreateDrain`/`forProject` (`project-storage-locks.ts:55-64`), `inSlot` (`canonical-project-writer.ts:112-118`; `settle` enters through `Promise.resolve().then` at :212 and can fall inside the window), and `Semaphore.withPermit(steps)` (`registration/project-registration-flow.ts:185, 194`, run per request at `harness-runtime.ts:300`).
- **Pins:**
  - Only the facade test pins the "later arrival" case (`project-storage-locks.test.ts:69-93`).
  - The service tests (`project-storage-locks-service.test.ts:43, 60, 93`) register every waiter before the release, or fork the late caller after the hand-off. In-fiber barging is not covered by any test.
- **Other primitives:**
  - Queue wakes through the dispatcher and lets a direct take succeed (`Queue.ts:795-797, 2457-2485`).
  - TxSemaphore retries without ordering (`TxSemaphore.ts:242-249`).
  - Latch also wakes through the dispatcher (`internal/effect.ts:5836-5858`).
  - Only `Deferred.doneUnsafe` resumes its waiters inline, in registration order (`Deferred.ts:1649-1663`).
  - Context7 (`/websites/effect_website_v4`, Semaphore API) documents no fairness guarantee.

### 6. ProjectStorageLocks surface and the duplicate guard
- **Raw permits:** `createPermit` and `retainProject` are on the service only for the facade (`project-storage-locks.ts:51-54`; external users only at :84, :85, :87). The service's own operations use them internally too (:55, :58, :61). `active-project-coordinator.ts` does not use them; it uses `createPermitLock`/`withPermit` (:57, :507, :542).
- **Non-idempotent release:** each run decrements `users` (:30) and deletes the entry at 0 (:31-32). A double release could let a fresh semaphore be created for the same Project while a holder still runs (:15-18). The current callers release exactly once: `acquireUseRelease` (:59-64) and the facade's `.finally` (:88).
- **Consumer contract:** Promise-typed `ProjectStorageStoreDependencies["locks"]` (`project-storage-store.ts:253-257`), used at :467, :604, :649, :660, :671, :686 and :717. `create` nests `forProject` → `forCreate` (:671 → :467). Promise-shaped fakes exist at `project-storage-store.test.ts:220-225, 501-514, 746-753, 766-771` and `tests/integration/project-storage-lifecycle.integration.test.ts:354-371, 456, 478`.
- **Duplicate guard:** `isStorageFailure` (`project-storage-node-registry.ts:60-64`, which feeds `keepStorageFailure` :75-77 to split fail from die) and `isKnownStorageError` (`project-storage-node-errors.ts:37-42`, which feeds `storageFailureFor` :67) run the same two `instanceof` checks against classes with no custom `Symbol.hasInstance` (`project-storage-errors.ts:1-7`). They are identical for every input. A third inline copy is at `project-storage-upgrade-node-adapter.ts:558-559`. A related but different check (Unavailable plus a code) is at `project-storage-application-client.ts:77-80`. The rule that applies is `.rpiv/decisions/shared-vocab-union.md:5, 20`.

### 7. Harness Promise facades and `run*` edges (inventory and classification)
- **Process and IPC edges (keep):** `process-bootstrap.ts:99-141`, `harness-runtime.ts:300` (transport handler) and `harness-runtime.ts:375-401` (stop facade). All of them run on the global runtime, not on the ManagedRuntime.
- **Temporary facades and handwritten coordination in Part A territory:**
  - authority Promise interface (`application-database-authority.ts:34-47`, run* at :154/160/168/314/318/370/437, Deferred at :67-68/130/147/288/401/436);
  - `permit-lock.ts:12-22`;
  - `project-storage-locks.ts:81-91`;
  - `project-storage-node-adapters.ts:341-344, 391-396` (callers `project-storage-store.ts:413, 447, 478`);
  - coordinator `drained` per-command Deferreds and the release drain (`active-project-coordinator.ts:529-538, 558-563`) and the conversation facades (:714-724);
  - `project-storage-store.ts:557-574, 747`;
  - `registration-listing.ts:52-56`;
  - `registration-registry.ts:68-83, 180-194`;
  - `list-visibility.ts:83-93`;
  - `project-registration-preparation.ts:273`;
  - `project-storage-application-client.ts:142-203`;
  - `retryable-attempt.ts:6-30` (callers: coordinator :669, `canonical-project-writer.ts:138`, `canonical-writer-lease.ts:50`);
  - `project-storage-upgrade-recovery.ts:96`;
  - `project-storage-upgrade-pipeline.ts:490`;
  - `canonical-project-writer.ts:113, 138-146, 212`.
- **Effect → Promise → Effect nesting** (4 chains):
  - `list-visibility.ts:84-91`;
  - `registration-listing.ts:36` → `registration-registry.ts:182`;
  - `project-storage-upgrade-pipeline.ts:356, 454` → `upgrade-recovery.ts:96`;
  - the conversation save path: coordinator :722 → `conversation/conversation-save.ts:52` → `canonical-project-writer.ts:113` → `canonical-writer-conversation.ts:52`.
- **Handwritten timeouts outside Effect:**
  - `project-registration-observer.ts:90-113` and `registration/repository-identity-query-owner.ts:316-340`: `Promise.race` against `setTimeout(REGISTRATION_CLEANUP_BUDGET_MS)`. Their migrated twin is `project-registration-preparation.ts:259-279` (`Effect.timeoutOrElse`).
  - `repository-physical-observation.ts:182-201` and `windows-version-child.ts:85-109`, both tied to child and native work.
  - `identity-query-control.ts:20, 33`.
- **SQL-body-adjacent (Part B candidates):**
  - `registry-effect.ts:38`, `project-listing.ts:132` and `canonical-writer-conversation.ts:52` (inside Promise transaction bodies);
  - the `Promise.all` calls inside SQL and filesystem bodies (`application-database-migration.ts:162`, `database-schema-verifier.ts:265/495/545`, `project-storage-*` builders, `canonical-command-settlement.ts:67`);
  - the worker bridge `local-libsql-worker-client.ts:522, 542`.
  
  The "after C2" timing comes from §102 (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:890-894`). The cited SQL research (`2026-10-04_sql-code-to-effect-pros-cons.md:59-64`) ties the pass to the `claude -p` cost-viability decision instead.
- **Error identity:** `runPromise` throws `causeSquash`, so the facades keep error identity (`instanceof ProjectStorageBrokenError`, `project-storage-store.ts:544-553`) but cannot tell fail from die (#110 evidence :114, :132, :414).

### 8. Electron main: owners, shutdown and runtime fit
- **Module-level state:** `main.ts:53-74`. `createDesktopShutdown` is wired at module load, before `app.whenReady()` (:58-68), and reads the owners late through optional chaining. The `stopWorkspaceBridge` closure stops the workspace bridge and then the entry bridge inside one `Effect.try`, so a throw from the first skips the second (`desktop-shutdown.ts:30-33`).
- **Bootstrap:** `bootstrap()` (`main.ts:343-421`):
  - Takes the single-instance lock (:348-351).
  - **Writer-proof branch** (:356-359): returns before any owner exists and ends in a direct `app.exit` (:124). Other direct exits are :92, :94, :329 and :331.
  - Then builds the logger (:366), `HarnessSupervisor` (:378, which owns `HarnessSession`: `harness-supervisor.ts:60, 78-80`) and the three bridges (:380-396), registers IPC, subscribes broadcasts, and finally calls `supervisor.start()` (:411).
- **Shutdown:** `desktop-shutdown.ts`:
  - **Stop program** (:28-41): never fails. It stops the bridges and then the harness.
  - **`stop()`** (:43-54): starts one microtask late; the test is pinned at `desktop-shutdown.test.ts:42-43`.
  - **`finish()`** (:56-69): calls `quit()` or `exit(code)`.
  - **`beforeQuit`** (:78-86): calls `preventDefault` on every `before-quit` until `allowQuit` (verifier: not only the first one; `desktop-shutdown.test.ts:39, 45`). Nothing is awaited after `quit` or `exit`.
- **Supervisor:**
  - **Timers:** `#after` runs global `Effect.runFork` timers (`harness-supervisor.ts:198-202`), interrupted only by `interruptUnsafe` (:136-141, :224, :267).
  - **`#stopChild`** (:145-196): a Deferred on `exit`, then grace, kill, grace, each `harnessShutdownGraceMs` = 5 000 ms (:25), run by its own `Effect.runPromise`.
  - **Restartable:** `start()` resets `#stopPromise` (:106).
- **Lifecycle owners (Layer candidates):**
  - Logger (`logger.ts:22-50`): synchronous `appendFileSync` sink with no close (`bounded-log-destination.ts:85-100`).
  - Supervisor and session.
  - The three bridges: each subscribes on construction and its `stop()` unsubscribes and fails what is pending. Today's stop order, bridges then harness, equals reverse build order.
  - `ProjectStorageBridge` has no IPC handler; only the package smoke uses it (`main.ts:134, 159-165`).
  - Sentry is only initialized (`crash-reporting.ts:91-106`).
- **IPC edges:** `project-entry-ipc.ts:26-44`, `project-registration-ipc.ts:48-56` and `main.ts:227-230, 243-248`. `ipcMain.removeHandler` is never called. After stop the handlers answer broken or unsent envelopes. A `runtime.runPromise` made after dispose would instead reject with `"ManagedRuntime disposed"` (`ManagedRuntime.ts:344`).
- **ManagedRuntime facts** (`ManagedRuntime.ts:291-347`):
  - runtime `runFork`/`runPromise` fibers join `fiberScope`;
  - `dispose` interrupts them before it runs the `layerScope` finalizers.
  
  So a supervisor stop fiber run on the runtime would be interrupted by dispose. Disposal must complete before `options.quit()`/`exit()`. On the writer-proof and lock-refusal paths a lazily built runtime has nothing to release.

### 9. The G28 desktop bridge Promise core
- **The core:** `requestHarness` (`apps/desktop/src/main/harness-pending-request.ts:55-77`).
  - An unbuildable command answers `broken` (:37-43, :65-66).
  - Registration in the caller-owned Map (with collision refusal, :45-53) and `send` happen in one synchronous `new Promise` executor (:68-76).
  - A throwing `send` rejects the Promise with no envelope.
  - The caller deletes its own entries.
- **Event dispatch:** `dispatchPendingHarnessEvent` (:10-35) maps `disconnected` → transport, `protocol-error` → protocol, and `request.failure` → harness with its code. `request.failure` requires a `causationId` (`protocol.ts:201-206`).
- **The three bookkeeping copies diverge:**
  - **Null `causationId`:** ignored by project entry (`project-entry-bridge.ts:66`); fail-all in storage (`project-storage-bridge.ts:231-233`) and workspace (`workspace-bridge.ts:296-298`).
  - **`system.failure`:** fail-all only in storage (:196-198) and workspace (:220-221).
  - **Fault type:** typed `ProjectRequestFault` in project entry (`project-upgrade-failure.ts:17-21`); plain strings in the other two.
  - **Decode errors:** `decodeStrict` can throw out of a session listener in storage and workspace (`project-storage-bridge.ts:66-73`, `workspace-bridge.ts:254, 282`).
- **G25 mapping** (`project-conversation-failure.ts:33-47, 67-79`): a save maps transport and protocol → `uncertain`, not sent → `unavailable`, defect → broken `PROTOCOL_MESSAGE_INVALID`, harness → broken with its code. This matches decisions log :490.
- **Session:** `HarnessSession` (`harness-session.ts:35-111`) emits synchronously in insertion order and aggregates listener throws. `detach` closes the port and then emits `disconnected`.
- **Premise correction (quit):** during desktop shutdown the bridges stop and unsubscribe before `stopHarness` (`desktop-shutdown.ts:30-39`). So the `disconnected` from `supervisor.stop` → `detach` (`harness-supervisor.ts:114`) reaches only the supervisor (:237-238), and the bridges' own `stop()` fails what is pending.
- **Re-entrant ordering (real wiring):** the supervisor subscribes first (`harness-supervisor.ts:69`). On `protocol-error` or `system.failure` it quarantines (:218-220, :250-252), and `detach` (:443) emits a nested `disconnected` before the outer event reaches the bridges.
  - So a project-entry read pending during a protocol error answers `unavailable` (transport), not `broken` (protocol) (`project-conversation-failure.ts:57-59`).
  - The bridge tests use a bare session (`project-entry-bridge.test.ts:60-66`), so this ordering is not exercised.
- **No timeout or cancellation:**
  - No bridge has a per-request timeout, `AbortSignal` or cancel.
  - Protocol v8 (`protocol.ts:87`) has no cancel or abort command and no multi-event reply (commands :252-295, events :298-344). Events carry `sequence` and a nullable `causationId` (:177-184).
  - Every request settles on its first correlated event.
  - `project.command`/`project.command.result` exist (:268-272, :314-318), but no desktop bridge sends `project.command`.
- **Effect facts for the redesign:**
  - `Deferred.doneUnsafe` completes once and resumes waiters synchronously (`Deferred.ts:1649-1663`).
  - An interrupted waiter does not remove the bridge's Map entry (:1653-1655).
  - `runPromise({ signal })` interrupts on abort (`internal/effect.ts:5684-5692`).
  - An interrupted edge program rejects unless it maps the interruption to an envelope (:5778-5781).
- **Precedent:** `f810132` kept `harness-pending-request.ts` a native Promise because "the bridges' settlement timing is part of their tested contract".

### 10. Quit-time log path (#96)
- **#96:** "Keep harness upgrade log lines that arrive after the child exits on quit". Its acceptance: either a bounded wait for the child's stdout to end before the app exits, or the loss documented as accepted, plus a supervisor test (and an e2e check if feasible). The roadmap (`2026-10-10_pending-work-roadmap.md:49`) places it with Unit 2b.
- **Electron side:**
  - `stop()` calls only `quiet()` (`harness-supervisor.ts:123, 380-381, 416-420`), so upgrade lines keep being forwarded.
  - On `exit`, `drain()` deletes the observation but keeps the stdout forwarder until `end`/`close` (:351-355, :372-391).
  - `#stopChild` resolves on the same `exit` event (:148-152), so `finish()` can quit before stdout ends.
  - `ChildObservation` has no completion signal (:40).
  - On a timeout, `remove()` ends forwarding at once (:160-162, :386-389), and a partial line is reported as `HARNESS_LOG_LINE_INCOMPLETE` (`harness-log-lines.ts:80-89`).
  - Only upgrade-event JSON lines are forwarded (:30-46). Tests pin forwarding after `exit` until stdout ends (`harness-supervisor.test.ts:1028-1087`).
- **Harness side:**
  - There is no shutdown command; the harness stops on port close.
  - The harness logger is an async SonicBoom on fd 1 with an exit flush (`harness-logger.ts:13`; `node_modules/pino/lib/tools.js:274-281, 366`), so lines can reach the pipe after the parent has seen `exit`.
  - On success the harness never calls `process.exit`. Its quit budget is two grace periods, 10 s worst case. Any stdout wait adds to the window held by `preventDefault`.

## Code References
- `apps/harness/src/process-bootstrap.ts:99-141` — the only ManagedRuntime: make, runSync extraction, dispose after stop, unobserved dispose on failure
- `apps/harness/src/process-bootstrap.ts:181-186` — ApplicationDatabase Layer, no finalizer
- `apps/harness/src/process-bootstrap.ts:188-269` — Storage, Registration and Canonical Layers; composition
- `apps/harness/src/harness-runtime.ts:66-164` — failure aggregation, startStop, heldProject, stopCanonicalThenStorage, shutdownAfterIntake
- `apps/harness/src/harness-runtime.ts:289-304` — transport handler runPromise edge
- `apps/harness/src/harness-runtime.ts:375-401` — stop facade (Deferred published first, runFork)
- `apps/harness/src/process-entry.ts:32-40, 73-103` — failStartup/failShutdown, port-close wiring, unhandledRejection
- `apps/harness/src/process-shutdown.ts:9-22` — port-close handler
- `apps/harness/src/storage/application-database-authority.ts:34-47, 81-198, 288-320, 401-438` — Promise interface, leases, admission, decision lock, unbounded stop
- `apps/harness/src/storage/project-storage-locks.ts:15-91` — permits, service, raw surface, facade
- `apps/harness/src/storage/permit-lock.ts:7-22` — FIFO Promise lock (runSync release)
- `apps/harness/src/storage/project-storage-store.ts:253-257, 530-574, 725-762` — locks contract, sessions, admission tracking, stop
- `apps/harness/src/storage/project-storage-node-adapters.ts:156-159, 179-188, 333-350, 388-416` — owns-authority flag, clients, facades, adapter build
- `apps/harness/src/storage/project-storage-node-registry.ts:60-89` and `project-storage-node-errors.ts:37-76` — duplicate guard
- `apps/harness/src/storage/project-storage-upgrade-node-adapter.ts:558-559` — third inline copy of the guard
- `apps/harness/src/active-project-coordinator.ts:507-573, 657-733` — lifecycle queue, drained Deferreds, release, stopOnce, holdsProject
- `apps/harness/src/canonical-project-writer.ts:111-146, 212` — inSlot (in-fiber release), closeOnce, settle microtask
- `apps/harness/src/registration/project-registration-flow.ts:185-195` — in-fiber steps semaphore
- `apps/harness/src/registration/project-listing.ts:201-228` and `registration-storage-bootstrap.ts:99-122` — per-call Storage owners
- `apps/harness/src/registration/registry-database.ts:44-68` — applicationDatabaseFor and the standalone WeakMap
- `apps/harness/src/storage/retryable-attempt.ts:6-30` — shared retryable attempt
- `apps/harness/src/project-registration-observer.ts:90-113` and `registration/repository-identity-query-owner.ts:316-340` — handwritten race budgets
- `node_modules/effect/src/Semaphore.ts:214-314` — waiters, release scheduling, withPermits
- `node_modules/effect/src/internal/effect.ts:3947-4011, 5672-5682, 5778-5802` — scopeClose, run* semantics, sync flush
- `node_modules/effect/src/ManagedRuntime.ts:291-371` — scopes, fiber registration, dispose
- `node_modules/effect/src/Layer.ts:243-265, 395-455, 583-586, 972-977, 1433-1479, 1593-1594, 1904-1923` — memoization and build order
- `node_modules/effect/src/Deferred.ts:1649-1663` — synchronous, ordered resume
- `apps/desktop/src/main/main.ts:53-74, 343-471` — module state, bootstrap, quit handlers
- `apps/desktop/src/main/desktop-shutdown.ts:28-89` — shutdown program, finish, beforeQuit
- `apps/desktop/src/main/harness-supervisor.ts:25, 40, 60-202, 351-420, 443` — grace, observation, stop, stopChild, timers, quarantine
- `apps/desktop/src/main/harness-pending-request.ts:10-77` — G28 Promise core
- `apps/desktop/src/main/project-entry-bridge.ts:38-210`, `project-storage-bridge.ts:27-240`, `workspace-bridge.ts:22-307` — three pending-bookkeeping copies
- `apps/desktop/src/main/harness-session.ts:35-111` — synchronous emit, detach
- `apps/desktop/src/main/project-conversation-failure.ts:33-79` — G25 fault mapping
- `apps/desktop/src/main/harness-log-lines.ts:30-89` — forwarding filter and tail flush
- `packages/protocol/src/protocol.ts:87, 177-213, 252-344` — protocol v8 envelopes; no cancel, single-reply

## Integration Points

### Inbound References
- `apps/harness/src/process-entry.ts:81-97` — starts the bootstrap and wires the port-close stop
- `apps/harness/src/canonical-project-application.ts:90-103` — conversation read/save and stop into the coordinator
- `apps/harness/src/storage/project-storage-application.ts:176` — Storage stop from the runtime
- `apps/harness/src/registration/list-visibility.ts:83-93` — `withHeldProject` from registration (Effect → Promise → Effect)
- `apps/desktop/src/main/project-entry-ipc.ts:26-44`, `project-registration-ipc.ts:48-56`, `main.ts:227-249` — IPC edges into the bridges
- `apps/desktop/src/main/main.ts:423-443` — `before-quit` / `window-all-closed` into desktop shutdown

### Outbound Dependencies
- `effect` 4.0.0 (`node_modules/effect/package.json:4`) — Semaphore, Deferred, Layer, ManagedRuntime, Scope semantics above
- `node_modules/pino/lib/tools.js:274-281, 366` — async harness stdout with exit flush
- `apps/harness/src/storage/local-libsql-worker-client.ts:522, 542` — worker message bridge (stays; Part B)

### Infrastructure Wiring
- `apps/harness/src/process-bootstrap.ts:262-269` — the harness Layer graph
- `apps/desktop/src/main/main.ts:58-68, 378-411` — Electron owner construction and shutdown wiring
- `apps/desktop/vite.harness.config.ts`, `tests/e2e/package-smoke-load-order.mjs` — packaged load-order guard (precedent `ff162f5`)

## Architecture Insights
- **Today's real pattern:** Layers build things and handwritten Promise code handles the lifecycle. "One ManagedRuntime per process" holds today only by count. A Part A that only adds `acquireRelease` would wrap the coordination instead of replacing it, which lifecycle plan :40 forbids.
- **Owner-local stops:** the shutdown order depends on runtime state (held Project, canonical outcome) and is not a fixed graph order. Scope finalizers fit resources whose release is independent of that order. The held-Project sequencing is a program, so it stays a program (`harness-runtime.ts:114-164`).
- **Ordering is the main risk:** `runSync` release is the only FIFO hand-off the project has. Any move of callers into fibers removes it unless the design deliberately replaces it (precedents `00f4a23` → `ff162f5`).
- **Owner kinds:** there are three Storage owner kinds and one authority. The shared ones are one per process; listing and bootstrap are per call with their own locks and clients. Layer identity memoization makes accidental sharing a one-line mistake.
- **Desktop:** settlement timing in the desktop is a tested contract (`f810132`, `desktop-shutdown.test.ts:42-43`). The three bridges duplicate bookkeeping and have drifted apart, so G28 is as much about unifying them as about moving them to Effect.

## Precedents & Lessons
5 similar past changes analyzed.

### Precedent: Unit 2b-1, owners from Layers in one ManagedRuntime, with an Effect-owned shutdown
**Commit(s)**: `615df7a` — "refactor(harness): compose owners with Effect layers and an Effect-owned shutdown" (2026-10-03)
**Blast radius**: 3 files, 1 layer
  apps/harness/src/ — process-bootstrap.ts, harness-runtime.ts (+test)

**Follow-up fixes**:
- `7058508` — "fix(registration): run the remove-from-list guard inside the coordinator queue" (2026-10-05) — a check made outside the lifecycle queue raced with activation
- `43bc303` — "fix(harness): fix the C1-0 deep-review findings in the staged upgrade" (2026-10-07) — a quit during an upgrade must stop Storage together with canonical when no Project is held

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md:25, :40, :66-68 — keep owners separate under memoization; close admission in the same turn; publish the stop promise before callbacks (Unit 2a re-entry stack overflow)

**Takeaway**: disposal and memoization must keep separate owners separate and keep the same-turn order; re-entry has broken once already.

### Precedent: SerialLock replaced by an Effect permit lock, then the #110 locks service
**Commit(s)**: `00f4a23` — "refactor(storage): replace SerialLock with an Effect permit lock" (2026-10-03); `ff162f5` — "refactor(harness): split project-storage-node-adapters into owned project storage parts" (2026-10-16)
**Blast radius**: 6 files (storage, coordinator); then 24 files (storage, packaging config, e2e smoke)
  apps/harness/src/storage/ — permit-lock.ts, project-storage-locks.ts (+tests)

**Follow-up fixes**:
- in-slice #110 round 1 (T1 high): the service facade order became `held,late,waiting`; the fix returned to `permit-lock.ts` with a `runSync` release
- in-slice §79-80: `package:launch-smoke` regressed through rolldown chunking (not the facades); the fix was bundle config plus a load-order guard

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md:238-259, :309 — in-Effect barging residual U11; Context7 documents no fairness
- .rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:729, :736 — pins first (red on the facade, green on the base); U6/U9/U11 carried to #123
- .rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md:114, :132, :414 — `runPromise` rejects fail and die with the same object, so mutants that swap them survive

**Takeaway**: pin the "later arrival" order for in-fiber callers before converting, and plan the packaged smoke.

### Precedent: Unit 2c, desktop supervisor timing and shutdown through Effect
**Commit(s)**: `f810132` — "refactor(desktop): run harness supervision timing and shutdown through Effect" (2026-10-04)
**Blast radius**: 2 files, 1 layer
  apps/desktop/src/main/ — harness-supervisor.ts, desktop-shutdown.ts

**Follow-up fixes**:
- `43bc303` (2026-10-07) — keep forwarding harness lines until the child's stdout ends
- `c417342` (2026-10-05) — the packaged smoke expected an outdated preload list (red unnoticed since `be631a2`)

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:491 — G28 migrates in #123 before C2

**Takeaway**: bridge and shutdown settlement timing is a tested contract; a main ManagedRuntime must not shift microtask or turn order without a decision.

### Precedent: application.db authority and its race fixes
**Commit(s)**: `daee118` — "chore(effect): checkpoint schema migration, unit 2a and application.db authority" (2026-10-03)
**Blast radius**: 169 files across kernel, protocol, harness and desktop

**Follow-up fixes**:
- `18d9761` (2026-10-03) — a fresh database was counted as observed
- `32c52fa` (2026-10-03) — verify the schema before commit
- `9aab1cc` (2026-10-09) — the authority owns the registry witness rule (join in-flight creation under the decision permit)
- `9be86e4` (2026-10-05) — worker moved to node:sqlite after a native finalizer crash

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md:96, :107-111 — admission waits outside the worker queue; stop refuses new admissions and drains admitted work

**Takeaway**: a finalizer must keep lazy creation, join-in-flight and stop-last ordering.

### Composite Lessons
- Ordering keeps breaking (Unit 2a re-entry; `ff162f5` FIFO; `43bc303` shutdown concurrency). Pin same-turn, FIFO and start-deferral order with binding red/green tests before converting any facade.
- `runSync` flushes semaphore wake-ups and `runPromise` defers them. Moving callers onto one runtime removes the flush unless the design keeps or replaces it on purpose (U11).
- Packaged proofs catch what source tests miss (`ff162f5`, `c417342`). Plan `package:launch-smoke`, a heavy run that needs the coordinator's go-ahead.
- Facades hide fail versus die. The error mapping needs Effect-level tests for mutation coverage.
- CodeScene dropped after every migration batch (`c87727d`, `29f7224`). Budget a refactor pass per touched file.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md` — Unit 2 lifecycle plan and Unit 2b proposal
- `.rpiv/artifacts/evidence/2026-10-03_effect-migration-authority.md` — Effect migration authority
- `.rpiv/artifacts/evidence/2026-10-03_effect-sql-owner-decision.md` — SQL owner decision
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` — decisions log (§46 G25/G28 :490-491; §81-82 :729-736; §102 :890-895)
- `.rpiv/artifacts/evidence/2026-10-10_94-timeouts-under-load.md` — #94 study; finalizer gap and standalone authority (:139-142)
- `.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md` — #110 evidence; in-Effect barging residual
- `.rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md` — C1 S4 design; G28 (:273, :374, :1020)
- `.rpiv/artifacts/designs/2026-10-15_20-38-03_split-project-storage-node-adapters.md` — #110 split design
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md` — roadmap (Phase 2 :49; §6 :127-136)
- `.rpiv/artifacts/research/2026-10-04_sql-code-to-effect-pros-cons.md` — SQL-to-Effect pros and cons (Part B input)

## Developer Context
Checkpoint deviation: under the coordinator brief, questions for Pedro go through the coordinator and the research stops after writing. The developer checkpoint (skill Step 3) was therefore not run live. The grounded checkpoint questions are recorded under Open Questions as pending for Pedro. Design waits for his answers.

**Q (coordinator brief, 2026-10-16): What is in Part A scope?**
A: Per decisions log §102 (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:890-895`): one ManagedRuntime per process (harness and Electron main), services at ownership boundaries, explicit shutdown sequencing, removing replaced coordination, the ApplicationDatabase finalizer gap, the #110 carry-forwards, and the G28 bridge core. The SQL-body pass is Part B, after C2.

## Related Research
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md`
- `.rpiv/artifacts/research/2026-10-04_sql-code-to-effect-pros-cons.md`
- `.rpiv/artifacts/research/2026-10-05_20-24-35_project-database-staged-upgrade.md`

## Open Questions
Pending developer checkpoints for Pedro, routed through the coordinator, most significant first:

1. **Shutdown shape** (`apps/harness/src/harness-runtime.ts:114-164` vs `node_modules/effect/src/internal/effect.ts:4000-4011`). Does shutdown stay one explicit program run before `runtime.dispose()`, with Layer finalizers only for releases that do not depend on order (clients, timers)? Or does any owner's stop move into a Scope finalizer, which would need a decision on the lost guarantees (same-turn closure, the withheld rule, not-held concurrency, aggregated failures)?
2. **Bounded close for the authority** (`apps/harness/src/storage/application-database-authority.ts:434-438`). Today `stop()` waits forever on an unconfirmed lease, on the explicit path as well. Should Part A add a deadline with a truthful "cleanup unconfirmed" outcome? If so, what bound? And is it confirmed that the database finalizer must not stop the authority when Storage was withheld (`harness-runtime.ts:153-155`)?
3. **FIFO inside Effect** (`node_modules/effect/src/Semaphore.ts:264-275`). The options are:
   - (a) a project-owned fair lock built on `Deferred` hand-off (`Deferred.ts:1649-1663`), with the facade pins ported to in-fiber callers;
   - (b) keep the `runSync`-release edge as the ordering point;
   - (c) accept barging under a written contract.
   
   A related question: are the existing in-fiber barging sites `canonical-project-writer.ts:112-118` (comment :129) and `registration/project-registration-flow.ts:194` defects for Part A to fix, or accepted?
4. **Facade cut line** (inventory in Detailed Findings §7). Which of the about 15 facades and coordination sites migrate in Part A, and which stay until Part B? In particular, does the four-level conversation-save nesting (`active-project-coordinator.ts:722` → `canonical-writer-conversation.ts:52`) move in Part A, given that C2 streams through it?
5. **Electron main and #96** (`apps/desktop/src/main/desktop-shutdown.ts:79-84`, `harness-supervisor.ts:148-152`). Does Part A include #96's bounded wait for stdout end? The roadmap places it here (`2026-10-10_pending-work-roadmap.md:49`). If so, what is the bound inside the `preventDefault` window, given the current 10 s worst case? Should IPC handlers be removed on shutdown, or keep answering envelopes after dispose (`main.ts:227-249`)?
6. **Bridge scope for C2** (`apps/desktop/src/main/harness-pending-request.ts:55-77`; `packages/protocol/src/protocol.ts:252-344`). Does Part A only replace and unify the Promise core (one Effect pending-request owner, with no protocol change), or also add a protocol cancel command or multi-event reply ahead of C2? Should the behaviour drift between the three bridges (null `causationId`, `system.failure`; `project-entry-bridge.ts:66` vs `project-storage-bridge.ts:231-233`) be unified? That would be a behaviour change and needs a decision. Is the re-entrant quarantine ordering, where a read during a protocol error answers `unavailable` rather than `broken` (`harness-supervisor.ts:443`; `project-conversation-failure.ts:57-59`), accepted or a defect?
7. **Baseline and gates.** Re-baseline the #123 counts (now 121/64/286/6/36-in-20). Plan `package:launch-smoke` and mutation runs as coordinator-approved heavy runs (precedents `ff162f5`, `c417342`).
8. **Standalone authority leak** (`apps/harness/src/registration/registry-database.ts:44-67`). The leak is not reachable in the production graph. Should it still be closed in Part A, by owning or stopping standalone authorities, or recorded as test-only?
