---
date: 2026-10-06T13:20:24+0100
author: Pedro Mesquita
commit: 17cc797
branch: main
repository: slopstop
topic: "C1-0 S3: upgrade request through the harness (S3a) and the window flow (S3b)"
tags: [design, protocol, coordinator, desktop, renderer, c1-0, s3]
status: ready
parent: .rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md
last_updated: 2026-10-07T15:38:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Follow-up appended: S4 upgrade documentation done; full journal tracked in #92."
content_hash: 85b37dcdbc4920c2c73f36c6e789da75948d2ac446c8034a03e6ec6a2abd3abe
---

# Design: C1-0 S3 — upgrade request through the harness (S3a) and the window flow (S3b)

Lane: normal (`lane.mjs --paths`, 2026-10-06: files > 5). S3b will classify as rigorous (`preload`, `ipc`). Intent review at the user's request; at most two rounds per slice.

## Intent

S1 and S2 (`ad823a0`, `17cc797`) give the harness storage owner a complete, self-recovering `upgrade`, but nothing outside tests calls it. S3 makes it reachable: the app runs as a single instance (S2 E9), the desktop can send `project.upgrade` and receive its result, abandoned upgrades are written to the app's local log, and the window turns "safe mode: migration required" into "Updating Project…" followed by the normal Project view — or, on failure, a read-only Project with a clear message, the real reference code and, unless the upgrade was refused, "Try again".

Authoritative requirements: parent design (`.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`, content hash `ed78b8c649415c006fbf1e7516be26e62eafcb6add04d599ae67d85699c1aa6d`) Deferred Work "S3"; S2 design (`.rpiv/artifacts/designs/2026-10-06_02-02-21_upgrade-failure-and-recovery.md`, content hash `2d565ae2bfea3556773d4fdb87e9881596c65f1aed5c270d778885a362896485`) E4, E9 and Deferred Work "S3"; FRD (`.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md`, content hash `d45f5d9c6f63fdfd7cca2e00d6197299522aa2568bae31e3a1c0155165b21105`) FR1, FR7, FR8, FR11, the performance NFR and acceptance criteria 5–7; S2 as built: `.rpiv/artifacts/evidence/2026-10-06_c1-0-s2-tdd-evidence.md`.

Two slices (user): **S3a** `c1-0-s3a-upgrade-request` is the next executable slice; **S3b** `c1-0-s3b-upgrade-window` is outlined and detailed after S3a is accepted.

Non-goals: changing activation results or the bridge's existing activation mapping; Sentry; storage behavior changes; serializing `project.list` with upgrades (accepted risk, F9); the C1 gate; ADR 0006 (S4).

Constraints: AGENTS.md process boundaries and strict decode; one catch of unexpected exceptions at the process boundary; `degrade-distinguishes-broken`; `shared-vocab-union`; D12 busy stays distinct; privacy (log lines carry ids and classes only); CodeScene waiver for `project-storage-node-adapters.ts` (8.41) until after C1; squash merges; two review rounds per slice.

## Architecture

### Facts (verified at `17cc797`)

- `protocolVersion = 5` (`packages/protocol/src/protocol.ts:66`, enforced :401-418); `project.activate` entries :247-251/:278-282; strict factories :478-495; result `causationId` = command `messageId`. Activation failures `{ status, request, diagnostic: { code, message, retryable } }` (`canonical-project-protocol.ts:168-252`); a stopped coordinator answers `PROJECT_COORDINATOR_UNAVAILABLE` with `retryable: false` (`active-project-coordinator.ts:319-325`). The read-write `active` result carries no generation id (`canonical-project-protocol.ts:187-193`).
- Harness runtime: dispatch :186-203, routing :263-284, one catch → `request.failure HARNESS_INTERNAL_FAILURE` `retryable: false` (`harness-runtime.ts:178-184, 286-290`); stop unsubscribes intake before stopping the coordinator (:306-327).
- Coordinator: FIFO permit queue (`active-project-coordinator.ts:474-483`, `permit-lock.ts:12-22`); `execute` is not queued and answers `PROJECT_COORDINATOR_UNAVAILABLE` while `pendingLifecycle > 0` (:638-641); safe-mode activation returns to `inactive` (:452-459); `release-failed` keeps a session (:505, :514-519); `storage` typed `ProjectStorageActivationPort` (:68).
- Production composition: `projectStorageLayer` builds the owner without `failures` (`process-bootstrap.ts:205-217`); `startHarnessProcessRuntime({ bootstrap, transport })` (:88-93). Test composition precedent: `startHarnessRuntime` + `createActiveProjectCoordinator` (`tests/integration/canonical-writer-recovery-runtime-fixture.ts:161,269`) and `createUpgradeStorageOwner` with `failAt`/`onCheckpoint` (`tests/integration/project-storage-runtime-fixture.ts:270-361`).
- Harness Pino writes to stdout (`process-entry.ts:30-37`); the desktop supervisor logs only byte counts of harness stdout (`apps/desktop/src/main/harness-supervisor.ts:340-349`); the desktop logger is bounded and redacting (`logger.ts:22-44`, `bounded-log-destination.ts`).
- Desktop: no `requestSingleInstanceLock`; `bootstrap()` sets the package-smoke `userData` before `await app.whenReady()` (`main.ts:318-331`); `launchBuiltDesktop` uses Playwright `_electron.launch` (`tests/e2e/electron-launch.ts:9-21`); `shell.test.ts:66-73` launches on the default `userData` (Playwright workers = 1).
- Upgrade codes are declared today as harness literals (`apps/harness/src/storage/project-storage-upgrade.ts:31,37`).

### S3a — ownership and data shapes

**Single instance (desktop main).** In `bootstrap()`, after the package-smoke `userData` override and before `await app.whenReady()`, `app.requestSingleInstanceLock()`; `false` → `app.quit()` and return before any window, logger or harness. The holder handles `second-instance` by restoring (if minimized) and focusing its main window.

**Protocol (version 6), one owner of the vocabulary.** `protocolVersion` → `6`. New `packages/protocol/src/project-upgrade-protocol.ts` owns `ProjectUpgradeRequestSchema = Struct({ projectId })`, `ProjectUpgradeResultSchema` and the upgrade code literals; the harness storage types import those literals instead of re-declaring them (`shared-vocab-union`). Exact variants and messages:

| status | code | message | retryable |
|---|---|---|---|
| `upgraded` (+ `sourceGenerationId`, `generationId`, `upgradeId`) | — | — | — |
| `not-required` / `not-registered` | — | — | — |
| `refused` | `PROJECT_UPGRADE_UNSUPPORTED` | "This Project needs a database change that cannot run automatically." | false |
| `refused` | `PROJECT_UPGRADE_NOT_ELIGIBLE` | "This Project's storage cannot be upgraded in its current state." | false |
| `failed` | `PROJECT_UPGRADE_BACKUP_INVALID` | "The pre-upgrade backup failed its integrity check." | true |
| `failed` | `PROJECT_UPGRADE_VERIFICATION_FAILED` | "The upgraded copy did not match the original data." | true |
| `rejected` | `PROJECT_ALREADY_ACTIVE` | "Close the active Project before upgrading." | false |
| `unavailable` | `PROJECT_STORAGE_UNAVAILABLE` | "Project Storage is unavailable." | true |
| `unavailable` | `PROJECT_COORDINATOR_UNAVAILABLE` (coordinator stopped) | "Canonical Project coordination is unavailable." | false |
| `unavailable` | `PROJECT_COORDINATOR_UNAVAILABLE` (transport loss, S3b bridge) | "The Project connection is unavailable." | true |
| `broken` | `PROJECT_STORAGE_BROKEN` | "Project Storage upgrade failed." | false |
| `broken` | `HARNESS_INTERNAL_FAILURE` | "Harness failed while handling a message." | false |
| `broken` | `PROTOCOL_MESSAGE_INVALID` / `PROTOCOL_VERSION_UNSUPPORTED` | the harness failure's own message (`HarnessFailureSchema`, `protocol.ts:171-182`) | false |

Every variant carries `request`. The (code, message, retryable) rows are owned by one protocol constant map that every producer imports — the harness pipeline drops its own `refusalMessages`/`failureMessages` tables (`project-storage-upgrade-pipeline.ts:127-143`) and the coordinator and bridge use the same map (`shared-vocab-union`). The `broken` harness-failure codes reuse `HarnessFailureCodeSchema`. `retryable` describes whether the same request can succeed unchanged; it does **not** decide "Try again" (F3). The harness never produces the harness-failure or transport-loss rows inside `project.upgrade.result`; they let the S3b bridge express a `request.failure` or a lost transport within the same strict schema.

**Coordinator.** `upgrade(request)` enqueued on the permit queue (activations and switches wait; commands answer `PROJECT_COORDINATOR_UNAVAILABLE` while it is queued or running, as for any lifecycle operation). Preconditions: `stopped` → `unavailable PROJECT_COORDINATOR_UNAVAILABLE`; any state other than `inactive` (including `release-failed`) → `rejected PROJECT_ALREADY_ACTIVE`, storage not called. Otherwise `storage.upgrade(request)` (`storage: ProjectStorageActivationPort & ProjectStorageUpgradePort`; the `ProjectStorage` service type in `process-bootstrap.ts:180-182` widens to `ProjectStorageOwner & ProjectStorageUpgradePort`) mapped per the table; a rethrown error is not caught (F2) and the coordinator stays `inactive` and usable.

**Runtime.** `project.upgrade` is routed through `handleCanonicalProjectMessage` → `canonicalProjectApplication.upgrade(payload)`, which re-validates the result against `ProjectUpgradeResultSchema` and the request echo (like `activate`, `canonical-project-application.ts:52-61,93-102`), then `project.upgrade.result`.

**Diagnostics to the local log.**
- *Harness.* `process-entry.ts` builds its Pino logger through a new exported factory `createHarnessLogger(destination?)` (`apps/harness/src/harness-logger.ts`, same options as today: `base: { service: "harness" }`, level, redaction). `startHarnessProcessRuntime` gains a **required** `logger: { info, warn }` input. A new exported production function `createUpgradeDiagnosticsLogger(logger)` (`apps/harness/src/upgrade-diagnostics-logger.ts`) maps `abandoned` → `logger.info({ event: "project-storage.upgrade.abandoned", projectId, upgradeId, reason })` and `discardFailed` → `logger.warn({ event: "project-storage.upgrade.discard-failed", projectId, upgradeId, cause })` (no message argument); `process-bootstrap.ts` passes it as `upgradeDiagnostics` for the coordinator's owner only.
- *Line schema.* `HarnessUpgradeLogLineSchema` (protocol, strict) is exactly what that Pino logger serializes: `level` 30 (abandoned) or 40 (discard-failed), `time` an epoch-millisecond integer, `service: "harness"`, `event`, `projectId` and `upgradeId` (UUIDs), and `reason` (`failed` | `interrupted`) or `cause` (`busy` | `broken` | `unproven`). The reason/cause literals are protocol-owned and imported by the harness diagnostics types.
- *Desktop.* The supervisor keeps today's per-chunk byte-count observation for every stdout chunk unchanged, and additionally splits stdout into lines with a buffer bounded at 16 KiB: once the buffer exceeds 16 KiB without a newline, it discards until the next newline and logs `warn({ code: "HARNESS_LOG_LINE_TOO_LONG", attempt }, "Harness output line dropped.")` once for that line. Each complete line that parses as JSON with an `event` of `project-storage.upgrade.abandoned` or `.discard-failed`: strict decode → `info` (level 30) or `warn` (level 40) of `{ source: "harness", event, projectId, upgradeId, reason | cause, harnessTime: <RFC 3339 from time> }` with message "Harness upgrade event."; decode failure → `warn({ code: "HARNESS_LOG_LINE_INVALID", attempt, event }, "Harness upgrade log line rejected.")`. A non-empty partial line at child exit → `warn({ code: "HARNESS_LOG_LINE_INCOMPLETE", attempt }, "Harness output line incomplete.")`. Every other line produces nothing beyond the per-chunk observation (user decision F8).

### S3b — outline (detailed after S3a)

- **Bridge**: `upgrade` like `activate`; a harness `request.failure` for `project.upgrade` → the `broken` row for its code (all three harness failure codes, `retryable: false`); transport loss → the transport-loss `unavailable PROJECT_COORDINATOR_UNAVAILABLE` row. Activation mapping unchanged. Open question for S3b: the E2E fault mechanism for FRD AC5 under F7.
- **IPC/preload**: `projects:upgrade`, `SlopStopApi.upgradeProject`, strict decode both ways.
- **Renderer**: after a safe-mode activation with canonical `migration-required`, show "Updating Project…", send `upgradeProject`; on `upgraded`/`not-required` activate again; otherwise show the safe-mode view, "This Project could not be updated. Your data is intact.", "Reference: <code>", and "Try again" for every status except `refused` (F3). Keyboard and screen-reader reachable.
- **E2E**: older Project → "Updating Project…" → normal view; a failing case → message, reference, "Try again", then success on retry (FRD AC5 at window level).

### Data flow

```text
renderer (S3b) --activate--> main --> harness: safe-mode migration-required
renderer (S3b) --upgradeProject--> preload --> bridge --project.upgrade--> runtime
  --> coordinator.upgrade (permit queue; inactive only) --> owner.upgrade (S1/S2)
  <-- project.upgrade.result | request.failure HARNESS_INTERNAL_FAILURE
owner diagnostics --> harness Pino (stdout) --> supervisor allowlist --> desktop local log
second launch --> requestSingleInstanceLock false --> quit; holder restores and focuses
```

## Decisions

- **F1 Two slices** (user). The lock lands in S3a, before any production sender of `project.upgrade` (S3b).
- **F2 Internal failure keeps its code** (user): the coordinator does not catch; the runtime answers `request.failure HARNESS_INTERNAL_FAILURE`; the protocol admits that code in `broken` so S3b can pass it on.
- **F3 "Try again" is status-driven** (user: none on refusal; FRD FR7 for every failure): shown for `failed`, `unavailable`, `broken`, `rejected`; not for `refused`. Reopened from round 0, where it was tied to `retryable`.
- **F4 Timing test in the harness, low parallelism** (user). Measures the generation-two fixture (a lower bound; no measured real sizes exist, FRD assumption).
- **F5 Protocol version 6.**
- **F6 Upgrade only from `inactive`.**
- **F7 Fault rows use the test composition**: `startHarnessRuntime` + `createActiveProjectCoordinator` + `createUpgradeStorageOwner`; the real `startHarnessProcessRuntime` proves routing, `upgraded` and the logger wiring. No test-only hook enters the production bootstrap.
- **F8 Desktop forwards harness upgrade log lines** (user) through a protocol-owned allowlist schema.
- **F9 Listing concurrency accepted** (user): `project.list` uses its own owner and is not serialized with an upgrade; worst cases are a transient `recovery-required` row or a busy upgrade (`unavailable`, "Try again"); S2's proof prevents data loss. Pinned by one oracle (UPG-B27).
- **F10 Protocol owns the upgrade vocabulary** (`shared-vocab-union`).
- Inherited: S1 D1–D12, S2 E1–E10; E4, E9 fulfilled here.

## Next Slice

- **slice_id**: `c1-0-s3a-upgrade-request`
- **Behaviors**: `UPG-B24`–`UPG-B30`. Order: B24, B25, B26, B27, B28, B30, B29.
- **Deliverable**: single instance per `userData`; `project.upgrade` with exact results, quiescence and the internal-failure path; abandoned upgrades in the desktop's local log; timing proven.
- **Affected source**: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/harness-supervisor.ts`; `packages/protocol/src/protocol.ts`, new `packages/protocol/src/project-upgrade-protocol.ts`, `packages/protocol/src/index.ts`; `apps/harness/src/active-project-coordinator.ts`, `harness-runtime.ts`, `canonical-project-application.ts`, `process-bootstrap.ts`, `process-entry.ts`, new `harness-logger.ts` and `upgrade-diagnostics-logger.ts`, `storage/project-storage-upgrade.ts` and `storage/project-storage-upgrade-pipeline.ts` (import the protocol literals and message map); `stryker.config.json` mutation scope already covers `protocol.ts` and `harness-runtime.ts` (add `project-upgrade-protocol.ts`).
- **Affected tests**: new `apps/desktop/tests/e2e/single-instance.test.ts`; `apps/desktop/src/main/harness-supervisor.test.ts`; `packages/protocol/src/protocol.test.ts`; new `apps/harness/tests/integration/project-upgrade-runtime.integration.test.ts`; `apps/harness/src/canonical-project-application.test.ts`; `apps/harness/src/active-project-coordinator.test.ts`; new `apps/harness/tests/integration/registration-project-upgrade-timing.integration.test.ts`; typed fakes gaining a throwing `upgrade` stub: `tests/integration/active-project-coordinator-fixture.ts:144`, `canonical-writer-recovery-fixture.ts:374`, `canonical-writer-recovery-runtime-fixture.ts:270`, `project-storage-create-fixture.ts:455`, `conformance-counter-command.ts:596`, `project-storage-runtime-fixture.ts:163`, `canonical-project-activation.integration.test.ts:216`, `canonical-runtime-application-fixture.ts`, `project-storage-lifecycle.integration.test.ts:113`, `src/harness-runtime.test.ts`, `tests/integration/harness-runtime.integration.test.ts`, `src/canonical-project-application.test.ts:88`, `src/harness-runtime-shutdown.test.ts:19`; `startHarnessProcessRuntime` callers gaining a logger: `tests/integration/process-bootstrap.integration.test.ts:214,333,360`, `project-list-runtime.integration.test.ts:15`, `registered-project-selection.integration.test.ts:43`, `registration-flow-fixture.ts:47`, `canonical-project-activation.integration.test.ts:318`; `project-storage-runtime-fixture.ts` (`createUpgradeStorageOwner` accepts injected `upgradeDiagnostics`); new `src/upgrade-diagnostics-logger.test.ts` and `tests/integration/harness-logger.integration.test.ts`; `src/harness-runtime.test.ts` (unit routing case for `project.upgrade`); `protocolVersion: 5` pins in 10 files plus `packages/protocol/src/protocol.test.ts:315,331` (including `schema-boundary-characterization.test.ts:50`, `canonical-writer-smoke-protocol.test.ts:224`, `apps/desktop/src/main/canonical-writer-package-smoke-test-peers.ts:73`).
- **Dependencies**: `17cc797`.

## Test Contracts

**Seams.** (a) *Real composition*: `startHarnessProcessRuntime` over a temporary application root, the checked-in migration root, a transport and a recording logger; a generation-two Project created in that root (`createGenerationTwoProject`). (b) *Test composition*: `startHarnessRuntime` + `createActiveProjectCoordinator` + `createUpgradeStorageOwner` (attempt ids T `…024`/U `…0a1`, T2 `…034`/U2 `…0a2`; `failAt`/`onCheckpoint`; `upgradeDiagnostics: createUpgradeDiagnosticsLogger(recordingLogger)`), as `canonical-writer-recovery-runtime-fixture.ts` composes the runtime; the coordinator's storage is `{ acquireActivation: fixture.owner.acquireActivation, upgrade: fixture.upgrade }` (the fixture wrapper arms faults and attempt ids; the raw owner does not); a `projectListing` over the same root is composed as `process-bootstrap.ts:128,151-164` does; a second Project for "another Project active" is reached through a routed `acquireActivation` to a second root (`canonical-writer-recovery-runtime-fixture.ts:243-249`). Results are matched by `causationId`; whole payloads are asserted with `toEqual`. "Active on T" is observed as the registry's active generation and the activation's canonical path.

- **Behavior UPG-B24**: Only one app instance runs per `userData`.
  - Test: `quits a second launch and keeps the first usable` → `apps/desktop/tests/e2e/single-instance.test.ts` (per-test timeout 60 s; a timeout is a setup failure, not the red)
  - Oracle: A launched with `launchBuiltDesktop` and minimized; B started with `child_process.spawn` of the same `electron.exe` and `launch.cjs` shim and the same `userData` → B exits with code 0 within 10 s; A is restored (`isMinimized()` false via `application.evaluate`), has exactly one window, its Projects heading is visible, and the desktop log holds exactly one "SlopStop desktop starting." line. B with another `userData` → B is still running after 10 s and its own log holds exactly one "SlopStop desktop starting." line; the test then kills B (its own child) and awaits exit.
  - Expected red: B opens a second window (does not exit within 10 s).
- **Behavior UPG-B25**: `project.upgrade` is a strict version-6 message with the exact vocabulary.
  - Test: `encodes and decodes the upgrade request and result strictly` → `packages/protocol/src/protocol.test.ts`
  - Oracle: every row of the table (each code and, for `PROJECT_COORDINATOR_UNAVAILABLE` and the protocol failure codes, each listed message) round-trips through `createProjectUpgradeCommand` / `createProjectUpgradeResultEvent` with its exact message and `retryable`; a wrong `retryable`, a code in the wrong status, another message, or an unknown key at any level → decode failure; a `protocolVersion: 5` command → `PROTOCOL_VERSION_UNSUPPORTED`.
  - Expected red: the union rejects `project.upgrade` (after minimal scaffolding of exports).
- **Behavior UPG-B26**: An older Project upgrades through the real harness and then opens read-write.
  - Test: `upgrades a migration-required Project through the harness` → `project-upgrade-runtime.integration.test.ts`, seam (a)
  - Oracle: `project.activate` → `safe-mode`, canonical `migration-required`, identity S; `project.upgrade` → `{ status: "upgraded", request, sourceGenerationId: S, generationId: T, upgradeId }` with T ≠ S, both UUIDs; `project.activate` → `active` read-write, with the registry's active generation T.
  - Expected red: `project.upgrade` is not routed (it falls into the registry handler; the observed red — a `request.failure` or a registration result — is recorded as observed). A unit routing case in `src/harness-runtime.test.ts` (fake application) pins that `project.upgrade` reaches `canonicalProjectApplication.upgrade` and its result is sent as `project.upgrade.result`.
- **Behavior UPG-B27**: The coordinator maps every outcome exactly, serializes with activations, refuses while a Project is held, and survives a rethrow.
  - Test: `maps upgrade outcomes through the harness` → `project-upgrade-runtime.integration.test.ts`, seam (b) unless stated (one case per row)
  - Oracle (whole payloads per the table): generation-one Project → `refused UNSUPPORTED`; corrupt-manifest Project → `refused NOT_ELIGIBLE`; backup fault at `after-backup-copied` → `failed BACKUP_INVALID`; staged-copy fault at `after-staged-migration` → `failed VERIFICATION_FAILED`, then `project.activate` → safe-mode `migration-required`, then a second `project.upgrade` → `upgraded` with T2/U2 (one-time fault); current Project → `not-required`; unknown id → `not-registered`; S's `slopstop.db` exclusively locked → `unavailable PROJECT_STORAGE_UNAVAILABLE`; contradictory active location → `broken PROJECT_STORAGE_BROKEN`; another Project active read-write → `rejected PROJECT_ALREADY_ACTIVE`, storage snapshot unchanged; the upgrade target itself held read-write (a current Project) → `rejected PROJECT_ALREADY_ACTIVE`, storage snapshot unchanged; a retained `release-failed` activation (pattern of `canonical-project-switch.integration.test.ts:663-720`) → `rejected PROJECT_ALREADY_ACTIVE`; an upgrade held at `after-staged-copy` while `project.activate` and a command are sent → the command answers `PROJECT_COORDINATOR_UNAVAILABLE` immediately, the activation answers only after the upgrade result, read-write on T; a `project.list` sent while the upgrade is held at `after-staged-copy` → answers with that Project's entry in storage safe-mode, canonical and runtime `recovery-required` (deterministic: T's staging row exists at that checkpoint), and after release the upgrade answers `upgraded` (F9); raw step error (pre-created `repository_bindings` in the staged copy at `after-staged-copy`) → no `project.upgrade.result`, one `request.failure { code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false }` with the command's `messageId` as `causationId`, then `project.activate` → safe-mode `migration-required` on S. Stopped coordinator → `unavailable PROJECT_COORDINATOR_UNAVAILABLE` at `apps/harness/src/active-project-coordinator.test.ts` (`stop()` then `upgrade()`; unreachable over the transport).
  - Expected red: after UPG-B26 the mapping is a pass-through (no `retryable`, wrong codes), the held-Project cases call storage, and the stopped case throws.
- **Behavior UPG-B28**: The application re-validates upgrade results.
  - Test: `rejects an invalid or foreign upgrade result` → `apps/harness/src/canonical-project-application.test.ts`
  - Oracle: a fake coordinator returning an undecodable result, or a result whose `request.projectId` differs → `upgrade` rejects with `CanonicalProjectApplicationError`.
  - Expected red: the result is passed through.
- **Behavior UPG-B30**: Upgrade log lines reach the desktop's local log, and nothing else does.
  - Tests: `maps upgrade diagnostics to log calls` → `src/upgrade-diagnostics-logger.test.ts`; `writes upgrade log lines the desktop accepts` → `tests/integration/harness-logger.integration.test.ts`; `logs abandoned upgrades without paths` → `project-upgrade-runtime.integration.test.ts`; `forwards only harness upgrade log lines` → `apps/desktop/src/main/harness-supervisor.test.ts`.
  - Oracle (mapping, unit): each `abandoned` reason (`failed`, `interrupted`) → exactly one `info({ event: "project-storage.upgrade.abandoned", projectId, upgradeId, reason })`; each `discardFailed` cause (`busy`, `broken`, `unproven`) → exactly one `warn({ event: "project-storage.upgrade.discard-failed", projectId, upgradeId, cause })`; no other keys; no message argument.
  - Oracle (real Pino line): a logger from `createHarnessLogger(memoryDestination)` passed through `createUpgradeDiagnosticsLogger` emits, for one abandoned and one discard-failed event, lines that each strictly decode as `HarnessUpgradeLogLineSchema` (levels 30 and 40, integer `time`, `service: "harness"`), with no other keys.
  - Oracle (runtime): seam (b) staged-copy fault → the recording logger received exactly one `info` with `reason: "failed"`; seam (a): an upgrade interrupted by an owner stop at `after-staged-copy` on the same root, then `project.activate` → one `info` with `reason: "interrupted"`; seam (a): the same interrupted state plus a held `DatabaseSync` handle on `.staging-T/slopstop.db`, then `project.activate` → exactly one `warn` with `cause: "busy"`, and the same activation result when `warn` throws; seam (b): `info` throws → upgrade result unchanged; no logged value contains the application root path.
  - Oracle (desktop): a fake child writes, across newline-free chunks: lines encoded from `HarnessUpgradeLogLineSchema` for every reason and every cause; a valid-shaped upgrade line with an extra key; one with a non-UUID `projectId`; one with an unknown `reason`; a Pino line with another `event`; a non-JSON line; a line of exactly 16 KiB (a valid upgrade line padded inside a string field is not admitted, so use a non-upgrade line); an overlong line split across chunks followed by a valid upgrade line; and a final partial line before exit. The desktop logger receives, in order: the unchanged per-chunk byte-count observations; exactly one `info`/`warn` "Harness upgrade event." per valid line with exactly `{ source, event, projectId, upgradeId, reason | cause, harnessTime }` (RFC 3339); one `HARNESS_LOG_LINE_INVALID` warn for each of the three invalid upgrade lines (with its `event`); nothing for the other-event, non-JSON and 16 KiB lines; one `HARNESS_LOG_LINE_TOO_LONG` warn for the overlong line, with the following valid line still forwarded; one `HARNESS_LOG_LINE_INCOMPLETE` warn at exit.
  - Expected red: no mapping, factory or forwarder exists; the supervisor logs only byte counts.
- **Behavior UPG-B29**: A normal Project upgrades in under 2 seconds.
  - Test: `upgrades a generation-two Project in under two seconds` → `registration-project-upgrade-timing.integration.test.ts` (registration project, low parallelism)
  - Oracle: generation-two fixture with its seeded rows; wall-clock time of one `owner.upgrade()` (setup excluded) `< 2000` ms; result `upgraded`; duration written to the test output.
  - Expected red: guard (likely green on arrival); a failure is reported, never retried or loosened.

TDD-exempt: none.

### Success Criteria

Automated (Windows host):
- Repository root: `pnpm check`; `pnpm test:integration`; `pnpm check:duplicates`; knip; `pnpm test:e2e`; then `pnpm --filter @slopstop/desktop package:launch-smoke` (package-smoke `userData` keeps its own lock); `pnpm test:mutation` (scope includes `protocol.ts`, `harness-runtime.ts`, `project-upgrade-protocol.ts`); CodeScene 10 on touched files.
- `apps/harness`: `pnpm exec vitest run --config vitest.registration.config.ts` (timing file).

Manual: launch the packaged app twice; the second launch focuses the first window.

## Deferred Work

- **S3b `c1-0-s3b-upgrade-window`** (rigorous lane) — as outlined; trigger: S3a accepted. Open: copy beyond the FRD sentences; whether "Updating Project…" replaces "Opening Project…"; E2E seeding of an older Project.
- **S4** — ADR 0006 manifest version 2 and `storage_upgrades`; GitHub issue for the full journal after user authorization.
- **C1 gate** — also revisit: `project.upgrade` skips the registered-Project admission checks that activation runs (`registered-project-selection.ts:107-135`); a representative-size timing measurement once real sizes exist.
- **Mutation survivors** in `project-storage-upgrade-recovery.ts` (S2 evidence) — disclosed, not triaged.

## Verification Notes

- Risks: E2E run time and flakiness (explicit timeouts); timing under Windows load (`cefc503`); pin churn (`52b5bc2`); the default-`userData` lock is shared by `shell.test.ts` journeys (Playwright workers = 1, sequential).
- Workflow notes from S2: one commit per slice plus review-fix commits; candidate reviewers need the Git diff saved to a file and `workflow_path`; check the branch directly if a completion report does not arrive.
- Review evidence: `.rpiv/artifacts/evidence/2026-10-06_c1-0-s3a-intent-review-1.md`, `-2.md`.
- Mutation: root Stryker runs the unit config; the new routing is pinned by a unit case in `src/harness-runtime.test.ts` so its mutants are covered.

## Developer Context

Request: coordinator handoff (agent collaboration, pasted by the user on 2026-10-06) after S2 was squash-merged as `17cc797`.

Asked in this design (2026-10-06, user):

- **Q: One slice or two?** A: two → F1.
- **Q (`project-entry-bridge.ts:83-119`): Which reference does the window show for an unexpected upgrade error?** A: `HARNESS_INTERNAL_FAILURE` → F2.
- **Q: "Try again" on a refusal?** A: no → F3.
- **Q (`cefc503`): Where is the 2 s timing test?** A: harness, low-parallelism project → F4.
- **Q (round 1, `harness-supervisor.ts:340-349`): Where are harness upgrade log lines kept?** A: the desktop forwards them into its own bounded log → F8.
- **Q (round 1, `registration/project-listing.ts:86,201-212`): Listing touching a Project during an upgrade?** A: accept the risk → F9.
- Round 1 (user request): the coverage reviewer and slice-verifier, previously blocked by the auto-mode classifier, were re-run and completed.

### Review gate status

Two intent rounds ran with all three reviewers (evidence `-1.md`, `-2.md`), both failed; round 2 found no blocker from the code reviewer and only contract-precision items from the others (log path proof, harness-failure rows, seam wiring). Round-2 findings were applied without a third round (user rule). The final revision has no independent review.

**User gate decision (2026-10-06):** accept S3a intent with recorded residual risk, as an explicit override of the intent-review gate (rounds 1–2 failed; final revision unreviewed). Residual risks: unreviewed round-2 fixes; listing concurrency (F9); timing proven on a minimal fixture only; Expected red predictions may differ and are then recorded as observed. Mitigation: candidate-mode independent review of the real S3a source. This decision does not authorize a build, workspace or branch. S3b remains outline only.

Intent accepted by the user with recorded residual risk. Build authorization, branch and worktree remain separate decisions.

## TDD Evidence (implement)

- Slice `c1-0-s3a-upgrade-request`, branch `feat/c1-0-s3a-upgrade-request` from `a9b347c`: per-behaviour red/green with working-tree digests, gates and deviations in `.rpiv/artifacts/evidence/2026-10-06_c1-0-s3a-tdd-evidence.md` (append-only). Prior content hash of this design: `257d4fe6eb3a842f39c8b75d2f5db2ec4a00a9cb8eedf070a9f6ce877f8c9c7d`.

## References

- `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md` (parent)
- `.rpiv/artifacts/designs/2026-10-06_02-02-21_upgrade-failure-and-recovery.md` (S2)
- `.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md` (FRD)
- `.rpiv/artifacts/evidence/2026-10-06_c1-0-s2-tdd-evidence.md`
- `.rpiv/artifacts/evidence/2026-10-06_c1-0-s3a-intent-review-1.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`

## Follow-up

- **S4 done (2026-10-07).** The ADR 0005 amendment (temporary single-marker form) and ADR 0006 manifest version 2 and `storage_upgrades` were already delivered in S1 (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §5, Adjustment 1). The remaining upgrade documentation (ADR 0005 amendment precision: eligibility, who starts an upgrade, runtime copy not migrated, internal-failure mapping, discard at the next activation or upgrade, single-instance lock, discard diagnostics; ADR 0006 backup manifest; `CONTEXT.md` terms) is in the S4 docs commit on branch `feat/c1-0-s4-upgrade-docs`. The full Storage-operation journal stays a follow-up: [Replace the temporary storage_upgrades marker with the full Storage-operation journal and its Effect records (#92)](https://github.com/TheMastermindPT/slopstop/issues/92).
