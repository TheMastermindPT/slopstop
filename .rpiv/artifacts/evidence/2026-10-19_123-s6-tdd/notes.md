# s6 TDD running notes (raw; summarized in ../2026-10-19_123-s6-tdd-evidence.md)

- base (digest e3b0c44298fc1c14 = clean tree at 5f1bca3): 5 files, 251/251 green.
- scaffold-red (9b320d231d943120): 29 failed / 39 passed. Every failure matches its Expected red:
  - B1 rows lack "dispose" (quit, requested exit, failed harness stop), dispose rejects resolves, both-fail rejects with harness alone, never-settles rows reach the terminal action at once.
  - B2: entry stop never called (order of 4 vs 6; entry-throws resolves).
  - B3 controller: accepting() stays true. IPC rows: each handler returns its fake's open-path answer; off-Windows answers IDENTITY_CAPABILITY_UNAVAILABLE; dialog-open row registers.
  - B6: built-never-stopped records no stop; supervisor-rejects-no-program and a-release-throws resolve; stop twice calls the owner twice. Pins passed: program then dispose, program first, never built, build fails after the logger.
- b7-register-red (same digest): register lists EW6 and EW8 (9 ids).
- b1-green (38fcf7101d8cf30d): DesktopRuntimeDisposeUnconfirmed + DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS 1000, dispose step under Effect.timeoutOrElse, last in the failures. 7 B1 rows + 8 characterizations green; B2 and B3 still red.
- b2-green (f7456355d2286825): entry stop added to the bridge loop (storage, workspace, entry). 18/21; B3 still red.
- b3-green (265325a6f1b4970d): accepting() closes in stop(); gates in the three registers; builders hoisted and exported (projectActivationUnavailable, projectSwitchUnavailable); capabilityForIntent exported. 154/154 incl. project-entry-bridge.test.ts.
- b6-green (e023d8c3630b6e51): once-latch + acquireRelease with closeIfNeverStopped release. 8/8.
- bind-b6-latch: unlatched stop + release that always calls the owner -> program then dispose, supervisor stop rejects program first (and stop twice) fail; restored blob 83d046a6e52ab2b9 MATCH, digest MATCH.
- main reds, wiring, B4/B5 bindings, B7 EW8/EW6, gates, CodeScene, final bindings: see ../2026-10-19_123-s6-tdd-evidence.md.
- commit b0e92fc (tree 55a80490, equal to the staged tree the final gates ran on); preflight clean.
- heavy: e2e 27/27 (4.7 min); package:smoke exit 0.
