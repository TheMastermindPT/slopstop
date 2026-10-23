# CI red diagnosis (2026-10-23)

- Scope: diagnosis only, bounded (about 45 min). No code change and no heavy local run. The local probes were two single gate calls of about 1 s each.
- Sources:
  - `gh run view --log-failed` for run 39891408381 (`0b49cc0`, TypeScript 7): jobs 120211784577 (Windows) and 120211784838 (Ubuntu);
  - run 39872783914 (`4cf6541`, Part A): jobs 120150994000 and 120150993650;
  - runs 37333441934 (`95e2c85`), 37931475806 and 38075348284;
  - the full logs of the TypeScript 7 jobs, for the passing rows and their timings.
- Raw logs: session scratchpad `ci/`, not committed.

## Summary

| # | Failure | Jobs | Since | Kind | Silent clean? |
|---|---|---|---|---|---|
| A | `package-smoke-launcher.test.ts`, 77 rows | Ubuntu deep check | first red push `95e2c85` (2026-10-05); most likely introduced by `97678d2` (2026-09-12) | test-only (a Windows-only fixture run on Linux) | no |
| B1 | `fails on a planted Effect error: 'unknownInEffectCatch'` answers `{ ok: true }` | both | `0b49cc0` (TS 7). On Part A (tsc mode) the same rows failed as `EFFECT_GATE_BROKEN` | test fixture environment, which also exposes a gate hardening gap | not on the repository; yes for a project whose Effect version is not detected (see B1) |
| B2 | `runs the canary before any package: plugin removed, real compiler` gives extra `missing …` lines | both | `0b49cc0` (a new row in ts7-s1) | test fixture environment (same cause as B1) | no |
| C | (not in the brief) `passes on the repository` takes 13.4 s on Windows and 12.6 s on Ubuntu, under its 15 s timeout | both | `0b49cc0` | margin risk | no (a timeout fails visibly) |

The gate itself works on both runners. Each TS 7 job prints `Effect diagnostics verified; 50 advisory warnings.`. `runs the canary before any package: real canary` passes (812 ms on Windows, 744 ms on Ubuntu), and so does `passes on the repository`. So `effect-tsgo` finds TypeScript 7.0.2 on Windows and on Linux (the `@effect/tsgo-linux-x64` 7.0.2 build exists and runs), and Defender is not involved on the runner.

## B1 and B2: planted and plugin-removed rows outside the repository (highest priority)

**Cause.** These rows build their project in `os.tmpdir()`, outside the repository, and map `effect` to the repository's copy through `compilerOptions.paths`. The Effect language service decides which Effect major a file uses from package resolution, not from `paths`:
- On the runner, nothing above the temp folder holds `effect`. The file's Effect version is `unknown`, the service falls back to the v3 rule set, and the v4 rule `unknownInEffectCatch` never runs. The run is a valid clean report, so the gate answers `{ ok: true }`. `newPromise` does not depend on the Effect version, so the `newPromise` row still passes.
- Locally the rows passed only because `C:\Users\pedro\node_modules\effect` (4.0.0) is a parent of `C:\Users\pedro\AppData\Local\Temp`. A stray user-level install made the fixture work.

**Proof (local, light).** I ran the same planted `unknownInEffectCatch` project as `fails on a planted Effect error` in two places:
- under `C:\Users\pedro\...\scratchpad`: `EFFECT_GATE_VIOLATIONS src/a.ts(4,24) unknownInEffectCatch`;
- at `C:\slopstop-ci-probe` (outside the home folder): `{"ok":true,"warnings":0,"projects":["."]}`. This is CI's result.

`effect-tsgo diagnostics --list-files` on the same two projects:
- outside: `{"file":".../src/a.ts","detectedEffect":"unknown","supportedEffect":"v3"}`, errors 0;
- under home: `"detectedEffect":"v4","supportedEffect":"v4"`, errors 1.

B2 has the same cause. The canary copy in a temp root loses the v4 entries (`unknownInEffectCatch` and the `anyUnknownInErrorContext` pair), so the mismatch carries three extra `missing` lines.

**Since.** These rows are real-compiler rows on temporary roots.
- Part A (`4cf6541`, tsc mode): `unknownInEffectCatch` and `newPromise` failed as `EFFECT_GATE_BROKEN` and `clean` as `ok: false`. The failure was visible: in tsc mode a temp root's run produced something the gate classed as broken.
- TS 7 (`0b49cc0`, diagnostics mode): the same environment gives a clean report. This is how B1 became `{ ok: true }`.

So (B) was red on Part A too, but it failed closed there.

**Is it a gate defect?** For the repository: no.
- The four packages and the canary resolve `effect` through the repository's `node_modules`.
- On both runners the real canary matches, so its `unknownInEffectCatch` entry is present and Effect v4 is detected.
- `passes on the repository` passes.

But the mechanism is a silent-clean class that `degrade-distinguishes-broken` forbids, and the canary does not cover it. A project whose files resolve no Effect v4 gets the v3 rule set and can report clean while v4 rules are silently off. Examples are a future package outside the hoisted layout, or a broken install. The canary proves detection only for its own folder.

**Proposed fixes.**
1. Test fixtures (makes CI green for B1 and B2). Give each temporary root a real `node_modules/effect` that points at the repository's copy: a junction on Windows, a directory symlink elsewhere. Then drop the `paths` mapping, so detection works the way it does for a real package. The alternative is to build the fixture inside the repository, in an ignored folder. Either way, the local run then no longer depends on `C:\Users\pedro\node_modules`.
2. Gate hardening (a separate small slice, Pedro's call). Run `--list-files` and treat any checked file whose `detectedEffect` is not `v4` as `EFFECT_GATE_BROKEN`, naming the file. With fix 1 in place, a fixture without its link becomes the red row for this. Open point: whether files that never import Effect (for example renderer files) report `v4` or `unknown`. M1-style measurement on the four packages first.
3. Housekeeping: `C:\Users\pedro\node_modules\effect` (and its siblings) is a stray install that masked this. Pedro decides whether to remove it. I touched nothing.

## A: `package-smoke-launcher.test.ts` on Ubuntu

**Symptoms.** 77 rows fail:
- 67 × `expected [ 'rename', 'rename' ] to have a length of 1 but got 2`;
- 8 × `process.exitCode` 1 instead of 0;
- the four-stage row runs `registration` three times instead of `writer-proof, missing-runtime, witnessed-staging`;
- 1 × `expected "Mock" to be called with arguments`.

**Cause.** The unit test drives `apps/desktop/tests/e2e/package-smoke.mjs` with a mocked file system whose packaged tree is Windows-only:
- `prebuilds/win32-x64/fs-native-extensions.node`;
- `@libsql/win32-x64`, `@koromix/koffi-win32-x64`;
- the win32 Writer native bytes, read from the real `fs-native-extensions` package (test `:35-41`, `:148-162`).

The script picks the target from the host:
- `assertWriterResources` uses `${process.platform}-${process.arch}` and the per-target hash table (`package-smoke.mjs:154-159`, `:213-222`);
- the koffi prefix (`:136`);
- the expected runtime stdout `"\r\n"` on win32 and `""` elsewhere (`:429-431`);
- the registration stage requires Git for Windows (`:751-764`).

On Linux the target is `linux-x64`, so the mocked tree misses the binding and the resource checks fail. The run never reaches the Writer stages, and cleanup retries the rename.

**Since.** The last green push is `59fb35b` (2026-09-04), and the first red push is `95e2c85` (2026-10-05). That push carried 146 commits, with no push in between. `git blame` puts the win32 fixture and the platform-picking code in `97678d2` (2026-09-12, "test(packaging): prove writer ownership and crash recovery"); `5274425` and `4688eea` added to it. This is not bisected: proving the exact first commit would need Linux runs.

**Kind.** Test-only. The package smoke is a Windows packaging proof by design (Git for Windows, `.exe`). The product code is not wrong on Linux; the unit test assumes a Windows host.

**Proposed fix (pick one).**
- (a) Make the fixture follow the host: build the mocked tree from `process.platform`/`process.arch` and use that target's native bytes and pinned hash. The rows that are Windows-only by contract (Git for Windows, `"\r\n"` stdout) run only on win32.
- (b) Mark the file `describe.runIf(process.platform === "win32")` and let the Windows job prove it. That is smaller, but leaves Linux with no coverage of the launcher logic.

## Other observations

- Earlier red runs had more failures on the Windows job: `canonical-writer-package-smoke.integration.test.ts`, `registration-preparation` (`ENOENT ... Temp\opencode\pc-s1-preparation-XXXXXX`), `registered-project-selection` and timeouts (runs 37333441934 to 38075348284). They are gone by the Part A run, where the Windows job fails only on the gate rows. I did not trace them further.
- C: `passes on the repository` uses about 85-90% of its 15 s bound on 2-vCPU runners. It is a likely flake once A, B1 and B2 are fixed. The bound is not raised (standing rule); this needs a decision.
- The B fixes touch only `apps/harness/scripts/check-effect-diagnostics.test.mjs`, and the hardening touches the gate script. A needs only `apps/desktop/src/main/package-smoke-launcher.test.ts`.
