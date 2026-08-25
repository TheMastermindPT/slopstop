# SlopStop Domain Context

Use these terms consistently in code, schemas, tests, and UI copy.

| Term | Meaning |
| --- | --- |
| Project | One saved Git repository and its local SlopStop state; visualized as a galaxy. |
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

Waypoint, run, worker, action, process-job, finding, and onboarding-readiness statuses are separate fixed models. Do not reuse one family's status to stand in for another.

## Graphs

- The project graph stores durable intent, decisions, relationships, evidence, and status.
- An execution graph represents one attempt with tools, workers, retries, and approvals.
- A conversation graph stores model turns, forks, summaries, and tool results.

These graphs link to one another but never share one canonical state model.
