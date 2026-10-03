# ADR 0003: Task-Shaped TypeScript Language Intelligence

- Status: Accepted
- Date: 2026-08-21
- Decision owners: Pedro Mesquita

## Context

TypeScript language services can reduce broad repository reads and improve semantic navigation, but they can also return stale, version-sensitive, resource-heavy results and expose a large overlapping tool surface to the model. Direct `tsserver` integration would provide TypeScript-specific control at the cost of implementing and maintaining its lifecycle, synchronization, diagnostics, cancellation, and edit translation before language intelligence has proven model-outcome value.

## Decisions

- Put a project-owned SlopStop adapter in front of an exact-pinned, bundled `typescript-language-server`, which in turn supervises `tsserver`. Run one private language-process set per exact workspace through Execution's Process job and permission contracts.
- Permit a workspace-local TypeScript version only after explicit Capability acceptance. Disable automatic type acquisition, repository plugins, arbitrary `tsserverRequest`, unapproved custom commands, and network access by default.
- Keep the broad LSP method surface internal. Expose only a small task-shaped model tool set selected through repeated paired evaluation against the approved grep/read plus CLI typecheck/test baseline.
- Bind every Language observation to workspace, process, configuration, request, TypeScript, server, and, where applicable, document identity. Track freshness, completion, and cardinality separately; empty is clean only when current and complete.
- Treat semantic anchors as revision-bound navigation aids, never canonical symbol identities or independent proof of completeness.
- Intercept language-server edits as preview-only Language mutation proposals. Only Execution may revalidate and apply them through the normal mutation lease, effect, recovery, and Evidence contracts.
- Keep live DAP post-v1. This program produces a versioned Debug Adapter Safety Boundary covering process identity, launch/attach authority, mutation-capable evaluation, bounded output, redaction, recovery, and Evidence limits without adding a DAP dependency or wire protocol.

## Consequences

- SlopStop can replace the LSP implementation without changing the model-facing tool contract.
- The extra wrapper process and possible upstream lag are accepted initially to reduce custom TypeScript protocol code; the outcome gate may still reject individual tools or the complete model-facing language surface.
- Protocol correctness and safety are necessary but do not admit a Capability. Each model-facing operation must improve its target outcome or preserve success while materially reducing irrelevant context and broad search.
- CLI typecheck, tests, Git/content fingerprints, and independent validation remain the authoritative proof paths.
