---
date: 2026-08-22T19:18:10+0100
author: Pedro Mesquita
commit: acf9c8b
branch: main
repository: slopstop
topic: "Workspace supervision experience"
tags: [intent, frd, desktop, workspace, ux, prototype]
status: complete
register: mixed
consensus: confirmed
last_updated: 2026-08-22T23:37:42+0100
last_updated_by: Pedro Mesquita
content_hash: 35ba844ee371d740be19c940c4badb3c8b34b078f2dabe35cce49f3203b77d40
---

# FRD: Workspace Supervision Experience

## Summary

Build an isolated React prototype of the complete SlopStop workspace inside `apps/desktop`. The workspace must lead with requests for human attention, give Run supervision and Project understanding equal weight, and provide explicit navigation across the relationship map, source files, Run overviews, live and final diffs, logs, settings, and model-scoped conversation.

## Problem & Intent

The developer ranked the jobs of the workspace as: "1 primeiro, 2 =3, depois 4": first find what requires attention; second, with equal weight, supervise work and navigate or understand the Project; last, prepare or configure work.

The workspace must also let the user navigate the files of the active Project, open a file in place of the map while retaining a deterministic return to the map, and inspect GitHub-like diffs as Workers modify files. The current mock makes the map dominant, treats attention as an optional action, has no usable Files, Runs, logs, Settings, or model-selection journeys, and presents an overly dense right-hand workbench.

The developer's deeper frustration is false alignment: a model can repeat the request while still imagining a different completed product. During Frame, the workspace must make the model's understanding of the intended end-state easy to inspect and correct before technical planning creates an illusion of agreement.

## Goals

- Make human action requests obvious immediately after opening or switching Project.
- Give Run supervision and relationship-map comprehension equally strong first-class surfaces.
- Let users inspect Project files and Worker-produced changes without turning SlopStop into an editor.
- Keep conversation primary as a permanent center surface while preserving explicit targets, provenance, state summaries, and review surfaces.
- Make the model's understanding of the completed end-state visible in clear language before the user approves a plan.
- Lead plan comprehension with user stories and observable outcomes while keeping technical implementation detail available separately.
- Establish a distinctive carbon and graphite interface without weakening long-session readability or accessibility.
- Validate the complete workspace in real React components without inventing production process contracts.

## Non-Goals

- Reading a real repository or invoking real Git operations.
- Running Workers, Runs, tools, or model providers.
- Persisting prototype state or adding Project, Files, Run, diff, or model IPC contracts.
- Editing code inside SlopStop.
- Replacing the production renderer's truthful harness-state experience with simulated Project data.
- Finalizing production architecture for repository access, Git integration, process transport, or persistence.

## Functional Requirements

1. The prototype SHALL have an isolated React entry inside `apps/desktop` and SHALL use typed fixtures without changing the normal renderer's truthful production state.
2. The workspace SHALL operate on one active Project at a time and SHALL display that Project identity persistently.
3. Opening the prototype or changing the active Project SHALL activate the `Attention` sidebar and frame every human-action item on the relationship map without automatically opening one item.
4. `Attention` SHALL contain only decisions, approvals, permissions, conflicts, failures, blocked work, and recovery that require human action; healthy activity SHALL remain in `Runs`.
5. `Attention` SHALL sort first by impact and then by age, with recovery, failure, and blockers ahead of decisions and approvals.
6. One activity rail SHALL expose `Projects`, `Attention`, `Files`, and `Runs` at the top, with `Diagnostics` and `Settings` separated at the bottom.
7. Selecting an activity-rail destination SHALL replace the sidebar contents rather than adding a second permanent sidebar or Project dock.
8. The center SHALL expose persistent `Map` and `Conversation` destinations and SHALL support file previews, pinned files, Run overviews, and Change reviews as adjacent surfaces.
9. The map SHALL remain the primary relationship and orientation surface, SHALL support semantic zoom, and SHALL not use a permanent background grid.
10. `Files` SHALL show the active Project's folder and file hierarchy. Selecting a text file SHALL open a reusable preview tab, and the user SHALL be able to pin files that must remain open.
11. The internal file view SHALL be inspection-only and SHALL offer an explicit action to open the file in an external editor.
12. Binary, oversized, unsupported, or unreadable files SHALL remain visible and SHALL show their type, size when available, exact unavailable reason, and external-open action instead of appearing empty or silently truncated.
13. Selecting a Run SHALL open a central Run overview containing its plan or tasks, Workers, progress, budget, Evidence, and entry to Changes.
14. Worker changes SHALL be visible during execution as a clearly provisional, read-only diff preview.
15. Approval, change-request, and Integration actions SHALL appear only for a closed Candidate delta ready for final review.
16. Change reviews SHALL be entered from `Runs` or `Attention`, SHALL retain the producing Run's provenance, and SHALL show a changed-file navigator plus GitHub-like diff. The normal file tree SHALL only badge changed files.
17. Logs, Process-job output, and detailed diagnostics SHALL appear in a collapsible lower panel without replacing the center surface.
18. The lower panel SHALL default to the selected Run or Worker, SHALL show that scope explicitly, and SHALL allow changing to Project-wide or application-wide output.
19. Critical failures SHALL always surface in `Attention` and SHALL never be hidden only in logs or degraded to a clean or absent state.
20. The right panel SHALL follow the selected Waypoint, file, diff, or Run and SHALL show actions and context relevant to that selection.
21. When open, the right panel SHALL display a compact persistent summary, open on `Details`, and expose a small contextual set of tabs such as `Details`, `Evidence`, `Changes`, or `Validation`; it SHALL NOT own `Conversation`.
22. On wide windows the right panel SHALL be inline, resizable, and collapsible. On narrow windows it SHALL become an overlay or temporary full surface with deterministic return to the center.
23. `Conversation` SHALL be a permanent center surface beside `Map` for direct dialogue with the model; it SHALL NOT act as a Project activity feed or automatically project Run, Worker, or Waypoint Board events into the dialogue.
24. Every conversation SHALL show its explicit `Project` or `Waypoint` scope. Selecting context MAY suggest or open that scoped conversation but SHALL NOT infer or hide the scope that will receive the message.
25. Project-scoped messages SHALL support general questions and proposals. Requests about concrete Waypoint work SHALL use a Waypoint target.
26. Choosing a Waypoint target SHALL produce a bounded, inspectable Prompt packet containing the objective, state, accepted decisions, contracts, and relevant Run context.
27. Opening a file SHALL NOT send source to a model. Files, selections, and code anchors SHALL enter a Prompt packet only through removable, visible attachments chosen by the user.
28. `Settings` SHALL open a short menu with `App settings`, `Project settings`, and `Models`; choosing one SHALL open a central settings page.
29. Model credentials and catalogue SHALL live under `Models`, Project defaults under `Project settings`, and Run, role, or task overrides at Run preparation. Each response SHALL identify the model actually used.
30. The prototype SHALL use a carbon and graphite direction based on matte near-black surfaces, machined edges, restrained neutral light, and state color limited to focus, attention, active work, and transitions; it SHALL NOT use a space or constellation look.
31. Green SHALL be limited to small verified-success signals. Attention and failure SHALL use distinct amber and red or pink signals, always paired with text or iconography.
32. The prototype SHALL use `Segoe UI Variable` for interface text, `Cascadia Code` for source, logs, and technical data, and one consistent Phosphor icon set with filled variants reserved for active states.
33. A first Frame conversation for a new Project SHALL establish both shared understanding of the intended end-state and a user-approved plan before generating accepted Project map content.
34. Before asking for plan approval, Frame SHALL present a clear-language teach-back of the intended end-state using user stories, observable outcomes, concrete examples, and relevant non-goals.
35. Technical implementation details SHALL remain inspectable but SHALL be presented separately from the end-state teach-back so the user can validate expected product behavior without first interpreting engineering mechanics.
36. The user SHALL be able to correct the teach-back or its user stories; a correction SHALL revise the Decision Canvas and SHALL NOT change Canonical state until explicit acceptance.
37. End-state review SHALL happen in two layers: the user first confirms or corrects the overall plain-language summary, then reviews the user stories and corrects the stories or expectations where the model's understanding diverges.
38. During Frame, Conversation SHALL remain the primary surface while offering an optional, clearly provisional preview of Decision Canvas decisions and relationships; the canonical Project map SHALL appear only after explicit acceptance.
39. Frame SHALL use adaptive comprehension proof: it SHALL ask a bounded set of concrete prediction questions when behavior is consequential, ambiguous, corrected, disputed, surprising, or involves a relevant limit or failure; the user MAY invoke the same proof at any time, while clear low-risk work MAY use the quick path without it.
40. Multi-step Future Walkthroughs MAY be used when they clarify an ambiguous journey. Expectation Cards MAY exist as an alternate compact projection but SHALL NOT replace the primary conversational review.
41. Final plan approval SHALL include a Traceable Mirror that distinguishes expectations with accepted support, disputes, missing decisions, missing plan coverage, and broken links before canonical Project map generation.
42. A model conversation SHALL support manually created branches from an exact message, including branches of branches, free navigation, and indefinite retention without requiring a close or merge ceremony.
43. Before preparing a revision, the model SHALL propose an inspectable branch-context selection that lists included and excluded branches or messages; the user SHALL be able to correct that selection, and unlisted or excluded branch content SHALL NOT influence the revision.
44. A Conversation branch SHALL have no Project-work status, Run, execution authority, or Canonical-state authority and SHALL NOT become a Waypoint automatically; it MAY produce a reviewed proposal for a new Waypoint.
45. Each Project SHALL have one primary Project conversation, and each Waypoint SHALL have its own scoped conversation; their histories SHALL remain separate, and both conversation scopes SHALL support branches.
46. Selecting a Waypoint MAY open its scoped conversation, and the workspace SHALL provide a deterministic return to the primary Project conversation without changing the selected Waypoint's state or priority.
47. Before sending a model message, Conversation SHALL show a compact Context proposal summarizing scope, selected conversation or branch material, accepted decisions, Verified Memories, and attachments; the user SHALL be able to inspect and correct it without routine messages requiring repeated full approval.
48. Expanding Project or Waypoint scope, adding source or sensitive content, or otherwise crossing a declared context-risk boundary SHALL require explicit confirmation before the attempt.
49. Every model response SHALL expose an immutable Context record of what the attempt actually used and excluded, including completeness or truncation; token counts, hashes, and provider delivery details SHALL remain available in a separate technical section rather than dominating normal Conversation.
50. The Project menu SHALL provide entry to a central Memory library without adding a permanent `Memory` activity-rail destination.
51. The Memory library SHALL support browse, search, Topic and state filters, accepted and stale memory inspection, proposal review, provenance, Evidence, revision history, invalidation explanation, and authorized re-verification entry.
52. Model-response Context records and other relevant projections MAY link directly to referenced accepted or stale Memories and SHALL provide deterministic return to the originating surface; Memory Proposals SHALL appear for review only inside the Memory library and SHALL NOT create Conversation or Attention interruptions.
53. Accepted Frame decisions SHALL remain Accepted revisions rather than being duplicated automatically as Verified Memories; a reusable claim derived from a decision SHALL still follow the separate evidence-backed Memory Proposal and acceptance contract.
54. The Decision Canvas SHALL update continuously as Conversation clarifies or corrects intent, while coherent groups of proposed decisions SHALL become Accepted revisions only through explicit lightweight Decision checkpoints at natural conversational boundaries.
55. Decision checkpoints SHALL preserve accepted progress without generating or replacing the canonical Project map; final Frame approval SHALL separately validate the complete end-state, plan, Traceable Mirror, proposed Feature, Waypoints, and relationships before map generation.
56. Memory Proposals SHALL accumulate non-blockingly in the Memory library with full origin and Evidence; they SHALL NOT enter trusted retrieval, interrupt Conversation, or surface in Attention before explicit review and acceptance in that library.
57. The user SHALL be able to correct end-state summaries, user stories, Decision Canvas content, and plan content either through natural Conversation or by attaching a comment to exact selected text in a specific provisional revision.
58. A correction SHALL produce an inspectable proposed diff with preserved attribution and history; neither a conversational correction nor a text comment SHALL silently rewrite an Accepted revision or Canonical state.
59. Full comprehension and plan review SHALL use a temporary central `Review` surface rather than a long Conversation message or the contextual right panel.
60. `Review` SHALL keep summary, conversational-prose user stories, Review annotations, proposed diffs, Decision checkpoints, technical plan, and final Traceable Mirror in visibly separate sections with deterministic return to `Conversation`.
61. On sufficiently wide windows the user MAY open an optional Conversation-and-Review split; the split SHALL NOT be the default or reduce either surface below its usable width.
62. Conversation SHALL show a persistent scope breadcrumb identifying the Project conversation or exact Waypoint conversation and current branch.
63. Activating the scope breadcrumb SHALL open a temporary searchable navigator over the Project conversation, Waypoint conversations, and nested branches; selecting an item SHALL close the navigator and preserve the main Conversation width.
64. Map selections and contextual links MAY open the corresponding Waypoint conversation or branch directly, while preserving a deterministic return to the originating Map or surface.
65. Entering `Conversation` SHALL collapse the right panel by default. Selecting a Memory, Evidence item, decision, attachment, or other inspectable reference MAY open the panel on that exact detail, and closing it SHALL restore the full Conversation width.
66. Review SHALL express each end-state expectation first as one short plain-language user story; it SHALL add a Future Walkthrough narrative only when ambiguity, multiple steps, surprising consequences, or relevant limits or failures require more concrete explanation.
67. Final Frame acceptance SHALL open the generated canonical Project map immediately, frame the newly created or changed Feature, Waypoints, and relationships, and expose the Accepted revision that produced them; Conversation and Review SHALL remain directly recoverable.

## Non-Functional Requirements

- **Performance**: No production performance limit is set for this fixture-backed prototype. Interactions, panel resizing, semantic zoom, tab changes, and log toggling must remain visibly responsive with the representative fixture corpus.
- **Security**: The prototype must perform no repository reads, Git operations, credential access, model calls, or outbound source transmission. Opening source is never equivalent to attaching it to a Prompt packet.
- **UX / Accessibility**: Rail destinations, sidebar items, center tabs, map alternatives, panel tabs, and primary actions must work by keyboard. State must never depend on color, glow, or motion alone. Reduced-motion preferences must be respected, the map must have an equivalent list or text projection, and Frame explanations must use plain language before exposing technical detail.
- **Reliability**: Unsupported and broken states must be explicit. The prototype must never present unavailable content, failed diagnostics, provisional diffs, or incomplete context as clean, final, or absent.

## Constraints & Assumptions

- The production renderer currently exposes only harness status and retry behavior; it has no Project, repository, Git, Run, or model contracts.
- The prototype is isolated inside `apps/desktop` and may reuse the desktop build system, React version, and test tooling, but not application-to-application imports or renderer access to Node/Electron APIs.
- Fixtures represent UX states only and have no canonical or persistence authority.
- The existing standalone HTML prototype remains historical design evidence; the accepted next pass is React, not an expansion of that file.
- Fine tab labels, tab ordering, fixture copy, and exact glow intensity may change during visual iteration without changing the agreed interaction contract.

## Acceptance Criteria

- [ ] `pnpm --filter @slopstop/desktop typecheck` exits 0.
- [ ] `pnpm test:unit` exits 0 and includes public-interaction tests for activity-rail navigation, Attention landing, Map return, file preview/pinning, Run overview, provisional versus final Changes, log scope, Settings routing, and explicit conversation target/attachments.
- [ ] `pnpm check` exits 0 without weakening an existing gate.
- [ ] A documented prototype command launches the isolated React workspace, while the normal `pnpm dev` entry still shows only truthful harness states.
- [ ] On launch, `Attention` is active, the map frames all fixture items that require human action, and no item is automatically opened.
- [ ] A keyboard-only journey can switch `Attention` -> `Files`, open and pin a file, return directly to `Map`, select a Run, open its provisional and final Changes, inspect logs, and reach Settings.
- [ ] Selecting a file never adds source to the conversation; adding source creates a visible removable attachment before send.
- [ ] A provisional diff has no approval or Integration action; the final Candidate delta exposes the review actions and producing Run identity.
- [ ] At a wide desktop viewport, the right panel resizes and collapses without document overflow; at a narrow viewport, it becomes an overlay and leaves a deterministic path back to the center.
- [ ] With reduced motion enabled, ambient or continuous animation is absent and all state remains legible.
- [ ] Automated accessibility checks report no serious violations, and every state encoded by color also has a label, icon, or pattern.
- [ ] Browser or Electron console output contains no uncaught errors during the representative journey.
- [ ] A Frame journey demonstrates that the user can inspect and correct a plain-language end-state teach-back and user stories before separately reviewing technical implementation detail or accepting the Project map revision.
- [ ] The Frame journey requires overall-summary review before story-level correction, without forcing a separate approval action for every story that needs no change.
- [ ] The Frame journey adaptively introduces concrete predictions for one consequential or disputed behavior, skips them for one clear quick-path change, and allows the user to request them manually.
- [ ] Final approval exposes expectation-to-decision-to-plan coverage and never reports missing or broken links as covered.
- [ ] A routine message exposes a compact correctable Context proposal without forced approval, while a source attachment or scope expansion requires confirmation and the resulting response exposes the exact immutable Context record.

## Recommended Approach

Add a dedicated prototype renderer entry under `apps/desktop` composed of real React components and typed local fixtures, while leaving the production renderer, preload API, and process contracts unchanged. Exercise the prototype through public interactions and an isolated launch command; use the results to design later vertical production slices rather than treating fixture state as implementation truth.

## Decisions

### Workspace priority
**Question**: In a real session, what is the first problem the whole workspace must solve?
**Recommended**: n/a - intent question
**Chosen**: Attention first; Run supervision and Project understanding tied second; preparation and configuration last.
**Rationale**: This is the developer's stated ordering: "1 primeiro, 2 =3, depois 4."

### Internal source role
**Question**: Is the file view for inspection or editing?
**Recommended**: Inspection and review only.
**Chosen**: Inspection and review only, with external-editor handoff.
**Rationale**: Keeps SlopStop focused on supervised agent work instead of becoming an IDE.

### File navigation location
**Question**: Where should the active Project's file tree live?
**Recommended**: `Files` destination in one activity rail.
**Chosen**: `Files` in the rail, replacing sidebar contents.
**Rationale**: Preserves map width and follows a familiar explorer pattern without a permanent second pane.

### Deterministic map return
**Question**: How does the user return from source or Changes to the map?
**Recommended**: Keep `Map` fixed at the top of the center surface.
**Chosen**: Persistent `Map` destination beside open center tabs.
**Rationale**: Returning to orientation must not depend on navigation history or a low-discovery bottom control.

### Attention-first landing
**Question**: What opens when the application starts or the active Project changes?
**Recommended**: `Attention` sidebar plus a map framing all attention items.
**Chosen**: Open `Attention` and frame the map without auto-selecting an item.
**Rationale**: Surfaces the priority immediately while preserving the user's choice of what to inspect.

### Left-edge structure
**Question**: Should Projects and tools use one rail or separate docks?
**Recommended**: One activity rail with a replaceable sidebar.
**Chosen**: One rail.
**Rationale**: Two permanent vertical bars would consume space and create competing navigation models.

### Rail destinations
**Question**: Which destinations deserve top-level rail buttons?
**Recommended**: `Projects`, `Attention`, `Files`, and `Runs`, with `Diagnostics` and `Settings` below.
**Chosen**: The recommended focused set; Evidence and Revisions remain contextual.
**Rationale**: Avoids duplicating workbench content and keeps daily jobs prominent.

### Logs and output location
**Question**: Where should logs, command output, and detailed diagnostics appear?
**Recommended**: A collapsible lower panel.
**Chosen**: A collapsible lower panel beneath the current center surface.
**Rationale**: Preserves map, source, or diff context while allowing long horizontal output.

### Settings entry
**Question**: What should the bottom `Settings` control open?
**Recommended**: A short menu leading to full central pages.
**Chosen**: Menu for App, Project, and Models settings, each opening centrally.
**Rationale**: Keeps scopes explicit and avoids compressing growing forms into a narrow sidebar.

### Model selection scopes
**Question**: Where are models selected without pretending there is one global active model?
**Recommended**: Credentials/catalogue, Project defaults, Run overrides, and actual response model at separate scopes.
**Chosen**: Scope-specific model controls.
**Rationale**: Matches the domain model and makes the model that performed work truthful and visible.

### Right-panel ownership
**Question**: Does the right panel remain on a Waypoint or follow the inspected object?
**Recommended**: Follow the selection.
**Chosen**: Follow Waypoint, file, diff, or Run selection.
**Rationale**: Relevant actions and provenance matter more than preserving stale panel contents.

### Conversation as a center surface
**Question**: Where does the primary Project conversation live?
**Recommended**: A permanent center surface beside `Map`.
**Chosen**: Developer correction: `Conversation` leaves the right panel and becomes a permanent center surface; the right panel keeps a persistent compact summary with switchable contextual tabs.
**Rationale**: Conversation needs the same working area as the map, while exact context remains visible in the right panel.

### Plan comprehension before implementation detail
**Question**: How does the user verify that the model understood the intended completed product before approving the plan?
**Recommended**: n/a - intent clarification
**Chosen**: The first Frame conversation must produce both shared understanding and a user-approved plan. Before technical detail, the model presents its understanding of the end-state in clear language through user stories, observable outcomes, examples, and non-goals. Technical implementation detail remains available as a separate view.
**Rationale**: Repeating the user's wording is not proof of understanding. The user must be able to recognise and correct the product experience they will receive before implementation mechanics make the plan appear more certain than it is.

### Layered comprehension review
**Question**: How should the user confirm the end-state teach-back before reviewing technical detail?
**Recommended**: Confirm the overall summary first, then review and correct the individual stories where understanding diverges.
**Chosen**: Summary first, then stories.
**Rationale**: One large approval can hide subtle misunderstandings, while mandatory approval of every story would make normal planning unnecessarily tedious.

### Provisional planning preview
**Question**: What should appear beyond Conversation, the summary, and user stories before the plan is accepted?
**Recommended**: Keep Conversation primary and offer an optional provisional preview of decisions and relationships.
**Chosen**: Optional provisional preview.
**Rationale**: A visual preview can expose missing or incorrect relationships without forcing the user to divide attention continuously or mistaking tentative planning content for the accepted Project map.

### Validated future walkthrough
**Question**: Does the proposed end-to-end Frame walkthrough match the intended SlopStop experience?
**Recommended**: n/a - comprehension exercise
**Chosen**: The developer confirmed the walkthrough is accurate: Conversation leads a new Project from questions, through a live understanding summary, user stories, corrections, optional provisional planning preview, inspectable context and memory use, bounded prediction checks, separate technical planning, and explicit acceptance into the canonical Project map.
**Rationale**: This validates the intended sequence and authority boundaries without yet deciding whether a walkthrough is mandatory or adaptively invoked in the final interaction.

### Expectation Cards exercise
**Question**: Do structured cards containing a user story, expected outcome, example, non-goal, and uncertainty provide a suitable comprehension review?
**Recommended**: Initially considered as the stable baseline for story review.
**Chosen**: Retain as an option, but do not select it as the primary technique; the developer did not like the exercised interaction.
**Rationale**: Structural fit is not sufficient when the review format itself feels wrong to the intended user. The technique may still be useful as an optional compact projection rather than the main Conversation experience.

### Prediction Game exercise
**Question**: Do concrete predictions across normal, simple, failure, and stale-context situations help the developer detect whether the model understood the intended product?
**Recommended**: Use a bounded Prediction Game for consequential, ambiguous, or disputed behavior.
**Chosen**: The developer found the exercised technique substantially helpful. It is the strongest comprehension technique tested so far; its activation policy remains open.
**Rationale**: Applying the model's understanding to concrete situations exposes semantic disagreement more reliably than repeating requirements or presenting structured cards alone.

### Traceable Mirror exercise
**Question**: Should expectation-to-decision-to-plan coverage be visible during normal Conversation or only at a review boundary?
**Recommended**: Keep it optional so it does not interrupt Conversation.
**Chosen**: Present the Traceable Mirror during final plan approval.
**Rationale**: Its value is confirming that no accepted expectation was lost before canonical map generation; showing the matrix throughout normal conversation would add weight without improving the dialogue.

### Adaptive comprehension proof
**Question**: When should Prediction Game and Future Walkthrough techniques enter Frame?
**Recommended**: Invoke them adaptively for ambiguity, consequence, corrections, disputes, surprising behavior, and relevant limits or failures; preserve manual invocation and a clear-work quick path.
**Chosen**: Adaptive proof. Prediction is the primary active proof, Future Walkthrough is optional for multi-step ambiguity, Expectation Cards remain an alternate projection, and Traceable Mirror appears at final approval.
**Rationale**: This preserves natural Conversation while requiring stronger evidence of understanding precisely where a wrong mental model would materially alter the end-state.

### Project feed over Boards
**Question**: Should a global conversation replace Waypoint Boards or aggregate them?
**Recommended**: A Project feed over separate Waypoint Boards.
**Chosen**: Superseded during renewed discovery. `Conversation` is direct model dialogue, not a Project feed; Project and Waypoint conversations remain separate from operational activity and do not automatically aggregate Board events.
**Rationale**: Combining activity and dialogue made the primary model interaction feel like a small monitoring feed rather than a full conversation workspace.

### Free Conversation branches with reviewed influence
**Question**: How can Conversation branches remain free to explore without silently influencing a revision?
**Recommended**: Allow free nested navigation and let the model propose an explicit include/exclude selection before revision preparation.
**Chosen**: Branches may remain open, fork again, and cross-reference one another without formal conclusion. Before producing a revision, the model proposes which branches or messages to use and exclude; the user corrects that manifest first.
**Rationale**: Exploration should not require merge ceremonies, but invisible branch context would recreate the same false-alignment and prompt-transparency problem that Frame is designed to prevent.

### Project and Waypoint conversation structure
**Question**: Which conversation scopes support direct model dialogue and branches?
**Recommended**: One primary Project conversation plus one scoped conversation per Waypoint, with branches available in both.
**Chosen**: Project conversation and Waypoint conversations remain separate, and both may branch freely under the reviewed-influence rule.
**Rationale**: Global intent and focused task discussion need different histories, while using the same branching model avoids a second interaction language and keeps exploratory content non-canonical.

### Model-context transparency
**Question**: How should the user understand and control model context without reviewing a technical manifest before every message?
**Recommended**: Show a compact correctable summary before send and an exact immutable record after the response; require confirmation only when a declared risk boundary is crossed.
**Chosen**: Summary before, proof after. Routine attempts remain fluid, while scope expansion, source, and sensitive content require confirmation. `Prompt packet` remains a technical term rather than the primary user-facing label.
**Rationale**: The user needs to know both what is proposed and what actually happened, but repeated full-manifest approval would make normal Conversation unusable and encourage blind confirmation.

### Memory library entry
**Question**: Where should the complete Project memory experience begin?
**Recommended**: Initially recommended a permanent rail destination plus contextual links.
**Chosen**: The Project menu opens the central Memory library; model responses, Context records, and Attention provide direct contextual links without adding a permanent rail button.
**Rationale**: Memory remains independently searchable and governable without crowding the small set of daily rail destinations or hiding memory inspection inside Conversation alone.

### Natural Decision checkpoints
**Question**: When should a clarified Frame decision become an Accepted revision while Conversation continues?
**Recommended**: Keep the Decision Canvas current continuously and request lightweight acceptance at natural boundaries for coherent groups of decisions.
**Chosen**: Natural checkpoints, rather than per-decision interruption or one final all-or-nothing acceptance.
**Rationale**: This preserves durable progress and explicit authority without turning every answer into a form or leaving all clarified intent provisional until the end of a long Frame conversation.

### Memory Proposal review location
**Question**: When and where should automatically discovered Memory Proposals ask for user review?
**Recommended**: Initially recommended a non-blocking notice at natural checkpoints with review now or later.
**Chosen**: Memory Proposals appear only in the Memory library. They do not interrupt Conversation and do not create Attention items.
**Rationale**: Memory reuse is valuable but not urgent enough to disrupt planning; proposals remain untrusted and excluded from retrieval until the user deliberately opens the library and accepts them.

### Correcting model understanding
**Question**: How should the user correct end-state and plan content without turning Conversation into a form or hiding revision history?
**Recommended**: Support both natural conversational correction and comments attached to exact selected text; let the model propose a visible diff.
**Chosen**: Conversation plus comments on text. Direct silent editing is not the primary correction path.
**Rationale**: Natural dialogue preserves flow, text comments provide precision, and proposed diffs preserve what changed, why it changed, and which revision remains accepted.

### Central Review surface
**Question**: Where should full end-state, plan, diff, and coverage review live?
**Recommended**: A temporary central `Review` surface with deterministic return to the permanent Conversation surface.
**Chosen**: Central Review. Long structured review does not live as a giant chat message or in the narrow right panel; an optional wide-window split may be available but is not the default.
**Rationale**: Conversation needs room for natural dialogue, while review needs stable text selection, annotations, diffs, technical separation, and final traceability without competing for the same reading shape.

### Conversation navigation
**Question**: How should the user navigate the Project conversation, Waypoint conversations, and nested branches without adding another permanent column?
**Recommended**: Keep the current scope visible in a header breadcrumb and open a temporary searchable conversation tree from it.
**Chosen**: Scope header plus temporary navigator. Map and contextual links may deep-link to the relevant scoped conversation.
**Rationale**: The user can always see where a message belongs and find another history without sacrificing the full-size Conversation surface to a permanent ChatGPT-style sidebar.

### Project-scoped messages
**Question**: Can the user ask a general Project question without choosing a Waypoint?
**Recommended**: Permit explicit Project targets.
**Chosen**: Project and Waypoint are both valid visible targets.
**Rationale**: General coordination should not be forced into an unrelated Waypoint, while concrete work remains explicitly scoped.

### Diff lifecycle
**Question**: When may the user see and act on Worker changes?
**Recommended**: Read-only live preview followed by actionable final review.
**Chosen**: Provisional live diff plus final Candidate-delta review.
**Rationale**: Provides visibility during long work without treating incomplete mutations as safe to integrate.

### Diff entry point
**Question**: How does the user enter a GitHub-like review while retaining provenance?
**Recommended**: From the producing Run or its Attention item.
**Chosen**: Run/Attention entry; the normal file tree only badges changes.
**Rationale**: Concurrent Runs must not be collapsed into one ambiguous global Changes list.

### Persistent summary
**Question**: Is Summary a tab or always visible?
**Recommended**: Compact summary always visible.
**Chosen**: When the right panel is open, a compact summary remains above contextual `Details`, `Evidence`, and `Changes` tabs. Renewed discovery adds a Conversation-specific exception: the whole panel starts collapsed there.
**Rationale**: Selection details keep their target, state, provenance, and primary action visible when inspected, while direct model dialogue retains the full central width by default.

### Conversation right-panel default
**Question**: Should the contextual right panel consume width while Conversation is active?
**Recommended**: Start collapsed and open only for an exact selected reference.
**Chosen**: Collapsed by default. Memory, Evidence, decision, attachment, and other detail links may open it contextually; closing restores full Conversation width.
**Rationale**: Conversation is a primary work surface rather than a compact feed, and its essential scope is already visible in the header.

### User-story presentation
**Question**: Which writing shape best communicates the completed product without returning to structured Expectation Cards?
**Recommended**: Lead with one short user story and add a future narrative only where concrete explanation is needed.
**Chosen**: User story plus narrative when needed.
**Rationale**: A short story remains listable and traceable, while selective narrative makes ambiguous or multi-step outcomes concrete without making every expectation repetitive or mechanical.

### Final Frame transition
**Question**: What should the user see immediately after accepting the complete Frame revision?
**Recommended**: Open the canonical Project map and frame the newly generated or changed content with revision provenance.
**Chosen**: Open the generated map immediately. Conversation and Review remain recoverable, and later correction creates a new revision rather than rewriting accepted history.
**Rationale**: The user should see the concrete result of approval immediately and be able to verify that the accepted intent became the expected Project structure.

### Open-file behavior
**Question**: How many source files remain open after repeated Explorer clicks?
**Recommended**: One reusable preview with optional pinning.
**Chosen**: Reusable preview plus pinned files.
**Rationale**: Prevents tab accumulation while allowing references and comparisons to remain open deliberately.

### Log scope
**Question**: Which logs appear by default?
**Recommended**: Selected Run or Worker with an explicit scope selector.
**Chosen**: Contextual default with Project and application alternatives.
**Rationale**: Keeps routine investigation relevant without removing cross-Run diagnostics.

### Visual direction
**Question**: Which interpretation of an iPhone-like night interface should be explored?
**Recommended**: Initially proposed layered navy.
**Chosen**: Superseded during implementation: carbon and graphite with matte near-black surfaces, machined edges, restrained neutral light, and scarce state color.
**Rationale**: The selected circuit-map direction provides a distinctive premium identity without relying on blue, space, constellation, or game-progression imagery.

### Effect boundary
**Question**: Where may glow and movement appear?
**Recommended**: Focus and activity only.
**Chosen**: Selection, attention, active work, and transitions only.
**Rationale**: Preserves long-session readability and prevents a continuously animated science-fiction backdrop.

### Narrow-window behavior
**Question**: What yields when all columns no longer fit?
**Recommended**: Right panel becomes an overlay.
**Chosen**: Inline and resizable when wide; overlay or temporary full surface when narrow.
**Rationale**: Code, diffs, and maps need usable width without deleting panel functionality.

### Attention membership
**Question**: Which events belong in `Attention`?
**Recommended**: Only items requiring human action.
**Chosen**: Decisions, approvals, permissions, conflicts, failures, blockers, and recovery only.
**Rationale**: Normal activity would turn the priority inbox into a noisy duplicate of `Runs`.

### Attention ordering
**Question**: How are simultaneous attention items ordered?
**Recommended**: Impact, then age.
**Chosen**: Recovery/failure/blockers first, then decisions/approvals, oldest first within a level.
**Rationale**: Consequence drives urgency while age prevents starvation.

### Run center surface
**Question**: What replaces the map when a Run is selected?
**Recommended**: A dedicated Run overview.
**Chosen**: Run overview with tasks, Workers, progress, budget, Evidence, and Changes.
**Rationale**: Supervision needs a first-class surface rather than being compressed into the inspector or logs.

### Accessibility baseline
**Question**: Are keyboard support, non-color state, reduced motion, and a text/list map projection required from the prototype?
**Recommended**: Yes, from the first prototype.
**Chosen**: Yes.
**Rationale**: These constraints affect the navigation and visual system and cannot safely be postponed.

### Explicit source attachments
**Question**: Does opening source automatically send it to the model?
**Recommended**: Attach source explicitly.
**Chosen**: Opening changes only the visible surface; sending source requires visible removable attachments.
**Rationale**: Protects privacy, cost, and user understanding of what a model receives.

### Waypoint Prompt packet
**Question**: What base context is injected for a Waypoint target?
**Recommended**: A bounded inspectable summary.
**Chosen**: Objective, state, accepted decisions, contracts, and relevant Run context.
**Rationale**: Provides useful grounding without silently sending the whole Board or repository.

### Unsupported file behavior
**Question**: What happens for binary, oversized, unsupported, or unreadable files?
**Recommended**: Explicit unavailable state plus external-open action.
**Chosen**: Keep the file visible and explain the exact limit or failure.
**Rationale**: Missing or partial content must never masquerade as an empty valid file.

### Green usage
**Question**: Is green forbidden entirely or only as the dominant cast?
**Recommended**: Reserve green for verified success.
**Chosen**: Small success signals only.
**Rationale**: Retains a familiar semantic signal without returning to the rejected green atmosphere.

### Typography
**Question**: Which typography should the Windows desktop prototype use?
**Recommended**: `Segoe UI Variable` plus `Cascadia Code`.
**Chosen**: The native Windows pair.
**Rationale**: Prioritizes native clarity and lets layout, light, and motion carry the identity.

### Icon system
**Question**: Which icon family should the first visual pass use?
**Recommended**: Revised after developer challenge from Fluent to Phosphor.
**Chosen**: Phosphor.
**Rationale**: Provides more character and multiple weights or filled states without requiring a custom icon programme.

### Prototype coverage
**Question**: Should the next pass change only the right panel or the complete workspace?
**Recommended**: Initially recommended the right panel only.
**Chosen**: Developer scope expansion: complete workspace.
**Rationale**: The new navigation, source, Run, Changes, logs, Settings, and panel decisions need to be experienced as one system.

### Prototype host
**Question**: Should the complete prototype remain standalone HTML or use the real React renderer?
**Recommended**: Initially recommended the existing HTML prototype.
**Chosen**: Developer correction: real React components in an isolated prototype entry.
**Rationale**: Increases interaction and component fidelity without presenting fixture state as production truth.

### Missing-backend boundary
**Question**: How should React prototype states be supplied before Project process contracts exist?
**Recommended**: Isolated typed fixtures, leaving the production renderer unchanged.
**Chosen**: Isolated prototype entry with fixtures.
**Rationale**: Avoids fake IPC and prevents simulated data from masquerading as canonical state.

### Prototype exclusions
**Question**: Are real repository, Git, Run, model, persistence, IPC, and editing behavior excluded?
**Recommended**: Confirm exclusions.
**Chosen**: All confirmed outside this pass.
**Rationale**: The current goal is UX proof; those capabilities require separate vertical architecture and implementation work.

### Right-panel sizing
**Question**: Is the wide-window right panel fixed or adjustable?
**Recommended**: Resizable and collapsible.
**Chosen**: Resizable and collapsible, becoming an overlay when narrow.
**Rationale**: Evidence and review require different amounts of contextual space.

### Final teach-back confirmation
**Question**: Does the consolidated model for Conversation, Frame, context transparency, memory inspection, Review, and map generation match the intended SlopStop experience?
**Recommended**: n/a - mandatory comprehension confirmation
**Chosen**: Confirmed by the developer after the complete teach-back.
**Rationale**: The requirements now reflect the developer's intended end-state rather than only a technically coherent interpretation of individual answers.

## Open Questions

- Exact user-facing labels for the Context proposal, Context record, and their technical detail section remain to be tested in the prototype.
- Exact Project-menu placement and Memory-library layout remain to be exercised without changing the accepted entry-point model.
- Exact glow strength, blur, and transition timing will be settled through visual iteration while preserving reduced motion and focus-only effects.
- Exact labels and order of contextual right-panel tabs will be tuned against the selected fixture state.
- Exact fixture names and copy will be chosen to make the accepted journey understandable without creating new domain truth.

## Suggested Follow-ups

- Design and implement production Project, Files, Run, diff, and model process contracts as separate vertical slices; the current protocol only supports handshake and system status (`packages/protocol/src/protocol.ts:17-72`).
- Design the safe repository and Git boundary before any renderer can read source or Changes; the current preload API exposes only harness state and retry (`apps/desktop/src/shared/desktop-api.ts:3-13`).
- Define persistence ownership and navigation for the Project conversation, Waypoint conversations, and their branches without reintroducing an aggregated Project feed.

## Glossary

| Term | What it means here |
|---|---|
| Activity rail | The narrow vertical bar whose buttons replace the contents of one sidebar. |
| Active Project | The one Project currently opened for navigation and supervision; this is not a new `Selected Project` domain state. |
| Preview tab | A reusable source tab replaced by the next file click unless the user pins it. |
| Project conversation | The primary Project-scoped direct dialogue with the model; it remains separate from operational activity and Waypoint Board events. |
| Waypoint conversation | The direct model dialogue scoped to one Waypoint; its history remains separate from the Project conversation and from operational-event projections. |
| Conversation branch | A non-canonical exploration forked from an exact model-conversation message; it may fork again and remain open, but can influence a revision only through an inspectable user-corrected context selection. |
| Target | The explicit Project or Waypoint to which a composed message applies. |
| Prompt packet | The bounded, inspectable manifest of context approved for one model attempt. |
| Candidate delta | The closed set of Worker changes ready for final review and possible Integration. |
| Provisional diff | A read-only view of in-progress Worker changes that is not yet eligible for approval or Integration. |
| Scope selector | A visible control choosing whether logs belong to one Worker, one Run, the Project, or the application. |
| Overlay | A panel that temporarily covers the center on a narrow window instead of compressing every column. |

## Shared Understanding

**Agreed model (confirmed after final teach-back):** Attention comes first, while direct model dialogue uses a full central `Conversation` surface rather than an activity feed. Every Project has one primary conversation, every Waypoint has its own scoped conversation, and both support freely navigable nested branches. Before branch content influences a revision, the model proposes an inspectable selection that the user may correct. Frame reaches shared understanding before technical planning through a plain-language end-state summary, short user stories, selective Future Walkthroughs, and adaptive prediction questions. The Decision Canvas follows Conversation continuously; coherent decisions become Accepted revisions at natural checkpoints. Full understanding and technical planning open in a separate central `Review` surface, where annotations create visible proposed diffs and final Traceable Mirror coverage exposes lost intent. Before a model attempt the user sees a compact correctable Context proposal; each response preserves the exact Context record. The Project menu opens the Memory library, while Memory Proposals remain non-blocking and appear only there. Final Frame acceptance opens and frames the generated canonical Project map, with Conversation and Review still recoverable. Conversation starts with the right panel collapsed, uses a visible scope breadcrumb and temporary navigator, and follows the carbon and graphite visual direction.

**Corrected during implementation:** `Conversation` moved from the right panel to a permanent center surface, and the spatial blue/violet direction was replaced by carbon and graphite.

**Residual uncertainty (accepted):** Exact Context labels, Project-menu placement details, Memory-library layout, effect intensity, fine contextual-tab naming/order, and fixture copy remain prototype-iteration details; they do not change the confirmed flow or authority boundaries.

## References

- `PRODUCT.md`
- `CONTEXT.md`
- `.rpiv/artifacts/research/2026-08-22_workspace-ux-patterns.md`
- `.rpiv/artifacts/prototypes/waypoint-workspace/index.html`
- `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md`
- `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md`
- `apps/desktop/src/renderer/app.tsx`
- `apps/desktop/src/shared/desktop-api.ts`
- `packages/protocol/src/protocol.ts`
