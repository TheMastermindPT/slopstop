# TDD record: p3-s6b-stryker-range-alignment

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `c14caef2…`; approved copy `approved-1432f57c.md` (main checkout evidence folder).
- Base: `de02777` (p3-s6a closed). Candidate: `418b2c8`. No source file under `apps/*/src` or `packages` changed between `07c46e5` (the brief's read) and `de02777`.
- Lane: normal. Decisions: Q51 (a) one scoped mutation run on the final candidate; Q52 (a) sidecar anchors; Q53 (a) the `main.ts` items go back to their `34641bc` intent; Q54 (a) the dead and changed ranges go to Pedro before any anchor is written.
- Mutant counts: the instrumenter method of s5b-bridge (`range-mutants.mjs`, scratchpad), no test run. The old counts read the file extracted at the writing commit.

## Static prediction, written before any run

### Rows (`apps/harness/scripts/check-stryker-ranges.test.mjs`, 15 rows)

- P3-B36: 2 rows (all matching → `ok` with per-config `{ config, ranges, wholeFiles }`; a line inserted inside a range → the same `ok`).
- P3-B37: 12 rows (insertion above → `DRIFT` with the single re-pointed range; boundary text changed at `a` and at `b` → `DRIFT`, no suggestion, 2 rows; pair found twice → `DRIFT` naming both; `UNANCHORED`; `STALE_ANCHOR`; `BROKEN` for missing source, past end, `a > b`, invalid config JSON, invalid anchors JSON, `file:1:2-3:4`, 6 rows).
- P3-B38: 1 real-repository row.

### Reds

1. Red 1 (P3-B36, P3-B37 and P3-B38 together): the module does not exist. Vitest fails the file at import: 1 failed file, 0 tests run. This is the contract's expected red; no row runs.
2. Red 2 (P3-B38, after the module is green on its 14 temp-root rows and before any anchors file exists): the real row alone fails, `ok: false`, code `STRYKER_RANGE_UNANCHORED`, 81 lines (one per range: 23 + 16 + 7 + 3 + 2 + 30). A missing anchors file is read as "no anchors", so every range is unanchored, never clean and never `BROKEN`.
3. Green: 15/15 once the realign and the anchors file land. The real row's count is 81 ranges, or 81 minus the ranges Pedro removes under Q54, and 68 whole-file entries plus 1 for the new `stryker.stryker-ranges.config.json` (its one whole-file entry), across the 11 configs.

### Bindings (each applied alone, restored by digest)

- B1 ignore line `b` in the boundary comparison → exactly 1 failure (the `b` boundary row).
- B2 an unreadable source returns `ok` → exactly 1 failure (the missing-file row).
- B3 drop the found-twice branch, first location wins → exactly 1 failure (the found-twice row).
- B4 skip column-form entries → exactly 1 failure (the `file:1:2-3:4` row).

### Structural

- `scripts.check` contains `pnpm check:mutation-ranges`.
- `pnpm check:mutation-ranges` exit 0 on the candidate; exit 1 with `STRYKER_RANGE_DRIFT` after a one-line insertion above a range (reverted by digest).

## Q54 report, measured at `de02777` (before any anchor)

The configs today hold 81 ranges and 68 whole-file entries in 10 configs; there are no globs, negations or column forms. Mutant counts are instrumenter counts.

| # | Entry today | Writing commit | Unit when written (mutants then) | What the range points at today (mutants today) | Candidate |
|---|---|---|---|---|---|
| 1 | `canonical-project-protocol.ts:252-252` (`stryker.config.json`) | `34b7477` (squash; source unreachable, read at the squash) | `"WRITER_CLIENT_ABANDON_FAILED",` in `CanonicalProjectActivationResultSchema`'s `Schema.Literals` (1) | `if (value === null) return true;` in `isFiniteJson`, foreign code (4) | **dead.** `316e596` (phase 2, shared-vocab-union) merged the three copies into `writerReleaseFailureCodes` (`:141-150`), spread at `:162` and `:246`. The literal is at `:149` only, inside an `as const` array: 0 mutants; the spreads: 0. The intended mutant no longer exists anywhere. Remove. |
| 2 | `canonical-project-protocol.ts:419-419` (`stryker.config.json`) | `34b7477` (as above) | the same literal in `switchReleaseDiagnosticSchema`'s `Schema.Literals` (1) | `switchOutcomeSchema("inactive", "PROJECT_INACTIVE"),`, foreign code (2) | **dead**, same cause. Remove. |
| 3 | `project-registration-preparation.ts:225-279` (`stryker.config.json`) | `34b7477` (as above) | `pendingCreation` (`:225`) to `drainPreparations`' closing brace (`:279`) (43) | the same unit, now at `230-277`, with 5 lines in front (`OperationResult` type) and 2 after (blank, comment); every mutant is in the unit (38) | **re-point to `230-277`** (38, the same 38). The 5 lost mutants are the `registryDataCodes` set, which `316e596` moved to `isRegistryBrokenCode` in `packages/protocol/src/project-registration-protocol.ts:50-62`; that file is in no Stryker config. s7 refactors this file next. |
| 4 | `main.ts:294-323` (`stryker.desktop-s6`) | `34641bc` (inside `4cf6541`'s source range) | the `workspaceClosing` constant and `registerWorkspaceIpc` (11; the constant itself is `as const`, 0) | the end of `WindowOptions` and `createWindow`'s body, foreign code (15) | **re-point to `273-288`** (`registerWorkspaceIpc`, 11: the same handlers and gates). The constant became `closingDiagnostic`, `workspaceQueryClosing` and `workspaceIntentClosing` in `workspace-bridge.ts:100-113` (5), already covered by `stryker.desktop-s7`'s `workspace-bridge.ts:101-271` and `stryker.config.json`'s whole-file entry. |
| 5 | `main.ts:96-106` (`stryker.desktop-s6`) | `34641bc` | `let shutdownServices` to `createDesktopShutdown`'s `reportFailure` line (16) | 2 lines below the unit: a comment to `quit: () => app.quit(),` (20) | **`94-104`** (16; text-identical, Q53 (a)). |
| 6 | `main.ts:441-441` (`stryker.desktop-s6`) | `34641bc` | `if (!desktopShutdown.accepting()) return;` (3) | `smokeHarnessReady = true;`, foreign (1). At the squash `4cf6541` it was a blank line. | **`406-406`** (3; text-identical, Q53 (a)). |
| 7 | `writer-proof-report.ts:8-18` (`stryker.desktop-s6`, set by `07c46e5`) | `34641bc` as `main.ts:123-139` | the `WriterProofReportFailed` class and `writeWriterProofReport` (6) | the function only (5); the class line and its tag literal are out | **`4-18`** (6; Q53 (a)). |
| 8 | the dropped `main.ts:139` template mutant | none | never in the range at `34641bc`: `reportUnconfirmedWriterProof` was `:141` there | `main.ts:120-127` (6), reached only by package smoke | **not re-added** (Q53 (a)). |

Not asked, found while measuring:

- `canonical-project-protocol.ts:156-156` (the audit's "shifted" `156` → `149`) held 0 mutants when it was written (the literal in an `as const` array) and `:149` holds 0 today. Today `:156` is `"PROJECT_ALREADY_ACTIVE",`, also 0. The realign keeps it a 0-mutant range either way. It goes to Pedro with the rest.

## User decisions on Q54 (Pedro, relayed and confirmed by the coordinator, 2026-10-27)

1. `canonical-project-protocol.ts:252-252` and `:419-419`: remove.
2. `project-registration-preparation.ts:225-279`: re-point to `230-277`, and add `packages/protocol/src/project-registration-protocol.ts:50-62` (`isRegistryBrokenCode`) to `stryker.config.json` to win back the lost mutants. If the config's tests do not reach it, stop before anchoring; no test is added without telling the coordinator.
3. `main.ts:294-323`: re-point to `273-288`.
4. `canonical-project-protocol.ts:156-156` (the 0-mutant range): remove.
5. Q53 stands: `main.ts:96-106` → `94-104`, `441-441` → `406-406`, `writer-proof-report.ts:8-18` → `4-18`; the `:139` mutant is not re-added.

## Measured against decision 2 (instrumenter, before any edit)

- The 5 mutants the preparation unit lost (`225-279` at `34b7477` → `230-277` today: 43 → 38), by mutator:
  - 4 from the `registryDataCodes` set: one `ArrayDeclaration` and three `StringLiteral` (the `new Set([...])` array literal);
  - 1 `ArrowFunction`: the old `catch: (error) => error`, which s5b replaced with `catch: untypedRejection` (no arrow left to mutate).
  - The `listingCleanupFailed` `LogicalOperator` and `BooleanLiteral` mutants are still in the unit, now on `isRegistryBrokenCode(...)`.
- `project-registration-protocol.ts:50-62`: **0 mutants.** The owner's array is `as const`, which the instrumenter does not mutate (as `:149` above), and `has()` has no mutator. The one mutant in the unit is `isRegistryBrokenCode`'s `BlockStatement` (`{}`), which spans `61-63`: the range must end at `63`, the function's closing brace, to hold it. `50-63`: 1 mutant.
- The 4 set mutants cannot be won back: their array literal no longer exists. The arrow mutant left with s5b.
- Reach (static): `packages/protocol/src/registry-broken-codes.test.ts` is in the root `vitest.config.ts` projects (`packages/*/vitest.config.ts`), imports `isRegistryBrokenCode`, and asserts `toBe(true)` for each of the three codes and `toBe(false)` for two others. The `BlockStatement` mutant returns `undefined`, so the `toBe(true)` rows kill it. The tests reach the range; the stop condition does not apply. Proven only by the Stryker dry run and the run of `stryker.config.json`, both heavy and gated.
- Question to the coordinator: `50-62` as decided (0 mutants) or `50-63` (1 mutant)? The anchors wait for the answer; the count below is the same either way.

## Prediction, updated (the earlier prediction above stays as written)

- Ranges after the realign: 81 − 3 (`:156`, `:252`, `:419`) + 1 (the owner range) = **79**. Per config: `stryker.config.json` 21, `stryker.desktop-s6` 16, `stryker.desktop-s7` 7, `stryker.desktop-s8` 3, `stryker.ledger` 2, `stryker.project-storage` 30. Whole-file entries: 68 + 1 (the new `stryker.stryker-ranges.config.json`) = 69, in 11 configs.
- Order: Red 1 (import failure, 0 tests), then green on the 14 temp-root rows, then the config realign, then Red 2: the real row alone fails `STRYKER_RANGE_UNANCHORED` with **79** lines (no anchors file yet), then the anchors and 15/15.
- Instrumenter counts for each changed range, today → after:

| Config | Entry before → after | Mutants before → after | Mutants when written |
|---|---|---|---|
| `stryker.config.json` | `canonical-project-protocol.ts:156-156` → removed | 0 → — | 0 (`34b7477`) |
| `stryker.config.json` | `canonical-project-protocol.ts:252-252` → removed | 4 (foreign) → — | 1 |
| `stryker.config.json` | `canonical-project-protocol.ts:419-419` → removed | 2 (foreign) → — | 1 |
| `stryker.config.json` | `project-registration-preparation.ts:225-279` → `230-277` | 38 → 38 | 43 |
| `stryker.config.json` | new `project-registration-protocol.ts:50-62` (or `50-63`) | — → 0 (or 1) | — |
| `stryker.desktop-s6` | `main.ts:96-106` → `94-104` | 20 → 16 | 16 (`34641bc`) |
| `stryker.desktop-s6` | `writer-proof-report.ts:8-18` → `4-18` | 5 → 6 | 6 |
| `stryker.desktop-s6` | `main.ts:294-323` → `273-288` | 15 (foreign) → 11 | 11 |
| `stryker.desktop-s6` | `main.ts:441-441` → `406-406` | 1 (foreign) → 3 | 3 |

The brief's shifted and changed ranges in other configs (`active-project-coordinator.ts`, `project-registration-preparation.ts:294-307` and `:367-383`, `registration-listing.ts`, `project-registration-observer.ts`, `registry-database.ts`, `project-storage-upgrade-node-adapter.ts`) are realigned under the brief's own rule and get their rows in the realign table at that step.

## User decision on the owner range (Pedro, relayed and confirmed by the coordinator, 2026-10-27)

- The new range is `packages/protocol/src/project-registration-protocol.ts:50-63` (1 mutant, the `isRegistryBrokenCode` body), not `50-62`.
- The 5 old mutants are recorded as code that no longer exists: 4 from the old `new Set([...])` literal, 1 (the catch arrow) removed in s5b.
- The count stays 79. The real reach of `50-63` is open until the gated Stryker dry run of `stryker.config.json`.

## Coordinator decision (a) on the P3-B36 inside-insertion row (2026-10-27; the brief is not edited)

- The brief's row "a line inserted inside one range, boundaries unchanged" cannot hold: an insertion inside a range moves line `b`, so the config is stale.
- P3-B36's second row becomes an in-place edit of an interior line (brief: "an edit inside a range whose boundary lines stay put passes").
- P3-B37 gains one row: a line inserted inside `src/a.ts:3-5` → `STRYKER_RANGE_DRIFT`, `src/a.ts:3-5 moved to src/a.ts:3-6` (and the range below it `8-10 moved to 9-11`).
- The rule this row needs, beyond the brief's text: when the pair is not found at the range's own distance, a first line and a last line each found exactly once, in order, name the resized range. A changed boundary line (found nowhere) still gives no suggestion.

## Prediction, updated again (the earlier predictions stay as written)

- 16 rows: P3-B36 2, P3-B37 13, P3-B38 1. Red 1 unchanged (import failure, 0 tests). Green on the 15 temp-root rows, then Red 2 (real row, `UNANCHORED`, one line per range), then 16/16.
- Bindings unchanged: B1-B4 each exactly 1 failure.

## The realign audit, measured at `de02777` (data only; no config edited yet)

Method: `s6b-realign-audit.mjs` (scratchpad). For each range, the writing commit is the one that last wrote its config line; for the squash `4cf6541`, the newest commit in its source (`6561077`) found with `git log -S`; for `34b7477`, `c8a72d1`, `ff162f5` and `67f59fc`, the squash itself ("writing commit unreachable, read at the squash"). The block at the writing commit is compared with today's file. Output: `realign-audit-de02777.json`; mutant counts for all 81 ranges: `all-ranges-mutants-de02777.tsv` (scratchpad `s6b-q54/`).

Result: 55 text-identical, 13 found once elsewhere, 13 changed. Against the brief's audit (taken at the squashes), the pre-squash read finds more:

**A. Changed units the brief did not list (drifted already at the squash `4cf6541`; each needs Pedro's decision):**

| Config | Entry | Writing commit | Held when written (mutants) | Holds today (mutants) | Candidate (mutants) |
|---|---|---|---|---|---|
| `desktop-s6` | `project-entry-ipc.ts:42-43` | `34641bc` | the list handler's 2-line closing gate (3) | `decodeStrict(...)` and the 1-line gate (4) | `43-43`, the gate (3) |
| `desktop-s6` | `project-registration-ipc.ts:18-21` | `b0e92fc` | the `registrationUnavailable` constant (0) | blank line to `registrationCapability`'s return, foreign (4) | remove: the constant moved to `project-entry-bridge.ts:89-92` as `projectRegistrationClosing` (0) |
| `desktop-s6` | `project-registration-ipc.ts:39-39` | `b0e92fc` | `chooseRepository`'s first closing gate (3) | `const answer = await (owner === undefined`, foreign (3) | `35-35` (3) |
| `desktop-s6` | `project-registration-ipc.ts:47-47` | `34641bc` | the gate after the dialog (3) | `return decodeStrict(` (0) | `43-43` (3) |
| `desktop-s6` | `project-registration-ipc.ts:66-66` | `b0e92fc` | the `registerProject` gate (3) | nothing: the file has 65 lines, so the range is past its end; Stryker gives 0 mutants silently, and the new check calls it `STRYKER_RANGE_BROKEN` (0) | `62-62` (3) |
| `project-storage` | `project-storage-upgrade-node-adapter.ts:558-564` | `3f9fcfe` | `markerQueryFailure`, whole (9) | the TSDoc's last line to the middle of the function (7) | `560-567` (9). The brief's `560-566` (8) cuts the closing brace and the last mutant; the function gained a line. |

**B. Writing commit unreachable (`34b7477`), block found once, would be realigned by the squash's text (the brief: reported, never "aligned"):**

| Entry | Today (mutants) → candidate (mutants) |
|---|---|
| `active-project-coordinator.ts:513-539` | 11 → `522-548` 15 |
| `active-project-coordinator.ts:705-708` | 5 → `718-721` 10 |
| `active-project-coordinator.ts:715-724` | 14 → `728-737` 14 |
| `project-registration-preparation.ts:294-307` | 11 → `292-305` 11 |
| `project-registration-preparation.ts:367-383` | 18 → `365-381` 22 |

16 more ranges with an unreachable writing commit are text-identical to their squash today (`34b7477` 4 left after the decisions, `c8a72d1` 8, `ff162f5` 3, `67f59fc` 1); they would be kept as they stand, recorded as "read at the squash".

**C. Realigns with a reachable writing commit (the rule applies, no decision needed):** `main.ts:96-106` → `94-104` (20 → 16) and `441` → `406` (1 → 3) (Q53); `registration-listing.ts:24-86` → `23-85` (46 → 45); `project-registration-observer.ts:96-112` → `97-113` (13 → 14), `146-161` → `147-162` (8 → 9); `registry-database.ts:79-90` → `126-137` (0 → 8); `project-entry-bridge.ts:79-79` (`desktop-s6`) → `80-80` (0 → 0).

**D. Ranges with 0 mutants, as written and today (like `:156`, which Pedro removed):** `project-entry-bridge.ts:79-79` (`desktop-s6`, → `80`), `project-entry-bridge.ts:80-80` (`stryker.config.json`), `projects-workspace.tsx:44-44`, `project-registration-flow.ts:205-205` and `:214-214`. Each holds a declaration or call the instrumenter does not mutate.

**E. Edited in place, boundaries where they were (kept):** `harness-session.ts:105-134` (`desktop-s7`), `harness-supervisor.ts:176-233` (`desktop-s8`), `application-database-authority.ts:269-283`.

The realign stops here until Pedro decides A, B and D.

## User decisions on the realign audit (Pedro, relayed and confirmed by the coordinator, 2026-10-27)

- A: all 6 candidates accepted: `project-entry-ipc.ts:42-43` → `43-43`; `project-registration-ipc.ts:18-21` removed, `:39` → `35`, `:47` → `43`, `:66` → `62`; `project-storage-upgrade-node-adapter.ts:558-564` → `560-567`.
- B: the 5 realigned by the squash's text, each recorded as "writing commit unreachable, aligned by the squash text". The 16 text-identical ones are kept, recorded as "read at the squash".
- D: the 5 zero-mutant ranges removed.
- C and E follow the rule, as listed.
- Coordinator decision: the resized-range rule is accepted; the inside-insertion row expects that exact suggestion.

## The realign, applied (data only; `s6b-apply-realign.mjs`, scratchpad; configs backed up first, `s6b-config-backup/`)

- Every planned entry was found exactly once (the script refuses a miss). Biome formatted the three configs.
- Ranges after: **73** (`stryker.config.json` 19, `desktop-s6` 14, `desktop-s7` 7, `desktop-s8` 3, `ledger` 2, `project-storage` 28); whole-file entries 68, plus 1 when `stryker.stryker-ranges.config.json` lands. The real row now expects 19, 14 and 28.
- Instrumenter count over the 61 ranges in the 3 edited configs: none has 0 mutants.
- Red 2 is predicted with **73** `STRYKER_RANGE_UNANCHORED` lines.

## Red 1, observed (CPU 18/17/18%)

- `p3-s6b-red-1.log`: `Cannot find module './check-stryker-ranges.mjs'`, 1 failed file, no tests, exit 1. As predicted.

## Red 2, observed (CPU 17/18/20%, after the other project's Stryker run ended)

- Module copied in from the scratchpad. `p3-s6b-red-2.log`: 15 passed, 1 failed (`passes on the repository's own configs and anchors`), `STRYKER_RANGE_UNANCHORED` with exactly 73 lines. As predicted.

## After Red 2 (no run)

- `stryker-range-anchors.json`: 73 anchors written from the realigned configs by `s6b-write-anchors.mjs` (scratchpad); the CLI exits 0 (11 configs, 73 ranges, 69 whole files).
- `stryker.stryker-ranges.config.json` and `apps/harness/vitest.stryker-ranges-mutation.config.ts`, modelled on the effect-gate pair. **Coordinator decision (a):** the vitest config is accepted although the brief's path list does not name it (the new Stryker config needs it; effect-gate precedent). jscpd is watched: a clone of the effect-gate config is extracted, never excluded.
- `package.json`: `check:mutation-ranges`, run in `check` right after `check:effect`.
- CodeScene: module 9.09 (a complex conditional in `driftLine`, overall complexity) and test 9.38 (the two insertion rows duplicated). The resized-range test became `resizedRange`/`onlyPlace` and the broken-range checks moved into `brokenRange`; the two insertion rows became one `it.each` (still 2 rows, 16 in all). Both now 10.

## Green, observed (CPU 19/17/15%)

- `p3-s6b-green-1.log`: 16 passed, exit 0.

## Binding prediction, updated before the binding runs (the earlier B1-B4 prediction stays as written)

- B1 (ignore line `b`): **2** failures, not 1: the `last` boundary row, and the inside-insertion row added after the first prediction. With an insertion after line 3, line `a` of `3-5` still holds, so B1 passes that range, and the row's first expected line is missing.
- B2, B3, B4: exactly 1 each (missing file, found twice, column form).

## Bindings, observed (one per command, each restored by digest; CPU under 30% before each)

| Binding | Log | Failures | Rows |
|---|---|---|---|
| B1 ignore line `b` | `p3-s6b-b1.log` | 2 | the widened-range row; the changed last boundary row |
| B2 unreadable source → ok | `p3-s6b-b2.log` | 1 | the missing source file row |
| B3 first location wins | `p3-s6b-b3.log` | 1 | the found-twice row |
| B4 skip column forms | `p3-s6b-b4.log` | 1 | the line and column row |

All as predicted (B1 as updated before the run).

## Structural checks

- `scripts.check` includes `pnpm check:mutation-ranges`: true.
- `pnpm check:mutation-ranges` exit 0 (`p3-s6b-structural-clean.log`). A line inserted above `writer-proof-report.ts:4-18` → exit 1, `STRYKER_RANGE_DRIFT`, `... moved to apps/desktop/src/main/writer-proof-report.ts:5-19` (`p3-s6b-structural-drift.log`), restored by digest.
- jscpd: 0 clones (`p3-s6b-jscpd.log`). knip: exit 0 (`p3-s6b-knip.log`).

## `pnpm check`, first run: failed at `format:check`

- `p3-s6b-pnpm-check.log`, exit 1: Biome flagged the two new files (the module had CRLF line endings; one line in each was over the width). No later step ran.
- Fixed with `biome format --write`; beyond line endings the diff is layout only (the `context` object and the `sourceA`/`sourceB` calls wrapped). `biome check` over the 9 changed files is clean. Reported to the coordinator before any rerun.
- Cause: the module was written in the scratchpad (CRLF line endings on this machine) and copied into the tree, so Biome never formatted it before the gate. The test file had one over-width line.
- Coordinator GO for the rerun (a real fault, fixed; not a rerun to chase green).

## After the format fix

- Focused test: 16 passed (`p3-s6b-green-2.log`; CPU 6/10/2).
- `pnpm check`: exit 0 (`p3-s6b-pnpm-check-2.log`; CPU 3/6/7; no League/TFT process, 5 idle OverwolfBrowser; the CasaDosCaminhos astro process was idle and had ended by this run). "Effect diagnostics verified; 0 advisory warnings."; "Stryker ranges verified: ... 73 ranges"; 118 files, 3784 tests; depcruise clean. The "SlopStop failed to start." line in the log is a test's expected stderr, inside a passing run.
- `pnpm check:duplicates`: exit 0, 0 clones (`p3-s6b-check-duplicates.log`).

## Open

- The real reach of every changed range (`project-registration-protocol.ts:50-63` among them) is proven only by a Stryker dry run of each changed config (`stryker.config.json`, `desktop-s6`, `project-storage`); heavy, gated.
- The scoped mutation run of `stryker.stryker-ranges.config.json` (Q51) comes after the verifier, on the final candidate, with the coordinator's GO.

## Verifier round 1 (the only round): failed, 2 violations, 2 warnings; coordinator decisions

- V1 (violation): kept ranges anchored away from their origin units (the last-writer rule trusted already mis-shifted realigns). Measured, light only, and reported to the coordinator for the user (no re-point before the decision). Six ranges are confirmed by git blame: `application-database-migration.ts:147-289` → `149-291` (91 → 93); `process-bootstrap.ts:58-70` → `59-71` (4 → 4), `72-77` → `73-78` (3 → 4), `84-96` → `85-97` (6 → 7), `103-153` → `104-154` (26 → 27); and one the verifier did not name, `registration-listing.ts:23-85` → `24-86` (45 → 46). That one was already shifted −1 at `271b418`, and this slice's realign carried the shift. The other 57 ranges sit at their origin unit (`s6b-origin-chain.mjs`, `origin-chain-418b2c8-v2.json`, scratchpad). Ranges from the unreachable squashes cannot be walked past the squash.
- V2 (violation): the full realign table goes into this record.
- V3 (warning, fixed now with red-green, one behaviour each): (a) a config whose JSON is not an object → `BROKEN`; (b) a root `stryker*.json` the check does not recognise → `BROKEN`, naming the file; (c) a duplicate anchor → `BROKEN`. (d) The CLI guard on a symlinked path is project-wide and is not changed here; the coordinator takes it to the user.
- V4: s7's paths (to the designer at s7's detailing).
- Polish: singular "1 whole file" (and "1 range").

## V3 prediction, written before the rows run

- New rows: (a) an `it.each` over `null`, `[]` and `5` as a config's whole JSON, 3 rows → `BROKEN` `<config>: not a JSON object`; (b) a root `stryker-extra.json` → `BROKEN` `stryker-extra.json: a root Stryker file the check does not recognise` (the anchors file is the one root `stryker*.json` that is not a config, and stays accepted); (c) two anchors for the same config and entry → `BROKEN` `stryker-range-anchors.json: duplicate anchor for stryker.config.json src/a.ts:3-5`. 16 + 5 = 21 rows.
- Red: exactly 5 failures, the 5 new rows. Each returns `ok: true` today: (a) reads a missing `mutate` as an empty list; (b) skips the file by name; (c) the second anchor overwrites the first.
- Green: 21/21. The CLI count text becomes singular for 1; no row reads the CLI text.

## V3, observed

- Red (`p3-s6b-v3-red.log`, CPU 4/1/5): exactly the 5 new rows fail; 16 pass. The cause differs from the prediction in (a): the three non-object configs came back `STRYKER_RANGE_STALE_ANCHOR` (the config was read as an empty list, so its anchor had no range), not `ok: true`. Same defect, same rows; recorded, not a weaker result. (b) and (c) came back `ok: true`, as predicted.
- Change: `readMutate` refuses a non-object config (`not a JSON object`); `rootConfigs` reports any root `stryker*.json` other than a config or the anchors file; `readAnchors` reports a duplicate anchor. The CLI says "1 range" and "1 whole file".
- Green (`p3-s6b-v3-green.log`, CPU 6/0/2): 21 passed. CodeScene: module 10, test 10.

## V1, user decision (AskUserQuestion, 2026-10-27, relayed and confirmed by the coordinator): all 6 re-pointed to their origin unit

- `stryker.project-storage.config.json`: `application-database-migration.ts:147-289` → `149-291`; `process-bootstrap.ts:58-70` → `59-71`, `72-77` → `73-78`, `84-96` → `85-97`, `103-153` → `104-154`; `registration-listing.ts:23-85` → `24-86` (found by the implementer: this slice's `418b2c8` realign carried the −1 shift from `271b418`).
- The 6 anchors were rewritten from the new boundary lines; the CLI exits 0. The count stays 73 (`project-storage` 28). The instrumenter finds no 0-mutant range among the 73 (`p3-s6b-all-ranges-mutants-v1.tsv`).

## V2: the full realign table

Every range at `de02777` (81) and the one added range, as the candidate now stands. "Writing commit" is the commit that last wrote the config line (with the squash it came through); "Origin" is the commit that first wrote the range, walked back through every re-point (`p3-s6b-s6b-origin-chain.mjs`), with the result of matching the origin unit's boundary lines in today's file when that is not a match. That walk reads the committed configs at `418b2c8`, so the 6 V1 rows carry their origin by hand, with the blame lines. Mutants are instrumenter counts: before at `de02777`, after on the candidate.

Evidence in the main checkout's evidence folder: `p3-s6b-realign-audit-de02777.json`, `p3-s6b-origin-chain-418b2c8-v2.json`, `p3-s6b-all-ranges-mutants-de02777.tsv`, `p3-s6b-all-ranges-mutants-418b2c8.tsv`, `p3-s6b-all-ranges-mutants-v1.tsv`, and the scripts that made them (`p3-s6b-s6b-*.mjs`).

Notes on the "Origin" column: "origin boundaries not found" and "ambiguous" were each read by hand. `project-entry-bridge.ts:80-235` (s7: the unit shrank by a line, both ends match), `workspace-bridge.ts:101-271` (s7: its first constant `stoppedText` was deleted, so the unit now starts at `closingDiagnostic`), `application-database-authority.ts:165-183` (the TSDoc to the closing brace of `acquireApplicationDatabaseAuthority`), `project-registration-preparation.ts:230-277` and `workspace-view.tsx:122-178` (a blank first line that matches twice; the text is the origin's) are at their origin units. The `project-entry-ipc`, `project-registration-ipc`, `main.ts` and `writer-proof-report.ts` rows are the user's decisions (Q53, Q54, A). Ranges from `34b7477`, `c8a72d1`, `ff162f5` and `67f59fc` cannot be walked past their squash.

| # | Config | Entry before | After | State | Writing commit | Origin | Mutants before → after |
|---|---|---|---|---|---|---|---|
| 1 | `stryker` | `canonical-project-protocol.ts:156-156` | — | removed (D, 0 mutants; user); writing commit unreachable, read at the squash | `34b7477` | — | 0 → — |
| 2 | `stryker` | `canonical-project-protocol.ts:252-252` | — | removed (dead; user, Q54); writing commit unreachable, read at the squash | `34b7477` | — | 4 → — |
| 3 | `stryker` | `canonical-project-protocol.ts:419-419` | — | removed (dead; user, Q54); writing commit unreachable, read at the squash | `34b7477` | — | 2 → — |
| 4 | `stryker` | `active-project-coordinator.ts:513-539` | `active-project-coordinator.ts:522-548` | realigned (block found once); writing commit unreachable, aligned by the squash text | `34b7477` | 34b7477 active-project-coordinator.ts:513-539 | 11 → 15 |
| 5 | `stryker` | `active-project-coordinator.ts:705-708` | `active-project-coordinator.ts:718-721` | realigned (block found once); writing commit unreachable, aligned by the squash text | `34b7477` | 34b7477 active-project-coordinator.ts:705-708 | 5 → 10 |
| 6 | `stryker` | `active-project-coordinator.ts:715-724` | `active-project-coordinator.ts:728-737` | realigned (block found once); writing commit unreachable, aligned by the squash text | `34b7477` | 34b7477 active-project-coordinator.ts:715-724 | 14 → 14 |
| 7 | `stryker` | `canonical-project-application.ts:91-102` | `canonical-project-application.ts:91-102` | kept (text-identical) | `53ecb3c` | 34b7477 canonical-project-application.ts:90-101 | 4 → 4 |
| 8 | `stryker` | `canonical-project-application.ts:108-119` | `canonical-project-application.ts:108-119` | kept (text-identical) | `53ecb3c` | 34b7477 canonical-project-application.ts:107-118 | 8 → 8 |
| 9 | `stryker` | `project-registration-preparation.ts:225-279` | `project-registration-preparation.ts:230-277` | realigned (user decision); writing commit unreachable, aligned by the squash text | `34b7477` | 34b7477 project-registration-preparation.ts:225-279 — OFF ORIGIN: origin unit now 230-240 | 38 → 38 |
| 10 | `stryker` | `project-registration-preparation.ts:294-307` | `project-registration-preparation.ts:292-305` | realigned (block found once); writing commit unreachable, aligned by the squash text | `34b7477` | 34b7477 project-registration-preparation.ts:294-307 | 11 → 11 |
| 11 | `stryker` | `project-registration-preparation.ts:367-383` | `project-registration-preparation.ts:365-381` | realigned (block found once); writing commit unreachable, aligned by the squash text | `34b7477` | 34b7477 project-registration-preparation.ts:367-383 | 18 → 22 |
| 12 | `stryker` | `project-entry-bridge.ts:80-80` | — | removed (D, 0 mutants; user) | `cf95b0a (via 4cf6541)` | — | 0 → — |
| 13 | `stryker` | `project-entry-bridge.ts:103-103` | `project-entry-bridge.ts:103-103` | kept (text-identical) | `cf95b0a (via 4cf6541)` | cf95b0a project-entry-bridge.ts:103-103 | 2 → 2 |
| 14 | `stryker` | `project-entry-bridge.ts:189-202` | `project-entry-bridge.ts:189-202` | kept (text-identical) | `cf95b0a (via 4cf6541)` | cf95b0a project-entry-bridge.ts:189-202 | 4 → 4 |
| 15 | `stryker` | `projects-list.tsx:50-56` | `projects-list.tsx:50-56` | kept (text-identical); writing commit unreachable, read at the squash | `67f59fc` | 67f59fc projects-list.tsx:50-56 | 23 → 23 |
| 16 | `stryker` | `projects-workspace.tsx:44-44` | — | removed (D, 0 mutants; user); writing commit unreachable, read at the squash | `c8a72d1` | — | 0 → — |
| 17 | `stryker` | `projects-workspace.tsx:81-81` | `projects-workspace.tsx:81-81` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 projects-workspace.tsx:81-81 | 1 → 1 |
| 18 | `stryker` | `projects-workspace.tsx:94-94` | `projects-workspace.tsx:94-94` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 projects-workspace.tsx:94-94 | 1 → 1 |
| 19 | `stryker` | `projects-workspace.tsx:106-107` | `projects-workspace.tsx:106-107` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 projects-workspace.tsx:106-107 | 4 → 4 |
| 20 | `stryker` | `projects-workspace.tsx:307-317` | `projects-workspace.tsx:307-317` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 projects-workspace.tsx:307-317 | 3 → 3 |
| 21 | `stryker` | `workspace-view.tsx:46-58` | `workspace-view.tsx:46-58` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 workspace-view.tsx:46-58 | 33 → 33 |
| 22 | `stryker` | `workspace-view.tsx:82-116` | `workspace-view.tsx:82-116` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 workspace-view.tsx:82-116 | 20 → 20 |
| 23 | `stryker` | `workspace-view.tsx:122-178` | `workspace-view.tsx:122-178` | kept (text-identical); writing commit unreachable, read at the squash | `c8a72d1` | c8a72d1 workspace-view.tsx:122-178 — ambiguous: 13-69, 122-178 | 27 → 27 |
| 24 | `stryker` | — | `project-registration-protocol.ts:50-63` | added (user decision) | — | — | — → 1 |
| 25 | `stryker.desktop-s6` | `project-entry-ipc.ts:42-43` | `project-entry-ipc.ts:43-43` | realigned (user decision) | `34641bc (via 4cf6541)` | 34641bc project-entry-ipc.ts:42-43 — origin boundaries not found | 4 → 3 |
| 26 | `stryker.desktop-s6` | `project-entry-ipc.ts:48-48` | `project-entry-ipc.ts:48-48` | kept (text-identical) | `34641bc (via 4cf6541)` | 34641bc project-entry-ipc.ts:48-48 | 3 → 3 |
| 27 | `stryker.desktop-s6` | `project-entry-ipc.ts:53-53` | `project-entry-ipc.ts:53-53` | kept (text-identical) | `34641bc (via 4cf6541)` | 34641bc project-entry-ipc.ts:53-53 | 3 → 3 |
| 28 | `stryker.desktop-s6` | `project-entry-ipc.ts:58-58` | `project-entry-ipc.ts:58-58` | kept (text-identical) | `34641bc (via 4cf6541)` | 34641bc project-entry-ipc.ts:58-58 | 3 → 3 |
| 29 | `stryker.desktop-s6` | `project-entry-ipc.ts:63-63` | `project-entry-ipc.ts:63-63` | kept (text-identical) | `34641bc (via 4cf6541)` | 34641bc project-entry-ipc.ts:63-63 | 3 → 3 |
| 30 | `stryker.desktop-s6` | `project-entry-ipc.ts:68-68` | `project-entry-ipc.ts:68-68` | kept (text-identical) | `34641bc (via 4cf6541)` | 34641bc project-entry-ipc.ts:68-68 | 3 → 3 |
| 31 | `stryker.desktop-s6` | `project-registration-ipc.ts:18-21` | — | removed (moved away; user, A) | `b0e92fc (via 4cf6541)` | — | 4 → — |
| 32 | `stryker.desktop-s6` | `project-registration-ipc.ts:39-39` | `project-registration-ipc.ts:35-35` | realigned (user decision) | `b0e92fc (via 4cf6541)` | 418b2c8 project-registration-ipc.ts:35-35 — ambiguous: 35-35, 43-43 | 3 → 3 |
| 33 | `stryker.desktop-s6` | `project-registration-ipc.ts:47-47` | `project-registration-ipc.ts:43-43` | realigned (user decision) | `34641bc (via 4cf6541)` | 418b2c8 project-registration-ipc.ts:43-43 — ambiguous: 35-35, 43-43 | 0 → 3 |
| 34 | `stryker.desktop-s6` | `project-registration-ipc.ts:66-66` | `project-registration-ipc.ts:62-62` | realigned (user decision) | `b0e92fc (via 4cf6541)` | 418b2c8 project-registration-ipc.ts:62-62 | 0 → 3 |
| 35 | `stryker.desktop-s6` | `main.ts:96-106` | `main.ts:94-104` | realigned (user decision) | `34641bc (via 4cf6541)` | 34641bc main.ts:96-106 | 20 → 16 |
| 36 | `stryker.desktop-s6` | `writer-proof-report.ts:8-18` | `writer-proof-report.ts:4-18` | realigned (user decision) | `07c46e5` | 07c46e5 writer-proof-report.ts:8-18 — OFF ORIGIN: origin unit now 8-18 | 5 → 6 |
| 37 | `stryker.desktop-s6` | `main.ts:294-323` | `main.ts:273-288` | realigned (user decision) | `34641bc (via 4cf6541)` | 34641bc main.ts:294-323 — origin boundaries not found | 15 → 11 |
| 38 | `stryker.desktop-s6` | `main.ts:441-441` | `main.ts:406-406` | realigned (user decision) | `34641bc (via 4cf6541)` | 34641bc main.ts:441-441 | 1 → 3 |
| 39 | `stryker.desktop-s6` | `canonical-writer-package-smoke.ts:300-341` | `canonical-writer-package-smoke.ts:300-341` | kept (text-identical) | `01280f1 (via 4cf6541)` | 01280f1 canonical-writer-package-smoke.ts:300-341 | 35 → 35 |
| 40 | `stryker.desktop-s6` | `project-entry-bridge.ts:79-79` | — | removed (D, 0 mutants; user) | `01280f1 (via 4cf6541)` | — | 0 → — |
| 41 | `stryker.desktop-s7` | `project-entry-bridge.ts:80-235` | `project-entry-bridge.ts:80-235` | kept (text-identical) | `4b37629 (via 4cf6541)` | 9da01af project-entry-bridge.ts:79-236 — OFF ORIGIN: origin unit now 80-138 | 59 → 59 |
| 42 | `stryker.desktop-s7` | `project-storage-bridge.ts:38-167` | `project-storage-bridge.ts:38-167` | kept (text-identical) | `4b37629 (via 4cf6541)` | 9da01af project-storage-bridge.ts:36-165 | 53 → 53 |
| 43 | `stryker.desktop-s7` | `workspace-bridge.ts:101-271` | `workspace-bridge.ts:101-271` | kept (text-identical) | `03a50c8 (via 4cf6541)` | 9da01af workspace-bridge.ts:99-268 — origin boundaries not found | 111 → 111 |
| 44 | `stryker.desktop-s7` | `project-upgrade-failure.ts:36-53` | `project-upgrade-failure.ts:36-53` | kept (text-identical) | `4b37629 (via 4cf6541)` | 9da01af project-upgrade-failure.ts:38-55 | 15 → 15 |
| 45 | `stryker.desktop-s7` | `project-conversation-failure.ts:35-48` | `project-conversation-failure.ts:35-48` | kept (text-identical) | `4b37629 (via 4cf6541)` | 9da01af project-conversation-failure.ts:34-47 | 29 → 29 |
| 46 | `stryker.desktop-s7` | `harness-session.ts:105-134` | `harness-session.ts:105-134` | kept (edited in place, boundaries where they were) | `9da01af (via 4cf6541)` | 9da01af harness-session.ts:105-134 | 27 → 27 |
| 47 | `stryker.desktop-s7` | `desktop-runtime.ts:166-189` | `desktop-runtime.ts:166-189` | kept (text-identical) | `4b37629 (via 4cf6541)` | 9da01af desktop-runtime.ts:170-193 | 9 → 9 |
| 48 | `stryker.desktop-s8` | `harness-supervisor.ts:61-73` | `harness-supervisor.ts:61-73` | kept (text-identical) | `3001364 (via 4cf6541)` | 3001364 harness-supervisor.ts:61-73 | 6 → 6 |
| 49 | `stryker.desktop-s8` | `harness-supervisor.ts:176-233` | `harness-supervisor.ts:176-233` | kept (edited in place, boundaries where they were) | `3001364 (via 4cf6541)` | 3001364 harness-supervisor.ts:176-233 | 27 → 27 |
| 50 | `stryker.desktop-s8` | `harness-supervisor.ts:399-435` | `harness-supervisor.ts:399-435` | kept (text-identical) | `4d22a65 (via 4cf6541)` | 3001364 harness-supervisor.ts:399-434 | 30 → 30 |
| 51 | `stryker.ledger` | `canonical-command-ledger.ts:63-122` | `canonical-command-ledger.ts:63-122` | kept (text-identical) | `ba06c01` | ba06c01 canonical-command-ledger.ts:63-122 | 68 → 68 |
| 52 | `stryker.ledger` | `canonical-command-ledger.ts:193-459` | `canonical-command-ledger.ts:193-459` | kept (text-identical) | `ba06c01` | ba06c01 canonical-command-ledger.ts:193-459 | 275 → 275 |
| 53 | `stryker.project-storage` | `application-database-migration.ts:147-289` | `application-database-migration.ts:149-291` | re-pointed to its origin unit (user decision, V1) | `53ecb3c` | ba4e15b application-database-migration.ts:142-284; blame 149 <- ba4e15b:142, 291 <- ba4e15b:284 | 91 → 93 |
| 54 | `stryker.project-storage` | `project-storage-healthy-opening.ts:108-115` | `project-storage-healthy-opening.ts:108-115` | kept (text-identical); writing commit unreachable, read at the squash | `ff162f5` | ff162f5 project-storage-healthy-opening.ts:108-115 | 20 → 20 |
| 55 | `stryker.project-storage` | `project-storage-healthy-opening.ts:147-153` | `project-storage-healthy-opening.ts:147-153` | kept (text-identical); writing commit unreachable, read at the squash | `ff162f5` | ff162f5 project-storage-healthy-opening.ts:147-153 | 4 → 4 |
| 56 | `stryker.project-storage` | `project-storage-database-authority.ts:189-194` | `project-storage-database-authority.ts:189-194` | kept (text-identical); writing commit unreachable, read at the squash | `ff162f5` | ff162f5 project-storage-database-authority.ts:189-194 | 23 → 23 |
| 57 | `stryker.project-storage` | `project-registration-flow.ts:205-205` | — | removed (D, 0 mutants; user) | `a567672 (via 4cf6541)` | — | 0 → — |
| 58 | `stryker.project-storage` | `project-registration-flow.ts:214-214` | — | removed (D, 0 mutants; user) | `a567672 (via 4cf6541)` | — | 0 → — |
| 59 | `stryker.project-storage` | `application-database-authority.ts:57-70` | `application-database-authority.ts:57-70` | kept (text-identical) | `cadf2ab` | 95ba184 application-database-authority.ts:51-64 | 4 → 4 |
| 60 | `stryker.project-storage` | `application-database-authority.ts:165-183` | `application-database-authority.ts:165-183` | kept (text-identical) | `cadf2ab` | 95ba184 application-database-authority.ts:155-170 — origin boundaries not found | 5 → 5 |
| 61 | `stryker.project-storage` | `application-database-authority.ts:194-200` | `application-database-authority.ts:194-200` | kept (text-identical) | `cadf2ab` | 95ba184 application-database-authority.ts:179-185 | 4 → 4 |
| 62 | `stryker.project-storage` | `application-database-authority.ts:269-283` | `application-database-authority.ts:269-283` | kept (edited in place, boundaries where they were) | `cadf2ab` | 95ba184 application-database-authority.ts:254-268 | 12 → 12 |
| 63 | `stryker.project-storage` | `application-database-authority.ts:499-502` | `application-database-authority.ts:499-502` | kept (text-identical) | `cadf2ab` | 95ba184 application-database-authority.ts:481-484 | 6 → 6 |
| 64 | `stryker.project-storage` | `application-database-authority.ts:527-533` | `application-database-authority.ts:527-533` | kept (text-identical) | `cadf2ab` | 95ba184 application-database-authority.ts:509-515 | 4 → 4 |
| 65 | `stryker.project-storage` | `harness-runtime.ts:188-191` | `harness-runtime.ts:188-191` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:184-187 | 7 → 7 |
| 66 | `stryker.project-storage` | `process-bootstrap.ts:285-293` | `process-bootstrap.ts:285-293` | kept (text-identical) | `cadf2ab` | de9966a process-bootstrap.ts:262-268 | 1 → 1 |
| 67 | `stryker.project-storage` | `harness-runtime.ts:92-104` | `harness-runtime.ts:92-104` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:88-100 | 9 → 9 |
| 68 | `stryker.project-storage` | `harness-runtime.ts:111-122` | `harness-runtime.ts:111-122` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:107-118 | 12 → 12 |
| 69 | `stryker.project-storage` | `harness-runtime.ts:182-182` | `harness-runtime.ts:182-182` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:178-178 | 1 → 1 |
| 70 | `stryker.project-storage` | `harness-runtime.ts:245-248` | `harness-runtime.ts:245-248` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:241-244 | 2 → 2 |
| 71 | `stryker.project-storage` | `harness-runtime.ts:339-356` | `harness-runtime.ts:339-356` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:335-351 | 19 → 19 |
| 72 | `stryker.project-storage` | `harness-runtime.ts:432-455` | `harness-runtime.ts:432-455` | kept (text-identical) | `4eeb8d4` | de9966a harness-runtime.ts:425-446 | 16 → 16 |
| 73 | `stryker.project-storage` | `process-bootstrap.ts:58-70` | `process-bootstrap.ts:59-71` | re-pointed to its origin unit (user decision, V1) | `e3b9171` | de9966a process-bootstrap.ts:81-93; blame 59 <- 4cf6541:82, 71 <- 4cf6541:94 (de9966a:81 const, :93 }) | 4 → 4 |
| 74 | `stryker.project-storage` | `process-bootstrap.ts:72-77` | `process-bootstrap.ts:73-78` | re-pointed to its origin unit (user decision, V1) | `e3b9171` | de9966a process-bootstrap.ts:95-100; blame 73 <- 4cf6541:96, 78 <- 4cf6541:101 (de9966a:95 type, :100 }) | 3 → 4 |
| 75 | `stryker.project-storage` | `process-bootstrap.ts:84-96` | `process-bootstrap.ts:85-97` | re-pointed to its origin unit (user decision, V1) | `e3b9171` | de9966a process-bootstrap.ts:107-119; blame 85 <- 4cf6541:108, 97 <- 4cf6541:120 (de9966a:107 function, :119 }) | 6 → 7 |
| 76 | `stryker.project-storage` | `process-bootstrap.ts:103-153` | `process-bootstrap.ts:104-154` | re-pointed to its origin unit (user decision, V1) | `4eeb8d4` | de9966a process-bootstrap.ts:126-166; blame 104 <- 4cf6541:127, 154 <- 4cf6541:168 (de9966a:126 function, :166 }) | 26 → 27 |
| 77 | `stryker.project-storage` | `registration-listing.ts:24-86` | `registration-listing.ts:24-86` | re-pointed to its origin unit (user decision, V1) | `271b418 (via 4cf6541)` | de9966a registration-listing.ts:18-80; blame 24 = the class, 86 = the closing brace; 271b418 had shifted it -1 and this slice's 418b2c8 realign carried that (found by the implementer) | 46 → 46 |
| 78 | `stryker.project-storage` | `project-registration-observer.ts:96-112` | `project-registration-observer.ts:97-113` | realigned (block found once) | `de9966a (via 4cf6541)` | de9966a project-registration-observer.ts:96-112 | 13 → 14 |
| 79 | `stryker.project-storage` | `project-registration-observer.ts:146-161` | `project-registration-observer.ts:147-162` | realigned (block found once) | `de9966a (via 4cf6541)` | de9966a project-registration-observer.ts:146-161 | 8 → 9 |
| 80 | `stryker.project-storage` | `project-storage-upgrade-node-adapter.ts:558-564` | `project-storage-upgrade-node-adapter.ts:560-567` | realigned (user decision) | `3f9fcfe (via 4cf6541)` | 3f9fcfe project-storage-upgrade-node-adapter.ts:558-564 | 7 → 9 |
| 81 | `stryker.project-storage` | `registry-database.ts:79-90` | `registry-database.ts:126-137` | realigned (block found once) | `3f9fcfe (via 4cf6541)` | 3f9fcfe registry-database.ts:79-90 | 0 → 8 |
| 82 | `stryker.project-storage` | `registration-registry.ts:209-227` | `registration-registry.ts:209-227` | kept (text-identical) | `cadf2ab` | 3f9fcfe registration-registry.ts:182-200 | 13 → 13 |

## Gates after the verifier fixes (CPU 4/2/2 and 5/12/5; no League/TFT process, 5 idle OverwolfBrowser, no CasaDosCaminhos process)

- Focused test: 21 passed (`p3-s6b-r1-green.log`).
- `pnpm check:duplicates`: 0 clones (`p3-s6b-r1-duplicates.log`). knip: exit 0 (`p3-s6b-r1-knip.log`). CodeScene: module 10, test 10.
- `pnpm check`: exit 0 (`p3-s6b-r1-pnpm-check.log`); "Effect diagnostics verified; 0 advisory warnings."; "Stryker ranges verified" (73 ranges); depcruise clean.
- Open, gated: the Stryker dry runs of `stryker.config.json`, `desktop-s6` and `project-storage` (the real reach of every changed range), then the Q51 scoped mutation run.

## Heavy runs on `40a379a` (coordinator GO; the user said "livre"; one at a time, alone; CPU read before each)

Expected counts come from the instrumenter over every `mutate` entry at the candidate (whole files included), before the runs were read.

| Run | Log | CPU | Files | Mutants (expected) | Initial test run | Exit |
|---|---|---|---|---|---|---|
| `stryker.config.json` dry run | `p3-s6b-dryrun-main.log` | 8/3/9 | 41 | 3885 (3885) | 2785 tests passed | 0 |
| `stryker.desktop-s6` dry run | `p3-s6b-dryrun-desktop-s6.log` | 8/7/10 | 7 (8 before: the only `project-entry-bridge.ts` range was removed) | 214 (214) | 317 tests passed | 0 |
| `stryker.project-storage` dry run | `p3-s6b-dryrun-project-storage.log` | 4/6/5 | 28 (29 before: both `project-registration-flow.ts` ranges were removed) | 3791 (3791) | 610 tests passed | 0 |
| Q51 `stryker.stryker-ranges` mutation | `p3-s6b-q51-mutation-stryker-ranges.log` | 3/17/17 | 1 | 339 | **failed**: 1 row | **1** |

- Reach of `project-registration-protocol.ts:50-63`: the dry run instrumented its 1 mutant, and `registry-broken-codes.test.ts` is in the related test set. A dry run does not report per-mutant coverage, so the reach is still open. It needs a one-range mutation run, which is gated.
- **Q51 failed before any mutant ran.** In the Stryker sandbox the initial test run failed one row, `passes on the repository's own configs and anchors` (`ok: false` against `ok: true`; Stryker does not print the code or the lines). The other 20 rows passed. The row passes in the worktree. Reported to the coordinator first. No rerun and no change.

## Q51 failure, diagnosed (coordinator GO for a light diagnosis; no Stryker run; nothing changed)

- The failed run left `.stryker-tmp/sandbox-Ryoalb` behind (timestamp 18:20:58; ignored by git). `checkStrykerRanges({ root: <sandbox> })` returns `STRYKER_RANGE_DRIFT` with 73 lines, one per range. 70 of them say `moved to a+1 - b+1`; 3 say the pair was found twice, each copy one line down (`workspace-view.tsx:122-178`, `project-registration-ipc.ts:35` and `:43`).
- Cause: Stryker's `disableTypeChecks`, whose default glob covers the sandbox's `.ts`/`.tsx`/`.mjs` files, adds `// @ts-nocheck` as a new line 1 to every source file it copies. In the sandbox, line 1 of `active-project-coordinator.ts`, `project-registration-protocol.ts`, `workspace-view.tsx` and `check-stryker-ranges.mjs` is that header. `active-project-coordinator.ts` is byte-identical to the worktree after line 1. No config sets `disableTypeChecks` today.
- Ruled out: missing source; an extra root `stryker*.json` (the sandbox root has the same 11 configs and the anchors file; `stryker-setup-*.js` does not match); `.stryker-tmp` inside the sandbox root.
- The row is right: in the sandbox every range is one line off. Stryker's own ranges are unaffected, because it instruments the original files.
- Options sent to the coordinator for the user (none picked): (1) `"disableTypeChecks": false` in `stryker.stryker-ranges.config.json`; (2) narrow it to the mutated module only; (3) exclude the real row from the mutation vitest config (weakens the run); (4) skip the row in a sandbox (weakens the run). Recommended: (1) or (2).

## Q51 fix: user decision (option 1, relayed and confirmed by the coordinator, 2026-10-27)

- `stryker.stryker-ranges.config.json` gains `"disableTypeChecks": false`, and nothing else changes: not the test, not the oracle, not the other configs.
- Proof of the cause, before the change (light, no Stryker run): `checkStrykerRanges` on the leftover sandbox as it was left → `STRYKER_RANGE_DRIFT`, 73 lines. The configs, the anchors and the 32 range source files copied from the sandbox with only the `// @ts-nocheck` line 1 removed (all 32 had it) → `ok: true`, 73 ranges (scratchpad `s6b-sandbox-proof/stripped`).

## Q51, rerun after the fix (CPU 27/23/19; no League/TFT; alone)

- `p3-s6b-q51-mutation-stryker-ranges-2.log`, exit 0: 1 file, 339 mutants. The initial test run passed all 21 rows. **Score 80.71** (break 80): 250 killed, 1 timeout, 33 survived, 27 no coverage, 28 ignored (static). Report: `p3-s6b-mutation-stryker-ranges-d956826.json`.
- As Q51 (a) requires, every survivor and every no-coverage mutant goes to Pedro as it stands, with none waived or killed by editing tests. Grouped by the gap each one shows (line numbers in `check-stryker-ranges.mjs` at `d956826`):
  - **Missing anchors file and the JSON read** (4 survived: L21 the `"utf8"` literal, L23 `missing` forced false and its `"ENOENT"` literal, L30 the early return forced false). No row has a root without an anchors file; Red 2 showed the behaviour once, but no row pins it.
  - **Anchors file with the wrong shape** (12 survived: L36 ×3 and `isAnchor` L53-55 ×9; 2 no coverage: L36 block, L37 message). No row has valid JSON that is not a list of anchors.
  - **`mutate` that is not a list of strings** (4 survived at L175; 4 no coverage: L174 `?? []`, L175 block, L176 object and message). No row has a config whose `mutate` is wrong.
  - **Source reading** (L62 the final-newline pop forced on; L67 the cache check forced on; L71 `"missing"` vs `"unreadable"` forced on, with the `"unreadable"` literal not covered). No row has a source that is unreadable but present, and no row reads the same source twice so that only the cache would show.
  - **Pair search bounds** (L80 `<=` and `index - distance` survived; `index -= 1` timed out, so it counts as detected). No row puts the anchored pair on the file's last line.
  - **Drift wording and branch order** (L93 the `", "` separator of `foundAt`, which no row reaches with two places; L105 `places.length === 1` forced false, and L106 `> 1` as `>= 1`: with one place the resized rule gives the same line, so equivalent for the current rows; L115 `onlyPlace` forced true; L122 the resized-order condition ×2). No row has a boundary found twice where the resized rule would differ.
  - **Equivalent on this platform or for these results** (L197 removing `.sort()`: NTFS already lists names in order; L223 `?? []` replaced by `["Stryker was here"]`: only reached when a config is broken, and then `configs` is never returned).
  - **The CLI block** (20 no coverage, L235-245): the rows call `checkStrykerRanges`, never the CLI. The structural check ran the CLI by hand (exit 0, and exit 1 on drift), outside Vitest.
- The leftover sandbox `.stryker-tmp/sandbox-Ryoalb` was deleted after Q51 passed (coordinator instruction).

## One-range run for `project-registration-protocol.ts:50-63` (option b: scratch config, `incremental` false, own report names)

- The first attempt (`p3-s6b-mutation-owner-range.log`) exited 1 before anything ran. That was my error: `--incremental false` passed a value to a flag that takes none. It was reported first and not rerun as it stood.
- `p3-s6b-mutation-owner-range-2.log` (CPU 16/9/5, alone), exit 0, initial run 1269 tests. 1 mutant (L61 `BlockStatement`): **Killed**, score 100. Killed by `registry-broken-codes.test.ts > names the registry-broken set once`; covered by that file's 4 tests. Config `p3-s6b-owner-range-mutation-config.json`, report `p3-s6b-owner-range-mutation-report.json`. **The reach of 50-63 is proven** (coordinator accepted).

## Coordinator decision on the Q51 survivors ("maxima qualidade", disclosed to the user)

- 80.71 at a break of 80 is not acceptance. Kill every survivor and no-coverage mutant that is not equivalent, with behaviour rows that have exact oracles through the public seam. Each equivalent mutant gets a written argument here, which the coordinator reviews.
- (2a) A defect the mutation run found: an unreadable source reads "names a unreadable source file". Approved fix: "names an unreadable source file", with a red row first; the "missing" text stays exactly as it is.
- (2b) Approved extraction: an exported `runStrykerRanges({ root, stdout, stderr })` that returns the exit code, with output byte-identical to today's CLI. It is pinned first by spawn rows against the current CLI; the same oracles hold after the move. The single spawn row on the real guard stays, and the guard's condition does not change (V3 d is a separate follow-up).

## Survivor rows: prediction, written before they run

- 18 new rows (39 in all): anchors file missing → `UNANCHORED` (3 lines); anchors file unreadable (a directory) → `BROKEN`; 6 broken shapes (anchors `{}`, an anchor with no `last`, `last: 2`, a `null` anchor, `mutate` a string, a `mutate` entry `5`); a config with no `mutate` → `ok`, 0/0; code-unit config order (`stryker.B` before `stryker.a`); a source with no final newline → `ok`; 2 drift wordings (`found at 3, 13`; a pair found once while its first line stands elsewhere); reversed boundaries; first equals last now on one line → `2-2`; the unreadable source; 2 CLI spawn rows (passing root with "1 range, 1 whole file" / "2 ranges, 0 whole files"; failing root with 3 stderr lines).
- Red: exactly **1** failure, the unreadable-source row (today's text is "names a unreadable source file"). The other 17 describe today's correct behaviour and pass now: their red is the mutant each one kills, which the final Q51 shows. They cannot be red against the current checker without breaking it.

## Survivor rows: first run, a test-setup fault

- `p3-s6b-survivors-red.log` (CPU 3/12/3): 4 failed, 35 passed, against 1 predicted. Three of the four come from a fault in my test helper, not in the checker: `plantedRoot({ anchors: undefined })` falls back to the default parameter (the aligned anchors). So the "missing anchors file" row got `ok: true`, and the unreadable-anchors and failing-CLI rows could not create their setup. The fourth is the predicted unreadable-source red.
- Fix in the test only: `null` now means "no anchors file". The checker is unchanged. The rows run again on the corrected setup.

## Survivor rows, corrected run, and the wording fix

- Red (`p3-s6b-survivors-red-2.log`, CPU 23/7/19): exactly 1 failure, the unreadable-source row ("names a unreadable source file" against "names an unreadable source file"). 38 passed. As predicted.
- Fix (a defect found by the mutation run): `sourceLines` stores "a missing" or "an unreadable", and `brokenRange` writes `names ${error} source file`. The "missing" text is unchanged.
- Green (`p3-s6b-survivors-green.log`, CPU 6/12/2): 39 passed.
- Still to do: the `runStrykerRanges` extraction with in-process rows (the spawn rows already pin today's exact CLI output), the equivalence arguments, CodeScene, the gates and the final Q51.

## `runStrykerRanges` extraction: prediction, written before the run

- 2 new in-process rows reuse the spawn rows' exact oracles (`cliCases`): status, stdout and stderr for the passing root (1 range, 1 whole file / 2 ranges, 0 whole files) and the failing root (3 lines).
- Red: the module has no `runStrykerRanges` export, so the test file fails at link time: 1 failed file, no tests run.
- Green: 41/41. The 2 spawn rows must still pass after the move, which shows the CLI output is byte-identical. The guard's condition does not change.

## `runStrykerRanges` extraction: observed red

- `p3-s6b-extract-red.log` (CPU 17%, no game processes; coordinator GO after the user's "livre"): 2 failed, 39 passed. Both failures are the 2 new in-process rows, with `TypeError: runStrykerRanges is not a function`.
- Mismatch with the prediction (link-time failure, no tests run), recorded and not chased: Vitest's module transform reads named imports through the module namespace, so a missing export is `undefined` at the call rather than a link error. It is explained, and it is a stricter red than predicted: only the 2 new rows fail, for the missing function, while the 39 existing rows (the 2 spawn rows among them) still pass on today's CLI.

## `runStrykerRanges` extraction: green

- Change: `counted` moves to module scope; the exported `runStrykerRanges({ root, stdout, stderr })` writes the failure's code and lines to `stderr` and returns 1, or writes the verified counts to `stdout` and returns 0. The guard's condition is unchanged; its body is now `process.exitCode = runStrykerRanges();`.
- `p3-s6b-extract-green.log`: 41/41. The 2 spawn rows still pass, so the command line's output is byte-identical after the move.
- CodeScene: `check-stryker-ranges.mjs` 10, `check-stryker-ranges.test.mjs` 10.

## Final Q51: prediction and equivalence arguments, written before the run

Line numbers below are the current file's (lines 1-233 are unchanged since d956826, whose report listed 33 survivors and 27 no-coverage mutants). Every other survivor and no-coverage mutant of d956826 is predicted **Killed** by the 18 survivor rows and the 2 in-process rows; the new `counted` and `runStrykerRanges` mutants are predicted **Killed** by the in-process rows' exact oracles ("1 range" against "2 ranges" and "0 whole files" kills each plural mutant).

Predicted to survive, each equivalent (no input can tell it apart):

1. L21 `"utf8"` → `""` (Survived). `readFileSync` with an empty encoding returns a Buffer (`""` is falsy, so no encoding check runs), and `JSON.parse` turns its argument into a string with `String(buffer)`, which decodes UTF-8. Neither path strips a BOM. Same value, same error for invalid JSON.
2. L53 `typeof value === "object"` → `true` (Survived). It only lets primitives on to the next tests: `null` still fails `value !== null`, and a number, string, boolean or bigint has none of the own or inherited keys `config`, `entry`, `first`, `last`, so `typeof value[key] === "string"` is false (`undefined` would throw only for `undefined` itself, and JSON has no `undefined`).
3. L67 `!sources.has(file)` → `true` (Survived). The cache only avoids reading the same file twice within one run; reading it again gives the same lines or the same error code.
4. L80 `index + distance < lines.length` → `<=` (Survived). The one extra index reads `lines[lines.length]`, which is `undefined`, never equal to the anchor's `last` (a string, checked by `isAnchor`).
5. L80 `index + distance` → `index - distance` (Survived). The loop runs further, to `index < lines.length + distance`; every extra index reads `undefined` at `index` or `index + distance`, never equal to a string anchor. The loop is still bounded.
6. L106 `places.length > 1` → `>= 1` (Survived). L105 has already returned for a length of 1, so this line only sees 0 or more than 1, where both comparisons agree.
7. L223 `?? []` → `?? ["Stryker was here"]` (Survived). `checkConfig` returns `undefined` only after it pushed a `STRYKER_RANGE_BROKEN` line, so the result is then a failure, which never returns `configs`; the mutated list is built and dropped.
8. The guard block at the module's end (NoCoverage or Ignored, as Stryker classes import-time code). It runs only when the module is the process's entry, which only the spawn rows do in a child process, outside per-test coverage. Its behaviour is pinned by the spawn rows and the single spawn row on the real repository; the coordinator allowed it to stay the only no-coverage block, with this argument.

Expected outcome: 7 survivors (1-7), the guard block's mutants as NoCoverage or Ignored, every other mutant Killed (a Timeout counts as detected). Any other survivor is a stop and a report.

## Final Q51: observed

- `p3-s6b-q51-mutation-stryker-ranges-final.log` on 5f51a97 (CPU 13/7/9, no game processes, alone), exit 0. Report `p3-s6b-mutation-stryker-ranges-5f51a97.json`.
- 341 mutants: 303 killed, 1 timeout, 8 survived, 1 no coverage, 28 ignored. Score **97.12** (was 80.71 on d956826).
- The 7 predicted survivors (arguments 1-7) survived, as predicted. The guard block is the one no-coverage mutant (L261 `BlockStatement`), as predicted (argument 8); its condition's mutants are among the 28 ignored.
- **Mismatch: one survivor not predicted.** L122 `first === undefined` → `false` (only the left operand of `first === undefined || !(last >= first)`). My prediction misread the d956826 row as the whole condition, whose mutants are all killed now. Explanation: it is equivalent. When `first` is `undefined`, `last >= first` compares with `undefined`, which converts to `NaN`, so it is false for every `last` (a number or `undefined`); `!(…)` is then true and the function still returns `undefined`. The left operand is redundant. Not chased; reported to the coordinator before any change (accept the argument, or drop the redundant operand and run Q51 once more).
