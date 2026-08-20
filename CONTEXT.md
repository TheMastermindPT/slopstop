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
| Board | One append-only Waypoint collaboration timeline containing chat and typed events. Chat alone has no state authority. |
| Typed command | A validated request that may change canonical state through the coordinator. |
| Compound code anchor | A Git-, text-, symbol-, syntax-, and optional LSP-backed code reference registered by the harness. |
| Verified memory | A durable claim accepted through evidence and policy, with provenance, scope, confidence, and invalidation rules. |
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
