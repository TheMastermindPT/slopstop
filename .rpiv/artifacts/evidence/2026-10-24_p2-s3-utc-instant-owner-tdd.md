# TDD evidence: p2-s3-utc-instant-owner

- Design: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Follow-up 2026-10-24, slice p2-s3), committed at `2c9262a` and `8c28c90` (approval note only).
- Contract identity: approved copy `approved-589d0cd5.md`; append-only check at start: `keep`; `validate-artifact`: OK. Q3 (a), Q4 (a).
- Base: `8c28c90` on `fix/arch-review-phase-2`. The P2-B15 red ran on the `2c9262a` tree, whose source equals `8c28c90` (the later commit changes only the brief).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/p2-s3-*.log` in the main checkout.

## P2-B15: one UTC instant rule

- Test: `accepts only UTC instants with seconds (%s)` and `normalizes only trailing fraction zeros` in new `packages/protocol/src/utc-instant.test.ts`.
- Red (`p2-s3-b15-red.log`): 9 failed; the import of `UtcInstantSchema` and `normalizedUtc` is undefined. Matches the Expected red.
- Implementation: `UtcInstantSchema` (the RFC 3339 structure check with `.abort()`, then a `Z` filter and a seconds filter, both `custom`, with the default messages), `utcInstant(message)`, and `normalizedUtc` moved into `schema-codec.ts`; exported from `index.ts`. The structure check is factored as `dateTimeCheck`.
- The first green attempt failed one row: without `.abort()`, `2026-10-03 12:00:00Z` also reported the seconds issue. The Effect v4 docs (Context7 `/websites/effect_website_v4`, `Filter.abort`) say an aborting filter stops later checks.
- Green (`p2-s3-b15-green.log`): 9 passed.

## P2-B18: settlement keeps its message and acceptance set (pin)

- New row in `accepts only UTC settlement instants with seconds` (`schema-boundary-characterization.test.ts`): `+01:00` and `12:00Z` each report exactly `[{ code: "invalid_format", path: [], message: "Settlement time must include seconds and use UTC Z notation." }]`.
- The first draft of the row asserted code `custom`, which failed against today's code. Today the settlement rule is an `isPattern`, code `invalid_format`. This exposed the contract conflict that the coordinator decided as (a), recorded in the brief's Developer Context: `utcInstant(message)` keeps today's composition byte-identical.
- Before (`p2-s3-b18-pin-before.log`, settlement untouched): 9 passed. After (`p2-s3-b18-pin-after.log`, settlement on `utcInstant(...)`): 291 passed, including `canonical-project-protocol.test.ts`.

## P2-B16: stored instants refuse a minute-only value

- Tests: `rejects a minute-only stored instant (%s)` in `project-storage-node-schemas.test.ts` (`utcInstantSchema`) and `project-storage-manifest.test.ts` (the manifest `createdAt`, via `serializeProjectStorageManifest`).
- Red (`p2-s3-b16-red.log`): the 2 `minute only` rows failed (the value decoded); the 2 `+01:00` pin rows passed. Matches the Expected red.
- Implementation: `utcInstantSchema = UtcInstantSchema`; the manifest imports it instead of keeping its copy.
- Green (`p2-s3-b16-green.log`): 10 passed.

## P2-B17: the envelope `sentAt` is a UTC instant

- Tests: `rejects a non-UTC or minute-only message timestamp (%s)` in `schema-boundary-characterization.test.ts` (replaces `accepts message timestamps with offsets and without seconds`; 3 acceptance rows become rejections, 3 rejection rows stay) and in `protocol.test.ts` for `parseHarnessMessage`.
- Red (`p2-s3-b17-red.log`): the 6 new rejection rows failed (parsed `ok: true`); the 3 kept rejections passed. Matches the Expected red.
- Implementation: `TimestampSchema = UtcInstantSchema` in `protocol.ts`.
- The harness rows first expected code `invalid_format`; the owner reports `custom`, so the expectation was corrected before green.
- Green (`p2-s3-b17-green.log`): 64 passed.

## TDD-exempt rebinding

- `canonicalWriterUtcInstantSchema = UtcInstantSchema`; the ledger's `normalizedUtc` deleted, and the ledger and `canonical-writer-recovery.ts` import it from the protocol.
- The registration `createdAt`, `preparedAt` and `capturedAt` use `UtcInstantSchema`.
- The smoke fixture `utc` is `UtcInstantSchema` plus a 3-digit fraction check.
- `dateTimeTextSchema` is no longer exported.
- Oracle: `rg -n "dateTimeTextSchema\(" apps packages` finds only `schema-codec.ts`; `rg -n "UTC instant must end in Z" apps packages --glob '!*.test.*'` finds only the owner default. The writer-state and recovery integration rows: pending the GO.
- Issue-shape amendments (coordinator decision): recorded in the brief's Developer Context with the `rg` reader evidence.

## Bindings (each restored by digest)

- The owner's seconds filter loosened to `T\d{2}:\d{2}`: the P2-B15 `minute only` row fails (`p2-s3-binding-b15.log`).
- The envelope back on `dateTimeTextSchema({ offset: true })`: the 6 P2-B17 rows fail (`p2-s3-binding-b17.log`).
- The owner's `Z` filter without a message: both P2-B16 `offset` rows fail (`p2-s3-binding-b16.log`). The first attempt ran the harness test from the protocol package and matched no file; it was rerun from `apps/harness`.
- Settlement on `utcInstant("UTC instant must end in Z.")`, standing in for the default messages: the P2-B18 message row fails (`p2-s3-binding-b18.log`). Settlement on the default `UtcInstantSchema` would also change the code, so the message-only mutation isolates the message.

## Light checks

- `tsc --noEmit -p tsconfig.json`: `packages/protocol`, `apps/harness` and `apps/desktop` all exit 0.
- Protocol unit suite: 1211 passed. Harness `src/storage`, `src/registration`, `src/conversation` and neighbours: 509 passed.
- Biome: clean.
- CodeScene `code_health_score`: 10 on every changed source and test file, except `canonical-writer-package-smoke-fixture.ts` at 9.52. Its smell is `createWriterProofFixture.initialize` (Large Method, 86 lines, lines 380-465), a function this slice does not touch: the fixture diff is 3 lines near the top. It is reported to the coordinator, not refactored here.
- **Named residual (coordinator decision):** `canonical-writer-package-smoke-fixture.ts` scores 9.52 on `main` too (the coordinator measured it), so s3 does not degrade it. It stays unrefactored in s3 because it feeds the package smoke; the Large Method `createWriterProofFixture.initialize` is a residual for a later cohesion slice.

## Heavy gates (coordinator GO; CPU 1/6/4, no game process)

- `pnpm check`: exit 0, 104 files, 3548 tests passed; typecheck, Effect diagnostics (51 advisory warnings) and dependency-cruiser clean (`2026-10-24_p2-s3-check.log`). The `SlopStop failed to start.` line is expected test stderr, also present in the s2 and s2b green logs.
- `pnpm check:duplicates`: 0 clones. `pnpm check:dead-code`: Knip clean.
- Integration `canonical-command-repository-writer-state`, `canonical-writer-recovery`, `harness-runtime`: 3 files, 101 tests passed (`2026-10-24_p2-s3-integration.log`). This closes the writer-state and recovery oracle rows above.

## Slice-verifier round 1 follow-up (candidate `709e55a`)

- Result: passed, 0 violations, 2 warnings (V1, V2); the coordinator decided one follow-up commit and no round 2. Recorded in the brief's Developer Context.
- V2 pin: `accepts the same instants as the settlement time (%s)` in `utc-instant.test.ts`, 10 rows. Test-only, so no red is expected; `src/utc-instant.test.ts` 19 passed (`p2-s3-v2-pin.log`), protocol `tsc --noEmit` exit 0.
- Binding: the owner's seconds filter loosened to `T\d{2}:\d{2}` fails the `2026-10-03T12:00Z` pin row (`p2-s3-binding-v2.log`); `schema-codec.ts` restored by digest (`88eee6af…d452`).
