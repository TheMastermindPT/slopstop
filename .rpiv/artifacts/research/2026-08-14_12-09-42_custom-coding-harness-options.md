---
date: 2026-08-14T12:09:42+0100
author: Pedro Mesquita
commit: d9c49a8
branch: fix/arch-review-helper-paths
repository: rpiv-claude
topic: "SDK and architecture options for a visual, non-linear coding-project harness"
tags: [research, coding-harness, agent-sdk, wayfinder, visualization]
status: complete
last_updated: 2026-08-14T12:09:42+0100
last_updated_by: Pedro Mesquita
content_hash: b77dc5dd03ed440e88ef52f0f698fab0b5fae63276eab5e910c69ed1e990ccb4
---

# Research: A Visual, Non-Linear Coding-Project Harness

## Research Question

How could RPIV and Matt Pocock's skills become a fully customized coding-project harness with an interactive waypoint map, persistent decisions, file-aware engineering tools, and a non-linear development model? Which current SDKs are useful, what do they provide, and what should be built in-house?

## Bottom Line

No single agent SDK provides the proposed product. The product has at least four distinct layers:

1. A coding-agent runtime that talks to models and safely operates on a repository.
2. A persistent project graph containing waypoints, dependencies, decisions, evidence, and status.
3. A visual local application that presents and edits that graph.
4. A capability broker that activates skills and engineering tools only when they are relevant.

The lowest-risk first version is:

- **OpenCode server/SDK** as the initial coding-agent runtime.
- **A custom SQLite project graph** as the source of truth for waypoints and decisions.
- **Tauri 2 + React Flow + ELK.js** for the local visual workbench.
- **Agent Skills-compatible `SKILL.md` directories** as canonical skill content.
- **A custom capability broker** for lazy activation of jscpd, dependency-cruiser, language guidance, MCP servers, and other project tools.

Pi is the strongest alternative runtime when owning and reshaping the coding loop matters more than shipping the workbench quickly. LangGraph is useful for individual agent executions, but it should not own the user-visible project map. Cloud-hosted durability should be deferred until work must continue while the local machine is offline or multiple users need shared state.

## The Three Graphs

The design becomes much clearer when three superficially similar graphs are kept separate.

### Project Graph

This is the user's world map. It contains durable domain facts:

- Waypoints and stable waypoint IDs.
- Parent, dependency, alternative, supersedes, and evidence relationships.
- Open, blocked, ready, active, completed, rejected, and superseded statuses.
- Questions, options, decisions, rationale, evidence, and acceptance criteria.
- Links to source revisions, artifacts, agent runs, issues, and commits.

The project graph is edited over time. It is not a compiled workflow and should not be owned by an agent framework.

### Execution Graph

This is one attempt to research, plan, implement, review, or validate a waypoint. LangGraph, an agent SDK, or a local worker may own this short-lived graph. It has retries, tool calls, approvals, parallel subagents, and checkpoints.

Several execution attempts may belong to one waypoint. A failed or superseded attempt must not corrupt the project's durable meaning.

### Conversation Graph

This is model/session history: turns, forks, summaries, tool results, and context compaction. Pi and OpenCode already model this well. It should be linked to a waypoint or execution attempt, not used as the only project record.

Conflating these graphs would make a user decision look like a paused stack frame, or make a model's retry look like a new project waypoint.

## Existing RPIV Boundary

RPIV already owns most of the portable workflow layer:

- Canonical Markdown skills under `skills/*/SKILL.md`.
- Markdown subagent definitions under `agents/*.md`.
- Claude lifecycle integration in `hooks/hooks.json`.
- OpenCode translation and generated skills in `opencode/adapter.mjs:210-324`.
- OpenCode host events in `opencode/plugin.ts:177-312`.
- Artifact validation in `skills/_shared/validate-artifact.mjs`.
- Evidence and finding storage in `skills/_shared/store.mjs:244-317`.
- Session compaction support in `.claude/hooks/session-state-preserve.mjs:1-66`.

RPIV currently delegates model inference, the tool loop, native tool execution, session transport, subagent scheduling, approval UI, and the actual context window to Claude Code or OpenCode. A custom harness can therefore begin as another host adapter rather than a rewrite of RPIV.

## Coding Runtime Options

### Option 1: OpenCode Server and SDK

**Best for:** proving the custom workbench quickly while retaining provider choice and mature coding tools.

OpenCode can run as a headless local server. It exposes an OpenAPI interface, a TypeScript SDK, session operations, and an SSE event stream. It already includes file, shell, search, LSP, skill, question, todo, and subagent tools. It also supports MCP, plugins, many model providers, and granular allow/ask/deny permissions.

This matches RPIV's current adapter and plugin work, so the first workbench can replace OpenCode's terminal UI without replacing its runtime.

**Advantages:**

- The shortest route to a custom GUI.
- Existing RPIV OpenCode adapter and tests are reusable.
- Provider-neutral relative to Claude/Codex SDKs.
- Native sessions, subagents, skills, MCP, permissions, and streamed events.
- MIT licensed.

**Costs and risks:**

- The harness depends on OpenCode's API and event model.
- OpenCode is fast-moving; an adapter contract and compatibility tests are needed.
- The custom product still needs workspace trust, sandbox policy, credentials, project state, and its own domain graph.

**Sources:** [SDK](https://opencode.ai/docs/sdk/), [server](https://opencode.ai/docs/server/), [plugins](https://opencode.ai/docs/plugins/), [skills](https://opencode.ai/docs/skills/), [permissions](https://opencode.ai/docs/permissions/).

### Option 2: Pi Coding Agent SDK

**Best for:** a deeply customized, provider-flexible coding loop with a custom desktop or web UI.

Pi explicitly supports embedding its coding agent in custom web, desktop, and mobile interfaces. Its SDK supplies built-in read/write/edit/bash tools, streaming session events, JSONL session persistence, forks, a branching conversation tree, and a `ResourceLoader` for skills, prompts, themes, extensions, and context files.

Pi deliberately omits native MCP, subagents, permissions, and sandboxing. Those omissions are an advantage when the goal is to own every part of the runtime, but they are meaningful product work.

**Advantages:**

- Small, understandable, highly extensible TypeScript core.
- Strong session and resource-loading model.
- Broad provider support.
- Designed for custom UIs.
- MIT licensed.

**Costs and risks:**

- The harness must build or integrate approval policy and real process isolation.
- MCP and subagent orchestration are extension work.
- More runtime behavior must be verified and maintained than with OpenCode.

**Sources:** [Pi repository](https://github.com/earendil-works/pi), [SDK documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), [skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md), [packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

### Option 3: Claude Agent SDK or OpenAI Codex SDK

**Best for:** a product committed to one model vendor's coding runtime.

Both SDKs can power a separately branded custom interface and already provide coding tools, streamed events, resumable sessions, skills, MCP, subagents, and approval mechanisms. Codex has a particularly strong documented local sandbox model. Claude Agent SDK closely exposes Claude Code behavior and hooks.

**Advantages:**

- Less coding-agent runtime work than a raw model SDK.
- Native integration with each vendor's strongest coding features.
- Mature sessions, tool loops, and subagent patterns.

**Costs and risks:**

- Strong model-provider and commercial-term coupling.
- Provider portability becomes an expensive later rewrite.
- Extension models are less neutral than a project-owned runtime interface.

**Sources:** [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview), [Claude permissions](https://docs.claude.com/en/api/agent-sdk/permissions), [Codex SDK](https://developers.openai.com/codex/sdk/), [Codex security](https://developers.openai.com/codex/agent-approvals-security/).

### Option 4: Raw Model or Agent SDK

OpenAI's raw `openai` SDK and Responses API provide model calls, function calling, structured outputs, streaming, conversation chaining, compaction, hosted tools, and remote MCP. They do not provide a safe local coding harness. The application must build the tool loop, repository tools, sandbox, approvals, context policy, sessions, subagent governance, and audit trail.

The higher-level OpenAI Agents SDK runs the agent loop and adds sessions, handoffs, approvals, and tracing. Vercel AI SDK offers a provider-neutral `ToolLoopAgent`, typed tools, streaming UI primitives, approvals, MCP conversion, and context-preparation hooks. Neither turns local command execution into a safe sandbox.

**Recommendation:** do not begin here. A raw runtime is justified only after the product proves that OpenCode or Pi's loop prevents a critical behavior. Replacing a working coding runtime before proving the waypoint model spends effort on the least distinctive part of the idea.

**Sources:** [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [OpenAI Agents](https://developers.openai.com/api/docs/guides/agents), [Vercel AI SDK agents](https://ai-sdk.dev/docs/agents/overview), [Vercel tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

## Orchestration Options

### Custom SQLite Project Graph

This should own the project's durable state. An append-only event log can record facts such as `waypoint_created`, `dependency_added`, `decision_recorded`, `execution_requested`, `execution_completed`, and `waypoint_superseded`. Transactional projections provide the current map, runnable work, decision history, and UI views.

SQLite is local-first, portable, inspectable, and sufficient for a single-user workbench. Its main cost is that retry policy, leases, attempts, scheduling, and idempotency must be designed rather than inherited from a workflow engine.

### LangGraph.js

LangGraph supports agent execution graphs, checkpoints, interrupts, retries, parallel branches, dynamic fan-out with `Send`, state history, and streaming. It is a good optional executor for one waypoint.

It is not the correct canonical store for the mutable project map. A LangGraph definition is primarily a computation graph; its checkpoints restore execution rather than explain the full domain history of a project decision.

**Sources:** [overview](https://docs.langchain.com/oss/javascript/langgraph/overview), [Graph API](https://docs.langchain.com/oss/javascript/langgraph/use-graph-api), [durable execution](https://docs.langchain.com/oss/javascript/langgraph/durable-execution), [interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts).

### XState v5

XState is useful for client and control-plane behavior: selection, editing, approval dialogs, local worker state, reconnecting, and explicit UI transitions. Its actor snapshots can be persisted, but snapshots are not a decision audit trail. It should reflect the project graph rather than replace it.

**Sources:** [actors](https://stately.ai/docs/actors), [persistence](https://stately.ai/docs/persistence), [inspection](https://stately.ai/docs/inspection).

### Temporal and Hosted Runtimes

Temporal is excellent when jobs must survive process failure, execute across workers, retry reliably, and wait days for external input. Cloudflare Agents and Workflows are strong for hosted real-time state, WebSockets, schedules, retries, and durable approval waits. LangSmith can host LangGraph agents.

All are premature for a local single-user prototype. They cannot safely operate directly on a developer's live checkout without a separate authenticated local runner. Add hosted durability only when remote execution, collaboration, schedules, or offline continuation become real requirements.

**Sources:** [Temporal workflow execution](https://docs.temporal.io/workflow-execution), [Cloudflare Agents](https://developers.cloudflare.com/agents/), [Cloudflare Workflows](https://developers.cloudflare.com/workflows/), [LangSmith deployment](https://docs.langchain.com/langsmith/deployment).

## Visual Workbench

### Recommended Stack

- **Tauri 2** for a local desktop shell with narrow, explicit filesystem and command capabilities.
- **React Flow** for editable waypoint nodes, edges, groups, minimap, keyboard navigation, and rich React-based details.
- **ELK.js** in a Web Worker for hierarchical and nested automatic layout.
- A normal list/tree view alongside the map for accessibility, search, bulk operations, and large projects.

Persist user positions. Automatic layout should be an explicit "arrange" operation, not something that moves the world after every edit.

### Alternatives

- **Cytoscape.js:** better for very large and graph-theory-heavy views, weaker for rich HTML waypoint cards and accessibility.
- **tldraw:** strongest freeform world-map feel, but not graph-first and its production SDK license is not permissive.
- **Electron:** viable and mature, but its renderer-to-Node boundary needs stricter IPC discipline than Tauri's capability model.

**Sources:** [React Flow](https://reactflow.dev/), [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility), [ELK.js](https://github.com/kieler/elkjs), [Cytoscape.js](https://js.cytoscape.org/), [tldraw SDK](https://tldraw.dev/), [Tauri capabilities](https://tauri.app/security/capabilities/), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).

## Skills and File-Aware Tools

### Canonical Skills

Use the open Agent Skills directory format as the canonical source:

- Required `SKILL.md` with stable name and description.
- Optional `scripts/`, `references/`, and `assets/`.
- Catalog only names and descriptions at startup.
- Load the full skill only when activated.
- Load supporting files only when the active skill reaches them.

RPIV's existing adapter pattern is the right general direction: canonical skill content stays host-neutral while small adapters translate tool names, paths, permissions, and host-specific metadata.

**Sources:** [Agent Skills specification](https://agentskills.io/specification), [client implementation guide](https://github.com/agentskills/agentskills/blob/main/docs/client-implementation/adding-skills-support.mdx).

### Capability Broker

Do not eagerly add every CLI or MCP tool to every model prompt. Build one project capability registry with entries such as:

- Capability ID and version.
- Eligibility signals: file globs, language IDs, config files, package dependencies, and installed binaries.
- Activation signals: user intent, active skill, changed files, or explicit command.
- Scope rules and cost class.
- Read/write/network permissions.
- Command adapter and bounded output parser.
- Report storage and model-facing summary format.

A `.ts` file can make TypeScript guidance eligible without immediately running dependency-cruiser. An architecture question can activate dependency-cruiser with `includeOnly` or `focus`. A duplication review can activate jscpd on changed directories and save the full report to disk while giving the model a bounded summary.

This follows the useful part of LSP and VS Code activation: detect relevance early, pay startup and context cost only when needed.

MCP should be used when a capability is remote, shared, or naturally protocol-based. A local project CLI is usually cheaper and safer as a direct adapter behind the capability broker.

**Sources:** [VS Code activation events](https://code.visualstudio.com/api/references/activation-events), [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18), [jscpd configuration](https://jscpd.dev/getting-started/configuration), [dependency-cruiser options](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md).

## Replacing the Fixed Pipeline

The current Discover -> Research -> Design/Blueprint -> Plan -> Implement -> Validate -> Review sequence encodes one useful route, but it should not be the domain model.

Replace stages with **capabilities** that can act on a waypoint:

- Clarify intent.
- Gather evidence.
- Explore options.
- Record a decision.
- Define a test contract.
- Implement a change.
- Validate evidence.
- Review a change or decision.
- Split, merge, block, reopen, or supersede waypoints.

The harness can recommend a route based on waypoint state, risk, and evidence. It should not force every waypoint through every capability. A small bug may move directly from evidence to implementation and validation. A large architectural question may branch into several research waypoints before any implementation exists. A review finding can reopen an earlier decision without pretending the project has gone "backward" in a pipeline.

RPIV workflows can initially remain intact behind these capability actions. The first redesign should change orchestration and state, not rewrite every skill at once.

## Removing Code Triplication

Design, plan, and implementation should not each carry a complete copy of proposed code.

Recommended ownership:

- **Project graph:** intent, decisions, dependencies, status, and provenance.
- **Research evidence:** factual findings with source and file references.
- **Design record:** interfaces, invariants, seams, and decisions; only minimal signatures or examples when they prove a decision.
- **Execution plan:** ordered work, test contracts, success criteria, and references to design IDs; no full implementation copy.
- **Repository:** the only authoritative implementation code.
- **Execution attempt:** logs, diffs, tool reports, approvals, and resulting commit/worktree reference.

Use stable waypoint, decision, slice, and test-contract IDs to link these records. Use source revision plus file/symbol references and fingerprints to detect stale evidence. Render rich documents as views over the same records instead of generating separate documents that repeat the same content.

## Suggested First Build

### Phase 0: Prove the Product Model

Build a throwaway interactive map with fake agent runs. Test whether waypoints, decisions, dependencies, reopening, splitting, and navigation feel useful. Do not start by writing a model loop.

### Phase 1: Local Project Kernel

Create the SQLite event log, projections, project IDs, waypoint state model, and an event stream. Make the map fully usable without an AI agent.

### Phase 2: OpenCode Runtime Adapter

Run OpenCode locally, connect through its SDK/server, map sessions and tool events to execution attempts, and surface approvals in the workbench. Keep an internal runtime interface so Pi can be added later.

### Phase 3: Skill and Capability Registry

Index RPIV and Matt skills using Agent Skills metadata. Add project trust. Implement capability detection and one bounded analyzer broker. Start with jscpd and dependency-cruiser because they exercise file eligibility, command execution, report storage, and model summaries.

### Phase 4: Non-Linear RPIV Actions

Expose selected RPIV workflows as waypoint actions. Begin with research, decision recording, implementation, and validation. Link generated artifacts to the graph, then progressively replace repeated document content with shared IDs and projections.

### Phase 5: Runtime Experiments

Only after the product model works, implement a Pi adapter and compare it with OpenCode using the same projects and evaluations. Build a custom model loop only if both runtimes prevent a measured requirement.

## Main Trade-Offs

| Choice | Gains | Gives up |
|---|---|---|
| OpenCode first | Fastest path, complete coding runtime, current RPIV fit | Runtime dependency and API churn |
| Pi first | Maximum loop control and provider flexibility | More security, MCP, subagent, and product work |
| Raw SDK first | Total ownership | Slowest route and highest safety burden |
| SQLite domain graph | Local-first clarity and durable semantic history | Custom scheduler, migrations, and projections |
| LangGraph as executor | Checkpoints, interrupts, agent fan-out | Another framework and execution/domain mapping |
| Tauri + React Flow | Polished local graph and narrow system access | Rust bridge and OS WebView differences |
| Fixed pipeline | Simple prompting and predictable artifacts | Poor fit for iteration, branching, and reopening |
| Capability actions | Flexible real development flow | Requires a precise state model and routing rules |

## Risks to Resolve During Grilling

- Is this a personal local tool, an open-source distribution, or a future multi-user product?
- Must the workbench support several model providers from day one?
- Does a waypoint represent a question, a decision, a deliverable, or a general work item? One overloaded entity could make the map incoherent.
- Which relationships block execution, and which are merely informational?
- What facts must remain auditable after artifacts, branches, or sessions are deleted?
- What commands may run automatically, which require approval, and what must run in a sandbox?
- Are Matt Pocock's skills licensed for the intended redistribution model?
- What is the smallest proof that the map improves real development rather than becoming a decorative project manager?

## Recommendation

Prototype the waypoint domain and visual interaction before choosing a permanent agent framework. Use OpenCode as a replaceable runtime adapter for the first integrated version, because RPIV already targets it and its server API fits a custom GUI. Keep the project graph, skills, capability registry, and runtime interface under project ownership. Add Pi as the second adapter when there is a working benchmark. Treat LangGraph, Temporal, and Cloudflare as optional execution infrastructure, not as the product's core data model.

The distinctive value is not another model loop. It is a coding environment that makes intent, decisions, evidence, and progress visible and navigable while agents do the mechanical work underneath.
