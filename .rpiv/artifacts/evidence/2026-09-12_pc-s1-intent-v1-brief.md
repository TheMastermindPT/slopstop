---
date: 2026-09-12T22:45:37+0100
author: Pedro Mesquita
commit: 97678d2
branch: main
repository: slopstop
topic: "Persistent primary Project Conversation"
tags: [design, conversation, workspace, persistence, ragnarok]
status: in-review
last_updated: 2026-09-12T23:17:37+0100
last_updated_by: Pedro Mesquita
content_hash: 85e613dcb9850da6153ca90f2fb703db7e7a3bb7144a7a93895d4fc69ed34abf
---

# Persistent Primary Project Conversation

## Intent

Deliver the first useful Ragnarok Conversation increment: select a real Project, save a user message locally, close the application and recover the same conversation and messages on reopening. Show local persistence truthfully; no model response or model delivery is implied.

The developer approved Conversation-first sequencing after the coordinator explained Board's missing Waypoint/source prerequisites. This brief develops that direction. It is not yet approved architectural intent, a test contract, build authorization or a completed implementation.

The existing technical SlopStop identifiers remain. Product behavior follows `PRODUCT.md` and `CONTEXT.md`; model integration, Frame acceptance, canonical map creation and production Board follow later separately approved slices.

## Architecture

### Existing boundaries and gaps

- `apps/harness/src/process-bootstrap.ts:93-114` composes active Project coordination, an empty canonical domain-command registry and unavailable Workspace owners. Writer implementation alone does not supply Conversation behavior.
- `apps/desktop/src/preload/preload.ts:13-52` exposes narrow Workspace query/submission but no usable saved-Project list, native repository picker or Project activation surface. Adding those capabilities must retain the renderer boundary, rather than expose Storage operations or paths directly.
- `packages/protocol/src/project-storage-protocol.ts:126-145` creates/opens by Project identity, not repository location. Selecting a Git repository is a separate application concern; a generated UUID alone is not a real Project binding.
- ADR 0006:56-58 and 97 keep application Workspace identity separate from Run workspace and persist Conversation outside canonical command sequence, revisions and events. They forbid speculative tables for future owners.
- `packages/protocol/src/workspace-protocol.ts:130-153` can represent user-only messages with no Context record/proposal. Its existing submit intent at lines 393-400 instead requires a Context proposal, and the result at lines 602-609 reports forwarding rather than durable acceptance. The new local-save behavior needs an explicit contract, not a fabricated Context proposal or an interpretation of forwarding as saved.
- `apps/harness/src/active-project-coordinator.ts:582-605` currently guards canonical execution against active identity/access. Conversation needs equally protected admission and inclusion in Project switch/close draining without entering canonical settlement.
- `apps/harness/src/storage/project-storage-opening.ts:374-389` classifies known-older schema as `migration-required`. The current migration executor does not supply an approved forward-update workflow for existing Projects. A new table migration must not silently change this behavior.
- Initial Storage creation is already a distinct accepted bootstrap path, not a missing ADR 0013 Effect family. `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md:114-118` owns staged initial creation and conservative interruption handling. Reuse it; do not require the whole Evidence portfolio for registration.
- `application.db` is shared installation state. The approved safe-mode policy for old Project databases does not authorize breaking its existing registry: inspect and adapt known-version/head compatibility and pending migration behavior before adding registry structure (`apps/harness/src/storage/generated-migrations.ts:49-73`; `project-storage-node-adapters.ts:1356-1409`).

### Proposed ownership

- Desktop main owns native folder selection and returns only the narrow result required by the application contract. Harness-owned identity/registry logic establishes and resolves saved Project bindings; repository and Storage authorities stay distinct.
- The Application coordinator admits Project-scoped Conversation work under the active session, closes admission on switch/close and drains already admitted work. Internal transaction fencing must reject stale ownership before writes.
- A Conversation owner persists message identity, ordering and save outcomes independently of canonical receipts and Project sequence. Exact retry must return the original save result; an uncertain commit requires direct reconciliation against its own durable identity rather than automatic resubmission with a new identity.
- Workspace projections expose confirmed messages and explicit failure/conflict states through the existing validated transport. Neither the renderer nor a projection may allocate trusted persisted state itself.

These responsibilities are proposals pending the next-slice contract and review. No generic SQL port, writer token, physical Storage path or unrestricted repository API is proposed for the renderer.

### Proposed Project-entry transaction boundary

PC-S1 adds a Project-registration owner, not a generic repository service. Native selection is passed internally to a bounded identity observer. The original filesystem-only proposal is reopened below: it was a design suggestion, not an accepted user prohibition on subprocesses. Both candidate approaches must verify the working tree/common-directory association without enumerating source content, accessing credentials, executing repository hooks or mutating the repository. Physical identity semantics and finite observation limits must be pinned before intent stabilization; malformed, unsupported, inaccessible, exhausted and changing input remain distinct refusals. Detached HEAD and an unborn branch are not automatically invalid repositories.

An immutable registration proposal separates inspection from the user's confirmation. Confirmation revalidates the administrative identity and uses a durable registration request identity plus fingerprint. A registry transaction reserves the common-directory identity and stable Project/binding/Storage-create identities before initial creation. Uniqueness must hold across concurrent processes, not only an in-memory lock. No one transaction is assumed to cover registry rows, Project rows and physical generation publication.

Initial binding/workspace records are created by the accepted fresh-generation bootstrap before sealing. Subsequent canonical association changes use current writer authority; they cannot be made as lateral registry or Conversation writes. Installation-local locations remain separate from canonical binding identity. A repeated selection of another linked worktree resolves the existing Project; if writer authority is unavailable for a required association change, return a truthful read-only/blocked result rather than create another Project.

The existing staged Storage creation is reused with its original interruption semantics. An incomplete registration retains reserved identities and prior-state witnesses. A lost response is resolved through the original request; only a proved published result returns registered. PC-S1 does not automatically complete, discard or restart uncertain creation. The new reservation must be recognized as the exact authorized predecessor to initial creation without bypassing unrelated witness checks.

The shared installation registry requires explicit known-old-schema compatibility and transactional migration before normal current-schema validation. This is not migration of old Project generations: those remain in safe mode as approved. Unknown/newer/corrupt registry state cannot be reset or mistaken for an empty installation.

### Installation registry compatibility contract

Preserve application `formatVersion: 1` and `schemaVersion: 1`, adding one generated migration head `0001_project_registration` after immutable `0000_gray_eddie_brock`. The head identifies the supported additive schema. The existing specification at `project-storage-database-specs.ts:802-815` contains exactly `schema_metadata`, `storage_generations`, `storage_locations` and `storage_registrations`; retain an independent exact old specification including columns, defaults, keys, checks, indexes and foreign keys, with no extra triggers/views/objects permitted.

Before list/register/select, the compatibility owner checks normal-file and prior-state-witness conditions, opens a write transaction and rereads metadata under that cross-process lock. For the exact previous head it validates the complete previous schema, foreign keys, integrity and existing registry relationships, applies only the additive migration, advances metadata, and validates the complete current schema before commit. For the current head it validates the current schema and performs no DDL. Unknown/newer/contradictory or corrupt inputs retain distinct failures with no mutation. Missing bytes with witnesses never authorize a fresh registry.

Use the existing transaction executor without nesting the generated migrator's transaction. Preserve every value in existing rows; new registration-specific rows are created only for actual requests, not synthesized for old Projects. SQLite write exclusion must span validation through final validation/commit so another process checks the head again after acquiring the lock. Contention is an explicit retryable unavailable result, never an empty list or an unlocked bypass.

Failure before commit rolls back the entire additive change. An uncertain commit closes the uncertain client and reopens for exact head/schema classification; never assume rollback or blindly repeat DDL. Supported old and current registry states remain distinguishable from partial/corrupt state. This operation does not open, rewrite, migrate or reseal any Project database or manifest. The existing current-spec checks remain unchanged outside this explicit compatibility entry.

New tables own immutable proposals, idempotent request outcomes, common-directory reservations and private location observations. Reservations bind the allocated Project, canonical Repository binding, initial Workspace and original Storage-create identities. Canonical bindings and Workspace rows live in the new Project database with real composite keys, initialized before generation sealing. Adding a later worktree association requires current writer settlement; the corresponding installation location remains pending until exact canonical association is verified. No cross-database foreign key or atomicity is claimed.

Proposed narrow operations are preparation, confirmation, saved-Project listing and selection. Their final schema names are not yet fixed. Preparation grants no repository mutation authority; registration and activation remain separate results, and the list includes incomplete/unavailable entries instead of hiding them.

## Decisions

### Inherited and settled

- **Conversation-first schedule:** approved by the developer's “aprovo” on 2026-09-12 after the explicit #85 sequencing question. Board contracts may be prepared earlier; production Board follows real Waypoint sources.
- **Local persistence before model calls:** inherited from the agreed prototype sequence. No dummy assistant reply or Context record is introduced for the initial increment.
- **Primary Project scope:** the first conversation belongs to the Project, not a fabricated Waypoint. ADR 0004:14 excludes it from Board.
- **Durability is not canonical acceptance:** ADR 0006:57 remains binding. Saving a message creates neither an Accepted Frame revision nor a Feature/Waypoint.
- **Incremental UX:** reuse the accepted provisional composition where appropriate; final identity remains open. Test the real journey and refine through developer use.
- **Plan closure:** `rpiv-validate` then `rpiv-deep-review` after implementation of the whole plan; periodic architectural review remains separate. Per-slice TDD and independent review gates still apply.

### Proposed product behavior

- Use explicit local-save semantics such as “Save locally”, with a visible explanation that no model is connected in this increment. Clear saved status only follows durable acknowledgment, not submission transport success.
- Keep authored text recoverable in the current UI while a save is pending or failed. Do not automatically claim that an unsubmitted composer draft survives an application restart; draft durability is a separate scope decision.
- Provide a narrow real Project entry path instead of requiring users to type opaque IDs or selecting fixture Projects. Exact repository-binding and duplicate-selection behavior needs further contract work.

### Accepted initial data compatibility

The developer approved new Ragnarok Projects first on 2026-09-12: answered “sim” to the explicit new-Projects-versus-migration question and then confirmed continuation after the coordinator restated the decision. An existing Git repository may be registered as a new Ragnarok Project; this does not create, erase or reinitialize that repository.

The initial schema-bearing increment does not implement forward migration of older local Project generations. Preserve their identity and bytes and expose known-older schemas as `migration-required` safe mode. Do not replace old state with defaults, reuse an existing registration to create fresh state, or treat this approval as permission to delete/reset data. Other missing, corrupt, unknown or newer-version states retain their own diagnostics. Explicit migration remains later work under the Storage lifecycle ADRs.

## Next Slice

- Proposed `slice_id`: `PC-S1`.
- Proposed candidate outcome: add an existing Git working tree as a saved Project, list and select it through the real application, and recover the same association after restart. This prerequisite does not claim delivered Conversation or completed onboarding.
- The next Conversation slice follows this real entry seam and adds local save/reopen. This split is proposed for intent approval; later milestones retain the accepted Conversation-first outcome.
- Likely affected owners for PC-S1: Project-entry protocol, harness Project identity/registry coordination, existing staged Storage creation and active-Project lifecycle, desktop main/preload narrow entry surface and renderer Projects list/summary. Conversation tables and local-message handlers belong to the following slice, not empty prerequisite migrations.
- Existing public proof seams: harness runtime through transport; renderer through preload in a real Electron launch. Unit/contract tests remain beside source; adapter integration and Electron journeys use their established locations.
- Build workspace and source-write authority are not yet agreed. Local main includes intentional uncommitted product-identity documents that a new worktree would not inherit automatically.

### Proposed PC-S1 user journey

1. Open Projects and select “Add existing repository”. Desktop main presents the native folder selector; cancellation returns focus without registration or changing the active Project.
2. Validate the selected existing non-bare Git working tree using a specifically admitted read-only observer. No initialization, checkout, reset, hooks, scripts, network or repository mutation occurs. The proposed Git-executable approach requires explicit observer admission as described below; read-only intent alone is not process admission.
3. Confirm registration. Repeated selection resolves an existing association rather than allocating duplicate local state. Preserve the request identity across uncertain responses; partial creation follows the existing recovery-required behavior, not automatic recreation.
4. Show the saved Project and its actual access/health, with preparation visibly incomplete and Conversation unavailable until its owner is delivered. Do not substitute a fixture conversation or canonical map.
5. After restart, choose the same entry and revalidate its association and Storage before activation. Missing location, read denial, invalid Git structure, writer contention and old-schema safe mode remain distinct; a failed list operation does not become an empty list.

### Accepted registration identity: linked worktrees

ADR 0015:21-27 distinguishes domain identity, Git common-directory administration and individual worktree resources, but does not select the uniqueness policy for Project registration. The current registry keys do not settle it either.

The developer approved the coordinator's recommended rule on 2026-09-12: two linked worktrees sharing one local Git common directory select one Ragnarok Project, sharing its Project conversation, decisions and map while keeping physical locations and changes distinct. A separate clone is not automatically the same Project merely because its remote URL or content matches. The alternative of independent Projects for each linked worktree was not selected. Relocation/reassociation is deferred rather than inferred from similar paths or contents. Git administration is an input to registration matching, not the durable Project ID.

### Accepted architectural direction: registration observer admission

The filesystem-only suggestion expands into a restricted Git config/ref/layout parser plus cross-platform physical-identity handling. Independent research identified valid configurations that a deliberately small parser would refuse (including extensions, relative-worktree administration, includes and alternate Git layouts). A generic INI parser does not provide equivalent Git semantics. This implementation cost and compatibility limitation were not implied by the approved user journey.

The developer approved using an installed trusted Git executable through one application-owned registration observer on 2026-09-12 (“ok” in response to the explicit Git-executable-versus-own-parser question). This is not a generic shell/tool endpoint or an Execution Run. Its contract must fix attributed registration request identity, exact executable trust/version resolution without download, a closed argument vocabulary with no shell interpolation, controlled environment/configuration, no network/credential/hook/repository-writing operation, bounded output/runtime, actual child ownership/cancellation and explicit interruption/failure states. An observation may locate a Project; it does not confer mutation authority or independent Evidence-family authority.

The approved direction requires an explicit narrow admission contract before build. PRODUCT.md's deterministic-owner allowance and the read-only onboarding requirement are not a general process exemption. ADR 0008 retains ownership of Execution Process jobs; ADR 0013 retains its closed Effect subjects and effectful operation rules. This user-initiated registration observer is an application-owned diagnostic operation with bounded child ownership and an attributed observation result, not an Execution Process job, Effect-family evaluation or model-visible tool. Its explicit allowance applies only to the reviewed closed identity queries; any additional effectful command requires its own applicable authority. Initial Storage creation remains under its separately accepted bootstrap contract.

The alternative is to retain filesystem-only observation with an explicitly restricted supported Git grammar and verified physical-identity adapter. This has not been selected as a permanent product requirement. Candidate byte/count limits from the research are suggestions, not accepted constants: the agent observed one local config of 800 bytes and three administrative worktree records but performed no timing calibration. The suggested two-second deadline is not adopted or represented as measured. Whichever approach is accepted requires finite bounds and tests pinned to the actual contract.

### Registration Git observer policy v1 — proposed for intent review

The earlier filesystem-parser limits and uncalibrated deadline suggestion are superseded by this policy. The selected approach delegates Git interpretation to an installed executable while retaining application-owned admission and result validation.

- Resolve a machine-configured absolute Git executable outside the selected repository, never through repository-influenced PATH/current-directory search. First-use UI identifies the executable and version for explicit confirmation. Do not download, install, upgrade, follow an unverified executable replacement or infer trust from a filename. Record executable physical identity and digest and revalidate before every child; changed/unavailable executable invalidates the observation and requires renewed selection. Platform support must prove the physical identity adapter rather than substitute lowercase paths for file identity.
- Spawn with no shell, closed stdin and the exact selected root as cwd. One executable-version call uses only `--version`. Each observation phase then has six sequential queries using this exact common prefix: `--no-pager --no-optional-locks -c core.fsmonitor=false -c maintenance.auto=false -c gc.auto=0 -c protocol.allow=never -c safe.directory= -c safe.bareRepository=explicit rev-parse`.
- The six allowed suffixes are respectively `--is-inside-work-tree`, `--is-bare-repository`, `--is-inside-git-dir`, `--path-format=absolute --show-toplevel`, `--absolute-git-dir`, and `--path-format=absolute --git-common-dir`. No repository text or model input selects arguments. Version/capability incompatibility is explicit and never retries with weaker flags.
- Boolean results must be exactly true/false/false in that order. Path results must be single absolute UTF-8 paths with exactly one terminal LF or CRLF and no interior CR/LF/NUL. Reject ambiguous encoding, overflow, extra lines and unrepresentable selected paths; never trim meaningful path spaces or guess escaping. Root must identify the selected physical directory, not a discovered ancestor. Git's administrative and common directory results remain distinct.
- Build a fresh environment: `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_SYSTEM` and `GIT_CONFIG_GLOBAL` point to the platform null device, `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, `GIT_NO_LAZY_FETCH=1`, `GIT_ALLOW_PROTOCOL` is empty, `GIT_PROTOCOL_FROM_USER=0`, `LC_ALL=C`, `LANG=C`. Supply only validated platform startup variables and installation/OS executable search directories; HOME/profile/XDG/temp locations are application-controlled. Do not inherit repository redirection, injected config, tracing, askpass, SSH, pager or dynamic-code-loading variables. Do not create trust exceptions such as `safe.directory=*`; an ownership refusal remains a refusal.
- **Configuration-read boundary:** these environment settings suppress global/system config, not local Git config includes. Official Git documentation permits includes outside the worktree. The registration UI must describe inspection as Git reading repository administration and effective local configuration; it must not promise filesystem confinement to `.git`. Configuration/diagnostic contents are not persisted, logged, sent to models or used to resolve credentials. No credential helper or network-capable operation is admitted. This boundary is a review risk and must be checked against the accepted no-credential-access requirement; if the reviewer finds explicit further approval or confinement necessary, readiness remains blocked rather than silently broadening authority.
- Provisional policy ceilings: at most six identity calls per phase, two phases per registration attempt (preparation and confirmation), plus one version check for that executable identity. Each child has a 2,000 ms observation deadline, each phase a 10,000 ms overall deadline, stdout and stderr each at most 8,192 bytes per child. No automatic retry or limit expansion. These are design headroom choices informed by the narrow sample below, not production benchmarks or guarantees.
- The observer owns each returned child and stream immediately. A deadline, cancellation, stream overflow, spawn/exit error or invalid response invalidates the whole phase, triggers bounded termination and retains uncertain cleanup explicitly. Exit alone is not EOF; capture terminal exit and closed streams independently. No late result may publish registration. While any owned child has unconfirmed termination, close observer admission rather than launch another attempt. Deadlines never grant writer authority, remove Git locks, release registration reservations or recreate uncertain Storage.
- Common-directory matching uses verified physical identity and location continuity under a platform-specific adapter, not remote/content identity. Revalidate selected root, administrative directory and common-directory identity across queries and again at confirmation/publication. A changed or unprovable association remains `changed`/`unsupported` rather than being registered. A replaced common directory at a previously registered location does not silently inherit the former Project or trigger fresh initialization.

Observed research sample: Git `2.53.0.windows.1` at a Program Files installation, 18 local identity calls (three per suffix) against this repository; all returned exit zero, durations 99.79–220.54 ms, stdout 5–46 bytes and empty stderr. The agent observed location/version, not executable-signature trust, Linux support or malicious-config safety. It ran one version query in addition. The coordinator retrieved current Context7 `/git/htmldocs` definitions for `rev-parse`, linked worktrees, config environment and includes. Implementing this policy still requires exact platform lifecycle, executable-identity and config-boundary proof; no runtime success is inferred from documentation.

## Test Contracts

The following are proposed behavioral contracts for PC-S1, not executed tests or approved build scope. They are submitted with the observer policy and registry compatibility contract for independent intent inspection. All names below are planned test files, not claims that files already exist. A reviewer finding that a policy, oracle or schema contract remains incomplete blocks readiness.

### Test Contract: PC-S1 Project registration and return

- **Behavior PC-B1 — Durable association:** confirming one valid existing working tree creates one saved Project that can be selected after a full application restart.
  - Seam: renderer through the narrow preload API in real Electron; registration owner through harness transport for deterministic storage assertions.
  - Test: `registers and reopens the same Project` → `apps/desktop/tests/e2e/project-registration.test.ts` and `apps/harness/tests/integration/project-registration.integration.test.ts`.
  - Oracle: start with an isolated empty installation and repository A; confirm its proposal, record returned Project/binding identity, restart with the same installation, list and select A. Exactly one registration appears with the same identities. Activation reflects actual writer access. No Conversation, Frame acceptance or onboarding completion is reported.
  - Expected red: current preload has no registration/list/select flow and production has no registration owner. After minimal typed seam scaffolding, the behavior remains unavailable instead of returning the persisted association.
- **Behavior PC-B2 — Worktree identity without clone conflation:** A and linked worktree B resolve to the same Project; independent clone C remains separate even when remote URL and contents match.
  - Seam: harness registration transport over real disposable Git administrative fixtures.
  - Test: `deduplicates linked worktrees without conflating clones` → `apps/harness/tests/integration/project-registration.integration.test.ts`.
  - Oracle: confirm A, B and C. There are exactly two Project identities: A/B share one and C owns the other. A/B locations remain distinct and B does not overwrite A's location. Repeating A returns its existing Project. None of these matches uses remote URL, branch or content equality as identity authority.
  - Expected red: current Storage registration is keyed by supplied Project/create-request identity, not Git administrative identity; the new public registration operation is absent.
- **Behavior PC-B3 — Durable request and concurrency:** duplicate requests cannot allocate multiple Projects for one observed common directory.
  - Seam: two independent harness processes against the same isolated installation, plus deterministic registration-owner failure injection through its public application port.
  - Test: `reserves one Project across competing registrations` → `apps/harness/tests/integration/project-registration.integration.test.ts`.
  - Oracle: concurrent confirmations for A reserve at most one Project/binding/Storage-create tuple. After the winning complete publication, both callers can resolve that same association; a caller that observes incomplete creation receives an explicit pending/recovery result, never a fabricated success. Reusing one request with changed target/payload produces a conflict without allocating another registration. Exact retry after restart returns the original proved result.
  - Expected red: current creation does not correlate the selected repository with a durable registration request or reserve common-directory identity.
- **Behavior PC-B4 — Selection is not creation authority:** cancelling or refusing a proposal preserves the existing active selection and all Project/Storage state.
  - Seam: real Electron preload/native-selector adapter plus registration transport.
  - Test: `cancels without registering or switching` → `apps/desktop/tests/e2e/project-registration.test.ts`.
  - Oracle: from Project P, cancel native selection and then decline a valid proposal in separate cases. P remains selected; no new Project or Storage generation exists, and keyboard focus returns to the invoking control. Inspection may retain its bounded proposal bookkeeping but cannot allocate Project/Storage authority.
  - Expected red: no real native selection/proposal/confirmation flow exists; fixture navigation cannot satisfy durable state assertions.
- **Behavior PC-B5 — Revalidation and truthful refusal:** invalid or changed Git administration never becomes a usable saved association.
  - Seam: filesystem identity observer through its public result and registration transport.
  - Test: `refuses invalid or changed repository observations` → `apps/harness/src/storage/repository-identity-observer.test.ts` and registration integration tests.
  - Oracle: missing folder, inaccessible metadata, non-Git folder, selected bare root, malformed administrative links, unsupported required format, exhausted policy and changed identity between proposal/confirmation each return their own closed failure classification; no successful registration is published. Valid detached/unborn repositories are positive controls. Exercise exact 8,192/8,193 byte outputs independently for stdout/stderr, terminal completion immediately before/at/after 2,000 ms, whole-phase completion before/at/after 10,000 ms, attempted seventh call, injected extra argv, invalid UTF-8, CR/LF/NUL inside paths and physically different returned roots. At a deadline equality timeout wins; at the byte ceiling valid complete input can pass, one extra byte cannot. Absent required Git options fail closed, not by dropping flags.
  - Expected red: the observer and its admitted proposal path do not exist; unavailable scaffolding fails the positive control, while a permissive stub fails the negative matrix.
- **Behavior PC-B6 — Initial creation interruption preserves truth:** a failure before complete publication cannot silently recreate, clean up or publish partial state.
  - Seam: registration application with existing staged Storage dependencies and real persistence integration.
  - Test: `retains incomplete registration after interruption` → `apps/harness/tests/integration/project-registration.integration.test.ts`.
  - Oracle: interrupt after registry reservation, during generation creation, after physical generation publication and before final registration acknowledgment in distinct cases. Restart and query the same request: return the same proved completed association or explicit incomplete/recovery-required state. Retain identities and witnesses; never allocate a replacement Project or delete uncertain data. Prove the result from persistent rows/manifests, not a mocked success flag.
  - Expected red: existing Storage creation has witness handling, but the new repository reservation/registration-result linkage does not exist. Existing Storage behavior is characterization, not new Red evidence.
- **Behavior PC-B7 — Opening preserves failures and ownership:** saved-Project listing and selection do not confuse missing paths, unavailable writers or storage faults with absence or healthy emptiness.
  - Seam: registration transport and real Electron renderer.
  - Test: `retains saved Projects with explicit unavailable access` → registration integration/Electron tests.
  - Oracle: remove A's selected location after registration; its list entry and identity remain with a missing-location reason. A separately held writer produces read-only access, not a second writer or corruption. Failed listing displays an error rather than zero Projects. Switching uses the existing coordinator's drain/release ordering; no stale selection authorizes a write.
  - Expected red: no saved-Project read model or renderer is wired; existing writer-contention/drain behavior is reused, not relabelled as new implementation.
- **Behavior PC-B8 — Installation compatibility without Project migration:** updating supported registry structure preserves old registrations and supports new registrations without migrating older Project generations.
  - Seam: registration bootstrap/open over real packaged migration resources and isolated previous-version database fixtures.
  - Test: `preserves old Projects while extending the installation registry` → `apps/harness/tests/integration/project-registration.integration.test.ts`.
  - Oracle: start with a valid exact supported previous registry and older Project P. Extend the registry through the scoped transactional path; P retains identity/data and its own migration-required safe-mode diagnosis. New Project Q can register normally. Two competing processes apply `0001_project_registration` at most once; both validate the committed current head. Capture every old row value and Project file/manifest byte before and after, proving equality. Unknown/newer/corrupt registry variants fail distinctly with no reset; inject failure before DDL, after DDL, before metadata advance and at commit acknowledgment to verify rollback or explicit reconciliation, never a published partial schema. Extra objects/columns or malformed old authority fail the exact old validator rather than entering a permissive migration path.
  - Expected red: current pre-migration inspection expects current registry structure and no registration extension exists. Existing known-older Project classification is a preserved baseline.
- **Behavior PC-B9 — Repository and renderer boundaries:** registration and re-opening perform no repository mutation or model activity.
  - Seam: real observer/registration integration and the renderer's exposed preload surface.
  - Test: `registers without mutating repository bytes or exposing authority` → registration integration/Electron tests.
  - Oracle: independently capture disposable repository content/administration before and after the complete register/list/reopen flow. Bytes and Git administrative content remain unchanged; instrumentation observes no network, hook or model invocation. Only the exact observer policy's Git executable/argv/environment and owned lifecycle may spawn; no shell or unrelated child is permitted. Test malicious PATH/GIT_DIR/GIT_CONFIG_COUNT/askpass/loader inputs, executable replacement, unsafe ownership, embedded-newline paths, local includes with sensitive canary values, stderr canaries and blocked child/EOF cleanup. No canary/config content may reach public diagnostics, logs, model input or durable observations. Record config include reads honestly; this test does not turn a non-sandboxed process into filesystem confinement. Public results expose no Storage path, SQL handle or writer token. Renderer cannot call Node/Electron or arbitrary path-reading APIs.
  - Expected red: the new public flow is absent. Existing renderer isolation remains characterization; the new registration capability must retain it.

### Success Criteria: PC-S1

- Observe behavioral Red through the agreed seams, not missing imports or unrelated setup failures; add only minimal interface scaffolding when necessary.
- Use focused Vitest selections for the new public contracts, then the configured harness integration suite and real Electron journey. Test command syntax and filenames must be confirmed against installed tooling before execution.
- Run affected protocol/harness/desktop typechecks and repository fast/boundary checks. Verify both bootstrap registry creation and supported registry extension using shipped migration resources. Include the package proof needed for the new main/preload/runtime path.
- Manual outcome: a real existing repository can be registered, its saved Project selected again after restart, and invalid/cancel/read-only states understood without a fabricated conversation. Keyboard operation and focus return are observable criteria.
- Required independent intent/candidate reviews and CodeScene/Sonar results remain separate from test execution. Full-plan closure remains Validate then Deep Review; PC-S1 is not the complete Conversation milestone.

The following Conversation contract must cover save/reopen identity and text preservation; retry without duplication; explicit revision conflict; uncertain-save reconciliation; no premature saved status; cross-Project and stale-activation rejection; switch/close draining; no canonical-sequence advance from message persistence; and no synthetic model response or acceptance authority.

## Deferred Work

- Real model integration: refine after local Conversation persistence. Requires credential security, exact context, explicit call/delivery and interruption semantics, attribution and visible failure behavior.
- Frame proposals, decision checkpoints and final acceptance: refine when persistent Conversation can support real reviewed content.
- Feature/Waypoint/map ownership and production Board: follow accepted Frame and actual scoped sources.
- Branches, attachments, repository content retrieval, durable unsubmitted drafts and advanced history navigation: decide when the first journey identifies their need; existing final-product requirements are not removed.
- Broad migration/backup/restore/import/delete workflows: explicit forward migration is deferred by the accepted new-Projects-first decision; refine when older local Project data must become usable under a newer schema.
- Execution, Workers, Evidence, Memory and Convergence remain later milestones, not implied implementation scope.

## Verification Notes

- Starting source: local main `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`. The writer evidence records final two-platform package success while preserving the earlier literal full-deep failure and unsuccessful Sonar requests. This brief neither waives nor fabricates predecessor proof.
- Two Herdr sessions performed read-only source investigations. The coordinator directly checked the submit requirement, bootstrap composition, canonical table inventory, ADR constraints and old-schema classification. No browser, tests, schema migration or provider call ran for this design.
- The remaining Project-entry and safe noncanonical write details are material design work. They must be resolved before a candidate is built; numerical limits are not invented here. Older-generation preservation and safe-mode behavior remain required tests despite deferring migration.
- This revision is frozen for independent intent inspection with status `in-review`. Required review outcomes and developer intent acceptance are not yet recorded; no readiness, build or implementation pass is claimed.

## Developer Context

- The developer asks the coordinator to proactively investigate, advise, supervise agents and flag evidence-backed reasons to change accepted decisions. The developer retains final say and refines the product through use.
- The approved scheduling question and answer are recorded in `docs/ragnarok-prototype-coordination.md`, under “Verified Initial Findings And Accepted Adjustment”.
- GitHub #85 was updated after explicit approval. Its frontier is persistent Conversation design; #90 was not closed or misrepresented as completed remote implementation.
- The `chess` repository is a candidate later trial, not inspected or modified by this slice.
- The developer approved the new-Projects-first data policy after an explicit explanation that older local harness data remains preserved in safe mode and existing Git repositories remain usable as registration targets. This changes migration timing, not preservation obligations.
- During further investigation an agent initially inferred that initial creation needed the later Effect portfolio. The coordinator challenged that reading against the defined Storage-operation families and the accepted #87 bootstrap design. The agent withdrew the claim; the coordinator independently checked the explicit exemption at that design's line 116. This is a corrected research finding, not a new exception or an approved architectural change.
- Further investigation distinguished the coordinator's filesystem-only suggestion from accepted requirements. The investigator confirmed that no existing approved registration-subprocess contract was found, but no universal onboarding prohibition was found either. The developer then approved the explicit Git observer direction. Exact arguments, trust, bounds and lifecycle are still reviewed technical intent, not an unrestricted process exemption or authority to implement without candidate approval.

## References

- `PRODUCT.md`
- `CONTEXT.md`
- `docs/ragnarok-prototype-coordination.md`
- `docs/adr/0004-canonical-board-index.md`
- `docs/adr/0006-physical-persistence-layout.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md`
- [Git repository layout](https://git-scm.com/docs/gitrepository-layout)
- [Git configuration syntax](https://git-scm.com/docs/git-config#_syntax)
- [Git worktree configuration](https://git-scm.com/docs/git-worktree#_configuration_file)
- `.rpiv/artifacts/validation/2026-08-25_23-26-11_workspace-supervision-prototype.md`
- `.rpiv/artifacts/plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md`
- `.rpiv/artifacts/evidence/2026-09-10_canonical-project-writer-s7.md`
- [Trust spine delivery #85](https://github.com/TheMastermindPT/slopstop/issues/85)
