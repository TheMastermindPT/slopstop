---
date: 2026-10-31T15:28:02+0000
author: Pedro Mesquita
commit: d34a025
branch: main
repository: slopstop
topic: "Architecture review Phase 4, desktop bridge and IPC consolidation: L1-01, L1-02, L1-03, L1-05, L1-07, L1-08, L1-10, L1-12, L7-02, plus Phase 2 residual R5"
tags: [design, architecture-review, polish, desktop, bridge, ipc, protocol, harness-failure-carriage, security]
parent: .rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md
lane: normal
lane_reasons: ["no upstream lane", "s6, s7, s8, s9 lane.mjs --paths: rigorous (sensitive word: ipc; files: 6 > 5)"]
status: ready
last_updated: 2026-10-31T17:22:25+0000
last_updated_by: Pedro Mesquita
last_updated_note: "P4-B3 marked as a pin; TDD Evidence section added (p4-s1 preflight finding)."
content_hash: 6ee6d0a4e291763379fccf647fb94fea0501d6a4ca1da83cade49eb4741d15f3
---

# Design: Architecture review Phase 4, desktop bridge and IPC consolidation

The feature lane is **normal**: the parent review has no lane, so the "no upstream lane" default applies. Every slice runs at least normal. Four slices measure **rigorous** with `lane.mjs --paths` (`s6`, `s7`, `s8`, `s9`); Q6 asks which of them keep it. Each slice's lane is in the table under Deferred Work.

> **Base.** Read at main `d34a025`. The coordinator named `d2a365c`; `d34a025` is the one docs-only commit after it ("record the phase 3 cleanup and the phase 4 start"), so every source fact below holds at both. Phase 3 is pushed (origin/main `8990120`).

## Intent

**Outcome.**
- The desktop core has one request skeleton and one fault table. The three bridges supply schemas and texts only.
- A harness failure row is carried end to end: activation and switch answer a protocol or desktop defect as **broken**, never as "connection lost".
- Every renderer-to-main IPC handler goes through one gated helper, which checks the sender frame.
- The desktop process reads time from its one injected clock (R5).

**Scope.**
- **The nine findings accepted into Phase 4** (review §Phase 4, Pedro's §144 decision):
  - **L1-01:** three bridges copy one request skeleton and check the reply echo against three different baselines;
  - **L1-02:** per-bridge fault-text tables repeat four identical `Match` arms;
  - **L1-12:** the storage and workspace bridges co-change as one module (constituents L1-01, L1-02);
  - **L1-03:** the upgrade fault mapper re-implements the conversation fault table, and activation and switch flatten every fault to connection lost;
  - **L7-02:** `harnessFailureRow` and `rowSchema` are copied verbatim in two protocol modules;
  - **L1-08:** three standalone bridge factories exist only for tests;
  - **L1-10:** a unit test imports the side-effecting Electron entry;
  - **L1-07:** the gated IPC handler shape is written out nine times;
  - **L1-05:** thirteen IPC handlers never check the sender frame.
- **Phase 2 residual R5** (`.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/phase-2-residuals-and-amendments.md:9`, homed in Phase 4 by Pedro's Phase 2 acceptance): `harness-supervisor.ts:498` (`sentAt`) and `canonical-writer-package-smoke.ts:84` read `new Date().toISOString()` inline.

**Non-goals.**
- **L1-06** (custom protocol and the file-protocol fuse), **L1-09** (storage bridge reached only by the smoke) and **L2-01** (smoke surface): Phase 6.
- **L1-11** (fire-and-forget window creation): Phase 1.
- Moving the IPC edge onto the Effect runtime. `answerRequest` stays the temporary Promise facade (P-S7-1 (b)); C2 streaming removes it.
- No change to any renderer behaviour except what Q1 states.
- No new IPC channel, no preload change.

**Constraints.**
- AGENTS.md "Effect Usage (effect 4)". The request core stays an Effect pipeline with `answerRequest` at the edge. The IPC helper and the sender check are plain functions at the IPC edge. Pure classification (`faultMeaning`) stays a plain function.
- The renderer imports neither Electron nor Node APIs; nothing in this phase moves code into it.
- `degrade-distinguishes-broken`: a defect never answers as unavailable (the root of L1-03).
- `shared-vocab-union`: one owner per copied helper, identity proven before the move (L7-02, L1-02, L1-03).
- ADR 0023 Protocol Version: any change to the wire contract is marked by a new `protocolVersion` (Q1).
- Review risk callouts:
  - re-pin the cross-bridge correlation rows (precedent `8a0658d`);
  - re-resolve the Stryker ranges by content, not by line (precedent K12).

**Phase 3 lessons built into every slice:**
1. **Full-integration exposure.** Each slice names the integration, e2e and smoke files that run its changed code outside the unit run. Precedent: a config change in p3-s5 broke `trace-94.test.ts`, which runs only in full integration, and it surfaced only at `check:deep`. Where a slice's exposure includes an e2e journey or a smoke, its success criteria name that run, gated by the coordinator.
2. **Transient EPERM on Windows.** A new row that writes and then renames or removes a fresh directory on Windows retries on `EPERM`, `EACCES` and `EBUSY`, as `apps/harness/tests/integration/rename-when-released.ts` does (#146). The desktop cannot import that harness test helper (applications never import one another). A desktop row that needs it stops and asks the coordinator; no slice here plans one.
3. **Stryker ranges move with their anchors in the same slice.** Each slice lists the `stryker*.json` entries its edit moves or empties. It re-points them in the same commit as the code, with `stryker-range-anchors.json`, red-first through `pnpm check:mutation-ranges`, as p3-s7 did. When the slice moves code into a file that no config mutates, it adds that file, so mutation coverage is not lost silently.

## Architecture

### The request core and the three bridges (L1-01, L1-02, L1-12, L1-08)

Today `harness-request-core.ts` (190 lines) owns correlation (`makeHarnessRequestCore`), `decodeReply`, `answerRequest` and the neutral texts (`bridgeNeutralText`). It does not own the per-request skeleton. Each bridge writes its own:

| Bridge | Stopped guard | Invalid input | Echo baseline | Fault text |
|---|---|---|---|---|
| `project-storage-bridge.ts:101-128` | `unsent` broken answer | fails in the command builder → `desktop invalid-command` envelope | `command.payload`, the validated payload (`:121`) | own `faultText` `Match` (`:57-69`) |
| `workspace-bridge.ts:193-215` | `unsent` broken answer | fails in the command builder → envelope | the **caller's** `query` object (`:224`); intent echo is `capability` only (`:239`) | own `faultText` `Match` (`:135-147`) |
| `project-entry-bridge.ts:95-138` | `unsent` per operation | **throws synchronously** (`decodeStrict` at `:123`, `:154`, before the request) | a re-decoded copy of the input (`:123`, `:129`) | none: each operation maps faults itself |

The two `faultText` matches share 4 of 6 arms character for character (`transport`, `protocol`, `harness`, `send`). They differ only in the stopped and mismatched-echo arms, which is a designed difference (S7-R14, P-S7-2 (a)).

**Proposed shape.**
- The core gains one bridge-request function. A bridge passes its tag, a command builder over the validated request, the reply event, the result schema, the echo rule and its broken answer. The function owns:
  1. the stopped guard;
  2. invalid input as an envelope, never a throw;
  3. the request through the core, with the decoded reply;
  4. the echo check against the command's validated payload (`command.payload`);
  5. `answerRequest` at the end.
- The core gains `bridgeFaultText({ noun, stopped, echo })`. It owns the four shared arms; each bridge passes its own noun and its stopped and echo texts.
- The three bridges keep their public clients (`ProjectStorageBridgeClient`, `WorkspaceBridgeClient`, `ProjectEntryBridge`) and their texts.
- The three test-only factories are deleted first (L1-08). Bridge tests build the shared core as `harness-bridges.ts:25-31` does. Measured callers: `createProjectStorageBridge` in `project-storage-bridge.test.ts` only; `createWorkspaceBridge` in `workspace-bridge.test.ts` only; `createProjectEntryBridge` in `project-entry-bridge.test.ts` and `harness-supervisor.test.ts`. There are no production callers.
- L1-12 has no code of its own. Its acceptance is a metric (the pair drops out of the co-change block), which can only be measured over later history (Q8).

### Fault classification (L1-03)

- `project-conversation-failure.ts:34-49` `faultMeaning` is the G25 table: not-sent, sent-then-lost, malformed-reply, defect, harness.
- `project-upgrade-failure.ts:32-54` restates it arm for arm, and the two files each hold the same `harnessRows` map (`:13-17`, `:11-15`).
- `project-entry-bridge.ts:49-77` answers activation and switch with `PROJECT_COORDINATOR_UNAVAILABLE` / `connectionLost` for **every** fault, including `protocol` and `desktop` faults.

**Proposed shape.** `faultMeaning` and the `harnessRows` map move to one module, a fault-classification owner in `apps/desktop/src/main`. The upgrade mapper consumes it. Activation and switch route through it, so a malformed reply or a defect answers broken.

**What the wire allows today (measured, `canonical-project-protocol.ts`):**
- The activation `broken` arm (`:241-247`) carries `PROJECT_STORAGE_BROKEN`, the registry-broken codes, `INTERNAL_FAILURE`, `WRITER_FENCE_*` and the writer release codes. It has no harness failure code (`HARNESS_INTERNAL_FAILURE`, `PROTOCOL_MESSAGE_INVALID`, `PROTOCOL_VERSION_UNSUPPORTED`).
- The switch result (`:412-437`) has **no** broken status. Its failure arms are `inactive`, `project-mismatch`, `stale-activation`, `coordinator-unavailable` and `release-failed`.
- So "carried end to end" needs a wire change for both (Q1). The renderer's switch handler (`projects-workspace.tsx:139-161`) already shows `diagnostic.message` for every non-target, non-release-failed status. A new `broken` arm lands there with no renderer branch to add, only its type widening.

### The protocol row owner (L7-02)

- `project-upgrade-protocol.ts:11-13` and `project-conversation-protocol.ts:16-18` hold the same `harnessFailureRow(code)` body.
- `project-upgrade-protocol.ts:82-88` and `project-conversation-protocol.ts:141-147` hold the same `rowSchema(row)` body (exact `code`, `message`, `retryable` literals). They differ only in the generic row type.
- `harness-failure-protocol.ts` (15 lines) already owns the codes and messages.

**Proposed shape.** That module also owns `harnessFailureRow` and one exact-row schema builder. Both diagnostics tables and both result schemas use them. They are package-internal: `packages/protocol/src/index.ts` does not export them, so the review's "public-API" blast radius does not apply, because nothing outside the package changes.

### The IPC edge (L1-10, L1-07, L1-05)

- **Handlers (measured, `rg -n "ipcMain\.(handle|on)\(" apps/desktop/src`): 13.**
  - `main.ts:258-259`: `getHarnessStatus`, `retryHarness` (not gated);
  - `main.ts:277,282`: `queryWorkspace`, `submitWorkspaceIntent` (gated);
  - `project-entry-ipc.ts:41-66`: six gated handlers;
  - `project-registration-ipc.ts:54-60`: `getRegistrationCapability` (not gated), `chooseRepository` (gated inside `chooseRepository`, twice, around the dialog), `registerProject` (gated).

  So **9** handlers share the inline decode, gate and forward shape, and none of the 13 reads `event.senderFrame`. The only handler that reads the event at all is `chooseRepository` (`event.sender` for the dialog owner).
- **L1-10.** `registerWorkspaceIpc` and `broadcastWorkspaceNotification` are exported from `main.ts:264-288` for `workspace-bridge.test.ts:26`, which neutralises the entry's bootstrap with five `vi.mock` calls (`:40-57`). A second importer exists that the finding did not name: `canonical-writer-package-smoke-main.test.ts:264` dynamically imports `./main.js` on purpose, to test the entry's smoke wiring (Q4).
- **Proposed shape.**
  1. The workspace handlers and the broadcast move to their own module, `workspace-ipc.ts`, beside `project-entry-ipc.ts` (L1-10).
  2. One gated-handler helper owns decode, gate, closing answer and forward. The nine gated handlers use it (L1-07). A non-gated variant serves the four other handlers.
  3. The helper checks the sender (L1-05, Q2): the invoking frame must be the main frame of the application window. A foreign or missing frame is refused.
- **Electron guidance** (Context7 `/electron/electron`, security tutorial): validate `event.senderFrame` in every handler, and use the frame's `origin` because the frame may be `null`. With today's `loadFile` renderer (`main.ts:327`), the origin of any local file page is `file://`. So an origin check alone admits any `file:` frame, until L1-06 (Phase 6) moves the renderer to a custom scheme. Q2 compares the frame's identity, not only its origin.

### R5, the desktop clock

`main.ts:85-86` injects `createId: randomUUID` and `now: () => new Date().toISOString()` into the bridges. Two sites bypass it:
- `harness-supervisor.ts:498`: the handshake `sentAt`;
- `canonical-writer-package-smoke.ts:84`: `metadata()` for the writer-proof commands.

**Proposed shape (Q9 (a)).** Both take the `Clock` (`{ createId, now }`, `harness-request-core.ts:32`) from their composer, so `main.ts` stays the desktop's one clock. The `harness-log-lines.ts` `harnessTime` conversions (`:83-136`) format a harness-supplied timestamp; they are not clock reads, and they stay.

### Stryker entries this phase moves (lesson 3)

| Config | Entries in Phase 4 files | Moved by |
|---|---|---|
| `stryker.desktop-s7.config.json` | `harness-request-core.ts`, `harness-bridges.ts` (whole files); `project-entry-bridge.ts:80-235`, `project-storage-bridge.ts:38-167`, `workspace-bridge.ts:101-271`, `project-upgrade-failure.ts:36-53`, `project-conversation-failure.ts:35-48` | s2 (factories at the range ends), s3, s4, s5 |
| `stryker.config.json` | `project-upgrade-protocol.ts`, `project-conversation-protocol.ts`, `workspace-bridge.ts`, `project-upgrade-failure.ts`, `harness-request-core.ts`, `harness-bridges.ts`, `project-conversation-failure.ts`, `harness-supervisor.ts` (whole files); `project-entry-bridge.ts:103-103`, `:189-202` | s1 (new owner file not mutated, Q7), s3, s4, s6 |
| `stryker.desktop-s6.config.json` | six `project-entry-ipc.ts` single lines (`:43`, `:48`, `:53`, `:58`, `:63`, `:68`, the gate checks); `project-registration-ipc.ts:35`, `:43`, `:62`; `main.ts:94-104`, `:273-288`, `:406-406`; `canonical-writer-package-smoke.ts:300-341` | s7 (`main.ts:273-288` leaves the file), s8 (the gate lines move into the helper), s9, s10 |
| `stryker.desktop-s8.config.json` | `harness-supervisor.ts:61-73`, `:176-233`, `:399-435` | s10 |
| `stryker.project-storage-desktop.config.json` | `harness-supervisor.ts` (whole file) | s10 |

The mutation Vitest configs that name the touched tests are `apps/desktop/vitest.desktop-s6-mutation.config.ts` (`project-entry-ipc.test.ts`, `project-registration-ipc.test.ts`, `workspace-bridge.test.ts`), `vitest.desktop-s7-mutation.config.ts` (the four bridge tests, the core test, `harness-supervisor.test.ts` and the two IPC tests) and `vitest.desktop-s8-mutation.config.ts` (`harness-supervisor.test.ts`). A test file that moves or splits (s7) updates them in the same slice. Precedent: `e55b35b`, a missed config consumer.

## Decisions

Inherited (not asked again):
- §144: the six phases are the plan; Phase 4 comes before C2.
- Pedro's Phase 2 acceptance: R5 is homed in Phase 4.
- P-S7-1 (b): `answerRequest` is the temporary Promise facade until C2.
- S7-R14, P-S7-2 (a): the stopped answers differ per bridge on purpose (the workspace bridge answers its closing envelope).
- ADR 0023 Protocol Version: a wire change takes a version.

**Open questions (each with a recommendation and its measured blast radius):**

- **Q1 (s6) carrying a broken activation or switch.**
  - (a) **Recommended.**
    - The activation `broken` arm gains the three harness failure rows and the protocol-invalid row.
    - The switch result gains a `broken` status carrying the same rows.
    - `protocolVersion` goes 9 → 10.

    Blast: `canonical-project-protocol.ts`, `protocol.ts`, the desktop entry bridge, and the 12 files that pin the literal `9` (protocol, desktop and harness tests, 3 of them harness integration files). The renderer needs no new branch (Architecture).
  - (b) No wire change. Activation answers its existing `broken` arm with `INTERNAL_FAILURE`, and switch keeps `coordinator-unavailable`. The acceptance "an undecodable activation reply answers broken" is met for activation only; switch keeps flattening a defect into unavailable, against `degrade-distinguishes-broken`.
- **Q2 (s9) the sender rule.**
  - (a) **Recommended.** The invoking frame must be the main frame of the one application window (`event.senderFrame` is not `null` and is that window's `webContents.mainFrame`). A refused call rejects the invoke with one fixed error (Q3) and writes one redacted log line naming the channel only.
  - (b) An origin allowlist (`file://` in production, the dev-server origin in development). It is Electron's documented pattern. But under `loadFile` every local file page has the origin `file://`, so it admits any `file:` frame until L1-06.
- **Q3 (s9) what a refused call answers.**
  - (a) **Recommended.** The invoke rejects with one fixed error, which is distinct from every product answer. A foreign frame gets no data.
  - (b) Each channel's closing or unavailable envelope. That would tell a foreign frame "SlopStop is closing", which misreports a refusal as a state (`degrade-distinguishes-broken`).
- **Q4 (s7) L1-10's acceptance "no file imports `main.ts`".**
  - (a) **Recommended.** Narrow it to the finding's own case. `workspace-bridge.test.ts` stops importing `main.ts`. `canonical-writer-package-smoke-main.test.ts:264` keeps its deliberate import (it tests the entry's smoke wiring). The review's depcruise rule `no-import-of-electron-entry` is added with that one test path excluded by name.
  - (b) Also move the smoke wiring out of `main.ts`. That grows into L2-01, which is Phase 6.
  - (c) No depcruise rule, only the move.
- **Q5 (s4) invalid input to the entry bridge.** Today `activate`, `switchProject`, `upgrade`, `readConversation`, `saveConversationMessage` and `register` throw synchronously on invalid input. The IPC handlers decode first, so production never reaches that throw; only direct callers (tests, the smoke) can.
  - (a) **Recommended.** Invalid input becomes the `desktop invalid-command` envelope, as the storage and workspace bridges already answer (the review's acceptance).
  - (b) Keep the throw for the entry bridge only.
- **Q6 lanes for the IPC slices.** `lane.mjs` answers rigorous for s6 (sensitive word `ipc`: `project-entry-ipc.ts`), s7 (`workspace-ipc.ts`), s8 (`files: 6 > 5`) and s9 (`ipc-gate.ts`).
  - (a) **Recommended.**
    - s6 and s9 stay **rigorous**, with an intent review and Pedro accepting each: s6 changes the wire and s9 is the security check.
    - s7 and s8 go **normal by override**: s7 is a move and s8 a helper extraction, each under unchanged tests. Precedent: P2 Q12 and P3 Q6, overrides for filename-only triggers.
  - (b) All four rigorous.
- **Q7 (s1) mutation coverage of the moved protocol helpers.** `harness-failure-protocol.ts` is in no Stryker config, so moving the helpers there removes their mutants from `stryker.config.json`'s run.
  - (a) **Recommended.** Add `packages/protocol/src/harness-failure-protocol.ts` as a whole-file entry to `stryker.config.json`. The real-repository row (`check-stryker-ranges.test.mjs:446`, `wholeFiles: 33`) is edited to 34 first, and its red is observed.
  - (b) No entry.
- **Q8 L1-12's acceptance is a metric over later history.**
  - (a) **Recommended.** Phase 4 meets L1-12 structurally: no copied skeleton or `Match` table remains (the s4 and s5 checks). The co-change metric is re-measured at the next architecture review, where the pair is expected to drop out once later commits touch one bridge alone.
  - (b) Measure it at the Phase 4 final acceptance. Inside the phase, both bridges change together on purpose, so the pair still co-changes.
- **Q9 (s10) R5.**
  - (a) **Recommended.** `HarnessSupervisor` and the writer-proof smoke take the desktop `Clock` from their composer. `main.ts` stays the one clock.
  - (b) Keep the two inline reads as an accepted residual.
- **Q10 slice plan.** Confirm the 10 slices and their order (Deferred Work).

## Next Slice

### Slice p4-s1-harness-failure-row-owner

- **`slice_id`:** `p4-s1-harness-failure-row-owner`.
- **Lane:** normal. `lane.mjs --paths` over the planned paths answers fast; the feature lane is normal.
- **Finding:** L7-02. Acceptance: "One harnessFailureRow". Remediation: "Move harnessFailureRow and rowSchema into packages/protocol/src/harness-failure-protocol.ts."
- **Base:** main `d34a025`.
- **Deliverable:**
  - `harness-failure-protocol.ts` exports `harnessFailureRow(code)` (same body) and `exactRowSchema(row)` (the `rowSchema` body, generic over any `{ code, message, retryable }` row).
  - `project-upgrade-protocol.ts` and `project-conversation-protocol.ts` import both and delete their copies.
  - Neither helper is exported from `packages/protocol/src/index.ts`.
  - Q7 (a): `stryker.config.json` gains the owner file as a whole-file entry.
- **Message and code ledger:** nothing added, removed or changed. No wire change; `protocolVersion` stays 9.
- **Affected paths:**
  - `packages/protocol/src/{harness-failure-protocol,project-upgrade-protocol,project-conversation-protocol}.ts`;
  - `packages/protocol/src/harness-failure-protocol.test.ts` (new);
  - `stryker.config.json` and `apps/harness/scripts/check-stryker-ranges.test.mjs` (its real-repository row, Q7).

  No range is added, so `stryker-range-anchors.json` does not change.
- **Full-integration exposure:** both diagnostics tables are decoded across the process boundary.
  - Harness integration: `project-upgrade-runtime.integration.test.ts`, `project-conversation-runtime.integration.test.ts`, `project-conversation-runtime-busy.integration.test.ts`.
  - e2e: `apps/desktop/tests/e2e/conversation.test.ts`, `conversation-accessibility.test.ts`, `project-upgrade.test.ts`.
  - The slice changes no value, so these runs prove only that nothing moved. They run once, at the Phase 4 final `check:deep`, not per slice.
- **Dependencies:** none. It is the first slice, because s6 builds its rows on this owner.

#### Test Contract: p4-s1-harness-failure-row-owner

Public seam: the exports of `harness-failure-protocol.ts`, and the exported `projectUpgradeDiagnostics`, `projectConversationDiagnostics`, `ProjectUpgradeResultSchema` and the conversation result schemas.

- **Behavior P4-B1: one owner builds every harness failure row.**
  - Test: `packages/protocol/src/harness-failure-protocol.test.ts`, through `harnessFailureRow` and the two exported diagnostics tables.
  - Rows:
    - for each of the three `HarnessFailureCode` values, `harnessFailureRow(code)` `toEqual({ code, message: harnessFailureMessages[code], retryable: false })`;
    - for each of the three, `projectUpgradeDiagnostics` and `projectConversationDiagnostics` hold a row that `toEqual`s `harnessFailureRow(code)` (6 rows).
  - Expected red: the import fails, because `harness-failure-protocol.ts` exports no `harnessFailureRow`.
- **Behavior P4-B2: one exact-row schema accepts only its row.**
  - Test: `packages/protocol/src/harness-failure-protocol.test.ts`, through `exactRowSchema` with `decodeStrictResult`.
  - Rows for one row (`harnessFailureRow("HARNESS_INTERNAL_FAILURE")`):
    - the row itself decodes to itself;
    - a changed `message` fails;
    - `retryable: true` fails;
    - a changed `code` fails;
    - an extra key fails (`unrecognized_keys`).
  - Expected red: as P4-B1, the import fails.
- **Behavior P4-B3: the result schemas and mutation coverage stay as they are.**
  - Test: `packages/protocol/src/project-conversation-protocol.test.ts` and `packages/protocol/src/protocol.test.ts` (the upgrade result rows), through the exported result schemas, unedited and green before and after. Also `apps/harness/scripts/check-stryker-ranges.test.mjs`, through `checkStrykerRanges({ root: repository })` (the real-repository row, Q7).
  - Expected red: none — pin. The two result-schema files stay unedited and green before and after. The real Stryker row is the one red, observed (Q7 (a)): it is edited to `wholeFiles: 34` for `stryker.config.json` and fails with 33. It passes after the config entry is added. Its proof is the slice's TDD evidence, because a pin behavior is not re-proved.

**Bindings that bite (each restored after):**
1. `harnessFailureRow` answers `retryable: true`. Every P4-B1 row fails.
2. `exactRowSchema` types `message` as `Schema.String`. The P4-B2 changed-message row fails.
3. Keep a local `harnessFailureRow` in `project-upgrade-protocol.ts` whose message differs. The P4-B1 upgrade equality rows fail, which proves the table uses the owner.

**Structural checks (on the candidate):**
- `rg -n "function (harnessFailureRow|rowSchema|exactRowSchema)" packages/protocol/src`: only `harness-failure-protocol.ts`.
- `rg -n "harnessFailureRow|exactRowSchema" packages/protocol/src/index.ts`: nothing.
- `git diff d34a025 --stat` lists only the affected paths and this brief's evidence.

#### Success Criteria: p4-s1-harness-failure-row-owner

Automated (smallest first; each read by its real exit code):
- Red then green: `pnpm --filter @slopstop/protocol exec vitest run src/harness-failure-protocol.test.ts`.
- `pnpm --filter @slopstop/protocol exec vitest run src/project-conversation-protocol.test.ts src/protocol.test.ts` green before and after.
- `pnpm check:mutation-ranges` exit 0. Red then green for the real row: `pnpm --filter @slopstop/harness exec vitest run scripts/check-stryker-ranges.test.mjs`.
- `pnpm check` exit 0 (read CPU first, in its own call); `pnpm check:dead-code` (Knip: the helpers are used).
- CodeScene 10 on the three protocol files and the new test.
- Mutation: none for this slice (no logic changed; the coordinator may ask for one `stryker.config.json` run scoped to the owner file on the final Phase 4 candidate).

Manual: none.

## Deferred Work

Each slice gets its full contract when it becomes next. Behavior IDs continue from P4-B4; questions from Q11. Lanes come from `lane.mjs --paths` over the planned paths, raised to the feature lane (normal).

| Slice | Content | Planned paths | lane.mjs → lane | Full-integration exposure | Stryker entries moved | Trigger |
|---|---|---|---|---|---|---|
| `p4-s2-bridge-test-composition` | L1-08: bridge tests build the shared core like `harness-bridges.ts`; delete the 3 factories | 3 bridges + their 3 tests + `harness-supervisor.test.ts` | fast → normal | none in production (test-only callers); Knip | `desktop-s7` ranges ending at the factories (`project-entry-bridge.ts:80-235`, `project-storage-bridge.ts:38-167`, `workspace-bridge.ts:101-271`) | after s1 |
| `p4-s3-fault-meaning-owner` | L1-03 part 1: one `faultMeaning` and `harnessRows` owner; the upgrade mapper consumes it; no answer changes | `project-conversation-failure.ts`, `project-upgrade-failure.ts`, the new owner, `project-entry-bridge.test.ts` | fast → normal | e2e `project-upgrade.test.ts`, `conversation.test.ts` (fault paths only by unit rows) | `desktop-s7` `:36-53`, `:35-48`; owner file added to `desktop-s7` and `stryker.config.json` | after s2 |
| `p4-s4-request-skeleton` | L1-01 (+ L1-12 structure): characterization pins first (echo baseline, invalid input per bridge, the `8a0658d` cross-bridge correlation rows), then the skeleton into the core; Q5 | core + 3 bridges + 4 tests | normal (7 > 5) | every e2e journey (`projects`, `registration`, `conversation`, `project-upgrade`, `shell`); `package:launch-smoke` (storage bridge and writer proof through the bridges) | `desktop-s7` bridge ranges; `stryker.config.json` `project-entry-bridge.ts:103-103`, `:189-202` | Q5; after s3 |
| `p4-s5-bridge-fault-text` | L1-02: `bridgeFaultText` over the 4 shared arms; texts pinned unchanged | core + storage and workspace bridges + 2 tests | fast → normal | as s4, texts only | `desktop-s7` bridge ranges | after s4 |
| `p4-s6-activation-switch-broken` | L1-03 part 2: activation and switch answer protocol/desktop faults as broken with harness rows; Q1 | `canonical-project-protocol.ts`, `protocol.ts`, entry bridge, `project-entry-ipc.ts`, tests; the 12 files pinning version 9 (Q1 (a)) | **rigorous** (sensitive word: ipc); Q6 | protocol bump: harness `harness-runtime.integration`, `canonical-project-activation.integration`, `project-list-runtime.integration`; e2e `projects.test.ts`; `package:launch-smoke` (the handshake carries the version) | `stryker.config.json` entry-bridge ranges; `desktop-s6` `project-entry-ipc.ts` lines if edited | Q1, Q6; after s3 and s1 |
| `p4-s7-workspace-ipc-module` | L1-10: `registerWorkspaceIpc` and `broadcastWorkspaceNotification` move to `workspace-ipc.ts`; the test moves off `main.ts`; Q4 depcruise rule | `main.ts`, `workspace-ipc.ts` (new) + test, `workspace-bridge.test.ts`, `dependency-cruiser.config.cjs`, `vitest.desktop-s6-mutation.config.ts` | **rigorous** (ipc) → normal by override (Q6) | `package:launch-smoke` (bundle chunk order, precedent `ff162f5`); `canonical-writer-package-smoke-main.test.ts` | `desktop-s6` `main.ts:273-288` → `workspace-ipc.ts`; `main.ts:406-406` shifts | Q4, Q6 |
| `p4-s8-gated-ipc-helper` | L1-07: one gated-handler helper; the 9 gated handlers use it; existing IPC tests unchanged | helper (new) + test, `project-entry-ipc.ts`, `project-registration-ipc.ts`, `workspace-ipc.ts` | **rigorous** (6 > 5) → normal by override (Q6) | every e2e journey (every renderer call); `package:launch-smoke` | `desktop-s6` the 9 single-line gate entries move into the helper (whole-file entry for the helper) | Q6; after s7 |
| `p4-s9-ipc-sender-check` | L1-05: the helper and the 4 non-gated handlers check the sender frame; Q2, Q3 | helper + test, `main.ts` (window identity, harness handlers), `project-registration-ipc.ts` + test | **rigorous** (ipc) | every e2e journey: only a real Electron launch proves the real window's frame passes, because a wrong identity would refuse every call; `package:launch-smoke` (the packaged `file://` renderer) | `desktop-s6` helper entry; `project-registration-ipc.ts` lines | Q2, Q3, Q6; after s8 |
| `p4-s10-desktop-clock` | R5: supervisor handshake `sentAt` and writer-proof `metadata()` read the injected `Clock`; Q9 | `harness-supervisor.ts`, `canonical-writer-package-smoke.ts`, `main.ts` + 2 tests | normal (6 > 5) | every e2e journey (the handshake); `package:launch-smoke` and `package:smoke` (writer proof) | `desktop-s8` `harness-supervisor.ts:61-73`, `:399-435` if the constructor or handshake move; `desktop-s6` `canonical-writer-package-smoke.ts:300-341`; `project-storage-desktop` whole file | Q9; after s9 (shares `main.ts`) |

Heavy runs (e2e, `package:launch-smoke`, `package:smoke`, mutation) are never run per slice without the coordinator's GO. The default is one run of each named exposure at the Phase 4 final `check:deep` (which carries `test:integration`, `test:e2e` and `package:launch-smoke`). A slice whose exposure is the real Electron frame (s9) or the wire version (s6) asks for its own e2e run on its candidate.

## Verification Notes

- **Risk, s4:** every renderer request goes through the new skeleton. The `8a0658d` cross-bridge correlation rows (`project-storage-bridge.test.ts`, `workspace-bridge.test.ts`, `harness-supervisor.test.ts`) must be pinned before the move and stay green unedited.
- **Risk, s6:** a version bump with a missed pin fails only where the handshake runs: harness integration, e2e and the launch smoke. The 12 files with the literal `9` are the measured list (`rg -l "protocolVersion: 9|protocolVersion = 9|\b9 as const" apps packages`).
- **Risk, s9:** a sender check that is wrong for the real window refuses every call. Unit fakes cannot prove the real `mainFrame` identity; the e2e journeys and the launch smoke can.
- **Risk, s7:** moving code out of `main.ts` can reorder bundled chunks (precedent `ff162f5`, caught only by `package:launch-smoke`).
- **Known baseline:** `stryker.config.json` holds 19 ranges and 33 whole files (`check-stryker-ranges.test.mjs:446`).
- **Electron docs:** Context7 `/electron/electron`, security tutorial "Validate the sender of all IPC messages".

## Developer Context

- Coordinator instruction (2026-10-31): draft the Phase 4 brief with `/rpiv:design` on main; the sources are the findings accepted into Phase 4 plus R5. Follow the Phase 1-3 briefs for structure and slice size. Build in the three Phase 3 lessons. Docs only: no code, branch or worktree. Report path, hash, slices with lanes, and Pedro's questions.
- Measurement: static reads only (`rg`, `lane.mjs --paths`), no test, gate or mutation run.
- Corrections to the review found at `d34a025`:
  - L1-10 has two `main.ts` importers, not one (Q4);
  - L7-02's "public-API" blast radius does not apply, because the helpers stay package-internal;
  - the L1-03 remediation for switch needs a wire change, because switch has no broken status (Q1).
- Intent approval of this brief is not build authority. The implementer agrees workspace and build with the coordinator.
- **2026-10-31: Phase 4 brief approved, Q1-Q10 decided (Pedro, confirmed by the coordinator; decisions log).**
  - **Approved:** the brief at `content_hash cdf66d04e5d19c61682408e3952bf7155b391c7a8da27955b024d7ffa5e9dd55`, with this entry added. The coordinator saves the approved copy under `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` and commits. The next slice is `p4-s1-harness-failure-row-owner` (lane normal), and its contract (P4-B1 to P4-B3) stands as written.
  - All ten answers are (a), as recommended:
    - **Q1 (a):** the activation `broken` arm gains the three harness failure rows and the protocol-invalid row. The switch result gains a `broken` status carrying the same rows. `protocolVersion` goes 9 → 10 in s6, with every pin of the literal `9` updated in that slice.
    - **Q2 (a):** the sender check compares frame identity: the invoking frame is the main frame of the one application window, never `null`. An origin allowlist alone is rejected.
    - **Q3 (a):** a refused call rejects the invoke with one fixed error and writes one redacted log line naming the channel only.
    - **Q4 (a):** L1-10 is narrowed to its own case. `workspace-bridge.test.ts` stops importing `main.ts`. `canonical-writer-package-smoke-main.test.ts` keeps its deliberate import. The depcruise rule `no-import-of-electron-entry` excludes that one path by name.
    - **Q5 (a):** invalid input to the entry bridge answers the `desktop invalid-command` envelope, never a synchronous throw.
    - **Q6 (a):** s6 and s9 stay **rigorous** (an intent review; Pedro accepts each). s7 and s8 go **normal by override**, for a filename-only or file-count trigger under unchanged tests (precedent P2 Q12, P3 Q6).
    - **Q7 (a):** `packages/protocol/src/harness-failure-protocol.ts` joins `stryker.config.json` as a whole-file entry in s1. The real-repository row is edited to `wholeFiles: 34` red-first.
    - **Q8 (a):** L1-12 is met structurally by s4 and s5. Its co-change metric is re-measured at the next architecture review.
    - **Q9 (a):** `HarnessSupervisor` and the writer-proof smoke take the desktop `Clock` from their composer; `main.ts` stays the one clock.
    - **Q10 (a):** the 10 slices and their order stand as in Deferred Work.
  - No answer changes a slice. The Deferred Work table already shows the Q6 overrides.
  - Lane labels for the approved lanes are recorded when each slice is detailed and approved.
- **2026-10-31: P4-B3 marked as a pin (Pedro approved a wording-only fix; coordinator instruction).**
  - **Trigger:** the rpiv preflight of p4-s1 candidate `5570258` (base `0fc425c`) answered `untouched-test-file: P4-B3 packages/protocol/src/project-conversation-protocol.test.ts` and `... packages/protocol/src/protocol.test.ts`. Evidence: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s1-harness-failure-row-owner-preflight.log`. Without the pin marker, a whole-file Test means "the slice changed this file"; P4-B3 means the opposite for those two files.
  - **Change:** the P4-B3 Expected red line now starts with `none — pin`, the contract grammar's pin marker, and keeps the observed red of the real Stryker row as prose. The Test line is unchanged. Meaning is unchanged: same files, same seam, same "unedited" promise.
  - **Cost, stated plainly:** the grammar marks a whole behavior as a pin, and pins are never re-proved. So validate no longer re-proves the Stryker row's red (Q7); that red rests on the slice's TDD evidence (`p4-s1-stryker-red.log`). Naming a test title in each pinned file instead was tried and rejected: the preflight then lists those titles for red re-proof, and they are green by design.
  - **Approval:** the approved copy `approved-16db782f.md` holds the old Expected red line, which sits outside the sections the append-only check lets grow. So `append-only.mjs` answers `reopen` for this revision, and `status` is back to `in-review` until Pedro approves the new hash.
  - **Added:** `## TDD Evidence (implement)` at the end, which the implement workflow links to.

## References

- `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md` (Phase 4; L1-01, L1-02, L1-03, L1-05, L1-07, L1-08, L1-10, L1-12, L7-02).
- `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/phase-2-residuals-and-amendments.md` (R5).
- `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Q6, R5's origin).
- `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md` (structure; the p3-s7 re-anchoring pattern).
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §144 and the Phase 4 choice.
- `docs/adr/0023-one-strict-identity-text-root.md` (Protocol Version).
- `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`.
- `apps/harness/tests/integration/rename-when-released.ts`, #146.
- Commits `8a0658d` (correlated request failures), `e55b35b` (missed consumer), `ff162f5` (chunk order).
- Electron security tutorial via Context7 `/electron/electron`.
## TDD Evidence (implement)

- `p4-s1-harness-failure-row-owner`: `.rpiv/artifacts/evidence/2026-10-31_p4-s1-harness-failure-row-owner-tdd.md` (candidate `5570258`).
