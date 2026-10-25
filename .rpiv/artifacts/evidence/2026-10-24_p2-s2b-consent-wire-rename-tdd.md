# TDD evidence: p2-s2b-consent-wire-rename

- Design: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Follow-up 2026-10-24, slice p2-s2b), committed at `730b72e`.
- Contract identity: approved copy `approved-928e8e2c.md`; append-only check at start: `keep`; `validate-artifact`: OK. Q2 (a): the protocol owns and exports the flow brands; wire fields stay unbranded.
- Base: `730b72e` on `fix/arch-review-phase-2`. Lane: normal.
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/p2-s2b-*.log` in the main checkout.

## P2-B11 and P2-B13 (protocol)

- Tests in `packages/protocol/src/project-registration-protocol.test.ts`: `names the executable and identity-query consents apart (%s)` and `exports the registration flow brands (%s)`. The s1 P2-B4 rows renamed their field lists (`executableConsentId`, `identityQueryConsentId`), with no other assertion change.
- Command: `pnpm vitest run src/project-registration-protocol.test.ts` (in `packages/protocol`).
- Red (`p2-s2b-b11-b13-red.log`): the 4 consent rows failed at the new-key decode ("expected false to be true"); the 7 brand rows failed at the import (`TypeError: Cannot read properties of undefined (reading 'ast')`); the renamed s1 rows failed the same way. Matches the Expected red.
- Implementation: seven brands with types in `project-registration-flow-protocol.ts`, exported from `index.ts`; the `PreparationFields`, `decide-git-version` and `decide-identity-queries` keys renamed.
- Green (`p2-s2b-b11-b13-green.log`): 71 passed.
- Contract deviation (recorded for review): the contract says the legacy request fails "with an issue at path `consentId`". The project vocabulary reports an unknown key at its owning object, naming the key. The test pins the exact issues: `{ code: "unrecognized_keys", path: [], keys: ["consentId"] }` and `{ code: "invalid_type", path: [<new key>] }`.

## P2-B12 (harness)

- Test: `routes each wire consent to its own consent` in `apps/harness/src/registration/project-registration-flow.test.ts`, with the recording fake `recordingFlow()`.
- Red (`p2-s2b-b12-red.log`): the `decide-git-version` call rejected with `SchemaError: Expected string | null at ["consentId"]`; no fake port was called. The reason matches the Expected red (the flow read `request.consentId`, which is `undefined`, and its `decodeStrict` threw). Difference from the contract wording: the answer was a rejected promise (a defect), not `INTERNAL_FAILURE`.
- Implementation: `project-registration-flow.ts` maps `executableConsentId` and `identityQueryConsentId` to the internal `consentId`; `registration-proposal-steps.ts` maps `identityQueryConsentId` into `admission.consentId`.
- Green (`p2-s2b-b12-green.log`): 2 passed.

## P2-B14 (renderer)

- Test: `sends each consent under its own name` in `apps/desktop/src/renderer/add-repository/add-repository.test.tsx`. It also checks that the two consents differ.
- Red (`p2-s2b-b14-red.log`): "expected undefined to deeply equal Any<String>" at the `executableConsentId` read. Matches the Expected red.
- Implementation: `use-add-repository.ts` sends `executableConsentId` and `identityQueryConsentId`, and `GitApproval` carries `identityQueryConsentId` into preparation.
- Green (`p2-s2b-b14-green.log`): 24 passed.

## TDD-exempt brand imports and sender renames

- The harness imports the seven brands (`project-registration-observer.ts`, `identity-query-consent.ts`, `registration-proposal-store.ts`, `repository-trust.ts`) and declares none.
- Senders renamed (key names only): `registration-package-smoke.ts`, the e2e `registration.test.ts`, `registration-flow-fixture.ts` (with its `GitConsent` type), `registration-flow-runtime.integration.test.ts`, `registration-restart-reconciliation.integration.test.ts:77`.
- Oracle so far:
  - the brand `rg` over `apps/harness` finds nothing; the only registration brand the harness declares is `RegistrationReservationId`;
  - `rg -n "consentId" packages/protocol/src apps/desktop/src` finds only the new keys plus the two refusal tests that name the legacy key;
  - `pnpm typecheck` and `pnpm check:dead-code`: pending the coordinator's GO.
- Harness-internal `consentId` stays (admission, registry calls, journals, SQL), as the brief decides.

## Bindings (each restored by digest)

- `decide-git-version` accepting `consentId` as an alias: its P2-B11 row fails (`p2-s2b-binding-b11.log`).
- The two flow mappings swapped: P2-B12 fails (`p2-s2b-binding-b12.log`).
- The renderer not threading the identity-query consent into preparation (`crypto.randomUUID()` in its place): P2-B14 fails (`p2-s2b-binding-b14.log`). The renderer keeps no executable consent id after the version check, so "reusing the git-version consent id" cannot be written literally; this is the nearest mutation.

## Light checks

- Protocol unit suite: 1194 passed. Harness `src/registration` + observer: 108 passed. Renderer add-repository: 24 passed.
- Biome: clean on the changed files.
- CodeScene `code_health_score`: 10 on every changed file; `project-registration-flow-protocol.ts` returns no score (declarations only, no smells), as in s1. The flow test's fake moved into `recordingFlow()` for the Large Method rule.

## Pending (coordinator GO)

- `pnpm check`, `pnpm check:duplicates`, `pnpm check:dead-code`, and `registration-flow-runtime.integration.test.ts` + `registration-restart-reconciliation.integration.test.ts`. Results in the next section.

## Heavy gates (coordinator GO; Pedro: "continua, ja esta livre"; my CPU read 5/1/3, no TFTClient process)

- `pnpm check` run 1 (`p2-s2b-check.log`): exit 1 at `packages/protocol typecheck`, 4 × TS2532 "Object is possibly 'undefined'" at `project-registration-protocol.test.ts:192-195`: the new `consentSteps` table indexed `rendererSteps[i][0]` under `noUncheckedIndexedAccess`. Kernel typecheck Done; nothing after protocol typecheck ran. Sequence stopped and reported; `check:duplicates`, `check:dead-code` and integration not run.
  - Fix (test-only, no assertion change): the rows name only the step and key; a `stepRequest(step)` helper finds the valid request in `rendererSteps`. The file: 71 passed; `tsc --noEmit -p tsconfig.json` in `packages/protocol`: exit 0.
- `pnpm check` run 2 on the fixed tree (coordinator GO: a fault fix, not a rerun; CPU 3/2/1, no TFTClient): exit 0, 103 files, 3527 tests, typecheck Done in all packages. Log: `2026-10-24_p2-s2b-check.log`.
- `pnpm check:duplicates`: exit 0, 0 clones.
- `pnpm check:dead-code` (Knip): exit 0, no findings. With the typecheck in `pnpm check`, this completes the TDD-exempt oracle.
- Integration (`vitest.integration.config.ts`): `registration-flow-runtime` and `registration-restart-reconciliation`: 2 files, 7 passed, 5.43s. Log: `2026-10-24_p2-s2b-integration.log`.
- Still open for `check:deep` before the push: the e2e `registration.test.ts`, the package smoke (`registration-package-smoke.ts`), and the other integration files.
