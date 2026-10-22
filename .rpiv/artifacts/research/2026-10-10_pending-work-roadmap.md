---
date: 2026-10-10T09:00:00+0100
author: coordenador-claude (Claude Code), for Pedro Mesquita
commit: e44236d
branch: main
repository: slopstop
topic: "Pending-work inventory and roadmap reference point"
tags: [roadmap, inventory, pending-work, deferred]
status: complete
last_updated: 2026-10-19T14:40:00+0100
last_updated_by: coordenador-claude
content_hash: 6bb8c30854d729d014b043cc8322d28043923895e13d7ae284ecf44e1efdb07b
---

# Pending-work inventory and roadmap reference point (2026-10-10)

## Status and rules

- **Purpose.** The user asked (2026-10-10) for one reference point of everything still to do. It consolidates three read-only sweeps: GitHub issues (open, and deferrals in closed issues), the ADRs with PRODUCT.md, CONTEXT.md and DESIGN.md, and the rpiv artifacts (FRDs, designs, plans, evidence, the decisions log).
- **Not a plan.** This is an inventory. Implementation still starts only from an accepted design converted into a phased plan (`docs/agents/issue-tracker.md`, Implementation Roadmap Operations). Order below is the user's agreed order where one exists, otherwise #85's delivery order.
- **Keep it current.** Update this file when items close or appear. Untracked items get GitHub issues on 2026-10-10; see the "Issues created" section.
- Abbreviations: DL = `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md`; C1D = `.rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md`.

## Naming (2026-10-10)

"Feature" is now **Strand** and the map's whole-Project view "Saga" is now **Weave**; the one-Strand view is called Strand (DL §30). "Waypoint parent" is now **Forger** (ADR 0021). Accepted ADR text keeps the former names with a note (`CONTEXT.md` Former Names). **Naming rule:** new code uses Strand, Weave and Forger. There is no separate code rename slice: code has no `Feature` or `WAYPOINT_PARENT_*` identifiers, only about 16 mentions in `apps/desktop/src/renderer/prototype/*` that leave with the React port, and schema renames are not possible with the current upgrade engine (C1D:77).

## Ordered roadmap

Revision 2 (2026-10-10), after an adversarial completeness and ordering review; status refreshed on 2026-10-19 (revision 3). Each phase starts when the previous one is done unless marked "in parallel"; reasons are in brackets. Sections 3-7 hold the detail and sources. ADR line numbers refer to the files after commits d601e5b and e44236d.

**Where we are (2026-10-19):** Phases 0 and 1 are done. Phase 2: #99 and the #105 research are done; #123 Part A is in progress at s6 (branch `refactor/123-effect-lifecycle-part-a`, worktree `slopstop-123`). Local main is 32 commits ahead of origin; the push waits for the user (DL §87, §101).

### Phase 0 — done
1. **Done 2026-10-10:** C1 S1 + S2 squash-merged to local main as `ba4e15b` after review rounds 1-2 and a user-approved bounded round 3 (DL §32); final-head proof on ac6569c. The real `userData` was backed up first to `%APPDATA%SlopStop-backup-2026-10-10` (67 files, hashes verified).
2. **Documentation consistency:** done on 2026-10-10 (d601e5b section-7 corrections, e44236d Strand/Weave sweep; prototypes and Figma by the ui-ux agent). Remaining: the #1 map paragraph.
3. **Done 2026-10-10:** GitHub issues for untracked items (see "Issues created").
4. **Done 2026-10-10:** main pushed (origin/main 7a1b041) on the second attempt; the first failed on #94 registration timeouts under load (push-main-7), the retry on an idle machine passed (push-main-8). The C1 branch and worktree were deleted.
5. **Done 2026-10-11: #94** timeouts under load, squash-merged as `f45de07` after its final `check:deep` (DL §53).

### Phase 1 — Conversation C1, done
1. **Done 2026-10-10:** S3 squash-merged to local main as `34b7477` (rounds 1-2 plus a bounded round 3, DL §40-§41; #102 fixed inside it): protocol v8, coordinator admission, runtime; `WRITER_CLIENT_ABANDON_FAILED` (6a); read-after-abandonment routing (U2, CNV-B13).
2. **Done 2026-10-15:** S4 bridge, IPC, preload, renderer, built in React (`c8a72d1`, pushed; #108 and #130 closed; DL §51-§65). The bridge kept its Promise core as the temporary G28 exception, which ends in #123 Part A (DL §46).
3. **Done 2026-10-15:** S5 the real-app journey (`67f59fc`, plus the e2e race fix `8fcee45`; DL §66-§72).
4. **Close-out, done 2026-10-16:** #110 split of `project-storage-node-adapters.ts` (`ff162f5`, DL §73-§87). The C1-gate carry-forward review (DL §88) moved the nine deferred rows and the licence check to **#134**, and opened **#133** (log a successful upgrade, prove the harness-to-desktop log link in the real app). The multi-process storage survey opened **#135** (DL §89).

### Phase 2 — after C1, before C2 (in progress)
[The foundations come before C2 because C2's streaming and cancellation are heavy Effect code.]
1. **Done 2026-10-16: #99 interview** continuation: phase 2 dialogue and decision staleness (FRD `discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md`, DL §90-§101; ADR amendments accepted). Still open from it: where technical agreements are stored (the user is thinking about it, DL §90).
2. **#105 TypeScript 7 and the Effect language service.** Research done 2026-10-18 (`research/2026-10-18_20-08-00_typescript-7-and-effect-tsgo-gate.md`, DL §134). The curated Effect diagnostics gate is built as #123 Part A s5b (`pnpm check:effect`, inside `pnpm check` and CI). **Remaining:** the TS 7 compiler-switch slice with the alias layout, on main **after Part A integrates** (DL §134.1); it also fixes the s5b residuals R2-1 and R2-2. Until then `pnpm typecheck` (TS 6.0.2) is authoritative. [Out of order: #123 s1-s5 ran before #105, a coordinator error; the user placed #105 before s6, DL §129.]
3. **#123 Effect unit 2b, Part A (in progress; must land before C2; G28 ends here, DL §46, §102):** one `ManagedRuntime` per process (harness and Electron main), services and Layers, explicit shutdown, the ApplicationDatabase finalizer, the #110 carry-forwards and the desktop bridge core; with **#96** (late harness log lines on quit). Brief `designs/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a.md`.
   - Done: s1 fair lock, s2, s3 bounded authority close, s4, s5 harness runtime (accepted, DL §105-§133), s5b Effect gate (done at `010ee05`; accepted with Part A).
   - In progress: s6 desktop runtime (rigorous lane; candidate review round 1 fix round).
   - Remaining: s7 bridge core (one `HarnessBridges` service), s8 stdout drain (#96), the combined mutation, the 2 manual criteria, Part A acceptance, integration into main and the push; then delete the `slopstop-110` worktree and branch (DL §87).
4. **#133** successful-upgrade log and the proven log link (small slice, queued after C1, DL §88).
5. **#135** multi-process storage tests: the upgrade-vs-open race integration test, then a packaged upgrade-kill stage (DL §89).
6. **#95, #97** C1-0 residuals.
7. **Runtime-database cleanup (#93, after #105 and #123, before any new feature; user 2026-10-11, DL §55):** with Mastra withdrawn, decide whether a runtime database is still needed, then rename or remove `mastra.db` and `mastraMigrationHead` with a storage upgrade, red-green and review. [DL §55 predates the Part A/B split; confirm with the user whether Part A is enough as the trigger.]
8. **Moved after C2: #123 Part B**, the module-by-module SQL-to-Effect pass with performance measured before and after, the remaining Promise facades, the EW1-EW3 races, and `project-registration-preparation.ts` to Code Health 10 (DL §102, §103.4). See Phase 5b.

9. **Whole-project architecture review** (`/rpiv:architectural-review`), scheduled by the coordinator on the user's delegation (2026-10-22). It runs after #123 Part A is integrated and the TS 7 switch has landed, and before Phase 3 and C2. Why then: the runtime, lifecycle and bridge foundations are settled, and C2 will build streaming and cancellation on them, so structural problems are cheapest to fix now. Scope: all workspaces (kernel, protocol, harness, desktop), checking the AGENTS.md boundaries, the Effect rules, duplication and the Part B candidates. The findings become a phased polish plan. Each item is then scheduled with the user, and none starts on its own.

The order of items 2 (switch), 4, 5, 6 and 7 after Part A is not decided; confirm the next item with the user before starting it (DL §129).

### Phase 3 — the new interface
1. Decisions: the open visual items through a session with the ui-ux agent (#121); local Rive runtime; ADR note for the splash-window CSP; custom frameless title bar (Electron security review); Settings shell with the sounds toggle and first-install sound prompt (DL:292, :304). The Rive paid plan is a release gate (#103), not a prerequisite. **Added 2026-10-22 (user):** the ui-ux agent designs the initial repository-selection section (Project registration: choosing the repository) in Figma AND as HTML prototypes, in 3 distinct variants for the user to choose from, with the same anti-clone and rune rules.
2. **React port** of the remaining prototype screens (`ragnarok-hero/PORT-PLAN.md`), deleting the old UI slice by slice; map motion in CSS.
3. From here on, **accessibility is an acceptance criterion of every slice** (PRODUCT.md:75, :173), not an end pass.

### Phase 4 — decisions before the model
1. **#101 agent runtime: decided 2026-10-11 (DL §55).** API mode uses the official Anthropic client (`@anthropic-ai/sdk`) behind the ADR 0009 port; Mastra is out; the AI SDK may come later as a second adapter. The text cleanup is done; the code cleanup is Phase 2 item 7 (#93). (Zod in ADR 0006:26 does not depend on #101.)
2. **Decided 2026-10-10 (v1-scope FRD):** C2 delivers both billing modes, which brings the governed-CLI process machinery into C2; one default model at first install plus overrides per role and task. Still open here: the cheap-model paired evaluation (memory: Luna, DeepSeek, Haiku).

### Phase 5 — C2 real-model Conversation
The Project conversation with the Supervisor as its agent (ADR 0021): model replies, Context proposals and records, per-message model choice, streaming, the contract for credentials, attribution, failure and interruption (#85, C1D:701); the Models and credentials part of Settings (safeStorage, both billing modes, one active); the governed CLI session for subscription mode (both billing modes, one active); the plan-usage meter; branching.

### Phase 5b — #123 Part B, right after C2
The SQL-to-Effect pass and the rest of the Effect migration (Phase 2 item 8; DL §102).

### Phase 6 — Frame and the real map
1. **#92 Storage-operation journal first**, with a minimal ADR 0013 storage-operation partition [mandatory follow-up of ADR 0005; every later schema upgrade otherwise ships on the temporary marker and the S1 chain rule].
2. Frame acceptance; real Strand and Waypoint owners; `supersedes`; ADR 0022 store relations, Decisions page commands, map counts and "Show on map"; Waypoint conversations, Waypoint chips, `#`, `@` and `To:` (DL:39; real Waypoints need accepted Strand membership, ADR 0006:78); #104 opt-in Foundation quiz for new Projects; Files sidebar and previews (PRODUCT.md:50-51).

### Phase 7 — Board
Board admission and durable read positions from real Waypoint sources.

### Phase 8 — Runs and Workers
**First: #128 role profiles** (editable, versioned instructions per role, family-bounded tools, per-Project override; decisions log §34). Supervised Runs (ADRs 0007-0009), the Forger and Workers, the governed CLI Worker path and its open checks (ADR 0009:327-331), agent dialogue phase 1 and phase 2 (both in v1; pairs only, 12 messages default, agent-declared closing state; ADR 0021 note), the Supervisor coordination budget, the Run approval view; architecture review proposed at the end of each Strand; Project-profile surfaces needed by Run preparation (discipline override, rpiv lanes, Foundation sections); decisions in Run context and the "Decision changed" Attention item (ADR 0022); #104 inference for existing Projects (a read-only Worker); the lower log panel for process output (PRODUCT.md:53); the Project activity feed (a projection of Execution events, PRODUCT.md:57). **Security:** ISOL-1 deferred for v1 (trusted repositories only, decided 2026-10-10); mandatory before untrusted repositories or a public release (#111). Named-pipe isolation only if a named pipe is productized.

### Phase 9 — Evidence, Findings, Candidate and Integration
ADRs 0010-0020 with artifact retention and result limits; user-approved commits with decision and Run trailers (PRODUCT.md:123); #100 rpiv method inside Ragnarok [its review rounds need Findings].

### Phase 10 — Memory and language intelligence
Verified Memory (ADR 0017); TypeScript language intelligence (ADRs 0003, 0016) and the Debug Adapter Safety Boundary.

### Phase 11 — storage lifecycle and the rest of Settings
Backup, encrypted export, migration, restore, import, reset, Close/Archive/Delete (PRODUCT.md:92-95; ADR 0002:32); Application and Project Settings pages (Project profile: default lane, review rounds and dialogue limits, test discipline, models per role); the Diagnostics destination and its charts (DL:311); Supervisor coordination budget surfaces (phase 2 is in v1).

### Phase 12 — packaging, diagnostics and identity
Consent-gated Sentry with a DSN (decided for v1); Stable Product Identity and final visual identity acceptance; the **visible rename to Ragnarok** (executable, `%APPDATA%Ragnarok` via a verified copy, AppUserModelId; internal names stay); a **licence check** over dependencies and bundled tools, then a **simple unsigned Windows installer** for the tester; the bundled-tool Update control (tested versions, rollback).

### Phase 13 — v1 acceptance
Recalibrate provisional numbers from real use (ADRs 0004/0005/0009/0018/0019/0020); triage leftover mutation survivors and review suggestions; technical acceptance, multi-week personal acceptance, final freeze; the evaluation protocol against the baseline, with the product-thesis consequences (#125; decided as part of v1 acceptance).

### After v1 or unscheduled
#103 monetization and licensing (Anthropic's written confirmation, ADR 0009:318; licence audit; trademark; #103 also suggests a licence check in the gates now), installers, signing and auto-update, live DAP, code signing and auto-update; the Rive paid plan; ISOL-1 before untrusted repositories. Research with pending human decisions: Jev evaluation and JEV-F01/F02, skill-procedures adoption, inspiration-project candidates, Effect/Alchemy/Bun questions (README:24-34). Ideas: #100 professional delivery flow, #104 advisor panel. Tooling: the planned PreToolUse hook for ask-before-branch/PR.

## 3. Decisions the user still owns

- **#101 agent runtime:** decided 2026-10-11, the Anthropic client in API mode (DL §55).
- **v1 scope:** closed on 2026-10-10, see `.rpiv/artifacts/discover/2026-10-10_00-59-10_v1-scope-deferred-decisions.md`.
- **Before the React port:** ADR note for the splash-window CSP (DL:273-274). The Rive paid plan waits for a public version.
- **Open visual items** (states, the palette, charts and the Run timeline were decided later in DL §24): first use; Windows accessibility; notifications outside the app; app icon meaning; drawing the role-agent icons (marks partly approved, DL:330, :361); Waypoint panel diffs. They go to a session with the ui-ux agent (#121).
- **FRD open questions:** #99 phase 2 mechanics across Runs (for design). Closed 2026-10-10: the closing state is agent-declared and validated; the Project-profile options and the architecture-review trigger are decided.
- **Agents at 100% of budget:** the Run-pause rule is design input only, not a contract (DL:320).
- **Evaluation protocol and product thesis:** part of v1 acceptance; tasks and criterion decided in #125 at that point.
- **Kept product ideas** (`research/2026-10-07_developer-value-ideas.md`), raised when their area is designed; deliberately inventory-only, no issue.
- **#103 monetization and licensing** (deferred until after personal v1), including Anthropic's written confirmation (release gate, ADR 0009:318), the licence audit and the "Ragnarok" trademark check.
- **#104 Foundation** discovery (quiz, inference for existing Projects, later changes, instructions file).

## 4. v1 programme contents (detail; the order is in "Ordered roadmap")

1. **C2 real-model Conversation:** model replies, Context proposals and records, per-message model choice, streaming attempts (C1D:701); separately approved contract for credentials, context, call attribution, failure and interruption (#85). Branching, Waypoint conversations, `#`/`@`, `To:` (C1D:702). Level-2 Waypoint conversation summaries (DL:20).
2. **Frame acceptance and real Strand/Waypoint/map owners;** `supersedes` relationship (DL:112); decision scope and implementing-Waypoint links, Decisions page commands, map counts, "Show on map", decision selection in Run context, Foundation by role, "Decision changed" Attention item (ADR 0022:30-56); Waypoint reference chips and the `@` file picker (DL:39, :48).
3. **Board admission and durable read positions** from real Waypoint sources; Project activity feed (PRODUCT.md:56-57).
4. **Supervised Runs and Workers** (ADRs 0007-0009): Forger and Workers, governed CLI Worker path (ADR 0009 Am.1; unverified points 0009:327-331), agent-dialogue records and the agent-authored context source (ADR 0021:68-69), Run approval view with dialogue pairs, Forger rename in code identifiers (ADR 0021:20, :71), plan-usage meter (DL:312-319), user-approved commits with decision and Run trailers (PRODUCT.md:123).
5. **Evidence, Findings, Candidate and Integration** (ADRs 0010-0020), including artifact retention and result limits.
6. **Verified Memory** (#13; ADR 0017 open parts) and **TypeScript language intelligence** (#24; ADRs 0003, 0016), including the versioned Debug Adapter Safety Boundary (live DAP is post-v1).
7. **Settings:** Application, Project and Models pages, credentials in `safeStorage`, both billing modes with one active (PRODUCT.md:72; ADR 0009:333-335); Supervisor coordination budget surfaces if phase 2 is in v1.
8. **Storage lifecycle:** backup, encrypted export, migration, restore, import, reset, Close/Archive/Delete (PRODUCT.md:92-95; ADR 0002:32); #92 full Storage-operation journal.
9. **Packaging and Diagnostics** (#27): consent-gated Sentry and DSN provisioning (ADR 0001:72-73), lower log panel, Stable Product Identity and final visual identity acceptance with independent review (#26, #44, #45).
10. **Accessibility across the product:** keyboard-only operation, plain-text equivalents, reduced motion (PRODUCT.md:75, :173).
11. **Convergence** (#23): technical acceptance, multi-week personal acceptance, final freeze.

## 5. Security deferred until before untrusted use

- **ISOL-1:** hostile Git config and OS-network confinement before untrusted repositories are admitted (`evidence/2026-10-03_pc-s1-guarantee-scope-decision.md:26`; #91; #85 comment).
- **Named-pipe isolation:** DACL/user-session isolation and pipe-name squatting before sensitive data uses the writer/observer pipe (#43).
- PC-S1 reduced-scope items: additional worktree association, interrupted-creation recovery flow, Linux, "Choose a different Git program" (`evidence/2026-10-03_pc-s1-guarantee-scope-decision.md:21-24, :97`).

## 6. Technical debt and residuals

- **Open issues:** #92 journal; #93 Mastra head (after #101); #95 real-process quit during upgrade; #96 late harness log lines on quit (in #123 Part A s8); #97 mutation scope for C1-0 S5; #133 upgrade log and log link; #134 C1-gate deferred rows and the licence check; #135 multi-process storage tests. Closed: #94 (2026-10-11), #102 (fixed in C1 S3).
- **Effect migration remainder:** the unit 2 lifecycle is #123 Part A (in progress); the existing SQL bodies are #123 Part B, after C2 (`research/2026-10-04_sql-code-to-effect-pros-cons.md:50-63`; DL §102).
- **Mutation survivors not triaged:** C1-0 S1 scope (eligibility 13, generated-migrations 8, manifest 2), C1-0 S2 recovery; 41 out-of-scope C1-0 deep-review suggestions (DL:125).
- **Measured numbers still provisional:** timeouts, heartbeats, retries, retention (ADRs 0004, 0005, 0009:163), artifact retention (ADR 0018), result limits (ADR 0019), convergence profile (ADR 0020); upgrade time target under 1 s once sizes are measured.
- **Program handoff payload schemas** (Execution, Evidence, Frame, Memory, Language) left to the owning designs (#28).
- **Forge 7.11.2 and Drizzle 0.45.2** declarations fail full lib checking (warning; #35), relevant to #105.
- **Triggered items** (built only when the trigger happens; tracked in one triggered-work register issue): durable drafts, runtime-database migrations, cross-process marker liveness, Store `open()` recovery, shared-vocab extraction of activation results, backup pruning, local map position pins and the minimum window size (#25).

## 7. Document inconsistencies (text corrections, 2026-10-10)

Corrected the same day unless stated otherwise; see the git log for the commit.
- CONTEXT.md called the Supervisor provisional although ADR 0021 is accepted.
- ADR 0001 kept a stale "SQL client choice is undecided" line and the old provisional visual direction.
- ADR 0016 called ADR 0003 a local draft.
- PRODUCT.md placed Diagnostics on the rail; DESIGN.md did not list it.
- ADRs 0009, 0011 and 0014 carried no note that ADRs 0021 and 0022 amend them.
- GitHub #1 still named #90 as the next front (updated with the issues on 2026-10-10).
- Stale artifact status fields (`designs/2026-09-04_18-05-05_canonical-project-writer.md`, `designs/2026-09-12_22-45-37_persistent-project-conversation.md`, `handoffs/2026-10-05_list-removal-race-and-s6b-brief.md`).
- **Mastra text corrected 2026-10-11** (PRODUCT.md, AGENTS.md, CONTEXT.md, `model.c4`, "Mastra Withdrawn" amendments in ADRs 0001, 0002, 0006, note in 0009). The file `mastra.db` and `mastraMigrationHead` stay until Phase 2 item 7. Zod in ADR 0006:26 can be removed independently.

## Issues created (2026-10-10)

22 issues (#106-#127), 5 comments (#98 closure proposed, awaiting the user; #99; #100; #101; #105) and the #1 frontier paragraph, on 2026-10-10.

| Issue | Topic | Roadmap phase |
| --- | --- | --- |
| #106 | Conversation C1 implementation parent (sub-issue of #85) | 0-1 |
| #107 / #108 / #109 | C1 S3 / S4 / S5 (native blocked_by chain) | 1 |
| #110 | Split project-storage-node-adapters.ts | 1 |
| #111 | ISOL-1 and named-pipe isolation | 8 |
| #112 | PC-S1 deferred registration scope | 8 or later |
| #113 | Program: Packaging and Diagnostics | 12 |
| #114 | Program: Supervised Runs and Workers | 8 |
| #115 | Program: Evidence, Findings, Candidate and Integration | 9 |
| #116 | Program: Verified Memory and TypeScript language intelligence | 10 |
| #117 | Program: Settings | 3, 5, 11 |
| #118 | Program: Storage lifecycle | 11 |
| #119 | Program: Accessibility | per slice from 3 |
| #120 | Program: v1 Convergence | 13 |
| #121 | Open visual and interaction decisions | 3 |
| #122 | Measure provisional numeric defaults | 13 |
| #123 | Effect migration remainder: Part A lifecycle, Part B SQL pass | 2 (A), 5b (B) |
| #124 | Triage C1-0 mutation survivors and deep-review suggestions | 13 |
| #125 | Evaluation tasks and success criterion | 13 |
| #126 | Naming rule: Strand, Weave, Forger in new code | ongoing |
| #127 | Triggered work register | triggered |
| #128 | Role profiles (editable, versioned) | 8 (first) |
