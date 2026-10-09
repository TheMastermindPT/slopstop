# Claude Instructions

@AGENTS.md

`AGENTS.md` is the canonical cross-agent instruction file. Follow it together with the closest applicable `.rpiv/guidance/` document.

## Agent skills

### Issue tracker

Issues, specifications, and Wayfinder maps live in GitHub Issues for `TheMastermindPT/slopstop`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels without aliases. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context product: read the root `CONTEXT.md` and applicable files under `docs/adr/`. See `docs/agents/domain.md`.

## Effect

New and touched harness and Electron-main code follows the **Effect Usage (effect 4)** rules in `AGENTS.md`, which is imported above, so they apply in full:
- Effect programs for I/O, waiting and cancellation;
- typed errors instead of `throw`;
- `acquireRelease` for resources;
- `Semaphore`, `Deferred` or `Queue` for coordination;
- services built by Layers;
- plain functions for pure logic;
- one `ManagedRuntime` per process, with `runPromise` only at the edges.

The renderer runs no Effect runtime. Fetch current Effect 4 docs through Context7 (`/websites/effect_website_v4`) before writing Effect code.
