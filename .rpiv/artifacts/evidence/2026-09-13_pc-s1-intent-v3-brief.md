---
date: 2026-09-12T22:45:37+0100
author: Pedro Mesquita
commit: 97678d2
branch: main
repository: slopstop
topic: "Persistent primary Project Conversation — PC-S1 trusted-local prototype"
tags: [design, conversation, workspace, persistence, ragnarok]
status: in-review
last_updated: 2026-09-13T00:35:50+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Apply approved trusted-local scope and close v2 replay/admission/concurrency gaps."
content_hash: d4fe47ccce00a2cdf00fd9e93854fceb446d80239c8eaf8b1394a19b9527c66d
---

# Persistent Primary Project Conversation — PC-S1 v3

## Intent

Register, list, select and reopen an existing developer-trusted local Git repository as one Ragnarok Project. This is the first prerequisite for persistent Conversation; it does not deliver a model response, canonical Frame/map/Board, complete onboarding or a hardened environment for unknown repositories.

The developer explicitly chose this recommendation: “ok vamos com a tua recomendacao. o isolamento fica pra outra altura”. Strong isolation against hostile configuration is deferred, not implemented or silently declared safe. Repository mutation, arbitrary shell/model tools, credential-helper use and disclosure of config/diagnostics remain prohibited. No source candidate is authorized by this document.

## Contract Identity And Inheritance

The v2 amendment is preserved byte-for-byte at `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v2-brief.md`, raw SHA-256 `cfdfe1b215b102187135fc62c45b96895ef5a0647e9911989d2720b86511d069`, content hash `15d5cc9583d1379710cefd6a6b6d79801b21f513a731d872e5d9251f9d26acde`. Its frozen v1 owner is `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-brief.md`, raw SHA-256 `24d799c3d4d126f4ff7ecb60b16f6b72a862532ece8e568dbff6e33b65dd116f`, content hash `85e613dcb9850da6153ca90f2fb703db7e7a3bb7144a7a93895d4fc69ed34abf`.

Effective contract: unchanged v1 clauses, overridden by v2 D1–D5/Test Contract replacements, then overridden by the exact v3 replacements below. Preserve all PC-B1…PC-B12 IDs, seams, Expected red and success obligations not expressly replaced. This file owns the current changes; frozen files are immutable normative references for retained clauses and historical review reproduction. Previous failed reviews stay failed. No pending-authority wording in those historical versions can override a recorded v3 decision.

The replaced clauses are: the absolute hostile-config/no-network-filesystem guarantee (D6); D5 new-work-before-replay ordering (D7); executable version dispatch ambiguity (D8); nonzero-Git result mapping (D9); and D4 equivalent-association/revision precedence (D10). All other registration, identity, transaction, witness, lifecycle, privacy and platform-capability obligations remain binding.

## Architecture

Retain the reviewed ownership: desktop main native selection, harness-owned registration/observer/private location registry, existing staged fresh-Project bootstrap, post-bootstrap association through the active canonical writer, and narrow preload transport. Conversation persistence follows as its own owner outside canonical command sequencing. Git remains the installed trusted executable with the inherited closed argv/environment policy; there is no custom universal Git parser and no implied filesystem sandbox.

The scoped additive installation registry migration, old-Project safe-mode preservation, physical identity contract, 5,000 ms child cleanup policy and durable observer owner-loss admission remain as fixed in v2. PC-S1 still needs actual platform capability and package proof; this trusted-local scope does not waive process ownership, substitute paths for identity, or authorize a native dependency automatically.

## Decisions

### D6 — Approved initial trusted-local scope

Initial use is restricted by product contract to existing local repositories and installed Git executables that the developer already trusts. Selecting a folder alone does not attest that trust: before identity inspection, the UI identifies the chosen repository, explains configuration reads (including external includes), asks the developer to confirm trusted-local use and stores the decision against the exact proposal/selection identity. Refusal launches no identity query or registration. Trust for A does not authorize another selection or a materially replaced association; a new selection requires its own decision. This confirmation is not `safe.directory=*`, an executable trust substitute or a general permission to execute repository code.

The interface explicitly states: the prototype does not isolate hostile Git configuration; an include or filesystem redirection may cause the operating system to access a network location. Such OS-level access is **not mechanically prevented** in this scope. The user has approved deferring that protection. Do not claim an absolute zero-network/zero-OS-authentication guarantee for adversarial configuration, and do not treat this disclosure as support for registering remote repositories. Known nonlocal target/capability failures retain v2 refusals.

Keep zero application-issued Git network commands, remote authentication actions, credential helpers, hooks, shell expansion, model-directed commands and repository mutations. The allowlist and controlled environment continue to reduce accidental execution. Configuration/raw stderr must remain transient, bounded and excluded from logs, durable data, telemetry and model context. Local configuration reads are allowed under D1; no disclosure or arbitrary file-query capability is added.

**Replacement of earlier test claims:** no-network/helper/mutation assertions prove that the application dispatches only the allowed local operations and preserves the trusted disposable fixture, not that untrusted configuration cannot cause an OS network read. Remove the requirement to block SMB/UNC at the OS boundary from PC-S1 and track it as deferred ISOL-1 below. Do not run an actual remote-authentication experiment as a substitute for isolation proof.

### D7 — Durable replay precedes fresh observation

Separate `queryRegistrationRequest(requestId, fingerprint)` from admission of a new confirmation. Both validate the public request and registry authority first. A confirmed durable registration result is returned exactly, with its original IDs and outcome, without Git dispatch, new reservation, executable confirmation or target observation. Missing/moved target, pending unrelated observer cleanup or changed current access cannot rewrite that historical result. Current location/access health is a separate query/projection; an original successful receipt does not assert current writable availability.

Same request identity with a different fingerprint returns `REGISTRATION_IDEMPOTENCY_CONFLICT` before any target/executable work. For incomplete records, reconcile only the exact saved creation/association state under v2 D5; it may return the recorded pending/recovery outcome without creating new physical work. A replay lookup is not permission to resume physical creation. Only an unknown request or an explicitly resumed pre-admission request follows new-work admission.

New-work order is: protocol validation → registry availability/compatibility and exact request lookup → unresolved observer ownership → executable-stage consent → active-target authority when required → trusted-local repository consent and target observation → proposal revalidation → transactional reservation/idempotency recheck → creation/association/publication. No later stage executes after a failing earlier stage. Registry lookup/migration remains governed by its existing exact compatibility contract; malformed authority never yields a trusted replay. The transactional idempotency recheck still protects the race after the initial lookup.

### D8 — Two-stage Git executable admission

The user first selects/confirms the absolute installed executable **for a version inspection**. The UI explains this action runs only `--version`; declining means zero dispatch. That single query runs in an application-controlled non-repository cwd with the inherited clean environment and bounded process lifecycle. Trust is an explicit developer choice, not discovery through repository PATH. Verify executable identity before and after; a changed identity invalidates the result.

The second confirmation displays that exact executable and observed version and grants the six fixed identity queries for that executable identity. No identity query runs before this confirmation. An executable replacement invalidates both stages; do not execute its `--version` automatically using the former grant. If the executable/version cannot be verified, return `GIT_CONFIRMATION_REQUIRED` or the specific incompatibility/failure outcome. These stages clarify the existing first-use contract; they do not introduce a download or signature claim.

### D9 — Exact Git result classification

With process cleanup confirmed, any nonzero Git exit returns `unavailable / GIT_QUERY_FAILED`, with an application-authored generic diagnostic and numeric exit metadata only. Do not parse raw stderr to infer corruption, trust, credential or repository state. Malformed stdout plus nonzero exit still yields `GIT_QUERY_FAILED`; output overflow yields `OBSERVATION_LIMIT_EXCEEDED`; unconfirmed child ownership yields `OBSERVER_CLEANUP_UNCONFIRMED` above either, retaining the trigger as typed secondary metadata. Unexpected spawn/transport exceptions remain `broken / INTERNAL_FAILURE` unless an existing explicit capability/unavailability code applies.

Run the three boolean queries first. After their complete valid zero-exit results: bare=true → `BARE_REPOSITORY`; otherwise inside-work-tree=false or inside-git-dir=true → `NOT_WORKING_TREE`; only true/false/false admits path queries. Thus bare input does not need a failing `--show-toplevel` call to be classified. A non-Git/config-refused directory that produces nonzero exit uses `GIT_QUERY_FAILED`, not a guessed specific reason. Filesystem-observed absence/access/capability errors keep the exact v2 codes when actually established without interpreting stderr. This replaces any inherited oracle that demanded a more specific diagnosis solely from nonzero Git output.

### D10 — Competing worktree association

Each B association is reserved installation-locally by Project/binding plus proven administrative identity. Concurrent request IDs resolve the same proposed Workspace identity for that association; a losing request cannot allocate another Workspace. With P active writable, the handler validates Project/binding ownership and the registration observation's owner/request/digest first. An already committed exact equivalent association returns unchanged with its existing Workspace identity **before** testing an obsolete expected revision. If no equivalent association exists, enforce expected revision before any canonical write. A different target/payload is not equivalence.

Exact same Command ID/fingerprint retry returns the original receipt before handler execution, as the predecessor requires. Different Command IDs for equivalent B may produce one applied receipt plus unchanged receipts, but at most one canonical Workspace association, one ready private location and one applied association event. Each first unchanged/rejected settlement keeps the existing Project-sequence rules; do not demand zero receipts for a legitimate durable rejection.

The current writer may return transient `COMMAND_IN_PROGRESS` rather than queue simultaneous clients. Tests explicitly retry that same request/Command ID after the active settlement; no automatic new identity or observer-loop retry is implied. A separate harness without P's writer authority returns read-only/selection-required, never steals the lease. Conflicting observation/binding/revision failures remain distinct and never publish the pending location as ready.

New canonical rejection codes for version-1 `identity.workspace.attach`: `BINDING_PROJECT_MISMATCH` when the supplied binding is not owned by P; `OBSERVATION_NOT_AUTHORIZED` when its immutable registration observation is absent, not current for this request/selection or has the wrong owner/digest; `ASSOCIATION_REVISION_CONFLICT` when no exact equivalent exists and the expected binding revision is stale. These are expected domain rejections through the existing writer: first settlement creates its one durable rejection receipt/sequence, no applied event, no Workspace/revision/current-pointer update and no ready location publication. A stale writer refuses before settlement with no receipt/sequence, preserving the different authority failure.

## Next Slice

PC-S1 remains proposed register/list/select/reopen with no accepted candidate. No behavior ID is renumbered or removed. Strong hostile-config isolation is the sole explicitly deferred guarantee; registration integrity, local data preservation, exact retries, lifecycle and narrow renderer access stay mandatory. The following Conversation slice remains deferred until this predecessor is accepted.

Before implementation, agree the exact worktree/branch/start revision, handling of uncommitted product-identity documents, permitted test/build effects and current intent identity. This document remains under independent intent review, not blanket source-write or integration authority.

## Test Contracts

Retain all effective v1/v2 PC-B1…PC-B12 definitions with these named amendments. All execution evidence remains future; Expected red is the currently absent registration/observer behavior as previously specified. Public harness tests are exactly `apps/harness/tests/integration/project-registration.integration.test.ts`; Electron tests are exactly `apps/desktop/tests/e2e/project-registration.test.ts`. Observer lifecycle tests use `apps/harness/src/project-registration-observer.test.ts` in addition to the real integration cases.

### Test Contract: v3 corrections

- **PC-B2 — concurrent association and negative authority additions:** prepare two valid proposals for the same B before either settles. Use two transport clients against the active writer; exercise overlapping dispatch returning `COMMAND_IN_PROGRESS` and explicit same-ID retry, then separate Command IDs after the winning commit. Assert the one Workspace/ready location/applied event maxima in D10, one applied result and exact unchanged/original-receipt results for losers/retries. A second harness contending for the writer must produce no canonical write. A different target with the old revision gives `ASSOCIATION_REVISION_CONFLICT`, not unchanged. Through the public transport inject foreign-Project binding, absent/wrong-owner/digest observation and stale revision of a not-yet-attached target; assert D10's exact rejection code, one original durable rejection receipt/sequence, no applied event or association and no ready-location publication. Repeating each rejected Command ID returns that exact original receipt without another sequence. An old activation remains the separate no-settlement case.
- **PC-B5 — cross-stage precedence additions:** invalid protocol request plus pending cleanup → existing protocol invalid-input failure and zero registry/observer admission; valid new request plus witnessed missing registry and invalid selected target → `REGISTRY_MISSING_WITH_WITNESS`, no Git/path observation or file creation; healthy registry plus pending cleanup and unconfirmed executable → `OBSERVER_CLEANUP_UNCONFIRMED`, no version or identity spawn. With cleanup settled and no executable-version consent, dispatch stays zero. A matching completed registration request bypasses these new-work stages under B6, not by granting fresh dispatch. All simultaneous nonzero/overflow/parse/cleanup Git cases use D9's exact primary/secondary codes. Public assertions use rows/spawn capture and observable outcomes; no private-method call-count contract is introduced.
- **PC-B6 — completed-replay additions:** commit a complete registration, lose its response, then remove the repository location, invalidate Git confirmation and retain an unrelated unsettled observer marker. Query the exact original request/fingerprint: return the original registered result byte-for-byte with zero Git spawn, reservation or generation writes. The separate current-location query reports missing/unavailable honestly. Reusing the request with another fingerprint returns `REGISTRATION_IDEMPOTENCY_CONFLICT` without Git. A corrupted/unreadable registry cannot return a trusted result; use its exact existing failure. The owned incomplete-state matrix and unrelated-witness cases from v2 remain mandatory.
- **PC-B9 — exact locations and revised trusted-scope oracle:** test `honors trusted-local registration and keeps configuration private` in `apps/harness/tests/integration/project-registration.integration.test.ts` and `apps/desktop/tests/e2e/project-registration.test.ts`. Confirm the D6 disclosure/trusted-local decision before identity inspection; refusal launches zero identity queries. Use a trusted disposable repository with a permitted external **local** include and sensitive canary. Reading it is allowed; no canary/config/raw stderr reaches output, logs, durable state, telemetry or model input. Sentinels prove no application-issued network command/helper/hook/model call and no repository-byte mutation. Test the visible lack-of-isolation disclosure using inert simulated configuration metadata, not an actual SMB/remote-authentication attempt. Explicitly do not claim hostile-config/OS-network confinement; that oracle belongs to ISOL-1. Unknown/untrusted user choice stays unsupported/refused, not automatically trusted.
- **PC-B10 — version/identity consent replacement:** no stage-one grant → no spawn; approve the exact absolute executable for version inspection → precisely one bounded `--version` process in controlled non-repository cwd, zero identity queries; decline stage two → zero identity queries; accept stage two matching unchanged executable/version → only the six allowed identity queries. Replace executable between any stage or after consent → invalidate grants and require renewed stage one before executing the replacement. Verify PATH lookalikes never substitute and nonzero version result is `GIT_QUERY_FAILED` with no identity consent inferred. This replaces the ambiguous v2 “show actual version before any dispatch” requirement.

### Success Criteria

Preserve all inherited fast/integration/Electron/package, independent review, platform capability, CodeScene/Sonar and final-plan Validate→Deep Review obligations. Technical corrections do not turn prior reviews into passes. No production source/test change or execution occurred during this revision. The agreed risk boundary must be visible in the manual Project-registration journey and in the accepted intent; hostile-repository support cannot be inferred from successful trusted-fixture tests.

## Deferred Work

- **ISOL-1 — Hostile configuration and OS-network isolation:** explicitly deferred by developer on 2026-09-13. Before admitting untrusted repositories or claiming sandboxed/no-OS-network inspection, design and prove actual filesystem/process confinement, including UNC/SMB authentication, redirected paths, config includes, process descendants and adversarial races. Existing Git environment flags are not that proof. Reopen the threat model at that milestone, not through a silent retry or hidden fallback.
- All other previously deferred outcomes remain unchanged: Conversation messages, model integration, Frame/map/Board, full onboarding, broad Storage recovery/migration, relocation, Execution/Evidence/Memory/Convergence. No current data-integrity or lifecycle failure is waived by trusted-local scope.

## Verification Notes

v2 slice-verifier passed; code and coverage roles failed, so overall v2 remained failed. This revision addresses C2-1 through approved D6/ISOL-1, C2-2 through D7/B6, C2-3 through D8/B10, C2-4 through D9/B5, C2-5 and V2-1 through D10/B2, V2-2 through D7/B5 and V2-3 through B9's exact paths. All eight findings require fresh inspection at this composite identity. Source base remains `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`; no candidate proof is transferred.

## Developer Context / Follow-Up — 2026-09-13T00:35:50+0100

After the coordinator explained that an external Git include can cause OS network access, the developer chose trusted local repositories for the prototype and deferred strong isolation. This changes the initial threat-model guarantee and corresponding B9 oracle, not canonical/Storage authority, approved worktree identity, no-credential-helper policy or confidentiality. The remaining v2 findings are technical corrections to the approved behaviors; their dispositions and fresh review outcomes remain outside the normative brief.

v2 bytes were preserved at the snapshot path above with the same raw digest. The original v2 packet's canonical brief path resolves to that snapshot for historical inspection. v1 raw bytes, packets and reports remain retained. Current design approval and build authority are still separate required decisions.

## References

- Frozen v1/v2 brief paths, raw hashes and content hashes in Contract Identity And Inheritance; their original authorities remain required unless this revision explicitly overrides a scoped guarantee.
- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v2-review.md`
- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v2.json`
- `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-review.md`
- `docs/ragnarok-prototype-coordination.md`
- [Delivery #85](https://github.com/TheMastermindPT/slopstop/issues/85)
