# CodeScene on the s7 changed files (MCP `code_health_score` / `code_health_review`, CLI MCP-1.5.10)

Final scores are on the committed candidate `f3d2c8f` (tree `94190546`). The version banner is removed from the tool answers.

## Findings below 10 during the build, and their refactors (behaviour-preserving; tests and every binding re-run after them)

| File | Finding | Refactor |
| --- | --- | --- |
| `apps/desktop/src/main/project-entry-bridge.ts` | Large Method: `projectEntryBridgeOver` | `entryRequests` (metadata, request, echoing helpers) and `entryOperations` (the operations) extracted; the factory keeps only the stopped flag and `stop`. |
| `apps/desktop/src/main/workspace-bridge.ts` | Code Duplication: `query` and `submit` | One internal `request({ command, event, schema, check, broken })` helper. |
| `apps/desktop/src/main/harness-session.ts` | Complex Method: `#emit` cc 9 | `#deliver(event, failures)` extracted. Later, to make the B4 flag binding able to fail, the collected failures are thrown inside the `try` (same behaviour); re-scored 10. |
| `apps/desktop/src/main/harness-request-core.test.ts` | Code Duplication: the `refused send` and `throwing send` rows | `expectSendFailureFreesId(code, fail, heal)`. |

## Final (candidate `f3d2c8f`)

| File | Score |
| --- | --- |
| `apps/desktop/src/main/harness-request-core.ts` | 10 |
| `apps/desktop/src/main/harness-bridges.ts` | 10 |
| `apps/desktop/src/main/project-entry-bridge.ts` | 10 |
| `apps/desktop/src/main/project-storage-bridge.ts` | 10 |
| `apps/desktop/src/main/workspace-bridge.ts` | 10 |
| `apps/desktop/src/main/harness-session.ts` | 10 |
| `apps/desktop/src/main/desktop-runtime.ts` | 10 |
| `apps/desktop/src/main/main.ts` | 10 |
| `apps/desktop/src/main/project-upgrade-failure.ts` | 10 |
| `apps/desktop/src/main/project-conversation-failure.ts` | 10 |
| `apps/desktop/src/main/project-entry-ipc.ts` | 10 |
| `apps/desktop/src/main/project-registration-ipc.ts` | 10 |
| `apps/desktop/src/main/harness-request-core.test.ts` | 10 |
| `apps/desktop/src/main/harness-bridges.test.ts` | 10 |
| `apps/desktop/src/main/harness-session-test-peers.ts` | 10 |
| `apps/desktop/src/main/project-entry-bridge.test.ts` | 10 |
| `apps/desktop/src/main/project-storage-bridge.test.ts` | 10 |
| `apps/desktop/src/main/workspace-bridge.test.ts` | 10 |
| `apps/desktop/src/main/harness-session.test.ts` | 10 |
| `apps/desktop/src/main/harness-supervisor.test.ts` | 10 |
| `apps/desktop/src/main/desktop-runtime.test.ts` | 10 |
| `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` | 10 |
| `apps/harness/scripts/check-effect-diagnostics.test.mjs` | 10 |
| `apps/desktop/vitest.desktop-s7-mutation.config.ts` | "Could not determine Code Health score." (a config object with no function) |

Not scored (no CodeScene language): `stryker.desktop-s7.config.json`, `knip.jsonc`, `effect-diagnostics-waivers.json`, the brief. `harness-pending-request.ts` is deleted.
