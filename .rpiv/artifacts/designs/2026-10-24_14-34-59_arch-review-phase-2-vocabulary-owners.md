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
last_updated: 2026-10-24T14:34:59+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Lean brief written; identity split into two slices (protocol root, then harness consumers); s1 detailed; later slices deferred with their questions."
content_hash: 961724bec7d1ce85e54c160eadd2ff32be5fadb34a9bca55c3f1faff2d7e0102
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

## References

- `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md`: Phase 2, IX-3, T2, and findings L7-03, L7-04, L7-05, L7-01, L7-06, L7-07, L4-09, L4-10, L5-03, L8-01, L4-05
- `docs/adr/0023-one-strict-identity-text-root.md` (Accepted 2026-10-24)
- `docs/adr/0001-repository-foundation.md` (Amendment 2026-10-03), `docs/adr/0006-physical-persistence-layout.md:45`
- `.rpiv/decisions/shared-vocab-union.md`, `.rpiv/decisions/degrade-distinguishes-broken.md`
- `.rpiv/artifacts/designs/2026-10-23_18-52-05_arch-review-phase-1-correctness-fixes.md` (Phase 1, landed as `4dbd834`)
- Precedent `43bc303` (2026-10-07)
