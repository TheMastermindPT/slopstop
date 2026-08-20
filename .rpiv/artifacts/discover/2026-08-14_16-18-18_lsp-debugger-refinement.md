---
date: 2026-08-14T16:18:18+0100
author: Pedro Mesquita
commit: d9c49a8
branch: fix/arch-review-helper-paths
repository: rpiv-claude
topic: "LSP and debugger refinement for the personal coding harness"
tags: [intent, frd, coding-harness, lsp, dap, debugger, evidence]
status: complete
register: mixed
consensus: confirmed
parent: .rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md
last_updated: 2026-08-14T16:18:18+0100
last_updated_by: Pedro Mesquita
content_hash: c6434811c07866743a3a2d3a5713138819ca2265a33821d1952cf03dbf7881bf
---

# FRD: LSP And Debugger Refinement

## Summary

This refinement adds core Language Server Protocol (LSP) intelligence to the first resilient proof and defines a Debug Adapter Protocol (DAP) seam whose live implementation follows that proof. It inherits the complete personal galaxy, Prime Agent, Oh My Pi, TDD, onboarding, validation, memory, evidence, permission, process, and workspace model from `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md` without changing those decisions.

## Problem & Intent

The coding agent should understand code semantically rather than relying only on text search, and it should eventually be able to inspect runtime behavior when tests and static analysis do not explain a failure. LSP can improve navigation, code anchors, diagnostics, rename/code-action proposals, and validation now. A debugger can improve diagnosis later, but only if its processes, sensitive runtime state, permissions, evidence, and crash behavior use the harness's existing safety boundaries.

## Goals

- Add workspace-isolated language intelligence to the first resilient proof.
- Strengthen compound code anchors with semantic symbol/location information while retaining Git and content hashes as permanent authority.
- Produce version-fresh, bounded, registered diagnostic evidence that distinguishes server failure from a clean result.
- Route all language-server-proposed writes through final-argument permission checks and proof-bearing structured edits.
- Define debugger capability, permission, process, evidence, redaction, board, and Electron contracts now.
- Keep debugging an on-demand worker capability supporting TDD and remediation rather than a replacement for tests.
- Avoid sharing unsaved language-server overlays across concurrent worker workspaces.

## Non-Goals

- A shared LSP broker across concurrent worktrees in the first proof.
- Treating LSP diagnostics as red/green test evidence or sufficient completion proof.
- Directly accepting server-originated `workspace/applyEdit`, commands, or arbitrary raw requests.
- LSP completion, signature help, semantic tokens, call hierarchy, or every protocol feature in the first proof.
- A live DAP debugger in the first resilient proof.
- Treating debugger state as safely resumable after a crash.
- Unrestricted expression evaluation, arbitrary DAP requests, memory writes, or attach-to-any-process behavior.
- Confusing child DAP debug sessions with harness worker agents.

## Functional Requirements

### LSP In The First Resilient Proof

1. The capability catalogue SHALL discover language-server definitions from built-in, application, plugin, user, and project sources with explicit provenance and deterministic precedence.
2. Project-owned LSP configuration SHALL remain untrusted until project trust and policy permit it.
3. LSP eligibility SHALL consider file extension or exact basename, project root markers, configured language IDs, executable availability, and workspace identity.
4. Project-local language-server executables SHALL be preferred over system `PATH` when policy permits execution.
5. LSP capability status SHALL distinguish detected, configured, executable-found, starting, ready, failed, stopped, and unavailable states.
6. Every started language server SHALL be an owned managed ProcessJob linked to project, WorkspaceLease, run, worker, configuration provenance, executable, and negotiated capabilities.
7. The first implementation SHALL use a private language-server process per concurrent worker workspace and SHALL NOT share unsaved document overlays across worktrees.
8. A server MAY be reused within the same workspace/run only when document-overlay ownership and lifecycle remain compatible.
9. LSP process exit, reader failure, blocked writes, timeout, and failed initialization SHALL produce explicit capability/process failure rather than clean diagnostics.
10. The service SHALL support bounded initialization, request cancellation, graceful shutdown, forced cleanup, and explicit reload.
11. The service SHALL synchronize `didOpen`, monotonically versioned `didChange`, `didSave`, and watched-file changes for harness-originated edits.
12. Applying proof-bearing edits or mutating process-job deltas SHALL refresh relevant open documents and invalidate stale language-intelligence state.
13. The initial read capabilities SHALL include diagnostics, definition, type definition, implementation, references, hover, document symbols, workspace symbols, server status, and negotiated capabilities.
14. Rename, file/directory rename, and code actions SHALL be preview-only language-intelligence proposals until separately authorized.
15. Arbitrary raw LSP requests and unclassified server commands SHALL be denied by default.
16. Server-originated workspace edits SHALL be intercepted and translated into proposed structured edit operations.
17. Every proposed LSP mutation SHALL pass final-argument permission resolution, workspace/path scope validation, stale-preimage checks, and the proof-bearing EditEngine before application.
18. Public LSP positions SHALL use a normalized path, one-based line/column convention, and symbol/occurrence identity where available.
19. URI handling SHALL correctly canonicalize encoded paths, Windows drive/case behavior, and equivalent server URI spellings.
20. Compound code anchors SHALL add LSP URI, line, column, enclosing symbol, symbol occurrence, definition location, and language-server capability/source metadata where available.
21. Git commit/blob/path, captured text, hashes, context, syntax fingerprint, and workspace revision SHALL remain the durable code-anchor authority.
22. Diagnostics SHALL be keyed by canonical document identity, workspace, language-server process, and diagnostic generation.
23. Diagnostics matching the expected document version MAY be accepted immediately.
24. Diagnostics from versionless or mismatched servers SHALL require bounded quiescence and SHALL be marked with their weaker freshness basis.
25. Mutation flows SHALL record a diagnostic baseline generation before change and SHALL bind resulting diagnostics to edit/workspace versions.
26. Late diagnostics SHALL append version-bound board/evidence events and SHALL NOT be silently attributed to newer code.
27. Diagnostics from matching servers SHALL be deduplicated by canonical location/message while preserving source provenance and severity.
28. Total failure of matching servers SHALL produce a broken/failed result and SHALL NOT report an empty diagnostic set.
29. LSP results SHALL be bounded for model and UI consumption while complete results remain accessible as artifacts/evidence.
30. Every truncation SHALL be visible and SHALL provide a way to inspect or page the complete result.
31. LSP diagnostics SHALL be one input to validation and remediation but SHALL NOT satisfy test-first red/green evidence by themselves.

### Debugger Design Seam After The First Proof

32. The capability catalogue SHALL support debugger-adapter definitions with source provenance, language/runtime matching, root markers, executable availability, transport, and negotiated capabilities.
33. The debugger service interface SHALL support future launch, attach, source/function breakpoints, threads, stack frames, scopes, variables, evaluate, continue, pause, step, output, terminate, and session listing.
34. The first live debugger implementation SHALL begin with launch/attach, source breakpoints, threads, stack/scopes/variables, continue/pause/step, output, and terminate.
35. Data/instruction breakpoints, memory read/write, disassembly, modules, source retrieval, and arbitrary custom DAP requests SHALL remain specialist/deferred capabilities.
36. Debug adapter and debuggee processes SHALL be separate owned ProcessJobs inside the selected workspace/isolation.
37. Launch and attach SHALL require exact final-argument approval for adapter, program/PID/port, arguments, cwd, environment, workspace, network, and expected process effects.
38. Attach to an arbitrary process SHALL require explicit user approval and SHALL NOT be granted by a generic execute permission.
39. Expression evaluation SHALL be classified as executable and potentially mutating, not read-only.
40. Memory writes and arbitrary custom DAP requests SHALL be denied by default.
41. Debug operations SHALL subscribe to expected stop/terminate/output events before issuing state-changing protocol commands to avoid missed events.
42. DAP transport SHALL use framed requests, sequence matching, bounded request/write/connect timeouts, cancellation, pending-request failure on transport loss, and aggressive broken-client cleanup.
43. Debug output SHALL use bounded buffers and artifact spillover rather than unlimited prompt, board, or renderer insertion.
44. Variables, expressions, scopes, environment values, stack data, memory, and process output SHALL pass sensitive-data classification/redaction before model context, board, evidence, or UI display.
45. Every debug session SHALL record adapter, debuggee ProcessJob, run/worker/workspace, approval revision, concrete model, state, current stop source/line/column, threads, breakpoints, output/truncation, and terminal status.
46. Debug source locations and breakpoints SHALL use compound code anchors and SHALL report moved/stale/ambiguous source resolution.
47. A DebugObservation SHALL register debug session, workspace/source revision, triggering action, thread/stack, redacted variables, source anchors, and linked finding/evidence IDs.
48. Debug observations MAY support findings and remediation but SHALL NOT count as test-first red/green proof.
49. A parent MAY propose a debug worker when a failing test or runtime defect cannot be explained sufficiently through accepted evidence and static analysis.
50. Debug workers SHALL remain non-nesting, plan-scoped, workspace-isolated, and subject to the same action queue, permission resolver, board, budget, and supervision rules as other workers.
51. Child DAP sessions created by the debuggee SHALL remain children of one debug job and SHALL NOT appear as harness worker descendants.
52. After harness or adapter crash, debugger state SHALL be interrupted/uncertain and SHALL require reconcile, terminate, or relaunch rather than automatic state reconstruction.
53. The Electron UI SHALL eventually project debugger sessions into a selected-worker inspector with threads, stack, scopes, variables, breakpoints, output, controls, evidence links, and redaction state.

## Non-Functional Requirements

- **Performance**: LSP requests, diagnostics, symbols, references, and UI rows must be bounded. One private server per active workspace is accepted for overlay correctness; lifecycle and idle cleanup must prevent abandoned processes. Debug output must remain bounded and spill to artifacts.
- **Security**: Repository LSP/DAP configuration and executables are untrusted until policy allows them. Server-originated writes never bypass permissions. Debug attach, evaluate, environment, variables, and memory are sensitive capabilities. Adapter/debuggee execution remains worker-only and workspace-isolated.
- **UX / Accessibility**: Language-server status and diagnostic freshness must be visible. Semantic results and debug state require keyboard/plain-text equivalents. Failures, truncation, stale anchors, redactions, and deferred results must not appear as clean or complete.
- **Reliability**: Language-server clients are owned per workspace and fail distinctly on process/reader/write/timeout errors. Diagnostics remain version-bound. Debugger sessions are not assumed resumable after crashes and enter explicit uncertain recovery state.

## Constraints & Assumptions

- All parent-FRD requirements remain binding unless explicitly changed here; none are changed.
- Oh My Pi is an implementation precedent, not a runtime dependency.
- LSP servers and debug adapters are external executables managed through the existing ProcessJob and capability systems.
- The first proof prioritizes language intelligence because it directly supports code anchors and validation already in scope.
- Debugger contracts are designed now to prevent incompatible ProcessJob, permission, evidence, and UI choices, but live DAP work is deferred.
- Tree-sitter/syntax and Git/content anchors remain required because LSP symbol identity alone is not stable across edits and renames.

## Acceptance Criteria

- [ ] Project onboarding detects an applicable project-local language server, shows its provenance and capabilities, and does not start it until an approved worker plan needs it.
- [ ] Two concurrent worktrees receive independent language-server processes and unsaved overlays cannot leak between them.
- [ ] Opening and editing a document produces monotonically versioned synchronization and a fresh diagnostic result bound to the expected workspace revision.
- [ ] A versionless late diagnostic is visibly marked with its freshness basis and cannot be attributed to newer code silently.
- [ ] Failure of every matching language server produces an explicit failed capability result rather than zero diagnostics.
- [ ] Definition/reference/symbol results register semantic data into compound code anchors while captured Git/content evidence remains navigable independently.
- [ ] An LSP rename or code action is previewed and cannot mutate files until final permission and structured-edit checks pass.
- [ ] A server-originated `workspace/applyEdit` request is intercepted and cannot bypass path, approval, preimage, or workspace constraints.
- [ ] A stale or ambiguous LSP-derived edit proposal fails without modifying the file.
- [ ] A large reference or diagnostic result shows a bounded summary plus an inspectable complete artifact.
- [ ] LSP diagnostics can create validation evidence/findings but cannot satisfy a missing TDD red or green gate.
- [ ] The post-proof debugger design specifies adapter discovery, owned ProcessJobs, permissions, redaction, evidence, uncertainty, and Electron projection without enabling unsafe memory/custom operations.

## Recommended Approach

Add a project-owned `LanguageIntelligenceService` behind the capability broker, keyed by immutable workspace identity and implemented first with private LSP processes, version-fresh diagnostic ledgers, semantic anchor enrichment, and preview-only mutations routed through the existing permission and EditEngine seams. Define a separate `DebuggerService` contract over managed DAP adapter/debuggee jobs and registered redacted observations now, then implement its safe core after the resilient proof.

## Decisions

### LSP scope
**Question**: How should LSP enter the first resilient proof?
**Recommended**: Core language intelligence.
**Chosen**: Include per-workspace server discovery/lifecycle, navigation, symbols, fresh diagnostics, semantic anchors, and preview-only rename/code actions routed through permissions and structured edits.
**Rationale**: LSP directly strengthens code understanding, registered evidence, and validation already required by the first proof.

### Debugger delivery
**Question**: When should the first DAP debugger implementation land?
**Recommended**: Design now, build after the proof.
**Chosen**: Define capability, permission, ProcessJob, evidence, redaction, recovery, and UI contracts now; implement live adapters/debugging after the resilient proof.
**Rationale**: Debugging is valuable for runtime diagnosis but adds a large sensitive process and recovery surface to an already broad first proof.

### Workspace isolation
**Question**: Should language-server and debugger state be shared across worker workspaces?
**Recommended**: Private per-workspace LSP state and workspace-owned debugger jobs.
**Chosen**: Do not share unsaved LSP overlays or mutable debuggee state across concurrent worker workspaces.
**Rationale**: Semantic and runtime state must match the exact code revision being inspected.

### LSP mutation authority
**Question**: May language servers directly apply workspace edits?
**Recommended**: No; preview and route through project-owned safety seams.
**Chosen**: Intercept rename, code-action, and server-originated edits, then apply only through final permission and proof-bearing EditEngine operations.
**Rationale**: A nominally read request can cause a server write, so protocol origin cannot bypass the approved execution contract.

### Debugging and TDD
**Question**: Can debugger output satisfy the test-first evidence gate?
**Recommended**: Use debugging only as supporting diagnostic evidence.
**Chosen**: Debug observations may support findings and remediation but never replace red/green tests.
**Rationale**: Runtime inspection can explain behavior but does not prove the expected behavior contract passes.

## Open Questions

None. Exact server/adapter definitions, supported first languages, idle timeouts, diagnostic quiescence constants, and redaction implementation are technical research/design questions rather than deferred product intent.

## Suggested Follow-ups

- Prototype TypeScript LSP diagnostics and semantic anchors in two concurrent Git worktrees.
- Evaluate Tree-sitter plus LSP plus Git anchor resolution after symbol rename and file move.
- Build a post-proof DAP prototype around a failing Vitest test and a workspace-isolated JavaScript debug adapter.
- Evaluate language-server reload/backoff only after ProcessJob ownership and recovery journaling are implemented.

## Glossary

| Term | What it means here |
|---|---|
| LSP | Language Server Protocol; the standard used to ask language tools for diagnostics, symbols, definitions, references, and refactoring proposals. |
| Language Intelligence Service | The project-owned interface that manages workspace-specific LSP capabilities, processes, synchronization, diagnostics, and semantic queries. |
| Document overlay | The language server's in-memory version of an open file, which may differ from disk and must not leak between workspaces. |
| Diagnostic freshness | Evidence that a diagnostic result belongs to the expected document/workspace version rather than stale code. |
| Semantic anchor | Symbol, definition, line, and column data added to a compound code anchor to help resolve current code. |
| Workspace edit | An LSP-proposed set of file edits or renames; it remains a proposal until the harness authorizes and applies it. |
| DAP | Debug Adapter Protocol; the standard used to control debuggers and inspect running programs. |
| Debug adapter | An external process translating DAP operations into a language/runtime-specific debugger. |
| Debuggee | The program or test process being debugged. |
| DebugObservation | Registered, redacted runtime evidence containing source anchors, stack/thread context, and selected variable state. |
| Safe boundary | A point where an agent or process can stop without losing known side-effect state or corrupting an approved operation. |

## Shared Understanding

**Agreed model (in the developer's words):** LSP is useful enough to be core language intelligence in the first resilient proof. Each worker workspace gets isolated semantic state; diagnostics are version-fresh evidence; symbols enrich code anchors; and any language-server write remains a proposal routed through the harness's existing permissions and structured edits. The debugger is also useful, especially after failing tests, but its adapter processes, variables, evaluation, secrets, and crash behavior require a designed safety seam first. Live debugging follows the proof and supports TDD/remediation without replacing tests.

**Corrected during teach-back:** None; the developer accepted core LSP now and debugger design now/implementation later as recommended.

**Residual uncertainty (accepted):** Exact initial languages, language-server/adapter configurations, timeout values, redaction mechanics, and Electron debugger presentation will be selected during research and design.

## References

- `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md` - complete inherited harness requirements.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/lsp/config.ts:176-310,437-530` - language-server discovery and matching.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/lsp/client.ts:801-975,1022-1321` - client lifecycle and document synchronization.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/lsp/diagnostics.ts:170-274` - diagnostic freshness.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/lsp/tool.ts:303-440,1094-1423` - agent operations, output, and mutation previews.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/test/lsp-mux.test.ts:215-322` - concurrent workspace isolation and reuse behavior.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/dap/defaults.json:2-211` - debugger adapter definitions.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/dap/client.ts:107-665` - DAP transport, timeouts, and cleanup.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/dap/session.ts:308-442,927-1155` - debug session lifecycle and operations.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/tools/debug.ts:62-148,725-1120` - model-facing debugger tool and permissions.
