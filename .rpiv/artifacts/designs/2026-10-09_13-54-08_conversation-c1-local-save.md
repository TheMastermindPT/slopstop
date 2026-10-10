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
last_updated: 2026-10-10T18:00:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Approved by Pedro on 2026-10-10 (revision 4.3, content_hash 5ff869b7b774e2cc6bd1143ef507488868b9c2020ae0e80840e7576649df2e19; decisions log §37); approved copy under .rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/. S3 (#107) may start. Revision 4.3 (every rev-4.2 bounded-verifier finding applied, Pedro's choice; the coordinator checks each item, then Pedro approves; no new review agents). Revision 4.2 (after S3 intent review round 2, the last; Pedro chose option A, decisions log §36: fix every round-2 item, then one verifier limited to the fixes). Revision 4.1 (after the S3 intent review round 1, which failed: six verified blockers, all fixable). Revision 4, for slice S3 before #107 (coordinator hand-off, 2026-10-10). Adds the CNV-B13 read-after-admission-closes rows (U2, decisions log §29), and folds in what S2 changed: deviation 6a (the dedicated WRITER_CLIENT_ABANDON_FAILED release code arrives with protocol v8, CNV-B36), U3 (a failed settlement keeps the S1 retry-at-release), the round-3 rule that admission closes inside the writer slot (§32), and #102 fixed inside S3 (CNV-B37). Facts for S3 re-verified at main 80228ac. Behaviour IDs kept; S1 and S2 commitments unchanged. Needs an independent intent review (rigorous lane) before Pedro approves."
content_hash: 5ff869b7b774e2cc6bd1143ef507488868b9c2020ae0e80840e7576649df2e19
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
  - §14–15 and §17–18: the visual structure belongs to the UI/UX agent. This design fixes behaviour and seams, not pixels.
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
- Visual identity and the final layout.
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
- `protocolVersion = 7` (`protocol.ts:77`); the desktop pin is at `canonical-writer-package-smoke-test-peers.ts:73`.
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
- the exported text predicate `conversationTextProblem(text): "empty" | "whitespace-only" | "too-large" | undefined`. Whitespace is the JavaScript `\s` class with the `u` flag; size is UTF-8 bytes via `TextEncoder`. The renderer and the harness both import it;
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

**Bridge** (`project-entry-bridge.ts`)
- `readConversation` and `saveConversation` follow S3b's `upgrade` pattern.
- A `request.failure` gives `broken` with its harness code.
- A malformed reply gives `broken PROTOCOL_MESSAGE_INVALID`.
- A disconnect before sending gives `unavailable` (`connectionLost`).
- **A disconnect after sending a save gives `uncertain CONVERSATION_SAVE_UNCONFIRMED`.** For a read it gives `unavailable` (`connectionLost`).

**IPC and preload**
- `projects:conversation:read` and `projects:conversation:save`, registered in `registerProjectEntryIpc`.
- The preload adds `readConversation` and `saveConversationMessage`, with strict decode both ways.

**Renderer** (behaviour only; the placement belongs to the UI/UX agent)
- `View` gains `activationId` and `access`. The Conversation section replaces `workspace-view.tsx:98-100`.
- **Loading.**
  - On mount and on every new `activationId`, the section reads all pages, following `nextCursor` until `null`, and shows the messages in cursor order.
  - A failed load is its own state, with the reason and "Reload". It never looks like an empty conversation, and saving stays disabled until a read succeeds.
  - A `stale-activation` reload is dropped.
- **The composer value is passed unchanged:** no trimming; `\r\n` and tabs are kept.
- **"Save locally" is disabled** while any of these holds:
  - `conversationTextProblem` reports a problem. Over the limit, it shows "This message is longer than 32 KiB." and keeps the text.
  - The Project is read-only. The `read-only` reason text shows, and the earlier messages stay visible.
  - A save is pending (a second press sends nothing).
  - The last load failed.
- **Save status.**
  - While pending: "Saving…".
  - After `saved`, and only then: "Saved". The composer clears and the message joins the list.
  - **Every other outcome keeps the exact text in the composer, with its reason.** This covers pending, `conflict`, `rejected`, `uncertain`, each refusal row, and the bridge's `connectionLost`, harness and protocol rows.
  - "Try again" resends the same `saveId` and text for `uncertain` and every retryable outcome.
  - Editing the text mints a new `saveId` with the last known `expectedRevision`.
  - A `conflict` reloads the conversation and keeps the composer text.
- **Per-Project memory.** The composer text and any pending `saveId` are kept per `projectId`, in memory, across switches.
  - A result that arrives for an old activation is dropped by the epoch guard. The text and `saveId` stay in that Project's memory.
  - On return, "Try again" resends the same `saveId` under the new activation. The exact-retry rule resolves it, because the fingerprint excludes the activation.
  - All of this is lost on app restart (durable drafts are a non-goal).

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
- **G16 Chain order from links** (R2-C5). The chain order and its root are derived from source→target links; the root is the row whose source is no row's target. `started_at` comes from an injected clock and is never checked: equal or backward times never make a correctly linked chain `REGISTRY_CORRUPT` (Pedro, S1 review round 1, U1).

## Slices

The order is S1 → S2 → S3 → S4 → S5. Behaviour IDs are `CNV-B…`. Each slice is one commit: red at its seam, minimal implementation, green, then a separate review and refactor.

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

### S4 `c1-s4-conversation-window` — bridge, IPC, preload, renderer

**Behaviour**
- In the active Project, "Save locally" saves the message, and "Saved" appears only after the harness confirms it.
- Every other outcome keeps the text, with its reason.
- Messages reload in order on every activation.
- A read-only Project shows its messages, with saving disabled and the reason shown.

**Seams.** The bridge over a real `HarnessSession` with a Port fake; `registerProjectEntryIpc` with the `ipcMain` mock; `preload.test.ts`; the renderer through `exposeApi` with gated promises.

**Files**
- `apps/desktop/src/main`: `project-entry-bridge.ts`, `project-entry-ipc.ts`, `package-smoke-verifier.ts`.
- `apps/desktop/src/shared/desktop-api.ts` and `apps/desktop/src/preload/preload.ts`.
- `apps/desktop/src/renderer`: `workspace-view.tsx`, `projects-workspace.tsx`, new `conversation-section.tsx`, new `use-project-conversation.ts`, `test-api.ts`.
- The API lists.

**Contracts**
- **CNV-B16** `maps conversation replies and transport faults` → `apps/desktop/src/main/project-entry-bridge.test.ts`.
  - Oracle:
    - each harness result is passed through unchanged;
    - `request.failure` with each harness code → its `broken` row;
    - a malformed reply → `PROTOCOL_MESSAGE_INVALID`;
    - a send that is not OK, and a save called after the bridge stopped (unsent) → `unavailable` (`connectionLost`), never `uncertain` (R2-C10);
    - a disconnect after sending → `uncertain` for a save, `unavailable` for a read.
  - The bridge distinguishes "not sent" (`project-entry-bridge.ts:71`) from "lost after send" (:47-49, :184) with separate failure kinds.
  - Expected red: the methods are absent; after scaffolding, a disconnect after sending answers `unavailable`.
- **CNV-B17** `exposes strict conversation methods` → `project-entry-ipc.test.ts`, `preload.test.ts` and the API lists.
  - Oracle:
    - the handlers forward valid values;
    - an extra key throws, with no bridge call;
    - the preload decodes both ways;
    - the API list gains the two methods.
  - Expected red: after scaffolding the handlers without forwarding, `invoke` is not called.
- **CNV-B18** `saves locally and shows Saved only after confirmation` → `apps/desktop/src/renderer/project-conversation.test.tsx`.
  - Oracle:
    - the note text is exact;
    - while the save is pending: "Saving…", no "Saved", Save disabled, and a second press sends nothing;
    - on `saved`: the message is in the list, the composer is empty, and "Saved" shows;
    - the composer value is sent unchanged: leading and trailing spaces, tabs and line breaks kept. A textarea normalises CR/CRLF to LF, so `\r\n` byte-exactness is pinned at the protocol (CNV-B12) and the store (CNV-B6), not here (R2-C11).
  - Expected red: there is no Conversation section.
- **CNV-B31** `reloads all pages on every activation` (same file).
  - Oracle:
    - 201 messages over three gated pages are shown in cursor order, after mount and again after a new activation;
    - a reload from a stale activation is dropped.
  - Expected red: only the first page is shown.
- **CNV-B32** `keeps the text when a save answers $status $code` (same file).
  - Driven from the literal result table: every save row except `saved`, including `PROJECT_STORAGE_UNAVAILABLE`, `PROJECT_STORAGE_BROKEN`, and the bridge rows.
  - Oracle:
    - for pending and each row, the composer keeps the exact text and the row's reason shows;
    - "Try again" resends the same `saveId` for `uncertain` and retryable rows;
    - editing after `uncertain` sends a new `saveId` with the old `expectedRevision`, and the resulting `conflict` reloads and keeps the edited text;
    - per-Project isolation (R2-C7): Project A has a pending save, then the user switches to B. B's composer holds neither A's text nor A's `saveId`, and a save in B carries a fresh `saveId`. Returning to A restores A's text and `saveId`, and "Try again" under the new activation answers `replayed` or `saved`.
  - Expected red: the composer clears on submit.
- **CNV-B33** `shows a read-only Project's messages with saving disabled` (same file).
  - Oracle: the earlier messages are listed, Save is disabled, and the exact `read-only` reason text is visible.
  - Expected red: the section is hidden, or Save is enabled.
- **CNV-B34** `applies the shared text rules` (same file).
  - Oracle:
    - empty, `" \t\r\n"` or NBSP-only text → Save disabled;
    - 32768 multibyte bytes → Save enabled;
    - 32769 bytes → Save disabled, "This message is longer than 32 KiB." shown, and the text kept;
    - the predicate used is the protocol export (import identity asserted).
  - Expected red: Save is enabled for whitespace-only text.
- **CNV-B35** `shows a failed load when a read answers $status $code` (same file).
  - An it.each over every non-`read` read row except the dropped `stale-activation`: `inactive`, `project-mismatch`, `coordinator-unavailable`, `unavailable` (storage and connection), and `broken` (storage and the bridge rows).
  - Oracle: each shows its reason and "Reload", never the empty state; Save stays disabled until a read succeeds.
  - Expected red: an empty conversation is shown.

**Risks**
- The layout is provisional (the UI/UX agent owns it).
- The epoch guard and the per-Project memory.
- The API lists.

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
- S4 and S5: `pnpm test:e2e` and `package:launch-smoke`.

**Mutation**, with the coordinator's go-ahead (R2-C13):
- S1: the chain rule and the filesystem agreement, through `stryker.project-storage.config.json`;
- S2: the store, the slot queue and `sqlite-busy`, through the new `stryker.conversation.config.json`;
- S3: through the root `stryker.config.json` (unit tests). Its `mutate` list gains, with Stryker's line-range form recorded at build time: `project-conversation-protocol.ts` (whole new file), `canonical-project-protocol.ts` (the CNV-B36 ranges), `active-project-coordinator.ts` (`admitActiveWork`, `conversationRead`, `conversationSave` and the G17 routing), `canonical-project-application.ts` (the two new wrappers), `registration/project-registration-preparation.ts` (only the code CNV-B37 drives, at `80228ac`: `pendingListing`, `listProjects`, `cleanupUnconfirmed` and `drainPreparations` :225-264, `trackedListing` :279-292, `close` :352-367) and the new `registration/registration-listing.ts`; `harness-runtime.ts` is already listed. Each mutated range has a unit oracle: CNV-B12, CNV-B14 same-turn rows, CNV-B29, CNV-B36, CNV-B37, CNV-B38, CNV-B39 and CNV-B40. The root config is incremental, so the final S3 run is `pnpm exec stryker run --force` on the final candidate, once, with per-file scores recorded for every S3 file. The CNV-B36 writer change is mutated by `stryker.conversation.config.json`, which already lists `canonical-project-writer.ts`; the final S3 candidate also runs that config once (it is not incremental), with per-file scores recorded.
- `WriterOwnerBusy` is a defensive branch, pinned by its writer-level test.

**Push gate:** `pnpm check:deep`.

**Claim, re-established.** After S1 and S2 merge together (G15), every existing kind of Project opens read-write after its automatic upgrade: Storage-only v2 and v3, upgraded-once, and registered (CNV-B2, B3, B4, B20). Nothing writes the new tables until S2, and nothing in the UI uses them until S4.

## C1-gate carry-forward

| Item (source) | Disposition |
|---|---|
| Chained upgrades (#92; C1-0 design, Deferred Work) | Done in S1 (G9). |
| Registered-Project receipts after an upgrade (C1-0 design :264, :286) | Done in S1 (CNV-B20). |
| Chain root `createdAt` (C1-0 design :264) | Done in S1 (CNV-B4). |
| `project.upgrade` skips the registered admission checks (S3 design, Deferred Work) | Re-deferred. Owner: the coordinator's issue list. Trigger: the first registered Project whose repository moved before its upgrade. |
| Listing concurrency F9, extended to a chained switch between the listing scan and its registry read (`project-listing.ts:86`; node-adapters :1070-1077) | Accepted risk, carried. Worst case: a transient `recovery-required` row. The data-safety proofs hold. |
| Representative-size timing (S3a) | Re-deferred. Trigger: measured real Project sizes. |
| G2 residual: no composed IPC failure proof (upgrade-window design) | Carried. Owner: the coordinator. Trigger: the first real IPC failure, or the next change to `registerProjectEntryIpc`. |
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

## Verification Notes

**Risks**
- The automatic upgrade of Pedro's real Projects (see the C9 integration recommendation).
- The hash-bound rebuild pin.
- The writer's hot path (G2).
- The 5 s busy waits.

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
| C7 renderer | Save is disabled while pending (CNV-B18). After an edit, a new `saveId` with the old revision, then a conflict reload (CNV-B32). |
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
