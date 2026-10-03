---
date: 2026-10-03
author: OpenCode
commit: 11b1989
branch: feat/effect-migration
repository: slopstop
status: in-progress
---

# Effect Migration — Next Lifecycle Work

This records the OpenCode/Claude implementation discussion under the approved full migration. It does not change product guarantees or grant global acceptance. Unit1 Schema remediation is a retained technical checkpoint; integration/packaged failures remain pending.

## Corrected Failure Classification

- Switch-result expectations that omit `sourceReleased` lag behind the committed Projects UI/runtime. The current protocol allows this field, the producer returns true after source release and false when preflight refuses while preserving the incumbent, and the renderer consumes it. Updating exact fixture expectations to match that established behavior is technical consistency, not permission to remove authority/ordering assertions.
- The purported missing `mode: read-write` is **not an oracle-only discrepancy**. Parent read the full retained diff: expected `status: created`, received `status: unavailable`. The absent mode is a consequence. `CreatedResultSchema` still requires that mode. Keep both assertions and diagnose the actual Storage failure.
- Some same-turn tests also report hook timeouts. Determine whether they are secondary to failed fixture creation before classifying every timeout as a separate coordinator defect.
- Shutdown-order tests identify an asynchronous gap before canonical stop. The runtime currently awaits listing stop before invoking canonical stop. Preserve synchronous admission closure and canonical-drain-before-its-Storage-release guarantees.

## Resource Ownership Clarification

`process-bootstrap` supplies one Storage owner to the canonical coordinator and Project Storage application. `project-listing.ts` creates a different owner per list call and stops it in a finally block. They touch the same installation but do not share the same owner instance.

Do not impose a guessed universal listing/Storage shutdown order. Derive dependencies explicitly, stop intake immediately, drain all in-flight owners, withhold the coordinator's Storage close when canonical release fails, and retain/aggregate cleanup failures. When introducing Layers later, memoization must not accidentally merge these owners and let listing close the active Project's resources.

## Unit2a — Bounded Baseline Repair Before Effect Lifecycle Changes

Claude initially remains the exclusive writer in `ragnarok-effect`.

1. Authorized first action: reproduce one failing Storage-create case in isolation, capture its real diagnostic and owner outcome with a small temporary env-gated trace, then remove the trace. Report after approximately15minutes or a concrete result. A local fault may be corrected through the existing failing public test; do not loosen `created`/`mode` assertions, raise deadlines or claim a cause from coincidence.
2. Recheck the affected timeout cases after that cause is understood. Avoid broad reruns while diagnosis is incomplete.
3. Correct only demonstrated stale switch fixtures and the real shutdown-order defect, with focused before/after proof. Preserve complete admission, release-failure and ownership oracles.
4. Investigate the packaged bootstrap timeout in a separate bounded probe after the above checkpoint. No repeated package/deep loops without a discriminating hypothesis.

## Unit2b — Proposed Effect Runtime/Lifecycle Unit

Not started by this record. Proposed scope: one ManagedRuntime per harness utility process, Effect services at actual ownership boundaries, explicit shutdown sequencing and effect-managed in-process work. Keep native adapters and the selected SQL worker boundary. Preserve bounded close and pending-recovery; generic disposal/timeout is insufficient by itself.

Same-turn command admission must close synchronously before asynchronous scheduling. Durable counters/history are not replaced with fibers merely because fibers exist. Main-process supervision can be a subsequent coherent unit. The final implementation must remove the replaced handwritten coordination rather than add wrappers around it.

No commit, merge, push, SQL-client replacement or product-contract change follows from this plan. Wider strategic guarantee simplifications still require the user. Parent reviews the actual diagnosis and fix before starting the next lifecycle migration unit.

## Unit2a C/A/D Review — Current Checkpoint

OpenCode inspected the frozen source and independently verified the tracked diff against base11b1989: SHA-256 `83c8263fce4f3a39baf5415948f1bc61990709fe52a123ae54373af809fcda4e`. This includes Unit1; the bounded review here concerns the worker file-release repair, truthful switch expectations and shutdown ordering/reentrancy.

- Worker source: `a8fa87ebf4a03c88a5e9768c9281326e398ea35449cb4dc36c0b932a670126a0`.
- Runtime source: `e9b6f8c8575cc78e2c7cf6d192608847f976315e42ab6b615aadc0c9b58c30b2`.
- Runtime test: `f35691a514c3fedaaf3d0905b169192c2020e300b1535592d74e6dda9ac4ad65`.

### C — Demonstrated Windows staging-rename defect

Retained traces identify EPERM at the staging-directory rename while other clients remain open in the same native worker. The existing file-handle finalization ran only when the pool became empty. The fix runs the same worker-local GC and existing10ms completion turn after each client close, retaining other live clients in the map. It adds no GC flags to Electron main/utility-process configuration.

The permanent regression uses the public client: keep A open with a row, open and close B in a staging directory, rename B without retry, and verify A still reads its unchanged row. Claude reports a bounded run against the former condition reproduced EPERM and the corrected six-case worker suite passed. Parent inspected the regression and source, and read the earlier trace logs directly. This explains the demonstrated rename defect, not every historical native crash.

### A — Exact fixture alignment

The shared switch fixture and identified settlement/reconciliation literals now report `sourceReleased: true` after actual source release, retaining all request, target, authority and ordering assertions. They do not change the runtime contract or weaken Storage-created/mode assertions.

Parent read the retained sequential integration results: switch65/65, settlement105/105, selection9/9 and reconciliation517/517 passed. Open2 failures, registration1, lifecycle9 and writer-package-smoke81 remain reported failures; this checkpoint does not clear them.

### D — Shutdown order and reentrancy

The repaired runtime unsubscribes intake synchronously, invokes canonical and independently owned listing stops in the same turn, withholds the shared Storage stop on canonical failure, and aggregates observed failures. Parent identified a regression in the first repair: the shared stop promise was assigned only after callbacks, allowing synchronous re-entry to duplicate cleanup.

The final source publishes the shared promise before any cleanup callback. The permanent public test re-enters stop from canonical cleanup and checks promise identity, same-turn invocation and exactly-once cleanup. Claude reports the previous source failed this test with unequal promises/stack overflow and the corrected runtime/coordinator pair passed123/123, with clean types/Biome. Parent verified the exact final source/test hashes and requested the retained paths for those latest results; no duplicate broad run was requested merely to regenerate metadata.

**Review conclusion:** the inspected C/A/D corrections are coherent and the identified reentrancy defect is resolved in code. Latest execution counts above remain attributed to their retained logs or explicitly to the author where raw paths are still being supplied. No new concrete production defect was found in this bounded review. Global migration readiness, remaining baseline failures and packaged-launch proof are not approved. The next bounded investigation is the packaged bootstrap timeout, before the later Effect lifecycle implementation.

### Follow-up — Retention Qualification And Step4 Dispatch

Claude confirmed that the latest reentrancy Red,123/123 Green, worker previous-source EPERM Red and6/6 Green were console-only in his session, not separate retained log files. Parent keeps those results explicitly attributed to the author's report and the inspected permanent regression tests. They are not relabelled as independently verified raw captures. No repeat was requested solely to recreate bookkeeping.

Parent authorized the already planned bounded packaged-bootstrap investigation on the current C/D implementation: rebuild if necessary, use disposable data and existing CI diagnostics, identify the actual failing startup/creation/UI/quit stage, and report within approximately15minutes. No broad-suite repeat, security-fuse change, new utility-process GC flags, WER/admin changes, commit or merge is included. A newly passing smoke run would be current proof, not conclusive identification of the historical timeout's cause. Effect lifecycle Unit2b remains later work.

## Step4 — Packaged Startup Cause And Next Failing Boundary

The first bounded probe showed that the harness exited with code1 before ready; no registry database was created. A temporary local stderr trace identified the Koffi loader error: the target native module was missing. The trace was removed. Parent independently inspected pinned `koffi@3.2.1/package.json`: its platform binaries are optional dependencies, including `@koromix/koffi-win32-x64`. The runtime collector followed ordinary dependencies and explicitly added libSQL's target binding, but omitted Koffi's target package. The same omission exists at the preserved registration baseline.

The narrow correction stages only `@koromix/koffi-${process.platform}-${process.arch}` from the Koffi package root, retaining the awaited writeBundle barrier and security fuses. The package resource preflight now requires the matching unpacked `koffi.node`; hiding that binary produced the exact preflight refusal and it was restored afterward. Parent inspected these source changes.

Claude reports the resulting asar contains the target package and that the1036800-byte `koffi.node` exists in the unpacked runtime tree alongside the required Effect/libSQL resources. Retained scratchpad evidence includes `2a-step4-preflight-red.log` and `2a-step4-final-probe.log`.

**Progress is specific, not an overall smoke pass:** resource preflight and invalid-authorization cases passed; harness now reached ready. The bootstrap scenario then exited nonzero at `storage-healthy-project-create`. The preceding absent-open/not-registered and renderer proof completed. The bridge create result's status/code were not yet logged, so its cause remained unknown.

Parent authorized one further bounded trace of that create boundary, capturing only result status and diagnostic code (plus transport failure code if applicable), with disposable authorized data. No accepting a non-created result as healthy, deadline increase, global stderr exposure, new runtime flags, broad suite or security change is authorized. Any behavioral fix must follow the demonstrated cause and existing contract. This Koffi diagnosis does not identify the cause of the earlier native worker crashes.

### Create-Boundary Observation

The temporary packaged traces returned `unavailable / PROJECT_STORAGE_UNAVAILABLE`, caused by underlying libSQL `SQLITE_BUSY` on application.db before any Project generation directory existed. The failure reached the caller through the normal unavailable-Storage classification; it was not a bridge parse error, missing native module, prior-state refusal or elapsed deadline. Claude restored source to tracked diff `7bd53525...`; trace builds were identified separately and will be replaced by the next package build.

The contending owner/operation is **not yet established**. Registration initialization, listing's private owner and the shared Storage owner all access the installation database. Merely observing those code paths does not prove which held the write lock.

Parent authorized a final bounded transaction trace using logical connection/transaction IDs, operation labels and timestamps, without SQL arguments/content or local paths. Identify whether the contention occurs at BEGIN, migration, journal PRAGMA or another operation before selecting a fix. The existing worker serializes requests; a busy wait inside that queue may prevent the queued COMMIT that would release the lock. Therefore a timeout increase alone is not an approved repair, nor is moving the visible list operation merely to hide the race. Any coordination change must preserve the current ownership and transaction contracts and be supported by the observed contender.

## Identified Contender And Joint Proposal — Awaiting Human Decision

A single packaged harness/application-worker trace identified concurrent fresh-database initialization. Client1 held a write transaction while applying the registration registry's initial migration and integrity checks. Client2 inspected sqlite metadata outside a transaction, saw the uncommitted database as fresh, then its BEGIN failed with SQLITE_BUSY before client1 committed. All activity was in one process/worker; it was not a demonstrated external-process or WAL-PRAGMA conflict.

The Storage migration begins in `project-storage-node-adapters.ts:prepareCreate` through `applyGeneratedMigrations`, not in `ApplicationClientManager.initialize`, whose default is only foreign-key configuration. The registry independently applies the same application schema through `migrateRegistry`. Thus a gate around only client opening/PRAGMAs would miss the actual race, and inspecting freshness before serialized migration could still allow duplicate DDL decisions.

OpenCode and Claude recommend **one storage-level application-database authority per harness**, covering initialization and in-process transaction admission for that database. This is a proposal, not authority to implement yet:

- The schema has one initialization/migration owner; inspect freshness inside the protected transaction, not before admission. Preserve the existing migration checkpoints, uncertain-commit recovery, corruption/newer/missing-witness diagnostics and integrity checks.
- Wait for transaction admission in harness code outside the worker's serial request queue. Do not block that worker on a lock whose owner needs the same queue to COMMIT.
- Scope admission to database work; never retain it over Git execution, filesystem staging/rename or other non-database awaits.
- Registration, shared Project Storage and private listing owners receive the same per-harness authority. Their connection/resource ownership and private listing lifecycle remain distinct.
- Determine actual journal mode and protect consistent reads appropriately; a write-only gate does not by itself prove that all read/commit interactions are safe.
- Stop refuses new admissions, drains admitted work and preserves canonical-failure-withholds-Storage and truthful incomplete cleanup.
- This does not solve contention from another harness/process/external program or coordinate canonical/runtime Project databases. Those limits remain explicit.

Alternatives discussed but not recommended: force registry initialization before harness ready (changes startup semantics and leaves later write contention), or make Project Storage depend directly on the repository-registration module (incorrect dependency direction). A one-time initialization promise alone also leaves later in-process transaction races.

If the user approves, this can be the first coherent Effect-owned database service rather than implementing a new manual coordination mechanism solely to replace it in the next step. Inventory all application.db access paths first; test a controlled concurrent fresh list/create with exactly one schema initialization and correct outcomes, then existing/missing/corrupt/restart behavior. No code changes for this proposal have been made.

### Human Approval — Application Database Authority

The user explicitly answered **“sim”** to the proposal above: one shared Effect-owned service initializes application.db and coordinates its in-process transactions outside the worker queue. This authorizes implementing that bounded service in the migration worktree, replacing the competing application-schema initialization paths rather than adding a second legacy route.

The approved scope remains per application database and harness. Preserve lazy operation-specific initialization rather than changing the meaning of harness-ready; preserve private client ownership, classified commit uncertainty, existing/missing/corrupt/newer schema outcomes and bounded shutdown. Reads must follow the actual journal/transaction behavior; no gate may be held over Git or filesystem staging work.

Claude receives exclusive implementation ownership in `C:/Users/pedro/Documents/GitHub/ragnarok-effect`; OpenCode reviews the completed checkpoint. No main/registration-worktree source edits, commit, merge, push, SQL-engine replacement, new runtime flags or weakened tests are included. The existing worker and Drizzle choices remain in effect. The code-free proposal above is retained as history; this section supplies the subsequent human authority to build it.
