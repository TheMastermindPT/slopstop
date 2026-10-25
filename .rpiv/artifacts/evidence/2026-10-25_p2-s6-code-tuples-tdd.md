# TDD evidence: p2-s6-code-tuples

- Design: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Follow-up 2026-10-25, slice p2-s6), approved copy `approved-aaeb6037.md`; append-only check at start: `keep`. Q9 (a), Q10 (a), Q11 (a), Q12 lane override to normal (Pedro).
- Base: `1321c4d` (the accepted s5 head, per the s5 V2 note), not `cdf6cb2`.
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/p2-s6-*.log` in the main checkout.

## P2-B25: one registry-broken set

- Test: `names the registry-broken set once` and `carries every registry-broken code (%s)` in new `packages/protocol/src/registry-broken-codes.test.ts`.
- Red (`p2-s6-b25-red.log`): `TypeError: Cannot read properties of undefined (reading 'every')`; the import of `registryBrokenCodes` is undefined. Matches the Expected red.
- Implementation: `registryBrokenCodes`, `RegistryBrokenCodeSchema`, `RegistryBrokenCode` and `isRegistryBrokenCode` exported from the index. The 4 protocol lists spread the tuple; `registeredProjectSelectionCodes` spreads it first, keeping its order.
- **Placement (to report):** the contract places the tuple in `project-list-protocol.ts`. `project-list-protocol.ts` already imports `project-registration-protocol.ts`, which needs the tuple for `registeredProjectSelectionCodes`, so that placement makes an import cycle, which dependency-cruiser's `no-circular` rule refuses. The tuple lives in `project-registration-protocol.ts`, next to `registeredProjectSelectionCodes`, and `project-list-protocol.ts` imports it.
- Green (`p2-s6-b25-green.log`): 4 passed.

## P2-B26: the renderer treats every registry-broken code as damaged (pin)

- Tests: `shows a damaged registry as an alert and disables adding with the reason (%s)` (`projects-list.test.tsx`) and `treats a damaged registry as not updatable (%s)` (`remove-from-list.test.tsx`), plus one `INTERNAL_FAILURE` row each: `does not treat an internal list failure as a damaged registry` and `does not treat an internal removal failure as a damaged registry`. The existing texts and `Reference: <code>` stay the oracle.
- **Oracle correction (to report):** the first rows iterated `registryBrokenCodes`. The binding (dropping `REGISTRY_SCHEMA_NEWER` from the tuple) then removed that row instead of failing it: 30 passed. The rows now list the 3 codes literally (`damagedRegistryCodes`), apart from the tuple.
- Before the renderer change (the base `add-repository-button.tsx` and `use-remove-from-list.ts` swapped in, restored by digest `aa964b27…8249`, `e240677a…fcd8`): 32 passed (`p2-s6-b26-pin-before.log`). After: 32 passed (`p2-s6-b26-pin-after.log`).
- Implementation: both renderer modules call `isRegistryBrokenCode`; their local `Set<string>` copies are deleted. **Shape note (to report):** the contract keeps two renderer Sets built from the tuple, typed `ReadonlySet<RegistryBrokenCode>`. Both checks test a wider code, which the contract routes through the guard, so the Sets would only repeat it; the renderer holds no copy of the set.

## P2-B27: one writer release tuple

- Test: `names the 8 writer release codes once, without the stale fence` and `carries every writer release code (%s)` in `canonical-project-protocol.test.ts`.
- Red (`p2-s6-b27-red.log`): `TypeError: Cannot read properties of undefined (reading 'every')`; the import of `writerReleaseFailureCodes` is undefined. Matches the Expected red.
- Implementation: `writerReleaseFailureCodes`, `WriterReleaseFailureCodeSchema`, `WriterReleaseFailureCode` exported; the activation diagnostic codes and the activation broken list spread the tuple; the switch release arm is `diagnosticSchema(WriterReleaseFailureCodeSchema, Schema.Literal(true))`, with `WRITER_FENCE_STALE` apart at `retryable: false`. The literal order inside the activation lists moves `WRITER_FENCE_ACTIVATION_FAILED` and `WRITER_FENCE_STALE` before the 8; the accepted sets are unchanged.
- Green (`p2-s6-b27-green.log`): 280 passed (the whole file).

## TDD-exempt rebinding

- Harness registry copies: `RegistryFailureSchema` broken code is `RegistryBrokenCodeSchema`; `ApplicationDatabaseFailure` uses `RegistryBrokenCode`; `project-registration-preparation.ts` calls `isRegistryBrokenCode` (the `registryDataCodes` Set deleted).
- Harness unions: `CanonicalWriterLeaseFailureCode = Extract<WriterReleaseFailureCode, \`WRITER_LEASE_${string}\`>`; `CanonicalProjectWriterReleaseFailureCode = "WRITER_FENCE_STALE" | Exclude<WriterReleaseFailureCode, "PROJECT_STORAGE_RELEASE_FAILED">`; the repository union keeps its 2 non-release codes and `Extract`s the 2 release ones.
- **Type assertions (to report):** the Success Criteria put them in `registry-broken-codes.test.ts`, but they name harness types, which a protocol test cannot import. They live in new `apps/harness/src/code-tuples.test.ts` (`expectTypeOf`), checked by `tsc --noEmit`. Widening `CanonicalWriterLeaseFailureCode` by `PROJECT_STORAGE_RELEASE_FAILED` makes `tsc` fail in that file; restored.
- Oracle: `rg -n '"REGISTRY_SCHEMA_NEWER"' apps packages -g '!*.test.*' -g '!**/tests/**'` finds only the tuple (`project-registration-protocol.ts:52`) and the producer (`application-database-migration.ts:338`); `rg -n '"WRITER_LEASE_UNLOCK_FAILED"' …` finds only the tuple (`canonical-project-protocol.ts:145`) and the producer (`canonical-writer-lease.ts:66`).

## Bindings (each restored by digest)

- `REGISTRY_SCHEMA_NEWER` dropped from `registryBrokenCodes`: P2-B25 `names the registry-broken set once` fails (`p2-s6-binding-b25.log`); P2-B26 both `REGISTRY_SCHEMA_NEWER` rows fail (`p2-s6-binding-b26.log`). Restored to `c30f82a9…7d31`.
- `PROJECT_STORAGE_RELEASE_FAILED` moved out of `writerReleaseFailureCodes` (kept in the activation list): P2-B27 and two existing switch and activation tests fail (`p2-s6-binding-b27.log`). Restored to `fcb22008…f227`.

## Light checks

- `tsc --noEmit -p tsconfig.json`: protocol, harness, desktop exit 0. Biome clean.
- Unit suites: protocol 1242, harness 1064, renderer 395 passed.
- CodeScene: 10 on every changed source and test file, except `project-registration-preparation.ts` at 8.03, the named s4 residual (unchanged score).

## Heavy gates (coordinator GO; CPU 3/5/4, no game process)

- `pnpm check`: exit 0, 109 files, 3591 tests passed; typecheck, Effect diagnostics (51 advisory warnings) and dependency-cruiser clean (`2026-10-25_p2-s6-check.log`).
- `pnpm check:duplicates`: 0 clones. `pnpm check:dead-code`: Knip clean.
- The Success Criteria name no integration run at the candidate; the writer and registration integration tests run in `check:deep` before the push.
- The 4 deviations and the activation order are accepted amendments (coordinator), recorded in the brief.
