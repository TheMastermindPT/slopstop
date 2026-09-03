---
date: 2026-09-02T19:16:24+0100
author: Pedro Mesquita
commit: f4685df
branch: design/ticket-86-project-storage
repository: slopstop
source_state: "commit plus dirty working tree"
topic: "Current harness capabilities and next implementation priority"
tags: [research, codebase, harness, project-storage, electron, packaging]
status: complete
last_updated: 2026-09-02T22:48:10+0100
last_updated_by: OpenCode
last_updated_note: "Record accepted recovery contracts and the corrected owning-phase Red sequence."
content_hash: 682dca494732d8e502f9c53e1b2eb3e0a06cb54295977b6682d441a30c5d6188
---

# Research: Current Harness Capabilities And Next Implementation Priority

## Research Question
What works now about the harness after the Project Storage implementation, and what should be implemented next?

## Summary
The committed harness foundation supervises an Electron utility process, performs a versioned handshake, correlates commands and results, and retains an asynchronous shutdown boundary. The newer Project Storage capability validates and transfers trusted roots and composes a real persistent owner that creates, opens, classifies, retains, and closes Project storage. Only those newer Project Storage changes exist as uncommitted, unauthorized working-tree implementation beyond commit `f4685df`; their presence and Green tests are not accepted completion evidence and later tracker changes cannot authorize them retroactively.

The checked-out source does not contain the plan's terminal Phase 6 implementation. It stages generated migrations, but it has no explicit native libSQL staging/unpacking configuration, package-smoke Storage-root authorization, or packaged Project Storage scenarios. The present source therefore supplies no package proof that the target native closure and migration resources work in the packaged product. Persistent Project Storage is development-composed and source-integration-tested, not packaged-product-proven. At investigation time, the plan also retained incomplete manual evidence, unavailable Phase 1-5 authority/evidence, unresolved schema-authority concerns C51-C54, and open privacy and bounded-log requirements. Its historical review placed C51-C54 as implementation follow-ups before Phase 1 began, while the prior implementation handoff placed C51 before Phase 1 Green and C52-C54 before Phase 3 Green (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11486-11489`, `.rpiv/artifacts/handoffs/2026-09-01_19-56-25_proximo-agente-implementacao.md:59-60`). That schedule is impossible on clean baseline `f4685df`, where the Phase 1/3 files do not yet exist. The accepted correction locks C51-C54 contracts before Phase 1, then adds and observes each failing test first in its owning phase: C51 in Phase 1 and C52-C54 in Phase 3 before their respective implementations and Green gates. The revised plan explicitly supersedes both older timing records. C52-C53 expose implementation gaps; C54 is the missing same-name mutation-test matrix, including proof of the existing full foreign-key comparator.

Workspace schemas and transport are present, but production Conversation, Frame, and Memory owners intentionally return unavailable. The production renderer currently uses only harness status and retry. Although the developer selected Phase 6 as the desired next outcome, no implementation is currently authorized. The missing schema-authority, privacy, bounded-output, retention, and shutdown-terminal contracts and their tracker scope must first be decided; the design and plan must then be revised where affected, validated, and explicitly accepted before the tracker can authorize future implementation. [Implement Project Storage opening and health classification](https://github.com/TheMastermindPT/slopstop/issues/87) currently requires a real packaged Workspace consumer, while the documented slice and plan intentionally retain unavailable Workspace owners and prove Storage through a main-process bridge. Its outcome must be reconciled with the designed main-only Storage boundary. Even after remediation and Phase 6, the ticket cannot close successfully while the historical-red gate remains broken. Ticket or policy edits cannot retroactively repair chronological Red evidence; the affected behavior must be independently redone from a genuinely failing public seam under a new authorized sequence or remain a broken completion gate.

## Detailed Findings

### Supervised Harness Process
- Electron main derives `<userData>/storage` and the development or packaged migration root, converts them to validated local `file:` URLs, and constructs the supervisor (`apps/desktop/src/main/main.ts:191-205`, `apps/desktop/src/main/project-storage-bootstrap.ts:5-27`).
- The supervisor forks `harness.cjs`, transfers a fresh message port with the immutable parsed bootstrap, then sends the protocol handshake (`apps/desktop/src/main/harness-supervisor.ts:295-349`).
- Process bootstrap converts URLs to physical paths, rejects symbolic roots and overlap, constructs persistent Storage dependencies, and starts protocol intake (`apps/harness/src/process-bootstrap.ts:23-98`).
- The supervisor preserves distinct lifecycle paths for timeout and process exit, but some causes deliberately collapse to the same public status: fork and handshake-send failures become `HARNESS_START_FAILED`, while malformed messages and explicit `system.failure` become `HARNESS_PROTOCOL_ERROR` (`apps/desktop/src/main/harness-supervisor.ts:151-196`, `apps/desktop/src/main/harness-supervisor.ts:202-274`, `apps/desktop/src/main/harness-supervisor.ts:295-337`).
- Invalid desktop messages and unexpected command-handler failures become stable, correlated protocol failures rather than exposing caught causes (`apps/harness/src/harness-runtime.ts:57-80`, `apps/harness/src/harness-runtime.ts:113-116`).
- One limitation remains: every `system.failure`, including a causally correlated request failure, is treated by the supervisor as a global crash that blocks automatic recovery and kills the child; explicit manual retry remains available (`apps/desktop/src/main/harness-supervisor.ts:60-79`, `apps/desktop/src/main/harness-supervisor.ts:151-164`).

### Persistent Project Storage
- The runtime dispatches exact `project.open`, `project.create`, and `project.close` commands to a schema-validating application boundary and emits correlated result events (`apps/harness/src/harness-runtime.ts:67-100`, `apps/harness/src/project-storage-application.ts:58-98`).
- Creation is installation-serialized and Project-serialized, fingerprints its durable request, rejects prior-state witnesses, stages registry authority and both databases, writes a sealed manifest, verifies it, renames atomically, and activates exact registry pointers (`apps/harness/src/storage/project-storage-store.ts:245-395`, `apps/harness/src/storage/project-storage-store.ts:481-518`).
- Canonical and runtime databases are independently migrated, identity-seeded, checked against declared object metadata, integrity-checked, and closed before sealing (`apps/harness/src/storage/project-storage-node-adapters.ts:244-320`). This verification does not compare exact CHECK expressions or partial-index predicates, and no same-name mutation matrix proves those gaps or the existing full foreign-key comparison (`apps/harness/src/storage/database-schema-verifier.ts:92-109`, `apps/harness/src/storage/database-schema-verifier.ts:192-212`, `apps/harness/tests/integration/project-storage-create.integration.test.ts:460-598`).
- Replaying the same `createRequestId` and fingerprint returns the original active identity. Conflicting reuse or interrupted-state witnesses do not create another generation (`apps/harness/src/storage/project-storage-store.ts:210-227`, `apps/harness/src/storage/project-storage-node-opening-registry.ts:374-429`, `apps/harness/src/storage/project-storage-node-opening-registry.ts:466-643`).
- Opening validates application authority, bounded filesystem witnesses, the selected generation, its manifest, and each database independently (`apps/harness/src/storage/project-storage-node-opening-databases.ts:319-405`).
- Both healthy databases produce `opened/read-write`; any unhealthy selected database produces `safe-mode` with separate canonical/runtime health (`apps/harness/src/storage/project-storage-opening.ts:192-235`). Clean absence is returned only when registry and bounded filesystem evidence are both absent (`apps/harness/src/storage/project-storage-node-opening-registry.ts:761-815`).
- Close releases only the named Project session and is idempotent. Stop closes admission, drains admitted work, releases retained sessions in admission order, stops registry ownership, and aggregates cleanup failures (`apps/harness/src/storage/project-storage-store.ts:427-431`, `apps/harness/src/storage/project-storage-store.ts:553-601`).
- Real transport integration proves not-registered, create, healthy open, close, awaited stop, root-overlap rejection, and no root leakage (`apps/harness/tests/integration/process-bootstrap.integration.test.ts:101-175`).

### Desktop Bridges And Renderer Boundary
- Project Storage has a main-process-only `open/create/close/stop` bridge. It validates local commands and returned requests, correlates by message ID, rejects response-kind and identity mismatches, and maps transport/lifecycle failures to stable Storage failures (`apps/desktop/src/main/project-storage-bridge.ts:34-63`, `apps/desktop/src/main/project-storage-bridge.ts:90-156`, `apps/desktop/src/main/project-storage-bridge.ts:167-230`).
- Workspace has an equivalent renderer-facing query/intent/notification bridge with stale-projection protection (`apps/desktop/src/main/workspace-bridge.ts:95-167`, `apps/desktop/src/main/workspace-bridge.ts:207-314`).
- Shared IPC and preload expose harness status/retry and Workspace operations only. No Project Storage channel or renderer filesystem capability exists (`apps/desktop/src/shared/desktop-api.ts:11-29`, `apps/desktop/src/preload/preload.ts:13-54`).
- Electron main constructs both bridges but registers only harness and Workspace IPC (`apps/desktop/src/main/main.ts:91-114`, `apps/desktop/src/main/main.ts:201-214`).
- The production renderer currently consumes only harness status, subscription, and retry. It does not call the available Workspace methods (`apps/desktop/src/renderer/app.tsx:63-141`).

### Workspace Capability Status
- Protocol contracts already describe Conversation, Context Record, Frame Review, and Memory Library projections plus their associated intents (`packages/protocol/src/workspace-protocol.ts:70-96`, `packages/protocol/src/workspace-protocol.ts:130-477`).
- `createWorkspaceApplication()` routes typed operations to Conversation, Frame, and Memory owner ports, validates projections, translates producer failures, and combines invalidation subscriptions (`apps/harness/src/workspace-application.ts:78-235`).
- Production process bootstrap deliberately installs `createUnavailableWorkspaceApplication()` (`apps/harness/src/process-bootstrap.ts:91-98`). Its three capability owners return `WORKSPACE_CAPABILITY_UNAVAILABLE` and publish no notifications (`apps/harness/src/workspace-application.ts:237-255`).
- Consequently, Workspace transport is truthful and safe but no Conversation, Frame, or Memory product workflow is operational. The prototype UI is not production behavior and runs without preload (`apps/desktop/src/main/main.ts:159-177`).

### Current Product Boundary
- The canonical and runtime databases currently contain Storage metadata, identity, and migration-owned foundation tables rather than persisted Conversation, Frame, Memory, Execution, or Evidence product state (`apps/harness/src/storage/canonical-schema.ts:5-40`, `apps/harness/src/storage/runtime-schema.ts:5-40`).
- Production composition contains Project Storage plus an unavailable Workspace application; no active-Project selection coordinator or product-domain producer is composed (`apps/harness/src/process-bootstrap.ts:83-98`).
- Backup, export, restore, reset, delete, repository tooling, agents, and broader Execution/Evidence workflows are outside the implemented Project Storage slice (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:93-102`, `PRODUCT.md:70-121`).
- Accordingly, `opened/read-write` means a healthy retained Storage session. It does not mean the product can yet persist or execute a complete user workflow.

### Retained Shutdown
- Desktop shutdown retains one Promise and orders Project Storage bridge stop, Workspace bridge stop, then awaited supervisor stop. Quit re-entry and package/startup failure paths reuse that chain (`apps/desktop/src/main/desktop-shutdown.ts:9-63`, `apps/desktop/src/main/main.ts:39-45`, `apps/desktop/src/main/main.ts:239-267`).
- Both bridges reject new work and settle pending requests before the session is detached (`apps/desktop/src/main/project-storage-bridge.ts:116-156`, `apps/desktop/src/main/workspace-bridge.ts:140-196`).
- Supervisor stop detaches the port first, waits up to five seconds for natural child exit, kills only as fallback, and still resolves only after an exit event (`apps/desktop/src/main/harness-supervisor.ts:94-148`).
- Port close invokes one retained runtime stop; runtime detaches intake before awaiting Project Storage owner cleanup (`apps/harness/src/process-entry.ts:89-97`, `apps/harness/src/process-shutdown.ts:9-19`, `apps/harness/src/harness-runtime.ts:129-138`).
- Shutdown has an unbounded terminal path: after the five-second fallback calls `child.kill()`, the retained stop Promise still waits indefinitely for an `exit` event. If that event never arrives, normal quit, startup failure, package-smoke failure, and cleanup remain pending through Desktop shutdown (`apps/desktop/src/main/harness-supervisor.ts:130-148`, `apps/desktop/src/main/desktop-shutdown.ts:23-63`). An explicit terminal policy is required before shutdown can be described as safe or bounded.

### Privacy And Observability
- Sentry initializes only when the external environment supplies both `SLOPSTOP_SENTRY_CONSENT=1` and a DSN (`apps/desktop/src/main/crash-reporting.ts:7-15`). [Decide Sentry scope for Foundation Closure](https://github.com/TheMastermindPT/slopstop/issues/3) accepted that disabled-by-default environment gate for the foundation and explicitly deferred product-facing consent/configuration plus live ingestion to a dedicated future issue; this research does not reopen that settled consent scope. The current `beforeSend` removes request, user, contexts, extras, breadcrumbs, source context, and variables, and reduces `frame.filename` to a basename; explicit harness crash reports contain only a fixed message and numeric exit code (`apps/desktop/src/main/crash-reporting.ts:15-60`). It does not explicitly clear Sentry's `frame.abs_path`, so the prohibition on transmitting full local paths is not yet proven.
- Cross-process bootstrap, protocol, Storage, and shutdown errors are reduced to stable generic messages before they reach protocol results (`apps/harness/src/process-entry.ts:38-45`, `apps/harness/src/project-storage-application.ts:58-97`, `apps/harness/src/storage/project-storage-node-application-client.ts:106-177`).
- Residual production risk exists in local logs: supervisor stdout/stderr chunks and startup errors are logged as raw values, and harness uncaught exception/rejection handlers also log raw values (`apps/desktop/src/main/harness-supervisor.ts:256-286`, `apps/harness/src/process-entry.ts:101-108`). Key-name Pino redaction does not sanitize secrets or paths embedded inside arbitrary strings (`apps/desktop/src/main/logger.ts:35-44`, `apps/harness/src/process-entry.ts:29-36`).
- Log retention has no finite enforced byte bound. Desktop main checks the 5 MiB threshold only before opening the destination, rotates an arbitrarily large active file to `.1` only at startup, and then permits the new active file to grow without runtime rotation. Both per-file and aggregate retained bytes can therefore exceed the nominal threshold without a hard bound (`apps/desktop/src/main/logger.ts:6-25`).
- These flaws have no direct native-packaging dependency, but they violate binding repository privacy and bounded-log requirements. The current handoff recommends closing them before further implementation, while the current Project Storage tickets do not include that delivery-order requirement (`AGENTS.md:43-50`, `.rpiv/artifacts/handoffs/2026-09-02_20-05-30_project-storage-plan-and-tracker-repair.md:43-46`, `.rpiv/artifacts/handoffs/2026-09-02_20-05-30_project-storage-plan-and-tracker-repair.md:61-65`). Tracker authority must decide whether they enter the Project Storage prerequisite or a separate blocking ticket; this research does not silently promote the handoff recommendation into implementation authority. The eventual work requires explicit contracts for sanitization, truncation, per-record limits, and runtime rotation; this research does not invent their values.

### Missing Phase 6 Package Proof
- Current harness Vite configuration copies generated migrations and externalizes Node built-ins only (`apps/desktop/vite.harness.config.ts:7-32`). It does not externalize raw `libsql` or copy its target-specific native dependency closure.
- Harness dependencies include `@libsql/client` but not the direct raw `libsql` ownership required by Phase 6 (`apps/harness/package.json:18-24`).
- Forge has no native auto-unpack plugin, migration `extraResource`, or staging-source exclusion (`apps/desktop/forge.config.ts:6-54`).
- No package-smoke authorization or Project Storage scenario module exists. Optional smoke mode activates only in packaged, non-prototype mode with `SLOPSTOP_PACKAGE_SMOKE=1`, but that mode does not validate a root, token, marker, or scenario before bootstrap (`apps/desktop/src/main/main.ts:46-80`, `apps/desktop/src/main/main.ts:180-200`).
- The package launcher runs one renderer-boundary child. It does not preflight migrations/native bindings, exercise invalid authorization, reuse one root across bootstrap/missing-runtime/witnessed-staging scenarios, or prove child-close-before-mutation cleanup (`apps/desktop/tests/e2e/package-smoke.mjs:6-58`).
- The renderer smoke verifies isolation and the honest unavailable Workspace result, not packaged persistent Project Storage (`apps/desktop/src/main/package-smoke-verifier.ts:21-65`, `apps/desktop/src/main/package-smoke-verifier.ts:82-119`).
- The plan itself still has Phase 6 verification unchecked (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11348-11359`). The prior handoff's completed wording referred to design and planning, not production implementation (`.rpiv/artifacts/handoffs/2026-09-01_19-56-25_proximo-agente-implementacao.md:19-23`).
- Earlier verification records also remain incomplete: Phase 4 has an unchecked historical red-proof criterion and seven unchecked manual checks, while Phase 5 has an unchecked historical red-proof criterion (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:8683`, `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:8695-8701`, `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:10269`). The Phase 4 record contains only Green evidence, and the Phase 5 record explicitly says required tests were not executed before implementation or their exact Red output was not captured (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11579-11586`, `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11610-11622`). Those historical pre-implementation observations are therefore unavailable and cannot be recreated after the behavior exists. Because repository rules require a failing test before implementation, forbid product-domain exceptions from waiving that rule, and require a failed gate to be reported broken, the revised plan must report the historical-red gate as broken (`AGENTS.md:33-36`, `AGENTS.md:60`). Only independently redoing the affected behavior from a genuinely failing public seam under a new authorized sequence can produce compliant Red evidence.
- Plan concern C51 is stale rather than unresolved: the unaccepted working tree now binds every blocked create reason to its exact diagnostic code and exhaustively rejects contradictory mappings (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11486`, `packages/protocol/src/project-storage-protocol.ts:197-240`, `packages/protocol/src/project-storage-protocol.test.ts:111-149`). The recovery plan records that current Green as unaccepted, assigns a fresh failing public-seam matrix and implementation to Phase 1, and does not treat the dirty-tree result as authorization.
- Plan concerns C51-C54 were deferred in the historical review table. C52-C53 are implementation gaps because same-name CHECK expressions and partial-index `WHERE` predicates can change while current verification still accepts their names and coarse metadata. C54 is a missing mutation-test matrix for same-name altered CHECK/index/foreign-key definitions; the existing foreign-key key already compares columns, target, actions, and match (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11486-11489`, `apps/harness/src/storage/database-schema-verifier.ts:92-109`, `apps/harness/src/storage/database-schema-verifier.ts:192-212`, `apps/harness/src/storage/database-schema-verifier.ts:243-248`). The recovery revision marks all four prospectively resolved: contracts lock before Phase 1, each failing test is added and observed first in its owning phase, C51 is implemented in Phase 1, and C52-C54 are implemented in Phase 3. This explicitly supersedes both conflicting older timing records.
- Phases 1-5 were written while the implementation ticket remained `needs-info` and natively blocked by the still-open design-and-plan ticket. The worktree must remain preserved for review, but resolving those tickets later cannot retroactively make the existing implementation authorized or restore missing historical Red evidence.
- The implementation ticket's current outcome requires a packaged Workspace consumer to distinguish persistence states. That conflicts with the designed main-only Storage boundary, the plan's explicit exclusion of renderer Storage APIs, and production's deliberately unavailable Workspace owners (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:93-100`, `apps/harness/src/process-bootstrap.ts:91-98`, `apps/desktop/src/shared/desktop-api.ts:11-29`).
- Privacy sanitization and runtime log rotation are binding repository requirements, but they are cross-cutting Desktop/harness hardening rather than scope currently named by the design-and-plan or implementation ticket. Tracker authority must explicitly add them to the Project Storage prerequisite or create a separate blocking ticket before the plan silently absorbs that work.
- The Phase 5 manual privacy criterion is marked complete even though live Sentry, supervisor, and harness logging contradict it (`.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:10282-10283`, `apps/desktop/src/main/crash-reporting.ts:31-46`, `apps/desktop/src/main/harness-supervisor.ts:256-286`, `apps/harness/src/process-entry.ts:101-108`). The revised plan must invalidate and reopen that criterion rather than leaving the checked evidence in force.

### Red Evidence Recovery Contract
- The existing Green working tree cannot supply chronological Red evidence. Preserve it untouched as a non-authoritative reference and perform any accepted redo in an isolated Git worktree/branch beginning at clean commit `f4685df`.
- Before implementation, the revised plan must enumerate every independently testable oracle clause in every Phase 1-5 Test Contract (`plan:716-734`, `plan:1927-1965`, `plan:6363-6470`, `plan:8579-8678`, `plan:10214-10264`). Each clause receives exactly one prospective disposition: genuine isolated redo required, behavior-preserving pre-existing Green with no production behavior change, non-behavior proof, or broken/unrecoverable. Historical Red records may remain cited as provenance but cannot satisfy prospective authorization or the new gate. A broad phase-level label is insufficient.
- Phase 5 Project Storage result forwarding (`plan:10240-10243`) is currently recorded as pre-existing Green and must not receive a fabricated failure. Phase 5 shutdown/restart and overlap clauses (`plan:10244-10251`, `plan:10260-10263`) lack required pre-implementation Red capture and require genuine isolated redo if they remain behavior requirements. Every Phase 4 clause requires evidence-level review because its current record contains only Green summaries.
- A clean redo brings only accepted artifacts into the isolated worktree, adds and observes each public test before its production behavior in the owning phase, then implements phases sequentially. C51-C54 contracts lock before Phase 1; C51 test and implementation enter Phase 1, and C52-C54 tests and implementation enter Phase 3. Harness exception/rejection privacy work enters the Phase 2 process-boundary sequence. Desktop supervisor shutdown/output bounding plus logger/Sentry privacy and retention enter Phase 5. Every vertical slice receives the repository-required sequence: failing public-seam behavior test, minimal Green implementation, passing focused test, then a separate review/refactor gate. The result must not reimplement Phases 1-5 and then apply a late remediation bucket.
- A broken/unrecoverable clause blocks successful final validation. No ticket edit, policy edit, weakened assertion, intentionally corrupted oracle, or invented failure can replace chronological Red evidence.

### Contract Decision Checkpoint
The developer accepted the following contracts on 2026-09-02 after the research repair:

- **Schema equality**: use token-normalized SQLite SQL for authoritative CHECK expressions and partial-index predicates. Normalize only insignificant spelling such as whitespace, recognized-keyword case, and equivalent identifier quoting. Preserve literal tokens, operators, punctuation, parentheses, and token order. Malformed or unsupported SQL fails as broken authority; it never degrades to name-only comparison. C54 adds same-name altered CHECK, partial-index, and full foreign-key-definition cases.
- **Schema timing**: lock C51-C54 contracts before isolated Phase 1; add and observe each failing test first in its owning phase, then implement C51 in Phase 1 and C52-C54 in Phase 3 before each phase reaches Green. This executable clean-baseline sequence explicitly supersedes both conflicting older timing records.
- **Shutdown terminal**: allow the existing five-second graceful period, issue `child.kill()`, then wait at most five additional seconds. If no `exit` arrives, detach process communication/output observation, emit stable path-free `HARNESS_SHUTDOWN_TIMEOUT`, and reject `stop()` so Desktop shutdown exits nonzero rather than reporting `stopped`. The revised design must retain a quarantined child identity or an equivalent fence that prevents a duplicate retry while process termination remains unconfirmed.
- **Local logs and privacy**: keep at most a 5 MiB active JSONL file and one 5 MiB archive, rotate during runtime before a write would exceed the active limit, and cap every serialized record at 8 KiB UTF-8. Child output and caught exception/rejection values become bounded metadata-only diagnostics rather than raw text. Sentry sanitization explicitly removes `frame.abs_path` while retaining issue 3's disabled-by-default environment gate and deferred product-facing consent.
- **Scope**: include the recovery inline. Harness exception/rejection privacy belongs to reopened Phase 2; Desktop shutdown/output bounding, logger rotation, and Sentry sanitization belong to reopened Phase 5. The admission gate before Phase 6 proves both.
- **Planning authority**: repair issue 86 in place after artifact acceptance. Its completion means accepted planning artifacts and an accurately revised issue 87, not implementation execution.
- **Packaged outcome**: revise issue 87 to prove packaged persistent Project Storage through the trusted main-to-harness boundary. Do not add a renderer/preload Storage API.
- **Mutation proof**: define separate executable harness and Desktop Stryker runs, each with exact mutate lists, included tests, commands, budget, and thresholds. The harness run owns schema authority; the Desktop run owns shutdown, process-output, logger, and Sentry behavior.

### Recommended Next Sequence
1. Do not implement yet. Translate every accepted checkpoint decision above into the design and plan before changing tracker authorization.
2. Following the current handoff's mandated order, revise the design and implementation plan before coding or changing tracker authorization. Lock C51-C54 contracts before Phase 1; add and observe each failing test first in its owning phase; implement C51 in Phase 1 and C52-C54 in Phase 3. Place harness exception/rejection privacy in Phase 2, and place Desktop supervisor shutdown/output bounding plus logger/Sentry privacy and retention in Phase 5. Use phase-owned remediation plus one explicit pre-Phase-6 admission gate, not a late post-Phase-5 remediation bucket. Preserve the Phase 1-5 working tree as unaccepted prior work; include the complete clause-level Red Evidence Recovery Contract; report every still-broken clause truthfully; invalidate and reopen the contradicted Phase 5 privacy criterion; and require every retained or revised Phase 1-5 automated Success Criterion (`plan:735-751`, `plan:1966-1986`, `plan:6471-6491`, `plan:8679-8704`, `plan:10265-10291`) and manual criterion to be rerun or individually replaced by accepted equivalent proof. No generic waiver or disposition satisfies them.
3. Validate and explicitly accept both the Project Storage design and revised plan as authority for future work. Only then repair issue 86 in place to represent the accepted recovery planning workflow, fully specify it, correct its labels, and explicitly claim it before any implementation. Do not remove the implementation ticket's `needs-info`, leave a transition with no native blocker, or treat existing source as authorized.
4. Post the accepted artifacts and truthful prior-work/evidence findings on issue 86. Close issue 86 only when its planning responsibilities are complete: the recovery design/plan is accepted and issue 87 accurately carries the resulting implementation contract and blockers. Phase 1-6 execution remains issue 87's responsibility and cannot be an issue 86 closure condition. Update the parent delivery issue's current frontier consistently. At this tracker stage, remove issue 86's current `ready-for-agent` label while its revised scope is not fully represented; re-add it only after specification and explicit claim. The GitHub dependencies API currently returns it as the implementation ticket's blocker ([current dependency endpoint](https://api.github.com/repos/TheMastermindPT/slopstop/issues/87/dependencies/blocked_by)).
5. Revise [Implement Project Storage opening and health classification](https://github.com/TheMastermindPT/slopstop/issues/87) with the accepted main-process packaged outcome, phase order, public seams, file map, success criteria, inline recovery scope, unaccepted prior-work status, and clause-level Red-evidence matrix. Only after issue 86 is accepted and closed may the implementation ticket remove `needs-info`, add `ready-for-agent`, and be explicitly claimed.
6. Once authorized and claimed, preserve the current dirty worktree untouched as a non-authoritative reference and create a separate isolated Git worktree/branch from clean commit `f4685df`. Bring only the accepted design, plan, and public tests into that worktree phase by phase; observe each genuine failure before adding its production behavior, and never create Red by weakening or intentionally corrupting an oracle. Reimplement Phases 1-5 there with every remediation integrated into its owning phase and enforced by the pre-Phase-6 gate. Integrate only the independently validated result through an explicit non-destructive user-approved path; never reset, clean, or overwrite the existing dirty worktree.
7. Then finish Phase 6: native libSQL staging/unpacking, packaged migration resources, authorized smoke roots, the three persistent package scenarios, negative authorization matrix, and close-owned cleanup proof.
8. The revised plan must make its terminal proof set executable by naming every command after the outstanding contracts are decided. Known required entries are `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts`, `pnpm --filter @slopstop/desktop typecheck`, `pnpm check`, `pnpm test:integration`, `pnpm check:architecture`, `pnpm package:smoke`, `pnpm check:deep`, and `/rpiv:validate .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`. The existing `pnpm --filter @slopstop/harness db:generate:check` is not sufficient because `git diff --exit-code -- drizzle` misses staged and untracked generated files (`apps/harness/package.json:14`); the revised plan must test and replace its implementation with a named command that asserts an explicit clean/indexed baseline and no tracked, staged, unstaged, or untracked `drizzle` output, then include that exact command in terminal proof. Execute every retained/reopened/replacement Phase 1-5 manual criterion and every Phase 6 manual package inspection. Record the prior 103/103 Phase 4 classifier result and the unassessed whole-storage run without extending either claim to new code. The revised Test Contract must either define separate executable harness and Desktop Stryker configurations with exact mutate lists, test includes, commands, budgets, and thresholds, or record per-surface risk-based no-mutation decisions with rationale; the current generic and Project Storage configurations do not cover the complete scope, and the harness-rooted Project Storage runner cannot exercise Desktop files (`stryker.config.json:3-19`, `stryker.project-storage.config.json:3-15`, `apps/harness/vitest.project-storage-mutation.config.ts:3-15`). Then create the explicit final implementation-validation artifact required by the implementation ticket. Its result must remain broken unless every affected clause and Success Criterion received its accepted disposition/proof and every genuine behavior change was independently redone through a compliant Red-Green-review/refactor sequence.
9. Only after truthful Project Storage validation and authorized closure, return to [Deliver the canonical trust spine and first durable Workspace capability](https://github.com/TheMastermindPT/slopstop/issues/85): canonical writer/fencing/Typed-command settlement, then Board admission/read positions, then real Conversation and Frame owners. Supervised Run/Worker execution is outside that issue's authorized sequence.

## Code References
- `apps/harness/src/process-bootstrap.ts:68-98` - Validated persistent production composition.
- `apps/harness/src/harness-runtime.ts:44-138` - Versioned command dispatch, result emission, notification forwarding, and retained stop.
- `apps/harness/src/project-storage-application.ts:58-179` - Owner outcome validation and public failure mapping.
- `apps/harness/src/storage/project-storage-store.ts:398-603` - Project Storage lifecycle, sessions, locks, and shutdown.
- `apps/harness/src/storage/project-storage-opening.ts:192-235` - Writable versus safe-mode classification.
- `apps/harness/src/storage/project-storage-node-adapters.ts:460-719` - Node registry, migration, filesystem, database, and lock dependencies.
- `apps/desktop/src/main/harness-supervisor.ts:94-178` - Retained stop and health-event ownership.
- `apps/desktop/src/main/project-storage-bridge.ts:90-230` - Main-process Storage request correlation and failure handling.
- `apps/desktop/src/main/workspace-bridge.ts:121-314` - Workspace correlation, notification, and revision handling.
- `apps/desktop/src/main/main.ts:180-267` - Live Electron composition and retained exit paths.
- `apps/desktop/src/shared/desktop-api.ts:11-29` - Exact renderer-visible API.
- `apps/desktop/vite.harness.config.ts:7-32` - Current migration-only harness staging.
- `apps/desktop/tests/e2e/package-smoke.mjs:6-58` - Current renderer-boundary-only package smoke.

## Integration Points

### Inbound References
- `apps/desktop/src/main/main.ts:191-224` - Electron creates trusted bootstrap, supervisor, and both bridges.
- `apps/desktop/src/preload/preload.ts:13-54` - Renderer calls harness status and Workspace operations through context isolation.
- `apps/desktop/src/main/desktop-shutdown.ts:23-59` - Quit and failure paths initiate retained harness shutdown.

### Outbound Dependencies
- `packages/protocol/src/protocol.ts:61-100` - Process command/event and bootstrap validation.
- `packages/protocol/src/project-storage-protocol.ts:109-263` - Strict Project Storage request/result vocabulary.
- `apps/harness/src/storage/project-storage-node-adapters.ts:460-719` - Persistent Node/libSQL implementation.
- `apps/harness/src/workspace-application.ts:194-255` - Workspace routing and currently unavailable production owner.

### Infrastructure Wiring
- `apps/desktop/src/main/harness-supervisor.ts:295-349` - Utility process, message-channel transfer, and handshake.
- `apps/harness/src/process-entry.ts:68-99` - Utility-process entry and shutdown observer.
- `apps/desktop/vite.harness.config.ts:21-32` - Harness bundle and migration staging.
- `apps/desktop/forge.config.ts:15-53` - Current Electron package build and security fuses.
- `apps/desktop/package.json:9-16` - Package, launch-smoke, and E2E commands.

## Architecture Insights
- Project Storage is a separate harness-owned lifecycle capability, not a Workspace query and not a renderer filesystem API.
- Strict schemas own every process and renderer trust boundary; expected failures remain discriminated results.
- The architecture intentionally permits transport scaffolding to exist before a producer, returning explicit unavailable instead of fabricated empty success.
- Canonical Project state and derived runtime state are independently persisted and independently health-classified.
- Main owns trusted local paths and process lifecycle; renderer receives neither paths nor Storage operations.
- Persistence mutation is fail-closed: prior-state witnesses, authority disagreement, unsupported versions, and uncertainty never degrade to clean absence.

## Precedents & Lessons
3 similar past change groups were analyzed.

### Precedent: Workspace Production-Boundary Tracer Bullet
**Commit(s)**: `c3ac1e8` - "feat(workspace): establish production boundary tracer bullet" (2026-08-25)
**Blast radius**: 38 files across protocol, harness, desktop main, preload, renderer, E2E, and tooling.

**Follow-up fixes**:
- No code follow-up commit was recorded; `6356230` captured final validation.

**Lessons from docs**:
- `.rpiv/artifacts/plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md` - Missing production owners must remain explicitly unavailable or broken.
- `.rpiv/artifacts/validation/2026-08-25_20-05-32_workspace-production-boundary-tracer-bullet.md` - Transport, ownership, correlation, invalidation, and package proof are separate verification obligations.

**Takeaway**: Reuse the validated transport seam, but do not replace unavailable with success until a real canonical owner exists.

### Precedent: Harness And Desktop Process Foundation
**Commit(s)**: `1789aad` - "feat: establish the SlopStop foundation" (2026-08-20)
**Blast radius**: 99 files across CI, kernel, protocol, harness, Electron, renderer, E2E, and architecture documentation.

**Follow-up fixes**:
- `c3ac1e8` added the application/session seam missing from bootstrap-only transport.

**Lessons from docs**:
- `.rpiv/artifacts/plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md` - Supervisor owns process health and recovery, not domain dispatch.
- `.rpiv/artifacts/handoffs/2026-08-14_19-24-21_fechar-fundacao-codescene-api.md` - Structured-clone and packaged proof are required boundary evidence.

**Takeaway**: Preserve lifecycle ownership while adding capabilities behind the runtime boundary.

### Precedent: Storage And Execution Lifecycle Decisions
**Commit(s)**: `4ddd542`, `171aeb8`, `d155890` - Storage recovery, physical persistence, and execution lifecycle decisions (2026-08-26)
**Blast radius**: 9 documentation and product-context files.

**Follow-up fixes**:
- No implementation follow-up commit was recorded in history; current Project Storage changes are newer working-tree state.

**Lessons from docs**:
- `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md` - Baseline Storage gap investigation.
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md` - Main-only bridge and trusted-root design boundary.
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` - Six-phase implementation and verification contract.

**Takeaway**: Treat package proof and safe lifecycle shutdown as part of shipping persistence, not optional follow-up polish.

### Composite Lessons
- Explicit unavailable states are a deliberate architecture feature, not an incomplete-success substitute.
- Process, source integration, and packaged execution require independent proof.
- Do not expose persistence mechanics to the renderer merely because the main-to-harness bridge exists.
- Await shutdown through every layer so database handles and filesystem cleanup cannot race process exit.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md` - Project Storage baseline research.
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md` - Project Storage architecture and slice design.
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` - Six-phase Project Storage implementation plan.
- `.rpiv/artifacts/solutions/2026-08-31_20-24-41_self-evolving-harness-and-developer-leverage.md` - Strategic options whose own decision record defers implementation order to the GitHub roadmap.
- `.rpiv/artifacts/handoffs/2026-09-01_19-56-25_proximo-agente-implementacao.md` - Historical implementation handoff.

## Developer Context
**Q (`apps/desktop/vite.harness.config.ts:7-31`, `apps/desktop/tests/e2e/package-smoke.mjs:21-58`): Should the next recommendation finish the missing package phase, start the first usable workflow, or prioritize production hardening?**
A: Finish the Phase 6 package outcome before starting a product workflow, after replacement planning authority and the selected schema, shutdown, privacy, and bounded-log remediation path are decided, accepted, implemented, and verified.

## Related Research
- `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md`

## Resolved Contract Decisions
- Authoritative CHECK expressions and partial-index predicates use token normalization limited to whitespace/comments, recognized-keyword case, and equivalent identifier quoting. Literals, operators, punctuation, grouping, and token order remain significant; malformed input is broken authority. Same-name CHECK, partial-index predicate, and full foreign-key-definition mutations must fail closed.
- Harness fatal values and Desktop child output are metadata-only. Desktop JSONL records are at most 8 KiB UTF-8; oversized records become one valid controlled `LOG_RECORD_TRUNCATED` object. Runtime rotation retains one 5 MiB active file and one 5 MiB archive.
- Desktop waits five seconds for graceful harness exit, kills once, then waits five seconds for terminal exit. Missing `exit` rejects with `Harness shutdown timed out.`, reports `HARNESS_SHUTDOWN_TIMEOUT`, exits nonzero, and fences duplicate start/retry until termination is confirmed.
- Privacy and bounded-log remediation stay inside their owning Project Storage phases: harness fatal handling in Phase 2 and Desktop child-output/logging/Sentry handling in Phase 5. Sentry removes `frame.abs_path` while preserving issue #3's disabled-by-default environment consent and DSN gate.
- Packaged proof uses the designed main-process-to-harness Storage boundary and adds no renderer/preload Storage API.
- Every genuine Phase 1-5 behavior is redone prospectively in an isolated worktree from `f4685df`, except the already-Green Project Storage result-forwarding behavior, which is rerun without a fabricated Red or production delta.
- Issue #86 is repaired in place after artifact acceptance and closes when planning responsibility and issue #87's implementation contract are complete. Issue #87 remains blocked and `needs-info` until that repair is applied.

## Deferred Questions
- Should correlated per-request `system.failure` events remain supervisor-global crashes, or should only uncorrelated/system failures own process recovery?
- Where should active-Project selection live once the controlling canonical-writer and Board sequence reaches the product-shell boundary?
