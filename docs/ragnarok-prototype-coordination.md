# Ragnarok Prototype Coordination

Started: 2026-09-12. Status: Conversation-first sequencing approved; next-slice RPIV design in progress.

## Outcome

Build towards a usable Ragnarok prototype through small, evidence-backed RPIV deliveries. The central product hypothesis is mutual understanding: the developer understands what the model proposes to do, the model demonstrates understanding of the intended outcome, and progress and uncertainty remain inspectable during work.

The coordinator proactively investigates, recommends priorities and improvements, coordinates agents, and supervises results with the developer. The developer refines the experience through use and retains final decisions. Existing ADRs, accepted contracts and GitHub decisions remain authoritative; a proposed change requires concrete evidence, consequences and an explicit decision before implementation relies on it.

This document records coordination and sequencing, not a replacement behavioral contract or blanket build/integration authorization.

## Agreed Working Cycle

- Use RPIV discovery, research and design as needed to establish the next behavior. Use a scheduling plan when dependencies justify it; refine later slices just in time.
- Implement approved slices with prospective Red, Green and a separate review/refactor gate. Apply repository-required checks, including SonarQube and CodeScene; unavailable or failed checks remain explicit.
- At the end of implementing a complete plan, run `rpiv-validate`, then `rpiv-deep-review`. Corrections require affected validation and review before closure.
- Run `rpiv-architectural-review` periodically across the project, especially after substantial integrated milestones or evidence of accumulating structural problems. It is not a mandatory repeat on every slice.
- Human intent approval, bounded build authorization, candidate acceptance and integration authorization remain distinct under the RPIV candidate workflow.
- Coordinate independent sessions through the local Herdr CLI. Research sessions are read-only. Parallel implementation requires agreed isolated workspaces, owned paths and stable shared contracts. A worktree is not a security sandbox.
- Keep durable findings, contracts, evidence and handoffs in the repository. Rediscover live Herdr state on resume; pane IDs and agent names are operational handles, not durable product identities.

## Product And UX Direction

`PRODUCT.md` owns the official Ragnarok name and provisional visual identity; `CONTEXT.md` owns domain vocabulary. Technical SlopStop identifiers remain until a separately scoped rename.

Design and test the first functional UI/UX journey alongside Board contract preparation, before real Conversation/Frame implementation. Reuse accepted prototype learning while allowing substantial changes based on use. The name informs exploration without selecting a mythology or visual treatment automatically. Accessibility and clear failure states accompany every delivered surface.

The agreed near-term direction is minimal durable Conversation, then a real model, then incremental Frame acceptance. Provider-call authority, credential handling and interruption semantics need their own explicit contract; Execution invocation records cannot be assumed to belong to Conversation.

## Rolling Milestones

| Milestone | Outcome | Current classification |
| --- | --- | --- |
| Writer foundation | Canonical command settlement and ownership supported by real package proof | Integrated into local main; retained closeout qualifications below |
| First usable Conversation | Open a Project, retain a conversation across restart, then talk to one real model | Approved next implementation direction; behavioral contracts pending |
| Frame and map | Review understanding and explicitly accept decisions/plans that create canonical map content | Agreed direction; incremental scope pending |
| Board foundation | Small canonical admission and durable read-position behavior using real Waypoint sources | Follows Conversation and accepted Frame/Waypoint owners; contract preparation can proceed earlier |
| Bounded execution | Supervise one bounded task and inspect results and proof | Later milestone; not build-authorized by this map |
| Resilient prototype | Exercise interruption/recovery and the integrated packaged journey | Later milestone; acceptance criteria still to refine |

The Project's primary conversation does not enter Board. Board references require a Waypoint and a real owned source. The next design must resolve these dependencies rather than invent production fixture identities or bypass Frame acceptance.

`C:/Users/pedro/Documents/GitHub/chess` is the developer's proposed early trial project. It has not been inspected by this coordination work. It does not replace the accepted MaxReps v1 proof scenario without a separate decision.

## Starting Baseline

- Repository: `C:/Users/pedro/Documents/GitHub/slopstop`.
- Local branch: `main`, HEAD `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, seven commits ahead of the locally recorded `origin/main`. No fetch/push/integration performed by this coordination step.
- Intentional existing edits: `PRODUCT.md`, `CONTEXT.md`, `README.md` contain the Ragnarok naming decision. Preserve them; a new worktree would not automatically inherit them.
- Writer evidence: `.rpiv/artifacts/evidence/2026-09-10_canonical-project-writer-s7.md`, especially the final practical review and package renewal section. It records final Windows and Linux package success after the fractional wait-timer correction. It explicitly preserves the historical literal deep-gate failure and failed Sonar requests; these are not relabelled as passing checks.
- GitHub issue `#90` remains open and describes design-only work with unchecked acceptance criteria. Tracker wording is behind local implementation and requires an evidence-grounded update; it is not implementation authority.
- No new application behavior, worktree, commit or GitHub mutation is authorized by this baseline record alone.

## Initial Herdr Dispatch

| Agent | Session | Pane | Bounded assignment |
| --- | --- | --- | --- |
| `board-research` | `ses_f68875b54ffeDVZaK51r1OKV0O` | `w3:p9` | Read-only Board ownership, prerequisites and smallest public behavior |
| `ux-research` | `ses_f68872163ffeAgBFLPEoH2M7mb` | `w3:pA` | Read-only accepted prototype reuse and first Conversation/Frame journey |

Both agents were instructed to avoid file edits, tests/builds, installs, Git/GitHub writes and nested agents. Returned recommendations require coordinator verification before becoming proposed contracts.

## Verified Initial Findings And Accepted Adjustment

- `apps/harness/src/storage/canonical-schema.ts` currently declares Storage/Project identity, writer ownership and command settlement tables, not real Feature/Waypoint, Conversation or Board owners. `apps/harness/src/process-bootstrap.ts:97` registers no production domain commands, and line 113 composes unavailable Workspace owners.
- ADR 0004:13-17 requires every Board entry to reference a Waypoint-owned message or an Execution event. The primary Project conversation is excluded. ADR 0006:78 requires actual accepted Feature membership for a Waypoint; syntactically valid UUIDs cannot substitute for those owners.
- ADR 0006:57 and 97 explicitly support durable Conversation outside canonical command sequence and acceptance authority. No reviewed dependency requires the primary Project conversation to wait for Board implementation.
- UX investigation found that the accepted prototype provides reusable navigation and interaction structure, but its responses and Frame acceptance remain fixtures. See `apps/desktop/src/renderer/prototype/prototype-app.tsx:192-243` and `.rpiv/artifacts/validation/2026-08-25_23-26-11_workspace-supervision-prototype.md:12-19`. This is the investigating agent's source-grounded report, not a new browser or runtime verification.
- The Board investigator first recommended conformance-only Board to retain #85's order. After the coordinator challenged the technical dependency, the same session explicitly confirmed that this was a scheduling choice, not a requirement, and recommended Conversation-first for earlier user value.

**Developer-approved sequencing, 2026-09-12:** in response to the coordinator's explicit question about changing #85 to Conversation-first, the developer answered “aprovo”. Prepare Board ownership/contracts alongside UX research, but implement the primary Project Conversation first; introduce a real model after minimal persistence, then accepted Frame/Feature/Waypoint behavior, then production Board admission from real Waypoint sources. This supersedes #85's earlier Board-first delivery order without changing Board ownership or canonical-acceptance semantics. The rejected scheduling alternative was conformance-only Board first, delaying production utility. This approval authorizes next-slice design; detailed behavior, candidate build workspace and integration still follow RPIV's separate decisions.

The first proposed user-visible milestone is writing in a Project conversation and retrieving the same messages after reopening the application. Model responses, Frame acceptance and map creation follow separate approved slices. The initial UX retains the provisional composition and tests understanding/correction/return flows before committing to a final visual identity.

## Immediate Decisions And Follow-Up

- Design the first persistent Project Conversation slice under the approved Conversation-first sequence.
- Define the smallest UI/UX experiment that exposes real user understanding rather than merely demonstrating fixture navigation.
- Before candidate builds, agree the exact slice, starting revision, branch/workspace and handling of uncommitted product-identity documents.
- Keep writer proof qualifications visible; determine whether any missing closure evidence affects the next behavior rather than silently waiving or automatically repeating every historic check.
- Update the GitHub frontier only with accurate links to accepted design and observed implementation evidence.

## Conversation-First Design Checkpoint

The approved sequence is now recorded in the live body of [#85](https://github.com/TheMastermindPT/slopstop/issues/85). No issue was closed and no push or commit was performed.

The same two Herdr sessions completed a second read-only investigation. The next draft is `.rpiv/artifacts/designs/2026-09-12_22-45-37_persistent-project-conversation.md` (`in-progress`, not build-ready). Existing submission requires a Context proposal and reports forwarding rather than durable acceptance; local save needs a distinct truthful contract. Real Project entry, safe noncanonical Conversation writes and schema evolution also require explicit ownership.

The developer approved new Ragnarok Projects first on 2026-09-12 (“sim”, followed by confirmation of the coordinator's restatement). Older local data stays preserved in migration-required safe mode until explicit migration exists. Existing Git repositories can be registered; this decision never permits deleting, resetting, overwriting or silently replacing old local Project state or repository content. Initial migration scope is settled; Project entry and protected Conversation writes are the remaining next-slice design work.

The draft's explicit read-only artifact validator passed. Automatic write hooks still time out; this successful direct validation is not an intent review or a passed implementation gate.

### Registration identity decision — 2026-09-12

The developer approved the coordinator's recommendation that linked Git worktrees sharing a local Git common directory belong to one Ragnarok Project. They share Project conversation, decisions and map; their physical locations and changes remain separate. Independent clones are not automatically associated based on remote URL or equal contents. This fixes duplicate-registration behavior without replacing opaque domain identities with filesystem paths. The decision is owned by the current Conversation design's “Accepted registration identity: linked worktrees” section.

### Technical stabilization checkpoint

The draft now specifies the additive shared installation-registry compatibility path and proposed PC-S1 behavioral oracles. Filesystem-only parsing was a coordinator suggestion, not a developer requirement; investigation showed compatibility restrictions and parser/native-identity complexity. On 2026-09-12 the developer approved using installed trusted Git for a closed local read-only registration observation instead. Exact trust, arguments, bounds and lifecycle remain technical contract work; approval is not a generic subprocess exemption. See the design's “Accepted architectural direction: registration observer admission”.

The repository-registration identity decision remains accepted. Whole-intent independent review has not been dispatched while the observer contract is unresolved; no review pass or build authority is claimed. Both research sessions completed and remain idle. Raw filesystem size samples do not establish measured runtime limits.

## References

- `../PRODUCT.md`
- `../CONTEXT.md`
- `adr/0004-canonical-board-index.md`
- `adr/0006-physical-persistence-layout.md`
- [Trust spine delivery #85](https://github.com/TheMastermindPT/slopstop/issues/85)
- [Writer design #90](https://github.com/TheMastermindPT/slopstop/issues/90)
- [v1 roadmap #1](https://github.com/TheMastermindPT/slopstop/issues/1)
- `../.rpiv/artifacts/README.md`
