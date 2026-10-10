---
date: 2026-10-09T13:54:08+0100
author: Pedro Mesquita
commit: 9aab1cc
branch: main
repository: slopstop
topic: "Conversation C1: save and reopen messages locally, no model"
tags: [design, conversation, storage, upgrade, protocol, coordinator, desktop, c1]
lane: rigorous
lane_reasons: ["files: 6 > 5", "weak sensitive word: schema", "sensitive word: preload"]
status: ready
last_updated: 2026-10-11T00:30:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Approved by Pedro on 2026-10-10 (revision 5.3, content_hash e05cac0b6573365816e033a2490dbd0cd0f4a0898e26b1d61274839b9d369180; decisions log §46): G29, G30, the composed-IPC re-deferral and the G24 copy approved; G25 confirmed; G28 accepted as a temporary exception whose end trigger is #123 Effect unit 2b, scheduled in phase 2 right after C1 and before C2 (this supersedes the trigger text in G28 and Deferred Work; the decisions log is authoritative). The coordinator checked every rev-5.2 verifier item in 5.3. Approved copy under .rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/. S4a may start. Earlier: Revision 5.3 (every rev-5.2 bounded-verifier item applied, Pedro's choice, decisions log §45: stale activation shows its notice without an action and the recovery is a recorded gap; no new agents; the coordinator checks each item, then Pedro approves). Revision 5.2 (after S4 intent review round 2, the last, which failed with 2 blockers; Pedro chose option A, decisions log §44: every round-2 item fixed, #130 per-window CSP owner folded in, then one bounded verifier limited to the fixes, then Pedro approves). Revision 5.1 (after S4 intent review round 1, which failed: 9 blockers, all fixable; every finding resolved, see the Revision-5 round-1 resolution table; adds G29 CSP-in-page and G30 S4a merges with S4b, both for Pedro). Revision 5 (2026-10-10, for S4 only; decisions log §42 at 9e06d55 and §43 at 6a41350): S4 is built in React from the hero prototypes and split into S4a renderer foundation and S4b Conversation window; only the Conversation region is restyled; the old prototype window is deleted; the ui-ux agent's visual answers, the per-slice accessibility checklist, the bridge fault split and the stale-fact fixes are folded in. S1-S3 commitments unchanged. Needs an independent intent review of S4a and S4b (rigorous lane, at most two rounds) before Pedro approves. Earlier: Approved by Pedro on 2026-10-10 (revision 4.3, content_hash 5ff869b7b774e2cc6bd1143ef507488868b9c2020ae0e80840e7576649df2e19; decisions log §37); approved copy under .rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/. S3 (#107) may start. Revision 4.3 (every rev-4.2 bounded-verifier finding applied, Pedro's choice; the coordinator checks each item, then Pedro approves; no new review agents). Revision 4.2 (after S3 intent review round 2, the last; Pedro chose option A, decisions log §36: fix every round-2 item, then one verifier limited to the fixes). Revision 4.1 (after the S3 intent review round 1, which failed: six verified blockers, all fixable). Revision 4, for slice S3 before #107 (coordinator hand-off, 2026-10-10). Adds the CNV-B13 read-after-admission-closes rows (U2, decisions log §29), and folds in what S2 changed: deviation 6a (the dedicated WRITER_CLIENT_ABANDON_FAILED release code arrives with protocol v8, CNV-B36), U3 (a failed settlement keeps the S1 retry-at-release), the round-3 rule that admission closes inside the writer slot (§32), and #102 fixed inside S3 (CNV-B37). Facts for S3 re-verified at main 80228ac. Behaviour IDs kept; S1 and S2 commitments unchanged. Needs an independent intent review (rigorous lane) before Pedro approves."
content_hash: e05cac0b6573365816e033a2490dbd0cd0f4a0898e26b1d61274839b9d369180
---

# Design: Conversation C1 — save and reopen messages locally, no model

Lane: rigorous (`lane.mjs --paths`, 2026-10-09: files > 5; `schema`, `preload`). The coordinator runs the three-role intent review (at most two rounds), and Pedro approves. Workspace: a linked worktree (Pedro, decisions §19).

## Intent

In the active Project, the user writes a message in the primary Project conversation and presses "Save locally". The message is saved durably in that Project's database. It is shown again, with the same identity, text and order, after switching Projects and after an app restart. No model is connected: the window says "No model is connected yet. Messages are saved on this computer." (decisions §4).

The first Conversation tables raise the canonical Project database from schema 3 to 4. Every existing Project reaches schema 4 through the C1-0 staged-upgrade engine, which the desktop runs automatically on activation. This includes Projects already upgraded once, through chained upgrades (Q1), and registered Projects, whose registration receipts survive the upgrade.

**Authoritative inputs**
- Brief: `.rpiv/artifacts/handoffs/2026-10-05_conversation-c1-local-save-brief.md`.
- User decisions: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` as committed in `679b9ae` (content hash `bceafed85b9fd06dd7fd98ddd2ea28bbe027426e452fe4194fb9c1bb3a6fcef5`):
  - §3–4: save and reopen first; the "Save locally" wording; the 32 KiB limit; option A for existing Projects.
  - §14–15 and §17–18: the visual structure belongs to the UI/UX agent. This design fixes behaviour and seams, not pixels. Revision 5 narrows this for S4: the Conversation region's look comes from the hero prototypes, DESIGN.md and the ui-ux agent's answers (G24), which this design records but does not own.
- For revision 5 (S4 only): decisions log §17, §22, §24, §27 (:359, Runa v2), §33 and §42 at `9e06d55`, §43 at `6a41350`; `DESIGN.md`; `C:/Users/pedro/Documents/ragnarok-hero/PORT-PLAN.md`, the hero sources it names, and the 12-point checklist `access.src.html:381-393`; the ui-ux agent's answers V1–V7 and the designer's reconciliations R1–R4 (2026-10-10, through the coordinator).
  - §16: the Q1–Q3 answers and agent roles.
  - §19: the linked worktree and the C1 merge order (S1 merges only together with S2).
- The same log as committed in `59a8d9b` (file SHA-256 `46c535c6e48eaf3b50b237b5c3cb11cde8428542bc0ea759a3a23f3ed04a9619`), for revision 4 only:
  - §28: deviation 6a (the dedicated release code waits for protocol v8) and deviation 6b;
  - §29: U2 (read routing after the writer's admission closes belongs to S3's CNV-B13) and U3 (a failed settlement keeps the S1 retry-at-release);
  - §30: the names Strand, Weave and Forger, used in new text only;
  - §32: the bounded S2 round 3, whose fix B makes a failed settlement close admission inside the writer slot.
- §36 of the same log (commit `e59bbb7`): option A for revision 4.2 and one verifier limited to the fixes; deviation 6b extended to S3's CNV-B14; the G17 extension accepted. `git diff --name-only 80228ac 7a1b041` lists only the decisions log, so the S3 source anchors at `80228ac` hold at `7a1b041`.
- S2 result: `.rpiv/artifacts/evidence/2026-10-09_c1-s2-tdd-evidence.md` ("Design-vs-result gaps", "U2", "U3", "Review round 3"), merged in `ba4e15b`.
- Inherited requirements: `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-brief.md`.
  - The parts used are "Proposed ownership" (:39-46), "Inherited and settled" (:76-83), "Proposed product behavior" (:85-89) and the Conversation contract (:206).
  - Its source anchors are stale. The facts below are re-verified at `9aab1cc`.
- `PRODUCT.md` :55, :62; ADR 0004 :14; ADR 0005 amendment :38-52; ADR 0006 :50, :57, :58, :97, :147-150; ADR 0009 Amendment 1 :267.
- C1-0 designs:
  - parent `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`. Its :264 and :286 are the C1-gate items for registered Projects and the chain root.
  - S3b `.rpiv/artifacts/designs/2026-10-06_18-48-25_upgrade-window.md`: the bridge pattern, and Deferred Work :339-350.
- GitHub #92 (chained upgrades at the C1 gate) and #93 (not touched).

**Non-goals**
- Any model call, dummy reply, Context proposal or record.
- Branching beyond the root branch; attachments; Waypoint conversations; `#`/`@`; `To:`.
- Durable drafts: unsaved text is kept in memory per Project, not across a restart.
- Frame, Decisions and Memory.
- The visual port of the shell (rail, header, Projects sidebar, title bar) and the final app layout (G21).
- The full Storage-operation journal (#92) and the Mastra head (#93).
- Changing the workspace `conversation.*` contracts.

**Constraints**
- AGENTS.md boundaries and strict decode; Effect for new harness code.
- `degrade-distinguishes-broken`; `shared-vocab-union`.
- Saving never changes `project_state`, `command_receipts`, `command_idempotency` or `canonical_events` (ADR 0006 :57).
- Additive migrations only (ADR 0005 amendment :43).
- One squash commit per slice; at most two review rounds per slice.

## Precedents and lessons

- **C1-0 witness race** (`9aab1cc`): a registry rule must be owned by one authority, with concurrent paths proven by tests, not assumed (G12, CNV-B27).
- **#94 timing:** long native SQLite waits run in the low-parallelism project (`vitest.native-long.config.ts`), with recorded idle durations (CNV-B9).
- **Uncertain commits:** canonical settlement keeps the uncertainty and recovers it at reactivation (`canonical-command-repository.ts:398-415`, `canonical-writer-recovery.ts:61-116`). pc-s1 :68 asks for close-and-reopen reconciliation; adopted in G6.
- **S3a deviation 10:** expected protocol rows are pinned by one literal table in the protocol test.
- **S3b G4:** the bridge keeps harness codes and separates a lost connection from a malformed reply.
- **S2 round 3, fix B** (decisions §32): a settlement failure published its flags after the slot permit was released, so a queued call could take the free permit and reach the repository. Rule: any state change that refuses later work is made **inside** the slot, before the permit is released. S3 adds no admission state of its own (G18).
- **#102:** a cleanup error thrown from a test's `finally` hides the assertion that actually failed. A broken result that was already answered is not a cleanup fault (G19).

## Architecture

### Facts (verified at `9aab1cc`)

**Storage and the upgrade engine**
- The canonical `slopstop.db` is at schema 3 (`project-storage-database-specs.ts:1592`), with migrations `0000`–`0002` (`drizzle/canonical/meta/_journal.json`).
- SQL is generated from `canonical-schema.ts`; `db:generate:check` refuses hand edits (`scripts/check-generated-migrations.mjs:84-95`).
- The created table set must equal the spec (`generated-migration-resources.ts:329-343`). The rebuild pin accepts only schema 2 or the exact generation-three list and hash (`:267-288, :337`).
- The schema version equals the migration count (`generated-migrations.ts:137-143`).
- The upgrade target is the packaged current spec. The plan accepts only `CREATE TABLE` / `CREATE [UNIQUE] INDEX` (`project-storage-upgrade-node-adapter.ts:404-432`; `project-storage-upgrade-eligibility.ts:59-77`), so no `ALTER`, `INSERT` or `DROP` can follow later.
- Only the canonical copy is migrated (`:474-479`).
- **Chain gate.** A second upgrade of the same Storage is unsupported:
  - `completedUpgradeFor` throws for more than one row (`:648-671`).
  - The registry treats it as `REGISTRY_CORRUPT` (`application-database-migration.ts:142-170`).
  - The filesystem agreement admits only `[active, completed.sourceGenerationId]` (`project-storage-node-adapters.ts:1070-1077`).
  - Unfinished-upgrade proof keeps one completed source (`project-storage-upgrade-node-adapter.ts:601-605`).
- **Creation-time check** (`project-storage-node-adapters.ts:819-824`). Registration agreement compares `registration.createdAt` with `completed.sourceCreatedAt`. An upgrade's target generation is created at the upgrade's `startedAt` (`project-storage-upgrade-node-adapter.ts:197, :215, :226`). After a second upgrade, the row targeting the active generation therefore carries upgrade 1's time, not the original creation time.
- **Registration receipts** (`registration-confirmation-store.ts:265-273`).
  - A receipt's generation must exist in `storage_generations`, activated, with the reservation's create request.
  - The upgrade switch deletes the source generation row (`project-storage-upgrade-node-adapter.ts:346-351`), and the target's create request is the upgrade id.
  - `readProjectRegistrationRecords` (:312-349) feeds the list, activation, visibility and re-add.
  - So an upgraded registered Project answers `REGISTRY_CORRUPT` everywhere. This has not happened yet only because every registered Project was at v3 before C1.

**Coordinator, writer and SQLite**
- `execute` refuses, synchronously and in order: a pending lifecycle, inactive, non-active, a Project mismatch, a stale activation, read-only. It registers in `admitted`, which `release` drains (`active-project-coordinator.ts:649-670, :503-517`).
- Every canonical settlement takes a sequence number (`canonical-command-ledger.ts:416-457`; `canonical-command-registry.ts:127`).
- `CanonicalTransactionOwner.exclusively` throws a plain `Error` when busy (`canonical-command-repository.ts:342-343`), and `settle` throws on an unfinished transaction (:388-390). `runSettlement` then closes writer admission for good (`canonical-project-writer.ts:119-124`).
- The writer's client sets `PRAGMA busy_timeout = 5000` before each transaction (`canonical-command-repository.ts:122`). The worker opens with `timeout: 0` (`local-libsql-worker-client.ts:213`).
- The settlement fence is `currentCanonicalSettlementFence`: the `writer_fence` row's state, generation and token digest (`canonical-command-ledger.ts:78-91`).
- Read-only clients run on the generation worker pool through `withDatabase(path, { readOnly: true }, …)` (`local-libsql-worker-client.ts:697-708`).
- `registryFailure` treats only `SQLITE_BUSY`/`SQLITE_LOCKED` as busy (`registration/registry-failure.ts:37`). `isBusyStorageError` is wider (`project-storage-node-errors.ts:21-58`).

**Protocol and desktop**
- The workspace `conversation.message.submit` cannot carry the contract (`workspace-protocol.ts:387-394, :564-571`).
- Branded Conversation id schemas already exist (`workspace-protocol.ts:13-22`).
- Shared availability texts are in `projectAvailabilityMessages` (`availability-messages.ts:5-9`). The S3b rows (`connectionLost`, harness rows) are in `project-upgrade-protocol.ts:47-74`.
- `protocolVersion = 7` (`protocol.ts:77`); the desktop pin is at `canonical-writer-package-smoke-test-peers.ts:73`. (Revision 5: version 8 since S3, `protocol.ts:87`.)
- The renderer has no Conversation UI (`workspace-view.tsx:98-100`). `View` lacks the activation id and access (`:11-16`).
- The S3b upgrade flow runs on activation (`projects-workspace.tsx:186-195`; `use-project-upgrade.ts:30-74`).

### Data model (canonical `slopstop.db`, migration `0003_conversation_messages`, schema 4)

The three tables come from ADR 0006 :50, each with its first behaviour. Because the engine refuses `ALTER`, the columns and references later slices need are declared now (G3).

| Table | Columns and rules |
|---|---|
| `conversations` | `conversation_id` PK; `project_id` NOT NULL; `scope_kind` CHECK IN (`project`, `waypoint`); `waypoint_id` NULL exactly when `scope_kind = 'project'`; `created_at` RFC 3339. Unique partial index: one `project` conversation per `project_id`. |
| `conversation_branches` | `branch_id` PK; `conversation_id` FK → `conversations`; UNIQUE (`conversation_id`, `branch_id`); `parent_branch_id` and `fork_message_id` both NULL (root) or both set; FK (`conversation_id`, `parent_branch_id`) → `conversation_branches` (`conversation_id`, `branch_id`); FK `fork_message_id` → `conversation_messages` (`message_id`); unique partial index: one root branch per conversation; `created_at`. |
| `conversation_messages` | `message_id` PK; `conversation_id`; `branch_id`; FK (`conversation_id`, `branch_id`) → `conversation_branches` (`conversation_id`, `branch_id`); `cursor` INTEGER > 0, UNIQUE (`branch_id`, `cursor`); `author` CHECK IN (`user`, `model`); `body` TEXT CHECK `length(CAST(body AS BLOB)) BETWEEN 1 AND 32768`; `save_id` UNIQUE; `save_fingerprint` 64 lower-case hex; `saved_at` RFC 3339. |

**Rules**
- Rows are immutable: no update or delete path exists.
- The cursor is contiguous from 1 per branch. The branch **revision** is its highest cursor, or 0 when empty.
- **Lazy creation (G4):** the first save creates the conversation, the root branch and the message in one transaction.
- **Fingerprint:** `hashCanonicalJson({ projectId, scope: "project", text })` (`apps/harness/src/canonical-json.ts:59`).
- **C2 fits beside these rows (G3).** C2 adds only new tables: Context records linked by `message_id`, the per-message model choice, and streaming attempts. A partial stream is never a message; only a completed reply becomes an immutable `model` message.

### Harness: the Conversation store (Effect)

New module `apps/harness/src/conversation/`: `conversation-store.ts` (Effect programs), `conversation-errors.ts` (tagged errors) and `conversation-rows.ts` (strict row decode). It exposes no SQL port to callers.

**`readProjectConversation({ after, limit: 100 })`**
- Answers `{ conversation: null }` exactly when no Conversation row exists for the Project.
- Otherwise `{ conversationId, branchId, revision, messages, nextCursor }`, in cursor order.
- `after` is exclusive. `nextCursor` is the last returned cursor when more rows follow, otherwise `null`.
- Partial or inconsistent state is `ConversationStorageBroken` and never reads as empty. Examples: a conversation without a root branch, a cursor gap, a message on another branch, or a row that fails strict decode.

**`saveProjectMessage({ saveId, expectedRevision, text })`**: one write transaction, after the fence check (G2).
1. A row with the same `save_id`:
   - the same fingerprint → the original `saved` with `replayed: true`, whatever the current revision;
   - a different fingerprint → `rejected SAVE_ID_REUSED`.
2. `expectedRevision` ≠ the revision → `conflict { currentRevision }`, with no write.
3. Otherwise, insert at `revision + 1`, creating the conversation and root branch if absent → `saved` with `replayed: false`.

**Failures.** They are mapped once, through one exported narrow predicate, `isSqliteBusy(error)` (BUSY/LOCKED only). `registry-failure.ts:37` is migrated to use it (`shared-vocab-union`, G7).

| Tagged error | When |
|---|---|
| `ConversationStorageBusy` | `isSqliteBusy`, after the writer's `busy_timeout` (5 s) |
| `ConversationStorageBroken` | everything else, including CANTOPEN, IOERR, READONLY and corrupt rows |
| `ConversationWriterUnavailable` | writer admission is closed |
| `ConversationWriterStale` | fence mismatch |
| `ConversationCommitUncertain` | handled under G6 |

### Writer: one serialized slot for canonical and Conversation work (G2)

`createCanonicalProjectWriter` gains `conversation(work)` and an internal FIFO **slot queue** (an Effect `Semaphore` of 1).

- Canonical settlement (`runSettlement`) and Conversation work both acquire the queue before touching `CanonicalTransactionOwner`. They wait for each other and never meet a busy owner.
- The owner's busy check becomes a typed `WriterOwnerBusy`. The queue makes it unreachable. If it is ever reached, the canonical path maps it to the retryable `command-busy` and the Conversation path to `ConversationStorageBusy`; neither closes admission for it.
- A canonical command arriving during a save waits, then settles normally. A save arriving during a settlement waits, then runs. Both orders are tested.
- Conversation work runs `runClassifiedWriteTransaction` on the owner and checks `currentCanonicalSettlementFence` before any write (C2).
- **Admission is re-checked after the slot is acquired**, on both paths. A command or save queued behind work that closed admission therefore answers `writer-unavailable`, never an internal error.
- **Only the in-process busy flag** (`exclusively`, `canonical-command-repository.ts:342-343`) becomes the typed `WriterOwnerBusy`. It is a defensive branch, unreachable through the queue, and pinned by one writer-level test (CNV-B24).
  - The `hasUnfinishedTransaction` guard (:388-390) keeps its meaning: the client state is unknown. It stays non-retryable and closes admission (`degrade-distinguishes-broken`).
- **Plain contention never closes admission for Conversation work.** This covers the slot, SQLite BUSY/LOCKED in a Conversation transaction, and a Conversation body-stage `broken` outcome such as a corrupt row. A **settlement** is different: any failure there, including SQLite BUSY/LOCKED at begin or a body error, is a thrown settlement (only `WriterOwnerBusy` is mapped to `command-busy`), and it closes admission (S1 behaviour, U3). A failure to snapshot a command (`snapshotCanonicalCommand`) closes it too.
- **A thrown settlement** (U3, decisions §29). `runSettlement` keeps the S1 rule: any thrown error closes admission for both paths, and the queued work answers `writer-unavailable` (S2 F1). The client is **not** abandoned: release runs the S1 stages (`releaseFence`, `closeRepository`, `releaseLease`) with the S1 retry-at-release. Abandonment (G6 case 2) covers only an unknown client state left by Conversation work. This is a recorded design-vs-result gap, accepted by Pedro.
- **Admission closes inside the slot** (S2 round 3, fix B, decisions §32). Both the abandonment flag and the failed-settlement flag are set while the permit is still held, so no call queued behind the failure can take the free permit and reach the repository.

**Uncertain commit (G6).** `runClassifiedWriteTransaction` rolls back before it returns `commit: "uncertain"` (`project-storage-transaction.ts:51-79`). Two cases follow.

1. **Known client state.** The commit failed or was classified uncertain, and the rollback and close succeeded (`tx.closed`).
   - The client stays usable and admission stays open.
   - The store reconciles by `save_id` and fingerprint on a **separate read-only connection** (`withDatabase(canonicalDatabasePath, { readOnly: true })`, with the bounded busy wait of the read path):
     - row present → `saved`, with `replayed: false`;
     - row absent → `unavailable PROJECT_STORAGE_UNAVAILABLE`, retryable: the text was not saved, and the same `saveId` is safe to resend;
     - reconciliation read fails → `uncertain`.
2. **Unknown client state.** The close failed, so the transaction is unfinished. This includes an acknowledged commit whose close failed.
   - The writer marks its client **abandoned** and closes admission for both paths. Later commands and saves answer `writer-unavailable`.
   - It reconciles on the separate connection as in case 1. A row present means `saved`.
   - **Release with an abandoned client** (R2-B1). `stagedWriterRelease` skips the `releaseFence` and `closeRepository` stages, because the abandoned client cannot run them.
     - It force-closes the raw worker client instead. Closing the SQLite connection rolls back and releases its locks.
     - It then releases the lease as usual.
     - The fence stays `active`. The next activation's existing abandoned-active-fence recovery supersedes it (`canonical-command-repository.ts:247`, `writer_recovery_records.reason = 'abandoned-active-fence'`).
     - A switch therefore answers `sourceReleased: true`, a coordinator stop resolves, and the next activation is read-write. (`project.close` is a Storage-level command that never reaches the coordinator; deviation 6b, decisions §28.)
     - If the raw close itself fails, the release fails with its own diagnostic (`WRITER_CLIENT_ABANDON_FAILED`) and stays `release-failed`. This is a genuine broken state, never reported as released.
       - Through S2 (deviation 6a, decisions §28) the release reports `WRITER_REPOSITORY_CLOSE_FAILED` with the cause `WRITER_CLIENT_ABANDON_FAILED`, because the release vocabulary is part of the protocol. S3 adds the dedicated code with protocol v8 (CNV-B36).
   - The in-slot abandonment never awaits queued settlements. The queued work re-checks admission on acquiring the slot and returns at once, so `closeOnce` (`canonical-project-writer.ts:98-110`) cannot deadlock.

In every case, a resend with the same `saveId` converges through the exact-retry rule. A new identity is never minted.

### Read path (C5)

- **Read-write activation with admission open:** the read runs through the writer's slot queue on the writer's client, so it is serialized with saves and settlements.
- **Read-only activation (G10), or read-write after admission closed (R2-C3, U2):** the read opens a short-lived read-only client per request on the generation pool (`readProjectConversationReadOnly`, `withReadOnlyClient`, S2).
  - **Routing (S3, G17).** The coordinator's `conversationRead` owns it, inside **one** admitted registration: it first offers a read-write activation's read to the writer (`writer.conversationRead`); when the writer answers `writer-unavailable`, it runs the same read through the per-request read-only client on the activation's recorded `canonicalDatabasePath` (`ActiveActivation`, File Map). Because both attempts sit in the same admitted entry, a switch or stop drains the fallback read before it closes the Storage session. The harness runtime only dispatches. The decision comes from the writer's own in-slot answer, never from a flag the runtime reads before the slot, so a closure that happens while the read waits is covered too (G18).
  - Admission can close by an abandonment (the CNV-B10 (b) close fault), a thrown settlement (U3), or a failed command snapshot. All route the same way: the coordinator acts on any writer refusal of a read.
  - That client sets `PRAGMA busy_timeout = 2000` instead of `timeout: 0` (R2-C4), because read-only is exactly when another process may be writing. A short external commit therefore does not fail the read.
- In every case, a lock held past the wait gives `ConversationStorageBusy`, which surfaces as `unavailable PROJECT_STORAGE_UNAVAILABLE`, never as broken or empty. Any other read-only client failure (open, read or close) is `ConversationStorageBroken` → `broken PROJECT_STORAGE_BROKEN`. Neither answers an empty conversation.

### Coordinator admission

- `active-project-coordinator.ts` extracts the synchronous checks of `execute` into one function, `admitActiveWork(request, kind)`. `execute`, `conversationRead` and `conversationSave` all use it.
- The refusal order is identical. Read-only refuses saves and commands, not reads.
- Admitted work registers in `admitted` before its first await, so `release` (switch and coordinator stop) drains it, and a pending lifecycle refuses new work (G8). `project.close` closes only `project.open` Storage sessions and never enters the coordinator (deviation 6b).
- An it.each table pins precedence for combined conditions against `execute` (C8).

### Protocol (version 8) and the result vocabulary

New `packages/protocol/src/project-conversation-protocol.ts` owns:
- the read and save schemas;
- the exported text predicate `conversationTextProblem(text): "empty" | "whitespace-only" | "too-large" | undefined`. Whitespace is the JavaScript `\s` class with the `u` flag; size is UTF-8 bytes (S3 counts them by code point, `project-conversation-protocol.ts:98-105`; the tests check against `TextEncoder`). The renderer and the harness both import it;
- `projectConversationDiagnostics`: the one map of `{ code, message, retryable }` rows, built from existing owners where they exist.

Ids use the branded schemas from `workspace-protocol.ts:13-22`: `conversationId`, `branchId`, and `conversationMessageId`. The last is named so it cannot be confused with the envelope `messageId`.

**Commands**
- `project.conversation.read`: `{ projectId, activationId, after: non-negative int | null }`.
- `project.conversation.save`: `{ projectId, activationId, saveId: UUID, expectedRevision: non-negative int, text }`, where `conversationTextProblem(text) === undefined`.

**Results.** Every result echoes `request`.

| Status | Op | Code | Message | Retryable | Owner / note |
|---|---|---|---|---|---|
| `read` | read | — | — | — | `{ conversation: null \| { conversationId, branchId, revision, messages: [{ conversationMessageId, cursor, author: "user", text, savedAt }], nextCursor } }` |
| `saved` | save | — | — | — | `{ conversationMessageId, cursor, revision, savedAt, replayed }`; also the answer when a re-read confirms an acknowledged commit whose close failed |
| `conflict` | save | — | — | — | `{ currentRevision }` |
| `rejected` | save | `SAVE_ID_REUSED` | "This save was already used for different text." | false | new code: no existing owner expresses an identity reused with another fingerprint |
| `uncertain` | save | `CONVERSATION_SAVE_UNCONFIRMED` | "The save could not be confirmed. Try again to check it." | true | new code: the harness reconciliation read failed, or the bridge lost the connection after sending |
| `inactive` | both | `PROJECT_INACTIVE` | "No Project is open." | false | code from `canonical-project-protocol.ts:363-373` |
| `project-mismatch` | both | `PROJECT_NOT_ACTIVE` | "This Project is not the open Project." | false | same owner |
| `stale-activation` | both | `PROJECT_ACTIVATION_STALE` | "The Project was reopened. Reload the conversation." | false | same owner |
| `coordinator-unavailable` | both | `PROJECT_COORDINATOR_UNAVAILABLE` | `projectAvailabilityMessages.coordinatorUnavailable` | false | same owner |
| `read-only` | save | `WRITER_UNAVAILABLE` | "This Project is open read-only because another process is using it, so saving is disabled." | true | the same code and retryable flag as the command `read-only` row; this text is the reason shown in the window (G10) |
| `writer-unavailable` | save | `WRITER_UNAVAILABLE` | "Saving is unavailable until the Project is reopened." | false | same owner |
| `stale-writer` | save | `WRITER_FENCE_STALE` | "Another writer took over this Project. Reopen it to continue." | false | same owner |
| `unavailable` | both | `PROJECT_STORAGE_UNAVAILABLE` | `projectAvailabilityMessages.storageUnavailable` | true | storage busy; the same row as the upgrade map's `storageUnavailable` |
| `unavailable` | both | `PROJECT_COORDINATOR_UNAVAILABLE` | `projectAvailabilityMessages.connectionLost` | true | built by the bridge only: a read lost, or a save not sent |
| `broken` | both | `PROJECT_STORAGE_BROKEN` | "Project Storage could not be read safely." | false | new message; existing code |
| `broken` | both | `HARNESS_INTERNAL_FAILURE`, `PROTOCOL_MESSAGE_INVALID`, `PROTOCOL_VERSION_UNSUPPORTED` | `harnessFailureMessages` | false | built by the bridge only, as in S3b (`harnessFailureRow`) |

The harness never produces the bridge-only rows. They exist so the bridge can express transport faults within the same strict schema (B4).

### Desktop

Revision 5 (decisions §42, §43). S4 is built in React from the coded hero prototypes, in two slices: S4a (renderer foundation) and S4b (Conversation window). Only the Conversation region is restyled; the old shell stays until the shell slice of the React port (G21). Facts below are verified at `6a41350`.

**Facts (verified at `6a41350`)**
- The renderer is already React 19 with CSS modules (`apps/desktop/package.json:24-25`; `projects-workspace.module.css`). "Not the current renderer style" means the visual system (Seixo, DESIGN.md), not the framework.
- **Old shell CSS.** Three sources style the live shell:
  - `renderer/prototype/prototype-global.css`: the `--prototype-*` tokens (:1-21) plus global element rules: `body` overflow, background and colour (:35-40), form controls `font: inherit` (:42-47), `button` cursor and disabled state (:54-60), scrollbars (:67-81), `:focus-visible` (:83-86) and reduced motion (:88-94). The production renderer imports it (`projects-workspace.tsx:21`), which `main.tsx:3` loads through `App` before `./global.css` (`main.tsx:4`), so `global.css` wins where both set a rule.
  - `renderer/global.css`: the old palette (:1-16), `body` (:30-33), `button, a` 160 ms transitions (:35-41), `:focus-visible` outline in `--signal`, offset 4 px (:43-46), `::selection` (:48-51), reduced motion (:53-60).
  - `projects-workspace.module.css`: descendant rules such as `.shell button` (:11-18: 1 px border, radius 0.35 rem) and `.workspace h2`, `.workspace p` (:134-143), and the `.workspace` padding. These beat a single CSS-module class inside the workspace area.
  - `renderer/app.module.css` is imported nowhere.
- No `@font-face` and no font file exist in the desktop app; only system fonts are used (`global.css:3, :15`). `vite.renderer.config.ts:4-9` sets no build options, so Vite's default `build.assetsInlineLimit` (4 KiB) applies, and a smaller font file would become a `data:` URL, which `font-src 'self'` blocks.
- **CSP.** The policy is sent only as a response header (`main/security.ts:3-18, :26-33`): `font-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`; `security.test.ts` does not pin it. The e2e build and the packaged app load the renderer from `file://` (`main.ts:288-290`), and Electron's security guide says a header CSP cannot be used for `file://` loads ("it is not possible to use this method when loading a resource using the `file://` protocol"); `index.html` has no CSP `<meta>`. Nothing in the repository shows the policy is in force on those pages (G29).
- `@phosphor-icons/react` is used by seven non-prototype renderer files; DESIGN.md:363 forbids it for new work.
- **The old prototype window:** `renderer/prototype/` (about 6,300 lines); `vite.prototype.config.ts`; the Forge renderer `prototype_window` (`forge.config.ts:60-63`); the `--prototype` branches in `main/main.ts` (:69-71, :297-305, :377, :427); the declarations `PROTOTYPE_WINDOW_VITE_DEV_SERVER_URL` and `PROTOTYPE_WINDOW_VITE_NAME` (`main/forge-env.d.ts:3-4`) and their defines (`scripts/build-project-entry-e2e.mjs:13-14`); the stubs and the `"prototype"` quit-ownership row in `main/canonical-writer-package-smoke-main.test.ts` (:312-313, :349-363), which fails once `--prototype` is no longer read; the knip entry (`knip.jsonc:15`); the script `start:prototype`; and the e2e journey `tests/e2e/shell.test.ts:176-246` with its helpers `collectRendererErrors` and `capturePrototype` (:42-60).
- The active Project's `activationId` and `access` already live in `Session.activation` (`projects-workspace.tsx:25-28, :92-116`); `View` carries only a display `label` (`workspace-view.tsx:11-16`). The active-mode body to replace is `workspace-view.tsx:95-101`.
- The renderer guard is per harness epoch, not per activation (`projects-workspace.tsx:48-50, :74-88, :161-184`).
- Existing e2e locators S4 must keep: `getByRole("status")` = "Harness ready" (`shell.test.ts:87, :159`; a second `role="status"` on screen breaks strict mode), region "Project workspace", heading "Project <name>", the exact text "Read-write" (`project-upgrade.test.ts:44-48`; `projects.test.ts:37-39`), `getByRole("alert")` count 0 during an upgrade (`project-upgrade.test.ts:54`), and `#ws-progress` as a polite region without a role.
- **Where the preload API is listed:** `shared/desktop-api.ts` (channels :22-36 and the interface :38-57, insertion order); `preload/preload.ts` (the implementation); `preload.test.ts:34-42` (a partial `ExposedApi` type, 7 of 13 methods); `main/package-smoke-verifier.ts:29-43` and `package-smoke-verifier.test.ts` (about :381-395), both sorted; `tests/e2e/shell.test.ts:99-113`, sorted; `renderer/test-api.ts:19-67` (the shared fakes, insertion order; unused methods throw by convention, :18).
- **The bridge does not yet separate "not sent" from "lost after send":** a call after `stop()` (`project-entry-bridge.ts:71`), a disconnect while pending (:50-52 with `harness-pending-request.ts:18-20`) and a stop while pending (:180-185) all fail with `{ kind: "transport" }`. A refused send is `{ kind: "send", code }` (:89). The upgrade mapping is exhaustive over these kinds (`project-upgrade-failure.ts:44-63`).
- **A malformed reply never reaches the bridge's parse.** `HarnessSession` decodes every incoming message strictly against the whole v8 message union (`harness-session.ts:39-46`; `protocol.ts:485-487`) and turns a failure into a `protocol-error` event, which fails every pending request with `{ kind: "protocol" }` (`harness-pending-request.ts:21-25`). The bridge's own `desktop` fault is reached only by a decodable reply with the wrong event (:59), a `request` echo that does not match (:131-132), an unbuildable command, or a colliding id (`harness-pending-request.ts:64-74`).
- Protocol facts: version 8 (`protocol.ts:87`); the message row is `{ conversationMessageId, cursor, author: "user", text, savedAt }` (`project-conversation-protocol.ts:182-188`); the harness page size is 100 (`conversation-store.ts:60`) and is not in the protocol; a replayed save returns the original message's `revision` (`conversation-store.ts:148`). Two codes are shared by two rows each: `WRITER_UNAVAILABLE` (`readOnly`, retryable; `writerUnavailable`, not) and `PROJECT_COORDINATOR_UNAVAILABLE` (`coordinatorUnavailable`, not retryable; `connectionLost`, retryable).
- Effect in the Electron main process: it already runs Effect programs with `Effect.runPromise` at its edges (`desktop-shutdown.ts:28, :46`; `harness-supervisor.ts:195`); there is no service or Layer composition, and the project bridge is a Promise core shared by list, register, activate, switch and upgrade.
- Accessibility automation: none in the repository (no axe, no `emulateMedia`). Playwright 1.62 supports `page.emulateMedia({ forcedColors, reducedMotion })`; `electron.launch` has `bypassCSP`, which S4 never uses. The workspace runs pnpm with `autoInstallPeers: false` and `strictPeerDependencies: true` (`pnpm-workspace.yaml:5, :11`).

**Bridge** (`project-entry-bridge.ts`, S4b)
- `readConversation` and `saveConversationMessage` use the existing `echoing` helper, as S3b's `upgrade` does.
- **Fault split (G25).** The bridge gains an `unsent` fault for a call made after `stop()`. "Not sent" paths: `unsent`, a refused send, an unbuildable command, a colliding id. "Sent, then lost" paths: a disconnect while pending, a stop while pending, a `protocol-error` while pending. The upgrade mapping maps `unsent` to `connectionLost`, so S3b's behaviour is unchanged.
- **Read mapping:** a harness result passes through unchanged; `request.failure` keeps its harness code as `broken`; a `protocol-error` (which includes every malformed reply), a decodable reply with the wrong event or a mismatched `request` echo, an unbuildable command and a colliding id → `broken PROTOCOL_MESSAGE_INVALID`; a refused send with `HARNESS_SESSION_MESSAGE_INVALID` → `broken PROTOCOL_MESSAGE_INVALID`; every other refused send, `unsent`, and a disconnect or stop while pending → `unavailable` (`connectionLost`).
- **Save mapping:** as for a read, except that every "sent, then lost" path — a disconnect or a stop while pending, and a `protocol-error` while pending (which includes a malformed save reply) — gives `uncertain CONVERSATION_SAVE_UNCONFIRMED`, because the harness may have committed. A decodable reply with the wrong event or a mismatched `request` echo stays `broken PROTOCOL_MESSAGE_INVALID`.
- The mapping is a plain function in a new `project-conversation-failure.ts`, beside `project-upgrade-failure.ts`.

**IPC and preload** (S4b)
- Channels `projects:conversation:read` and `projects:conversation:save`, registered in `registerProjectEntryIpc`, whose `Pick` gains the two bridge methods.
- The preload adds `readConversation` and `saveConversationMessage`, with strict decode of the request before `invoke` and of the result after it.
- The two sorted lists (`package-smoke-verifier.ts` with its test, and `shell.test.ts`) gain the names in sorted position; `desktop-api.ts`, `preload.ts`, the `ExposedApi` type in `preload.test.ts` and the shared fakes gain them through the type check. The shared fakes answer a read with `{ status: "read", request, conversation: null }` by default and throw on a save, so existing renderer tests run unchanged.

**Renderer foundation** (S4a)
- **Fonts.** `@fontsource/red-hat-text` (400, 500, 600), `@fontsource/cinzel` (400) and `@fontsource/cascadia-code` (400), pinned in the catalog and imported once by the renderer entry through each package's per-weight CSS (for example `@fontsource/red-hat-text/400.css`), which declares the latin and latin-ext faces among others. The renderer build never inlines font files (`build.assetsInlineLimit` returns false for `.woff` and `.woff2`), so every face is a same-origin file that `font-src 'self'` allows.
- **One CSP owner, per window, also in the page (G29, #130).** A plain shared module (no Electron import) builds the policy: `contentSecurityPolicy({ window: "main", delivery: "header" | "meta", development: boolean })`. For the main window it returns today's policy exactly: the header in development adds the localhost connect sources, the packaged header does not, and the `<meta>` is always the packaged variant without `frame-ancestors` (which a `<meta>` ignores; the header keeps it). `security.ts` uses it for the header; a pure, exported HTML transform used by the renderer's Vite build writes the `<meta http-equiv="Content-Security-Policy">` as the first element after `<meta charset>`, before any script or stylesheet. The `window` parameter exists so the React port's Rive splash window (decisions log :268-274, #130) can later get its own variant that adds `'wasm-unsafe-eval'` to `script-src` for that window only; S4 builds no splash window and adds no such variant, and the main-window policy never contains `'wasm-unsafe-eval'`.
- **Seixo theme, scoped (G22).** `theme/seixo.module.css` holds, on the region's root class: the DESIGN.md `colors`, `rounded` and `spacing` tokens; the component and elevation values the region uses, copied from DESIGN.md (`--button-primary-hover` #B2D6E8 from `components.button-primary-hover`, `--button-secondary-hover` #1B1F23, and the Soft, Button, Frost and Composer lifts from "Shadow Vocabulary", DESIGN.md:278, :280, :281 and :282; the Row lift and the Overlay are not used by the region); the decided focus ring (`ragnarok-hero/access.css:8-17`: `outline: 2px solid transparent; outline-offset: 2px` plus a 1.5 px frost line and a 5 px halo at 0.22; on frost-filled buttons the line sits outside a 2 px canvas gap, 3.5 px line, 7 px halo), which supersedes DESIGN.md:284's halo-only rule (decisions §33); and the forced-colors block (`ragnarok-hero/access.src.html:237-248`, ported under the region root, including `.button { border: 1px solid ButtonText }`). Its colour literals are only those declarations; the halo is written from `--frost` (`rgb(from var(--frost) r g b / 0.22)`); `transparent` appears only as the focus rule's outline colour and inside `@media (forced-colors: active)`, where `currentColor` and system colours may also appear. Every selector in it and in the region's other modules contains a module-local class; none is `:root`, `html`, `body`, `:global(...)`, an old-shell class, or made only of elements, attributes, pseudo-classes or `*`. The other region modules contain no colour literal: they use these properties.
- **The old shell is layered and reset at the region edge (G22).** Every old-shell style sheet (`legacy-shell.css`, `global.css`, `projects-workspace.module.css` and the old feature modules) is wrapped in `@layer legacy-shell`, in its current import order, so its own cascade is unchanged. A layer only decides the properties both sides declare, so the region module also starts with an unlayered reset, `:where(.<root> *:not(svg, svg *)) { all: revert }` (zero specificity, so every region rule still wins; SVG is excluded so the icons' presentation attributes stay), which removes every legacy value — the old `h2`, `p` and `code` rules, `.shell button` and its hover, the global `:focus-visible` outline and the 160 ms transitions — from region elements; custom properties are not affected by `all`. `legacy-shell.css` is the new home of every `prototype-global.css` rule except the `#prototype-root` selectors, imported where `prototype-global.css` was (`projects-workspace.tsx:21`), and the old tokens are renamed from `--prototype-*` to `--legacy-*` with unchanged values, so the old shell looks the same (CNV-B50, plus a static check that every `var(--legacy-*)` names a declared property) and no "prototype" name remains. The reset matches elements only: pseudo-elements keep the legacy `::selection` colours and scrollbar styling inside the region until the shell slice (accepted). `all: revert` also returns `box-sizing` to `content-box`, so the region module declares `box-sizing: border-box` on its root and descendants; the region declares its own properties rather than relying on legacy ones.
- **Runa icons.** One component with a name union renders inline SVG from the Runa v2 sources (`ragnarok-hero/icons-runa-v2`, accepted by Pedro, decisions log :359): `circle-x`, `triangle-alert`, `rotate-ccw`, `check`, `lock`, `info`. Each is decorative (`aria-hidden="true"`, `focusable="false"`), `stroke="currentColor"`, stroke width 1.5, square caps, mitred joins, 14 px in meta lines. No Lucide, no Phosphor in the region.
- **Conversation region frame.** For an active Project, the region fills the workspace area edge to edge on the canvas tone: the workspace section drops its padding while the region is shown (a variant class in `projects-workspace.module.css`). The idle note (after a removal or a cancelled add, `workspace-view.tsx:20-23`) and the selection error, when present, render above the region in a new wrapper strip with the old `.workspace` padding (2 rem) and their current markup. The region's header holds the heading `h2#ws-heading` "Project <name>", the access word ("Read-write" or "Read-only") in its own element, and the `projectId` in Cascadia at the code size (12.5 px). The context line holds the info icon and "No model is connected yet. Messages are saved on this computer." The safe-mode and release-failed views and `UpgradeProblem` keep their current markup until the shell slice. The bundled Cascadia Code face (400) also serves the old shell's code text (`--legacy-font-code`, e.g. `.projectList code`); with `font-synthesis: none` (`global.css:4`) such text renders at 400 only. This is the one accepted change to the old shell's look, and the S4a screenshot review includes the Projects sidebar to show it.
- **Old prototype window deleted (G23)**, with every entry listed in the facts above; the `"prototype"` quit-ownership row is deleted because it tests removed behaviour (no assertion is weakened). The dead `app.module.css` and the stale comment in `index.html:9-17` go too.

**Renderer: the Conversation window** (S4b)
- **Ownership.** A hook `use-project-conversation.ts` owns loading and saving for one activation; `conversation-region.tsx` and its parts render it. **Per-Project memory** lives in `ProjectsWorkspace`, keyed by `projectId`: `{ text, saveId, expectedRevision, outcome, activationId }`, where `outcome` is `none`, `pending`, `dropped` (a result lost to an old activation or harness epoch) or the last answered row, and `activationId` is the activation the region last loaded for that Project (it tells an opening load from a remount, and a current pending save from an old one). A save result updates the memory only while the memory's `saveId` still equals the result's `request.saveId` and its outcome is `pending`; a late result for an older `saveId` is ignored, so it can never overwrite newer state. Save results are written to that memory, not to component state, so a save survives the region being remounted inside one activation (the add flow or the removal view replace the region while they run). Pure rules (the save-outcome table, the slot precedence, the time format) are plain functions with their own unit tests. The renderer runs no Effect runtime; it may use pure `Match` and protocol schemas, as `use-project-upgrade.ts` does.
- **Activation guard.** Every read and save result echoes its `request`; a result whose `activationId` is not the current activation's is dropped, and so is any result from an older harness epoch. A dropped pending save sets that Project's `outcome` to `dropped` (under the `saveId` rule above) and makes its composer editable; nothing else in another Project's memory changes.
- **Loading.**
  - On mount and on every new `activationId`, the region reads every page, sending `after: null` and then each `nextCursor` until it is `null`, and shows the messages in cursor order. It never assumes a page size. **Focus moves only for the first load of an activation (its `activationId` differs from the memory's) or a Reload**, and only while focus is on `body` or on the control that started it; a load caused by a remount inside one activation (same `activationId`) never moves focus, and the slot keeps showing that Project's current outcome.
  - **Every successful read sets the Project's `expectedRevision` to the read's `revision`** (0 for `conversation: null`).
  - After about 300 ms without an answer, the status slot says "Loading messages…". Before that, Save has no description; after it, Save is described by that line.
  - `conversation: null` or no messages → the empty pattern: "No messages yet" and "Messages you save stay on this computer." Focus goes to the composer.
  - A failed read on any page replaces the stream with a notice; no partial list stays; the draft is kept; focus goes to the notice's action (under the focus rule above). The Failure tone (circle-x, polite, announced through the status slot) shows "Could not load this conversation." and the row's message. The Broken tone (blood outline, triangle-alert, `role="alert"`) shows the same title, the row's message and a code line "Code <CODE>"; a rejected read shows the title, "The desktop could not load this conversation." and no code line. The action is "Reload" (rotate-ccw), which stays mounted and `aria-disabled` while it reads, and after a successful read focus goes to the composer. For `stale-activation` the harness already holds a newer activation, so neither a re-read nor the existing open path can succeed (a switch from the stale activation is refused, `active-project-coordinator.ts:249`; a fresh activation is refused while one is held, :363-368): the notice shows the Failure tone with the row's message and **no action** (Pedro, decisions log §45); recovery is a recorded gap.
- **Messages.** An ordered list named "Messages". Each item shows "You", a `<time dateTime={savedAt}>` in 24-hour en-GB form in the system time zone (today: "14:02"; earlier this year: "9 Oct, 14:02"; another year: "9 Oct 2025, 14:02"), and the text as a React text node with `white-space: pre-wrap`. The stream opens at the newest message and scrolls to a new message after a save, with `behavior: "smooth"` in normal motion and `"auto"` under reduced motion.
- **Composer.** A labelled textarea ("Message", placeholder "Write a message") and one frost primary button "Save locally" with no icon and no anvil (G24). Ctrl+Enter saves; Enter and Shift+Enter insert a new line. The value is passed unchanged: no trimming; spaces, tabs and line breaks are kept. While a save of the current activation is pending the textarea is read-only, so text typed after a press cannot be lost. The field's focus-within ring is the decided ring (two box-shadow layers: a 1.5 px frost line and a 5 px halo at 0.22), not Seixo V3's halo-only field rule (`ragnarok-hero/seixo.css:29`), which is below checklist 02's 3:1. The textarea itself has no outline in either colour mode (the ported forced-colors `:focus-visible` rule excludes it); under forced colours the field has `outline: 2px solid Highlight` (the ui-ux agent's answer V5, recorded in G24).
- **Save is unavailable** (G26: `aria-disabled="true"`, never the `disabled` attribute, so it stays focusable and Tab reaches it; pressing it or Ctrl+Enter sends nothing). Its description:
  - empty or whitespace-only text: none (the empty field is the reason);
  - "too-large": described by "This message is longer than 32 KiB." in the status slot; the field is `aria-invalid`; the text is kept; it clears when the text fits;
  - a read-only activation: the context line shows the §4 note and, below it, the lock icon and "Read only: " followed by `projectConversationDiagnostics.readOnly.message`; Save and the textarea (read-only) are described by that read-only line element only, not the whole context line; earlier messages stay visible;
  - loading: none before 300 ms, then "Loading messages…" (which outranks a kept outcome line while it shows); a failed load: the notice's title;
  - pending: the button's name becomes "Saving…" and it keeps focus if it had it.
- **Save outcomes.**
  - Pending: "Saving…" in the status slot.
  - `saved` with `replayed: false`: the returned row joins the list, the composer clears, `expectedRevision` becomes the returned `revision`, focus is in the composer, and "Saved" (check icon) shows until the next input.
  - `saved` with `replayed: true`: the composer clears, "Saved" shows, and the conversation is read again (which sets `expectedRevision`), because a replay returns the original message's revision.
  - **Every other outcome keeps the exact text**, with its reason; focus does not move:
    - `uncertain`: "Not confirmed." plus `diagnostic.message`, circle-x, polite;
    - `conflict` (no diagnostic): the conversation is read again (which sets `expectedRevision`), and the slot says "The conversation changed and was reloaded. Save again to add your message.";
    - `broken`: the Broken tone with "Not saved.", `diagnostic.message` and the code line "Code <CODE>", `role="alert"`;
    - a rejected preload call (an IPC failure or a strict-decode throw): the Broken tone with "Not saved.", "The desktop could not complete this save." and no code line, `role="alert"`, no "Try again";
    - every other row: "Not saved." plus `diagnostic.message`, circle-x, polite.
  - "Try again" (rotate-ccw) appears only for `uncertain`, a `dropped` save and rows whose `retryable` is true (`read-only`, both `unavailable` rows); it resends the same `saveId` and text, and is `aria-disabled` while a read is in progress. Pressing it moves focus to Save ("Saving…"). A `stale-activation` save answer shows its line with no action (G21, §45).
- **Save identity (G27).** A `saveId` is minted on the first press for a text. It is kept until the text is edited, or a definitive outcome arrives (`saved`, `conflict`, `rejected`); the next press after those mints a new one with the current `expectedRevision`. Every other outcome, including `broken` and a rejected call, keeps it, so a later press can never duplicate a committed message.
- **What a Project shows on return.** When a Project's region loads under a new activation, its kept `outcome` decides the status slot: a `pending` save of the old activation (its memory `activationId` differs from the new one) and `dropped` show "Not confirmed." plus `projectConversationDiagnostics.saveUnconfirmed.message` and "Try again", with the composer editable; `uncertain` and both `unavailable` rows show their line and "Try again"; rows tied to the old activation (`read-only`, whose reason belongs to that activation's access, `writer-unavailable`, `stale-writer`, `stale-activation`, `inactive`, `project-mismatch`, `coordinator-unavailable`, `broken`, a rejected call) are cleared, keeping the text and `saveId`; `conflict` and `rejected` keep only the text; a kept `saved` shows nothing ("Saved" is not restored). "Try again" under the new activation resends the same `saveId` (the fingerprint excludes the activation). A save that answers while its activation is still current — the usual case, because the coordinator drains admitted work before it answers a switch (G13) — is applied normally, even if the region was remounted. All of this is lost on app restart (durable drafts are a non-goal).
- **A rejected read** shows the Broken-tone load notice with the title "Could not load this conversation.", "The desktop could not load this conversation.", no code line, and "Reload".
- **Announcements (G26).** One visible status slot under the composer, `#conversation-status`, is a polite live region **without** `role="status"`. Its precedence, highest first: the Failure-tone load title, the over-limit line, "Saving…", "Loading messages…", the kept outcome line, "Saved". Each line is one announcement per load or save (including a re-read after a replay or a conflict), not a stream of progress, so checklist 05's 10-second progress limit, which governs Run progress (`ragnarok-hero/access.src.html:141`), does not apply. Only Broken-tone elements use `role="alert"`. The "Messages" list and the stream have no `aria-live` and no `log` or `status` role, so messages are never announced one by one.
- **Motion.** Region controls use the DESIGN.md 120 ms transitions in normal motion; under reduced motion every region transition is 0 s and no scroll is smooth. Nothing in C1 loops or animates on its own.

### Data flow

```text
composer --saveConversationMessage--> preload --projects:conversation:save--> bridge --project.conversation.save-->
  runtime --> coordinator.admitActiveWork (admitted set) --> writer slot queue --> fence --> ConversationStore (Effect, 1 tx)
  --> saved | conflict | rejected | uncertain | refusal row
open / switch / restart --> activate --> (migration-required: S3b upgrade, chained if needed) --> read pages --> messages
```

## Decisions

- **G1** Dedicated Conversation messages, protocol v8. The workspace `conversation.*` contracts and `project.command` stay untouched (§16).
- **G2** One FIFO slot queue in the writer serializes canonical settlement and Conversation work. Admission is re-checked after acquiring the slot.
  - For Conversation work, contention (slot, SQLite busy) and body-stage broken outcomes never close admission. For a settlement, any thrown failure (including SQLite busy or a body error) closes it; only `WriterOwnerBusy` maps to `command-busy`.
  - Three things close writer admission, for both paths: (1) an unknown client state left by Conversation work (a failed close, or an unfinished transaction), which also abandons the client (G6); (2) any thrown settlement, which does **not** abandon it and keeps the S1 retry-at-release (U3, decisions §29); (3) a failed command snapshot (`snapshotCanonicalCommand`, `canonical-project-writer.ts:199-203`). Paths (1) and (2) close admission inside the slot and refuse work already queued (decisions §32). Path (3) closes it before the command enters the slot, sets no `failed` flag, and does not refuse work already queued, which still runs on a known client.
  - Rejected: a second SQLite client, which would get immediate cross-client `SQLITE_BUSY`; and recovering a broken client in the same session, because its state is unknown.
- **G3** Tables are declared complete for later additive slices: author `model`, branch parent and fork references, composite keys. C2's data goes in new tables.
- **G4** Lazy conversation creation on the first save. Two racing first saves leave exactly one conversation and one root branch, through unique indexes plus serialization in the slot.
- **G5** Identity first, then conflict.
- **G6** Uncertain commits are reconciled by `saveId` on a separate read-only connection (pc-s1 :68). A known client state keeps the writer usable. An unknown client state left by Conversation work abandons the client (a thrown settlement never does, U3): release skips the fence and repository stages, force-closes the raw client, releases the lease, and leaves the fence to the next activation's abandoned-fence recovery. A new identity is never minted.
- **G7** Busy means SQLite BUSY/LOCKED only, through one exported predicate shared with the registry. Everything else is broken.
- **G8** Conversation work is refused, not queued, during lifecycle operations, the same as `execute`.
- **G9** Chained upgrades in the first slice (Pedro, §16 Q1 = A).
- **G10** Read-only Projects show their messages; "Save locally" is disabled with the reason visible (Pedro, §16 Q2 = A).
- **G11** Text rules (Pedro, §16 Q3): exact text; no empty or whitespace-only text; 32 KiB of UTF-8 bytes, enforced at the protocol and in the SQL `CHECK`.
- **G12** The registry chain rule has one owner, `application-database-migration.ts`, beside the C1-0 witness rule. Every reader asks it instead of re-deriving the chain: the opening agreement, receipts, the discard proof and the listing. It answers three things: the root `createdAt`, the generations the chain retains, and a receipt's original generation.
- **G13** Unsaved text is kept per Project in memory across switches. Rejected: blocking a switch while a save is pending (the drain already finishes the save before release).
- **G14** C1 is built in a linked worktree (Pedro, §19).
- **G15 Merge order** (Pedro, §19, decisions log `679b9ae`): S1 is not split, and it merges to `main` only together with S2. Consequences:
  - An S1 amendment found during S2 review reopens S1 acceptance and rebases S2. A pushed commit is never rewritten; the amendment is a new commit.
  - S2's head is what reaches `main`, so S2's gates include `pnpm test:e2e` and `package:launch-smoke`. The package smoke drives the writer that S2 changes (`package-smoke.mjs:40, :47`).
  - The C1 branch is never run against the real `userData` before S1 and S2 merge.
- **G17 Read routing after admission closes** (U2, decisions §29). A read-write activation's read goes to the writer first; on `writer-unavailable` it falls back to the per-request read-only client. Saves keep answering `writer-unavailable`. Owned by S3 (CNV-B13). U2's own text names the abandonment; Pedro accepted the extension to a failed settlement and a failed command snapshot (decisions log §36, commit `e59bbb7`). Rejected: refusing reads after an abandonment, which would hide saved messages while the Project is still open.
- **G18 One owner for admission state** (S2 round 3, decisions §32). Only the writer decides, inside its slot, whether work is admitted. The coordinator's `admitActiveWork` checks only lifecycle, activation and access; it never caches the writer's admission. A failed settlement keeps the S1 retry-at-release and does not abandon the client (U3).
- **G19 #102 is fixed inside S3**, because S3 already touches `process-bootstrap.ts`. A `project.list` that answered `broken` with a registry-data code (`REGISTRY_CORRUPT`, `REGISTRY_SCHEMA_UNKNOWN`, `REGISTRY_SCHEMA_NEWER`) completed its cleanup: a failed `finally` cleanup (the listing Storage owner's `stop`, `project-listing.ts:226-227`; the registry client's `close`, `registry-database.ts:106-108`) would have replaced that code with `INTERNAL_FAILURE`. Such a listing no longer makes the cleanup unconfirmed. `INTERNAL_FAILURE`, work still running past the budget, and a rejection during the drain stay unconfirmed. Stop then reports every unconfirmed part, including the registry stop, in one `RegistrationCleanupUnconfirmed` error, so the original failure is never masked (`degrade-distinguishes-broken`).
- **G20 Names** (decisions §30, ADR 0021). New text uses Strand (formerly Feature), Weave and Forger. Existing text, ADR quotes and code identifiers keep the former names until the rename slice. C1 itself names none of these concepts.
- **G21 S4 in React, split, Conversation region only** (Pedro, decisions §42, §43). S4 is built in React from the hero prototypes, as two slices: S4a (renderer foundation) and S4b (Conversation window), each with its own red-green cycle and candidate review. Behaviour IDs CNV-B16–B18 and B31–B35 move to S4b; their meaning is unchanged except where revision 5 says so: CNV-B16 (G25), CNV-B31 and CNV-B35 (a `stale-activation` read for the current activation is now a failed load with no action, not dropped, so the region never stays loading; Pedro, decisions log §45), and CNV-B33/B34 (focusable unavailable Save, G26). Only the Conversation region is restyled; the old shell (rail, header, Projects sidebar) stays until the shell slice of the React port, so two looks coexist for a while. Rejected: one large S4 (too big to review); porting the shell inside C1 (it changes every existing e2e locator).
- **G22 Seixo is scoped to the region; the old shell is layered and reset at the region edge.** The DESIGN.md tokens, the component and elevation values the region uses, the decided focus ring and the forced-colors rules live in one CSS module on the region's root class; every region selector contains a module-local class, so only `@font-face` is global. Every old-shell style sheet is wrapped in `@layer legacy-shell` in its current order, so its own cascade is unchanged. Because a layer only decides properties both sides declare, the region also starts with an unlayered zero-specificity reset, `:where(.<root> *:not(svg, svg *)) { all: revert }`, which removes every legacy value (the old `h2`, `p`, `code` and `.shell button` rules, the global `:focus-visible` outline and the transitions) from region elements while leaving the icons' presentation attributes and all custom properties alone. CNV-B42 pins the module statically, CNV-B51 pins the look with rows a leak would fail, and CNV-B50 pins the old shell. The ring adopted here (decisions §33, `access.css:8-17`) supersedes DESIGN.md:284's halo-only rule; the ui-ux agent updates DESIGN.md (carry-forward). When the shell is ported, the scope moves to the app root and the layer and reset are deleted. The fonts are the three `@fontsource` packages, never inlined, served locally (§43).
- **G23 The old prototype window is deleted in S4a** (Pedro, §43), with its Vite config, Forge renderer, `--prototype` branches, declarations and defines, knip entry, script, e2e journey and the unit row that tested `--prototype`. The `ragnarok-hero` prototypes stay the visual reference. The old shell keeps its look: every `prototype-global.css` rule it relies on moves into `legacy-shell.css` at the same place in the cascade, and the old tokens are renamed `--prototype-*` → `--legacy-*` with unchanged values (CNV-B50), so no "prototype" name remains in the desktop app.
- **G24 Visual answers** (ui-ux agent, 2026-10-10, V1–V7 and R1–R4; it owns visuals). "Save locally" is a plain frost primary with no icon and no anvil (the anvil stays for a real Send, C2). No state uses the eclipse. Failure tone: circle-x; Broken tone: blood outline, triangle-alert, the code; Reload and Try again: rotate-ccw; Saved: check; read-only: lock; the note: info, in the context line. 24-hour en-GB times, no day separators. The stream opens at the newest message. The composer bar holds only Save. **Copy marked PROPOSED** by the ui-ux agent, for Pedro to approve with this revision: "Write a message", "Loading messages…", "No messages yet", "Messages you save stay on this computer.", "Could not load this conversation.", "Read only: <reason>", "Not saved.". Designer-proposed copy, same status: "Not confirmed." (for `uncertain` and a dropped save, which may have committed), the Broken-tone code line "Code <CODE>", "The conversation changed and was reloaded. Save again to add your message.", "The desktop could not complete this save.", "The desktop could not load this conversation."
- **G25 The bridge tells "not sent" from "sent, then lost"** (the coordinator's relay of Pedro's answer, 2026-10-10; not yet in the decisions log, so Pedro confirms it with this revision). A call after `stop()` becomes its own `unsent` fault. For a save, every "sent, then lost" path — a disconnect or a stop while pending, and a `protocol-error` while pending, which is how every malformed reply arrives — answers `uncertain`, because the harness may have committed. A decodable reply with the wrong event or a mismatched echo stays `broken` because it points to a defect (`degrade-distinguishes-broken`); the kept `saveId` (G27) makes a later press replay any commit it hid. Reads answer `unavailable` or `broken` as in S3b. Rejected: keeping `protocol-error` as `broken` for a sent save, which would hide a possible commit.
- **G26 Accessibility rules for S4** (Pedro, decisions §33; checklist `ragnarok-hero/access.src.html:381-393`). Every S4 slice states its checklist mapping. A failure is announced at once but politely; only the Broken tone is assertive (checklist 05). The status slot `#conversation-status` is a polite live region without `role="status"`, because a second `role="status"` breaks the existing strict e2e locators. An unavailable Save is never `disabled`: it is `aria-disabled="true"`, stays focusable, and is described by the visible reason where one exists (the repository's pattern, `add-repository-button.tsx:43-46`); this includes the pending Save, so focus is never dropped to `body`. Pressing "Try again" moves focus to Save; "Reload" stays mounted and `aria-disabled` while it reads, then focus goes to the composer. A load moves focus only when it is the first load of an activation or a Reload, and only while focus is on `body` or on the control that started it, so a remount inside one activation never steals focus from the add or removal flows. The composer field's focus-within ring is the decided ring (Seixo V3's halo-only field rule is below checklist 02's 3:1). The agent's NVDA speech-log pass and Pedro's Narrator listen are manual evidence per phase; the ui-ux agent's screenshot review covers states the real window cannot reach. Where the ui-ux proposal used `role="status"`, `role="alert"` or `disabled` for these cases, these rules win, and the ui-ux agent was told (R1, R2).
- **G27 Save identity and revision in the window.** Every successful read sets the Project's `expectedRevision` to the read's `revision` (0 for none); a non-replayed `saved` sets it to the returned `revision`. A `saveId` lives until the text is edited or a definitive outcome (`saved`, `conflict`, `rejected`) arrives. Every other outcome keeps it, so "Try again" or a later press can only replay, never duplicate. While a save is pending the composer is read-only. Per-Project memory holds `{ text, saveId, expectedRevision, outcome, activationId }`; a result changes it only while its `saveId` matches a pending outcome; the outcome decides what a Project shows when it loads under a new activation (old pending and dropped saves show "Not confirmed." with "Try again"; `uncertain` and `unavailable` rows keep their line and "Try again"; rows tied to the old activation, including `read-only`, are cleared), and the status slot has a fixed precedence.
- **G28 The desktop bridge keeps its Promise core.** S4b adds two `echoing` operations, one fault kind and one pure mapping function, and no new Promise coordination. The Electron main process already runs Effect programs through `Effect.runPromise` at its edges (`desktop-shutdown.ts:28`, `harness-supervisor.ts:195`), but it has no service or Layer composition, and the bridge's Promise core (`request`, `requestHarness`) is shared by list, register, activate, switch and upgrade; moving only the two new operations would fork it, and moving all of it is its own migration. Trigger (the same in Deferred Work): a slice that changes the bridge's request core beyond adding an operation, or the coordinator scheduling the desktop-main Effect migration. This is an explicit exception to "touched code follows the Effect rules" for reviewers, approved or rejected by Pedro with this revision.
- **G29 One per-window CSP owner, and the main policy also written into the page** (found in revision-5 review round 1; Pedro: "nothing changes on CSP", issue #130). The renderer is loaded from `file://` in the e2e build and the packaged app, and Electron's security guide says a header CSP cannot apply there, so AGENTS.md's strict CSP may not be in force today. S4a moves the policy to one shared builder, `contentSecurityPolicy({ window, delivery, development })`, with no Electron import. For `window: "main"` it returns today's policy exactly: the header (with the localhost connect sources only in development) and a build-time `<meta>` that is always the packaged variant without `frame-ancestors`, placed as the first element after `<meta charset>`. The `window` parameter lets the React port later add the Rive splash window's own variant, with `'wasm-unsafe-eval'` in `script-src` for that window only (decisions log :268-274); S4 builds no splash window and no such variant, and a unit row pins that no main-window policy contains it. A positive control proves the policy is enforced (CNV-B48). Rejected: asserting "no violation" alone, which also passes when no policy applies.
- **G30 S4a merges to `main` only together with S4b**, as S1 did with S2 (G15). On its own, S4a would replace the "not available in this view yet" sentence with a note about saving messages while no composer exists.
- **G16 Chain order from links** (R2-C5). The chain order and its root are derived from source→target links; the root is the row whose source is no row's target. `started_at` comes from an injected clock and is never checked: equal or backward times never make a correctly linked chain `REGISTRY_CORRUPT` (Pedro, S1 review round 1, U1).

## Slices

The order is S1 → S2 → S3 → S4a → S4b → S5. Behaviour IDs are `CNV-B…`. Each slice is one commit: red at its seam, minimal implementation, green, then a separate review and refactor.

**Merge order (G15, decided):** S1 is not split; it merges to `main` only together with S2.

### S1 `c1-s1-schema-and-chained-upgrade` — schema 4, chained upgrades, registered Projects survive upgrades

**Behaviour**
- New Projects are created at schema 4.
- Every existing Project upgrades to schema 4 and opens read-write, keeping every pre-existing row: Storage-only v2 and v3 Projects, Projects upgraded once by C1-0, and registered Projects. A registered Project keeps its list entry, activation, visibility and re-add.
- Every older generation and every backup is kept.

**Seams**
- The Storage owner (`createProjectStorageOwner`, `createUpgradeStorageOwner`) and the registry authority (`application-database-migration.ts`), over a temporary application root and the checked-in migration root.
- Registered Projects go through the real registration flow (`project-entry-ui-seed` steps, `registration-flow-fixture.ts`), and through the harness runtime (`startHarnessProcessRuntime`) for listing and activation.

**Files**
- `canonical-schema.ts`, and the generated `drizzle/canonical/0003_conversation_messages.sql`, snapshot and journal.
- `project-storage-database-specs.ts`: schema 4 and the three table specs.
- `generated-migration-resources.ts`: a generation-four rebuild pin.
- `application-database-migration.ts` (G12, G16): the chain rule. The completed rows of a Storage, ordered by their source→target links from the root, must satisfy all of:
  - they form one unbranched chain;
  - exactly the last row's target is the active generation;
  - no source is in `storage_generations`.

  Anything else is `REGISTRY_CORRUPT`. The file also provides `chainRootCreatedAt`, `chainRetainedGenerationIds` and `receiptGenerationResolves`.
- `project-storage-upgrade-node-adapter.ts`: `completedUpgradeFor` returns the row targeting the active generation; `proveUnfinishedUpgrade` (:601-605) retains every chain source.
- `project-storage-node-adapters.ts`:
  - :819-824 compares with the chain root's `sourceCreatedAt`; the root is found by links (replaces the C1-0 :264 `started_at` rule);
  - :1070-1077 admits every retained chain generation.
- `registration-confirmation-store.ts:265-273`: a receipt's generation is valid in either of two cases:
  - it is activated in `storage_generations` with the reservation's create request;
  - it is the chain root's source with that create request, and the chain ends at the registration's active generation (G12).
- The opening manifest check: manifest v2 names the latest upgrade.
- ADR 0005 and 0006 amendments. They replace "at most one completed row … later gate" (ADR 0006 :147), the single-row wording at :149-150, and the code comments at `application-database-migration.ts:146` and `project-storage-upgrade-node-adapter.ts:650`.
- Fixtures, named by depth:
  - `createGenerationTwoProject`;
  - new `createGenerationThreeProject`;
  - new `createUpgradedOnceProject`, checked against a pinned capture of a real C1-0 upgrade made at `9aab1cc` (under `tests/fixtures/`).
- `rewindToGenerationTwo` also drops the v4 tables.
- The `0002`/`schemaVersion: 3` pins: `project-storage-schema-cases.ts:94`, `project-storage-upgrade.integration.test.ts:100,505`, `canonical-writer-package-smoke-fixture.ts:165`.
- Shared helper `rewindToGenerationThree` for registered Projects. It is used by the CNV-B20 test and by the CNV-B19 seed.
- `vitest.registration-files.ts` gains `registration-project-upgrade.integration.test.ts` (CNV-B20). Idle durations are recorded.
- Mutation (R2-C13): the chain rule and the filesystem agreement go into `stryker.project-storage.config.json`, which runs `vitest.project-storage-mutation.config.ts`. The root config runs unit projects only.

**Contracts**
- **CNV-B1** `creates new Projects at schema 4` → `tests/integration/project-storage-conversation-schema.integration.test.ts`.
  - Oracle:
    - the canonical schema rows equal the v4 spec;
    - a 32768-byte multibyte body is accepted;
    - an it.each of raw-SQL inserts that must be rejected, one per permanent rule:
      - a 0-byte body and a 32769-byte body;
      - `waypoint` with a null `waypoint_id`, and `project` with a non-null one;
      - a second `project` conversation for the same Project, and a second root branch;
      - a parent without a fork, and a fork without a parent;
      - cursor 0, and a duplicate (`branch_id`, cursor);
      - an author outside the set;
      - a message whose (`conversation_id`, `branch_id`) pair does not exist.
  - Expected red (unscaffolded base): a new Project is created at schema 3 without the tables, so the v4 rows and every insert case fail.
- **CNV-B2** `upgrades a generation-three Project to schema 4` (same file).
  - Oracle: safe mode `migration-required` → `upgraded` → read-write at schema 4, with every pre-existing table's rows equal.
  - Expected red: none — guard. At base, a v3 Project answers `not-required` before planning (`project-storage-upgrade-pipeline.ts:196`). The test passes as soon as CNV-B1's migration lands; this is recorded.
- **CNV-B3** `upgrades a generation-two Project to schema 4 in one upgrade` (same file).
  - Oracle: one upgrade applies `0002` and `0003`, then the Project opens read-write.
  - Expected red: the target is still schema 3.
- **CNV-B4** `upgrades a Project that was already upgraded` → `tests/integration/project-storage-chained-upgrade.integration.test.ts`.
  - Oracle:
    - the upgrade answers `upgraded`, then the Project opens read-write at schema 4;
    - generations v2, v3 and v4 and both backups are on disk;
    - two completed rows form the chain;
    - reopening from a new owner on the same root is read-write (chain root `createdAt`);
    - create-replay of the original request answers the same Storage.
  - Expected red: the second upgrade switches, then opening fails with "Project Storage upgrade authority is not unique."
- **CNV-B5** `refuses a broken upgrade chain` (same file).
  - Oracle: each of these gives `REGISTRY_CORRUPT`, and the Project is never opened:
    - a source that is not the previous target;
    - two rows targeting the active generation;
    - a source still in `storage_generations`;
    - a three-row chain with a gap.
  - Expected red: none — pin. It is already `REGISTRY_CORRUPT` at base (`application-database-migration.ts:160-167`).
- **CNV-B5b** `discards an interrupted upgrade on a chain` (same file).
  - Oracle, case 1:
    - an upgraded-once Project is stopped at `after-staged-copy`, then activated → safe mode `migration-required` on v3, with the first chain row, its source generation and its backup untouched;
    - a new `upgrade` completes the chain.
  - Oracle, case 2: two completed rows plus an interrupted upgrade, seeded by SQL and file copy (pattern of `registration-storage-upgrades.integration.test.ts:42-58`; no third migration). The discard proof retains both the v2 and the v3 sources, and the discard succeeds.
  - Expected red:
    - case 1: completing the chain is refused, because opening the second completed row fails "not unique";
    - case 2: `completedUpgradeFor` throws "not unique", so the proof cannot run.
- **CNV-B20** `keeps a registered Project usable after its upgrade` → `tests/integration/registration-project-upgrade.integration.test.ts` (registration project).
  - Oracle: a Project registered through the real flow at v3 is upgraded to v4 through the runtime. Then:
    - `project.list` shows it registered and present;
    - activation is read-write;
    - list visibility and re-add answer as before;
    - its receipt still decodes and matches.
  - Expected red: `REGISTRY_CORRUPT` from `readProjectRegistrationRecords`.
- **CNV-B22** `accepts a chain of three` (chained file).
  - Fixture: three completed rows plus the matching generation directories and backups, seeded by SQL and file copy.
  - Oracle: the chain rule accepts it; the filesystem agreement admits all three retained generations; the discard proof over three generations holds; opening is read-write.
  - Expected red: none — pin over S1's rule.
  - Gap disclosed: no real third migration runs. A test-only migration root is impossible without a production hook, because plan and migrate bind `databaseSpecs.canonical` (`project-storage-upgrade-node-adapter.ts:411, :420, :470`; `generated-migrations.ts:139`).
- **CNV-B23** `reproduces a real C1-0 upgrade` (chained file).
  - Oracle: `createUpgradedOnceProject` yields registry rows, manifests and directory listings equal to the pinned capture.
    - Normalised fields: generation, upgrade, location and lineage ids; create request ids and fingerprints; timestamps; manifest hashes and sizes.
    - The capture command and the revision (`9aab1cc`) are recorded beside the data.
  - Expected red: none — fidelity guard.

**Risks**
- This is the largest slice, and the registry invariants are subtle. The chain rule must be easy to move into the #92 journal.
- Retention grows on disk (accepted).
- Pin churn; jscpd; the timing guard (B29) at schema 4.
- The e2e upgrade seed changes.

### S2 `c1-s2-conversation-store` — save and read in the Project database

**Behaviour.** Saving appends an immutable message with exact identity, text and order. Exact retry, conflict, reuse, busy, broken, stale writer and uncertain behave as specified. Canonical sequence, receipts, idempotency and events never change. Canonical commands and saves serialize without closing admission.

**Seam.** A real read-write activation session (`project-storage-runtime-fixture.ts`) with the real writer, through `writer.conversation(work)`. The composition `withConversationWriter` extends `withFixtureWriter`.

Fault seams (R2-C9):
- **Real:**
  - a held exclusive lock (busy);
  - a reader holding a SHARED lock during COMMIT (CNV-B10 case a);
  - a moved `writer_fence` row;
  - a corrupt row written by raw SQL;
  - an exclusive lock held past the read-only client's 2 s wait (CNV-B10 case c).
- **Injected at the worker-client seam** (the `LocalLibsqlClient` passed to the writer in the fixture): typed SQLite errors `SQLITE_LOCKED`, `SQLITE_CANTOPEN`, `SQLITE_IOERR` and `SQLITE_READONLY` raised from `execute`.
- **Injected at the classification seam:** only the failed close after an acknowledged commit (CNV-B10 case b).

**Files**
- New `apps/harness/src/conversation/` (store, errors, rows).
- `canonical-project-writer.ts`: the slot queue and `conversation`.
- `canonical-command-repository.ts`: the typed `WriterOwnerBusy`.
- New shared `sqlite-busy.ts` (`isSqliteBusy`), used by `registration/registry-failure.ts`.
- `canonical-project-writer.ts` (abandoned-client release); `canonical-command-repository.ts` (raw force-close).
- `vitest.native-long-files.ts` gains the busy cases of CNV-B9, B10 case a (a 5 s blocked COMMIT) and B25. Idle durations are recorded.
- Mutation (R2-C13): a new `stryker.conversation.config.json` running a `vitest.conversation-mutation.config.ts` project over the store, slot-queue and `sqlite-busy` tests.

**Contracts.** Integration file `tests/integration/conversation-store.integration.test.ts`. BUSY cases run in `vitest.native-long.config.ts`, with a 15 s per-test timeout and recorded durations. "Canonical snapshot" means a byte snapshot of `project_state`, `command_receipts`, `command_idempotency` and `canonical_events`; every case asserts it is unchanged.

- **CNV-B6** `saves and reads messages in order`.
  - Oracle: three saves, then a read → cursors 1–3 with exact texts (leading and trailing spaces, `\r\n`, tab, non-ASCII), harness-minted ids and `savedAt`; canonical snapshot unchanged.
  - Expected red: after scaffolding the store with a non-persisting stub, the read returns `null`.
- **CNV-B7** `returns the original result for an exact retry`.
  - Oracle:
    - the same `saveId` after a later save → the original `saved`, `replayed: true`, and no new row;
    - the same `saveId` with other text → `SAVE_ID_REUSED`;
    - canonical snapshot unchanged.
  - Expected red: a second row is inserted.
- **CNV-B8** `reports a revision conflict`.
  - Oracle: a stale `expectedRevision` → `conflict { currentRevision }`, no row, canonical snapshot unchanged.
  - Expected red: the message is appended anyway.
- **CNV-B9** `keeps busy and broken storage distinct` (native-long).
  - Oracle:
    - another connection's exclusive lock → `ConversationStorageBusy` after about 5 s, with the duration recorded;
    - injected `SQLITE_LOCKED` → busy;
    - injected `SQLITE_CANTOPEN`, `SQLITE_IOERR`, `SQLITE_READONLY` and a corrupt row → broken;
    - none of them is saved;
    - after the lock is released, and after a corrupt-row broken save, the next save and the next `project.command` are both accepted, with no `writer-unavailable` (R2-B2).
  - Expected red: everything is broken, because there is no busy mapping.
- **CNV-B10** `reconciles an uncertain commit by its save id`.
  - Oracle, case (a), known client state: a real COMMIT is blocked by a SHARED reader (native-long).
    - The separate connection sees no row → `unavailable PROJECT_STORAGE_UNAVAILABLE`, retryable.
    - Admission stays open.
    - After the reader is released, a resend with the same `saveId` saves once, and the next command is accepted.
  - Oracle, case (b), unknown client state: an acknowledged commit, then a failed close.
    - The separate connection sees the row → `saved`.
    - The next command and save answer `writer-unavailable`. A read still answers, through the per-request read-only client (R2-C3).
    - A command queued behind the failing save answers `writer-unavailable`, not an internal error (R2-C1).
    - A switch and, in a second run, a `project.close` answer `sourceReleased: true`. (Built as a coordinator stop: deviation 6b, decisions §28.)
    - The next activation is read-write and records an `abandoned-active-fence` recovery.
    - A resend with the same `saveId` answers `replayed`.
  - Oracle, case (c): an exclusive lock held past the read-only client's wait makes the reconciliation read fail → `uncertain`.
  - Every case: the canonical snapshot is unchanged.
  - Expected red:
    - (a): after scaffolding, the store maps the uncertain classification to `broken`, because it does not reconcile;
    - (b): the switch answers `release-failed`, because `releaseFence` runs on the abandoned client.
- **CNV-B11** `refuses a save from a stale writer`.
  - Oracle: the `writer_fence` row is moved to another generation, then a save → `stale-writer`, no row, canonical snapshot unchanged.
  - Expected red: the row is written.
- **CNV-B24** `serializes canonical commands and saves without closing admission`.
  - Oracle:
    - with a save held in its transaction, a `project.command` is submitted; it settles after the save;
    - the next command and the next save are accepted;
    - the reverse order (a settlement held, a save waits) behaves the same;
    - no `writer-unavailable` appears;
    - the canonical state equals a command-only control run of the same commands.
  - A writer-level unit case drives the defensive `WriterOwnerBusy` branch with a fake owner. It answers `command-busy` and closes nothing.
  - Expected red: the command meets a busy owner, and `WRITER_UNAVAILABLE` follows.
- **CNV-B25** `never reads partial state as empty`.
  - Oracle:
    - zero rows → `null`;
    - a conversation without a root branch, a cursor gap, or an undecodable row → broken;
    - a held lock during a read → busy; after release, the next read, save and command are accepted (R2-B2);
    - read-only activation (R2-C4):
      - a short external commit during the read does not fail it;
      - an exclusive lock held past 2 s answers `unavailable PROJECT_STORAGE_UNAVAILABLE`, never broken or `null`.
  - Expected red: a partial state reads as `null`.
- **CNV-B26** `pages by cursor`.
  - Oracle:
    - (page sizes, `nextCursor`) for 100 messages: (100, `null`); for 101: (100, 100), then (1, `null`); for 201: (100, 100), (100, 200), then (1, `null`);
    - `after` is exclusive.
  - Expected red: one unbounded page.
- **CNV-B27** `creates one conversation for two first saves`.
  - Oracle: two saves in the same tick on an empty Project, both with `expectedRevision: 0`. The first is `saved` at cursor 1; the second is `conflict { currentRevision: 1 }`. Exactly one conversation row and one root row exist.
  - Expected red: none — guard. The unique indexes and the FIFO slot make a duplicate impossible; the test pins it.
- **CNV-B28** `classifies busy with one shared predicate` → `src/storage/sqlite-busy.test.ts`.
  - Oracle:
    - BUSY and LOCKED are busy; CANTOPEN, IOERR, READONLY and unknown codes are not;
    - `registryFailure` gives the same answers as before.
  - Expected red: none — pin of the extraction (behaviour-preserving for the registry).

**Risks**
- The slot queue changes the canonical writer's hot path.
- The 5 s busy wait holds the generation worker (hence the native-long project).
- Mutation testing of the store and the queue.

### S3 `c1-s3-conversation-protocol` — protocol v8, coordinator admission, runtime

**Behaviour**
- The harness answers read and save for the active Project only, with every row of the result table. A switch and a coordinator stop drain admitted work and refuse new work. `project.close` is a Storage-level command and is out of this rule (deviation 6b, decisions §28).
- After the writer's admission closes, reads still return the stored page through the read-only client; saves answer `writer-unavailable` (G17).
- A failed force-close of an abandoned client reports its own release code (CNV-B36).
- A broken Project listing whose cleanup completed no longer makes the runtime stop fail; a listing whose cleanup failed still does, with every unconfirmed part named (CNV-B37).

**S2 constraints S3 must honour**
- The writer stays the one owner of admission, decided inside its slot (G18). S3 adds no admission flag in the coordinator or the runtime.
- A failed settlement keeps the S1 retry-at-release (U3). S3 never maps its release failure to `WRITER_CLIENT_ABANDON_FAILED`.
- `WriterOwnerBusy` still maps to `command-busy` with admission open (existing pin).

**Effect (AGENTS.md).** The coordinator's `conversationRead` and `conversationSave` are Effect programs (`Effect.fn`) that call the S2 store programs, exposed to the Promise-based coordinator and runtime through one documented temporary Promise facade, the precedent of the writer's `conversation` facade (`canonical-project-writer.ts:38-48`); `runPromise` appears only in that facade. The per-request client is opened through `withReadOnlyClient` (`acquireRelease`). `admitActiveWork` and the CNV-B37 cleanup rule are plain synchronous functions. The listing adapter's `stop` collects failures as values and throws once at the facade.

**S3 anchors, re-verified at `80228ac`.** `execute` `active-project-coordinator.ts:651-672`; `release` :498-520; `stop` :604-616; `releaseCode` :260-273; switch release-failed :633-643; `runSettlement` `canonical-project-writer.ts:174-193`; `tracked` :153-173; `closeOnce` :137-145; `WriterOwnerBusy` `canonical-command-repository.ts:377`; protocol code list `canonical-project-protocol.ts:141-156`, activation `broken` union :234-251, `switchReleaseDiagnosticSchema` :411-425; `project.close` routing `harness-runtime.ts:267-271`; unrouted registry fallthrough :285-291 and :329-335. The Facts section above keeps its `9aab1cc` anchors for S1 and S2.

**Seams**
- **(a) Process runtime:** `startHarnessProcessRuntime` over a transport (S3a seam (a)), real worker clients. Used for the plain rows that real data, real locks and real fences produce: `saved`, `replayed`, `conflict`, `SAVE_ID_REUSED`, `stale-writer`, the refusal rows, `read` (null, messages, read-only Project), the real-lock busy rows, CNV-B30 identity, and CNV-B37 integration.
- **(b) Composed runtime:** `startHarnessRuntime` over a coordinator composed in the test, the precedent of `canonical-writer-recovery-runtime-fixture.ts:162` and `conformance-counter-command.ts:701`. Its writer repositories use the fixture's `faultingClient` (`writerClientFaults`, `writerClientCloses`, `noteSettlementHolds`, `project-storage-upgrade-fixture.ts:65-128`, plus a new `writerClientCalls` counter of `execute` and `transaction` calls), and its read-only paths are injected: reads through the coordinator's `readConversationReadOnly` port, and the save's reconciliation through `openReconciliationClient`, both with a hooked opener (`readOnlyClientOpenHooks`, `conversation-writer-fixture.ts:42`). The `uncertain` row hooks `openReconciliationClient` to release the shared reader and take the exclusive lock at the moment the reconciliation opens, as the CNV-B10 (c) fault does in S2. Used for: storage broken (injected), both closure kinds, the CANTOPEN row, the client-call counts, every held or same-turn row in CNV-B14, the CNV-B13 queued-read rows and the fallback paging row. The `uncertain` row also runs here, in the busy file (it holds a real lock, CNV-B10 (c)). With no `projectRegistration` in this composition, an unrouted command answers `project.registration.result unavailable PROJECT_REGISTRATION_UNAVAILABLE` (`harness-runtime.ts:285-291`).
- **Unit tests** with fakes: coordinator (CNV-B14 same-turn rows, CNV-B29, B36, B38), canonical application (CNV-B40), runtime (CNV-B39), writer (CNV-B36), registration (CNV-B37).
- **Test teardown (#102 lesson).** A test that ends with a failed release or an abandoned client asserts the release outcome explicitly. Its teardown collects a cleanup failure and reports it together with the first assertion failure, never instead of it.

**Files**
- `packages/protocol`: new `project-conversation-protocol.ts`; `protocol.ts` (v8, factories); `index.ts`; the `protocolVersion: 7` pins.
- The desktop pin: `apps/desktop/src/main/canonical-writer-package-smoke-test-peers.ts:73`.
- `apps/harness`: `active-project-coordinator.ts` (`admitActiveWork`, `conversationRead` with the G17 fallback, `conversationSave`; `ActiveActivation` records `canonicalDatabasePath` when `acquireWritable` publishes it, for both access variants, so the fallback never narrows a session union; new dependencies: the Conversation ids and clock, a `readConversationReadOnly(input: { canonicalDatabasePath, projectId, after }) → Effect<page, ConversationStorageBusy | ConversationStorageBroken>` port that defaults to `readProjectConversationReadOnly`, and an optional `openReconciliationClient(databasePath) → LocalLibsqlClient` passed to `saveConversationMessage` as its `openReadOnlyClient` (`conversation-save.ts:25`), defaulting to the generation read-only client; the two are separate so a test can hook the save's reconciliation without touching reads), `node-active-project-coordinator.ts` (production wiring of those dependencies), `harness-runtime.ts` (dispatch), `canonical-project-application.ts` (strict decode and request-echo correlation of the two new results, CNV-B40), `process-bootstrap.ts`.
- `conversation/conversation-store.ts`: `readProjectConversationReadOnly` passes the existing optional `openReadOnlyClient` (:255) through.
- Deviation 6a (CNV-B36): `packages/protocol/src/canonical-project-protocol.ts` (code list :141-156, activation `broken` union :234-251, `switchReleaseDiagnosticSchema` :411-425) and its test (the `broken` pin and the switch application failure list); `apps/harness/src/canonical-project-writer.ts` (`CanonicalProjectWriterReleaseFailureCode` :28-32, `abandonClient` :285-292).
- #102 (CNV-B37): `registration/project-registration-preparation.ts` (`trackedListing` :279-291); a new exported `registration/registration-listing.ts` that takes over `registrationListing` from `process-bootstrap.ts:145-157`, with owner, observer and registry ports; the flipped pin in `tests/integration/registration-project-upgrade.integration.test.ts:114-115`.
- Tests: `tests/integration/project-conversation-runtime.integration.test.ts`; a separate `tests/integration/project-conversation-runtime-busy.integration.test.ts`, added to `apps/harness/vitest.native-long-files.ts`; a composed-runtime fixture beside the existing ones, with a new `conversationWorkHolds` gate next to `noteSettlementHolds` and the `writerClientCalls` counter; `project-storage-upgrade-fixture.ts` exports `faultingClient`, `recordNoteCommand` and `noteAggregateId`, which are module-private today; the fakes that typecheck lists.

**Contracts**
- **CNV-B12** `encodes conversation messages strictly` → `packages/protocol/src/project-conversation-protocol.test.ts`.
  - Oracle:
    - a literal table equal to the result table above, compared key by key with `projectConversationDiagnostics`;
    - every row round-trips with its exact message and retryable flag, including the bridge-only rows;
    - text of 32768 bytes (multibyte) passes;
    - 32769 bytes, empty text, `" \t\r\n"` and NBSP-only text fail;
    - an extra key, or a row in the wrong status, fails;
    - a version-7 command → `PROTOCOL_VERSION_UNSUPPORTED`;
    - rejected commands (it.each): `after` -1 and 1.5, `expectedRevision` -1 and 1.5, `saveId` `"not-a-uuid"`, a missing `activationId`, a `projectId` that is not a UUID;
    - accepted edges: `after: 0`, `after: null`, `expectedRevision: 0`;
    - rejected result rows: a message with `cursor` 0, a negative `revision`, a `nextCursor` that is negative.
  - Expected red: after scaffolding the exports, the union rejects `project.conversation.save`. The `after`, `expectedRevision`, `saveId` and result-row bound rows are red against a scaffold that types those fields as plain numbers and strings; they are recorded as the first red of the schema refinement. The missing-`activationId` and non-UUID `projectId` rows are guards: any `Struct` scaffold that reuses the branded `ProjectIdSchema` already rejects them.
- **CNV-B13** `maps $outcome through the harness for $op` → `tests/integration/project-conversation-runtime.integration.test.ts`; the busy rows in `project-conversation-runtime-busy.integration.test.ts` (native-long).
  - An it.each over every harness-produced row of the result table, per op; the seam column says (a) or (b):
    - save: `saved` (a), `replayed` (a), `conflict` (a), `SAVE_ID_REUSED` (a), `uncertain CONVERSATION_SAVE_UNCONFIRMED` (b, the CNV-B10 (c) fault, busy file, native-long: about 8.7 s at the writer seam in S2), storage busy (a, real lock, native-long), storage broken (b, injected `SQLITE_IOERR`), `stale-writer` (a, moved `writer_fence` row), `writer-unavailable` (b), `inactive`, `project-mismatch`, `stale-activation`, `coordinator-unavailable`, `read-only` (a);
    - read: `read` with `{ conversation: null }`, `read` with messages, `read` on a read-only Project (the earlier messages), read busy (a, native-long), read broken (b), `inactive`, `project-mismatch`, `stale-activation`, `coordinator-unavailable` (a).
  - Each row is compared with `toEqual` against the protocol map.
  - **Paging row** (the `after` pass-through): 101 messages seeded by raw SQL; `after: null` → 100 messages and `nextCursor: 100`; `after: 100` → 1 message and `nextCursor: null`. Run once through the writer (seam (a)) and once through the G17 fallback after a failed-settlement closure (seam (b)).
  - **Rows after the writer's admission closes (R2-C3; U2, decisions §29), seam (b):** after the writer's admission closes, by an abandonment (B10(b) close fault) or a failed settlement, `project.conversation.read` answers through the per-request read-only client: the stored page as before, a save answers writer-unavailable, and a read-only client failure answers busy or broken, never an empty conversation.
    - Closure kinds (it.each):
      - **abandonment:** the CNV-B10 (b) fault: a closing save whose commit is acknowledged and whose close fails (`writerClientFaults.push({ match: /^close$/, error })`); it answers `saved` with `replayed: false`, which the row asserts;
      - **failed settlement:** `writerClientFaults.push({ match: /^close$/, error })` before a fixture note `project.command` (`recordNoteCommand`, type `fixture.record-note`, `project-storage-upgrade-fixture.ts:123-148`, with `noteAggregateId`). The one-shot fault leaves the settlement transaction unfinished (`canonical-command-repository.ts:354-360`); the settlement throws and closes admission, and the S1 retry-at-release closes it at release (U3).
    - Setup: one message saved and its page read (P1), then the closure. Expected page, per kind:
      - failed settlement: the read `toEqual`s P1 (the command writes no Conversation row);
      - abandonment: the read `toEqual`s P1 plus the closing save's message (`conversationMessageId`, cursor and `savedAt` from its `saved` answer), with `revision` P1 + 1 and `nextCursor: null`.
    - Oracles, per closure kind:
      - the read answers the expected page above;
      - a further save with a new `saveId` → `writer-unavailable` (`WRITER_UNAVAILABLE`, "Saving is unavailable until the Project is reopened.", retryable false);
      - with an exclusive lock held past the read-only client's 2 s wait → `unavailable PROJECT_STORAGE_UNAVAILABLE`, retryable true (busy file, native-long);
      - with `SQLITE_CANTOPEN` from the injected read-only opener → `broken PROJECT_STORAGE_BROKEN`;
      - in no case `read` with `{ conversation: null }`;
      - `writerClientCalls` (the writer client's `execute` and `transaction` calls) does not change during the reads: the reads never use the writer's client; `writerClientCloses.count` does not change either (no force-close).
    - Expected red: with the plain rows green, the minimal scaffold maps the writer's refusal of a read to `broken PROJECT_STORAGE_BROKEN` (the result table has no `writer-unavailable` row for reads). The test observes that row instead of the stored page.
  - **Queued-read rows (G17/G18, the round-3 lesson), seam (b), per closure kind:** the closing save (held by `conversationWorkHolds`) or the closing settlement (held by `noteSettlementHolds`) holds the slot; a read is sent and queues behind it; the hold is released and the closure happens. Oracle: the read answers the expected page of its closure kind (above) through the read-only client, never `writer-unavailable`, `broken` or null.
    - Expected red: none — guard. It passes once the plain closure rows pass, because the routing uses the writer's in-slot answer. It is bound by a recorded mutation: the coordinator decides the fallback from a closure check made **before** entering the writer slot; the queued read then answers `broken PROJECT_STORAGE_BROKEN`, and the row must fail.
  - Expected red (plain rows): after protocol scaffolding, the runtime does not route the commands. Through seam (a) they fall to the registry handler and answer `request.failure HARNESS_INTERNAL_FAILURE` (`harness-runtime.ts:329-335`, the S3a B26 precedent); through seam (b) they answer `project.registration.result unavailable PROJECT_REGISTRATION_UNAVAILABLE`. The observed reds are recorded.
  - Durations: every busy row records its idle time, as S2 did (#94); each must stay under the 15 s per-test budget, and any timeout goes to the coordinator before a rerun.
- **CNV-B14** `drains conversation work on switch and stop` (deviation 6b extended to S3, decisions §36: switch and coordinator stop, never `project.close`).
  - **Build order.** Phase 1 comes after the plain CNV-B13 rows and before CNV-B38; phase 2 comes after CNV-B38 and the CNV-B13 closure rows are green. At the plain-B13 stage, saves and writer reads are registered in `admitted` (they go through `admitActiveWork` like `execute`); read-only reads are not yet registered (the named scaffold).
  - **Phase 1, read-only variants (red first).**
    - Same-turn row → `src/active-project-coordinator.test.ts`, with a fake writer and a fake `readConversationReadOnly` port whose answers are gated: in one synchronous turn, `conversationRead` on a read-only activation, then `switchProject` or `stop`. Oracle: the release (the session's `close`) is called only after the gate opens; the read answers its page; the switch result or stop resolution comes after it. Expected red: the release is called while the gate is closed (the scaffold does not register the read).
    - Same-turn save row (same file): `conversationSave`, then `switchProject` or `stop` in the same turn; same oracle with the fake writer's `close`. Expected red: none — guard (saves are registered from the plain-B13 stage).
    - Per-request read row → runtime file, seam (b): on a read-only activation, a read is held in the per-request client; the gate sits in the hooked opener's wrapper, on the client's first `execute`, before any statement runs, so no SHARED lock blocks the target activation. Then a switch, or a coordinator stop, is sent. Oracle: the read answers its page first; the transport's `project.switch.result` is sent, or the stop promise resolves, only after that; a save or read sent during the pending switch or stop → `coordinator-unavailable`; after returning to the Project, the read shows the message. Expected red: `project.switch.result` (or the stop resolution) is recorded while the gated read is still held.
  - **Phase 2, fallback variants (guards).**
    - Same-turn fallback row (coordinator unit file): the fake writer answers `writer-unavailable`, `conversationRead` falls back to the gated port, then `switchProject` or `stop` in the same turn; same oracle.
    - Per-request read row after a failed-settlement closure (seam (b)): as the phase-1 row, on a read-write activation whose admission closed by the failed-settlement injection of CNV-B13.
    - Expected red: none — guards, since CNV-B38 already registers the fallback inside the admitted entry. Bound by a recorded mutation that registers Conversation work in `admitted` after its first await; the same-turn fallback row must fail under it.
  - All same-turn rows, both phases, are bound by that recorded mutation; it is the only window where "registers in `admitted` before its first await" changes behaviour.
  - **Writer-held rows** → seam (b): a save held by `conversationWorkHolds`, or a held writer read, then a switch or a stop; the work answers first.
    - Expected red: none — pin over two redundant drains, the coordinator's `admitted` and S2's writer `closeOnce` (`canonical-project-writer.ts:137-145`). Bound by the combined recorded mutation (registration after the first await **and** `closeOnce` ignoring `conversations`): `releaseFence` then meets the held transaction and the switch answers `release-failed`.
- **CNV-B15** `keeps the canonical command path unchanged`: the existing canonical command and coordinator suites run unchanged.
  - Expected red: none — pin.
- **CNV-B29** `refuses $kind with $expected when lifecycle=$pending, state=$state, project=$project, activation=$activation, access=$access` → `src/active-project-coordinator.test.ts`.
  - Oracle: an it.each table of combined conditions (pending lifecycle × state × project × activation × access). For every row, `execute`, `conversationSave` and `conversationRead` give the same status, except that `conversationRead` is not refused for read-only access.
  - Expected red: `conversationSave` and `conversationRead` do not exist (a typed missing-method failure after scaffolding the interface). Once `admitActiveWork` is shared, the table is a guard, bound by a recorded mutation: in `admitActiveWork`, the read-only check runs before the Project-match check; the read-only × mismatch rows must then fail.
- **CNV-B30** `keeps message identity after reopen` (runtime file, seam (a)).
  - Oracle: the messages read after a switch and back, and after a new runtime on the same root, `toEqual` the originals (`conversationMessageId`, cursor, text, `savedAt`).
  - Expected red: none — composition guard, like CNV-B19. It cannot pass at base, and passes once B13 is green; this is recorded.
- **CNV-B36** `fails release with the abandon code when the force-close fails` → `src/canonical-project-writer.test.ts`, `src/active-project-coordinator.test.ts` and `packages/protocol/src/canonical-project-protocol.test.ts` (deviation 6a, decisions §28).
  - Oracle:
    - writer: an abandoned client whose `abandonClient` rejects → the release error has `code: "WRITER_CLIENT_ABANDON_FAILED"` directly, no longer `WRITER_REPOSITORY_CLOSE_FAILED` with a wrapped cause; a second release attempt retries only the abandon stage, then releases the lease;
    - coordinator: a fake writer whose `close` rejects with `CanonicalProjectWriterReleaseError("WRITER_CLIENT_ABANDON_FAILED")`; a switch away answers, after `decodeStrict(CanonicalProjectSwitchResultSchema)`, `{ status: "release-failed", request, diagnostic: { code: "WRITER_CLIENT_ABANDON_FAILED", message: "Project activation resources could not be released.", retryable: true } }`;
    - protocol: the code is in `canonicalProjectActivationDiagnosticCodes`, in the activation `broken` union (with a `["broken", "WRITER_CLIENT_ABANDON_FAILED"]` pin row) and in `switchReleaseDiagnosticSchema`'s retryable group; a version-8 switch reply with it decodes, and with `retryable: false` it fails;
    - U3 (writer test): a settlement that throws, then `releaseFence` rejects → the first `close` rejects with `code: "WRITER_FENCE_RELEASE_FAILED"` after calling only `releaseFence`; a second `close` calls `releaseFence`, the repository `close` and `lease.release`, and resolves; the recorded call list is `["fence", "fence", "repository", "lease"]`, the S1 precedent (`canonical-project-writer.test.ts:419-485`); `abandonClient` is never called. Expected red: none — guard; at the coordinator the same case answers `{ code: "WRITER_FENCE_RELEASE_FAILED", retryable: true }`.
  - Build order: the writer row, then the coordinator row, then the protocol rows. Expected red: the S2 pin (T2, `fails release with the abandon cause …`) observes `WRITER_REPOSITORY_CLOSE_FAILED`, and that assertion changes in this slice; the coordinator row, written before the protocol change, throws at `decodeStrict` because the switch schema rejects the code; the protocol rows fail to decode before the vocabulary changes.
- **CNV-B37** `stops cleanly after a broken listing whose cleanup completed` (#102, G19).
  - Unit, preparation owner → a new `src/registration/project-registration-preparation.test.ts` (no unit test exists for this owner; the listing is faked through its `listing` port, the registry through a stub). The drain budget uses fake timers (`vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })`, precedent `registration-bootstrap-guards.integration.test.ts:320`):
    - a listing that resolves `broken` with each registry-data code (`REGISTRY_CORRUPT`, `REGISTRY_SCHEMA_UNKNOWN`, `REGISTRY_SCHEMA_NEWER`) → `close()` answers `{ status: "closed" }`. Red: `{ status: "broken", code: "INTERNAL_FAILURE" }` (`trackedListing` marks any broken result, :287);
    - a listing that resolves `{ status: "broken", code: "INTERNAL_FAILURE" }` (its own cleanup failed, `project-listing.ts:226-235`) → `close()` answers `{ status: "broken", code: "INTERNAL_FAILURE" }`. Pin;
    - a listing still running past the cleanup budget → `{ status: "broken", code: "INTERNAL_FAILURE" }`. Pin;
    - a listing that rejects while `close()` drains it → `{ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }`. Pin;
    - a listing that rejected before `close()` → `{ status: "closed" }`. Pin of today's behaviour: the real listing never rejects (`listRegisteredProjects` maps every error, `project-listing.ts:234-236`), so no change is made.
  - Unit, listing adapter → a new `src/registration/registration-listing.test.ts`, with owner, observer and registry fakes:
    - observer unconfirmed and listing unconfirmed → `stop()` rejects with one `RegistrationCleanupUnconfirmed` whose `parts` are `["observer", "listing"]`, with the message "Project registration cleanup is unconfirmed: observer, listing.";
    - the registry stop rejects as well → `parts` are `["registry", "observer", "listing"]`; the registry failure is the error's `cause`;
    - only the listing unconfirmed → `parts: ["listing"]`, message "Project registration cleanup is unconfirmed: listing.";
    - only the registry stop rejects → `parts: ["registry"]`, the registry failure as `cause`, message "Project registration cleanup is unconfirmed: registry.";
    - all three confirmed → `stop()` resolves.
    - Red: today `stop` throws only "Project registration observer cleanup is unconfirmed.", and a registry stop rejection hides both checks (`process-bootstrap.ts:150-155`).
  - Integration, seam (a): the pin at `registration-project-upgrade.integration.test.ts:114-115` flips: `list()` still answers `REGISTRY_CORRUPT`, and `session.dispose()` resolves. Red: the dispose rejects with "Project listing cleanup is unconfirmed." (`process-bootstrap.ts:155`).
- **CNV-B38** `routes a refused read to the read-only reader` → `src/active-project-coordinator.test.ts`, with a fake writer and a fake `readConversationReadOnly` port.
  - Oracle:
    - the writer answers `writer-unavailable` for a read → the port is called once with `{ canonicalDatabasePath, projectId, after }` equal to the activation's path and the request's values, including a row with `after: 100`; its page is returned;
    - the writer answers a page → the port is not called;
    - a read-only activation's read → the port is called directly, with the same arguments;
    - a save answered `writer-unavailable` is returned as is and never rerouted;
    - the port fails with `ConversationStorageBusy` → `unavailable PROJECT_STORAGE_UNAVAILABLE`; with `ConversationStorageBroken` → `broken PROJECT_STORAGE_BROKEN`.
  - Expected red: with the CNV-B13 scaffold, the refused read returns `broken PROJECT_STORAGE_BROKEN` and the port is never called.
- **CNV-B39** `dispatches conversation commands to the coordinator` → `src/harness-runtime.test.ts`.
  - Oracle: `project.conversation.read` and `project.conversation.save` reach `conversationRead` and `conversationSave` once each, with the decoded payload, and their results are sent as the matching v8 result events; a malformed payload gets the runtime's existing strict-decode failure answer without calling the coordinator.
  - Expected red: the commands fall to the registry handler (the CNV-B13 plain-row red).
- **CNV-B40** `rejects a foreign conversation result` → `src/canonical-project-application.test.ts`.
  - Oracle: a coordinator conversation result whose `request` is not the sent request, or that has an extra key → a sanitised `CanonicalProjectApplicationError` with no `cause` and `name` as its only own key, as the existing methods pin; an owner exception, a synchronous throw or a rejection, propagates unchanged (`rejects.toBe(sentinel)`), as the existing methods do.
  - Expected red: the scaffolded wrappers pass the coordinator result through unchecked, so the foreign result is returned.

**Risks**
- Protocol pin churn (S3a precedent: 10 files plus the desktop pin).
- The admission refactor touches `execute`.
- The read fallback must not run on the abandoned client, and must not add an admission check outside the writer (G18).
- Adding methods to `ActiveProjectCoordinator` (aliased as `CanonicalProjectApplication`, `canonical-project-application.ts:15`) breaks every `satisfies ActiveProjectCoordinator` fake, e.g. `canonical-project-application.test.ts:87`; `pnpm typecheck` lists them, and they are updated in this slice.
- CNV-B37 changes a registration cleanup rule; the unit cases keep the genuinely unconfirmed paths unconfirmed.

### S4a `c1-s4a-renderer-foundation` — fonts, the CSP in the page, Seixo theme, Runa icons, the Conversation region frame, accessibility harness

Revision 5 (decisions §42, §43). S4a has no Conversation behaviour: it gives the region its look and the checks every later port slice reuses. It merges to `main` only together with S4b (G30). Anchors at `6a41350`.

**Behaviour**
- The bundled fonts load under the CSP in the e2e build and in the packaged app, and the main-window CSP is proven to be in force on those `file://` pages, with its content unchanged.
- An active Project's workspace area is the Seixo Conversation region frame: heading, access word, `projectId` and the "No model is connected yet…" note, edge to edge. The placeholder sentence is gone. Every other view, and the old shell's look, are unchanged, except that the old shell's code text uses the bundled Cascadia Code face (accepted).
- The old prototype window no longer exists.

**Seams.** The renderer through `exposeApi` (jsdom); `security.test.ts` and a unit test of the shared CSP owner; `package-smoke-verifier` (packaged `file://`); the real Electron launch with a seeded `userData` (`runHarnessSeed`, `PC_UI_USER_DATA`), the CSP as built, and Playwright `emulateMedia`. Every S4a e2e test has a per-test timeout of 150 s; a seeding or launch timeout is a setup failure. Window sizes are set with `BrowserWindow.setContentSize` and checked with `innerWidth` and `innerHeight` before any measurement. The `securitypolicyviolation` listener is installed with `context().addInitScript` followed by a reload of the window, and the test asserts that the listener is present before reading its results.

**Files**
- `pnpm-workspace.yaml` (catalog), `apps/desktop/package.json`: the three `@fontsource` packages; `@axe-core/playwright` as a devDependency, plus `playwright-core` pinned at the `@playwright/test` version (1.62.1) if the strict peer check requires it (the install result is recorded); `start:prototype` removed.
- `apps/desktop/vite.renderer.config.ts` (no font inlining; the build-time CSP `<meta>`), new `apps/desktop/src/shared/content-security-policy.ts` (the per-window policy builder and the pure HTML transform), `src/main/security.ts`, and `apps/desktop/vitest.main.config.ts` (its `include` gains `src/shared/**/*.test.ts`, so `pnpm check` and the root Stryker run collect the shared tests).
- `apps/desktop/src/renderer`: `main.tsx` (font imports), new `legacy-shell.css` (the moved rules), `global.css`, `projects-workspace.module.css` and the other old modules (wrapped in `@layer legacy-shell`; `--prototype-*` renamed `--legacy-*`; the workspace variant without padding and the padded strip for the note and error), new `theme/seixo.module.css`, new `icons/runa-icon.tsx` with its path data, new `conversation/conversation-region.tsx` and `conversation-region.module.css`, `workspace-view.tsx`, `projects-workspace.tsx`; deleted: `prototype/**`, `app.module.css`.
- `apps/desktop`: `index.html` (stale comment), `forge.config.ts`, `vite.prototype.config.ts` (deleted), `src/main/main.ts` (the `--prototype` branches), `src/main/forge-env.d.ts`, `scripts/build-project-entry-e2e.mjs`, `src/main/canonical-writer-package-smoke-main.test.ts` (the `"prototype"` row and stubs), `src/main/security.test.ts`, `src/main/package-smoke-verifier.ts` and its test.
- `knip.jsonc` (prototype entry removed).
- Tests: new `src/shared/content-security-policy.test.ts`, new `src/renderer/conversation/conversation-region.test.tsx`, new `src/renderer/icons/runa-icon.test.tsx`, new `src/renderer/theme/seixo-tokens.test.ts`, new `tests/e2e/renderer-foundation.test.ts`, new `tests/e2e/accessibility.ts` (the shared axe, media, sizing, zoom and violation-listener helper); `tests/e2e/shell.test.ts` (prototype journey and its helpers removed).

**Contracts**
- **CNV-B41** `loads the bundled fonts under the unchanged CSP`.
  - `src/main/security.test.ts` (guard): the packaged header policy equals the literal of `security.ts:8-18` at `6a41350` exactly. Expected red: none — guard; it pins that S4a adds no origin.
  - `tests/e2e/renderer-foundation.test.ts`: for each of `400 14px "Red Hat Text"`, `500 13px "Red Hat Text"`, `600 16px "Red Hat Text"`, `400 16px Cinzel`, `400 12.5px "Cascadia Code"`, `document.fonts.load(spec, "Aé€çő")` resolves to a non-empty list; for Red Hat Text 400, `document.fonts` then holds a face whose `unicodeRange` covers U+0151 (latin-ext) with `status` `"loaded"`; no `securitypolicyviolation` event fires; every font request is a same-origin file. Expected red: the lists are empty (no `@font-face`).
  - Build output (same e2e file, reading `.vite/renderer`): no emitted CSS contains a `data:font` or `data:application/font` URL. Expected red: none — guard.
  - `package-smoke-verifier.ts` (packaged `file://`): the smoke script also loads the five faces and returns `fonts`. Unit rows: "no fonts key" (accepted at red, rejected at green — the red row), "fonts loaded" (passes), "a face missing" (fails the smoke).
- **CNV-B48** `enforces the main-window CSP on the file:// renderer` → `src/shared/content-security-policy.test.ts`, `tests/e2e/renderer-foundation.test.ts` and `package-smoke-verifier.ts`.
  - Unit, exact literals: `contentSecurityPolicy({ window: "main", delivery: "header", development: false })` equals the CNV-B41 literal; with `development: true` it equals the same literal with ` http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*` after `connect-src 'self'`; with `delivery: "meta"`, for both `development: false` and `development: true`, it equals the packaged literal without `frame-ancestors 'none'` and has no `localhost`. No main-window result contains `wasm-unsafe-eval`.
  - Unit, the pure HTML transform on the source `index.html`: the output's first element after `<meta charset>` is the CSP `<meta>` with exactly the meta literal, and no `<script>` or `<link>` precedes it.
  - E2E, built output: the built `index.html` has that `<meta>` in that position and contains no `localhost`.
  - E2E positive control: in the launched window, a deliberately disallowed load (a font face whose source is a `data:` URL, added by the test) fires `securitypolicyviolation` with `effectiveDirective` `font-src`; then the five bundled faces load with no violation.
  - Packaged smoke: the smoke script returns the page's CSP `<meta>` content, and the verifier fails unless it equals the meta literal (unit rows "meta missing" and "meta differs" fail; "meta exact" passes).
  - Expected red: unit — the builder does not return the meta variant (scaffold: it returns the header string for every delivery); e2e — at `6a41350` the positive control fires no violation on the `file://` page (Electron: a header CSP cannot apply to `file://`). If it does fire at red, that row is recorded as a guard and the `<meta>` stays as Electron's documented `file://` mechanism; the result is recorded in the S4a evidence.
- **CNV-B42** `keeps the Seixo theme identical to DESIGN.md and scoped` → `src/renderer/theme/seixo-tokens.test.ts`.
  - The test reads DESIGN.md (repository root) with a small line parser: the three flat front-matter blocks `colors`, `rounded` and `spacing` (two-space keys, quoted values), the `backgroundColor` of `components.button-primary-hover` and `components.button-secondary-hover`, and the code spans of the four "Shadow Vocabulary" bullets the region uses (DESIGN.md:278, :280, :281, :282), with the leading `box-shadow: ` and trailing `;` stripped and the bullet name mapped to the property ("Soft lift" → `--shadow-soft-lift`, "Button lift" → `--shadow-button-lift`, "Frost lift" → `--shadow-frost-lift`, "Composer lift" → `--shadow-composer-lift`); the Row lift and Overlay bullets are skipped; no YAML dependency.
  - Oracle:
    - every token has exactly one custom property in `seixo.module.css` with the same value (`--<name>`, `--radius-<name>`, `--space-<name>`), and so do `--button-primary-hover`, `--button-secondary-hover`, `--shadow-soft-lift`, `--shadow-button-lift`, `--shadow-frost-lift` and `--shadow-composer-lift`;
    - `seixo.module.css`'s only hex, `rgb()` and `hsl()` literals are those declarations; the halo uses `rgb(from var(--frost) …)`; `transparent` occurs only as the focus rule's outline colour and inside `@media (forced-colors: active)`, where `currentColor` and system colours may also occur; every other `*.module.css` under `src/renderer/conversation/` (the glob also picks up S4b's modules) has no colour literal;
    - every selector in the region modules contains a module-local class; none is `:root`, `html`, `body`, `:global(`, an old-shell class name, or made only of elements, attributes, pseudo-classes or `*`; the forced-colors block is nested under the region root;
    - contrast computed from the pinned tokens: frost against canvas and against plate ≥ 3:1 (the ring); blood against canvas ≥ 3:1 (the Broken outline); ink-muted on each of frost-tint, ember-tint, moss-tint and blood-tint ≥ 4.5:1; ink and ink-dim on canvas and plate ≥ 4.5:1.
  - Expected red: with an empty `seixo.module.css` scaffold, "no `--canvas` custom property".
- **CNV-B43** `shows the Conversation region frame for an active Project` → `src/renderer/conversation/conversation-region.test.tsx`.
  - Oracle: after a read-write activation, the "Project workspace" region holds heading "Project <name>", the exact text "Read-write", the `projectId`, and the exact note "No model is connected yet. Messages are saved on this computer."; the placeholder sentence of `workspace-view.tsx:99` is absent. A read-only activation shows "Read-only". A safe-mode result still shows "Writes unavailable. Storage needs attention before this Project can be used." Every icon in the region is `aria-hidden` and not focusable.
  - Expected red: the placeholder sentence still shows.
- **CNV-B49** `renders each Runa icon as a decorative stave` → `src/renderer/icons/runa-icon.test.tsx`.
  - Oracle, an it.each over the six names: `aria-hidden="true"`, `focusable="false"`, `stroke="currentColor"`, stroke width 1.5, `stroke-linecap="square"`, `stroke-linejoin="miter"`, `fill="none"`, and path data equal to the Runa v2 source copied into the test as literals.
  - Expected red: with a scaffold that renders an empty `<svg>`, "no stroke attributes and no path data".
- **CNV-B44** `passes the accessibility harness on the region frame` → `tests/e2e/renderer-foundation.test.ts`, with `tests/e2e/accessibility.ts`.
  - Oracle, with the seeded Project open read-write and the content sized 1280×800 (the workspace section then holds only the region):
    - `AxeBuilder` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, included to `section[aria-label="Project workspace"]`, reports no violations; with `emulateMedia({ forcedColors: "active" })` it again reports none and the note text is still visible; `bypassCSP` is never set (`setLegacyMode(true)` is allowed if the default run needs a new page; the configuration used is recorded);
    - with `emulateMedia({ reducedMotion: "reduce" })`, `matchMedia("(prefers-reduced-motion: reduce)").matches` is true in the window and `document.getAnimations()` has no animation inside the region;
    - at zoom factors 0.5 and 2.0 (set on the window's `webContents`), the region has no horizontal overflow and the note is fully inside the viewport.
  - Expected red: none — guard on the new frame (its look has its own red in CNV-B51). It is bound by a recorded check that a deliberate low-contrast note colour makes the harness fail.
- **CNV-B51** `gives the region frame its Seixo look` → `tests/e2e/renderer-foundation.test.ts`.
  - Oracle, at 1280×800 content: the heading's computed font family starts with "Red Hat Text"; the region's background equals canvas `rgb(5, 6, 6)`; the region's box equals the workspace section's box (the section's padding is 0); the note's colour equals ink-muted `rgb(154, 163, 171)`; the note's computed `max-width` is `none` (the region declares none; the legacy `.workspace p` gives `65ch`, which computes to pixels); the heading's computed `margin` equals the value the region module declares for it (the legacy `.workspace h2` gives `0 0 16px`) and its font size is not the legacy 22.4 px; the `projectId`'s font family starts with "Cascadia Code" and its font size is 12.5 px; every region element computes `box-sizing: border-box`.
  - Expected red: at `6a41350` the heading computes "Segoe UI Variable" and the section has 32 px padding. Bound by two recorded checks: removing the region reset, and separately removing the `@layer legacy-shell` wrapper from `projects-workspace.module.css`, each makes the note `max-width` row fail (`.workspace p` then wins over the zero-specificity reset).
- **CNV-B50** `keeps the old shell's look` → `tests/e2e/renderer-foundation.test.ts`.
  - Oracle: these computed values equal literals recorded from `main` at `6a41350`: the `body` background and colour; a Projects-sidebar button's font family, cursor, border and radius; that button's `:focus-visible` outline colour, width and offset; `body` overflow; and the workspace section's padding (32 px) with no Project open and with a safe-mode Project open (the seed registers two clean Projects; the test makes repository-a safe-mode as `projects.test.ts:35-62` does: open A, switch to B, rename A's runtime database, refresh). A static row (`src/renderer/legacy-shell.test.ts`) checks that every `var(--legacy-*)` in the old style sheets names a property declared in `legacy-shell.css`.
  - Expected red: none — guard. It is bound by a recorded check that dropping `legacy-shell.css` makes it fail.
- **Removal (no behaviour ID).** The old prototype window and every entry for it are gone, and the old tokens are renamed `--legacy-*`: `rg -n -i "prototype" apps/desktop knip.jsonc --glob '!node_modules' --glob '!.vite' --glob '!out' --glob '!test-results'` returns no hit; `pnpm check`, knip, `pnpm check:duplicates` and `pnpm test:e2e` pass; the existing e2e locators listed in Desktop facts pass unchanged.
- **Visual review (manual).** The ui-ux agent reviews screenshots, at scale 1 with content 1280×800 and 853×533, of: the frame; the frame with the idle note strip (after a cancelled add); and the Projects sidebar's code text in the bundled face. It checks them against the hero and DESIGN.md's anti-clone test (DESIGN.md:189); its sign-off, including acceptance of the sidebar code face, is recorded in the S4a evidence.

**Accessibility checklist (G26).**

| # | Point | In S4a |
|---|---|---|
| 01 | Keyboard | not applicable: the frame has no control |
| 02 | Visible focus | the ring's CSS and its 3:1 contrast land here (CNV-B42); the frame has no control, so the ring is observed on real controls in S4b (CNV-B47) |
| 03 | Single-letter shortcuts | not applicable |
| 04 | Names, `lang="en"` | decorative icons (CNV-B43, B49); `lang="en"` already set (`index.html:2`) |
| 05 | Announcements | not applicable: the frame announces nothing |
| 06 | Map and diffs as text | not applicable |
| 07 | Never colour alone | not applicable: the frame shows no state |
| 08 | High contrast | CNV-B44 |
| 09 | Zoom and scale | CNV-B44 (zoom); the 150 % scale run is in S4b, whose surface is larger |
| 10 | Reduced motion | CNV-B44 |
| 11 | AA contrast, axe | CNV-B44 (axe), CNV-B42 (non-text 3:1 and tint text pairs), CNV-B51 (the note's colour) |
| 12 | Sounds | not applicable |

**Risks**
- `@axe-core/playwright` must run under the CSP as built. If it cannot, the slice stops and reports to the coordinator; `bypassCSP` is not an allowed workaround.
- The `<meta>` CSP is new delivery for an unchanged main-window policy (G29); the development server keeps the header. The splash-window variant (#130) is not built here.
- Two looks coexist until the shell slice (G21); the ui-ux agent asked for the shell slice to follow soon after C1.

### S4b `c1-s4b-conversation-window` — bridge, IPC, preload, the React Conversation window

**Behaviour**
- In the active Project, "Save locally" saves the message, and "Saved" appears only after the harness confirms it.
- Every other outcome keeps the text, with its reason.
- Messages reload in order on every activation, and the next save uses the loaded revision.
- A read-only Project shows its messages, with saving unavailable and the reason shown.
- The window meets the S4 items of the 12-point accessibility checklist.

**Seams.** The bridge over a real `HarnessSession` with a Port fake, and the pure `project-conversation-failure.ts` mapping for rows the real session cannot produce (as `project-entry-bridge.test.ts:278-285` does for the upgrade); `registerProjectEntryIpc` with the `ipcMain` mock; `preload.test.ts`; the renderer through `exposeApi` with gated promises (jsdom); the real Electron launch with a seeded `userData` for the accessibility journey, where a test may replace a conversation IPC handler from the main process (`application.evaluate` with `ipcMain.removeHandler` and `ipcMain.handle`) to reach states the seed cannot.

**Files**
- `apps/desktop/src/main`: `project-entry-bridge.ts`, `harness-pending-request.ts` or `project-upgrade-failure.ts` (the `unsent` kind), new `project-conversation-failure.ts`, `project-entry-ipc.ts`, `package-smoke-verifier.ts` and its test.
- `apps/desktop/src/shared/desktop-api.ts`; `apps/desktop/src/preload/preload.ts`.
- `apps/desktop/src/renderer`: `projects-workspace.tsx` (per-Project memory, activation passed down), `workspace-view.tsx`, `conversation/*` (region, messages, composer, status slot, `use-project-conversation.ts`, the pure save-outcome and time rules), `test-api.ts` (the default read answer), `window.d.ts` if needed.
- Tests: `project-entry-bridge.test.ts`, `project-entry-ipc.test.ts`, `preload.test.ts`, new `src/renderer/conversation/project-conversation.test.tsx`, new `src/renderer/conversation/saved-at.test.ts`, new `tests/e2e/conversation-accessibility.test.ts`; the API list in `tests/e2e/shell.test.ts`; `tests/e2e/electron-launch.ts` (an optional extra-arguments parameter for the scale launch).

**Contracts**
- **CNV-B16** `maps conversation replies and transport faults` → `apps/desktop/src/main/project-entry-bridge.test.ts`.
  - Oracle, as one literal fault table per operation, in the style of the upgrade table (`project-entry-bridge.test.ts:150-241`):
    - each harness result is passed through unchanged;
    - `request.failure` with each harness code → its `broken` row;
    - a decodable reply with the wrong event, a mismatched `request` echo, an unbuildable command and a colliding id → `broken PROTOCOL_MESSAGE_INVALID`, for both operations;
    - a call after `stop()`, a send refused with `HARNESS_SESSION_UNAVAILABLE` or `HARNESS_SESSION_SEND_FAILED` → `unavailable` (`connectionLost`), for both operations, never `uncertain` (R2-C10);
    - a send refused with `HARNESS_SESSION_MESSAGE_INVALID` → `broken PROTOCOL_MESSAGE_INVALID`, for both operations, asserted on the pure mapping function (every bridge command is already decoded strictly by its factory, so the real session never refuses one this way);
    - while pending, a disconnect, a stop, and a malformed reply (which the session turns into a `protocol-error`) → `uncertain CONVERSATION_SAVE_UNCONFIRMED` for a save; for a read, `unavailable` (`connectionLost`) for the first two and `broken PROTOCOL_MESSAGE_INVALID` for the third;
    - the existing upgrade table still answers `connectionLost` for "a call after stop" (guard for the `unsent` mapping).
  - Expected red: the methods are absent; after scaffolding them with the upgrade-style mapping, a disconnect while a save is pending answers `unavailable`.
- **CNV-B17** `exposes strict conversation methods` → `project-entry-ipc.test.ts`, `preload.test.ts` and the API lists.
  - Oracle:
    - IPC: each handler forwards a valid request to the bridge method once; a request with an extra key throws and the bridge method is not called;
    - preload: a valid request reaches `invoke` once with its channel; an extra key on the request rejects without `invoke`; an extra key on the result rejects; a diagnostic row that does not belong to the status rejects;
    - the two sorted lists gain `readConversation` and `saveConversationMessage` in sorted position; the other places gain them through the type check (Desktop, IPC and preload).
  - Expected red: IPC — after scaffolding the handlers without forwarding, the bridge method is not called; preload — the methods are absent.
- **CNV-B18** `saves locally and shows Saved only after confirmation` → `apps/desktop/src/renderer/conversation/project-conversation.test.tsx`.
  - Oracle:
    - the note text is exact;
    - after a read with revision 201, and separately after `conversation: null`, the first press sends exactly `{ projectId, activationId, saveId: <UUID>, expectedRevision: 201 | 0, text }` with the current activation;
    - while the save is pending: "Saving…" in `#conversation-status`, no "Saved", the button has no `disabled` attribute, is `aria-disabled` and named "Saving…", and Tab still reaches it; the textarea is read-only; a second press or Ctrl+Enter sends nothing;
    - on `saved` (`replayed: false`): the message is in the list, the composer is empty, "Saved" shows, focus is in the composer, and the next save carries the returned revision;
    - on `saved` (`replayed: true`): the conversation is read again, the composer is empty, and "Saved" shows;
    - the composer value is sent unchanged: leading and trailing spaces, tabs and line breaks kept. A textarea normalises CR/CRLF to LF, so `\r\n` byte-exactness is pinned at the protocol (CNV-B12) and the store (CNV-B6), not here (R2-C11).
  - Expected red: there is no composer.
- **CNV-B31** `reloads all pages on every activation` (same file).
  - Oracle:
    - 201 messages over three gated pages of 120, 50 and 31 rows are shown in cursor order, after mount and again after a new activation; the sent `after` values are `[null, c120, c170]`;
    - while a page is gated and the composer holds text: before 300 ms nothing shows "Loading messages…" and Save has no `disabled` attribute, is `aria-disabled` with no description, and Tab reaches it; after 300 ms (fake timers) the slot shows "Loading messages…" and Save is described by it; a press and Ctrl+Enter send nothing;
    - focus: opening a Project whose conversation is empty moves focus to the composer; with a read-write Project open, starting the add flow and cancelling it with Esc, then releasing the region's read, leaves focus on "Add existing repository"; opening and cancelling the removal view leaves focus on that Project's Remove button (`[data-remove]`, as `use-remove-from-list.ts:86-89` and `workspace-hooks.ts:41` put it);
    - a read result for an older activation, or from an older harness epoch (a harness status change while a read is pending), is dropped and changes nothing;
    - a save that is still pending while the region is remounted inside the same activation (the add flow opened and cancelled meanwhile) shows "Saving…" and a read-only composer after the remount, and focus does not move; when its result arrives it is applied: the message is listed and the composer is empty;
    - `conversation: null` shows "No messages yet" and "Messages you save stay on this computer.", and focus goes to the composer.
  - Expected red: only the first page is shown.
- **CNV-B32** `keeps the text when a save answers $status ($row)` (same file).
  - Driven from the literal row table, keyed by status and row key, never by code alone (two codes are shared): every save row except `saved` — `conflict`, `rejected`, `uncertain`, `read-only`, `writer-unavailable`, `stale-writer`, `inactive`, `project-mismatch`, `stale-activation`, `coordinator-unavailable`, `unavailable` (`storageUnavailable`, `connectionLost`), `broken` (`storageBroken` and the three harness rows) — plus "preload call rejected".
  - Oracle:
    - for pending and every row, the composer keeps the exact text. `uncertain`: "Not confirmed." plus the row's message in `#conversation-status`; `conflict`: the conflict line; `broken` rows: the Broken tone with "Not saved.", the row's `diagnostic.message` and "Code <CODE>", `role="alert"`; "preload call rejected": the Broken tone with "Not saved." and "The desktop could not complete this save.", no code line, `role="alert"`; every other row: "Not saved." plus the row's `diagnostic.message` in `#conversation-status`;
    - "Try again" shows exactly for `uncertain`, `read-only` and both `unavailable` rows (and a `dropped` save), resends the same `saveId` and text, moves focus to Save ("Saving…"), and is `aria-disabled` while a read is in progress; a `stale-activation` answer shows its line with no action;
    - the `saveId` is kept for every row except `conflict` and `rejected`; after those, and after editing, the next press sends a new `saveId` with the current `expectedRevision`;
    - after `conflict`, the re-read's revision is the next press's `expectedRevision`, and that press answers `saved`;
    - editing after `uncertain` sends a new `saveId` with the old `expectedRevision`, and the resulting `conflict` reloads and keeps the edited text;
    - drain order: Project A has a pending save, a switch to B starts, and the save answers `saved` before the switch resolves; on returning to A the message is listed and the composer is empty. In a second case the save answers `unavailable` (`storageUnavailable`) before the switch resolves; on returning to A, after loading, the slot shows "Not saved." and that row's message with "Try again", which resends the same `saveId` under the new activation. In a third case it answers `writer-unavailable`, and in a fourth `read-only`; on return the slot shows nothing from either, and the text and `saveId` are kept. In a fifth, A is left while its save is still pending and re-entered before the result arrives: the composer is editable and the slot shows "Not confirmed." with "Try again"; the late `saved` result for that `saveId` is then applied if the user has not pressed again, and ignored if a newer `saveId` exists;
    - per-Project isolation (R2-C7): Project A has a pending save, the switch to B resolves first, and A's result arrives afterwards. B's composer holds neither A's text nor A's `saveId`, and a save in B carries a fresh `saveId`. Returning to A restores A's text and `saveId` with "Not confirmed." and "Try again". In one case "Try again" answers `saved` with `replayed: true` (re-read, composer cleared); in another, `replayed: false` (row appended, composer cleared);
    - a harness status change while a save is pending drops its late result; after the harness is ready and A is opened again, the composer holds the text and is editable, and the slot shows "Not confirmed." plus `saveUnconfirmed.message` with "Try again", which resends the same `saveId`.
  - Expected red: the composer clears on submit.
- **CNV-B33** `shows a read-only Project's messages with saving unavailable` (same file).
  - Oracle: the earlier messages are listed; the exact §4 note and the exact text "Read only: " + `projectConversationDiagnostics.readOnly.message` are visible; the button has no `disabled` attribute, is `aria-disabled="true"`, Tab reaches it, and its accessible description equals the read-only line alone (not the note); the textarea is read-only with the same description; pressing the button or Ctrl+Enter sends nothing.
  - Expected red: the button is enabled.
- **CNV-B34** `applies the shared text rules` (same file).
  - Oracle:
    - empty, `" \t\r\n"` or NBSP-only text → no `disabled` attribute, `aria-disabled="true"` with no description, Tab reaches it, and pressing sends nothing;
    - 32768 multibyte bytes → saving is available;
    - 32769 bytes → no `disabled` attribute, `aria-disabled`, Tab reaches it, described by "This message is longer than 32 KiB." in `#conversation-status`, the field `aria-invalid`, and the text kept; it clears when the text fits.
  - Expected red: saving is available for whitespace-only text.
- **CNV-B35** `shows a failed load when a read answers $status ($row)` (same file).
  - An it.each over every non-`read` read row: `inactive`, `project-mismatch`, `stale-activation`, `coordinator-unavailable`, `unavailable` (`storageUnavailable`, `connectionLost`), `broken` (`storageBroken` and the three harness rows), plus "preload call rejected"; each also as the second page after a successful first page.
  - Oracle: each replaces the stream with its notice — the Failure tone with "Could not load this conversation." and the row's message (announced through `#conversation-status`); for `broken`, the Broken tone with the same title, the row's message and "Code <CODE>"; for "preload call rejected", the Broken tone with the title "Could not load this conversation.", "The desktop could not load this conversation." and no code line; both Broken forms `role="alert"` — never the empty state and never a partial list. "Reload" has focus for every row except `stale-activation`, whose notice has no action (focus then goes to the notice's title, which is focusable with `tabIndex={-1}`, as `#ws-heading` is). While Reload reads, it keeps focus, it stays mounted and `aria-disabled`; after a successful read, focus is in the composer. Until a read succeeds, Save has no `disabled` attribute, is `aria-disabled`, Tab reaches it, and it is described by the notice's title; the draft is kept.
  - Expected red: an empty conversation is shown.
- **CNV-B45** `shows each message as written, with its saved time` → `saved-at.test.ts` and the conversation test file.
  - Oracle, the time rule as a plain function `(savedAt, now, timeZone)`, with `timeZone` "Europe/Lisbon":
    - now `2026-10-10T12:00:00Z`: savedAt `2026-10-10T13:02:00Z` → "14:02"; `2026-10-09T23:30:00Z` → "00:30" (the next local day, so today); `2026-10-09T13:02:00Z` → "9 Oct, 14:02"; `2025-12-31T23:30:00Z` → "31 Dec 2025, 23:30";
    - now `2027-01-01T00:10:00Z`: savedAt `2026-12-31T23:59:00Z` → "31 Dec 2026, 23:59";
    - with `timeZone` "Asia/Tokyo" (UTC+9 all year), now `2026-12-31T15:30:00Z` (00:30 on 1 January 2027 there): savedAt `2026-12-31T14:30:00Z` → "31 Dec 2026, 23:30" (a year compared in UTC would drop the year);
    - `<time dateTime>` equals `savedAt`;
    - a message whose text is `"<b>x</b>\n  y"` renders that exact text content, with no `<b>` element.
  - Expected red: the function does not exist.
- **CNV-B46** `works by keyboard and announces politely` (same file).
  - Oracle:
    - Ctrl+Enter in the composer saves; Enter and Shift+Enter add a line and send nothing;
    - focusing "Save locally" and pressing Enter saves; while pending and after a fault, focus stays on the button (it is never moved to `body`); after `saved`, focus is in the composer;
    - after a failed load, focus is on "Reload"; after a fault, focus stays where it was;
    - `#conversation-status` has `aria-live="polite"` and no `role`; only Broken-tone elements have `role="alert"`; the region adds no `role="status"` element; the "Messages" list and the stream have no `aria-live` and no `log` or `status` role;
    - every state shows an icon and words, never colour alone;
    - with `matchMedia("(prefers-reduced-motion: reduce)")` true, the post-save scroll is called with `behavior: "auto"`; otherwise `"smooth"`.
  - Expected red: Ctrl+Enter does nothing.
- **CNV-B47** `meets the accessibility checklist in the real window` → `tests/e2e/conversation-accessibility.test.ts`, with `tests/e2e/accessibility.ts`.
  - Seeding: `runHarnessSeed` with the registered-Projects seed (repository-a and repository-b, both empty). Per-test timeout 150 s; a seeding or launch timeout is a setup failure. The content is sized with `setContentSize(1280, 800)` and `innerWidth`/`innerHeight` are asserted first.
  - Oracle, with the CSP as built, in this order:
    1. **Empty state** (open repository-a with the "Open Project repository-a" button): axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on `section[aria-label="Project workspace"]` reports no violations in normal and forced colours; focus is in the composer.
    2. **Keyboard and focus:** typing two lines with Shift+Enter and pressing Ctrl+Enter saves; `#conversation-status` reads "Saved"; the new message is in view; focus is in the composer. Then, with new text typed in the composer, Tab moves focus to "Save locally". On that focused button, in normal colours: `outline-color` `rgba(0, 0, 0, 0)`, `outline-width` 2 px, `outline-offset` 2 px; a `box-shadow` of three layers with spreads 2 px, 3.5 px and 7 px whose colours equal canvas, frost and frost at alpha 0.22 (channels compared numerically); border width 0; font family starting with "Red Hat Text"; on hover, background `rgb(178, 214, 232)`. Under `forcedColors: "active"`: `outline-style` `solid`, `outline-width` 2 px, `outline-offset` 2 px (a missing region rule would leave the browser's default focus outline, which has a different offset and style), and a 1 px border. Pressing Enter on the button saves; afterwards focus is in the composer. With the textarea focused: the textarea's `outline-style` is `none` in both colour modes; the field's `box-shadow` has exactly two layers, a 1.5 px frost layer and a 5 px frost layer at alpha 0.22 (channels compared numerically); under forced colours the field has `outline-style` `solid` and `outline-width` 2 px.
    3. **Over-limit fault:** pasting 32769 bytes shows the fault line; axe reports no violations in normal and forced colours; clearing restores the state.
    4. **Many messages:** enough messages are saved through the window to overflow the stream; after reopening the Project, the newest message is in view.
    5. **Reduced motion:** under `reducedMotion: "reduce"`, every region control's computed `transition-duration` is 0 s; after a save, a page-side MutationObserver on `#conversation-status` waits one `requestAnimationFrame` after "Saved" appears and then finds the stream at its end (`scrollTop + clientHeight >= scrollHeight - 1`), with no further scrolling in the next frame; the stream's computed `scroll-behavior` is `auto`.
    6. **Zoom and scale:** at zoom factors 0.5 and 2.0, and in a second launch with `--force-device-scale-factor=1.5` and `setContentSize(853, 533)` (asserting `innerWidth` within 1 px of 853), the region has no horizontal overflow and "Save locally" is fully inside the viewport.
    7. Throughout: no `pageerror` and no `securitypolicyviolation`. Each step saves a screenshot for the ui-ux review.
    8. **Unreachable states, in further launches on the same `userData`** (so no handler needs restoring): before opening a Project, the test replaces conversation IPC handlers from the main process (`application.evaluate` with `ipcMain.removeHandler` and `ipcMain.handle`), then opens repository-b so the replaced read handler serves its load. One launch per group, each with its own replacements: (a) a save answering `uncertain`, then one answering `broken`, then a handler that throws (preload call rejected); (b) a read answering `unavailable`; (c) a read answering `broken`; (d) a handler that throws on read; (e) a read answering `stale-activation`; (f) the activate handler answering a read-only activation (echoing the request) with a read handler answering `read`. In each state: axe reports no violations in normal and forced colours; any focused "Try again" or "Reload" has `outline-color` `rgba(0, 0, 0, 0)`, `outline-width` 2 px, `outline-offset` 2 px and a 1.5 px frost layer, and under forced colours `outline-style` `solid`; a screenshot is saved.

  - Expected red: the composer is missing (S4b's own surface).
  - **Manual, recorded in the S4b evidence (G26):** an NVDA speech-log pass by an agent against the speech table below, then Pedro listens with Narrator; if NVDA is not available on the machine, that part is recorded as unavailable, not as passed. The ui-ux agent reviews the screenshots of every state (including step 4's) against the hero and DESIGN.md's anti-clone test; its sign-off is recorded.

**Speech table (what the screen reader says).** Region "Project workspace"; heading "Project <name>"; list "Messages" with N items; each item: "You, <time>, <text>"; textbox "Message"; button "Save locally" (unavailable: "Save locally, dimmed", plus the description where one exists); "Saving…" while pending; the status slot phrases above; button "Try again"; button "Reload".

**Accessibility checklist mapping (G26).**

| # | Point | In S4b |
|---|---|---|
| 01 | Everything by keyboard | CNV-B46, CNV-B47; F6 zones and "Skip to Attention" belong to the shell slice |
| 02 | Visible focus | CNV-B47 on Save, the composer, Try again and Reload (steps 2 and 8) |
| 03 | Single-letter shortcuts | not applicable: S4 adds none |
| 04 | Names, `lang="en"` | the speech table; icons decorative |
| 05 | Announcements | CNV-B46; the 10-second progress limit does not apply, because each status line is one announcement per user action |
| 06 | Map and diffs as text | not applicable |
| 07 | Never colour alone | CNV-B46 |
| 08 | High contrast | CNV-B47 forced colours |
| 09 | Zoom 50–200 % and 150 % scale at 1280×800 | CNV-B47 |
| 10 | Reduced motion | CNV-B46, CNV-B47 |
| 11 | AA contrast, axe | CNV-B47 (axe); CNV-B42 (tones and non-text 3:1 from the tokens) |
| 12 | Every sound has a visual twin | not applicable: C1 plays no sound |

**Risks**
- The activation guard and the per-Project memory.
- The API lists.
- `uncertain` after a `protocol-error`: a malformed save reply cannot show whether the save committed; "Try again" resolves it by `saveId`.
- Following the Windows Text size setting is a shell-level decision (decisions §33) and is deferred to the shell slice.

### S5 `c1-s5-conversation-journey` — the real app

- **CNV-B19** `saves, switches, restarts and reopens` → `apps/desktop/tests/e2e/conversation.test.ts`.
  - Seeding: the shared `runHarnessSeed` helper creates two registered Projects and one generation-three Storage-only Project.
  - Oracle:
    - two messages are saved, and "Saved" is observed only after each save resolves;
    - switching away and back shows the same two messages in order;
    - after a restart, the same;
    - the generation-three Project is upgraded on opening, then accepts a save.
  - Expected red: none — composition guard (S3b B35 precedent); recorded as observed.
  - Per-test timeout: 150 s. A seeding or launch timeout is a setup failure.
  - Revision 5, consistency with S4b: locators use the S4b speech table (region "Project workspace", list "Messages", textbox "Message", button "Save locally"). "Saved observed only after each save resolves" is checked with a MutationObserver on `#conversation-status`, as `project-upgrade.test.ts:34-53` checks `#ws-progress`. The generation-three Project needs a new env-gated seed file using `createGenerationThreeProject` (`project-storage-upgrade-fixture.ts:505`); the existing upgrade seed makes generation two. S5 adds no accessibility oracle of its own; CNV-B47 owns them.

### Success Criteria

**Every slice**, at the repository root, in the C1 linked worktree:
- `pnpm check`;
- the touched integration projects (including `native-long` for S2);
- `pnpm check:duplicates`;
- knip;
- CodeScene 10 on touched files. The waiver for `project-storage-node-adapters.ts` stays until after C1.

**Per slice, in addition**
- S1: `db:generate:check`; `pnpm test:e2e`, because the upgrade seed changes; `package:launch-smoke`, because the schema changes.
- S2: `pnpm test:e2e` and `package:launch-smoke`. S2's head reaches `main` together with S1 (G15), and the package smoke drives the writer that S2 changes.
- S3: `pnpm test:e2e` and `package:launch-smoke`, because the protocol pin changes, including the desktop peer.
- S4a, S4b and S5: `pnpm test:e2e` and `package:launch-smoke` (S4a's packaged font row runs in the launch smoke).

**Mutation**, with the coordinator's go-ahead (R2-C13):
- S1: the chain rule and the filesystem agreement, through `stryker.project-storage.config.json`;
- S2: the store, the slot queue and `sqlite-busy`, through the new `stryker.conversation.config.json`;
- S3: through the root `stryker.config.json` (unit tests). Its `mutate` list gains, with Stryker's line-range form recorded at build time: `project-conversation-protocol.ts` (whole new file), `canonical-project-protocol.ts` (the CNV-B36 ranges), `active-project-coordinator.ts` (`admitActiveWork`, `conversationRead`, `conversationSave` and the G17 routing), `canonical-project-application.ts` (the two new wrappers), `registration/project-registration-preparation.ts` (only the code CNV-B37 drives, at `80228ac`: `pendingListing`, `listProjects`, `cleanupUnconfirmed` and `drainPreparations` :225-264, `trackedListing` :279-292, `close` :352-367) and the new `registration/registration-listing.ts`; `harness-runtime.ts` is already listed. Each mutated range has a unit oracle: CNV-B12, CNV-B14 same-turn rows, CNV-B29, CNV-B36, CNV-B37, CNV-B38, CNV-B39 and CNV-B40. The root config is incremental, so the final S3 run is `pnpm exec stryker run --force` on the final candidate, once, with per-file scores recorded for every S3 file. The CNV-B36 writer change is mutated by `stryker.conversation.config.json`, which already lists `canonical-project-writer.ts`; the final S3 candidate also runs that config once (it is not incremental), with per-file scores recorded.
- S4b: through the root `stryker.config.json`, whose `mutate` list gains the new `project-conversation-failure.ts`, the S4b ranges of `project-entry-bridge.ts` and `projects-workspace.tsx` (the per-Project memory), and the renderer's conversation hook, the region components that map state to controls, and the pure rules (save outcome, time format); `preload.ts`, `project-upgrade-failure.ts` and `harness-pending-request.ts` are already listed. Oracles: CNV-B16, CNV-B17, CNV-B18, CNV-B31–B35, CNV-B45, CNV-B46. The final S4b run is `pnpm exec stryker run --force` once, with per-file scores recorded. S4a runs the root config once on its final candidate (`pnpm exec stryker run --force`), for the new font and CSP-meta branches of `package-smoke-verifier.ts` (already listed) and the new `apps/desktop/src/shared/content-security-policy.ts` (added to the `mutate` list), with CNV-B41's and CNV-B48's rows as the oracle and per-file scores recorded.
- `WriterOwnerBusy` is a defensive branch, pinned by its writer-level test.

**Push gate:** `pnpm check:deep`.

**Claim, re-established.** After S1 and S2 merge together (G15), every existing kind of Project opens read-write after its automatic upgrade: Storage-only v2 and v3, upgraded-once, and registered (CNV-B2, B3, B4, B20). Nothing writes the new tables until S2, and nothing in the UI uses them until S4b.

## C1-gate carry-forward

| Item (source) | Disposition |
|---|---|
| Chained upgrades (#92; C1-0 design, Deferred Work) | Done in S1 (G9). |
| Registered-Project receipts after an upgrade (C1-0 design :264, :286) | Done in S1 (CNV-B20). |
| Chain root `createdAt` (C1-0 design :264) | Done in S1 (CNV-B4). |
| `project.upgrade` skips the registered admission checks (S3 design, Deferred Work) | Re-deferred. Owner: the coordinator's issue list. Trigger: the first registered Project whose repository moved before its upgrade. |
| Listing concurrency F9, extended to a chained switch between the listing scan and its registry read (`project-listing.ts:86`; node-adapters :1070-1077) | Accepted risk, carried. Worst case: a transient `recovery-required` row. The data-safety proofs hold. |
| Representative-size timing (S3a) | Re-deferred. Trigger: measured real Project sizes. |
| G2 residual: no composed IPC failure proof (upgrade-window design) | Trigger fires in S4b, which changes `registerProjectEntryIpc`. S4b proves each hop separately: the IPC handler throws on an invalid request (CNV-B17), the preload rejects an invalid reply (CNV-B17), and the window shows a rejected call as broken while keeping the text (CNV-B32, CNV-B35). The composed hop (a main-process handler throw reaching the window) is re-deferred. Owner: the coordinator. Trigger: the first real IPC failure. Pedro approves this re-deferral with revision 5. |
| Following the Windows Text size setting (decisions §33) | Deferred to the shell slice of the React port. Owner: the coordinator. |
| `@phosphor-icons/react` still used by the old shell (DESIGN.md:363) | Stays until the last Phosphor user is ported (the shell slice); no new use. |
| DESIGN.md:284 and :326 still state the halo-only focus rule (controls and composer) that §33's ring supersedes (G22) | The ui-ux agent updates DESIGN.md. Owner: the ui-ux agent, through the coordinator. |
| Recovery from a `stale-activation` Conversation answer (Pedro, decisions log §45) | Gap: the notice shows the row's message with no action, because the renderer's open path cannot replace a stale activation (`projects-workspace.tsx:124-153`; `active-project-coordinator.ts:249, :363-368`). Owner: the coordinator. Trigger: the first real occurrence. |
| Licence check of the S4 dependencies (§43): `@fontsource/red-hat-text`, `@fontsource/cinzel`, `@fontsource/cascadia-code` (OFL-1.1), `@axe-core/playwright` (MPL-2.0, dev only) | Carried into the licence check before the first installer. Owner: the coordinator. |
| Distinct desktop diagnostics (upgrade-window design :339-350) | Re-deferred. Trigger: a real occurrence. |
| `process-entry` → desktop log link, proven hop by hop (decisions §8 :84) | Carried. This design is the C1 gate, so there is no separate gate review. Owner: the coordinator. Trigger: the first missing upgrade log line in a real run, or S5's e2e if it reads the desktop log. |
| Generation-cap semantics (node-adapters :155) | Re-deferred. Trigger: retention policy work (nothing is deleted today). |
| S2 deviation 6a: the dedicated `WRITER_CLIENT_ABANDON_FAILED` code (decisions §28) | Done in S3 (CNV-B36). |
| U2: read routing after the writer's admission closes (decisions §29) | Done in S3 (CNV-B13, G17). |
| U3: settlement close failures keep the S1 retry-at-release (decisions §29) | Accepted design-vs-result gap; honoured in S3 (G18, CNV-B36 last oracle). |
| #102: listing cleanup masks the real failure | Done in S3 (CNV-B37, G19). |

## Deferred Work

- **C2:** model replies; Context proposals and records, the per-message model choice and streaming attempts, all in new tables (G3); the workspace `conversation.*` contracts.
- Branching, Waypoint conversations, `#`/`@` and `To:` (§15).
- **#92:** the full journal replaces `storage_upgrades` and S1's chain rule.
- **#93:** the Mastra head.
- **Runtime-database migrations.** Trigger: the first runtime table.
- **Durable drafts.** Trigger: a user request.
- **The shell slice of the React port** (rail, header, Projects sidebar, title bar, F6 zones, Skip to Attention): right after C1, as the ui-ux agent asked, so the two looks do not coexist for long (G21).
- **Moving the desktop bridge to Effect** (G28). Trigger: a slice that changes the bridge's request core beyond adding an operation, or the coordinator scheduling the desktop-main Effect migration.
- **The Rive splash window's CSP variant** (#130; decisions log :268-274): built with the React port's startup slice through G29's `window` parameter.

## Verification Notes

**Risks**
- The automatic upgrade of Pedro's real Projects (see the C9 integration recommendation).
- The hash-bound rebuild pin.
- The writer's hot path (G2).
- The 5 s busy waits.
- S4: the CSP on `file://` pages (G29); `@axe-core/playwright` under the CSP as built; packaged `file://` fonts; the five API lists; the activation guard and per-Project memory; e2e load from the parallel #94 measurements (heavy runs only with the coordinator's go-ahead).

**Workspace (G14, decisions §19).** C1 is built in a linked worktree on a feature branch, as the rigorous lane recommends; the main working tree is not used. Gates and candidate reviews run against the worktree's frozen commits. Candidate reviewers get the saved diff and `workflow_path`.

**Merge order (G15).** S1 and S2 reach `main` together. An S1 amendment reopens S1 acceptance and rebases S2 with new commits, and no pushed commit is rewritten. The C1 branch is never run against the real `userData` before that merge.

## Developer Context

Request: the coordinator hand-off of 2026-10-09, after C1-0 landed on `origin/main` `9aab1cc`. Pedro answered Q1–Q3, chose the workspace and decided the merge order through the coordinator. Authority: the decisions log in `679b9ae`, §16 (G9–G11) and §19 (G14, G15).

### Review gate status

- **Round 1** (coordinator, three reviewers): failed. The findings are in `c1-intent-round1.md` and are resolved below.
- **Round 2** (the last; revision 2, SHA-256 `77b62e02…`): failed, with fixable findings, in `c1-intent-round2.md`.
- **Pedro's decision** (decisions log `679b9ae`): the designer writes revision 3, the coordinator checks every item, and there is no third reviewer round. Pedro then approves.
- Revision 3 therefore has no independent reviewer pass. Pedro approved it on 2026-10-09; S1 and S2 were built from it and merged in `ba4e15b`.
- **Revision 4** (2026-10-10, for S3 before #107; content_hash `8b7aa9ee…`): changes only S3, the read path, G2/G6 wording and G17–G20, from Pedro's S2 decisions (§28, §29, §32) and #102. Rigorous lane: it needs an independent intent review of slice `c1-s3-conversation-protocol` before Pedro approves. Status `in-review` until then.

- **Revision-4 intent review, round 1** (2026-10-10; slice-verifier, artifact-code-reviewer and artifact-coverage-reviewer on `8b7aa9ee…`, every finding adversarially verified by claim-verifier): **failed**, all three. 6 blockers and the concerns below, all verified or weakened, one falsified (code F5). Resolved in revision 4.1 (table below). Round 2 is the last (at most two rounds); after it Pedro decides.

- **Revision-4.1 intent review, round 2** (the last; `e2dffc1a…`): **failed**, all three. Every round-1 item was confirmed resolved; 3 new verified test-contract blockers and about 10 concerns. Evidence: `.rpiv/artifacts/evidence/2026-10-10_c1-s3-intent-review-1.md` and `-2.md`. Pedro chose option A (decisions log §36): revision 4.2 fixes every item, then one verifier limited to these fixes (as in §32), then Pedro approves.

- **Revision 5** (2026-10-10, for S4 only; decisions §42, §43): rewrites the Desktop section and replaces S4 with S4a and S4b; adds G21–G28; updates S5, Success Criteria, carry-forward and Deferred Work. S1–S3 are unchanged. Rigorous lane: an independent intent review of `c1-s4a-renderer-foundation` and `c1-s4b-conversation-window` (at most two rounds), then Pedro approves. Status `in-review` until then.

- **Revision-5 intent review, round 1** (2026-10-10; two slice-verifiers, artifact-code-reviewer and artifact-coverage-reviewer on `93ec1de3…`, every finding adversarially verified by claim-verifier): **failed**, all four. 9 blockers (8 verified, 1 weakened), about 48 concerns and 22 suggestions; one suggestion falsified (VC-26). Evidence: `.rpiv/artifacts/evidence/2026-10-10_c1-s4-intent-review-1.md`. Resolved in revision 5.1 (table below). Round 2 is the last; after it Pedro decides.

- **Revision-5.2 bounded verification** (55 claim-verifiers, one per round-2 finding; `1718800d…`): 41 Verified, 13 Weakened, 1 Falsified (S4B-11). Evidence: `.rpiv/artifacts/evidence/2026-10-10_c1-s4-rev52-verification.md`. Pedro chose (decisions log §45): the stale-activation notice has no action and the recovery is a recorded gap; revision 5.3 applies every verifier item (table below); no new agents; the coordinator checks each item, then Pedro approves.

### Revision-5.2 verification resolution
| Verifier item | Change in 5.3 | Lines |
|---|---|---|
| R2-S4A-02, C2-02, VC2-03 (weakened): reset-removal check bound only max-width; heading rows; box-sizing; pseudo-elements | CNV-B51 pins note `max-width: none`, the heading's declared margin and non-legacy size, `border-box`; both binding checks (reset, layer) name the max-width row; the reset bullet names box-sizing and the accepted pseudo-element exception | :784 :785 :292 |
| R2-S4A-05, C2-04, VC2-05, VC2-12: meta row with `development: true`; meta position worded two ways | Unit row covers both `development` values; G29 and the round-2 row say "first element after `<meta charset>`" | :757 :375 :1098 |
| R2-S4A-06: stale CNV-B44 anchors in round-1 rows | Rows VC-02 and VC-23 point at CNV-B51 | :1133 :1170 |
| R2-S4A-07, VC2-14: shadow parser maps six bullets to four properties; S4b modules unnamed | Parser takes the four named bullets, strips `box-shadow: `, maps names; Seixo bullet cites :278, :280-:282; the literal rule uses a glob | :764 :291 :767 |
| R2-S4A-08 (weakened), C2-05: `src/shared` tests never collected | `vitest.main.config.ts` include gains `src/shared/**/*.test.ts` (S4a Files) | :744 |
| R2-S4A-09, C2-09, VC2-11: latin-ext request unproven | Fonts imported through per-weight CSS (latin-ext declared); CNV-B41 asserts a loaded face whose `unicodeRange` covers U+0151 | :289 :753 |
| R2-S4A-11 (weakened): bundled Cascadia changes the old shell, contradicting "unchanged" | Stated as the one accepted change in the Behaviour, the frame bullet and the S4a screenshot review, with the 400-only note | :737 :294 :790 |
| R2-S4A-13: 853×533 screenshot scale unstated | S4a review is at scale 1, content 1280×800 and 853×533 | :790 |
| S4B-01 (weakened): pending display after a remount; removal focus target; opening vs remount load | Memory gains `activationId`; focus rule keyed on the first load of an activation; CNV-B31 rows for the pending remount and the Remove-button target | :301 :863 :861 |
| S4B-02 (weakened): kept `read-only` false after a read-write reopen; old vs current pending; precedence versus the loading description | `read-only` is cleared on a new activation; old pending identified by `activationId`; "Loading messages…" outranks the kept outcome; CNV-B32 fourth and fifth cases | :326 :326 :328 :874 |
| S4B-03, S4B-11 (falsified): "Reopen Project" cannot work | Removed; the stale-activation notice has no action and focus goes to its title (Pedro, §45); carry-forward gap row | :305 :889 :1001 |
| S4B-04 (weakened), VC2-01: Tab missing in CNV-B31 loading and CNV-B34 empty rows; overclaiming resolution rows | Tab added to both rows; round-1 and round-2 rows reworded; the historical C7 row annotated | :860 :883 :1134 :1094 :1278 |
| S4B-05 (weakened): field ring layers, forced-colours width, attribution; textarea double ring; DESIGN.md:326 | Composer bullet: two layers, textarea without outline in both modes, V5 recorded in G24; CNV-B47 step 2 pins layers, width and the textarea; carry-forward names :326 | :307 :912 :1000 |
| S4B-06 (weakened): handlers cannot be restored; missing save states; screenshot sources | Step 4 removed; step 8 runs in further launches (no restore), lists every fault group incl. Broken save, rejected calls, stale activation and read-only; every step saves a screenshot | :918 :917 |
| S4B-12, VC2-13: "one per user action" inaccurate | Reworded to one per load or save, citing the Run-progress scope of the 10 s limit | :328 |
| S4B-13: duplicated G25 sentence | Duplicate removed | :371 |
| C2-01: wrong reason for the forced-colours offset row | Reason restated (the browser default outline, not the legacy rule) | :912 |
| C2-03: rename typo would pass CNV-B50 and the `rg` check | Static row: every `var(--legacy-*)` names a declared property | :787 |
| C2-07 (weakened): Broken save words not pinned in CNV-B32; rejected-read title | CNV-B32 pins "Not saved.", message and "Code <CODE>" for `broken`, and "Not saved." for a rejected call; the rejected-read notice has the title everywhere | :869 :327 |
| C2-08: scroll final value and sampling moment | Page-side observer waits one frame after "Saved" and checks the stream is at its end, with no further scroll | :915 |
| C2-10: late result overwriting newer state; old pending composer rule | A result changes memory only while its `saveId` matches a pending outcome; old pending shown as "Not confirmed." with an editable composer | :298 |
| C2-12 (weakened): strip not reviewed; "cancel note" misnamed; strip padding | Renamed the idle note; the strip is a new wrapper with 2 rem padding; the S4a review includes it | :294 :790 |
| VC2-04 (weakened), VC2-09: Try again/Reload width and forced style; Shift+Tab sequence | Step 8 pins width 2 px and forced `solid`; step 2 uses Tab from the composer and a valid typing order | :918 :912 |
| VC2-08: kept `saved` on return | A kept `saved` shows nothing on return | :326 |
| VC2-17: anchor and seed wording | Anchor `projects.test.ts:35-62`; the seed makes two clean Projects | :787 |
| All other ids (Verified, no new defect) | No change | — |

- **Revision-5.1 intent review, round 2** (the last; `fb948d46…`): **failed**, all four. Every round-1 item resolved or partly resolved; 2 verified blockers, 26 concerns (3 weakened) and 30 suggestions (2 weakened); none falsified. Evidence: `.rpiv/artifacts/evidence/2026-10-10_c1-s4-intent-review-2.md`. Pedro chose option A (decisions log §44): revision 5.2 fixes every item and folds in #130's per-window CSP owner, then one bounded verifier limited to the fixes, then Pedro approves.

### Revision-5.1 round-2 resolution
| Finding (verified unless marked) | Resolution in 5.2 |
|---|---|
| R2-S4A-01 (blocker), C2-01, VC2-04: `transparent` rule contradicts the decided ring; the legacy outline could reach Save | `transparent` is allowed as the focus rule's outline colour (Seixo theme bullet, CNV-B42); CNV-B47 step 2 pins Save's normal-colour outline (transparent, 2 px, offset 2 px) and the forced-colours offset 2 px, which the legacy rule (4 px) would fail. |
| VC2-01 (blocker), S4B-04: "never disabled" pinned only for read-only | No-`disabled` and `aria-disabled` rows in CNV-B18 (pending), CNV-B31 (loading, with its description before and after 300 ms), CNV-B34 (over-limit) and CNV-B35 (failed load); Tab rows in CNV-B18, B34 and B35 (5.3 adds Tab to CNV-B31 and the CNV-B34 empty-text row). |
| R2-S4A-02, C2-02, VC2-03: the layer only wins declared properties | G22 and the layer bullet: an unlayered zero-specificity `all: revert` reset at the region edge (SVG excluded); new CNV-B51 rows a leak fails (note colour and max-width, `projectId` font size), bound by removing the reset. |
| R2-S4A-03: class-less selectors are global | CNV-B42: every region selector contains a module-local class; the forced-colors block is nested under the region root. |
| R2-S4A-04, C2-03, VC2-02: `rg` check versus the kept `--prototype-*` tokens | Tokens renamed `--legacy-*` (values unchanged, CNV-B50 guards); the check runs over the whole of `apps/desktop` (tests and Vite configs included) and must return nothing. |
| R2-S4A-05, C2-04, C2-05 (weakened), VC2-05, VC2-12, and #130 | G29 and the CSP bullet: `contentSecurityPolicy({ window, delivery, development })`, no Electron import; the `<meta>` is the packaged variant, the first element after `<meta charset>`; CNV-B48 pins three literals, the pure HTML transform (unit), the built file (e2e) and the packaged page's `<meta>` (smoke); the `window` parameter allows the later splash variant with `'wasm-unsafe-eval'`, never in the main policy. |
| R2-S4A-06: CNV-B44's look rows had a red | Split: CNV-B44 keeps the guard rows; new CNV-B51 holds the look rows with their red at `6a41350`. |
| R2-S4A-07, VC2-14: hover and elevation values had no home | The theme module declares the two hover colours and four lifts from DESIGN.md; CNV-B42 parses and pins them; no colour literal in other region modules. |
| R2-S4A-08 (weakened): CSP owner not mutated | Added to the S4a mutation run. |
| R2-S4A-09, C2-09, VC2-11: sample text did not reach latin-ext | Sample "Aé€çő" (ő is latin-ext); the round-1 resolution row is corrected. |
| R2-S4A-10: setup-failure reds | CNV-B42 and CNV-B49 name a scaffold and a behavioural red. |
| R2-S4A-11, VC2-15: listener timing; bundled Cascadia reaches the old shell | `addInitScript` then a reload, listener asserted (S4a Seams); the old shell's code face change is stated and goes to the ui-ux screenshot review. |
| R2-S4A-12 (weakened): DESIGN.md:284 versus the adopted ring | G22 states that §33's ring supersedes DESIGN.md:284; carry-forward row for the ui-ux agent to update DESIGN.md. |
| R2-S4A-13, S4B-09, C2-11, VC2-10: window sizing | `setContentSize(1280, 800)` and `setContentSize(853, 533)` with `innerWidth` asserted (within 1 px at scale 1.5). |
| S4B-01: a remount inside one activation steals focus | Focus rule: only a load started by opening, switching, Reload or Reopen Project moves focus, and only from `body` or the starting control; CNV-B31 rows for the add flow and the removal view; save results go to per-Project memory, so a remount loses nothing. |
| S4B-02, C2-10, VC2-08: memory lacks the outcome; no slot precedence | Memory is `{ text, saveId, expectedRevision, outcome }`; "What a Project shows on return" names each outcome's display; the status slot has a fixed precedence; CNV-B32 drain-order cases pin it. |
| S4B-03: focus after Try again and Reload | Try again moves focus to Save; Reload stays mounted and `aria-disabled`, then focus goes to the composer (G26); CNV-B32 and CNV-B35 rows. |
| S4B-05: composer ring | The field uses the decided ring, not Seixo V3's halo-only rule; CNV-B47 pins its layers and its forced-colours outline. |
| S4B-06: no way to produce unreachable states | CNV-B47 replaces IPC handlers from the main process (step 8 since 5.3, in its own launches) to reach the fault and Broken states, with axe, forced colours, rings and screenshots. |
| S4B-07, C2-06: MESSAGE_INVALID row unreachable | Asserted on the pure mapping function (S4b Seams, CNV-B16). |
| S4B-08, C2-08 (weakened): no-op `getAnimations` check | Replaced: on the first frame after "Saved", `scrollTop` already equals its final value. |
| S4B-10: read-only description | Points at the read-only line only; CNV-B33 pins it. |
| S4B-11: Reload cannot fix `stale-activation` | 5.2 offered "Reopen Project"; the verifier falsified it (the real open path refuses). 5.3: no action (Pedro, §45); recovery gap carried. |
| S4B-12, VC2-13: checklist 05 | Each status line is one announcement per user action, so the 10-second limit does not apply; CNV-B46 pins that the list and the stream are not live regions. |
| S4B-13: G25's rationale | G25 says why wrong-event and mismatched replies stay `broken`, and that the kept `saveId` replays any hidden commit. |
| C2-07: Broken-tone words | Read: title, row message, "Code <CODE>"; save: "Not saved.", message, code line; CNV-B32 and CNV-B35 pin them. |
| C2-12: note and error above the flush region | They render in a padded strip above the region; included in the screenshot review. |
| VC2-06 (weakened): epoch drop end state | A dropped save sets `outcome: dropped`, the composer is editable, and on return the slot shows "Not confirmed." with "Try again"; CNV-B32 pins it. |
| VC2-07: year boundary in Lisbon winter | Added an Asia/Tokyo tuple (UTC+9). |
| VC2-09: CNV-B47 order | Steps are ordered: empty-state axe and keyboard first, overflow messages later. |
| VC2-16: two triggers for G28 | One trigger text in G28 and Deferred Work. |
| VC2-17: padding variant on other views | CNV-B50 pins the 32 px padding with no Project and with a safe-mode Project. |
| R2-S4A-00, S4B-00, VC2-00 (headers) | No change. |

### Revision-5 round-1 resolution
| Finding (verified unless marked) | Resolution in 5.1 |
|---|---|
| S4B-B16-MALFORMED-VS-PROTOCOL-ERROR, code F1, VC-01 (blockers): a malformed save reply arrives as a `protocol-error` | Desktop fact added (`harness-session.ts:39-46`); Bridge mappings and CNV-B16 rewritten: a malformed reply is a `protocol-error` (`uncertain` for a save, `broken` for a read); only a wrong-event reply, a mismatched echo, an unbuildable command or a colliding id are `broken`; rows for both operations. |
| S4A-04, code F2, VC-07 (blockers): CNV-B42's colour rule contradicts the ring and forced-colors rules | CNV-B42 defines the allowed literals; the halo derives from `--frost`; system colours only under forced colors. |
| S4B-EXPECTED-REVISION-FROM-READ (blocker), VC-16 (weakened) | G27 and the Loading bullet: every successful read sets `expectedRevision`; CNV-B18 pins the first save request after a read and after `conversation: null`; CNV-B32 pins the press after a conflict re-read. |
| VC-02 (blocker), S4A-03, code F5, S4B-OLD-SHELL-LEAK: old shell styles reach the region; no oracle | G22: the old shell is wrapped in `@layer legacy-shell`; the workspace drops its padding for the region; CNV-B42 static selector rows; computed font, background and edge-to-edge rows (in CNV-B51 since 5.2); CNV-B47 border 0 and font rows. |
| VC-03 (blocker, weakened), S4B-UNAVAILABLE-REASON, code F13 | Each unavailable state's description is named (none for empty text); CNV-B33 pinned no `disabled`; CNV-B34 and B35 pinned `aria-disabled` and the description (completed in 5.2 and 5.3: no `disabled` and Tab in CNV-B18, B31, B34, B35). |
| VC-04 (blocker), S4B-CHECKLIST-02-OVERCLAIM | Row 02 restated; CNV-B47 adds the composer ring and its forced-colors outline; Try again and Reload confirmed in the ui-ux screenshot review. |
| S4A-01, code F3, VC-05: removal list incomplete | Facts and S4a Files gain `forge-env.d.ts`, `build-project-entry-e2e.mjs`, the `"prototype"` unit row and the shell.test helpers; the removal check is a literal `rg`. |
| S4A-02, code F4, VC-08 (weakened): moving only tokens changes the old look | `legacy-shell.css` takes every `prototype-global.css` rule except `#prototype-root`, at the same cascade place; new guard CNV-B50 with recorded computed values. |
| S4A-05 (reduced motion in S4a, §43) | CNV-B44 reduced-motion row. |
| S4A-06 (checklist 09 on the frame; 02 unobservable) | CNV-B44 zoom rows; S4a mapping table with reasons. |
| S4A-07, VC-20: mutation scope | Success Criteria: S4a runs the root config once (`package-smoke-verifier.ts`); S4b adds `projects-workspace.tsx` ranges and the region components. |
| S4A-08, code F6, VC-06: no proof the CSP is in force on `file://` | New fact; G29 and CNV-B48 (shared owner, build-time `<meta>`, positive control); "in development" dropped from the S4a behaviour. |
| S4A-09, code F7: Vite may inline fonts as `data:` | No font inlining; CNV-B41 build-output guard. (Corrected in 5.2: the 5.1 sample stayed in the latin subset; the sample now includes ő.) |
| S4A-10: five icons untested | New CNV-B49. |
| S4A-11, code F10: S4a e2e timeout | 150 s per test, setup failures named. |
| S4A-12: axe include selector | `section[aria-label="Project workspace"]`. |
| S4A-13: smoke red row | "no fonts key" is the red row. |
| S4A-14, code F9: axe peer under strict peers | `playwright-core` pin if required; install result recorded. |
| S4A-15: S4a alone on `main` | G30: S4a merges only with S4b. |
| S4B-TEST-API-DEFAULT (weakened), VC-27 | The shared fakes answer a read with `conversation: null` and throw on a save. |
| S4B-PENDING-SAVE-FOCUS, code F12, VC-14 | The pending Save is `aria-disabled`, never `disabled`; CNV-B46 and CNV-B47 rows for the button path. |
| S4B-REJECTED-CALL-CODE, VC-17 | A rejected call shows the Broken tone with its sentence and no code line; row named "preload call rejected". |
| S4B-STATUS-SLOT-HANDLE | One slot, `#conversation-status`, pinned in CNV-B46 and used by CNV-B47 and S5. |
| S4B-UNCERTAIN-NOT-SAVED | "Not confirmed." for `uncertain` and the dropped-pending return (PROPOSED copy, G24). |
| S4B-PARTIAL-PAGING-FAILURE, VC-10 | CNV-B35 second-page rows; CNV-B31 uneven pages and the sent `after` values. |
| S4B-STALE-ACTIVATION-READ, VC-11 | A `stale-activation` read for the current activation is a failed load (G21 notes the change). |
| S4B-SCALE-FACTOR-RUN, VC-19 | The scale launch is 853×533 with `innerWidth` asserted; `electron-launch.ts` gains an extra-arguments parameter (code F18, weakened). |
| S4B-TRACEABILITY | G21 lists the changed meanings; G25 marked for Pedro's confirmation; anchor :148. |
| S4B-READ-ONLY-NOTE | Both lines shown; CNV-B33 pins the note. |
| S4B-A11Y-ORACLE-REACH, VC-12, VC-18 | CNV-B46 scroll-behaviour row; CNV-B47 axe in the empty and over-limit states, transitions 0 s; tone contrast from tokens in CNV-B42. |
| code F8 (weakened): axe may need a new page | `setLegacyMode(true)` allowed and recorded. |
| code F11: vague ring oracle | Numeric layer check (spreads and colours). |
| code F14, VC-13: time rule inputs | Exact tuples in Europe/Lisbon, with day and year boundaries. |
| code F15: import identity tests a collaborator | Row dropped; the behaviour rows remain. |
| code F16: 3:1 non-text contrast | CNV-B42 contrast rows from the tokens. |
| code F17, VC-21: API lists misstated | Facts restated; "sorted position" applies to the two sorted lists. |
| code F19: G28's premise | G28 reworded with the `runPromise` precedents. |
| VC-09: harness epoch and drain order | CNV-B31 and CNV-B32 rows. |
| VC-15: editing while pending | The composer is read-only while pending (G27). |
| VC-22: licence check | Carry-forward row. |
| VC-23: front-matter parsing | A line parser; typography not pinned (the fonts are checked by CNV-B41 and, since 5.2, CNV-B51). |
| VC-24: opens at the newest message | CNV-B47 reopen row. |
| VC-25 (weakened): craft and anti-clone review | The ui-ux screenshot review against DESIGN.md:189, per slice. |
| VC-26 (falsified) | No change. |
| VC-28: replayed true or false | Split into two cases. |

### Revision-5 changes
| Input | Change |
|---|---|
| §42 S4 in React | Desktop section rewritten; S4a and S4b; G21. |
| §43 split, shell, prototype, dependencies | G21, G22, G23; S4a Files and dependencies. |
| ui-ux answers V1–V7, reconciliations R1–R4 | G24, G26; the renderer bullets and CNV-B18, B31–B35, B45, B46. |
| Stale facts | Protocol v8; `savedAt`; the bridge's missing "not sent" vs "lost" split (G25, CNV-B16); `protocol-error` on a sent save is `uncertain`; tests keyed by status and row, not code; no second `role="status"` (G26); CNV-B17's IPC red names the bridge call, not `invoke`; a send refused with `MESSAGE_INVALID` is `broken`. |
| 12-point checklist (§33) | Per-slice mapping; CNV-B44, CNV-B46, CNV-B47; manual NVDA and Narrator evidence. |
| G2 residual trigger | Fires in S4b; per-hop proofs; composed hop re-deferred for Pedro's approval. |

### Revision-4 changes
| Source | Change |
|---|---|
| U2 (§29) | CNV-B13 rows after admission closes (abandonment and failed settlement); read path routing (G17). |
| Deviation 6a (§28) | G6 note; CNV-B36 adds `WRITER_CLIENT_ABANDON_FAILED` to the v8 release vocabulary. |
| U3 (§29) | G2 bullet; G18; CNV-B36 keeps settlement release codes. |
| Round 3 fix B (§32) | G2 bullet "admission closes inside the slot"; G18; S3 adds no admission state. |
| #102 | G19; CNV-B37; files and the flipped pin. |
| Names (§30) | G20; new text only. |

### Revision-4 round-1 resolution
| Finding (verified) | Resolution in 4.1 |
|---|---|
| slice B1, code F2, coverage B14-CLOSE: `project.close` never reaches the coordinator (6b not folded in) | `project.close` removed from S3 Behaviour, CNV-B14, the admission section and G6 :190; the drain is proven on switch and coordinator stop, as 6b did for S2. No routing change. |
| slice B2, code F3: G19 would clear real listing cleanup failures | G19 narrowed: only the three registry-data codes count as completed, because a failed `finally` cleanup (`project-listing.ts:226-227`, `registry-database.ts:106-108`) replaces them with `INTERNAL_FAILURE`, which stays unconfirmed. New CNV-B37 oracle for `INTERNAL_FAILURE`. |
| slice C3, code F1, coverage SEAM: the process seam cannot inject faults or holds | Two named seams: (a) process runtime for plain, identity and real-lock rows; (b) `startHarnessRuntime` over a composed coordinator for fault and hold rows. Row-to-seam map; seam (b) red stated. |
| coverage READ-RACE, slice S5, code F9: no oracle for a closure while the read waits | CNV-B13 queued-read rows per closure kind, as a guard bound by a recorded pre-slot-routing mutation. |
| slice C6/C7, code F4/F6, coverage B37-REJECT / B37-STOP-SEAM | CNV-B37 rejected cases split by timing with today's exact values as pins; the stop rule moves to the exported `registration/registration-listing.ts` with its own unit file, one `RegistrationCleanupUnconfirmed` error, registry stop included. |
| slice C1, code F8: the fallback owner and drain | The coordinator owns G17 inside one admitted registration; files and the opener dependency added; CNV-B14 fallback-read drain row. |
| slice C2: the closure red cannot be observed | Red restated against a named scaffold (`broken PROJECT_STORAGE_BROKEN`). |
| slice C4, code F10, coverage B36-RUNTIME | CNV-B36 coordinator oracle in `active-project-coordinator.test.ts` with the full diagnostic; red stated. |
| slice C5, code F7: G2/G6 still pre-U3 | Both reworded. |
| coverage B14-RED | CNV-B14 red moved to the read held in the per-request client; writer-held rows recorded as guards bound by a mutation. |
| slice S2, coverage NATIVE-LONG | Separate native-long runtime file, registered in `vitest.native-long-files.ts`, durations recorded. |
| code F11: Effect rules | Stated for the coordinator methods, `admitActiveWork` and the listing adapter. |
| code F14, coverage MUTATION | CNV-B38 (routing unit) and CNV-B39 (dispatch unit); mutate list widened. |
| slice S1, code F12 | The code also joins the activation `broken` union and its test pin; anchors corrected. |
| slice S3, coverage B29-RED | CNV-B29 marked as a guard bound by a named mutation. |
| slice S4: stale anchors | "S3 anchors at `80228ac`" list added to S3. |
| code F13 (weakened): fakes | Risk line: typecheck lists every `satisfies ActiveProjectCoordinator` fake. |
| coverage 102-TEST-CLEANUP (weakened) | S3 test-teardown rule added. |
| code F5 (falsified) | No change; CNV-B37 still names its time control (fake timers, precedent `registration-bootstrap-guards.integration.test.ts:320`). |
| slice R0: packet identity | Round 2 gets `workflow_path` and the stamped content_hash. |

### Revision-4.1 round-2 resolution
| Finding (verified) | Resolution in 4.2 |
|---|---|
| slice B1, code 01, coverage B13-ABANDON-PAGE: the abandonment closure commits the closing save | Expected page per kind: failed settlement = P1; abandonment = P1 plus the closing message, revision + 1. The closing save's `saved, replayed: false` is asserted; "a further save". Queued-read rows use the same per-kind page. |
| coverage B12-FIELD-BOUNDS | CNV-B12 rejection rows for `after`, `expectedRevision`, `saveId`, `activationId`, `projectId`; accepted edges; bad result rows. |
| coverage B14-SAME-TURN, slice C1 | Same-turn coordinator rows bound by the "register after first await" mutation; writer-held rows relabelled as pins over two drains, bound by the combined mutation. |
| slice C2, code 05, coverage B14-RED | Per-request read rows: build order (after plain B13, before B38), the scaffold named, the gate placed before any statement, and the red is the ordering observation on `project.switch.result` or the stop resolution. |
| slice C3, coverage UNCERTAIN-NATIVE-LONG | The `uncertain` row moves to the native-long busy file. |
| slice C4, code 08 | G2 and the writer section limit the contention clause to Conversation work; a thrown settlement (including BUSY) and a snapshot failure close admission; routing acts on any writer refusal. |
| slice C5, code 02 | A `readConversationReadOnly` port in the File Map; CNV-B38 states its exact arguments. |
| slice C6 (weakened): identity | `git diff --name-only 80228ac 7a1b041` = the decisions log only; recorded in the inputs. |
| slice S1, code 07 | The failed-settlement injection is the seam (b) `writerClientFaults` close fault before a fixture note command. |
| slice S2, code 04, coverage B36-U3 | CNV-B36 U3 writer row with the exact code `WRITER_FENCE_RELEASE_FAILED`, the stages, no abandon call; guard. |
| slice S3: U2 covers abandonment only | Pedro accepted the extension to a failed settlement and snapshot (§36, `e59bbb7`); G17 cites it. |
| code 03, coverage B37-SINGLE-PART | Adapter rows for listing-only and registry-only failures. |
| code 06 | CNV-B40 for the canonical application wrappers; added to the mutate scope. |
| code 09 (weakened) | `ActiveActivation` records `canonicalDatabasePath`. |
| code 10 | CNV-B36 build order stated. |
| coverage MUTATION-PREPARATION-SCOPE | Line-range mutate entries; per-file scores. |
| coverage MUTATION-INCREMENTAL | Final S3 run is `pnpm exec stryker run --force`, once, on the final candidate. |
| coverage AFTER-PASSTHROUGH | CNV-B38 checks `{ canonicalDatabasePath, projectId, after }` incl. `after: 100`; CNV-B13 paging row with 101 messages, through the writer and the fallback. |
| coverage B13-CLOSES-PROXY | `writerClientCalls` counts `execute` and `transaction` calls; the close count keeps its narrower meaning. |
| slice S4 (falsified) | No change beyond the line-range scope. |

### Revision-4.2 verification resolution
Source: `.rpiv/artifacts/evidence/2026-10-10_c1-s3-rev42-verification.md` (one bounded verifier on `882180ce…`, every finding checked by claim-verifier; no blockers). Pedro chose to apply every finding as revision 4.3; the coordinator checks each item, with no new review agents. Line numbers are in this revision.

| Finding id | Change | Lines |
|---|---|---|
| B14-ORDER (concern) | CNV-B14 split into phase 1 (read-only variants, red first, before CNV-B38) and phase 2 (fallback variants, guards, after CNV-B38 and the closure rows); the registration state of saves and writer reads at the plain-B13 stage stated; the same-turn read-only row is red, the same-turn save row a guard. | :613-622 |
| SEAM-B-RECONCILE-OPENER (concern) | New optional coordinator dependency `openReconciliationClient`, passed to `saveConversationMessage` as its `openReadOnlyClient` and wired in `node-active-project-coordinator.ts`; seam (b) hooks it for the `uncertain` row. | :568, :561 |
| B40-OWNER-EXCEPTION (concern) | CNV-B40 oracle: the invalid-result error is sanitised with no `cause`; an owner exception propagates unchanged, as the existing methods do. | :667 |
| PREP-RANGE (concern) | Preparation mutate ranges narrowed to :225-264, :279-292 and :352-367 at `80228ac`. | :780 |
| G2-THREE-PATHS (suggestion) | G2 names three closure paths; the snapshot path closes admission before the slot and does not refuse queued work. | :301 |
| B36-U3-STAGES (suggestion) | Exact calls across two closes, `["fence", "fence", "repository", "lease"]`, S1 precedent `canonical-project-writer.test.ts:419-485`. | :638 |
| B12-RED-LABELS (suggestion) | Missing `activationId` and non-UUID `projectId` rows marked as guards. | :586 |
| TEXT-RESIDUES (suggestion) | Read path cites the recorded `canonicalDatabasePath`; the note command is `recordNoteCommand` (:123-148); the fixture exports `faultingClient`, `recordNoteCommand` and `noteAggregateId`. | :202, :596, :572 |
| MUTATION-RUNS (suggestion) | The final S3 candidate also runs `stryker.conversation.config.json` once; CNV-B12 joins the oracle list. | :780 |
| Partly-resolved rows (slice C2/code 05/B14-RED; slice C4/code 08; code 06; MUTATION-PREPARATION-SCOPE) | Closed by B14-ORDER, G2-THREE-PATHS, B40-OWNER-EXCEPTION and PREP-RANGE above. | as above |

### Round-1 resolution

| Item | Resolution |
|---|---|
| B1 shared slot closes admission | G2: the writer's FIFO slot queue serializes both paths. A typed `WriterOwnerBusy` maps to a retryable wait. Only an unknown client state closes admission. CNV-B24 and CNV-B10(b) added. |
| B2 chain `createdAt` | S1: compare with the chain root (G12); `project-storage-node-adapters.ts:819-824` added. Asserted in CNV-B4 (reopen and create-replay). ADR 0006 :149-150 amended. |
| B3 registration receipts | S1: receipts resolve through the chain root (`registration-confirmation-store.ts:265-273`, G12). CNV-B20 uses the real registration flow and a real v3→v4 upgrade. |
| B4 bridge rows | The bridge-only rows (`connectionLost`, the three harness codes) are in the protocol map. A save lost after sending is `uncertain`. The `saveId` survives reactivation (CNV-B32). |
| B5 result table | Full table with status, op, code, message and retryable, bound to the existing owners. Two new codes, with justification. `conversationMessageId` and the branded ids. |
| B6 test contracts | Every CNV-B has a title, path, oracle and behavioural Expected red. Pins are marked (B5, B15, B23, B28, B30). |
| B7 coverage gaps | B31 (pages on activation). B32 (text kept for every outcome; per-Project memory). B30 (identity after reopen). B10 (a real commit failure and a separate connection). B14 (close, a held read, a read during a switch). The canonical snapshot in B6–B11. B13 (wire mapping). B9 and B28 (fault injections; one predicate). B23 (fixture fidelity; helpers renamed by depth). B33 (read-only). B1, B12 and B34 (byte boundary, BLOB check, shared predicate, whitespace set). B25 and B35 (degrade on read). |
| B8 atomicity and gates | Success Criteria per slice: S1 and S3 run e2e and launch-smoke, and the desktop pin is in S3. The claim is re-established. |
| C1 `busy_timeout` 5 s | Fact corrected. The B9 busy cases run in `native-long` with a 15 s timeout and recorded durations. |
| C2 fence | `currentCanonicalSettlementFence`; CNV-B11 moves the `writer_fence` row. |
| C3 chains longer than two | The discard proof retains every chain source. CNV-B5 includes a three-row gap. CNV-B22 added. |
| C4 paging | CNV-B26 (100, 101, 201; exclusive `after`; `null` at the end). The renderer follows `nextCursor` (CNV-B31). |
| C5 read path | Read-write: through the writer slot. Read-only: a per-request read-only client on the generation pool. Busy-read oracles in B9 and B25. |
| C6 concurrency | A save during a settlement waits (CNV-B24) and is never broken. Two first saves create one root (CNV-B27). The listing chained switch is carried as F9. |
| C7 renderer | Save is unavailable while pending (CNV-B18; since revision 5 `aria-disabled`, never `disabled`, G26). After an edit, a new `saveId` with the old revision, then a conflict reload (CNV-B32). |
| C8 precedence | CNV-B29: an it.each table against `execute`. |
| C9 split S1 | Decided by Pedro: no split; S1 merges only with S2 (G15). `fork_message_id` and composite (`conversation_id`, `branch_id`) FKs added. The C2 fit is recorded under G3. |
| C10 carry-forward | The C1-gate carry-forward table. |
| C11 mutation | The chain rule and the filesystem agreement added to S1 mutation. |
| C12 suggestions | `hashCanonicalJson`; `withConversationWriter`; the Precedents and lessons section; `lane` frontmatter; §16–19 cited (now at `679b9ae`). |
| Process: worktree | Pedro chose a linked worktree (§19) → G14 and Verification Notes. |

### Round-2 resolution

| Item | Resolution |
|---|---|
| R2-B1 G6 vs staged release | G6 split into known and unknown client state. An abandoned client: release skips the fence and repository stages, force-closes the raw client, releases the lease, and leaves the fence to the next activation's abandoned-fence recovery. A raw-close failure has its own diagnostic (`WRITER_CLIENT_ABANDON_FAILED`). CNV-B10 (b) asserts `sourceReleased: true` on switch and close, then a read-write reactivation. The false claim "matches today's canonical rule" is removed. |
| R2-B2 admission after contention | CNV-B9 and CNV-B25: after a released lock and after a corrupt-row broken save, the next save and the next command are accepted. |
| R2-B3 B13 wire mapping | CNV-B13 is an it.each over every harness-produced row per op, including `uncertain` (B10 c), read `null`, read busy and read broken. |
| R2-B4 impossible reds | B1: the unscaffolded base red. B2: guard. B5b: the red moves to two completed rows plus an interrupted upgrade (SQL and file seed). B22: a three-row registry-plus-directories fixture, pin, gap disclosed. B10 (a): red restated (maps to broken). B13: concrete red (`HARNESS_INTERNAL_FAILURE`). B30: composition guard. B27: both at revision 0, guard. |
| R2-B5 merge order | G15 (user decision, `679b9ae`) with its consequences: amendment rules, S2 gates with e2e and launch-smoke, no real `userData` before the merge. Authority re-pinned at `679b9ae` (`bceafed8…`). |
| R2-C1 slot re-check, no deadlock | Admission re-checked after acquiring the slot. Abandonment never awaits queued work. Queued command case in CNV-B10 (b). |
| R2-C2 typed busy only | Only the `exclusively` flag becomes `WriterOwnerBusy` (defensive, one writer test). `hasUnfinishedTransaction` stays non-retryable and closes admission. |
| R2-C3 read after admission closes | Falls back to the per-request read-only client. Case in CNV-B10 (b). |
| R2-C4 read-only busy wait | `busy_timeout = 2000` on the read-only client. CNV-B25 read-only cases. |
| R2-C5 chain order | G16: order and root from links only; `started_at` is not checked (amended by U1, S1 review round 1). |
| R2-C6 B1 rules | CNV-B1 it.each of raw-SQL rejections, one per permanent rule. |
| R2-C7 composer isolation | CNV-B32 isolation oracle, driven from the literal table. |
| R2-C8 B35 rows | CNV-B35 it.each over every non-`read` read row except stale-activation. |
| R2-C9 fault seams | Named: real locks, readers, fence and corrupt rows; the worker-client seam for typed SQLite errors; the classification seam for the failed close only. |
| R2-C10 bridge fault model | Unsent (stopped or send not OK) → `unavailable`; lost after send → `uncertain`. Separate failure kinds. CNV-B16. |
| R2-C11 CRLF | Line breaks kept at the renderer; `\r\n` byte-exact at the protocol and the store. |
| R2-C12 test projects | File lists for `vitest.native-long-files.ts` (B9, B10 a, B25, B13 busy rows) and `vitest.registration-files.ts` (B20), with idle durations recorded. |
| R2-C13 mutation configs | S1: `stryker.project-storage.config.json`. S2: a new `stryker.conversation.config.json`. S3: the root config. |
| R2-C14 carry-forward owners | The G2 residual and the log link have an owner (the coordinator) and a trigger. "C1 gate review" is replaced. |
| R2-C15 suggestions | `rewindToGenerationThree` helper; B23 normalised fields, capture command and revision, fidelity guard; B24 control run; B26 tuples; read → `coordinator-unavailable` in B14; B29 title with placeholders. |

## References

- `.rpiv/artifacts/handoffs/2026-10-05_conversation-c1-local-save-brief.md`
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` at `679b9ae` (§3–4, §14–19)
- `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-brief.md`
- `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`
- `.rpiv/artifacts/designs/2026-10-06_18-48-25_upgrade-window.md`
- `docs/adr/0004-canonical-board-index.md`, `0005-storage-lifecycle-and-recovery.md`, `0006-physical-persistence-layout.md`, `0009-provider-neutral-agent-runtime-and-turn-contracts.md` (Amendment 1)
- GitHub issues #92, #93, #102, #107
- `.rpiv/artifacts/evidence/2026-10-09_c1-s2-tdd-evidence.md`; decisions log at `59a8d9b` (§28–§32)
- `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`
- Revision 5: decisions log at `9e06d55` (§42) and `6a41350` (§43); `DESIGN.md`; `C:/Users/pedro/Documents/ragnarok-hero/PORT-PLAN.md`, `access.src.html` (checklist :381-393, forced colors :237-248), `access.css:8-17`, `components.css`, `conversation.css`, `states.src.html`, `icons-runa-v2/`; Playwright accessibility testing (`@axe-core/playwright`, Context7 `/websites/playwright_dev`)
