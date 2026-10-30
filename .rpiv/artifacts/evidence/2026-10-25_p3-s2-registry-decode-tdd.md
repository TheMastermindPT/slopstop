# TDD evidence: p3-s2-registry-decode

- Design: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md` (Follow-up "slice p3-s2-registry-decode detailed"), `content_hash bfa0b603…`, approved copy `approved-1c3af438.md`; append-only check at start: `keep`. Q2 (a), Q10 (a), Q11 (a), Q12 (a).
- Base: `02e24be` (the designer's brief commit on the s1 head `fd9afcd`).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s2-*.log` in the main checkout. Each log heads with the parent commit, the working-tree patch digest, the command and its exit.

## P3-B3: stored registry data that does not decode answers `REGISTRY_CORRUPT`

- Test: `classifies stored registry data that does not decode as corrupt (%s)` in new `apps/harness/src/registration/registry-database.test.ts` (3 rows: a row that fails its schema, `"{"`, `"{}"` without a required field), plus `returns the named, decoded rows` and `returns the decoded stored JSON`. Oracle: a `RegistryFault` whose `failure` is `{ status: "broken", code: "REGISTRY_CORRUPT" }`, and `registryFailure(thrown)` the same value.
- Red (`p3-s2-b3-red.log`): 5 failed, `TypeError: decodeRegistryRows is not a function` / `decodeRegistryJson is not a function`. Matches the Expected red.
- Implementation: `registryCorruptFailure` and `registryCorrupt()` in `registry-failure.ts`; `decodeRegistryRows(schema, result)` and `decodeRegistryJson(schema, text)` in `registry-database.ts` (`decodeStrictResult`; a failure, or a `JSON.parse` error, throws `registryCorrupt()`).
- Green (`p3-s2-b3-green.log`): 5 passed. **Note:** that tree had briefly lost the `registryRows` export (my edit replaced it; `tsc` caught it). The test does not import it, but the green is re-recorded on the complete tree (`p3-s2-b3-green-2.log`): 5 passed.

## P3-B4: stored damage the database admits answers `REGISTRY_CORRUPT` at every observable site

- Test: `answers a stored registration value that does not decode as corrupt (%s)` in new `apps/harness/tests/integration/registration-stored-damage.integration.test.ts`, rows a to i of the brief's table, under `describe.runIf(win32 && x64)`.
- Fixture: one `createRepositoryTrustScenario` installation built in `beforeAll`, stopped, then copied per row. Each row plants its damage with `node:sqlite` (checks and foreign keys on), reads the planted value back, and checks `PRAGMA integrity_check` = `[{ integrity_check: "ok" }]` and `PRAGMA foreign_key_check` = `[]` before the public operation.
  - Rows g, h, i plant their own version consent, because `registration_observer_intents` has a unique index on `consent_id`.
  - Row f calls the version observer over the reopened registry; its child port rejects if it is ever dispatched.
- Timing: one row 2.4 s, the whole file about 2.6 s (well under 2 minutes).
- First red (`p3-s2-b4-red.log`): 8 rows answered `INTERNAL_FAILURE`; row g failed at its read-back precondition (`exit_code: 0`, because the base already holds a terminal row). That is a fixture fault, not an accepted red. The read-back now names the planted observation.
- Red (`p3-s2-b4-red-2.log`, plus a JSON report): all 9 failed with one identical error, which Vitest groups as `[1/9]`: the answer `{ status: "broken", code: "INTERNAL_FAILURE" }` (only the `code` line differs from the expected value). Every precondition held. Matches the Expected red.
- Implementation: the 33 sites use the helpers; the 3 raw-cell sites read a named one-field row (`identity-query-consent.ts` and `repository-trust.ts` already select `decision`; `observer-journal.ts` selects `exit_code AS exitCode`), each schema keeping one row at most, with the same SQL predicates. Agreement checks call `registryCorrupt()`. `list-visibility.ts` decodes inside its `registryRead` callback; `existing-registration.ts` uses `registryCorruptFailure`. R2: `decodeProposalRecord`, `corruptProposal`, `readReservation`'s catch-all and `decodeSavedRequest` are gone; `readPublication`'s catch stays. `registryRows` is deleted, not only unexported (no caller is left; `decodeRegistryRows` reads `applicationDatabaseRows` directly).
- Green (`p3-s2-b4-green.log`): 9 passed.

## P3-B5: the guarded reservation reads keep their answer (pin)

- Tests: two rows added to `classifies a stored reservation with a non-strict identity as corrupt (%s)` in `registration-confirmation-store.test.ts`: `reservation row absent` and `recordJson not JSON` (`"{"`). The fake gains an optional `StoredRow` answer.
- Before (`p3-s2-b5-pin-before.log`): the 11 source files at `02e24be` swapped in, 8 passed; restored, every digest checked (`sha256sum -c`). After (`p3-s2-b5-pin-after.log`): 8 passed; whole file (`p3-s2-b5-pin-after-2.log`): 16 passed.
- **Contract correction (to report):** the brief says a missing reservation row "today ... comes from a `TypeError` caught by the catch-all" and that the new code "throws `registryCorrupt()` explicitly". `reservationKeyRowsSchema` is a one-element `Schema.Tuple`, so a missing row already fails the decode (base: a `SchemaError` caught by the catch-all; now: `decodeRegistryRows` answers corrupt). An explicit `row === undefined` guard is unreachable; I removed the one I had added and left a one-line comment naming the tuple.

## P3-B6: the no-dispatch settlement is stamped from the injected clock (pin)

- Test: `stamps the no-dispatch settlement from the injected clock` in `registration-clock.integration.test.ts`, under the file's `process.platform === "win32"` guard. `createRepositoryTrustScenario`, trust accepted; the owner gets `{ ...consentRegistryOptions(root), clock }` and a child that returns `{ status: "unavailable", code: "GIT_UNAVAILABLE" }` without `onOwned`.
- Oracle: the result equals that value; the one attempt row is `{ child_json: null, settled_at: "2026-10-24T12:00:00.000Z", result_json: JSON.stringify(result) }`.
- Before (`p3-s2-b6-pin-before.log`, base sources swapped in): 1 passed. After (`p3-s2-b6-pin-after.log`): 1 passed.

## Structural checks (`apps/harness/src/registration -g '!*.test.*'`)

- `rg -n "registryRows\("`: nothing (the brief expected only `registry-database.ts`; the private function is deleted).
- `rg -n "JSON\.parse"`: only `registry-database.ts:73`.
- `rg -n "decodeStrict(Result)?\([^)]*\.rows\b"`: nothing.
- `rg -n '"REGISTRY_CORRUPT"'`: exactly `registry-failure.ts:33`.
- `rg -n "catch \{"` in the two stores: nothing. The brief expected the `readPublication` catch, but that catch is written `catch (error)` (it was at the base too); it stays at `registration-confirmation-store.ts:358`.

## Bindings (each restored by digest)

- Helpers rethrow the raw error (`p3-s2-binding-raw-error-b3.log`, `-b4.log`): P3-B3's 3 corrupt rows fail; all 9 P3-B4 rows fail with `INTERNAL_FAILURE`. Restored `723139cd…23af`.
- `observer-journal.ts` result read back to `decodeStrict(…, JSON.parse(…))` (`p3-s2-binding-row-f.log`): only P3-B4 row f fails. Restored `c45d6ec5…ff76`.
- `readReservation` returns `undefined` for a missing row, as the brief words it (`p3-s2-binding-missing-reservation.log`): **does not bite** (8 passed), because the one-row tuple refuses the missing row first (see P3-B5). Replacement on the real mechanism (`p3-s2-binding-missing-reservation-v2.log`): the tuple loosened to `Array` with at most one row, and `undefined` for a missing row: `reservation row absent` fails (`The read did not reject.`). Restored `d1c7819a…aa60`.

## Light checks

- `tsc --noEmit -p apps/harness/tsconfig.json`: exit 0 (only the harness is touched). Biome clean.
- Harness unit suite (`p3-s2-harness-unit.log`): 51 files, 1181 passed.
- CodeScene: 10 on all 11 source files and the 4 test files.
- Defended sites: no reachable plant was searched for beyond the brief's measurement; none was added (raise-only rule unused).

## Accepted amendment (coordinator, 2026-10-25)

- The third binding is replaced by the binding on the one-element tuple (`p3-s2-binding-missing-reservation-v2.log`), with the brief correction under P3-B5: a missing reservation row is refused by `reservationKeyRowsSchema` (a one-element `Schema.Tuple`), at the base and now; the explicit guard was unreachable and is not in the code.

## Heavy gates (coordinator GO; my CPU readings 2/1/0, no game process)

- `pnpm check` (`p3-s2-check.log`): exit 0, 109 files, 3619 tests passed; typecheck, Effect diagnostics (51 advisory, unchanged) and dependency-cruiser clean. Its head digest is the tree before the amendment note above, which was appended during the run; that note is the only difference, in this `.md`, which no gate reads.
- `pnpm check:duplicates` (`p3-s2-duplicates.log`): exit 0, 0 clones. `pnpm check:dead-code` (`p3-s2-dead-code.log`): exit 0, Knip clean.
- Candidate integration (`p3-s2-integration.log`): `project-registration`, `registration-restart-reconciliation`, `registration-identity-query-lifecycle`, `registration-clock`, `registration-preparation`: 5 files, 159 passed, exit 0 (64 s).
- Each exit was read before the next gate.

## Preflight (candidate `566e7b4`)

- From the worktree root (`p3-s2-registry-decode-preflight.log`): `missing-test-file` for P3-B3, P3-B4 and P3-B6 (the contract names bare filenames in two folders), P3-B5 `unchecked` (a table edit, no new title).
- From `apps/harness/src/registration` (`…-preflight-registration.log`): P3-B3's file and title resolve; from `apps/harness/tests/integration` (`…-preflight-integration.log`): P3-B4's and P3-B6's resolve. No `missing-test-title` anywhere. The remaining findings are the brief's bare cross-folder paths, the brief-format class the coordinator accepted for s1 (rpiv draft `20261025-150017-075be3a8` covers bare filenames). P3-B5 goes to the slice-verifier as unchecked reviewer focus.
- Lane re-check `lane.mjs --range 02e24be..566e7b4`: normal (`lines: 325 > 150`).

## Slice-verifier round 1 (candidate `150d0df`) and the V1 follow-up

- Result: passed, 0 violations; Decisions OK, Research OK; one Cross-slice warning, V1 (pre-existing). Identity needs-run settled at the clean `150d0df`: the 4 contract test files, 21 unit + 24 integration passed (`p3-s2-at-150d0df-unit.log`, `p3-s2-at-150d0df-integration.log`).
- **V1:** `project-listing.ts` ran `readHiddenProjectIds` through `Effect.runPromise`, which rejects with the `RegistryReadFailed` itself; `listRegisteredProjects`' catch (`registryFailure`) has no branch for it, so hidden-row damage answered `INTERNAL_FAILURE` on the listing while `inspectProposal` answered `REGISTRY_CORRUPT` for the same row, and a busy hidden-row read lost `REGISTRY_BUSY`. Same at the base.
- **User-decided amendment (Pedro, 2026-10-25, D1 ledger; confirmed by the coordinator with AskUserQuestion):** fix now. `listProjects` answers `REGISTRY_CORRUPT` for hidden-row damage and `REGISTRY_BUSY` for a busy hidden-row read.
- Tests (`registration-stored-damage.integration.test.ts`): raise-only P3-B4 row `j: hidden project id (listing)` (a BLOB `project_id` planted in `registration_list_visibility`, read back as `blob`, healthy database, then `listRegisteredProjects`), and `answers a busy hidden-row read as busy when listing` (the client seam of `registration-identity-query-lifecycle`: every transaction's visibility `SELECT` rejects with a `SQLITE_BUSY`-coded error). A real held write transaction is not used: it makes the listing's own `BEGIN` busy before the hidden-row read, which answers `REGISTRY_BUSY` today already, so it would prove nothing.
- Red (`p3-s2-v1-red.log`): row j `INTERNAL_FAILURE` (expected `REGISTRY_CORRUPT`); busy row `{ status: "broken", code: "INTERNAL_FAILURE" }` (expected `{ status: "unavailable", code: "REGISTRY_BUSY" }`); the other 9 passed.
- Implementation: `registryReadRejection(failed)` in `registry-effect.ts` (owner of `RegistryReadFailed`) gives a registry failure as its `RegistryFault` and an internal failure as is (`INTERNAL_FAILURE` is not a `RegistryFailure`; both answer the same through `registryFailure`, so that branch is behaviour-neutral and has no binding); the listing facade runs `Effect.mapError(readHiddenProjectIds(transaction), registryReadRejection)` before `runPromise` (Effect 4 `mapError`, checked in Context7 `/websites/effect_website_v4`). The other registration `runPromise` facades either catch `RegistryReadFailed` (`list-visibility.ts:91` via `catchTag`) or never fail with it.
- Green (`p3-s2-v1-green.log`): 11 passed.
- Binding (`p3-s2-v1-binding.log`): `registryReadRejection` returning the raw failure: row j and the busy row fail. Restored `6fd46644…4610`.
- Light checks: `tsc --noEmit` harness exit 0, Biome clean, harness unit 1181 passed (`p3-s2-v1-harness-unit.log`), CodeScene 10 on `registry-effect.ts`, `project-listing.ts` and the integration test. Polish left as the coordinator decided; no round 2.
