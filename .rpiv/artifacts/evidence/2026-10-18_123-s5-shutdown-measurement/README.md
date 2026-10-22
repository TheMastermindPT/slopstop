# #123 s5 opening measurement (STEP 1)

- Slice `u2b-s5-harness-runtime`, contract `content_hash` 1a915533f3e62e1e7b6aa43576ce2d26fed4ebb206506dda81a1bbcc9a0b8ff3 (append-only check against `approved-1a915533…`: keep; `validate-artifact`: OK).
- Parent `df16fb7` on `refactor/123-effect-lifecycle-part-a`, worktree `slopstop-123`. No product code changed; the only tracked change in the worktree is the design artifact (pre-existing).
- Coordinator GO (CPU 7/6/6, Pedro informed). Run alone. Brief: Success Criteria, round-1 Y15 and round-2 W3/W10 amendments.

## Tool

- `shutdown-measurement.test.ts` + `shutdown-measurement.vitest.config.ts`, run from `apps/harness` with `pnpm exec vitest run --config <this folder>/shutdown-measurement.vitest.config.ts`.
- Access path (W10): `ManagedRuntime.make(harnessServicesLayer(roots, logger))` over a migrated root; the exported `ApplicationDatabase` is extracted; the registration ports are built with `createRegistrationRegistry`, `createProjectRegistrationObserver`, `createProjectRegistrationOwner` and `createRegistrationListing`, mirroring `projectRegistrationLayer` (`process-bootstrap.ts:205-244`), with that authority injected.
- Cells: **M-listing** (listing stop chain, nothing in flight), **M-listing-drain** (`registry.hasUnsettled()` started in the same synchronous turn right before `listing.stop()`), **M-dispose** (`listing.stop()` and `authority.stop()` first, then only `runtime.dispose()` is timed).
- Outside the timed window: root migration, runtime build, `ensureCurrent`, port construction, admission start, and post-sample cleanup (each cleanup bounded at 15 s; a timeout fails the sample).
- In-flight proof per M-listing-drain sample (W3): `pendingAtStop` (a settled flag read synchronously after the stop call is `false`) and `settledAtStopEnd` (the flag is `true` when the stop settled). A sample missing either is a failed sample.
- Burst (§116): `burst-rg-git-no-node-modules.sh`, copied from the s3 tool with only its header comment changed. Preflight: 1400 files, 0 under node_modules, in every window. A window opens only after the previous burst process exited.
- Bounds (s3 §114 T3/T4 restated): 200 samples per cell and condition; each sample bounded at 15 s (a bound counts as 15 000 ms); hard run bound 30 min (the Vitest test timeout is exactly 30 min; no new sample starts inside the reserved tail); a cell left incomplete, with a failed sample, a sample outside its window, or (drain) a sample without the in-flight proof is `broken`.
- Rule: M-listing and M-listing-drain keep the 3 000 ms budget if p99 ≤ 1 500 ms; M-dispose keeps the 500 ms deadline if p99 ≤ 250 ms.

## Runs

| Run | CPU before | Result | Log |
| --- | --- | --- | --- |
| Smoke (`MEASURE_SMOKE=1`, tool check only: 2 samples per quiet cell + M-listing-drain burst in one 30 s window) | 3/14/1 | exit 0, 32.9 s, no broken cell | `smoke-run.log`, `smoke-*` |
| Full | 8/9/1 | exit 0, 9 m 14 s (`elapsedMs` 551 491), started 16:09:54 +01:00, ended 16:19:07 +01:00 | `run.log` |

## Result (full run, ms, nearest-rank percentiles)

| Cell | n | bound hits | p50 | p95 | p99 | max | half bound | within | broken |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-listing quiet | 200 | 0 | 0.11 | 0.21 | 0.30 | 1.09 | 1 500 | yes | none |
| M-listing-drain quiet | 200 | 0 | 13.52 | 17.34 | 20.34 | 21.00 | 1 500 | yes | none |
| M-dispose quiet | 200 | 0 | 0.03 | 0.04 | 0.07 | 0.09 | 250 | yes | none |
| M-listing burst | 200 | 0 | 0.14 | 0.74 | 3.09 | 11.42 | 1 500 | yes | none |
| M-listing-drain burst | 200 | 0 | 40.75 | 327.72 | 397.12 | 418.83 | 1 500 | yes | none |
| M-dispose burst | 200 | 0 | 0.07 | 0.17 | 0.58 | 1.61 | 250 | yes | none |

- Highest p99 per bound: listing chain 397.12 ms (M-listing-drain burst) ≤ 1 500 ms; dispose 0.58 ms (M-dispose burst) ≤ 250 ms. **Both values stand: 3 000 ms budget, 500 ms dispose deadline.**
- In-flight proof: 400/400 drain samples carry both facts. Failed samples: 0 of 1 200. Samples outside their window: 0.
- Burst windows: 3, overlaps `[]`, failed bursts `[]`, every exit code 0.

| Window | Cell | Spawned | Timed start | End (from log) | Exited |
| --- | --- | --- | --- | --- | --- |
| 1 | M-listing burst | 15:10:07.769Z | 15:10:10.789Z | 15:13:08.000Z | 15:13:07.678Z |
| 2 | M-listing-drain burst | 15:13:07.679Z | 15:13:10.736Z | 15:16:07.000Z | 15:16:07.488Z |
| 3 | M-dispose burst | 15:16:07.488Z | 15:16:10.504Z | 15:19:07.000Z | 15:19:07.146Z |

## Disclosed tool limitation

- Window 1's computed end (15:13:08.000Z) is 0.32 s after its process exited. The script computes `END` before it logs its start line, and here the log line (15:10:08.013Z) fell in the next second, so the tool's `END` read is one second late. No sample is affected: the last timed stop in window 1 ended at 15:10:30.214Z, 157.5 s before the exit (window 2: 136.6 s, window 3: 159.5 s). The s3 tool has the same read.

## Files (sha256)

| File | sha256 |
| --- | --- |
| `shutdown-measurement.test.ts` | 8820513e6658f6e0d80c7e4ff00c9f0779ccb20a4f36cf42a4ace75e742c5b92 |
| `shutdown-measurement.vitest.config.ts` | 3dad1703e8a968919bf1b963e6a9d94bc3d319cf39266039682df1643e87d561 |
| `burst-rg-git-no-node-modules.sh` | 170162650a2c649dc407d9d24fc1a6e315eb6e9959cb5d59a5cba9a6e938c429 |
| `run.log` | 335a8cc3b142ddfffbd459c9fcc4e4b069b9ad88ca280aa5663e4c9f2d39ae7f |
| `samples.jsonl` (1 200 lines) | 51caf6eb218faa4be0accf3a503efe4f6a5b7139e08aec821fea894e5723cc7a |
| `summary.json` | aebc57bd52a364d8a2c2a2e27cadf449d2c8b75a695a5794479eb21b1272a8e4 |
| `burst-windows.json` | e1fef40260c27548494390504c8dccd80fc12efdea3e9bb40173e9b43f3f23d6 |
| `burst-1.log` | cc8c187a2278f779683c57a1c6ee0c42a9667044b891b2d1f1fba7bd2a6192a7 |
| `burst-2.log` | 6ae0654f1e59926c8e7d436427eb3472e819ae996b062c4fd4fa2283226e8404 |
| `burst-3.log` | 1599ea6a5d6b044f4f31d531e8edc7b62db88f5cde19e666cf84d02d29835863 |

STOP before any code (coordinator instruction).
