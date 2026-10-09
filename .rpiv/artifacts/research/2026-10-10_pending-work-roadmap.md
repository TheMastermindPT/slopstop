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
- **Keep it current.** Update this file when items close or appear. Items marked "(no issue)" at sweep time received GitHub issues on 2026-10-10; see the "Issues created" section.
- Abbreviations: DL = `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md`; C1D = `.rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md`.

## Naming (2026-10-10)

"Feature" is now **Strand** and the map's whole-Project view "Saga" is now **Weave**; the one-Strand view is called Strand (DL §30). "Waypoint parent" is now **Forger** (ADR 0021). Code identifiers and accepted ADR text keep the former names until the rename slice (phase 2).

## Ordered roadmap

Each phase starts only when the previous one is done, unless marked "in parallel". The reason for each position is given in brackets. Sections 3-7 below hold the detail and sources.

### Phase 0 — now (in progress)
1. **C1 S2 round-1 fixes** (DL §29) → heavy runs → candidate review round 2 (the last) → user merge decision → **S1 + S2 squash merge** to main (G15).
2. **Documentation consistency** (in parallel): section-7 text corrections; the Strand/Weave/Forger sweep over every current document, the prototypes and Figma; former-names notes in the ADRs.
3. **GitHub issues** for untracked items (in parallel; see "Issues created").
4. **Push main** after the merge, once its gates pass (the last push failed at launch-smoke).

### Phase 1 — finish Conversation C1
1. **S3** `c1-s3-conversation-protocol`: protocol v8, coordinator admission, runtime; also the dedicated `WRITER_CLIENT_ABANDON_FAILED` code (deviation 6a) and the read-after-abandonment routing (U2, a new CNV-B13 row).
2. **S4** `c1-s4-conversation-window`: bridge, IPC, preload, renderer. Coordinator proposal, user decides at S4: build the window in React from the prototypes, so the Conversation React port is not done twice.
3. **S5** `c1-s5-conversation-journey`: the real-app journey.
4. **Split `project-storage-node-adapters.ts`** (CodeScene 8.41 waiver, due after C1; DL:68, C1D:666).

### Phase 2 — tooling and hygiene before more product code
[Done before the React port and C2 so all new code is written once, with the final compiler, rules and names.]
1. **#105 TypeScript 7 and the Effect language service** (about 2-4 hours of investigation, mostly machine time):
   - toolchain compatibility (Vite, Vitest, Electron Forge, Biome, knip, dependency-cruiser, Stryker, drizzle-kit, typecheck scripts), compiler option and behaviour changes, build speed, and the Forge/Drizzle lib-check warnings (#35);
   - whether `effect-tsgo diagnostics` can run in the gates;
   - the **Effect tsgo LSP server configuration**: a curated `diagnosticSeverity` rule set (candidates: newPromise, runEffectInsideEffect, globalErrorInEffectFailure, unknownInEffectCatch, tryCatchInEffectGen, multipleEffectProvide, leakingRequirements, scopeInLayerEffect, schemaNumber), the plugin options, and a count of existing violations; today `tsconfig.base.json` has only the minimal plugin entry with default severities;
   - a go/no-go report with a migration and rollback plan; if go, the migration is a normal slice. Until then `pnpm typecheck` (TypeScript 6.0.2) stays authoritative and LSP findings are advisory (AGENTS.md).
2. **Rename slice** (code identifiers): Feature → Strand, Waypoint parent → Forger (ADR 0021:71), in code, schema names where safe, tests and protocol vocabulary.
3. **Stabilisation batch:** #94 timeouts under load (every heavy run depends on it), #102 listing cleanup masking the real failure, #95/#96/#97 C1-0 residuals.

### Phase 3 — the new interface
1. Decisions first: Rive paid plan; ADR note for the splash-window CSP; open visual items (error/failure/success states, first use, command list, Windows accessibility, notifications, app icon meaning, role-agent icons, Waypoint diffs).
2. **React port** of the remaining prototype screens (`ragnarok-hero/PORT-PLAN.md`), deleting the old UI slice by slice; Rive startup in a splash window; map motion in CSS (DL:268-274).

### Phase 4 — decisions before the model arrives
[C2 cannot be designed without them.]
1. **#101 agent runtime** (AI SDK vs Mastra); then the Mastra/Zod text cleanup in PRODUCT.md and ADRs 0005/0006/0009, and #93.
2. **#99 interview** continuation (Supervisor, dialogue closing state, phase 2 across Runs).
3. **v1 scope:** dialogue phase 2 and the Supervisor coordination budget; the Sentry consent path.
4. Discover interviews on the other deferred decisions in section 3.

### Phase 5 — C2 real-model Conversation
Model replies, Context proposals and records, per-message model choice, streaming, the contract for credentials, attribution, failure and interruption (#85, C1D:701); the **Models and credentials part of Settings** (safeStorage, both billing modes, one active); branching, Waypoint conversations, `#`/`@`, `To:`. Then the **SQL-to-Effect pass** for existing storage code (planned after the model prototype and cost analysis).

### Phase 6 — Frame and the real map
Frame acceptance; real Strand and Waypoint owners; `supersedes`; ADR 0022 decision scope and implementing-Waypoint links, Decisions page, "Show on map", decisions in Run context; #104 Foundation by role and the opt-in quiz; Waypoint chips and the `@` file picker.

### Phase 7 — Board
Board admission and durable read positions from real Waypoint sources; Project activity feed.

### Phase 8 — security before agents run code
ISOL-1 (hostile Git config, OS-network confinement); named-pipe isolation (#43); PC-S1 reduced-scope items (worktree association, recovery flow, Linux, choosing another Git program).

### Phase 9 — Runs and Workers
Supervised Runs (ADRs 0007-0009), the Forger and Workers, the governed CLI Worker path and its open checks (ADR 0009:322-326), agent dialogue phase 1 (ADR 0021), the Run approval view, the plan-usage meter, user-approved commits with trailers; #100 rpiv method inside Ragnarok.

### Phase 10 — Evidence, Findings, Candidate and Integration
ADRs 0010-0020, including artifact retention and result limits.

### Phase 11 — Memory and language intelligence
Verified Memory (#13, ADR 0017); TypeScript language intelligence (#24, ADRs 0003, 0016) and the Debug Adapter Safety Boundary.

### Phase 12 — storage lifecycle and the rest of Settings
#92 full Storage-operation journal; backup, encrypted export, migration, restore, import, reset, Close/Archive/Delete; Application and Project Settings pages; Supervisor budget surfaces if phase 2 is in v1.

### Phase 13 — packaging, diagnostics and identity
Consent-gated Sentry and DSN (#27); lower log panel; Stable Product Identity and final visual identity acceptance (#26, #44, #45); an accessibility pass across the product.

### Phase 14 — v1 acceptance (#23)
Recalibrate provisional numbers from real use (ADRs 0004/0005/0009/0018/0019/0020); triage leftover mutation survivors and review suggestions; technical acceptance, multi-week personal acceptance, final freeze; the evaluation protocol against the baseline.

### After v1
#103 monetization and licensing, Anthropic's written confirmation, the licence audit and trademark check, installers, signing and auto-update, live DAP, dialogue phase 2 if left out of v1.

## 3. Decisions the user still owns

- **#101 agent runtime** (AI SDK vs Mastra, maybe per billing mode). Blocks C2 and #93. PRODUCT.md:84 and AGENTS.md stay unchanged until decided (DL:340).
- **v1 scope:** is dialogue phase 2 with the Supervisor coordination budget in v1 (ADR 0021:36, :41)? Is the Sentry consent path required in v1 (PRODUCT.md:25; ADR 0001:72-73)?
- **Bundled quality tools inside Ragnarok:** update control, pinning, rollback, licence redistribution (DL:325-329; rpiv-method FRD:177). Needs an interview and an ADR.
- **Before the React port:** Rive paid plan (watermark); ADR note for the splash-window CSP (DL:273-274).
- **Open visual items** (DL:295-311): error/failure/success states; first use; command and shortcut list; Windows accessibility; notifications outside the app; app icon meaning; role-agent icons; Waypoint panel diffs.
- **Naming:** Mention vs "Send to" (DL:38). (Feature → Strand was settled on 2026-10-10, DL §30.)
- **FRD open questions:** #99 closing-state production/validation and phase 2 across Runs (agent-coordination FRD:187-189); #100 adjustable Project-profile options and the periodic architecture-review trigger (rpiv-method FRD:175-176).
- **Plan changes discussed by agents:** remaining details (DL:257, :320).
- **Evaluation protocol:** candidate tasks and success criterion; alternative evaluation project (`research/2026-10-04_ragnarok-vs-baseline-evaluation-protocol.md:86-97`).
- **Product thesis** roadmap consequences (`research/2026-10-03_product-thesis.md:61`).
- **Kept product ideas** (`research/2026-10-07_developer-value-ideas.md`), raised when their area is designed; deliberately inventory-only, no issue.
- **#103 monetization and licensing** (deferred until after personal v1), including Anthropic's written confirmation (release gate, ADR 0009:318), the licence audit and the "Ragnarok" trademark check.
- **#104 Foundation** discovery (quiz, inference for existing Projects, later changes, instructions file).

## 4. v1 roadmap after C1 (#85 order, then chartered v1 programs)

1. **C2 real-model Conversation:** model replies, Context proposals and records, per-message model choice, streaming attempts (C1D:701); separately approved contract for credentials, context, call attribution, failure and interruption (#85). Branching, Waypoint conversations, `#`/`@`, `To:` (C1D:702). Level-2 Waypoint conversation summaries (DL:20).
2. **Frame acceptance and real Strand/Waypoint/map owners;** `supersedes` relationship (DL:112); decision scope and implementing-Waypoint links, Decisions page commands, map counts, "Show on map", decision selection in Run context, Foundation by role, "Decision changed" Attention item (ADR 0022:30-56); Waypoint reference chips and the `@` file picker (DL:39, :48).
3. **Board admission and durable read positions** from real Waypoint sources; Project activity feed (PRODUCT.md:56-57).
4. **Supervised Runs and Workers** (ADRs 0007-0009): Forger and Workers, governed CLI Worker path (ADR 0009 Am.1; unverified points 0009:322-326), agent-dialogue records and the agent-authored context source (ADR 0021:68-69), Run approval view with dialogue pairs, Forger rename in code identifiers (ADR 0021:20, :71), plan-usage meter (DL:312-319), user-approved commits with decision and Run trailers (PRODUCT.md:123).
5. **Evidence, Findings, Candidate and Integration** (ADRs 0010-0020), including artifact retention and result limits.
6. **Verified Memory** (#13; ADR 0017 open parts) and **TypeScript language intelligence** (#24; ADRs 0003, 0016), including the versioned Debug Adapter Safety Boundary (live DAP is post-v1).
7. **Settings:** Application, Project and Models pages, credentials in `safeStorage`, both billing modes with one active (PRODUCT.md:72; ADR 0009:330); Supervisor coordination budget surfaces if phase 2 is in v1.
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
- GitHub #1 still named #90 as the next front.
- Stale artifact status fields (`designs/2026-09-04_18-05-05_canonical-project-writer.md`, `designs/2026-09-12_22-45-37_persistent-project-conversation.md`, `handoffs/2026-10-05_list-removal-race-and-s6b-brief.md`).
- **Not corrected, waiting for #101:** Mastra as the first runtime in PRODUCT.md:84, and `mastra.db` and Zod in ADRs 0005/0006/0009 (DL:340 keeps PRODUCT.md unchanged until #101 is decided).

## Issues created (2026-10-10)

To be filled after creation.
