---
date: 2026-08-25T14:22:52+0100
author: Pedro Mesquita
commit: acf9c8b
branch: main
repository: slopstop
topic: "Production boundaries for Conversation, Frame, Review, Context, and Memory projections"
tags: [research, codebase, workspace, conversation, frame, context, memory, protocol]
status: complete
parent: .rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md
last_updated: 2026-08-25T14:53:19+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Updated references after recording context ownership in the domain glossary"
content_hash: 47b8f8b0c3e0c7c6282a78c181e58a3fc62c2c4638bda89d35b99d84b2fbcbec
---

# Research: Production Boundaries for Conversation, Frame, Review, Context, and Memory Projections

## Research Question

Given the accepted workspace interaction contract and settled canonical-state rules, what current code, authority boundaries, missing producer contracts, integration seams, and ordering constraints must a production design and phased plan account for when implementing Conversation, Frame, Review, Context proposals and records, and Memory-library projections without granting canonical authority to the renderer, Conversation, or fixture state?

## Summary

The live product has one narrow end-to-end production spine: a versioned handshake in `packages/protocol`, a transport-independent harness runtime, an Electron utility-process supervisor, a validated preload bridge, and a truthful renderer that reports only harness health. It has no production contracts or producers for Project projections, Conversation, Frame drafts, model attempts, Context records, Execution, Evidence, Candidate deltas, or Verified Memory.

The accepted prototype correctly demonstrates the intended interaction sequence, but its types, records, transitions, eligibility checks, and generated responses are fixture-backed React state. They are Evidence for public interaction and presentation distinctions, not process schemas or ownership precedents.

Production must preserve three separate graphs. Conversation owns direct dialogue, branch history, and the exact Context record associated with each direct response. Execution performs the provider call but does not own the conversation record. Frame draft history owns recoverable pre-acceptance annotations and proposed diffs; natural Decision checkpoints cross a typed-command seam to create immutable Accepted revisions. Final Frame acceptance creates or revises the canonical Project map. Verified Memory remains separately governed, with untrusted proposals accepted only through its Evidence and policy boundary.

The minimum desktop shape is the existing one repeated by capability: versioned schemas at the harness process boundary, application-owned producers behind harness ports, a main-process projection proxy, a narrow preload interface that revalidates untrusted values, and a renderer that only displays projections and submits explicit intentions. Physical persistence, writer transport, repository/Git producers, model-provider execution, Evidence acceptance, and Verified Memory production remain separate native dependency edges. Their missing payloads must be named, not guessed.

Issue #45 blocks final production-renderer implementation, but not logical design or non-visual foundation slices. Issues #36, #41, and #40 respectively govern the Board index, physical persistence layout, and migration/backup semantics; they are related ordering dependencies rather than reasons to merge their concerns into this design.

## Detailed Findings

### Existing Production Spine

- `DesktopMessageSchema` currently accepts only `system.handshake`; `HarnessMessageSchema` accepts only `system.ready` and `system.failure` (`packages/protocol/src/protocol.ts:17-73`).
- Protocol parsing distinguishes an incompatible version from a structurally invalid envelope, but it has no domain command dispatcher (`packages/protocol/src/protocol.ts:153-195`).
- `startHarnessRuntime()` validates a desktop message and returns failure or ready; every valid command is currently the handshake (`apps/harness/src/harness-runtime.ts:33-58`).
- `HarnessTransport` is already a useful internal seam because runtime behavior depends on `send` and `subscribe`, not Electron (`apps/harness/src/harness-runtime.ts:9-12`).
- `process-entry.ts` adapts Electron's `UtilityMessagePort`, validates the bootstrap, and starts the runtime, but it does not instantiate the application coordinator, Project writer, model runtime, repository tools, Execution producers, Evidence authority, or Memory producer (`apps/harness/src/process-entry.ts:43-98`).
- `HarnessSupervisor` owns process health, timeout, retry, restart, and bootstrap transport. It does not own the Execution graph merely because it transports harness messages (`apps/desktop/src/main/harness-supervisor.ts:103-199`, `apps/desktop/src/main/harness-supervisor.ts:201-267`).
- Main validates status before IPC delivery, preload validates every received value again, and the renderer receives only three explicit operations (`apps/desktop/src/main/main.ts:18-32`, `apps/desktop/src/preload/preload.ts:5-25`, `apps/desktop/src/shared/desktop-api.ts:3-13`).
- The normal BrowserWindow retains context isolation, disabled Node integration, sandboxing, web security, restricted navigation, denied popups, and a narrow preload (`apps/desktop/src/main/main.ts:34-63`, `apps/desktop/src/main/security.ts:21-43`).

### Authority Map for Accepted Interactions

| Accepted interaction | Owning boundary | Durable record or projection family | Current implementation status |
|---|---|---|---|
| Primary Project conversation and scoped Waypoint conversations | Conversation graph | Conversation identity, scope link, turn history | Fixture-only branches and messages (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:81-97`) |
| Freely nested branch navigation | Conversation graph | Parent branch and exact source-message relationship | `depth` and `pathLabel` are presentation-only fixtures (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:345-395`) |
| Reviewed include/exclude influence before a revision | Conversation selection feeding Frame draft history | Inspectable selection and the draft revision it may influence | Local included-ID array only (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1329-1397`) |
| Direct message and response | Conversation graph; Execution performs the provider effect | User turn, model turn, attempt link, settled response | Static local response appended by React (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1952-1979`) |
| Context proposal before a direct response | Conversation graph | Correctable pre-attempt projection | Derived from local fixture IDs (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1166-1169`, `apps/desktop/src/renderer/prototype/prototype-app.tsx:1329-1383`) |
| Exact immutable Context record after a direct response | Conversation graph | Immutable record linked to the exact response and provider attempt | Only the latest local record exists (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1952-1958`) |
| Explicit source attachment | Conversation selection; repository/source producer remains external | Visible selection before attempt and exact delivered source in the Context record | Only a file name is stored locally (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1945-1950`) |
| Shared-understanding summary, stories, predictions, and optional walkthrough | Frame draft history | Revisable draft material with provenance to conversation turns | Static Review content and local state (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1402-1492`) |
| Decision Canvas following Conversation | Frame draft projection plus canonical Accepted revisions | Draft decision state; immutable Accepted revision after checkpoint | Presentation-only counts and labels (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1220-1245`) |
| Natural Decision checkpoint | Application coordinator through Project writer | Typed command, transition, Accepted revision, canonical event, command receipt | No command or producer exists (`CONTEXT.md:94-105`, `docs/adr/0002-project-canonical-state.md:13-16`) |
| Central Review annotations and proposed diffs | Frame draft history | Recoverable annotation and proposed-diff history | Review opens from React state and records neither (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1402-1492`) |
| Final Traceable Mirror | Frame Review projection over draft and accepted links | Derived coverage projection; accepted links become canonical only through commands | Static illustrative rows (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1460-1477`) |
| Final Frame acceptance and generated map | Application coordinator through Project writer | Atomic validated canonical revisions and resulting State projection | A boolean and navigation changes only (`apps/desktop/src/renderer/prototype/prototype-app.tsx:1927-1932`) |
| Recoverable Conversation and Review after acceptance | Conversation graph plus Frame revision history | Immutable prior records and links to superseding revisions | Only mounted component state exists |
| Memory library | Verified Memory boundary | Memory Topic, immutable Memory Revision, status and provenance projection | Local fixtures only (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:442-464`) |
| Memory Proposal review only in the library | Verified Memory proposal boundary; Evidence and policy gate acceptance | Untrusted proposal followed by accepted/rejected result | A fixture status only; no producer or acceptance seam exists |
| Attention-first entry | Board/projection boundary, not Conversation | Human-action projection from authoritative source events | Mixed local fixture cards with no trustworthy producer (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:134-161`) |
| Right-panel, navigator, tabs, resizing, and narrow overlay | Desktop presentation state | Local preference and ephemeral selection state | Valid prototype behavior; no canonical ownership required |

### Separate Graphs and Cross-Graph Links

- Project, Execution, and Conversation are separate graphs; linking a Run or Conversation scope to a Waypoint does not copy authority into that graph (`CONTEXT.md:174-180`).
- A direct Conversation turn can request a provider effect from Execution, but the settled response and direct-response Context record remain Conversation records. Execution may expose its runtime outcome without becoming the conversation history owner.
- Workers require the same provenance rule as direct dialogue, but not the same producer contract. A future Execution-owned Worker-attempt Context record must remain separate from the Conversation-owned direct-response record.
- Frame drafts are recoverable but non-canonical. Only explicit typed commands at natural checkpoints create Accepted revisions. Later correction creates a superseding revision rather than rewriting accepted history (`CONTEXT.md:67-69`, `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:312-315`, `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:378-381`).
- Memory Proposals are untrusted candidates. They do not become Verified Memory merely because Conversation, Frame, or a Worker mentions them (`CONTEXT.md:115-120`).
- State projections do not own or mutate the state they display. The renderer can submit explicit intentions but cannot settle Conversation, Frame, Evidence, Integration, or Memory itself (`CONTEXT.md:138`).

### Prototype-Only Shapes and False Authority Risks

- `ProjectFixture` mixes apparent canonical identity, repository observation, Attention aggregates, and active Execution counts in one display type (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:14-21`).
- `AttentionFixture` compresses decision, failure/recovery, Candidate delta, Validation, and Integration-review concerns into one local card type (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:23-31`, `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:134-161`).
- `WaypointFixture` combines apparent canonical content, an Execution link, and personal map coordinates. Its visual relationship names also do not establish domain contracts (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:33-44`, `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:214-247`).
- `RunFixture` provides only `active | review` and `provisional | candidate`, then presents free-form progress, elapsed time, budget, and Worker strings without producers or provenance (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:67-79`, `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:316-343`).
- `ConversationBranchFixture` has no exact source message, parent relationship, revision influence manifest, or immutable conversation identity (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:91-97`).
- `ContextItemFixture` mixes canonical scope, accepted decisions, Conversation branches, Memory, repository source, and UI defaults; it is not a Prompt packet or process schema (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:99-105`, `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:397-440`).
- `MemoryFixture` collapses proposal, accepted, and stale states into a display record without Memory Revision identity, Evidence dependencies, invalidation, or acceptance authority (`apps/desktop/src/renderer/prototype/prototype-fixtures.ts:107-113`, `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:442-464`).
- `ChangesSurface()` permits `Request changes` for a provisional delta and reveals `Approve integration` solely from a fixture boolean. Production must instead derive action eligibility from closed Candidate delta, accepted current Evidence, and Integration-review state (`apps/desktop/src/renderer/prototype/prototype-app.tsx:664-686`, `CONTEXT.md:78-89`).

### Missing Producer Contract Families

The following contract families are absent. Research can name their responsibilities, but the #47 design must not invent their payloads before their owning programs settle them.

- **Canonical command/result producer:** validates authority, expected revisions, writer generation, idempotency, and transition invariants; emits immutable revisions, canonical events, and command receipts (`CONTEXT.md:94-105`, `docs/adr/0002-project-canonical-state.md:13-16`).
- **Conversation producer:** owns Project/Waypoint conversation identities, nested branch history, turns, reviewed branch influence, direct-response Context proposals, and immutable direct-response Context records.
- **Frame draft producer:** owns recoverable non-canonical understanding, plan, annotation, proposed-diff, and Traceable Mirror draft history before command acceptance.
- **Model-attempt Execution producer:** performs provider calls and returns bounded runtime outcomes to the owning Conversation or Worker flow without declaring canonical success.
- **Worker/Run Execution producer:** owns Run plan, Worker dispatch, Process jobs, progress, budgets, control requests, outputs, recovery, and Worker-attempt context provenance.
- **Repository/Git delta producer:** owns controlled workspace observations, fingerprints, Worker deltas, closed Candidate deltas, target applicability, and material Integration effects.
- **Evidence producer and authority:** records attributed observations, independent Validation and Findings, then separately accepts or rejects Evidence against exact revisions and contracts.
- **Integration-review producer:** performs fresh, independent, read-only scope and applicability review before user approval can be offered.
- **Verified Memory producer:** owns Topics, immutable Memory Revisions, proposal provenance, Evidence dependencies, accepted/stale/broken distinctions, and re-verification/invalidation outcomes.
- **Board projection producer:** owns ordered human-action entry identity and references without absorbing Conversation content or Execution event production; its logical boundary belongs to issue #36.

### Minimum Process and Projection Seams

- Process-boundary schemas remain versioned and Zod-owned by `packages/protocol`; TypeScript types are inferred from schemas (`packages/protocol/src/protocol.ts:17-73`, `packages/protocol/src/protocol.ts:190-208`).
- Product behavior and transition invariants remain framework-independent in `packages/kernel`; process adapters and framework runtimes remain in `apps/harness` (`docs/adr/0001-repository-foundation.md:24-31`).
- Harness application producers need their own internal interfaces. `HarnessTransport` remains transport plumbing rather than becoming a domain interface (`apps/harness/src/harness-runtime.ts:9-12`).
- Main may proxy validated queries, subscriptions, and explicit commands, but `HarnessSupervisor` remains a health/lifecycle adapter rather than an Execution owner (`apps/desktop/src/main/harness-supervisor.ts:20-25`, `apps/desktop/src/main/harness-supervisor.ts:103-199`).
- The desktop-local preload interface may compose protocol types into browser-safe operations, but it must not expose raw IPC, generic invoke/send, Node capabilities, repository paths, or harness source (`apps/desktop/src/shared/desktop-api.ts:3-13`, `apps/desktop/src/preload/preload.ts:5-25`).
- The renderer consumes projections and result envelopes through `window.slopstop`; it does not import Electron, Node, harness code, repositories, persistence adapters, or provider SDKs (`apps/desktop/src/renderer/window.d.ts:1-6`, `apps/desktop/tests/e2e/shell.test.ts:40-60`).
- Prototype and production bundles remain separate while fixture-backed review continues. Real data replaces fixtures only through the normal validated harness-main-preload-renderer path (`apps/desktop/forge.config.ts:33-42`, `apps/desktop/vite.prototype.config.ts:5-10`).

### Test and Verification Surfaces

- Protocol tests currently prove strict handshake schemas, version mismatch, and unknown-command rejection (`packages/protocol/src/protocol.test.ts:47-60`).
- Harness runtime tests currently prove only valid handshake response and invalid-envelope failure (`apps/harness/src/harness-runtime.test.ts:45-68`).
- The normal Electron journey is the strongest existing end-to-end seam: it launches the packaged shell, reaches real harness-ready state, proves Node globals are absent, and checks the exact preload allowlist (`apps/desktop/tests/e2e/shell.test.ts:40-84`).
- Prototype React tests prove public fixture-backed navigation and accessibility behavior, not production authority or producer correctness (`apps/desktop/src/renderer/prototype/prototype-app.test.tsx:6-147`).
- Prototype Electron tests prove isolation, responsive layout, and absence of preload, not domain integration (`apps/desktop/tests/e2e/shell.test.ts:87-188`).
- Production slices need behavior tests at the public owner interface, protocol parse/dispatch contracts, harness adapter integration tests, preload projection tests, and final real-Electron journeys. UI tests must not inject the same eligibility boolean that they later assert.
- Broken, stale, unavailable, rejected, and incomplete producer states must stay distinct. A missing producer cannot degrade to a clean projection (`.rpiv/decisions/degrade-distinguishes-broken.md`).
- Packaging and cross-platform checks are part of the desktop contract because the foundation required immediate follow-up fixes for path assumptions and packaged sandbox behavior.

### Ordering Dependencies

- **Issue #45:** architecture and non-visual foundation work can be designed now; the final renderer implementation phase remains blocked until explicit structural and visual acceptance.
- **Issue #36:** defines the canonical Board index. It is required before an Attention/activity implementation can claim durable ordered-entry semantics, but it does not own Conversation content.
- **Issue #41:** defines physical tables, keys, aggregate layout, registry, and storage manifests. Logical owner interfaces can precede it; durable persistence adapters cannot.
- **Issue #40:** defines migration, backup, restore, import, deletion, and safe-mode semantics. It follows accepted physical storage contracts and blocks shipping persistence, not logical workspace design.
- **Issue #43 evidence:** the Windows packaged writer-lease probe supports a future Project-writer native transport decision. It does not add a production writer, ACL/DACL policy, persistence adapter, or workspace producer to the current spine.

## Code References

- `packages/protocol/src/protocol.ts:17-73` — Complete current Desktop/Harness message vocabulary.
- `packages/protocol/src/protocol.ts:153-208` — Boundary parsing, version mismatch, and typed parse results.
- `apps/harness/src/harness-runtime.ts:9-58` — Transport seam and handshake-only runtime behavior.
- `apps/harness/src/process-entry.ts:43-98` — Electron MessagePort adapter and process bootstrap.
- `apps/desktop/src/main/harness-supervisor.ts:103-199` — Message handling, health-state ownership, retry, and lifecycle publication.
- `apps/desktop/src/main/harness-supervisor.ts:201-267` — Utility-process creation and port transfer.
- `apps/desktop/src/main/main.ts:18-63` — Validated status IPC and secure normal BrowserWindow.
- `apps/desktop/src/main/main.ts:68-132` — Isolated prototype window and harness bypass.
- `apps/desktop/src/main/security.ts:21-43` — Permission denial, CSP, navigation, and popup rules.
- `apps/desktop/src/shared/desktop-api.ts:3-13` — Current narrow renderer interface.
- `apps/desktop/src/preload/preload.ts:5-25` — Preload revalidation and contextBridge exposure.
- `apps/desktop/src/renderer/app.tsx:64-132` — Truthful production renderer consumption of harness health.
- `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:1-113` — Illustrative fixture types that mix several owners.
- `apps/desktop/src/renderer/prototype/prototype-fixtures.ts:115-483` — Fixture-only Project, Attention, Run, Conversation, Context, and Memory examples.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:583-737` — Fixture-backed Run and Changes surfaces.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:1135-1492` — Conversation, Context, and Review interactions.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:1782-1816` — Local React state that simulates records and authority.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:1927-1979` — Local Frame acceptance, attachments, Context record, and generated response.
- `apps/desktop/src/renderer/prototype/prototype-app.test.tsx:6-147` — Public prototype interaction tests.
- `apps/desktop/tests/e2e/shell.test.ts:40-84` — Real normal-shell security and harness journey.
- `apps/desktop/tests/e2e/shell.test.ts:87-188` — Isolated prototype Electron journey.
- `CONTEXT.md:26-38` — Project writer and canonical transition ownership.
- `CONTEXT.md:48-120` — Waypoint, Run, Evidence, Conversation, and Memory vocabulary.
- `CONTEXT.md:129-154` — Delta, Integration, projection, Prompt packet, and Context record distinctions.
- `CONTEXT.md:170-180` — Status-family and graph-separation constraints.
- `docs/adr/0001-repository-foundation.md:24-31` — Package and application ownership boundaries.
- `docs/adr/0001-repository-foundation.md:44-50` — Electron security boundary.
- `docs/adr/0002-project-canonical-state.md:13-16` — Atomic canonical command settlement.

## Integration Points

### Inbound References

- `apps/desktop/src/main/harness-supervisor.ts:238-267` — Desktop initiates the only current process command, the handshake.
- `apps/desktop/src/main/main.ts:27-32` — Renderer intentions currently enter main through two explicit IPC handlers.
- `apps/desktop/src/preload/preload.ts:5-25` — Browser calls and subscriptions enter the trusted desktop boundary through a fixed allowlist.
- `apps/desktop/src/renderer/app.tsx:64-102` — Production React consumes only the preload interface.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:1782-1816` — Prototype behavior enters local fixture state directly and must not be reused as production wiring.

### Outbound Dependencies

- `apps/harness/src/process-entry.ts:43-58` — Harness runtime depends outward on a MessagePort adapter only.
- `apps/desktop/src/main/harness-supervisor.ts:201-237` — Desktop depends on Electron UtilityProcess lifecycle for the harness process.
- `apps/desktop/src/main/main.ts:18-25` — Main publishes only schema-validated status to renderer windows.
- `apps/desktop/src/preload/preload.ts:5-21` — Preload depends on IPC invoke/event channels and protocol validation before exposing data.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:29-46` — Prototype depends directly on fixtures, proving its intentional isolation from production producers.

### Infrastructure Wiring

- `apps/desktop/src/main/main.ts:104-132` — Selects normal versus prototype bootstrap and controls whether the harness starts.
- `apps/desktop/forge.config.ts:33-53` — Registers separate renderer entries and restrictive Electron fuses.
- `apps/desktop/vite.prototype.config.ts:5-10` — Builds the prototype from a separate root and output.
- `apps/desktop/src/renderer/window.d.ts:1-6` — Declares the only browser-visible desktop capability.
- `apps/desktop/tests/e2e/shell.test.ts:40-60` — Runtime proof that the allowlist and Node isolation match the declaration.

## Architecture Insights

- The foundation is a deep-module precedent: a small validated interface hides process spawning, timeout, restart, sequence, and failure handling. New product capabilities should deepen owner modules, not widen the renderer bridge into generic IPC.
- Bootstrap transport and product dispatch are different seams. Adding domain branches to `HarnessSupervisor.#handleHarnessMessage()` would turn a lifecycle adapter into a shallow application coordinator.
- Direct-response Context records belong to Conversation because they explain an exact conversational response. Worker attempt records follow the same provenance invariant under a separate Execution owner and future contract.
- Frame draft history is durable enough to recover Review work but remains non-canonical. Natural Decision checkpoints are the explicit transition seam from draft material to Accepted revisions.
- A projection can combine links from several owners for presentation, but each field needs one authoritative producer and an explicit freshness or failure state.
- Prototype types should be replaced by producer-owned schemas or desktop-specific view projections, not promoted wholesale into `packages/kernel` or `packages/protocol`.
- The final renderer slice is deliberately conditional on #45. This keeps visual acceptance independent from protocol and owner design rather than freezing fixture layout into a process contract.

## Precedents & Lessons

Two similar past changes or current patterns were analyzed.

### Precedent: Foundation protocol, harness, secure desktop bridge, and truthful renderer

**Commit(s)**: `1789aad` — "feat: establish the SlopStop foundation" (2026-08-20)

**Blast radius**: 47 files across four layers.

- `packages/protocol/` — strict versioned handshake and event schemas.
- `apps/harness/` — transport-independent validation and typed failures.
- `apps/desktop/src/main/` and `apps/desktop/src/preload/` — narrow IPC, validation, process supervision, and sandboxed window.
- `apps/desktop/src/renderer/` — truthful rendering of real harness state only.

**Follow-up fixes**:

- `1b0a875` — "fix(ci): make path assertions cross-platform" (2026-08-20) — corrected platform-specific path assumptions.
- `cb4a683` — "fix(ci): configure packaged Electron sandbox" (2026-08-20) — corrected packaged sandbox configuration.

**Takeaway**: preserve the narrow validated trust chain, and include packaged Windows proof rather than treating unit tests as enough.

### Precedent: Isolated fixture-backed workspace prototype

**Commit(s)**: no commit in current history contains the uncommitted prototype files.

**Blast radius**: isolated prototype renderer, dedicated BrowserWindow path, separate Vite entry, local typed fixtures, React behavior tests, and an Electron prototype journey.

**Follow-up fixes**: none in committed history.

**Takeaway**: use the prototype as accepted interaction Evidence and a list of state distinctions, never as a producer schema or authority model.

### Composite Lessons

- `1789aad` shows that each trust boundary should parse rather than trust values already parsed upstream.
- `1b0a875` and `cb4a683` show that Windows paths and packaged sandbox behavior need explicit terminal-phase verification.
- The isolated prototype shows that a visually complete state can remain intentionally false as a production model; design must preserve that honesty until each producer exists.

## Historical Context (from `.rpiv/artifacts/`)

- `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md` — binding workspace interaction contract.
- `.rpiv/artifacts/solutions/2026-08-22_22-52-33_end-state-comprehension-strategies.md` — compared end-state comprehension strategies.
- `.rpiv/artifacts/research/2026-08-22_workspace-ux-patterns.md` — external workspace UX research.
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md` — program ownership and requirement coverage map.
- `.rpiv/artifacts/research/2026-08-25_packaged-writer-lease-probe-report.json` — packaged Windows writer-lease Evidence.

## Developer Context

**Q (discover: Workspace priority): In a real session, what is the first problem the whole workspace must solve?**  
A: Attention first; Run supervision and Project understanding tied second; preparation and configuration last.

**Q (discover: Internal source role): Is the file view for inspection or editing?**  
A: Inspection and review only, with external-editor handoff.

**Q (discover: File navigation location): Where should the active Project's file tree live?**  
A: `Files` in the rail, replacing sidebar contents.

**Q (discover: Deterministic map return): How does the user return from source or Changes to the map?**  
A: Persistent `Map` destination beside open center tabs.

**Q (discover: Attention-first landing): What opens when the application starts or the active Project changes?**  
A: Open `Attention` and frame the map without auto-selecting an item.

**Q (discover: Left-edge structure): Should Projects and tools use one rail or separate docks?**  
A: One rail.

**Q (discover: Rail destinations): Which destinations deserve top-level rail buttons?**  
A: The recommended focused set; Evidence and Revisions remain contextual.

**Q (discover: Logs and output location): Where should logs, command output, and detailed diagnostics appear?**  
A: A collapsible lower panel beneath the current center surface.

**Q (discover: Settings entry): What should the bottom `Settings` control open?**  
A: Menu for App, Project, and Models settings, each opening centrally.

**Q (discover: Model selection scopes): Where are models selected without pretending there is one global active model?**  
A: Scope-specific model controls.

**Q (discover: Right-panel ownership): Does the right panel remain on a Waypoint or follow the inspected object?**  
A: Follow Waypoint, file, diff, or Run selection.

**Q (discover: Conversation as a center surface): Where does the primary Project conversation live?**  
A: `Conversation` is a permanent center surface; the right panel keeps a compact summary with switchable contextual tabs.

**Q (discover: Plan comprehension before implementation detail): How does the user verify that the model understood the intended completed product before approving the plan?**  
A: The first Frame conversation produces shared understanding and a user-approved plan. Plain-language end-state understanding precedes separately available technical detail.

**Q (discover: Layered comprehension review): How should the user confirm the end-state teach-back before reviewing technical detail?**  
A: Summary first, then stories.

**Q (discover: Provisional planning preview): What should appear beyond Conversation, the summary, and user stories before the plan is accepted?**  
A: Optional provisional preview.

**Q (discover: Validated future walkthrough): Does the proposed end-to-end Frame walkthrough match the intended SlopStop experience?**  
A: Yes; Conversation progresses through understanding, stories, corrections, optional planning preview, inspectable context and memory, bounded predictions, technical planning, and explicit map acceptance.

**Q (discover: Expectation Cards exercise): Do structured cards provide a suitable comprehension review?**  
A: Retain as an option, but not the primary technique.

**Q (discover: Prediction Game exercise): Do concrete predictions help detect model understanding?**  
A: Yes; this was the strongest exercised technique, with activation policy still open at discovery time.

**Q (discover: Traceable Mirror exercise): Should expectation-to-decision-to-plan coverage be visible during normal Conversation or only at a review boundary?**  
A: Present the Traceable Mirror during final plan approval.

**Q (discover: Adaptive comprehension proof): When should Prediction Game and Future Walkthrough techniques enter Frame?**  
A: Use adaptive proof: Prediction primarily, Future Walkthrough selectively, Expectation Cards as an alternate projection, and Traceable Mirror at final approval.

**Q (discover: Project feed over Boards): Should a global conversation replace Waypoint Boards or aggregate them?**  
A: No. Conversation is direct model dialogue; Project and Waypoint conversations remain separate from operational activity and do not aggregate Board events automatically.

**Q (discover: Free Conversation branches with reviewed influence): How can Conversation branches remain free without silently influencing a revision?**  
A: Before a revision, the model proposes included and excluded branches/messages and the user corrects that manifest.

**Q (discover: Project and Waypoint conversation structure): Which conversation scopes support direct model dialogue and branches?**  
A: Separate Project and Waypoint conversations, both freely branchable under reviewed influence.

**Q (discover: Model-context transparency): How should the user understand and control model context without reviewing a technical manifest before every message?**  
A: Summary before, proof after; routine attempts remain fluid, while expansion, source, and sensitive content require confirmation.

**Q (discover: Memory library entry): Where should the complete Project memory experience begin?**  
A: The Project menu opens the central Memory library; contextual links may open exact records.

**Q (discover: Natural Decision checkpoints): When should a clarified Frame decision become an Accepted revision while Conversation continues?**  
A: At natural checkpoints, not per decision and not only at one final all-or-nothing acceptance.

**Q (discover: Memory Proposal review location): When and where should Memory Proposals ask for user review?**  
A: Only in the Memory library; never interrupt Conversation or create Attention.

**Q (discover: Correcting model understanding): How should the user correct end-state and plan content without hiding revision history?**  
A: Conversation plus comments on text; silent direct editing is not the primary correction path.

**Q (discover: Central Review surface): Where should full end-state, plan, diff, and coverage review live?**  
A: A central Review surface, with an optional wide-window split but not as the default.

**Q (discover: Conversation navigation): How should Project, Waypoint, and nested conversations be navigated without another permanent column?**  
A: Scope header plus a temporary navigator; map and contextual links may deep-link.

**Q (discover: Project-scoped messages): Can the user ask a general Project question without choosing a Waypoint?**  
A: Project and Waypoint are both valid visible targets.

**Q (discover: Diff lifecycle): When may the user see and act on Worker changes?**  
A: Provisional live diff plus final Candidate-delta review.

**Q (discover: Diff entry point): How does the user enter review while retaining provenance?**  
A: From Run or Attention; the normal file tree only badges changes.

**Q (discover: Persistent summary): Is Summary a tab or always visible?**  
A: When open, the right panel keeps a compact summary above contextual tabs; Conversation starts with the panel collapsed.

**Q (discover: Conversation right-panel default): Should the right panel consume width during Conversation?**  
A: No; it is collapsed by default and opens contextually.

**Q (discover: User-story presentation): Which writing shape communicates the completed product?**  
A: User story plus narrative when needed.

**Q (discover: Final Frame transition): What appears immediately after accepting the complete Frame revision?**  
A: The generated map opens; Conversation and Review remain recoverable, and later correction creates a new revision.

**Q (discover: Open-file behavior): How many source files remain open after repeated Explorer clicks?**  
A: Reusable preview plus pinned files.

**Q (discover: Log scope): Which logs appear by default?**  
A: Contextual default with Project and application alternatives.

**Q (discover: Visual direction): Which night-interface direction should be explored?**  
A: Carbon and graphite with matte near-black surfaces, machined edges, restrained neutral light, and scarce state color.

**Q (discover: Effect boundary): Where may glow and movement appear?**  
A: Selection, attention, active work, and transitions only.

**Q (discover: Narrow-window behavior): What yields when all columns no longer fit?**  
A: Inline and resizable when wide; overlay or temporary full surface when narrow.

**Q (discover: Attention membership): Which events belong in Attention?**  
A: Decisions, approvals, permissions, conflicts, failures, blockers, and recovery only.

**Q (discover: Attention ordering): How are simultaneous Attention items ordered?**  
A: Recovery, failures, and blockers first; then decisions and approvals; oldest first within a level.

**Q (discover: Run center surface): What replaces the map when a Run is selected?**  
A: Run overview with tasks, Workers, progress, budget, Evidence, and Changes.

**Q (discover: Accessibility baseline): Are keyboard support, non-color state, reduced motion, and a text/list map projection required?**  
A: Yes.

**Q (discover: Explicit source attachments): Does opening source automatically send it to the model?**  
A: No. Sending source requires visible removable attachments.

**Q (discover: Waypoint Prompt packet): What base context is injected for a Waypoint target?**  
A: Objective, state, accepted decisions, contracts, and relevant Run context.

**Q (discover: Unsupported file behavior): What happens for binary, oversized, unsupported, or unreadable files?**  
A: Keep the file visible and explain the exact limit or failure.

**Q (discover: Green usage): Is green forbidden entirely?**  
A: No; use it only for small success signals.

**Q (discover: Typography): Which typography should the Windows desktop prototype use?**  
A: The native Windows pair.

**Q (discover: Icon system): Which icon family should the first visual pass use?**  
A: Phosphor.

**Q (discover: Prototype coverage): Should the pass change only the right panel or the complete workspace?**  
A: Complete workspace.

**Q (discover: Prototype host): Should the prototype remain standalone HTML or use React?**  
A: Real React components in an isolated prototype entry.

**Q (discover: Missing-backend boundary): How should prototype states be supplied before process contracts exist?**  
A: An isolated prototype entry with fixtures.

**Q (discover: Prototype exclusions): Are repository, Git, Run, model, persistence, IPC, and editing behavior excluded?**  
A: Yes, all are outside the prototype pass.

**Q (discover: Right-panel sizing): Is the wide-window right panel fixed?**  
A: It is resizable and collapsible, becoming an overlay when narrow.

**Q (discover: Final teach-back confirmation): Does the consolidated model match the intended experience?**  
A: Yes, confirmed after the complete teach-back.

**Q (`.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:543-547`, `apps/desktop/src/main/main.ts:68-132`): How should #47 treat unresolved visual acceptance in #45?**  
A: Design now, but block final production-renderer implementation until #45 is accepted.

**Q (`CONTEXT.md:153-155`, `apps/desktop/src/renderer/prototype/prototype-app.tsx:1952-1979`, `apps/harness/src/harness-runtime.ts:33-58`): Which graph owns the direct-response Context record?**  
A: Conversation owns the durable record; Execution only produces the provider result.

**Q (`CONTEXT.md:67-69`, `apps/desktop/src/renderer/prototype/prototype-app.tsx:1402-1492`): Which history owns recoverable Review annotations and proposed diffs before acceptance?**  
A: Frame draft history; accepted checkpoints create canonical Accepted revisions.

**Q (`CONTEXT.md:153-155`, `CONTEXT.md:57-59`): Does Worker context use the same contract as direct Conversation context?**  
A: Preserve the same provenance rule but use separate owner contracts for Conversation and Execution.

## Related Research

- `.rpiv/artifacts/research/2026-08-22_workspace-ux-patterns.md`
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md`
- `.rpiv/artifacts/research/2026-08-25_packaged-writer-lease-probe-report.json`

## Open Questions

- Exact user-facing labels for the Context proposal, Context record, and technical-detail section remain a #45 prototype decision.
- Exact Project-menu placement and Memory-library layout remain a #45 prototype decision.
- Exact glow strength, blur, and transition timing remain a #45 visual decision.
- Exact contextual right-panel tab labels and ordering remain a #45 prototype decision.
- Exact fixture names and copy remain prototype-only and must not create domain truth.
- The logical payloads for the missing Execution, Evidence, repository/Git, Integration-review, Board, and Verified Memory producers remain owned by their respective programs and must not be inferred from fixtures.
- Physical persistence and migration implementation remain blocked on issues #41 and #40.
