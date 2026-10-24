# Registered Project selection: busy activation after Phase 1 (2026-10-24)

## Failure

After Phase 1 was squashed onto main as `4dbd834`, the pre-push gate failed twice on one row: `tests/integration/registered-project-selection.integration.test.ts`, "runtime switches between two registered Projects and releases the old writer without creating Storage". It threw `Activation A missing` (`requireActive`). It failed once in `test:integration` and once in `test:coverage`, and the file alone passed 9/9.

The #94 trace of the second run (pid 27016) records activation A as:

```json
{"status":"unavailable","diagnostic":{"code":"REGISTRY_BUSY","message":"Registered Project selection could not be admitted.","retryable":true}}
```

## Cause

- Phase 1 s1 (P1-B1) forks one start reconciliation in `process-bootstrap.ts`. When `application.db` exists, it runs one write transaction (`BEGIN IMMEDIATE`) at every harness start.
- The row started two process runtimes on the same root (`host`, then `reopened`) before acting. Each runtime has its own application database authority, so the in-process one-writer queue does not order them.
- The worker client opens SQLite with `timeout: 0` (`local-libsql-worker-client.ts:213`). The first runtime's activation reads its registration record in a write transaction (`registered-project-selection.ts`, `readRegistrationRecord`). It therefore failed with `SQLITE_BUSY`, mapped to `REGISTRY_BUSY`, whenever the second runtime's start reconciliation held the lock.
- **Why only under the full suite:** alone, the second runtime's reconciliation commits before the first runtime's activation reaches its transaction. Under full-suite load the reconciliation is slower and the two overlap.

## Deterministic repro (scratch row, deleted afterwards)

The scratch row did three things:
1. It started the first runtime and waited 1.5 s.
2. It spied `withWriteTransaction` (the `project-storage-transaction.js` namespace) to hold the next transaction inside `BEGIN IMMEDIATE`. That transaction was the second runtime's start reconciliation.
3. It then activated A on the first runtime.

Observed results:
- `HELD {"status":"unavailable",...,"diagnostic":{"code":"REGISTRY_BUSY",...,"retryable":true}}`
- After the release, activating A on the second runtime answered `active`.

CPU before the run: 16/17/16 %, with no game processes.

## Product impact

Product impact is none in practice. The desktop holds `requestSingleInstanceLock` (`apps/desktop/src/main/main.ts:388`), so two harnesses never share one `userData`, and the answer is retryable. Two runtimes over one root is a test shape.

## Same race class: search

I scanned for tests that keep two runtimes live on one root while one acts.

**Method:**
- A scratch script listed every test block where a second runtime start comes before a stop. The starts it matched: `startHarnessProcessRuntime` and the fixtures over it, `createStorageRuntimeForRoot`, the conversation runtimes, the upgrade runtimes, `registrationSession`, `createRecoveryRuntime` and the file-local `runtime`.
- It covered `apps/harness/tests/integration/*.test.ts` and `apps/desktop/tests/e2e`.
- Only process runtimes (`startHarnessProcessRuntime`) run the start reconciliation.

| Hit | Verdict |
| --- | --- |
| `registered-project-selection` "runtime switches between two registered Projects..." | **Same race. Fixed:** `reopened` now starts after the first runtime's switch and old-command check. |
| `registered-project-selection` "runtime selects read-only when another session owns the writer..." | **Same race** (the reader's start against the writer's activation). **Fixed:** the reader now starts after the writer's activation. |
| `project-conversation-runtime` CNV-B30 | No race: the first runtime stops before the second starts. |
| `project-conversation-runtime` CNV-B14 | No race: the composed runtime uses `startHarnessRuntime` (no start reconciliation). The process writer's own activation queues behind its own reconciliation on one authority, and the composed runtime acts only after that. |
| `project-storage-create` (line 711 block) | No race: `createStorageRuntimeForRoot` uses `startHarnessRuntime` (no start reconciliation). |
| `apps/desktop/tests/e2e` `single-instance.test.ts` | No race: the second app exits on the single-instance lock before starting a harness. |

Both fixes are test-only. They move a runtime start later and keep every assertion unchanged. The coordinator approved this. The scan is a line heuristic, not proof that no other overlap exists.

**Not proposed now:** skipping the start write transaction when nothing is unsettled. That would be a product change.
