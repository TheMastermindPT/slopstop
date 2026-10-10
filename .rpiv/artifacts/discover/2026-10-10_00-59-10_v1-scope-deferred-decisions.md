---
date: 2026-10-10T00:59:10+0100
author: Pedro Mesquita
commit: 46322d8
branch: main
repository: slopstop
topic: "v1 scope: deferred decisions closed (2026-10-10)"
tags: [intent, frd, v1-scope, diagnostics, identity, packaging, agent-dialogue, models, billing, quality-tools]
status: complete
register: mixed
consensus: confirmed
lane: normal
lane_reasons: ["lane.mjs estimate fast on documentation paths", "raised to normal: many decision branches touching credentials, diagnostics and storage paths"]
last_updated: 2026-10-10T00:59:10+0100
last_updated_by: Pedro Mesquita
content_hash: ee79d47d3ee98d30fef1fde72e2100654f6c4b1529780a0c26c9995131530155
---

# FRD: v1 scope — deferred decisions closed

## Summary
The user closed the deferred decisions that set the v1 scope. v1 is for the user and possibly the user's brother as a tester. It includes consent-gated Sentry, a visible-only rename to Ragnarok, a simple unsigned Windows installer with a licence check before the first installer, both billing modes in C2, dialogue phase 2, and the bundled-tool update control. Hostile-repository isolation (ISOL-1) stays deferred while only trusted repositories are used.

## Problem & Intent
The user chose "Fechar o âmbito do v1": to know exactly what enters and what stays out of the version they will use. v1 means "para mim, e talvez peça ao meu irmão para testar".

## Goals
- Every deferred decision that changes the v1 scope has a recorded answer.
- The roadmap, ADRs and issues can be updated from these decisions without guessing.

## Non-Goals
- The #101 agent-runtime choice (its own decision).
- Visual design answers for the open visual items: they go to a session with the ui-ux agent (#121).
- Evaluation task and success-criterion details (#125), decided when v1 acceptance is reached.
- Public release concerns: Anthropic's written confirmation, trademark, full licence audit, code signing, auto-update, Rive paid plan (#103).

## Functional Requirements
1. v1 SHALL include consent-gated Sentry: a consent screen, a persisted consent record (ADR 0006 diagnostic-consent tables), and a provisioned Sentry project and DSN. Sentry SHALL stay off until the user consents and SHALL send only sanitised events (no prompts, source, model output, secrets, environment values or full local paths; AGENTS.md Safety And Privacy).
2. v1 SHALL change the visible identity to Ragnarok: executable and product name, the `userData` folder (`%APPDATA%\Ragnarok`), the Windows AppUserModelId and window titles. On first launch under the new name the app SHALL copy the old `%APPDATA%\SlopStop` folder with verification and keep the old folder intact.
3. Internal technical names (`slopstop.db`, `.slopstop-writer.lock`, `slopstop_runtime_*` tables, `@slopstop/*` packages, `window.slopstop`, `SLOPSTOP_*` variables) SHALL stay unchanged in v1.
4. v1 SHALL ship a simple Windows installer (for example Squirrel), unsigned and without auto-update.
5. An automatic licence check over dependencies and bundled tools SHALL pass before the first installer is distributed.
6. Agent dialogue SHALL stay pair-only: one recipient per message and two participants per dialogue. One agent MAY hold several dialogues at once (X⇄Y and X⇄Z), each with its own subject, limit and closing state.
7. The provisional default limit SHALL be 12 messages per agent per dialogue (was 6 in ADR 0021), visible and editable in the Project profile.
8. Dialogue phase 2 (cross-Waypoint, Forgers coordinated by the Supervisor, Supervisor coordination budget approved by the user, with Settings and Project-profile surfaces) SHALL be in v1.
9. Each agent message SHALL carry a mandatory closing-state field in a fixed format that the app validates. A message with a missing or invalid field SHALL be refused. The app SHALL NOT infer the closing state from free text.
10. C2 SHALL deliver both billing modes, subscription (unmodified official CLI under the user's own login) and API, with one active at a time and no automatic switching (ADR 0009 Amendment 1).
11. Models SHALL start from one default model chosen at first install, with overrides per role and per task (model and effort) in Settings.
12. Bundled quality tools SHALL be pinned per Ragnarok release. An "Update" control SHALL install only versions tested with that release, show what changed, run a self-check and allow rollback.
13. The Supervisor SHALL propose an architecture review, with scope and estimated cost, when a Strand completes. The user MAY request one at any time, and the user approves or declines.
14. The Project profile SHALL expose four groups of settings: default lane; review rounds and dialogue limits (rounds 2, messages 12, budget warning 80%); the test-discipline exception; model and effort per role.

## Non-Functional Requirements
- **Performance**: no specific constraint.
- **Security**: v1 admits only trusted repositories, with the current warning; ISOL-1 is mandatory before untrusted repositories or a public release. Sentry consent is explicit and off by default. Credentials stay in Electron `safeStorage`.
- **UX / Accessibility**: accessibility is an acceptance criterion of every slice from the React port onward (roadmap phase 3). Open visual items go through the ui-ux agent (#121).
- **Reliability**: the `userData` move never deletes the old folder. A failed copy keeps the app on a visible diagnostic, never silently empty (degrade-distinguishes-broken).

## Constraints & Assumptions
- The code facts come from the 2026-10-10 probe:
  - Sentry is wired only behind `SLOPSTOP_SENTRY_CONSENT` and `SLOPSTOP_SENTRY_DSN` (`apps/desktop/src/main/crash-reporting.ts:91-106`), with no consent record.
  - `userData` derives from `productName` (`apps/desktop/package.json:5`).
  - Forge has `makers: []` (`apps/desktop/forge.config.ts:30`).
  - Git runs with a clean environment in a kill-on-close job, but the local `.git/config` is still read (`apps/harness/src/registration/windows-version-child.ts:212-245`).
  - There is no provider SDK and no `safeStorage` use today.
- Both billing modes in C2 pull the governed-CLI process machinery (planned for Workers) forward into C2, so C2 grows.
- Dialogue phase 2 details (Runs at different epochs, approval of both amendments) are left to design.

## Acceptance Criteria
- [ ] `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md` reflects every decision here (phase placement updated, open items removed from section 3).
- [ ] ADR 0021 carries a dated note with the new message limit (12), the pair-only rule with several concurrent dialogues per agent, the agent-declared closing-state field, and phase 2 in v1.
- [ ] Issues #111, #113, #117, #121 and #125 carry a comment linking this FRD with the decision that affects them.
- [ ] Decisions log `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` records these decisions in a new section.

## Recommended Approach
Documentation and planning only. Update the roadmap, add ADR notes (0021 dialogue, 0009 billing modes in C2, 0001 identity and packaging), and comment on the affected issues. Implementation follows the roadmap phases through normal rpiv designs.

## Decisions

### Meaning of v1
**Question**: When you say v1, which is it: only you, you plus a few testers, or public?
**Recommended**: n/a — `intent` question
**Chosen**: "para mim, e talvez peça ao meu irmão para testar"
**Rationale**: The user's own framing; it sets which public-release items stay out.

### Diagnostics in v1
**Question**: Sentry is wired but only behind two environment variables, with no consent screen; local logs work. For v1?
**Recommended**: Local logs only; consent and upload for a public version.
**Chosen**: Sentry with consent (consent screen, persisted choice, Sentry project with DSN).
**Rationale**: The user wants errors to reach them on their own when the brother tests; teach-back confirmed off-by-default and sanitised events.

### Technical rename in v1
**Question**: SlopStop appears in 590 places; renaming moves the data folder and database files. For v1?
**Recommended**: Keep SlopStop inside.
**Chosen**: Rename the visible part in v1.
**Rationale**: The user wants the identity changed in v1.
**Challenged**: Renaming internal files, tables and packages needs a risky database migration of real Projects for no visible gain. Alternative offered: visible part only (executable, folder with a safe copy, AppUserModelId, titles). Final call: visible part only.

### ISOL-1 for trusted repositories
**Question**: If only you and your brother use your own repositories, does ISOL-1 come before v1?
**Recommended**: Defer; trusted repositories only.
**Chosen**: Defer; trusted repositories only, with the current warning.
**Rationale**: Hostile repositories are not part of the v1 use; ISOL-1 stays mandatory before untrusted repositories or a public release (#111).

### Installation for the tester
**Question**: There is no installer, signing or auto-update today. For your brother to test?
**Recommended**: A zip of the packaged app.
**Chosen**: A simple Windows installer, unsigned, without auto-update.
**Rationale**: The user prefers a proper installer for the tester.

### Dialogue limits and shape
**Question**: Is communication in phase 1 always in pairs? (follow-up from the user)
**Recommended**: Keep pairs (ADR 0021).
**Chosen**: Pairs only; the default limit rises from 6 to 12 messages per agent per dialogue; one agent may hold several pair dialogues at once.
**Rationale**: The user's words: "o limite de mensagens tem que subir para 12, 6 parece-me baixo. mantém só pares."

### Dialogue phase 2 in v1
**Question**: Is cross-Waypoint coordination by the Supervisor (phase 2) in v1? (asked after an explanation with a MaxReps example)
**Recommended**: After v1.
**Chosen**: In v1.
**Rationale**: The user's choice after the explanation of the difference between phase 1 and phase 2.

### Closing state of a dialogue
**Question**: Who produces the closing state?
**Recommended**: The agent declares it in a mandatory field; the app validates.
**Chosen**: The agent declares it; the app validates.
**Rationale**: Reliable and costs no extra calls.

### Billing mode for C2
**Question**: Which mode does C2 start with?
**Recommended**: Subscription from the start.
**Chosen**: Both modes in C2, one active at a time.
**Rationale**: The user wants both options available from the first model-backed version; teach-back confirmed that C2 grows.

### Default and per-role models
**Question**: Which model does each role use after install?
**Recommended**: One default model plus overrides per role.
**Chosen**: One default model chosen at first install, plus overrides per role and per task (model and effort).
**Rationale**: Matches the rpiv-method FRD decision ("a primeira vez que instalo … escolho o modelo … vou poder mudar, para cada coisa, o modelo e o nível de esforço").

### Bundled quality tools update
**Question**: How do the bundled tools update in v1?
**Recommended**: Tested versions, with an Update button and rollback.
**Chosen**: Tested versions, with an Update button and rollback.
**Rationale**: Safe; tool changes cannot break the gates unannounced.

### Architecture review trigger
**Question**: When does the periodic architecture review happen?
**Recommended**: At the end of each Strand, plus on request.
**Chosen**: At the end of each Strand, plus on request.
**Rationale**: It ties the review to a meaningful milestone; the user approves each one.

### Project profile options
**Question**: Which options can be adjusted per Project in v1?
**Recommended**: n/a (multi-select).
**Chosen**: All four: default lane; review rounds and dialogue limits; test discipline; models per role.
**Rationale**: The user's selection.

### Licence check
**Question**: When does a licence check enter the gates?
**Recommended**: Before the installer for your brother.
**Chosen**: Before the first installer is distributed.
**Rationale**: Bundled third-party tools are redistributed in the installer.

### Open visual items
**Question**: How do we close the open visual items?
**Recommended**: A session with the ui-ux agent.
**Chosen**: A session with the ui-ux agent (#121) before the React port; all items are in v1.
**Rationale**: Visual choices need visual proposals.

### Rive paid plan
**Question**: When do we pay for Rive (watermark removal)?
**Recommended**: Only before a public version.
**Chosen**: Only before a public version.
**Rationale**: The watermark is acceptable for the user and the tester.

### Evaluation protocol and product thesis
**Question**: Are the evaluation protocol and the product-thesis consequences part of v1 acceptance?
**Recommended**: Yes, in v1 acceptance.
**Chosen**: Yes, in v1 acceptance; tasks and criterion are decided in #125 at that point.
**Rationale**: v1 acceptance should include the comparison with the manual baseline.

## Open Questions
- #101 agent runtime (AI SDK vs Mastra), deliberately outside this interview.
- Dialogue phase 2 mechanics across Runs at different epochs and budgets, and approval of both amendments: for design.
- "Agents pause at 100%" (DL:320) stays a design input for the Runs work.

## Suggested Follow-ups
- Both billing modes in C2 move the governed-CLI process machinery from the Runs phase into C2. The roadmap phases 4-5 need re-sequencing.
- ADR 0001 says installers and signing are deferred (ADR 0001:98). A simple unsigned installer in v1 needs an amendment note.
- ADR 0021 provisional defaults table (6 messages) needs the new value of 12 and the phase-2-in-v1 note.

## Glossary
- **v1**: the version the user uses personally, possibly with the user's brother as a tester; not a public release.
- **Visible rename**: the executable, product name, data folder, Windows identifier and titles become Ragnarok; internal file, table and package names stay SlopStop.
- **ISOL-1**: protection against a malicious repository (hostile Git config, network access) before untrusted repositories are opened.
- **Phase 1 / phase 2 dialogue**: phase 1 is pair dialogue between agents of one Run under its Forger; phase 2 is coordination between Runs of different Waypoints through the Supervisor.
- **Closing state**: agreement, no-agreement or needs-human, declared by each agent to end a dialogue.
- **Billing modes**: subscription (official CLI with the user's own login, usage from the user's plan) or API (pay per use with a key).
- **Lane**: the rigor level of the rpiv method for a piece of work (fast, normal, rigorous).

## Shared Understanding
The teach-back restated every decision in a table, plus four residual points. The user answered "Está certo como está":
- Sentry is off until consent and sends only sanitised events.
- The data-folder move copies with verification and keeps the old folder.
- C2 grows because both modes need the governed-CLI machinery.
- Phase 2 details are left to design.

Nothing was corrected during the teach-back. One choice was challenged during the interview: the full technical rename was narrowed to the visible part.

## References
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md` (input)
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §21, §25, §27, §30
- `.rpiv/artifacts/discover/2026-10-09_18-03-55_agent-coordination-and-dialogue.md`, `.rpiv/artifacts/discover/2026-10-09_18-03-55_rpiv-method-in-ragnarok.md`
- `docs/adr/0001-repository-foundation.md`, `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md`, `docs/adr/0021-supervisor-forger-and-mediated-agent-dialogue.md`
- GitHub #99, #100, #101, #103, #111, #113, #117, #121, #125
