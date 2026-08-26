# ADR 0008: Run Workspace, Mutation Lease, And Process Job Lifecycle

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

ADR 0007 gives each Run an exact workspace reference and fingerprint waterline, but deliberately leaves workspace mechanics, Process jobs, and effect records to a dedicated owner decision. The product must support observation of the current checkout, explicitly authorized editing of that checkout, and isolated Git worktrees without allowing concurrent workers, external edits, process failure, or application restart to blur attribution. ADR 0005 also requires uncertain effects to remain visible. ADR 0006's Identity-owned `workspaces` table belongs to the application Workspace protocol; this decision therefore uses separate Execution-owned Run-workspace tables.

The existing `Workspace` protocol is the application boundary for Conversation, Frame, and Memory projections. This decision therefore names the execution aggregate `Run workspace`; future types use `RunWorkspaceId` rather than overloading that protocol name.

## Decisions

### Aggregate And Resource Identity

- Give each Run exactly one primary `Run workspace`. Its `RunWorkspaceId`, mode, Repository binding, baseline, and physical resource binding are immutable. A material mode or baseline change supersedes the Run instead of silently rebinding it.
- Distinguish the logical Run-owned aggregate from its physical checkout through a `RunWorkspaceResourceKey`. Derive that key from the Repository binding, Git common directory, and worktree administrative identity, never from a path alone.
- Permit several read-only Run workspaces to reference one physical resource at the same accepted fingerprint. Apply read claims and mutation exclusivity to the resource key so separate Run workspace identities cannot bypass coordination.
- Treat the current normalized path as observed location data. A move, disappearance, administrative mismatch, or repair changes location or health, not Run workspace identity.

### Modes And Provisioning

- Use the closed v1 mode vocabulary `current-checkout-read-only`, `current-checkout-editable`, and `isolated-worktree`.
- Let a read-only current checkout start from an exact clean or dirty fingerprint. Let an editable current checkout start dirty only after the user explicitly approves that exact baseline. Never copy dirty current-checkout state into an isolated worktree implicitly; import requires a separate attributed operation.
- Provision isolated worktrees under an application-managed root in Electron `userData`, from one exact clean commit and a collision-resistant managed branch. Before creation, inspect `git worktree list --porcelain`, verify the Git common directory, baseline commit, branch availability, target absence, and prior-state witnesses. A failed selected mode blocks the Run and never falls back to a weaker mode.
- Create, verify, and then lock a managed worktree with an identifying reason. The Git lock protects administrative metadata from pruning; it is not a file-mutation lock and grants no SlopStop authority.
- Use the Run-workspace lifecycle `provisioning -> ready -> active -> quiescing -> retained`, permit `retained -> active`, and clean up through `retained -> cleanup-requested -> removed`. `removed` is terminal. Keep `missing`, `conflicting`, and `broken` as distinct recovery states that never degrade to removed, clean, or newly provisioned.

### Read Claims And Mutation Leases

- Give every read-only Process job a short-lived read claim bound to its resource key and accepted fingerprint. Mutation admission closes new read dispatch, waits for active read jobs to finish or be cancelled, captures a fresh fingerprint, and only then attempts an atomic lease grant.
- Grant a mutation lease with compare-and-set under the canonical Writer. Require the expected resource, Run workspace, Run, Worker, policy epoch, Capability version, start fingerprint, Project sequence, and Writer generation. At most one active mutation lease may exist for a physical resource.
- Record each lease grant immutably and keep a directly queryable current-lease pointer. A lease has no time-based expiry and survives application, parent, Worker, and process interruption. Resume may grant a new lease only after the earlier lease is conclusively released.
- Require every mutating Process job and workspace effect to reference the active lease, exact Worker, declared scope, and expected fingerprint. Release requires no active mutating job, no uncertain effect, and an accepted end fingerprint.
- Treat the lease as SlopStop coordination, not an operating-system lock. An unattributed external change closes dispatch, invalidates dependent Evidence, and puts the Run into `blocked` or `recovery-required` according to effect certainty. It is never adopted into the current Candidate delta; continuing from that state requires a new Run baseline.

### Fingerprint And Effect Authority

- Let Evidence own Workspace fingerprints, deltas, Recovery Journal records, effect reconciliation, and safety proofs. Execution requests captures and stores only exact Evidence references and waterlines; it does not compute a competing fingerprint or effect ledger.
- Let Execution own Run workspaces, resource coordination, read claims, mutation leases, Process jobs, checkpoints, and recovery orchestration. Integration alone owns application of an immutable Candidate delta to its target.
- Describe each committed action with a `DeclaredEffectSet` drawn from `workspace-files`, `git-index`, `git-refs`, `git-worktree-admin`, `local-artifacts`, `external-service`, and `credential-access`. Workspace or Git effects require a mutation lease. External cost or state requires a Recovery Journal entry even when the checkout remains read-only.
- Derive read-only or mutating behavior from a versioned Capability, never from a Worker assertion or executable name. Verify before and after fingerprints. Any undeclared path, Git, local, or external effect is `PROCESS_EFFECT_SCOPE_VIOLATION`, closes dispatch, and requires remediation even when the process exits zero.
- Bind old Evidence permanently to its original fingerprint. A reader may finish local computation after a later mutation, but its result is stale before acceptance and must be reproduced against the newer fingerprint.

### Process Job Authority And Lifecycle

- Make the deterministic Application coordinator the sole authority that creates and launches operating-system processes. Parents and Workers submit bounded requests; they never call a shell, repository tool, analyzer, or process API directly.
- Use the Process-job lifecycle `queued`, `starting`, `running`, `cancel-requested`, `exited`, `failed-to-start`, `timed-out`, `output-limit-exceeded`, `cancelled`, and `interrupted`. The last six states are terminal. `exited` records an exit code but does not claim semantic or effect success. `interrupted` means trusted process observation was lost.
- Bind each Process job to Project, Run, Worker, Run workspace, physical resource, Capability version, policy epoch, Command ID, command fingerprint, declared effect set, timeout, output policy, and any required lease and Recovery Journal entry. Record a redacted final invocation manifest, process-start identity, transitions, exit observation, artifact references, and truncation state.
- Build invocations from an executable and separate arguments. Shell use, cwd, environment names, stdin, network access, descendants, and shared caches require explicit Capability policy. Resolve secret references only at spawn and never persist secret values.
- Control the complete process tree. Cancellation first requests graceful termination, waits the Capability's grace period, then uses bounded forced termination. Classify the job as cancelled, timed out, or output-limit-exceeded only after disappearance is confirmed; otherwise classify it as interrupted.
- Stop a process when bounded output is exceeded, persist only the allowed local bytes with explicit truncation, and reconcile effects separately. Never send process output, source, model output, secrets, environment values, or full paths to Sentry.
- Keep Model and tool invocations out of Process-job state. Their adapters own distinct invocation records, while the coordinator authorizes them through the same Capability, Command-ID, effect-declaration, and Recovery-Journal rules.

### Idempotency And Recovery

- Require the canonical command idempotency contract for every Run-workspace, lease, checkpoint, and Process-job command. An exact retry returns the original settlement; a reused Command ID with different content is `IDEMPOTENCY_CONFLICT`.
- Consume a Process-job identity permanently once its effect reaches `started`. Never relaunch that identity. A proven-safe retry uses a new Process-job identity, Recovery Journal entry, before fingerprint, and lease proof.
- Persist and flush effect intent, then `started`, before dispatch. Persist a terminal observation and after fingerprint when available. Do not promise exactly-once across the operating system or external services; use provider idempotency keys where supported and reconcile before any retry.
- Reconcile crash windows conservatively: intent without `started` may close as not started; `started` without process-start proof remains uncertain until Evidence proves absence of effect; an identified process without outcome is observed or stopped; a terminal process without an after fingerprint leaves the effect uncertain; complete Journal and fingerprint proof may reconstruct a missing checkpoint without replay.
- On startup, reconcile all nonterminal Run workspaces, leases, Process jobs, and Journal entries before runtime dispatch. Compare managed records with Git porcelain state and fresh read-only observations. Mark continuity-lost jobs interrupted and let Evidence classify effects before rebuilding Action availability.
- Define `missing` as unavailable expected path or metadata without a competing claimant, `conflicting` as an identity claimed by another resource, and `broken` as the expected identity with unusable or inconsistent Git state. Repair only after proving the same identity. Recreation, force, or adoption never substitutes for that proof.

### Checkpoints, Pause, And Cancellation

- Make a Safe checkpoint an Execution-owned durable record referencing an Evidence safety proof. It requires closed dispatch, no starting, running, or cancel-requested mutating job, no uncertain started effect, an accepted fingerprint captured after the last effect, and settled Writer state.
- Keep a Resume checkpoint separate. It adds the exact Resume capsule, parent and Worker context, Capability versions, policy epoch, budgets, approvals, and Action availability inputs needed to continue. A Safe checkpoint permits stopping and salvage; it does not promise resumability.
- Pause by persisting the Control request, closing dispatch, allowing an active mutating effect to settle, handling read-only jobs under policy, creating a Safe checkpoint, releasing the lease, and retaining the Run workspace. Confirm `paused` only from that proof. If no Resume checkpoint exists, `ResumeRun` remains unavailable rather than guessing context.
- Cancel by closing dispatch and attempting bounded process-tree termination. Keep the Run in `cancel-requested` or `recovery-required` while any effect is uncertain. A reconciled safe cancellation follows ADR 0007 to terminal `cancelled` with cause `USER_CANCELLED`; it never manufactures `failed` or deletes the Run workspace.

### Integration, Export, Discard, And Cleanup

- Retain a Run workspace after Run completion, cancellation, supersession, or failure. Completion, Integration, Candidate-delta export, salvage, discard, and cleanup remain separate explicit decisions. Age or quota may block new provisioning but never delete retained work.
- Freeze the source Run workspace while Integration consumes its immutable Candidate delta. Integration success or conflict does not clean the source automatically.
- Require a Safe checkpoint for a `Candidate delta export`, including baseline, delta, provenance, hashes, and Validation state. Permit a visibly distinct recovery salvage bundle from uncertain or broken files, but never label it an integratable Candidate delta.
- Define discard of a current checkout as abandonment of SlopStop authority without reverting or deleting files. Read-only discard removes only SlopStop's logical binding. Isolated-worktree discard may remove its managed files after exact-scope confirmation.
- Begin cleanup only after terminal Run and Workers, released leases and claims, terminal Process jobs, no uncertain effects, a current Safe checkpoint, no live Evidence, Validation, or Integration dependency, and confirmation bound to the final fingerprint. Treat cleanup itself as a journalled effect and mark `removed` only after Git and filesystem verification.
- Unlock before removing a managed worktree. Prefer ordinary `git worktree remove`; permit one `--force` only for an explicitly confirmed dirty isolated-worktree discard whose fingerprint is rechecked immediately before removal. Never use double force. Delete a managed branch only through a separate decision and preserve any branch with unique commits by default.
- Never run `git worktree prune` automatically because it is repository-global and may affect resources SlopStop does not own. A dry run may support diagnosis, while global cleanup remains a separate explicit user action.

### Stable Failure Vocabulary

Use at least these stable failures and derive Action availability from them rather than returning a boolean or free-text error:

`WORKSPACE_NOT_READY`, `WORKSPACE_MISSING`, `WORKSPACE_CONFLICTING`, `WORKSPACE_BROKEN`, `WORKSPACE_FINGERPRINT_MISMATCH`, `WORKSPACE_EXTERNAL_CHANGE`, `MUTATION_LEASE_CONFLICT`, `MUTATION_LEASE_REQUIRED`, `MUTATION_LEASE_STALE`, `ACTIVE_READ_CLAIMS`, `PROCESS_CAPABILITY_DENIED`, `PROCESS_EFFECT_SCOPE_VIOLATION`, `PROCESS_OUTPUT_LIMIT_EXCEEDED`, `PROCESS_INTERRUPTED`, `RECOVERY_REQUIRED`, `SAFE_CHECKPOINT_UNAVAILABLE`, `RESUME_CHECKPOINT_UNAVAILABLE`, `CLEANUP_DEPENDENCIES_PRESENT`, `CLEANUP_CONFIRMATION_STALE`, and `IDEMPOTENCY_CONFLICT`.

### Physical Tables

Execution adds these owner tables to `slopstop.db` under ADR 0006's Project-scoped key, transition, command-settlement, and indexing rules:

| Family | Tables |
| --- | --- |
| Run workspace | `run_workspaces`, `run_workspace_resources`, `run_workspace_status_transitions`, `run_workspace_status_transition_conditions` |
| Coordination | `run_workspace_read_claims`, `mutation_leases`, `mutation_lease_releases`, `run_workspace_checkpoints` |
| Process job | `process_jobs`, `process_job_effect_scopes`, `process_job_status_transitions`, `process_job_status_transition_conditions`, `process_job_outputs` |

- Make the Run reference unique in `run_workspaces`, keep current status and resource binding directly queryable, and key resource coordination by Project and exact resource key. Every `RunWorkspaceId` foreign key targets this Execution table, never ADR 0006's application `workspaces` table.
- Keep Evidence-owned fingerprints, deltas, Journal entries, reconciliations, and safety proofs in Evidence tables defined by its own decision. Execution tables hold exact composite references without copying their payloads or authority.
- Keep machine-local location and invocation details redacted or installation-local as required by the portable-export contract. No portable package may expose a full local path or credential value.

## Consequences

- Logical Run ownership and physical resource coordination remain distinct, so parallel readers cannot accidentally create parallel writers through separate workspace identities.
- Conservative Process-job and Recovery-Journal ordering may report uncertainty when no effect occurred, but it cannot safely report a started unknown effect as clean or repeat it blindly.
- Current-checkout editing remains vulnerable to external human or tool changes because a lease is coordination rather than sandboxing. Fingerprint invalidation makes that limitation visible and protects attribution.
- Retained worktrees and artifacts may consume disk space until the user acts. Explicit cleanup and quota blocking trade convenience for preservation of failed, cancelled, and uncertain work.
- Git worktree provisioning, locking, removal, branch cleanup, external-service idempotency, and process-tree control need adapter-level integration tests before implementation can claim this contract.
