# TDD evidence: p2-s2-identity-harness-consumers

- Design: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Follow-up 2026-10-24, slice p2-s2), committed at `c679aa4`.
- Contract identity: approved copy `approved-b92d447f.md`; append-only check at start: `keep`; `validate-artifact`: OK.
- Base: `c679aa4` on `fix/arch-review-phase-2`. Lane: normal.
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/p2-s2-*.log` in the main checkout.

## P2-B7: a stored reservation with a non-strict identity is corrupt

- Test: `classifies a stored reservation with a non-strict identity as corrupt (%s)` and the control `reads a stored reservation whose identities are strict`, in `apps/harness/src/registration/registration-confirmation-store.test.ts`.
- Command: `pnpm vitest run src/registration/registration-confirmation-store.test.ts` (in `apps/harness`).
- Red (`p2-s2-b7-red.log`): 6 failed, 5 passed. Every non-strict row resolved ("The receipt check did not reject."); the control passed. Matches the Expected red.
- Implementation: `reservationSchema`, `reservationIdRowsSchema`, `requestRowsSchema`, `publicationRowsSchema` and `ConfirmationValidationRequestSchema.requestId` move to the protocol brands and the strict root; `findCommonReservation` and `readReservation` take `Pick<LocalLibsqlTransaction, "execute">`, as `readPublication` already does.
- Green (`p2-s2-b7-green.log`): 11 passed.
- Contract deviation (recorded for review): the contract lists "the `reservation_id` row value uppercase" and "the record's `reservationId` uppercase" as two rows. `readReservation` requires the row id and the record id to be equal, so the record's id cannot differ from the row's without failing agreement first. Both are covered by one row, `reservationId uppercase`, that changes both together. The record-only variant is not reachable through this seam.

## P2-B8: a published receipt with a non-strict stored identity stays corrupt (pin)

- Test: new rows `receipt storageId uppercase`, `receipt generationId nil`, `publication row requestId uppercase` in `classifies a receipt check failure: $name`.
- Before (`p2-s2-b8-pin-before.log`): the store source at `c679aa4` restored temporarily (digest-verified restore), `-t "receipt check failure"`: 7 passed.
- After (`p2-s2-b8-pin-after.log`): 14 passed. Oracle `REGISTRY_CORRUPT` with `generationReads` 0 holds.

## P2-B9: conversation rows read only strict identities

- Test: `treats a stored row with a non-strict identity as broken storage ($name)` in new `apps/harness/src/conversation/conversation-rows.test.ts` (4 fields × nil, max, uppercase).
- Red (`p2-s2-b9-red.log`): 12 failed at the refusal assertion ("expected false to be an instance of ConversationStorageBroken"); the valid row decoded in every case. Matches the Expected red.
- Implementation: `ConversationIdSchema`, `ConversationBranchIdSchema`, `ConversationMessageIdSchema`.
- Green (`p2-s2-b9-green.log`): 12 passed.

## P2-B10: a storage location identity follows the one stored-identity rule

- Test: `rejects a non-strict private location identity (%s)` in new `apps/harness/src/storage/project-storage-node-schemas.test.ts`.
- Red (`p2-s2-b10-red.log`): nil and max failed (decoded today); the uppercase pin passed with the kernel message. Matches the Expected red.
- Implementation: `privateLocationIdSchema = LowercaseDomainIdentityTextSchema`.
- Green (`p2-s2-b10-green.log`): 3 passed.

## TDD-exempt rebinding and deletion

- Sites: the 8 harness-only brands, the 5 imported protocol brands, `canonical-json`, `canonical-command-registry` (its extra `isDomainIdentity` check dropped), `canonical-command-repository` (handoff and recovery ids), `canonical-writer-recovery`, `observer-journal`, the proposal store, the three fixtures. `UuidTextSchema` deleted from `schema-codec.ts` and `index.ts`. `LowercaseDomainIdentityTextSchema` is now exported from `@slopstop/protocol`.
- Oracle: `rg "UuidTextSchema" apps packages` finds nothing; the brand `rg` finds nothing; no identity `value === value.toLowerCase()` filter remains in `apps/harness`. `pnpm typecheck` and Knip: pending `pnpm check`.
- Refactor gate: `readProposal` (unchanged behavior) split into `decodeProposalRecord` and `proposalRowAgrees` for CodeScene (cc 12 to below threshold).

## Bindings (each restored by digest)

- `reservationSchema.repositoryBindingId` loose: `repositoryBindingId uppercase` fails (`p2-s2-binding-b7.log`).
- conversation `messageId` without the lowercase rule: the 6 message rows fail, uppercase included (`p2-s2-binding-b9.log`).
- `privateLocationIdSchema` without the root: nil and max fail (`p2-s2-binding-b10.log`).

## Light checks

- Neighbouring unit tests (15 files): 301 passed.
- Biome: clean on the changed files.
- CodeScene `code_health_score`: 10 on every changed source and test file.

## Heavy gates (coordinator GO under Pedro's override "continua, estou a jogar")

- `pnpm check` run 1 (`p2-s2-check.log`): exit 1 at `apps/harness typecheck`, 4 errors, all in test files; kernel and protocol typecheck Done. Sequence stopped and reported.
  - `active-project-conversation.test.ts(262,19)` TS2322 and `active-project-coordinator.test.ts(775,9)` TS2322: the rebinding brands `MessageRow.messageId` as `ConversationMessageId`, which reaches `ProjectConversationPage`; both page fakes used plain strings.
  - `conversation-rows.test.ts(62,74)` TS7053 and `(65,34)` TS2345: typing faults in the new test.
  - Fix (test-only, no assertion change, no production change): the two fakes decode their `messageId` through `decodeStrict(ConversationMessageIdSchema, ...)`; the new test uses an `as const` spellings list and `expect.objectContaining` for the accepted row. Those 3 files: 79 passed.
- `pnpm check` run 2 on the fixed tree (coordinator GO: a fault fix, not a rerun): `p2-s2-check-2.log`.
  - Result: exit 1. Typecheck Done in all four packages (the run-1 fault is fixed). Vitest: 7 failed, 3507 passed (103 files), duration 54.77s, under game load.
    - 6 `desktop-renderer` tests: `TestingLibraryElementError: Unable to find role="button"` (`project-upgrade`, `projects-list`, `conversation-details`, `conversation-region`, `project-conversation`, `remove-from-list`).
    - 1 harness script test: `check-effect-diagnostics.test.mjs > fails on a planted Effect error: 'newPromise'`, `Test timed out in 5000ms`.
    - s2 touches no `apps/desktop` file; its protocol change is the `UuidTextSchema` removal and one new export, and typecheck passes. Not rerun, per the stop-and-report rule. Sequence stopped before `check:duplicates` and integration.
  - Discriminator (run by the coordinator, same game load, in `slopstop-p2`): `projects-list.test.tsx` and `project-upgrade.test.tsx` alone: 2 files, 60 passed. Coordinator reading: the renderer failures are load-sensitive waits in the full suite, not s2. `pnpm check` reruns when the machine is idle, on the coordinator's GO.
- `pnpm check` run 3, machine idle (CPU 7/8/0, no game process; Pedro said he had finished playing; the coordinator confirmed it as GO): exit 0, 103 files, 3514 tests, typecheck Done in all packages, Knip clean. Log: `2026-10-24_p2-s2-check.log`. The 7 run-2 failures did not recur.
- `pnpm check:duplicates`: exit 0, 0 clones.
- Integration (`vitest.integration.config.ts`): `registration-preparation-lifecycle`, `project-registration`, `canonical-command-repository`: 3 files, 474 passed, 85.40s. Log: `2026-10-24_p2-s2-integration.log`.
- Still open for `check:deep` before the push: the smoke fixture (`canonical-writer-package-smoke-fixture.ts`), `registration-owner-recovery-fixture.ts` consumers, and the other integration files.

## Correction and fix after slice-verifier round 1 (2026-10-24)

- **Correction:** the run-3 line above says "Knip clean". That is wrong. `pnpm check` has no Knip step (Knip is `pnpm check:dead-code`, run by `check:deep:shared`), so Knip did not run for `b109386`. The TDD-exempt oracle's "Knip in `pnpm check`" is met only by the separate `check:dead-code` run below.
- slice-verifier round 1 (`b109386`): failed on V1 (the harness's last `@slopstop/kernel` imports removed, the dependency, model edge and ADR count left behind) and V2 (this Knip claim); warnings V3, V4, V5. One review round only (coordinator decision); the fix delta goes to the combined acceptance.
- Fix commit (coordinator GO): `@slopstop/kernel` removed from `apps/harness/package.json` with `pnpm install` lockfile refresh; the `slopstop.harness -[imports]-> slopstop.kernel` edge removed from `docs/architecture/model.c4`; a dated factual note at ADR 0023 Brand Ownership (harness uses `isDomainIdentity` at 0 sites); V3, V4 and V5 recorded in the brief's Developer Context.
- Gates on the fix commit `b0a9a83` (coordinator GO), run alone. CPU first read 35/32/31 (above the rule), then 7/7/4 with no League/TFT/Overwolf process; the runs started after the second reading.
  - `pnpm check:dead-code` (Knip): exit 0, no findings. This is the Knip half of the TDD-exempt oracle.
  - `pnpm typecheck`: exit 0, all four packages Done.
  - `pnpm check:architecture` (`likec4 validate`): exit 0, valid, 0 errors.
  - Logs: `p2-s2-fix-check-dead-code.log`, `p2-s2-fix-typecheck.log`, `p2-s2-fix-check-architecture.log` in the gitignored evidence folder of the main checkout.
- s2 status: waits for the combined Phase 2 acceptance. Still needs-run in `check:deep` before the push: full integration (smoke and owner-recovery fixture consumers), e2e, launch smoke.
