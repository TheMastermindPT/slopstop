# TDD evidence: p2-s1-identity-protocol-root (append-only)

- Brief: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md`, content_hash `961724be…0102` (approved copy `approved-961724be.md`), ADR `docs/adr/0023-one-strict-identity-text-root.md`.
- Worktree `slopstop-p2`, branch `fix/arch-review-phase-2`, parent commit `c9e5cb1` for every state below.
- State digest: sha256 (first 16 hex) over `git diff HEAD --binary` plus `sha256sum` of each untracked file, sorted.
- Commands run from the worktree root.

## P2-B1: the kernel recognizes only strict lowercase identities

- Test: `packages/kernel/src/workspace-identifiers.test.ts`, "recognizes only boundary-safe identities and revisions" (extended).
- Seam note: the kernel cannot import the protocol's `decodeWithIssues` (the kernel depends on no workspace package). The kernel test reads the issue with Effect's `SchemaIssue.makeFormatterStandardSchemaV1` (path and message). The `code: "custom"` projection is pinned on the protocol side by the existing storage rows (P2-B6), which decode through the same kernel filter.
- **Red** (state `84e8303b4ae6ecd3`): `pnpm exec vitest run packages/kernel/src/workspace-identifiers.test.ts` → 1 failed: `018F47A3-4E3D-7D2B-9C41-7DF4605C0A11: expected true to be false` at line 29. Matches Expected red (the `/iu` pattern accepts uppercase).
- Implementation: `lowercaseDomainIdentity(message)` and `LowercaseDomainIdentityTextSchema` in `workspace-identifiers.ts`; `isDomainIdentity` decodes through it.
- **Green** (state `c0dae935bfc189da`): same command → 1 passed.

## P2-B2: a message identity is as strict as a domain identity

- Tests: `schema-boundary-characterization.test.ts` "keeps domain and message identities strict and lowercase" (replaces "keeps domain identities lowercase and message identities broad"); `canonical-writer-smoke-protocol.test.ts` "rejects a non-strict MessageId (%s)" (replaces "preserves legacy MessageId acceptance %s"); `protocol.test.ts` "rejects an envelope whose messageId is the nil identity".
- **Red** (state `82e03490227ad474`): `pnpm exec vitest run packages/protocol/src/schema-boundary-characterization.test.ts packages/protocol/src/canonical-writer-smoke-protocol.test.ts packages/protocol/src/protocol.test.ts` → 5 failed, 694 passed. The 3 smoke rows `expected true to be false`; the envelope row `expected { ok: true, … }`; the characterization row `00000000-…: expected true to be false`. Matches Expected red.
- Implementation: `MessageIdSchema = LowercaseDomainIdentityTextSchema.pipe(Schema.brand("MessageId"))` in `protocol.ts`.
- **Stop (contract gap, state below):** the 5 P2-B2 rows pass, but `pnpm exec vitest run --project protocol --project kernel` → 21 failed, 1087 passed. All 21 are two acceptance pins outside the ADR 0023 census, in `canonical-writer-smoke-protocol.test.ts` (from `97678d2`):
  - line 216 "retains valid uppercase MessageId spelling" (11 closed-envelope fixtures: `proofId` = `uppercaseMessageId`);
  - line 254 "retains valid uppercase requestId spelling" (10 correlation fixtures: `requestId` = `uppercaseMessageId`).
  - The census counted literals; these rows use the constant `uppercaseMessageId`, so the scan missed them. The brief says "6 acceptance pins … no other assertion change".
  - No source fix is made for them; the decision is with the coordinator and Pedro.
- **Decision (Pedro, via coordinator AskUserQuestion, 2026-10-24):** option (a). The two extra pins flip to "rejects uppercase MessageId spelling" and "rejects uppercase requestId spelling" (`decodeWithIssues(...).success` false). The smoke nil/max exclusion and its message are removed as an accepted text removal. Both recorded in the brief's Developer Context; append-only check: keep.
- **Green** (state `449cfa9b6abe8914`): `pnpm exec vitest run --project protocol --project kernel` → 10 files, 1108 passed.

## P2-B3: workspace identities refuse uppercase

- Test: `packages/protocol/src/workspace-protocol.test.ts`, "rejects an uppercase workspace identity (%s)", `it.each` over the 13 workspace brand schemas.
- **Red** (state `ca87e4d7ca34461d`): `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts` → 13 failed, 13 passed: `expected undefined to deeply equal [ { code: 'custom', path: [], …(1) } ]` (uppercase decodes). Matches Expected red.
- Implementation: the 13 brands in `workspace-protocol.ts` move from `DomainIdentityTextSchema` to `LowercaseDomainIdentityTextSchema`.
- **Green** (state `2cda9e0dd17b7970`): same command → 26 passed.

## P2-B4: registration, flow and conversation-save ids are strict; registration brands exported

- Test (new): `packages/protocol/src/project-registration-protocol.test.ts`.
  - "rejects a non-strict registration identity (%s)": 56 rows, one per loose UUID field: every renderer step under both `RendererRegistrationRequestSchema` and `ProjectRegistrationRequestSchema` (21 fields each), the `ProjectRegistrationResultSchema` id fields (5), `RepositoryChoiceResultSchema.repositorySelectionId`, `InitialRepositoryBindingSchema` (reservationId, repositoryBindingId, workspaceId, registrationRequestId), `RegisteredProjectSchema` (requestId, proposalId, repositoryBindingId, workspaceId). The two result schemas go beyond the brief's list; they hold the remaining loose flow sites. Oracle: valid decodes; nil, max and uppercase each fail with issue paths exactly `[[field]]`.
  - "exports the strict %s brand": the four registration brands accept valid lowercase and reject nil.
- **Red** (state `a49b703a5328305c`): `pnpm exec vitest run packages/protocol/src/project-registration-protocol.test.ts` → 60 failed: `00000000-…: expected true to be false` (nil decodes) and `TypeError: Cannot read properties of undefined (reading 'ast')` (brand schemas not exported). Matches Expected red.
- Implementation: `project-registration-flow-protocol.ts` and `project-registration-protocol.ts` move every `UuidTextSchema` to `LowercaseDomainIdentityTextSchema`; the four brands (`RepositoryBindingIdSchema`, `WorkspaceIdSchema`, `RegistrationRequestIdSchema`, `RegistrationProposalIdSchema`) and their types are exported through `index.ts`.
- **Green** (state before the saveId test): same command → 60 passed.
- Test: `project-conversation-protocol.test.ts`, "rejects a non-strict save id (%s)".
  - First red run (state `0dce39dc0511d43d`) used `saveId.toUpperCase()`; the fixture is digit-only, so that row tested nothing new. The fixture was changed to `ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF` before any implementation.
  - **Red** (state `d4e5c4432eee51bf`): `pnpm exec vitest run packages/protocol/src/project-conversation-protocol.test.ts` → 3 failed, 80 passed, `expected true to be false`. Matches Expected red.
  - Implementation: `saveId: LowercaseDomainIdentityTextSchema`.
  - **Green** (state `f41013044ccfbc70`): same command → 83 passed.

## P2-B5: a version-8 peer is refused as an unsupported version

- Test: `protocol.test.ts`, "refuses a version-8 peer as an unsupported version": `protocolVersion` is 9; `parseHarnessMessage` of a version-8 `system.failure` event and `parseDesktopMessage` of a version-8 handshake each answer `PROTOCOL_VERSION_UNSUPPORTED` with `[{ code: "unsupported_value", path: "protocolVersion" }]`.
- First run (state `2c59b897d269aa06`) failed on fixture setup (`SchemaError: Expected null at ["causationId"]`): not the expected red. The failure event's `causationId` was set to `null` before any implementation.
- **Red** (state `8b15191d8ea45d39`): `pnpm exec vitest run packages/protocol/src/protocol.test.ts -t "version-8 peer"` → `expected 8 to be 9`. Matches Expected red.
- Implementation: `protocolVersion = 9`. The version literals moved to 9: 30 `protocolVersion: 8` sites in the 11 planned files, plus 3 `expect(protocolVersion).toBe(8)` pins and 3 test titles ("protocol version 8") in `protocol.test.ts`. No other assertion changed. `git grep "protocolVersion: 8"` over apps and packages finds only the two new version-8 rows.
- **Green** (state `42c935281992ce74`): `pnpm exec vitest run packages/protocol/src/protocol.test.ts` → 45 passed.

## P2-B6: pins (green before and after)

- Green after the kernel filter move (see P2-B1): storage, canonical-project and smoke files, 922 passed.
- Final single-file runs (state `1f0c0a6351f210a0`, before CodeScene): kernel 1, schema-boundary-characterization 11, canonical-writer-smoke-protocol 644, workspace-protocol 26, project-registration-protocol 60, project-conversation-protocol 83, project-storage-protocol 5, canonical-project-protocol 271, `apps/harness/src/harness-runtime.test.ts` 104: all passed.

## TDD-exempt: the 23 kernel identity type shadows

- Deleted the 14 in `workspace-identifiers.ts` and 9 in `project-storage-identifiers.ts`, and their `index.ts` exports. `DomainIdentity<Name>` stays (the return type of `isDomainIdentity`).
- Oracle so far: `pnpm --filter @slopstop/kernel --filter @slopstop/protocol typecheck` → both Done. Full `pnpm typecheck` and Knip are pending inside `pnpm check` (no full-tree run while Pedro plays).

## Bindings (restored by digest, before = after = `1f0c0a6351f210a0`)

- `MessageIdSchema` back on `UuidTextSchema` → schema-boundary-characterization 1 failed (P2-B2 row).
- `WaypointIdSchema` on `DomainIdentityTextSchema` (no lowercase) → workspace-protocol 1 failed: its P2-B3 row.
- `PreparationFields.trustId` back on `UuidTextSchema` → project-registration-protocol 4 failed: the prepare and confirm `trustId` rows under both request schemas.

## Other checks

- `rg "UuidTextSchema" packages/protocol/src` → only `schema-codec.ts:68` (definition) and `index.ts` (export).
- CodeScene `code_health_score`: 10 for kernel `workspace-identifiers.ts`, protocol `protocol.ts`, `project-registration-protocol.ts`, `workspace-protocol.ts`, `canonical-writer-smoke-protocol.ts`, `project-conversation-protocol.ts`, and the new test file. No score (`{"score":null,"review":[]}`, declaration-only, no functions) for `project-registration-flow-protocol.ts` (same on main), `domain-identity-schema.ts` and `project-storage-identifiers.ts`.
- Pending (coordinator GO required, Pedro playing): `pnpm check`, `pnpm check:duplicates`, the two integration files; then the commit, preflight and slice-verifier.
- Code-complete state: `1f0c0a6351f210a0`.

## Gates at the code-complete state (coordinator GO, Pedro override "continua")

- CPU before the run (own call): 59/57/43 %, League client open, no game process. The GO was given at the coordinator's reading of 37-41 %; the override covered this step.
- `pnpm check` → exit 0: format, lint, typecheck (kernel, protocol, desktop, harness Done), Effect diagnostics verified (51 advisory warnings), `vitest run` 101 files / 3489 passed, depcruise no violations. Log: `2026-10-24_p2-s1-check.log`.
- `pnpm check:duplicates` → exit 0, golden SQL verified, 0 clones.
- Note: Knip is not part of `pnpm check` (it is `check:dead-code`, in `check:deep`). The exempt step's oracle so far is the full `pnpm typecheck`; Knip runs in `check:deep` before the push.
- Pending GO: `harness-runtime.integration.test.ts` and `canonical-project-activation.integration.test.ts`.
- **Coordinator GO 2 (CPU 6/10/6):** my own reading 7/18/4 %, 0 game processes.
  - `pnpm check:dead-code` (Knip) → exit 0, no findings. This closes the exempt-step oracle (full typecheck plus Knip).
  - `pnpm exec vitest run --config vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts` → exit 0, 2 files / 11 passed. Log: `2026-10-24_p2-s1-integration.log`.
