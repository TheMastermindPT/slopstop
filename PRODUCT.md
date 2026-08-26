# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

SlopStop is delivered as a Windows-first, cross-platform Electron desktop application. Its interface uses web technology, while operating-system and repository capabilities remain behind strict process boundaries.

## Stack

Electron, React, TypeScript, CSS Modules, pnpm workspaces, and a separate TypeScript harness utility process.

## Users

The first user is one developer working locally across Git repositories. They need to supervise several bounded agent sessions while understanding what each session is doing, why work is blocked, and which evidence supports its claims.

## Product Purpose

SlopStop combines continuity and verified memory, visible multi-agent coordination, and non-linear project control. It lets work branch, pause, reopen, and evolve without forcing every task through one fixed pipeline.

Success means the developer can steer concurrent Waypoint work, inspect durable evidence and decisions, recover safely after interruption, and trust that failed or unknown checks never appear clean.

## Positioning

SlopStop treats project intent, execution attempts, and model conversations as separate graphs. A deterministic application coordinator owns canonical project truth while resumable AI parents supervise bounded, non-nesting workers.

## Operating Context

- Local Git repositories are the implementation workspaces and historical evidence source.
- One project is active at a time; many projects may be saved.
- Projects, Features, Waypoints, and their typed relationships have visual and plain-text projections. The primary workspace uses a spatial relationship map with semantic zoom; its final visual identity remains deliberately open.
- The initial actions are Frame, Research, Implement, and Validate, but they are capabilities rather than mandatory stages.
- The user approves delegation plans, permissions, workspace mode, model changes, and integration actions.

## Workspace Interaction

- One Project is active at a time. One activity rail exposes Projects, Attention, Files, and Runs above separately placed Diagnostics and Settings; each destination replaces one sidebar rather than adding a permanent Project dock.
- Opening or changing the active Project opens Attention and frames every part of the map that requires human action without automatically selecting one item. Attention contains only decisions, approvals, permissions, conflicts, failures, blockers, and recovery, ordered first by impact and then by age; healthy activity remains in Runs.
- Semantic zoom moves from Project-level Feature regions to Feature-level Waypoints and typed relationships. The map is for orientation and selection, not the complete work surface.
- The center keeps deterministic `Map` and `Conversation` destinations and may open source previews, pinned source files, Run overviews, and Change reviews alongside them. Neither permanent destination requires browser-like backtracking to recover.
- Files presents the active Project hierarchy for inspection, not built-in editing. Opening source never sends it to a model; source, selections, and code anchors enter a Prompt packet only through explicit, removable attachments. Unsupported, binary, oversized, and unreadable files remain visible with an exact reason and external-editor action.
- Selecting a Run opens a first-class overview of its plan, Workers, progress, budget, Evidence, and Changes. In-progress Worker changes are visible as provisional read-only diffs; approval, change-request, and Integration actions appear only for a closed Candidate delta reached from its Run or Attention item.
- Logs, Process-job output, and detailed diagnostics use a collapsible lower panel scoped by default to the selected Run or Worker, with explicit Project and application alternatives. Critical failures always surface in Attention and never remain hidden only in logs.
- The right panel follows the selected Waypoint, file, diff, or Run. When open it keeps a compact summary visible, opens on `Details`, exposes only relevant contextual pages such as `Details`, `Evidence`, and `Changes`, and is resizable or collapsible on wide windows and an overlay on narrow windows. `Conversation` starts with it collapsed and opens it only for selected contextual details.
- Conversation is a full central workspace for direct model dialogue, never a Project activity feed. Project and Waypoint conversations preserve separate visible scopes and provenance; operational Run, Worker, and Board events remain in their owning surfaces instead of being automatically projected into chat. Choosing a Waypoint supplies bounded, inspectable context rather than the entire Board or repository. Model output may explain or create a reviewed proposal; it never changes canonical state directly.
- Board is a durable append-only index over one Project-wide order. Each entry belongs to one Waypoint and references either that Waypoint's conversation graph or an approved typed Execution event without copying source content; the primary Project conversation never enters Board.
- The Project activity feed is a policy-selected projection of approved typed-event entries from Waypoint Boards, never of their conversation messages, and is not another conversation or event store. Canonical state owns stable pagination, independent Project-feed and Waypoint unread positions, linear correction links, and explicit source-resolution failures, while Frame owns presentation.
- For a new Project, Conversation supports Frame from initial understanding through an approved plan. Before technical implementation detail, the model exposes its understanding of the intended end-state in clear language; the user reviews that overall summary first, then the user stories, observable outcomes, examples, and non-goals where misunderstanding may remain. Corrections revise the Decision Canvas, and only explicit acceptance creates canonical map content.
- While Frame remains unresolved, Conversation stays primary and may open an optional, visibly provisional preview of Decision Canvas decisions and relationships. That preview has no canonical authority; the Project map is created only from an explicitly accepted revision.
- Frame proves understanding adaptively. Consequential, ambiguous, corrected, disputed, surprising, limit, and failure behavior receives a bounded set of concrete prediction questions; the user may request the same proof, while clear low-risk work keeps a quick path. Multi-step walkthroughs are optional, structured expectation cards are an alternate projection rather than the primary conversation, and final approval exposes expectation-to-decision-to-plan gaps before canonical map creation.
- Model conversations may branch freely from exact messages, including nested branches that remain open without merge ceremonies. Before branch content influences a revision, the model proposes an inspectable include/exclude selection and the user may correct it; a branch never gains Project-work status or becomes a Waypoint automatically.
- Each Project has one primary Project conversation, and each Waypoint has its own separate scoped conversation. Both may branch under the same reviewed-influence rule; selecting a Waypoint can open its conversation without changing Project state, and returning to the primary conversation is deterministic.
- Before a model attempt, Conversation shows a compact inspectable and correctable Context proposal; routine messages do not require repeated full approval, but scope expansion, source, and sensitive content do. Each response exposes an immutable Context record of what was included and excluded, while token, hash, and provider-delivery details remain in a separate technical view.
- The Project menu opens a central Memory library for browse, search, filtering, proposal review, accepted and stale inspection, provenance, Evidence, history, and re-verification. Context records may link directly to referenced accepted or stale memories with deterministic return. Memory Proposals remain non-blocking and appear only in the library, never interrupting Conversation or creating Attention items; accepted Frame decisions remain canonical revisions and are never duplicated automatically as Verified Memory.
- During Frame, the Decision Canvas follows Conversation continuously. At natural conversational boundaries, coherent groups of proposed decisions receive a lightweight explicit Decision checkpoint and become Accepted revisions; final approval separately validates the complete end-state, plan, coverage, Feature, Waypoints, and relationships before generating the canonical Project map.
- The user corrects end-state, story, Canvas, and plan content through natural Conversation or comments attached to exact text in a provisional revision. The model produces an inspectable attributed diff; corrections never silently rewrite Accepted revisions or Canonical state.
- Full end-state and plan review opens a temporary central `Review` surface containing separate summary, user-story prose, annotations, proposed diffs, Decision checkpoints, technical plan, and final traceability sections. Conversation remains a permanent clean surface with deterministic return; wide windows may optionally split both views, but split is never the default.
- A persistent Conversation scope breadcrumb names the Project or Waypoint conversation and current branch. It opens a temporary searchable tree of scoped conversations and nested branches; the navigator closes after selection, preserving Conversation width, while Map and contextual links may deep-link to an exact conversation with deterministic return.
- Review expresses each end-state expectation first as one short plain-language user story and adds a Future Walkthrough narrative only for ambiguity, multi-step journeys, surprising consequences, or relevant limits and failures.
- Final Frame acceptance opens the generated canonical Project map immediately, frames newly created or changed Features, Waypoints, and relationships, and exposes the Accepted revision that produced them. Conversation and Review remain directly recoverable, while later correction creates a new revision instead of rewriting accepted history.
- Settings opens a short menu for Application, Project, and Models pages. Model credentials and catalogue, Project defaults, Run or role overrides, and the model actually used remain separate visible scopes rather than one misleading global selector.
- Automatic relationship-driven layout remains the v1 contract. Personal position pins are an accepted direction for later rich map control; they are local presentation preferences and can never change canonical relationships or priority.
- The visual treatment uses a carbon and graphite material language: matte near-black surfaces, machined edges, restrained neutral light, and scarce state color. Space, constellation, and game-progression imagery must not replace the real non-linear relationship semantics.
- The same rail destinations, selection, page content, actions, map relationships, and attention states require keyboard-accessible and plain-text projections. Small windows may temporarily prioritize the right panel as an overlay but must provide deterministic return to the center, `Map`, and `Conversation`.

## Capabilities and Constraints

- Project state, boards, revisions, evidence, memory, approvals, and recovery records are local-first.
- Electron renderer code receives no unrestricted Node access.
- The harness runs in one supervised utility process per desktop application.
- Mastra is the first agent runtime behind a project-owned adapter and is added only when its first behavior is implemented.
- Canonical and Mastra persistence use separate local libSQL databases with Drizzle-owned canonical migrations.
- Canonical persistence uses Project-scoped composite keys, directly queryable current aggregates, immutable Accepted revisions, append-only settlement history, and family-owned status transitions. The installation registry selects and operates versioned Storage generations but never becomes Project truth.
- Backup, export, forward migration, restore, import, runtime reset, and deletion use durable staged operations. A Project backup verifies both databases and one sealed identity/schema/checksum manifest; migration, restore, and import replace active storage only with a complete verified generation.
- A persistence fault opens the Project in read-only safe mode and never creates fresh defaults while any prior-state witness exists. Missing, corrupt, failed, recovery-required, identity-conflict, and unsupported-newer remain distinct.
- Close releases only the live session; Archive preserves a reversible canonical lifecycle; Delete SlopStop data removes only confirmed local SlopStop state after quiescence and never deletes the Git repository, tracked files, managed worktrees, or external exports.
- Portable exports use authenticated encryption by default and never contain raw credentials or machine-local paths. Automatic backup or generation retention waits for measured limits; v1 deletion is explicit.
- Test-first preferred is the default discipline. Behavior uses red-green at an agreed public seam, followed by a separate review/refactor gate.
- Workers do not nest. Repository reads that become evidence, mutations, commands, analyzers, Git operations, and external effects belong to attributed workers.
- Each Waypoint has at most one nonterminal Run, each Run has one logical Waypoint parent, and each Delegation task has at most one nonterminal Worker attempt. Runtime and model outputs remain attributed proposals; only typed coordinator commands, independent Evidence authority, and proven recovery records can move canonical execution state.
- Automatic model fallback, silent isolation downgrade, and failure-to-clean degradation are prohibited.
- Live debugger implementation follows the first resilient proof; its safety seam is designed earlier.

## Brand Commitments

The product name is SlopStop. The final visual identity is deliberately open and will be selected through explicit variants. The foundation shell may use a provisional technical-cartography direction, but it must remain cheap to replace.

The current prototype direction is carbon and graphite, centered on a live graph, direct model conversation, explicit commands, contextual supervision, and full diagnostic state. Effects are reserved for focus, attention, active work, and transitions so code and operational reading remain stable. This direction remains a prototype until explicit review selects a Stable Product Identity.

## Evidence on Hand

- `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md`
- `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md`
- `.rpiv/artifacts/discover/2026-08-14_16-18-18_lsp-debugger-refinement.md`
- `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md`
- `.rpiv/artifacts/research/2026-08-14_12-09-42_custom-coding-harness-options.md`
- `.rpiv/artifacts/research/2026-08-22_workspace-ux-patterns.md`

No customer claims, benchmarks, release claims, final brand assets, or final visual system exist yet. Future work must not fabricate them.

## Product Principles

- Durable application state outranks model conversation state.
- Every side effect is attributable, bounded, and recoverable without touching unrelated user work.
- Evidence and failure states remain explicit; unknown is never presented as clean.
- Rich visual control always has a keyboard-accessible and plain-text equivalent.
- Frameworks remain behind project-owned boundaries so measured requirements can replace them.
- Plans earn trust by proving shared understanding of the intended end-state in plain language before presenting implementation mechanics.

## Accessibility & Inclusion

Every map, Decision Canvas, board, approval, memory, evidence, and supervision interaction requires a keyboard-accessible and plain-text equivalent. Status must use text, shape, icon, and motion in addition to color. Reduced-motion behavior is required.
