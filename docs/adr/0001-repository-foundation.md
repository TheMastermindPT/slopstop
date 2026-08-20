# ADR 0001: Repository Foundation

- Status: Accepted
- Date: 2026-08-14
- Decision owners: Pedro Mesquita

## Context

SlopStop starts as an empty private repository but already has confirmed product requirements. The foundation must prove the desktop/process boundary without installing unused framework dependencies or allowing generated templates to become accidental architecture.

## Decisions

### Repository And Runtime

- Use a private pnpm monorepo with `apps/desktop`, `apps/harness`, `packages/kernel`, and `packages/protocol`.
- Target Node.js 24.19.x and pin pnpm 11.5.1. Install Node 24.19.0 as a repository-local pnpm runtime so scripts do not inherit an unsupported system Node. Use ESM and ES2022 output.
- Use pnpm's hoisted linker. Store pnpm 11 project settings in `pnpm-workspace.yaml` so workspace commands and Electron Forge read the same effective configuration.
- Use strict TypeScript, Biome for formatting/linting, and pnpm workspace scripts without Turborepo or Nx.
- Pin direct dependencies exactly through pnpm catalogs and use Renovate for scheduled grouped updates.
- Keep pnpm's exotic-transitive-source block enabled. Electron Forge's rebuild package pins a Git commit identifying itself as `@electron/node-gyp@10.2.0-electron.1`; override it to the exact registry-published version with integrity metadata instead of disabling the supply-chain check globally.
- Allow dependency build metadata only for exact-pinned `electron` and `esbuild`. Electron 43 also exposes an explicit `install-electron` command; the reviewed root `postinstall` runs it to ensure the runtime binary exists. New dependency build scripts require an explicit reviewed addition to `allowBuilds`.
- Use Conventional Commits, `commitlint`, and an `[Unreleased]` changelog. Defer release automation and a public license.

### Dependency Direction

- Kernel depends on no workspace package.
- Protocol may depend on kernel.
- Harness may depend on kernel and protocol; only harness may own Mastra, Drizzle, libSQL, model providers, repository tools, or process execution.
- Desktop may depend on protocol; only desktop may own Electron.
- Applications do not import one another. Forge integration wiring may point at the built harness entry but desktop source cannot import harness source.
- Dependency-cruiser enforces these rules.

### Desktop And Harness

- Use Electron Forge with its exact-pinned experimental Vite plugin and React.
- One Forge/Vite pipeline builds Electron main, preload, renderer, and the harness utility-process entry.
- Keep TypeScript source ESM, but name the directly executed CommonJS runtime outputs `main.cjs` and `harness.cjs`; Forge emits the sandboxed CommonJS preload as `preload.js`.
- Run one supervised harness utility process per desktop application. It may manage several open project records while keeping project persistence separate.
- Use a transferred message port and a strict, versioned Zod protocol. Do not add loopback HTTP.
- Validate every envelope. Use exact protocol-major handshake, UUID identity, explicit sequence ordering, RFC 3339 UTC timestamps, and typed result envelopes.
- Main owns typed starting, ready, degraded, crashed, and stopped states. It uses handshake timeout, graceful shutdown, and bounded exponential-backoff restart before requiring explicit Retry.
- The first runnable shell proves protocol parsing, harness transport behavior, preload exposure, renderer status, real utility-process startup, and packaged launch. It contains no SlopStop feature behavior.

### Electron Security

- Enable context isolation and renderer sandboxing; disable Node integration.
- Expose only a narrow typed preload API and validate IPC payloads.
- Deny unexpected navigation and new windows.
- Use CSP, ASAR, ASAR integrity validation, and restrictive Electron fuses.
- Development exceptions must not grant renderer Node access or weaken release behavior silently.

### Persistence

- Use `@libsql/client` with Drizzle when the first persistence behavior lands.
- Store canonical state in `slopstop.db` and Mastra-owned state in `mastra.db` under Electron `userData/projects/<project-id>/`.
- Use WAL, foreign keys, a busy timeout, short transactions, and serialized canonical writes.
- Commit Drizzle-generated SQL migrations. Before a forward migration, create and verify a database-native backup; refuse databases newer than the app.
- Use FTS5 for canonical text search first. Keep semantic/vector framework data in the Mastra database until a project-owned semantic-search requirement is proven.
- Do not copy an open database file as the only backup mechanism.

### Configuration And Secrets

- Permit an optional tracked, non-secret `.slopstop/project.json` for project policy.
- Keep databases, traces, logs, memory, and machine-local settings under Electron `userData`.
- Encrypt provider credentials with Electron `safeStorage`. Never place credentials in project files or Git.
- Validate all configuration sources with Zod.

### Logging And Crash Reporting

- Use structured local Pino logs with run, command, correlation, and causation identifiers, redaction, readable development output, and bounded retention.
- Keep Sentry optional. It sends no data without a DSN and explicit user consent.
- Defer Sentry project and DSN provisioning until crash reporting has a product-facing consent path and an operational owner. Foundation Closure relies on disabled-by-default behavior and tests, not live ingestion.
- Scrub prompts, source text, model output, secrets, environment values, and full local paths before any remote event.
- Mastra observability remains local-first; Sentry is optional crash reporting, not a hosted canonical trace backend.

### Testing

- Use Vitest for unit, contract, and integration tests; Testing Library with jsdom for React components; Playwright for Electron E2E; fast-check for later state-machine properties; and selective Stryker for kernel/safety behavior.
- Install a dependency only with its first exercised behavior or active configuration. Mastra, Drizzle, libSQL, fast-check, and Stryker are recorded choices but are not foundation dependencies unless used.
- Test only approved public seams: protocol parse/dispatch, harness runtime through its transport port, and renderer behavior through the preload API in a real Electron launch.
- Colocate unit/contract tests. Put adapter integration tests under workspace `tests/integration/` and Electron journeys under `apps/desktop/tests/e2e/`.
- Use risk-based coverage thresholds: highest for kernel/protocol/safety, moderate for process and renderer adapters.
- The working discipline is one failing behavior test followed by minimal passing behavior, then a separate review/refactor gate. This refines the imported FRD's red-green-refactor wording without weakening its evidence requirements.

### Quality Gates And Hooks

- `pnpm check` is the fast gate: format, lint, typecheck, targeted tests, and dependency rules.
- `pnpm check:deep` is the pre-push gate: fast gate, full tests and coverage, integration/E2E, Knip, jscpd, LikeC4 validation, and package smoke.
- Stryker is explicit or selected by a risk-aware skill; it is not part of pre-push.
- Husky pre-commit runs lint-staged Biome checks. Commit-msg runs commitlint. Pre-push runs the deep gate without Stryker.
- A broken tool invocation or unparsable result fails distinctly and never appears clean.

### CI And Packaging

- Keep source paths and behavior cross-platform while releasing Windows first.
- GitHub Actions runs frozen installs and deep checks on Ubuntu, core/process checks on Windows, and a Windows packaged-app smoke artifact.
- Produce a packaged application only. Defer installers, code signing, auto-update, and publishing.
- Keep Electron's `RunAsNode` fuse disabled. Playwright verifies production bundles with the development Electron binary; a separate bounded launch smoke proves the fused packaged executable reaches harness-ready. Do not weaken production fuses to make automation attach.
- Use provisional application identifier `dev.slopstop.desktop`.

### Documentation And Visual Foundation

- `AGENTS.md` is canonical cross-agent guidance. Host-specific files remain thin adapters.
- `PRODUCT.md` stores durable product truth, `CONTEXT.md` stores domain vocabulary, `docs/adr/` stores implementation decisions, `.rpiv/guidance/` stores path-specific architecture, and tracked `.rpiv/artifacts/` preserve durable workflow records.
- Maintain an executable LikeC4 model of process, package, storage, provider, and telemetry boundaries.
- Use React with CSS Modules and a small token/reset stylesheet. Add no router or client-state library until a concrete need exists.
- The foundation shell uses a provisional technical-cartography direction with a living-navigation-instrument motif. It does not establish the final product identity; later visual variants replace it after explicit selection.

## Consequences

- The repository begins with more executable safeguards than feature code.
- Deep pre-push checks will be intentionally slower, especially packaging and Electron E2E.
- Framework and persistence packages cannot become unused architectural placeholders.
- The separate process and strict protocol add initial ceremony but keep renderer security, runtime replacement, and crash recovery testable.
- Visual variant work remains free to replace the shell without undoing process, schema, or repository decisions.
