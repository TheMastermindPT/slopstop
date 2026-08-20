# SlopStop

SlopStop is a private, local-first desktop coding harness for visible, non-linear multi-agent development.

The repository is in its foundation stage. The first executable slice proves a strict Electron renderer boundary, a separate harness utility process, and a versioned typed protocol before product features are added.

## Requirements

- Node.js 24.19.x
- pnpm 11.5.1
- Git

## Commands

```text
pnpm install
pnpm dev
pnpm check
pnpm check:deep
pnpm package
```

`pnpm check` is the fast development gate. `pnpm check:deep` is the pre-push gate and includes the packaged application smoke test. Mutation testing stays explicit and is introduced when kernel or safety behavior exists.

## Repository Shape

```text
apps/desktop      Electron main, preload, renderer, and packaging
apps/harness      Transport-independent harness runtime and utility entry
packages/kernel   Framework-independent project domain
packages/protocol Versioned cross-process schemas and message factories
docs/architecture Executable LikeC4 architecture model
.rpiv             Tracked requirements, plans, guidance, and decisions
```

See `PRODUCT.md` for durable product truth, `CONTEXT.md` for domain vocabulary, `AGENTS.md` for engineering rules, and `docs/adr/0001-repository-foundation.md` for foundation decisions.
