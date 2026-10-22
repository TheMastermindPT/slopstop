# CodeScene on the files changed in `de29eec..34641bc` (MCP `code_health_score`, CLI MCP-1.5.10)

Every answer below is on the fix tree `9e4a4814` (= commit `34641bc`), copied from the tool (version banner removed).

| File | Answer |
| --- | --- |
| `apps/desktop/src/main/desktop-runtime.ts` | Code Health score: 10 |
| `apps/desktop/src/main/desktop-shutdown.ts` | Code Health score: 10 |
| `apps/desktop/src/main/main.ts` | Code Health score: 10 |
| `apps/desktop/src/main/project-entry-ipc.ts` | Code Health score: 10 |
| `apps/desktop/src/main/project-registration-ipc.ts` | Code Health score: 10 |
| `apps/desktop/src/main/project-entry-bridge.ts` | Code Health score: 10 |
| `apps/desktop/src/main/workspace-bridge.ts` | Code Health score: 10 |
| `apps/desktop/src/main/canonical-writer-package-smoke.ts` | Code Health score: 10 |
| `apps/desktop/src/main/desktop-runtime.test.ts` | Code Health score: 10 |
| `apps/desktop/src/main/desktop-shutdown.test.ts` | Code Health score: 10 |
| `apps/desktop/src/main/project-entry-ipc.test.ts` | Code Health score: 10 |
| `apps/desktop/src/main/project-registration-ipc.test.ts` | Code Health score: 10 |
| `apps/desktop/src/main/workspace-bridge.test.ts` | Code Health score: 10 |
| `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` | Code Health score: 10 (after the fix below) |
| `apps/desktop/src/main/canonical-writer-package-smoke.test.ts` | Code Health score: 10 |
| `apps/harness/scripts/check-effect-diagnostics.test.mjs` | Code Health score: 10 |
| `apps/desktop/vitest.desktop-s6-mutation.config.ts` | Could not determine Code Health score. (config file) |
| `effect-diagnostics-waivers.json`, `knip.jsonc`, `stryker.desktop-s6.config.json` | not analysed (JSON) |

## Correction to the round-1 record

- `canonical-writer-package-smoke-main.test.ts` first scored **9.68** here (Primitive Obsession, "38 % of all functions have primitive types as arguments").
- A temporary in-repo copy of the **`b0e92fc`** blob also scores **9.68**, and a copy of the **`5f1bca3`** blob scores **10** (both copies deleted after scoring). So the debt came in with round 1, and round 1's `codescene.md` row "10.0" for this file is wrong for the committed `b0e92fc` blob. The round-1 cause: the helpers it added with primitive arguments (`ipcHandler(channel: string)` and the B5 row's `setPath`/`getPath` mocks).
- Fix (test-only, assertions unchanged): `ipcHandler` takes the row; the B5 row reads userData from `app.setPath`'s recorded calls instead of a `setPath` mock with string arguments; the K9 oracle reads the first `info` call without a callback. Score: 10.
