---
date: 2026-08-14T14:57:58+0100
author: Pedro Mesquita
commit: d9c49a8
branch: fix/arch-review-helper-paths
repository: rpiv-claude
topic: "Personal multi-agent coding harness with a visual project galaxy"
tags: [intent, frd, coding-harness, multi-agent, memory, waypoints, mastra]
status: complete
register: mixed
consensus: confirmed
last_updated: 2026-08-14T14:57:58+0100
last_updated_by: Pedro Mesquita
content_hash: 0a0a85e8b518da22571408359cfb9d153e85c770e008909a745dfaaa0145d927
---

# FRD: Personal Multi-Agent Coding Harness With a Visual Project Galaxy

## Summary

Build a personal, local-first desktop coding harness that makes several agent sessions visible and controllable, preserves verified knowledge across sessions, and represents project work as a non-linear galaxy of feature systems and waypoint planets. A deterministic application coordinator owns durable project truth; resumable AI parents supervise bounded, non-nesting workers for each active waypoint.

## Problem & Intent

The harness is for **personal development**. Compared with several ordinary coding-agent sessions, the desired improvement is **all three together**: continuity and memory, visible coordination of parallel agents, and non-linear project control where work may branch, pause, reopen, and evolve without being forced through Discover -> Research -> Design -> Plan -> Implement.

The product should make complex development understandable and steerable. It should show what each agent is doing, why work is blocked, which evidence supports a claim, how a decision changed, and whether interrupted work can safely resume. It should not reproduce the current RPIV pipeline or duplicate implementation code through several planning artifacts.

## Goals

- Provide one coherent environment for project framing, agent orchestration, verified memory, implementation, validation, and recovery.
- Let the user supervise several active waypoint runs while preserving bounded context for each AI session.
- Represent one project as a visual galaxy, durable Features as star systems, and durable Waypoints as planets.
- Generate an initial waypoint map from an interactive framing conversation, while requiring user acceptance before generated state becomes canonical.
- Support non-linear actions rather than mandatory project phases.
- Preserve every meaningful waypoint, prompt, decision, board, and memory change as auditable history.
- Make canonical code evidence clickable, historically durable, and resistant to fabricated or stale line references.
- Support full verified memory in the first version, including provenance, staleness, retrieval, and user governance.
- Make project analyzers and skills available only when project signals and the approved delegation plan make them relevant.
- Recover safely after application, session, or computer interruption without reverting unrelated user work.
- Keep the runtime replaceable even though Mastra is the first implementation.

## Non-Goals

- Multi-user accounts, team collaboration, hosted project synchronization, or several simultaneously active projects.
- Non-Git implementation workspaces.
- A fixed Discover -> Research -> Design -> Plan -> Implement pipeline.
- New FRD Markdown compatibility as an authoritative or generated interface; new Research behavior will consume structured Frame records.
- A complete built-in code editor; the harness provides evidence, captured-code, and diff viewers plus an external-editor link.
- Automatic merging, pushing, dependency changes, or unrestricted autonomous shell execution.
- Unlimited recursive subagents.
- Tauri packaging in the first desktop implementation.
- LangSmith or another required remote observability backend in the first version.
- Full voice and freehand-sketch interpretation in the first Frame implementation.
- Shipping the entire RPIV action catalogue initially.

## Functional Requirements

1. The system SHALL save many local projects but allow only one active project to run sessions at a time.
2. The system SHALL require every implementation-capable project to be a Git repository.
3. The system SHALL represent the active project as a galaxy containing durable Feature star systems.
4. Each Feature SHALL have a stable ID, objective, Frame record, goals, constraints, revision history, and waypoint collection.
5. The Frame action SHALL use an adaptive grilling interview rather than the current Discover pipeline behavior.
6. Frame SHALL present important choices through a Decision Canvas containing context, rationale, assumptions, visual explanation, trade-offs, concrete scenarios, recommendation, confidence, and unresolved uncertainty before selection.
7. Frame SHALL support structured manipulation: diagram editing, map-diff editing, assumption pinning, option ranking and combination, labeled trade-off controls, scenario toggles, annotations, undo/redo, and a visible plain-language interpretation of every gesture.
8. Frame SHALL show one dependent or important decision at a time and MAY batch only independent routine details.
9. Frame SHALL store requirements, decisions, interaction events, and proposed map changes as structured records rather than new FRD Markdown artifacts.
10. The system SHALL let the framing agent propose Feature waypoints, relationships, rationale, and completion contracts, but SHALL require user acceptance or editing before those proposals become canonical.
11. Each Waypoint SHALL represent one durable project objective and have a stable ID, name, description, immutable creation date, current revision, fixed status, completion contract, start mode, action prompts, decisions, evidence, and execution history.
12. Every meaningful Waypoint edit SHALL create a recoverable revision under the same stable ID.
13. Restoring an older Waypoint revision SHALL create a new revision and SHALL NOT erase later history.
14. Internal worker tasks SHALL remain inside a Waypoint run plan unless the user or parent proposes and accepts promotion to a new Waypoint.
15. The initial canonical Waypoint relationships SHALL be `blocks`, `related-to`, and `derived-from`; only `blocks` SHALL affect readiness.
16. The system SHALL maintain separate fixed status models for Waypoints, runs, and workers.
17. Waypoint status SHALL distinguish at least draft, ready, active, waiting-for-user, blocked, completed, and cancelled.
18. Run status SHALL distinguish at least preparing, awaiting-approval, running, paused, interrupted, failed, succeeded, rolled-back, and cancelled.
19. Worker status SHALL distinguish at least queued, running, waiting, failed, succeeded, and cancelled.
20. Different Waypoints MAY have active runs concurrently, but one Waypoint SHALL have at most one active parent run.
21. A manual Waypoint SHALL begin only when the user presses Begin.
22. An automatic Waypoint SHALL begin preparing when it becomes ready, but SHALL stop for delegation-plan approval before launching workers.
23. The system SHALL choose prompts by explicit action rather than status; status SHALL control which actions are available.
24. Action prompt drafts SHALL be versioned and user- or parent-editable; workers MAY propose prompt revisions but SHALL NOT silently replace canonical prompts.
25. The first action set SHALL be Frame, Research, Implement, and Validate.
26. Implementation SHALL enforce an evidence gate before repository changes begin.
27. The Waypoint parent SHALL decide whether accepted evidence is sufficient and SHALL expose that assessment in the delegation plan.
28. If implementation evidence is insufficient, the run SHALL gather context or research before proposing implementation work, without requiring a separate Research artifact or pipeline stage.
29. Every Waypoint SHALL have a stored completion contract before it can complete.
30. A parent SHALL submit completion evidence and the user SHALL accept completion.
31. The deterministic application coordinator SHALL own durable state, scheduling, budgets, policy, recovery, and parent-run lifecycle.
32. Each active Waypoint SHALL have a resumable AI parent responsible for evidence assessment, a just-in-time delegation plan, worker selection, supervision, blockers, and result acceptance.
33. The Waypoint parent SHALL handle coordination capabilities directly but SHALL NOT perform repository mutations, commands, analyzers, Git operations, or external side effects.
34. Repository reads that create canonical evidence, mutations, commands, analyzers, Git operations, and external side effects SHALL be performed by attributed worker sessions.
35. Workers SHALL be non-nesting and SHALL NOT create descendants.
36. Worker recipes SHALL be risk-based: low-risk work may use one implementer plus deterministic checks; standard work may add validation; high-risk work may add evidence, validation, and independent review workers.
37. Workers SHALL run sequentially by default; parallel workers SHALL require an approved plan showing that their tasks are independent.
38. The parent SHALL show proposed worker roles, tasks, tools, budgets, dependencies, and risk classification for approval before dispatch.
39. The user SHALL be able to inspect, message, approve, reject, pause, resume, cancel, and retry active parent and worker sessions.
40. The system SHALL enforce configurable global and per-Waypoint limits for active sessions, workers, model usage, cost, and command runtime.
41. The system SHALL support one configured default model and optional model overrides by action or worker role through Mastra's provider-neutral model interface.
42. Every Waypoint SHALL have one durable shared board spanning all of its attempts and revisions.
43. The shared board SHALL be one append-only timeline containing natural chat plus typed findings, questions, answers, blockers, task events, results, artifacts, decision proposals, memory candidates, state events, and conflicts.
44. Chat SHALL NOT directly change project state; only validated typed commands SHALL change canonical state and append resulting state events.
45. Workers SHALL be allowed to submit validated updates only for their assigned Waypoint.
46. The application SHALL reject stale, unauthorized, invalid-transition, or out-of-scope worker commands and SHALL append a visible conflict event.
47. The board SHALL support filters for messages, tasks, evidence, decisions, tools, and system events.
48. The project SHALL expose a read-only project activity feed that aggregates important events from all Waypoint boards.
49. The parent SHALL create bounded handoff packages for new workers from accepted board entries, relevant verified memory, repository state, completion conditions, and permissions rather than forwarding entire transcripts.
50. Board entries and meaningful corrections SHALL be append-only and linked by supersession rather than overwritten.
51. Canonical code evidence SHALL be created only through a harness evidence-registration tool and identified by a stable evidence ID.
52. A compound code anchor SHALL capture repository, commit, blob, path, range, exact text, normalized hash, surrounding context, language, enclosing symbol, and syntax-tree fingerprint where available.
53. Plain model-written file and line references SHALL remain visibly unverified and SHALL NOT satisfy evidence gates or verified-memory promotion.
54. The code-anchor resolver SHALL attempt exact blob, Git diff/rename mapping, symbol resolution, snippet matching, syntax-tree matching, and context matching in decreasing confidence order.
55. The resolver SHALL report exact, moved, changed, historical-only, deleted, ambiguous, or invalid resolution and SHALL NOT silently select a weak match.
56. Clicking code evidence SHALL open a built-in current, captured, or diff view and MAY jump to a configured external editor.
57. The system SHALL preserve existing RPIV Markdown artifacts and hashes as linkable evidence even though new Frame and Research data is structured.
58. The first version SHALL implement full verified memory with candidate, verified, stale, superseded, revoked, and deleted lifecycle behavior.
59. Every verified memory SHALL carry evidence, scope, source revision, verification policy, author, confidence, timestamps, and invalidation dependencies.
60. Evidence changes SHALL automatically mark dependent memories stale and remove them from trusted retrieval until reverified.
61. Memory retrieval SHALL combine project and Waypoint relationships, metadata filters, full-text search, semantic search, and context-budget ranking.
62. Project facts and decisions SHALL remain project-scoped; only explicitly approved preferences MAY cross project boundaries.
63. The user SHALL be able to inspect retrieval rationale and evidence, revise through history, revoke trust, reverify, and delete private memory data.
64. The system SHALL detect project capabilities from file types, configuration, package dependencies, and installed local tools.
65. Eligible analyzers such as jscpd and dependency-cruiser SHALL become available to the parent but SHALL execute only when included in an approved delegation plan.
66. Privileged tool permission SHALL be bounded by the approved plan, workspace, arguments, budget, and policy version; destructive Git, network, secrets, dependency changes, and scope expansion SHALL request fresh approval.
67. Before every run, the user SHALL choose read-only current checkout, exclusive current-checkout editing, or a Git worktree.
68. Concurrent or substantial edits SHOULD use worktrees; current-checkout edits SHALL have an exclusive write lease and a run-owned change journal.
69. Candidate code changes SHALL be shown for review before an integration action rebases or merges them into the main working branch.
70. A logically failed run SHALL preserve its board, logs, evidence, and worktree while waiting for user retry, redirection, or discard.
71. An interrupted run SHALL resume only when its resume capsule is complete, pending side effects are known, and the workspace still matches its recorded state.
72. A non-resumable interrupted run SHALL roll back only provably run-owned changes to the last safe checkpoint while preserving the abandoned patch and logs.
73. The resume capsule SHALL include workflow snapshot, prompt version, conversation and board cursor, source revision, diff, current task, budgets, approvals, and pending-tool state.
74. The first agent runtime SHALL be Mastra behind a project-owned `AgentRuntime` interface.
75. The first desktop client SHALL use Electron with React, while the Mastra harness SHALL run in a separate TypeScript child or utility process.
76. The first version SHALL keep durable project data and Mastra observability local.
77. The map SHALL use a 2D solar/galaxy visual language: Project as galaxy, Features as star systems, Waypoints as planets, and live parents/workers as satellites.
78. Orbital position SHALL be user-authored; automatic arrangement SHALL be an explicit operation on a selection or system.
79. Motion SHALL communicate state rather than continuously moving targets, and reduced-motion behavior SHALL be provided.
80. Planet status SHALL be communicated through text, shape, icon, and motion in addition to color.
81. The map SHALL have progressively disclosed far, medium, near, and focused zoom states.
82. Every visual and Frame interaction SHALL have a keyboard-accessible and plain-text equivalent.

## Non-Functional Requirements

- **Performance**: No final numeric load target is set. The first proof must keep the map, board, and supervision controls responsive while two Waypoint parents and their workers stream events concurrently. Timelines and code/tool output must use bounded loading or virtualization rather than injecting unlimited history into the renderer or model context.
- **Security**: Project state is local-first. Renderer code must not receive unrestricted Node access. The Electron preload interface must be narrow and typed. Parent sessions cannot perform side effects. Worker permissions are bound to an approved plan. Shell allowlists are policy, not sandboxing; unattended or untrusted execution requires a container or equivalent isolation. Secrets and source content must be excluded from telemetry unless explicitly allowed.
- **UX / Accessibility**: The visual direction is an operable 2D project galaxy, not a decorative or constantly moving simulation. Every color and motion cue has a textual/iconic equivalent. All map, Decision Canvas, board, approval, memory, and evidence interactions are keyboard-accessible and represented in plain language. User-authored spatial placement persists.
- **Reliability**: Project state, board events, revisions, evidence, memory, approvals, and resumable execution snapshots are durable across application and computer restarts. State changes use validation and expected revisions. Interrupted side effects fail closed: resume only from a complete capsule or safely roll back run-owned changes.

## Constraints & Assumptions

- The first product is personal and local-first, with one active project and no team model.
- TypeScript and pnpm remain the primary implementation environment.
- Mastra is the first runtime, but the project kernel does not expose Mastra types outside its adapter.
- AgentController and other young Mastra harness APIs may change; adoption requires a compatibility spike and pinned versions.
- Electron is the first shell; the harness remains a separate process so Tauri or another shell can be evaluated later.
- SQLite/libSQL is the expected local persistence shape; research must validate storage, FTS, vector, concurrency, and migration requirements.
- Git history is the permanent source for captured code evidence and safe implementation work.
- The application coordinator is deterministic software, not one unbounded project-wide AI conversation.
- Waypoint parents are resumable AI sessions constrained by application policy.
- Existing RPIV skills and artifacts are inputs to migration research, not contracts that force the new application into the existing pipeline.

## Acceptance Criteria

- [ ] From an empty local project record, the user can create one Feature through Frame, manipulate and accept its proposed map, and see a star system containing two canonical Waypoint planets.
- [ ] Frame presents at least one important decision with a visual explanation, assumptions, scenario, trade-off comparison, recommendation, richer option details, structured manipulation, undo, and plain-language interpretation before acceptance.
- [ ] Editing a Waypoint name, description, prompt, or completion contract creates a visible revision that can be restored without changing its stable ID or deleting later history.
- [ ] The map renders `blocks`, `related-to`, and `derived-from` distinctly; a blocked planet cannot become ready until its blocking Waypoint completes.
- [ ] Two different Waypoints can have concurrent parent runs while the UI accurately separates Waypoint, run, and worker statuses.
- [ ] A ready automatic Waypoint prepares its plan and stops at delegation approval; a ready manual Waypoint waits for Begin.
- [ ] An implementation run with insufficient evidence performs bounded research before presenting its delegation plan.
- [ ] An approved risk-based plan launches non-nesting workers in the proposed sequence and enforces the approved model, tools, workspace, budget, and permission boundaries.
- [ ] The user can inspect, message, pause, resume, cancel, retry, approve, and reject active sessions without editing database state manually.
- [ ] Worker chat and typed events appear in one durable Waypoint board; a chat statement alone cannot change status, while an accepted typed command can.
- [ ] A worker attempting to update another Waypoint or a stale revision receives a visible conflict event and causes no canonical state change.
- [ ] A later worker starts from a bounded handoff and can use accepted earlier findings without receiving every earlier transcript or raw tool output.
- [ ] A model-written nonexistent `file:line` citation remains unverified and cannot pass an evidence gate.
- [ ] A registered code anchor opens the captured historical code and, after inserted lines or a file move, either resolves the current location with an explicit confidence state or reports ambiguity/staleness.
- [ ] A code-derived verified memory becomes stale after its registered source changes and is excluded from trusted retrieval until reverified.
- [ ] The memory inspector shows why a memory was retrieved and lets the user inspect evidence, revise, revoke, reverify, and delete it.
- [ ] The capability broker detects an applicable analyzer but does not execute it until the approved plan includes it.
- [ ] Before implementation, the UI requires the user to select a workspace mode; concurrent substantial runs can use separate worktrees.
- [ ] A completed candidate change presents its diff and validation evidence before integration into the main branch.
- [ ] Restarting during a run with a complete resume capsule restores the parent, board, statuses, budgets, and pending approval without repeating a completed side effect.
- [ ] Restarting during a non-resumable run rolls back only run-owned changes to the safe checkpoint and preserves the abandoned patch and logs.
- [ ] The two-Waypoint resilient proof completes one validated change and leaves locally inspectable Mastra traces, boards, revisions, evidence, and memory.
- [ ] The complete first-proof flow can be operated through keyboard and plain-text equivalents without relying on planet color or motion alone.

## Recommended Approach

Build a framework-independent TypeScript project kernel for Project, Feature, Waypoint, run, worker, board, evidence, memory, capability, workspace, and approval state; adapt Mastra behind a narrow runtime interface and expose it through a separate local harness process to an Electron/React project-galaxy client. Execute short, approved Mastra parent/worker recipes inside Waypoints while the application database remains the only authority for the evolving non-linear map.

## Decisions

### Primary user and value
**Question**: Who is this harness primarily for, and what should it let that person do better than existing coding agents?
**Recommended**: n/a - intent question
**Chosen**: Personal development; combine continuity and memory, visible coordination, and non-linear project control.
**Rationale**: The developer explicitly chose "Personal development" and "All three together" as the product's purpose.

### Application-owned parent
**Question**: Should the visible parent be one long-lived AI conversation for the project, or should the durable application coordinate shorter AI sessions?
**Recommended**: Application parent.
**Chosen**: Application parent.
**Rationale**: Keeps recovery and scheduling durable while preventing one AI context from growing into a degraded project bottleneck; current RPIV leaves parent scheduling to the host (`opencode/plugin-support.mjs:229-242`).

### Worker updates
**Question**: When a worker updates shared state directly, how broad should its authority be?
**Recommended**: Assigned Waypoint only.
**Chosen**: Assigned Waypoint only through validated commands.
**Rationale**: Preserves worker autonomy without allowing concurrent sessions to rewrite unrelated objectives.

### Existing RPIV artifacts
**Question**: Should existing RPIV artifacts and hashes remain linked evidence while the Waypoint database becomes the source of current status?
**Recommended**: Keep as evidence.
**Chosen**: Keep as evidence.
**Rationale**: Retains useful research, decisions, lineage, and content hashes without making Markdown responsible for live scheduling (`skills/_shared/validate-artifact.mjs:78-147`).

### Feature, Waypoint, and task meanings
**Question**: What should one Waypoint represent, and where should implementation and decomposed tasks live?
**Recommended**: A durable objective with internal tasks promoted only when independently important.
**Chosen**: A durable objective that contains decisions, runs, implementation, and validation; temporary tasks stay internal unless promoted.
**Rationale**: Avoids confusing sessions with durable project intent and prevents agent task decomposition from flooding the map.

### Waypoint revisions
**Question**: Should every meaningful edit create a recoverable revision while preserving the Waypoint's stable ID?
**Recommended**: Version every meaningful edit.
**Chosen**: Version every meaningful edit.
**Rationale**: Gives audit and rollback without replacing one objective with many near-duplicate planets.

### Waypoint relationships
**Question**: Which map relationships should be canonical initially?
**Recommended**: `blocks`, `related-to`, and `derived-from`.
**Chosen**: `blocks`, `related-to`, and `derived-from`.
**Rationale**: Expresses scheduling, context, and promoted work while avoiding a large custom relationship language.

### Separate statuses
**Question**: Should Waypoint, run, and worker each have separate fixed status models?
**Recommended**: Separate status models.
**Chosen**: Separate status models.
**Rationale**: A Waypoint can remain active while one worker succeeds, another fails, and the run waits for input.

### Creation date only
**Question**: What should the visible calendar date on a Waypoint mean?
**Recommended**: Initially proposed planned and target dates.
**Chosen**: Immutable creation date only; planned-start and due-date behavior removed.
**Rationale**: The developer corrected the earlier interpretation: the visible date is simply when the Waypoint was created.

### Action-based prompts
**Question**: Should default prompts be selected by explicit action, with status only controlling allowed actions?
**Recommended**: Action-based prompts.
**Chosen**: Action-based, versioned prompt drafts.
**Rationale**: One status such as waiting-for-user can require several different next actions, so status alone cannot safely choose an instruction.

### One active run per Waypoint
**Question**: May the same Waypoint have several competing orchestrator runs?
**Recommended**: One run per Waypoint; different Waypoints may run concurrently.
**Chosen**: One active parent run per Waypoint.
**Rationale**: Preserves understandable status and avoids competing changes to one objective.

### Start mode and automatic boundary
**Question**: Who starts a ready Waypoint, and how far may an automatic Waypoint proceed?
**Recommended**: Per-Waypoint start mode; automatic preparation stops at approval.
**Chosen**: Manual or automatic per Waypoint; automatic begins when ready and waits before dispatch.
**Rationale**: Allows proactive preparation without unattended agent work or spend.

### Delegation approval
**Question**: Should the parent show how it intends to split work before launching workers?
**Recommended**: Show and approve the plan.
**Chosen**: Show and approve worker roles, tasks, tools, budgets, and dependencies.
**Rationale**: Gives the user control and teaches how the orchestration behaves before cost or side effects occur.

### Agent communication
**Question**: How should child workers communicate while a Waypoint is running?
**Recommended**: Initially parent mediation; refined to a shared structured surface.
**Chosen**: One combined append-only board containing chat and typed events; only typed commands affect state.
**Rationale**: Combines natural coordination with reliable scheduling, attribution, and audit.

### Board scope
**Question**: Should the shared board persist for the full lifetime of each Waypoint, with a project feed aggregating important events?
**Recommended**: Waypoint board plus project feed.
**Chosen**: Waypoint board plus project feed.
**Rationale**: Preserves continuity across attempts without creating one noisy project-wide agent chat.

### Full supervision
**Question**: What control should the user have over active sessions?
**Recommended**: Full supervision.
**Chosen**: Inspect, message, approve/reject, pause/resume, cancel, and retry.
**Rationale**: Visible control is one of the three primary product outcomes.

### Capability-based parent boundary
**Question**: Should the Waypoint parent handle coordination while repository mutations, commands, analyzers, and external effects belong to workers?
**Recommended**: Capability boundary.
**Chosen**: Capability boundary with no worker nesting.
**Rationale**: Keeps parent context stable and makes side effects attributable without relying on a vague model judgment of triviality.

### Risk-based worker recipes
**Question**: How should the parent choose implementer, validator, research, and reviewer workers?
**Recommended**: Risk-based recipes, sequential by default.
**Chosen**: Risk-based, approved recipes; workers normally run sequentially and cannot delegate.
**Rationale**: Small tasks avoid a full pipeline while risky work receives independent evidence, validation, and review.

### Just-in-time plans
**Question**: When should a Waypoint receive its detailed worker plan?
**Recommended**: Just in time.
**Chosen**: Map creation stores an outline; Begin generates the detailed plan from current evidence and repository state.
**Rationale**: Avoids stale plans and repeated code design as earlier Waypoints change the project.

### Implementation evidence gate
**Question**: Should every implementation enforce an evidence gate, gathering research inside the run when necessary?
**Recommended**: Require the evidence gate.
**Chosen**: Require the evidence gate; the parent decides sufficiency and exposes its reasoning in the plan.
**Rationale**: Preserves research-before-change without rebuilding a mandatory artifact pipeline.

### Initial actions
**Question**: Which action templates should the first usable version support?
**Recommended**: Frame, Research, Implement, and Validate.
**Chosen**: Frame, Research, Implement, and Validate.
**Rationale**: This is the smallest complete loop for map creation, evidence, code changes, and proof.

### Frame interaction model
**Question**: How should Frame sequence and present choices?
**Recommended**: Adaptive Decision Canvases with structured manipulation.
**Chosen**: Adaptive cadence; rich visual rationale before selection; structured diagram/map editing, ranking, combination, controls, scenarios, annotations, undo, and interpreted gestures.
**Rationale**: Concise multiple-choice descriptions do not align human and model understanding for complex decisions.

### Frame output and map acceptance
**Question**: How should the initial map be created, and should Frame retain FRD compatibility?
**Recommended**: Agent proposes and user accepts; initially proposed structured source plus rendered FRD.
**Chosen**: Agent proposes and user accepts; store structured records and drop new FRD compatibility.
**Rationale**: Removes a duplicated Markdown authority and prevents Research compatibility from forcing the new harness back into the old pipeline.

### Completion contract
**Question**: What should let a Waypoint become completed?
**Recommended**: Stored completion contract.
**Chosen**: Parent submits evidence against a stored contract and the user accepts completion.
**Rationale**: Makes completion observable and comparable rather than dependent on an agent saying it is done.

### Workspace selection
**Question**: How should the harness choose an execution workspace?
**Recommended**: Initially risk-based selection with override.
**Chosen**: The user chooses before every run.
**Rationale**: The developer prefers explicit control over current checkout, read-only mode, and worktree overhead.

### Code integration
**Question**: How should completed worktree code reach the main working branch?
**Recommended**: Review then integrate.
**Chosen**: Review the diff and evidence, then run an explicit integration action.
**Rationale**: Prevents tests alone from silently integrating semantic conflicts.

### Failed and interrupted work
**Question**: What should happen to failed work and crash-interrupted work?
**Recommended**: Preserve logical failures; resume from a complete capsule or safely roll back interruptions.
**Chosen**: Preserve failed attempts for review; interrupted attempts resume only with complete context and matching workspace, otherwise roll back run-owned changes while preserving patch and logs.
**Rationale**: Protects unrelated user work while avoiding both blind continuation and unnecessary loss of safely resumable progress.

### Local-first data
**Question**: Where should maps, prompts, transcripts, memory, and tool output live?
**Recommended**: Local-first.
**Chosen**: Local-first.
**Rationale**: Matches a personal tool, repository privacy, offline project state, and simple first-version operations.

### Concurrency and permission budgets
**Question**: How should the harness limit sessions and tool permissions?
**Recommended**: Global and Waypoint budgets; approved plans grant bounded permissions.
**Chosen**: Global and per-Waypoint model/session/worker/runtime budgets; plan-scoped permissions with fresh approval for high-risk expansion.
**Rationale**: Prevents runaway delegation without interrupting for every expected read, edit, or test.

### Full verified memory
**Question**: What continuity must the first version provide, and what qualifies as verified?
**Recommended**: Initially structured project memory, then evidence-plus-policy verification.
**Chosen**: Full verified memory in the first version, using evidence plus policy.
**Rationale**: Memory is a primary product goal; model agreement alone is insufficient proof.

### Memory staleness and retrieval
**Question**: What happens when evidence changes, and how should relevant memory be found?
**Recommended**: Automatically stale dependent memory and use hybrid retrieval.
**Chosen**: Automatic staleness plus relationship, metadata, full-text, semantic, and budget-aware retrieval.
**Rationale**: Prevents outdated code facts from remaining trusted while retaining recall across different wording.

### Memory governance and scope
**Question**: What user control is required, and which memories may cross projects?
**Recommended**: Inspect and govern; share preferences only.
**Chosen**: Inspect, revise, revoke, reverify, and delete; project facts stay isolated and only approved preferences cross projects.
**Rationale**: Makes memory debuggable and prevents one repository's assumptions from poisoning another.

### Tool activation
**Question**: Should relevant analyzers automatically execute or become available for planning?
**Recommended**: Available, then planned.
**Chosen**: Detect and expose relevant tools, then execute only through an approved delegation plan.
**Rationale**: Gains project-aware capabilities without startup cost, prompt bloat, or noisy automatic scans.

### Canonical code evidence
**Question**: Should only harness-issued compound anchors count as canonical evidence?
**Recommended**: Require registered anchors.
**Chosen**: Require registered compound anchors; plain citations remain unverified.
**Rationale**: Prevents fabricated citations from satisfying evidence gates and supports historical/current navigation after code moves.

### Code navigation
**Question**: Where should clicking anchored evidence open code?
**Recommended**: Built-in viewer plus editor link.
**Chosen**: Built-in current/captured/diff viewer plus external-editor jump.
**Rationale**: Supports historical comparison without expanding scope into a full editor.

### First runtime
**Question**: Which runtime should the first implementation target behind `AgentRuntime`?
**Recommended**: Mastra first.
**Chosen**: Mastra first.
**Rationale**: Best current TypeScript fit for agents, workspaces, skills, approvals, memory, workflows, streaming, local traces, and evals while preserving an adapter exit.

### Desktop shell
**Question**: Which desktop shell should the first version use?
**Recommended**: Electron first with a separate harness process.
**Chosen**: Electron first with a separate harness process.
**Rationale**: Keeps Mastra and project infrastructure in TypeScript and reaches the distinctive product sooner while retaining a later Tauri migration path.

### Observability
**Question**: Should LangSmith be the first trace backend?
**Recommended**: Optional redacted LangSmith.
**Chosen**: Mastra local observability only.
**Rationale**: Preserves the local-first boundary and defers remote source/tool telemetry.

### Project and model scope
**Question**: How many projects are active and how should models be selected?
**Recommended**: One active project with many saved; one default model plus overrides.
**Chosen**: One active project with many saved; default model plus action/role overrides.
**Rationale**: Controls local resource use while preserving provider and cost flexibility.

### Git requirement
**Question**: Should a project be required to use Git?
**Recommended**: Require Git.
**Chosen**: Require Git.
**Rationale**: Worktrees, diffs, historical evidence, recovery, and safe rollback depend on it.

### Visual accessibility
**Question**: Should every visual interaction have a keyboard and plain-text equivalent?
**Recommended**: Equivalent interaction.
**Chosen**: Equivalent interaction.
**Rationale**: Improves accessibility, audit, automation, testing, and recovery when a visual cannot render.

### Solar-system hierarchy
**Question**: What should galaxies, stars, planets, and satellites represent?
**Recommended**: Initially one project star with Waypoint planets.
**Chosen**: Project galaxy; durable Feature star systems; Waypoint planets; live parents and workers as satellites.
**Rationale**: Supports several feature maps inside one project and gives the visual metaphor stable domain meaning.

### Map layout
**Question**: How should Waypoint placement behave?
**Recommended**: Manual map with explicit auto-arrange.
**Chosen**: Manual map with explicit auto-arrange.
**Rationale**: Preserves spatial authorship and world-map memory without making large systems tedious to arrange.

### First proof
**Question**: What demonstration defines the first successful release?
**Recommended**: Two-Waypoint resilient run.
**Chosen**: Two-Waypoint resilient run.
**Rationale**: Proves the three main outcomes together: non-linear visual state, multi-session supervision, and durable evidence/memory/recovery.

## Open Questions

None. Exact default numeric budgets, visual styling tokens, memory embedding provider, and detailed board payload schemas are implementation research rather than deferred product decisions.

## Suggested Follow-ups

- Evaluate a later Tauri shell after the Electron/harness process seam is proven.
- Evaluate additional runtime adapters only after the Mastra contract and first-proof dataset exist.
- Add voice and confirmed freehand-sketch interpretation to Frame after structured manipulation is usable.
- Add additional actions such as Explore, Design, Review, Recover, and Integrate without turning them into mandatory stages.
- Research whether selected existing RPIV artifact schemas should be imported automatically or linked manually.

## Glossary

| Term | What it means here |
|---|---|
| Project | One saved Git repository and its complete local harness state; the active project's visual metaphor is a galaxy. |
| Feature | A durable objective container with its own Frame record, goals, constraints, revisions, and Waypoint star system. |
| Waypoint | A durable project objective represented as a planet; it is not an agent session or temporary worker task. |
| Application coordinator | Deterministic software that owns project truth, scheduling, policy, budgets, and recovery. |
| Waypoint parent | A resumable AI supervisor for one active Waypoint run. |
| Worker | A bounded, non-nesting agent session that performs attributed research, repository work, validation, or review. |
| Run | One supervised attempt to perform an action on a Waypoint. |
| Action | A reusable behavior such as Frame, Research, Implement, or Validate; actions are not mandatory pipeline stages. |
| Delegation plan | The just-in-time, user-approved description of workers, tasks, tools, budgets, dependencies, and risk. |
| Evidence gate | The check that accepted, current evidence is sufficient before implementation side effects begin. |
| Completion contract | The observable checks and evidence required before a Waypoint may complete. |
| Shared board / blackboard | A durable Waypoint collaboration timeline where isolated workers publish selected chat and structured events. |
| Typed event | A structured, validated board record whose meaning the application can safely interpret. |
| Compound code anchor | A Git-, text-, symbol-, and syntax-backed reference that can open captured code and attempt to resolve its current location. |
| Verified memory | A durable claim accepted through evidence and policy, with scope, provenance, confidence, and invalidation rules. |
| Semantic search | Retrieval by similar meaning rather than exact words; used as one signal in hybrid memory retrieval. |
| Capability broker | The module that detects relevant skills/tools and exposes them for approved plans without running everything automatically. |
| Write lease | Exclusive permission for one run to edit the current checkout at a time. |
| Worktree | A separate Git checkout used to isolate a run's code changes. |
| Resume capsule | The complete persisted context needed to continue an interrupted run without guessing or repeating uncertain side effects. |
| Decision Canvas | Frame's interactive explanation-and-choice surface with visuals, trade-offs, scenarios, controls, and teach-back. |
| Projection | A read-only view derived from canonical data, such as the project activity feed assembled from Waypoint boards. |
| Local-first | Durable project state stays on the user's machine; remote model calls do not make hosted state authoritative. |

## Shared Understanding

**Agreed model (in the developer's words):** This is a personal coding harness where continuity/memory, visible multi-agent control, and non-linear project work operate together. A project is a galaxy, Features are star systems, Waypoints are planets, and active agents appear as satellites. The application is the durable parent; each active Waypoint has an AI parent that prepares an approved plan and supervises non-nesting workers. Boards, registered evidence, verified memory, revisions, and safe crash recovery make every result inspectable and reusable.

**Corrected during teach-back:** Waypoint date means creation date only, not scheduled or due dates. Worktrees are chosen by the user per run rather than always created. The Waypoint parent is coordination-capable but repository side effects always belong to workers. New FRD compatibility was removed. The solar metaphor was expanded from one system into Project galaxy -> Feature star systems -> Waypoint planets.

**Residual uncertainty (accepted):** Mastra's current AgentController/harness APIs are assumed suitable behind an adapter and must be verified through the first technical spike. Exact numeric budgets, memory backend details, and low-level event payloads will be selected during research/design without changing the agreed product model.

## References

- `.rpiv/artifacts/research/2026-08-14_12-09-42_custom-coding-harness-options.md` - SDK, orchestration, memory, visual, and tool-loading research.
- `opencode/adapter.mjs:66-70,173-210` - current host translation and subagent definitions.
- `opencode/plugin-support.mjs:229-242` - current host-owned child-session identity.
- `.claude/hooks/session-state-preserve.mjs:1-66` - current compaction snapshot behavior.
- `skills/_shared/validate-artifact.mjs:78-147` - existing artifact validation and content hashes.
- `skills/_shared/artifact-review-dispatch.md:11-61` - current parent fan-out and result merge pattern.
- `skills/discover/SKILL.md:255-300` - current automatic Discover-to-Research handoff to replace.
