---
date: 2026-10-10T09:00:00+0100
author: coordenador-claude (Claude Code), for Pedro Mesquita
commit: e44236d
branch: main
repository: slopstop
topic: "Pending-work inventory and roadmap reference point"
tags: [roadmap, inventory, pending-work, deferred]
status: complete
last_updated: 2026-10-10T09:00:00+0100
last_updated_by: coordenador-claude
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

Revision 2 (2026-10-10), after an adversarial completeness and ordering review. Each phase starts when the previous one is done unless marked "in parallel"; reasons are in brackets. Sections 3-7 hold the detail and sources. ADR line numbers refer to the files after commits d601e5b and e44236d.

### Phase 0 — now (in progress)
1. **Done 2026-10-10:** C1 S1 + S2 squash-merged to local main as `ba4e15b` after review rounds 1-2 and a user-approved bounded round 3 (DL §32); final-head proof on ac6569c. The real `userData` was backed up first to `%APPDATA%SlopStop-backup-2026-10-10` (67 files, hashes verified).
2. **Documentation consistency:** done on 2026-10-10 (d601e5b section-7 corrections, e44236d Strand/Weave sweep; prototypes and Figma by the ui-ux agent). Remaining: the #1 map paragraph.
3. **GitHub issues** for untracked items (see "Issues created").
4. **Push main** after the merge, once its gates pass (the last push failed at launch-smoke).
5. **In parallel with phases 0-1: #94** timeouts under load [S2-S5 all need e2e and launch-smoke runs].

### Phase 1 — finish Conversation C1
1. **S3** protocol v8, coordinator admission, runtime; the dedicated `WRITER_CLIENT_ABANDON_FAILED` code (6a); read-after-abandonment routing (U2, CNV-B13). **Fix #102 inside S3** [S3 rewrites the runtime routing in `process-bootstrap.ts`, the file behind #102].
2. **S4** bridge, IPC, preload, renderer. Proposal, user decides at S4: build it in React from the prototypes. This is the user's "Conversation to React right after C1" (DL:348) without doing the screen twice.
3. **S5** the real-app journey.
4. **Close-out:** split `project-storage-node-adapters.ts` (CodeScene waiver, DL:68); review the carried C1-gate items with triggers (C1D:691-697: `project.upgrade` admission checks, F9 listing concurrency, G2 IPC failure proof, desktop diagnostics, `process-entry` log link, generation-cap semantics).

### Phase 2 — right after C1
[The user decided the #99 interview starts when C1 is done; the foundations below come before C2 because C2's streaming and cancellation are heavy Effect code.]
1. **#99 interview** continuation (Supervisor and dialogue details; agent-coordination FRD:187-189).
2. **#105 TypeScript 7 and the Effect language service** (about 2-4 hours, mostly machine time): toolchain compatibility (Vite, Vitest, Electron Forge, Biome, knip, dependency-cruiser, Stryker, drizzle-kit, typecheck scripts), option and behaviour changes, build speed, Forge/Drizzle lib-check warnings (#35); `effect-tsgo diagnostics` in the gates; the **Effect tsgo LSP server configuration**: a curated `diagnosticSeverity` set (candidates newPromise, runEffectInsideEffect, globalErrorInEffectFailure, unknownInEffectCatch, tryCatchInEffectGen, multipleEffectProvide, leakingRequirements, scopeInLayerEffect, schemaNumber), plugin options and a count of current violations (today `tsconfig.base.json` has only the minimal plugin entry). Go/no-go report with migration and rollback; a go becomes a normal slice. Until then `pnpm typecheck` (TS 6.0.2) is authoritative.
3. **Effect unit 2b runtime and lifecycle** (`evidence/2026-10-03_effect-unit2-lifecycle-plan.md`; ADR 0001:126): one `ManagedRuntime` per process, services and Layers, shutdown sequencing; with **#96** (late harness log lines on quit).
4. **SQL-to-Effect pass** for existing storage code [its prerequisites, the `claude -p` prototype and the cost analysis, were done on 2026-10-04].
5. **#95, #97** C1-0 residuals.

### Phase 3 — the new interface
1. Decisions: the open visual items through a session with the ui-ux agent (#121); local Rive runtime; ADR note for the splash-window CSP; custom frameless title bar (Electron security review); Settings shell with the sounds toggle and first-install sound prompt (DL:292, :304). The Rive paid plan is a release gate (#103), not a prerequisite.
2. **React port** of the remaining prototype screens (`ragnarok-hero/PORT-PLAN.md`), deleting the old UI slice by slice; map motion in CSS.
3. From here on, **accessibility is an acceptance criterion of every slice** (PRODUCT.md:75, :173), not an end pass.

### Phase 4 — decisions before the model
1. **#101 agent runtime.** ADR 0009 Amendment 1 already withdrew Mastra as the planned first adapter; the open choice and the document cleanup remain: `mastra.db` in ADRs 0001:56, 0002:15, 0006, the storage manifest and `docs/architecture/model.c4`; PRODUCT.md:84 and AGENTS.md. Then **#93**. (Zod in ADR 0006:26 does not depend on #101.)
2. **Decided 2026-10-10 (v1-scope FRD):** C2 delivers both billing modes, which brings the governed-CLI process machinery into C2; one default model at first install plus overrides per role and task. Still open here: the cheap-model paired evaluation (memory: Luna, DeepSeek, Haiku).

### Phase 5 — C2 real-model Conversation
The Project conversation with the Supervisor as its agent (ADR 0021): model replies, Context proposals and records, per-message model choice, streaming, the contract for credentials, attribution, failure and interruption (#85, C1D:701); the Models and credentials part of Settings (safeStorage, both billing modes, one active); the governed CLI session for subscription mode (both billing modes, one active); the plan-usage meter; branching.

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

- **#101 agent runtime** (AI SDK vs Mastra, maybe per billing mode). Blocks C2 and #93. PRODUCT.md:84 and AGENTS.md stay unchanged until decided (DL:340).
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

- **Open issues:** #92 journal; #93 Mastra head (after #101); #94 timeouts under load; #95 real-process quit during upgrade; #96 late harness log lines on quit; #97 mutation scope for C1-0 S5; #102 listing cleanup masking the real failure.
- **Effect migration remainder:** existing SQL bodies in a dedicated pass (`research/2026-10-04_sql-code-to-effect-pros-cons.md:50-63`); Effect unit 2 lifecycle plan not started (`evidence/2026-10-03_effect-unit2-lifecycle-plan.md:38`).
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
- **Not corrected, waiting for #101:** Mastra as the first runtime in PRODUCT.md:84 and AGENTS.md, and `mastra.db` in ADRs 0001:56, 0002:15, 0006, the manifest and `docs/architecture/model.c4` (DL:340). Zod in ADR 0006:26 can be removed independently.

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
| #123 | Effect migration remainder (SQL pass, unit 2 lifecycle) | 2 |
| #124 | Triage C1-0 mutation survivors and deep-review suggestions | 13 |
| #125 | Evaluation tasks and success criterion | 13 |
| #126 | Naming rule: Strand, Weave, Forger in new code | ongoing |
| #127 | Triggered work register | triggered |
| #128 | Role profiles (editable, versioned) | 8 (first) |
