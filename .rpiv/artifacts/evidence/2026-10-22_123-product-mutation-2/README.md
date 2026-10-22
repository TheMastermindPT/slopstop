# #123 combined mutation, product rerun 2 — PASSED under D1, D2 and the static Ignored

- The coordinator accepted D1 and D2 (decisions log §139).
- Kill commit **`aabd716`** (tree `123094d2f10b972f91d3296b6b75deaef2dca2da`): the new row `treats a non-string error code as no code` (`{ code: 5 }` is neither unavailable nor corrupt).
  - Its binding, `:10` `typeof code === "string" ? … : …` → `true ? …`, makes the row fail with `TypeError: code?.startsWith is not a function`; the file is restored with sha256 and tree MATCH (`../2026-10-22_123-product-kill/bind-m10-any-code.log`).
  - Gates on `123094d2`: `pnpm check` (3 282 tests, check:effect 50), typecheck, dead-code and duplicates pass; CodeScene 10 on the test file.
- Run: backups (scratchpad `product-mutation2-backup`); CPU 11.4/18.0/22.1, alone. `--mutate` limited to the product ranges, as in the first product rerun. The dry run passed (469 tests); the run took 6 min 24 s, exit 0, with no error and no Defender alert. Afterwards the sources match the backup (`after-run.txt`).

## Result

- Score **98.02**. **105 mutants: 97 Killed, 2 Timeout, 1 Survived, 1 NoCoverage, 4 Ignored.**

| File | Killed | Timeout | Survived | NoCoverage | Ignored |
| --- | --- | --- | --- | --- | --- |
| `project-storage-node-errors.ts` | 67 | 2 | 1 (D1) | 1 (D2) | 4 (static `Set` literal) |
| `project-storage-upgrade-node-adapter.ts:558-564` | 9 | 0 | 0 | 0 | 0 |
| `registration-registry.ts:182-200` | 13 | 0 | 0 | 0 | 0 |
| `registry-database.ts:79-90` | 8 | 0 | 0 | 0 | 0 |

- **Every non-killed mutant is allowed:** `:7:42` (D1), `:11:11` (D2), and the 4 static Ignored at `:21`. `:10` is now Killed.
- The gate script's mutants are a named residual in issue #139 (Pedro, "Produto agora, gate depois"); they were not in this run.
