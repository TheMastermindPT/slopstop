---
date: 2026-10-05
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
branch: main
commit: 43bc303
status: in-progress
tags: [conversation, decisions, context, waypoint]
content_hash: 16af9a9baf33ad63038575eda6c708ad1199406314e21544501743f5118a8541
---

# Conversation — Human Decisions

Baseline: the decisions recorded in `PRODUCT.md`, `discover/2026-08-22_19-18-10_workspace-supervision-experience.md` (FR23–FR49), ADR 0006, ADR 0004 and ADR 0009 Amendment 1 stay in force. This log adds the decisions taken while preparing Conversation planning.

## 1. Project conversation context about Waypoints (2026-10-05)

- **Gap closed.** The recorded rules defined the Waypoint-target context packet (FR26) but not what a Project-scoped message carries about Waypoints. In subscription mode Conversation has no tools, so the model only knows what SlopStop sends.
- **Level 1, always.** Every Project-scoped message carries a compact canonical status of the Project's Waypoints: objective, status, accepted decisions and approved typed Execution events. When the set is too large, SlopStop sends the active or changed Waypoints and the Context record lists every omitted Waypoint; nothing is omitted silently.
- **Level 2, on explicit request.** A summary of a Waypoint's conversation enters a Project-scoped message only when the user asks for it, as a declared scope expansion that needs confirmation (FR48). How and when summaries are produced is decided later; a model-produced summary is its own recorded invocation.
- **Level 3 rejected.** Full Waypoint conversation transcripts never enter the Project conversation.
- Waypoint and Project conversation histories stay separate (FR45). Neither conversation controls the other; information moves through accepted decisions (canonical state) or explicit, confirmed attachment.

## 2. Talking about Waypoints from the Project conversation (2026-10-05)

- **Problem raised by the user.** Entering each Waypoint conversation for every change means many jumps between many Waypoints.
- **Accepted: one place to talk, the destination always visible.**
  - The Project conversation is the default place to write.
  - When a request concerns concrete Waypoint work, the model may *suggest* a destination ("This concerns Waypoint X. Send it there?"). The user confirms or corrects it; nothing is routed silently.
  - A message sent to a Waypoint is stored in that Waypoint's conversation, so its history stays focused. The Project conversation keeps a short linked line.
  - The user enters a Waypoint conversation only for long, focused discussion.
  - Changes to an accepted plan stay reviewed proposals; changes to running work use the existing Run amendment flow.
- **Amends FR24.** Scope is never inferred *silently*: a model-suggested destination is allowed only as a visible suggestion the user confirms.
- **Explicit Waypoint references.**
  - On the map, a Waypoint's menu offers to put it into the composer as a removable reference chip.
  - In the composer, typing `@` opens a searchable picker (keyboard equivalent), as in code editors. The same picker can later list other attachable items (files, selections), shown with distinct type markers.
  - A chip makes the destination explicit, so no model guess is needed.
  - Proposed split, to confirm when the slice is planned: "Mention" (talk about the Waypoint in the Project conversation; its detailed status joins the context) versus "Send to" (the message goes to the Waypoint's conversation).
- **Timing.** Waypoint references arrive with the slice that builds the map and Waypoints (after Frame), not with the first Conversation slice. The `@` picker for files follows the attachments work.

## 3. First-slice choices and the `@` convention (2026-10-05)

- **Accepted (user, "Sim, aceito"):**
  1. First slice: save and reopen Conversation messages with no model; the real model follows in the next slice.
  2. Subscription-mode model: Opus by default, with a visible per-message choice the user can change.
  3. History sent per turn: the most recent messages up to a size limit, in a stable append-only order; automatic summaries later.
  4. Responses stream progressively and can be cancelled mid-turn.
- **`@` is reserved for files** (supersedes section 2's use of `@` for Waypoints). Its behaviour follows current industry practice; when the attachments slice is planned, research VS Code chat and Claude Code `@` file references first and bring the details to the user.
- **Waypoint references need another trigger.** Proposed: `#`, as GitHub uses for issues. Pending the user's confirmation.

## 4. Conversation C1 plan answers (2026-10-05)

- **Existing Projects: option A.** Add slice C1-0, a staged Project database upgrade under ADR 0005, limited to additive migrations: database-native backup, migrate copies in a staging generation, verify schema and integrity, activate the new generation atomically, keep the old one until verified. It runs automatically on activation. Rejected: B (pre-C1 Projects stay read-only), C (separate Conversation database, contradicts ADR 0006), D (in-place migration without backup, contradicts ADR 0005).
- **Wording.** Button "Save locally"; note "No model is connected yet. Messages are saved on this computer."
- **Message size limit.** 32 KiB of text per message.

## 5. C1-0 S1 build authorization (2026-10-06)

- **Build authorized** for slice `c1-0-s1-staged-upgrade-engine` of `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`, with the design's recorded residual risk. Branch requested by the implementer through the user.
- **Adjustment 1: ADR 0005 amendment moves into S1.** The temporary single-marker form (`storage_upgrades`), manifest version 2 and the snapshots backup layout are recorded in ADR 0005/0006 in the same branch as the S1 code, not deferred to S4.
- **Adjustment 2: typed Effect errors.** Each pipeline step's failure is a typed Effect error (tagged); conversion to the existing owner outcome shape (`ready` / `unavailable` / `broken`, `refused`, `failed`) happens once, at the owner boundary.
- **Mitigation for the unreviewed final revision:** candidate-mode independent review of the real S1 source before S1 is accepted.

## 6. C1-0 S1 candidate review decisions (2026-10-06)

Asked by the coordinator after candidate-mode review round 1 of `cf56a87`; answered by the user in the coordinator session.

- **CodeScene waiver for `apps/harness/src/storage/project-storage-node-adapters.ts`.** S1 is accepted with this file at 8.41 (pre-existing; S1 grew it from 1098 to 1149 lines). The waiver is recorded here and a follow-up task splits the file after Conversation C1. Every other touched file keeps the score-10 rule.
- **Squash merge.** S1 lands on `main` as one commit, so no point of `main` carries a registry head of 0007 without 0006 in the known previous heads. The per-behaviour red/green history stays in `.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-tdd-evidence.md` and on the feature branch.
- **Review round 2 outcome (user decision, same day).** Round 2 on `40b3a2a` confirmed F1-F5 and S1-S10 resolved and found two new concerns: a raw busy error from plan/backup/stage/migrate/seal is rethrown instead of answering `unavailable` (introduced by the F5 fix), and a backup without its identity or metadata table crashes instead of answering `PROJECT_UPGRADE_BACKUP_INVALID`. The user chose to fix both now with red-first tests, without a third review round; the coordinator verifies source and tests before the squash merge.

## 7. C1-0 S2 build authorization (2026-10-06)

- **Build authorized** for slice `c1-0-s2-upgrade-failure-and-recovery` of `.rpiv/artifacts/designs/2026-10-06_02-02-21_upgrade-failure-and-recovery.md`, with the design's recorded residual risk (intent rounds 1-2 failed; final revision unreviewed; mitigation: candidate-mode review of the real source, at most two rounds). Confirmed by the user in the coordinator session.
- **Automatic deletion confirmed.** The FRD's "nothing deleted" now admits one exception: the proven output of an unfinished upgrade (`.staging-<target>/`, `<target>/`) and its marker and target registry rows are discarded automatically. The source generation, the prior generation and every pre-upgrade backup are always kept.
- Branch `feat/c1-0-s2-upgrade-recovery` from `main`; squash merge after acceptance.
- **S2 review round 2 outcome (user decision, 2026-10-06).** Round 2 on `0ac994e` confirmed the data-safety fixes in source with no blocker and found two test-contract gaps: the upper-case target test uses a digit-only id, so it does not exercise letter case; one busy staged-copy case still reads the backup after the discard. The user chose to fix the tests now (with the upper-case test shown red against `4293b2c`), without a third review round; the coordinator verifies before the squash merge.
- **S2 accepted and squash-merged (user decision, 2026-10-06)** as `17cc797` on `main` (tree identical to branch head `5c5fa44`).

## 8. C1-0 S3a build authorization (2026-10-06)

- **Build authorized** for slice `c1-0-s3a-upgrade-request` of `.rpiv/artifacts/designs/2026-10-06_13-20-24_upgrade-request-and-window.md`, with the design's recorded residual risk (intent rounds 1-2 failed; round-2 fixes unreviewed; timing proven on a minimal fixture; listing concurrency F9 accepted). Mitigation: candidate-mode review of the real source, at most two rounds. Confirmed by the user in the coordinator session.
- Branch `feat/c1-0-s3a-upgrade-request` from `main`; squash merge after acceptance. S3b stays outline only.
- **S3a review round 1 outcome (user decision, 2026-10-06).** Round 1 on `5ff39ed` found no data-safety defect; findings R1-R9 plus cheap fixes are listed in the coordinator's round-1 note. The user chose to fix all of them now; round 2 is the last. The manual packaged double-launch check (design Success Criteria) will be done by the user after the fixes and recorded. Accepted residual risk: the `process-entry` → desktop log link is proven hop by hop only (no end-to-end run of the built harness); revisit at the C1 gate. The S3a implementation ran in the main working tree on the feature branch (user and coordinator choice).
- **S3a review round 2 outcome (user decision, 2026-10-06).** Round 2 on `4d8cabd` confirmed R1-R9 resolved and found one coverage blocker (the remainder buffer bound is untested), one `degrade-distinguishes-broken` violation introduced by the R9 fix (a package-smoke launch refused the lock exits 0), and smaller test gaps (T1-T8 in the coordinator's round-2 note). The user chose to fix them now, without a third review round; the coordinator verifies before the squash merge.
- **R1 table placement confirmed by the user (2026-10-06).** Only the protocol test keeps the literal design table; the runtime tests read `projectUpgradeDiagnostics`, which that test pins.
- **S3a accepted (user decision, 2026-10-06).** The coordinator verified `bcb102b` (T1-T8 red/green, final gates bound to the commit: check, integration, e2e, package smoke, mutation `--force` 87.89, jscpd 0, knip, db:generate:check, CodeScene). The user's manual packaged double-launch check passed. Squash merge to `main`.

## 9. Product decisions from the Figma exploration (2026-10-06)

Relayed by the ui-ux agent and confirmed by the user in the coordinator session. The Figma screens (`https://www.figma.com/design/zHeTrqwSFK7XMHMMhgzZeL`) are exploration, not a contract; visual identity stays undecided.

- **Waypoint-parent conversation has its own place.** The user's dialogue with a Run's Waypoint parent lives in its own surface, not inside the Waypoint conversation.
- **Feature is the only grouping.** There are no other grouping types (Research, Review and Frame are Actions or statuses, not groups).
- **The name "Feature" may change.** The user has not chosen a term; keep "Feature" until then.
- **The Waypoint parent proposes; the user approves.** It never forwards or applies information to a Waypoint on its own (consistent with PRODUCT.md: model output never changes canonical state directly).
- Naming note: "Wayfinder" already names the GitHub-issues decision map (`docs/agents/issue-tracker.md`); it is not adopted as a product term.

## 10. C1-0 S3b build authorization (2026-10-07)

- **Build authorized** for slice `c1-0-s3b-upgrade-window` of `.rpiv/artifacts/designs/2026-10-06_18-48-25_upgrade-window.md`, with the design's recorded residual risk (intent rounds 1-2 failed; round-2 fixes unreviewed; the window chooses `PROJECT_STORAGE_BROKEN` when the harness answers `upgraded` but the Project still needs migration; desktop-side protocol errors appear as `PROTOCOL_MESSAGE_INVALID`; no failure E2E). Mitigation: candidate-mode review of the real source, at most two rounds. Confirmed by the user in the coordinator session.
- **Workspace:** the main working tree on branch `feat/c1-0-s3b-upgrade-window` (user choice instead of a linked worktree, although the slice touches preload and IPC).
- **Test stability first:** before the S3b behaviours, a separate commit on the branch applies the pre-push timeout diagnosis options A (split multi-case loops into rows), B (long native files in their own low-parallelism project) and C (promise waits instead of default-deadline `vi.waitFor`), without raising any timeout. Option D (timeout changes) is not authorized.
- **Pushes of main (2026-10-06/07):** three pre-push failures from load-induced stalls (different tests each time; the `recovery-required` result was a timeout side effect, per the implementer's diagnosis); the fourth attempt passed and `origin/main` is `0bc2f4f`.
- **S3b review round 1 outcome (user decision, 2026-10-07).** Round 1 on `51a2e8e` found no code defect; it found one coverage blocker (the remove flow clearing the panel is untested), an unpinned stale-upgrade guard, the add flow not blocked during an update, unbound gate evidence and incomplete CodeScene evidence (V1-V5 plus cheap fixes in the coordinator's round-1 note). The user chose to fix all of them now; round 2 is the last. Section 11 (Waypoint relationships) entered the S3b range on the coordinator's instruction and is recorded as a deliberate deviation.
- **S3b review round 2 outcome (user decision, 2026-10-07).** Round 2 (final) on `12b1664` found one blocker: Remove could start during an update (M1). The user chose to fix M1 and suggestions S1–S3 (assert no list refresh after another follow-up result; block Add while opening; announce why Add and Remove wait) without a third review. Accepted residual risks: the equivalent mutation survivors at `use-project-upgrade.ts:45` and `:65`; the E2E "Safe mode" line never observed red on its own; opening a Project while the add or remove flow is on screen (a pre-existing ability whose hidden failure panel can take focus after Cancel); and a stale out-of-scope entry in the mutation report.
- **S3b accepted and squash-merged (user decision, 2026-10-07)** as `089bd90` on `main` (tree identical to branch head `4b8d5f1`); the coordinator's research notes followed on `main` as `8138ed9`, pushed as `origin/main`.

## 11. Waypoint relationships (user decisions, 2026-10-07)

- **`blocks` may link Waypoints of different Features.** Cross-Feature blocking is allowed; readiness follows the same rule as within a Feature.
- **Proposal accepted for design: `supersedes`.** A Waypoint can supersede another (change of direction, merged duplicates): the old Waypoint is closed and keeps its history instead of staying open or being deleted. To be specified with the Waypoint/map work (updates the initial set `blocks`, `related-to`, `derived-from` and CONTEXT.md); not part of C1-0 or C1.
- Not adopted as relationship types: `validates` (Validate is an Action), a soft "prefer after" order, `duplicates` (covered by `supersedes`). A "same area" overlap warning, if built, is derived from changed paths, not declared by the user.

## 12. C1-0 S4 upgrade documentation (user decisions, 2026-10-07)

- **Scope approved:** all 11 documentation items of the S4 brief (docs only; no behaviour change, so no red-green). Branch `feat/c1-0-s4-upgrade-docs` from `main` `8138ed9` approved; S4 ran in the main working tree, not a linked worktree.
- **Follow-up issues:** creating issue #92 ("Replace the temporary storage_upgrades marker with the full Storage-operation journal and its Effect records") was authorized; it is edited to say that chained upgrades (more than one completed upgrade per Storage) belong to the C1 gate. Issue #93 ("Decide whether the generation manifest records the Mastra migration head (ADR 0006 vs always-null mastraMigrationHead)") tracks the gap between ADR 0006 and the always-null `mastraMigrationHead`.
- **S4 review round 1 outcome:** three reviewers on `2fc32a8`, no blocker. The user approved one docs fix commit with no third review, applying the wording and record suggestions (plain-opening safe-mode wording, failed-result wording, `HARNESS_INTERNAL_FAILURE`, discard-failure behaviour, eligibility precedence, activation wording, protocol statuses standing in for `blocked`, Context citations, design Follow-up and frontmatter, and this entry). `CONTEXT.md` "Storage operation" stays unchanged: its `storage-operation` partition is the nested arm of the ADR 0013 `project-operation` Effect.

## 13. C1-0 S5 deep-review fixes (user decisions, 2026-10-07)

Relayed by the coordinator from the user. Source: `.rpiv/artifacts/reviews/2026-10-07_16-47-49_2a19d40-e1c0a99-c1-0-staged-upgrade.md`.

- **Scope:** fix the 9 important deep-review findings (I1/Q4/Q7, I2/Q11, I3, Q8, Q9, Q14, Q18, Q38, Q39) and correct Q49 and Q50. The 41 suggestions are out of scope. The work ran on branch `feat/c1-0-s5-deep-review-fixes` from `main` `3b833e1`, in the main working tree.
- **I1, option B:** when the harness stops while it holds no Project, Storage stops together with the canonical application, so a running upgrade ends as an owner stop. It answers `unavailable` and leaves its output for the next activation or upgrade. While a Project is held, Storage still stops only after its release.
- **Q13:** once the switch commits, an owner stop leaves the answer `upgraded`. This applies to a stop inside the switch transaction and to one at the post-switch checkpoint.
- **Q49 (supersedes design F3 and the "Try again" on the G5 panel):** the window offers "Try again" only when the diagnostic row is retryable. The FRD FR7/FR8 Follow-up records the narrowing.
- **Q50:** the window sends the automatic upgrade only when the runtime database is healthy. Otherwise it shows the safe-mode reason.
- **I3:** a `storageBusy` row (retryable) carries the busy text. Protocol version 6 becomes 7. The availability texts have one owner.
- **U5 (review round 1, 2026-10-07):** round 2 fixes everything: the blocker (a non-busy marker-query failure read as clean), the concerns and the small suggestions. This is the last review round.
- **U6:** a busy unfinished-marker lookup answers retryable `unavailable` with no discard-failed line, because no upgrade id is known yet. That answer is the distinct diagnostic, an exception to ADR 0005's discard-failed(busy) rule, and it is recorded in the ADR 0005 refinement lines.
- **U7:** the post-upgrade (G5) check is canonical-only. A false success always shows the `storageBroken` panel, whatever the runtime health. The healthy-runtime rule applies only to sending the upgrade.
- **Oracle changes accepted with these decisions:**
  - Q4 test: stdout keeps the upgrade-line forwarder after stop until stdout ends.
  - G5 panel: no "Try again", because `storageBroken` is not retryable.
  - "Try again" per row now follows `retryable`.
  - Busy-source runtime test: it now expects the `storageBusy` row.
  - Protocol design table: the `storageBusy` row is appended, and every protocol version pin is 7.
  - Owner-level busy outcome constants: they now carry `busy: true`.
  - Runtime: a canonical stop failure while no Project is held no longer keeps the application database alive.
- **U8 (review round 2, 2026-10-07):** the user accepted the not-held stop rule: with no Project held, a canonical stop failure is reported, but it does not keep the shared application database alive once Storage has stopped.
- **Round-2 outcome:** the user chose one fix commit and no further review round. The residuals are tracked as GitHub issues:
  - #95 "Prove a real-process quit during a running upgrade and assert its wire reply" (5g/5f);
  - #96 "Keep harness upgrade log lines that arrive after the child exits on quit" (W1);
  - #97 "Add mutation scope for the C1-0 S5 upgrade and shutdown branches".

## 14. Harness visual structure, first pass (user decisions, 2026-10-08)

Recommended by the coordinator and the ui-ux agent, approved by the user in the coordinator session. **Provisional:** the user keeps these open; the coordinator and the opencode design agent refine them together and present the final options to the user again before any Figma or Rive work. Saga and Chapter are view labels only; the domain keeps Project → Feature → Waypoint.

- **Shell:** keep the PRODUCT.md shell (activity rail and one replaceable sidebar; center Map/Conversation plus temporary surfaces; right contextual panel; collapsible lower panel). Work starts with the Conversation zone.
- **Conversation:**
  - D1: the right panel stays collapsed and opens on demand. Its pages are Decisions, Context and Details, and a header toggle shows a count such as "Decisions · 3/5".
  - D2: the scope navigator is a temporary drawer over the sidebar that closes after selection.
  - D3: a breadcrumb plus a compact Waypoint scope header (objective, status, "Open on map"); the composer placeholder names the scope.
  - D4: a model suggestion appears as a removable chip in the composer before sending, with Mention (default) or Send to; `#` is the manual trigger.
  - D9: a per-message model pill in the composer, equivalent to `/model`; the choice sticks within the conversation.
  - D10: a failure shows on the affected response (reason, Retry, Change model), and goes to Attention only when it blocks work.
- **Frame, Review and Runs:**
  - D5: the Waypoint-parent dialogue is a pane in the Run overview, with amendment cards to approve.
  - D6: the Decision Canvas preview is the right panel's Decisions page, labelled provisional and not styled like the map.
  - D7: Decision checkpoints are inline cards in the conversation.
  - D8: Review is a temporary center destination.
  - B1: the Waypoint-parent dialogue has no branches; read-only side questions cover the "what if" need (PRODUCT.md Workspace Interaction clarification).
- **Map views:**
  - M0: Chapter shows the Feature's Waypoints, ordered by `blocks`, with parallel Waypoints stacked. A Run's task DAG reuses the sequence layout in the Run overview.
  - M0b: steps and rows are derived, never stored.
  - M1: in the Saga, the same row means parallel, with at most 3 per row and labelled cross-row needs.
  - M2: every chapter opens; a click selects and "Open chapter" zooms.
  - M3: counts only, no percentages.
  - M4: a zoom of 300 ms or less, instant under reduced motion; the carved effect is kept only for map creation.
  - M5: the right panel shows Feature Details or Waypoint Details.
  - M6: a Project opens on the Saga with Attention framing.
- **Menus:**
  - N1: the Project menu opens from the Project name.
  - N2: Settings fills the sidebar with Application, Project and Models.
  - N3: the Waypoint menu opens from ⋯, right-click and the keyboard.
  - N4: a message toolbar with Branch and Copy, plus ⋯.
  - N5: rail labels show at 1280 px and wider.

## 15. Harness visual structure, refined pass (user decisions, 2026-10-08)

The coordinator and the opencode design agent worked as peers and converged; the user approved each topic in the coordinator session. This section refines §14 and supersedes it where they differ. The design is still under review in Figma (task-guided journeys); DESIGN.md is updated only after the design is approved.

- **Conversation (topic 1):** a send starts from the Project conversation with a clickable `To:` selector, never typed text, and a Send button that names the destination. A routed send leaves a linked receipt in the Project. After a successful send, `To:` returns to the Project; on failure the draft and destination are kept. The model override sticks within the conversation, with "Reset to Project default". `#` references a Waypoint and has a visible button; `@` attaches files.
- **Right panel (topic 2):** one contextual inspector without permanent tabs, whose decisions follow the displayed conversation. A named link opens its page directly (PRODUCT.md clarification). A checkpoint can be accepted in the panel as well as in the conversation; correction and final Frame acceptance stay outside the panel. Nothing becomes out-of-scope automatically.
- **Saga and Chapter (topic 3):** the M0-M6 baseline with an interleaved band, a "Linked work · A + B" combined drill-down and named cross-Feature stubs (derived view only). Overflow wraps visibly inside the group. Motion is 200-300 ms in both directions and instant under reduced motion.
- **Menus and rail (topic 4):** N1-N5 kept. Labels: "Use as recipient" (sets `To:`, sends nothing), "Begin…" (opens preparation and approval), Remove from list, Close, Archive, Delete SlopStop data. There is no Pin action.
- **Visual baseline (topic 5):** Cinzel for the RAGNAROK wordmark only, Inter for the UI and Cascadia Code for code. Matte carbon and graphite, with frost light only for focus or active work and amber only for genuine human attention. Medium density, no ambient glow or ornamental animation.
- **Comprehension journeys:** the first draft was judged appealing but confusing to use, so the design is reviewed through clickable, task-guided journeys in the order J3 → J2 → J1 → J4. After accept, J1 must say that the changes are not yet applied to the repository and show that next step.
- **Attention (J3 feedback, option c):** the Attention sidebar opens on Project or Map entry. Explicitly entering Conversation collapses it, but typing, sending or reading does not. The rail bell with its actionable-only count reopens it, and it stays open until closed. A new Project that goes straight to Frame starts with the list closed. Blockers stay as a persistent plain cue beside the affected action, there is one item per exact action, and a load failure never looks like zero. Opening or closing the list never resolves an item. A popover-only Attention (option b) was considered and superseded.
- **Decisions page:** a central Decisions page, reached from the Project menu and from "See all" in the right panel. It holds only product and plan decisions; operational approvals stay with their owners and are linked when relevant. It is not part of the Memory library.
  - Search, add, edit and remove are easy. Edit happens in place and is confirmed; the new version becomes current and the old one stays in history (append-only). Remove retires the decision and keeps its history. Add is authored and accepted directly by the user; no AI review gate is required.
  - Provenance of a direct add or edit says it was added or edited by the user there. An original conversation remains historical provenance only.
  - A possible contradiction with another decision or the plan shows an advisory, non-blocking note with the related wording and links; saving stays available beside "Review related decisions". A save never silently rewrites other decisions, the plan, running work or code. "Checking" and "Not checked" never look like "No conflicts". Real save failures and concurrent versions must be resolved, never overwritten.
  - An optional "Group by Project → Feature → Waypoint" view; a decision spanning several Waypoints stays one record with several links.
- **Decisions on the map:** Feature and Waypoint cards show a count of current linked decisions, and a named entry covers Project-wide decisions. The count opens that Decisions view in the right panel, while a normal card selection still opens Details. "Show on map" on a selected decision highlights the Waypoints that implement it without changing the layout, under a visible "Showing decision: … / Clear focus" control. There is no default decisions lens and no decision nodes on the map.
- **Decision links (domain):** a decision stores two separate links: its scope (the Project, one Feature or one Waypoint) and the Waypoints that implement it (zero or more). The current Frame protocol (`workspace-protocol.ts:289-307`, `:412-423`) has neither link and no direct add, edit or retire. Both need an ADR update before implementation, and the UI never infers them from a conversation's location or from a `blocks` relationship.

## 16. Conversation C1 design questions (user decisions, 2026-10-09)

- **Q1 — Projects already upgraded once (option A).** The first C1 slice adds chained upgrades: several completed upgrades per Project, with every older generation and backup kept and nothing deleted. This closes the C1-gate part of #92. Rejected: refusing the second upgrade, which would leave those Projects in safe mode without Conversation.
- **Q2 — Read-only Project (option A).** Conversation shows the saved messages; "Save locally" is disabled with the reason visible.
- **Q3 — Message text.** Text is saved exactly as typed, with no trimming and line breaks kept. An empty or whitespace-only message cannot be saved. The limit stays 32 KiB, measured in UTF-8 bytes.
- **Design facts accepted:** C1 adds dedicated read and save messages instead of reusing `conversation.message.submit`. Saving never uses `project.command`, so no canonical sequence number is taken.
- **Agent roles:** the rpiv designer agent does slice design only; the ui-ux agent owns all visual design, including the identity approved on the Figma startup frame 109:49.

## 17. Visual identity and Decisions page input (user decisions, 2026-10-09)

Decided by the user directly with the ui-ux agent and relayed verbatim; the action set was confirmed in the coordinator session. These supersede the topic-5 rules of §15 where they differ.

- **User's words:** "Segue a tua recomendação em relação ao cinzel nos títulos. Eu gosto do ecra de abertura (o do eclipse com runas) na identity direction como combinada. tal como esta no figma. O lado do brilho está bem no ecrã de abertura. O nome Ragnaro que fica com traço normal, como no ecrã de abertura A barra de icones tem os nomes a partir de 1280 pixels. O ícone da atenção é uma chama. Sim aprovo as duas cores novas que a gente acrescentou. Não gosto dos cantos cortados." On a glow on daily screens: "Não, não quero um brilho de fundo também nos ecrãs do dia a dia."
- **Startup:** the combined startup frame (Figma 109:49: eclipse, rune inscription, ash, ᚱ) is approved as it is.
- **Cinzel:** the wordmark, in Regular weight (not Bold) as on the startup screen, plus short fixed section names in capitals (for example ATTENTION, DECISIONS, NEEDS YOU). User content and surface titles stay in Inter.
- **Glow:** the startup screen only, with frost top-left and ember bottom-right. Daily screens have no background glow. The eclipse is kept for big moments only.
- **Rail:** labels show at 1280 px and wider (N5 kept).
- **Attention icon:** a flame with the actionable count, replacing the bell.
- **Palette:** plate #16191C and the solid state tints (ember #2A1D10, blood #2A1513, moss #132019, frost #14232B) are approved as roles.
- **Rejected:** chamfered (cut) corners on decision objects.
- **Decisions page input (not a final layout):** the user likes grouping by Proposed / In force / Superseded (Figma V2 114:221) and a "Why" section that explains where a decision came from (V3 114:353). The user dislikes the list format but likes decisions grouped by theme. Reading: Proposed = pending checkpoint items, In force = current, Superseded = replaced by a newer version or retired.
- **Proposed decision actions:** only Accept and Correct (user choice). No Reject or Discuss action.

## 18. Accepting proposed decisions (user decision, 2026-10-09)

- **User's words:** "Eu quero vê-las agrupadas. Mas aceito uma a uma."
- Proposed decisions are shown grouped in their checkpoint, but each decision is accepted on its own. Each has its own Accept, and Correct stays available. There is no bulk "accept all" action. This clarifies D7 (§14) and supersedes group-only acceptance.
- **Amendment (user, same day):** "Mas também quero uma opção para aceitar todas de uma vez só." Each decision keeps its own Accept, and the checkpoint also offers "Accept all" for the decisions still pending in it. Correct stays. Attention keeps one item per checkpoint: its label updates as decisions are accepted, and the count drops only when the checkpoint closes (J3 rule C).

## 19. Process choices (user decisions, 2026-10-09)

- **C1 workspace:** C1 is built in a linked worktree, as the rigorous lane recommends ("como recomenda o processo rigoroso"), not in the main working tree as in C1-0.
- **Design context:** the ui-ux agent runs `/impeccable init` to record the visual decisions (§14-18) as durable design context. The coordinator reviews and commits its files.
- **Reviewed slice designs are revised by the rpiv designer agent;** the C1 design is in intent review round 1 of 2.
- **Icons and eclipse (user, same day):** "usa Lucide e faz a clarificação do eclipse". Lucide is the single interface icon family (this replaces Phosphor in the old DESIGN.md). PRODUCT.md now states that the brand eclipse is an ornament for big moments only, and never represents domain objects or their relationships.
- **C1 merge order (user, same day):** S1 (the schema and chained upgrades) is not split. It merges to main only together with S2 (the Conversation store), so the permanent table shape reaches real Projects only after the store that writes it has been reviewed.
- **Map direction (user, same day):** on the coded Saga (spine) the user said "Ok eu gosto deste design do mapa" and asked for three Figma variants for Saga and Chapter (page 117:30). Of those, the user said "gosto da direcao da v3": the Graph variant (Saga 122:30, Chapter 122:235) is the chosen direction. Whether to build it in code is pending the user's answer to the ui-ux agent.
- **C1 design review outcome (user, same day):** after intent review round 2 failed with fixable findings, the user chose "Corrigir e eu confiro": the designer revises the design (revision 3), the coordinator checks every finding without a third reviewer round, and the user then approves. Candidate reviews of each slice keep the three reviewers.
- **V3 map built in code (user, same day):** the user chose "Construir a V3 em código". On the coded V3 graph (derived layers, orthogonal edges, Saga↔Chapter semantic zoom) the user said: "esta ok, vai precisar de ser refinada mas gosto da ideia." It needs refinement later.
- **Waypoint panel actions (user, same day):** "adiciona essas três ações ao painel do waypoint." The Waypoint panel offers: open its scoped conversation; "Use as recipient" (sets To:, sends nothing); and talk to the agent running its active Run (the Waypoint parent, in the Run overview), shown only while a Run is active, otherwise "No agent is working on it".
- **C1 design approved (user, same day):** the coordinator checked revision 3 (raw SHA-256 e4d02922…, before finalizing) against every round-2 item; the user approved it ("Aprovo, pode começar"). The implementer builds in a linked worktree on branch `feat/c1-conversation-local-save`, starting with S1 then S2 (merged together).

## 20. Decisions in Run context (user decisions, 2026-10-09)

- **Which decisions a Waypoint agent receives (option "only the relevant ones"):** the Invocation context for a Waypoint parent or Worker includes current Project-wide decisions, decisions scoped to its Feature or Waypoint, and decisions that Waypoint implements. All other decisions are excluded, with the reason recorded in the Invocation context record, and stay reachable only through read-only typed retrieval. This depends on the decision scope and implemented-by links (§15), which are not yet stored.
- **Editing a decision while a dependent Run is active (option "continue + warning"):** the Run keeps its pinned accepted revision, and nothing pauses or changes on its own. Attention shows one item ("Decision changed: Run X uses the earlier version") with an action that asks the Waypoint parent for a Run amendment proposal (ADR 0011), which the user approves or not.
- Both need an ADR amendment (ADR 0009 context sources; ADR 0011 amendment trigger) before Runs are built; tracked in GitHub.

## 21. Agent-to-agent communication in Ragnarok (user decisions, 2026-10-09)

Prompted by the coordinator ↔ design-agent peer dialogue used in this session, which the user judged a success.

- **Shape: mediated by the application.** Agents never message each other directly. Every message goes through the application, is durable and attributed, and is visible to the user in an agent dialogue inside its Run. It reaches the recipient only as an Invocation context source marked "agent-authored, no authority". It is bounded by a round limit, budget and loop-health detection. A converged outcome is a typed proposal (options, plan amendment, decision) that the user approves through Attention. Agent messages never carry or relay human approval. Isolation rules stay: no shared checkouts, turn sequences or hidden memory. Rejected: free direct chat between agents (it breaks isolation, attribution and replay); fixed peer moments only (too rigid).
- **First use: reviewer ↔ builder.** The user's words: "1 para comecar mais nao limitado a apenas revisor, construtor." The first use is an independent reviewer returning findings to the builder, with at most two rounds before the user decides. The mechanism must be general, not specific to that pair. Later uses include linked Waypoints agreeing on an interface, questions between agents, and peers preparing options for the user.
- Needs a PRODUCT.md change (the coordination rule at the "Parallel Workers keep independent turn sequences" bullet) and an ADR (agent dialogue ownership and the new Invocation context source kind).
- **PRODUCT.md text approved (user, same day):** "sim, faz isso". The mediated agent dialogue rule is appended to the parallel-Workers bullet.
- **User's target scenario:** "ao fazer um pedido a um agente (neste caso seria o supervisor, não sei se seria esse o nome), eu imagino que aí a tarefa vai ser repartida por vários waypoints dentro da saga e do chapter. Se estes agentes tiverem uma tarefa nas quais podem colaborar, então eles aí falam." Examples: a reviewer and a builder; and a front-end request where one agent owns the design and another owns the front-end implementation, talking to each other. Open points: the name and authority of the agent that splits a request across Waypoints (today the plan comes from Frame, and the Application coordinator is deterministic software, not an agent); whether collaboration happens inside one Run or across Waypoints and Runs; and role-specialised agents (design, implementation, review) in Run profiles.
- **Plan changes discussed by agents (user, same day; PROVISIONAL, "Temos que pensar bem nisto"):** when implementation shows the plan must change, the affected agents first discuss it through the mediated dialogue. They then bring one Run amendment proposal (ADR 0011) with the change, the reason, the effect on prior work and their dialogue attached; the user approves, corrects or rejects it. If they disagree at the round limit, they bring the conflicting positions, each side's arguments and a recommendation. While they discuss, only the affected tasks stop at a safe point and the rest continues. The user wants this thought through properly before it is fixed; it goes into the #99 discovery and design.
- **Correction to §17 "Glow" (coordinator, same day):** the user's decision was to keep the glow "as on the startup screen" ("O lado do brilho está bem no ecrã de abertura"). The orientation written in §17 (frost top-left, ember bottom-right) came from an agent's report. The ui-ux agent later measured the approved frame 109:49 and found the opposite: ember top-left, frost bottom-right. The binding rule is whatever frame 109:49 shows; §17's written orientation is superseded.

## 22. Component kit and typography (user decisions, 2026-10-09)

- **Component kit V3 "Seixo" chosen for every set** (relayed verbatim by the ui-ux agent): "botoes v3. campos de escrita v3. estados e avisos v3. cartoes e contentores v3. navegacao v3.listas e linhas v3. marcadores e contagens v3. marca v3. movimento v3." This replaces component feel A (quiet and machined) recorded in DESIGN.md. Seixo means: pill buttons and chips, 12-14px corners on cards, containers and rows, borderless tonal fills for fields and secondary controls, soft real shadows on raised items, and focus shown as a soft frost halo.
- **UI typeface reopened:** "nao gosto da letra inter. aprensata me 7 variantes para eu decidir a tipografia". The ui-ux agent is preparing seven OFL options. Cinzel and Cascadia stay unless the user says otherwise. DESIGN.md is updated once, after the typeface choice.
- **Material wording (user, same day):** the user chose to update the text. PRODUCT.md now says "soft rounded forms like polished stone" instead of "machined edges", while keeping matte carbon and graphite, restrained light and scarce state colour.
- **UI typeface (user, same day):** "gosto da red hat text". Red Hat Text (SIL OFL 1.1, variable 300-700; weights 400 body and meta, 500 labels and buttons, 600 titles) replaces Inter for UI and prose. It is bundled locally because of the app's CSP. Cinzel and Cascadia Code are unchanged.
- **Anvil brand exception (user, same day):** "aprovo a excepcao da bigorna". A custom anvil-and-hammer icon is the single exception to "Lucide only" and is used only on Send buttons, whose label still names the destination. On each send the hammer strikes once (about 420 ms) with sparks; under reduced motion nothing moves.
- **Prototype port timing (user, same day):** "Depois da C1". The React port of the coded prototypes (the ui-ux agent's PORT-PLAN.md in ragnarok-hero) is scheduled after Conversation C1, with the designer and the implementer under AGENTS.md (slices, red-green, reviews).
- **Port scope (user, same day, relayed verbatim by the ui-ux agent):** "apagad a medidade que cada fatia nova fica pronta. depende eu vou querer aquelas animcoes de abertura do rive e as animacoes do mapa (atencao, que as animacoes do mapa estao desatualizadas e sao as antigas, no entanto se essas animacoes podemn ser feitas em css ficam em css e nao em rive)". Meaning:
  - the old renderer UI is deleted slice by slice as each replacement lands;
  - the Rive startup moment ships;
  - the map motion is redesigned for the V3 graph, in CSS wherever possible and in Rive only where CSS cannot do it.
  Consequences the user still has to decide on before the port: a local Rive runtime (about 2.6 MB); `wasm-unsafe-eval` in the renderer CSP, which loosens a security default in AGENTS.md and needs an explicit decision and an ADR note; a paid Rive plan before release, to remove the watermark; and lucide-react versus inline SVG.
- **Rive and the CSP (user, same day):** "ok faremos com uma janela so para abertura." The Rive startup animation runs in a separate splash window, which alone allows `wasm-unsafe-eval` and never shows model or repository content. The main window keeps the strict CSP, and map motion uses CSS only. This needs an ADR note when the port is built.
- **Ragnarok-owned icons (user, same day):** the user asked for three variants of a fully Ragnarok-owned icon set, which would replace "Lucide only" once chosen. The coordinator drew them on Figma page 125:30: V1 Runa (126:30), V2 Seixo (127:30) and V3 Forja (128:30). The choice is pending.
- **Icon set chosen (user, same day):** "gosto da v1, incrivel!!". V1 Runa (Figma 126:30) becomes the Ragnarok-owned icon family and replaces "Lucide only": straight rune-stave strokes with no curves, diamonds instead of circles, 1.5 px, square caps and mitred joins. Missing icons are drawn in the same style and never borrowed from another set. The anvil stays as the Send exception. Consequence: the Attention mark becomes the Kenaz (torch) rune, replacing the flame of §17.

## 23. C1 S1 candidate review round 1 (user decisions, 2026-10-09)

- **Chain order, links only:** the order and root of chained upgrades come only from the source→target links, and `started_at` is not checked at all. A clock that moved backwards must never turn a valid chain into `REGISTRY_CORRUPT` (this follows the approved G16 wording). The coordinator had wrongly confirmed a strict-time reading to the implementer; that confirmation is withdrawn.
- **Approved S1 contract amendments:** (1) a CNV-B5 case that opens in safe mode with recovery required counts as "never opened"; (2) CNV-B5b case 1 is a guard, and case 2's red came from temporarily restoring the one-source retention; (3) CNV-B22 uses three real upgrades instead of an SQL seed, with the gap disclosed; (4) the C1-0 recovery test now expects cause `broken` instead of `unproven`, and the data stays quarantined.

## 24. Visual and interaction decisions (user, via the ui-ux agent, 2026-10-09)

Relayed verbatim by the ui-ux agent; recorded here as decided or open.

- **Decided:**
  - model text streams in progressively;
  - the anvil-and-hammer strike also serves as the "agent is thinking" indicator;
  - a custom dark title bar with the rune (frameless window, no native Windows title bar);
  - the Rive startup plays on first install and on every launch;
  - different sounds signal different kinds of completed tasks;
  - syntax highlighting uses the Ragnarok palette;
  - the UI language is English for v1;
  - role agents get distinct icons, still to be drawn;
  - live before/after diffs while an agent writes files;
  - the Waypoint panel shows diffs of the files changed for that Waypoint, with an expand button (the user will refine this);
  - a shortcut opens a cheat sheet listing every command.
- **Open:** how tool calls are displayed (HTML examples coming); error, failure and success states; first use; chart ideas for Runs and Diagnostics; the command list; Windows accessibility; notifications outside the app beyond sounds; the app icon ("aquele striker que eu te falei"), whose meaning is still to be confirmed with the user.
- **Tool-call display (user, same day):** "gosto da opcao A , em linhas." Tool use shows as one quiet line per tool. The live diff opens inline under the file being written and folds when the next step starts, and Expand opens the full view of all changes (prototype `ragnarok-hero/work.html?v=a`). Open: whether runs of four or more similar steps fold into one expandable line (the ui-ux agent's proposal).
- **Folding long tool runs (user, same day):** "gostei!". Runs of four or more similar read or search steps fold into one expandable line, for example "Read 6 files". Edits and commands never fold.
- **States, toasts and sounds (user, same day):** "Os toast ficam no canto inferior direito. Os sons ficam ligados por defeito. No entanto numa primeira instalação, é lançada uma espécie de pop-up que pergunta se você quer desligar ou não. E, claro, através dos settings também se vai poder desligar ou não. eu gosto do contorno no broken .No ecrã que bloqueia a runa, fica com o eclipse. No entanto já te disse que o símbolo está demasiado grosso." In practice:
  - toasts appear bottom-right;
  - sounds are on by default; a first-install prompt offers to turn them off, and Settings has the toggle;
  - a broken state is shown with a blood outline, with no new colour;
  - the blocking screen shows the eclipse with the Raidho rune;
  - the rune stroke is thin everywhere, in the ratio of the approved frame 109:49.
- **State catalogue, shortcuts and charts (user, same day):**
  - The state catalogue (prototype `states.html`: six tones and five scopes, each scope for a different case) is approved.
  - The Ctrl K palette and the Ctrl / shortcut sheet (`keys.html`) are approved: "Está muito bem feito". The actual shortcut list is to be defined later.
  - Charts: "gostei de todos os gráficos das runs" and "Em relação ao número 2, ficara em dólares e tokens. Sinceramente gostei de tudo o que implementaste nos gráficos." All Runs charts are in: timeline, budget, cost per Waypoint, last 30 Runs, and tests. Costs show both dollars and tokens. The Diagnostics charts are liked too, and their order is left to the plan. Open: whether the timeline shows every agent of a Run or only the selected Waypoint's.
  - New request: show how much of a subscription plan is used and how much remains, in Settings or elsewhere. Not designed yet; it depends on whether the provider exposes usage (the ADR 0009 Amendment 1 subscription/CLI mode).
- **Run timeline and plan usage (user, same day):** "Todos com o filtro. Penso que seria poderoso ter a visão geral e outra mais específica. Em relação às [definições] sim, gostei da maneira como tu as imaginaste." In practice:
  - The Run timeline shows every agent, with a filter down to one Waypoint.
  - Plan usage, approved as the ui-ux agent proposed:
    - in Settings, a meter per account showing percent used and left, the refill time, and a weekly limit where the provider reports one;
    - a top-bar chip and an Attention item appear only above a warning level (default 80%);
    - agents pause at 100%;
    - when the provider does not report usage, an explicit "not reported, this is not 0%" state is shown, never an invented number.
  - "Agents pause at 100%" must go through the Run pause rules (ADR 0007/0009 safe checkpoints) and budget policy; it is a design input for the Runs work, not yet a contract.
- **Sign-in options (user, same day):** "está detalhado que eu utilizo a API, ok? Isso é para manter porque eu gostaria de ter essa opção de conectar através da API. Agora eu também quero a opção de me poder fazer login através da página dos settings ou de outra forma, para utilizar a subscrição ao invés da API." This matches ADR 0009 Amendment 1, which provides two billing modes, `subscription` (sign in to the unmodified official CLI) and `api`. Constraints that stay in force:
  - a Run pins its mode, and the mode never switches automatically, so the prototype's "the other method stays as a fallback" can only be a manual choice, never an automatic fallback;
  - Anthropic does not allow third-party apps to route subscription credentials, so subscription sign-in happens in the official CLI;
  - public release with subscription mode needs Anthropic's written confirmation (a release gate).
- **Bundled quality tools (user, same day; the final position supersedes the first):** "Então talvez a melhor opção não seja dar o controle dos usuários para desativar essas ferramentas. No entanto eu quero que vocês estejam cientes de que essas ferramentas já vêm pré-instaladas no Arnis. Depois também, outra coisa em que teremos que prestar atenção é que essas ferramentas terão que ser atualizadas, não é? Portanto a Arda deveria ter lá um botão, se calhar, para eles fazerem o update da última versão." In practice:
  - the quality tools (jscpd, ast-grep and the others from the rpiv-claude workflows) ship preinstalled with the harness and cannot be disabled;
  - the app shows clearly that they are bundled;
  - an update control is wanted.
  The ui-ux agent's advice: pin tool versions per harness release; an update installs only versions tested with that harness, shows what changed, re-runs a self-check and allows rollback. Each tool's licence must allow redistribution. This needs its own interview and ADR; the user wants to discuss it further.
- **Agent marks (user, same day):** "Gosto dos ícones. As marcas convencem, sim. Está tudo OK." The agent marks in prototype `agents.html` are approved: Conversation (Ansuz), Waypoint parent (Othala), Worker (Uruz), Supervisor (Algiz, provisional pending #99), plus marks for common Worker roles. Identity marks stay neutral; state colours stay on separate marks.

## 25. Agent coordination FRD and coherence decisions (user, 2026-10-09)

- **Agent-coordination FRD (consensus confirmed):** `.rpiv/artifacts/discover/2026-10-09_18-03-55_agent-coordination-and-dialogue.md`. It covers the Supervisor (plans and coordinates; never executes, approves or starts Runs), the Forger per Run, the doer and reader Worker families, and an application-mediated agent dialogue in free text with an envelope. Dialogue is declared in the plan, budgeted from the Run, shown in its own thread, open to the user to write into or stop, and arrives in phases (inside a Run first, then across Waypoints through the Supervisor). Plan changes go through two phases: during discussion only the affected tasks stop; once a proposal is submitted, ADR 0011 applies. This resolves the §21 provisional conflict with ADR 0011.
- **Rename:** "Waypoint parent" becomes **Forger** ("alias fica so forger"). PRODUCT.md and CONTEXT.md are updated. ADRs 0007-0020 and existing code identifiers keep the former name until migrated.
- **Commits:** Ragnarok prepares the commit message (a "why" summary plus decision and Run trailers) and creates the commit only on the user's explicit approval (PRODUCT.md integration rule updated).
- **Billing:** both the subscription sign-in and an API key may be stored, with exactly one mode active at a time and manual switching (ADR 0009 note).
- **Map markers:** Waypoints on the map are diamonds (Runa geometry), not circles.
- **Coherence pass (user request: "atualiza todos esses lugares"):** PRODUCT.md, CONTEXT.md (galaxy/planet metaphors removed; Supervisor, Worker family, agent dialogue and Decision checkpoint added), DESIGN.md, design.json, the artifacts README (Current Authority), the old coordination record and the C1 brief (marked historical or superseded), and ADR 0009 are aligned with §14-25. The ADR 0005/0006 chained-upgrade amendments ship with the C1 S1+S2 merge (they exist on the C1 branch).
- **Runtime choice still open (user, same day):** the earlier leaning was the AI SDK instead of Mastra, because subscription mode was chosen for cost and gives less control over the conversation. Ragnarok now supports both API and subscription modes, so the runtime choice is not closed. It is tracked in GitHub #101, and PRODUCT.md and AGENTS.md stay unchanged until it is decided.
- **Effect usage rules (user, same day):** after an Exa and Context7 review of the Effect 4 documentation and of incremental-adoption guidance, the user asked for the rules in the repository instructions ("deixa as instrucoes sobre effect presentes no claude.md do repositorio" and "e agents.md tambem"). AGENTS.md gains the section "Effect Usage (effect 4)", and CLAUDE.md points to it. The rules cover incremental migration of new and touched code; Effect programs for I/O; typed errors; acquireRelease; Semaphore, Deferred and Queue; services with Layers; plain functions for pure logic; one ManagedRuntime per process with runPromise only at the edges; no runtime in the renderer; Effect-native test fakes. Measured baseline on main: 52 of 103 harness files import effect, 20 of them with Effect programs; 287 `throw new`, 6 `new Promise`, 24 `run*` calls in 14 files, and 1 ManagedRuntime.

## 26. C1 S1 acceptance (user decisions, 2026-10-09)

- **S1 closing (review round 2 had no code or decision defects):** "Corrigir e aceitar". The implementer adds three tests: the target-uniqueness loop guard, two upgraded Projects in one registry, and filesystem-agreement refusal on a chain of two. It also records the heavy runs for 75ce0d1 in evidence. The coordinator checks this with no third reviewer round. The heavy runs and mutation run again once on the final S1+S2 candidate.
- **Accepted:** the re-stamped C1 design (content_hash 493058d6…, the links-only amendment) is approved; the residual risk that the original S1 reds were not bound to patch digests is accepted; the S1 and S2 commits are squashed when merged to main.
- **Follow-up:** GitHub #102 tracks "Project listing cleanup is unconfirmed" masking real failures.
- **After C1 (user, same day):** "depois do C1 passamos a Conversa para React". The first post-C1 step is porting the Conversation screen to React (the walking-skeleton approach), ahead of the remaining prototype screens.

## 27. Open-points interview: Supervisor, links, dialogue, defaults (user decisions, 2026-10-09)

- **The Supervisor is the agent the user talks to in the Project conversation.** In a Waypoint conversation it is the same agent, scoped to that Waypoint. The user reaches the Forger through "Talk to the agent running Run N".
- **The Supervisor proposes a split, and the user confirms:** when it recognises work, it asks whether to split it, and goes ahead only on a yes.
- **Decision links:** the Supervisor proposes scope and implementing Waypoints; the user confirms them in the checkpoint or the map proposal, and can change them later on the Decisions page.
- **Dialogue closing:** agents declare the closing state; the app ends a dialogue at the limit or when it detects circling, and surfaces its state to the user.
- **Cross-Waypoint dialogue (phase 2):** it is paid from a Supervisor coordination budget that the user approves.
- **Defaults:** the user first chose "measure first", then, at the user's suggestion, provisional defaults from the coordinator's own multi-agent experience: 6 messages per agent per dialogue, then needs-human; 1 subject per dialogue; 2 review rounds; budget warning at 80%. They are visible, editable and recalibrated from use.
- **ADRs written as Proposed:** ADR 0021 (Supervisor, Forger and mediated agent dialogue; amends 0007/0009/0011/0014) and ADR 0022 (decision scope, implementing Waypoints and decisions in Run context; amends 0009/0011). Both await the user's acceptance.
- **Runa V2 approved (user, same day):** "aprovo a v2, aplica nos protótipos". The icon set is Runa V2 (Figma 139:30 on page 125:30; SVG source `ragnarok-hero/icons-runa-v2`, 77 icons), which supersedes V1 (126:30). It keeps a 1.5 px stroke, square caps and mitred joins, Kenaz for Attention, and the anvil Send exception. A notable V2 change: Settings is two diamond controls on tracks instead of the V1 hexagon.
- **Foundation by role (user, same day):** Foundation decisions are split into a Common section plus one section per Worker role (front-end, back-end/data, tests, design, security, docs, migration and so on), on the Decisions page and not in the Memory library. A Worker receives Common plus its role's section; a reviewer receives Common plus the section of the work it reviews; the Forger and the Supervisor receive every section. Existing Projects have each section inferred by a read-only Worker and confirmed by the user. This is added to Proposed ADR 0022 and to #104.
- **Agent marks updated (user, same day):** there are three kinds: Supervisor (Algiz), Forger and Worker (Uruz). The Conversation mark (Ansuz) is retired, because the Supervisor is the conversation agent. For the Forger mark the user chose "B": Thurisaz ᚦ, the shaping hammer, replacing Othala (options compared in prototype `forger.html`; Kenaz, Raidho and the state diamond were excluded because they are already taken). Applied in the prototypes and Figma 141:30. Worker roles: doers are design, front-end, back-end, tests, docs, migration and resolver; readers are research, review and security.
- **ADR 0021 and ADR 0022 accepted (user, same day):** "Aprovo os ADRs que escreveste porque eu já li." Both move from Proposed to Accepted.

## 28. C1 S2 deviations and final heavy runs (user decisions, 2026-10-09)

- **Deviation 6a accepted:** a failed force-close of an abandoned writer client reports `WRITER_REPOSITORY_CLOSE_FAILED` with cause `WRITER_CLIENT_ABANDON_FAILED`. The dedicated release code waits for the S3 protocol v8 change.
- **Deviation 6b accepted:** the S2 "second run" uses `coordinator.stop()`, because `project.close` is a storage-level command that does not go through the coordinator.
- **Final heavy runs authorised:** on S2 head de254e8, run sequentially and once each: full integration, e2e, launch-smoke, mutation project-storage and mutation conversation. Any failure or timeout stops the sequence and is reported before a rerun. A stray disk-wide `find` process was stopped first, with the user's approval.

## 29. C1 S2 candidate review round 1 (user decisions, 2026-10-10)

- **Heavy runs on 5a85033 all passed:** integration 2105, e2e 11/11, launch-smoke, mutation project-storage 87.52, conversation 84.12. The three reviewers failed the candidate (ba2b381), with overlapping findings: a queued save behind a failed settlement is not refused, defects are reported as storage broken, the read-only client close becomes a defect, and several required branches are untested (force-close, deviation 6a, read close failure, conversation-side owner busy).
- **U1:** add a truly broken client case (an unfinished transaction holding a lock) to CNV-B10(b), beyond the one injection R2-C9 allowed.
- **U2:** routing reads to the per-request read-only client after writer abandonment (R2-C3) moves to the S3 contract (CNV-B13); S2 proves only the read-only function.
- **U3:** abandonment covers only unknown client state from Conversation work; a settlement whose transaction close fails keeps the S1 retry-at-release. Recorded as a design-vs-result gap.
- **U4:** missing red-run logs are reproduced at their recorded parent and patch, with the digest checked; any red that cannot be reproduced is marked unverified.

## 30. Feature renamed to Strand (user decision, 2026-10-10)

- **The domain term "Feature" is renamed "Strand"** (user: "O nome feature vai ser mudado"; chose the Norns direction, then "Strand"). A Strand is one thread of fate, and its Waypoints are the knots along it. The hierarchy is Project → Strand → Waypoint. Rejected candidates: Voyage, Chapter, Route, Raid/Expedition, Saga at the Feature level, Skein, Weave, Wyrd.
- **How it lands:** product documents (CONTEXT.md, PRODUCT.md, DESIGN.md) use Strand with "formerly Feature". ADRs and existing code identifiers keep "Feature" as the former name until a dedicated rename slice migrates them, the same rule as the Forger rename (ADR 0021).
- **Open:** whether the map's Chapter view label (one Feature) becomes the Strand view or keeps a separate label.
- **Map view labels renamed (user, same day):** "Saga" (the whole-Project view) becomes **Weave**, the fabric where all Strands cross. "Chapter" (one Feature's view) is dropped: the one-Strand view is simply called **Strand**. Rejected for the Project view: Loom, Tapestry, Web. This closes the open point above.
- **Consistency requirement (user):** "vamos ter que atualizar documentacao para ficar consistente, caso contrario eu e os agente podem ficar confusos". Every current document, the prototypes and Figma move to Strand and Weave in one sweep. ADRs keep their accepted text plus a former-names note; code identifiers move in a dedicated rename slice after C1.

## 31. v1 scope interview (user decisions, 2026-10-10)

FRD: `.rpiv/artifacts/discover/2026-10-10_00-59-10_v1-scope-deferred-decisions.md` (consensus confirmed).
- **v1 means** "para mim, e talvez peça ao meu irmão para testar".
- **Diagnostics:** Sentry with consent in v1: a consent screen, a persisted choice and a provisioned DSN; off until consent; sanitised events only.
- **Identity:** the visible rename to Ragnarok is in v1 (executable, `%APPDATA%\Ragnarok` with a verified copy that keeps the old folder, AppUserModelId, titles). Internal names stay SlopStop. Challenged and narrowed from a full rename.
- **ISOL-1:** deferred; v1 admits trusted repositories only, with the current warning.
- **Packaging:** a simple unsigned Windows installer without auto-update; a licence check over dependencies and bundled tools must pass before the first installer is distributed.
- **Agent dialogue:** pairs only, several concurrent pair dialogues per agent; the default limit is 12 messages per agent per dialogue (was 6); phase 2 (cross-Waypoint through the Supervisor) is in v1; the closing state is an agent-declared mandatory field that the app validates.
- **C2:** both billing modes, one active at a time.
- **Models:** one default model chosen at first install, plus overrides per role and per task (model and effort).
- **Bundled quality tools:** pinned per release, plus an Update control limited to tested versions, with a change list, a self-check and rollback.
- **Architecture review:** proposed by the Supervisor at the end of each Strand, plus on request.
- **Project profile:** default lane, review rounds and dialogue limits, the test-discipline exception, models per role.
- **Open visual items:** a session with the ui-ux agent (#121) before the React port. **Rive paid plan:** only before a public version. **Evaluation protocol and product thesis:** part of v1 acceptance (#125).

## 32. C1 S2 round 3 approved (user decision, 2026-10-10)

- Round 2 (the last) closed every round-1 item and found four verified concerns: (A) a work defect with a failed close skips client abandonment, a regression from F2; (B) the settlement failure flags are published after the slot is released; (C) the non-busy rethrow in the Conversation transaction is untested; (D) the project-storage mutation score was carried from an earlier candidate, and its proof log is a placeholder.
- The user approved ("sim") a short, bounded round 3 beyond the two-round cap. It covers fixes A and B, tests for C and the suggestions, evidence corrections, heavy reruns on the final head including both mutation configs, and one verifier limited to these fixes instead of a full three-reviewer round.

## 33. #121 visual and interaction decisions (user, 2026-10-10)

The user answered the seven #121 boards in the ui-ux agent's session (hub `ragnarok-hero/v1-121.html`), and the coordinator confirmed four points in its own session.
- **First use:** data copy → billing (skippable, with an Attention reminder before the first Run) → default model (Opus 5.5 preselected) → crash reports (off until consent) → first Project. Sounds are not a setup step: after the first real Run sound, a toast offers Turn off or Keep (option B). When the copy fails repeatedly, "Start from scratch" sits behind a confirmation, and the old folder is never deleted.
- **Accessibility:** all proposals accepted. Text follows the Windows Text size setting. Toasts pause on hover or focus and stay 12 s with a screen reader. Under reduced motion the map zoom becomes a 120 ms fade, which changes the earlier "instant". Title-bar caption buttons are native Windows buttons inside the dark rune title bar (option A). An agent runs an NVDA speech-log pass per phase, and the user listens with Narrator. The stronger focus ring and the 12-point checklist apply per slice from the React port onward.
- **Notifications:** no tray icon in v1. Minimised, Runs keep working; closing the window asks, then pauses Runs (confirmed). Our own per-event sound always plays, even under Do Not Disturb (confirmed against the ui-ux recommendation), while the Windows toast follows Do Not Disturb. Hide-details on the lock screen is on by default (confirmed). Windows toasts fire for plan at 80% (once per usage window) and for a proposed architecture review; calm events keep their sounds. The taskbar flashes only for broken and plan at 100%.
- **App icon:** candidate B, the Raidho rune in frost on a carbon plate. The meaning of "striker" is moot.
- **Role marks:** the polished marks are approved, including the Research and Security redraws. New reader roles: Architecture, Accessibility, Performance. The closing state shows on every message. **Not changed:** the user kept the ADR 0021 rule that two "no agreement" declarations close a dialogue (confirmed in the coordinator session), overriding the ui-ux proposal.
- **Waypoint Changes tab:** a separate tab, and the panel widens to 480 px. It opens on the waiting or writing Run. Each file row shows the role mark, plus the Worker name on hover. Above 800 changed lines a file shows a summary only.
- **Run timeline:** on the Runs page above the list, joining all Runs in progress on a fixed time scale. The filter only dims the other Waypoints. The Supervisor lane is always visible. The DESIGN.md sentence was adopted.

## 34. Role profiles (user decisions, 2026-10-10)

- Each agent role gets a **role profile**: a versioned, Ragnarok-owned record with instructions, allowed tools, an output schema, context sources and a default model and effort. rpiv rules that depend on tools agents will not have (MCP, subagent spawning, AskUserQuestion, gh, web, hooks, scripts) move into the application. Tracked in #128.
- **Editable (user: "gostaria que fosse possível editar"):** instructions, model and effort are free. Tools stay within the family: a reader never gets write tools, and network needs explicit approval.
- **Scope:** profiles are app-wide, with a visible per-Project override.
- **Safety:** every edit is a new version with a diff, with one-click revert to the Ragnarok original. A Run pins the versions it used. When Ragnarok ships a new profile version, the user sees the diff and chooses keep, adopt or merge.

## 35. #94 investigation scope (user decision, 2026-10-10)

- The user approved ("sim, tudo ok se for necessário"), when needed, (a) instrumentation in production code beyond test-side tracing and (b) a load generator plus `handle.exe` to see open file handles. Standing rules stay in force: no timeout raises and no gate weakening without the user; heavy runs only with the coordinator's go-ahead on a free machine; new production code follows the Effect rules.

## 36. C1 S3 design and the main push retry (user decisions, 2026-10-10)

- **Main push:** the first attempt (push-main-7) failed in test:integration, with 4 registration tests failing (3 timeouts with EBUSY, 1 "Proposal missing"), the #94 pattern, while other agents were working. The user approved ONE retry on a fully idle machine. If it fails again, the push waits for the #94 fix. The failure is #94 evidence.
- **S3 design:** intent review round 2 (the last) on revision 4.1 found 3 verified test-contract blockers and about 10 concerns. The user chose revision 4.2 fixing all of them, plus one verifier limited to the fixes (as in §32).
- **Deviation 6b extended to S3:** CNV-B14 uses the switch and the coordinator stop instead of `project.close`, because `project.close` does not reach the coordinator. App behaviour is unchanged. Accepted.
- **G17 extension accepted:** besides abandonment and a failed settlement (U2), a failed writer snapshot also routes the read to the per-request read-only client. One rule, no special cases.
- **Main push retry succeeded:** push-main-8 on an idle machine passed the deep pre-push gate (integration 2115 passed, e2e 11/11, launch-smoke OK), and origin/main is now 7a1b041.

## 37. C1 S3 design approved (user decision, 2026-10-10)

- The user approved ("sim, aprovo") C1 design revision 4.3 (content_hash `5ff869b7b774e2cc6bd1143ef507488868b9c2020ae0e80840e7576649df2e19`) for slice S3. It was reached through two intent review rounds, the user-approved revision 4.2 with a bounded verifier (§36), and revision 4.3, whose nine verifier findings the coordinator checked one by one against `.rpiv/artifacts/evidence/2026-10-10_c1-s3-rev42-verification.md`. S3 (#107) may start.

## 38. Order: C1 S3 before the #94 measurements (user decision, 2026-10-10)

- The user chose option (a): C1 S3 (#107) starts now, and the #94 measurement steps (2-4) come after it. #94 Step 1, the test-side instrumentation gated by `SLOPSTOP_TRACE_94` with no runs, may be written between S3 steps. S3 heavy runs keep running on an idle machine. If a stall appears during S3, the run stops and becomes #94 evidence; no rerun hides it.
- The #94 Step 0 findings so far: about 10-13 registration tests take 5-7 s at idle against a 15 s budget, so they fail under load; separate stalls (up to about 96x) are suspected in the shared SQLite worker path. The remedy for the slowdown is a user decision after the measurements; timeouts are not raised.

## 39. CodeScene waiver for C1 S3 (user decision, 2026-10-10)

- `apps/harness/src/registration/project-registration-preparation.ts` scores 8.03, the same pre-existing score as on main; C1 S3 step 10 (CNV-B37, #102) added no smell. The user accepted it as recorded pre-existing debt for C1 S3 only, the same kind of waiver as #110, with the refactor to 10 tracked in #129 after the #94 measurements.

## 40. C1 S3 round 3 approved and win32 gating accepted (user decisions, 2026-10-10)

- S3 candidate review round 2 (the last) closed every round-1 item and found no production defect. What remained: three test-contract gaps (a clean listing closing clean, the injected reconciliation opener actually being used, the writer-read arguments), the repository evidence for the heavy runs with per-file mutation scores, a too-wide coordinator mutation range, and test hygiene.
- The user approved a short, bounded round 3, as in §32. It covers those fixes, fresh heavy runs on the final candidate (the changes touch integration tests) and one verifier limited to the fixes. The S3 merge decision follows.
- **Win32-only rows accepted:** the CNV-B13 read-only rows and the CNV-B14 phase-1 per-request rows run only on Windows. v1 is Windows, and Linux is deferred (#112). This is recorded as a deviation to revisit when Linux enters.

## 41. C1 S3 accepted (user decision, 2026-10-10)

- The round-3 limited verifier closed round-2 items A-H with no new defect. Final heavy runs on 97aeaa1 passed: integration 2143, e2e 11/11, launch-smoke OK, root mutation 88.25, conversation mutation 92.41. The user accepted S3 and authorised a squash merge into local main without a push. S3 changes no database schema, so no new `userData` backup is needed.

## 42. C1 S4 in React, and #94 measurements in parallel (user decision, 2026-10-10)

- **C1 S4 (the Conversation window) is built in React** from the coded prototypes, so the Conversation React port happens inside C1 (DL:348) without building the screen twice. The C1 design needs an S4 revision (React renderer, bundled fonts, CSP, DESIGN.md and the #121 decisions, the per-slice accessibility checklist) with its intent review and the user's approval before building.
- **#94 measurements run in parallel** in a separate Herdr agent, `medições` (pane w3:p28), in its own worktree. Measurement batches and heavy runs never overlap with other test runs: each batch needs the coordinator's go-ahead on a free machine (§35 rules apply).

## 43. C1 S4 scope (user decisions, 2026-10-10)

- **Split:** S4a "renderer foundation" covers bundled fonts, Seixo tokens, the Runa icons S4 uses, the focus ring, and an accessibility e2e harness (axe, forced-colors and reduced motion in the real Electron launch with the real CSP). S4b "Conversation window" covers the bridge, IPC, preload and React surface, keeping behaviour IDs CNV-B16 to B18 and B31 to B35. Each is its own red-green slice with its own candidate review.
- **Shell:** S4 restyles only the Conversation region. The old shell (rail, header, Projects sidebar) stays until the shell slice of the React port, so two looks coexist for a while.
- **Old prototype window** (`apps/desktop/src/renderer/prototype`, about 6,300 lines): deleted entirely in S4, with its knip, Forge and main entries and the shell.test prototype journey. The ragnarok-hero prototypes stay the reference.
- **Dependencies:** `@fontsource/red-hat-text`, `@fontsource/cinzel`, `@fontsource/cascadia-code` (OFL-1.1, pinned in the catalog, served locally under `font-src 'self'`) and `@axe-core/playwright` (MPL-2.0, devDependency, e2e only). They are included in the licence check before the first installer.

## 44. C1 S4 design: revision 5.2 and the CSP clarification (user decisions, 2026-10-10)

- S4 intent review round 2 (the last) on revision 5.1 (`fb948d46…`) found 2 blockers (the focus ring's transparent outline versus CNV-B42, and "Save is never disabled" pinned only for read-only) and about 26 concerns. The user chose revision 5.2 fixing every item, plus one verifier limited to the fixes (as in §36), then approval.
- **CSP clarification (user):** nothing changes. The Rive startup runs in its own splash window, the only window allowed `wasm-unsafe-eval` (DL:268-274); the main window keeps the strict CSP. The header-only CSP gap is issue #130; S4a's G29 builds one per-window CSP owner whose main-window policy never contains `wasm-unsafe-eval`.

## 45. C1 S4 revision 5.3 (user decisions, 2026-10-10)

- The bounded verifier on revision 5.2 (`1718800d…`) confirmed both round-2 blockers fixed. Of 55 claims, 41 were Verified, 13 Weakened and 1 Falsified.
- **Stale activation:** "Reopen Project" cannot work in the real app, because the coordinator refuses a switch from a stale activation and refuses activate with PROJECT_ALREADY_ACTIVE. The user accepted showing the stale-activation notice without an action. The recovery is a recorded gap: owner the coordinator, trigger the first real occurrence.
- The user chose revision 5.3, applying every verifier item with a resolution table and no new agents. The coordinator checks each item, then the user approves.

## 46. C1 S4 design approved (user decisions, 2026-10-10)

- The user approved C1 design revision 5.3 (`e05cac0b6573365816e033a2490dbd0cd0f4a0898e26b1d61274839b9d369180`) for S4a and S4b, after the coordinator checked every rev-5.2 verifier item. Approved with it:
  - G29: one per-window CSP owner, with the main policy also written into the page as a `<meta>` (fixes #130);
  - G30: S4a merges only together with S4b;
  - the composed-IPC-failure proof is deferred again;
  - the proposed copy, as listed in G24: "Write a message", "Loading messages…", "No messages yet", "Messages you save stay on this computer.", "Could not load this conversation.", "Read only: <reason>", "Not saved.", "Not confirmed.", and the "Save locally" button.
- **G25 confirmed:** a sent save that is then lost (a disconnect, a stop, or a malformed reply while pending) answers `uncertain` ("Not confirmed."). A decodable but wrong reply stays `broken`.
- **G28 accepted as a temporary exception:** the desktop bridge keeps its Promise core. The user asked to define when it migrates. It migrates with #123 (Effect unit 2b: one ManagedRuntime per process, Electron main included), in roadmap phase 2 right after C1 and **before C2**, because C2 adds streaming and cancellation through this bridge. The user specified it comes after #105 (TypeScript 7 and the Effect language-service rules), the roadmap phase 2 order.

## 47. #94 remedies (user decision, 2026-10-10)

- The #94 cause is proven (evidence `.rpiv/artifacts/evidence/2026-10-10_94-timeouts-under-load.md` on `feat/94-instrumentation`, 7ff05de). The stall-type timeouts are CPU starvation from concurrent multi-threaded repository searches (ripgrep). A synthetic burst produced 18 real 15 s timeouts, all inside the burst window, and every stalled step finished later. Quiet baselines were clean.
- The user chose remedy **(c)**: lighter canonical fixtures, a seeded database template instead of a full Storage create per test, together with the one-line cwd fix in `canonical-writer-package-smoke.integration.test.ts:45`. The user also chose **(d)**: lighten the slowdown population, the ~13 registration tests at 5-7 s whose most expensive step is the confirm at ~1.8 s.
- Not chosen now: (a1) a written rule, (a3) a CPU pre-flight before push, (b) lower-priority agent searches, and (e) production tracing (P2). They stay recorded in #94. Timeouts are untouched.

## 48. Forced-colours accessibility oracle (user decision, 2026-10-11)

- In S4a E2, axe reported no violations in normal colours. Under emulated forced colours it reported color-contrast false positives: the rendered text is black on white, but axe reads `-webkit-text-fill-color`, which Chromium's emulation leaves unforced. The old shell shows the same false positives.
- The user approved replacing the oracle in CNV-B44 and in S4b's CNV-B47. In the forced-colours run only, axe's `color-contrast` rule is disabled, because a forced theme's contrast comes from the user's system theme. A direct assertion replaces it: every text element in the region computes the forced CanvasText colour, with `forced-color-adjust: auto`, plus the screenshot. The axe configuration is recorded. Normal-colour axe runs keep every rule.

## 49. #94 fix scope (user decisions, 2026-10-11)

- **(c) approved as planned:** a per-process template plus a whole-root copy for `createCanonicalCommandDatabase` and the package-smoke `seed()`, together with the cwd fix. An equivalence test (same tree; same schema and rows per database; byte equality where it holds; a real `open` answering read-write) keeps the real create exercised and is bound by a mutation.
- **(d):** D1, injecting the manual clock into the native-observer deadline test (about 7 s down to under 1 s, every assertion kept), plus a separate product slice d-P1 that caches the generated migration resources per authority, so they are not reloaded on every application.db open. No verification is removed; d-P2 (fewer integrity and schema checks) is not chosen.
- **Instrumentation stays** in the repository, off by default and proved inert when off.
- **The 4a synthetic burst is repeated** after (c), to measure the direct effect on the 18 timeouts.

## 50. #94 d-P1 dropped (user decision, 2026-10-11)

- Step 0 measured the migration-resource load at about 3 ms of the about 50 ms per application.db open (about 6%). Caching would save about 0.3 s per registration-flow test (4.5-6 s idle), at the cost of moving resource verification from every open to once per process; the digest middle option saves almost nothing. The user chose not to do d-P1; it stays recorded in #94. The bigger levers (fewer opens per registry step, or fewer per-open verifications) are later design decisions.
- The #94 fix therefore consists of (C) seeded canonical templates plus the cwd fix, D1 (the manual clock in the native-observer deadline test) and the instrumentation, which stays off by default.

## 51. C1 S4a accepted (user decision, 2026-10-11)

- S4a passed candidate review rounds 1 and 2 with nothing serious left. Final-head runs on 0eb8a32 all passed: e2e 18/18, launch-smoke, root mutation 88.48, gates and CodeScene 10. The ui-ux agent confirmed the final screenshots and the anti-clone check. The user accepted S4a at 07651a2 (code identical to 0eb8a32). By G30 it merges to main only together with S4b. S4b starts on the same branch.

## 52. Screen-reader check: Narrator only for now (user decision, 2026-10-11)

- NVDA 2026.2 crashes at start on this machine. Its log shows `AttributeError: function 'lou_freeTableFile' not found`: it loads Windows' own `C:\Windows\System32\liblouis.dll` (Microsoft-signed, used by Narrator) instead of its bundled one. That cannot be fixed without administrator rights or touching a system file.
- The user chose Narrator only for now. The §33 agent NVDA speech-log pass is recorded as "unavailable (incompatibility)", never as passed. The automated accessibility checks (axe, forced colours, zoom, announcements) and the user's Narrator listen stay. The NVDA pass returns when a compatible NVDA version exists.

## 53. #94 closing path (user decision, 2026-10-11)

- #94 candidate review round 2 (the last) closed every serious round-1 item. One evidence claim was still overstated: run 4 of batch 2b had several 6-10x rows, not one. Four small suggestions remained: `seedDatabase` set only inside the template build, keeping the original build error when cleanup fails, a headed cwd log, and the Outcome's "Still open" list.
- The user chose to apply these final corrections without another review round, with the coordinator checking each item. Then come the final heavy runs on the final head (integration, native-long, deep-style gates), then the merge decision.
- Final head e993ec0 passed once on a clean tree: `pnpm check:deep` exit 0 (coverage 4781 passed, integration 2161 passed, e2e 11/11, launch-smoke OK, no timeout) and the headed cwd log from apps/harness 149/149. The user chose a squash merge into main (f45de07); push only when asked.

## 54. C1 S4b visual changes (user decisions, 2026-10-11)

- The ui-ux review of the S4b screenshots (C1-C11) is applied in full:
  - a centred 720 px column;
  - Save inside the field bar;
  - the composer anchored at the bottom;
  - a painted disabled look for an `aria-disabled` Save (still focusable);
  - status-row gap and tone icons;
  - the over-limit fault slot;
  - failed-load notices in the Failure tone (the stale-activation notice keeps no action, per §45; the user confirmed this over C8's Reload, because a Reload there always fails again);
  - the uncertain row in the Unknown tone, with a ghost "Try again";
  - message meta on one baseline;
  - forced-colours edges.
- **Contract amendment:** a rejected save or read (a preload call rejected, a rejected load) uses the Failure tone (fault slot or Failure notice, circle-x), not the Broken tone. Broken is reserved for an actual broken status. This amends the design's CNV-B32 and CNV-B35 rows; the sealed design body stays, and this log is authoritative.
- **Copy:** under the composer, when the conversation did not load, Save's reason reads "Saving is off until the conversation loads." (approved), instead of repeating the notice.
- **Stale-activation copy (user, same day):** the implementer checked the code. Choosing the Project again, or switching away and back, is always refused (stale-activation, then PROJECT_ALREADY_ACTIVE). Only restarting the app recovers. The notice keeps the title "Could not load this conversation." and gets the approved detail "This Project was reopened elsewhere. Restart Ragnarok to open it again." The harness diagnostic text stays for Diagnostics and logs. The §45 recovery gap stands.
- **ui-ux review 2 (same day):** two more changes. D1: one 720 px column and one left edge for the plates, the header and the context lines. D2: the status slot is visually hidden, but still announced, while a load notice shows (8b, 8d, 8e), as in 8c. **User-approved copy change:** in read-only mode the composer shows no "Write a message" placeholder; the "Read only: <reason>" line explains why.
- **Dead Try again (user, same day):** after a kept failure with Try again, editing the draft clears the saveId but keeps the outcome, so Try again stays visible and does nothing (`use-conversation-save.ts:77`). The user chose to hide Try again as soon as the draft is edited. The previous failure line may stay as information, and the edited text is saved as a new save with "Save locally". No dead button.

## 55. #101 agent runtime for API mode (user decisions, 2026-10-11)

- **Providers:** in API mode, v1 talks to Anthropic only; other providers maybe later.
- **Checked (Context7 AI SDK docs and npm metadata, 2026-10-11):** the AI SDK covers schemas without Zod (`jsonSchema` with our own validation; Standard Schema inside provider-utils), cancellation (`abortSignal`, `onAbort`), tool approval (`needsApproval`, `toolApproval`, or a manual loop with tools that have no `execute`), Anthropic prompt caching (`cacheControl`, 1 h TTL) and adaptive thinking with effort. However `ai` 7.0.137 and `@ai-sdk/anthropic` 4.0.78 declare `zod` as a required peer dependency, so Zod would ship in the packaged harness. `ai` also depends on `@ai-sdk/gateway`, so a plain model-id string routes through the Vercel gateway. `@anthropic-ai/sdk` 0.133.0 declares `zod` only as an optional peer. Today Zod reaches the repository only through dev tools (knip, likec4, Stryker).
- **Decision:** API mode uses the official Anthropic client (`@anthropic-ai/sdk`) behind the ADR 0009 runtime port. Mastra is out. The AI SDK may come later as a second adapter if other providers are wanted. Subscription mode stays the governed Claude CLI session (ADR 0009).
- **Follow-up:** remove the Mastra references (PRODUCT.md:84, AGENTS.md, `mastra.db` in ADRs 0001, 0002 and 0006, the Project Storage manifest and `docs/architecture/model.c4`) in a separate change; #93 is resolved by that removal. The C2 design names the client version and keeps the API key in `safeStorage`.
- **Cleanup timing (user, same day):** the text cleanup was done at once (PRODUCT.md, AGENTS.md, CONTEXT.md, `model.c4`, ADR amendments). The code cleanup of `mastra.db` and `mastraMigrationHead` (#93) comes after #105 (TypeScript 7 and the agreed configs) and #123 (Effect migration), before any new feature, "Dessa maneira deixamos tudo pronto antes de avancar com mais features". #101 closes after the text cleanup. The push of main waits until the implementer finishes the S4b runs.

## 56. C1 S4b candidate review round 1 (user decisions, 2026-10-11)

- Round 1 ran three reviewers on e3706d3, and the claim-verifier checked every finding. The result is twelve fixes, T1-T12:
  - T1: focus ring on focused unavailable controls (ui-ux approves the visual);
  - T2: "Saved" clears on the next input;
  - T3: `project-entry-bridge.ts` S4b ranges in the mutate list;
  - T4: the stale final-head E5 (package before E5);
  - T5: the CNV-B32 isolation sub-rows;
  - T6: no Try again under a read-only activation;
  - T7-T11: missing oracles (focus guards, Reload pressed twice, saved-at month boundary, Try again available state, the not-loaded reason after a load);
  - T12: classify the 60 survivors that were never classified.
- **Activation check in settleSave (C6):** the real app cannot reach it today (G13 drain, in-order answers). The user chose "Corrigir por precaução": a pending save also requires the current `activationId`, while a dropped save's late answer stays accepted (fifth drain case). Add one row.
- **Stale-activation save copy:** the user chose to match the §54 load notice. The save line for a stale activation now says "This Project was reopened elsewhere. Restart Ragnarok to open it again." instead of the harness text "The Project was reopened. Reload the conversation."
- Pedro's Narrator listen (§52) remains a manual gate before acceptance. Round 2 is the last.

## 57. C1 S4 integration path under the current rpiv chain (user decision, 2026-10-11)

- The current rpiv workflow runs implement → deep-review → validate → PR, with mutation once on the final candidate after the last review round, and integration under a separate authorization.
- **Decision:** after Pedro accepts S4b, run `/rpiv:deep-review` and `/rpiv:validate` over the S4 range (merge-base `b96b305` with main through the final S4b head; `07651a2` is the accepted S4a head) before the S4a+S4b squash into main. This replaces the G30 "squash right after acceptance" path for S4; S5 is not awaited.
- The root Stryker runs once on the final S4b candidate after round 2 closes; earlier runs (`aac55b5`, the T3 targeted run) are diagnostics only.

## 58. C1 S4b candidate review round 2 (user decisions, 2026-10-11)

- Round 2 (the last) ran the three reviewers on `ff2cd8e`: all passed, no blocker; every round-1 fix T1-T14 holds. One concern and nine suggestions remain (table in the local evidence folder `.rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/s4b-review-round2.md`).
- **Path:** the user chose "F1-F7 sem 3.ª ronda". The implementer applies F1-F7 with red-green where behavior or tests change; there is no third review round, and the unreviewed fix delta is recorded as residual risk. F8-F10 (shared activation fixture, a UI row for T13, a neutral owner for `staleActivationDetail`) are follow-ups.
- **F7 copy:** under a read-only activation with a kept uncertain or dropped outcome, the line drops the "Try again to check it." sentence and says only "The save could not be confirmed.", because no Try again is offered (T6).
- After the fixes: the root Stryker once on the final candidate, then a fresh package, E5 and E4; then Pedro's Narrator listen and acceptance; then deep-review and validate over the S4 range (§57).

## 59. C1 S4b final mutation scope (user decision, 2026-10-11)

- **Exception to the rpiv rule** "mutation runs once on the final candidate": the user chose "esta vai ser a excepção. apenas nos ficheiros alterados". The final mutation run on `020cb6a` covers only the five source files changed since the `aac55b5` root run: `conversation-region.tsx`, `load-notice.tsx`, `save-outcome.ts`, `settle-save.ts` and `use-conversation-save.ts`.
- The other mutate entries keep their `aac55b5` scores (and `project-entry-bridge.ts` its T3 score), because their source is unchanged since then. Residual risk: changed tests are not re-measured against unchanged sources. This is a one-off exception, not a new rule.

## 60. C1 S4b Narrator listen and acceptance (user decisions, 2026-10-11)

- **Narrator listen (§52):** Pedro listened to the packaged candidate `a1fc648` on a separate seeded userData (`--user-data-dir`, the real `%APPDATA%/SlopStop` proven unchanged) following `narrator-checklist.md` part A, steps 1-8, and answered "tudo ok". Part B states (failures, read-only, stale activation, Try again) are covered by the ui-ux screenshot sign-off and the e2e rows. The NVDA pass stays unavailable (§52).
- **Acceptance:** Pedro accepted S4b at the exact revision `a1fc648` ("Aceito a1fc648"), with the recorded residual risks: no third review round for the F1-F7 delta and the mutant-234 test (§58), and the changed-files-only final mutation (§59).
- Next (§57): deep-review and validate over `b96b305..a1fc648`, then a separate integration authorization for the S4a+S4b squash into main.

## 61. C1 S4 deep-review fix round (user decisions, 2026-10-11)

- `/rpiv:deep-review b96b305..a1fc648 lane=rigorous` (agent "revisor", review `.rpiv/artifacts/reviews/2026-10-11_19-07-31_b96b305-a1fc648-c1-s4-conversation-window.md`): 0 critical, 7 important rows (5 distinct problems), 26 suggestions, 4 discussion, 4 withdrawn; security clean; gates clean.
- **Fix round (the one deep-review round):** the user chose "Ronda de correções" for the important findings:
  - I3/Q17: the not-confirmed copy follows the same condition that shows Try again; whenever Try again is hidden (read-only, or the draft was edited), the line says only "The save could not be confirmed.";
  - I4/Q10: one owner for the ghost-sm button; reduced motion removes the Reload and Try again transition (G26);
  - Q12: the forced-colours edge targets the class the status row really uses, and the test checks a rendered element;
  - Q5: the note strip reads the canvas token instead of the `#050606` literal (shared-vocab-union);
  - Q23: the four `as` casts on mock calls become the named-error helper.
- This voids the S4b acceptance (§60): after the fix commit, gates, the targeted mutation on the changed source files, a fresh package, E5 and E4 run again, and Pedro accepts the fixed revision before `/rpiv:validate`.
- The 26 suggestions and 4 discussion points go to one GitHub follow-up issue (user: "Sim, abre o issue").

## 62. C1 S4 deep-review re-review: last fixes without a further review (user decision, 2026-10-15)

- The re-review (`.rpiv/artifacts/reviews/2026-10-15_09-38-54_b96b305-cec7422-c1-s4-fix-round-rereview.md`) of the fix commit `66a29a1`: I4/Q10, Q12 and Q23 resolved; I3/Q17 and Q5 partly resolved; two important findings left, and no second deep-review fix round exists.
  - I1 (introduced by `66a29a1`): `.seixoTokens` joined the whole `.seixo` appearance rule, so the note strip takes the Seixo font and the layered `background: var(--canvas)` is dead.
  - Q1 (pre-existing, fourth recurrence of the copy/affordance class): with a kept uncertain save and a broken (concealed) load, the polite status announces "Try again to check it." while Try again is withheld.
- **Decision:** the user chose "Corrigir os dois". I1: a tokens-only rule for `.seixoTokens`, with the strip's own background owning the colour. Q1: the failed/concealed load joins the condition that drives both Try again and its wording, plus one rendered test. Each with red-green, in one fix commit carrying the re-review in its `Review:` trailer.
- No further review: the unreviewed delta is recorded as residual risk (rpiv fix-round cap stop). Then the targeted mutation on the changed source files, a fresh package, E5 and E4; then Pedro's acceptance of the final revision; then `/rpiv:validate`.

## 63. C1 S4 acceptance of the final revision (user decision, 2026-10-15)

- After the deep-review fix round (`66a29a1`, §61) and the re-review fixes (`6add959`, §62), the final chain on `6add959` passed (targeted Stryker on `conversation-region.tsx` 90.08 with no real unguarded survivor, package, E5, E4 26/26, CodeScene change set vs `b96b305` passed). `88c6d4d` adds evidence only.
- **Acceptance:** Pedro accepted S4 at the exact revision `88c6d4d` ("Aceito 88c6d4d"), with the recorded residual risks: the changed-files-only final mutation (§59) and the independently unreviewed `cec7422..6add959` delta (§62). The changes since the Narrator listen (§60) touch only states the real window cannot reach and system settings (reduced motion, forced colours), so the listen was not repeated.
- Next: `/rpiv:validate` over `b96b305..88c6d4d`, then a separate integration authorization for the squash into main.

## 64. C1 S4 validate skipped (user decision, 2026-10-15)

- **Exception to §57 and the rpiv chain:** the user said "skip the validate next. this is an exception." `/rpiv:validate` over `b96b305..88c6d4d` was stopped before it ran anything; no validation report exists.
- Residual risk: no independent re-proof of red per slice commit (reprove-red) and no consolidated validation report; the accepted candidate `88c6d4d` rests on the recorded TDD evidence, the reviews (§56, §58, §61, §62) and the final chain (§63). This is a one-off exception, not a new rule.
- Next: a separate integration authorization for the S4a+S4b squash into main.

## 65. C1 S4 pushed; S5 start (user decisions, 2026-10-15)

- Main pushed `e1c88a4..c8a72d1` (pre-push check:deep passed: unit 2983, integration 5144 and 2161, e2e 26/26, launch-smoke). Issues #108 (S4) and #130 (CSP; resolved in S4a, CNV-B48, with the premise corrected: the header policy was already in force on `file://`) are closed with evidence comments.
- S5 workspace (user: "Sim"): branch `feat/c1-s5-conversation-journey`, worktree `C:/Users/pedro/Documents/GitHub/slopstop-c1-s5`, starting commit `c8a72d1`.
- S5 contract (design rev 5.3 + appended Developer Context, `content_hash 0457b36e…`, CNV-B19): the user chose "Aprovo, com revisão de intenção". The rigorous-lane intent review (slice-verifier plus the code/coverage pair, intent mode) runs first; build authorization for S5 in that worktree takes effect when the intent review passes or Pedro triages its findings.

## 66. C1 S5 intent review and contract refinements (user decisions, 2026-10-15)

- Intent review of S5 on `c8a72d1` (slice-verifier, code and coverage reviewers, intent mode): 0 blockers; the slice-verifier failed Decisions on an inexact CNV-B19 oracle (F1); all three raised the same concerns (save and upgrade oracles, the recorder remounted per activation, message identity, seeding and timeouts, no failure route).
- **Contract refinements R1-R11** (user: "Aprovo os 7"), appended to the design's Developer Context ("S5 intent review and oracle refinement"); design `content_hash c609a5a7df3a41efb7dbe65fcd14e3a7d96d6efd4dbc5ab30939bc807ec7f185`, approved copy `.rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/approved-c609a5a7df3a41efb7dbe65fcd14e3a7d96d6efd4dbc5ab30939bc807ec7f185.md`; S5 branch commit carries the entry.
- **Registered upgrade in the real window** (user: "Sim, acrescenta"): the seed also rewinds one registered Project to generation three (R7).
- **Extras** (user chose both): one recorded binding with the save handler set to "hang" (R10, a heavy run under the coordinator's GO), and the desktop-log assertions after each launch (R9), which settles the log-link carry-forward trigger for this journey.
- Build authorization for S5 in `slopstop-c1-s5` is now in effect (§65).

## 67. C1 S5 journey order (user decision, 2026-10-15)

- The implementer found that R6 and R7 conflicted: the rewound registered Project had to be repository-b, but R6 opened repository-b early, which would already upgrade it, so its later upgrade oracle (R5) would fail by construction.
- **Decision:** the user chose option A, "o b é o registado antigo". The switch to repository-b is its upgrade open (R5), followed by one save. Then switching back to repository-a checks its two messages, the Storage-only generation-three Project is opened and saves one message, and the restart checks all three. R6 and R8 are amended in the design's Developer Context; design `content_hash 3e9a2147…`, approved copy `approved-3e9a214773f5335e87620ecf4239282c28a2ee841a042887efa2482f045bc1f3.md`; S5 branch commit `9779fbd`.

## 68. C1 S5 scope: reopening an upgraded Project without a repository (user decision, 2026-10-15)

- CNV-B19 found a real red on arrival: after the restart, the upgraded Storage-only Project cannot be reopened. `canOpen` (`apps/desktop/src/renderer/projects-list.tsx:46-49`, from `846493f`) opens an unbound Project only in safe mode, so once upgraded its saved messages are unreachable in the window. Registered Projects reopen correctly (repository-a and repository-b passed every R2-R9 check across the restart).
- Origin check: the upgrade-window design (:81) calls this "the legacy opening contract"; nothing states that an upgraded unbound Project must stay closed. There is no flow that binds a repository to an existing unbound Project ("Add existing repository" registers a new one), so the data would have no path back. The C1 design claim (:985) is that Storage-only v2 and v3 open read-write after their upgrade.
- **Decision:** the user chose "A: corrigir dentro do S5". S5 widens to one product change: `canOpen` also opens an upgraded (healthy) unbound Project. It gets its own expected red (a renderer unit row) before the change; CNV-B19's R6 reopening proves it in the real window. The candidate review covers it.

## 69. C1 S5 candidate review round 1 (user decision, 2026-10-15)

- Round 1 on `1665900` (three reviewers): 1 blocker (touched integration projects unproven), concerns on run evidence bound to pre-commit digests, the R2b poll, the `canOpen` mutation scope and the red re-proof wording, and seven suggestions. Table in the local evidence folder `s5-review-round1.md`.
- **Decision:** the user chose "Corrigir tudo + ronda 2": fixes T1-T12, then the final runs on the fixed candidate (gates, `pnpm test:integration`, `pnpm test:e2e`, `package:launch-smoke`), then round 2 (the last). The `canOpen` mutation run happens once after the last round, with its range added to the root config now.

## 70. C1 S5 candidate review round 2 (user decisions, 2026-10-15)

- Round 2 (the last) on `12c3804`: all three passed T1-T12 with no new defect; one concern (F1) and small suggestions (table in the local evidence folder `s5-review-round2.md`).
- **F1, the `process-entry` → desktop log link** (user: "Aceitar como risco"): T7 showed a successful upgrade writes no harness log line, so S5 proves only the negative (no forwarded failure line, no `HARNESS_LOG_LINE_` code). The coordinator had changed R9's "settles the carry-forward" to "stays open" without a recorded user decision; Pedro now accepts the unproven positive link as residual risk at the C1 gate. The C1-gate carry-forward row keeps one trigger: the first missing upgrade log line in a real run. Owner: the coordinator.
- **Leftovers** (user: "Aplicar sem 3.ª ronda"): S1 (the journey failure as the thrown error's `cause`), S2 and S3 (evidence wording), S4 (drop the unused export). No third review round; the unreviewed delta is recorded as residual risk. Then the final runs on the final tree, the `canOpen` (CNV-B52) mutation run once, and Pedro's S5 acceptance.

## 71. C1 S5 acceptance and integration path (user decisions, 2026-10-15)

- After the round-2 leftovers (`bd72469`), the final runs on the clean commit passed (gates, `pnpm test:e2e` 27/27, `package:launch-smoke`; integration last green on `cbbb087`, no harness file changed since) and the CNV-B52 mutation ran once: `projects-list.tsx:50-56`, 23/23 killed, score 100. `b636bc8` adds evidence only.
- **Acceptance:** Pedro accepted S5 at the exact revision `b636bc8` ("Aceito b636bc8"), with the residual risks of §70 (unreviewed round-2 delta, the unexecuted T6 double-failure branch, the unproven positive log link).
- **Integration path, exception** (user: "Nenhum"): no `/rpiv:deep-review` and no `/rpiv:validate` before the S5 squash. Residual risk: no feature-range deep review and no independent re-proof of red for S5. One-off, like §64.
- Integration authorized: squash `feat/c1-s5-conversation-journey` (`b636bc8`) into main.

## 72. Pre-push e2e race fix (user decision, 2026-10-15)

- The push of main at `67f59fc` failed in pre-push check:deep: `conversation-accessibility.test.ts:518` (`g-try-again-unavailable`) threw `AbortError` in `focusFacts` (`conversation-window.ts:139`). Cause, confirmed from the trace: the forced-colours switch starts Try again's 120 ms transition; ~300 ms after the hanging read begins, "Loading messages…" outranks the kept failure line (designed precedence), the tone changes, the running transition is replaced and its `finished` promise rejects. The product behaves as designed; the race was in the test helper.
- **Decision:** the user chose "Corrigir o teste num ramo curto". Branch `fix/e2e-animation-abort` (`a197995`): `focusFacts` settles animations with `allSettled` and loops until none run (bounded 1 s, with a named failure); no oracle changed, no timeout raised. A throwaway deterministic check showed the old helper failing with the same `AbortError` and the new one settling. Gates passed; the accessibility file passed 5 times in a row and the full e2e 27/27. Squashed into main, then the push is retried.

## 73. #110 split of project-storage-node-adapters.ts (user decisions, 2026-10-15)

- Worktree `C:/Users/pedro/Documents/GitHub/slopstop-110`, branch `refactor/110-split-node-adapters` at main `8fcee45` (user: "Sim"). The S4, S5 and e2e-fix branches and worktrees were deleted (user: "Sim, apaga os três").
- Brief: `.rpiv/artifacts/designs/2026-10-15_20-38-03_split-project-storage-node-adapters.md` (worktree). Eight new files plus the kept composition file; bodies move verbatim; the public surface of `project-storage-node-adapters.ts` is unchanged; the two complex conditionals become named pure predicates; the project-storage mutation scores must not drop (baseline before the move, final after the last review).
- **Lane:** `lane.mjs --paths` says normal; the user chose "Rigoroso" (every open, create and upgrade goes through this file).
- **D1, Effect scope** (user: "Aprovo"): verbatim-moved code keeps its Promise form (moving without changing is not a change under AGENTS.md); new code (predicates, factories) follows the Effect rules; SQL bodies stay for #123.
- Next: the rigorous intent review; build authorization takes effect when it passes or Pedro triages its findings.

## 74. #110 intent review round 1 (user decisions, 2026-10-15)

- Intent review of the #110 brief (`aa5dff59…`, three reviewers): blockers were a runtime import cycle between create inspection and healthy opening (`:971` ↔ `:1068`), the cycle gate attributed to `check:architecture` (it is `check:boundaries`), and no check that `metadataIsCurrent` keeps the same result; plus concerns on unassigned declarations (`:126-159`), the registry factory's scope, guard-table gaps, per-instance locks, like-for-like mutation, CodeScene 10 per commit, and a Primitive Obsession risk in the support file.
- **Commits** (user: "1 commit, passos como checkpoints"): the eight steps are uncommitted checkpoints (parent plus patch digest, with their test logs); the slice ends as one commit.
- **Factories** (user: "Novo, converter já"): the coordinator recommended treating them as moved code, but the user chose to convert them now. The locks become an Effect owner (a service built by a Layer, with `Semaphore`/`Deferred` coordination, per AGENTS.md), and the registry factory's operations become Effect programs, behind a temporary Promise facade for the not-yet-migrated callers. This narrows D1 (§73): only verbatim-moved functions keep their Promise form; SQL bodies still stay for #123. Lock semantics (create permit, per-Project permits, `forCreate`/`afterCreateDrain` sharing one permit, per-instance state) must be preserved and guarded.
- **Revision** (user: "Aprovo, sem 2.ª revisão"): the implementer revises the brief with every intent-review fix and this decision; the coordinator checks each item; no second intent review round (recorded residual risk); Pedro's approval of the revised brief is this decision.
- **Revision 2 checked** (2026-10-15): brief `d490024`, `content_hash 7afaf89c…`. The coordinator checked items 1-11 against the intent-review findings and §74 (dependency direction healthy opening → create inspection → registry rows, no back-edges including types; `check:boundaries` as the cycle gate; owners for `:126-159`; registry factory scope and single input; guard table and per-checkpoint commands; verbatim predicates first, with the `:381` residual; like-for-like baseline mutation; CodeScene 10 on the final state; one slice commit with checkpoints; locks as an Effect service with a per-instance temporary Promise facade and seven lock pins written and passing on the current code before conversion). Approved copy `approved-7afaf89cc279a31f5be4885d95800710031d83289524f0dd2db74fada47241fb.md`. Build authorization for #110 is in effect.

## 75. #110 mutation config timeout (user decision, 2026-10-15)

- The #110 baseline mutation stopped in Stryker's dry run (no mutant tested): `registration-bootstrap-guards.integration.test.ts:130` timed out at Vitest's 5 s default, because `apps/harness/vitest.project-storage-mutation.config.ts` sets no `testTimeout`; that file normally runs in the registration project with `testTimeout: 15_000` (it spawns Git and harness children). Machine idle (CPU 4-7 %).
- **Decision:** the user chose "(b) 15 s, como o grupo normal": the project-storage mutation config gets `testTimeout: 15_000`, the limit the file already has in its normal project, so `isSeededReservation` keeps a mutation oracle. This is a recorded limit change approved by the user, not a loosening of any assertion. The baseline reruns once with it.

## 76. #110 checkpoint 6 duplication (user decision, 2026-10-15)

- At checkpoint 6 the verbatim-moved `project-storage-create-inspection.ts` scored 8.81 in CodeScene (Code Duplication: `requireStagingCreateAuthority` and `requireActiveCreateAuthority` open with the same `Promise.all` reading the one registration row and the one location row, each through `exactlyOne`; plus Overall Code Complexity). The large file had hidden both smells; the brief's contingency covered only Primitive Obsession and Excess Arguments. Checkpoints 0-5 were green; the checkpoint 2 contingency (support file: five positional wrappers removed in favour of the existing object-argument helpers) is recorded in the TDD evidence.
- **Decision:** the user chose "(a) Aplicar a função": one private helper `createAuthorityRows({ client, generation, message })` holds the shared read. The staging authority passes its literal message and the active authority passes `input.message`. Same queries, order, messages and errors; the `rowsAgree` checks stay verbatim. The helper keeps the Promise form, because it only extracts moved Promise code (D1, §73/§74). A throwaway copy scored 10. This is recorded as a second contingency in the evidence.

## 77. #110 launch-smoke failure diagnosis (user decision, 2026-10-16)

- On clean slice commit `343d1ba`, `pnpm test:integration` passed (2161) and `pnpm test:e2e` passed (27/27). `pnpm package:launch-smoke` exited 1 after 28 s with only "Packaged SlopStop smoke failed.", because locally `package-smoke.mjs:894-898` does not name the failed stage. No SlopStop or Electron process was left running. The same smoke passed on main `8fcee45` in yesterday's pre-push check:deep.
- **Decision:** the user chose "Correr com CI=true": one diagnostic run of the same command on the same clean commit, with `CI=true`, which names the failed stage. It also sets `SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS=1` in the packaged app (`package-smoke.mjs:269-273`), so the environment is not identical. This run diagnoses the failure; it does not count as a pass. If the stage looks environmental, a comparison run on main follows.

## 78. #110 writer-proof diagnosis runs (user decision, 2026-10-16)

- The §77 diagnostic run (CI=true, clean `343d1ba`) failed at "writer-proof scenario". Every earlier stage passed in the package, including bootstrap: absent-open, create, healthy open and close. The smoke does not print the writer child's output, so the writer step is unknown. The implementer's leading hypothesis (unproven) is a timing change from the new Effect lock and registry facades in the cross-process writer sequence.
- **Decision:** the user chose "As duas: passo e main". (1) One run of a temporary, untracked copy of `package-smoke.mjs` that also prints the writer child's output, to name the failing writer step. The copy is deleted afterwards and the tree is restored by digest. (2) One plain `package:launch-smoke` on main code `8fcee45`, to rule out a failure that predates #110. It runs in the main checkout: its code equals `8fcee45`, and only the decisions log differs. No new worktree is needed. Both runs diagnose only; neither counts as a pass for the candidate.

## 79. #110 launch-smoke regression confirmed; diagnosis authority (user decision, 2026-10-16)

- §78 results: the diagnostic copy on `343d1ba` showed the app's private writer proof failing at `writer-transport` (a real harness utility process went away while no exit was expected; the fixture process imports no Storage code). Plain `package:launch-smoke` on main code `8fcee45` (main checkout, package rebuilt with `pnpm package` first) passed in 42 s. **The failure is a #110 regression.** It reproduces only in the packaged multi-process writer proof; the source-level `canonical-writer-package-smoke.integration.test.ts` passed in `test:integration`. Leading unproven hypothesis: an unhandled rejection or defect from the new Effect lock or registry code reaches the harness fatal path (`process-entry.ts:102-103`).
- **Decision:** the user chose "Autorizar o diagnóstico até à causa". Temporary diagnostic-only changes and short single runs are authorised until the cause is found. Each run needs the coordinator's GO and runs one at a time, and each change is restored by digest (the package is rebuilt back to the candidate) and recorded. Any fix to the code goes back to the user first.

## 80. #110 launch-smoke cause and fix (user decision, 2026-10-16)

- **Cause (diag 4):** a bundling effect, not a Storage behaviour change. With the #110 module graph, rolldown dropped the separate runtime chunk and put its interop helpers into `project-storage-store-*.cjs`. That chunk loads `fs-native-extensions` at module top level, and `writer-proof-fixture.cjs` now requires it statically. The addon is therefore loaded before the fixture's native-origin check (`canonical-writer-package-smoke-entry.ts:251-266`, which requires exactly one dlopen) and the check throws `WriterProofError`. The controller closes its port, so the proof reports `writer-transport`. On main the store chunk loads lazily, after the check. Ruled out: harness fatal handlers (diag 1), harness self-exit (diag 2), Effect error wrapping (diag 4).
- **Decision:** the user chose "(a) Configuração + guarda". Change only the harness bundle configuration (`apps/desktop/vite.harness.config.ts`) so the fixture entry never statically requires the chunk that loads the addon, restoring main's layout; product code is unchanged. Add a guard to the package smoke's resource preflight that fails with a clear message when `writer-proof-fixture.cjs` statically requires that chunk. The native-origin check is not weakened. This stays inside #110.

## 81. #110 candidate review round 1 (user decision, 2026-10-16)

- Round 1 on `65a10bb` (three reviewers, identical packet): all three `failed`. Table T1-T13 at `.rpiv/evidence/2026-10-15_20-38-03_split-project-storage-node-adapters/review-round1.md` (local).
  - T1 (high): the lock hand-off order changed. The new service wakes the next waiter on a `setImmediate` task, so a caller arriving at release can jump queued waiters. The base hands off synchronously. The coordinator confirmed it with a scratch script: base `held,waiting,late`, new `held,late,waiting`.
  - T2 (blocker): the final mutation scope omits the new Effect code, which brief :138 requires (the packet wrongly called it an open question).
  - Others: a missing 3-operation release pin, no oracle for the rewritten registry error mapping, the load-order guard's message, test and IIFE gap, the brief's Developer Context stopping at §75, stale evidence, two commits on the branch (resolved by the squash at integration), and code suggestions.
- **Decision:** the user chose "Corrigir tudo": T1-T13 are fixed as proposed. T1 restores the synchronous FIFO hand-off and the start deferral while keeping Effect, with a binding pin first (red on `65a10bb`, green on the base code). Round 2 is the last round.

## 82. #110 candidate review round 2 (user decision, 2026-10-16)

- Round 2 on `6e5d915` (three reviewers, identical packet): no blocker. All three confirm T1: the facade restores the base hand-off and start order. T2-T13 are resolved, with T8 deferred to the squash. Twelve small items, U1-U12, are in `.rpiv/evidence/2026-10-15_20-38-03_split-project-storage-node-adapters/review-round2.md` (local). The only medium item is U1: the T4 error-mapping tests are not in the mutation include.
- **Decision:** the user chose "Pequena correção final".
  - Fix U1 (mutation include, plus a dry run), U2 (Developer Context lists the fix round's out-of-map files), U3 (launcher test for the guard's failure path), U4 (class static blocks count as load time), U5 (commit the deferral pin and correct the evidence), U8 (a thrown message that does not depend on the status) and U10 (record the 6e5d915 heavy runs).
  - Carry U6 (service surface), U9 (duplicate storage-failure guard) and U11 (in-Effect barging residual) to issue #123.
  - Record U7 (rename-only red) and U12 (`.call`/`.apply` wrappers; test placement) as residuals.
  - There is no third review round: the coordinator checks each item. Then `package:launch-smoke` reruns, the final mutation runs, and Pedro accepts.

## 83. rpiv workflow improvements (user decision, 2026-10-16)

- The coordinator proposed four rpiv improvements; the user kept 2 (reuse mutation results) and 4 (less bureaucracy per decision and per round) and asked the coordinator to discuss them with a new rpiv session (herdr pane `w3:p2B`, renamed `rpiv`). The discussion produced a joint list of six items: (1) batch decision records and approved copies into one docs commit per slice, at every acceptance stop and before `/clear` or a handoff; (2) an `append-only.mjs` helper owning the append-only check; (3) a heavy-run evidence wrapper; (4) a review-packet builder plus a two-session ownership/freeze rule; (5) a findings-table template and round-2 focus fields with all three reviewers kept; (6) a per-mutant report-diff helper with an explicit range map. Withdrawn: reusing mutation results on the final candidate (unsound: results depend on the whole loaded closure), and fewer reviewers in round 2 (removes mandatory rigorous-lane roles; T1 was caught by one reviewer of three).
- **Decision:** the user chose to implement only items 1 and 2, and approved a linked rpiv worktree `C:/Users/pedro/rpiv-claude-wt/append-only-batch` on the new branch `feat/append-only-batch-commits` from `4876216`. The rpiv session builds them red-green there; no commit, push or issue without the user's approval. Items 3-6 are not authorised.

## 84. rpiv items 1 and 2 commit (user decision, 2026-10-16)

- The rpiv session built items 1 and 2 red-green in `C:/Users/pedro/rpiv-claude-wt/append-only-batch` (13 tests, red 13/13 against an unimplemented scaffold, then green 13/13; CodeScene 10). It added one rule the brief did not state, accepted by the coordinator: an unchanged approved line must stay in its section. The coordinator reran the tests and smoke-tested the helper on slopstop #110's real approved copies (current copy: keep; older pre-intent-review copy: reopen) and on edited copies (body edit, lane lowered: reopen; CRLF only: keep; missing copy: 1; directory: 2). Residuals: any added Developer Context line naming "lane" and the new value counts as recording a raise; multi-line frontmatter values always reopen.
- **Decision:** the user approved one commit with both items on `feat/append-only-batch-commits`, after the CodeScene safeguard on the staged change. No push, PR or merge into rpiv main. From this decision on, decision records are committed in batches per item 1 (at acceptance stops and before `/clear` or a handoff).

## 85. #110 candidate acceptance (user decision, 2026-10-16)

- Final runs on `19a038e` (clean, digest `e3b0c442…`): `pnpm package` and `package:launch-smoke` passed (41 s); the Stryker dry run passed; the final mutation passed in 137 min (score 84.84; the 14 baseline files 86.28 against 86.07; the two new whole-file scopes 76.50). In the four remapped ranges, all 60 mutants keep their baseline status. In the other files, 3086 of 3086 match by location (2 went Killed -> Timeout, still detected). No baseline-killed mutant survives. New-scope survivors: 2 equivalent; the locks survivors are the recorded unobservable lock-table cleanup residual; the registry survivors are untested failure, defensive and missing-authority paths.
- **Decision:** the user chose "Aceitar + issue para os testes". #110 is accepted as is. The implementer records the final runs and the baseline tally correction (metadataIsStale 7/16, isSeededReservation 9/4) in the evidence file in one docs commit. Issue #132 tracks the registry test gaps and the `metadataIsStale` gap. Next, the coordinator squashes the branch into one main commit (T8), and asks before the push.

## 86. #110 deep review and validate (user exception, 2026-10-16)

- The coordinator had not mentioned in §85 that the rpiv chain runs deep-review (rigorous depth) and then validate after acceptance. A deep-review fix would change the code and force a new final mutation (over 2 h).
- **Decision:** the user chose "Saltar as duas, como no S5". Deep review and validate are skipped by user exception, as in §71. The branch is squashed into main after the implementer's evidence commit. The squash message records the exception.

## 87. #110 push and cleanup (user decision, 2026-10-16)

- The #110 squash is on main as `ff162f5` (gates passed: pnpm check 3024, knip, check:duplicates, CodeScene safeguard), with `499a4c3` recording §86. Main is 15 commits ahead of origin.
- **Decision:** the user chose "Mais tarde" for the push (check:deep, about 17 minutes). After the push passes, delete the `slopstop-110` worktree and the `refactor/110-split-node-adapters` branch, once the coordinator confirms the worktree is clean.

## 88. C1-gate carry-forward review (user decisions, 2026-10-16)

- The user asked to review the C1-gate carry-forward table (C1 design :987-1009). Eight rows were already done. The user also said a #94 follow-up issue for the CodeScene finding in `registered-project-selection.integration.test.ts` is not needed.
- **Decisions:**
  - "Sim, pedir ao ui-ux agora": the ui-ux agent updated DESIGN.md's focus statements to the §33 ring as built. The coordinator checked the values against `seixo.module.css` and `conversation-parts.module.css`, mirrored the wording in `.impeccable/design.json`, and committed `f55cb69`.
  - "Sim, issue para uma slice pequena": a successful upgrade will be logged, and the harness-to-desktop log link proven in the real app. This is issue #133, queued after C1. It answers the open question "should successful upgrades be logged".
  - "Um issue de acompanhamento": the nine deferred rows and the licence check are tracked in issue #134, with code references updated for the #110 split. The design has an appended Developer Context pointer (append-only check: keep).

## 89. Multi-process Project Storage tests (user decision, 2026-10-16)

- A read-only survey found that the packaged smoke already proves writer exclusivity, a hard-killed writer, stale activation and native addon loading across processes, and that it caught the #110 bundle regression in `check:deep`. Two gaps remain: an upgrade killed mid-way is tested only against source, and an upgrade racing a second process that opens the same Project has no test at all.
- **Decision:** the user chose "Um issue com as duas". Issue #135: first an integration test for the race, then a packaged upgrade-kill stage. It is queued in Phase 2.

## 90. #99 interview continuation: phase 2 dialogue and decision staleness (user decisions, 2026-10-16)

- FRD `.rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md` (consensus confirmed). Also, the user said no #94 follow-up issue is needed for the CodeScene finding (recorded in §88).
- **Phase 2:**
  - Waypoints linked by `blocks` or `related-to` talk through the Supervisor; other pairs need the Supervisor's visible admission. A Forger asks for a dialogue, or the Supervisor opens one on a detected conflict.
  - Only the affected tasks of each involved Run pause. Technical agreements inside the approved plans need no approval and stay visible in the thread. Plan-changing agreements become one joint proposal for all affected Runs, which goes stale if any covered Run changes epoch or ends.
  - The Supervisor answers for a Waypoint without an active Run. The coordination budget is per Strand; a cross-Strand dialogue is paid by the requesting Strand.
- **Decision staleness:**
  - A decision revision may be a mandatory memory dependency (amends ADR 0017); replacing or retiring it makes dependent memories stale.
  - Documents repeating a decision are tracked by links plus a change-time search.
  - One Attention item lists the affected memories, documents and Runs, with a Supervisor-proposed update. A user-only "wording only" mark skips staleness.
- Open: where technical agreements are stored (the user leans to a new interface record, separate from Decisions, and wants to think about it).

## 91. #99 research despite uncertainty (user decision, 2026-10-16)

- The user said much of the harness may still change once they try it, and that they are still quite unsure how memories and decisions will work in practice. The coordinator proposed pausing the research, marking the §90 FRD provisional and prioritising work the user can try first (C2, basic Runs).
- **Decision:** the user chose "Continuar tudo". The rpiv designer's research continues on both topics (phase 2 dialogue and decision staleness).

## 92. #99 research checkpoints (user decisions, 2026-10-16)

- Research `.rpiv/artifacts/research/2026-10-16_17-01-10_cross-waypoint-dialogue-and-decision-staleness.md` (rpiv designer) found five FRD requirements in conflict with accepted text, and a new tension: a submitted joint proposal closes all dispatch in every covered Run (ADR 0011:131), and it stays closed after a rejection (:128). The coordinator's FRD wrongly listed ADR 0021:45 as kept in its Non-Goals.
- **Decisions (six checkpoints):**
  1. Amend ADR 0021:45 and PRODUCT.md:103: technical agreements inside the approved plans need no approval.
  2. An agreement that changes a task contract or result schema (ADR 0011:84, :91), or contradicts an accepted decision, is always plan-changing.
  3. While a joint proposal waits, only the affected tasks stop (narrower than ADR 0011:131); on rejection they resume the prior plan.
  4. The single decision-change Attention item replaces ADR 0022:49's per-Run items, with one action per Run inside it.
  5. "Wording only" also suppresses the per-Run notices. A scope-only or links-only edit is a real change, never "wording only".
  6. Supervisor-opened dialogues and Project-scope decision searches are paid from a Project-level coordination reserve, approved once, with a warning at 80%.

## 93. #99 design checkpoints (user decisions, 2026-10-16)

- Design brief `.rpiv/artifacts/designs/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness.md` (rpiv designer; slices c99-s1 to c99-s3, documentation only, decisions G1-G14). The designer asked eleven checkpoints plus G11.
- **Decisions:**
  - C1: the Strand budget is approved inside the first Run approval of that Strand, and the Project reserve inside the Project's first Run approval. A Project-scope search before any Run asks once via Attention.
  - C3: when the Project reserve reaches its limit, one Attention item appears, and no new Supervisor-opened dialogue or search runs until the user decides.
  - C4: contesting a technical agreement holds its tasks until the agents re-agree or withdraw it.
  - C5: the narrower closure (only affected tasks stop) applies to joint proposals only, labelled provisional. Single-Run amendments keep the whole-Run stop.
  - C6: when a joint proposal goes out of date, its held tasks stay held while the Forgers re-check, for a bounded time; the user can release them.
  - C7: after joint approval, the Runs continue on their own.
  - C8: the provisional label covers only the named memory and decision clauses; safety invariants are never provisional. Review happens only when the user asks (the user chose "Quando eu pedir", not the recommended usage trigger).
  - C9: a pinned-Run row has a "Keep the earlier version for this Run" action.
  - C10: for docs-update work with no host Waypoint, the Supervisor proposes a docs-update Waypoint through a map revision.
  - C11: a "Mark as meaning changed" action fixes a mistaken wording-only mark. The user added a general rule: "temos que ter em conta enganos humanos de maneira a podermos desfazer a accao". Every user action in this design needs a way to undo it.
  - G11: the Attention rule J3 is refined to "one exact action per row" inside one item.

## 94. #99 design intent review round 1 (user decisions, 2026-10-16)

- Round 1 on brief `946c66d3…`: four reviewers, failed with 88 findings (10 blockers, 9 of them verified). The table and proposed resolutions R1-R30 are in `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-1.md`. The coordinator flagged the growing size against the user's stated uncertainty. The coordinator also disclosed that the "cannot be undone" escape in its §93 relay was its own addition.
- **Decisions:**
  - R4: one slice, one review and one commit for the whole amendment set.
  - R8: an action that cannot be undone records why, and asks for confirmation first.
  - R9: a contest hold lifts only when the agents re-agree or the user withdraws the contest. A no-agreement, needs-human or stopped close keeps the hold and raises Attention.
  - R10: held tasks of an out-of-date joint proposal have an elapsed-time limit (number open). At expiry, Attention.
  - R15: before a Strand's budget exists, the Project reserve pays that Strand's decision searches.
  - R17: the change-time search and Foundation inference use a Run-absent read-only Project agent, not a Worker.
  - R21: a plan-changing agreement with a Waypoint without a Run uses the joint path with one Run, so only the affected tasks stop.
  - The designer fixes the remaining findings in one fix round; round 2 is the last.

## 95. #99 design intent review round 2 (user decisions, 2026-10-16)

- Round 2 (the last) on revision 2 `6051ada8…`: failed with 76 findings, 6 blockers (5 verified). The table and proposed resolutions Q1-Q22 are in `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-2.md`.
- **Decisions:**
  - Q3: for a completed proxy Waypoint, the user's Begin of its change Run comes first. Then the agreement re-enters as a two-Run joint set with that Waypoint's real Forger.
  - Q7: at onboarding, the Project reserve for Foundation inference is asked once via Attention.
  - Q9: the held-task time limit also covers a dialogue waiting on an unavailable Forger or a lapsed map link. At expiry, the app stops the dialogue with a named reason and raises Attention, and never sets an agent's closing state.
  - Q12: the user's acceptance of the slice candidate also accepts the ADR amendments, so the single commit carries Accepted status.
  - Q21: the Portuguese copy is "proposta ultrapassada", "tempo de espera esgotado" and "desatualizada".
  - Closing path (A): the designer writes revision 3 applying Q1-Q22, with a resolution table that maps each finding to lines. The coordinator checks each item, with no new agents. Then the user approves.

## 96. #99 design approval and workspace (user decisions, 2026-10-16)

- The coordinator checked revision 3 (closing path A). The six round-2 blockers are applied in the brief text. Every user decision from §90-§95 is reflected. The resolution table maps all 76 round-2 findings; the concerns and suggestions were not each re-verified. FRD Q1 (interface-record storage) stays open.
- **Decisions:** the user approved the #99 design brief, revision 3 (`content_hash 0170dcb8d10d8de977afa1272b69cafd4fe22adf764517a984d86e788a44a0c2`; approved copy `approved-0170dcb8d10d8de977afa1272b69cafd4fe22adf764517a984d86e788a44a0c2.md` in `.rpiv/evidence/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness/`). The user also approved a linked worktree `C:/Users/pedro/Documents/GitHub/slopstop-99` on the new branch `docs/99-cross-waypoint-dialogue`, from the main commit that includes the approved brief. The implementer writes the ADR amendments there as one documentation slice. No push or PR.
