# ADR 0023: One Strict Identity Text Root

- Status: Accepted (2026-10-24, Pedro Mesquita; see Decisions)
- Date: 2026-10-24
- Decision owners: Pedro Mesquita
- Source: architecture review `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md`, IX-3 and Phase 2 (Vocabulary owners, ADR first); constituents L7-03, L5-03, L4-09, L4-10, L8-01, L8-02, L5-07
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §144 (the six review phases are the plan)
- Measured at: main `d2851ca`

## Context

Two schemas validate UUID text, and they accept different values:

| Root | Location | Versions | Variant | nil / max | Case |
|---|---|---|---|---|---|
| `DomainIdentityTextSchema` | `packages/kernel/src/workspace-identifiers.ts:4-11` | 1-8 | `8 9 a b` | rejected | any (`/iu`) |
| `UuidTextSchema` | `packages/protocol/src/schema-codec.ts:65-70` | 1-8 | `8 9 a b` | accepted (lowercase only) | any |

The review described the second root as the one that accepts mixed case. The source shows that **neither root enforces lowercase**: the kernel pattern carries the `i` flag. The two roots differ only on nil and max. Lowercase is a separate filter, restated at six TypeScript sites and one SQL helper (see Measurements).

The broad `UuidTextSchema` is a remnant of the Zod migration. The 2026-10-03 amendment to ADR 0001 kept wire formats unchanged, and Zod's `uuid()` accepted nil and max. `schema-boundary-characterization.test.ts:69-78` pins this as "keeps domain identities lowercase and message identities broad".

Three existing rules bear on the choice, and they do not agree:

- **ADR 0001** (amendment 2026-10-03): the kernel may import Effect `Schema` "so identity brands and ordering values have one definition".
- **ADR 0006:45**: store branded UUIDs as lowercase `TEXT`, and validate complete UUID syntax before persistence.
- **`.rpiv/decisions/shared-vocab-union.md`**: when a vocabulary is copied across siblings, the one owner holds the union of every copy. Read literally for this case, the union is the loose root, which accepts nil, max and any case.

The split is not harmless. A value can be accepted at one boundary and refused at the next:

- Conversation rows (`apps/harness/src/conversation/conversation-rows.ts:17-35`) decode `conversationId`, `branchId` and `messageId` with the loose root. The columns they read carry the strict lowercase SQL CHECK (`canonical-schema.ts:584,630,662`).
- `recovery_record_id` is written through the loose root plus a lowercase filter (`canonical-command-repository.ts:135,284`). The recovery owner reads it through the strict root plus a lowercase filter (`canonical-writer-recovery.ts:34-43`). That is one column checked by two rules (L5-03).
- The registration store forges the `ProjectStorageCreateRequestId` brand on the loose root (`registration-confirmation-store.ts:46`). The protocol brands the same value on the strict lowercase root (`project-storage-protocol.ts:19`) (L4-09).
- The 13 workspace brands in `packages/protocol/src/workspace-protocol.ts:11-47`, for example `ConversationId`, use the strict root without the lowercase filter. They accept uppercase text that the SQL CHECK on the same stored column rejects.
- The kernel declares 23 identity types by hand (`workspace-identifiers.ts` 14, `project-storage-identifiers.ts` 9). No code outside the kernel uses them, and they shadow the types the protocol derives from its schemas (L8-01).

## Measurements

These are counts over tracked files at `d2851ca`. They exclude `node_modules`, `out` and `dist`. Literal counts come from one scan: a regex over tracked `ts`, `tsx`, `mjs`, `js`, `json` and `sql` files, with each hit classified against the strict pattern.

**Schema sites**

| What | Count | Where |
|---|---|---|
| UUID regexes in source | 2 | the two roots above |
| UUID regexes in tests (shape assertions on generated ids) | 8 | e2e, integration and renderer tests; v4-only or v1-8 shape checks |
| `UuidTextSchema` (loose) field sites in `packages/protocol` | 28 | registration flow 21, registration 5, envelope `MessageId` 1, conversation `saveId` 1 |
| `UuidTextSchema` (loose) field sites in `apps/harness/src` | 27 | registration stores and journals 20, conversation rows 4, canonical stored identity 1, repository identity 1, private location id 1 |
| `UuidTextSchema` sites in harness tests | 6 | 3 files |
| Strict root without the lowercase filter | 13 | workspace brands |
| Strict root with the lowercase filter | 10 | `ProjectId`, 4 canonical-project brands, 5 storage brands |
| Separate lowercase filters | 6 TypeScript + 1 SQL | `domain-identity-schema.ts:4-8`, `canonical-json.ts:38`, `canonical-command-repository.ts:135`, `project-storage-node-schemas.ts:52`, `canonical-writer-recovery.ts:34`, `canonical-writer-package-smoke-fixture.ts:79`; SQL `storage-schema-constraints.ts:4` (`domainIdentityCheck`) |
| Hand-added nil/max exclusions on `MessageId` | 2 | `canonical-writer-smoke-protocol.ts:52-59`, `canonical-writer-package-smoke-fixture.ts:79-86` |
| Kernel identity type shadows | 23 | 0 consumers outside the kernel |

**Stored data**

- **Columns with the strict SQL CHECK:** 37 identity columns carry `domainIdentityCheck`, which requires length 36, lowercase hex, version 1-8 and variant `8 9 a b`. Of these, 14 are in the application database, 19 in the canonical database and 4 in the runtime database. The CHECK rejects nil and max, because the version digit is neither `0` nor `f`. No row in these columns can hold nil, max or uppercase text.
- **Canonical columns without the CHECK:** 23 identity columns. All are foreign keys to a checked primary key, for example `conversation_messages.conversation_id` and `command_receipts.project_id`.
- **Application columns without the CHECK:** 34 identity columns in registration, observer, trust, reservation, request, publication, list-visibility and upgrade tables. They are guarded only by the TypeScript decode, which is the loose root at most of these sites.
- **Producers:** every production identity comes from `crypto.randomUUID()`. On the desktop that means `harness-supervisor.ts:497` and the renderer save and registration hooks. On the harness it means the `createId` ports wired in `process-bootstrap.ts` and `node-active-project-coordinator.ts`. These ids are lowercase v4. No producer emits nil, max or uppercase text. The repository tracks no `.db` or `.sqlite` file.
- **Conclusion:** no stored row or produced value needs the loose acceptance set. The product is not in production (AGENTS.md), so the only stored data is local development `userData` written by those same producers.

**Fixtures**

There are 991 UUID literals in 128 tracked files:

| Class | Count | Notes |
|---|---|---|
| lowercase, versions 1-8 | 920 | valid under every option |
| nil | 30 | 3 are Drizzle's own snapshot `prevId` (not ours), 2 are in source (the loose regex and the smoke exclusion), 25 are test rows |
| max | 14 | 2 in source, 12 test rows |
| uppercase | 22 | all test rows |
| bad version or variant | 5 | all rejection rows |

- **Acceptance pins on nil, max or uppercase: 6, all on `MessageId`.** Three are `schema-boundary-characterization.test.ts:73,74,76`. Three are the `preserves legacy MessageId acceptance` table at `canonical-writer-smoke-protocol.test.ts:282` (nil, max, uppercase). Every other nil, max or uppercase literal sits in a rejection row.
- **Issue texts pinned by tests: 2 distinct messages.** These are `Identity must use lowercase UUID text.` and `Project identity must use lowercase UUID text.`, pinned at `project-storage-protocol.test.ts:129,137` and `canonical-project-protocol.test.ts:282-283`. They come from the separate lowercase filter, which reports code `custom`. Structural failures report `invalid_format` from the pattern.
- **Why the issue texts matter (precedent `43bc303`):** that 2026-10-07 change re-checked 231 pinned fixtures across 56 files. It nearly lost a distinct busy text.

## Options

### A. Strict kernel root everywhere

- **Shape:** one identity text root, `DomainIdentityTextSchema` in the kernel. It accepts versions 1-8 and variant `8 9 a b`, and rejects nil and max. Lowercase is a named filter in the kernel that keeps today's two messages and the `custom` code, through the existing message factory. Every protocol and harness identity, `MessageId` included, decodes through root plus lowercase. `UuidTextSchema` is deleted.
- **Stored rows:** none change. The 37 checked columns already hold only strict values. The 34 unchecked application columns hold `randomUUID` output. A row that broke the rule (none can be produced) would fail its decode visibly, as today's corrupt or broken classification (degrade-distinguishes-broken), never silently.
- **Fixtures:**
  - The 6 `MessageId` acceptance pins flip to rejection. The `schema-boundary-characterization` test is renamed so that message identities are as strict as domain identities.
  - No rejection row flips, because A only narrows what is accepted.
  - The two pinned lowercase texts stay, because lowercase keeps its own filter. A field that moves from the loose root to the strict root also keeps its pattern code `invalid_format`.
  - The two hand-added nil/max exclusions become redundant and are removed.
- **Wire:** the acceptance set narrows for 28 protocol field sites: `MessageId`, `saveId` and 26 registration ids. That needs a protocol version bump (see Protocol Version).
- **Rules:** ADR 0001 and ADR 0006:45 hold. shared-vocab-union holds once it is read as below (Reconciling The Two Rules).

### B. Union root, loose

- **Shape:** one root equal to today's `UuidTextSchema`: nil, max and any case accepted. Lowercase stays a separate filter where storage needs it.
- **Stored rows:** none change. But a nil or max id that passes the protocol decode then fails the SQL CHECK at insert. That is a constraint error at the storage layer, today classified as an internal failure rather than as invalid input. The protocol and the SQL schema would disagree by design.
- **Fixtures:** the strict brands loosen, so the nil and max rejection rows against them flip to acceptance. Most of the 37 nil and max test rows (25 nil plus 12 max) target those brands; this was not counted row by row. Each needs rewriting, or the brand keeps a local nil/max filter, which recreates the second root under another name.
- **Wire:** acceptance widens, so a protocol bump is still needed.
- **Rules:** this follows shared-vocab-union literally. It contradicts ADR 0001 (one strict definition) and ADR 0006:45 (validate complete UUID syntax before persistence).

### C. Strict root plus an explicit legacy-accepting decode

- **Shape:** as A for every domain and stored identity. One named transport-only schema, `LegacyMessageIdTextSchema` in `packages/protocol` (today's broad acceptance), stays for the envelope `messageId` and `causationId` only. It carries a removal trigger.
- **Stored rows:** as A. Measurement shows no stored column needs a legacy reader. No legacy decode for stored rows is proposed, because it would have no data to serve.
- **Fixtures:** the 6 `MessageId` pins and the characterization test stay as they are. The two hand-added smoke exclusions stay.
- **Wire:** the registration and `saveId` sites still narrow, so a protocol bump is still needed. C avoids the bump only if the legacy schema also covers those 27 fields, which would keep the loose root as the de facto root.
- **Rules:** this keeps two roots, now with names. It is honest, but it postpones the IX-3 fix rather than closing it.

## Reconciling The Two Rules

shared-vocab-union protects a consumer from silently losing a token when copies of one vocabulary merge. Here the copies are not drifted versions of one intent. The loose root is a migration remnant that no producer and no stored row needs (Measurements). This ADR therefore reads the union rule as applying to the **diagnostic vocabulary**, not to the acceptance set:

- every distinct issue code and message survives the merge: `invalid_format`, `custom`, and both lowercase messages;
- the acceptance set is decided once, by this ADR.

Pedro confirmed this reading (Decisions, D1). It should be added to the decision file's History so that later extractions do not reopen it.

## Casing

- **Store lowercase.** This is already decided by ADR 0006:45 and enforced by the SQL CHECK on 37 columns.
- **Accept uppercase on input?** Recommended: no. Reject it with the existing lowercase filter and its message. Do not normalize it, because normalizing would change decoded values: canonical JSON fingerprints and idempotency keys are computed from decoded values, and ADR 0001 keeps the decoded wire form unchanged. Every producer already emits lowercase.
- **Where the rule lives:** the kernel root keeps its case-insensitive pattern, so that structure and case report distinct codes. Lowercase is one kernel filter, not six copies.

## MessageId And Conversation Rows

- **`MessageId`** (`packages/protocol/src/protocol.ts:89`) is the envelope correlation id for `messageId` and `causationId`. It is not a stored identity.
  - Under A it becomes strict lowercase. Desktop and harness both generate it with `randomUUID()`, so no live message changes.
  - The writer-proof smoke's own nil/max exclusion (`smokeMessageIdSchema`) becomes the root's behavior.
- **Conversation rows** (`conversation-rows.ts`) move to the strict lowercase root under every option except B. The SQL CHECK already guarantees the stored values, so the move has no data risk. It closes the read-looser-than-storage gap.
- **`saveId`** (`project-conversation-protocol.ts:136`) moves with them.

## Protocol Version

The exact-version handshake (`protocolVersion = 8`, `packages/protocol/src/protocol.ts:87`) means desktop and harness always ship together. A narrowed acceptance set is still a change to the wire contract, so it is marked by a version.

Phase 2 already needs one bump for the registration brand exports and the `consentId` split (L4-10). This ADR's narrowing should ride on that same bump to version 9, not on a separate one. The version bump and the fixture re-check happen in one slice, which keeps every distinct diagnostic row, per the `43bc303` lesson.

## Brand Ownership

- **Recommended:** the kernel owns the identity text root and the lowercase filter, which are pure `Schema` values and allowed there by ADR 0001. `packages/protocol` owns every branded identity schema, and types derive from those schemas (`typeof X.Type`, AGENTS.md).
- **Kernel shadows:** the kernel deletes its 23 unused identity type shadows. It keeps `isDomainIdentity`, now meaning strict lowercase, which harness uses at 2 sites. Numeric kernel brands such as `WorkspaceProjectionRevision` are unaffected.
- **Harness brands:** the harness stops declaring brands that the protocol owns. This covers the 4 registration brands declared twice and the forged `ProjectStorageCreateRequestId` (L4-09, L4-10). The 9 harness-only registration brands move onto the strict root.
- **L8-02:** the model text for the kernel ("domain types") is corrected in Phase 1 and is consistent with this split.

## Recommendation

Choose **A**, with these parts:

- the kernel's strict root and a kernel lowercase filter;
- `UuidTextSchema` deleted;
- `MessageId` tightened, with the 6 acceptance pins flipped;
- uppercase rejected, not normalized;
- the protocol owning the brands;
- the 23 kernel shadows deleted;
- the narrowing carried on the single Phase 2 protocol bump to version 9.

Measurement shows nothing that is stored, produced or pinned depends on the loose set, apart from the 6 characterization rows that describe it. A closes IX-3 in one place. B makes the protocol accept what storage rejects. C keeps two roots and does not even avoid the bump.

Deferred, with a trigger: adding the SQL `domainIdentityCheck` to the 34 unchecked application-database identity columns. That is an on-disk migration. The decode guards those columns once A lands. Trigger: the next application-schema migration, or any finding of a non-strict value in those tables.

## Consequences

With A accepted:

- One identity text root and one lowercase filter exist. Every identity brand has one definition in `packages/protocol`.
- About 55 loose field sites move to the strict root (28 protocol, 27 harness), plus 6 test sites. These are mechanical edits in Phase 2.
- 6 pinned acceptance rows flip, and one characterization test is renamed. No rejection row changes verdict. Both pinned lowercase messages survive.
- The protocol goes to version 9 together with the rest of Phase 2.
- shared-vocab-union gains the clarification that it governs diagnostic vocabulary, not acceptance sets that this ADR decides.

## Rejected Alternatives

These are rejected by the Decisions below:

- **B:** contradicts ADR 0001 and ADR 0006:45, and makes protocol and SQL disagree on purpose.
- **C:** keeps the second root with a name, while no measured consumer needs it.
- **Normalize uppercase to lowercase on decode:** changes decoded values and therefore fingerprints, and no producer emits uppercase.
- **Make the kernel pattern lowercase-only:** it would fold the case failure into `invalid_format`, which loses the two pinned `custom` messages (the `43bc303` lesson).

## Decisions

Decided by Pedro Mesquita on 2026-10-24 and confirmed by the coordinator directly with the user. Each answer resolves the open question with the same number.

- **D1 (Q1): option A.** The identity text root is the kernel's strict root. Pedro also confirmed how shared-vocab-union applies here: it governs the diagnostic vocabulary (every distinct issue code and message is kept), not acceptance sets.
- **D2 (Q2): `MessageId` is tightened in Phase 2.** It rejects nil, max and uppercase text. The 6 pinned acceptance rows flip to rejection, and the characterization test is renamed.
- **D3 (Q3): uppercase is rejected at every boundary.** It is not normalized to lowercase.
- **D4 (Q4): the protocol owns every branded identity schema.** The kernel keeps only the identity text root, the lowercase filter and the numeric brands. Its 23 identity type shadows are deleted.
- **D5 (Q5): the SQL CHECK on the 34 unchecked application-database identity columns is deferred** to the next application-schema migration. Until then, it is a named residual: those columns are guarded only by the strict decode.
- **D6 (Q6): one protocol version bump to 9, shared with the rest of Phase 2.**

## Open Questions (resolved by the Decisions above)

1. **Option:** A (recommended), B or C? With A, does Pedro confirm the reading that shared-vocab-union governs diagnostic vocabulary, not acceptance sets?
2. **`MessageId`:** tighten it in Phase 2, rejecting nil, max and uppercase and flipping the 6 pinned acceptance rows (recommended)? Or keep it broad under C's named legacy schema?
3. **Casing:** reject uppercase at every boundary with no normalization (recommended)? Or accept uppercase and store it lowercased?
4. **Brand ownership:** protocol owns the branded schemas, the kernel keeps only the root, the lowercase filter and the numeric brands, and the 23 shadows are deleted (recommended)? Or should the kernel own every identity schema, with the protocol re-exporting them?
5. **SQL CHECK on the 34 unchecked application-database identity columns:** defer to the next application-schema migration (recommended), or add the migration in Phase 2?
6. **Protocol version:** one bump to version 9 shared with the rest of Phase 2 (recommended), or a separate bump for this ADR alone?

## References

- `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md`: IX-3, T2, Phase 2, L7-03, L5-03, L4-09, L4-10, L8-01, L8-02, L5-07
- ADR 0001 Repository Foundation: Amendment 2026-10-03
- ADR 0006 Physical Persistence Layout, line 45
- `.rpiv/decisions/shared-vocab-union.md`, `.rpiv/decisions/degrade-distinguishes-broken.md`
- Precedent commit `43bc303` (2026-10-07, 56 files, 231 fixtures re-checked)
