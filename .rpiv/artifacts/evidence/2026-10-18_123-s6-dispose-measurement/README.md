# #123 s6 opening measurement (order of work, step 0)

- Slice `u2b-s6-desktop-runtime`, contract `content_hash` 1f402a8f75d2f8e70dd98f55e57684317c3529584102461150b14586bc42f6e4 (Pedro, decisions §135). At start, `validate-artifact.mjs` answered OK and `append-only.mjs` answered `keep` against `approved-1f402a8f….md` (main checkout).
- Code parent `010ee05`, HEAD `de29eec` on `refactor/123-effect-lifecycle-part-a`, worktree `slopstop-123`. No product code changed; the only other tracked change in the worktree is the designer's s6 brief revision, committed with this tool.
- Coordinator GO: the run starts after 3 CPU readings under 30%, alone. Brief: `### Test Contract: u2b-s6-desktop-runtime`, Order of work step 0 (P-S6-3, S6-I10 (a), S6-J5).

## Tool

- `dispose-measurement.ts`, an Electron main script. It builds one `ManagedRuntime` over the design point 1 owners with today's constructors:
  - the real `createMainLogger`, writing to a temporary folder (`isPackaged` = `true`, so no pretty stdout stream);
  - the real `HarnessSupervisor`, never started, so there is no child;
  - the real `createProjectEntryBridge`, `createProjectStorageBridge` and `createWorkspaceBridge` over the supervisor's real session.
- Each owner is acquired with `Effect.acquireRelease` and exposes a once-latched `stop`. Its release stops it only when no `stop` came first (s3's `closeIfNeverStopped`), and a release failure is a defect. The bridges depend on the supervision Layer, so they release first.
- Each sample builds a fresh runtime and reads its services with `runtime.runSync` (outside the timing). Only `runtime.dispose()` is timed.
  - **M-dispose-after-program:** the program's stops ran first, outside the timing (project-storage, workspace, project-entry, then `await` the supervisor's stop), so every release is a no-op.
  - **M-dispose-safety-net:** no program ran, so the releases stop every owner.
  - After every dispose the tool checks that all four latches are stopped; a sample without that proof fails.
- Bundle command (from the worktree root), then the run command:

  ```
  node_modules/.bin/esbuild .rpiv/artifacts/evidence/2026-10-18_123-s6-dispose-measurement/dispose-measurement.ts --bundle --platform=node --format=cjs --target=node22 --external:electron --outfile=.rpiv/artifacts/evidence/2026-10-18_123-s6-dispose-measurement/dispose-measurement.bundle.cjs
  pnpm --filter @slopstop/desktop exec electron <abs>/dispose-measurement.bundle.cjs <abs>/full
  ```

  - esbuild 0.28.1; Electron 43.4.0; one `effect` copy in the bundle (`node_modules/effect`, 4.0.0).
  - The measured bundle: sha256 `87bfc622572b74d844a8468b45a33d90b849e48a140030228f27fcb9d3739f2a` (1 309 390 bytes). It is not committed (1.3 MB of bundled third-party code, and lint-staged would run Biome over it); it is reproducible from the command above.
  - After the run, `biome format` changed only whitespace in the tool source. A rebuild of the committed source differs from the measured bundle in exactly one place, a line break in the `outside` diagnostic of `summarize` (`if (outside.length > 0) broken.push(…)` printed on two lines). No measured code path changes.
- The output folder is an argument. The tool refuses an existing non-empty folder (exit 3, nothing written). Proven once against `smoke/`: `refusal-check.log` (pnpm reports Electron's exit 3 as its own exit 1; `smoke/` unchanged).
- Burst (§116): `burst-rg-git-no-node-modules.sh`, copied from the s5 tool with only its header comment changed. Preflight: 1400 files, 0 under `node_modules`, in every window. A window opens only after the previous burst process exited.
- Bounds (s3 §114 T3/T4, s5 restated): 200 samples per cell and condition; each sample bounded at 15 s (a bound counts as 15 000 ms); whole run bounded at 30 min (no new sample inside the reserved tail, plus a watchdog that exits 2 at 31 min); a cell left incomplete, with a failed sample, or with a sample outside its window is `broken`.
- Rule (half the bound, P-S6-3): `DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS` = 1 000 if every cell's p99 ≤ 500 ms.

## Runs

| Run | CPU before | Result | Log |
| --- | --- | --- | --- |
| Smoke (`--smoke`, tool check only: 2 samples per quiet cell + M-dispose-safety-net burst in one 30 s window) | 19.3/13.3/12.5 | exit 0, 29.8 s, no broken cell | `smoke-run.log`, `smoke/` |
| Refusal check (same `smoke/` folder again) | — | refused, exit 3 | `refusal-check.log` |
| Full | 8.7/22.7/14.6 | exit 0, 6 m 1 s (`elapsedMs` 360 897), started 00:48:24 +01:00, ended 00:54:26 +01:00 | `run.log`, `run-meta.log`, `full/` |

No other Electron, Vitest or Stryker process ran. No failure, timeout or Defender alert.

## Result (full run, ms, nearest-rank percentiles)

| Cell | n | bound hits | p50 | p95 | p99 | max | half bound | within | broken |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-dispose-after-program quiet | 200 | 0 | 0.022 | 0.052 | 0.075 | 0.613 | 500 | yes | none |
| M-dispose-safety-net quiet | 200 | 0 | 0.039 | 0.079 | 0.191 | 0.317 | 500 | yes | none |
| M-dispose-after-program burst | 200 | 0 | 0.025 | 0.088 | 0.269 | 0.514 | 500 | yes | none |
| M-dispose-safety-net burst | 200 | 0 | 0.083 | 0.139 | 0.213 | 0.541 | 500 | yes | none |

- Highest p99: 0.269 ms (M-dispose-after-program burst) ≤ 500 ms. **The 1 000 ms deadline stands.**
- Failed samples: 0 of 800. Samples outside their window: 0. Every sample carries the four-latch proof.
- Burst windows: 2, overlaps `[]`, failed bursts `[]`, every exit code 0.

| Window | Cell | Spawned | Timed start | End (from log) | Exited | Timed disposes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | M-dispose-after-program burst | 23:48:25.487Z | 23:48:28.495Z | 23:51:25.000Z | 23:51:25.465Z | 23:48:28.497Z – 23:48:28.988Z |
| 2 | M-dispose-safety-net burst | 23:51:25.466Z | 23:51:28.480Z | 23:54:25.000Z | 23:54:25.880Z | 23:51:28.485Z – 23:51:28.967Z |

## Disclosed limitations

- The 200 burst samples of each cell finish within about 0.5 s at the start of their 177 s window; the window then runs to its end before the next one opens (same shape as s5).
- The tool reproduces design point 1 inside the evidence folder; `desktop-runtime.ts` does not exist yet. It measures the owners' real stops and Effect's real scope close, not the future module's code.
- `M-dispose-after-program` stops the supervisor without a child, so its stop resolves at once. The harness stop's grace and kill are outside the dispose bound by design (design point 3).

## Files (sha256)

| File | sha256 |
| --- | --- |
| `dispose-measurement.ts` | 67795c0edd72ea6958ec7767fcf9865bee84e9f4bec2174b32b8b591cc3f542c |
| `burst-rg-git-no-node-modules.sh` | 9da0c32ed4b58706ffe04c287a6b72660f27c916662e24be9e371970a3d32a6c |
| `run.log` | 474cd07686161696dd5aed912c6e2d6b85f70d878eb756acc59c1de0695d1978 |
| `run-meta.log` | 621dd2c5772ad37eea9d627318c857cb57b9a9e618c7411e5eec3d6b32774bc6 |
| `full/samples.jsonl` (800 lines) | b69a07cd8baf9e6e4dd188857bd5c1fb67b695bd074687ebcfbc3d84f52fab35 |
| `full/summary.json` | 4565c4ec2bd0fc462cf786459c3c98c60b3b9edc71599d9d2975f15774cdfc21 |
| `full/burst-windows.json` | 9872d631c8b318843a2ee7905777bad8600c0fd0fe6bd530d5c991fc40cc7710 |
| `full/burst-1.log` | 1156fe598f17a2801af3cdd73c7166e8e1d32bf29949a4c3e0e7b49d558682f3 |
| `full/burst-2.log` | 1e9af441f897bd08225994bda7df11f6ed722d84bf744000600270fba1630432 |
| `smoke-run.log` | 4b11f9edd49470d123fb8b75e0b7cd466be79d52ed17d164406f43b2e3eeb63f |
| `refusal-check.log` | 0003bdb9c358f7da4c4dd2b450153f3e69a20cc889108b9696f86f7b73ce23fa |
| `smoke/samples.jsonl` (6 lines) | f629c1b34a732be8b8b22a00f60cad16baa8c909a909632e26a4c056d174e88b |
| `smoke/summary.json` | 0cbd19e467f1b52a1947d0266b4e0f3ece879d35470edc2b86491ff2e1e6d703 |
| `smoke/burst-windows.json` | fc40efc38df124e1141ef6f67cf752af581159cbeae10f8e1080d5ef08efc907 |
| `smoke/burst-1.log` | 26605910600c001bd9bbe2a28c422e9258610f23f89777253c4f05cb4e21ec20 |

- `run.log`, `smoke-run.log` and `refusal-check.log` were written with CRLF; the hashes above are of those working-copy bytes. Git stores them with LF; the committed blobs hash to `058e09e9b1bb3f91f50493e532828f93ed26b504a4cd525f58332e65b97ad91b`, `3d019bf85bbf107918c37ff9558913dd95b63ada958d7345a2e60589f75d177b` and `ce8e5b5fe25112596834c994f42337149a9fb628d6aef46546bb4299ff59e172`. Every other file has LF and the same bytes in Git.

STOP before the build (coordinator instruction).
