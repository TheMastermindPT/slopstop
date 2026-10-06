---
date: 2026-10-05
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
status: in-progress
tags: [conversation, decisions, context, waypoint]
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
