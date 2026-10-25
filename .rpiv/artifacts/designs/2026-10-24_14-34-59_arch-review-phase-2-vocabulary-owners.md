---
date: 2026-10-24T14:34:59+0100
author: Pedro Mesquita
commit: d2851ca
branch: main
repository: slopstop
topic: "Architecture review Phase 2, vocabulary owners: L7-03, L7-04, L7-05, L7-01, L7-06, L7-07, L4-09, L4-10, L5-03, L8-01, L4-05"
tags: [design, architecture-review, polish, identity, uuid, protocol-version, utc-instant, sha256, registration, kernel]
parent: .rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md
lane: normal
lane_reasons: ["no upstream lane", "s1 lane.mjs --paths: files: 12 > 5"]
status: in-review
last_updated: 2026-10-25T01:30:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Follow-up: p2-s7 user-decided amendment (type alias only, no StorageOperationIdSchema)."
content_hash: 2d6abe4ae693fb8dc718b54ab09d68a59588cf3a3041a243fc47e4e2ee536941
---

# Design: Architecture review Phase 2, vocabulary owners

The feature lane is **normal**. The parent review carries no lane, so the "no upstream lane" default applies.

- **s1:** `lane.mjs --paths` over the 20 planned paths answers `normal` (`files: 12 > 5`; the weak word `schema` appears in three paths).
- **What normal means here:** a linked worktree, no intent review (Pedro, §144: proportional process), slice-verifier at candidate review with **one** candidate review round, a full deep review, and Pedro's acceptance of the combined result.

## Intent

**Outcome.** Each shared vocabulary gets one owner:
- identity text;
- the UTC instant;
- SHA-256 hex;
- the registry-broken codes;
- the writer release codes;
- the storage operation id.

With one owner, a value accepted at one boundary is never refused at the next, and a renamed code cannot leave a stale copy that still compiles. The identity owner is settled by **ADR 0023** (`docs/adr/0023-one-strict-identity-text-root.md`, Accepted 2026-10-24, D1-D6). This brief applies it and schedules the other ten findings.

**Scope.** The eleven Phase 2 findings:
- **Identity:** L7-03, L5-03, L4-09, L4-10 and L8-01, all governed by ADR 0023.
- **UTC instant and clock:** L7-04 and L4-05.
- **SHA-256 hex:** L7-05.
- **Code tuples:** L7-01 and L7-06.
- **Storage operation id:** L7-07.

**Non-goals.**
- **L5-07:** the `writer_recovery_records` insert owner. It is an IX-3 constituent but not in the Phase 2 list; it belongs to Phase 3 cohesion.
- **The SQL CHECK on the 34 unchecked application-database identity columns:** ADR 0023 D5 keeps it as a named residual until the next application-schema migration.
- **No normalization of uppercase identities** (D3).
- **No change to stored rows.** Measurement shows every stored identity already satisfies the strict rule (ADR 0023, Measurements).

**Constraints.**
- **One protocol bump, to `protocolVersion` 9** (D6). It lands in s1, the first slice that narrows the wire. Later Phase 2 slices that change the wire (the `consentId` split, the Z-only `sentAt`) amend version 9 before integration. The product is unreleased and Phase 2 integrates once, so no build ever ships two different version-9 contracts.
- **Every distinct issue code and message survives** (D1 reading of shared-vocab-union; precedent `43bc303`, which re-checked 231 fixtures and nearly lost a distinct busy text). Each slice lists the texts it must keep as pins.
- **AGENTS.md:**
  - the kernel holds only pure `Schema`, `Brand` and `Data` values;
  - types derive from schemas;
  - untrusted input is decoded with `decodeStrict`;
  - new cross-package imports use declared package exports.

## Architecture

### Identity (ADR 0023)

| Owner | Holds |
|---|---|
| `packages/kernel` (`workspace-identifiers.ts`) | the identity text root (`DomainIdentityTextSchema`: versions 1-8, variant `8 9 a b`, nil and max rejected, case-insensitive pattern so structure fails as `invalid_format`), the lowercase filter and its message factory (moved from `packages/protocol/src/domain-identity-schema.ts:4-8`), `isDomainIdentity` meaning root plus lowercase, and the numeric brands |
| `packages/protocol` | every branded identity schema, now including the registration brands it keeps private today (`project-registration-protocol.ts:10-12,27`) and `MessageId`; `LowercaseDomainIdentityTextSchema` stays a protocol export, re-exported from the kernel, so its consumers do not move |
| `apps/harness` | no identity brand that the protocol owns; its 9 harness-only registration brands sit on the strict root |

The two slices:

- **s1 (protocol and kernel):** every protocol field moves to root plus lowercase, `protocolVersion` goes to 9, and the 23 kernel shadows are deleted.
  - In scope: the 13 workspace brands (`workspace-protocol.ts:11-47`), the 26 registration and flow ids, `MessageId` (`protocol.ts:89`) and `saveId` (`project-conversation-protocol.ts:136`).
  - `UuidTextSchema` stays exported for the harness consumers only, so the tree still builds and the harness stays as loose as it is today.
  - The smoke's hand-added nil/max exclusion (`canonical-writer-smoke-protocol.ts:52-59`) becomes redundant and is removed.
- **s2 (harness consumers):** the 27 harness sites and 6 harness test sites move to the strict root. Harness brands that the protocol owns are imported instead of re-declared (L4-09, L4-10). `UuidTextSchema` is deleted (L7-03), and `recovery_record_id` gets one validator (L5-03).

### Later owners (outlines; detailed when their slice is next)

- **UTC instant (L7-04):** one protocol `UtcInstantSchema` with one seconds policy plus `normalizedUtc`, used by the envelope `sentAt` (`protocol.ts:92`, today any offset) and by every stored timestamp. Sites: `canonical-project-protocol.ts:47`, `canonical-command-ledger.ts:36`, `project-storage-node-schemas.ts:49` and others, 7-9 in total.
- **Clock (L4-05):** one UTC clock per process, injected through the composition root. It replaces the 15 inline `new Date().toISOString()` reads in `apps/harness/src/registration` and the 4 duplicate clock adapters.
- **SHA-256 (L7-05):** one protocol `Sha256HexSchema` in `schema-codec.ts` and one Node `sha256Text` adapter in the harness, replacing 9 definitions.
- **Code tuples (L7-01, L7-06):**
  - one exported `RegistryBrokenCodes` tuple and schema next to `RegistryPendingRecoverySchema`, consumed by the protocol results and by the two renderer `Set<string>` copies (`add-repository-button.tsx:7`, `use-remove-from-list.ts:31`);
  - one writer release-code tuple, with the harness unions written as `Extract` of it.
- **Storage operation id (L7-07):** a named protocol brand or alias for `upgradeId`, `storageOperationId` and `backupId`, which today borrow `ProjectStorageCreateRequestId`.

## Decisions

- **D1-D6 are inherited from ADR 0023 and are not re-asked.** In short:
  - A: one strict kernel root;
  - the shared-vocab-union reading;
  - `MessageId` tightened, with its 6 acceptance pins flipped;
  - uppercase rejected, not normalized;
  - the protocol owns the brands and the 23 shadows are deleted;
  - the SQL CHECK is deferred as a residual;
  - one bump to 9.
- **Identity is split into s1 (protocol and kernel) and s2 (harness).** Rejected: one identity slice. It would touch about 60 sites across three packages, more than one review round can hold. The intermediate state after s1 is coherent: the harness is still exactly as loose as today, and its decodes stay a superset of the protocol's, so no value accepted today is refused by the harness.
- **The protocol bump lands in s1.** Later wire changes amend version 9 before the single integration (see Constraints). Rejected: bumping in the last slice. That would leave s1's narrowed wire under version 8 between slices.
- **The kernel root keeps its case-insensitive pattern, with lowercase as a separate filter** (ADR 0023, Casing). This keeps `invalid_format` for structure and `custom` with the two pinned messages for case.
- **Slice order after identity:** UTC instant, clock, SHA-256, code tuples, storage operation id. The UTC and clock slices share the UTC owner. The last three are independent and small.

## Next Slice

### Slice p2-s1-identity-protocol-root (detailed 2026-10-24)

- **`slice_id`:** `p2-s1-identity-protocol-root`. Lane: **normal** (`lane.mjs --paths`, "files: 12 > 5").
- **Findings:** L7-03 (protocol half), L4-10 (brand exports), L8-01. ADR 0023 D1-D4 and D6.
- **Base:** main after the ADR 0023 commit (`d2851ca` or its child that holds the ADR).
- **Deliverable:**
  - the kernel lowercase filter and the strict `isDomainIdentity`;
  - every protocol identity on root plus lowercase;
  - the registration brands exported;
  - `MessageId` strict;
  - `protocolVersion` 9;
  - the 23 kernel shadow types deleted;
  - the smoke's nil/max exclusion removed.
- **Source paths:**
  - `packages/kernel/src/{workspace-identifiers,project-storage-identifiers,index}.ts`
  - `packages/protocol/src/{domain-identity-schema,protocol,workspace-protocol,project-registration-protocol,project-registration-flow-protocol,project-conversation-protocol,canonical-writer-smoke-protocol,index}.ts`
- **Test paths:**
  - `packages/kernel/src/workspace-identifiers.test.ts`
  - `packages/protocol/src/{schema-boundary-characterization,canonical-writer-smoke-protocol,protocol,workspace-protocol,project-conversation-protocol}.test.ts`
  - new `packages/protocol/src/project-registration-protocol.test.ts`
- **Version literals:** the `protocolVersion: 8` literals move to 9 in 11 test files, about 30 sites, with no other assertion change. Six are protocol test files; the others are `apps/harness/src/harness-runtime.test.ts`, four harness integration files or fixtures, and `apps/desktop/src/main/canonical-writer-package-smoke-test-peers.ts`.
- **Dependencies:** none beyond the base.

### Test Contract: p2-s1-identity-protocol-root

Public seams:
- the kernel package exports;
- the protocol package exports: the branded schemas through `decodeStrict` and `decodeWithIssues`, and the envelope parsers `parseDesktopMessage` and `parseHarnessMessage`, which is the AGENTS.md protocol parse foundation seam.

Fixture values: valid lowercase v7 `018f47a3-4e3d-7d2b-9c41-7df4605c0a11`, nil `00000000-0000-0000-0000-000000000000`, max `ffffffff-ffff-ffff-ffff-ffffffffffff`, uppercase is the valid value `.toUpperCase()`, bad version `018f47a3-4e3d-0d2b-9c41-7df4605c0a11`.

- **Behavior P2-B1 (L7-03, D3):** the kernel recognizes only strict lowercase identities.
  - Test: `recognizes only boundary-safe identities and revisions` in `workspace-identifiers.test.ts`, extended.
    - `isDomainIdentity` is `true` for valid lowercase.
    - It is `false` for nil, max, uppercase, bad version, `"not-a-uuid"` and a non-string.
    - The kernel's exported lowercase schema reports the uppercase value with exactly `[{ code: "custom", path: [], message: "Identity must use lowercase UUID text." }]`.
  - Expected red: `isDomainIdentity(uppercase)` answers `true` (the `/iu` pattern), and the kernel exports no lowercase schema.
- **Behavior P2-B2 (D2):** a message identity is as strict as a domain identity.
  - Test: `keeps domain and message identities strict and lowercase` in `schema-boundary-characterization.test.ts`. It replaces `keeps domain identities lowercase and message identities broad`.
    - `MessageIdSchema` rejects nil, max, uppercase max and uppercase v7.
    - It accepts valid lowercase.
    - Uppercase v7 reports the `custom` lowercase message; nil and max report `invalid_format`.
  - Test: `rejects a non-strict MessageId (%s)` in `canonical-writer-smoke-protocol.test.ts`, over nil, max and the uppercase `ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF`. It replaces `preserves legacy MessageId acceptance %s`.
  - Test: an envelope with `messageId` nil, through `parseDesktopMessage`, answers `ok: false` with `error.code` `PROTOCOL_MESSAGE_INVALID` and an issue at path `messageId` (in `protocol.test.ts`).
  - Expected red: the 6 acceptance rows decode successfully today (`schema-boundary-characterization.test.ts:73,74,76`; `canonical-writer-smoke-protocol.test.ts:282`), and the nil envelope parses `ok: true`.
- **Behavior P2-B3 (L7-03):** workspace identities refuse uppercase.
  - Test: `rejects an uppercase workspace identity (%s)` in `workspace-protocol.test.ts`, `it.each` over the 13 workspace brand schemas.
    - Valid lowercase decodes.
    - Uppercase fails with exactly the `custom` lowercase issue.
    - Nil fails.
  - Expected red: uppercase decodes today (`DomainIdentityTextSchema` without the lowercase filter).
- **Behavior P2-B4 (L7-03, L4-10):** registration, flow and conversation-save ids are strict, and the registration brands are exported.
  - Test: `rejects a non-strict registration identity (%s)` in the new `project-registration-protocol.test.ts`, `it.each` over every UUID field of:
    - `RendererRegistrationRequestSchema`, every step;
    - `ProjectRegistrationRequestSchema`;
    - `InitialRepositoryBindingSchema`;
    - `RegisteredProjectSchema`.
    - Oracle: for each field, a valid request decodes; nil, max and uppercase each fail at that field's path.
  - Test: the exported `RepositoryBindingIdSchema`, `WorkspaceIdSchema`, `RegistrationRequestIdSchema` and `RegistrationProposalIdSchema` each accept valid lowercase and reject nil.
  - Test: `rejects a non-strict save id (%s)` in `project-conversation-protocol.test.ts`. `ProjectConversationSaveRequestSchema` with `saveId` nil, max or uppercase fails at `saveId`.
  - Expected red: nil, max and uppercase decode today (`UuidTextSchema`), and the four brand schemas are not exported (import fails).
- **Behavior P2-B5 (D6):** a version-8 peer is refused as an unsupported version.
  - Test: in `protocol.test.ts`:
    - `protocolVersion` equals 9;
    - `parseHarnessMessage` of a version-8 request failure answers `{ ok: false, error: { code: "PROTOCOL_VERSION_UNSUPPORTED", issues: [{ code: "unsupported_value", path: "protocolVersion" }] } }`;
    - the same for `parseDesktopMessage` of a version-8 command.
  - Expected red: version 8 is the current version, so it parses.
- **Behavior P2-B6 (D1, the 43bc303 lesson):** every distinct identity issue text survives.
  - Tests:
    - `project-storage-protocol.test.ts:120-140`, both messages and the storage and project identity rows;
    - `canonical-project-protocol.test.ts:282-283`;
    - the writer-proof smoke's `invalidMessageIds` and `invalidIdentities` rejection rows (`canonical-writer-smoke-protocol.test.ts:38-39`), which now hold through the root instead of the removed exclusion.
  - Expected red: none, pin.
- **TDD-exempt:** deleting the 23 kernel identity type shadows (`workspace-identifiers.ts:13-26`, `project-storage-identifiers.ts:4-12`) and their `index.ts` exports. Reason: these are type-only declarations with zero consumers outside the kernel (`rg` at `d2851ca`: harness imports only `isDomainIdentity` from the kernel, protocol imports only the root and the numeric brands). No runtime behavior exists to test. The oracle is `pnpm typecheck` plus Knip in `pnpm check`.

### Success Criteria: p2-s1-identity-protocol-root

- Red then green for P2-B1 to P2-B5 with the smallest Vitest command (`pnpm vitest run <file>` per package), then `pnpm check`. P2-B6 is green before and after.
- The ~30 version literals move to 9 in the same slice. Their unit files run in `pnpm check`. The integration files run once at the candidate, with the coordinator's GO: `harness-runtime.integration.test.ts` and `canonical-project-activation.integration.test.ts`, which are the envelope surface. The rest run in `check:deep` before the push.
- **Bindings,** each restored by digest:
  - restoring nil/max acceptance on `MessageIdSchema` makes P2-B2 fail;
  - removing the lowercase filter from one workspace brand makes its P2-B3 row fail;
  - putting `UuidTextSchema` back on one flow field makes its P2-B4 row fail.
- `rg "UuidTextSchema" packages/protocol/src` finds only its definition and export.
- CodeScene `code_health_score` on every changed source file (target 10).

## Deferred Work

Each item below becomes the next slice in this order. Its contract is written when it is next. Behavior IDs continue from P2-B7.

- **p2-s2-identity-harness-consumers** (L7-03 harness half, L5-03, L4-09, L4-10 harness dedupe):
  - the 27 harness and 6 harness-test `UuidTextSchema` sites move to the strict root;
  - `conversation-rows.ts` reads with the protocol brands;
  - one `recovery_record_id` validator;
  - the harness imports the four protocol registration brands;
  - `UuidTextSchema` is deleted;
  - the five local lowercase filters (`canonical-json.ts:38`, `canonical-command-repository.ts:135`, `project-storage-node-schemas.ts:52`, `canonical-writer-recovery.ts:34`, `canonical-writer-package-smoke-fixture.ts:79`) become the kernel filter.
  - Pins: the `Identity must use lowercase UUID text.` message at `project-storage-node-schemas.ts:54`, and the registry corrupt classification of a non-strict stored id.
  - Dependency: s1.
  - Heavy runs: the registration and conversation integration files it touches, once at the candidate.
- **The `consentId` split** (L4-10 remediation 2), which changes the wire on version 9:
  - **Open question for Pedro before it is detailed:** which consent the `PreparationFields.consentId` carries (`project-registration-flow-protocol.ts:18`), next to the git-version step (`:38`) and the identity-query step (`:45`).
  - Trigger: s2 accepted. It may fold into s2 if the answer is a pure rename.
- **p2-s3-utc-instant-owner** (L7-04):
  - **Open question for Pedro:** the seconds policy of the one UTC schema: seconds required with milliseconds (what every producer writes, `toISOString`), or seconds optional.
  - Also: whether the envelope `sentAt` becomes Z-only, as the finding asks. That is a wire change on version 9.
  - Pins: every distinct UTC message, including `UTC instant must end in Z.` (`project-storage-node-schemas.ts:50`).
- **p2-s4-registration-clock** (L4-05): one injected UTC clock. Tests use a fixed clock, not real time (AGENTS.md TestClock rule). Dependency: s3, which owns the instant type the clock returns.
- **p2-s5-sha256-owner** (L7-05):
  - one protocol `Sha256HexSchema` and one Node adapter;
  - the stored proposal fingerprint gains the format check, which is safe because every stored value is `sha256` output;
  - **open question:** whether to keep the `[a-f0-9]` and `[0-9a-f]` variants as one class. They are the same set; prove identity first, per shared-vocab-union.
- **p2-s6-code-tuples** (L7-01, L7-06):
  - the registry-broken tuple consumed by the protocol and by the two renderer gates;
  - the writer release-code tuple with `Extract` unions.
  - Pins: every code and message row in the renderer gating tests and the activation diagnostics.
- **p2-s7-storage-operation-id** (L7-07):
  - a named brand or alias.
  - **Open question:** a new brand, which separates the three ids at the type level and changes the wire only by name, or an exported alias, which has no wire effect.

## Verification Notes

- **Measurements** are in ADR 0023 (main `d2851ca`). The key facts for s1:
  - the 6 acceptance pins are all on `MessageId`;
  - no rejection row flips under a narrowing;
  - 2 distinct lowercase messages are pinned;
  - the kernel pattern has the `i` flag, which is why `isDomainIdentity` accepts uppercase today.
- **Risk:** a test outside the measured set builds a `MessageId` from a non-strict literal. The census found none. All 920 valid literals are lowercase v1-8, and the desktop and harness use `randomUUID()`. A missed site fails loudly at decode, never silently.
- **Risk:** desktop tests that build envelopes with the literal `protocolVersion: 8` fail after the bump until they are updated. The slice updates all ~30 literals; `rg "protocolVersion: 8"` must find none at the candidate.
- **Baseline:** Phase 1 landed (`4dbd834`). The coverage-on-Windows CI decision (`2806143`, `d2851ca`) does not affect these paths.

## Developer Context

- **2026-10-24:** the brief was drafted from the coordinator's assignment (Pedro chose Phase 2 next; decisions log §144) after ADR 0023 was accepted with D1-D6, which Pedro decided and the coordinator confirmed directly with AskUserQuestion. The intent of this brief is not yet approved.
- **Approach check:** not run. Pedro prefers a proportional process, as in Phase 1. The rejected options are grounded in ADR 0023's measurements, taken today at `d2851ca`.
- **2026-10-24, s1 implementation (Pedro, confirmed by the coordinator with AskUserQuestion):**
  - **8 MessageId acceptance pins flip, not 6.** The ADR 0023 census counted literals and missed two rows in `canonical-writer-smoke-protocol.test.ts` that use the constant `uppercaseMessageId`: "retains valid uppercase MessageId spelling" (11 closed-envelope fixtures) and "retains valid uppercase requestId spelling" (10 correlation fixtures). Both become rejection rows, "rejects uppercase MessageId spelling" and "rejects uppercase requestId spelling", consistent with D2 and D3.
  - **Accepted text removal:** removing the smoke nil/max exclusion drops the message `Writer proof correlation must use a non-NIL, non-MAX message identity.`. No test pinned it. Nil and max are still rejected there through the root, with code `invalid_format`.
- **2026-10-24, s1 preflight (coordinator decision, technical triage disclosed to Pedro):** the slice preflight on `c9e5cb1..16a6ba5` reported 6 findings. All 6 are accepted as reference-format false positives:
  - 5 `missing-test-file` rows: the behavior lines cite bare filenames, and the helper reads them as repo-root paths. All 5 files exist at `16a6ba5`, under `packages/kernel/src` and `packages/protocol/src`.
  - `no-test-line: P2-B6`: its line reads "Tests:" with sub-bullets.
  - The 4 `unchecked` rows (the P2-B2 envelope row, the two P2-B4 rows, and P2-B5) go to the slice-verifier as explicit review focus.
- **2026-10-24, s1 slice-verifier V1 (coordinator decision, technical triage disclosed to Pedro):** this corrects the Decisions claim that after s1 "the harness is still exactly as loose as today … no value accepted today is refused by the harness".
  - Harness joins that decode harness-stored or harness-built ids through protocol schemas already tighten in s1:
    - `registration-confirmation-store.ts:346,371,414`: `readPublication` reports `REGISTRY_CORRUPT` for a non-strict stored id;
    - `registration-storage-bootstrap.ts:85,206`: the decode fails before the SQL CHECK;
    - `project-registration-flow.ts:211-212`: the result becomes `internalFailure`.
  - These paths are unreachable today, because every producer uses `randomUUID`. They fail visibly, never silently.
  - The s2 pin "registry corrupt classification of a non-strict stored id" covers them.

- **2026-10-24, s2 slice-verifier round 1 (coordinator decision, technical triage disclosed to Pedro; one review round only, so the fix delta goes to the combined acceptance):** the round on `b109386` failed on V1 (the harness's last two `@slopstop/kernel` imports were removed, but the dependency, the `model.c4` edge and the ADR 0023 count were left behind) and V2 (the evidence claimed Knip ran inside `pnpm check`; it does not, and Knip is `pnpm check:dead-code`). Both are fixed in the s2 fix commit. The three warnings are recorded here:
  - **V3, P2-B7 row-set amendment:** the contract's "`reservation_id` row value uppercase" and "the record's `reservationId` uppercase" rows are one row, `reservationId uppercase`, that changes both. The record-only variant is reachable through the fake, but `readReservation`'s agreement check (`record.reservationId === id`) already refuses it at base, so it can never be red. The merged row still proves the record field's rule, because the row schema reuses `reservationSchema.fields.reservationId`.
  - **V4, accepted text removal:** deleting `UuidTextSchema` removes its pattern annotation `expected: "a UUID"`. The sites that used it now report the root's structural annotation with the same code `invalid_format`. No test or caller pins the text. This corrects the ledger line "No project-owned text is removed" without editing it.
  - **V5, named residual for Phase 3:** the new `decodeProposalRecord` and `corruptProposal` (`registration-proposal-store.ts`), and the touched `readReservation` and `findCommonReservation`, still throw `RegistryFault` in Promise-based code that is not migrated to Effect. The registration stores' Effect migration is folded into Phase 3.

- **2026-10-24, p2-s2b slice-verifier round 1 (coordinator decision, technical triage disclosed to Pedro; one review round only):** the round on `be87690` passed with 0 violations and 2 warnings, recorded here.
  - **V1, accepted contract amendments:**
    - **(a) P2-B11 oracle:** "an issue at path `consentId`" cannot hold, because the project vocabulary reports an unknown key at its owning object and names the key. The test pins the exact, stricter issues: `{ code: "unrecognized_keys", path: [], keys: ["consentId"] }` and `{ code: "invalid_type", path: [<new key>] }`.
    - **(b) P2-B12 expected red:** the observed red was a rejected `handle` promise (a defect), not `INTERNAL_FAILURE`. The cause is the one the contract names: the flow read `request.consentId`. The defect comes from a `decodeStrict` that already ran outside `step()` at base; the runtime boundary maps it to `HARNESS_INTERNAL_FAILURE`, which is correct under "defects stay defects".
    - **(c) P2-B14 binding:** "the renderer reusing the git-version consent id" cannot be written literally, because the renderer mints that id inline and keeps no copy. A fresh `randomUUID` in preparation was used instead. The literal mutation would also fail, because the test asserts that the two consents differ and that `prepare` carries the identity-query value.
  - **V2, named scoped residual for L4-10:** the review's acceptance text "No registration brand declared in apps/harness" is not met to the letter. `RegistrationReservationId` (`registration-confirmation-store.ts:46`) stays harness-only, because it never crosses the wire. `InitialRepositoryBindingSchema.reservationId` stays unbranded in the protocol under Q2 (a). This corrects the Q2 (a) line "It meets L4-10's acceptance" without editing it.
  - **Polish, recorded:** the Architecture table's "9 harness-only registration brands" is 8 as measured in s2; the success criterion "`rg -n "consentId" packages/protocol/src apps/desktop/src` finds only the new keys" reads as "no wire sender or schema uses the legacy key", since four refusal and absence asserts name it; and the s1 `decide-git-version` row's consent fixture moved from `id(4)` to `id(17)`, so the two consents differ, with no assertion change.

- **2026-10-24, p2-s3 implementation (coordinator decision, technical triage disclosed to Pedro):**
  - **Settlement stays byte-identical.** Today `CanonicalSettlementTimeSchema` reports its message with code `invalid_format` (its rule is an `isPattern`), and a malformed value reports two issues: the structure and the settlement pattern. The contract's `utcInstant(message)` with `custom` filters would change that code against the message ledger ("no code changes"). Decision (a): `utcInstant(message)` builds the named variant as today's composition (RFC 3339 structure, then one `isPattern` carrying the message, code `invalid_format`, no abort), so the P2-B18 pin holds unchanged. The P2-B18 new row asserts code `invalid_format` with the settlement message.
  - **The default `UtcInstantSchema` follows the brief:** the RFC 3339 structure check aborts, then the `Z` and seconds filters report `custom` with the two default messages.
  - **Accepted amendment, storage malformed-value issue list:** with the abort, a structurally malformed storage or manifest instant now reports one `invalid_format` issue, where today's offset-pattern-plus-`Z`-filter could also add the `Z` issue.
  - **Accepted amendment, writer instants:** `canonicalWriterUtcInstantSchema`'s non-`Z` refusal moves from `invalid_format` (a message-less `isPattern`) to `custom` with `UTC instant must end in Z.`, and a minute-only value now reports the seconds message.
  - **Reader evidence for both amendments:** `rg -n "summarizeSchemaError|schemaIssueLeaves|SchemaIssue|\.issues\b" apps --glob '!**/*.test.*'` finds nothing; `rg -n "SchemaError|isSchemaError" apps --glob '!**/*.test.*'` finds nothing; `rg -n "issue\.code|issues\[|\"custom\"" apps --glob '!**/*.test.*'` finds nothing. The storage, manifest and writer schemas are decoded with `decodeStrict`, whose callers map any failure to their own broken or corrupt code. The only tests that pin these issues are the new P2-B16 rows. The envelope `sentAt` issues go through `parseDesktopMessage`/`parseHarnessMessage` and are pinned by the new P2-B17 rows (code `custom`, path `sentAt`).

- **2026-10-24, p2-s3 slice-verifier round 1 (passed, 2 warnings; coordinator decision: one follow-up commit, no round 2):**
  - **V1, two more issue-shape changes by the same owner rebind (accepted, same reader evidence as above):** the registration `createdAt`, `preparedAt` and `capturedAt` (`registration-confirmation-store.ts`, `registration-proposal-store.ts`, `executable-consent-store.ts`) now refuse an offset instant with `custom` `UTC instant must end in Z.` instead of one `invalid_format`, and an offset instant without seconds reports two `custom` issues; a structurally malformed writer instant (`canonicalWriterUtcInstantSchema`) now reports one `invalid_format` issue instead of two. Their failures map to the stores' corrupt codes; no reader inspects the issues.
  - **V2, equality pin:** the owner and `utcInstant(message)` encode the seconds-and-`Z` rule twice under decision (a). The test-only rows `accepts the same instants as the settlement time (%s)` in `utc-instant.test.ts` assert that `UtcInstantSchema` and `CanonicalSettlementTimeSchema` accept the same values over both row tables, so a later owner change cannot split the `savedAt` read and wire joins silently.
  - **Polish, recorded without change:** `dateTimeCheck`'s `precision` and `Z`-only branches are now unreachable; the `parseHarnessMessage` P2-B17 rows cover the 3 flipped values, not all 6; `conversation-rows.ts` still reads the owner through the ledger alias; the line numbers in the s3 "Today" table are stale after the change.

- **2026-10-24, p2-s4 implementation (coordinator decision (a), technical triage disclosed to Pedro):**
  - **Accepted amendment, one extra production input:** the P2-B20 rows need the full registration flow, and its only driver, `registrationSession()`, goes through `startHarnessProcessRuntime`, whose composition root builds the registration options itself. So `HarnessRuntimeIo` gains an optional `clock?: UtcClock`. `harnessServicesLayer(roots, upgradeLog, clock = systemUtcClock)` provides it as the `ProcessClock` service, which feeds `RegistrationDatabaseOptions.clock` and the runtime's `now` (one clock per process). `process-entry.ts` passes none. `registrationSession` accepts the clock; the restart row uses `createRegistrationRegistry({ ..., clock })` and `reconcileAtStart`.
  - **Pin:** `gives a process started without a clock the system clock` in `process-bootstrap.test.ts` asserts that `harnessServicesLayer` without a clock provides `systemUtcClock`.
  - **Unproven site:** `identity-query-journal.ts` `noDispatch` (settled without a child) runs only on failure paths: an unavailable child, a cancellation, or a revalidation mismatch before dispatch. The P2-B20 flow never reaches it, so that one site is rebound to the clock without its own row.

## References

- `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md`: Phase 2, IX-3, T2, and findings L7-03, L7-04, L7-05, L7-01, L7-06, L7-07, L4-09, L4-10, L5-03, L8-01, L4-05
- `docs/adr/0023-one-strict-identity-text-root.md` (Accepted 2026-10-24)
- `docs/adr/0001-repository-foundation.md` (Amendment 2026-10-03), `docs/adr/0006-physical-persistence-layout.md:45`
- `.rpiv/decisions/shared-vocab-union.md`, `.rpiv/decisions/degrade-distinguishes-broken.md`
- `.rpiv/artifacts/designs/2026-10-23_18-52-05_arch-review-phase-1-correctness-fixes.md` (Phase 1, landed as `4dbd834`)
- Precedent `43bc303` (2026-10-07)
## Follow-up

### 2026-10-24: slice p2-s2-identity-harness-consumers detailed

Added after s1 landed in the worktree (`16a6ba5`, triage `4d50501`). This section holds s2's slice and contract. The Deferred Work entry for s2 is its outline. Measured at `4d50501`.

#### Slice p2-s2-identity-harness-consumers

- **`slice_id`:** `p2-s2-identity-harness-consumers`. Lane: **normal** (`lane.mjs --paths` over the 20 planned paths: "files: 16 > 5"; the weak word `schema` appears in three paths).
- **Findings:** L7-03 (harness half), L5-03, L4-09, L4-10 (harness dedupe). ADR 0023 D1, D3 and D4. The s1 slice-verifier warning V1 (Developer Context) is part of the contract.
- **Base:** `4d50501` on `fix/arch-review-phase-2`.
- **Deliverable:**
  - **Protocol-owned brands imported, never re-declared** (L4-09, L4-10). The harness imports `RegistrationRequestIdSchema`, `RepositoryBindingIdSchema`, `WorkspaceIdSchema`, `ProjectStorageCreateRequestIdSchema` and `RegistrationProposalIdSchema` from `@slopstop/protocol`. Today they are re-declared on `UuidTextSchema` at `registration-confirmation-store.ts:33,44,45,46` and `registration-proposal-store.ts:30`.
  - **Harness-only brands on the strict root.** Measured: 8, not the 9 the review counted:
    - `ExecutableSelectionId`, `ExecutableConsentId` and `VersionObservationId` (`project-registration-observer.ts:6-8`);
    - `IdentityQueryConsentId` (`identity-query-consent.ts:22`);
    - `RegistrationReservationId` (`registration-confirmation-store.ts:42`);
    - `RegistrationPreparationRequestId` (`registration-proposal-store.ts:22`);
    - `RepositorySelectionId` and `RepositoryTrustId` (`repository-trust.ts:26,29`).

    They stay in the harness on `LowercaseDomainIdentityTextSchema`, as the approved Architecture table says. That table differs from L4-10's acceptance text ("No registration brand declared in apps/harness"). Branding them in the protocol pairs with the `consentId` split (see Deferred Work and the question below), because six of them cross the wire unbranded as `PreparationFields`.
  - **Every other harness `UuidTextSchema` site** (the ADR 0023 census counted 27 in harness source) moves to `LowercaseDomainIdentityTextSchema` or a protocol brand. `conversation-rows.ts` reads with `ConversationIdSchema`, `ConversationBranchIdSchema` and `ConversationMessageIdSchema`.
  - **One stored-identity rule** (L5-03, L7-03). The five local lowercase filters are replaced by the protocol `LowercaseDomainIdentityTextSchema`, which is the kernel root plus the kernel filter:
    - `CanonicalStoredIdentitySchema` (`canonical-json.ts:38`) and its extra `isDomainIdentity` check in `canonical-command-registry.ts:25`;
    - `identitySchema` (`canonical-command-repository.ts:135`);
    - `recoveryIdentitySchema` (`canonical-writer-recovery.ts:34`);
    - `privateLocationIdSchema` (`project-storage-node-schemas.ts:52`);
    - the smoke fixture `uuid` (`canonical-writer-package-smoke-fixture.ts:79`), whose hand nil/max exclusion becomes the root, as in s1.

    After this, `recovery_record_id` is written (`canonical-command-repository.ts:284`) and read (`canonical-writer-recovery.ts:43`) through the same schema.
  - **Harness test sites move:** `registration-owner-recovery-fixture.ts:31` and `registration-preparation-lifecycle.integration.test.ts:172-175`.
  - **`UuidTextSchema` is deleted** from `packages/protocol/src/schema-codec.ts:68` and `index.ts:269`.
- **Message ledger** (D1, the 43bc303 lesson):
  - `Identity must use lowercase UUID text.` (`project-storage-node-schemas.ts:54`) is the kernel default message, so it survives unchanged.
  - The other four local filters carry no message of their own; they used Effect's generic filter text. Uppercase there now reports the pinned kernel message.
  - No project-owned text is removed.
- **Source paths:**
  - `packages/protocol/src/{schema-codec,index}.ts`
  - `apps/harness/src/{canonical-json,canonical-command-registry,project-registration-observer}.ts`
  - `apps/harness/src/storage/{canonical-command-repository,canonical-writer-recovery,project-storage-node-schemas}.ts`
  - `apps/harness/src/conversation/conversation-rows.ts`
  - `apps/harness/src/registration/{repository-trust,observer-journal,registration-proposal-store,registration-confirmation-store,identity-query-consent}.ts`
- **Test paths:**
  - `apps/harness/src/registration/registration-confirmation-store.test.ts` (extended);
  - new `apps/harness/src/conversation/conversation-rows.test.ts`;
  - new `apps/harness/src/storage/project-storage-node-schemas.test.ts`;
  - fixtures `apps/harness/tests/integration/{canonical-writer-package-smoke-fixture,registration-owner-recovery-fixture}.ts` and `registration-preparation-lifecycle.integration.test.ts`, with no assertion change.
- **Dependencies:** s1 (`16a6ba5`): the strict protocol brands and the kernel filter.
- **Not in s2:** the `consentId` split and protocol brands for the `PreparationFields` ids (wire changes; see the question below), and the SQL CHECK on the 34 unchecked application columns (D5 residual).

#### Test Contract: p2-s2-identity-harness-consumers

Public seams:
- the registration store's exported readers `findCommonReservation` and `readPublication`, called with a fake transaction as in the existing `registration-confirmation-store.test.ts`, and classified through `registryFailure`;
- the conversation store's exported `selectRows`, called with a fake `ConversationExecutor`;
- the storage node's exported `privateLocationIdSchema`, through `decodeStrictResult`.

Fixture values are those of the s1 contract: valid lowercase v7, nil, max, uppercase as `.toUpperCase()` of the valid value.

- **Behavior P2-B7 (L4-09, L4-10, V1):** the registry refuses a stored reservation that carries a non-strict identity as corrupt.
  - Test: `classifies a stored reservation with a non-strict identity as corrupt (%s)` in `registration-confirmation-store.test.ts`. `it.each` over:
    - the `reservation_id` row value uppercase;
    - the record's `reservationId`, `repositoryBindingId`, `workspaceId`, `createRequestId` and `confirmationPhaseId` each uppercase;
    - `createRequestId` nil.
  - Oracle: `findCommonReservation` rejects, and `registryFailure(rejection)` equals `{ status: "broken", code: "REGISTRY_CORRUPT" }`.
    - The fake answers a row whose key, fingerprint (`digest` of the record) and id agree with the record, so only the identity rule decides.
    - A control row with all identities valid resolves to the record.
  - Expected red: every row resolves today, because `reservationSchema` and `reservationIdRowsSchema` use `UuidTextSchema`. The stored record is JSON, so no SQL CHECK guards these fields.
- **Behavior P2-B8 (V1 pin):** a published receipt with a non-strict stored identity stays corrupt.
  - Test: `classifies a receipt check failure: $name` in `registration-confirmation-store.test.ts`, with new rows:
    - receipt `storageId` uppercase;
    - receipt `generationId` nil;
    - publication-row `requestId` uppercase while the receipt keeps the lowercase value.
  - Oracle: `{ status: "broken", code: "REGISTRY_CORRUPT" }` and `generationReads` 0.
  - Expected red: none. This is a pin: s1 already made `RegisteredProjectSchema` strict, which is the tightening V1 recorded. It must stay green through the s2 rewrite of `publicationRowsSchema`.
- **Behavior P2-B9 (L7-03 harness half):** conversation rows read only strict identities.
  - Test: `treats a stored row with a non-strict identity as broken storage (%s)` in the new `conversation-rows.test.ts`. `it.each` over `ConversationRowSchema.conversationId`, `BranchRowSchema.branchId`, `MessageRowSchema.messageId` and `SavedRowSchema.messageId`, each with nil, max and uppercase.
  - Oracle: `selectRows` fails with a `ConversationStorageBroken`. The same row with a valid lowercase id succeeds and yields that value.
  - Expected red: nil, max and uppercase decode today (`UuidTextSchema`).
- **Behavior P2-B10 (L5-03, the message pin):** a storage location identity follows the one stored-identity rule.
  - Test: `rejects a non-strict private location identity (%s)` in the new `project-storage-node-schemas.test.ts`.
    - `privateLocationIdSchema` rejects nil and max with code `invalid_format`.
    - It rejects uppercase with exactly `[{ code: "custom", path: [], message: "Identity must use lowercase UUID text." }]`.
    - It accepts valid lowercase.
  - Expected red: nil and max decode today. The uppercase row is a pin.
- **TDD-exempt, with a stated oracle:**
  - **Rebinding the 8 harness-only brands, the 5 imported protocol brands, and the four message-less filters** (`canonical-json`, `canonical-command-registry`, `canonical-command-repository`, `canonical-writer-recovery`) to the one schema.
    - Reason: each site becomes the same value P2-B7, P2-B9 and P2-B10 already prove. Their writers decode `randomUUID()` output, and the canonical columns carry the SQL CHECK. A per-site red would repeat the same oracle.
    - Oracle:
      - `rg "UuidTextSchema" apps packages` finds nothing;
      - `rg 'Schema\.brand\("(RegistrationRequestId|RepositoryBindingId|WorkspaceId|ProjectStorageCreateRequestId|RegistrationProposalId)"\)' apps/harness` finds nothing;
      - no `value === value.toLowerCase()` identity filter remains in `apps/harness`;
      - `pnpm typecheck` and Knip in `pnpm check`.
  - **Deleting `UuidTextSchema`.** Reason: export removal with no consumer left. Oracle: as above.

#### Success Criteria: p2-s2-identity-harness-consumers

- Red then green for P2-B7, P2-B9 and P2-B10 (the nil and max rows) with the smallest Vitest command (`pnpm vitest run <file>` in `apps/harness`), then `pnpm check`. P2-B8 and the P2-B10 uppercase row are green before and after.
- **Heavy runs:** once at the candidate, with the coordinator's GO: `registration-preparation-lifecycle.integration.test.ts`, `project-registration.integration.test.ts` and `canonical-command-repository.integration.test.ts`, which cover the reservation, publication and recovery-record paths. The smoke fixture and the other integration files run in `check:deep` before the push.
- **Bindings,** each restored by digest:
  - putting `UuidTextSchema`'s loose rule back on `reservationSchema.repositoryBindingId` makes its P2-B7 row fail;
  - removing the lowercase filter from the conversation message id makes its P2-B9 uppercase row fail;
  - dropping the root from `privateLocationIdSchema` makes its P2-B10 nil row fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Question for the coordinator (s2 does not need it)

The code answers the open `consentId` question:
- **`PreparationFields.consentId` carries the identity-query consent.**
  - The renderer's `prepare` sends `granted.consentId`, the id it minted for `decide-identity-queries` (`use-add-repository.ts:106,204-211`).
  - The harness decodes it as `IdentityQueryConsentId` (`registration-proposal-steps.ts:40` into `RepositoryIdentityAdmissionRequestSchema`, which spreads `IdentityQueryConsentRequestSchema`, `repository-trust.ts:36-37`, `identity-query-consent.ts:22`).
- **The git-version step's `consentId` is a different consent.** It is a fresh id the harness stores as `ExecutableConsentId` (`use-add-repository.ts:180`, `project-registration-observer.ts:7,12`).
- **So the split is a pure rename on the wire.**

Q1. Where does the `consentId` rename land (`identityQueryConsentId` in `PreparationFields` and `decide-identity-queries`; `executableConsentId` in `decide-git-version`)? It amends version 9 and touches the protocol, the renderer and the harness.
- (a) **Recommended:** its own small slice right after s2, which also moves the 6 `PreparationFields` brands into the protocol. This keeps s2 harness-only and keeps one review round. It also meets L4-10's "no registration brand declared in apps/harness" for the ids that cross the wire.
- (b) Fold it into s2. This adds the protocol and renderer files to s2 and grows its review.

### 2026-10-24: s2 approved and Q1 decided (Pedro, confirmed by the coordinator)

- **s2 intent approved** at `content_hash` `b92d447f86bc26cbc58f693d3bd726c43cf0439c6f057b3e8e2b336e2d188338`. The approved copy is `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/approved-b92d447f.md` in the main checkout.
- **Q1: option (a).** The `consentId` rename is its own small slice, right after s2:
  - `identityQueryConsentId` in `PreparationFields` and `decide-identity-queries`;
  - `executableConsentId` in `decide-git-version`;
  - it amends `protocolVersion` 9 before the single integration (Constraints).
- **The same slice moves the 6 `PreparationFields` brands into the protocol:** `preparationRequestId`, `selectionId`, `observationId`, `consentId` (renamed), `repositorySelectionId` and `trustId`. This meets L4-10's "no registration brand declared in apps/harness" for the identities that cross the wire.
- **Order:** this slice replaces the Deferred Work entry "The `consentId` split". Its trigger was "s2 accepted", and that trigger is unchanged. Its contract is written when it is next. Behavior IDs continue from P2-B11.

### 2026-10-24: slice p2-s2b-consent-wire-rename detailed

The coordinator calls this slice "s3". Its id is `p2-s2b-consent-wire-rename`, so the deferred slices keep their stable ids (`p2-s3-utc-instant-owner` through `p2-s7-storage-operation-id`). Measured at `6337aaf`, after s2 (`b109386`, fix `b0a9a83`).

#### Slice p2-s2b-consent-wire-rename

- **`slice_id`:** `p2-s2b-consent-wire-rename`. Lane: **normal**. It touches more than five files, and it changes the renderer, main, protocol and harness sides of the registration flow.
- **Findings:** L4-10, remediation 2 (the `consentId` split) and remediation 1 for the identities that cross the wire. Decision: Q1 (a).
- **Base:** `6337aaf` on `fix/arch-review-phase-2`.
- **Deliverable:**
  - **The wire rename.** On version 9, amended in place, with no bump:
    - `PreparationFields.consentId` and `decide-identity-queries.consentId` become `identityQueryConsentId`;
    - `decide-git-version.consentId` becomes `executableConsentId`.

    The legacy key `consentId` is refused by the strict policy as an unknown key.
  - **Seven flow brands owned by the protocol.** They are exported from `@slopstop/protocol` and keep today's brand names, so harness types do not change:

    | Brand | Wire fields that carry it | Declared today at |
    |---|---|---|
    | `RegistrationPreparationRequestId` | `preparationRequestId` | `registration-proposal-store.ts:24` |
    | `ExecutableSelectionId` | `selectionId` | `project-registration-observer.ts:7` |
    | `VersionObservationId` | `observationId` | `project-registration-observer.ts:13` |
    | `IdentityQueryConsentId` | `identityQueryConsentId` | `identity-query-consent.ts:26` |
    | `RepositorySelectionId` | `repositorySelectionId` | `repository-trust.ts:31` |
    | `RepositoryTrustId` | `trustId` | `repository-trust.ts:35` |
    | `ExecutableConsentId` | `executableConsentId` | `project-registration-observer.ts:10` |

    `ExecutableConsentId` is the seventh. It crosses the wire as `executableConsentId`, so the "identities that cross the wire" rule includes it.

    The harness imports all seven and declares none. After this slice, the only registration brand the harness declares is `RegistrationReservationId`, which never crosses the wire.
  - **The harness maps the new wire names onto its unchanged internal names** (see the decision below) at the flow boundary:
    - `project-registration-flow.ts:122` (`executableConsentId` → `consentId`);
    - `project-registration-flow.ts:155` and `registration-proposal-steps.ts:40` (`identityQueryConsentId` → `consentId`).
  - **Senders move:**
    - the renderer `use-add-repository.ts` (`:19`, `:106`, `:180`, `:204`, `:211`);
    - the main `registration-package-smoke.ts:27-32`;
    - the harness fixtures `registration-flow-fixture.ts`, `registration-flow-runtime.integration.test.ts` and `registration-restart-reconciliation.integration.test.ts`;
    - the e2e `apps/desktop/tests/e2e/registration.test.ts`.
- **Decision, internal names stay `consentId`.** The harness's admission, journal, store and SQL names stay as they are (`registration_*_consents.consent_id`; the stored proposal and request JSON with their fingerprints).
  - Reason: renaming them would change stored JSON and its fingerprints, which is a stored-row change the brief's non-goals exclude. The two consents are already apart inside the harness, by brand and by table.
  - Only the wire carried one name for two concepts.
- **Message ledger** (D1, 43bc303): no issue code or message changes. The rename changes only issue paths (`consentId` becomes the new key) and the shape of the unknown-key refusal. Every registration result code stays as it is.
- **Source paths:**
  - `packages/protocol/src/{project-registration-flow-protocol,project-registration-protocol,index}.ts`
  - `apps/harness/src/project-registration-observer.ts`
  - `apps/harness/src/registration/{project-registration-flow,registration-proposal-steps,identity-query-consent,registration-proposal-store,repository-trust}.ts`
  - `apps/desktop/src/renderer/add-repository/use-add-repository.ts`
  - `apps/desktop/src/main/registration-package-smoke.ts`
- **Test paths:**
  - `packages/protocol/src/project-registration-protocol.test.ts`
  - `apps/harness/src/registration/project-registration-flow.test.ts`
  - `apps/desktop/src/renderer/add-repository/add-repository.test.tsx`
  - the sender fixtures above, which change only the key names.
- **Dependencies:** s2. It uses the strict root that s1 and s2 put under every flow identity.
- **Open, Q2 below:** whether the flow wire schemas also carry the brands in their types. The contract below follows the recommended answer.

#### Test Contract: p2-s2b-consent-wire-rename

Public seams:
- the protocol package exports, through `decodeStrict` and `decodeWithIssues`;
- the harness `createProjectRegistrationFlow(...).handle`, with fake registry and owner ports, as in `project-registration-flow.test.ts`;
- the renderer add-repository flow through the preload API fake `registrationApi` (`registration-fake.ts`), which records every `registerProject` request in `calls`.

- **Behavior P2-B11 (L4-10 remediation 2):** the wire names the two consents apart and refuses the old name.
  - Test: `names the executable and identity-query consents apart (%s)` in `project-registration-protocol.test.ts`. `it.each` over `decide-git-version` (`executableConsentId`), `decide-identity-queries` (`identityQueryConsentId`), `prepare` and `confirm` (`identityQueryConsentId`).
    - Oracle: the request with the new key decodes through `RendererRegistrationRequestSchema` and `ProjectRegistrationRequestSchema`.
    - The same request with the legacy `consentId` in its place fails, with an issue at path `consentId`.
  - The s1 P2-B4 rows (`:26-49`) rename their field lists from `consentId` to the new keys, with no other assertion change.
  - Expected red: the new keys are unknown keys today, so their decode fails, and the legacy key decodes.
- **Behavior P2-B12 (L4-10):** the harness carries each wire consent into the consent it names.
  - Test: `routes each wire consent to its own consent` in `project-registration-flow.test.ts`. The fake registry and owner record their arguments:
    - `decide-git-version` with `executableConsentId: c1` and `decision: "declined"`: `registry.decideVersion` receives `consentId: c1`, and the answer is `{ status: "cancelled" }`;
    - `decide-identity-queries` with `identityQueryConsentId: c2` and `decision: "declined"`: `registry.decideIdentityQueries` receives `consentId: c2`, and the answer is `{ status: "cancelled" }`;
    - `prepare` with `identityQueryConsentId: c2`: `owner.prepare` receives `admission.consentId: c2`.
  - Expected red: the flow reads `request.consentId`, which is `undefined`. Its `decodeStrict` throws, the answer is `INTERNAL_FAILURE`, and no fake port is called.
- **Behavior P2-B13 (L4-10 remediation 1):** the protocol exports the seven flow brands.
  - Test: `exports the registration flow brands (%s)` in `project-registration-protocol.test.ts`, `it.each` over the seven schemas.
    - Each accepts valid lowercase.
    - Each rejects nil and uppercase, with the s1 issue shapes.
  - Expected red: the import fails, because none is exported today.
- **Behavior P2-B14 (renderer):** the renderer sends the renamed consents and threads the identity-query consent into preparation.
  - Test: `sends each consent under its own name` in `add-repository.test.tsx`. Run the accepted flow through `registrationApi`, then read `calls`:
    - the `decide-git-version` call has `executableConsentId` and no `consentId`;
    - the `decide-identity-queries` call has `identityQueryConsentId` and no `consentId`;
    - the `prepare` call has `identityQueryConsentId` equal to the `decide-identity-queries` value;
    - the `confirm` call carries the same value.
  - Expected red: the renderer sends `consentId` today.
- **TDD-exempt, with a stated oracle:** the harness importing the seven brands in place of its declarations.
  - Reason: brands are type-only, and the runtime rule is the strict root on both sides since s2.
  - Oracle:
    - `rg 'Schema\.brand\("(RegistrationPreparationRequestId|ExecutableSelectionId|VersionObservationId|IdentityQueryConsentId|RepositorySelectionId|RepositoryTrustId|ExecutableConsentId)"\)' apps/harness` finds nothing;
    - `pnpm typecheck` and `pnpm check:dead-code`.

#### Success Criteria: p2-s2b-consent-wire-rename

- Red then green for P2-B11 to P2-B14 with the smallest Vitest command per package, then `pnpm check` and `pnpm check:dead-code`.
- `rg -n "consentId" packages/protocol/src apps/desktop/src` finds only the new keys. `consentId` stays only in harness internals and the stored schema.
- **Heavy runs:** once at the candidate, with the coordinator's GO: `registration-flow-runtime.integration.test.ts` and `registration-restart-reconciliation.integration.test.ts`. The e2e `registration.test.ts` and the package smoke, which both send the wire steps, run in `check:deep` before the push. Each needs the GO the heavy-run rule requires.
- **Bindings,** each restored by digest:
  - accepting `consentId` as an alias on `decide-git-version` makes its P2-B11 row fail;
  - swapping the two mappings at `project-registration-flow.ts` (executable ↔ identity-query) makes P2-B12 fail;
  - the renderer reusing the git-version consent id for preparation makes P2-B14 fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Question for the coordinator

Q2. Should the flow wire schemas carry the seven brands in their types, or should the protocol only own and export them?
- **(a) Recommended: own and export only.** The flow `Schema.Struct` fields keep `LowercaseDomainIdentityTextSchema`, which is the same runtime rule. The harness brands each value after its own decode, as it does today, with the imported schema.
  - Senders stay as they are: the renderer, the main smoke, the fakes and the e2e keep sending plain `crypto.randomUUID()` text.
  - It meets L4-10's acceptance ("No registration brand declared in apps/harness").
  - The contract above is written for (a).
- **(b) Brand the wire fields too, in the steps and results:** `repository-selected`, `git-prepared` and `git-version-observed`; also `requestId` and `proposalId` on `confirm` and `proposal-prepared`.
  - Each sender must then mint branded values: the renderer's 5 sites, the fake's result defaults, the main smoke, 3 harness fixtures and the e2e.
  - It gains only compile-time separation between the renderer and main, where every value is produced by `randomUUID` and decoded at the IPC boundary anyway.
  - If chosen, it would add a P2-B15 renderer row and roughly 10 more files.

### 2026-10-24: p2-s2b approved and Q2 decided (Pedro, confirmed by the coordinator)

- **p2-s2b-consent-wire-rename intent approved** at `content_hash` `928e8e2c522394b9e909777999d91ed64ec13c6f44e37707177e3625478c3eb6`. The approved copy is `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/approved-928e8e2c.md` in the main checkout.
- **The harness-internal `consentId` names stay**, as the slice's decision records: admission, journals, SQL `consent_id`, and the stored JSON with its fingerprints. The new wire names are mapped onto them at the flow boundary.
- **Q2: option (a), own and export only.** The flow `Schema.Struct` fields keep `LowercaseDomainIdentityTextSchema`, and senders keep sending plain text. The contract (P2-B11 to P2-B14) stands as written, and no P2-B15 is added.

### 2026-10-24: slice p2-s3-utc-instant-owner detailed

Measured at `0e5ab0e`, after s2b (`be87690`). This contract follows the recommended answers to Q3 and Q4 below. A different answer changes only the rows named in those questions.

#### Slice p2-s3-utc-instant-owner

- **`slice_id`:** `p2-s3-utc-instant-owner`. Lane: **normal** (`lane.mjs --paths` over the planned paths: "files: 12 > 5").
- **Finding:** L7-04, with acceptance "One UTC instant schema in packages/protocol; Envelope sentAt rejects non-Z offsets".
- **Base:** `0e5ab0e` on `fix/arch-review-phase-2`.
- **Today: 8 definitions in 4 acceptance sets** (`dateTimeTextSchema`, `schema-codec.ts:52`):

  | Set | Sites | Rule |
  |---|---|---|
  | Z, seconds optional | `registration-confirmation-store.ts:51` `createdAt`, `registration-proposal-store.ts:33` `preparedAt`, `executable-consent-store.ts:16` `capturedAt` | `dateTimeTextSchema()` |
  | Z by filter, seconds optional | `project-storage-node-schemas.ts:49` `utcInstantSchema`, and its copy `project-storage-manifest.ts:23` | offset pattern plus filter, message `UTC instant must end in Z.` |
  | Z, seconds required, any fraction | `canonical-project-protocol.ts:47` `CanonicalSettlementTimeSchema` (message `Settlement time must include seconds and use UTC Z notation.`), `canonical-command-ledger.ts:36` `canonicalWriterUtcInstantSchema` (no message; also used by `conversation-rows.ts`, `canonical-writer-recovery.ts` and `canonical-command-repository.ts`) | offset pattern plus seconds-and-Z pattern |
  | Any offset, seconds optional | envelope `sentAt`, `protocol.ts:92` | `dateTimeTextSchema({ offset: true })` |

- **Producers:** every producer writes `new Date().toISOString()`, which always has seconds, 3 fraction digits and `Z`.
  - 23 sites: harness registration and storage, `process-bootstrap.ts` and `node-active-project-coordinator.ts`; desktop main `main.ts`, `harness-supervisor.ts` and `canonical-writer-package-smoke.ts`.
  - No SQL CHECK guards a timestamp column.
  - So **0 stored rows** fail any option below.
- **Deliverable:**
  - **One protocol owner** in `schema-codec.ts`, next to `dateTimeTextSchema`:
    - `UtcInstantSchema`: RFC 3339 structure (code `invalid_format`, annotation `an RFC 3339 date-time`), then a Z filter, then a seconds filter, both code `custom`;
    - a factory `utcInstant(message)` for the named variants, after the s1 pattern `lowercaseDomainIdentity(message)`;
    - `normalizedUtc`, moved from `canonical-command-ledger.ts:63`.
  - **The owner's default messages** are `UTC instant must end in Z.` (today's storage text) and `UTC instant must include seconds.`.
  - **Every site in the table above** uses the owner:
    - storage, the envelope `sentAt` (Q4), and the registration and writer sites use `UtcInstantSchema` and its defaults;
    - the manifest imports the storage schema instead of keeping its copy;
    - settlement is `utcInstant("Settlement time must include seconds and use UTC Z notation.")`, which keeps its one message for both rules.
  - **`dateTimeTextSchema` stops being exported.** Its last outside consumer, the smoke fixture `utc` (`canonical-writer-package-smoke-fixture.ts:80`, precision 3), becomes `UtcInstantSchema` plus a 3-digit check, because it is a producer oracle.
- **Message ledger** (D1, 43bc303):
  - kept: `UTC instant must end in Z.`, `Settlement time must include seconds and use UTC Z notation.`, and the annotation `an RFC 3339 date-time`;
  - **added:** the default seconds message `UTC instant must include seconds.`, which today's seconds-optional sites never needed;
  - no code changes.
- **Source paths:**
  - `packages/protocol/src/{schema-codec,canonical-project-protocol,protocol,index}.ts`
  - `apps/harness/src/storage/{canonical-command-ledger,canonical-writer-recovery,project-storage-node-schemas,project-storage-manifest}.ts`
  - `apps/harness/src/registration/{registration-confirmation-store,registration-proposal-store,executable-consent-store}.ts`
- **Test paths:**
  - new `packages/protocol/src/utc-instant.test.ts`
  - `packages/protocol/src/{schema-boundary-characterization,protocol}.test.ts`
  - `apps/harness/src/storage/{project-storage-node-schemas,project-storage-manifest}.test.ts`
  - fixture `apps/harness/tests/integration/canonical-writer-package-smoke-fixture.ts`
- **Dependencies:** none beyond the base. The UTC owner is independent of the identity slices.
- **Wire:** Q4 (a) amends version 9, with no bump (Constraints).

#### Test Contract: p2-s3-utc-instant-owner

Public seams:
- the protocol exports `UtcInstantSchema`, `utcInstant` and `normalizedUtc`, through `decodeWithIssues`;
- the envelope parsers `parseDesktopMessage` and `parseHarnessMessage`;
- the storage `utcInstantSchema` and the manifest decoder, through their exported schemas, as in the s2 P2-B10 test.

- **Behavior P2-B15 (L7-04, Q3):** one UTC instant rule.
  - Test: `accepts only UTC instants with seconds (%s)` in the new `utc-instant.test.ts`.
    - Accepts `2026-10-03T12:00:00Z`, `…12:00:00.123Z` and `…12:00:00.123456Z`.
    - Rejects `2026-10-03T12:00Z` with exactly `[{ code: "custom", path: [], message: "UTC instant must include seconds." }]`.
    - Rejects `…12:00:00+01:00` with `[{ code: "custom", path: [], message: "UTC instant must end in Z." }]`.
    - Rejects `2023-02-29T00:00:00Z`, `…T24:00:00Z` and `2026-10-03 12:00:00Z` with code `invalid_format`.
    - `normalizedUtc` maps `…12:01:00Z` and `…12:01:00.000Z` to the same value, and keeps `.0001Z` and `.0002Z` apart.
  - Expected red: the import fails, because the protocol exports no `UtcInstantSchema`.
- **Behavior P2-B16 (L7-04, Q3):** the stored registration and storage instants refuse a minute-only value.
  - Test: `rejects a minute-only stored instant (%s)` in `project-storage-node-schemas.test.ts` and `project-storage-manifest.test.ts`. `utcInstantSchema` and the manifest `createdAt` reject `2026-10-03T12:00Z` with the seconds message, and keep `UTC instant must end in Z.` for `+01:00`.
  - Expected red: the minute-only value decodes today (seconds optional). The `+01:00` row is a pin.
  - The three registration sites (`createdAt`, `preparedAt`, `capturedAt`) are TDD-exempt rebinds onto the same owner. Reason: they read only `toISOString` output, and P2-B15 proves the value they now use. Oracle: no `dateTimeTextSchema(` call outside `schema-codec.ts`.
- **Behavior P2-B17 (L7-04, Q4):** the envelope `sentAt` is a UTC instant.
  - Test: `rejects a non-UTC or minute-only message timestamp (%s)` in `schema-boundary-characterization.test.ts`. It replaces `accepts message timestamps with offsets and without seconds`. Its 3 acceptance rows (`…12:00Z`, `…12:00:00.5+05:30` and `…12:00:00-00:00`) become rejection rows.
  - Oracle: `parseDesktopMessage` answers `ok: false` with `error.code` `PROTOCOL_MESSAGE_INVALID` and an issue at path `sentAt`. The same handshake with `…12:00:00.000Z` answers `ok: true`.
  - The same `sentAt` rows hold for `parseHarnessMessage` in `protocol.test.ts`.
  - Expected red: all three parse `ok: true` today. The 3 rejection rows (`+24:00`, no zone, date only) stay.
- **Behavior P2-B18 (pin, D1):** settlement keeps its message and acceptance set.
  - Tests: `accepts only UTC settlement instants with seconds` (`schema-boundary-characterization.test.ts:29`), and `requires seconds in settlement clocks and persisted receipt instants` (`canonical-project-protocol.test.ts:905-925`), unchanged.
  - Plus one new row: `+01:00` and `12:00Z` each report exactly `Settlement time must include seconds and use UTC Z notation.`.
  - Expected red: none (pin).
- **TDD-exempt:** moving `normalizedUtc` and rebinding `canonicalWriterUtcInstantSchema` onto the owner. Reason: same acceptance set (seconds required, any fraction, Z), and P2-B15 proves it. Oracle: the writer-state rows (`canonical-command-repository-writer-state.integration.test.ts:117-120`) and the recovery tests stay green in `check:deep`.

#### Success Criteria: p2-s3-utc-instant-owner

- Red then green for P2-B15, P2-B16 and P2-B17 with the smallest Vitest command per package, then `pnpm check` and `pnpm check:dead-code`. P2-B18 is green before and after.
- `rg -n "dateTimeTextSchema\(" apps packages` finds only `schema-codec.ts`. `rg -n "UTC instant must end in Z" apps packages --glob '!*.test.*'` finds only the owner's default.
- **Heavy runs:** once at the candidate, with the coordinator's GO: `canonical-command-repository-writer-state.integration.test.ts` and `canonical-writer-recovery.integration.test.ts` (the `normalizedUtc` and writer-instant users), and `harness-runtime.integration.test.ts` (the envelope `sentAt`). The rest run in `check:deep` before the push.
- **Bindings,** each restored by digest:
  - making the owner's seconds optional makes the P2-B15 `12:00Z` row fail;
  - letting the envelope keep `{ offset: true }` makes P2-B17 fail;
  - giving the owner's Z filter no message makes the P2-B16 `+01:00` row fail;
  - settlement using the default messages makes its P2-B18 message row fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Questions for the coordinator

Q3. Which seconds policy does the one UTC owner use? Measured blast radius (stored rows / test rows that change / fixture literals that change):

| Option | Stored rows | Test rows that flip | Fixture literals to rewrite |
|---|---|---|---|
| **(a) Recommended: seconds required, fraction optional of any length, Z.** This is today's canonical and settlement set. | 0 | 0 outside the envelope. The 5 storage and registration sites gain a refusal of minute-only values; no test accepts one today. | 0 |
| (b) seconds optional | 0 | 5 canonical rejection rows become acceptances (`canonical-project-protocol.test.ts:914`, `schema-boundary-characterization.test.ts:38`, `canonical-project-settlement.integration.test.ts:486`, `canonical-project-application.test.ts:173`, `canonical-command-repository-faults.integration.test.ts:317`). It loosens the canonical writer. | 0 |
| (c) exactly 3 fraction digits (what `toISOString` writes) | 0 | 7 acceptance pins flip (`schema-boundary-characterization.test.ts:31-33`, `canonical-project-protocol.test.ts:905` ×2, and the `normalizedUtc` rows `canonical-command-repository-writer-state.integration.test.ts:117-119`), and `normalizedUtc` becomes dead | about 35 literals with no fraction or another fraction length, in 6 files (`canonical-command-repository.integration.test.ts` 19, `canonical-writer-reconciliation-fixture.ts` 5, `canonical-writer-recovery.integration.test.ts` 5, `conversation-rows.test.ts` 1, and the protocol tests) |

- (a) is the strictest set that changes no stored value and no accepted fixture. (c) is stricter, but it buys nothing that the producers do not already guarantee, and it costs the rewrites above.

Q4. Does the envelope `sentAt` become Z-only, through the same owner?

| Option | Stored rows | Test rows that flip | Producers |
|---|---|---|---|
| **(a) Recommended: yes, through the Q3 owner.** It amends version 9. | 0 (`sentAt` is never stored) | 3 acceptance rows in `schema-boundary-characterization.test.ts:58-62` (`…12:00Z`, `…+05:30` and `…-00:00`) become rejections | 0. Every sender writes `toISOString`, and the desktop test peers already use `.000Z`. |
| (b) no, keep any offset | 0 | 0 | 0 |

- (b) fails L7-04's acceptance criterion and keeps a fifth acceptance set.

### 2026-10-24: p2-s3 approved, Q3 and Q4 decided (Pedro, confirmed by the coordinator)

- **p2-s3-utc-instant-owner intent approved** at `content_hash` `589d0cd509199e4b2fdb02473966f7ee7ec038bbc8b8c82b299680c7ab83f02a`. The approved copy is `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/approved-589d0cd5.md` in the main checkout.
- **Q3: option (a).** The one UTC owner requires seconds, allows a fraction of any length, and requires `Z`, which is today's canonical and settlement set. `normalizedUtc` stays and moves to the protocol.
- **Q4: option (a).** The envelope `sentAt` uses the same owner, so it is Z-only with seconds. This amends `protocolVersion` 9 with no bump (Constraints).
- The contract (P2-B15 to P2-B18) stands as written.

### 2026-10-24: slice p2-s4-registration-clock detailed

Measured at `282edea`, after s3 (`709e55a`, `282edea`). This contract follows the recommended answers to Q5 and Q6 below. A different answer changes only the rows named in those questions.

#### Slice p2-s4-registration-clock

- **`slice_id`:** `p2-s4-registration-clock`. Lane: **normal** (`lane.mjs --paths` over the planned paths: "files: 13 > 5").
- **Finding:** L4-05, with acceptance "No new Date().toISOString() in apps/harness/src/registration" and test strategy "Registration tests with a fixed clock".
- **Base:** `282edea` on `fix/arch-review-phase-2`.
- **Today: 18 wall-clock reads in the harness** (`rg -n "new Date\(|Date\.now\(" apps/harness/src -g '!*.test.ts'`):
  - **15 inline reads in registration**, each stamping one stored value:

    | Site | Stored value |
    |---|---|
    | `repository-trust.ts:138` | `registration_repository_selections.captured_at` |
    | `repository-trust.ts:168` | `registration_repository_trust.decided_at` |
    | `identity-query-consent.ts:104` | `registration_identity_consents.decided_at` |
    | `identity-query-journal.ts:79` | `registration_identity_query_attempts.created_at` |
    | `identity-query-journal.ts:33`, `:133`; `observer-journal.ts:100` (restart reconciliation) | `registration_identity_query_attempts.settled_at` |
    | `registration-registry.ts:145` | `registration_executable_selections.captured_at` |
    | `registration-registry.ts:187` | `registration_version_consents.decided_at` |
    | `observer-journal.ts:208` | `registration_observer_intents.created_at` |
    | `observer-journal.ts:331` | `registration_observer_terminals.observed_at` |
    | `observer-journal.ts:187` | `registration_observer_outcomes.settled_at` |
    | `project-registration-preparation.ts:79` | `preparedAt` inside `registration_proposals.record_json` |
    | `registration-confirmation-store.ts:282` | `createdAt` inside `registration_reservations.record_json` |
    | `list-visibility.ts:59` | `registration_list_visibility.hidden_at` |

  - **3 duplicate harness clock adapters:** `process-bootstrap.ts:212` and `node-active-project-coordinator.ts:15` (`const currentTime = () => new Date().toISOString()`), and the default clock in `project-storage-node-adapters.ts:136` (the only one that decodes through the UTC owner).
  - The finding's fourth adapter, `apps/desktop/src/main/main.ts:85`, is the desktop process's own clock (Q6).
- **What reads the values back:** only `executable-consent-store.ts:29` (`capturedAt`, decoded by `UtcInstantSchema`). No registration query orders or compares by a timestamp. The proposal and reservation fingerprints digest the whole record, but they are checked only against their own stored row; the request fingerprints exclude the time. So a fixed clock changes no registration decision.
- **Deliverable:**
  - **One harness clock owner,** new `apps/harness/src/utc-clock.ts`:
    - `UtcClock = Readonly<{ now(): string }>`, the shape `ProjectStorageStoreDependencies["clock"]` already has;
    - `systemUtcClock`, the harness's only wall-clock read, returning `new Date().toISOString()` decoded by the protocol `UtcInstantSchema` (today's storage precedent).
  - The owner lives in the harness, not the protocol or kernel: reading the wall clock is a side effect, and neither package runs one (Architecture).
  - **Registration takes the clock** through `RegistrationDatabaseOptions` (`registry-database.ts:24`) as `clock` (Q5). Each of the 15 sites reads `clock.now()` instead of `new Date()`. Helpers that take only a transaction receive the clock or the instant from their caller.
  - **The composition root passes one instance:** `projectRegistrationLayer` (`process-bootstrap.ts:304`) puts `systemUtcClock` in the registration options, and the runtime's `now` becomes `systemUtcClock.now`. `node-active-project-coordinator.ts` and the storage default use the same owner. Both `currentTime` lambdas are deleted.
  - Not an Effect `Clock`: registration is Promise code, and converting its 15 call paths to Effects is #123 Part B scope, not this finding's.
- **Message and code ledger** (D1, 43bc303): no message or code is added, removed or changed. A stored instant keeps the `toISOString` form.
- **Source paths:**
  - new `apps/harness/src/utc-clock.ts`
  - `apps/harness/src/{process-bootstrap,node-active-project-coordinator}.ts`, `apps/harness/src/storage/project-storage-node-adapters.ts`
  - `apps/harness/src/registration/{registry-database,repository-trust,identity-query-consent,identity-query-journal,observer-journal,registration-registry,project-registration-preparation,registration-confirmation-store,list-visibility}.ts`
- **Test paths:**
  - new `apps/harness/src/utc-clock.test.ts`
  - new `apps/harness/tests/integration/registration-clock.integration.test.ts`, reusing the existing registration fixtures (`registration-version-fixture.ts`, `registration-recovery-scenarios.ts`)
- **Dependencies:** s3, whose `UtcInstantSchema` the clock's value satisfies and the stores decode.

#### Test Contract: p2-s4-registration-clock

Public seams:
- the exported `systemUtcClock`;
- the registration owners built from `RegistrationDatabaseOptions` with a fixed clock, observed through the application database, as the existing registration integration tests do.

- **Behavior P2-B19 (L4-05):** the harness clock answers a UTC instant.
  - Test: `answers the current time as a UTC instant` in `utc-clock.test.ts`. `decodeStrict(UtcInstantSchema, systemUtcClock.now())` returns the value unchanged, and the value lies between two `Date.now()` reads taken around the call.
  - Expected red: the import fails, because `utc-clock.ts` does not exist.
- **Behavior P2-B20 (L4-05):** registration stamps every stored time from the injected clock.
  - Test: `stamps every registration time from the injected clock (%s)` in `registration-clock.integration.test.ts`, with the fixed clock `2026-10-24T12:00:00.000Z` in the options.
  - Rows, one per stored value in the table above (14 values, 15 sites): drive the registration paths that write each one, including restart reconciliation for `observer-journal.ts:100` and list removal for `hidden_at`, then read the value from the database.
  - Oracle: every value equals `2026-10-24T12:00:00.000Z` exactly. Each row asserts that it read at least one value, so a path that writes nothing fails instead of passing empty.
  - If a path cannot be driven on the test platform (the Windows observer), the row uses the existing fake observer port. A row that still cannot run is recorded in `## TDD Evidence (implement)` as an unproven gap, never skipped silently.
  - Expected red: the values are wall-clock times, not the fixed instant (the `clock` option is ignored at runtime).
- **Behavior P2-B21 (pin, D1):** a production registration still stores `toISOString` instants.
  - Test: the existing registration integration tests, which build options without a clock (Q5 (a)), stay green unchanged, and `executable-consent-store.ts` still decodes `capturedAt`.
  - Expected red: none (pin).
- **TDD-exempt:** deleting the two `currentTime` lambdas and pointing the runtime, the coordinator and the storage default at `systemUtcClock`. Reason: same value (`toISOString`), and P2-B19 proves the owner. Oracle: the structural checks below, and the runtime tests stay green.

#### Success Criteria: p2-s4-registration-clock

- Red then green for P2-B19 and P2-B20 with the smallest Vitest command, then `pnpm check` and `pnpm check:dead-code`. P2-B21 is green before and after.
- `rg -n "new Date\(|Date\.now\(" apps/harness/src -g '!*.test.ts'` finds only `utc-clock.ts`. `rg -n "currentTime" apps/harness/src` finds nothing.
- **Heavy runs:** `registration-clock.integration.test.ts` is the red-green command; it runs real SQLite, so the implementer tells the coordinator before it if it takes over 2 minutes. Once at the candidate, with the coordinator's GO: `project-registration.integration.test.ts` and `registration-restart-reconciliation.integration.test.ts` (the touched write paths). The rest run in `check:deep` before the push.
- **Bindings,** each restored by digest:
  - one site (for example `observer-journal.ts:331`) going back to `new Date().toISOString()` makes its P2-B20 row fail;
  - `systemUtcClock` returning a value without `Z` makes P2-B19 fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Questions for the coordinator

Q5. How does registration receive the clock? Measured blast radius (test files that must change / production wiring):

| Option | Test files that change | Production wiring |
|---|---|---|
| **(a) Recommended: optional `clock?: UtcClock` on `RegistrationDatabaseOptions`, defaulting to `systemUtcClock`.** This is the storage precedent (`project-storage-node-adapters.ts:133`, `options.clock ?? …`). | 0 existing; only the new P2-B20 file passes a fixed clock | `process-bootstrap.ts` passes `systemUtcClock` explicitly |
| (b) required `clock` | up to 30 test files (`rg -l migrationResourcesRoot` over the harness tests finds 30, some of them storage-only); each that builds registration options adds a clock | same as (a); a forgotten wiring becomes a type error |
| (c) Effect `Clock` / `TestClock` | the 15 call paths become Effects first | #123 Part B scope; out of this finding |

- (a) gives every test a fixed clock where time matters, at no churn. Its risk is a new owner that forgets the option and silently uses real time; the default is the same one system clock, so production behavior cannot drift.

Q6. Does s4 also cover the desktop process?

| Option | Change | Sites |
|---|---|---|
| **(a) Recommended: no; record a residual.** | none | desktop `main.ts:85` is already its process's one injected clock. `harness-supervisor.ts:498` (`sentAt`) and the smoke `canonical-writer-package-smoke.ts:84` stay inline reads. |
| (b) yes | `HarnessSupervisor` takes the main clock; the smoke keeps its inline read | 1 constructor, its tests, and `main.ts` |

- (a) matches L4-05's acceptance ("No new Date().toISOString() in apps/harness/src/registration") and the brief's one-clock-per-process rule. (b) closes the last desktop inline producer of `sentAt`, which s3 made Z-only; `toISOString` already satisfies it, so nothing breaks today.

### 2026-10-24: p2-s4 approved, Q5 and Q6 decided (Pedro, confirmed by the coordinator)

- **p2-s4-registration-clock intent approved** at `content_hash` `fa125147f058457eb488a1d426efd7ec6800c611cee2c9e87238658ec6502a23`. The approved copy is `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/approved-fa125147.md` in the main checkout.
- **Q5: option (a).** `RegistrationDatabaseOptions` gains an optional `clock?: UtcClock` that defaults to `systemUtcClock`, after the storage precedent. `process-bootstrap.ts` passes `systemUtcClock` explicitly.
- **Q6: option (a).** The desktop process is out of s4. Named residual: `apps/desktop/src/main/harness-supervisor.ts:498` (`sentAt`) and `canonical-writer-package-smoke.ts:84` stay inline `toISOString` reads; `main.ts:85` stays the desktop's one injected clock.
- The contract (P2-B19 to P2-B21) stands as written.

### 2026-10-24: slice p2-s5-sha256-owner detailed

Measured at `ca6127b` (s4 in progress). This contract follows the recommended answers to Q7 and Q8 below. A different answer changes only the rows named in those questions.

#### Slice p2-s5-sha256-owner

- **`slice_id`:** `p2-s5-sha256-owner`. Lane: **normal** (`lane.mjs --paths` over the planned paths: "files: 14 > 5").
- **Finding:** L7-05, with acceptance "One sha256 hex schema" and remediation "Export Sha256HexSchema from packages/protocol/src/schema-codec.ts and one Node sha256Text adapter".
- **Base:** s4's accepted head on `fix/arch-review-phase-2` (both slices touch `node-active-project-coordinator.ts`).
- **Today: 8 production schemas, one acceptance set, two default messages** (`rg -n "\{64\}" apps packages -g '!*.test.ts'`). Every one is `Schema.String.check(Schema.isPattern(…))` with no message:

  | Site | Class | Default message |
  |---|---|---|
  | `packages/protocol/src/project-registration-flow-protocol.ts:9` `Sha256TextSchema` (`proposalFingerprint` ×2) | `[0-9a-f]` | `Expected a string matching the RegExp ^[0-9a-f]{64}$` |
  | `packages/protocol/src/project-registration-protocol.ts:29` `reservationFingerprint` | `[0-9a-f]` | same |
  | `apps/harness/src/canonical-json.ts:16` `CanonicalSha256Schema` (8 ledger fields, the repository's `digestSchema`) | `[0-9a-f]`, `u` | same |
  | `apps/harness/src/registration/physical-identity.ts:27` `metadataFingerprint` | `[0-9a-f]` | same |
  | `apps/harness/src/registration/registration-confirmation-store.ts:40` `proposalFingerprint` | `[0-9a-f]` | same |
  | `apps/harness/src/storage/project-storage-manifest.ts:26` `sha256` | `[0-9a-f]`, `u` | same |
  | `apps/harness/src/storage/project-storage-node-schemas.ts:51` `sha256Schema` | `[0-9a-f]`, `u` | same |
  | `apps/harness/src/registration/executable-identity.ts:6` `sha256` | **`[a-f0-9]`** | **`Expected a string matching the RegExp ^[a-f0-9]{64}$`** |

  - **Identity proof (shared-vocab-union):** `[0-9a-f]` and `[a-f0-9]` name the same 16 characters, and the `u` flag changes nothing for ASCII classes, so all 8 accept exactly the 64-character lowercase hex strings. Probed with Effect 4 at `ca6127b`: the code is `invalid_format` for all; the message differs only by the regex source above.
  - **Readers of the messages:** none. The harness sites decode with `decodeStrict` and map any failure to their own corrupt or broken code (the s3 reader evidence: no `apps` source inspects issues). The two protocol sites reach the renderer only as `PROTOCOL_MESSAGE_INVALID`. `rg -n "matching the RegExp|a-f0-9" apps packages -g '*.test.ts'` finds no message pin; its one `[a-f0-9]` hit is a desktop test helper (`package-smoke-launcher.test.ts:199`).
  - **The stored proposal fingerprints have no format check:** `registration-proposal-store.ts:61` reads `input_fingerprint` and `proposal_fingerprint` as `Schema.String`. A non-hex stored value already fails `proposalRowAgrees` (it differs from the recomputed digest) and answers `REGISTRY_CORRUPT`, so the check changes no outcome.
  - **Stored rows and fixtures:** every producer is `createHash("sha256")…digest("hex")` (lowercase hex), so **0 stored values** fall outside the set. The renderer fake (`registration-fake.ts:39`, `"a".repeat(64)`) and every fixture digest stay accepted.
- **Two inline `sha256Text` adapters,** the same lambda `async (text) => createHash("sha256").update(text).digest("hex")`: `node-active-project-coordinator.ts:36` and `project-storage-node-adapters.ts:382`. Three more text digests compute the same thing: `canonical-json.ts:58` (`hashCanonicalJson`), `registration-confirmation-store.ts:106` and `registration-proposal-store.ts:74` (`JSON.stringify`).
- **Deliverable:**
  - **One protocol owner** in `schema-codec.ts`: `Sha256HexSchema = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u))`, exported from the package index. It keeps the default message of the 7 `[0-9a-f]` sites byte-identical.
  - **Every site in the table** uses it; `CanonicalSha256Schema` and the local names are deleted, and their consumers import the owner. The proposal row schema checks both fingerprints with it.
  - **One harness text digest,** new `apps/harness/src/sha256-text.ts`: `sha256Hex(text): string` (UTF-8, hex) and the port adapter `sha256Text(text): Promise<string>`. The two adapters pass `sha256Text`; the three text digests call `sha256Hex`.
  - Byte and stream digests (`windows-file-identity.ts:133`, `repository-physical-observation.ts:116`/`:172`, `project-storage-file-adapter.ts:40`, `project-storage-create-inspection.ts:95`, `project-storage-upgrade-verification.ts:51`, `generated-migration-resources.ts:293`/`:326`) hash buffers or composed inputs and stay as they are.
- **Message and code ledger** (D1, 43bc303): kept: the `[0-9a-f]` default message at all 7 sites. **Changed** (Q7): `executable-identity.ts`'s message becomes the `[0-9a-f]` text; 0 readers, 0 pins. No code changes.
- **Wire:** the two protocol fields keep their set, code and message, so this is no version 9 amendment.
- **Source paths:**
  - `packages/protocol/src/{schema-codec,index,project-registration-flow-protocol,project-registration-protocol}.ts`
  - new `apps/harness/src/sha256-text.ts`; `apps/harness/src/{canonical-json,node-active-project-coordinator}.ts`
  - `apps/harness/src/registration/{executable-identity,physical-identity,registration-confirmation-store,registration-proposal-store}.ts`
  - `apps/harness/src/storage/{project-storage-manifest,project-storage-node-schemas,project-storage-node-adapters,canonical-command-ledger,canonical-command-repository}.ts`
- **Test paths:** new `packages/protocol/src/sha256-hex.test.ts`; new `apps/harness/src/sha256-text.test.ts`; two rows in `apps/harness/tests/integration/registration-preparation.integration.test.ts` (the proposal store has no unit test).
- **Dependencies:** s4 (shared file). Independent of the identity and UTC owners.

#### Test Contract: p2-s5-sha256-owner

Public seams:
- the protocol export `Sha256HexSchema`, through `decodeWithIssues`;
- the exported `sha256Hex` and `sha256Text`;
- registration preparation over an edited stored proposal, as `registration-preparation.integration.test.ts:415-433` drives it.

- **Behavior P2-B22 (L7-05, Q7):** one SHA-256 hex rule.
  - Test: `accepts only lowercase 64-character hex digests (%s)` in the new `sha256-hex.test.ts`.
    - Accepts `"0".repeat(64)`, `"f".repeat(64)` and the SHA-256 of `abc`, `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
    - Rejects `"A".repeat(64)`, 63 and 65 characters, `"g".repeat(64)` and `""`, each with exactly `[{ code: "invalid_format", path: [], message: "Expected a string matching the RegExp ^[0-9a-f]{64}$" }]`.
  - Expected red: the import fails, because the protocol exports no `Sha256HexSchema`.
- **Behavior P2-B23 (L7-05):** one text digest.
  - Test: `digests text as lowercase SHA-256 hex` in the new `sha256-text.test.ts`. `sha256Hex("")` is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, `sha256Hex("abc")` is the P2-B22 value, `sha256Hex("é")` is the digest of its UTF-8 bytes (`createHash` over `Buffer.from("é", "utf8")`), and `sha256Text("abc")` resolves to the same value.
  - Expected red: the import fails, because `sha256-text.ts` does not exist.
- **Behavior P2-B24 (pin, D1):** a stored proposal with a non-hex fingerprint is corrupt.
  - Test: the existing `reports corrupt saved proposal as broken without a new observation: %s` (`registration-preparation.integration.test.ts:415`, Windows x64), which already holds the `proposal_fingerprint = 'corrupt'` row, gains two rows: `proposal_fingerprint` and `input_fingerprint` each set to 64 `A` characters. Oracle, unchanged: the second `prepare()` answers `{ status: "broken", code: "REGISTRY_CORRUPT" }`, no new observation is dispatched, and one proposal row remains.
  - Expected red: none (pin). Today the row fails `proposalRowAgrees` with the same answer; after the change it fails the row decode.
- **TDD-exempt:** rebinding the 8 schemas onto the owner and the 5 digests onto `sha256Hex`/`sha256Text`. Reason: same accepted set and same bytes, proven by P2-B22 and P2-B23; `executable-identity.ts`'s message change has no reader (Q7). Oracle: the structural checks below, and the ledger, registration and storage tests stay green.

#### Success Criteria: p2-s5-sha256-owner

- Red then green for P2-B22 and P2-B23 with the smallest Vitest command per package, then `pnpm check` and `pnpm check:dead-code`. P2-B24 is green before and after.
- `rg -n "\{64\}" apps/harness/src packages/protocol/src -g '!*.test.ts'` finds only `schema-codec.ts`. `rg -n "CanonicalSha256Schema|Sha256TextSchema" apps packages` finds nothing. `rg -n 'update\(text\)\.digest\("hex"\)' apps/harness/src -g '!*.test.ts'` finds only `sha256-text.ts`.
- **Heavy runs:** the P2-B24 pin runs `registration-preparation.integration.test.ts` (real SQLite, Windows observer) before and after, with the coordinator's GO if it takes over 2 minutes. The ledger and other registration integration tests that read these fields run in `check:deep` before the push.
- **Bindings,** each restored by digest:
  - the owner accepting `A-F` makes the P2-B22 uppercase row fail;
  - `sha256Hex` digesting `latin1` makes the P2-B23 `é` row fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Questions for the coordinator

Q7. Does `executable-identity.ts` join the one class? Measured blast radius (stored values / message readers / test pins):

| Option | Stored values | Readers | Pins | Result |
|---|---|---|---|---|
| **(a) Recommended: yes, one `[0-9a-f]` owner;** its default message changes to the `[0-9a-f]` text | 0 | 0 | 0 | one schema, as L7-05 asks |
| (b) the owner takes an optional message, and `executable-identity.ts` keeps `Expected a string matching the RegExp ^[a-f0-9]{64}$` by name | 0 | 0 | 0 | one rule, but a fake regex text kept as a message no one reads |
| (c) leave `executable-identity.ts` as is | 0 | 0 | 0 | two schemas; fails L7-05's acceptance |

- The message ledger (D1) keeps distinct texts that a reader or user sees. This one reaches only `decodeStrict`, whose failure becomes a corrupt code, so (a) loses nothing observable.

Q8. Which further sites join?

| Option | Adds | Files |
|---|---|---|
| **(a) Recommended: production schemas and text digests only (above).** Named residual: the desktop smoke regexes and the test fixtures. | none | 0 more |
| (b) also the desktop smoke checks and the fixture copies | `package-smoke-runtime.ts:8` (`executableSha256`; its `nonce` is random hex, not a digest), `canonical-writer-package-smoke-fixture.ts:82` (`[a-f0-9]`), `storage-root-capture.ts:18`, `registration-flow-outcomes.integration.test.ts:13` | 4 more |

- `package-smoke-authorization.ts:10` checks a random 32-byte token, not a digest, so it stays in either option. (b) gives the smoke and fixtures the same oracle, but they are test-only or smoke code, and their sets already match.

### 2026-10-24: p2-s5 approved, Q7 and Q8 decided (Pedro, confirmed by the coordinator)

- **p2-s5-sha256-owner intent approved** at `content_hash` `dc6b89997b4c986a64f0096945a5b37e5b54811e6afe49bf84084f56036cfcff`. The approved copy is `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/approved-dc6b8999.md` in the main checkout.
- **Q7: option (a).** `executable-identity.ts` joins the one `[0-9a-f]` owner. Its Effect-generated default message `Expected a string matching the RegExp ^[a-f0-9]{64}$` is not project diagnostic vocabulary under D1, so its change to the `[0-9a-f]` text is not a ledger loss.
- **Q8: option (a).** Production schemas and text digests only. Named residual: the desktop smoke check `package-smoke-runtime.ts:8` and the test copies `canonical-writer-package-smoke-fixture.ts:82`, `storage-root-capture.ts:18` and `registration-flow-outcomes.integration.test.ts:13`.
- The contract (P2-B22 to P2-B24) stands as written.

### 2026-10-24: p2-s4 light phase, coordinator decisions

- **Seam amendment:** the optional `HarnessRuntimeIo.clock` and its pin are recorded in the Developer Context entry `2026-10-24, p2-s4 implementation`.
- **Named residual:** `apps/harness/src/registration/project-registration-preparation.ts` scores CodeScene 8.03 at base and on `main` (Complex Method `confirm` and `inspectConfirmation`, cc 9; two complex conditionals; duplicated blocks in `createProjectRegistrationPreparation`). s4 changes two argument lines there and does not refactor it; it fits Phase 3, which reworks the registration failure paths.

### 2026-10-24: p2-s4 slice-verifier round 1 (passed, 2 Decisions warnings; coordinator decision: one follow-up commit, no round 2)

- **V1, the clock's reach (option (i)):** the injected clock feeds registration times and the runtime's message `sentAt` only. Project Storage (`projectStorageLayer` passes no clock) and the canonical coordinator (`node-active-project-coordinator.ts`) read `systemUtcClock` directly, and `canonicalProjectsLayer` builds its own `RegistrationDatabaseOptions` without the clock (its consumers write no time). The two TSDoc lines in `process-bootstrap.ts` now say so. In production every owner uses the same `systemUtcClock`, so nothing differs today. **Named residual:** piping `ProcessClock` into `projectStorageLayer`, `canonicalProjectsLayer`'s registry options and a coordinator `now` input.
- **V2, P2-B21 "before" (accepted from earlier recorded runs):** `project-registration.integration.test.ts` passed at `b109386` (s2 integration, `2026-10-24_p2-s2-integration.log`) and `registration-restart-reconciliation.integration.test.ts` at `be87690` (s2b integration, `2026-10-24_p2-s2b-integration.log`), both before s4. `git diff --stat b109386 112101e` and `git diff --stat be87690 112101e` on those two files are empty, so the tests are unchanged since. The "after" run is `2026-10-24_p2-s4-integration.log`.
- **Polish, recorded without change:** the s4 integration log does not name its 3 files (the evidence names them); the red log cites test lines 117-121, which are 115-117 in the final file; after s4, s5's cited lines `node-active-project-coordinator.ts:36` and `project-storage-node-adapters.ts:382` are at `:35` and `:379`; the s5 design and approval sections are committed inside `112101e`.

### 2026-10-25: slice p2-s6-code-tuples detailed

Measured at `cdf6cb2`, after s4. This contract follows the recommended answers to Q9, Q10 and Q11 below. A different answer changes only the rows named in those questions.

#### Slice p2-s6-code-tuples

- **`slice_id`:** `p2-s6-code-tuples`. Lane: **rigorous** by `lane.mjs --paths` over the 13 planned source paths: "files: 13 > 5" and "sensitive word: migration (apps/harness/src/storage/application-database-migration.ts)". Without that one file the lane is normal (Q12).
- **Findings:**
  - L7-01, with acceptance "One definition of the registry-broken set" and test strategy "Protocol tests; renderer gating tests";
  - L7-06, with acceptance "One release-code tuple" and remediation "write harness unions as Extract of it".
- **Base:** `cdf6cb2` on `fix/arch-review-phase-2`. It touches no s5 file.
- **Today, L7-01: 9 restatements of one 3-code set** (`REGISTRY_SCHEMA_UNKNOWN`, `REGISTRY_SCHEMA_NEWER`, `REGISTRY_CORRUPT`):

  | Package | Site | Form |
  |---|---|---|
  | protocol | `project-list-protocol.ts:98` (`ProjectListResultSchema` broken) | inline in `Schema.Literals`, with `INTERNAL_FAILURE`, `PROJECT_LIST_TRANSPORT_FAILED` |
  | protocol | `project-registration-flow-protocol.ts:105` (registration failures) | inline, with `INTERNAL_FAILURE`, `PROJECT_REGISTRATION_TRANSPORT_FAILED` |
  | protocol | `project-registration-protocol.ts:48` `registeredProjectSelectionCodes` | first 3 entries of the exported tuple |
  | protocol | `canonical-project-protocol.ts:236` (activation broken) | inline in `selectionCodes([…])`, with `INTERNAL_FAILURE` |
  | harness | `registration/registry-failure.ts:12` `RegistryFailureSchema` | `Schema.Literals` |
  | harness | `storage/application-database-migration.ts:32` `ApplicationDatabaseFailure` | type union |
  | harness | `registration/project-registration-preparation.ts:236` `registryDataCodes` | `ReadonlySet<BrokenListing["code"]>` |
  | renderer | `add-repository-button.tsx:7` `registryBroken` (blocks adding) | **untyped** `Set<string>` |
  | renderer | `remove-from-list/use-remove-from-list.ts:31` `damagedRegistry` (removal outcome) | **untyped** `Set<string>` |

  - Every copy holds the same 3 codes. The renderer lists them in another order, which changes nothing: no test pins a union message (`rg -n 'Expected \"REGISTRY' apps packages -g '*.test.*'` finds nothing).
  - **Gating test gap:** the renderer tests pin only `REGISTRY_CORRUPT`: `projects-list.test.tsx:201` (the add button is disabled with `Unavailable while saved Projects can't be read.`), `remove-from-list.test.tsx:122` (`Saved Projects can't be updated`) and `add-repository.test.tsx:215`. If the renderer lost `REGISTRY_SCHEMA_NEWER`, no test would fail, and the compiler would not either (`Set<string>`).
- **Today, L7-06: 8 writer release codes in 3 protocol lists and 3 harness unions, 0 drift:**
  - Protocol: `canonicalProjectActivationDiagnosticCodes` (`canonical-project-protocol.ts:139`), the activation broken list (`:241-:250`, `retryable` any boolean) and `switchReleaseDiagnosticSchema` (`:411-:425`, `retryable: true`, with `WRITER_FENCE_STALE` apart at `retryable: false`).
  - The 8: `PROJECT_STORAGE_RELEASE_FAILED`, `WRITER_LEASE_OPEN_FAILED`, `WRITER_LEASE_LOCK_FAILED`, `WRITER_LEASE_UNLOCK_FAILED`, `WRITER_LEASE_CLOSE_FAILED`, `WRITER_FENCE_RELEASE_FAILED`, `WRITER_REPOSITORY_CLOSE_FAILED` and `WRITER_CLIENT_ABANDON_FAILED`.
  - Harness: `CanonicalWriterLeaseFailureCode` (`canonical-writer-lease.ts:3`, the 4 lease codes), `CanonicalProjectWriterReleaseFailureCode` (`canonical-project-writer.ts:30`, `WRITER_FENCE_STALE` plus 3 writer codes plus the lease union) and `CanonicalCommandRepositoryFailureCode` (`canonical-command-repository.ts:76`). That last one also holds 2 codes that are not release codes, `WRITER_FENCE_ACTIVATION_FAILED` and `WRITER_FENCE_CHECK_FAILED`.
  - The harness message table `canonical-command-repository.ts:114` keeps its texts.
- **Deliverable:**
  - **Registry-broken owner** (Q9), in `project-list-protocol.ts` next to `RegistryPendingRecoverySchema`: `registryBrokenCodes = ["REGISTRY_SCHEMA_UNKNOWN", "REGISTRY_SCHEMA_NEWER", "REGISTRY_CORRUPT"] as const`, `RegistryBrokenCodeSchema = Schema.Literals(registryBrokenCodes)` and the type `RegistryBrokenCode`, exported from the index.
    - The 4 protocol lists spread the tuple. `registeredProjectSelectionCodes` keeps its order (spread first).
    - The 3 harness copies use the schema or the type.
    - The 2 renderer Sets are built from the tuple and typed `ReadonlySet<RegistryBrokenCode>`. A membership check on a wider code goes through one typed guard, `isRegistryBrokenCode(code: string): code is RegistryBrokenCode`, exported next to the tuple.
  - **Release-code owner** (Q10, Q11), in `canonical-project-protocol.ts`: `writerReleaseFailureCodes` (the 8 above) `as const`, its schema and its type `WriterReleaseFailureCode`, exported from the index.
    - The 3 protocol lists spread it. `WRITER_FENCE_STALE` stays a separate entry.
    - In the harness, `CanonicalWriterLeaseFailureCode = Extract<WriterReleaseFailureCode, \`WRITER_LEASE_${string}\`>`.
    - `CanonicalProjectWriterReleaseFailureCode = "WRITER_FENCE_STALE" | Exclude<WriterReleaseFailureCode, "PROJECT_STORAGE_RELEASE_FAILED">`.
    - The repository union keeps its 2 non-release codes and `Extract`s `WRITER_FENCE_RELEASE_FAILED` and `WRITER_REPOSITORY_CLOSE_FAILED`.
- **Message and code ledger** (D1, 43bc303): no code, message, status or `retryable` value is added, removed or changed. The renderer texts above stay byte-identical.
- **Wire:** every schema keeps its accepted set, so this is no version 9 amendment.
- **Source paths:**
  - `packages/protocol/src/{project-list-protocol,project-registration-flow-protocol,project-registration-protocol,canonical-project-protocol,index}.ts`
  - `apps/harness/src/registration/{registry-failure,project-registration-preparation}.ts`, `apps/harness/src/storage/{application-database-migration,canonical-writer-lease,canonical-command-repository}.ts`, `apps/harness/src/canonical-project-writer.ts`
  - `apps/desktop/src/renderer/add-repository-button.tsx`, `apps/desktop/src/renderer/remove-from-list/use-remove-from-list.ts`
- **Test paths:** new `packages/protocol/src/registry-broken-codes.test.ts`; `packages/protocol/src/canonical-project-protocol.test.ts`; `apps/desktop/src/renderer/{projects-list,remove-from-list/remove-from-list}.test.tsx`.
- **Dependencies:** none beyond the base.

#### Test Contract: p2-s6-code-tuples

Public seams:
- the protocol exports, with `decodeWithIssues` on the result schemas;
- the renderer through its rendered list and removal journeys, as the existing gating tests drive them.

- **Behavior P2-B25 (L7-01):** one registry-broken set, accepted by every result that carries it.
  - Test: `carries every registry-broken code (%s)` in the new `registry-broken-codes.test.ts`.
    - `registryBrokenCodes` equals exactly `["REGISTRY_SCHEMA_UNKNOWN", "REGISTRY_SCHEMA_NEWER", "REGISTRY_CORRUPT"]`.
    - For each code, these decode `ok`: `ProjectListResultSchema` `{ status: "broken", code }`, the registration result `{ status: "broken", code }`, and `CanonicalProjectActivationResultSchema` broken with that diagnostic code. `registeredProjectSelectionCodes` includes the code.
    - `isRegistryBrokenCode` answers `true` for the 3 and `false` for `REGISTRY_BUSY` and `INTERNAL_FAILURE`.
  - Expected red: the import fails, because the protocol exports no `registryBrokenCodes`.
- **Behavior P2-B26 (L7-01, pin):** the renderer treats every registry-broken code as damaged.
  - Tests: `projects-list.test.tsx:201` becomes `shows a damaged registry as an alert and disables adding with the reason (%s)` over `registryBrokenCodes`, and `remove-from-list.test.tsx:120` gets the same rows. The existing texts and `Reference: <code>` stay the oracle.
  - One more row in each: `INTERNAL_FAILURE` is not damaged. In the list test, adding is not disabled with the damaged reason; in the removal test, the outcome is not `Saved Projects can't be updated`.
  - Expected red: none (pin); the local Sets already hold all 3. Binding: dropping `REGISTRY_SCHEMA_NEWER` from the tuple makes both fail.
- **Behavior P2-B27 (L7-06, Q10):** one release-code tuple.
  - Test: `carries every writer release code (%s)` in `canonical-project-protocol.test.ts`.
    - `writerReleaseFailureCodes` equals the 8 codes above.
    - For each code, `CanonicalProjectSwitchResultSchema`'s release diagnostic accepts it with `retryable: true` and rejects it with `retryable: false`, and the activation broken result accepts it.
    - `WRITER_FENCE_STALE` is not in the tuple, and the switch release still accepts it with `retryable: false`.
  - Expected red: the import fails, because the protocol exports no `writerReleaseFailureCodes`.
- **TDD-exempt:** the harness unions written as `Extract`/`Exclude`, and the harness registry copies rebound. Reason: these are types or the same literal set, so `pnpm typecheck` proves them. Oracle: the compile-time checks below, and the harness registration and writer tests stay green.

#### Success Criteria: p2-s6-code-tuples

- Red then green for P2-B25 and P2-B27 with the smallest Vitest command per package, then `pnpm check` and `pnpm check:dead-code`. P2-B26 is green before and after.
- `rg -n '"REGISTRY_SCHEMA_NEWER"' apps packages -g '!*.test.*' -g '!**/tests/**'` finds only the tuple in `project-list-protocol.ts` and the producer `application-database-migration.ts:336` (10 hits today). `rg -n '"WRITER_LEASE_UNLOCK_FAILED"' apps packages -g '!*.test.*' -g '!**/tests/**'` finds only the protocol tuple and the producer `canonical-writer-lease.ts:66` (5 hits today).
- A type assertion in `registry-broken-codes.test.ts` (`expectTypeOf`) shows that `RegistryFailureSchema`'s broken code equals `RegistryBrokenCode`, and that `CanonicalWriterLeaseFailureCode` equals the 4 lease literals.
- **Heavy runs:** none at the candidate. The renderer tests are jsdom unit tests. The writer and registration integration tests run in `check:deep` before the push.
- **Bindings,** each restored by digest:
  - dropping `REGISTRY_SCHEMA_NEWER` from `registryBrokenCodes` makes P2-B25 and P2-B26 fail;
  - moving `PROJECT_STORAGE_RELEASE_FAILED` out of `writerReleaseFailureCodes` makes P2-B27 fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Questions for the coordinator

Q9. Where does the registry-broken set live, and does the renderer use it?

| Option | Files | Compile safety | Note |
|---|---|---|---|
| **(a) Recommended: protocol tuple next to `RegistryPendingRecoverySchema`, used by all 9 sites, the renderer included** | 9 source files | a renamed code breaks the renderer build | the renderer already imports runtime values from `@slopstop/protocol` in 5 files (`projects-list.tsx`, `projects-workspace.tsx`, …), which AGENTS.md allows |
| (b) protocol tuple; the renderer keeps its Sets, typed `satisfies readonly RegistryBrokenCode[]` | 9 | a renamed code breaks the build, but an added code does not | two copies remain; fails "One definition" |
| (c) protocol and harness only; the renderer stays `Set<string>` | 7 | none in the renderer | the finding's main risk stays |

Q10. Does L7-06 join s6?

| Option | Files | Note |
|---|---|---|
| **(a) Recommended: yes, one `writerReleaseFailureCodes` tuple and `Extract` unions** | 4 (`canonical-project-protocol.ts`, `canonical-writer-lease.ts`, `canonical-project-writer.ts`, `canonical-command-repository.ts`) | the 3 protocol lists become one; the harness unions derive from it |
| (b) no, keep as is | 0 | the review's own alternative ("compile-checked", severity Low); 6 lists remain |

Q11. Does `WRITER_FENCE_STALE` join the release tuple? It sits in the writer's release union, but the switch schema gives it `retryable: false`, apart from the other 8 (`retryable: true`).

| Option | Effect |
|---|---|
| **(a) Recommended: no.** The writer union is the tuple minus storage, plus `WRITER_FENCE_STALE`. | The switch schema keeps its two arms unchanged. |
| (b) yes | The switch schema must `Exclude` it from the `retryable: true` arm. The one tuple then means two `retryable` values, so it is no longer "the codes a release retries". |

Q12. Which lane does s6 run in? The rigorous trigger is only the file name: the change in `application-database-migration.ts:32` replaces one type union with `RegistryBrokenCode`, and touches no migration logic, SQL or stored value.

| Option | Lane | Cost |
|---|---|---|
| **(a) Recommended: keep the file in s6 and run rigorous as measured** | rigorous: intent review (slice-verifier, code and coverage reviewers) before approval, and the per-slice human acceptance | about three review agents (an agent fan-out, so it needs your GO); 1 of the 9 L7-01 sites is not left behind |
| (b) leave `application-database-migration.ts` out of s6 and name it a residual | normal, as s2-s5 | L7-01's "One definition" stays one type union short until a later slice touches that file |
| (c) keep the file, and you record a lane override to normal with this reason | normal | a recorded deviation from the lane script |

### 2026-10-25: p2-s6 approved, Q9 to Q12 decided (Pedro, confirmed by the coordinator)

- **p2-s6-code-tuples intent approved** at `content_hash` `aaeb6037e8e81add47f610739e3ed9217572638d45f7841375573c03e3057f69`. The approved copy is `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/approved-aaeb6037.md` in the main checkout.
- **Q9: option (a).** One protocol `registryBrokenCodes` tuple, used by all 9 sites, the 2 renderer Sets included.
- **Q10: option (a).** L7-06 joins s6: one `writerReleaseFailureCodes` tuple, and the harness unions derive from it.
- **Q11: option (a).** `WRITER_FENCE_STALE` stays out of the tuple. The writer union is the tuple minus `PROJECT_STORAGE_RELEASE_FAILED`, plus `WRITER_FENCE_STALE`.
- **Q12: lane override to normal (Pedro, 2026-10-25).** `lane.mjs --paths` measured rigorous. Its sensitive-word trigger "migration" is the file name `application-database-migration.ts`, whose change is one type union with no SQL. The file stays in s6, and the slice runs the normal lane.
- The contract (P2-B25 to P2-B27) stands as written.

### 2026-10-25: p2-s5 implementation notes (implementer, for the coordinator)

- **P2-B22 oracle mechanism:** `decodeWithIssues` reports a message only when the schema annotates one, and the contract's text `Expected a string matching the RegExp ^[0-9a-f]{64}$` is Effect's generated default. The test keeps `decodeWithIssues` for code and path and reads the message from Effect's Standard Schema formatter (`SchemaIssue.makeFormatterStandardSchemaV1`), as `project-storage-node-schemas.test.ts` already does. The asserted codes, paths and messages are the contract's, unchanged.
- **One extra source path:** `apps/harness/src/storage/canonical-writer-recovery.ts` imported the deleted `CanonicalSha256Schema`, so its two fields (`fingerprint`, `sourceDigest`) now import `Sha256HexSchema`. Same accepted set.
- **CodeScene:** 10 on every changed source file. `project-registration-flow-protocol.ts` has no score (schema declarations only). `registration-preparation.integration.test.ts` is 9.6, the same on `main`; s5 adds two table rows there.
- Evidence: `.rpiv/artifacts/evidence/2026-10-24_p2-s5-sha256-owner-tdd.md`.
- **Accepted amendment (coordinator, 2026-10-25):** the `canonical-writer-recovery.ts` rebind outside the planned source paths is accepted, because the file imported the deleted `CanonicalSha256Schema`.

### 2026-10-25: slice p2-s7-storage-operation-id detailed

Measured at `30554a8`, read-only while s5 held the brief; appended at `f93744a` (s5 committed). This contract follows Pedro's Q13 (a) (decision entry below).

#### Slice p2-s7-storage-operation-id

- **`slice_id`:** `p2-s7-storage-operation-id`. Lane: **normal** (`lane.mjs --paths` over the 8 planned source paths: "files: 8 > 5").
- **Finding:** L7-07, with acceptance "Upgrade ids use a named brand" and remediation "Add a protocol StorageOperationIdSchema or an exported alias".
- **Base:** the head after s6 on `fix/arch-review-phase-2`. It shares no file with s6; it shares `project-storage-node-adapters.ts` with s5 (`f93744a`).
- **Today: one borrowed brand under three names.** `ProjectStorageCreateRequestIdSchema` (`project-storage-protocol.ts:19`, root `LowercaseDomainIdentityTextSchema`, refusal message `Identity must use lowercase UUID text.`) also types:
  - `upgradeId` on the wire: the upgraded result (`project-upgrade-protocol.ts:102`) and the upgrade log line (`:173`);
  - the harness type `ProjectStorageUpgradeId` (`project-storage-upgrade.ts:25`, used in `project-storage-upgrade.ts` and `project-storage-store.ts`) and its producer (`project-storage-node-adapters.ts:133`);
  - the manifest's `storageOperationId` (`project-storage-manifest.ts:77`) and the pre-upgrade backup's `backupId` (`:116`);
  - the snapshot directory name check (`project-storage-filesystem-authority.ts:428`, `snapshots/<upgradeId>`).
- **The sharing is deliberate:** a staged upgrade's `upgradeId` is the target generation's `createRequestId` (`project-storage-upgrade-pipeline.ts:221`, `:243`), the generation manifest writes `storageOperationId: creation.createRequestId` (`project-storage-generation-manifest.ts:70`), and the v2 manifest refuses a mismatch with `Upgrade storage operation must equal its create request.` (`project-storage-manifest.ts:78-82`). CONTEXT.md: the staged upgrade is "the temporary single-marker form of the migration Storage operation", and the pre-upgrade backup lives "under `snapshots/<upgradeId>/`; both names denote the same backup".
- **Correction to the deferred line:** a brand is type-only, so neither option changes wire bytes, issue messages or stored rows. The deferred entry's "changes the wire only by name" was wrong.
- **Deliverable (Q13 (a)):**
  - In `project-storage-protocol.ts`, next to the create-request id: `StorageOperationIdSchema = ProjectStorageCreateRequestIdSchema` and `type StorageOperationId = ProjectStorageCreateRequestId`, with TSDoc naming the CONTEXT.md Storage operation and the deliberate equality above; exported from the index.
  - The naming sites use the alias: both wire `upgradeId` fields, `ProjectStorageUpgradeId` (becomes `StorageOperationId`, or an alias of it), the producer at `project-storage-node-adapters.ts:133`, the manifest `storageOperationId` and `backupId`, and the snapshot directory check.
  - `createRequestId` fields keep `ProjectStorageCreateRequestIdSchema`. No conversion is added at the join.
- **Message and code ledger** (D1): nothing added, removed or changed. **Wire:** no version 9 amendment.
- **Source paths:** `packages/protocol/src/{project-storage-protocol,project-upgrade-protocol,index}.ts`; `apps/harness/src/storage/{project-storage-upgrade,project-storage-store,project-storage-node-adapters,project-storage-manifest,project-storage-filesystem-authority}.ts`.
- **Test paths:** `packages/protocol/src/project-storage-protocol.test.ts`; `packages/protocol/src/project-upgrade-protocol.test.ts` (or the protocol test that already decodes upgrade results).
- **Dependencies:** s5 (`f93744a`, shared `project-storage-node-adapters.ts`); independent of s6.

#### Test Contract: p2-s7-storage-operation-id

Public seams: the protocol exports, through `decodeWithIssues`; `ProjectUpgradeResultSchema` and the upgrade log line schema.

- **Behavior P2-B28 (L7-07, Q13):** the Storage operation id has a protocol name.
  - Test: `names the storage operation id after its create request` in `project-storage-protocol.test.ts`. `StorageOperationIdSchema` is the same schema as `ProjectStorageCreateRequestIdSchema` (`toBe`); it accepts `00000000-0000-4000-8000-0000000000a1` and refuses `00000000-0000-4000-8000-0000000000A1` with exactly the root message `Identity must use lowercase UUID text.`; `expectTypeOf<StorageOperationId>().toEqualTypeOf<ProjectStorageCreateRequestId>()`.
  - Expected red: the import fails, because the protocol exports no `StorageOperationIdSchema`.
- **Behavior P2-B29 (pin, D1):** the upgrade id keeps its set and its equality.
  - Tests: `ProjectUpgradeResultSchema` `upgraded` and the upgrade log line accept the lowercase id and refuse the uppercase one with the same message; the v2 manifest decoder still refuses `storageOperationId` different from `createRequestId` with `Upgrade storage operation must equal its create request.` (existing manifest test, or one new row in `project-storage-manifest.test.ts`).
  - Expected red: none (pin).
- **TDD-exempt:** renaming the type at the harness naming sites. Reason: an alias is the same type; `pnpm typecheck` proves it. Oracle: the structural check below, and the storage upgrade tests stay green.

#### Success Criteria: p2-s7-storage-operation-id

- Red then green for P2-B28 with the smallest Vitest command, then `pnpm check` and `pnpm check:dead-code`. P2-B29 green before and after.
- `rg -n "upgradeId: ProjectStorageCreateRequestIdSchema|storageOperationId: ProjectStorageCreateRequestIdSchema|backupId: ProjectStorageCreateRequestIdSchema" apps packages -g '!*.test.*'` finds nothing; `rg -n "ProjectStorageCreateRequest\[\"createRequestId\"\]" apps` finds nothing.
- **Heavy runs:** none at the candidate; the upgrade integration tests run in `check:deep` before the push.
- **Binding,** restored by digest: making `StorageOperationIdSchema` its own brand makes the P2-B28 `toBe` and type rows fail.
- CodeScene `code_health_score` on every changed source file (target 10).

### 2026-10-25: p2-s7 approved, Q13 decided (Pedro, confirmed by the coordinator)

- **p2-s7-storage-operation-id intent approved** as described to the coordinator before this text was written (Q13 (a), exported alias at the naming sites, Q14 not needed). There is no separate approved copy for this section; its `content_hash` is the one stamped with this commit.
- **Q13: option (a).** `StorageOperationId` is an exported alias of `ProjectStorageCreateRequestId`, with the schema alias `StorageOperationIdSchema`. It names the CONTEXT.md Storage operation without fighting the deliberate equality between a staged upgrade's id and its target generation's create request. Accepted weakness: the compiler does not stop a plain create request id from being passed as an operation id (L7-07 severity Low, 0 drift).
- **Q14:** not needed.
- The contract (P2-B28, P2-B29) stands as written.

### 2026-10-25: p2-s5 slice-verifier round 1 (passed, 2 warnings; coordinator decision: one follow-up commit, no round 2)

- **V1, accepted amendment (option (a)), corrected exclusion reason:** three files on the s5 "stay as they are" list hash one text string, not buffers or composed inputs: `project-storage-create-inspection.ts` (the create-request fingerprint input, which `sha256Text` now also produces), `project-storage-upgrade-verification.ts` (`digestRows`, a `JSON.stringify` text) and `generated-migration-resources.ts` (the successor statements JSON and the predecessor source text). They now call `sha256Hex`, TDD-exempt with the same bytes. Proof: the pinned migration hashes `e21883d8…942c` and `e3a917fc…5b14` hold (`canonical-storage-identity-rebuild`), P2-B23, and the integration files that exercise the three sites. The byte and stream digests (`windows-file-identity.ts`, `repository-physical-observation.ts:116`, `project-storage-file-adapter.ts`) stay. `repository-physical-observation.ts:172` (`metadataFingerprint`, one `JSON.stringify` text) joined in a second follow-up commit (coordinator), proven by `registration-physical-identity` and `registration-physical-limits` (no test pins a literal value of it; stored and re-observed fingerprints come from the same function).
- **V2, correcting note for s6:** s6 was measured at `cdf6cb2` and says it touches no s5 file. Its base is the accepted s5 head on `fix/arch-review-phase-2` (the s5 follow-up commit). Four of its planned paths are s5 files: `packages/protocol/src/project-registration-flow-protocol.ts`, `packages/protocol/src/project-registration-protocol.ts`, `packages/protocol/src/index.ts` and `apps/harness/src/storage/canonical-command-repository.ts`. Some cited lines moved, for example `project-registration-protocol.ts:48` is now `:49` and `canonical-command-repository.ts:76` is now `:78`. The slice-verifier found no conflicting hunk.
- **Polish, recorded without change:** the s5 table's "8 ledger fields" is 7 in the ledger plus 2 in `canonical-writer-recovery.ts`; the P2-B22 formatter-message mechanism (implementation notes above) stands as recorded; the s5 integration log does not name its files (the evidence does).

### 2026-10-25: p2-s6 implementation, accepted amendments (coordinator, technical triage disclosed to Pedro)

- **Tuple placement:** `registryBrokenCodes`, `RegistryBrokenCodeSchema`, `RegistryBrokenCode` and `isRegistryBrokenCode` live in `packages/protocol/src/project-registration-protocol.ts`, next to `registeredProjectSelectionCodes`, not in `project-list-protocol.ts`. `project-list-protocol.ts` already imports `project-registration-protocol.ts`, which needs the tuple, so the planned placement makes an import cycle that dependency-cruiser's `no-circular` rule refuses. The Success Criteria `rg` for `"REGISTRY_SCHEMA_NEWER"` therefore finds the tuple in `project-registration-protocol.ts`.
- **No renderer Sets:** `add-repository-button.tsx` and `use-remove-from-list.ts` call `isRegistryBrokenCode`; the renderer holds no copy of the set.
- **P2-B26 oracle:** the renderer rows list the 3 codes literally (`damagedRegistryCodes`), apart from the tuple. Rows built from `registryBrokenCodes` would drop a removed code instead of failing it, so the binding could not bite.
- **Type assertions:** the `expectTypeOf` checks name harness types, which a protocol test cannot import, so they live in new `apps/harness/src/code-tuples.test.ts`, checked by `tsc --noEmit`.
- **Activation literal order:** in the activation diagnostic codes and the activation broken list, `WRITER_FENCE_ACTIVATION_FAILED` and `WRITER_FENCE_STALE` now come before the 8 spread release codes. The accepted sets are unchanged.
- Evidence: `.rpiv/artifacts/evidence/2026-10-25_p2-s6-code-tuples-tdd.md`.

### 2026-10-25: p2-s6 slice-verifier round 1 and p2-s7 implementation (coordinator decisions)

- **p2-s6 slice-verifier round 1:** passed, 0 findings. **Polish, recorded without change:** the activation-order amendment also covers the switch release arm, whose 8 codes now follow the tuple order (same set, no reader); P2-B25 decodes through `acceptsStrict`, the same strict decode as `decodeWithIssues`; the frontmatter `last_updated` was not bumped by the s6 commit; s7's "shares no file with s6" is wrong for `packages/protocol/src/index.ts`, which both change (s7's base is the s6 head, so the s7 verifier treats it as shared).
- **p2-s7 accepted amendment:** `apps/harness/src/storage/project-storage-registry-rows.ts:32` types its `createRequestId` as `ProjectStorageCreateRequestId` instead of `ProjectStorageCreateRequest["createRequestId"]`. The Success Criteria `rg` found it outside the planned paths; the change is type-only.
- Evidence: `.rpiv/artifacts/evidence/2026-10-25_p2-s7-storage-operation-id-tdd.md`.

### 2026-10-25: p2-s7 contract amendment (Pedro, confirmed by the coordinator)

- **User-decided amendment:** the protocol exports only the type alias `StorageOperationId = ProjectStorageCreateRequestId`, with TSDoc naming the Storage operation; there is no `StorageOperationIdSchema`. Reason: Knip (`check:dead-code`) refuses the schema alias as a duplicate export, and the decision is no Knip tag and no config change. Schema sites (the two wire `upgradeId` fields, the manifest `storageOperationId` and `backupId`, the producer and the snapshot directory check) decode with `ProjectStorageCreateRequestIdSchema`; the harness type `ProjectStorageUpgradeId` stays an alias of `StorageOperationId`.
- **P2-B28 amended:** the `toBe` schema row is dropped. The test keeps `expectTypeOf<StorageOperationId>().toEqualTypeOf<ProjectStorageCreateRequestId>()` and the lowercase and uppercase rows through `ProjectStorageCreateRequestIdSchema`. The binding becomes a type one: pointing the alias at another type makes `tsc` refuse the type row.
- **Success Criteria amended:** the first `rg` (`upgradeId:`/`storageOperationId:`/`backupId: ProjectStorageCreateRequestIdSchema`) no longer applies, because those sites use that schema by decision. The second `rg` (`ProjectStorageCreateRequest\["createRequestId"\]` in `apps`) still finds nothing.
