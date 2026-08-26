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
| Waypoint parent | A resumable AI supervisor for one active Waypoint run. |
| Worker | A bounded, attributed, non-nesting agent session that performs evidence, repository, validation, or review work. |
| Run | One supervised attempt to perform an Action on a Waypoint. |
| Action | A reusable capability such as Frame, Research, Implement, or Validate; not a mandatory pipeline stage. |
| Delegation plan | The just-in-time, user-approved worker roles, tasks, tools, budgets, dependencies, models, and risks for a run. |
| Evidence gate | The check that accepted, current evidence is sufficient before implementation side effects begin. |
| Completion contract | The observable checks and evidence required before a Waypoint may complete. |
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
| Compound code anchor | A Git-, text-, symbol-, syntax-, and optional LSP-backed code reference registered by the harness. |
| Verified memory | A durable claim accepted through evidence and policy, with provenance, scope, confidence, and invalidation rules. |
| Memory Topic | A stable project-local organizer for related Verified Memories; it has navigational metadata but no trust state, and each memory has one primary topic. |
| Memory Revision | An immutable version of a Verified Memory's claim, scope, and evidence dependencies; a semantic edit creates a new revision and removes the prior accepted revision from trusted retrieval until the replacement is accepted. |
| Memory Proposal | An untrusted structured candidate produced by an attributed worker with approved `memory-propose` capability; it links claim, topic, scope, evidence, invalidation dependencies, and limitations but cannot enter trusted retrieval until user acceptance. |
| Memory Retrieval | A typed, bounded, and audited query authorized by an approved plan; trusted retrieval returns only current accepted memories for the permitted scope, while stale memories require explicit inspection or re-verification. |
| Capability catalogue | The provenance-aware inventory of skills, tools, prompts, analyzers, servers, and extensions that may become available. |
| Recovery journal | A durable write-ahead record used to distinguish completed, failed, and uncertain side effects. |
| Uncertain side effect | An operation known to have started but lacking durable proof of completion; it cannot be replayed automatically. |
| Workspace fingerprint | A Git, diff, and untracked-file identity binding evidence to the code state it evaluated. |
| Process job | A cancellable, timed, output-bounded command with durable ownership and distinct terminal states. |
| Resume capsule | Persisted context sufficient to continue an interrupted run without guessing or repeating uncertain effects. |
| Language Intelligence Service | Workspace-isolated LSP lifecycle, synchronization, diagnostics, semantic navigation, and mutation proposals. |
| Debug observation | Registered and redacted runtime evidence from a future DAP session; supporting evidence, never red-green proof. |

## Status Families

Waypoint, run, worker, action, process-job, finding, onboarding-readiness, Project-lifecycle, storage-operation, and persistence-health statuses are separate fixed models. Do not reuse one family's status to stand in for another.

## Graphs

- The project graph stores durable intent, decisions, relationships, evidence, and status.
- An execution graph represents one attempt with tools, workers, retries, and approvals.
- A conversation graph stores model turns, forks, summaries, and tool results.

These graphs link to one another but never share one canonical state model.
