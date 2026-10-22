# #123 s8 scoped mutation rerun — PASSED under the declared equivalent

- Decision: Pedro "Como no s7" (decisions log §139). Kill commit **`4d22a65`** (tree `61833a8ca990de0866a7b3970b902dbaa6c5e433`) on `c80c7fb`; its bindings and gates are in `../2026-10-22_123-s8-kill/`.
- Run: backups (scratchpad `s8-mutation2-backup`, `SHA256SUMS`); CPU 15.8/11.2/12.1, alone. 21 s, exit 0, dry run 39 tests. No timeout, no error, no Defender alert. Afterwards the source and configs match the backup (`after-run.txt`).

## How the 9 first-run survivors were handled

| First-run mutants | Handling | Result now |
| --- | --- | --- |
| `:411:41` `"end"` → `""`, `:411:60` `"close"` → `""` | New row `removes every stdout listener when stdout $event arrives` (`end`, `close`): `child.stdout.eventNames()` is `[]`. Bindings `bind-m411-end` (fails the `close` row) and `bind-m411-close` (fails the `end` row), each restored MATCH. | Killed |
| `:185` ×3 (`if (this.#child === child) this.#child = undefined;` in the stop's `exit` handler) | **Restructure, line removed.** The observer's `exit` handler, registered at spawn and so run first, calls `#handleProcessExit`, which sets `#child = undefined` whenever `#child === child`. While a stop runs, `start()` returns (`#stopping` is set, including after a timeout until the late exit), so no other child can be current. The stop's line therefore always found `#child` already `undefined`. | No mutants (code gone) |
| `:417` ×4 (`if (this.#observations.get(child) === observation) this.#observations.delete(child);` in `forget`) | **Restructure: unconditional `delete`.** `#watchOutput` runs once per spawned child (`#observeChild` from `#spawn`), so the entry for `child` is always this observation or already gone, and the guard was always true when it mattered. This removes the three guard mutants. | 1 left, declared below |

## Result

- Score **98.41**. **63 mutants: 62 Killed, 1 Survived, 0 Timeout, 0 NoCoverage, 0 Ignored** (`non-killed.txt`).

## Declared equivalent (1), for the coordinator's verification

| Mutant | Why no public-seam test can tell it apart |
| --- | --- |
| `harness-supervisor.ts:418:7` CallExpression: `this.#observations.delete(child)` removed (in `forget`) | `#observations` is private and keyed by the child object, and each spawn creates a new child. After `forget` runs (at `exit` through `drain`, or on `remove`), the supervisor never looks the exited child up for anything observable. `stop()` reads only the current `#child`, which `#handleProcessExit` has already cleared. `#removeChildObservation` reads only the child being stopped. The observer's `exit` handler does run once more after a timeout's `remove()`, and with the entry left it calls `drain()` again. That second call is inert: `silence()` is idempotent, `finish` only `off`s listeners that are already gone, `lines.end()` on an empty buffer and an ended `StringDecoder` logs nothing (`harness-log-lines.ts:80-87`), and `Deferred.doneUnsafe` on a completed `Deferred` does nothing. So a left entry costs only memory. |
