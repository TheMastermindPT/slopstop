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
last_updated: 2026-11-01T10:00:00+0000
last_updated_by: Pedro Mesquita
last_updated_note: "p4-s4 contract detailed (P4-B9 to P4-B11); Q13 open."
content_hash: 0fb96a63a3331e628cd2ff517ef74cb6e5c06ea287659314468e80849d1dea85
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

### Slice p4-s2-bridge-test-composition

- **`slice_id`:** `p4-s2-bridge-test-composition`.
- **Lane:** normal. `lane.mjs --paths` over the ten planned paths answers normal (files: 6 > 5).
- **Finding:** L1-08. Acceptance: the three test-only standalone factories are gone, and the bridge tests compose bridges as production does. Q11 (a), Pedro's choice.
- **Base:** main `19b6166` (p4-s1 accepted). The implementer's read-only measurements were taken at `20e198a`; every source fact below was re-read at `19b6166`.
- **Measured at `19b6166`:**
  - Each factory builds a private core and passes its unsubscribe as `afterStop`, so a standalone `bridge.stop()` also ends the session subscription:
    - `createProjectEntryBridge` at `project-entry-bridge.ts:229-235`;
    - `createProjectStorageBridge` at `project-storage-bridge.ts:161-167`;
    - `createWorkspaceBridge` at `workspace-bridge.ts:267-271`.
  - Production composes the bridges only through `createHarnessBridges` (`harness-bridges.ts:25-59`).
    - It passes a no-op `keepCore`, so only `release()` unsubscribes the core, once.
    - `release()` first stops each bridge, isolating each failure, and only then unsubscribes.
    - It runs `core.failAll({ kind: "transport" })` in `finally`, and throws the first failure only after every step has run.
  - Callers are test-only:
    - `project-entry-bridge.test.ts:78` (`setup`) and `:658` (`scripted`);
    - `harness-supervisor.test.ts:1254`;
    - `project-storage-bridge.test.ts:174` (`bridgeWith`);
    - `workspace-bridge.test.ts:271` (`bridgeWith`).
  - Only the factories use the two option types, `ProjectStorageBridgeOptions` (`project-storage-bridge.ts:32-36`) and `WorkspaceBridgeOptions` (`workspace-bridge.ts:32-36`).
  - With the factories gone, the `makeHarnessRequestCore` import and the `HarnessSessionClient` import also become unused in all three bridge files.
- **Deliverable:**
  - The test helpers build the bridges with `createHarnessBridges({ session, createId, now })`: `setup`, `scripted`, both `bridgeWith`, and the supervisor row's bridge. Each takes its own bridge (`projectEntry`, `projectStorage` or `workspace`) and also returns the bundle's `release`.
  - Five rows move from "`bridge.stop()` ends the subscription" to `release()`. P4-B5 gives the exact oracle for each.
  - These are deleted: the three factories, the two option types and the imports that become unused.
  - The TSDoc on `projectEntryBridgeOver`, `projectStorageBridgeOver` and `workspaceBridgeOver` loses its "standalone bridge ends its private core" sentence. The `afterStop` parameter stays (see Non-goals).
- **Non-goals:**
  - No production composition, answer, text or signature changes. `harness-bridges.ts` and `main.ts` are not edited.
  - `afterStop` keeps one caller, which passes a no-op. Removing the parameter would change three signatures and `harness-bridges.ts`, which is s4 skeleton work; s4 decides it.
  - `harness-bridges.test.ts` is not edited. Its rows already prove the bundle (`release settles before unsubscribe fails`, `release twice`, `stop scoped to its bridge`). The moved rows keep each bridge's own pending answers in its own file.
- **Message and code ledger:** nothing added, removed or changed. No wire change.
- **Affected paths:**
  - `apps/desktop/src/main/{project-entry-bridge,project-storage-bridge,workspace-bridge}.ts`;
  - `apps/desktop/src/main/{project-entry-bridge,project-storage-bridge,workspace-bridge,harness-supervisor}.test.ts`;
  - `stryker.desktop-s7.config.json`, `stryker.config.json`, `stryker-range-anchors.json`.
- **Stryker re-anchoring (lesson 3, same slice).** Deleting the factories, the option types and the unused imports moves these ranges. The values below are predicted; the candidate's `pnpm check:mutation-ranges` is the authority. Every `first` and `last` anchor text stays as it is.

  | Config | Entry now | Predicted entry | Anchor row | Why |
  |---|---|---|---|---|
  | `stryker.desktop-s7.config.json` | `project-entry-bridge.ts:80-235` | `:78-223` | `stryker-range-anchors.json:202` | 2 import lines go (`:39`, `:42`). The range now ends at the `}` that closes `projectEntryBridgeOver` (now `:225`), not at the factory. |
  | `stryker.desktop-s7.config.json` | `project-storage-bridge.ts:38-167` | `:30-151` | `:208` | 8 lines go before the range (`:26`, `:30`, `:32-37`). The range ends at the `}` that closes `projectStorageBridgeOver` (now `:159`). |
  | `stryker.desktop-s7.config.json` | `workspace-bridge.ts:101-271` | `:93-257` | `:214` | 8 lines go before the range (`:26`, `:30`, `:32-37`). The range ends at the `}` that closes `workspaceBridgeOver` (now `:265`). |
  | `stryker.config.json` | `project-entry-bridge.ts:103-103` | `:101-101` | `:58` | Shifted by the two import lines. |
  | `stryker.config.json` | `project-entry-bridge.ts:189-202` | `:187-200` | `:64` | Shifted by the two import lines. |

  **Correction to the coordinator's input:** the two `stryker.config.json` entry-bridge ranges do move. Two import lines above them go, because `makeHarnessRequestCore` and `HarnessSessionClient` become unused once the factory is deleted.
  - The number of ranges and whole files does not change (19 ranges; 34 whole files after p4-s1). So the real-repository row in `check-stryker-ranges.test.mjs` is not edited.
  - No test file moves or splits, so `vitest.desktop-s7-mutation.config.ts` does not change, and neither do the `-s6-` and `-s8-` configs.
- **Full-integration exposure:** none in production. The bridges are composed only by `createHarnessBridges`, which this slice does not touch. The exposure is Knip (the deleted exports) and the desktop unit project. There is nothing for e2e or `package:launch-smoke` to prove here; the Phase 4 final `check:deep` covers them as usual.
- **Dependencies:** after s1 (accepted). s4 rebuilds the bridges over this test composition.

#### Test Contract: p4-s2-bridge-test-composition

Public seam: `createHarnessBridges` (`harness-bridges.ts`) and the bridge clients it returns (`projectEntry`, `projectStorage`, `workspace`, `release`), over each test file's own fake session.

- **Behavior P4-B4: bridge tests build their bridges the way production does, and every other row's assertions stay unchanged.**
  - Test: `apps/desktop/src/main/project-entry-bridge.test.ts`, `apps/desktop/src/main/project-storage-bridge.test.ts`, `apps/desktop/src/main/workspace-bridge.test.ts` and `apps/desktop/src/main/harness-supervisor.test.ts`, through `createHarnessBridges`. Only the helpers and the five P4-B5 rows change: `setup`, `scripted`, both `bridgeWith`, and the supervisor row's construction. Every other row's assertions stay character for character and pass before and after.
  - Expected red: none — pin. The production composition already behaves this way; these rows prove it and add no behavior.
- **Behavior P4-B5: a bridge's own stop keeps the shared subscription; `release()` ends it once, after every pending operation is settled, and surfaces an unsubscribe failure.**
  - Test: `rejects mismatched, uncorrelated, disconnected, and stopped requests` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `settles pending operations even when session unsubscribe throws` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `stops once and rejects later requests without observing the session` in `apps/desktop/src/main/workspace-bridge.test.ts`; `settles pending work even when session unsubscribe throws` in `apps/desktop/src/main/workspace-bridge.test.ts`; `settles pending work even when session unsubscribe throws` in `apps/desktop/src/main/project-entry-bridge.test.ts`.
  - Oracle per row. Titles stay; each "was" is the row at `19b6166`.
    1. **Storage, `rejects mismatched, uncorrelated, disconnected, and stopped requests`** (`:312`; tail `:348-353`). Earlier assertions are unchanged. Then:
       - `bridge.stop()` twice;
       - `bridge.open(openRequest)` resolves `transportBrokenOpenResult("Project Storage bridge is stopped.")` (unchanged);
       - `unsubscribeCalls` is **0** (was 1: a bridge's stop leaves the shared subscription);
       - `release()` does not throw;
       - `unsubscribeCalls` is **1**.
    2. **Storage, `settles pending operations even when session unsubscribe throws`** (`:299-310`). The session's `unsubscribeError` is `new Error("unsubscribe failed")`, and `pending = bridge.create(createRequest)`.
       - `expect(() => release()).toThrow("unsubscribe failed")`, where it was `bridge.stop()`;
       - `pending` resolves `transportBrokenCreateResult("Project Storage bridge is stopped.")` (unchanged: `release()` stops the bridge before it unsubscribes);
       - a second `release()` does not throw;
       - `unsubscribeCalls` is **1**.
    3. **Workspace, `stops once and rejects later requests without observing the session`** (`:465-480`). Before the stop, `listenerCount` is 1 (unchanged).
       - `bridge.stop()` twice; then `listenerCount` is **1** and `unsubscribeCalls` is **0** (they were 0 and 1);
       - the later `query` still resolves its broken answer (unchanged);
       - `release()`; then `listenerCount` is **0** and `unsubscribeCalls` is **1**.
    4. **Workspace, `settles pending work even when session unsubscribe throws`** (`:1040-1054`). The session's `unsubscribeError` is `failure`, and one query is pending.
       - `expect(() => release()).toThrow(failure)`, where it was `bridge.stop()`;
       - after the microtask flush, the query's answer is `workspaceQueryClosing(memoryQuery())` (unchanged);
       - a second `release()` does not throw;
       - `unsubscribeCalls` is **1**.
    5. **Entry, `settles pending work even when session unsubscribe throws`** (`:754-766`). The session has `failUnsubscribe = 1`, with `readConversation(s7Read)` and `list()` pending.
       - `expect(() => release()).toThrow(session.unsubscribeError)`, where it was `bridge.stop()`;
       - after `flushMicrotasks()`, both are settled: `read.value` is `readLost`, and `list.value` is `{ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" }` (unchanged);
       - a second `release()` does not throw;
       - `unsubscribeCalls` is **1**.
    - **Supervisor row** `answers broken for a read during $failure` (`harness-supervisor.test.ts:1248-1286`): the assertions are unchanged. Its cleanup `bridge.stop()` (`:1283`) becomes the bundle's `release()`, so the test ends the subscription it opened.
  - Expected red: none — pin. These rows pass on the base source, because `createHarnessBridges` already composes this way and the slice changes no source behavior. A rewritten test applied to the base cannot turn red. Bindings 1 to 3 show that the oracles bite.
- **TDD-exempt**: deleting `createProjectEntryBridge`, `createProjectStorageBridge`, `createWorkspaceBridge`, `ProjectStorageBridgeOptions`, `WorkspaceBridgeOptions` and their now-unused imports - removing test-only code changes no behavior. The proof is structural: the `rg` checks below, Knip, `pnpm typecheck`, and P4-B4 and P4-B5 green.

**Bindings that bite (each on the candidate, each restored after):**
1. A test helper in `project-storage-bridge.test.ts` returns a bridge built as `projectStorageBridgeOver(core, clock, core.unsubscribe)` over `makeHarnessRequestCore(session)`: the standalone composition. Oracle 1 fails because `unsubscribeCalls` is 1 where 0 is expected. So the rows tell the standalone composition from the production one.
2. In `harness-bridges.ts`, pass `core.unsubscribe` instead of `keepCore` for the workspace bridge. Oracle 3 fails: after `bridge.stop()`, `listenerCount` is 0 and `unsubscribeCalls` is 1. So the per-bridge rows guard production's composition.
3. In `release()`, move `core.unsubscribe()` (and its `finally`) before the bridge-stop loop. Oracle 2 fails: `failAll` settles `pending` with the transport text before the storage bridge stops, not with `"Project Storage bridge is stopped."`.

**Structural checks (on the candidate):**
- `rg -n "createProjectEntryBridge|createProjectStorageBridge|createWorkspaceBridge|ProjectStorageBridgeOptions|WorkspaceBridgeOptions" apps/desktop`: nothing.
- `rg -n "makeHarnessRequestCore" apps/desktop/src/main --glob "!*.test.ts"`: only `harness-request-core.ts` and `harness-bridges.ts`.
- `rg -n "standalone" apps/desktop/src/main/project-entry-bridge.ts apps/desktop/src/main/project-storage-bridge.ts apps/desktop/src/main/workspace-bridge.ts`: nothing.
- `git diff 19b6166 --stat` lists only the affected paths and this brief's evidence.

#### Success Criteria: p4-s2-bridge-test-composition

Automated (smallest first; each read by its real exit code):
- Green before (at `19b6166`) and after, with the same row count: `pnpm --filter @slopstop/desktop exec vitest run src/main/project-entry-bridge.test.ts src/main/project-storage-bridge.test.ts src/main/workspace-bridge.test.ts src/main/harness-supervisor.test.ts src/main/harness-bridges.test.ts`.
- Each binding (1 to 3) observed red and then restored, with the same command scoped to its file.
- `pnpm check:mutation-ranges` exit 0. The real-repository row stays green: `pnpm --filter @slopstop/harness exec vitest run scripts/check-stryker-ranges.test.mjs`.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). `pnpm check:dead-code` (Knip) exit 0, with no unused export left.
- CodeScene 10 on the three bridge files and the four test files.
- Mutation: none for this slice (no source logic changed). The scoped `desktop-s7` run belongs to the final Phase 4 candidate, with the coordinator's GO.

Manual: none.

### Slice p4-s3-fault-meaning-owner

- **`slice_id`:** `p4-s3-fault-meaning-owner`.
- **Lane:** normal. `lane.mjs --paths` over the twelve planned paths answers normal (files: 9 > 5).
- **Finding:** L1-03, part 1. There is one fault-meaning table, and the upgrade mapper consumes it. No answer changes. Part 2, activation and switch, is s6.
- **Base:** candidate `3f80587` (p4-s2 accepted, on branch `fix/arch-review-phase-4`). Both failure modules are unchanged since `19b6166` (`git diff 19b6166 3f80587` is empty for them).
- **Measured at `3f80587`:**
  - `project-conversation-failure.ts:34-49`: `faultMeaning` maps each `ProjectRequestFault` to one of five meanings (G25):
    - `unsent` → not-sent;
    - `transport` and `stopped` → sent-then-lost;
    - `protocol` → malformed-reply;
    - `desktop` → defect;
    - `harness` → harness, with its code;
    - `send` → defect when the code is `HARNESS_SESSION_MESSAGE_INVALID`, otherwise not-sent.
    
    `readConversationFailure` (`:52-62`) and `saveConversationFailure` (`:69-81`) branch on the meaning.
  - `project-upgrade-failure.ts:32-54` restates the same seven arms directly on `fault.kind`, arm for arm. Its answers equal "read's" answers, meaning by meaning: harness → broken with the harness row; not-sent and sent-then-lost → `unavailable` / `connectionLost`; malformed-reply and defect → broken / `protocolMessageInvalid`.
  - Each file keeps its own `harnessRows` map (`:13-17`, `:10-14`). The map goes from `HarnessFailureCode` to that file's diagnostics table. Since p4-s1, every row of both tables equals `harnessFailureRow(code)` (P4-B1), so the two maps hold equal values under different names.
  - `harnessFailureRow` is package-internal (p4-s1). `@slopstop/protocol` exports `harnessFailureMessages`, but no row table. s6 needs one too (Developer Context, p4-s1 D2).
  - Callers: `project-entry-bridge.ts:185`, `:192`, `:199` (the bridge's `broken` mappers) and `project-entry-ipc.ts:58`, `:63`, `:68` (the closed-gate answers). Neither file changes.
- **Q12 (open, for Pedro): where the one harness-row map comes from.** Today each mapper keeps its own copy.
  - **(a), recommended:** `@slopstop/protocol` exports `harnessFailureRows`, a frozen `Record<HarnessFailureCode, row>` built with `harnessFailureRow`, next to the helper in `harness-failure-protocol.ts`. Both desktop mappers read it, and s6's activation and switch rows read it too.
    - Cost: one new public export in `packages/protocol`. The helper itself stays internal.
    - Gain: one row table from protocol to desktop, and s6's D2 is settled here.
  - **(b):** the desktop owner builds its one map from `projectConversationDiagnostics`, and the upgrade mapper borrows conversation rows.
    - Cost: no protocol change.
    - Problem: the upgrade answers then depend on the conversation table by name; the values are equal only because of P4-B1. s6 would borrow it a third time.
  - **(c):** only `faultMeaning` moves, and each mapper keeps its `harnessRows`. That leaves the duplicate the finding names, so it does not meet L1-03 part 1.
  
  The contract below is written on (a). Under (b), P4-B6 and the three protocol paths drop out, and the owner also exports the map.
- **Deliverable (on Q12 (a)):**
  - `packages/protocol/src/harness-failure-protocol.ts` exports `harnessFailureRows`, and `packages/protocol/src/index.ts` re-exports it.
  - New `apps/desktop/src/main/request-fault-meaning.ts` exports `type FaultMeaning` and `faultMeaning(fault)` (the body moves unchanged, with its G25 TSDoc).
  - `project-conversation-failure.ts` imports `faultMeaning` and `harnessFailureRows`, and deletes its copy and its `harnessRows`. Its two mappers keep their bodies.
  - `project-upgrade-failure.ts` branches on `faultMeaning(fault)` and drops its `Match` on `fault.kind`:
    - harness → `{ status: "broken", request, diagnostic: harnessFailureRows[code] }`;
    - not-sent and sent-then-lost → `connectionLost`;
    - malformed-reply and defect → `protocolInvalid`.
    
    It deletes its `harnessRows`.
- **Non-goals:** no answer changes for any fault. Activation and switch are not touched (s6). `project-entry-bridge.ts` and `project-entry-ipc.ts` are not edited. The neutral texts stay in `harness-request-core.ts` (s5).
- **Message and code ledger:** nothing added, removed or changed. No wire change; `protocolVersion` stays 9.
- **Affected paths:**
  - `apps/desktop/src/main/request-fault-meaning.ts` (new) and `request-fault-meaning.test.ts` (new);
  - `apps/desktop/src/main/project-conversation-failure.ts`, `project-upgrade-failure.ts`;
  - `packages/protocol/src/harness-failure-protocol.ts`, `harness-failure-protocol.test.ts`, `index.ts`;
  - `stryker.desktop-s7.config.json`, `stryker.config.json`, `stryker-range-anchors.json`, `apps/desktop/vitest.desktop-s7-mutation.config.ts`, `apps/harness/scripts/check-stryker-ranges.test.mjs` (its real-repository row).
- **Stryker re-anchoring (lesson 3, same slice).** `check:mutation-ranges` on the candidate is the authority.

  | Config | Entry now (`3f80587`) | After | Anchor row |
  |---|---|---|---|
  | `stryker.desktop-s7.config.json` | `project-conversation-failure.ts:35-48` (the `faultMeaning` `Match` body) | removed; `apps/desktop/src/main/request-fault-meaning.ts` is added as a whole-file entry | `stryker-range-anchors.json:226` removed |
  | `stryker.desktop-s7.config.json` | `project-upgrade-failure.ts:36-53` (its `Match` body) | re-pointed at the rewritten `projectUpgradeFailure` body, from its first to its last statement line, with both anchor texts rewritten | `:220` rewritten |
  | `stryker.config.json` | `project-conversation-failure.ts`, `project-upgrade-failure.ts` (whole files) | unchanged; `request-fault-meaning.ts` is added as a whole file | none |
  | `stryker.config.json` | `project-entry-bridge.ts:101-101`, `:187-200` | unchanged (the file is not edited) | `:58`, `:64` |
  | `stryker.config.json` | `harness-failure-protocol.ts` (whole file) | unchanged (the new table is in that file) | none |

  - **Real-repository row** (`check-stryker-ranges.test.mjs:446-449`), edited red-first as in p4-s1:
    - `stryker.config.json`: `wholeFiles` 34 → 35;
    - `stryker.desktop-s7.config.json`: `ranges` 7 → 6 and `wholeFiles` 2 → 3.
  - `vitest.desktop-s7-mutation.config.ts` gains `apps/desktop/src/main/request-fault-meaning.test.ts`, so the owner's whole-file mutants meet its own table. `vitest.main.config.ts` already collects `src/main/**/*.test.ts`.
- **Full-integration exposure:**
  - e2e `apps/desktop/tests/e2e/project-upgrade.test.ts`, `conversation.test.ts` and `conversation-accessibility.test.ts` cover the answers through a real launch. Their fault paths are proven by the unit rows only; the e2e runs prove nothing moved, once, at the Phase 4 final `check:deep`.
  - Harness integration decodes the same result rows, whose values do not change.
  - `harnessFailureRows` is a new `@slopstop/protocol` export, which Knip counts as used by desktop.
- **Dependencies:** after s2 (accepted) and s1 (the row helper). s6 reads `harnessFailureRows` for activation and switch.

#### Test Contract: p4-s3-fault-meaning-owner

Public seam: `harnessFailureRows` from `@slopstop/protocol` (`index.ts`); `faultMeaning` from `request-fault-meaning.ts`; and the answers of `projectUpgradeFailure`, `readConversationFailure` and `saveConversationFailure` through the project-entry bridge and as direct calls.

- **Behavior P4-B6: `@slopstop/protocol` exports one harness failure row per code.**
  - Test: `packages/protocol/src/harness-failure-protocol.test.ts`, through `harnessFailureRows` imported from `./index.js`.
  - Rows:
    - the key set, sorted, `toEqual` the three `HarnessFailureCode` values, sorted;
    - for each code, `harnessFailureRows[code]` `toEqual` `harnessFailureRow(code)`;
    - for each code and each of `projectUpgradeDiagnostics` and `projectConversationDiagnostics`, the table's row for that code `toEqual` `harnessFailureRows[code]` (6 rows);
    - `Object.isFrozen(harnessFailureRows)` is true.
  - Expected red: `harnessFailureRows` is not exported from `./index.js`. The import is `undefined`, and every row fails.
- **Behavior P4-B7: one table gives every request fault its meaning.**
  - Test: `apps/desktop/src/main/request-fault-meaning.test.ts` (new), through `faultMeaning`.
  - Rows, one per fault value (17):
    - `{ kind: "unsent" }` → `{ meaning: "not-sent" }`;
    - `{ kind: "transport" }` and `{ kind: "stopped" }` → `{ meaning: "sent-then-lost" }`;
    - `protocol` with each of `invalid-message`, `uncorrelated`, `system-failure` and `undecodable` → `{ meaning: "malformed-reply" }`;
    - `desktop` with each of `invalid-command`, `identity-collision`, `mismatched-event` and `mismatched-echo` → `{ meaning: "defect" }`;
    - `harness` with each code → `{ meaning: "harness", code }`;
    - `send` with `HARNESS_SESSION_MESSAGE_INVALID` → `{ meaning: "defect" }`;
    - `send` with `HARNESS_SESSION_UNAVAILABLE` or `HARNESS_SESSION_SEND_FAILED` → `{ meaning: "not-sent" }`.
    
    Each row uses `toEqual`, so an extra key fails.
  - Expected red: the import fails, because `request-fault-meaning.ts` does not exist.
- **Behavior P4-B8: every upgrade and conversation answer stays as it is.**
  - Test: `answers every upgrade reply with one strict result: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers every upgrade reply with one strict result: request.failure %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers every upgrade reply with one strict result: an invalid command at send` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers a conversation %s with one strict result: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers a conversation %s request.failure %s as broken` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `maps a send refused as an invalid message to broken for both operations` in `apps/desktop/src/main/project-entry-bridge.test.ts`. The file is unedited and green before and after, with the same row count. Also `apps/harness/scripts/check-stryker-ranges.test.mjs`, through `checkStrykerRanges({ root: repository })` (the real-repository row).
  - Expected red: none — pin. The bridge rows guard kept answers. The real Stryker row's red is observed in the slice's TDD evidence, as in p4-s1: edited to the new counts, it fails against the old configs and passes after the entries move. A pin behavior is not re-proved.

**Bindings that bite (each on the candidate, each restored after):**
1. In `request-fault-meaning.ts`, map `stopped` to `not-sent`. The P4-B7 `stopped` row fails, and so does the P4-B8 conversation row "a stop while pending" for save (`unconfirmed` becomes `lost`). This proves the save mapper reads the owner.
2. In `request-fault-meaning.ts`, map `send` with `HARNESS_SESSION_SEND_FAILED` to `defect`. The P4-B7 row fails, and so does the P4-B8 upgrade row "a send that fails" (`connectionLost` becomes `protocolInvalid`). This proves the upgrade mapper reads the owner.
3. In `harness-failure-protocol.ts`, build `harnessFailureRows.HARNESS_INTERNAL_FAILURE` as `harnessFailureRow("PROTOCOL_MESSAGE_INVALID")`. The P4-B6 rows fail, and so does the P4-B8 row `answers every upgrade reply with one strict result: request.failure %s` for `HARNESS_INTERNAL_FAILURE`. This proves the upgrade mapper reads the protocol table.

**Structural checks (on the candidate):**
- `rg -n "function faultMeaning|type FaultMeaning" apps/desktop/src`: only `request-fault-meaning.ts`.
- `rg -n "harnessRows" apps/desktop/src --glob "!*.test.ts"`: nothing.
- `rg -n "Match" apps/desktop/src/main/project-upgrade-failure.ts apps/desktop/src/main/project-conversation-failure.ts`: nothing.
- `rg -n "harnessFailureRow\b" packages/protocol/src/index.ts`: nothing (the helper stays internal); `rg -n "harnessFailureRows" packages/protocol/src/index.ts`: one line.
- `git diff 3f80587 --stat` lists only the affected paths and this brief's evidence.

#### Success Criteria: p4-s3-fault-meaning-owner

Automated (smallest first; each read by its real exit code):
- Red then green: `pnpm --filter @slopstop/protocol exec vitest run src/harness-failure-protocol.test.ts`.
- Red then green: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/request-fault-meaning.test.ts`.
- Green before (at `3f80587`) and after, with the same row count: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/project-entry-bridge.test.ts`.
- Each binding (1 to 3) observed red and then restored, with the commands above.
- `pnpm check:mutation-ranges` exit 0. The real row is red first (new counts against the old configs), then green: `pnpm --filter @slopstop/harness exec vitest run scripts/check-stryker-ranges.test.mjs`.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). `pnpm check:dead-code` (Knip) exit 0.
- CodeScene 10 on the four desktop files, `harness-failure-protocol.ts` and both new or edited tests.
- Mutation: none for this slice. The coordinator may ask for one scoped `stryker.desktop-s7.config.json` run on the owner file at the final Phase 4 candidate.

Manual: none.

### Slice p4-s4-request-skeleton

- **`slice_id`:** `p4-s4-request-skeleton`.
- **Lane:** normal. `lane.mjs --paths` over the planned paths answers normal (files: 8 > 5).
- **Finding:** L1-01, plus the structural half of L1-12 (Q8 (a)). One request skeleton in the core; the three bridges supply their schemas, echo rule and answers. Also p4-s2's V1: `afterStop` and its comments go.
- **Base:** candidate `87f09e8` (p4-s3 accepted plus its polish, on branch `fix/arch-review-phase-4`). Every line number below is read at `87f09e8`.
- **Measured at `87f09e8`:**
  - The per-request skeleton is written three times:
    - `project-storage-bridge.ts:93-120` (`operation`): the stopped guard (`:101`), the command build (`:104-108`), `core.request`, `decodeReply`, the echo check against `command?.payload` (`:113`), `answerRequest` (`:109`);
    - `workspace-bridge.ts:185-207` (`request`): the stopped guard (`:194`), `core.request`, `decodeReply`, a per-operation `check` (`:199`), `answerRequest` (`:195`). The query `check` compares the reply against the **caller's** `query` object (`:216`); the intent `check` compares capability only (`:231`);
    - `project-entry-bridge.ts:93-136` (`entryRequests`): `request` (`:95-106`) with the stopped guard (`:101`), and `echoing` (`:108-134`), which decodes the input with `decodeStrict` **outside** the promise (`:121`) and compares the echo against that decoded copy (`:127`). `register` decodes its input the same way (`:152`); `list` has no input and no echo.
  - **Invalid input today (static read; this corrects the Architecture table and Q5's premise):**
    - Entry: `activate`, `switchProject`, `upgrade`, `readConversation`, `saveConversationMessage` and `register` throw synchronously (`decodeStrict`, `:121`, `:152`), running or stopped.
    - Storage and workspace: an invalid request fails in the command builder as `desktop` `invalid-command`, but the broken answer then decodes a result that echoes the invalid request (`brokenResult` `:68`, `brokenQuery` `workspace-bridge.ts:51`, `brokenIntent` `:61`, all `decodeStrict`). Every broken arm requires a valid request (`project-storage-protocol.ts:106` `brokenResultSchema(request)`). So that decode throws: inside `Effect.catch` the promise rejects with a schema error; after stop the guard calls `broken` synchronously (`:101`, `:194`) and the call throws.
    - So no bridge answers an envelope for an invalid request today. The `desktop invalid-command` envelope that the storage and workspace rows show (`project-storage-bridge.test.ts` "rejects invalid local metadata…", `workspace-bridge.test.ts` "rejects invalid locally generated command metadata before send") comes from invalid **metadata** with a valid request. Q13 reopens Q5 on this fact.
  - **V1 (p4-s2):** `createHarnessBridges` passes `keepCore = () => {}` as every bridge's `afterStop` (`harness-bridges.ts:28-31`), so the `afterStop()` calls (entry `:221`, storage `:148`, workspace `:254`) do nothing. Their "Settle first" comments are at entry `:219`, storage `:146`, workspace `:250`. The re-entry guards `if (stopped) return` are at entry `:217`, storage `:144`, workspace `:248`.
  - `unsent` is exported from `project-entry-bridge.ts:78` and read by `project-entry-ipc.ts:21`, `:58`, `:63`, `:68`; it stays where it is.
- **V1 decision: the re-entry guard is dropped.** Once `afterStop` is gone, every step of a bridge's `stop()` is idempotent on its own: `stopped = true`; `core.failBridge(tag, stopped)` finds no entry the second time, because a request after stop never reaches the core; the workspace's `removeObserver()` is a `Set.delete`; `notificationListeners.clear()` empties an empty set. A second `stop()` therefore does exactly what the first left behind, and no row can tell the guard from its absence: its mutants are equivalent. Keeping it would need an invented observable. `release()` keeps its own `released` guard (`harness-bridges.ts:38`), which is observable (`unsubscribeCalls` stays 1).
- **Q13 (open, for Pedro): what an invalid request answers.** Q5 (a) chose "the `desktop invalid-command` envelope, as the storage and workspace bridges already answer". They do not (above), and they cannot without a wire change: every result that could carry `invalid-command` must echo a valid request (or capability), and the request is the invalid part.
  - **(a), recommended:** an invalid request is a caller defect. In every bridge it never throws synchronously, never reaches the core and never sends: the call's promise rejects with one fixed error, `Invalid <bridge> request.` (`project-entry`, `project-storage` or `workspace`), which carries none of the input. The IPC handlers decode first, so the renderer never reaches it; only direct callers (tests, the smokes) can. Fixed text, because a schema error quotes the input, and a registration request holds a full local path.
  - **(b):** a wire change: each result gains a request-free `invalid-request` arm, so an envelope is possible. `protocolVersion` 9 → 10 here, or folded into s6's bump (Q1). Large blast for a path production never takes.
  - **(c):** keep each bridge's current behaviour. The skeleton then needs a per-bridge invalid-input hook, which is the duplication L1-01 removes.

  The contract below is written on (a). Under (b), P4-B9 changes its oracle to the new arm and the slice gains the protocol paths. Under (c), P4-B9 drops out.
- **Deliverable (on Q13 (a)):**
  - `harness-request-core.ts` exports one bridge-request function. A bridge passes its tag, its stopped check, the input and its request schema (none for `list`), the command builder over the validated request, the reply event, the result schema, an echo rule (what the reply echoes and what the command sent; none for `list` and `register`) and its broken answer over the validated request. The function owns, in this order:
    1. input validation with `decodeStrictResult`; a failure rejects with the fixed error, before anything else;
    2. the stopped guard, answering `broken(request, unsent)`;
    3. the request through the core and `decodeReply`;
    4. the echo check with `isDeepStrictEqual` against the command's validated payload (`command.payload`), never the caller's object;
    5. `answerRequest` at the end.
  - The workspace query check keeps `acceptQueryResult` (the revision floor) after the echo check, as today.
  - `projectEntryBridgeOver`, `projectStorageBridgeOver` and `workspaceBridgeOver` lose their `afterStop` parameter, its TSDoc sentence and the "Settle first" comment; `createHarnessBridges` loses `keepCore`. Each `stop()` loses its re-entry guard and keeps the rest.
  - The three bridges keep their public clients, their texts and their `faultText` tables (s5 merges those).
- **Non-goals:** no fault text changes (s5). No change to `ProjectRequestFault`, `makeHarnessRequestCore`, `decodeReply` or `answerRequest`. Activation and switch keep their unavailable answers (s6). `project-entry-ipc.ts`, `project-storage-bootstrap.ts`, `desktop-runtime.ts`, `main.ts` and the package smokes are not edited (`createHarnessBridges` keeps its signature).
- **Message and code ledger:** one new text, `Invalid <bridge> request.` (three values), on a promise rejection only; no wire change; `protocolVersion` stays 9.
- **Affected paths:**
  - `apps/desktop/src/main/harness-request-core.ts`, `harness-bridges.ts`;
  - `apps/desktop/src/main/project-entry-bridge.ts`, `project-storage-bridge.ts`, `workspace-bridge.ts`;
  - `apps/desktop/src/main/project-entry-bridge.test.ts`, `project-storage-bridge.test.ts`, `workspace-bridge.test.ts` (new rows only; existing rows unedited);
  - `stryker.desktop-s7.config.json`, `stryker.config.json`, `stryker-range-anchors.json`, `apps/harness/scripts/check-stryker-ranges.test.mjs` (its real-repository row).
- **Stryker re-anchoring (lesson 3, same slice).** `pnpm check:mutation-ranges` on the candidate is the authority; it answered exit 0 at `87f09e8` (`p4-s3-polish-mutation-ranges.log`). These entries supersede the citations in the Deferred Work row and the Stryker table.

  | Config | Entry now (`87f09e8`) | After | Anchor row |
  |---|---|---|---|
  | `stryker.desktop-s7.config.json` | `project-entry-bridge.ts:78-224` | re-pointed from `export const unsent` to the file's last line | `stryker-range-anchors.json:202` (line numbers only; `first`/`last` texts unchanged) |
  | `stryker.desktop-s7.config.json` | `project-storage-bridge.ts:30-151` | re-pointed from `const stoppedText` to the file's last line | `:208` |
  | `stryker.desktop-s7.config.json` | `workspace-bridge.ts:93-257` | re-pointed from `const closingDiagnostic` to the file's last line | `:214` |
  | `stryker.desktop-s7.config.json` | `harness-request-core.ts`, `harness-bridges.ts` (whole files) | unchanged; the skeleton lands in a whole-file entry | none |
  | `stryker.config.json` | `project-entry-bridge.ts:101-101` (the entry stopped guard) | **removed**: the line moves into the core, which is a whole-file entry (`stryker.config.json:31`) | `:58` removed |
  | `stryker.config.json` | `project-entry-bridge.ts:187-200` (`readConversation: echoing({` … `}),`) | re-pointed at the `readConversation` and `saveConversationMessage` operations in their new form, with both anchor texts rewritten | `:64` rewritten |
  | `stryker.config.json` | `workspace-bridge.ts`, `harness-request-core.ts`, `harness-bridges.ts` (whole files) | unchanged | none |

  - **Real-repository row** (`check-stryker-ranges.test.mjs:446`), edited red-first as in p4-s1 and p4-s3: `stryker.config.json` `ranges` 19 → 18. `desktop-s7` stays 6 ranges, 3 whole files.
  - `vitest.desktop-s7-mutation.config.ts` already names the three bridge tests, the core test and `harness-bridges.test.ts`; no change.
- **Full-integration exposure:** every renderer request goes through the new skeleton.
  - e2e: every journey that makes a bridge request: `projects.test.ts`, `registration.test.ts`, `conversation.test.ts`, `conversation-accessibility.test.ts`, `project-upgrade.test.ts`, `shell.test.ts`.
  - `package:launch-smoke`: `project-storage-package-smoke.ts` drives the storage bridge, and the writer proof goes through the bridges.
  - Harness integration: unaffected (no wire change).
  - Default: one run of each at the Phase 4 final `check:deep`. The coordinator may ask for one e2e run on this candidate, because this is the slice with the widest runtime reach before s6.
- **Dependencies:** after s3 (accepted). s5 (`bridgeFaultText`) builds on this skeleton's broken answers.

#### Test Contract: p4-s4-request-skeleton

Public seam: the three bridge clients built through `createHarnessBridges` (as since p4-s2), over a scripted session or port.

- **Behavior P4-B9: an invalid request rejects with one fixed error, in every bridge, running or stopped.**
  - Test: `rejects an invalid %s request without throwing or sending: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `rejects an invalid %s request without throwing or sending: %s` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `rejects an invalid %s request without throwing or sending: %s` in `apps/desktop/src/main/workspace-bridge.test.ts`.
  - Rows (operation × running, stopped):
    - entry: `activate`, `switchProject`, `upgrade`, `readConversation`, `saveConversationMessage`, `register` (12 rows), message `Invalid project-entry request.`;
    - storage: `open`, `create`, `close` (6 rows), message `Invalid project-storage request.`;
    - workspace: `query`, `submit` (4 rows), message `Invalid workspace request.`
  - Oracle, per row: the input is the operation's valid fixture with one field replaced by a marker string that its schema rejects (the `register` marker is path-shaped). The call itself does not throw (`expect(() => …).not.toThrow()` around the call that captures the promise); the promise rejects with exactly the fixed message (`rejects.toThrow(new Error(…))`); the rejection's text does not contain the marker; and the session or port recorded no sent command.
  - Expected red: every row fails at `87f09e8`. Entry rows throw synchronously (`decodeStrict`). Stopped storage and workspace rows throw synchronously in the broken builder. Running storage and workspace rows reject with a schema error, not the fixed message.
- **Behavior P4-B10: the workspace query echo is checked against the validated query.**
  - Test: `correlates a query against the validated command payload instead of caller mutation` in `apps/desktop/src/main/workspace-bridge.test.ts`.
  - Rows:
    - the caller mutates its query object (`Reflect.set` on `projectId`) after `query()`; a reply echoing the original query answers that ready result (`toEqual`);
    - the caller mutates its query object; then the session disconnects; the broken answer's `query` `toEqual` the original query.
  - Expected red: the first row answers broken with "Harness returned a mismatched workspace query." (the check compares against the caller's object, `:216`); the second echoes the mutated object.
- **Behavior P4-B11: every other bridge answer stays as it is.**
  - Test: `request failure settles only its correlated Project Storage operation` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `correlates against the validated command payload instead of caller mutation` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `rejects mismatched, uncorrelated, disconnected, and stopped requests` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `rejects invalid local metadata and identity collision without losing the original` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `request failure settles only its correlated Workspace request` in `apps/desktop/src/main/workspace-bridge.test.ts`; `rejects invalid response correlation` in `apps/desktop/src/main/workspace-bridge.test.ts`; `stops once and rejects later requests without observing the session` in `apps/desktop/src/main/workspace-bridge.test.ts`; `answers the stopped text for a request made after stop` in `apps/desktop/src/main/workspace-bridge.test.ts`; `rejects invalid locally generated command metadata before send` in `apps/desktop/src/main/workspace-bridge.test.ts`; `settles pending work on malformed input and rejects calls after stop` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `rejects activation replies for a different Project even with a matching message correlation` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers every upgrade reply with one strict result: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers a conversation %s with one strict result: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `apps/desktop/src/main/harness-bridges.test.ts`; `apps/desktop/src/main/harness-request-core.test.ts`; `apps/desktop/src/main/harness-supervisor.test.ts`. Also `apps/harness/scripts/check-stryker-ranges.test.mjs`, through `checkStrykerRanges({ root: repository })` (the real-repository row).
  - Expected red: none — pin. The named rows and the three whole files are unedited and green before (`87f09e8`) and after, with the same row counts. They include the `8a0658d` cross-bridge correlation rows (storage and workspace "request failure settles only its correlated …", supervisor "keeps request failure status-neutral and reserves recovery for system failure"). The real Stryker row's red is observed in the slice's TDD evidence: edited to 18 ranges, it fails against the old config and passes after the entry moves. A pin behavior is not re-proved.

**Bindings that bite (each on the candidate, each restored after):**
1. In the skeleton, check the echo against the caller's input instead of `command.payload`. The P4-B10 first row fails, and so does the storage pin `correlates against the validated command payload instead of caller mutation`. This proves both bridges take the skeleton's echo baseline.
2. In the skeleton, answer the stopped guard with `{ kind: "stopped" }` instead of `unsent`. The workspace pin `answers the stopped text for a request made after stop` fails (the closing envelope answers), and so does the entry pin `settles pending work on malformed input and rejects calls after stop` (`list` answers its closing `unavailable`). This proves the workspace and entry bridges take the skeleton's guard.
3. In the skeleton, run the stopped guard before input validation. The P4-B9 stopped rows fail (the broken answer decodes the invalid request). This proves the order.

**Structural checks (on the candidate):**
- `rg -n "answerRequest\(" apps/desktop/src/main --glob "!*.test.ts"`: only `harness-request-core.ts`.
- `rg -n "afterStop|keepCore|Settle first" apps/desktop/src`: nothing.
- `rg -n "isDeepStrictEqual|if \(stopped\)|isStopped\(\)" apps/desktop/src/main/project-entry-bridge.ts apps/desktop/src/main/project-storage-bridge.ts apps/desktop/src/main/workspace-bridge.ts`: nothing.
- `rg -n "decodeStrict\([A-Za-z.]*RequestSchema" apps/desktop/src/main/project-entry-bridge.ts`: nothing (no synchronous input decode).
- `git diff 87f09e8 --stat` lists only the affected paths and this brief's evidence.

#### Success Criteria: p4-s4-request-skeleton

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `87f09e8` with row counts recorded (the P4-B11 baseline): `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/project-entry-bridge.test.ts src/main/project-storage-bridge.test.ts src/main/workspace-bridge.test.ts src/main/harness-bridges.test.ts src/main/harness-request-core.test.ts src/main/harness-supervisor.test.ts`.
- Red then green: the P4-B9 and P4-B10 rows, with the same command.
- The same command green after, with the pinned rows unchanged in count.
- Each binding (1 to 3) observed red and then restored.
- `pnpm check:mutation-ranges` exit 0. The real row is red first (18 ranges against the old config), then green: `pnpm --filter @slopstop/harness exec vitest run scripts/check-stryker-ranges.test.mjs`.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). `pnpm check:dead-code` (Knip) exit 0; `pnpm check:duplicates` reads no new clone among the three bridges.
- CodeScene 10 on the core, `harness-bridges.ts`, the three bridges and the three edited tests.
- Mutation: none for this slice. V1's survivors (the dropped guard and `afterStop()` lines) leave with the code; any `desktop-s7` survivor is triaged at the final Phase 4 mutation run.
- e2e and `package:launch-smoke`: at the Phase 4 final `check:deep`, unless the coordinator gives a GO for one run on this candidate.

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
- **2026-10-31: p4-s1 accepted; binding 1 outcome and stale counts (coordinator decision; slice-verifier V1).**
  - **Binding 1:** `retryable: true` turns 4 rows red (the 3 direct P4-B1 rows and "rejects a retryable row"), not every P4-B1 row as the Bindings line says. The table rows derive from the same owner the oracle compares against, so they stay green under binding 1; binding 3 (a local copy with a different message) reddens them. Recorded before the run; accepted by the coordinator.
  - **Stale counts:** where this brief says `stryker.config.json` has 33 whole files or the owner file is not mutated, p4-s1 made it 34 whole files with `harness-failure-protocol.ts` a whole-file entry (Q7). Later slices start from 34.
  - **For s6 (D2):** `harnessFailureRow` is package-internal, so the desktop cannot call it. s6 sources the activation and switch rows from an exported table, or a new decision exports the helper.
  - **Accepted identity:** candidate `8f7e883` on main `2c0014d` (rebased from `5570258` on `0fc425c`, same code). Slice-verifier round 1 of 1, no violation.

- **2026-10-31: p4-s2 detailed; Q11 decided (a) (Pedro, confirmed by the coordinator).**
  - **Q11:** how the bridge tests compose bridges once the three standalone factories go. A factory passes `core.unsubscribe` as `afterStop`, so its `stop()` ends the subscription. `createHarnessBridges` passes `keepCore` and ends the core only in `release()`.
    - **(a), chosen:** the tests build bridges through `createHarnessBridges`, and the five rows that pinned "stop ends the subscription" move to `release()` with changed assertions (P4-B5 oracles 1 to 5). The tests then prove what production composes.
    - **(b), rejected:** a test helper rebuilds `xBridgeOver(core, clock, core.unsubscribe)` inline and every assertion stays. That keeps proving a composition production never builds, which is the finding itself (L1-08) moved into the tests.
  - **Inputs:** the implementer's read-only measurements at `20e198a`, relayed by the coordinator, re-read at `19b6166`. One correction: the two `stryker.config.json` entry-bridge ranges (`:103-103`, `:189-202`) do move by two lines, because the factory's two imports become unused.
  - **Red:** the slice changes no source behavior, so P4-B4 and P4-B5 are pins (they pass on the base source), and the factory deletion is TDD-exempt with structural checks. Bindings 1 to 3 prove the oracles tell standalone from shared composition.
  - **Lane:** normal (`lane.mjs --paths`: files 6 > 5). The label is recorded on approval.
- **2026-10-31: p4-s2 accepted; afterStop survivors handed to s4 (coordinator decision; slice-verifier V1).**
  - **Accepted identity:** candidate `3f80587` on `ab56351` (p4-s1, same patch as `8f7e883`) over main `73bacf3`. Slice-verifier round 1 of 1, no violation. Pins 210/210; bindings 1-3 red as predicted; `check:mutation-ranges` exit 0; `pnpm check` 3830/3830; CodeScene 10.
  - **V1, for s4:** every bridge now gets `afterStop = keepCore`, so the call to `afterStop()` (entry:221, storage:148, workspace:254) and the `if (stopped) return` guard (entry:217, storage:144, workspace:248) are no longer observable; about 6 desktop-s7 survivors and 2 in the whole-file `workspace-bridge.ts` are expected. s4's contract removes `afterStop` and its "Settle first" comments (entry:219, storage:146, workspace:250), and either drops the re-entry guard or keeps it with a row that observes it. Any survivor left at the final mutation run is triaged there. No scoped Stryker run now (proportional; s4 changes these lines).
  - **Corrections for later slices:** the desktop main tests run with `--config vitest.main.config.ts` (the Success Criteria command omits it). Current ranges: desktop-s7 entry 78-224, storage 30-151, workspace 93-257; `stryker.config.json` entry-bridge 101-101 and 187-200; the s4/s6 Deferred Work rows and the Stryker table cite the old ones.

- **2026-10-31: p4-s3 detailed (coordinator instruction); Q12 open.**
  - **Base:** candidate `3f80587` on `fix/arch-review-phase-4`. The coordinator's corrections are folded in: desktop main tests run with `--config vitest.main.config.ts`, and the ranges are desktop-s7 entry 78-224, storage 30-151, workspace 93-257, and `stryker.config.json` entry-bridge 101-101 and 187-200. This slice moves none of them.
  - **Q12 (for Pedro), where the one harness-row map comes from:** (a) `@slopstop/protocol` exports `harnessFailureRows` (recommended; it also settles s6's D2); (b) the desktop owner builds it from the conversation table; (c) keep both maps (does not meet L1-03 part 1). The contract is written on (a); the slice section says what (b) drops.
  - **Red:** P4-B6 (the protocol export) and P4-B7 (the owner) are genuinely red, because the import fails. P4-B8 pins every upgrade and conversation answer. Bindings 1 to 3 prove that the save mapper, the upgrade mapper and the protocol table each read the owner.
  - **Lane:** normal (`lane.mjs --paths`: files 9 > 5). The label is recorded on approval.
  - **For s4:** its contract takes V1. It removes `afterStop` and its "Settle first" comments, and either drops the re-entry guard or keeps it with a row that observes it.
- **2026-10-31: Q12 decided (a); p4-s3 contract approved (Pedro; coordinator).** Pedro chose (a): `@slopstop/protocol` exports the frozen `harnessFailureRows` table, read by both desktop mappers and later by s6. Pedro approved hash `e1e4976b776b…73a0`; approved copy `approved-e1e4976b.md`.
- **2026-11-01: p4-s3 accepted (coordinator; lane normal).**
  - **Accepted identity:** `e94fd75` plus the polish commit `87f09e8`, on `ab33543` (p4-s2) over main `a0ca406`. `pnpm check` 3858/3858; preflight clean; slice-verifier round 1 of 1 passed, no finding. The polish (coordinator-reviewed, no second verifier round): `harnessFailureRows` now `satisfies Record<HarnessFailureCode, DiagnosticRow>`; the `projectUpgradeFailure` TSDoc names not-sent. Gates on it: both typechecks, Biome, 25/25 and 128/128, knip, mutation ranges, CodeScene 10.
  - **P4-B6 Expected red, observed:** not every row failed on the missing export: the frozen row passed on `undefined` (`Object.isFrozen(undefined)` is true). It got its own red by exporting the table unfrozen first (1 failed). Recorded in the TDD evidence.
  - **For s6:** the `harness-failure-protocol.ts` TSDoc says "both desktop mappers"; s6 rewrites it when activation and switch become readers.
- **2026-11-01: p4-s4 detailed (coordinator instruction); Q13 open.**
  - **Base:** candidate `87f09e8` on `fix/arch-review-phase-4`. Ranges re-measured there: desktop-s7 entry 78-224, storage 30-151, workspace 93-257; `stryker.config.json` entry-bridge 101-101 and 187-200 (`check:mutation-ranges` exit 0, `p4-s3-polish-mutation-ranges.log`).
  - **V1 taken:** `afterStop`, `keepCore` and the "Settle first" comments go. The re-entry guard is dropped, not kept: after `afterStop` goes, every step of `stop()` is idempotent, so no row can observe the guard (its mutants are equivalent).
  - **Q13 (for Pedro), reopening Q5's premise:** Q5 (a) said the storage and workspace bridges already answer an invalid request with the `desktop invalid-command` envelope. A static read at `87f09e8` shows they do not: their broken answers echo the request and decode it strictly, so an invalid request rejects (running) or throws (stopped). The envelope rows in their tests come from invalid metadata. An envelope for an invalid request needs a wire change. Options: (a) one fixed rejection, `Invalid <bridge> request.`, in every bridge (recommended); (b) a request-free `invalid-request` arm on the wire; (c) keep each bridge's behaviour. The contract is written on (a).
  - **Red:** P4-B9 (invalid request, 22 rows) and P4-B10 (workspace echo baseline) are red at `87f09e8`. P4-B11 pins every other bridge answer, including the `8a0658d` rows. Bindings 1 to 3 prove the echo baseline, the stopped guard and their order live in the skeleton.
  - **Lane:** normal (`lane.mjs --paths`: files 8 > 5). The label is recorded on approval.
- **2026-11-01: Q13 decided (a); p4-s4 contract approved; no s4 e2e run (Pedro; coordinator).** Pedro chose (a): an invalid request is a caller defect; every bridge, running or stopped, rejects with the fixed `Invalid <bridge> request.` text, no synchronous throw, nothing sent, none of the input. This replaces Q5 (a)'s premise. Pedro approved hash `f224f3addd8f…0b02`; approved copy `approved-f224f3ad.md`. Pedro chose no e2e run on the s4 candidate: s6's own e2e and the final check:deep cover it.

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
- `p4-s1-harness-failure-row-owner`: accepted at `8f7e883` (base `2c0014d`, same code as `5570258`); preflight-2 clean; slice-verifier round 1 passed.
- `p4-s2-bridge-test-composition`: `.rpiv/artifacts/evidence/2026-10-31_p4-s2-bridge-test-composition-tdd.md`; accepted at `3f80587`; preflight clean; slice-verifier round 1 passed.
- `p4-s3-fault-meaning-owner`: `.rpiv/artifacts/evidence/2026-10-31_p4-s3-fault-meaning-owner-tdd.md`; accepted at `e94fd75` + `87f09e8`; preflight clean; slice-verifier round 1 passed.
