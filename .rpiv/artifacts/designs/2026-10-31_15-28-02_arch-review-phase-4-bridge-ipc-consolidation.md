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
last_updated: 2026-11-12T21:00:00+0000
last_updated_by: Pedro Mesquita
last_updated_note: "p4-s10 folded on Q19 (b), Q20 (a), Q21 (a): P4-B33 to P4-B38, bindings 1-6; awaiting approval of this hash."
content_hash: d861a935fb446baf55a04bd1e1842794ed72e73d98be79adfbe893f3a2f2e03f
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

### Slice p4-s5-bridge-fault-text

- **`slice_id`:** `p4-s5-bridge-fault-text`.
- **Lane:** normal. `lane.mjs --paths` over the planned paths answers fast (within fast limits), raised to the feature lane.
- **Finding:** L1-02, plus the rest of L1-12's structure (Q8 (a)). One fault-text function in the core; the storage and workspace bridges pass only their noun, their stopped text and their echo text. No text changes.
- **Base:** candidate `603298b` (p4-s4 accepted, on branch `fix/arch-review-phase-4`). Every line number below is read at `603298b`.
- **Measured at `603298b`:**
  - `project-storage-bridge.ts:30-61`: `stoppedText`, `desktopText`, `protocolText` and `faultText`, a `Match` over the seven fault kinds.
  - `workspace-bridge.ts:108-139`: `desktopText`, `protocolText` and `faultText(fault, echo)`, the same `Match` without the `stopped` arm (a stopped request answers the closing envelope, `:190`, `:208`).
  - Shared arm for arm, character for character: `transport` (`bridgeNeutralText.transport`), `protocol` `invalid-message` and `system-failure` (`bridgeNeutralText.protocol`), `harness` (the row's own message), `send` (`harnessSendFailureMessage`), `desktop` `invalid-command` (`harnessSendFailureMessage` for `HARNESS_SESSION_MESSAGE_INVALID`) and `identity-collision` (`bridgeNeutralText.desktop`).
  - Templated on the bridge's noun (`Project Storage`, `workspace`): `uncorrelated` "Harness returned an uncorrelated <noun> response.", `undecodable` "Harness returned an invalid <noun> response.", `mismatched-event` "Harness returned a mismatched <noun> response."
  - Per bridge, by design (S7-R14, P-S7-2 (a)): the stopped text (storage "Project Storage bridge is stopped." for `unsent` and `stopped`; workspace "Workspace bridge is stopped." for `unsent` only) and the mismatched-echo text (storage "Harness returned a mismatched Project Storage request."; workspace one per operation, query and capability, `:190`, `:208`).
  - `bridgeNeutralText` (`harness-request-core.ts:35-46`) is read only by these two bridges. The entry bridge has no fault text (each operation maps faults itself) and is not touched.
  - Stryker runs with `ignoreStatic: true`, so a text built in a module-load constant is not mutated. The workspace stopped text sits inside its arm on purpose (`workspace-bridge.ts:134` comment).
- **Deliverable:**
  - `harness-request-core.ts` exports `bridgeFaultText(fault, texts)`, with `texts` = `{ noun, stopped, echo }`. It owns every arm above: the shared texts, the three noun templates, `texts.stopped` for `unsent` and `stopped`, and `texts.echo` for `mismatched-echo`. Each text is built inside the function, never in a module-load constant.
  - `bridgeNeutralText` folds into it and is no longer exported. `harnessSendFailureMessage` is imported by the core instead of the two bridges.
  - `project-storage-bridge.ts` deletes `desktopText`, `protocolText` and `faultText`; its broken answer calls `bridgeFaultText(fault, { noun: "Project Storage", stopped: stoppedText, echo: "Harness returned a mismatched Project Storage request." })`.
  - `workspace-bridge.ts` deletes `desktopText`, `protocolText` and `faultText`; its two broken answers call `bridgeFaultText` with noun `workspace`, the stopped text inline and their own echo text. The `stopped` fault still answers the closing envelope before any text is asked for.
- **Non-goals:** no text changes, no new code or diagnostic. The entry bridge, `harness-bridges.ts`, the IPC files and `desktop-runtime.ts` are not edited, so the "latched stop" rewording (p4-s4 acceptance) stays for the next slice that touches `desktop-runtime.ts`. `ProjectRequestFault` is unchanged.
- **Message and code ledger:** nothing added, removed or changed.
- **Affected paths:**
  - `apps/desktop/src/main/harness-request-core.ts`, `harness-request-core.test.ts`;
  - `apps/desktop/src/main/project-storage-bridge.ts`, `workspace-bridge.ts`;
  - `stryker.desktop-s7.config.json`, `stryker-range-anchors.json`.
- **Stryker re-anchoring (lesson 3, same slice).** `pnpm check:mutation-ranges` on the candidate is the authority; it answered exit 0 at `603298b` (`p4-s4-v1-mutation-ranges.log`: `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files).

  | Config | Entry now (`603298b`) | After | Anchor row |
  |---|---|---|---|
  | `stryker.desktop-s7.config.json` | `project-storage-bridge.ts:30-131` | re-pointed from `const stoppedText` (kept) to the file's last line | `stryker-range-anchors.json:202` (line numbers only; texts unchanged) |
  | `stryker.desktop-s7.config.json` | `workspace-bridge.ts:93-229` | re-pointed from `const closingDiagnostic` to the file's last line | `:208` |
  | `stryker.desktop-s7.config.json`, `stryker.config.json` | `harness-request-core.ts` (whole file) | unchanged; `bridgeFaultText` lands in it | none |
  | `stryker.config.json` | `workspace-bridge.ts` (whole file) | unchanged | none |
  | `stryker.config.json` | `project-entry-bridge.ts:165-180`; `desktop-s7` `project-entry-bridge.ts:75-194` | unchanged (the file is not edited) | none |

  - Counts do not change, so the real-repository row (`check-stryker-ranges.test.mjs:446`, `:449`) is not edited.
  - `vitest.desktop-s7-mutation.config.ts` already names the core test and both bridge tests.
- **Full-integration exposure:** texts only, and none changes.
  - e2e: the journeys that show a storage or workspace fault text (`conversation.test.ts`, `conversation-accessibility.test.ts`, `projects.test.ts`); their fault paths are proven by the unit rows only.
  - `package:launch-smoke` (the storage bridge).
  - Default: one run of each at the Phase 4 final `check:deep`; no run on this candidate.
- **Dependencies:** after s4 (accepted). Phase 4 then leaves the bridges for the IPC slices (s6 to s9).

#### Test Contract: p4-s5-bridge-fault-text

Public seam: `bridgeFaultText` from `harness-request-core.ts`; the answers of the storage and workspace bridge clients built through `createHarnessBridges`.

- **Behavior P4-B12: one function names every request fault in a bridge's own words.**
  - Test: `names every request fault in the bridge's words: %s` in `apps/desktop/src/main/harness-request-core.test.ts`, through `bridgeFaultText` with the texts `{ noun: "Sample", stopped: "Sample stopped.", echo: "Sample echo." }`.
  - Rows, one per fault value (17), each `toBe` the exact text:
    - `transport` → "Harness session disconnected.";
    - `protocol` `invalid-message` → "Harness session received an invalid protocol message."; `system-failure` → "Harness reported a failure."; `uncorrelated` → "Harness returned an uncorrelated Sample response."; `undecodable` → "Harness returned an invalid Sample response.";
    - `harness` with each `HarnessFailureCode` and a marker message → that marker;
    - `send` `HARNESS_SESSION_UNAVAILABLE` → "Harness session is unavailable."; `HARNESS_SESSION_MESSAGE_INVALID` → "Desktop created an invalid harness message."; `HARNESS_SESSION_SEND_FAILED` → "Harness session send failed.";
    - `unsent` and `stopped` → "Sample stopped.";
    - `desktop` `invalid-command` → "Desktop created an invalid harness message."; `identity-collision` → "Harness request identity collided."; `mismatched-event` → "Harness returned a mismatched Sample response."; `mismatched-echo` → "Sample echo."
  - Expected red: `bridgeFaultText` is not exported from `harness-request-core.ts`; the call is not a function, and every row fails.
- **Behavior P4-B13: every storage and workspace fault answer keeps its text.**
  - Test: `maps %s to a Storage transport failure` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `rejects mismatched, uncorrelated, disconnected, and stopped requests` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `fails pending operations once for $type` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `rejects invalid local metadata and identity collision without losing the original` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `fails all pending work as protocol on $case` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `settles an undecodable reply as protocol` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `request failure settles only its correlated Project Storage operation` in `apps/desktop/src/main/project-storage-bridge.test.ts`; `maps %s without blaming producers` in `apps/desktop/src/main/workspace-bridge.test.ts`; `fails all pending work on %s` in `apps/desktop/src/main/workspace-bridge.test.ts`; `rejects invalid response correlation` in `apps/desktop/src/main/workspace-bridge.test.ts`; `rejects invalid locally generated command metadata before send` in `apps/desktop/src/main/workspace-bridge.test.ts`; `answers its own envelope when send throws` in `apps/desktop/src/main/workspace-bridge.test.ts`; `settles an undecodable reply as protocol` in `apps/desktop/src/main/workspace-bridge.test.ts`; `answers the stopped text for a request made after stop` in `apps/desktop/src/main/workspace-bridge.test.ts`; `answers the closing envelope for work in flight at stop: $operation` in `apps/desktop/src/main/workspace-bridge.test.ts`; `request failure settles only its correlated Workspace request` in `apps/desktop/src/main/workspace-bridge.test.ts`; `apps/desktop/src/main/harness-bridges.test.ts`.
  - Expected red: none — pin. Both bridge test files and `harness-bridges.test.ts` are unedited and green before (`603298b`) and after, with the same row counts. A pin behavior is not re-proved.

**Bindings that bite (each on the candidate, each restored after):**
1. In `bridgeFaultText`, build the `uncorrelated` text without the noun ("Harness returned an uncorrelated response."). The P4-B12 row fails, and so do the storage pins `rejects mismatched, uncorrelated, disconnected, and stopped requests` and `fails all pending work as protocol on $case` (their uncorrelated rows) and the workspace pin `rejects invalid response correlation` (its uncorrelated reply). This proves both bridges read the owner's template.
2. In `bridgeFaultText`, answer `unsent` with `texts.echo`. The P4-B12 `unsent` row fails, and so do the storage pin `rejects mismatched, uncorrelated, disconnected, and stopped requests` (open after stop) and the workspace pin `answers the stopped text for a request made after stop`. This proves both bridges pass their stopped text to the owner.
3. In `bridgeFaultText`, change the `transport` text. The P4-B12 row fails, and so does the storage pin `rejects mismatched, uncorrelated, disconnected, and stopped requests` (disconnected) and the workspace pin `fails all pending work on %s` (disconnect row). This proves the shared arms live only in the owner.

**Structural checks (on the candidate):**
- `rg -n "Match|faultText\b|desktopText|protocolText|bridgeNeutralText|harnessSendFailureMessage" apps/desktop/src/main/project-storage-bridge.ts apps/desktop/src/main/workspace-bridge.ts`: nothing.
- `rg -n "bridgeNeutralText" apps/desktop/src --glob "!harness-request-core.ts"`: nothing; `rg -n "export const bridgeNeutralText" apps/desktop/src`: nothing.
- `rg -n "export function bridgeFaultText" apps/desktop/src/main/harness-request-core.ts`: one line.
- `git diff 603298b --stat` lists only the affected paths and this brief's evidence.

#### Success Criteria: p4-s5-bridge-fault-text

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `603298b` with row counts recorded (the P4-B13 baseline): `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/project-storage-bridge.test.ts src/main/workspace-bridge.test.ts src/main/harness-bridges.test.ts`.
- Red then green: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/harness-request-core.test.ts`.
- The P4-B13 command green after, with the same row counts.
- Each binding (1 to 3) observed red and then restored.
- `pnpm check:mutation-ranges` exit 0.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). `pnpm check:dead-code` (Knip) exit 0; `pnpm check:duplicates` finds no clone between the two bridges' text tables.
- CodeScene 10 on the core, both bridges and the core test.
- Mutation: none for this slice; `bridgeFaultText` is in the whole-file core entry of the final Phase 4 mutation run.

Manual: none.

### Slice p4-s6-activation-switch-broken

- **`slice_id`:** `p4-s6-activation-switch-broken`.
- **Lane:** rigorous (Q6 (a): s6 changes the wire). `lane.mjs --paths` over the planned paths answers normal (files 11 > 5; weak sensitive word `schema`); Q6 raises it. An intent review runs before approval, and Pedro accepts the candidate.
- **Finding:** L1-03 part 2, on Q1 (a) and Q12 (a). Activation and switch answer a malformed reply, a defect or a harness failure as **broken** with a harness failure row, read from `harnessFailureRows`. Only a request that was not sent, or was sent and then lost, stays unavailable. `protocolVersion` goes 9 → 10.
- **Base:** `d885c9b` (p4-s5 accepted at `bb61356` plus its polish `d885c9b`, on `fix/arch-review-phase-4`). The polish touches only `workspace-bridge.ts` and its range, no s6 path. Line numbers below were read at `bb61356` and are the same at `d885c9b` for every s6 path; the Stryker rows were re-read at `d885c9b`.
- **Measured at `bb61356`:**
  - `project-entry-bridge.ts:44-72`: `unavailable` builds `PROJECT_COORDINATOR_UNAVAILABLE` with `projectAvailabilityMessages.connectionLost`. `projectActivationUnavailable` (`unavailable`, retryable `true`) and `projectSwitchUnavailable` (`coordinator-unavailable`, retryable `false`) are the `broken` answers of `activate` (`:147`) and `switchProject` (`:155`) for **every** fault. The `:44` comment says so.
  - `project-entry-ipc.ts:48`, `:53` use the same two answers at the closed IPC gate. They stay: a closing gate sends nothing.
  - `request-fault-meaning.ts` `faultMeaning`: `unsent` and `send` (other than `HARNESS_SESSION_MESSAGE_INVALID`) are not-sent; `transport` and `stopped` are sent-then-lost; `protocol` is malformed-reply; `desktop` and a send refused as invalid are defect; `harness` keeps its code. `project-upgrade-failure.ts` maps them: harness → broken with `harnessFailureRows[code]`; not-sent and sent-then-lost → unavailable; everything else → broken with the protocol-invalid row.
  - **The "protocol-invalid row" of Q1 is a harness row.** `projectUpgradeDiagnostics.protocolMessageInvalid` and `projectConversationDiagnostics.protocolMessageInvalid` are both `harnessFailureRow("PROTOCOL_MESSAGE_INVALID")` (`project-upgrade-protocol.ts:63`, `project-conversation-protocol.ts:78`), which equals `harnessFailureRows.PROTOCOL_MESSAGE_INVALID`. So Q1's "three harness rows and the protocol-invalid row" are three distinct rows.
  - `canonical-project-protocol.ts:241-247`: the activation `broken` arm is `diagnosticSchema(Schema.Literals(codes), Schema.Boolean)`: listed codes, any non-empty message, any retryability. The codes come from `canonicalProjectActivationDiagnosticCodes` (`:154-163`).
  - That code tuple is also the harness fatal-log vocabulary: `CanonicalProjectActivationDiagnosticCodeSchema` is read by `harness-fatal-log-protocol.ts:58` and by `process-fatal-diagnostics.ts:87` (`isReleaseCode`). Adding the harness codes to it would widen the fatal log and make `isReleaseCode` accept them. So the harness rows join the `broken` arm as exact rows, never as codes in that tuple.
  - `canonical-project-protocol.ts:412-437`: the switch result has `target-result` (whose `target` is a whole `CanonicalProjectActivationResultSchema`), four `switchOutcomeSchema` arms (`inactive`, `project-mismatch`, `stale-activation`, `coordinator-unavailable`) and `release-failed`. It has no `broken`.
  - `harness-failure-protocol.ts` owns `harnessFailureRow`, `harnessFailureRows` (TSDoc: "the one table both desktop mappers read") and `exactRowSchema`. The last two are package-internal except `harnessFailureRows` (`index.ts:73`).
  - Renderer: `projects-workspace.tsx:98-123` shows `code: message` for any activation result with a diagnostic; `:138-161` shows `diagnostic.message` and clears the view for every switch status but `target-result` and `release-failed`. A new switch `broken` lands in that branch, as `coordinator-unavailable` does today for the same faults, so no renderer branch changes.
  - **Version literal `9`** (`rg -n "protocolVersion\"?\s*[:=]\s*9\b|\b9 as const" apps packages`): 12 files. `protocol.ts:87` is the constant. The 11 pins are: protocol tests `protocol.test.ts` (9 sites: `:235`, `:270`, `:295`, `:345`, `:351`, `:659`, `:713`, `:732`, `:1008`), `canonical-writer-smoke-protocol.test.ts:224`, `schema-boundary-characterization.test.ts:67`, `project-conversation-protocol.test.ts:12`; harness unit `harness-runtime.test.ts` (10 sites); harness integration `canonical-project-activation.integration.test.ts:299`, `harness-runtime.integration.test.ts` (3 sites), and the fixtures `canonical-writer-recovery-runtime-fixture.ts` (2), `conformance-counter-command.ts:99`, `project-storage-create-fixture.ts:597`; desktop `canonical-writer-package-smoke-test-peers.ts:73`. No e2e file, smoke script or doc pins it. ADR 0023 names version 9 as history and is not edited.
  - **Version forms the literal regex misses** (intent review V2): `protocol.test.ts` also holds four `expect(protocolVersion).toBe(9)` (`:342`, `:358`, `:518`, `:1047`; `:1047` sits in `encodes and decodes the upgrade request and result strictly`) and four titles that name a version (`:293` "parses only correctly scoped failure events at protocol version 9", `:339` and `:357` "… under protocol version 9", `:500` "refuses a version-8 peer as an unsupported version"). `rg -n "toBe\(9\)|protocol version 9" apps packages` finds nothing else that pins the version (`canonical-project-settlement.integration.test.ts:358` `toBe(9)` is a counter value).
  - `project-entry-bridge.test.ts:335` (`keeps the activation result unchanged on %s`) and `:348` (`keeps the switch result unchanged on %s`) pin today's flattening over three faults: a harness `request.failure`, a session protocol error and a wrong-event reply. All three become broken.
  - A third test pins it (intent review V1): `project-entry-bridge.test.ts:102-119`, `rejects activation replies for a different Project even with a matching message correlation`, asserts `toMatchObject({ status: "unavailable", request })` for an echo mismatch (`desktop` `mismatched-echo`, a defect), which becomes broken.
  - Reading `faultMeaning` and classifying by `fault.kind` differ on one fault only: a send refused as `HARNESS_SESSION_MESSAGE_INVALID` (`request-fault-meaning.ts:29`: defect, not not-sent). `ScriptedHarnessSession.sendResult` produces it through the bridge.
- **Deliverable:**
  - **Wire (`canonical-project-protocol.ts`).** The activation `broken` arm's `diagnostic` becomes a union of today's diagnostic (same codes, message and retryability) and the three exact rows `exactRowSchema(harnessFailureRows[code])`. The switch result gains `{ status: "broken", request: CanonicalProjectSwitchRequestSchema, diagnostic: <the same three exact rows> }`. `canonicalProjectActivationDiagnosticCodes` does not change. Because `target-result.target` is the activation schema, a switch `target-result` whose target is a broken activation with a harness row is also accepted at version 10; P4-B15 pins it on purpose. The module imports `exactRowSchema` and `harnessFailureRows` from `harness-failure-protocol.ts` (package-internal). Nothing new is exported from `index.ts`.
  - **Version (`protocol.ts`).** `protocolVersion = 10 as const`. The 11 pins move their literal from `9` to `10`, and the four `expect(protocolVersion).toBe(9)` move to `toBe(10)`, with no other assertion change (precedent: Phase 2 moved `8` to `9` this way). The four `protocol.test.ts` titles that name a version are renamed (see P4-B16).
  - **Desktop (`project-entry-bridge.ts`).** Two module-private mappers beside the unavailable answers, `projectActivationFailure(request, fault)` and `projectSwitchFailure(request, fault)`, read `faultMeaning`:
    - `harness` → `{ status: "broken", request, diagnostic: harnessFailureRows[code] }`;
    - not-sent or sent-then-lost → today's answer (`projectActivationUnavailable(request)`, `projectSwitchUnavailable(request)`), unchanged;
    - malformed-reply or defect → `{ status: "broken", request, diagnostic: harnessFailureRows.PROTOCOL_MESSAGE_INVALID }`.

    `activate` and `switchProject` take them as their `broken` answers. The `:44` comment is rewritten: the coordinator-unavailable answer is for the closed IPC gate and for a request that was not sent or was lost. `projectActivationUnavailable` and `projectSwitchUnavailable` keep their names, exports and values.
  - **TSDoc (`harness-failure-protocol.ts`).** `harnessFailureRows` is "the one table every desktop fault mapper reads: upgrade, conversation, activation and switch". No code change there.
  - **Tests.** `project-entry-bridge.test.ts` deletes the two `keeps the … result unchanged on %s` tests; their three faults move into the P4-B14 table with the broken answer. It also deletes `rejects activation replies for a different Project even with a matching message correlation` (`:102-119`): the P4-B14 `activate` row "a reply for another Project" covers the same fault with a whole-answer `toEqual`.
- **Non-goals:** no renderer, preload or IPC change (`project-entry-ipc.ts` is not edited, so the `desktop-s6` single-line entries do not move). No change to the upgrade or conversation answers, to `faultMeaning`, or to the fatal-log code vocabulary. The harness never sends a switch `broken`, an activation harness row, or a `target-result` whose target carries one; the wire allows them, and nothing produces them. No shared mapper owner for upgrade, activation and switch: `project-upgrade-failure.ts` is not edited (intent review suggestion; the refactor gate takes it if `pnpm check:duplicates` reports a clone). `desktop-runtime.ts` is not touched, so the "latched stop" rewording (p4-s4 acceptance) stays for the slice that next touches it.
- **Message and code ledger:** no new code or message. The activation `broken` arm and the new switch `broken` status carry the three existing harness rows (`PROTOCOL_MESSAGE_INVALID`, `PROTOCOL_VERSION_UNSUPPORTED`, `HARNESS_INTERNAL_FAILURE`, each with its `harnessFailureMessages` text and `retryable: false`).
- **Affected paths:**
  - `packages/protocol/src/canonical-project-protocol.ts`, `canonical-project-protocol.test.ts`, `protocol.ts`, `protocol.test.ts`, `harness-failure-protocol.ts`;
  - `apps/desktop/src/main/project-entry-bridge.ts`, `project-entry-bridge.test.ts`;
  - the other 10 version pins listed above;
  - `stryker.desktop-s7.config.json`, `stryker.config.json`, `stryker-range-anchors.json`.
- **Stryker re-anchoring (lesson 3, same slice).** `pnpm check:mutation-ranges` on the candidate is the authority, red-first as in p3-s7.

  | Config | Entry now (`d885c9b`) | After | Anchor row |
  |---|---|---|---|
  | `stryker.desktop-s7.config.json` | `project-entry-bridge.ts:75-194` (from `export const unsent`) | starts at the first new mapper, ends at the closing line of `projectEntryBridgeOver`, so both mappers are mutated | `stryker-range-anchors.json:196` (start text changes) |
  | `stryker.config.json` | `project-entry-bridge.ts:165-180` (`readConversation`, `saveConversationMessage`) | the same two operations, shifted by the mappers' lines | `:58` (line numbers only) |
  | `stryker.config.json` | `protocol.ts`, `harness-failure-protocol.ts` (whole files) | unchanged | none |
  | none | `canonical-project-protocol.ts` | not added: it holds schema definitions built at module load, which `ignoreStatic` never mutates; the P4-B15 rows guard it | none |

  - Counts do not change, so the real-repository rows (`check-stryker-ranges.test.mjs:446`, `:449`) are not edited.
  - `vitest.desktop-s7-mutation.config.ts` already names `project-entry-bridge.test.ts`.
- **Full-integration exposure:**
  - **Every handshake carries the version.** Every e2e journey (`projects`, `registration`, `conversation`, `conversation-accessibility`, `project-upgrade`, `shell`, `renderer-foundation`, `single-instance`) launches the real harness at version 10. A missed pin breaks the launch.
  - **Activation and switch through the real wire:** e2e `projects.test.ts`.
  - **Harness integration:** `canonical-project-activation.integration.test.ts`, `harness-runtime.integration.test.ts`, and every integration file that builds its messages through the three edited fixtures (`project-storage-create-fixture.ts` alone serves the storage, switch and lifecycle files). So the whole harness `test:integration` is exposed.
  - **Smokes:** `package:launch-smoke` (the packaged handshake). The writer-proof peers (`canonical-writer-package-smoke-test-peers.ts`) are read by unit tests only.
  - **The run s6 asks for (Phase 4 approval: "the wire version (s6) asks for its own e2e run"):** on the candidate, after `pnpm check`, with the coordinator's GO, one run each of `pnpm test:e2e`, the harness `test:integration` and `package:launch-smoke`. Its scope is Q14.
- **Dependencies:** after s5 (accepted) and s3 (`faultMeaning`, `harnessFailureRows`). s7 to s9 do not depend on it.

#### Test Contract: p4-s6-activation-switch-broken

Public seams: the project-entry bridge built through `createHarnessBridges` (its `activate` and `switchProject` answers); `CanonicalProjectActivationResultSchema` and `CanonicalProjectSwitchResultSchema` through `decodeStrict`; `protocolVersion`, `parseHarnessMessage` and `parseDesktopMessage` from `@slopstop/protocol`.

- **Behavior P4-B14: activation and switch answer a malformed reply, a defect or a harness failure as broken with its harness row.**
  - Test: `answers a broken %s with its harness row: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`, one row per operation (`activate`, `switchProject`) and fault.
  - Rows (each `toEqual` the whole answer, `request` being the call's validated request):
    - `request.failure` with `HARNESS_INTERNAL_FAILURE`, `PROTOCOL_MESSAGE_INVALID` and `PROTOCOL_VERSION_UNSUPPORTED`, each sent with a message that is not the protocol text → `{ status: "broken", request, diagnostic: harnessFailureRows[code] }` (the row's own message, not the sent one);
    - a session protocol error (an invalid payload on the reply event, a `protocol` `invalid-message` fault), a wrong-event reply, a reply for another Project (the echo), an invalid local message id, and a send refused as `HARNESS_SESSION_MESSAGE_INVALID` (through `ScriptedHarnessSession` with `sendResult = { ok: false, error: { code: "HARNESS_SESSION_MESSAGE_INVALID" } }`) → `{ status: "broken", request, diagnostic: harnessFailureRows.PROTOCOL_MESSAGE_INVALID }`;
    - each row also asserts that `decodeStrict` of the answer through its result schema (`CanonicalProjectActivationResultSchema` or `CanonicalProjectSwitchResultSchema`, the schemas the preload decodes with) equals the answer.
  - Expected red: at the base every row answers `unavailable` (activation) or `coordinator-unavailable` (switch) with `PROJECT_COORDINATOR_UNAVAILABLE` and the connection-lost message, so all 16 rows fail.
- **Behavior P4-B15: the wire carries exactly the three harness rows in a broken activation and a broken switch.**
  - Test: `carries an exact harness row in a broken %s: %s` in `packages/protocol/src/canonical-project-protocol.test.ts`, one row per result (`activation`, `switch`) and `HarnessFailureCode` (6 rows).
  - Oracle, per row:
    - `decodeStrict` of `{ status: "broken", request, diagnostic: harnessFailureRows[code] }` equals its input;
    - the same result is rejected with the row's message changed, with `retryable: true`, and with an extra diagnostic key;
    - the exact row is rejected under any other status of the same result (activation `unavailable`; switch `coordinator-unavailable`);
    - switch rows only: a switch `broken` with today's activation broken diagnostic (`{ code: "PROJECT_STORAGE_BROKEN", message: "Project Storage activation failed.", retryable: false }`) and with the connection-lost `PROJECT_COORDINATOR_UNAVAILABLE` row is rejected: the switch arm holds only the three rows;
    - activation rows only: a switch `target-result` whose `target` is that broken activation decodes to its input (the nested acceptance the Deliverable states);
    - `Schema.is(CanonicalProjectActivationDiagnosticCodeSchema)(code)` is `false`: the fatal-log vocabulary does not grow.
  - Expected red: at the base the activation `broken` arm rejects every harness code and the switch result has no `broken` status, so the first assertion fails in all 6 rows.
- **Behavior P4-B16: the protocol is version 10, and a version-9 peer is refused.**
  - Test: `refuses a version-9 peer as an unsupported version` in `packages/protocol/src/protocol.test.ts`, renamed from `refuses a version-8 peer as an unsupported version`: `protocolVersion` is `10`, and a harness failure and a handshake at version `9` each answer `PROTOCOL_VERSION_UNSUPPORTED` with the `unsupported_value` issue on `protocolVersion`; `parses workspace commands and correlated result events under protocol version 10` in `packages/protocol/src/protocol.test.ts`, renamed from "… version 9", its literals moved to `10`; `round-trips Project Storage envelopes under protocol version 10` in `packages/protocol/src/protocol.test.ts`, renamed the same way; `parses only correctly scoped failure events at protocol version 10` in `packages/protocol/src/protocol.test.ts`, renamed from "… version 9", its literal moved to `10`; `encodes and decodes the upgrade request and result strictly` in `packages/protocol/src/protocol.test.ts`, its `:1047` `toBe(9)` moved to `toBe(10)`.
  - Expected red: at the base `protocolVersion` is `9`. Four tests fail at `expect(protocolVersion).toBe(10)`; `parses only correctly scoped failure events at protocol version 10` fails because its version-10 event is refused as `PROTOCOL_VERSION_UNSUPPORTED`.
- **Behavior P4-B17: every peer and fixture speaks version 10.**
  - Test: `packages/protocol/src/canonical-writer-smoke-protocol.test.ts`, `packages/protocol/src/schema-boundary-characterization.test.ts`, `packages/protocol/src/project-conversation-protocol.test.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`, `apps/harness/tests/integration/canonical-writer-recovery-runtime-fixture.ts`, `apps/harness/tests/integration/conformance-counter-command.ts`, `apps/harness/tests/integration/project-storage-create-fixture.ts` and `apps/desktop/src/main/canonical-writer-package-smoke-test-peers.ts`, each with its `protocolVersion: 9` literals moved to `10` and no other change.
  - Expected red: the literal move alone. Over the base source, a row that sends a version-10 envelope through the strict parser answers `PROTOCOL_VERSION_UNSUPPORTED`. These files are whole-file clauses, so validate checks that the slice changed them and does not re-prove a red. The integration files run in the harness `test:integration` (Q14).
- **Behavior P4-B18: every other activation, switch and closing answer is unchanged.**
  - Test: `keeps a %s unavailable when it was not sent or was lost: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts` (new): `activate` and `switchProject` × a call after stop, a send that fails, a lost connection while pending and a stop while pending → today's `unavailable` (retryable `true`) or `coordinator-unavailable` (retryable `false`) answer with `PROJECT_COORDINATOR_UNAVAILABLE` and the connection-lost message; `answers the closing envelope for work in flight at stop: $operation` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers every upgrade reply with one strict result: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers a conversation %s with one strict result: %s` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `answers its own decoded reply: $operation` in `apps/desktop/src/main/project-entry-bridge.test.ts`; `validates switch result branches and destination correlation` in `packages/protocol/src/canonical-project-protocol.test.ts`; `apps/desktop/src/main/project-entry-ipc.test.ts`; `apps/desktop/src/main/request-fault-meaning.test.ts`; `packages/protocol/src/harness-fatal-log-protocol.test.ts`; `apps/harness/src/process-fatal-diagnostics.test.ts`; `apps/desktop/src/renderer/app.test.tsx`.
  - Expected red: none — pin. The new `keeps a %s unavailable …` test is green at the base by design: it characterizes the answers s6 keeps, and binding 3 proves it bites. Every other named test and whole file is green at the base and after; the whole files are unedited, with the same row counts.

**Bindings that bite (each on the candidate, each restored after):**
1. In `projectActivationFailure`, answer a defect with `projectActivationUnavailable(request)`. The P4-B14 `activate` rows for the wrong-event reply, the reply for another Project and the invalid message id fail; the `switchProject` rows stay green. This proves the defect arm is per operation and read from `faultMeaning`.
2. In `projectSwitchFailure`, answer `harness` with `projectSwitchUnavailable(request)`. The three P4-B14 `switchProject` `request.failure` rows fail. This proves the switch carries the harness row.
3. In `projectSwitchFailure`, answer not-sent as broken with the protocol-invalid row. The P4-B18 rows `keeps a switchProject unavailable …: a call after stop` and `…: a send that fails` fail. This proves the kept-unavailable pin bites.
4. In `canonical-project-protocol.ts`, put the three harness codes into the activation `broken` arm's code list instead of the exact rows. The P4-B15 activation rows fail on the changed-message and `retryable: true` rejections (the free arm accepts them). This proves the arm holds exact rows. (`CanonicalProjectActivationDiagnosticCodeSchema` stays unchanged in this binding, so its assertion stays green; the exactness assertions catch it. The mutant breaks `activationFailureSchema`'s `CanonicalProjectActivationDiagnosticCode` type constraint, so it exists only under Vitest, which does not typecheck.)
5. In both mappers, classify by `fault.kind` instead of `faultMeaning` (every `send` as not-sent). The two P4-B14 rows for a send refused as `HARNESS_SESSION_MESSAGE_INVALID` fail. This proves the mappers read the owner, not a second fault table.
6. In `canonical-project-protocol.ts`, build the switch `broken` diagnostic from the activation broken union. The P4-B15 switch rows fail on the `PROJECT_STORAGE_BROKEN` rejection. This proves the switch arm holds only the three rows.
7. In `canonical-project-protocol.ts`, add the three harness codes to `canonicalProjectActivationDiagnosticCodes` while keeping the exact rows. All 6 P4-B15 rows fail on the `Schema.is` assertion. This proves the fatal-log guard bites.

**Structural checks (on the candidate):**
- `rg -n "keeps the (activation|switch) result unchanged|rejects activation replies for a different Project" apps/desktop/src`: nothing.
- `rg -n "protocolVersion\"?\s*[:=]\s*9\b|\b9 as const|protocolVersion\)\.toBe\(9\)|protocol version 9" apps packages`: only the version-9 peer in `refuses a version-9 peer as an unsupported version` (`protocol.test.ts`).
- `rg -n "both desktop mappers" packages apps`: nothing.
- `rg -n "harnessFailureRows" apps/desktop/src/main/project-entry-bridge.ts`: the import and the two mappers. `rg -n "faultMeaning\(" apps/desktop/src/main/project-entry-bridge.ts`: the two mappers.
- In `stryker-range-anchors.json`, the `stryker.desktop-s7.config.json` entry-bridge row's `first` text is the first mapper's declaration (`rg -n '"first": "function projectActivationFailure' stryker-range-anchors.json`: one hit), and the range starts at that line. `check:mutation-ranges` checks only anchor texts, so a range left at `export const unsent` would pass it while mutating neither mapper.
- `git diff <base> -- apps/desktop/src/main/project-entry-ipc.ts apps/desktop/src/renderer apps/desktop/src/preload packages/protocol/src/index.ts`: empty.
- `git diff <base> --stat` lists only the affected paths and this slice's evidence.

#### Success Criteria: p4-s6-activation-switch-broken

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `d885c9b`, with row counts recorded (the P4-B18 baseline): `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/project-entry-ipc.test.ts src/main/request-fault-meaning.test.ts`, `pnpm --filter @slopstop/protocol exec vitest run src/harness-fatal-log-protocol.test.ts`, `pnpm --filter @slopstop/harness exec vitest run src/process-fatal-diagnostics.test.ts`, and `pnpm --filter @slopstop/desktop exec vitest run src/renderer/app.test.tsx`.
- Red then green: `pnpm --filter @slopstop/protocol exec vitest run src/canonical-project-protocol.test.ts src/protocol.test.ts` (P4-B15, P4-B16) and `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/project-entry-bridge.test.ts` (P4-B14; P4-B18's new test green at both).
- The P4-B17 unit files green at the candidate: the three protocol test files and `pnpm --filter @slopstop/harness exec vitest run src/harness-runtime.test.ts`.
- Each binding (1 to 7) observed red and then restored.
- `pnpm check:mutation-ranges` exit 0.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). Knip exit 0; `pnpm check:duplicates` reports no clone between the three mappers.
- CodeScene 10 on `project-entry-bridge.ts`, `canonical-project-protocol.ts` and both test files.
- The run Q14 settles, with the coordinator's GO, each read by its real exit code: `pnpm test:e2e`, the harness `test:integration`, `package:launch-smoke`.
- Mutation: none for this slice; the mappers are in the `desktop-s7` entry-bridge range of the final Phase 4 mutation run.

Manual: none. Pedro accepts the candidate (rigorous lane).

### Slice p4-s7-workspace-ipc-module

- **`slice_id`:** `p4-s7-workspace-ipc-module`.
- **Lane:** normal by override (Q6 (a): a move under unchanged tests). `lane.mjs --paths` over the eleven planned paths answers rigorous (files: 8 > 5; sensitive word `ipc` in `workspace-ipc.ts` and its test); Q6 lowers it. No intent review. Pedro approves this contract; the coordinator accepts the candidate, and Pedro accepts the combined Phase 4 result.
- **Finding:** L1-10, narrowed by Q4 (a). `registerWorkspaceIpc` and `broadcastWorkspaceNotification` move out of the Electron entry into `workspace-ipc.ts`, beside `project-entry-ipc.ts`. `workspace-bridge.test.ts` stops importing `main.ts`. The depcruise rule `no-import-of-electron-entry` forbids every other import of `main.ts`, with `canonical-writer-package-smoke-main.test.ts` excluded by name.
- **Base:** `e2b1d48` (p4-s6 accepted at `b0a4cc3` + `7f43278` + `e2b1d48`, on `fix/arch-review-phase-4`). Every line below was read at `e2b1d48`.
- **Measured at `e2b1d48`:**
  - `main.ts` (494 lines) exports exactly two functions: `broadcastWorkspaceNotification` (`:264-271`) and `registerWorkspaceIpc` (`:273-288`). `bootstrap()` calls them at `:419` (`registerWorkspaceIpc(workspace.owner, desktopShutdown)`) and `:421` (`workspace.owner.subscribe(broadcastWorkspaceNotification)`). Only those two functions use the protocol imports `WorkspaceIntent`, `WorkspaceIntentSchema`, `WorkspaceNotification`, `WorkspaceNotificationSchema`, `WorkspaceQuery`, `WorkspaceQuerySchema` (`:9-14`) and the whole `./workspace-bridge.js` import (`:57-62`). `ipcMain` and `BrowserWindow` stay in use (`registerHarnessIpc`, `broadcastHarnessStatus`, the window code).
  - **`main.ts` importers** (`git grep` and `depcruise --include-only`): `workspace-bridge.test.ts:28` (static `import`) and `canonical-writer-package-smoke-main.test.ts:264` (`await import("./main.js")`, resolved by depcruise as `dynamic-import`). Nothing else.
  - `workspace-bridge.test.ts` (39 tests) imports `main.js` only for two tests: `keeps workspace IPC handlers narrow and validated` (`:921-973`, inside `describe("WorkspaceBridge")`) and `answers workspace unavailable after the IPC gate closes: $channel` (`:978-1014`, 2 rows). Five `vi.mock` calls (`electron`, `./crash-reporting.js`, `./harness-supervisor.js`, `./logger.js`, `./security.js`, `:41-58`) and the `mainMocks` hoist (`:35-39`, reset at `:285-286`) exist only to neutralise the entry's bootstrap and observe those two tests. No other import of the file reaches `electron` (`harness-bridges.ts`, `harness-request-core.ts`, `harness-session.ts`, `harness-session-test-peers.ts`, `workspace-bridge.ts`).
  - The two tests use the fixtures `id` (`:63-68`), `memoryQuery` (`:70-76`), `memoryIntent` (`:120-128`), `unavailableQueryResult` (`:167-176`) and `readyResult` (`:178`, only as the closed-gate fake's never-awaited answer). Copying the first four into a new file is about 35 lines, over `jscpd.json`'s `minLines: 10` / `minTokens: 60` with `threshold: 0`.
  - `canonical-writer-package-smoke-main.test.ts` (80 tests) loads the real `main.ts` with electron mocked (`ipcMain.handle`, `BrowserWindow.getAllWindows`) and drives `answers unavailable after quit starts: $channel` (`:764-800`), whose `queryWorkspace` row calls the registered handler after `before-quit` and expects the literal closing envelope. It is the one unit pin that `main.ts` still registers the workspace handlers behind `desktopShutdown`. The broadcast subscription (`:421`) has no unit pin; only the e2e notification paths reach it.
  - The closing answers `workspaceQueryClosing` / `workspaceIntentClosing` (`workspace-bridge.ts:91-104`, inside the `desktop-s7` range `workspace-bridge.ts:91-200`) are asserted with their literal text only by the two moved tests and by that smoke-main row. The other `workspace-bridge.test.ts` rows compare against the functions themselves.
  - `dependency-cruiser.config.cjs` has 8 `forbidden` rules and none names `main.ts`. `apps/harness/scripts/check-boundaries-parse.test.mjs` cruises a temp fixture through the real config (`cruiseFixture`) and asserts `{ rule, from, to }` violations. It runs from the repository root (`pnpm exec vitest run apps/harness/scripts/check-boundaries-parse.test.mjs`: 2 passed); through `pnpm --filter @slopstop/harness` it fails with `ENOENT … apps\harness\tsconfig.base.json`, a cwd artefact, not a red.
  - `pnpm check:mutation-ranges` at `e2b1d48`: exit 0; `stryker.desktop-s6.config.json` 14 ranges, 2 whole files. Its `main.ts` entries are `:94-104` (`stryker-range-anchors.json:166`), `:273-288` (`:178`, first `export function registerWorkspaceIpc(`, last `}`) and `:406-406` (`:184`).
  - `vitest.desktop-s6-mutation.config.ts` names `workspace-bridge.test.ts` only to reach `main.ts:273-288`. `vitest.desktop-s7-mutation.config.ts` names `workspace-bridge.test.ts` and `canonical-writer-package-smoke-main.test.ts`.
- **Deliverable:**
  - **`workspace-ipc.ts` (new).** It holds `broadcastWorkspaceNotification` and `registerWorkspaceIpc`, moved with their bodies and signatures unchanged, and the imports they need. It has one TSDoc in the style of `project-entry-ipc.ts`: each handler strictly decodes the renderer's value, and once the gate closes it answers the closing envelope without calling the bridge.
  - **`main.ts`.** Both functions and their now-unused imports go. It imports them from `./workspace-ipc.js`; `:419` and `:421` keep their calls. `main.ts` exports nothing.
  - **`workspace-test-peers.ts` (new), test-only.** `id`, `memoryQuery`, `memoryIntent` and `unavailableQueryResult` move there from `workspace-bridge.test.ts`, unchanged, beside `harness-session-test-peers.ts`. Both test files import them, so `pnpm check:duplicates` finds no clone.
  - **`workspace-ipc.test.ts` (new).** The two tests move here with their titles and assertions unchanged. One hoisted electron mock (`ipcMain.handle`, `BrowserWindow.getAllWindows`), reset before each test; no other `vi.mock`. The closed-gate fake bridge answers `unavailableQueryResult(memoryQuery())` instead of `readyResult(memoryQuery(), 1)`: it is never called (the test asserts that), so no assertion changes, and `readyResult` stays in `workspace-bridge.test.ts`.
  - **`workspace-bridge.test.ts`.** It loses the `main.js` import, the five `vi.mock` calls, the `mainMocks` hoist and its two resets, the two moved tests, the four moved fixtures (now imported) and the imports only they used. No remaining test body changes: 36 tests.
  - **`dependency-cruiser.config.cjs`.** A ninth rule: `{ name: "no-import-of-electron-entry", severity: "error", from: { pathNot: "^apps/desktop/src/main/canonical-writer-package-smoke-main\\.test\\.ts$" }, to: { path: "^apps/desktop/src/main/main\\.ts$" } }`, with a comment naming Q4 (a) and why the one test is excluded.
  - **Mutation configs.** `vitest.desktop-s6-mutation.config.ts` names `workspace-ipc.test.ts` in place of `workspace-bridge.test.ts`, which no longer reaches a `desktop-s6` entry. `vitest.desktop-s7-mutation.config.ts` adds `workspace-ipc.test.ts`, so the literal closing-answer rows still run against the `workspace-bridge.ts:91-200` mutants.
- **Non-goals:** no handler, gate or envelope change (s8 builds the helper, s9 the sender check). No change to `project-entry-ipc.ts`, `project-registration-ipc.ts`, the preload, the renderer or any channel. The smoke wiring stays in `main.ts` (Q4 (a); moving it is L2-01, Phase 6). `desktop-runtime.ts` is not touched, so the "latched stop" rewording (p4-s4 acceptance) stays for the slice that next touches it. No unit pin is added for the broadcast subscription; it is a call that stays in place.
- **Message and code ledger:** none. No text, code or channel changes.
- **Affected paths:**
  - `apps/desktop/src/main/main.ts`, `workspace-ipc.ts` (new), `workspace-ipc.test.ts` (new), `workspace-test-peers.ts` (new), `workspace-bridge.test.ts`;
  - `dependency-cruiser.config.cjs`, `apps/harness/scripts/check-boundaries-parse.test.mjs`;
  - `apps/desktop/vitest.desktop-s6-mutation.config.ts`, `apps/desktop/vitest.desktop-s7-mutation.config.ts`;
  - `stryker.desktop-s6.config.json`, `stryker-range-anchors.json`.
- **Stryker re-anchoring (lesson 3, same slice).** `pnpm check:mutation-ranges` on the candidate is the authority, red-first: after the move and before the re-point it fails on the three `main.ts` entries.

  | Config | Entry now (`e2b1d48`) | After | Anchor row |
  |---|---|---|---|
  | `stryker.desktop-s6.config.json` | `main.ts:273-288` (`registerWorkspaceIpc`) | `workspace-ipc.ts:<first>-<last>`, the same function from `export function registerWorkspaceIpc(` to its closing `}`; the same mutants | `stryker-range-anchors.json:178` (entry path and lines; anchor texts unchanged) |
  | `stryker.desktop-s6.config.json` | `main.ts:94-104` (shutdown services) | shifted up by the import lines `main.ts` loses | `:166` (line numbers only) |
  | `stryker.desktop-s6.config.json` | `main.ts:406-406` (the readiness gate) | shifted up by those lines and the 25 moved lines | `:184` (line numbers only) |

  - Counts do not change (14 ranges, 2 whole files), so the real-repository row (`check-stryker-ranges.test.mjs:448`) is not edited.
  - Not taken: a whole-file `workspace-ipc.ts` entry. It would add `broadcastWorkspaceNotification`'s mutants and edit the real-repository row; s8 reshapes the file around the helper and gives the helper its own entry.
- **Full-integration exposure:**
  - **In-process:** `canonical-writer-package-smoke-main.test.ts` loads the real `main.ts`, now with `workspace-ipc.ts` beneath it (unit run).
  - **e2e:** every journey registers the workspace handlers; `conversation.test.ts`, `conversation-accessibility.test.ts`, `projects.test.ts` and `renderer-foundation.test.ts` query the workspace, and the notification paths are the only proof of the broadcast subscription.
  - **Smoke:** `package:launch-smoke` (bundle chunk order, precedent `ff162f5`). `workspace-ipc.ts` imports only modules already in the main bundle (`electron`, `@slopstop/protocol`, `../shared/desktop-api.js`, `./workspace-bridge.js`): no native addon and no dynamic import. The `package-smoke-load-order` guard is not edited.
  - **Harness integration:** none.
  - **The run:** Q15.
- **Q15 (open, for Pedro): does s7 get its own run?**
  - (a) **Recommended.** No per-slice heavy run. The Phase 4 final `check:deep` carries `test:e2e` and `package:launch-smoke` once, as for s4 and s5. The move adds one static import of a module whose own imports are already bundled, and the in-process smoke-main test loads the real entry.
  - (b) One `package:launch-smoke` on the s7 candidate, with the coordinator's GO, because the Verification Notes name the chunk-order risk for s7.
- **Dependencies:** after s6 (accepted). s8 depends on it (the helper serves `workspace-ipc.ts`).

#### Test Contract: p4-s7-workspace-ipc-module

Public seams: the depcruise rule set through `cruise` with the real `dependency-cruiser.config.cjs` (the `cruiseFixture` of `check-boundaries-parse.test.mjs`); the workspace IPC handlers registered through `registerWorkspaceIpc` on a mocked `ipcMain.handle`, and `broadcastWorkspaceNotification` on mocked windows; the real `main.ts` loaded with mocked Electron (`canonical-writer-package-smoke-main.test.ts`).

- **Behavior P4-B19: no file may import the Electron entry.**
  - Test: `forbids importing the Electron entry: $name` in `apps/harness/scripts/check-boundaries-parse.test.mjs` (new).
  - Rows, over a fixture that also writes `apps/desktop/src/main/main.ts`:
    - a static import from a desktop main test (`apps/desktop/src/main/workspace-bridge.test.ts` importing `./main.ts`);
    - a dynamic `await import("./main.ts")` from another desktop main file (`apps/desktop/src/main/project-entry-ipc.test.ts`).
    - each row expects exactly `[{ rule: "no-import-of-electron-entry", from: <the importer>, to: "apps/desktop/src/main/main.ts" }]`.
  - Expected red: at the base the config has no such rule, so `violationsOf(output)` is `[]` and both rows fail.
- **Behavior P4-B20: only the smoke wiring test may import it.**
  - Test: `allows only the smoke wiring test to import the Electron entry` in `apps/harness/scripts/check-boundaries-parse.test.mjs` (new): `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` with `await import("./main.ts")` gives no violation, and the module graph contains `apps/desktop/src/main/main.ts`; `reports a forbidden TypeScript import: $name` in `apps/harness/scripts/check-boundaries-parse.test.mjs`, unedited.
  - Expected red: none — pin. The new test is green at the base by design (no rule yet); binding 2 proves it bites.
- **Behavior P4-B21: the workspace handlers and broadcast live in `workspace-ipc.ts`, with today's answers.**
  - Test: `apps/desktop/src/main/workspace-ipc.test.ts` (new): `keeps workspace IPC handlers narrow and validated` and `answers workspace unavailable after the IPC gate closes: $channel`, moved from `workspace-bridge.test.ts` with titles and assertions unchanged, importing from `./workspace-ipc.js`.
  - Expected red: at the base `./workspace-ipc.js` does not exist, so the file fails at import. It is a whole-file clause, so validate checks that the slice added it and does not re-prove a red.
- **Behavior P4-B22: the entry still wires the workspace handlers behind the shutdown gate.**
  - Test: `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`, unedited (80 tests; its `answers unavailable after quit starts: $channel` `queryWorkspace` row calls the handler `main.ts` registered and expects the literal closing envelope); `apps/desktop/src/main/project-entry-ipc.test.ts`, unedited.
  - Expected red: none — pin. Both files are green at the base and after, with the same row counts; binding 3 proves the smoke-main row bites on the wiring.

**Bindings that bite (each on the candidate, each restored after):**
1. Delete the `no-import-of-electron-entry` rule. Both P4-B19 rows fail. This proves the rule, not the fixture, reports the import.
2. Drop the rule's `pathNot` exception. P4-B20's new test fails, and `pnpm check:boundaries` names `canonical-writer-package-smoke-main.test.ts → apps/desktop/src/main/main.ts`. This proves the exception is by name and needed.
3. In `main.ts`, register the workspace handlers with an always-open gate (`registerWorkspaceIpc(workspace.owner, { accepting: () => true })`). The smoke-main `answers unavailable after quit starts: queryWorkspace` row fails (the fake bridge is called). This proves P4-B22 bites on the entry's wiring of the moved function.
4. In `workspace-ipc.ts`, drop the query handler's closed-gate branch. `answers workspace unavailable after the IPC gate closes: queryWorkspace` in `workspace-ipc.test.ts` fails. This proves the moved test exercises the moved module.

**Order (red first):** P4-B19 and P4-B20 tests first (P4-B19 red). Then the rule: P4-B19 green, and `pnpm check:boundaries` red, naming `apps/desktop/src/main/workspace-bridge.test.ts → apps/desktop/src/main/main.ts` (the real-repository red). Then the move: `check:boundaries` green; `check:mutation-ranges` red on the three `main.ts` entries; then the re-point: green.

**Structural checks (on the candidate):**
- `rg -n "^export " apps/desktop/src/main/main.ts`: nothing.
- `rg -n "registerWorkspaceIpc|broadcastWorkspaceNotification" apps/desktop/src/main/main.ts`: the import and the two calls in `bootstrap()`.
- `rg -n "vi\.mock|mainMocks|\./main\.js|registerWorkspaceIpc|broadcastWorkspaceNotification" apps/desktop/src/main/workspace-bridge.test.ts`: nothing.
- `rg -n "main\.js" apps/desktop/src`: only `canonical-writer-package-smoke-main.test.ts`.
- `rg -n "workspace-ipc\.test\.ts" apps/desktop/vitest.desktop-s6-mutation.config.ts apps/desktop/vitest.desktop-s7-mutation.config.ts`: one hit each; `rg -n "workspace-bridge\.test\.ts" apps/desktop/vitest.desktop-s6-mutation.config.ts`: nothing.
- In `stryker-range-anchors.json`, the row whose `first` is `export function registerWorkspaceIpc(` names `apps/desktop/src/main/workspace-ipc.ts`, and the range starts at that line.
- `git diff <base> -- apps/desktop/src/main/project-entry-ipc.ts apps/desktop/src/main/project-registration-ipc.ts apps/desktop/src/main/desktop-runtime.ts apps/desktop/src/preload apps/desktop/src/renderer apps/desktop/src/shared`: empty.
- `git diff <base> --stat` lists only the affected paths and this slice's evidence.

#### Success Criteria: p4-s7-workspace-ipc-module

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `e2b1d48`, with row counts recorded: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/workspace-bridge.test.ts src/main/canonical-writer-package-smoke-main.test.ts src/main/project-entry-ipc.test.ts` (measured: 39 and 80 for the first two), and `pnpm exec vitest run apps/harness/scripts/check-boundaries-parse.test.mjs` from the repository root (2).
- Red then green: `pnpm exec vitest run apps/harness/scripts/check-boundaries-parse.test.mjs` from the root (P4-B19; P4-B20 green at both).
- Green at the candidate: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/workspace-ipc.test.ts src/main/workspace-bridge.test.ts src/main/canonical-writer-package-smoke-main.test.ts src/main/project-entry-ipc.test.ts`: 3 + 36 = 39 workspace tests, 80 smoke-main tests, `project-entry-ipc.test.ts` at its base count.
- `pnpm check:boundaries` red then green, as in Order.
- Each binding (1 to 4) observed red and then restored.
- `pnpm check:mutation-ranges` red then exit 0.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). Knip exit 0. `pnpm check:duplicates` reports no clone between `workspace-ipc.test.ts` and `workspace-bridge.test.ts`.
- CodeScene 10 on `main.ts`, `workspace-ipc.ts` and both test files.
- The run Q15 settles, with the coordinator's GO.
- Mutation: none for this slice; the moved range is in the `desktop-s6` config of the final Phase 4 mutation run.

Manual: none. The coordinator accepts the candidate (normal lane).

### Slice p4-s8-gated-ipc-helper

- **`slice_id`:** `p4-s8-gated-ipc-helper`.
- **Lane:** normal by override (Q6 (a): a helper extraction under unchanged tests). `lane.mjs --paths` over the nine planned paths answers rigorous (files: 7 > 5; sensitive word `ipc` in the helper, its test and the three IPC modules); Q6 lowers it. No intent review. Pedro approves this contract; the coordinator accepts the candidate, and Pedro accepts the combined Phase 4 result.
- **Finding:** L1-07. The nine gated handlers each write out the same decode, gate, closing-answer and forward shape. One plain helper at the IPC edge owns that shape; each handler supplies its channel, schema, closing answer and forward.
- **Base:** `e34a84f` (p4-s7 accepted, on `fix/arch-review-phase-4`). Every line below was read at `e34a84f`.
- **Measured at `e34a84f`:**
  - **Handlers** (`rg -n "ipcMain\.(handle|on)\(" apps/desktop/src`, non-test): 13. The nine with the shared shape are `project-entry-ipc.ts:41-70` (`listProjects`, `activateProject`, `switchProject`, `upgradeProject`, `readConversation`, `saveConversationMessage`), `workspace-ipc.ts:36-46` (`queryWorkspace`, `submitWorkspaceIntent`) and `project-registration-ipc.ts:60-64` (`registerProject`). Each is: `decodeStrict(<schema>, value)`; `if (!gate.accepting()) return Promise.resolve(<closing answer of the decoded request>)`; `return <bridge call>(request)`. `listProjects` decodes and discards its value; its closing answer is the constant `projectListClosing` and its forward takes no argument. `submitWorkspaceIntent` closes with `workspaceIntentClosing(capabilityForIntent(intent))`.
  - The other four are not gated in that shape: `main.ts:247-250` (`getHarnessStatus`, `retryHarness`, no gate), `project-registration-ipc.ts:54-56` (`getRegistrationCapability`, no gate) and `:57-59` (`chooseRepository`, no value; it checks the gate twice inside `chooseRepository`, `:35` and `:43`, around the dialog).
  - **The gate type is written three times:** `project-entry-ipc.ts:39` and `workspace-ipc.ts:34` inline `Readonly<{ accepting(): boolean }>`; `project-registration-ipc.ts:17` names it `IpcGate`. `desktop-shutdown.ts:18` declares the `accepting()` the gate is built on (not edited).
  - **What the unchanged tests pin** (base counts: `project-entry-ipc.test.ts` 9, `project-registration-ipc.test.ts` 8, `workspace-ipc.test.ts` 3, `canonical-writer-package-smoke-main.test.ts` 80):
    - the decode runs before the gate and throws synchronously: every closed-gate row also calls the handler with an extra key and expects `expect(() => call(…)).toThrow()` (`project-entry-ipc.test.ts:236`, `project-registration-ipc.test.ts:90`, `workspace-ipc.test.ts` closed rows). A helper that reads the gate first, or decodes inside a Promise, fails them;
    - each channel's closing answer, whole, with the bridge fake never called (`answers unavailable after the IPC gate closes: $channel`, 6 rows in `project-entry-ipc.test.ts`; the `registerProject` row in `project-registration-ipc.test.ts:83-93`; 2 rows in `workspace-ipc.test.ts`);
    - the open path forwards the decoded request and answers the bridge's result (`registers strict Project IPC handlers: …`, `registers strict conversation IPC handlers`, `keeps workspace IPC handlers narrow and validated`);
    - the entry wires the handlers behind `desktopShutdown` (`answers unavailable after quit starts: $channel` in the smoke-main test: `listProjects`, `registerProject`, `queryWorkspace`).
  - `decodeStrict` (`packages/protocol/src/schema-codec.ts:29`) is `decodeStrict<S extends StrictDecoder>(schema: S, input: unknown): S["Type"]`, synchronous; `StrictDecoder` is package-internal.
  - `pnpm check:mutation-ranges` at `e34a84f`: exit 0; `stryker.desktop-s6.config.json` 14 ranges, 2 whole files. Its IPC entries: `project-entry-ipc.ts:43`, `:48`, `:53`, `:58`, `:63`, `:68` (the six gate lines, anchors `stryker-range-anchors.json:112-142`), `project-registration-ipc.ts:35`, `:43` (`chooseRepository`'s gates, `:148`, `:154`) and `:62` (`registerProject`'s gate, `:160`), and `workspace-ipc.ts:32-47` (`registerWorkspaceIpc`, `:178`; s7 left the whole-file entry to s8). The real-repository row is `passes on the repository's own configs and anchors` (`check-stryker-ranges.test.mjs`, `desktop-s6` at `:448`: `ranges: 14, wholeFiles: 2`). No other Stryker config names an IPC file. `vitest.desktop-s6-mutation.config.ts` names the three IPC tests and the smoke-main test.
- **Deliverable:**
  - **`ipc-gate.ts` (new), a plain function at the IPC edge** (AGENTS.md: the IPC helper is a plain function; `answerRequest` stays the Promise facade).
    - It exports the gate type `IpcGate` (`Readonly<{ accepting(): boolean }>`) and one helper, `handleGatedIpc(channel, schema, gate, { closing, forward })`.
    - The helper registers one `ipcMain.handle(channel, …)` whose handler, per call: decodes the value with `decodeStrict(schema, value)` first and synchronously (an invalid value throws before the gate is read and before either function is called); then reads `gate.accepting()`; when closed, returns `Promise.resolve(closing(request))`; when open, returns `forward(request)`.
    - The schema parameter is typed by what `decodeStrict` accepts, with the request type derived from it; no new export from `@slopstop/protocol`.
  - **The nine handlers use it.** `registerProjectEntryIpc`, `registerWorkspaceIpc` and the `registerProject` handler of `registerProjectRegistrationIpc` each pass their channel, schema, closing answer and forward, with today's values. `listProjects` keeps its constant closing answer and its argument-free forward. The three modules type their gate parameter as `IpcGate`; `project-registration-ipc.ts` drops its local `IpcGate` and imports it. Their TSDoc stays true as written.
  - **Not in the helper:** `chooseRepository` (no value; two gate reads around the dialog) and `getRegistrationCapability` keep their own `ipcMain.handle`, unchanged. `main.ts` is not edited.
- **Q16 (open, for Pedro): where the non-gated variant lands.** The Architecture names "a non-gated variant" for the four other handlers.
  - (a) **Recommended.** In s9. Today it would only wrap `ipcMain.handle` with nothing to add; s9 gives it its job (the sender check) and already edits `main.ts`'s two handlers and `project-registration-ipc.ts`.
  - (b) In s8, as a pass-through over the four handlers, which adds `main.ts` to s8.
- **Q17 (open, for Pedro): does s8 get its own run?**
  - (a) **Recommended.** None per slice (as Q15 (a)). Every one of the nine handlers keeps its unit rows unedited, and the smoke-main test drives three of them through the real entry; the final `check:deep` carries `test:e2e` and `package:launch-smoke`.
  - (b) One `pnpm test:e2e` on the s8 candidate, with the coordinator's GO: every renderer call goes through the new helper.
- **Non-goals:** no answer, channel, schema, preload or renderer change. No sender check (s9). `main.ts`, `desktop-shutdown.ts` and `desktop-runtime.ts` are not edited, so the "latched stop" rewording (p4-s4 acceptance) stays for the slice that next touches `desktop-runtime.ts`. No existing test is edited.
- **Message and code ledger:** none.
- **Affected paths:**
  - `apps/desktop/src/main/ipc-gate.ts` (new), `ipc-gate.test.ts` (new);
  - `apps/desktop/src/main/project-entry-ipc.ts`, `project-registration-ipc.ts`, `workspace-ipc.ts`;
  - `apps/desktop/vitest.desktop-s6-mutation.config.ts`;
  - `stryker.desktop-s6.config.json`, `stryker-range-anchors.json`, `apps/harness/scripts/check-stryker-ranges.test.mjs` (its real-repository row).
- **Stryker re-anchoring (lesson 3, same slice).** The gate lines move into the helper, so the `desktop-s6` IPC entries change shape. `pnpm check:mutation-ranges` on the candidate is the authority, red-first: the real-repository row is edited before the configs (P4-B25).

  | Config | Entry now (`e34a84f`) | After | Anchor rows |
  |---|---|---|---|
  | `stryker.desktop-s6.config.json` | none | `ipc-gate.ts` (whole file): the decode-then-gate order and the closing/forward choice for all nine handlers | none |
  | `stryker.desktop-s6.config.json` | `project-entry-ipc.ts:43`, `:48`, `:53`, `:58`, `:63`, `:68` (6 single lines) | `project-entry-ipc.ts` (whole file): the six channel/schema/closing/forward choices | `:112-142` removed |
  | `stryker.desktop-s6.config.json` | `workspace-ipc.ts:32-47` | `workspace-ipc.ts` (whole file), the entry s7 deferred; adds `broadcastWorkspaceNotification`'s mutants, which `keeps workspace IPC handlers narrow and validated` asserts | `:178` removed |
  | `stryker.desktop-s6.config.json` | `project-registration-ipc.ts:62` (`registerProject`'s gate) | the `registerProject` helper call, first to last line, so its closing answer and forward stay mutated | `:160` (texts and lines change) |
  | `stryker.desktop-s6.config.json` | `project-registration-ipc.ts:35`, `:43` (`chooseRepository`) | the same two lines, shifted only if the `IpcGate` import changes the line count | `:148`, `:154` (line numbers only) |

  - Counts: `desktop-s6` goes from 14 ranges and 2 whole files to **7 ranges and 5 whole files**; the other configs do not change.
  - Not taken: `project-registration-ipc.ts` as a whole file. It would add `registrationCapability`'s and the dialog path's mutants, which were never in `desktop-s6`.
  - `vitest.desktop-s6-mutation.config.ts` adds `ipc-gate.test.ts`. `vitest.desktop-s7-mutation.config.ts` is not edited (`desktop-s7` mutates no IPC file).
- **Full-integration exposure:**
  - **In-process:** `canonical-writer-package-smoke-main.test.ts` loads the real `main.ts` and calls `listProjects`, `registerProject` and `queryWorkspace` through the helper (unit run).
  - **e2e:** every journey: every renderer call to the nine channels goes through the helper (`projects`, `registration`, `conversation`, `conversation-accessibility`, `project-upgrade`, `renderer-foundation`, `shell`).
  - **Smoke:** `package:launch-smoke` (the packaged renderer calls through the preload). The helper imports only `electron`, `@slopstop/protocol` and modules already bundled.
  - **Harness integration:** none.
  - **The run:** Q17.
- **Dependencies:** after s7 (accepted; `workspace-ipc.ts`). s9 builds on the helper.

#### Test Contract: p4-s8-gated-ipc-helper

Public seams: `handleGatedIpc` registered on a mocked `ipcMain.handle` and called as Electron calls a handler (`(event, value)`); the nine handlers through `registerProjectEntryIpc`, `registerWorkspaceIpc` and `registerProjectRegistrationIpc` on the same mock; the real `main.ts` with mocked Electron; `checkStrykerRanges` over the repository.

- **Behavior P4-B23: one helper decodes strictly, then gates, then answers closing or forwards.**
  - Test: `apps/desktop/src/main/ipc-gate.test.ts` (new).
  - Rows (each title its own `it`, over a test schema and spy `closing`, `forward` and `accepting`):
    - `registers one handler on its channel`: one `ipcMain.handle` call, with the given channel;
    - `forwards the decoded request while the gate is open`: the handler returns `forward`'s promise, resolving to its answer; `forward` gets the decoded request once; `closing` is not called;
    - `answers the closing result once the gate closes`: resolves to `closing(request)` for the decoded request; `forward` is not called;
    - `rejects an invalid value before reading the gate: $gate`, open and closed: calling the handler with an extra key throws synchronously (`toThrow`), and `accepting`, `closing` and `forward` are not called;
    - `reads the gate on every call`: one registration, the gate open for the first call and closed for the second → `forward` once, then `closing` once.
  - Expected red: at the base `./ipc-gate.js` does not exist, so the file fails at import. It is a whole-file clause, so validate checks that the slice added it and does not re-prove a red.
- **Behavior P4-B24: the nine handlers answer exactly as before.**
  - Test: `apps/desktop/src/main/project-entry-ipc.test.ts`, `apps/desktop/src/main/project-registration-ipc.test.ts`, `apps/desktop/src/main/workspace-ipc.test.ts` and `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`, each unedited.
  - Expected red: none — pin. All four are green at the base and after with the same counts (9, 8, 3, 80); bindings 1, 3 and 4 prove they bite on the helper's order and on each module's per-channel choices.
- **Behavior P4-B25: the `desktop-s6` mutation set follows the helper.**
  - Test: `passes on the repository's own configs and anchors` in `apps/harness/scripts/check-stryker-ranges.test.mjs`, its `desktop-s6` row edited to `{ config: "stryker.desktop-s6.config.json", ranges: 7, wholeFiles: 5 }`.
  - Expected red: at the base the repository has 14 ranges and 2 whole files in `desktop-s6`, so the test fails on that row.

**Bindings that bite (each on the candidate, each restored after):**
1. In `handleGatedIpc`, read the gate before decoding (closed → closing answer without decoding). The closed-gate rows' invalid-value assertions fail: `answers unavailable after the IPC gate closes: $channel` in `project-entry-ipc.test.ts` (6), the `registerProject` row in `project-registration-ipc.test.ts`, the 2 closed rows in `workspace-ipc.test.ts`, and P4-B23's `rejects an invalid value before reading the gate: closed`. This proves the unchanged tests pin decode-before-gate through the helper.
2. In `handleGatedIpc`, forward whatever the gate says. P4-B23's closed rows fail, and so do the 9 closed-gate rows of the three IPC tests (the bridge fake is called) and the smoke-main `answers unavailable after quit starts: $channel` rows.
3. In `registerProjectEntryIpc`, give `switchProject` the activation closing answer. `answers unavailable after the IPC gate closes: switchProject` fails. This proves each channel's closing answer stays pinned.
4. In `registerWorkspaceIpc`, decode the intent with `WorkspaceQuerySchema`. `keeps workspace IPC handlers narrow and validated` fails (a valid intent is refused). This proves each channel's schema stays pinned.

**Order (red first):** P4-B25's row first (red), then the helper test (red at import), then the helper (P4-B23 green), then the nine handlers onto it (P4-B24 green throughout), then the Stryker and anchor edits (`check:mutation-ranges` and P4-B25 green).

**Structural checks (on the candidate):**
- `rg -n "ipcMain\.handle\(" apps/desktop/src --glob '!*.test.ts'`: `ipc-gate.ts` (1), `project-registration-ipc.ts` (2: `getRegistrationCapability`, `chooseRepository`), `main.ts` (2).
- `rg -n "gate\.accepting\(\)" apps/desktop/src/main --glob '!*.test.ts'`: `ipc-gate.ts` and the two in `chooseRepository`.
- `rg -n "accepting\(\): boolean" apps/desktop/src/main`: `ipc-gate.ts` and `desktop-shutdown.ts:18` only.
- `rg -n "decodeStrict\(" apps/desktop/src/main/project-entry-ipc.ts apps/desktop/src/main/workspace-ipc.ts`: only `broadcastWorkspaceNotification`'s.
- `stryker.desktop-s6.config.json` names `ipc-gate.ts`, `project-entry-ipc.ts` and `workspace-ipc.ts` as whole files and has no `project-entry-ipc.ts:` or `workspace-ipc.ts:` range; `stryker-range-anchors.json` has no row for them.
- `rg -n "ipc-gate\.test\.ts" apps/desktop/vitest.desktop-s6-mutation.config.ts`: one hit.
- `git diff <base> -- apps/desktop/src/main/main.ts apps/desktop/src/main/desktop-shutdown.ts apps/desktop/src/main/desktop-runtime.ts apps/desktop/src/main/project-entry-ipc.test.ts apps/desktop/src/main/project-registration-ipc.test.ts apps/desktop/src/main/workspace-ipc.test.ts apps/desktop/src/preload apps/desktop/src/renderer apps/desktop/src/shared packages`: empty.
- `git diff <base> --stat` lists only the affected paths and this slice's evidence.

#### Success Criteria: p4-s8-gated-ipc-helper

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `e34a84f`, counts recorded: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/project-entry-ipc.test.ts src/main/project-registration-ipc.test.ts src/main/workspace-ipc.test.ts src/main/canonical-writer-package-smoke-main.test.ts` (measured: 9, 8, 3, 80).
- Red then green: `pnpm exec vitest run apps/harness/scripts/check-stryker-ranges.test.mjs` from the repository root (P4-B25) and `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/ipc-gate.test.ts` (P4-B23).
- Green at the candidate with the same counts: the four P4-B24 files.
- Each binding (1 to 4) observed red and then restored.
- `pnpm check:mutation-ranges` exit 0 (`desktop-s6` 7 ranges, 5 whole files).
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). Knip exit 0. `pnpm check:duplicates` reports no clone.
- CodeScene 10 on `ipc-gate.ts`, `project-entry-ipc.ts`, `project-registration-ipc.ts`, `workspace-ipc.ts` and `ipc-gate.test.ts`.
- The run Q17 settles, with the coordinator's GO.
- Mutation: none for this slice; `desktop-s6` runs in the final Phase 4 mutation run.

Manual: none. The coordinator accepts the candidate (normal lane).

### Slice p4-s9-ipc-sender-check

- **`slice_id`:** `p4-s9-ipc-sender-check`.
- **Lane:** rigorous (Q6 (a): s9 is the security check). `lane.mjs --paths` over the sixteen planned paths answers rigorous (files: 9 > 5; sensitive word `ipc`). The intent review ran (round 1 of 1, folded below), and Pedro accepts the candidate.
- **Finding:** L1-05, on Q2 (a), Q3 (a), Q16 (a) and Q18 (a). Every renderer-to-main IPC handler admits a call only from the main frame of a window SlopStop created. Any other call rejects with one fixed error and writes one log line naming the channel only. The non-gated variant of the s8 helper lands here and serves the four handlers that have no gate.
- **Base:** `91669c2` (p4-s8 accepted, on `fix/arch-review-phase-4`). Every line below was read at `91669c2`; static reads only (no test, gate or Stryker run for this contract).
- **Measured at `91669c2`:**
  - **Handlers** (non-test `rg -n "ipcMain\.handle\("`): `ipc-gate.ts:26` (the nine gated handlers through `handleGatedIpc`), `project-registration-ipc.ts:54` (`getRegistrationCapability`) and `:57` (`chooseRepository`, which reads `event.sender` for the dialog owner through `BrowserWindow.fromWebContents`), `main.ts:247` (`getHarnessStatus`) and `:248` (`retryHarness`). None reads `event.senderFrame` (`rg senderFrame apps`: nothing).
  - **Order in `main.ts` `bootstrap()`:** the handlers are registered at `:379-382`, before the window exists; the window is created at `:388` (`smokeWindow = await createActiveWindow()`). `createApplicationWindow` (`:262-294`) constructs the `BrowserWindow` at `:263`, then awaits `loadURL` (`:286`) or `loadFile` (`:290`). The renderer's preload and React code run during that load, so they can invoke a channel before `createActiveWindow()` resolves. A window recorded after the `await` would refuse those first calls.
  - **More than one window over time:** `app.on("activate")` (`:391-396`) reopens a window through `create: createActiveWindow` when none is open (`window-reopen.ts`), and `focusExistingWindow` reuses `getAllWindows()[0]`. So the identity is per created window, not fixed at boot. Popups are denied (`security.ts`), so every window comes from `createApplicationWindow`.
  - **The renderer is `file://` under `loadFile`** (`:290`), so an origin check alone admits any `file:` frame (Q2's reason for frame identity).
  - **Electron** (Context7 `/electron/electron`): `event.senderFrame` is resolved on each read and is `null` once the frame has navigated or gone; read it synchronously at handler entry, before any `await`. The main-frame check compares the sending frame with `event.sender.mainFrame`, read per call (a reload can replace the main frame, `tests/e2e/accessibility.ts:36`); `WebFrameMain` exposes `processId` and `routingId`, which identify a frame. A window is not used after its `closed` event.
  - **The gate literals the implementer asked about:** `registerProjectEntryIpc(projects, { accepting })` (`project-entry-ipc.test.ts:48`), `registerProjectRegistrationIpc({ register }, { accepting })` (`project-registration-ipc.test.ts:36`), `registerWorkspaceIpc(bridge, { accepting })` (`workspace-ipc.test.ts:32`, `:106`), `handleGatedIpc(…, gate, …)` (`ipc-gate.test.ts:26`); `main.ts:379-382` passes `desktopShutdown` as the gate. Unit tests call handlers with `{}` or `{ sender: {} }` as the event.
  - **The in-process entry test's doubles** (`canonical-writer-package-smoke-main.test.ts`): `BrowserWindow` is a class with `once`, `loadFile` and one shared shape `webContents = { executeJavaScript }` (`:27-33`), plus `getAllWindows` (`:63`), and no `fromWebContents`; the electron mock has no `dialog`; the logger returns `{ info, error }` only (`:345-348`); the `HarnessSupervisor` mock has no `getStatus` or `retry` (`:86-99`); `ipcHandler` calls with `{ sender: {} }` (`:698-703`). No unit test calls `getHarnessStatus` or `retryHarness`.
  - **e2e handler replacement:** the conversation journeys replace some channels with a bare `ipcMain.handle` (`tests/e2e/conversation-window.ts:256-269`, `replaceHandlers`), so for those channels the e2e run proves the preload path, not the sender rule.
  - **Logger:** `bootstrap()` has `logger` from `readDesktopServices` (`:376`) before the registrations.
  - **Stryker** (`stryker.desktop-s6.config.json`, `check-stryker-ranges.test.mjs:448`: 7 ranges, 5 whole files): `ipc-gate.ts`, `project-entry-ipc.ts`, `workspace-ipc.ts` whole; `project-registration-ipc.ts:35-35`, `:43-43`, `:60-63` (anchors `stryker-range-anchors.json:112`, `:118`, `:124`); `main.ts:83-93` (`:130`), `:369-369` (`:142`). `vitest.desktop-s6-mutation.config.ts` names the four IPC tests and the smoke-main test.
- **Q18 (decided (a), Pedro): how the sender rule reaches the handlers.** A new `sender` parameter beside the gate, in both helpers and the three register functions; `main.ts` builds one rule and passes it to all. The shutdown gate and the sender rule stay two concerns, and the four non-gated handlers take a sender without a gate. Not taken: (b) widen `IpcGate` with `admit` (mixes shutdown with identity); (c) module state set by `main.ts` (a hidden, order-dependent global). Within (a), grouping the gate and the sender into one argument object (`{ gate, sender }`) is the implementer's choice (for example to keep CodeScene's argument count); the sender stays its own rule.
- **Deliverable (on Q18 (a)):**
  - **`ipc-sender.ts` (new): the sender rule.** `createIpcSender({ logger })` returns `{ track(window), admit(channel, event) }`; the `admit` side is typed `IpcSender`.
    - **Kind of owner (R11, ratified by Pedro).** The rule keeps state (the tracked ids) and listens to `closed`, which AGENTS.md would make a Layer-built service. It is instead a closure-state factory at the IPC edge, as `createDesktopShutdown` is (precedent, `desktop-shutdown.ts`), under the approved non-goal of not moving the IPC edge onto the Effect runtime.
    - **Structural types** (no double casts in tests): `logger: Pick<Logger, "warn">`; `track(window)` takes `Readonly<{ webContents: Readonly<{ id: number }>; once(event: "closed", listener: () => void): unknown }>`; `admit(channel: string, event)` takes `Readonly<{ sender: Readonly<{ id: number; mainFrame: FrameId }>; senderFrame: FrameId | null }>`, with `FrameId = Readonly<{ processId: number; routingId: number }>`. Electron's `BrowserWindow` and `IpcMainInvokeEvent` satisfy them.
    - `track(window)` reads `window.webContents.id` once, at track time, and subscribes with `window.once("closed", …)`. The listener forgets that stored id and does not read the window or its `webContents` (a destroyed window may throw).
    - `admit(channel, event)` reads `event.senderFrame` synchronously. It admits the call only when `event.sender.id` is a tracked id, `event.senderFrame` is not `null`, and the frame's `processId` and `routingId` equal those of `event.sender.mainFrame` as read on this call (never ids stored at `track`). Every refusal, whatever the reason, writes exactly one log line, `logger.warn({ channel }, "IPC call refused: unknown sender.")`, and throws `new Error(ipcSenderRefusedMessage)` with the exported fixed text `"IPC call refused: unknown sender."` and nothing appended. An admitted call logs nothing. The log carries the channel only: no URL, origin, frame id, path or value (AGENTS.md privacy; a `file://` URL holds a local path).
    - A throw at the `ipcMain.handle` edge is how Electron rejects an invoke; this is a plain function at the IPC edge, as `decodeStrict`'s throw already is.
  - **`ipc-gate.ts`.** `handleGatedIpc(channel, schema, gate, sender, answers)` (or with `{ gate, sender }` grouped) calls `sender.admit(channel, event)` first, with its own `channel` and the exact event object it received, then decodes, gates and answers as in s8. A new `handleIpc(channel, sender, handler)` registers one handler that calls `sender.admit(channel, event)` first, then `handler(event)`. Both check the sender before anything else, so a refused call is never decoded, gated or forwarded.
  - **The thirteen handlers.** The nine gated handlers pass the sender through their register functions. `getRegistrationCapability` and `chooseRepository` use `handleIpc`; `chooseRepository` keeps `BrowserWindow.fromWebContents(event.sender)` as the dialog owner and its two gate reads. In `main.ts`, `registerHarnessIpc(supervisor, sender)` uses `handleIpc` for `getHarnessStatus` and `retryHarness`.
  - **`main.ts`.** `bootstrap()` builds `const sender = createIpcSender({ logger })` from the main logger after the services, passes it to the four register calls, and every window `createApplicationWindow` creates is tracked with `sender.track(window)` right after `new BrowserWindow(…)`, before `loadURL`/`loadFile`, so the first renderer calls are admitted. The reopen path (`create` on `activate`) and `smokeWindow` both go through that tracking. How `createApplicationWindow` reaches the sender (an argument, or a closure built in `bootstrap()`) is the implementer's choice, as long as the reopen path tracks too; module state is not.
  - **Tests, scaffolding (no existing assertion changes).**
    - Each register call in the IPC tests gains a sender fake that admits; `ipc-gate.test.ts`'s `register` gains one.
    - Test files other than `ipc-sender.test.ts` use the literal text `"IPC call refused: unknown sender."` and import nothing from `ipc-sender.ts` at runtime (type-only imports are allowed), so they still load at the base.
    - `canonical-writer-package-smoke-main.test.ts`: the window mock gives each instance its own `webContents` with a counter `id` and its own `mainFrame` (`processId`, `routingId`); `BrowserWindow` gains `fromWebContents`; the electron mock gains `dialog.showOpenDialog` (a spy); the logger mock gains `warn: ports.logWarn`; the `HarnessSupervisor` mock gains `getStatus` and `retry` spies; `ipcHandler` calls with `{ sender: window.webContents, senderFrame: window.webContents.mainFrame }` from the constructed window.
- **Non-goals:** no origin allowlist (Q2 (b)); no change to the custom protocol or the file-protocol fuse (L1-06, Phase 6). No channel, preload, renderer or answer change; the renderer never sees the fixed error, because its own calls are admitted. `desktop-shutdown.ts` and `desktop-runtime.ts` are not edited, so the "latched stop" rewording (p4-s4 acceptance) stays for the slice that next touches `desktop-runtime.ts`. Main-to-renderer sends (`broadcastHarnessStatus`, `broadcastWorkspaceNotification`) are not handlers and do not change.
- **Not taken:** a stateless rule that admits any `event.sender` for which `BrowserWindow.fromWebContents` is non-null, plus the frame check, with no `track` (intent-review alternative, Pedro). It makes the allowlist implicit (any window in the process is admitted, including a future second window kind), and whether DevTools or `WebContentsView` contents resolve to a window there is unverified; the explicit set of created windows is the stronger defence in depth.
- **Message and code ledger:** one new fixed text, `"IPC call refused: unknown sender."`, used as the rejection message and the log message. No protocol code.
- **Affected paths:**
  - `apps/desktop/src/main/ipc-sender.ts` (new), `ipc-sender.test.ts` (new);
  - `apps/desktop/src/main/ipc-gate.ts`, `ipc-gate.test.ts`;
  - `apps/desktop/src/main/project-entry-ipc.ts`, `project-entry-ipc.test.ts`, `project-registration-ipc.ts`, `project-registration-ipc.test.ts`, `workspace-ipc.ts`, `workspace-ipc.test.ts`;
  - `apps/desktop/src/main/main.ts`, `canonical-writer-package-smoke-main.test.ts`;
  - `apps/desktop/vitest.desktop-s6-mutation.config.ts`;
  - `stryker.desktop-s6.config.json`, `stryker-range-anchors.json`, `apps/harness/scripts/check-stryker-ranges.test.mjs` (its real-repository row).
- **Stryker re-anchoring (lesson 3, same slice).** `pnpm check:mutation-ranges` on the candidate is the authority, red-first through the real-repository row (P4-B32).

  | Config | Entry now (`91669c2`) | After | Anchor rows |
  |---|---|---|---|
  | `stryker.desktop-s6.config.json` | none | `ipc-sender.ts` (whole file) | none |
  | `stryker.desktop-s6.config.json` | `project-registration-ipc.ts:60-63` (`registerProject`) | the same call, now with the sender | `:124` (text and lines) |
  | `stryker.desktop-s6.config.json` | `project-registration-ipc.ts:35`, `:43` (`chooseRepository`'s gates) | the same lines, shifted by the import and handler edits | `:112`, `:118` (lines only) |
  | `stryker.desktop-s6.config.json` | `main.ts:83-93`, `:369-369` | shifted by the `main.ts` edits | `:130`, `:142` (lines only) |
  | `stryker.desktop-s6.config.json` | `ipc-gate.ts`, `project-entry-ipc.ts`, `workspace-ipc.ts` (whole) | unchanged | none |

  - Counts: `desktop-s6` goes from 7 ranges and 5 whole files to **7 ranges and 6 whole files**.
  - No range on the `sender.track(window)` line (intent review): StrykerJS has no mutator for a bare call statement, so a one-line range would hold no mutant. P4-B30 and bindings 12 and 13 guard that line.
  - `vitest.desktop-s6-mutation.config.ts` adds `ipc-sender.test.ts`.
- **Full-integration exposure:**
  - **e2e, every journey** (`projects`, `registration`, `conversation`, `conversation-accessibility`, `project-upgrade`, `renderer-foundation`, `shell`, `single-instance`): only a real Electron launch proves that the real window's main frame is admitted, including the calls made while the page is still loading and after the `accessibility.ts:36` reload. A wrong identity refuses every call. Exception: the channels a conversation journey swaps with `replaceHandlers` run a bare handler, so that journey proves those channels' preload path, not the rule; the other journeys call them through the rule.
  - **Smoke:** `package:launch-smoke`: the packaged `file://` renderer, and the registration scenario's `executeJavaScript` in the window's main frame.
  - **In-process:** `canonical-writer-package-smoke-main.test.ts` (unit run).
  - **Harness integration:** none.
  - **The s9 run (Phase 4 approval: "a slice whose exposure is the real Electron frame (s9) asks for its own e2e run on its candidate"):** on the candidate, after `pnpm check`, with the coordinator's GO and Pedro's "livre", one run each of `pnpm test:e2e` and `package:launch-smoke`, alone.
- **Intent review:** done, round 1 of 1, on `c738013c…b345` (slice-verifier passed with 4 warnings; code reviewer 5 concerns, 1 suggestion; coverage reviewer 1 blocker, 5 concerns, 3 suggestions). Pedro's triage: fix all, R11 and R12 ratified, the stateless alternative not taken. Table and triage: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s9-intent-review.md`. No second round.
- **Dependencies:** after s8 (accepted; `handleGatedIpc`). s10 also edits `main.ts` and comes after; its contract re-anchors the `main.ts` `desktop-s6` ranges s9 shifts.

#### Test Contract: p4-s9-ipc-sender-check

Public seams: `createIpcSender` with structural fake windows, webContents, frames and a spy logger; `handleGatedIpc` and `handleIpc` on a mocked `ipcMain.handle`; the three register functions on the same mock; the real `main.ts` with mocked Electron (`canonical-writer-package-smoke-main.test.ts`); `checkStrykerRanges` over the repository.

Every refusal assertion matches the whole text, `/^IPC call refused: unknown sender\.$/`, never a substring.

- **Behavior P4-B26: the sender rule admits only the current main frame of a tracked window, and logs every refusal by channel only.**
  - Test: `apps/desktop/src/main/ipc-sender.test.ts` (new).
  - Rows (each title its own `it`; the spy logger has every pino level; each refusal event differs from the admitted event in exactly one property):
    - `admits the main frame of a tracked window`: no throw, and no logger level is called;
    - `refuses a call with no sender frame` (tracked webContents, `senderFrame: null`); `refuses a subframe of a tracked window` (tracked webContents, same `processId`, other `routingId`); `refuses a frame from another process with the main frame's routing id` (tracked webContents, same `routingId`, other `processId`); `refuses a window it never tracked` (an untracked webContents sending from its own main frame); each throws the fixed text, and the logger has exactly one call, `warn({ channel }, "IPC call refused: unknown sender.")`, and no other level;
    - `refuses a tracked window after it closed, without reading it`: the fake window's `webContents` (and its `id`) throws "Object has been destroyed" once its `closed` listeners have run; emitting `closed` does not throw, and a later call carrying the old id is refused with the one `warn`;
    - `admits the new main frame after it is replaced`: after `track`, the tracked webContents' `mainFrame` gets a new `processId` and `routingId`; a call from the new frame is admitted, and one from the old frame identity is refused;
    - `logs only the channel of a refused call`: for an event whose frame carries a `url` and an `origin`, the one `warn` call's fields are exactly `{ channel }`.
  - Expected red: at the base `./ipc-sender.js` does not exist, so the file fails at import. It is a whole-file clause, so validate checks that the slice added it and does not re-prove a red; bindings 4 to 11 give each security row its own observed red.
- **Behavior P4-B27: both helpers check the sender first, with their own channel and event.**
  - Test: `refuses an unadmitted call before decoding or gating: $helper` in `apps/desktop/src/main/ipc-gate.test.ts` (new).
  - Rows: `handleGatedIpc` with a valid value, `handleGatedIpc` with an invalid value, and `handleIpc`. Over a refusing spy sender, the handler throws the fixed text synchronously; `admit` was called exactly once, with `("test:channel", <the same event object the handler received>)`; `accepting`, `closing`, `forward` and the plain handler are not called.
  - Expected red: observed at the scaffold state of the Order (the helpers take the sender and ignore it; `handleIpc` registers its handler without `admit`): the valid row forwards, the invalid row throws the decode error, the `handleIpc` row calls the handler, and no row sees `admit` called. At the base itself the rows also fail (the 4-parameter helper reads the sender fake as `answers`; `handleIpc` does not exist).
- **Behavior P4-B28: each module registers every channel behind the sender rule.**
  - Test: `refuses every channel from an unadmitted sender: $channel` in `apps/desktop/src/main/project-entry-ipc.test.ts` (new); `refuses every channel from an unadmitted sender: $channel` in `apps/desktop/src/main/project-registration-ipc.test.ts` (new); `refuses every channel from an unadmitted sender: $channel` in `apps/desktop/src/main/workspace-ipc.test.ts` (new).
  - Rows: the six project-entry channels; `getRegistrationCapability`, `chooseRepository` and `registerProject`; the two workspace channels (11 rows).
  - Oracle: each call rejects or throws the fixed text; no bridge fake or dialog is called.
  - Expected red: observed right after `ipc-sender.ts` exists and before the helpers change (Order step 3): the register functions ignore the extra sender argument and every handler answers, so all 11 rows fail for the intended reason.
- **Behavior P4-B29: the composed entry refuses every invoke channel from a frame that is not an application window.**
  - Test: `refuses a call from a frame that is not the application window: $channel` in `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` (new).
  - Rows: every invoke channel of `desktopIpcChannels` (the 13 handled channels; the main-to-renderer event channels are excluded), after `ordinaryLaunch()`, each called with an event whose `sender` is another webContents (another `id`, its own main frame).
  - Oracle: each call rejects or throws the fixed text; the channel's port spy (`entryList`, `entryRegister`, the other entry fakes, `workspaceQuery`, `dialog.showOpenDialog`, the supervisor's `getStatus`/`retry`) is not called; `ports.logWarn` has exactly one call per row, `({ channel }, "IPC call refused: unknown sender.")`.
  - Expected red: observed with the scaffolding in place and before the `main.ts` wiring (Order step 3): every channel answers whatever its sender, so all 13 rows fail.
- **Behavior P4-B30: the composed entry admits every window it creates, from the first call.**
  - Test: `admits the application window on every channel before its page finishes loading: $channel` in `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` (new); `admits a window reopened on activate` in `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` (new).
  - Oracle, first test: with the first window's `loadFile` held pending, each invoke channel called from that window's main frame reaches its port spy once and is not refused; the `listProjects` row resolves exactly to the `entryList` fake's answer.
  - Oracle, second test: after `ordinaryLaunch()`, with `getAllWindows` returning `[]`, the `activate` listener creates a second window; a `listProjects` call from `ports.window.mock.instances[1]`'s main frame resolves exactly to the `entryList` fake's answer.
  - Expected red: none — pin. At the base nothing is refused, so both are green by design; bindings 12 and 13 prove they bite.
- **Behavior P4-B31: admitted calls answer exactly as before.**
  - Test: `answers unavailable after the IPC gate closes: $channel` in `apps/desktop/src/main/project-entry-ipc.test.ts`; `answers registration unavailable after the IPC gate closes: $channel` in `apps/desktop/src/main/project-registration-ipc.test.ts`; `forwards registration while the IPC gate is open: $channel` in `apps/desktop/src/main/project-registration-ipc.test.ts`; `opens the folder dialog owned by the calling window` in `apps/desktop/src/main/project-registration-ipc.test.ts` (new); `keeps workspace IPC handlers narrow and validated` in `apps/desktop/src/main/workspace-ipc.test.ts`; `answers workspace unavailable after the IPC gate closes: $channel` in `apps/desktop/src/main/workspace-ipc.test.ts`; `answers unavailable after quit starts: $channel` in `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`; `rejects an invalid value before reading the gate: $gate` in `apps/desktop/src/main/ipc-gate.test.ts`; `reads the gate on every call` in `apps/desktop/src/main/ipc-gate.test.ts`.
  - The new `opens the folder dialog owned by the calling window`: `BrowserWindow.fromWebContents` returns a sentinel window for the event's sender, and `dialog.showOpenDialog` receives `(sentinel, options)`.
  - Expected red: none — pin. Each is green at the base and after with unchanged assertions; only its register call or event gains an admitting sender. The new dialog-owner row is green at the base by design (the owner is computed today); binding 17 proves it bites. The other rows of the four IPC test files and the smoke-main file keep their counts.
- **Behavior P4-B32: the `desktop-s6` mutation set covers the sender rule.**
  - Test: `passes on the repository's own configs and anchors` in `apps/harness/scripts/check-stryker-ranges.test.mjs`, its `desktop-s6` row edited to `{ config: "stryker.desktop-s6.config.json", ranges: 7, wholeFiles: 6 }`.
  - Expected red: at the base `desktop-s6` has 7 ranges and 5 whole files, so the test fails on that row.

**Bindings that bite (each on the candidate, each restored after):**
1. In `handleGatedIpc`, call `sender.admit` after decoding. P4-B27's invalid-value row fails (the decode error is thrown instead of the fixed text).
2. In `handleGatedIpc`, call `sender.admit` after `gate.accepting()`. P4-B27's valid-value row fails (`accepting` was called).
3. In both helpers, call `sender.admit("ipc", event)`. Every P4-B27 row fails on the `admit` arguments.
4. In `admit`, compare `routingId` only. `refuses a frame from another process with the main frame's routing id` fails.
5. In `admit`, compare `processId` only. `refuses a subframe of a tracked window` fails.
6. In `admit`, drop the tracked-id check. `refuses a window it never tracked` fails.
7. In `admit`, admit a `null` sender frame when the webContents is tracked. `refuses a call with no sender frame` fails.
8. In `track`, store the main frame's ids and compare against them. `admits the new main frame after it is replaced` fails.
9. In the `closed` listener, read `window.webContents.id`. `refuses a tracked window after it closed, without reading it` fails.
10. In `admit`'s null-frame branch, throw without logging. `refuses a call with no sender frame` fails on the `warn` assertion.
11. In `admit`, add the frame's `url` to the log fields. `logs only the channel of a refused call` fails.
12. In `createApplicationWindow`, track the window after the `await` of `loadFile`. P4-B30's `before its page finishes loading` rows fail.
13. Track only the window `bootstrap()` creates (the reopen path does not track). `admits a window reopened on activate` fails.
14. In `main.ts`, give `registerProjectEntryIpc` an admit-all sender. P4-B29's `listProjects` row fails.
15. In `main.ts`, register `getHarnessStatus` with `ipcMain.handle` directly. P4-B29's `getHarnessStatus` row fails.
16. In `main.ts`, build the rule with a no-op logger. P4-B29's `ports.logWarn` assertions fail.
17. In `chooseRepository`'s registration, pass `undefined` as the dialog owner. `opens the folder dialog owned by the calling window` fails.

**Order (red first):**
1. P4-B32's row: red.
2. `ipc-sender.test.ts`: red at import; then the rule: P4-B26 green.
3. The scaffolding of the smoke-main doubles; P4-B28's module rows and P4-B29's entry rows written: red for the intended reason (every handler answers whatever its sender).
4. Scaffold state: the helpers take the sender (or `{ gate, sender }`) and ignore it; `handleIpc` registers without `admit`; every call site and every existing test's register call is updated in the same step (existing tests green). P4-B27 written: red.
5. The helpers call `admit` first: P4-B27 and P4-B28 green.
6. `main.ts` builds the rule from the main logger, tracks every created window before its load, and passes the rule to all four registrations: P4-B29 green; P4-B30 green throughout.
7. The Stryker and anchor edits: P4-B32 and `check:mutation-ranges` green.

**Structural checks (on the candidate):**
- `rg -n "ipcMain\.handle\(" apps/desktop/src --glob '!*.test.ts'`: only `ipc-gate.ts` (2: `handleGatedIpc`, `handleIpc`).
- `rg -n "senderFrame" apps/desktop/src --glob '!*.test.ts'`: only `ipc-sender.ts`.
- `rg -n "\.(url|origin)\b" apps/desktop/src/main/ipc-sender.ts`: nothing (identity, not origin: Q2 (a)).
- `rg -n "\.track\(" apps/desktop/src/main/main.ts`: one call, in `createApplicationWindow`, before its `loadURL`/`loadFile` lines.
- `rg -n "IPC call refused: unknown sender\." apps/desktop/src --glob '!*.test.ts'`: one definition, in `ipc-sender.ts`.
- `rg -n "from \"\./ipc-sender\.js\"" apps/desktop/src/main --glob '*.test.ts'`: only `ipc-sender.test.ts`, or `import type` elsewhere.
- `stryker.desktop-s6.config.json` names `ipc-sender.ts` as a whole file and has no `main.ts` range on the `track` line; `rg -n "ipc-sender\.test\.ts" apps/desktop/vitest.desktop-s6-mutation.config.ts`: one hit.
- `git diff <base> -- apps/desktop/src/preload apps/desktop/src/renderer apps/desktop/src/shared apps/desktop/src/main/desktop-shutdown.ts apps/desktop/src/main/desktop-runtime.ts packages`: empty.
- `git diff <base> --stat` lists only the affected paths and this slice's evidence.

#### Success Criteria: p4-s9-ipc-sender-check

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `91669c2`, counts recorded: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/ipc-gate.test.ts src/main/project-entry-ipc.test.ts src/main/project-registration-ipc.test.ts src/main/workspace-ipc.test.ts src/main/canonical-writer-package-smoke-main.test.ts`.
- Red then green, each red observed at its Order step: `pnpm exec vitest run apps/harness/scripts/check-stryker-ranges.test.mjs` from the repository root (P4-B32); the same desktop command plus `src/main/ipc-sender.test.ts` (P4-B26 at step 2, P4-B28 and P4-B29 at step 3, P4-B27 at step 4). P4-B30 and P4-B31 green at the base and at the candidate.
- Each binding (1 to 17) observed red and then restored.
- `pnpm check:mutation-ranges` exit 0 (`desktop-s6` 7 ranges, 6 whole files).
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). Knip exit 0. `pnpm check:duplicates` reports no clone.
- CodeScene 10 on `ipc-sender.ts`, `ipc-gate.ts`, `project-entry-ipc.ts`, `project-registration-ipc.ts`, `workspace-ipc.ts`, `main.ts` and `ipc-sender.test.ts`.
- The s9 run, with the coordinator's GO and Pedro's "livre", each read by its real exit code: `pnpm test:e2e`, `package:launch-smoke`.
- Mutation: none for this slice; `desktop-s6` runs in the final Phase 4 mutation run.

Manual: none. Pedro accepts the candidate (rigorous lane).

### Slice p4-s10-desktop-clock

- **`slice_id`:** `p4-s10-desktop-clock`.
- **Lane:** normal. `lane.mjs --paths` over the eleven planned paths answers normal (files: 7 > 5); no sensitive word. No intent review. Pedro approves this contract; the coordinator accepts the candidate, and Pedro accepts the combined Phase 4 result.
- **Finding:** R5 (Phase 2 residual, homed in Phase 4). Two desktop sites read the time and a fresh id inline instead of the injected `Clock`: the supervisor's handshake and the writer proof's command metadata. Q9 (a): both take the desktop `Clock` from their composer, and `main.ts` stays the desktop's one clock. Q19 (b): the runtime hands the supervisor the clock it was given, as it does for the bridges.
- **Base:** `eeae135` (p4-s9 accepted, on `fix/arch-review-phase-4`). Every line below was read at `eeae135`.
- **Measured at `eeae135`:**
  - **The one clock:** `main.ts:76-77` passes `createId: randomUUID` and `now: () => new Date().toISOString()` into `makeDesktopRuntime`; the runtime hands them to the bridges (`desktop-runtime.ts:173`). `Clock` is `Readonly<{ createId(): string; now(): string }>` (`harness-request-core.ts:34`).
  - **The two inline reads:**
    - `harness-supervisor.ts:497-498`, in `#connectChild`: the handshake's `messageId: randomUUID()` and `sentAt: new Date().toISOString()`. It runs once per connected child, so a restart sends a new handshake. The constructor is `constructor(entryPath, logger, bootstrap)` (`:96`). `main.ts:78-79` builds it through the runtime's `createSupervisor(logger, entryPath, bootstrap)` port (`desktop-runtime.ts:30-34`); the only other caller is `harness-supervisor.test.ts:190` (`supervisorWith`).
    - `canonical-writer-package-smoke.ts:84`: the module-level `metadata = () => ({ messageId: randomUUID(), sentAt: new Date().toISOString() })`, used by the four protocol commands (`:466` handshake, `:573` activate, `:592` project command, `:715` switch). `runCanonicalWriterPackageSmoke(input: ProofInput)` (`:907`) takes `{ bootstrap, mainBundleDirectory, resourcesPath, signal }` (`:71-76`). `main.ts:125-135` calls it; the test calls it through `run()` (`canonical-writer-package-smoke.test.ts:56-62`) and records every message posted to the harness port in `sent` (`:124-127`).
  - **Not clock reads:** `canonical-writer-package-smoke.ts:740` (`proofId`) and `:761` (`requestId`) are writer-proof control ids, not protocol message metadata. The `performance.now()` deadlines are monotonic timers. `harness-log-lines.ts:83-136` formats a harness-supplied time. None changes.
  - **Tests at the base (green, measured):** `harness-supervisor.test.ts` 39, `canonical-writer-package-smoke.test.ts` 151, `canonical-writer-package-smoke-main.test.ts` 108, `desktop-runtime.test.ts` 10. The smoke-main test mocks `HarnessSupervisor` as a class whose constructor records nothing (`:108-122`), runs the real `makeDesktopRuntime` (`:149-163`), and mocks the writer runner (`ports.runner`, `:87-89`).
  - **CodeScene at the base:** 10 for `harness-supervisor.ts`, `canonical-writer-package-smoke.ts`, `main.ts`, `desktop-runtime.ts`, `harness-supervisor.test.ts`, `canonical-writer-package-smoke.test.ts` and `desktop-runtime.test.ts`; 9.68 for `canonical-writer-package-smoke-main.test.ts` (Primitive Obsession, known debt from p4-s9; Q20).
  - **Stryker at the base** (`stryker-range-anchors.json` rows): `desktop-s6` `main.ts:85-95` (row 21), `main.ts:379-379` (row 23), `canonical-writer-package-smoke.ts:300-341` (row 24); `desktop-s8` `harness-supervisor.ts:61-73`, `:176-233`, `:399-435` (rows 31-33); `harness-supervisor.ts` whole file in `stryker.project-storage-desktop.config.json` and `stryker.config.json`; `desktop-runtime.ts` whole file in `desktop-s6`, and `desktop-runtime.ts:166-189` (`bridgesLayer`, row 30) in `desktop-s7`. `desktop-runtime.test.ts` is in `vitest.desktop-s6-mutation.config.ts` and `vitest.desktop-s7-mutation.config.ts`; its fake ports are at `:98-110` (`createId`, `now`, `createSupervisor`). The coordinator's note named the `main.ts` ranges `83-93` and `369`; at `eeae135` they are `85-95` and `379-379`.
- **Deliverable (Q19 (b)):**
  - **`HarnessSupervisor` takes the clock.** The constructor gains a fourth parameter, `clock: Clock` (the type from `harness-request-core.ts`). `#connectChild` stamps each handshake with `clock.createId()` and `clock.now()`, read at that send, never cached. `randomUUID` leaves the file.
  - **The writer proof takes the clock.** `ProofInput` gains `clock: Clock`. Every protocol command the proof builds takes its `messageId` and `sentAt` from `input.clock`, read per command. The module-level `metadata` no longer reads `randomUUID` or `Date`. `proofId` and `requestId` keep `randomUUID`.
  - **The runtime hands the supervisor its clock.** `DesktopRuntimePorts.createSupervisor` gains a fourth parameter, `clock: Clock`. The supervision Layer calls it with the runtime's own `createId` and `now` ports, the same functions it gives `createHarnessBridges` (`desktop-runtime.ts:173`).
  - **"Latched stop" rewording (p4-s4 acceptance), comments only.** `desktop-runtime.ts:48` ("each with its own latched stop") and `:164-165` ("skips the bridges whose latched stop already ran") are rewritten to what the bridges do since p4-s4: each bridge's stop is idempotent (a second stop does nothing), and `release()` stops every bridge, then ends the core (`harness-bridges.ts:20-23`). `desktop-runtime.test.ts:21` and `:66` are reworded to match. `desktop-runtime.ts:122` ("one latched stop", the `owned` helper's `once`) is accurate and stays. Identifiers (`latch`, `latched`) are not renamed.
  - **`main.ts` owns the one clock.** One `Clock` value holds `randomUUID` and `() => new Date().toISOString()`. `main.ts` gives its `createId` and `now` to `makeDesktopRuntime`, its `createSupervisor` port passes the runtime's `clock` argument on to `new HarnessSupervisor`, and `main.ts` passes the same value as `clock` to `runCanonicalWriterPackageSmoke`. After the slice, `main.ts` is the only desktop main source that reads `new Date()` for a timestamp it sends.
  - **Tests:** scaffold edits with no assertion change: `supervisorWith` passes a fake clock; `run()` passes a fake clock; the smoke-main supervisor mock's constructor passes its arguments to `ports.supervisorCreated`, and the runtime mock records the ports it was given. `desktop-runtime.test.ts` needs none (its `createSupervisor` is a `vi.fn`). Then the rows below.
- **Q19 (decided (b), Pedro):** the runtime's `createSupervisor` port gains the clock, and the runtime passes its own `createId`/`now`, as for the bridges. Not taken: (a) `main.ts` closing over its clock in the port (the runtime would then not be the one distributor of its own clock ports).
- **Q20 (decided (a), Pedro):** `canonical-writer-package-smoke-main.test.ts` keeps its known debt (Primitive Obsession); the criterion is no lower than 9.68. Not taken: (b) refactoring it to 10 in this slice.
- **Q21 (decided (a), Pedro):** no per-slice run. The unit rows prove each stamp; the final `check:deep` carries `test:e2e` (every journey sends the handshake) and `package:launch-smoke` (the writer proof).
- **Non-goals:** no protocol, wire, IPC, preload or renderer change. No Effect `Clock` service or `DateTime` (Q9 (a) chose the desktop `Clock` port; the supervisor and the writer proof are not migrated to Effect here). No change to `proofId`, `requestId`, the `performance.now()` deadlines or `harness-log-lines.ts`. In `desktop-runtime.ts`, nothing changes but the supervisor's clock argument and the reworded comments; the bridge wiring, the Layers and `owned` are unchanged. The `Clock` type does not move. Under Q20 (a), no refactor of `canonical-writer-package-smoke-main.test.ts` beyond the scaffold.
- **Message and code ledger:** none.
- **Affected paths:**
  - `apps/desktop/src/main/harness-supervisor.ts`, `harness-supervisor.test.ts`;
  - `apps/desktop/src/main/canonical-writer-package-smoke.ts`, `canonical-writer-package-smoke.test.ts`;
  - `apps/desktop/src/main/desktop-runtime.ts`, `desktop-runtime.test.ts`;
  - `apps/desktop/src/main/main.ts`, `canonical-writer-package-smoke-main.test.ts`;
  - `stryker.desktop-s6.config.json`, `stryker.desktop-s7.config.json`, `stryker.desktop-s8.config.json`, `stryker-range-anchors.json` (line numbers only).
- **Stryker re-anchoring (lesson 3, same slice).** No entry is added or removed, and the counts do not change, so `check-stryker-ranges.test.mjs` is not edited. `pnpm check:mutation-ranges` on the candidate is the authority: it names each drifted entry, which is re-pointed by line (its first and last texts unchanged).

  | Config | Entry at `eeae135` | Why it may move | Anchor row |
  |---|---|---|---|
  | `stryker.desktop-s6.config.json` | `main.ts:85-95`, `main.ts:379-379` | the clock value and the `createSupervisor` change sit above both | 21, 23 |
  | `stryker.desktop-s6.config.json` | `canonical-writer-package-smoke.ts:300-341` | `ProofInput`, `metadata` and imports sit above it | 24 |
  | `stryker.desktop-s6.config.json` | `desktop-runtime.ts` (whole file) | does not move; it gains the supervisor clock argument's mutants, which P4-B38 kills (`desktop-runtime.test.ts` is in `vitest.desktop-s6-mutation.config.ts`) | none |
  | `stryker.desktop-s7.config.json` | `desktop-runtime.ts:166-189` (`bridgesLayer`) | the port type, the supervision call and the reworded `:164-165` comment sit above it | 30 |
  | `stryker.desktop-s8.config.json` | `harness-supervisor.ts:61-73`, `:176-233`, `:399-435` | the import change shifts all three; the clock field and constructor shift the last two | 31-33 |
  | `stryker.project-storage-desktop.config.json`, `stryker.config.json` | `harness-supervisor.ts` (whole file) | does not move; the new handshake stamp is mutated there, and P4-B33 kills its mutants | none |

  - Counts: `desktop-s6` stays 7 ranges and 6 whole files (`desktop-runtime.ts` is already whole); `desktop-s7` and `desktop-s8` keep theirs.
  - The mutation Vitest configs are not edited (no test file is added or moved).
- **Full-integration exposure:**
  - **In-process:** `canonical-writer-package-smoke-main.test.ts` loads the real `main.ts` (unit run).
  - **e2e:** every journey: the supervisor sends the handshake on every launch (`projects`, `registration`, `conversation`, `conversation-accessibility`, `project-upgrade`, `renderer-foundation`, `shell`). A malformed stamp fails the strict handshake decode in the harness.
  - **Smoke:** `package:launch-smoke` (handshake and writer proof in the packaged app); `package:smoke` runs the same writer proof.
  - **Harness integration:** none (the harness is not edited).
  - **The run:** none per slice (Q21 (a)).
- **Dependencies:** after s9 (accepted; shares `main.ts`). Last slice of Phase 4.

#### Test Contract: p4-s10-desktop-clock

Public seams: `HarnessSupervisor` with mocked Electron, observed through the port it posts the handshake on; `runCanonicalWriterPackageSmoke` with scripted children, observed through the messages it posts; `makeDesktopRuntime` with fake ports, observed through the arguments its `createSupervisor` port receives; the real `main.ts` with mocked Electron, observed through the ports it hands the runtime, the supervisor and the writer runner.

The fake clock in each test is a counter: the n-th `createId()` returns a fixed valid UUID ending in `n` and the n-th `now()` returns `2001-01-01T00:00:0n.000Z`, values no real read can produce.

- **Behavior P4-B33: the supervisor stamps each handshake with its injected clock.**
  - Test: `stamps the handshake with the injected clock` in `apps/desktop/src/main/harness-supervisor.test.ts`.
  - Oracle: after `start()` and `spawn`, the one message posted on the channel's `port2` is the handshake, with `messageId` and `sentAt` equal to the clock's first id and first time.
  - Expected red: at the base the handshake carries `randomUUID()` and the real time, so both equalities fail.
- **Behavior P4-B34: each child's handshake reads the clock afresh.**
  - Test: `reads the clock afresh for each child's handshake` in `apps/desktop/src/main/harness-supervisor.test.ts`.
  - Oracle: a first child exits and the supervisor restarts a second (the restart path the existing rows drive); the second child's handshake carries the clock's second id and second time, and `createId` and `now` were each called exactly twice.
  - Expected red: at the base neither handshake reads the clock, so the values and the call counts fail.
- **Behavior P4-B35: the writer proof stamps every protocol command with its injected clock.**
  - Test: `stamps every protocol command with the injected clock` in `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`.
  - Oracle: on the full passing sequence (`fullSequence()`, then `settle()`, status `passed`), every message in `sent` that has a `command` field carries a `messageId` the fake `createId` returned and a `sentAt` the fake `now` returned; no two share a `messageId`; and `createId` was called exactly as many times as there are such messages.
  - Expected red: at the base `metadata` reads `randomUUID()` and the real time, so no message carries a fake value.
- **Behavior P4-B36: `main.ts` gives the supervisor the runtime's clock.**
  - Test: `gives the supervisor the runtime clock` in `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`.
  - Oracle: in a normal launch, the supervisor's fourth constructor argument has `createId` and `now` identical (`toBe`) to the ports `makeDesktopRuntime` received; its `now()` returns an RFC 3339 UTC string between the times read before and after the call, and two `createId()` calls return two different UUIDs.
  - Expected red: at the base the supervisor gets three arguments, so the fourth is `undefined`.
- **Behavior P4-B37: `main.ts` gives the writer proof the runtime's clock.**
  - Test: `gives the writer proof the runtime clock` in `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`.
  - Oracle: in a writer-proof launch, the runner's `clock` input has `createId` and `now` identical (`toBe`) to that launch's runtime ports, with the same time bounds and distinct ids as P4-B36.
  - Expected red: at the base the runner input has no `clock`.
- **Behavior P4-B38: the runtime hands the supervisor the clock it was given.**
  - Test: `hands the supervisor the clock it was given` in `apps/desktop/src/main/desktop-runtime.test.ts`.
  - Oracle: once the services are built, `createSupervisor` was called once, and its fourth argument's `createId` and `now` are identical (`toBe`) to the `createId` and `now` ports the runtime received.
  - Expected red: at the base the port is called with three arguments, so the fourth is `undefined`.

**Bindings that bite (each on the candidate, each restored after):**
1. In `HarnessSupervisor`, read the clock once in the constructor and reuse that stamp. P4-B34 fails (the second handshake repeats the first id and time).
2. In `#connectChild`, keep `sentAt: new Date().toISOString()` beside `clock.createId()`. P4-B33 fails on `sentAt`.
3. In the writer proof, keep `randomUUID()` for `messageId`. P4-B35 fails.
4. In `main.ts`'s `createSupervisor` port, ignore the runtime's clock argument and give `new HarnessSupervisor` a second inline clock with the same functions' bodies. `gives the supervisor the runtime clock` fails on identity.
5. In `main.ts`, give the writer runner a clock whose `now` returns a fixed time. `gives the writer proof the runtime clock` fails (identity and the time bounds).
6. In `desktop-runtime.ts`, give `createSupervisor` `{ createId: ports.createId, now: () => new Date().toISOString() }`. P4-B38 fails on `now`.

**Order (red first):** the scaffold edits (all base counts unchanged: 39, 151, 108, 10), then the six P4-B33 to P4-B38 rows (red), then the supervisor (P4-B33, P4-B34 green), the writer proof (P4-B35 green), the runtime port (P4-B38 green), `main.ts` (P4-B36, P4-B37 green), the comment rewording, then the Stryker re-pointing (`check:mutation-ranges` green).

**Structural checks (on the candidate):**
- `rg -n "randomUUID|new Date\(" apps/desktop/src/main/harness-supervisor.ts`: no hit.
- `rg -n "new Date\(" apps/desktop/src/main/canonical-writer-package-smoke.ts`: no hit; `rg -n "randomUUID\(" apps/desktop/src/main/canonical-writer-package-smoke.ts`: `proofId` and `requestId` only.
- `rg -n "new HarnessSupervisor\(" apps/desktop/src --glob '!*.test.ts'`: `main.ts` only, with four arguments.
- `git diff <base> -- packages apps/harness apps/desktop/src/preload apps/desktop/src/renderer apps/desktop/src/shared apps/desktop/src/main/harness-log-lines.ts apps/desktop/src/main/harness-request-core.ts apps/desktop/src/main/harness-bridges.ts apps/harness/scripts/check-stryker-ranges.test.mjs`: empty.
- `rg -n "latched stop" apps/desktop/src/main/desktop-runtime.ts apps/desktop/src/main/desktop-runtime.test.ts`: `desktop-runtime.ts:122`'s `owned` TSDoc only.
- `git diff <base> -- stryker-range-anchors.json`: only line numbers change.
- `git diff <base> --stat` lists only the affected paths and this slice's evidence.

#### Success Criteria: p4-s10-desktop-clock

Automated (smallest first; each read by its real exit code; desktop main tests with `--config vitest.main.config.ts`):
- Green at `eeae135`, counts recorded: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/harness-supervisor.test.ts src/main/canonical-writer-package-smoke.test.ts src/main/canonical-writer-package-smoke-main.test.ts src/main/desktop-runtime.test.ts` (measured: 39, 151, 108, 10).
- After the scaffold edits, the same counts green; then each new row red for the predicted reason; then green at the candidate (41, 152, 110, 11).
- Each binding (1 to 6) observed red and then restored.
- `pnpm check:mutation-ranges` exit 0, counts unchanged.
- `pnpm typecheck`, then `pnpm check` exit 0 (read CPU first, in its own call). Knip exit 0. `pnpm check:duplicates` reports no clone.
- CodeScene 10 on `harness-supervisor.ts`, `canonical-writer-package-smoke.ts`, `main.ts`, `desktop-runtime.ts`, `harness-supervisor.test.ts`, `canonical-writer-package-smoke.test.ts` and `desktop-runtime.test.ts`; `canonical-writer-package-smoke-main.test.ts` no lower than 9.68 (Q20 (a)).
- No per-slice e2e or smoke run (Q21 (a)).
- Mutation: none for this slice; `desktop-s6`, `desktop-s7`, `desktop-s8` and `project-storage-desktop` run in the final Phase 4 mutation run.

Manual: none. The coordinator accepts the candidate (normal lane).

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
- **2026-11-01: p4-s4 accepted (coordinator; lane normal).**
  - **Accepted identity:** `1a82fb6` plus follow-up `603298b`, on `9649ef3` (p4-s3 polish) over main `c721b4c`. `pnpm check` 3881/3881; preflight clean; slice-verifier round 1 of 1 passed with one warning (V1). Red 23 failed, green 244/244; bindings 1-3 red (B2 one extra row, same guard).
  - **V1, base premise corrected:** at the base, an invalid workspace intent with a valid discriminator (`memory.proposal.review` with an invalid `projectId`) resolved a broken envelope (running: the invalid-command text; stopped: the stopped text). The statements above that no bridge answered an envelope for an invalid request are wrong for that case. Q13 (a) covers it: it now rejects `Invalid workspace request.`. Follow-up `603298b` adds two P4-B9 rows for it (running, stopped), red at `9649ef3` (2 failed: resolved a broken `WORKSPACE_TRANSPORT_FAILED` envelope) and green at the candidate (52/52); `withInvalid` now takes any `PropertyKey`.
  - **Accepted deviations:** `decodeReply`, `answerRequest` and `EchoRule` are no longer exported (Knip: unused after the move; bodies unchanged), against the non-goal wording "no change to decodeReply or answerRequest". `project-entry-bridge.ts` split `catalogOperations`/runner out of `entryOperations` for CodeScene 10 (was 9.58), re-anchored. The `harness-bridges.ts` TSDoc now says `release()` stops every bridge.
  - **For a later slice:** `desktop-runtime.ts:48`, `:164-165` and `desktop-runtime.test.ts:21`, `:66` still say "latched stop"; the slice that next touches `desktop-runtime.ts` rewords it.
- **2026-11-01: p4-s5 detailed (coordinator instruction); no open question.**
  - **Base:** candidate `603298b` on `fix/arch-review-phase-4`. Ranges re-measured there: desktop-s7 entry 75-194, storage 30-131, workspace 93-229; `stryker.config.json` entry-bridge 165-180 (`check:mutation-ranges` exit 0, `p4-s4-v1-mutation-ranges.log`). s5 re-points the storage and workspace ranges by line only; counts stay.
  - **Shape:** `bridgeFaultText(fault, { noun, stopped, echo })` in the core, as the Architecture section proposed; `bridgeNeutralText` folds into it. Texts are built inside the function, because Stryker's `ignoreStatic` skips module-load constants.
  - **Red:** P4-B12 (the owner's 17-row table) is red on the missing export. P4-B13 pins every storage and workspace text row. Bindings 1 to 3 prove the noun template, the stopped text and the shared arms each come from the owner.
  - **Not taken:** the "latched stop" rewording; s5 does not touch `desktop-runtime.ts`.
  - **Lane:** normal (`lane.mjs --paths`: fast, raised to the feature lane). The label is recorded on approval.
- **2026-11-01: p4-s5 accepted (coordinator; lane normal).**
  - **Accepted identity:** `bb61356` plus the polish `d885c9b`. `pnpm check` 3900/3900; preflight clean; slice-verifier round 1 of 1 passed with no finding.
  - **Polish:** `d885c9b` adds `workspaceFaultText` inside `workspaceBridgeOver` (no text change); the `desktop-s7` workspace range is now 91-200. The coordinator reviewed it, with no second verifier round.
- **2026-11-01: p4-s6 detailed (coordinator instruction); Q14 open.**
  - **Base:** `d885c9b` on `fix/arch-review-phase-4`. Every s6 line number was read at `bb61356` and is unchanged at `d885c9b`; the Stryker rows were re-read there (desktop-s7 entry 75-194, `stryker.config.json` entry 165-180).
  - **Shape, settled by evidence:** the harness rows join the activation `broken` arm as exact rows, not as codes in `canonicalProjectActivationDiagnosticCodes`, because that tuple is also the harness fatal-log vocabulary (`harness-fatal-log-protocol.ts:58`, `process-fatal-diagnostics.ts:87`). The two mappers sit in `project-entry-bridge.ts` beside the unavailable answers, so `project-entry-ipc.ts` and its six `desktop-s6` entries do not move and no Stryker count changes. Q1's "protocol-invalid row" is `harnessFailureRows.PROTOCOL_MESSAGE_INVALID`, so three distinct rows.
  - **Q14 (for Pedro), the scope of s6's own run (Phase 4 approval):** (a) on the candidate, one run each of `pnpm test:e2e`, the harness `test:integration` and `package:launch-smoke` (recommended: the version is on every handshake, and the edited fixtures serve most harness integration files); (b) only e2e `projects.test.ts` and `package:launch-smoke`, the rest at the Phase 4 final `check:deep`. The contract is written on (a).
  - **Red:** P4-B14 (14 bridge rows), P4-B15 (6 wire rows) and P4-B16 (3 version rows) are red at the base. P4-B17 moves the version literal in 10 files (whole-file, not re-proved). P4-B18 pins every kept answer; its new kept-unavailable test is green by design, and binding 3 proves it bites.
  - **Taken:** the `harness-failure-protocol.ts` TSDoc "both desktop mappers" is rewritten. **Not taken:** the "latched stop" rewording; s6 does not touch `desktop-runtime.ts`.
  - **Lane:** rigorous (Q6 (a)); `lane.mjs --paths` answers normal (files 11 > 5). The intent review (slice-verifier, code and coverage reviewers) runs on the coordinator's GO, before Pedro's approval. The label is recorded on approval.
- **2026-11-01: p4-s6 intent review, round 1 of 1 (coordinator GO; hash `78d28a0a`).**
  - **Outcomes:** slice-verifier failed (V1 violation, V2 warning); code reviewer failed (1 blocker, 2 concerns, 1 suggestion); coverage reviewer failed (4 concerns, 2 suggestions). All three completed a static read at `d885c9b`; none ran anything.
  - **Fixed (folded into the s6 section):**
    - V1, code blocker, coverage concern: `rejects activation replies for a different Project even with a matching message correlation` (`project-entry-bridge.test.ts:102-119`) pinned the flattened echo answer; s6 deletes it (P4-B14's echo row supersedes it), with a structural check.
    - V2, code polish: the version inventory missed `protocol.test.ts:1047` `toBe(9)` and the `:293` title; both join P4-B16 (5 tests); the site count is 9, not 10; the structural regex now covers `toBe(9)` and "protocol version 9".
    - Code and coverage concern: a mapper classifying by `fault.kind` passed every row. P4-B14 adds a send refused as `HARNESS_SESSION_MESSAGE_INVALID` per operation (16 rows), binding 5 and an `rg "faultMeaning\("` check.
    - Code concern: the nested `target-result.target` also accepts the harness rows at version 10. Stated in the Deliverable and Non-goals and pinned in P4-B15.
    - Coverage concerns: the switch `broken` exactness against the activation union (P4-B15 rejection, binding 6); the desktop-s7 first anchor must move to the first mapper (structural check).
    - Coverage suggestions: binding 7 for the fatal-log guard; each P4-B14 row also decodes the answer through its result schema.
  - **Not taken:** the shared `faultAnswer` owner over upgrade, activation and switch (code suggestion), left to the refactor gate if `check:duplicates` reports a clone, so `project-upgrade-failure.ts` stays out of s6. Alternatives (advisory): a desktop-only answer schema with no wire change (it reopens Q1 (a) and would add a second result schema family next to the one the preload decodes with); a full fault-matrix table; a renderer check of the broken text (needs a renderer edit, a non-goal).
  - **Stale approved text, not edited (append-only):** Verification Notes' "19 ranges and 33 whole files" (now 18 and 35); the Deferred Work s6 row (`project-entry-ipc.ts` is not edited; `project-list-runtime.integration` is not a version pin); Architecture's `project-entry-bridge.ts:49-77` cite. The s6 section is authoritative.
  - **Q14:** unchanged.
- **2026-11-01: p4-s6 contract approved; Q1 (a) kept; Q14 decided (a) (Pedro; coordinator).** After the rigorous intent review (round 1 of 1, findings folded in), Pedro approved hash `77d46ce16203…0cd7` (copy `approved-77d46ce1.md`). He kept Q1 (a) over the reviewer's desktop-only schema alternative. Q14 (a): on the s6 candidate, one run each of `pnpm test:e2e`, the harness `test:integration` and `package:launch-smoke`, alone, after Pedro's "livre".
- **2026-11-03: p4-s6 candidate review triaged by Pedro (rigorous).**
  - **Candidate:** `b0a4cc3` on `be54239`. Q14 (a) runs passed: e2e 27/27, harness `test:integration` 2234 passed / 6 skipped (host-gated) / 0 failed, `package:launch-smoke` exit 0. `pnpm check` 3923/3923. Preflight clean. Candidate review round 1: 0 blockers, 1 concern, 1 warning, 1 suggestion.
  - **Concern, fix:** P4-B15 did not pin code/message pairing; a cross-product schema would pass. A reject row (one code with another code's message, activation and switch) is added, red against a cross-product mutant first; `harnessRowSchema` becomes an explicit tuple of the three `exactRowSchema` calls. Fix commit reviewed by the coordinator; no second review round.
  - **Warning V1, accepted deviation (Pedro):** the two approved mappers `projectActivationFailure`/`projectSwitchFailure` share one `entryFailure(unavailableAnswer)` (CodeScene 9.38 -> 10 on `project-entry-bridge.ts`). Behavior unchanged. Bindings 1/2/3/5 now bite both operations (8, 6, 4, 2 failed). The structural checks naming two mappers read as one `entryFailure` holding `faultMeaning(` and `harnessFailureRows`. The desktop-s7 entry anchor `first` is the `entryFailure` line (`project-entry-bridge.ts:83-216`).
  - **Suggestion, run (Pedro):** a binding drops `|| sent-then-lost`; predicted 6 failed.
- **2026-11-03: p4-s6 accepted by Pedro (rigorous).**
  - **Accepted identity:** `b0a4cc3` + `7f43278` (cross-message reject rows, red 6 against a cross-product mutant; sent-then-lost binding 6 failed) + `e2b1d48` (completeness), on `be54239`. The coordinator reviewed both fix commits. `7f43278` made `harnessRowSchema` an explicit tuple on the coordinator's instruction; that lost completeness for a future code, so `e2b1d48` restored `wholeUnion(Object.values(harnessFailureRows).map(exactRowSchema))` (equal to `b0a4cc3`) and pinned `codes` against `Object.keys(harnessFailureRows)` (red 2 with a hypothetical extra key). Protocol 362/362; CodeScene 10; `pnpm check` 3923/3923 at `7f43278`.
  - **Mutation:** Pedro chose one Stryker run on the final Phase 4 candidate, not one per slice.
- **2026-11-03: p4-s7 detailed (coordinator instruction); Q15 open.**
  - **Base:** `e2b1d48`. Static reads, plus two read-only runs in the Phase 4 worktree: `check:mutation-ranges` (exit 0; `desktop-s6` 14 ranges, 2 whole files) and the baselines of `workspace-bridge.test.ts` (39), `canonical-writer-package-smoke-main.test.ts` (80) and `check-boundaries-parse.test.mjs` (2, from the root). `depcruise --include-only` confirmed the two `main.ts` importers (static and dynamic).
  - **Facts not in the Deferred Work row:** the two moved tests need four fixtures shared with `workspace-bridge.test.ts`, which a copy would make a jscpd clone, so a `workspace-test-peers.ts` joins the slice. `vitest.desktop-s7-mutation.config.ts` must also name `workspace-ipc.test.ts`: the moved rows are the literal pins of the `workspace-bridge.ts` closing answers in the `desktop-s7` range. The `desktop-s6` entries `main.ts:94-104` and `:406-406` shift with the move, not only `:273-288`. The boundaries test runs from the root only.
  - **Settled in the contract (not asked):** the `desktop-s6` entry moves as a range over the same function, so counts and the real-repository row stay; a whole-file entry is left to s8.
  - **Q15 (for Pedro), the s7 run:** (a) none per slice; the final `check:deep` carries e2e and `package:launch-smoke` (recommended); (b) one `package:launch-smoke` on the s7 candidate.
  - **Not taken:** the "latched stop" rewording; s7 does not touch `desktop-runtime.ts`.
  - **Lane:** normal by override (Q6 (a)); `lane.mjs --paths` answers rigorous (files 8 > 5; `ipc`). The label is recorded on approval.
- **2026-11-03: p4-s7 contract approved; Q15 decided (a) (Pedro; coordinator).** Pedro approved hash `043dddf9ef6e…3938` (copy `approved-043dddf9.md`), lane normal by the Q6 override (lane.mjs answers rigorous). Q15 (a): no per-slice heavy run; the final check:deep carries `test:e2e` and `package:launch-smoke`.
- **2026-11-12: p4-s7 accepted (coordinator; normal lane).** Candidate `e34a84f` on `0a67690` (rebased onto main `29b46a6`; s1-s6 code identical to `e2b1d48`). Red-first: P4-B19 2 failed / 3 passed; real-repository `check:boundaries` red on exactly `workspace-bridge.test.ts -> main.ts`, then green; ranges red on exactly the 3 `main.ts` entries, re-pointed to `main.ts:83-93`, `workspace-ipc.ts:32-47` and `main.ts:369-369` (counts 18/35, desktop-s6 14/2, desktop-s7 6/3). Bindings 1-4 bite and were restored by digest. `pnpm check` exit 0 (121 files, 3927 tests); typecheck, knip and jscpd (0 clones) exit 0; CodeScene 10 on the 5 source files; preflight clean; slice-verifier round 1 passed with no findings. Coordinator diff read: both functions moved byte-identical, the rule excludes only the smoke wiring test, `workspace-test-peers.ts` follows the `harness-session-test-peers.ts` precedent.
  - **Noted, not changed:** the moved `keeps workspace IPC handlers narrow and validated` test sits at file level in `workspace-ipc.test.ts` (its `describe('WorkspaceBridge')` prefix is gone; the it-title is unchanged); both moved tests are now top-level, which fits a file without a `WorkspaceBridge`. The `main.ts` line cites in the approved p4-s7 text (`419/421`, `94-104`, `406`) are pre-move measurements and stay as written (append-only); the entries in `stryker-range-anchors.json` are authoritative.
  - **needs-run (planned):** `package:launch-smoke`, `test:e2e` and the desktop-s6/s7 Stryker run on the final Phase 4 candidate (Q15 (a)).
- **2026-11-12: p4-s8 detailed (coordinator instruction); Q16 and Q17 open.**
  - **Base:** `e34a84f`. Static reads, plus read-only runs in the Phase 4 worktree: `check:mutation-ranges` (exit 0; `desktop-s6` 14 ranges, 2 whole files) and the IPC test baselines (`project-entry-ipc` 9, `project-registration-ipc` 8, `workspace-ipc` 3, smoke-main 80).
  - **Facts the contract rests on:** the unchanged closed-gate rows call each handler with an invalid value and expect a synchronous throw, so the helper must decode synchronously and before the gate. The gate type is written three times (two inline, one local `IpcGate`); the helper module owns it.
  - **Stryker, settled in the contract:** `ipc-gate.ts`, `project-entry-ipc.ts` and `workspace-ipc.ts` become whole-file `desktop-s6` entries (the last closes s7's deferral, replacing `workspace-ipc.ts:32-47`); `registerProject`'s gate line becomes the range of its helper call; `chooseRepository`'s two lines stay. `desktop-s6` goes 14/2 → 7/5, red-first through the real-repository row (P4-B25). `project-registration-ipc.ts` is not made a whole file (its dialog path was never in `desktop-s6`).
  - **Q16 (for Pedro), the non-gated variant:** (a) in s9, where the sender check gives it a job (recommended); (b) in s8 as a pass-through, adding `main.ts` to s8.
  - **Q17 (for Pedro), the s8 run:** (a) none per slice; the final `check:deep` carries e2e and `package:launch-smoke` (recommended); (b) one `pnpm test:e2e` on the s8 candidate.
  - **Not taken:** the "latched stop" rewording; s8 does not touch `desktop-runtime.ts`.
  - **Lane:** normal by override (Q6 (a)); `lane.mjs --paths` answers rigorous (files 7 > 5; `ipc`). The label is recorded on approval.
- **2026-11-12: p4-s8 contract approved; Q16 (a), Q17 (a) (Pedro; coordinator).** Pedro approved hash `8b17cdf5b1ac…530b` (copy `approved-8b17cdf5.md`), lane normal by the Q6 override (lane.mjs answers rigorous). Q16 (a): the non-gated variant lands in s9 with the sender check. Q17 (a): no per-slice run; the final `check:deep` carries `test:e2e` and `package:launch-smoke`.
- **2026-11-12: p4-s8 accepted (coordinator; normal lane).** Candidate `91669c2` on `fe86793` (the branch rebased onto main `b5501d3`; the code is the same as `e34a84f`). The slice text still says Q16 and Q17 are open; both were decided (a) in the approval entry above. Red-first: P4-B25 1 failed (14/2 against 7/5), then green; P4-B23 red at import, then 6/6. P4-B24 counts unchanged (9/8/3/80). `check:mutation-ranges` green, 7 ranges and 5 whole files. Before the re-point, the check named only `workspace-ipc.ts:32-47` (BROKEN) and none of the 7 drifted entries, because `checkStrykerRanges` reports only the first problem class (`check-stryker-ranges.mjs:231`). That was a prediction miss, not a weaker proof: the coordinator chose to take P4-B25 as the red-first and the green run as the check over every entry. `pnpm check` exit 0 (122 files, 3933 tests); typecheck, biome, knip and jscpd (0 clones) exit 0; CodeScene 10 on the 5 files; preflight clean; slice-verifier round 1 passed with no findings. Coordinator diff read: `handleGatedIpc` decodes, then reads the gate, then answers closing or forward; the nine handlers keep their channel, schema, closing answer and forward; `chooseRepository` and the capability handler are unchanged.
  - **Bindings, differences from the contract lists (predicted with reasons before the runs):** binding 1 fails 9 rows, not every closed row: 4 of the 6 project-entry closed rows, the `registerProject` row, the 2 workspace closed rows and the 2 helper invalid-value rows. The activation and switch closing answers decode their request strictly themselves, so an invalid value still throws there. P4-B23 pins the decode-before-gate order for every handler, because all nine share the one helper. Binding 2 fails 14 rows, binding 3 fails 1, and binding 4 fails 2 (the closed `submitWorkspaceIntent` row also decodes an intent).
  - **For s9 (implementer note):** s9 must decide how the expected window identity reaches the helper: through the gate object, a new parameter, or module state. That choice may touch `project-entry-ipc.ts`, `workspace-ipc.ts` or the `{ accepting }` literals in their tests, which the s9 Deferred Work row does not list.
  - **needs-run (planned):** the final `check:deep`, and the desktop-s6 Stryker run, whose scope grew to 3 more whole files.
- **2026-11-12: p4-s9 detailed (coordinator instruction; static reads only); Q18 open.**
  - **Base:** `91669c2`. No test, gate, Stryker or agent run (Pedro needed the machine). Stryker counts are read from the configs and the real-repository row (`desktop-s6` 7/5), not re-run.
  - **Facts the contract rests on:** the handlers are registered before the window exists, and the renderer can invoke while `loadFile` is still pending, so the window must be tracked right after `new BrowserWindow`, before the load (binding 4). Windows can be recreated (`activate`), so identity is per created window. `senderFrame` is read synchronously (Electron: `null` after navigation). Under `loadFile` the origin is `file://`, so the rule compares frame identity (`processId`, `routingId` against `event.sender.mainFrame`), never the origin (Q2 (a)). The smoke-main test calls handlers with `{ sender: {} }`, so its window mock and `ipcHandler` gain a real-shaped sender; no assertion changes.
  - **Q18 (for Pedro), the implementer's open point, how the sender rule reaches the handlers:** (a) a new `sender` parameter beside the gate, in both helpers and the three register functions (recommended; the contract is written on it); (b) widen `IpcGate` with `admit`; (c) module state set by `main.ts`. Each option edits the tests' register calls; only (a) keeps shutdown and identity apart and serves the non-gated handlers without a gate.
  - **Approach check (rigorous):** rejected (b) and (c) above; rejected an origin allowlist (Q2 (b), settled); rejected an e2e foreign-frame row (the preload exposes the API to the main frame only, so a real foreign frame cannot reach a channel; the refusal is proven by unit rows, the admission by the e2e run).
  - **Intent review:** planned on the coordinator's GO, three read-only agents on this hash, one round (section "Intent review plan").
  - **Not taken:** the "latched stop" rewording; s9 does not touch `desktop-runtime.ts`.
  - **Lane:** rigorous (Q6 (a)); `lane.mjs --paths` answers rigorous (files 9 > 5; `ipc`). The label is recorded on approval.
- **2026-11-12: p4-s9 Q18 decided (a); intent review round 1 of 1 triaged and folded (Pedro; coordinator).**
  - **Q18 (a):** a new `sender` parameter beside the gate, in both helpers and the three register functions; grouping `{ gate, sender }` in one argument is the implementer's choice (R12); the sender stays its own rule.
  - **Review (on `c738013c…b345`, static only):** slice-verifier passed (4 warnings); code reviewer failed (5 concerns, 1 suggestion); coverage reviewer failed (1 blocker, 5 concerns, 3 suggestions). Table and triage: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s9-intent-review.md`.
  - **Pedro's triage: fix all.** R1 blocker (an admit-all sender in `main.ts` passed every check): the entry-seam table over every invoke channel (P4-B29) and the admission table (P4-B30), with bindings 13 and 14. R2 smoke-main scaffolding (logger `warn`, supervisor `getStatus`/`retry`, `dialog`, `fromWebContents`, per-instance windows; `track` uses `once("closed")`). R3 reds at named Order steps, literal text in module tests, binding 2. R4 closed window never read (binding 9). R5 main frame read per call (binding 8). R6 reopened window tracked (binding 13). R7 every refusal logs once (binding 10). R8 one-property fakes with bindings 4-6. R9 `admit` gets the helper's own channel and event (binding 3). R10 no Stryker range on the `track` line (`desktop-s6` 7/6). R13 structural types. R14 whole-text match. R15 dialog-owner row (binding 17). R16 main logger asserted (binding 16). Polish folded.
  - **R11 ratified:** the sender rule is a closure-state factory at the IPC edge (precedent `createDesktopShutdown`), under the non-goal of not moving the IPC edge onto the Effect runtime; recorded in the Deliverable.
  - **Not taken:** the stateless `BrowserWindow.fromWebContents` rule (implicit allowlist; DevTools/`WebContentsView` ownership unverified); coverage alternative A2 (a 32-row truth table; the one-property rows and bindings cover it). Coverage alternative A1 taken (R1).
  - **Behavior IDs** (renumbered inside this unapproved slice): P4-B26 rule, P4-B27 helpers, P4-B28 module channels, P4-B29 entry refusals, P4-B30 entry admissions (pin), P4-B31 unchanged answers (pin), P4-B32 Stryker row.
  - **No second review round** (Pedro). The s10 Deferred row's missing `main.ts` `desktop-s6` ranges are left to s10's contract.
- **2026-11-12: p4-s9 contract approved (Pedro; coordinator).** Pedro approved hash `8aaf8757597d…99bf` (copy `approved-8aaf8757.md`), lane rigorous (lane.mjs agrees). Q18 (a), R11 and R12 ratified; the stateless alternative is not taken. The s9 run (`test:e2e`, `package:launch-smoke`) runs alone on the candidate, after Pedro says "livre" and the coordinator gives GO. Pedro accepts the candidate.
- **2026-11-12: p4-s9 accepted by Pedro (rigorous).** Final candidate `9192e45` + `d7a4902` (docs) + `eeae135` (review fix round), on `8db84db` (the branch rebased onto main `d2d8e3f`). Reds at the named Order steps; bindings 1-17 bite (row sets for 2, 3, 6 and 14 differ from the contract lists, each predicted with its reason before the run). `pnpm check` exit 0 (123 files, 3985 tests). The s9 run on `9192e45`: `pnpm test:e2e` 27 passed, and `package:launch-smoke` exit 0 (logs `p4-s9-e2e.log`, `p4-s9-launch-smoke.log`); the fix round changed only tests and TSDoc, so there was no rerun. Preflight clean.
  - **Candidate review round 1** (`p4-s9-candidate-review.md`): slice-verifier passed with 2 warnings, code reviewer passed with 1 suggestion, coverage reviewer failed with 1 concern and 3 suggestions; no blocker. Pedro fixed all of them in one round, and the coordinator reviewed the fix diff: every fake frame carries a URL and the refusal log matches exactly; events copy the frame; a two-window closed row; invoke channels derived from `desktopIpcChannels`; TSDoc on both register functions.
  - **Deviations accepted by Pedro:** V1, `ipcSenderRefusedMessage` is not exported, because Knip fails an export no test may import (text and assertions unchanged). V2, the P4-B31 dialog-owner row was written after step 6; it was then run once against the base sources and passed, as predicted.
  - **Known debt (Pedro, option (a)):** `canonical-writer-package-smoke-main.test.ts` scores CodeScene 9.68, the same as at the base (Primitive Obsession, pre-existing). The slice added a Large Method and removed it again (`answerOpenPaths`). Raising the file to 10 is left for a later slice.
- **2026-11-12: p4-s10 detailed (coordinator instruction); Q19, Q20, Q21 open.**
  - **Base:** `eeae135` (p4-s9 accepted). Read there, and the three touched test files run green there (39, 151, 108; `desktop-runtime.test.ts` 10). CodeScene read at the base: 10 on the five source and test files, 9.68 on `canonical-writer-package-smoke-main.test.ts`.
  - **Shape:** Q9 (a) as approved: the supervisor and the writer proof take the desktop `Clock`; `main.ts` holds the one clock value. The contract is written on Q19 (a).
  - **Facts the contract rests on:** the supervisor is built through the runtime's `createSupervisor` port, which `main.ts` writes, so (a) reaches it without editing the runtime. The handshake runs once per connected child, so the stamp is read per send (P4-B34). `proofId` and `requestId` are writer-proof control ids, not protocol metadata, and keep `randomUUID`.
  - **The `main.ts` `desktop-s6` ranges** the s10 Deferred row omitted are taken here: `main.ts:85-95` and `:379-379` at `eeae135` (the coordinator's `83-93` and `369` were older lines).
  - **"Latched stop" rewording:** taken only under Q19 (b), which edits `desktop-runtime.ts`; not taken under (a). `desktop-runtime.ts:122` is accurate and stays either way.
  - **Known debt:** `canonical-writer-package-smoke-main.test.ts` (9.68) is named as Q20, an option, not a commitment.
  - **Approach check:** rejected an Effect `Clock` service (Q9 (a) settled the desktop port); rejected moving the `Clock` type out of `harness-request-core.ts` (no second consumer needs it moved); rejected clocking `proofId`/`requestId` (not message metadata).
  - **Lane:** normal; `lane.mjs --paths` answers normal (files 6 > 5). The label is recorded on approval.
- **2026-11-12: p4-s10 Q19 (b), Q20 (a), Q21 (a) decided; contract folded on (b) (Pedro; coordinator).**
  - **Q19 (b):** the runtime's `createSupervisor` port gains the clock and the runtime passes its own `createId`/`now`, as for the bridges. This adds `desktop-runtime.ts` and `desktop-runtime.test.ts` (P4-B38, binding 6) and takes the "latched stop" rewording (`desktop-runtime.ts:48`, `:164-165`; test `:21`, `:66`; `:122` stays). Stryker: `desktop-runtime.ts` is already a whole file in `desktop-s6` (counts stay 7/6); `desktop-s7`'s `desktop-runtime.ts:166-189` (row 30) may shift and is re-pointed by line.
  - **Q20 (a):** `canonical-writer-package-smoke-main.test.ts` keeps its debt; criterion no lower than 9.68.
  - **Q21 (a):** no per-slice run; the final `check:deep` carries `test:e2e` and `package:launch-smoke`.
  - **Lane:** normal; `lane.mjs --paths` over the eleven paths answers normal (files 7 > 5). The label is recorded on approval.
  - **Approval:** Pedro said he approves the contract once it is written on (b), relayed by the coordinator. The approval of this exact hash is recorded when the coordinator confirms it.
- **2026-11-12: p4-s10 contract approved (Pedro; coordinator).** Pedro approved the contract on the condition that it was written on Q19 (b). The coordinator checked the folded hash `4a04fb87f902…aae6` (copy `approved-4a04fb87.md`): additions only, validate OK, and Q19 (b), Q20 (a) and Q21 (a) recorded. That hash is the approved one. Lane normal.
- **2026-11-13: p4-s10 accepted (coordinator; normal lane).** Candidate `6a86a32` on `83ff857` (the branch rebased onto main `92a772f`; the code is the same as `eeae135`). The 6 rows P4-B33 to P4-B38 were red as predicted and then green; bindings 1-6 bite. `check:mutation-ranges` exit 0: 6 entries re-pointed by line, counts unchanged. `pnpm check` exit 0 (124 files, 3991 tests); biome, typecheck, knip and jscpd (0 clones) exit 0; preflight clean; slice-verifier round 1 passed with 1 warning (V1, below). Coordinator diff read: `HarnessSupervisor` and the writer proof stamp from the injected `Clock`; `main.ts` holds one `desktopClock`; the runtime hands the supervisor its own `createId`/`now`; the "latched stop" comments are reworded and no identifier is renamed.
  - **Deviation (c), chosen by Pedro.** The P4-B33/B34 rows pushed `harness-supervisor.test.ts` over the CodeScene file-size threshold (9.38; it was 10 at the base). The coordinator recommended against moving the clock rows, because the contract's Test lines name that file. Pedro chose to move `describe("harness upgrade log lines")` byte-identical to `harness-supervisor-log-lines.test.ts`, with the shared helpers in the test-only `harness-supervisor-test-peers.ts`. The rows split 25 + 16 = 41, with identical titles, and CodeScene is back to 10. The new file joins `vitest.desktop-s7-mutation`, `vitest.desktop-s8-mutation` and `vitest.project-storage-mutation`, so the desktop-s8 and project-storage killers stay in the run.
  - **Approved statements that the deviation makes literally false (V1; they stay as written, append-only):** the `new HarnessSupervisor(` structural check (`!*.test.ts`) also hits the test-only peers file; `--stat` lists 5 more paths; "mutation Vitest configs not edited"; and the one-file count 41 is now 25 + 16. The Lane line says "eleven planned paths", but the list has twelve; the lane answer is the same.
  - **CodeScene:** 10 on every touched file except `canonical-writer-package-smoke-main.test.ts`, which stays at 9.68 (Q20 (a)).
  - **needs-run:** the final mutation run (the desktop-s8 and project-storage killers now live in the log-lines file) and the final `check:deep` (`test:e2e` for the handshake, `package:launch-smoke` for the writer proof).
- **2026-11-13: the final mutation run was cut short (Pedro); one survivor killed; the rest is issue #147.** On `14d6e5a`, four configs finished: desktop-s6 95.06 (earlier 94.23), desktop-s7 97.96 (earlier 97.76), desktop-s8 98.41 (earlier 98.41) and project-storage-desktop 90.04 (no earlier run). Pedro stopped `stryker.config.json` at 2171 of 3517 mutants, because the run was taking too long; it has no score, so the Phase 4 protocol changes have no mutation run. No regression: no config scored lower, and the p4-s10 test split lost no killer. This replaces the earlier plan (survivors killed or argued) for everything but one mutant.
  - **Killed (Pedro's triage):** `ipc-sender.ts:41`, the `closed` event name. The fake window ignored the name. Commit `cab5002` (test only) makes the fake fire only `closed` listeners; the manual mutant `window.once("")` failed exactly the 2 predicted rows; `pnpm check` exit 0 (3991 tests); `p4-s10` polish `14d6e5a` (ADR 0023 pointer) sits under it.
  - **Left as debt, GitHub issue #147 (`needs-triage`):** the unfinished `stryker.config.json` run; 5 survivors in code Phase 4 wrote or moved (`harness-request-core.ts:49`, `:76`, `:253`; `project-entry-bridge.ts:83`; `workspace-bridge.ts:171`), probably equivalent or static but not confirmed; the `logger.ts` redaction survivors (privacy, older code); and the older survivors in `desktop-runtime.ts`, `writer-proof-report.ts`, `bounded-log-destination.ts`, `crash-reporting.ts` and `harness-supervisor.ts`. Logs: `p4-final-mutation-*`.

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
- `p4-s4-request-skeleton`: `.rpiv/artifacts/evidence/2026-11-01_p4-s4-request-skeleton-tdd.md`; accepted at `1a82fb6` + `603298b`; preflight clean; slice-verifier round 1 passed.
- `p4-s5-bridge-fault-text`: `.rpiv/artifacts/evidence/2026-11-01_p4-s5-bridge-fault-text-tdd.md`; accepted at `bb61356` + `d885c9b`; preflight clean; slice-verifier round 1 passed.
- `p4-s6-activation-switch-broken`: `.rpiv/artifacts/evidence/2026-11-02_p4-s6-activation-switch-broken-tdd.md`; candidate `b0a4cc3` + the review fix commit after it (base `be54239`); Q14 runs green at `b0a4cc3`; preflight clean; candidate review round 1 (0 blockers), triaged by Pedro; review table `p4-s6-candidate-review.md`.
- `p4-s7-workspace-ipc-module`: `.rpiv/artifacts/evidence/2026-11-12_p4-s7-workspace-ipc-module-tdd.md`; accepted at `e34a84f` (base `0a67690`); preflight clean; slice-verifier round 1 passed.
- `p4-s8-gated-ipc-helper`: `.rpiv/artifacts/evidence/2026-11-12_p4-s8-gated-ipc-helper-tdd.md`; accepted at `91669c2` (base `fe86793`); preflight clean; slice-verifier round 1 passed.
- `p4-s9-ipc-sender-check`: `.rpiv/artifacts/evidence/2026-11-12_p4-s9-ipc-sender-check-tdd.md`; accepted by Pedro at `9192e45` + `d7a4902` + `eeae135` (base `8db84db`); test:e2e 27 passed, package:launch-smoke exit 0; preflight clean; candidate review round 1 (0 blockers), triaged by Pedro; review table `p4-s9-candidate-review.md`.
- `p4-s10-desktop-clock`: `.rpiv/artifacts/evidence/2026-11-13_p4-s10-desktop-clock-tdd.md`; accepted at `6a86a32` (base `83ff857`); preflight clean; slice-verifier round 1 passed (1 warning, recorded).
