---
date: 2026-10-05
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
branch: main
commit: 43bc303
status: in-progress
tags: [conversation, decisions, context, waypoint]
content_hash: bfc1c578eddb5277e4a72adca443ada86ac4b340db51f7f3e6bb2ae8bb646156
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
