# CodeScene on the s6 changed files (MCP `code_health_review`, CLI MCP-1.5.10)

Final scores are on the committed candidate `b0e92fc` (tree `55a80490`). Raw tool answers below are copied verbatim (the version banner removed).

## First pass (before refactor, on the working tree after B7)

| File | Answer |
| --- | --- |
| `apps/desktop/src/main/desktop-runtime.ts` | `{"score":10.0,"review":[]}` |
| `apps/desktop/src/main/desktop-shutdown.ts` | `{"score":10.0,"review":[]}` |
| `apps/desktop/src/main/main.ts` | `{"score":9.53,"review":[Bumpy Road Ahead: bootstrap bumps = 2 (403-458); Complex Method: bootstrap cc = 11]}` |
| `apps/desktop/src/main/project-entry-ipc.ts` | `{"score":10.0,"review":[]}` |
| `apps/desktop/src/main/project-registration-ipc.ts` | `{"score":10.0,"review":[]}` |
| `apps/desktop/src/main/project-entry-bridge.ts` | `{"score":10.0,"review":[]}` |
| `apps/desktop/src/main/workspace-bridge.ts` | `{"score":10.0,"review":[]}` |
| `apps/desktop/src/main/canonical-writer-package-smoke.ts` | `{"score":9.68,"review":[Complex Method: OwnedUtility.wait cc = 11 (300-336)]}` |
| `apps/desktop/src/main/desktop-runtime.test.ts` | `{"score":9.38,"review":[Code Duplication: two run rows]}` |
| `apps/desktop/src/main/workspace-bridge.test.ts` | `{"score":9.68,"review":[Primitive Obsession: 38 % of functions]}` (the base file scores 10.0, checked from a temporary in-repo copy of `5f1bca3`'s version, then deleted) |
| other test files | 10.0 |

## Refactors (behaviour-preserving; tests and every binding re-run after them)

- `main.ts`: `holdsSingleInstanceLock`, `awaitSmokeHarnessReady` and `reopenWindowWhenNoneIsOpen` extracted from `bootstrap`.
- `canonical-writer-package-smoke.ts`: `wait` (the Promise facade) and `polling` (the `Effect.callback`) split; the `timer !== undefined` guards dropped (`clearTimeout(undefined)` is a no-op; `check` already calls it unguarded).
- `desktop-runtime.test.ts`: `built` and `builtWithFailingSupervisor` helpers; `workspace-bridge.test.ts`: the gated row callback takes the row object.

## Final (candidate `b0e92fc`)

| File | Score |
| --- | --- |
| `apps/desktop/src/main/desktop-runtime.ts` | 10.0 |
| `apps/desktop/src/main/desktop-shutdown.ts` | 10.0 |
| `apps/desktop/src/main/main.ts` | 10.0 |
| `apps/desktop/src/main/project-entry-ipc.ts` | 10.0 |
| `apps/desktop/src/main/project-registration-ipc.ts` | 10.0 |
| `apps/desktop/src/main/project-entry-bridge.ts` | 10.0 |
| `apps/desktop/src/main/workspace-bridge.ts` | 10.0 |
| `apps/desktop/src/main/canonical-writer-package-smoke.ts` | 10.0 |
| `apps/desktop/src/main/desktop-runtime.test.ts` | 10.0 |
| `apps/desktop/src/main/desktop-shutdown.test.ts` | 10.0 |
| `apps/desktop/src/main/project-entry-ipc.test.ts` | 10.0 |
| `apps/desktop/src/main/project-registration-ipc.test.ts` | 10.0 |
| `apps/desktop/src/main/workspace-bridge.test.ts` | 10.0 |
| `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` | 10.0 |
| `apps/desktop/src/main/canonical-writer-package-smoke.test.ts` | 10.0 |
| `apps/harness/scripts/check-effect-diagnostics.test.mjs` | 10.0 |
| `apps/desktop/vitest.desktop-s6-mutation.config.ts` | `{"score":null}` (no score for this config file) |
| `effect-diagnostics-waivers.json`, `knip.jsonc`, `stryker.desktop-s6.config.json` | not analysed (JSON) |
