---
date: 2026-10-09T18:03:55+0100
author: Pedro Mesquita
commit: 3895d4a
branch: main
repository: slopstop
topic: "Rebuild the rpiv working method natively inside Ragnarok"
tags: [intent, frd, rpiv, frame, runs, evidence, reviews, lanes, process]
status: complete
register: mixed
consensus: confirmed
lane: normal
lane_reasons: ["lane.mjs broken: no files named at intent time (exactly one mode is needed); broken means normal"]
last_updated: 2026-10-09T18:03:55+0100
last_updated_by: Pedro Mesquita
issue: https://github.com/TheMastermindPT/slopstop/issues/100
content_hash: 58002e7cef00d308c58c29500d3839b9090622e1ab175c582d8739a9d118fc28
---

# FRD: Rebuild the rpiv working method natively inside Ragnarok

## Summary
Ragnarok rebuilds the user's rpiv working method (staged intent, research, design, test-first implementation, bounded multi-agent review, sealed approvals) as native behaviour. The method maps onto Ragnarok's existing owners: Frame, Run preparation, test-first discipline, Findings and Evidence. Size-based lanes decide how much of it runs. Each Project can adjust it through its profile, and the quality tools are bundled and always on. The rpiv repository stays independent; Ragnarok's rules win wherever the two differ.

## Problem & Intent
In the user's words (Portuguese, verbatim): "Como eu já tenho a maior parte da maneira como eu gosto de trabalhar (workflows, hooks, skills) instaladas, há coisas que, se calhar, gostaria de importar para a harness e, portanto, trabalhar dessa forma."

The user chose all three motivations with no priority among them:
- work in Ragnarok the way they already work with rpiv;
- guarantee quality through rpiv's checks;
- reuse what they already built instead of reinventing it.

On public users, from earlier in the same session: "ao abrir esta área ao público eu não quero forçar ao utilizador a utilizar certas ferramentas que eu uso ou maneiras opinadas de trabalhar." The user later refined this for tools: "essas ferramentas já vêm pré-instaladas … teremos que prestar atenção é que essas ferramentas terão que ser atualizadas".

## Goals
- Ragnarok agents follow the rpiv method by default, without the user repeating it by hand.
- rpiv's quality guarantees run inside Ragnarok, owned by Ragnarok's authority records.
- The existing rpiv design is reused as the reference model, not reinvented.
- A public user is not forced into the owner's personal style: lanes scale the process, and Project profiles adjust it.

## Non-Goals
- Running the rpiv-claude plugin unchanged inside Ragnarok (rejected: rebuild natively instead).
- Fully editable, user-authored workflows.
- Making every stage mandatory for all work.
- Standing decisions (a binding rule ledger across all future work) in this first version.
- Storing process documents only as files in the user's repository.
- Jev or other external paid advisory services used by rpiv hooks.

## Functional Requirements
1. Ragnarok SHALL classify each piece of work into a lane (fast, normal or rigorous) from its size, risk and sensitive signals, as rpiv's lane estimate does. A lane can only be raised. Only the user can force a lighter lane.
2. The lane SHALL decide which stages and reviews run. No Action is a mandatory stage (PRODUCT.md:42).
3. Frame SHALL support rpiv's interview style: one question at a time, a glossary of terms, and a teach-back consensus check before writing.
4. In the rigorous lane, each slice's plan SHALL get an independent intent review before any build.
5. After a build, Ragnarok SHALL run a candidate review: code quality, test coverage and plan compliance, plus a verifier that confirms, weakens or falsifies each finding. These map onto ADR 0014 Findings and independent rechecks.
6. Review fix rounds SHALL default to two. When serious findings remain after two rounds, Ragnarok SHALL propose a third or fourth round in Attention, with the reason and the estimated cost. The user approves. Minor-only findings never trigger an extra round.
7. Before integration, Ragnarok SHALL run a deep multi-wave review, and periodically an architecture review (system model, "slop" lenses).
8. Outward actions (push, branches, worktrees, GitHub writes) SHALL require the user's explicit confirmation.
9. Approved documents SHALL be sealed: content-hashed, immutable accepted revisions. Any change outside the allowed append zones reopens approval.
10. Process documents (FRDs, designs, reviews, evidence) SHALL be stored as Ragnarok records in its local database, not in the user's repository.
11. When a change is committed to the repository, the commit (and PR) SHALL carry a short "why" summary in words, plus trailer lines with the stable identifiers and versions of the justifying decisions and the Run (for example `Ragnarok-Decisions: D-04 r2, D-05 r1` and `Ragnarok-Run: run-14`).
12. Ragnarok SHALL navigate both ways: from a commit or diff to its decisions and Run, and from a decision to the commits that implemented it.
13. Each Project SHALL be able to adjust permitted process options through its Project profile and the existing discipline exceptions (CONTEXT.md:82-83), for example lane thresholds or review depth.
14. The quality tools (jscpd, ast-grep and the others from the rpiv workflows) SHALL ship with the harness, always on, visibly listed as bundled, with an update control.
15. The model chosen at first install SHALL apply to every task by default. Settings SHALL allow choosing the model and effort level per task or role.

## Non-Functional Requirements
- **Performance**: no specific latency constraint. Multi-agent reviews are bounded by the round cap and lane, to limit model calls.
- **Security**: outward actions need explicit confirmation. Bundled tools are pinned per harness release, and updates install only tested versions with rollback. Model and repository text is untrusted. Each bundled tool's licence must allow redistribution.
- **UX / Accessibility**: lanes, reviews, extra-round proposals and bundled tools are visible in the app (Attention, Run overview, Settings). The plain-text and keyboard parity rules of PRODUCT.md apply.
- **Reliability**: a missing, broken, pending or stale required gate blocks acceptance and never reads as passed (degrade-distinguishes-broken). Sealed approvals detect any change outside the allowed zones.

## Constraints & Assumptions
- The rpiv-claude repository stays independent and keeps working on its own in Claude Code. Ragnarok does not depend on it at runtime.
- Where rpiv and Ragnarok's PRODUCT.md or ADRs differ (authority, approvals, isolation, persistence), Ragnarok wins.
- Built on existing owners: Frame (PRODUCT.md:58-71), Run preparation and amendments (ADR 0011), test-first proof (ADR 0012), Evidence (ADR 0010), and Findings with independent recheck (ADR 0014).
- Assumption: the lane classification runs automatically, as in rpiv (confirmed in teach-back).
- Assumption: deep and architecture reviews run before integration, not on every slice (confirmed in teach-back).
- The user's earlier decision stands: bundled quality tools cannot be disabled (decisions log, 2026-10-09).

## Acceptance Criteria
- [ ] For a change touching one file, the Run overview shows lane "fast" and no intent review. For a change touching a migration or a sensitive area, it shows "rigorous" with an intent review step before any build.
- [ ] After a third failed review round is reached, Attention shows one item proposing an extra round, with its reason and estimated cost. No round runs before the user approves it.
- [ ] A candidate review in the rigorous lane produces findings from the three reviewer roles plus verifier tags (confirmed, weakened, falsified), visible in the Run overview.
- [ ] Pushing or creating a branch from Ragnarok shows a confirmation prompt every time.
- [ ] Editing an accepted design outside its allowed zones changes its state to "approval reopened".
- [ ] A commit created by Ragnarok contains a "Why:" summary and `Ragnarok-Decisions:` and `Ragnarok-Run:` trailer lines. Opening that commit in Ragnarok shows the linked decisions and Run, and each decision lists the commit.
- [ ] Settings → Tools lists jscpd and ast-grep as bundled, with version and an update action, and no disable toggle.
- [ ] Settings shows one default model applied to every task, and a per-task model and effort override.
- [ ] No `.rpiv/` folder or process documents are written into the user's repository by Ragnarok.

## Recommended Approach
Map rpiv's stages and gates onto Ragnarok's existing owners (Frame, ADR 0011 Run preparation, ADR 0012 test-first discipline, ADR 0010 Evidence and ADR 0014 Findings), adding lanes, bounded review rounds, sealed approvals and commit-trailer traceability as Execution and Evidence policy configured through the Project profile. Bundled tools become pinned, deterministic Evidence producers.

## Decisions

### Motivation
**Question**: What problem do you want to solve by bringing rpiv into Ragnarok?
**Recommended**: n/a — `intent` question
**Chosen**: All three: work as I already work, guaranteed quality, and reuse what I built, with no priority among them.
**Rationale**: The user's own framing.

### Import meaning
**Question**: Does "import rpiv" mean rebuilding it inside Ragnarok, using the rpiv plugin as is, or a mix?
**Recommended**: n/a — disambiguation (about 50/50)
**Chosen**: Rebuild it inside Ragnarok, with rpiv as the model.
**Rationale**: It fits Ragnarok's own authority and records instead of a second, external process.

### Constraints
**Question**: Which limits apply to the rebuild?
**Recommended**: n/a — constraint gathering
**Chosen**: rpiv stays independent; Ragnarok's rules win; do not force my style on the public; quality tools always on.
**Rationale**: The user's selection, which matches earlier statements in the session.

### Stages are not mandatory
**Question**: Keep "no Action is a mandatory stage; the size of the work picks the path"?
**Recommended**: Keep.
**Chosen**: Keep.
**Rationale**: evidence: PRODUCT.md:42 + confirmed. Lanes scale the process instead of forcing it.

### Map onto existing owners
**Question**: Rebuild rpiv by fitting it into Frame, Run preparation, ADR 0012, ADR 0014 and ADR 0010?
**Recommended**: Fit into what exists.
**Chosen**: Fit into what exists.
**Rationale**: evidence: CONTEXT.md:36-37, ADR 0011/0012/0014/0010 + confirmed. It avoids two parallel systems.

### Review round cap
**Question**: Should the two-round review cap become a Ragnarok rule?
**Recommended**: Yes, a product rule.
**Chosen**: Two by default; a third or fourth is possible depending on the severity of the findings.
**Rationale**: The user's words: "Por norma, duas, mas há ocasiões em que talvez seja melhor ocorrer uma terceira e quarta. Depende da severidade."

### Who approves extra rounds
**Question**: Who decides to go past two rounds?
**Recommended**: The user, on a proposal.
**Chosen**: The user, on a proposal in Attention with the reason and the cost. Minor findings never trigger an extra round.
**Rationale**: It keeps model spend under the user's control.

### First-version scope (1)
**Question**: Which rpiv parts are in the first version?
**Recommended**: n/a — scope selection
**Chosen**: Lanes, review before build, review of the result, and the consensus interview.
**Rationale**: The user's selection.

### First-version scope (2)
**Question**: Which other rpiv parts are in the first version?
**Recommended**: n/a — scope selection
**Chosen**: Deep review and architecture review, confirmation before outward actions, and sealed approval. Standing decisions are left out.
**Rationale**: The user's selection.

### Customisation for public users
**Question**: How much can a user adjust the process?
**Recommended**: The Project profile.
**Chosen**: The Project profile: the rpiv-derived default with permitted options per Project (CONTEXT.md:82-83).
**Rationale**: Optimises controlled flexibility and loses total freedom; it fits the existing profile and discipline-exception model.

### Where documents live
**Question**: Where do process documents live?
**Recommended**: In Ragnarok's database.
**Chosen**: In Ragnarok's database.
**Rationale**: It keeps the user's repository clean and follows PRODUCT.md's local-state rule. The user raised the concern that the "why" could be lost, which was resolved by the next decision.

### Keeping the "why" with the code
**Question**: How do we keep the "why" from being lost outside Ragnarok?
**Recommended**: The why goes in the commit.
**Chosen**: The why goes in the commit: a short summary in words plus trailer lines with the decision ids and versions and the Run id, with two-way navigation in Ragnarok.
**Rationale**: The user asked how commits connect to the database; the identifier link was shown and confirmed.

### Reviewer models
**Question**: Which model do reviewers use by default?
**Recommended**: Depends on the lane.
**Chosen**: User's own rule: the model chosen at first install (for example Opus 5.5) runs every task by default; Settings allows changing the model and effort per task.
**Rationale**: The user's words: "a primeira vez que instalo … escolho o modelo Opus 5.5 … todas as tarefas irão correr com o 5.5 … vou poder mudar, para cada coisa, o modelo e o nível de esforço."

## Open Questions
- Which exact Project-profile options are adjustable, and their bounds (for research and design).
- How often the architecture review runs ("periodically"): its trigger and owner.
- Licence and redistribution check for each bundled tool, and the update and rollback mechanics (also tracked in the decisions log).

## Suggested Follow-ups
- Standing decisions (rules that bind all future work) were explicitly left out of this version. Revisit after the first version.
- The review round cap is a working rule today, not product text (no product-level cap found in PRODUCT.md, CONTEXT.md or the ADRs). It needs a PRODUCT.md or ADR change.
- The agent-collaboration FRD (second topic of this session) will define how reviewers and builders exchange findings through the mediated agent dialogue.

## Glossary
| Term | What it means here |
|---|---|
| lane | The size of a piece of work (fast, normal, rigorous), which decides how many stages and reviews run. |
| intent review | Independent agents check a slice's plan before any code is written. |
| candidate review | Independent agents check the built result (code, tests, plan compliance). |
| verifier | An agent that confirms, weakens or falsifies each finding a reviewer reports. |
| deep review | A multi-wave review of the whole change before it joins the repository. |
| sealed approval | An accepted document fixed by a content hash; changing it outside allowed parts reopens approval. |
| commit trailer | Lines at the end of a commit message with identifiers, e.g. `Ragnarok-Decisions: D-04 r2`. |
| Project profile | Per-Project settings that adjust permitted defaults. |

## Shared Understanding
**Agreed model (in the developer's words):** Rebuild the rpiv way of working inside Ragnarok, fitted onto Frame, Runs, test-first proof, Findings and Evidence. Lanes size the process; reviews are capped at two rounds, with extra rounds the user approves; the quality tools are bundled and always on; documents live in Ragnarok, and the why travels in commits; the default model applies to everything and is adjustable per task in Settings.

**Corrected during teach-back:** nothing — the model was confirmed as first stated.

**Residual uncertainty (accepted):** The lane classification is automatic and only the user can force a lighter lane. Deep and architecture reviews run before integration, not per slice. Both were confirmed as stated.

## References
- `C:/Users/pedro/rpiv-claude/rpiv/skills/_shared/candidate-workflow.md` (lanes, review rounds, sealed approval)
- `C:/Users/pedro/rpiv-claude/rpiv/hooks/hooks.json` (outward-action approval and other hooks)
- `PRODUCT.md:42`, `:58-71`; `CONTEXT.md:36-37`, `:82-83`
- `docs/adr/0010`, `0011`, `0012`, `0014`
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` (bundled tools, billing modes, Decisions page "Why")
- GitHub #99 (agent collaboration, companion FRD)
