# TDD evidence: p2-s7-storage-operation-id

- Design: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Follow-up 2026-10-25, slice p2-s7), approved copy `approved-e4688df7.md`; append-only check at start: `keep`. Q13 (a).
- Base: `e197ba8` (the s6 head).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/p2-s7-*.log` in the main checkout.

## P2-B28: the Storage operation id has a protocol name

- Test: `names the storage operation id after its create request` in `packages/protocol/src/project-storage-protocol.test.ts`.
- Red (`p2-s7-b28-red.log`): `expected undefined to be [Function Schema]`; the protocol exports no `StorageOperationIdSchema`. Matches the Expected red.
- Implementation: `StorageOperationIdSchema = ProjectStorageCreateRequestIdSchema` and `type StorageOperationId = ProjectStorageCreateRequestId` in `project-storage-protocol.ts`, with TSDoc naming the Storage operation and the equality with the generation's create request; exported from the index.
- Green (`p2-s7-b28-green.log`): 6 passed (the whole file). The `expectTypeOf` row is checked by `tsc --noEmit`.

## P2-B29: the upgrade id keeps its set and its equality (pin)

- Tests: `keeps the upgrade id set and message (%s)` in `protocol.test.ts` (the `upgraded` result and an `abandoned` upgrade log line: the lowercase id decodes; the uppercase one refuses with exactly `[{ code: "custom", path: ["upgradeId"], message: "Identity must use lowercase UUID text." }]`), and `refuses an upgrade storage operation that differs from its create request` in `project-storage-manifest.test.ts` (throws with `Upgrade storage operation must equal its create request.`).
- Before the rebind (`p2-s7-b29-pin-before.log`): protocol 2 passed; manifest file 6 passed. After (`p2-s7-b29-pin-after.log`): the same.

## TDD-exempt rebinding

- **Superseded by the amendment below:** both wire `upgradeId` fields use `StorageOperationIdSchema`; `ProjectStorageUpgradeId` is an alias of `StorageOperationId`; the producer (`project-storage-node-adapters.ts`), the manifest `storageOperationId` and `backupId`, and the snapshot directory check use the alias. `createRequestId` fields keep the create-request id.
- **One extra path (to report):** the Success Criteria `rg -n "ProjectStorageCreateRequest\[\"createRequestId\"\]" apps` also found `project-storage-registry-rows.ts:32` (a create-request id, not in the planned paths). It now uses the type `ProjectStorageCreateRequestId`, as `project-storage-store.ts` does.
- **Superseded by the amendment below:** oracle: both Success Criteria `rg` checks find nothing. (After the amendment the first `rg` is retired and finds the 4 expected schema sites; the second still finds nothing.)

## Binding (restored by digest)

- **Superseded by the amendment below:** `StorageOperationIdSchema` as its own brand (`LowercaseDomainIdentityTextSchema.pipe(Schema.brand("StorageOperationId"))`): the `toBe` row fails at run time (`p2-s7-binding-b28.log`) and `tsc` refuses the `expectTypeOf` row (`p2-s7-binding-b28-tsc.log`). Restored to `b1b659cb…0a7e`.

## Light checks

- `tsc --noEmit -p tsconfig.json`: protocol, harness, desktop exit 0. Biome clean.
- **Superseded (pre-amendment counts):** unit suites: protocol 1245, harness 1065 passed; CodeScene: 10 on every changed source and test file. The post-amendment counts are in the follow-up section at the end.

## First gate run: two failures (stopped)

- `pnpm check` (`p2-s7-check.log`) failed at its first step, `format:check`: the one-line import I wrote into `project-storage-registry-rows.ts` with `sed` was over the line width.
- **Process slip:** the background wrapper `pnpm check > log; echo "exit=$?"` printed the real `exit=1`, but the task status was the trailing `echo`'s 0, and I read the status instead of the printed line. I then also ran `check:duplicates` (0 clones) and `check:dead-code` against the stop rule. Fix: the background command is now the gate alone (no trailing `echo`), so the task status is the gate's own exit, and each exit is read before the next gate.
- `check:dead-code` (`p2-s7-dead-code.log`) failed: Knip `Duplicate exports: ProjectStorageCreateRequestIdSchema|StorageOperationIdSchema`.

## Amendment (Pedro, 2026-10-25)

- Only the type alias `StorageOperationId` is exported; `StorageOperationIdSchema` is removed, and its sites decode with `ProjectStorageCreateRequestIdSchema`. Recorded in the brief.
- P2-B28 amended (`p2-s7-amended-green.log`): the `toBe` row is dropped; the type row and the lowercase/uppercase rows through `ProjectStorageCreateRequestIdSchema` remain; protocol `project-storage-protocol.test.ts` and `protocol.test.ts` 56 passed; manifest file 6 passed (`p2-s7-amended-manifest.log`).
- Binding (amended): `StorageOperationId = StorageId` makes `tsc` refuse the `expectTypeOf` row (`p2-s7-binding-b28-amended.log`); restored to `79652109…d732`.
- `project-storage-registry-rows.ts` formatted with Biome. `tsc --noEmit`: protocol, harness, desktop exit 0.

## Heavy gates, rerun (coordinator GO; CPU 13/15/5, no game process)

- `pnpm check`: exit 0 (the task status is now the gate's own), 109 files, 3595 tests passed; typecheck, Effect diagnostics and dependency-cruiser clean (`2026-10-25_p2-s7-check.log`).
- `pnpm check:duplicates`: exit 0, 0 clones. `pnpm check:dead-code`: exit 0, Knip clean. Each exit read before the next.

## Slice-verifier round 1 follow-up (candidate `71f8c58`)

- Result: passed, 0 violations, 0 warnings, judged against the amendment; polish only. Coordinator: one follow-up commit, no round 2.
- Lines that describe the tree before the amendment are marked superseded above.
- TSDoc narrowed: only a staged upgrade's id is said to equal its generation's create request id (export and delete operations create no generation).
- Post-amendment counts: `pnpm check` at the amended tree ran every unit suite, 3595 passed (`2026-10-25_p2-s7-check.log`); after the TSDoc change, protocol unit 1245 passed (`p2-s7-followup-protocol-unit.log`) and protocol `tsc --noEmit` exit 0. CodeScene 10 on `project-storage-protocol.ts` and `project-storage-registry-rows.ts`.
- The amended P2-B28 has no red at base of its own: its one binding element is the type row, whose failure is shown by the amended type binding (`p2-s7-binding-b28-amended.log`).
