# TDD evidence: p2-s4-registration-clock

- Design: `.rpiv/artifacts/designs/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners.md` (Follow-up 2026-10-24, slice p2-s4), committed at `ca6127b`.
- Contract identity: approved copy `approved-fa125147.md`; append-only check at start: `keep`; `validate-artifact`: OK. Q5 (a), Q6 (a).
- Base: `ca6127b` on `fix/arch-review-phase-2` (source equals `282edea`).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/p2-s4-*.log` in the main checkout.

## P2-B19: the harness clock answers a UTC instant

- Test: `answers the current time as a UTC instant` in new `apps/harness/src/utc-clock.test.ts`.
- Red (`p2-s4-b19-red.log`): `Cannot find module './utc-clock.js'`. Matches the Expected red.
- Implementation: new `apps/harness/src/utc-clock.ts` with `UtcClock` and `systemUtcClock` (`new Date().toISOString()` decoded by the protocol `UtcInstantSchema`).
- Green (`p2-s4-b19-green.log`): 1 passed.

## P2-B20: registration stamps every stored time from the injected clock

- Seam decision (coordinator, option (a)): `HarnessRuntimeIo` gains an optional `clock`; recorded as an accepted amendment in the brief's Developer Context. Before the red, only the types were added (`RegistrationDatabaseOptions.clock`, `HarnessRuntimeIo.clock`) and `registrationSession` learned to pass a clock; nothing read it.
- Test: `stamps every registration time from the injected clock (%s)` in new `apps/harness/tests/integration/registration-clock.integration.test.ts`, 14 rows. One session with the fixed clock `2026-10-24T12:00:00.000Z` registers its folder and removes it from the list; the test then copies one settled identity query as an attempt left unsettled after its terminal record, and a registry with the same clock reconciles it at start. Each row reads its stored values, asserts at least one, and asserts each equals the fixed instant.
- First red attempt: 1 row showed the expected wall-clock value; the other 13 failed with `unable to open database file`, because the session fixture removes its root after the first row. A test fault, not the expected red. The values are now read inside the first row, before the cleanup.
- Red (`p2-s4-b20-red.log`): 14 failed, each with a wall-clock instant (for example `2026-10-24T22:14:01.430Z`) against the fixed one, including the restart-reconciliation row. Matches the Expected red.
- Implementation: `registrationClock(options)` in `registry-database.ts` (the option or `systemUtcClock`). The registry passes the clock to the trust owner, the identity-query consent authority and the observer journal; the identity-query journal, the preparation, the confirmation reservation and the list removal read it from their options. All 15 `new Date().toISOString()` sites now read `clock.now()`.
- Green (`p2-s4-b20-green.log`): 14 passed.
- **Unproven gap:** `identity-query-journal.ts` `noDispatch` (`settled_at` without a child) runs only when the child is unavailable, the query is cancelled, or revalidation does not match before dispatch. The flow never reaches it, so this one site has no row of its own; it is rebound by the same mechanical change.

## P2-B21: a production registration still stores `toISOString` instants (pin)

- The existing registration integration tests build options without a clock and stay unchanged. Their run (`project-registration`, `registration-restart-reconciliation`) is pending the coordinator's GO.
- Added pin (coordinator): `gives a process started without a clock the system clock` in `process-bootstrap.test.ts`; `process-bootstrap.test.ts` plus `utc-clock.test.ts`: 16 passed (`p2-s4-clock-pin.log`).

## TDD-exempt rebinding

- Both `currentTime` lambdas deleted. The runtime's `now` is the process clock's `now`; `node-active-project-coordinator.ts` uses `systemUtcClock.now`; the storage default clock is `systemUtcClock`.
- Oracle: `rg -n "new Date\(|Date\.now\(" apps/harness/src -g '!*.test.ts'` finds only `utc-clock.ts`; `rg -n "currentTime" apps/harness/src` finds nothing.

## Bindings (each restored by digest)

- `observer-journal.ts` terminal `observed_at` back to `new Date().toISOString()`: the `observer terminal` row fails, 13 pass (`p2-s4-binding-b20.log`); restored to `d6ef86dc…d962`.
- `systemUtcClock` returning the value without `Z`: P2-B19 fails (`p2-s4-binding-b19.log`); restored to `6a521931…62e2`.

## Light checks

- `tsc --noEmit -p tsconfig.json` in `apps/harness`: exit 0. Biome: clean.
- Harness unit suite (`vitest run src`): 45 files, 1061 passed (`p2-s4-harness-unit.log`).
- CodeScene `code_health_score`: 10 on every changed source and test file except `project-registration-preparation.ts` at 8.03, which is also 8.03 at base (`main` holds the same file). Its smells are pre-existing: `confirm` and `inspectConfirmation` (Complex Method, cc 9), two complex conditionals, and duplicated blocks in `createProjectRegistrationPreparation`. s4 changes two argument lines there.
- **Named residual (coordinator decision):** `project-registration-preparation.ts` stays at 8.03, unrefactored in s4; it fits Phase 3, which reworks the registration failure paths.

## Heavy gates (coordinator GO; CPU 8/6/15, no game process)

- `pnpm check`: exit 0, 105 files, 3560 tests passed; typecheck, Effect diagnostics (51 advisory warnings) and dependency-cruiser clean (`2026-10-24_p2-s4-check.log`).
- `pnpm check:duplicates`: 0 clones. `pnpm check:dead-code`: Knip clean.
- Integration `registration-clock`, `project-registration`, `registration-restart-reconciliation`: 3 files, 130 tests passed in 62 s (`2026-10-24_p2-s4-integration.log`). This is the P2-B21 pin: the existing registration tests, without a clock, stay green unchanged.

## Slice-verifier round 1 follow-up (candidate `112101e`)

- Result: passed, 0 violations, 2 Decisions warnings; the coordinator decided one follow-up commit and no round 2. Recorded in the brief.
- V1: the two `process-bootstrap.ts` TSDoc lines now name what the clock feeds (registration times and message `sentAt`); the fuller wiring into storage, the canonical registry options and the coordinator is a named residual.
- V2: P2-B21 "before" accepted from `project-registration` at `b109386` (s2) and `registration-restart-reconciliation` at `be87690` (s2b); both files unchanged since (`git diff --stat` empty).
- Light check: `tsc --noEmit` in `apps/harness` exit 0; Biome clean.
