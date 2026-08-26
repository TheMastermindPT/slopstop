# SlopStop Domain Context

Use these terms consistently in code, schemas, tests, and UI copy.

| Term | Meaning |
| --- | --- |
| Project | One saved Git repository and its local SlopStop state; visualized as a galaxy. |
| Project lifecycle | The independent active or archived axis of one Project; archiving preserves identity and history and never means close, delete, ready, or healthy. |
| Project backup | A sealed, checksum-verified snapshot of both quiescent Project databases and their identity/schema manifest; it contains no raw credentials. |
| Project restore | A staged, verified activation of a Project backup for the same Project and database lineages that preserves the previously active generation. |
| Project export | A portable Project backup stored outside application data for reinstall or machine transfer; it excludes machine-local paths and raw credentials. |
| Project snapshot | One immutable backup or export with its own opaque identity, sealed manifest, and checksums over an exact Storage generation. |
| Application registry | Reconstructible installation-local location and active-generation data used to find and operate Storage; it is never canonical Project truth. |
| Canonical database | The Project's `slopstop.db`, which owns directly queryable current state, immutable Accepted revisions, command settlement, and Canonical events without requiring event replay. |
| Runtime database | The separately owned `mastra.db`, whose private runtime state cannot decide canonical Project truth. |
| Database lineage | The opaque identity of one canonical or runtime database history, preserved by same-Project restore and replaced only by a contract that explicitly permits it. |
| Canonical recovery package | An explicitly incomplete package containing verified canonical Project truth when runtime persistence is unavailable; it opens only in safe mode and requires explicit runtime reset before normal use. |
| Persistence health | The independent healthy, migration-required, recovery-required, missing, corrupt, identity-conflict, unsupported-newer, unavailable, or broken state of one canonical or runtime database. |
| Storage generation | One activated physical pairing of canonical and runtime Project persistence; restore, import, or runtime reset creates a new generation without redefining Project identity. |
| Storage operation | One durable backup, export, migration, restore, import, runtime-reset, or delete attempt whose journal remains outside the Storage generation it may alter. |
| Storage safe mode | The read-only Project mode entered when either database is not healthy; only diagnosis and explicit storage-recovery operations remain available. |
| Prior-state witness | Any registry record, marker, manifest, generation, database sidecar, local snapshot, or unfinished-operation journal proving that missing files must enter recovery instead of fresh initialization. |
| Deletion tombstone | The external operation witness retained while destructive Project-data deletion is incomplete; it blocks fresh initialization until deletion either completes or is recovered. |
| Feature | A durable objective container with its own Frame record, goals, constraints, revisions, and Waypoint star system. |
| Waypoint | A durable project objective represented as a planet; never an agent session or temporary worker task. |
| Application coordinator | Deterministic software that owns canonical project state, scheduling, policy, budgets, and recovery. |
| Waypoint parent | The single logical AI supervisor of one Run, preserving identity across safe restart, resume, compaction, runtime session replacement, and model changes. |
| Worker | One bounded, attributed, non-nesting attempt to perform an exact Delegation task. |
| Turn Machine | The Execution-owned internal sequence controller for one Waypoint parent or Worker; it is reconstructed from durable records, is not a domain aggregate, and never replaces Worker state authority. |
| Run | One supervised attempt to perform an exact Action version on one Waypoint. |
| Run slot | The current exclusive claim that permits at most one nonterminal Run for a Waypoint without adding execution state to the Waypoint aggregate. |
| Action | A reusable capability such as Frame, Research, Implement, or Validate; not a mandatory pipeline stage. |
| Action availability | A versioned live projection of whether one Action is available, blocked, unavailable, or broken for one Waypoint; it is recalculated from authoritative inputs and never set directly. |
| Delegation plan | The just-in-time, user-approved worker roles, tasks, tools, budgets, dependencies, models, and risks for a run. |
| Delegation task | One immutable task inside an accepted Delegation plan revision; Worker retries preserve the task identity while creating new Worker identities. |
| Control request | One durable typed intent whose kind fixes its target: Run pause, resume, cancellation, and Change request target the Run; Worker stop and Worker model change target one Worker; Waypoint-parent model change targets that parent. |
| Model attempt | One durable append-only attributed admitted provider-dispatch attempt for an exact Waypoint parent or Worker, created after command and policy admission and durable Recovery Journal `started`, immediately before the adapter boundary; it distinguishes `proven-not-started`, `provider-invocation-observed`, and `invocation-uncertain` without owning execution state. |
| Sealed invocation | One immutable provider-neutral candidate containing the exact proposed identity, task, policy epoch, workspace, Invocation context record, visible tools, provider, model, budget, and completion inputs; command or policy admission may reject it before any Model attempt exists. |
| Attributed observation | One normalized immutable report with a closed versioned kind, emitted by a provider, runtime, or tool adapter and recorded by Execution against an exact invocation; it reports what was observed and owns no state transition. |
| Model availability observation | One attributed `provider-unavailable` or `model-unavailable` observation for an admitted dispatch; it is distinct from generic provider rejection or failure and may propose, but never perform, recovery behavior. |
| Model change | One approval-gated Control request that selects an exact provider/model for future Waypoint-parent invocations or a linked replacement of one stopped Worker; it never mutates an in-flight invocation or selects a fallback automatically. |
| Context record | One Conversation-owned immutable record linked to an exact response message, describing what that direct response used and excluded; its `responseMessageId` contract is never reused as Execution invocation state. |
| Invocation context record | One Execution-owned immutable record of the exact purpose, prompt sources, and deterministic compiled context prepared for one Waypoint parent or Worker provider candidate; a model-based compaction uses the specialized `context-compaction` purpose and produces an artifact only for a later record. It is separate from every Conversation Context record. |
| Tool invocation | One durable attributed attempt to handle an exact model-visible tool proposal through ordered observations; it is not a domain aggregate and its terminal transport observation is not semantic or effect success. |
| Worker stop | The terminal outcome for one Worker after model unavailability or an explicit stop request closes its dispatch and reaches a Worker-safe boundary; replacement uses a new linked Worker identity. |
| Run policy epoch | One immutable approved authority basis for Run dispatches; later restriction still applies live, while added power requires another approved epoch. |
| Development discipline policy | One stable, versioned definition of strict TDD, test-first preferred, tests required, or exploration obligations and the exact replacements its policy permits; it does not itself prove Completion. |
| Application development-discipline default decision | One append-only installation-local selection of an exact Development discipline policy version; a directly queryable current pointer chooses the fallback used by later Run resolutions. |
| Run discipline decision | One immutable ordered resolution for an exact Run and accepted plan, sourced by either an Application development-discipline default decision or one exact Project-profile override; the applicable Run policy epoch selects it, and an amendment may add a later decision without rewriting history. |
| Discipline exception | One immutable one-Run proposal to replace exact default proof obligations, including Red or Green only when the selected Development discipline policy permits that replacement; applicability requires its exact accept decision and no append-only supersession, and it never changes SlopStop's own repository rules. |
| Run change classification | One immutable proposal to classify an exact change as behavior implementation, production-only remediation, test-changing remediation, or non-behavior work; current applicability requires its exact accept decision, unchanged pinned inputs, and no append-only supersession. |
| Fixed test set | The immutable Test checks, command specifications, semantics, artifacts, and hashes that an authorized production-only change must preserve. |
| Evidence family | One bounded proof domain with one typed subject and scope model and closed observation, evaluation, decision, and verdict meanings; a verdict has no meaning outside its family. |
| Trust basis | The immutable source classification, assessing authority, policy or rule version, and optional prior decision that determine whether one Evidence entry may be used for its declared scope; it is separate from the entry's domain verdict. |
| Evidence envelope | The narrow structural metadata shared by every Evidence entry: stable identity and version, attributed producer, typed subject and scope, exact fingerprints and artifact references, time, trust basis, and integrity; it contains no verdict. |
| Evidence observation | One immutable family-owned account of what an attributed producer reported for an exact subject, scope, and input. |
| Evidence evaluation | One immutable family-owned interpretation of exact observations, dependencies, fingerprints, evaluator identity, evaluator version and implementation hash, rule versions, and limits. |
| Evidence decision | One immutable family-owned acceptance, rejection, invalidation, supersession, or other authoritative interpretation of an exact evaluation. |
| Evidence current evaluation | The accepted family evaluation presently authoritative for one exact subject and `EvidenceScopeId`; a scope-keyed materialized pointer advances atomically with its append-only evaluation and decision history. |
| Evidence artifact | One bounded local output with opaque durable identity, immutable integrity expectations, truncation-at-production state, and discriminated provenance as either Evidence-produced or imported-source; a separate Artifact state version records current availability, integrity, and retention. |
| Artifact source record | One immutable logical account of the original source, revision, stable relative identifier, timestamp, producer, and declared digest for an imported, historical, or research Artifact; importer identity and trust remain separate attributed facts. |
| Artifact state version | One immutable accepted evaluation of an exact Artifact's availability, integrity, and retention state; evaluations consuming its bytes depend on that exact version, while removal never deletes provenance or history. |
| Evidence evaluator version | One immutable implementation of a stable evaluator identity, fixed by version and implementation hash; a changed implementation invalidates evaluations that depended on the earlier version. |
| Evidence producer attempt | One durable Evidence capture-attempt identity recorded before an explicit rerun producer starts; it references but never replaces the Execution Worker, Process-job, Model-attempt, Tool-invocation, or Recovery-Journal lifecycle. |
| Evidence scope | One stable typed identity for a Run workspace, Task workspace, Candidate, or Artifact scope; changing state creates another scope fingerprint without changing the scope identity. |
| Evidence scope fingerprint | One immutable typed state identity bound to an exact Evidence scope; Run-workspace and Task-workspace scopes reference repository-state fingerprints, Candidate scopes reference Candidate fingerprints, and Artifact scopes reference Artifact state versions. |
| Task workspace | The Evidence scope for one immutable Delegation task and Worker attempt over one exact Run workspace, sealed input snapshot, accepted start fingerprint, result fingerprint, and attributed producer; it is not another checkout or Execution aggregate. |
| Candidate scope | The Evidence scope for one materialized Candidate delta, its source baseline and Candidate fingerprints, and its exact selected Worker deltas; Task-workspace green Evidence is not Completion Evidence for the combination. |
| Candidate evaluation | One technical Evidence verdict for an exact Candidate: acceptable, changes required, blocked, stale, uncertain, or broken; user approval, rejection, and Change requests are separate canonical actions. |
| Evidence gate | The check that accepted, current evidence is sufficient before implementation side effects begin. |
| Behavior contract | The accepted revisioned statement of a Waypoint's observable intent, expressed as stable clauses with public seams, relevant limits, and failure behavior. |
| Test contract | The accepted revisioned verification design for one exact Behavior contract, owning stable Test checks, approved commands, expected semantics, clause coverage, and proof phases but no test results. |
| Completion contract | The accepted revisioned acceptance design that binds exact Behavior and Test contracts to fixed typed proof obligations before a Run may complete. |
| Completion subject | The exact output Evidence evaluates for Completion: a final Candidate for every repository mutation, or an explicitly contracted typed non-repository output with current no-mutation and no-effect proof. |
| Test-first Proof Chain | A typed view linking exact accepted historical baseline and Red Evidence to current final Green, rerun, review, and exception proof for one contract clause and scope; it is not another ledger. |
| Completion Matrix | A query-only clause projection of Completion obligations, accepted causal Evidence, current terminal Evidence, applicability, and blockers; it has no editable or canonical state. |
| Completion Finding snapshot | One immutable direct-query result over exact current Finding evaluations for a Completion scope and waterline; members reference immutable Finding evaluations and accepted decisions while copying the observed materialized-current version and hash, never referencing the mutable current row. |
| Completion acceptance | One immutable user decision to accept, reject, or request changes against exact current Completion Evidence, contracts, and output fingerprint. |
| Completion authorization | One immutable Evidence-owned proof that an exact Run output has both current contract proof and an exact accepted Completion decision; Execution must recheck both before completing the Run. |
| Board | The canonical append-only index of ordered references to one Waypoint's conversation messages and approved typed events; it owns neither source content nor presentation. |
| Board entry | One immutable, Project-ordered reference to a Waypoint conversation message or approved typed event, with structural provenance and optional supersession but no copied source content. |
| Board position | A monotonic Project-scoped ordering value assigned by the canonical writer when it accepts a Board entry; it is separate from Board-entry identity and source time. |
| Board admission policy | The versioned canonical policy that decides which typed event references enter a Waypoint Board and which of those also appear in the Project activity feed. |
| Board read position | The monotonic highest contiguous Board position confirmed as presented in one scope; the Project feed and each Waypoint keep independent positions. |
| Typed command | A validated request that may change canonical state through the coordinator. |
| Command receipt | The durable applied, unchanged, or rejected settlement of the first distinct Typed-command fingerprint under one Project and command identity. |
| Canonical event | An append-only fact emitted only by an applied command for audit and integration; current Project state never depends on replaying it. |
| Accepted revision | An immutable, explicitly accepted version of canonical aggregate content to which directly queryable current state may point. |
| Writer generation | A durable fencing identity acquired under the operating-system writer lease and checked by every canonical command settlement. |
| Runtime handoff | A versioned immutable request crossing from canonical outbox to the runtime inbox through at-least-once delivery, stable reservation, and evidence-backed reconciliation. |
| Workspace protocol | The application-facing identity and transport boundary for Conversation, Frame, and Memory projections; it owns no Execution checkout, lease, process, or effect state. |
| Run workspace | One separate Execution-owned logical binding to an exact mode, Repository binding, baseline, physical resource, and fingerprint waterline; it never reuses Workspace-protocol identity. |
| Run-workspace resource | The physical current checkout or managed worktree identified by Git administration and Repository binding rather than path alone; several read-only Run workspaces may reference it. |
| Read claim | A short-lived Process-job claim permitting observation of one Run-workspace resource at one accepted fingerprint. |
| Mutation lease | The durable exclusive grant allowing one Worker to perform declared mutations on one Run-workspace resource; it never expires or releases solely because time passed or a process stopped. |
| Compound code anchor | A Git-, text-, symbol-, syntax-, and optional LSP-backed code reference registered against one exact typed Evidence scope and captured scope fingerprint; historical inspection never changes its separate current-location authority. |
| Verified memory | A durable claim accepted through evidence and policy, with provenance, scope, confidence, and invalidation rules. |
| Memory Topic | A stable project-local organizer for related Verified Memories; it has navigational metadata but no trust state, and each memory has one primary topic. |
| Memory Revision | An immutable version of a Verified Memory's claim, scope, and evidence dependencies; a semantic edit creates a new revision and removes the prior accepted revision from trusted retrieval until the replacement is accepted. |
| Memory Proposal | An untrusted structured candidate produced by an attributed worker with approved `memory-propose` capability; it links claim, topic, scope, evidence, invalidation dependencies, and limitations but cannot enter trusted retrieval until user acceptance. |
| Memory Retrieval | A typed, bounded, and audited query authorized by an approved plan; trusted retrieval returns only current accepted memories for the permitted scope, while stale memories require explicit inspection or re-verification. |
| Capability catalogue | The provenance-aware inventory of skills, tools, prompts, analyzers, servers, and extensions that may become available. |
| Recovery journal | Evidence-owned durable write-ahead records of effect intent, start, terminal observation, and reconciliation used to distinguish completed, failed, and uncertain side effects. |
| Run recovery reconciliation | One accepted Evidence-backed settlement that removes only the resolved recovery condition, then recomputes Run state and every remaining blocker before dispatch, retry, or model replacement may continue. |
| Uncertain side effect | An operation known to have started but lacking durable proof of completion; it cannot be replayed automatically. |
| Run-workspace fingerprint | A Git, diff, and untracked-file identity binding Evidence to the exact Run-workspace state it evaluated. |
| Worker delta | One stable identity per Worker for changes between its sealed input and results; explicit reruns append command-bound observations and never rewrite or replace the identity. |
| Candidate fingerprint | The immutable content identity of one exact materialized Candidate version; it verifies Candidate state but never replaces Candidate identity. |
| Candidate delta | One closed, materialized set of explicitly selected Worker changes with its own identity and fingerprint, ready for final review and possible Integration. |
| Declared effect set | The versioned file, Git, local-artifact, external-service, and credential scopes that one authorized action may affect. |
| Process job | One coordinator-owned operating-system process attempt with a bounded invocation, output, lifecycle, effect declaration, and durable attribution. |
| Safe checkpoint | An Execution record referencing Evidence proof that dispatch is closed, zero Model attempts and Tool invocations remain in flight, no mutating process or uncertain effect remains, and the final Workspace fingerprint is accepted. |
| Resume capsule | Persisted context sufficient to continue an interrupted run without guessing or repeating uncertain effects. |
| Resume checkpoint | A Safe checkpoint plus the exact Resume capsule, policy, Capability, budget, approval, and availability inputs needed to continue a Run. |
| Language Intelligence Service | Workspace-isolated LSP lifecycle, synchronization, diagnostics, semantic navigation, and mutation proposals. |
| Debug observation | Registered and redacted runtime evidence from a future DAP session; supporting evidence, never red-green proof. |

## Status Families

Waypoint, Run, Worker, Control request, Run workspace, Process job, Finding, Integration, onboarding readiness, Project lifecycle, Storage operation, and persistence health statuses are separate fixed models. Action availability is a separate derived projection. Each Evidence family has its own versioned observation, evaluation, decision, and verdict vocabulary; there is no universal Evidence verdict. Do not reuse one family's state to stand in for another.

## Graphs

- The project graph stores durable intent, decisions, relationships, evidence, and status.
- An execution graph represents one attempt with tools, workers, retries, and approvals.
- A conversation graph stores model turns, forks, summaries, and tool results.

These graphs link to one another but never share one canonical state model.
