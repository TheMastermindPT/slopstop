# #123 s6 survivor fixes (candidate `54d30da`, tree `f93999ff`)

- Decision: Pedro, "Corrigir 6 + declarar 7", then "Declarar os 3" (decisions log §135, via the coordinator).
- `desktop-shutdown.ts` (restructuring and fixtures only, no assertion changed):
  - `:91` (now `:90`): the AggregateError branch comes first, so the equivalent `> 1` / `>= 1` comparison is gone.
  - `:132` (now `:129`): `requestedExitCode ??= options.requestedExitCodeOnQuit?.()`, so the no-op `exitCode !== undefined` guard is gone.
  - `:9`: `desktop-shutdown.test.ts` imported the module once at file load, so Stryker counted the class definition as static (covered only by the main tests, which re-import `main.js` per test), and the existing `_tag` assertions never ran against that mutant. The "dispose never settles" row now uses a freshly imported module (`vi.resetModules()` plus a dynamic import, through a new `create` parameter of the `recording` fixture).
- Each logged run records its tree with the round-2 helpers (`tdd-run.sh`, `bind.py`).
  - Shutdown and main tests 105/105 (`shutdown-green.log`).
  - Bindings, each restored with blob and tree MATCH on `f93999ff`:
    - `bind-k91-aggregate` (`>= 1`): 9 rows fail;
    - `bind-k9-tag` (`""`): `dispose never settles` fails;
    - `bind-k132-quit-code` (`&&=`): `maps a pending package smoke quit to one nonzero exit` fails.
  - The `*-with-k303-row.log` files are the same three bindings run earlier, while the dropped gap row was still in the tree.
- Smoke trio `:302`/`:303`/`:316`: the attempted gap row passed with and without `:303` (`attempt-k303/`). It was dropped, and the trio is declared (see `../2026-10-19_123-s6-mutation-2/README.md`).
- Gates on `f93999ff`:
  - `pnpm check` passed (check:effect 50 advisory, 3 207 tests), as did typecheck, dead-code and duplicates (`gate-*.log`).
  - s6 unit 402/402 (`s6-unit.log`).
  - CodeScene `code_health_score`: `desktop-shutdown.ts` 10, `desktop-shutdown.test.ts` 10.
