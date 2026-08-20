---
date: 2026-08-14T15:32:56+0100
author: Pedro Mesquita
commit: d9c49a8
branch: fix/arch-review-helper-paths
repository: rpiv-claude
topic: "Personal multi-agent coding harness refined with Prime Agent, TDD, and onboarding"
tags: [intent, frd, coding-harness, multi-agent, tdd, onboarding, prime-agent, mastra]
status: complete
register: mixed
consensus: confirmed
parent: .rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md
last_updated: 2026-08-14T15:32:56+0100
last_updated_by: Pedro Mesquita
content_hash: cab08b32ac12609d118166e3176bb465d44a5e3d6a5a8380535d63fcd6a56fc1
---

# FRD: Personal Multi-Agent Coding Harness, Refined

## Summary

Build a personal, local-first Electron coding harness where a project galaxy contains Feature star systems and Waypoint planets, while a deterministic application coordinator supervises resumable AI parents and bounded workers. This revision incorporates Prime Agent's strongest operational mechanisms, makes test-first development a configurable and enforceable working discipline, adds a parent-mediated validation/remediation loop, and defines progressive application and project onboarding.

## Problem & Intent

The harness is for **personal development** and should improve **all three together**: continuity and verified memory, visible control of several agent sessions, and non-linear project work. It should feel safe to experiment with agent orchestration while making every action, finding, test, memory, recovery decision, and configuration change inspectable.

The current RPIV pipeline generates useful artifacts but assumes a mostly linear Discover -> Research -> Design/Plan -> Implement flow and repeats code shape across artifacts. The new harness should preserve useful RPIV skills and evidence without reproducing that pipeline. It should also encode the developer's normal test-first approach as actual run policy instead of a weak prompt preference.

## Goals

- Preserve the confirmed Project galaxy -> Feature star system -> Waypoint planet model from the parent FRD.
- Adopt Prime Agent's capability provenance, recovery journaling, typed action queue, change-aware gates, bounded context, worker registry, read-only side questions, readiness checks, and proposal-based refinement.
- Make user steering and lifecycle commands durable, attributable, and visibly delivered rather than ad-hoc chat injection.
- Treat an interrupted side effect as uncertain until a durable result proves otherwise.
- Make test-first preferred the personal default, with project overrides and user-approved one-run exceptions.
- Enforce meaningful red/green/refactor evidence through workspace fingerprints and registered test results.
- Route validator findings through bounded remediation while keeping validator and implementer responsibilities independent.
- Onboard the application and each project separately, asking only about missing or ambiguous choices.
- Support empty, partially initialized, established, and uncertain repositories without overwriting existing setup.
- Reuse ordinary Waypoints and workers for greenfield scaffolding rather than hiding a second execution engine inside onboarding.
- Let agents propose project-first improvements to prompts, skills, worker recipes, and preferences without silently applying them.
- Adopt Oh My Pi's exact-call permission checks, owned isolation lifecycle, dynamic parent-model inheritance, provider-aware prompt compilation, proof-bearing edits, managed process jobs, effect-checked worker recipes, and operator-grade agent inspection.

## Non-Goals

- Recursive workers, autonomous shell loops, or unbounded continuation.
- Automatic executable downloads during onboarding or capability discovery.
- Unconditional injection of every ancestor `AGENTS.md`, `CLAUDE.md`, skill, or tool definition into model context.
- Treating compaction summaries, agent refinement notes, or model agreement as verified memory.
- Treating corrupt persistence as clean or empty state.
- A one-time onboarding wizard that cannot be revisited.
- A hidden onboarding scaffolder with separate permissions, recovery, and audit behavior.
- Automatic configuration or dependency changes in established repositories.
- Requiring strict TDD for every visual, configuration, exploratory, or legacy change when no meaningful test-first seam exists.
- Letting validators modify the code they judge.
- Rerunning an unchanged failing verification command until budget is exhausted.
- `yolo` permissions, automatic model fallback, hidden advisor injection, or silent isolation downgrade.
- Session forks sharing a mutable workspace or automatically trusted repository guidance.
- Treating a generated skill as permission to overwrite an authored skill.
- Multi-user, hosted synchronization, non-Git implementation, Tauri packaging, or required remote observability in the first version.

## Functional Requirements

1. The system SHALL preserve the parent FRD's local-first Project, Feature, Waypoint, run, worker, board, evidence, memory, capability, workspace, and approval entities.
2. One local Git project SHALL be active at a time, with many projects saved.
3. A Project SHALL render as a galaxy, a Feature as a durable star system, a Waypoint as a planet, and active parent/worker sessions as satellites.
4. Frame SHALL use adaptive grilling and structured Decision Canvases to propose Feature and Waypoint maps for user acceptance.
5. Waypoints SHALL retain stable IDs, revisions, creation dates, completion contracts, action prompts, statuses, evidence, memory links, boards, and run history.
6. `blocks`, `related-to`, and `derived-from` SHALL remain the initial canonical Waypoint edge types.
7. Waypoint, run, worker, finding, action, and onboarding-readiness states SHALL use separate fixed status models.
8. Frame, Research, Implement, and Validate SHALL remain the initial actions and SHALL NOT form a mandatory global pipeline.
9. Implementation SHALL pass an evidence gate, gathering research inside the run when accepted evidence is insufficient.
10. Detailed delegation plans SHALL be generated just in time and approved before worker dispatch.
11. The application coordinator SHALL be deterministic software; each active Waypoint SHALL have at most one resumable AI parent run.
12. The parent SHALL perform coordination only; attributed, non-nesting workers SHALL perform repository evidence reads, edits, commands, analyzers, Git operations, and external side effects.
13. Worker recipes SHALL be selected by risk and SHALL be sequential unless the approved plan proves tasks independent.
14. The user SHALL retain full supervision: inspect, message, question, approve, reject, pause, resume, redirect, cancel, and retry.
15. Each Waypoint SHALL retain one durable append-only board containing chat and typed events, with a project activity feed as a projection.
16. Only validated typed commands SHALL change project state; chat text SHALL have no direct state authority.
17. Canonical code evidence SHALL require a harness-issued compound code anchor and stable evidence ID.
18. Code evidence SHALL open current, captured, and diff views and SHALL report exact, moved, changed, historical-only, deleted, ambiguous, or invalid resolution.
19. Verified memory SHALL retain provenance, scope, revision, confidence, verification policy, staleness dependencies, and user governance.
20. Relevant analyzers and skills SHALL be detected lazily and executed only through approved plans.
21. Before a run, the user SHALL choose read-only current checkout, exclusive current-checkout editing, or a Git worktree.
22. Candidate changes SHALL be reviewed before integration into the main branch.
23. Mastra SHALL remain the first runtime behind a project-owned adapter; Electron SHALL remain the first client with a separate TypeScript harness process.
24. Project data and observability SHALL remain local in the first version.

### Prime Agent Operational Mechanisms

25. The capability broker SHALL maintain a catalogue entry for every discovered skill, prompt, tool, extension, analyzer, and external capability.
26. Capability entries SHALL record stable ID, display name, description, source path/package, scope, version, trust state, supported project signals, permission class, diagnostics, and collision state.
27. The model SHALL initially receive only a bounded capability index; detailed instructions and tool schemas SHALL load only after selection and plan authorization.
28. Name or path collisions SHALL be deterministic and visible rather than silently resolved.
29. Repository-owned capabilities and instruction files SHALL remain untrusted until project trust and applicable policy are established.
30. Every mutating coordinator command SHALL be written and durably flushed to a recovery journal before dispatch.
31. The recovery journal SHALL record command ID, actor, approval revision, target project/Waypoint/run/worker, workspace identity, Git baseline, arguments fingerprint, permission scope, and dispatch time.
32. Command completion and client acknowledgement SHALL be separate durable journal records.
33. A received command without a durable completion result SHALL be classified as an uncertain side effect and SHALL NOT be automatically replayed.
34. Malformed or truncated journal state SHALL surface a distinct recovery error and SHALL NOT degrade to clean state.
35. User steering, follow-up, approval, rejection, pause, resume, redirect, retry, cancellation, and side-question requests SHALL be typed durable actions.
36. Durable actions SHALL expose accepted, queued, selected, delivered, running, completed, rejected, cancelled, and failed lifecycle states as applicable.
37. Illegal action transitions SHALL be rejected and recorded rather than inferred from chat.
38. Steering actions SHALL be delivered at safe turn or tool boundaries defined by policy.
39. The supervision UI SHALL show whether each user command is accepted, queued, delivered, or completed.
40. Verification gates SHALL persist the exact command, workspace fingerprint, source revision, timeout, output reference, exit state, and approval scope.
41. A failed verification gate SHALL NOT rerun automatically when the relevant workspace fingerprint is unchanged.
42. A gate MAY rerun after a relevant change, an approved retry, or policy-defined invalidation.
43. Gate command, timeout, output limit, retry limit, and permission SHALL be part of the approved delegation plan.
44. Full board, session, and tool history SHALL remain durable outside model context.
45. Parent and worker context SHALL use bounded handoff packages selected from accepted evidence, decisions, board events, current tasks, verified memory, workspace state, completion conditions, and permissions.
46. Generated compaction or handoff summaries SHALL remain unverified until backed by registered evidence and policy.
47. Every worker SHALL have a stable session ID, readable name, role, parent run ID, model, task, workspace, live activity, token/cost usage, status, and retained history.
48. Worker registry records SHALL remain inspectable after worker completion or failure.
49. The system SHALL provide a read-only "Ask about this run" interaction that does not alter the active run unless the user explicitly converts its result into a steering action.
50. Side questions SHALL use a bounded packet from the current plan, selected board events, accepted evidence, and worker state rather than cloning an unlimited transcript.
51. Parents and workers MAY propose Create/Update/Delete refinements for project prompts, skills, worker recipes, and preferences.
52. Every refinement proposal SHALL contain scope, current revision, proposed diff, evidence, expected effect, evaluation plan/result, and rollback path.
53. Refinement proposals SHALL be project-scoped by default and SHALL require user acceptance.
54. Promotion of an accepted refinement into a cross-project preference SHALL require a separate explicit decision.
55. Refinement writes SHALL use optimistic revision checks and atomic persistence.
56. A corrupt refinement or memory store SHALL surface recovery/conflict state and SHALL NOT silently produce an empty store.

### Test-First Development Discipline

57. Application onboarding SHALL store `test-first preferred` as the default development discipline.
58. Project onboarding MAY override the application default.
59. A delegation plan MAY propose a one-run discipline exception with rationale, alternative proof, and testability impact; the user SHALL approve the exception.
60. The discipline profile SHALL support at least strict TDD, test-first preferred, tests required, and exploration modes.
61. Test-first preferred SHALL require a meaningful test-first plan whenever an automated test can express the behavior.
62. Before creating new red evidence, the run SHALL record the relevant existing test baseline and its workspace fingerprint.
63. Existing baseline failures SHALL be registered separately from the new expected failure.
64. The new test SHALL produce a distinct failure attributable to the missing behavior before production implementation begins, unless an approved exception exists.
65. Red evidence SHALL record test command, expected failure reason, actual output, source/workspace revision, test evidence anchors, and capability version.
66. Production-code mutation for that behavior SHALL remain unavailable until valid red evidence or an approved exception exists.
67. The implementation worker SHALL receive the registered red evidence and SHALL target the smallest approved behavior.
68. Green evidence SHALL run the same relevant test against the expected workspace revision and SHALL record a passing result.
69. Refactoring SHALL preserve green evidence; relevant change SHALL invalidate the prior workspace fingerprint and allow another gate run.
70. Low-risk work MAY use one worker across application-enforced red, green, and refactor phases.
71. Standard or high-risk work SHALL separate test-author and implementation workers and SHALL include independent validation as selected by the approved risk recipe.
72. Red/green loops SHALL use the smallest relevant test command for rapid feedback.
73. Validation SHALL expand according to risk and detected capabilities to broader tests, typecheck, lint, coverage, mutation testing, architecture analysis, or other approved gates.
74. Expensive tools such as mutation testing SHALL execute during risk-appropriate validation rather than every red/green cycle.
75. If meaningful test-first work is not practical, the parent SHALL explain the missing seam and propose either an exception or a derived testability Waypoint.

### Validation And Remediation

76. Validators SHALL report findings and evidence but SHALL NOT modify repository code.
77. Every validation finding SHALL have a stable ID, validator, run, severity, blocking/advisory class, claim, registered evidence, failed completion-contract clause, workspace revision, and lifecycle status.
78. Finding lifecycle SHALL support at least open, assigned, fix-submitted, verified, reopened, deferred, dismissed, and superseded states.
79. The parent SHALL triage findings using registered evidence, completion contract, Waypoint scope, approved permissions, policy, and remaining budget.
80. Blocking in-scope findings MAY enter remediation automatically within the already approved plan and budget.
81. A finding lacking a suitable regression test SHALL first route to a test-author worker when test-first policy applies.
82. Remediation workers SHALL receive bounded handoffs containing the finding, contract clause, evidence, relevant diff, test result, permission scope, budget, and workspace revision.
83. A fix submission SHALL NOT close a finding.
84. The original or a fresh independent validator SHALL recheck the same finding ID against the new workspace revision.
85. A failed recheck SHALL reopen the finding and MAY trigger another bounded remediation round.
86. Every delegation plan SHALL define remediation-round, worker, command-time, and cost limits.
87. Exceeding remediation limits with blocking findings SHALL move the run to waiting-for-user and preserve all remaining findings.
88. Valid findings outside the current Waypoint scope SHALL become proposed derived Waypoints and SHALL NOT silently expand current scope.
89. Dismissal, accepted risk, contract revision, or budget expansion SHALL require visible user rationale and a typed event.

### Application And Project Onboarding

90. Onboarding SHALL have separate, re-runnable application and project layers.
91. Application onboarding SHALL configure model providers/credentials, local storage/privacy, default development discipline, model/budget defaults, approval/autonomy preferences, and preferred external editor.
92. Project onboarding SHALL configure trust, readiness, detected runtime/framework/package manager, test commands/baseline, skills, analyzers, sandbox support, project discipline override, and capability catalogue.
93. Onboarding SHALL be progressive: only credentials, storage, Git/trust, and safe defaults SHALL gate entry; optional decisions SHALL appear when first relevant.
94. The UI SHALL keep incomplete onboarding/readiness visible without repeatedly asking settled questions.
95. Onboarding profile changes SHALL be versioned and auditable.
96. Active runs SHALL retain the approved profile snapshot unless the user explicitly reapplies a changed policy.
97. "Create new" and "Open existing" SHALL express user intent but SHALL NOT determine trust or write permission by themselves.
98. Every project SHALL begin with a read-only readiness scan.
99. The scan SHALL propose one of empty, initialized, established, or unknown/untrusted states using registered evidence.
100. The user SHALL confirm or correct the proposed readiness classification before setup permissions are granted.
101. Empty classification SHALL allow one approved foundation plan to create named files and install named dependencies.
102. Initialized classification SHALL preserve detected Git, framework, test, and package configuration and SHALL plan only missing or conflicting pieces.
103. Established classification SHALL remain read-only by default for configuration and dependency changes and SHALL require exact diff approval.
104. Unknown/untrusted classification SHALL prohibit execution and writes until uncertainty is resolved.
105. The scan SHALL NOT execute untrusted repository scripts or automatically download/install tools.
106. Configuration edits, source edits, test edits, dependency installation, command execution, network access, and Git integration SHALL be separate permission categories.
107. Existing configuration SHALL be registered as evidence before a worker proposes modifications.
108. Configuration workers SHALL prefer minimal merge/update behavior and SHALL NOT silently replace compatible setup with templates.
109. A greenfield project flow SHALL create a local project record, confirm or initialize Git, apply the application profile, run Frame, and propose the initial galaxy.
110. Actual project scaffolding SHALL execute through the normal Waypoint parent/worker, approval, board, journal, TDD, validation, and recovery mechanisms.
111. The initial foundation Waypoint SHOULD establish a runnable project, test framework, passing smoke test, formatter/typecheck commands, capability refresh, and clean baseline as applicable.
112. After scaffolding or configuration changes, the readiness scan and capability catalogue SHALL rerun against the resulting files.

### Oh My Pi Execution And Operator Mechanisms

113. Every worker tool call SHALL pass through a project-owned permission resolver after argument normalization and again after any extension or policy rewrite.
114. The tool-call record SHALL preserve original and final arguments/hashes, rewrite source, original and final effect/risk classification, matched plan permission, approval decision, and recovery-journal command ID.
115. A rewritten call MAY proceed without fresh approval only when its final normalized arguments remain inside the approved scope and have equal or lower effect/risk.
116. A material change to target, command, permission, network use, configuration, dependency, Git behavior, or side effect SHALL require fresh approval.
117. Worktree isolation SHALL capture HEAD, staged, unstaged, and untracked user state before worker execution.
118. Every isolated workspace SHALL have a durable ownership record containing run, worker, process identity, process-start identity where available, baseline, and lifecycle status.
119. Isolated workers SHALL be prevented from mutating the parent checkout's index, HEAD, or refs.
120. Integration SHALL use a captured worker-only delta against the recorded baseline.
121. Cleanup SHALL verify ownership is no longer live and that the workspace is integrated, discarded, or otherwise explicitly resolved.
122. Failure to create or verify the selected isolation mode SHALL block and ask; the system SHALL NOT silently fall back to a weaker workspace mode.
123. Each run SHALL snapshot a default parent model and MAY define explicit worker or role model overrides.
124. A worker with an explicit model SHALL use it; otherwise a worker with a role override SHALL use that role model; otherwise it SHALL inherit the Waypoint parent's current model at dispatch time.
125. A parent `/model` change SHALL affect subsequently dispatched inheriting workers but SHALL NOT mutate models of already-started attempts or explicit overrides.
126. Every worker attempt SHALL record the concrete provider/model used after dispatch-time resolution.
127. Model unavailability SHALL stop the affected parent or worker and append a typed warning containing role, provider/model, resolution source, reason, checkpoint, completed effects, uncertain effects, and available recovery actions.
128. The system SHALL NOT select a fallback model automatically.
129. `/model` and the graphical model picker SHALL submit the same typed model-change action.
130. Using `/model` on a stopped worker SHALL affect only that worker and SHALL create a linked replacement attempt with a revised run profile and provider-recompiled prompt packet.
131. If the Waypoint parent's model is unavailable, active workers MAY finish their current bounded task or reach the next safe boundary, but no new worker SHALL launch and results SHALL queue until the parent recovers.
132. The prompt-packet compiler SHALL deterministically assemble action prompt revision, worker role/task, trusted guidance, accepted board entries, registered evidence, verified memory, completion contract, selected capabilities, permissions, budgets, and provider/model profile.
133. Every compiled prompt packet SHALL retain a source manifest, inclusion/exclusion reason, trust/scope, token contribution, provider delivery mode, and deterministic output hash.
134. The approval UI SHALL show the prompt manifest and allow expandable source content, permitted removal, and pinning before dispatch.
135. Project context files SHALL enter prompt packets only through explicit trust and inclusion policy.
136. Ordinary code changes SHALL use proof-bearing structured edit operations with expected preimage, unique text/syntax target, replacement, workspace revision, actor, and reason/finding link.
137. Structured edits SHALL reject stale preimages and ambiguous targets, apply atomically, preserve relevant encoding/line-ending behavior, and record before/after hashes, diff, diagnostics, worker, workspace, and evidence IDs.
138. Formatters, generators, scaffolds, migrations, lockfile changes, and codemods MAY use declared mutating process jobs with a complete before/after workspace delta.
139. A mutating process job that changes paths or effect categories outside approval SHALL stop as a scope violation and SHALL NOT silently include those changes.
140. Every command SHALL be represented as a managed ProcessJob with command fingerprint, workspace/cwd, environment policy, PTY/background mode, timeout, output cap, process ownership, stdout/stderr artifacts, terminal state, and cleanup state.
141. Process-job terminal states SHALL distinguish success, non-zero exit, timeout, user cancellation, steering interruption, disappeared process, and unknown-after-crash.
142. Worker recipes SHALL declare capability effects including at least repository read/write, test write, configuration write, process execution, network access, Git write, memory propose/verify, and project-state update.
143. Recipe approval and runtime execution SHALL both verify that every selected capability is compatible with the worker role and approved effect set.
144. Unknown extension or MCP capabilities SHALL fail closed as potentially mutating until explicitly classified.
145. The Electron galaxy SHALL project the same registry/action/job/board data into spatial, parent-tree, timeline, and transcript views.
146. Every parent and worker inspector SHALL expose status, lineage, current intent/task, current tool/job, last activity, blocker, model source/concrete model, tokens/cost, elapsed time, context pressure, workspace, unread entries, and artifacts where available.
147. Telemetry values SHALL be labeled live, persisted, estimated, unavailable, or otherwise provenance-qualified; the UI SHALL NOT invent a composite health score.
148. Transcript and prompt-manifest inspection SHALL be available before the user sends a steering action.
149. Agent-generated skills and refinements SHALL be stored separately from authored resources and SHALL retain project scope, generated provenance, proposal, evidence, evaluation, accepted revision, and rollback history.
150. A generated resource SHALL NOT overwrite or claim an authored resource name without an explicit rename/conflict decision.
151. Refinement execution/evaluation records, measured results, and user acceptance/rejection SHALL remain separate records.
152. Raw experiment or gate output SHALL remain linked to parsed metrics; suspect evidence MAY be flagged and excluded without deletion.
153. Session forks, visual branch compass/rewind reports, automated isolated refinement experiments, noise-aware benchmark confidence, and full generated-skill experiment workflows SHALL be extension points after the first resilient proof.

## Non-Functional Requirements

- **Performance**: The action queue, worker registry, board, and verification UI must remain responsive during two concurrent Waypoint parents. Gate output, session history, and capability catalogues must be paged or bounded; unchanged failed gates must not consume repeated model or command budget.
- **Security**: Discovery is not authorization. Repository instructions, skills, extensions, MCP tools, configuration, and scripts are untrusted until policy permits them. Every side effect is journaled before dispatch. Established-project configuration and dependencies require exact approval. Automatic executable downloads and recursive agent capability are prohibited.
- **UX / Accessibility**: Onboarding, TDD phase, action delivery, gate evidence, finding remediation, prompt packets, process jobs, model failures, and refinement proposals must be visible in both the project-galaxy UI and keyboard/plain-text equivalents. Readiness scans explain evidence and allow correction rather than presenting opaque classifications. Spatial, tree, timeline, and transcript views must expose the same authoritative state.
- **Reliability**: Received-without-result commands are uncertain, not replayable. Corrupt journals, memory, or refinement state remain visible failures. Test evidence, edits, jobs, and findings are bound to workspace revisions. Active run profiles remain stable across settings changes and restart. Isolation failure and model unavailability stop visibly rather than degrading to weaker behavior.

## Constraints & Assumptions

- The parent FRD remains the baseline for the product galaxy, Frame, memory, evidence, board, workspace, runtime, and UI model.
- Prime Agent is a source of implementation patterns, not a runtime dependency or domain model.
- Prime Agent paths in this artifact refer to `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main`.
- The first runtime remains Mastra, but the coordinator, action queue, recovery journal, capability catalogue, findings, TDD policy, and onboarding profiles are project-owned modules.
- Application and project onboarding are for one personal user in the first version, but profile separation must not assume one repository configuration fits every project.
- Test-first enforcement depends on detected test capabilities and registered evidence; inability to test is a visible exception path, not silent permission to skip tests.
- Local observability remains the first-version choice.

## Acceptance Criteria

- [ ] Application onboarding stores test-first preferred, model/budget defaults, privacy, approval preferences, and editor in a versioned profile.
- [ ] Creating or opening a project performs a read-only scan and displays registered evidence for an empty, initialized, established, or unknown proposal before the user confirms it.
- [ ] An initialized Astro/Vitest repository preserves existing setup and proposes only proven gaps.
- [ ] An established repository cannot receive a configuration or dependency change without an exact diff and explicit permission.
- [ ] A greenfield project reaches scaffolding through an accepted foundation Waypoint rather than hidden onboarding execution.
- [ ] The capability catalogue shows source, scope, version, trust, diagnostics, and collisions while the parent initially receives only compact entries.
- [ ] An analyzer detected from project files is visible but unavailable to workers until an approved plan grants it.
- [ ] A Pause, Redirect, Follow-up, Retry, or Cancel command visibly moves through queued/delivered/completed or another valid terminal lifecycle.
- [ ] Killing the harness after a mutating command receipt but before a result creates an uncertain-side-effect recovery record and does not replay the command automatically.
- [ ] A malformed trailing journal record produces a visible recovery diagnostic and does not appear as clean state.
- [ ] "Ask about this run" returns a read-only answer without changing board, run, Waypoint, workspace, or worker state unless converted into a steering command.
- [ ] A test-first implementation records baseline failures, creates a distinct expected red bound to a workspace fingerprint, then records green for the same behavior.
- [ ] Attempting production mutation before red evidence is rejected unless the approved run profile contains an explicit exception.
- [ ] An unchanged failing test is not rerun automatically; modifying relevant files invalidates the fingerprint and permits another gate run.
- [ ] Low-risk work can complete red/green/refactor in one worker, while a high-risk plan visibly separates test author, implementer, and validator.
- [ ] Deep validation expands from targeted tests to the approved broader tests, typecheck, lint, mutation, or analyzer capabilities without running every expensive gate in each red/green cycle.
- [ ] A validator posts a stable blocking finding with registered evidence and cannot edit code.
- [ ] The parent routes an in-scope blocking finding through test authoring if required, remediation, fix submission, and independent re-verification under the same finding ID.
- [ ] A finding outside scope appears as a proposed `derived-from` Waypoint and does not expand the current completion contract silently.
- [ ] Exhausting remediation limits moves the run to waiting-for-user with remaining findings, evidence, and available actions visible.
- [ ] An agent refinement proposal shows project scope, before/after diff, evidence, expected effect, evaluation, revision, and rollback before acceptance.
- [ ] Accepting a project refinement does not change cross-project preferences without a second explicit promotion decision.
- [ ] The revised two-Waypoint proof demonstrates readiness onboarding, TDD red/green, validation remediation, one queued steering/side-question interaction, crash journaling, capability provenance, and one reviewed refinement proposal.
- [ ] Rewriting an approved tool call into a materially broader command or target triggers fresh approval against the final argument fingerprint.
- [ ] A worktree run preserves dirty parent state, records ownership, prevents parent Git metadata mutation, captures only worker changes, and refuses cleanup while ownership is live.
- [ ] Failure to create the selected isolation mode stops the run and does not fall back to the current checkout.
- [ ] An inheriting worker uses the parent's concrete model at dispatch; changing the parent with `/model` affects only future inheriting workers.
- [ ] Model unavailability stops visibly with Retry, `/model`, and Cancel; `/model` creates a linked replacement attempt for only the selected worker.
- [ ] Parent-model unavailability prevents new dispatch while active workers finish only to a safe boundary and queue their results.
- [ ] Before worker approval, the UI shows a prompt manifest with source, trust, inclusion reason, token contribution, hash, and expandable content.
- [ ] A structured edit with a stale preimage or ambiguous target is rejected without modifying the file.
- [ ] An approved formatter job that unexpectedly changes an unapproved configuration file stops as a scope violation and exposes the complete delta.
- [ ] A managed test process can be cancelled, times out distinctly, retains bounded stdout/stderr artifacts, and cleans up owned processes.
- [ ] A worker recipe labeled non-mutating is rejected when it contains an unknown or write-capable tool.
- [ ] Galaxy, tree, timeline, and transcript views show consistent worker identity, lineage, status, model, activity, job, cost, context, workspace, and provenance-qualified metrics.
- [ ] An accepted generated-skill refinement remains separate from an authored skill and cannot overwrite an authored name.

## Recommended Approach

Keep the parent FRD's framework-independent TypeScript project kernel and Mastra adapter, then add project-owned capability catalogue, typed action queue, write-ahead recovery journal, worker registry, test-discipline policy, finding/remediation engine, refinement proposal store, and versioned onboarding profiles. Reuse the existing Waypoint, board, evidence, memory, approval, workspace, and Electron galaxy UI so these mechanisms deepen one product rather than creating parallel execution systems.

## Decisions

### Inherit the confirmed product model
**Question**: Should the previously confirmed personal harness, galaxy, Feature, Waypoint, parent/worker, board, evidence, memory, workspace, Mastra, and Electron decisions remain the baseline?
**Recommended**: Preserve the confirmed parent FRD and refine it through a new artifact.
**Chosen**: Preserve the parent FRD; this document adds Prime Agent, TDD, validation, and onboarding requirements.
**Rationale**: The developer confirmed the prior teach-back, then requested further discussion rather than replacement.

### Prime Agent transfer scope
**Question**: Which Prime Agent ideas should enter the first product scope?
**Recommended**: Operational core, deferring self-improving prompts and skills.
**Chosen**: Include capability provenance, recovery journals, typed action queue, change-aware verification, bounded handoffs, worker registry, side questions, readiness onboarding, and refinement proposals.
**Rationale**: The project is personal and intentionally experimental, while user acceptance and project-first scope constrain refinement risk.

### Reject recursive and unsafe Prime behaviors
**Question**: Which Prime Agent assumptions conflict with the confirmed harness?
**Recommended**: Preserve the no-nesting, approved-plan, verified-memory, and distinct-failure rules.
**Chosen**: Do not copy recursive RLM agents, autonomous shell loops, automatic binary downloads, unconditional ancestor guidance injection, session notes as trusted memory, or malformed-state fallback to empty.
**Rationale**: These mechanisms conflict with bounded workers, explicit approval, local trust, verified memory, and `degrade-distinguishes-broken`.

### Two onboarding layers
**Question**: Should onboarding be split into re-runnable application and per-project layers?
**Recommended**: Two onboarding layers.
**Chosen**: Application onboarding for personal defaults and project onboarding for repository evidence, tools, tests, trust, and overrides.
**Rationale**: Avoids repeating personal setup while preventing one repository's assumptions from applying to every project.

### Progressive onboarding
**Question**: Must every onboarding choice be completed before entering the project galaxy?
**Recommended**: Progressive with readiness gates.
**Chosen**: Require only credentials, storage, Git/trust, and safe defaults upfront; defer optional decisions until relevant.
**Rationale**: Reduces wizard fatigue without leaving critical safety and cost choices implicit.

### Evidence-driven readiness
**Question**: Should project onboarding trust the user's new/existing choice or detect repository state?
**Recommended**: Read-only detection followed by user confirmation.
**Chosen**: User choice expresses intent; a registered-evidence scan proposes empty, initialized, established, or unknown/untrusted, and the user confirms it before permissions.
**Rationale**: A new project may already contain Git, Astro, or Vitest, while an existing path may be empty; neither entry label safely determines write authority.

### Greenfield scaffolding
**Question**: How should a new project be scaffolded?
**Recommended**: Through an ordinary setup Waypoint.
**Chosen**: Onboarding creates/recognizes Git, profile, Frame record, and galaxy; the first approved foundation Waypoint performs gap-driven scaffolding.
**Rationale**: Reuses one approval, recovery, board, TDD, and worker engine instead of hiding a second implementation path in onboarding.

### Configuration permissions
**Question**: How should onboarding handle existing project configuration?
**Recommended**: Classify readiness and require stronger permission for established repositories.
**Chosen**: Configuration and dependency changes are distinct permission categories; established projects require exact diff approval and compatible setup is preserved.
**Rationale**: Configuration changes can break an established repository even when ordinary source edits are safe.

### Development-discipline inheritance
**Question**: At which levels should the TDD approach be configurable?
**Recommended**: Application default, project override, and one-run exception.
**Chosen**: Application default -> project override -> parent-proposed, user-approved run exception.
**Rationale**: Preserves a consistent personal preference while allowing prototypes, legacy seams, and unusual tasks to explain exceptions.

### Default test discipline
**Question**: Which development discipline should onboarding select by default?
**Recommended**: Test-first preferred.
**Chosen**: Test-first preferred.
**Rationale**: Matches the developer's normal TDD practice while avoiding brittle strict enforcement where a meaningful test-first seam does not exist.

### TDD exception authority
**Question**: Who may decide meaningful test-first coverage is not practical?
**Recommended**: Parent proposes, user approves.
**Chosen**: Parent explains the missing seam and alternative proof; user approves the run exception.
**Rationale**: Prevents agents from bypassing difficult tests while allowing justified exceptions.

### Existing failing tests
**Question**: How should TDD work when the project already has failures?
**Recommended**: Record baseline and prove a distinct new red.
**Chosen**: Register existing failures separately, then require the new test to introduce an expected failure attributable to missing behavior.
**Rationale**: Avoids blocking on unrelated debt without mistaking an existing failure for valid red evidence.

### TDD worker separation
**Question**: Should test authoring and implementation use separate workers?
**Recommended**: Risk-based separation.
**Chosen**: Low-risk work may use one phase-constrained worker; standard/high-risk work separates test author, implementer, and independent validator.
**Rationale**: Balances cost with protection against weakening tests to fit implementation.

### Test depth
**Question**: How should expensive test tools fit the TDD loop?
**Recommended**: Fast loop, deep validation.
**Chosen**: Use the smallest relevant command for red/green and expand tests, coverage, mutation, typecheck, lint, and analyzers according to validation risk.
**Rationale**: Keeps TDD responsive while preserving strong completion evidence.

### Validation remediation
**Question**: How should issues found by a validator be fixed and communicated?
**Recommended**: Bounded parent-mediated remediation with independent re-verification.
**Chosen**: Automatically remediate in-scope blocking findings within approved limits, route test gaps to a test author, require independent closure, propose derived Waypoints for out-of-scope findings, and return exceptions to the user.
**Rationale**: Keeps validator and implementer roles independent without interrupting the user for routine defects.

### Refinement governance
**Question**: How should agent-proposed prompt, skill, worker-recipe, and preference improvements be governed?
**Recommended**: Project-first proposals.
**Chosen**: Versioned project-scoped proposals with evidence, diff, expected effect, evaluation, conflict checks, rollback, and user acceptance; cross-project promotion is separate.
**Rationale**: Enables experimentation and learning without allowing one project's assumptions to silently affect all future work.

### Oh My Pi transfer scope
**Question**: Which Oh My Pi mechanisms should enter the first requirements scope?
**Recommended**: Adopt the execution/operator core now and defer forks and automated refinement experiments.
**Chosen**: Adopt exact-call permission checks, owned isolation, model-role policy, prompt compiler, proof-bearing edits, managed process jobs, effect-checked recipes, Hub supervision, and managed refinement storage; defer forks/experiments.
**Rationale**: These mechanisms deepen safety, context reproducibility, TDD execution, and supervision without adding a second runtime or expanding the first proof into an experiment platform.

### Material tool-call rewrites
**Question**: If policy or an extension rewrites an approved tool call, when should fresh approval be required?
**Recommended**: Reapprove material change.
**Chosen**: Proceed only when final normalized arguments remain within scope and equal/lower risk; reapprove material target/effect/risk expansion.
**Rationale**: Avoids approval noise for harmless normalization while binding consent to the command that will actually execute.

### Prompt inspection
**Question**: How visible should a compiled prompt packet be before dispatch?
**Recommended**: Manifest plus expandable content.
**Chosen**: Show source, trust, scope, token contribution, hash, inclusion reason, and expandable actual content with permitted pin/removal controls.
**Rationale**: Makes context engineering debuggable without forcing a full prompt wall before every session.

### Isolation fallback
**Question**: What happens if selected workspace isolation cannot be created or ownership verified?
**Recommended**: Block and ask.
**Chosen**: Block and ask; never silently fall back to a weaker mode.
**Rationale**: A less safe workspace is a material change to the approved execution contract.

### Structured file mutation
**Question**: How should workers be allowed to change files?
**Recommended**: Proof-bearing structured edits first, with declared mutating process jobs for tools that legitimately write files.
**Chosen**: Structured edits first; process jobs require full before/after delta and scope validation.
**Rationale**: Preserves stale-write protection and edit attribution while supporting formatters, generators, migrations, lockfiles, and codemods.

### Dynamic parent-model inheritance
**Question**: How should unspecified worker models inherit defaults?
**Recommended**: Initially proposed snapshotted run default with explicit overrides.
**Chosen**: Explicit worker model, then role override, otherwise inherit the Waypoint parent's current model at dispatch time.
**Rationale**: Matches familiar subagent behavior while recording the concrete model per attempt; parent changes affect future inheriting workers only.

### Model unavailability and `/model`
**Question**: What happens when a parent or worker model is unavailable?
**Recommended**: No automatic fallback; stop and let the user Retry, choose `/model`, or Cancel.
**Chosen**: Stop with a typed visible warning. `/model` changes only the selected worker through a linked replacement attempt. If the parent fails, active workers finish only to a safe boundary and no new workers launch.
**Rationale**: Preserves user control, provider/privacy/cost intent, and audit history instead of silently substituting behavior.

## Open Questions

None. Numeric default budgets, exact onboarding readiness heuristics, test-command detection, capability trust scoring, and journal storage format are technical research/design questions rather than deferred intent decisions.

## Suggested Follow-ups

- Evaluate Prime Agent's daemon protocol and compact stream reconstruction when designing Electron process reconnect behavior.
- Compare Prime Agent's JSONL journals with SQLite transactional/outbox designs for the coordinator's command and recovery store.
- Prototype change-aware Vitest and Stryker gates against a repository with existing failures.
- Evaluate whether a future onboarding import can translate existing OpenCode/Claude provider, skill, and editor settings with explicit consent.
- Prototype Oh My Pi-style synthetic worktree baselines against dirty parent repositories and nested Git repositories.
- Evaluate session forks, branch-compass UI, and automated refinement experiments only after the first resilient proof passes.

## Glossary

| Term | What it means here |
|---|---|
| Capability catalogue | The provenance-aware inventory of skills, tools, prompts, analyzers, and extensions that may become available to a run. |
| Lazy disclosure | Showing a compact capability description first and loading detailed instructions or schemas only when selected. |
| Recovery journal | A durable write-ahead record of commands, results, and acknowledgements used to distinguish safe completion from uncertain interruption. |
| Uncertain side effect | A command known to have started but lacking durable proof of whether it completed; it cannot be blindly repeated. |
| Durable action queue | The typed lifecycle for user steering, approvals, retries, cancellation, and other controls from acceptance through completion. |
| Workspace fingerprint | A Git/diff/untracked-file identity binding a test or tool result to the exact code state it evaluated. |
| Change-aware gate | A verification command that reruns only after relevant workspace change, invalidation, or explicit retry. |
| Development discipline | The versioned policy controlling whether work uses strict TDD, test-first preferred, tests required, or exploration behavior. |
| Red evidence | Registered proof that a new test fails for the expected missing behavior against a known baseline and workspace state. |
| Green evidence | Registered proof that the same behavior test passes after implementation against the expected workspace state. |
| Remediation loop | The bounded sequence where a parent routes a validation finding through test proof, implementation, and independent re-verification. |
| Readiness classification | The user-confirmed empty, initialized, established, or unknown/untrusted state proposed by a read-only project scan. |
| Application profile | Versioned personal defaults for providers, privacy, development discipline, budgets, approvals, and editor. |
| Project profile | Versioned repository-specific trust, capabilities, tests, tools, sandbox, and overrides inheriting from the application profile. |
| Refinement proposal | A reviewed, versioned suggestion to improve a prompt, skill, worker recipe, or preference without changing it automatically. |
| Side question | A read-only question about an active run that does not steer or alter execution unless explicitly promoted to an action. |
| Permission resolver | The module that classifies the final normalized tool call and verifies it remains inside the approved plan before execution. |
| Isolation owner | The durable run/process identity proving who owns an isolated workspace and whether cleanup is safe. |
| Model role | A semantic worker purpose such as test-author or validator that may select a model before falling back to parent inheritance. |
| Prompt packet | The deterministic, hashed context compiled for one parent or worker from trusted and approved sources. |
| Structured edit | A file mutation carrying an expected preimage and unambiguous operation so stale or ambiguous writes fail safely. |
| Mutating process job | A managed command expected to write files, with declared scope and complete workspace delta capture. |
| Process job | A cancellable, timed, output-bounded command with durable process ownership and distinct terminal states. |
| Capability effect | A machine-readable side-effect class such as repository write, process execution, network access, or Git write. |
| Agent Hub projection | Spatial, tree, timeline, and transcript views derived from the same authoritative worker and run records. |

## Shared Understanding

**Agreed model (in the developer's words):** The personal project galaxy remains the product foundation. Prime Agent contributes durable control through lazy capability provenance, action delivery, recovery journals, change-aware verification, bounded handoffs, inspectable workers, side questions, readiness checks, and reviewed self-improvement proposals. Oh My Pi deepens exact execution through final-argument permissions, owned isolation, dynamic parent-model inheritance, inspectable prompt packets, proof-bearing edits, managed process jobs, effect-checked recipes, and richer operator views. Test-first preferred is enforced through registered red/green evidence and risk-based workers. Validators report findings into a parent-managed remediation loop rather than fixing their own work. Application onboarding stores personal defaults; project onboarding scans and confirms each repository's actual readiness; greenfield setup happens through visible Waypoints rather than hidden wizard code.

**Corrected during teach-back:** Project readiness is not inferred solely from whether the user selected new or existing; a read-only evidence scan proposes the state and the user confirms it. New projects may already have Git, Astro, Vitest, or other setup. Established repository configuration and dependency changes need stronger explicit permission. Prime's refinement proposals are included in first-product scope but remain project-first and user-approved. Unspecified workers inherit the parent's current model at dispatch rather than a fixed run default. No model fallback is automatic; `/model` changes only the stopped worker. Isolation never silently degrades.

**Residual uncertainty (accepted):** Exact readiness heuristics, storage/journal technology, default budgets, test discovery rules, and capability trust scores will be resolved through research and prototypes. These do not change the agreed onboarding, TDD, validation, or recovery behavior.

## References

- `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md` - confirmed baseline requirements and decisions.
- `.rpiv/artifacts/research/2026-08-14_12-09-42_custom-coding-harness-options.md` - SDK and architecture option research.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/README.md:31-99` - Prime Agent goals and top-level capabilities.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/resource-loader.ts:336-679` - resource provenance, discovery, and loading.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/skills.ts:442-632` - compact skill index, validation, and collision handling.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/modes/daemon/command-recovery-journal.ts:48-184` - write-ahead command recovery.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/session-action-store.ts:7-233` - durable steering/follow-up lifecycle.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/autonomous.ts:273-443` - change-aware verification gates.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/compaction/compaction.ts:28-145` - bounded context and compaction.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/refinement/refinement.ts:123-205,281-519` - structured refinement proposals and bounded rendering.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/side-question.ts:24-158` - read-only side questions.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/modes/interactive/onboarding.ts:21-45` - readiness-driven first-run onboarding.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/tools/approval.ts:104-219` - argument-aware permission resolution.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/task/worktree.ts:151-252,422-471` - isolation baseline, delta, and lifecycle.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/task/isolation-ownership.ts:1-106` - isolation ownership markers.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/config/model-roles.ts:22-66` - semantic model roles.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/system-prompt.ts:671-885` - provider-aware prompt construction.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/edit/modes/replace.ts:1062-1189` - stale-safe structured edits.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/tools/bash.ts:57-118,798-1180` - managed command execution.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/docs/agent-hub.md:24-80` - worker roster, lineage, telemetry, transcripts, and controls.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/autoresearch/storage.ts:425-498` - separate experiment execution, result, and acceptance records.
- `skills/_shared/store.mjs:334-435,613-615,675-693` - existing RPIV finding IDs, gates, and retire-not-delete precedent.
