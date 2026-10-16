---
date: 2026-10-16T17:01:10+0100
author: Pedro Mesquita
commit: 7f549c0
branch: main
repository: slopstop
topic: "Cross-Waypoint agent dialogue (phase 2) and decision-dependent staleness: ADR grounding and required amendments"
tags: [research, adr, agents, supervisor, forger, dialogue, runs, budget, decisions, memory, attention, issue-99]
status: complete
lane: rigorous
lane_reasons: ["FRD lane rigorous: authority and approval boundaries (ADR 0011, ADR 0017, ADR 0021)", "lane.mjs --paths over the 9 documents likely to change: normal (files: 9 > 5); raise-only keeps rigorous"]
parent: .rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md
issue: https://github.com/TheMastermindPT/slopstop/issues/99
last_updated: 2026-10-16T17:01:10+0100
last_updated_by: Pedro Mesquita
content_hash: 0bf8366804a4a1ae6299891d7715db6081dae0ceddeb68caf1dbcb31a524c8b0
---

# Research: Cross-Waypoint agent dialogue (phase 2) and decision-dependent staleness

## Research Question
Ground each functional requirement of the FRD `.rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md` (FR1-FR17, :58-74) against the accepted contracts — ADRs 0006, 0007, 0009, 0011, 0015, 0017, 0021, 0022, `PRODUCT.md` and `CONTEXT.md` — and identify exactly which amendments the design needs: ADR 0021 phase 2; ADR 0011 multi-Run joint amendment with epoch staleness; ADR 0017 decision revisions as mandatory memory dependencies; a decision-echo record and a decision-change Attention item; plus whatever else the other contracts need. Resolve or carry the FRD's three Open Questions (:229-232). The interface-record storage question (Open Question 1) is the user's open choice and is mapped, not decided.

Scope: documents only. Runs, the Supervisor and agent dialogue are not built. Evidence for that is in "Code status" below.

## Summary
- **Nothing in code.** The canonical migrations `apps/harness/drizzle/canonical/0000`-`0003` hold only storage identity, writer, settlement, repository binding and Conversation tables. No decision, Waypoint/relationship, Run, dialogue, Evidence, Memory or Attention table exists, and no Attention identifier exists under `apps/` or `packages/protocol/src`. Only protocol projection shapes touch the topic (`packages/protocol/src/workspace-protocol.ts:111-118`, `:289-299`, `:337-354`, `:425-431`; `packages/kernel/src/workspace-identifiers.ts:23-26`). Every amendment is therefore an ADR/PRODUCT/CONTEXT text change; no schema or migration is involved yet (ADR 0006:62 forbids empty tables before first behaviour).
- **Five FRD requirements contradict accepted text** and need explicit amendments, not just additions:
  1. FR5 (technical agreements take effect without approval) contradicts ADR 0021:45 and the last sentence of `PRODUCT.md:103`. The FRD's own Non-Goals (:52) claims ADR 0021:44-45 is kept; only :44 can be.
  2. FR6/FR7 (one joint proposal over several Runs) collides with ADR 0011:28 ("Do not create … second approval aggregate"), one pending proposal per Run (ADR 0011:242), one declared transaction per approval (ADR 0011:224) and the no-generic-batch rule (ADR 0007:50).
  3. FR7's word "stale" for a waiting proposal conflicts with ADR 0011:183 (a pre-decision reference that differs is `changed`; "do not relabel the old one stale"); `stale` is reserved for accepted authority (:184).
  4. FR11/FR12 (a decision revision as a mandatory memory dependency) contradicts ADR 0017's Evidence-only dependency model (:19-20, :26, :36, :47, :53, :87-88, :94, :138); FR16 ("wording only") contradicts the exact-equality rule at ADR 0017:88.
  5. FR9 (per-Strand coordination budget pays Forgers' dialogue turns) contradicts `CONTEXT.md:35` ("budgeted from the Run") and ADR 0021:52's in-Run charging, and has no owner: every budget authority is Run-owned (ADR 0011:55, :172-174, :237; ADR 0009 Amendment 1 :288-289) and the Strand has no status, approval owner or start trigger (ADR 0006:47, :50; `CONTEXT.md:28`).
- **A tension the FRD did not see.** FR4 limits a pause to affected tasks, but once any Run amendment request is submitted, ADR 0011:131 closes all new dispatch in that Run, ADR 0011:140/:145 force in-flight Workers to a safe boundary before sealing, and after rejection dispatch stays closed (ADR 0011:128, with no withdraw transition in ADR 0007:34/:47). A joint proposal therefore stops every covered Run entirely while the user decides — against the FRD's "tudo parado" failure (:34).
- **Missing runtime contract for the Supervisor.** The Turn Machine, Sealed Invocation target union, Invocation context record and Model attempt owner cover only a Forger ("Waypoint parent") or Worker (ADR 0009:23, :31, :38, :48-49; ADR 0007:27); Amendment 1's role table routes only Worker, Waypoint parent and Conversation (ADR 0009:224-228). Supervisor dialogue turns (FR3, FR8, FR9) have no runtime, context or budget contract.
- **Required amendments** (full map in Architecture Insights): ADR 0021 (phase 2 section), ADR 0011 (joint amendment, task-scoped hold, vocabulary, diagnostics), ADR 0017 (decision dependency arm, event or cause, read union, wording-only rule), ADR 0022 (retire semantics, wording-only mark, echo record, decision-change item versus :49), ADR 0007 (task-scoped Control request or hold, multi-Run write set, terminal-Run clearing), ADR 0009 (Supervisor invocation, Strand budget scope), ADR 0006 (decision and echo table families, Strand budget owner), `PRODUCT.md` (:48, :52, :64-65, :80-81, :100, :103, :123) and `CONTEXT.md` (:28, :33, :35, :58, :161-170, new terms).
- **Open Questions:** FRD Q1 (interface-record storage) is carried unchanged with its facts mapped; FRD Q2 (naming affected tasks; pausing a Worker) and Q3 (numeric budget defaults) are carried with the facts that bound them. Several new questions arose; six of them need Pedro (see Developer checkpoints pending).

## Detailed Findings

### 1. Opening a phase 2 dialogue and who takes part (FR2, FR3)
- The channel rule already requires application mediation (ADR 0021:41, "Direct agent-to-agent channels … remain prohibited"), so ADR 0021:48 ("Forgers of different Waypoints never talk directly") puts the Supervisor in the path. Nothing says whether it is a participant or a router.
- Pair-only rule (ADR 0021:17): two participants per dialogue; one agent may hold several pair dialogues. Closing state (ADR 0021:19, :42-43): a dialogue ends when both participants declare the same closing state.
- Two readings, undecided anywhere:
  - **One mediated pair (Forger A ↔ Forger B)**, the Supervisor opens, admits and routes but declares nothing. Fits :17/:43; FR8 (no Forger B) cannot use it; relayed content must keep its original author (:42 "attributed, immutable").
  - **Two pairs (A ↔ Supervisor, Supervisor ↔ B)**. Each satisfies :17 and closes on its own (:43); no rule binds the two `agreement` states into one A–B agreement, which FR6/FR7 need. FR8 fits naturally.
- Phase 1 admission (ADR 0021:46) comes from pairs declared in the approved Delegation plan, else the Forger's admission. FR2 moves admission to the user-accepted map (`blocks`, `related-to`) plus Supervisor admission. "Linked" is undefined in `CONTEXT.md:33` and the earlier FRD.
- Relationship facts (ADR 0006:82-85): `related-to` is symmetric (one canonical row in UUID order), `blocks` is directed and acyclic, `derived-from` is directed (excluded by FR2); relationships may cross Strands (:82, consistent with FR10) and are revisioned (:83). FR2 does not say which relationship revision applies (at open or per message) — the FRD lists the map-change gap (:88, :235). ADR 0007:106 lists blocking relationships as an Action-availability input; whether a `blocks` pair can hold two concurrent Runs is not stated (if not, `blocks` pairs often fall into the FR8 case).
- **No home for the admission record or the thread.** ADR 0021:80 lists dialogues, messages, envelopes, closing states and per-dialogue budget slices, with no admission record (also missing for phase 1). Execution records are Run-keyed (ADR 0007:23, :77). ADR 0021:47 puts threads in the Run overview; `PRODUCT.md:52` does not list the thread among Run overview contents; Board entries belong to one Waypoint (`PRODUCT.md:56`). A cross-Waypoint thread has no single owner (Run, Strand or Project).
- **FR3 (Supervisor-detected conflicts).** The Supervisor cannot read files (ADR 0021:34-35; `PRODUCT.md:100`). Candidate canonical inputs: accepted Delegation plan node fingerprints and effect scopes (ADR 0011:91, `delegation_task_effect_scopes` :234), Run approval views (ADR 0011:74), effect declarations and resource keys (`PRODUCT.md:111`; ADR 0015:27-30), decision scope and implementing Waypoints (ADR 0022:21-22), accepted contract revisions (ADR 0011:47), map relationships, accepted Worker results (ADR 0015:50). Independence is checked only inside one plan's fan-out group (ADR 0011:103); cross-Run collisions surface only at lease time (`PRODUCT.md:110`). No document gives the Supervisor a read path to any of these.

### 2. Pausing only the affected tasks across Runs (FR4; FRD Open Question 2)
- Phase 1 rule: ADR 0021:57 (only affected tasks stop until a proposal exists) and :58 (then ADR 0011 applies unchanged).
- Overlap: `SubmitRunAmendmentRequest` closes all new Run dispatch immediately and moves the Run to `amendment-requested` (ADR 0011:131); the proposal is sealed later (ADR 0011:127; sequence :34-38). The "only affected tasks" window therefore exists only before any amendment request; the ADR 0011 note (:9) repeats ADR 0021's wording without resolving it.
- Readiness (ADR 0011:95): a task is ready only when, among others, "no pending Control request closes dispatch"; ready/blocked are derived, never persisted (:27), so "paused at safe point" (AC :95) would be a derived label. Live restrictions narrow authority without approval (ADR 0011:172-173, :175); no task-scoped restriction exists.
- Control requests target only a Run, its Forger or one Worker and always store `run_id`, with composite keys preventing cross-Run targets (ADR 0007:26, :77); kinds are `run-amendment`, `worker-stop`, `model-change` (ADR 0007:79; full set `CONTEXT.md:58`). A not-started task has no `worker_id` (slot created when a Worker is queued, ADR 0007:59).
- Pause exists only Run-wide (ADR 0007:33; ADR 0009:119; ADR 0008:75). Worker `paused` exists only as a side effect of Run pause (ADR 0007:56, :59-60); there is no Worker-pause command (ADR 0007:47). `RequestWorkerStop` is terminal and releases the slot (ADR 0007:57-59; ADR 0009:120-121); retry exists only for availability-stopped Workers (ADR 0007:60). Task redirection uses a Run amendment (ADR 0007:57; `PRODUCT.md:106`).
- Only per-Worker hold today: when the Forger is unavailable, active Workers may finish or halt at their next Worker-safe boundary without a state change (ADR 0007:71; ADR 0009:127).
- Boundaries: portable boundary = no in-flight Model attempts or Tool invocations (ADR 0009:118); Safe checkpoint adds closed dispatch, no lease owned by the checkpointed scope, settled waterlines (ADR 0008:72) — scoped, not necessarily Run-wide; Worker-stop checkpoint applies to one Worker (ADR 0008:74).
- CLI sessions (ADR 0009 Amendment 1): Workers are governed CLI sessions (:226); the hook denies every new tool call once a pause or stop is requested and the session is terminated (:280); session resume is prohibited, continuation is a new stateless session (:272) under a new seal (:236). Any pause of an in-flight Worker ends its session.
- Naming affected tasks: accepted `DelegationTaskId`s exist only after approval (ADR 0011:93; proposal nodes have none, :24; unchanged tasks selected by id and fingerprint, :92). During a dialogue, affected tasks can only be named as accepted task ids of each Run's current plan (`runs.current_run_policy_epoch_id`, ADR 0011:242, :257). Only the Forger proposes plan changes in its Run (ADR 0021:36); who names Run B's affected tasks is not stated. Descendants wait automatically through the DAG (ADR 0011:95); whether they count as "affected" is not stated.
- **Conflict.** Once a joint proposal is submitted, ADR 0021:58 and ADR 0011:131 close all dispatch in every covered Run; ADR 0011:140 requires classifying every prior task, Worker and result, and the only retained in-flight class needs a portable checkpoint (:145), so even unaffected Workers must reach a safe boundary before sealing. After rejection, dispatch stays closed (ADR 0011:128) and ADR 0007:34/:47 have no withdraw. FR4 and AC :95 speak only of "during a cross-Waypoint dialogue"; the FRD is silent about the waiting period.

### 3. Authority of a technical agreement (FR5; FRD Open Question 1)
- Contradicted: ADR 0021:45 ("A converged outcome becomes a typed proposal … that only the user approves") and `PRODUCT.md:103`'s last sentence ("a converged outcome becomes a typed proposal that the user decides"). The FRD Non-Goals (:52) claim ADR 0021:44-45 is kept; only :44 can be.
- Kept only if "take effect" means agents act inside current epochs and contracts with no canonical write beyond the durable messages and closing states: ADR 0021:44 (messages never move canonical state); `PRODUCT.md:43` (what the user approves), :55, :109 (model outputs are attributed proposals; the Forger's own classification has no authority — the epoch is the real bound, as the FRD assumption at :90 says).
- Bounds of "technical": ADR 0011:172-175 (added power needs a new epoch; narrowing cannot be persisted as policy). FR5's parenthetical omits: a changed Behavior/Test/Completion/Waypoint revision always needs approval (ADR 0011:84; Behavior contracts are stable clauses with public seams, `CONTEXT.md:132` — an interface between Waypoints may be one); a changed node result schema, contract-clause links, tool schema hashes, effect scopes or input requirement changes the node fingerprint and needs an amendment (ADR 0011:91-92, :131; `CONTEXT.md:48`); an agreement contradicting an accepted decision (ADR 0022:21-22) is not caught by :174 — the only contradiction check is advisory, on the Decisions page (ADR 0022:50).
- In-flight Workers cannot receive an agreement mid-session: context changes apply only to a new seal (ADR 0009:129); one seal per CLI session (Amendment 1 :236); "Pausing a Worker means stopping it" (:323).
- Storage for future Runs (FRD Open Question 1 — facts only, no recommendation):
  - *Accepted decision:* one record with several scope/implementer links (ADR 0022:21-24); reaches later Runs automatically (ADR 0022:34), pinned at epoch approval (:36), changes raise Attention (:49); needs user acceptance via a Decision checkpoint (ADR 0022:54; `PRODUCT.md:65-66`). Conflicts with FRD :79 (never on the Decisions page or Attention), the user's lean (:230) and FR5's "no approval".
  - *Dialogue records only:* Execution-owned, durable, immutable (ADR 0021:42, :80), Run-keyed (ADR 0007:23, :77); reach another agent only as agent-authored context with no authority (ADR 0021:44; ADR 0009:9); no rule carries a past dialogue's outcome into a later Run.
  - *Verified Memory:* needs a non-empty Evidence dependency set (ADR 0017:47) and user acceptance (`CONTEXT.md:169`); proposals never reach Attention (`PRODUCT.md:64`); decisions are never duplicated as memory (`PRODUCT.md:64`; ADR 0022:44).
  - *New interface record (the user's lean):* no owner exists (FRD :87); ADR 0006:62 forbids empty tables before first behaviour; precedent for durable-but-non-canonical rows: ADR 0006:61.
  - *Repository code:* once built, later Runs reach it through the workspace baseline (ADR 0011:51); Workers read it, the Supervisor does not (ADR 0021:35).
- Later Runs' context: the Invocation context selection rule covers decisions only (ADR 0022:34-35); every source is recorded with kind, trust and reason (ADR 0009:50) and hidden injection is prohibited (:58). A non-decision agreement arrives only through a new source-selection rule or typed retrieval (ADR 0009:81, :52). Code: `ContextSourceSchema` (`workspace-protocol.ts:111-117`) closes Conversation context kinds to `scope`, `conversation`, `accepted-revision`, `verified-memory`, `attachment`, trust `trusted|untrusted|mixed` (:118), bound to a response message (:235-245) — not the Execution Invocation context record, which has no code.

### 4. One joint proposal across Runs (FR6, FR7)
- Every authority object is per Run: epoch (ADR 0011:22), `RunAmendmentProposal` one-to-one with one approval proposal (:25), classification children per proposal (:246), one view per proposal (:247). A joint proposal decomposes into N per-Run proposals.
- A grouping record with approval authority conflicts with ADR 0011:28; a non-authoritative grouping has precedent in the Approval Dependency Graph (ADR 0011:26).
- One pending proposal per Run (ADR 0011:242); replacing it marks the old one `superseded` (:127); decisions are only `approved|rejected|superseded` (:247). Consequence for AC :98: a second amendment on Run A supersedes A's joint component; an epoch can change only through approval of the current pending proposal (:22, :133). No rule cascades supersession to Run B's component.
- Approval CAS covers accepted plan and epoch, pending proposal identity, manifest and view hashes (ADR 0011:133, :223) and rejects before authority changes (:225); missing is a rule that makes the whole set non-approvable when one component fails.
- "Approved as a whole": each approval is one declared fenced transaction (ADR 0011:224); a multi-aggregate command needs a declared complete write set and the generic batch is prohibited (ADR 0007:50). A specific N-Run command is the allowed shape; all Runs of a Project share one `slopstop.db` and one Writer fence (ADR 0006:41-47, :71). One command → one receipt with several events (ADR 0006:66-69); N epochs referencing one receipt is neither forbidden nor allowed. Whole rejection returns each Run to `amendment-requested` with dispatch closed (ADR 0011:128): plans unchanged, dispatch still stopped.
- A covered Run ending: a terminal Run must have no pending proposal and the terminal transaction clears the pointer (ADR 0007:36); no `superseded` decision is written for the cleared proposal and nothing invalidates the siblings, which stay `awaiting-approval` with dispatch closed. A completed Waypoint's further change goes through FR8's change Run (ADR 0011:125).
- Vocabulary: a waiting joint proposal is pre-decision, so a predecessor-epoch mismatch is `changed` (or `superseded` as a decision), not `stale` (ADR 0011:183-184, :53); distinct states stay distinct (:293). The FRD NFR (:80) requires a distinct visible state, which `changed` satisfies.
- Diagnostics missing beyond ADR 0011:271 (descriptions only): joint set invalid after one component superseded or epoch moved; a covered Run ended while waiting; component set incomplete or inconsistent at approval (counterpart of :76); a covered Run without an epoch; joint approval transaction failed; task held by a cross-Waypoint dialogue; coordination budget at warning or exhausted; unlinked pair awaiting Supervisor admission.

### 5. The Supervisor answering for a Waypoint without a Run (FR8)
- Keeps ADR 0021:34 (never changes files, approves or starts a Run) and :91 (Supervisor that starts Runs rejected) if the change Run is created only by a user action; keeps `PRODUCT.md:105` (Runs only through Begin) and :109.
- Extends ADR 0021:48 (the Supervisor becomes the counterpart) and ADR 0021:45 (a "change Run" proposal is not among the typed outcomes).
- "No active Run" is undefined against ADR 0007:32's eleven nonterminal states (e.g. `paused`, `awaiting-approval`, `ready-for-validation`); "finished" covers four terminal states, of which only `completed` carries accepted work (ADR 0007:32, :36).
- "Accepted work and decisions": decisions by scope and implementer (ADR 0022:21-22; the selection rule :34 is defined only for Forger/Worker context; the Supervisor receives every Foundation section, :42); accepted contract revisions, Waypoint-level and Run-independent (ADR 0011:47; ADR 0012:149); the Waypoint revision and Strand Frame (`CONTEXT.md:28-29`); for a finished Waypoint the Candidate and review (ADR 0015:80-84), Completion authorization (`CONTEXT.md:140`), Integration proof (ADR 0015:97), decision trailers (ADR 0022:60). The Supervisor cannot read code and cannot commission a reader Worker without a Run (`CONTEXT.md:32`).
- Change-Run entries (ADR 0011:125): `BeginAction` (cause `ACTION_SELECTED`, ADR 0007:43, baseline from workspace mode ADR 0011:51) has no Candidate precondition; `BeginCandidateChangeRun` needs a user `request-changes` decision against a terminal predecessor and fixes the `predecessor-candidate` baseline (ADR 0015:37, :82-84, :116) — the Supervisor cannot produce that decision, and for an integrated Waypoint it would invalidate the prior acceptance. `PrepareAutomaticAction` (ADR 0011:126) creates a draft Run without Begin; whether Supervisor-triggered preparation counts as "starts a Run" is unaddressed. The cause vocabulary is closed (ADR 0007:43). On the current text, a Supervisor-originated proposal maps to a user `BeginAction` with `ACTION_SELECTED` unless a new path or cause is added (fact, not a recommendation).
- A not-started Waypoint has no Run, epoch or Candidate; its intent changes through a map revision (ADR 0021:34), a decision proposal (ADR 0021:45; ADR 0022:28) or a contract revision (ADR 0012:149). FR7 has no epoch to anchor the Supervisor-answered side of a joint proposal. If B gains a Run mid-dialogue (slot vacant, ADR 0007:31-32), the FR8 case turns into the FR2 case; no rule covers it.

### 6. Per-Strand coordination budget (FR9, FR10; FRD Open Question 3)
- Only definition: ADR 0021:53 (a Supervisor coordination budget the user approves, separate from Run budgets), with no granularity, owner, record or approval moment. In-Run dialogue is charged to the Run with a per-dialogue limit and one Attention item at the limit (ADR 0021:52); `CONTEXT.md:35` says dialogue is "budgeted from the Run".
- Defaults: provisional table ADR 0021:65-76 (80% warning at :74; 12 messages per agent at :18 supersedes the table's 6 at :71), with no coordination-budget row; surfaces in Settings and Project profile (:84); splitting cross-Waypoint costs across Runs rejected (:92), consistent with FR10.
- All budget authority is Run-owned: epoch-owned limits (ADR 0011:55, :237; ADR 0007:35; ADR 0014:105), side-question budget per Run (ADR 0011:195), waterlines in dispatch authority (ADR 0011:172); raising a budget is added power needing a new epoch (ADR 0011:174).
- Units: subscription mode counts tokens, turns, time and utilization; API mode adds money (ADR 0009 Amendment 1 :288-289); utilization is an observation (:286); each Run pins its billing mode (:221), so Runs in one Strand may differ. Invocations pin a generic "budget scope" (ADR 0009:43, :108) and the current Run epoch (:39).
- The Strand has no status, approval owner or "work starts" event (ADR 0006:47, :50, :77; `CONTEXT.md:28`); Project-profile revisions hold Project defaults (ADR 0006:52; ADR 0011:49).
- Supervisor turns have no Execution owner to charge (ADR 0007:27; ADR 0009:38, :48; Amendment 1 :224-228; the Supervisor is the Project-conversation agent, ADR 0021:33).
- Forger dialogue turns are Run-owned Model attempts today (ADR 0009:39, :43, :108); excluding them from the Run budget needs a purpose split. ADR 0021:53 ("separate from Run budgets") supports exclusion but no clause states it.
- FR10 assigns cost only to "the Strand whose Forger asked"; a Supervisor-opened cross-Strand dialogue (FR3) has no paying Strand.
- Open Question 3: ADR 0009:163 leaves numeric defaults to measured Evidence; ADR 0021:67's provisional values are labelled "coordinator experience", and no such figure exists for a Strand-level budget.

### 7. Decision revisions as mandatory memory dependencies (FR11, FR12, FR16, FR17)
- Contradicted (Evidence-only model): ADR 0017:47 (each member binds one Evidence family current key via composite foreign keys), :53 (v1 dependencies are same-Project Evidence; the same-database half still holds — decisions live in the canonical store, ADR 0022:58; `CONTEXT.md:16`), :20 (Memory never changes an Evidence pointer; a decision counterpart is needed), :138 (one typed child per family; no generic subject). Kept: :48 (set root and ordered hash), :51 (informational relation outside the hash). Open: whether a set with decisions and zero Evidence is allowed (`CONTEXT.md:161` says "through evidence").
- FR12 keeps ADR 0017:60-63 (stale immediate and terminal, regardless of favourability) and :89 (effective stale before settlement, cited by FRD :80); extends :49 (the acceptance recheck must also reject a concurrent decision edit) and :9.
- FR16 contradicts ADR 0017:88 (exact equality of identities and digests): any new decision revision has a new id and version (ADR 0006:34; ADR 0022:29). ADR 0017:13 (re-verification always creates a new revision) means the mark can only prevent staleness, never restore it. Precedent: semantic fingerprints and explicit reuse links for onboarding decisions (ADR 0006:90, :135) — computed there, user-asserted here.
- FR17 extends ADR 0022:49 (which triggers only on "a new current revision", not retirement).
- "Current" for a retired decision is undefined: current rows hold `entity_version`, `current_revision_id` and archive state (ADR 0006:33); restoring never rewinds a pointer (:36); retire is a command (ADR 0022:58); every change creates a revision (ADR 0022:29; `PRODUCT.md:65`); the decisions log says retire keeps history (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:194`, :221). If retiring only changes archive state, a pointer comparison passes for a retired decision.
- Both an event and a direct comparison are needed as written: the read resolves dependencies against a structural union of ADR 0010 family current tables (ADR 0017:87, :94) — a decision current table needs a second arm; materialisation needs a source event (ADR 0017:65, :139-140, :144) but the event type and cause are closed to Evidence (:26, :36). ADR 0006:69 allows command receipts to insert events; nothing says decision edit or retire emits one. The decision owner, like Evidence (ADR 0017:19), would not query Memory; Memory's reverse index (:52) needs a decision arm.
- Unclear: whether a scope- or link-only revision (ADR 0022:29) counts as "meaning unchanged"; whether the wording-only mark also suppresses ADR 0022:49's Run item (FR16 and AC :102 name only memories and documents; FR15 lists pinned Runs).
- Text that becomes wrong or ambiguous: `PRODUCT.md:64` ("any exact decision" means an Evidence decision), :80-81 (invalidation only from Evidence replacement), :65 (no wording-only mark, no dependents list, retire semantics); `CONTEXT.md:161`, :163-164, :166-167, :170 (Evidence-only dependency terms); no term for the wording-only mark or Attention.
- Protocol shapes to extend later: `FrameDecisionSchema` (`workspace-protocol.ts:289-299`: only `draft|accepted`, keyed by section, no identity, revision chain, retire, scope or mark); `MemoryProjectionItemSchema` (:337-354: no stale cause or dependency list); `WorkspaceIntentSchema` (:425-440: no decision edit/retire intent); capabilities (:55).

### 8. Decision echo record and the decision-change Attention item (FR13-FR15)
- FR13 extends commit trailers (ADR 0022:60; `PRODUCT.md:123`), which are per commit, not per document location. Candidate recording moments, none assigned: a doer Worker's Tool invocation (lands in a task resource, ADR 0015:25, :30, and may be discarded; a Worker's claim is an attributed proposal, `PRODUCT.md:109`); `AcceptWorkerResult` (ADR 0015:48, task-workspace-local); Candidate publication (ADR 0015:62); Integration apply (`PRODUCT.md:123`; changed paths in `CONTEXT.md:181`, :183) — the only point where text reaches the working tree; the user-approved commit.
- Location identity: a path is never domain identity (ADR 0015:21; `CONTEXT.md:158`); nearest precedent is the Compound code anchor against a typed Evidence scope (`CONTEXT.md:160`, :123; `PRODUCT.md:126`), with `integration-target` (`CONTEXT.md:179`) matching the user's tree; Artifact source records use a stable relative identifier (`CONTEXT.md:113`). Privacy: no full paths in diagnostics or events (AGENTS.md "Safety And Privacy"; ADR 0006:116; ADR 0017:39, :100; `PRODUCT.md:116`).
- FR14 contradicts Worker ownership: a Worker is an attempt at a Delegation task in a Run (ADR 0007:25; `CONTEXT.md:32`); every Invocation context record is bound to a Run (ADR 0009:49); the Effect subject union is closed (`CONTEXT.md:71`; `PRODUCT.md:111`); the Supervisor never starts a Run and only "commissions" reader Workers with no stated owner (ADR 0021:34-35; same gap in ADR 0022:43). Alternative precedent: deterministic owner-specific observers with narrow read-only authority (`PRODUCT.md:100`, :122) — fits a literal search, not a model-judged paraphrase search. ADR 0006:137/:145 forbid a stored full-text index without requirements; a live scan needs none. A failed or truncated search must never read as "none found" (ADR 0022:50; ADR 0017:96; ADR 0009:52; `PRODUCT.md:48`, :116; `.rpiv/decisions/degrade-distinguishes-broken.md`). FR9's budget pays only cross-Waypoint messages; a Project-scope decision has no Strand to pay for the search.
- FR15 versus ADR 0022:49 (one per-Run item with a Forger-amendment action; recorded as an amendment trigger in the ADR 0011 note :10): the FRD does not say whether the single item absorbs or sits beside the per-Run items. Precedents: direct projection over unresolved failures (ADR 0017:101-102); Attention contents and "opening or closing the list never resolves an item" (`PRODUCT.md:48`); grouping per checkpoint (ADR 0022:54). Tension with the decisions log J3 rule "one item per exact action" (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:192`) unless the item has one action. Memory re-verification proposals cannot surface as their own Attention items (`PRODUCT.md:64`).
- Turning proposed update work into approved work: the Supervisor's outputs are proposals only (ADR 0021:34; ADR 0022:28). Document updates are repository mutations needing doer Workers in a Run (`PRODUCT.md:100`); Runs start only through Begin and automatic Actions stop at the approval boundary (`PRODUCT.md:105`); epochs come only from approval (ADR 0011:22); one nonterminal Run per Waypoint (ADR 0007:31). One approval of the Supervisor's proposal cannot itself create executable work. A Project-scope decision has no Waypoint to host a docs-update Run (FR8's change Run covers only finished Waypoints). Re-verification creates a new memory revision from a Memory Proposal with explicit user acceptance (ADR 0017:61, :135; `CONTEXT.md:169`; `PRODUCT.md:64`). Pinned Runs use ADR 0022:49's Forger amendment path.

## Code References
- `apps/harness/drizzle/canonical/0000`-`0003` — the only canonical migrations; no decision, Run, dialogue, Evidence, Memory or Attention tables.
- `packages/protocol/src/workspace-protocol.ts:55` — workspace capabilities (conversation, frame, memory); no decisions or attention.
- `packages/protocol/src/workspace-protocol.ts:111-118` — Conversation `ContextSourceSchema` kinds and trust.
- `packages/protocol/src/workspace-protocol.ts:235-245` — `ContextRecordProjectionSchema`, bound to a response message.
- `packages/protocol/src/workspace-protocol.ts:289-299` — `FrameDecisionSchema` (`draft|accepted` only).
- `packages/protocol/src/workspace-protocol.ts:337-354` — `MemoryProjectionItemSchema` (`accepted|stale|broken`).
- `packages/protocol/src/workspace-protocol.ts:425-440` — workspace intents (memory proposal review; no decision intents).
- `packages/kernel/src/workspace-identifiers.ts:23-26` — branded `AcceptedRevisionId`, `MemoryTopicId`, `MemoryRevisionId`, `MemoryProposalId`.
- `docs/adr/0021-supervisor-forger-and-mediated-agent-dialogue.md:17-20, :33-36, :41-48, :52-53, :57-58, :65-76, :80, :84, :91-92` — dialogue, roles, budgets, phase rules, defaults, consequences.
- `docs/adr/0011-approved-run-preparation-and-amendment-authority.md:9-10, :22-28, :47, :51, :55, :84, :91-95, :125-133, :140, :145, :172-175, :183-184, :195, :212-217, :223-225, :234-247, :257, :271, :276-294` — epoch, proposals, readiness, amendment commands, authority intersection, vocabulary, tables, diagnostics.
- `docs/adr/0007-supervised-execution-aggregate-ownership.md:23-36, :43, :47, :50, :56-60, :71, :77-79, :94, :106` — Run lifecycle, causes, commands, multi-aggregate rule, Worker states, Control requests, Action availability.
- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md:9, :23, :31, :38-52, :58, :81, :103, :108, :118-121, :127, :129, :163, :221-228, :236, :272, :280, :286-289, :323` — Turn Machine, Sealed Invocation, Invocation context, boundaries, Amendment 1 roles and units.
- `docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:9, :13, :19-20, :26, :36, :39, :47-53, :60-66, :82-96, :100-102, :123-146` — dependency model, events, trusted read, Attention projection, tables.
- `docs/adr/0022-decision-scope-and-implementing-waypoints.md:15, :21-24, :28-29, :34-36, :42-44, :48-50, :54, :58, :60` — decision scope, context inclusion, pinning, change item, retire, trailers.
- `docs/adr/0006-physical-persistence-layout.md:33-36, :41-62, :66-71, :82-90, :116, :129, :135-137, :145` — current rows, table families, receipts and events, relationships, fingerprints, indexes.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:21, :25-30, :37, :48, :50, :62, :80-84, :97, :116` — identity rules, resources, change-Run baseline, Candidate review.
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md:72-75` — Safe checkpoint scope, pause.
- `docs/adr/0012-test-first-completion-proof.md:149` — contract revision acceptance.
- `docs/adr/0014-finding-validation-remediation-and-recheck-authority.md:105` — epoch-pinned remediation limits.
- `PRODUCT.md:43, :47-48, :52, :55-56, :64-66, :80-81, :100, :103, :105-106, :109-111, :116, :122-123, :126` — product rules touched.
- `CONTEXT.md:16, :28-29, :32-33, :35-36, :48, :58, :67, :71-72, :82, :113, :123, :132, :140, :149-150, :158, :160-170, :179-183` — terms touched.

## Integration Points

### Inbound References
- `.rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md` — the FRD this research grounds.
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:778-794` (§90-§91) — the user record of the FRD; §91 records the user is still unsure how memories and decisions work in practice and chose to continue.
- ADR 0011 note (:9-10) and ADR 0007 note (:11-13) — earlier "amended by ADR 0021/0022" notes the new amendments must extend.

### Outbound Dependencies
- ADR 0010 (Evidence family current tables) — the trusted-read union ADR 0017 resolves against (ADR 0017:87, :94).
- ADR 0012 (contract revisions) — the Run-independent accepted contracts FR8 can read (ADR 0012:149).
- `.rpiv/decisions/degrade-distinguishes-broken.md` — governs the change-time search outcome and the stale/changed joint-proposal state.

### Infrastructure Wiring
- None in code. Future wiring (not built): canonical decision and echo table families (ADR 0006:47, :56), Execution dialogue records (ADR 0021:80), Memory dependency children (ADR 0017:123-138), protocol intents and projections (`workspace-protocol.ts`).

## Architecture Insights
- **Every Execution authority is Run-scoped by construction** (epoch, proposal, Control request, budget, Invocation context, Model attempt). Phase 2 is the first requirement set that spans Runs; each FR that crosses Runs (FR4, FR6-FR10) hits this. The amendment must choose, per mechanism, between N per-Run records plus a non-authoritative grouping (the Approval Dependency Graph precedent, ADR 0011:26) and a new cross-Run owner (forbidden for approval by ADR 0011:28).
- **The Supervisor is a Conversation-side agent with no Execution contract.** FR3, FR8, FR9 and FR14 all need the Supervisor (or a Worker it commissions) to read, speak or spend outside any Run. The minimum enabling change is an ADR 0009 Supervisor invocation arm (or an explicit Conversation-side budget path) plus an owner for commissioned readers or deterministic observers.
- **Two staleness vocabularies.** ADR 0011 says `changed` for pre-decision references and `stale` for accepted authority; ADR 0017 says `stale` for memory. FR7's "stale" maps to ADR 0011's `changed`/`superseded`; FR12's "stale" maps to ADR 0017's `stale`.
- **Decisions have no physical home yet.** ADR 0022:58 says the canonical store gains decision relations, but ADR 0006 lists no decision table family; the echo record and the memory dependency arm both need it.
- **Amendments required (locations; no text written):**
  - ADR 0021: :17-20 (note and participant shape), :43 (closing states for the chosen shape), :45 (technical-agreement exception with bounds from ADR 0011:84, :91, :172-175; change-Run and joint proposal kinds), :46-48 (linked-pair rule, Supervisor admission record, Supervisor-opened dialogues, Supervisor as counterpart, "no active Run" against ADR 0007:32), :47 (thread ownership, contest), :52-53 (per-Strand budget, requesting-Strand rule, exclusion from Run budgets), :57-58 (task-scoped hold across Runs and its reconciliation with ADR 0011:131), :65-76 (coordination-budget row or explicit "open"), :80 (admission record, cross-Run thread owner, budget owner), :84, :91.
  - ADR 0011: :9-10 note, :22/:25/:28 (grouping record without approval authority), :55 (Run budgets exclude phase 2 turns), :95 and :172-173 (task-scoped hold), :125 (dialogue-originated change Run entry), :127/:242 (cascade supersession), :128/:131/:133 (joint approve/reject, dispatch while waiting and after rejection), :183-184 (word for an unapprovable joint proposal), :212-217 (command rows), :223-225 (N-Run CAS), :236/:247 (tables, decisions), :271 (diagnostics), :276-294 (closure rows).
  - ADR 0017: :9, :19-20, :26/:36 (event or cause arm), :47 (decision child arm), :49 (acceptance recheck), :53, :60/:63, :65/:139-140 (source event), :87-88/:94 (read union and wording-only exception), :123-138 (tables), :144, :146-162 (proofs).
  - ADR 0022: :49-50 (retire, wording-only effect, single item versus per-Run item, search outcome), :58 (retire semantics), :58-60 (echo record and owner), :34 (Supervisor source selection when answering for a Waypoint; later, agreement source selection).
  - ADR 0007: :26/:77/:79/:94 (task-scoped Control request, if chosen), :56-60 and :71 (Worker-safe pause, if chosen), :27 (Model attempt owner for Supervisor turns), :34/:36/:47/:50 (joint lifecycle, terminal-Run clearing, command list, N-Run write set), :43 (causes, only if needed).
  - ADR 0009: note (:7-10), :23/:31/:38/:43/:48-49/:108 (Supervisor invocation and Strand budget scope), :118-121 (Worker-scoped pause, if chosen), Amendment 1 :221-228/:272/:280/:288-289 (role routing, session end on pause, units across billing modes).
  - ADR 0006: :47/:50/:52/:56/:70/:129/:136 (decision and echo families, Strand budget owner, event requirement, indexes), :137 (only if a stored search index is chosen).
  - ADR 0008:72-75 (task- or Worker-scoped checkpoint, if chosen); ADR 0015:83 (only if `BeginCandidateChangeRun` is chosen).
  - `PRODUCT.md`: :48 (decision-change item type), :52 (thread in Run overview), :64/:80-81 (decision-caused invalidation), :65 (wording-only mark, dependents, retire), :100 (observer or reader outside a Run), :103 (technical agreements; phase 2 through the Supervisor), :104-106 (joint proposal), :123 (echo versus trailers).
  - `CONTEXT.md`: :28 (Strand budget), :33 (Supervisor; define "linked"), :35 ("budgeted from the Run"), :58 (Control request kinds, if changed), :82, :161-170 (dependency terms), and new terms: Technical agreement, Joint proposal, Coordination budget, Decision echo, Wording-only revision, Attention.

## Precedents & Lessons
4 similar past changes analyzed.

### Precedent: ADR 0021 and ADR 0022 proposed, accepted, then cross-ADR notes added a day later
**Commit(s)**: `fc53cbc` — "docs(adr): propose ADR 0021 (agent coordination) and ADR 0022 (decision links)" (2026-10-09); `e7dfc3e` (2026-10-09); `1cf6983` — "docs(adr): accept ADR 0021 and ADR 0022" (2026-10-09)
**Blast radius**: 3 files across 2 layers
  docs/adr/ — two new ADRs, Proposed first
  .rpiv/artifacts/evidence/ — decisions log §27

**Follow-up fixes**:
- `d601e5b` — "docs: align ADRs, CONTEXT, DESIGN and stale artifact statuses with accepted decisions" (2026-10-10) — amended ADRs 0007/0009/0011/0014 had no "amended by" notes; CONTEXT.md still said "Provisional".
- `e44236d` — "rename Feature to Strand and Saga to Weave" (2026-10-10) — new text must use current names.
- `211b2ea` (2026-10-10) — ADR 0021 note: phase 2 in v1, "mechanics across Runs at different epochs left to design" (this research's subject).

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md §27 (:350-362) — ADRs written as Proposed, accepted only on the user's explicit words.

**Takeaway**: add dated "amended by" notes to every amended ADR, plus CONTEXT and PRODUCT edits, in the same change.

### Precedent: ADR 0009 Amendment 1 with product documents left stale
**Commit(s)**: `fe04423` — "docs(adr): amend ADR 0009 with billing modes and governed CLI sessions" (2026-10-04)
**Blast radius**: 1 file (ADR 0009)

**Follow-up fixes**:
- `3ad4b7a` (2026-10-09) — coherence pass aligning PRODUCT, CONTEXT, DESIGN.
- `1f88f9a` — "docs: withdraw mastra from product text and adrs (#101)" (2026-10-11) — PRODUCT.md and AGENTS.md still wrong a week later.

**Takeaway**: an ADR-only amendment left product documents wrong for 7 days and took two passes to fix.

### Precedent: the original ADR 0011 and ADR 0017
**Commit(s)**: `d77ed4b` — "docs(execution): define approved run preparation" (2026-08-26); `1710e0c` — "docs(memory): define evidence invalidation authority" (2026-08-30); `d1962a2` (2026-08-31)
**Blast radius**: ADR plus CONTEXT.md, PRODUCT.md, ADR 0006 and neighbouring ADRs in one commit

**Follow-up fixes**:
- none found in the following 30 days.

**Takeaway**: the amendments that needed no fix-up changed PRODUCT, CONTEXT and ADR 0006 in the same commit.

### Precedent: staged-upgrade amendments reconciled after the build
**Commit(s)**: `cfe7896`, `3138743` (2026-10-05); `e1c0a99` — "docs(adr): make the staged-upgrade amendments match the built upgrade" (2026-10-07)

**Follow-up fixes**:
- `3138743` — fixed ADR 0001 spots that `cfe7896` missed the same day.

**Lessons from docs**:
- .rpiv/artifacts/reviews/2026-10-07_16-47-49_2a19d40-e1c0a99-c1-0-staged-upgrade.md (:66, :783-785) — a review found an ADR branch dead in production.

**Takeaway**: search every ADR for each sentence that states the old rule; a single pass missed spots twice.

### Composite Lessons
- Amendments repeatedly left PRODUCT.md, CONTEXT.md, AGENTS.md or sibling ADRs stale (`fe04423`, `1cf6983`, `cfe7896`; fixed by `3ad4b7a`, `d601e5b`, `1f88f9a`, `3138743`). Plan one change covering ADRs 0021, 0011, 0017, 0022 (and 0006/0007/0009 where touched), PRODUCT.md and CONTEXT.md.
- Style: accepted text is never rewritten; amended ADRs get a dated "## Note (YYYY-MM-DD): amended by …" naming the sections; larger changes get a numbered "Amendment N" with its own status (ADR 0009 Amendment 1). New text uses Forger and Strand.
- Approval path: ADRs Proposed, recorded in the decisions log, Accepted only on the user's explicit words (§27).
- Overlaps already in force: ADR 0022:49's per-Run item and the ADR 0011 note's single-Run rule must be explicitly extended or superseded.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md` — the FRD under research.
- `.rpiv/artifacts/discover/2026-10-09_18-03-55_agent-coordination-and-dialogue.md` — phase 1 dialogue FRD (:180-189 open phase 2 questions).
- `.rpiv/artifacts/discover/2026-10-10_00-59-10_v1-scope-deferred-decisions.md` — phase 2 in v1.
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md` — #99 agenda (:45-47).
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` — §21, §25, §27, §31, §90-§91.
- `.rpiv/artifacts/reviews/2026-10-07_16-47-49_2a19d40-e1c0a99-c1-0-staged-upgrade.md` — amendment-versus-build review lesson.

## Developer Context
Decisions carried from the FRD (`discover`):

**Q (discover: Phase 2 situations): Which real situation of cross-Waypoint dialogue matters, and what must go right?**
A: All three: agreeing an interface, one Waypoint's change affecting another, ordering and dependencies.

**Q (discover: Phase 2 failures to avoid): What would be a failure of phase 2?**
A: Work thrown away; everything stopped.

**Q (discover: Parallel Waypoints): Pre-resolved from codebase evidence — confirmed in Step 4.**
A: Keep: one active Run per Waypoint, Waypoints in parallel.

**Q (discover: Forgers talk only through the Supervisor): Pre-resolved from codebase evidence — confirmed in Step 4.**
A: Keep.

**Q (discover: Runs stay pinned to the approved plan): Pre-resolved from codebase evidence — confirmed in Step 4.**
A: Keep: a running Run changes only through an amendment the user approves.

**Q (discover: No authority in agent messages across Waypoints): Pre-resolved from codebase evidence — confirmed in Step 4.**
A: Keep.

**Q (discover: Who may talk): Who decides that two Waypoints may talk?**
A: Waypoints linked by `blocks` or `related-to` talk directly through the Supervisor; any other pair needs the Supervisor's visible admission.

**Q (discover: What stops during a dialogue): While two Forgers discuss a change, what stops?**
A: Only the affected tasks of each involved Run, at a safe checkpoint.

**Q (discover: Approval of a cross-Waypoint agreement): How does an agreement that changes two Runs reach the user?**
A: One joint proposal, approved or rejected as a whole.

**Q (discover: Technical agreements need no approval): Should a technical agreement inside the approved plans need the user's approval?**
A: Only plan-changing agreements reach the user; technical agreements stay recorded and visible in the thread.

**Q (discover: Waypoint without an active Run): What if the other Waypoint has no active Run?**
A: The Supervisor answers from that Waypoint's accepted work; a change to a finished Waypoint becomes a change-Run proposal.

**Q (discover: Epoch change while a joint proposal waits): What happens to a waiting joint proposal if one Run changes plan version or ends?**
A: It goes stale, cannot be approved, and is re-checked and proposed again.

**Q (discover: Coordination budget granularity): When, and for what, is the Supervisor coordination budget approved?**
A: Per Strand, warning at 80%, Attention at the limit.

**Q (discover: Cross-Strand dialogue cost): Which budget pays a dialogue between Waypoints of different Strands?**
A: The requesting Strand's.

**Q (discover: Who opens a cross-Waypoint dialogue): Who can start a dialogue between Waypoints?**
A: A Forger asks, or the Supervisor on a detected conflict.

**Q (discover: Memories depending on decisions): When a decision is replaced, what happens to memories that rely on it?**
A: They become stale: a decision revision may be a mandatory memory dependency (amends ADR 0017).

**Q (discover: Documents that repeat a decision): How does Ragnarok know which documents repeat a decision?**
A: Recorded links plus a change-time search.

**Q (discover: What happens when a decision changes): What should the user see, and what happens next?**
A: One Attention item with stale memories, documents and pinned Runs; the Supervisor proposes the update work; the user approves.

**Q (discover: Wording-only edits): Should a typo fix make dependent memories stale?**
A: The user can mark "wording only"; without the mark, everything dependent becomes stale.

**Q (discover: Retired decisions): And a decision retired without a replacement?**
A: Same as replaced.

Process note: the coordinator's instruction (2026-10-16) routes every question for Pedro through the coordinator and asks for the checkpoints to be reported with this artifact. The research skill's in-session developer checkpoint therefore did not run; the grounded checkpoint questions are recorded below as pending and are not answered here.

## Related Research
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md`

## Open Questions

### Carried from the FRD (verbatim)
- Where technical agreements between Waypoints are stored for future Runs. The user leans to a new interface record, separate from Decisions, and does not want technical details mixed with decisions: "talvez um registo nove de interface mas tenho que pensar bem". *(Pedro's open choice; not decided. Facts in Detailed Findings §3.)*
- How a Forger names the affected tasks, and which command pauses a Worker at a safe checkpoint (no Worker-pause command exists; ADR 0007:58, ADR 0009:118-121). For design. *(Facts in §2: options are a task-scoped Control request with a new target kind, a hold on not-yet-started tasks only, or a Worker-safe pause that ends the CLI session and continues under a new seal; affected tasks can only be named as accepted `DelegationTaskId`s of each Run's current plan.)*
- Numeric defaults for the per-Strand coordination budget (evidence-driven; ADR 0009:163). *(No measured or provisional figure exists; ADR 0021:65-76 has no row.)*

### Developer checkpoints pending (for Pedro, through the coordinator)
1. `docs/adr/0021-supervisor-forger-and-mediated-agent-dialogue.md:45` and `PRODUCT.md:103` say every converged outcome is a proposal only the user approves, and the FRD Non-Goals (:52) claim :45 is kept, while FR5 lets technical agreements take effect without approval. Confirm that ADR 0021:45 and PRODUCT.md:103 are amended to carve out technical agreements (FR5 wins over Non-Goal :52).
2. FR5's bound cites only `docs/adr/0011-approved-run-preparation-and-amendment-authority.md:172-174`. An agreement that changes a contract clause or node result schema (ADR 0011:84, :91) or contradicts an accepted decision (ADR 0022:21-22) is not covered. Is such an agreement always plan-changing (reaches the user), or may it be technical?
3. Once a joint proposal is submitted, ADR 0011:131 closes all new dispatch in every covered Run, in-flight Workers must reach a safe boundary (:140, :145), and after rejection dispatch stays closed (:128). Should unaffected tasks keep running while the joint proposal waits for the user (a new narrower closure), or is a full stop of the covered Runs acceptable during that wait?
4. FR15's single decision-change Attention item and ADR 0022:49's per-Run item ("Decision changed: Run N uses the earlier version", with its own Forger-amendment action) overlap, and the decisions log J3 rule (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md:192`) says one item per exact action. Should the single item replace the per-Run items (one action: approve the proposed update), or sit beside them?
5. FR16's "wording only" mark: should it also suppress ADR 0022:49's per-Run item for Runs pinned to the old wording, and does a revision that changes only a decision's scope or implementing links (ADR 0022:21-22, :29) count as "meaning unchanged"?
6. FR10 assigns cost to "the Strand whose Forger asked"; a dialogue the Supervisor opens on a detected conflict (FR3) has no requesting Forger, and a Project-scope decision's change-time search (FR14) has no Strand. Which budget pays in those two cases?

### New questions for design (not for Pedro unless the designer escalates)
- One mediated pair (Forger A ↔ Forger B) or two pairs through the Supervisor, and how closing states combine (ADR 0021:17, :19, :43).
- Owner of a cross-Waypoint thread and its admission record (ADR 0021:47, :80; ADR 0007:77).
- Which relationship revision applies, and what happens to an open dialogue when the map changes or a Waypoint gains a Run mid-dialogue (ADR 0006:83; ADR 0007:31-32).
- A Supervisor runtime, context and budget contract (ADR 0009:23, :31, :38, :48-49; Amendment 1 :224-228).
- Joint proposal shape: grouping record versus pure link (ADR 0011:26, :28); one receipt versus N; word for an unapprovable joint proposal (`changed`/`superseded` per ADR 0011:183, versus the FRD's "stale"); whether a covered Run without an epoch may join.
- "No active Run" against ADR 0007:32's nonterminal states, and which change-Run entry a Supervisor-originated proposal uses (ADR 0011:125-126; ADR 0007:43).
- Retire semantics (new terminal revision or archive state; ADR 0006:33, :36; ADR 0022:58); decision event versus a cause arm (ADR 0017:26, :36, :65, :139-140); whether a decision-only memory dependency set is allowed (ADR 0017:47).
- Echo recording moment, location identity, and search owner (Worker versus deterministic observer; ADR 0015:21, :48; `PRODUCT.md:100`, :123).
- How approved update work becomes Runs or memory proposals, including a Project-scope decision with no hosting Waypoint (ADR 0021:34; `PRODUCT.md:105`).

### FRD Suggested Follow-ups (unchanged; outside this research)
- A rule for a running Run when the map changes.
- An Attention item type for conflicts between two Waypoints' Runs.
- Two Runs touching the same code (`PRODUCT.md:110`; ADR 0008:105).
