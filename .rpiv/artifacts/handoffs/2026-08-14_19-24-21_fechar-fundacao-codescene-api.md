---
date: 2026-08-14T19:24:21+0100
author: Pedro Mesquita
commit: no-commit
branch: main
repository: slopstop
topic: "SlopStop Foundation Closure Implementation Strategy"
tags: [implementation, strategy, foundation, codescene, electron, quality-gates]
status: complete
last_updated: 2026-08-14T19:24:21+0100
last_updated_by: Pedro Mesquita
type: implementation_strategy
---

# Handoff: Close the foundation before product work

## Task(s)

- **Completed: repository foundation.** Built the pnpm monorepo, strict Electron desktop shell, separate harness utility process, versioned Zod protocol, security boundary, local logging, optional redacted Sentry hook, executable LikeC4 model, CI/tooling, unit/integration/E2E tests, and packaged launch smoke.
- **Completed: runtime repair.** Fixed the renderer self-navigation block, Forge preload filename mismatch, CommonJS runtime filenames, and packaged `Cannot find module 'pino'` failure shown by the user. The packaged executable now reaches harness-ready and exits cleanly.
- **Completed: quality-gate hardening.** Added real tests, removed zero-test success allowances, made dependency-cruiser use a supported TypeScript compiler, and repaired a false-green LikeC4 command that filtered out parser errors.
- **Work in progress: close the foundation step by step.** The user's explicit order is: make CodeScene work first; update the API/configuration; finish all remaining foundation closure work; only then begin product features.
- **Planned: CodeScene recovery.** CodeScene CLI connectivity works, but authentication fails because the configured token is invalid or expired. The pre-commit safeguard also cannot run yet because this repository has no initial `HEAD`.
- **Planned: visual closure.** The technical-cartography shell is intentionally provisional. It still needs a manual desktop/small-window review and a concise `DESIGN.md` finish record. Final visual identity must come from explicit variants later.
- **Planned: repository baseline.** Every source file is still untracked and `commit: no-commit`. Create the initial commit only after CodeScene is working and the user explicitly proceeds with that step.
- **Not started: product implementation.** Do not start repository onboarding, persistence, Features/Waypoints, Board, agents, LSP, debugger, or other product behavior until the user confirms the foundation is closed.

## Critical References

- `PRODUCT.md` - durable product truth, privacy boundaries, and the rule that the current visual shell is provisional.
- `docs/adr/0001-repository-foundation.md` - accepted repository, process, protocol, security, persistence, observability, and test decisions.
- `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md` - refined feature requirements that future product work must follow.

## Recent changes

- `apps/desktop/src/main/main.ts:29-63` now loads the trusted renderer without blocking its first navigation and uses Forge's actual `preload.js` artifact.
- `apps/desktop/src/main/security.ts:21-42` denies permissions, installs CSP, denies new windows, and permits navigation only to the computed renderer URL.
- `apps/desktop/vite.main.config.ts:6-16` bundles Pino into `main.cjs`, fixing the packaged app's missing-module crash.
- `apps/desktop/vite.preload.config.ts:6-17` records Forge's sandboxed CommonJS preload filename as `preload.js`.
- `apps/desktop/src/main/harness-supervisor.test.ts` covers startup, handshake, protocol failure, bounded backoff, explicit retry, timeout, logging, and stop behavior.
- `apps/desktop/src/main/{security,logger,crash-reporting}.test.ts` cover the reusable desktop security, local logging, rotation, consent, and redaction rules.
- `apps/harness/tests/integration/harness-runtime.integration.test.ts` proves a real structured-clone handshake over Node message ports.
- `packages/protocol/src/protocol.test.ts` now covers command/event factories, message IDs, malformed events, and unsupported protocol versions.
- `vitest.config.ts:3-42` measures reusable modules while excluding only startup entrypoints already exercised by Electron/integration tests.
- `package.json:12-35` contains honest fast/deep gates; unit, coverage, and integration commands no longer succeed when no tests exist.
- `dependency-cruiser.config.cjs:1-67` enforces workspace import direction. TypeScript was pinned to `6.0.2` in `pnpm-workspace.yaml:48` because dependency-cruiser 18.2.0 cannot safely analyze TypeScript 7.
- `docs/architecture/specification.c4:1-48` uses supported LikeC4 shapes; `package.json` validates the directory without `--file` filters, so parser errors can no longer be hidden.
- `knip.jsonc` was reduced to non-redundant entries and now exits without hints.
- `jscpd.json` no longer contains unsupported schema metadata and reports zero clones.
- `docs/adr/0001-repository-foundation.md:33-42` now correctly distinguishes directly executed `main.cjs`/`harness.cjs` from Forge's sandboxed `preload.js`.

## Learnings

- Forge's Vite plugin emits the preload target as `.vite/build/preload.js` even when `lib.fileName` requests `preload.cjs`. The sandboxed preload is CommonJS, but the main process must reference the emitted filename exactly.
- A blanket `will-navigate` handler installed before `loadFile()` blocks the application's own first renderer load. The guard must allow the exact trusted renderer URL and reject every other URL.
- Externalizing Pino made development pass but broke the packaged ASAR because Pino was not copied into the package. Bundling Pino into the main bundle is the working package contract.
- `main` and `harness` must remain `.cjs` because they are directly executed under an ESM package. The preload is a special Forge/Electron sandboxed artifact.
- Repository-local Node 24.19.0 is intentional. It avoids the Node 26 packaging failure encountered during foundation setup.
- Dependency-cruiser with TypeScript 7 scanned only 25 modules and warned that it could miss dependencies. TypeScript 6.0.2 scans 66 modules and 78 dependencies without warnings.
- The old LikeC4 command returned `valid: true` while `stats.totalErrors` was 2 because `--file` filters suppressed both invalid-shape errors. The corrected command returns `valid: true`, `totalErrors: 0`, and `filteredErrors: 0`.
- Current CodeScene state: `verify_installation` passes repository discovery, CLI connectivity, and runtime, but fails authentication with `Token is set but invalid or expired.` The pre-commit safeguard first failed with `fatal: ambiguous argument 'HEAD'` because there is no commit.
- Interpret the user's phrase "iremos dar update a api" as updating the CodeScene API token/configuration unless the user clarifies that a different API is meant. Do not print or persist secrets outside CodeScene's configuration tool.
- No Sentry project was created. Organization `mastermind-ol` exists in `https://de.sentry.io`, but Sentry remains optional and must have both a DSN and explicit consent before sending anything.
- The unrelated RPIV write hook often reports `validate-on-write.mjs failed ... ETIMEDOUT`. Do not treat it as SlopStop validation; run the repository's commands directly.
- Forge still prints an upstream deprecation warning for `inlineDynamicImports`; packaging and all tests pass. Do not weaken the build to silence it.

## Artifacts

- Product and contributor docs: `PRODUCT.md`, `CONTEXT.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`.
- Foundation decision: `docs/adr/0001-repository-foundation.md`.
- Architecture model: `docs/architecture/README.md`, `docs/architecture/likec4.config.json`, `docs/architecture/specification.c4`, `docs/architecture/model.c4`, `docs/architecture/views.c4`.
- Imported requirements/research: `.rpiv/artifacts/README.md`, `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md`, `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md`, `.rpiv/artifacts/discover/2026-08-14_16-18-18_lsp-debugger-refinement.md`, `.rpiv/artifacts/research/2026-08-14_12-09-42_custom-coding-harness-options.md`.
- Standing decisions: `.rpiv/decisions/README.md`, `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`.
- Root tooling: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `biome.json`, `dependency-cruiser.config.cjs`, `knip.jsonc`, `jscpd.json`, `renovate.json`, `commitlint.config.cjs`, `lint-staged.config.mjs`.
- Repository/CI setup: `.editorconfig`, `.gitattributes`, `.gitignore`, `.node-version`, `.vscode/settings.json`, `.github/workflows/ci.yml`, `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push`.
- Desktop configuration: `apps/desktop/package.json`, `apps/desktop/tsconfig.json`, `apps/desktop/forge.config.ts`, `apps/desktop/index.html`, `apps/desktop/playwright.config.ts`, `apps/desktop/vitest.config.ts`, `apps/desktop/vitest.main.config.ts`, `apps/desktop/vite.main.config.ts`, `apps/desktop/vite.preload.config.ts`, `apps/desktop/vite.harness.config.ts`, `apps/desktop/vite.renderer.config.ts`.
- Desktop main/preload/shared: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/security.ts`, `apps/desktop/src/main/logger.ts`, `apps/desktop/src/main/crash-reporting.ts`, `apps/desktop/src/main/forge-env.d.ts`, `apps/desktop/src/preload/preload.ts`, `apps/desktop/src/shared/desktop-api.ts`.
- Desktop renderer: `apps/desktop/src/renderer/app.tsx`, `apps/desktop/src/renderer/app.module.css`, `apps/desktop/src/renderer/global.css`, `apps/desktop/src/renderer/main.tsx`, `apps/desktop/src/renderer/window.d.ts`, `apps/desktop/src/renderer/test-setup.ts`.
- Desktop tests: `apps/desktop/src/main/harness-supervisor.test.ts`, `apps/desktop/src/main/security.test.ts`, `apps/desktop/src/main/logger.test.ts`, `apps/desktop/src/main/crash-reporting.test.ts`, `apps/desktop/src/renderer/app.test.tsx`, `apps/desktop/tests/e2e/shell.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.
- Harness: `apps/harness/package.json`, `apps/harness/tsconfig.json`, `apps/harness/vitest.config.ts`, `apps/harness/vitest.integration.config.ts`, `apps/harness/src/index.ts`, `apps/harness/src/harness-runtime.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/src/process-entry.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`.
- Protocol/kernel: `packages/protocol/package.json`, `packages/protocol/tsconfig.json`, `packages/protocol/vitest.config.ts`, `packages/protocol/src/index.ts`, `packages/protocol/src/protocol.ts`, `packages/protocol/src/protocol.test.ts`, `packages/kernel/package.json`, `packages/kernel/tsconfig.json`, `packages/kernel/vitest.config.ts`, `packages/kernel/src/index.ts`.
- Generated validation outputs are ignored and should not be committed: `coverage/`, `apps/desktop/.vite/`, `apps/desktop/out/`, `apps/desktop/test-results/`.

## Action Items & Next Steps

1. Load the `configuring-codescene-mcp` skill before changing CodeScene configuration.
2. Call CodeScene `get_config` first and identify whether the invalid credential comes from persisted `access_token` configuration or a client-level `CS_ACCESS_TOKEN` environment variable. Include the returned documentation URL when explaining the result.
3. Update the CodeScene API token/configuration with the user. Prefer OAuth `login` when no valid `CS_ACCESS_TOKEN` is required; otherwise use `set_config` for the supported key. Never echo the secret. A client environment variable overrides persisted configuration and may require changing the MCP client plus restart.
4. Run CodeScene `verify_installation` until Authentication, API/CLI connectivity, repository, and runtime all pass.
5. Because there is no `HEAD`, use file-level `code_health_review`/`code_health_score` on the key changed modules first: `harness-supervisor.ts`, `protocol.ts`, `app.tsx`, and `main.ts`. Do not claim the pre-commit safeguard passed before an initial commit exists.
6. Review CodeScene findings and make only concrete foundation fixes. Rerun `pnpm check:deep` after any source/config change.
7. Walk the user through the remaining foundation closure one step at a time: manual visual review at desktop and small-window sizes, write `DESIGN.md` with a clearly provisional verdict, decide whether optional Sentry setup belongs in this foundation closure, then prepare the initial commit when explicitly requested.
8. After the initial commit creates `HEAD`, rerun the CodeScene pre-commit safeguard or appropriate branch-level check and record the result.
9. Confirm with the user that the foundation is closed. Only then select and plan the first product slice; the current recommendation is repository registration/onboarding plus real persistence, but do not implement it early.

## Other Notes

- Last complete verification: `pnpm check:deep` passed after all fixes. It includes format, lint, TypeScript, 25 unit tests, dependency boundaries, coverage, one real integration test, Knip, jscpd, LikeC4, Electron E2E, packaging, and packaged launch smoke.
- Coverage at handoff: 95.74% lines, 95.79% statements, 96.42% functions, and 83.14% branches.
- Packaged binary: `apps/desktop/out/SlopStop-win32-x64/SlopStop.exe`.
- The Electron E2E proves `process` and `require` are absent in the renderer and only `getHarnessStatus`, `retryHarness`, and `subscribeHarnessStatus` are exposed.
- Git state: branch `main`, no commit, all intended repository files untracked. Do not reset, clean, or delete generated/user files destructively.
- The user wants step-by-step collaboration, not a jump into product implementation.

## Wayfinder Roadmap Update

- The public GitHub repository now exists at `https://github.com/TheMastermindPT/slopstop` and is configured as `origin`.
- Engineering-skill tracker configuration was added to `CLAUDE.md`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, and `docs/agents/domain.md`.
- The canonical roadmap is [Wayfinder: Reach a personally usable SlopStop v1](https://github.com/TheMastermindPT/slopstop/issues/1). It has 24 native GitHub sub-issues and native blocking relationships.
- Destination: produce and accept a rolling, evidence-backed roadmap from verified Foundation Closure to a personally usable Windows v1. The umbrella map decides program boundaries, order, dependencies, entry/exit proof, and which program map opens next; it does not implement product behavior.
- The user accepted a portfolio structure: one roadmap map plus later program-specific Wayfinder/research/design/blueprint/plan cycles. Do not attempt one monolithic design or blueprint.
- The v1 proof uses a real Git repository, two related Waypoints, one validation failure, one recoverable interruption, and explicit integration.
- TypeScript/JavaScript language intelligence is in v1; live DAP debugging is post-v1.
- Verified-memory guarantees stay strong, while the v1 proof is bounded to create, accept, retrieve, stale, and reverify.
- GitHub Issues is the canonical live roadmap. Only stable domain/architecture decisions graduate into repository docs.
- Final visual identity remains deferred until Frame, supervision, and recovery prototypes establish the necessary information density. Foundation Closure still requires review and documentation of the provisional shell.
- Every product-roadmap ticket is blocked behind [Confirm Foundation Closure](https://github.com/TheMastermindPT/slopstop/issues/9).
- The only initial frontier ticket is [Record the CodeScene operational baseline](https://github.com/TheMastermindPT/slopstop/issues/2). The next agent must claim it before work with `gh issue edit 2 --repo TheMastermindPT/slopstop --add-assignee @me`.
- Product research tickets are deliberately blocked and were not dispatched. Respect the user's order: CodeScene first, then the remaining Foundation Closure chain, then product-roadmap decisions.
