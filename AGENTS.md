# SlopStop Agent Guidance

## Read First

- Read `PRODUCT.md` for durable product truth.
- Read `CONTEXT.md` before naming domain concepts or tests.
- Read applicable files under `.rpiv/decisions/` and `docs/adr/` before changing a boundary.
- Durable requirements and research are indexed in `.rpiv/artifacts/README.md`.
- Before CodeScene authentication, API/project lookups, or Code Health gates, read `docs/agents/codescene.md`.

## Interacting with the user

- Don't just agree with the user. Explain where their idea is correct, where it is incomplete, and where it could fail.

### How to communicate (plain Portuguese (Portugal))

Explanations and status updates must be in plain Portuguese (Portugal). The user sometimes can't follow dense, jargon-heavy writing, so make it easy to read:

- Use simple, everyday words and short sentences. Avoid jargon. When a technical term is unavoidable, explain it in a few plain words the first time you use it.
- Lead with the bottom line: what happened, what it means, and what (if anything) you need from the user. Then add supporting detail below it.
- Use a short analogy or a concrete example when it makes the point click faster than an abstract description.
- Keep it concise. Don't bury the point under exhaustive detail; give the short version and offer to go deeper if the user wants it.
- Still be direct about problems: say plainly where something is wrong, incomplete, or risky. Plain Portuguese means clear, not vague or softened.
- This governs explanations, summaries, and status updates, not artifacts. Code, file paths, commit messages, test names, and command output stay exact and technical.
- Use Portuguese only when speaking with the user or writing artifacts that require it. Write everything else in English.

## Environment

- Windows 11 development with Docker available.
- Stack tooling: pnpm, Biome, Vitest + StrykerJS, Knip, dependency-cruiser, likeC4 (likec4 CLI is global).
- Work on feature branches. The user may push with GitHub Desktop or the CLI.
- Product is in active development, not hosted or in production.
- Lazy-load current documentation through Context7 when touching a library; use Exa search for the web.
- Playwright is available for browser verification.
- After each implementation packet or phase, use the CodeScene MCP tools to analyze issues. Resolve issues immediately and refactor until CodeScene reports a score of 10. SonarQube is not used (user decision).
- Load relevant best-practice skills before drafting designs or blueprints, writing code, or performing reviews. For example, load `typescript-best-practices` for TypeScript work, use the Astro docs MCP server for Astro, and load the relevant Cloudflare, Stripe, or Vitest skills.
- Prefer `rg` over `grep` in the shell.
- Write TypeScript comments as TSDoc, and add comments only when they improve understanding.

## Architecture

- `packages/kernel` owns framework-independent domain behavior and depends on no workspace package.
- `packages/protocol` owns versioned Zod schemas for process boundaries and may depend on `packages/kernel`.
- `apps/harness` may depend on kernel and protocol. Mastra, Drizzle, libSQL, provider SDKs, repository tools, and process execution belong here.
- `apps/desktop` may depend on protocol and Electron. It never imports harness source or framework-owned domain behavior.
- Applications never import one another. Electron launches the built harness artifact across a process boundary.
- The renderer imports neither Electron nor Node APIs. All access uses the narrow preload API.
- New cross-package imports use declared package exports. Do not use deep workspace imports or internal barrel chains.

## TypeScript

- Use strict TypeScript and ESM.
- Zod schemas are the source of truth at trust boundaries; infer types from schemas.
- Model mutually exclusive states as discriminated unions.
- Use branded UUID strings for durable identity, explicit non-negative sequence numbers for ordering, and RFC 3339 UTC strings at storage/process boundaries.
- Expected failures cross boundaries as discriminated result envelopes with stable codes. Catch unexpected exceptions once at process boundaries and convert them to a distinct internal failure.
- Use named exports and explicit type-only imports. Avoid `any`, double casts, non-null assertions, and default exports except where a tool requires one.
- Keep filenames kebab-case. React component and type names use PascalCase; values and functions use camelCase.

## Test Discipline

- This section governs development of SlopStop itself. Every SlopStop behavior change follows the strict red-green and review/refactor sequence below; a product-domain discipline exception for work supervised in an external Project never waives these repository rules.
- Documentation-only decision work may use its applicable document validation gates, but it cannot classify a SlopStop behavior change as documentation to avoid red-green proof.
- Test behavior through an agreed public seam, not private methods or internal collaborator calls.
- Work one vertical slice at a time: failing behavior test, minimal implementation, passing test, then a separate review/refactor gate.
- Foundation seams are protocol parse/dispatch, harness runtime through its transport port, and renderer behavior through the preload API in a real Electron launch.
- Unit and contract tests live beside source. Adapter integration tests live in each workspace's `tests/integration/`. Electron journeys live in `apps/desktop/tests/e2e/`.
- Use the smallest relevant Vitest command for red-green. Broader coverage, E2E, packaging, Knip, jscpd, and architecture checks belong to deep validation.
- Mutation testing is explicit and risk-based. Do not add it to every red-green loop or the default pre-push hook.
- Never add tautological smoke tests merely to make an empty package appear covered.

## Safety And Privacy

- Renderer security defaults are context isolation and sandbox on, Node integration off, denied navigation/popups, strict CSP, ASAR integrity, and restrictive Electron fuses.
- Validate every cross-process value. Protocol incompatibility and malformed input fail visibly.
- Local Pino logs are structured, correlated, redacted, and bounded. Sentry is optional and sends nothing before explicit user consent.
- Never send prompts, source text, model output, secrets, environment values, or full local paths to Sentry.
- Credentials use operating-system-backed Electron `safeStorage`; they never enter project configuration or Git.
- Project databases, traces, logs, and runtime memory live under Electron `userData`, not in the source repository.

## Commands

- Fast gate: `pnpm check`
- Deep pre-push gate: `pnpm check:deep`
- Mutation gate when applicable: `pnpm test:mutation`
- Architecture validation: `pnpm check:architecture`
- Package proof: `pnpm package:smoke`

Do not weaken a gate to make it pass. Fix the fault or report the gate as broken with its diagnostic.

<!-- BEGIN standing-decisions (generated by regen-decisions-index.mjs - do not edit inside) -->
## Standing Decisions

Binding decisions that outlive their originating feature. Full rationale is under `.rpiv/decisions/`.

- **degrade-distinguishes-broken** - A degrade-to-clean/absent branch must never swallow a genuine failure; every broken case emits a distinct diagnostic and never reports as clean. [`.rpiv/decisions/degrade-distinguishes-broken.md`](.rpiv/decisions/degrade-distinguishes-broken.md)
- **shared-vocab-union** - When the same constant, regex, or vocabulary is copied across sibling modules, extract one owner whose value is the union of every copy, prove identity first, then migrate consumers in small changes. [`.rpiv/decisions/shared-vocab-union.md`](.rpiv/decisions/shared-vocab-union.md)
<!-- END standing-decisions -->
