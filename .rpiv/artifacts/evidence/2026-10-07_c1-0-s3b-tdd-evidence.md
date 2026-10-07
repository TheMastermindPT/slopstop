# C1-0 S3b TDD evidence: `c1-0-s3b-upgrade-window`

Append-only. This file records the evidence for slice `c1-0-s3b-upgrade-window` of `.rpiv/artifacts/designs/2026-10-06_18-48-25_upgrade-window.md`.

- **Approved design.** Content hash `59459de71142422b635967cd8c7efdde4f089a3acbe4111e70e2813e40801c77`. The approved copy was saved from `git show dd00e95:<design>` (the commit with the §10 authorization) as `.rpiv/evidence/2026-10-06_18-48-25_upgrade-window/approved-59459de7….md`; that directory is git-ignored. The append-only check exits 0.
- **Build authorization.** `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §10 (commit `dd00e95`).
- **Branch.** `feat/c1-0-s3b-upgrade-window`, created from `main`.
- **Lane.** Rigorous.
- **Before the behaviours.** The test-stability commit `84a2d8b` came first, as §10 requires.
- **Workspace.** The shared main working tree (deviation 1).

**Digests.** Each red and green state is identified by its parent commit `84a2d8b` and a working-tree digest. The digest is the first 16 hex characters of the `sha256` over:
- `git diff HEAD --binary`;
- then every untracked file except `.playwright-mcp/`, as `UNTRACKED <path>` followed by its bytes, in sorted path order.

From some point during B33/B34, the untracked file set also held the coordinator's research note `.rpiv/artifacts/research/2026-10-07_oh-my-pi-and-prime-agent-inspiration.md`. That note is not part of this slice.

**Logs.** The logs are in the session scratchpad, `ev/*.txt`. Each log starts with its digest.

## UPG-B31: one strict upgrade result from the bridge

- **Tests.** `answers every upgrade reply with one strict result: <case>` (row tests), plus the regression rows `keeps the activation result unchanged on <fault>`, `keeps the switch result unchanged on <fault>` and `keeps list and registration transport results unchanged on request.failure`. All are in `apps/desktop/src/main/project-entry-bridge.test.ts`, seam (a).
- **Scaffolding before the red.**
  - `upgrade` was added through the existing `echoing`, with the transport-loss result.
  - `project-upgrade-failure.ts` was a stub that always answered `connectionLost`.
  - The first run was not a valid red: six `request.failure` cases failed on `SchemaError: Missing key ["payload"]["retryable"]`, a fixture error in the test's own failure factory. The factory was fixed and the run repeated.
- **Red, at digest `39fe7501e1b203f9`.** 9 failed and 30 passed (`b31-red.txt`). Every `broken` row answered `{ status: 'unavailable', … }` instead of `{ status: 'broken', … }`, exactly as Expected red predicts: the mismatched reply, the activation result, the protocol error, the invalid id, the repeated id, the three `request.failure` codes, and the direct mapping call.
- **Green on arrival** (regression pins and transport rows): the 15 echoed results; the five `connectionLost` cases; the activation, switch, list and registration regressions; and the three existing bridge tests.
- **Implementation.**
  - `harness-pending-request.ts`: handlers gain a trailing `PendingFailure` (`transport`, `protocol`, or `harness` with a code). `workspace-bridge.ts` and `project-storage-bridge.ts` are unchanged.
  - `project-upgrade-failure.ts`: `projectUpgradeFailure(request, fault)`, an exhaustive Effect `Match` over `ProjectRequestFault` (the pending failures plus `send` with its session code, and `desktop`).
  - `project-entry-bridge.ts`:
    - `Pending.fail(fault)` and `request(…, broken(fault))`;
    - a stopped bridge answers `transport`;
    - a failed send answers `send` with its code;
    - an invalid command, an id collision and a mismatched reply answer `desktop`;
    - `echoing` takes `broken(request, fault)`, and activation and switch keep their former result through `unavailable(…)`.
- **Green, at digest `6cff9b66b8cf04c1`.** `project-entry-bridge`, `workspace-bridge` and `project-storage-bridge` passed 74/74 (`b31-green.txt`).

## UPG-B32: strict IPC handler and preload method

- **Tests.**
  - `registers strict Project IPC handlers: upgrade` and `…: list, activate and switch as before`, in the new `project-entry-ipc.test.ts`;
  - `upgrades through a strict preload method`, in `preload.test.ts`;
  - the method lists in `package-smoke-verifier.test.ts` and `tests/e2e/shell.test.ts`.
- **Scaffolding.**
  - `registerProjectEntryIpc` registers the three existing handlers, moved unchanged from `main.ts`.
  - The preload `upgradeProject` is a stub that rejects without calling `invoke`.
  - The channel and the `SlopStopApi` method were added, and the renderer fake gains `upgradeProject`.
  - The bridge mock gains `upgrade` (scaffolding).
- **Red, at digest `d805cf7d49840fd3`.** 3 failed and 133 passed (`b32-red.txt`):
  - `No handler for projects:upgrade`;
  - `promise rejected "Error: upgradeProject is not implemented."` (no `invoke` call);
  - `Packaged renderer smoke did not satisfy the production boundary`: the expected method list lacks `upgradeProject`.
- **Implementation.**
  - The `projects:upgrade` handler uses `decodeStrict(ProjectUpgradeRequestSchema, value)`.
  - The preload decodes strictly in both directions.
  - `package-smoke-verifier.ts` adds `upgradeProject` to its expected methods.
- **Green, at digest `7ab6b1d1b2fb61bd`.** 136/136 (`b32-green.txt`).

## UPG-B33: an older Project is updated and opened

- **Tests.** `updates a migration-required Project and opens it > …`, in `apps/desktop/src/renderer/project-upgrade.test.tsx`, seam (c). There are five cases: upgraded with each step gated; not-required; recovery-required; healthy canonical with runtime migration; and switch.
- **Red, at digest `dd1c759b75d3d970`.** 5 failed (`b33-red.txt`), with `#ws-progress is not mounted` and `Unable to find … Read-write` (the safe-mode view stays). This matches Expected red. The two no-upgrade cases fail only because `#ws-progress` is missing.
- **Implementation.**
  - New `use-project-upgrade.ts`, holding `needsUpgrade` and the update step.
  - `ProjectsWorkspace`:
    - `busy` became `"opening" | "updating" | undefined`;
    - an always-mounted `<p id="ws-progress" aria-live="polite">` sits beside the `srOnly` region, outside the workspace section;
    - `switchTo` returns the presented target, and `open` starts the update when that target needs it.
  - `WorkspaceView` lost its conditional busy line.
  - A `.progress` style was added, using existing tokens only.
- **Green, at digest `7634aa9ba96b9a9d`.** The renderer project passed 54/54 (`b33-green.txt`).

## UPG-B34: a failed update explains itself and can be retried

- **Tests.**
  - `explains a failed update and retries it > …`: 12 rows, the two retries, two false successes, the other follow-up result, not-registered, three rejected calls, and three restart variants.
  - `clears the update panel > …`: four cases.
  - A test-support module, `apps/desktop/src/shared/upgrade-result-fixtures.ts`, derives each row's status from the protocol schema. The bridge test now uses it too, so jscpd stays at 0.
- **Red, at digest `754c1a83f100c1a6`.** 22 failed and 11 passed (`b34-red.txt`): no panel exists (`Unable to find … This Project could not be updated. Your data is intact.`).
  - **Prediction difference.** "Not registered" was predicted green on arrival but was red (`Unable to find role="alert"`): the B33 implementation ignored `not-registered`.
  - **Green on arrival, as predicted:** other follow-up result; the first-attempt and follow-up rejected calls; and the first two restart variants. The third restart variant (a stale upgrade beside a newer open) was also green on arrival.
- **Implementation.**
  - **`use-project-upgrade.ts`.**
    - The panel's problem state, and an Effect `Match` over the upgrade status.
    - `upgraded` and `not-required` lead to the follow-up activation. If that activation still answers `migration-required`, the panel shows `broken` + `storageBroken` (G5).
    - `not-registered` shows "This Project is not registered."
    - Any other status shows the panel.
    - `clear` is a stable callback.
  - **New `upgrade-problem.tsx`.**
    - A `role="alert"` with the three lines.
    - "Try again" outside the alert, unless the status is `refused`.
    - Focus moves to "Try again", or to the first line when refused.
  - **`ProjectsWorkspace`.**
    - `open` runs through a shared `select(kind, step)` guard. Retry uses the same guard with `"updating"` and focuses `#ws-heading`.
    - The panel is cleared by a new selection, by a refresh, by starting the add or remove flow, and by the `ready`/`attempt` reset.
- **Green, at digest `92e6c3dd7532c5f9`.** The renderer project passed 82/82 (`b34-green.txt`).
- **A broken run before that green.** The first green attempt hung: an unstable `clear` callback changed `refresh` on every render, so the reset effect ran in a loop. The run was stopped (the stuck vitest processes were ended), and `clear` was wrapped in `useCallback`. This was a defect in my implementation; no oracle changed.

## UPG-B35: the real app updates an older Project

- **Seed.** The new `apps/harness/tests/integration/project-upgrade-ui-seed.integration.test.ts`, gated by `PC_UPGRADE_USER_DATA`:
  - it runs `createGenerationTwoProject(<userData>/storage)`;
  - it asserts exactly one `unbound` entry, with storage safe mode and canonical `migration-required`;
  - it writes `fixture-upgrade-project.json`.
  - **Probe.** The first probe used the long scratchpad path and failed at `create` (`status: 'unavailable'`). The probable cause is the Windows path length. With a short temporary path it passed and wrote `{"projectId":"00000000-0000-4000-8000-000000000010"}`. The E2E uses a short `tmpdir()` path.
- **E2E test.** `updates an older Project in the window`, in `apps/desktop/tests/e2e/project-upgrade.test.ts`. The shared `tests/e2e/harness-seed.ts` (`runHarnessSeed`) is now also used by `projects.test.ts`.
- **Run.** After the coordinator's go-ahead, `pnpm test:e2e` ran at digest `51ed446035ce5178` and passed 11/11 in 1.6 min (`e2e-1.txt`). `updates an older Project in the window` passed in 11.3 s. Expected red was "none — composition guard", and the test was green on arrival as predicted. `projects.test.ts`, now on the shared seed helper, and the `shell.test.ts` method list also passed.

## Slice gates (working tree at digest `51ed446035ce5178`, parent `84a2d8b`)

- **`pnpm check`:** 2416 passed (run at the B34 state plus the B35 files).
- **`pnpm check:dead-code`:** clean.
- **`pnpm check:duplicates`:** 0 clones.
- **CodeScene `pre_commit_code_health_safeguard`:** passed, 25 files. Score 10 for `projects-workspace.tsx`, `workspace-view.tsx`, `use-project-upgrade.ts`, `project-entry-bridge.ts` and the two new test files.
- **`pnpm test:integration`:** 2022 passed and 5 skipped. The skips are the 4 earlier ones plus the new env-gated upgrade seed (`integration-1.txt`).
- **`pnpm package:launch-smoke`:** exit 0, "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." (`launch-smoke-1.txt`).
- **`pnpm test:mutation --force`:** "Force mode is activated, all mutants will be retested". Score 88.26, above the break threshold of 80 (it was 87.89 after S3a). Run time 5 min 33 s (`mutation-1.txt`).
  - `project-upgrade-failure.ts`: 100% (18 killed, 2 ignored).
  - `harness-pending-request.ts`: 97.67% (42 killed, 1 survived). The survivor is the empty `catch` block in `tryCreateHarnessCommand`, which existed before this slice. It is an equivalent mutant: the block already answers `undefined`.
  - `preload.ts`: 100% (16 killed, 9 ignored).
  - `package-smoke-verifier.ts`: 87.98%.

## Deviations

1. **Workspace.** The main working tree on `feat/c1-0-s3b-upgrade-window`, instead of a linked worktree. This was the user's choice, recorded in §10.
2. **B34 prediction.** "Not registered" was red, not green on arrival (see UPG-B34).
3. **Test support in `src/shared`.** `upgrade-result-fixtures.ts` is test support shared by the desktop main and renderer tests. Its only consumers are tests.

## Review round 1 fixes (candidate `51a2e8e`; findings in the coordinator's `s3b-review-round-1.md`)

The user decided to fix all findings now; the decision is recorded in `2026-10-05_conversation-decisions.md` §10. Round 2 is the last.

**Logs.** The logs are in `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/338a4bae-a42a-40dc-9e1f-30ad2d4bf69d/scratchpad/ev2/`. The slice logs above are in the sibling `ev/` directory.

**Digests.** The digests in this section, all with parent `51a2e8e`, use the definition above with two exclusions: `.playwright-mcp/` and the coordinator's untracked research notes `.rpiv/artifacts/research/2026-10-07_*`.

- **V1: the remove flow clears the panel.**
  - New case: `clears the update panel > when the remove flow starts and is cancelled`. It was green on arrival (`tests-added.txt`).
  - Probe: with `upgrade.clear()` removed from `onRemove`, the case went red at digest `d44cf02b501b13eb` (`v1-probe.txt`). The code was restored.
- **V2: the stale-result guards are pinned.**
  - "Drops a pending upgrade when the harness restarts" now releases `upgraded`. It then asserts that no follow-up `activateProject` call happens.
  - "Keeps a newer open guarded…" now asserts, after the other activation answers, that `Read-write` shows and that no panel shows on `Project repo-a`.
  - Probes, one per guard, each restored:
    - with the guard after the upgrade request removed (`use-project-upgrade.ts:54`), variants 1 and 3 went red at digest `20f7880d467a6716` (`v2-probe-upgrade-guard.txt`);
    - with the guard after the follow-up activation removed (`:40`), variant 2 went red at digest `bdaa44a5b77e613e` (`v2-probe-activation-guard.txt`);
    - with the `finally` release guard of `select` replaced by `if (true)`, variant 3 went red at digest `86c3c799a1095203` (`v2-probe-release-guard.txt`).
- **V3: no add flow during an update.**
  - New case: `does not start the add flow during an update`.
  - Red at digest `84f2299210279646`: `expected null to be 'true'`, because the Add button had no `aria-disabled` while busy (`v3-red.txt`).
  - Fix: `AddRepositoryButton` takes `busy`. It is `aria-disabled` and does nothing while a Project is opened or updated, and it stays focusable.
  - Green at digest `077ab8444d6be064`: renderer 84/84 (`v3-green.txt`).
- **Cheap fixes.**
  - The retry-success case asserts "Updating Project…" after the retried upgrade answers.
  - The IPC test fakes are typed as `Parameters<typeof registerProjectEntryIpc>[0]`, with `satisfies` instead of `as never`.
  - The harness `tsconfig.json` includes `vitest.native-long.config.ts` and `vitest.native-long-files.ts`.
  - The stability evidence has an appended correction: the run total went from 2017 to 2026, and `vitest list` shows 2025. The name comparison is saved at `…/scratchpad/s1/name-comparison.txt`.
  - The E2E asserts that the older row no longer contains "Safe mode" after `Read-write`.
  - `apps/desktop/src/renderer/use-project-upgrade.ts` joins the Stryker mutate scope, as the coordinator instructed.
- **B35 probe.**
  - Setup: the `needsUpgrade` path in `open` was disabled, then the app was repackaged and `project-upgrade.test.ts` alone was run.
  - Result: red at digest `acebcd9f40b85ac3`. `getByRole('region', { name: 'Project workspace' }).getByText('Read-write', { exact: true })` was not found within 8 s (`b35-probe.txt`).
  - The code was restored.
- **Pre-commit fast gate.** `pnpm check` passed 2418 at digest `226c773611624050` (`pre-check.txt`).

**Evidence-record additions.**
- Green on arrival, outside the predicted list: the third restart variant (a stale upgrade beside a newer open) and the follow-up activation rejection.
- The B34 "Lifetime" cases are named `clears the update panel > …`.
- §11 of `conversation-decisions.md` (Waypoint relationships) entered this range on the coordinator's instruction. It is unrelated to S3b and accepted as a deliberate deviation.
- Deviation 3 (test support in `src/shared`) was accepted by the coordinator: it is test-only and follows the `test-api.ts` precedent.

The gates on the review-fix commit are recorded in the next section. Each log starts with that commit's SHA.

## Gates on the round-1 fix commit `12b1664c033f61efb820654897c38aaedeb3fd96`

Each log starts with `commit 12b1664…`. No log shows a dirty tracked file; the only untracked paths were `.playwright-mcp/` and the coordinator's research notes. Logs are in `…/scratchpad/ev2/`.

| Gate | Command | Result | Log |
|---|---|---|---|
| Fast gate | `pnpm check` | 2418 passed | `gate-check.txt` |
| Dead code | `pnpm check:dead-code` | clean | `gate-knip.txt` |
| Duplicates | `pnpm check:duplicates` | 0 clones | `gate-jscpd.txt` |
| CodeScene | `analyze_change_set` base `dd00e95`, plus `code_health_score` per touched file | passed, 34 files checked; 28 touched `.ts`/`.tsx` files score 10 | `gate-codescene.txt` |
| Integration | `pnpm test:integration` | 2022 passed, 5 skipped | `gate-integration.txt` |
| E2E | `pnpm test:e2e` | 11/11; `updates an older Project in the window` 10.0 s | `gate-e2e.txt` |
| Launch smoke | `pnpm package:launch-smoke` | exit 0, "validated renderer isolation, Project Storage, and Writer proof" | `gate-launch-smoke.txt` |
| Mutation | `pnpm test:mutation --force` | 88.33, above break 80; 7 min 32 s | `gate-mutation.txt`; per-file scores in `gate-mutation-files.txt` |

- **CodeScene, files with no score.** Six touched files returned "Could not determine Code Health score": `desktop-api.ts`, which has only types, and five Vitest config or file-list modules, which have no functions.
- **Mutation, per file.**
  - `use-project-upgrade.ts` (new in scope): 91.30%, with 42 killed and 4 survived. The survivors are:
    - `:45`, the status and request literals of the false-success problem (×2);
    - `:46`, `activation.status === "active"` → `true`. Round 2 pins it (S1).
    - `:65`, the `useCallback` dependency array, which is an equivalent mutant.
  - `project-upgrade-failure.ts`: 100%.
  - `preload.ts`: 100%.
  - `harness-pending-request.ts`: 97.67%.

## Review round 2 fixes (candidate `12b1664`; coordinator's `s3b-review-round-2.md`)

The user decided to fix M1 and S1–S3 without a third review. The decision is recorded in `2026-10-05_conversation-decisions.md` §10. The round-1 outcome bullet also moved there from §11. Logs are in `…/scratchpad/ev3/`.

- **Red at digest `d4f80b2338a56052`.** Parent `12b1664`; renderer: 3 failed, 34 passed (`r2-red.txt`).
  - **M1.** New case: `does not start the remove flow during an update`. The Remove button was not `aria-disabled` while busy (`expected null to be 'true'`).
  - **S3.** `does not start the add flow during an update` and the new `does not start the add flow while a Project is opening` found no announcement "A Project is being opened or updated. Try again when it finishes."
  - **S2.** Add was already `aria-disabled` while opening: that part was green on arrival. The new case was red only on the S3 announcement.
- **S1.** `presents another follow-up result as opening does` now asserts that no list call follows the upgrade. It was green on arrival.
  - Probe: `use-project-upgrade.ts:46` set to `else if (true)`. The case went red at digest `2b093a42cf220bcd` (`s1-probe.txt`), which kills the round-1 survivor. The code was restored.
- **Implementation.**
  - `RowProps` gains `busy`.
  - `RemoveButton` is `aria-disabled` while busy. It stays focusable, and a click announces `busyAnnouncement` instead of starting the removal. A row-specific block (the open Project, or one needing recovery) keeps its own announcement first.
  - `AddRepositoryButton` announces the same reason while busy.
  - The shared text `busyAnnouncement` lives in the new `busy-announcement.ts`. A first placement in `projects-list.tsx` made two import cycles, which dependency-cruiser rejected in `pnpm check`.
- **Green at digest `1e609d66a1361474`.** Renderer: 86/86 (`r2-green.txt`). After the module move, the renderer ran 86/86 again at digest `6dfa04e857ecb460` (`r2-green-final.txt`), and `pnpm check` passed 2420 (`pre-check.txt`).

The gates on the round-2 fix commit are recorded in the coordinator report for that commit. Each log starts with its SHA.

## 1fe5441 gates (round-2 fix commit `1fe544101e1669d7943f292f78c831707f76bab9`)

**Logs.**
- Gates: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/338a4bae-a42a-40dc-9e1f-30ad2d4bf69d/scratchpad/ev4/`. Each log starts with `commit 1fe544101e1669d7943f292f78c831707f76bab9`, and none shows a dirty tracked file.
- Red and green: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/338a4bae-a42a-40dc-9e1f-30ad2d4bf69d/scratchpad/ev3/`.

**Red and green (parent `12b1664`).**
- Red at digest `d4f80b2338a56052`: M1 and S3 (`r2-red.txt`).
- S1 probe red at digest `2b093a42cf220bcd` (`s1-probe.txt`).
- Green at digest `1e609d66a1361474`: renderer 86/86 (`r2-green.txt`).
- After the `busy-announcement.ts` move, at digest `6dfa04e857ecb460`: renderer 86/86 and `pnpm check` 2420 (`r2-green-final.txt`, `pre-check.txt`). That tree became `1fe5441`; the lint-staged Biome pass made no change.

**Gates.** They ran in sequence, each stopping the run on failure. None failed.

| Gate | Command | Result | Log |
|---|---|---|---|
| Fast gate | `pnpm check` | 2420 passed | `gate-check.txt` |
| Dead code | `pnpm check:dead-code` | clean | `gate-knip.txt` |
| Duplicates | `pnpm check:duplicates` | 0 clones | `gate-jscpd.txt` |
| CodeScene | `analyze_change_set` base `dd00e95`, plus `code_health_score` per touched file | passed, 37 files checked; 30 touched `.ts`/`.tsx` files score 10 | `gate-codescene.txt` |
| Integration | `pnpm test:integration` | 2022 passed, 5 skipped | `gate-integration.txt` |
| E2E | `pnpm test:e2e` | 11/11 in 1.7 min | `gate-e2e.txt` |
| Launch smoke | `pnpm package:launch-smoke` | exit 0, "validated renderer isolation, Project Storage, and Writer proof" | `gate-launch-smoke.txt` |
| Mutation | `pnpm test:mutation --force` | 88.39, above break 80; 7 min 4 s | `gate-mutation.txt`; per-file scores in `gate-mutation-files.txt` |

- **CodeScene, files with no score.** Seven files have no score: types, constants and configs, including the new `busy-announcement.ts`.
- **CodeScene version.** The MCP reported an update from 1.5.7 to 1.5.8. The update was not applied, so these results come from 1.5.7.
- **Mutation, per file.**
  - `use-project-upgrade.ts`: 93.48%, with 43 killed and 3 survived. The survivors are the equivalent `:45` (×2) and `:65`. The round-1 survivor at `:46` is now killed.
  - `project-upgrade-failure.ts`: 100%.
  - `preload.ts`: 100%.
  - `harness-pending-request.ts`: 97.67%.
- **Mutation, worker crash.** One Stryker child process (pid 26800) exited with code 3221225477 (0xC0000005), the known Windows worker crash. `gate-mutation.txt` reports it twice, as the warning and as the error detail. Stryker recovered, and the final score comes from the complete run.
