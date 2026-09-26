---
date: 2026-09-12T22:45:37+0100
author: Pedro Mesquita
commit: 97678d2
branch: main
repository: slopstop
topic: "Persistent primary Project Conversation — PC-S1 revised intent"
tags: [design, conversation, workspace, persistence, ragnarok]
status: in-review
last_updated: 2026-09-12T23:59:35+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Resolve approved v1 intent-review findings; preserve all PC-B behavior IDs."
content_hash: 15d5cc9583d1379710cefd6a6b6d79801b21f513a731d872e5d9251f9d26acde
---

# Persistent Primary Project Conversation — PC-S1 v2

## Intent

Deliver Project entry as the first prerequisite of persistent Conversation: register an existing Git working tree, list/select the same Project after restart, and preserve identity and failures without modifying the repository. PC-S1 does not deliver model responses, Frame acceptance, Board or completed onboarding. Those remain the agreed Conversation-first roadmap's later slices.

This revision incorporates the developer's approval to resolve every finding in the v1 independent review and explicitly allow Git to read effective local configuration, including referenced configuration outside the selected repository. Scope remains document-only until reviewed intent and bounded build workspace are approved.

## Contract Identity And Inheritance

The complete v1 brief is preserved byte-for-byte at `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-brief.md`, raw SHA-256 `24d799c3d4d126f4ff7ecb60b16f6b72a862532ece8e568dbff6e33b65dd116f`, stamped `content_hash: 85e613dcb9850da6153ca90f2fb703db7e7a3bb7144a7a93895d4fc69ed34abf`.

Inherit its Intent, Architecture, Decisions, Next Slice, PC-B1 through PC-B9 Test Contracts, Success Criteria, Deferred Work and authority references **except the explicitly replaced commitments below**. This file is the current amendment owner; the frozen v1 file owns unchanged clauses. Resolve the effective contract as those unchanged clauses plus the named replacements, not as two competing options. No application code exists in either document.

Replacements: the configuration-read qualification is settled by Decision D1; bounded-child-cleanup language is replaced by D2; unspecified physical identity is replaced by D3; post-bootstrap worktree association is fixed by D4; broad failure alternatives are replaced by D5; the exact Test Contract additions/replacements below close the remaining verification gaps. Historical proposal wording or pending-decision statements in v1 cannot override these replacements. All unaffected requirements, restrictions, behavior IDs and prior evidence remain intact.

## Architecture

Keep the v1 ownership model: native desktop selection; harness-owned Project registration, location registry and observer; canonical initial binding/Workspace inside staged fresh-generation bootstrap; later association through the active Project writer; opaque validated renderer operations; Conversation outside canonical settlement in its following slice.

The v1 installation-registry compatibility contract remains normative: exact independent old/current schema specifications, additive `0001_project_registration` under application format/schema version 1, one SQLite write transaction from old-head validation through final validation/commit, explicit uncertain-commit reconciliation, no Project-database migration or inferred fresh initialization from missing bytes. Existing initial-create authority remains distinct from ADR 0005's later Storage operations.

## Decisions

### D1 — Explicit configuration-read authority

The developer answered “ok” to the explicit effective-local-configuration read question and to correcting the remaining v1 gaps. Before inspection, the registration interface explains that Git reads repository administration and effective local Git configuration, including its `include`/`includeIf` references outside the worktree. The user's inspect/confirm flow grants that read scope; refusal launches no observer. This is an explicit extension of allowed **reads**, not merely a non-disclosure test.

Replace v1's absolute “no credential access” wording for this observer with: no credential resolution, credential-helper/askpass invocation, credential-store API, remote authentication or network operation. A configuration file may itself contain a sensitive value; Git may parse it under the approved read grant. Neither configuration contents nor raw diagnostics are persisted, logged, sent to models/telemetry or exposed publicly. Public errors use stable application-authored text and codes; raw stderr exists only in the bounded transient observer buffer. Global/system config remains suppressed by the v1 environment policy. This is not a filesystem sandbox or an authorization for arbitrary file queries.

Keep the six closed `rev-parse` suffixes, exact prefix/environment, executable confirmation and 8,192-byte stream/2,000-ms-child/10,000-ms-phase ceilings from v1. The 18-call sample justifies calling these provisional headroom choices, not production benchmarks. No automatic fallback, installation or scope expansion occurs.

### D2 — Finite observer lifecycle and owner-loss continuity

Observer cleanup policy `registration-child-cleanup/v1` uses an absolute 5,000 ms budget starting when any terminal failure, cancellation or observation deadline first occurs. These cleanup values are explicit provisional policy choices, not measured shutdown performance or lock-expiry authority. Close observer admission immediately. At offset 0 request graceful termination if the platform supports it; at offset 2,000 ms request forced termination if the exact child is still alive; at offset 4,000 ms classify unconfirmed process disappearance as cleanup-unconfirmed. Confirmed exit still requires stdout/stderr EOF; retain the final 1,000 ms for outstanding stream closure. At offset 5,000 ms settle the diagnostic even when cleanup is unconfirmed. An observation failure remains failure even if cleanup succeeds. Equality at each deadline takes the timeout branch.

The implementation owns the returned process handle before subsequent setup and never acts on an unverified PID. POSIX termination targets the exact owned process group; Windows termination uses the platform owner of that child/tree, not a broad image-name kill. An unavailable ownership primitive is an explicit capability failure before dispatch; no unsafe weaker fallback is authorized. A wrapper that spawns an unowned Git process is not a compatible executable. Platform adapter implementation and package proof must establish these guarantees; no native dependency is assumed to exist or approved implicitly.

Persist a registration-observer attempt identity, executable identity, selected scope and `dispatch-intent` before spawning. When known, append the OS-qualified child identity (PID plus creation identity, never PID alone), and record terminal exit/stream/cleanup facts before clearing the durable unsettled marker. This diagnostic record is registration-owned; it is not an Evidence-family result or an Execution Process job. A crash after dispatch intent but before child identity is recorded remains explicitly unconfirmed, not proven-not-started.

Harness close cancels owned observations and awaits only the finite cleanup budget; it reports cleanup-unconfirmed if needed rather than hanging forever. On restart, unsettled attempt records keep new observer dispatch closed. A narrow owner reconciler may reopen admission only after proving the exact prior child/tree absent and no callback can publish. If identity is missing or absence cannot be proved, keep registration unavailable pending explicit recovery; PC-S1 does not invent an automatic reset/retry. Listing already stored state may remain available. Late output never publishes an observation or registration, and successful cleanup never releases a writer lease or registration reservation by itself.

### D3 — Versioned physical identity, not path identity

Persist the installation-scoped `physical-directory/v1` key as `(platform, volumeIdentity, fileIdentity, birthIdentity)` with all numeric identities encoded as canonical unsigned decimal strings. The adapter obtains these from lossless OS directory metadata; a Node bigint-stat implementation may use `dev`, `ino`, `birthtimeNs` only on a platform/filesystem combination for which the birth value is actual creation identity, not ctime fallback. Do not convert to Number, milliseconds or Date. Do not use mtime/ctime, lowercased path, remote URL or content hash as the identity key.

PC-S1 targets local Windows NTFS and Linux ext4/XFS only when the platform adapter proves that capability for the selected volume. Network/virtual filesystems, unsupported birth identity, zero/invalid identity fields, unknown volume type or inability to establish locality return `IDENTITY_CAPABILITY_UNAVAILABLE` before reservation. A positive birthtime alone is not a capability proof. Do not report Windows support merely because `statfs.type` is zero or an inode exists. Actual platform APIs/dependencies must be selected and verified before building their adapter; unsupported behavior remains explicit and may block a platform's package acceptance.

Resolve aliases to the same physical tuple only when the filesystem confirms them. On case-sensitive filesystems, different-case directories remain different. Store directory locations separately; at reopening compare common-directory tuple and administrative association against the persisted binding/observation. Changed tuple at the old location returns `REPOSITORY_IDENTITY_CHANGED`; missing original location remains missing and is not inferred from another path. Same-volume rename may preserve the tuple but automatic relocation is still deferred. Reboot/remount/restore/copy and file-ID reuse are not assumed to preserve lifetime continuity. If continuity cannot be demonstrated, require explicit reassociation/recovery rather than inheriting the previous Project.

Research observed Windows Node bigint inodes larger than `Number.MAX_SAFE_INTEGER` and equal root/common-directory tuples through dot/case aliases, but did not prove NTFS volume type, rename/replacement or Linux capability. This is feasibility input, not conformance evidence or adversarial anti-forgery proof. The approved shared-Project worktree rule remains unchanged.

### D4 — Second-worktree association through exact writer authority

Fresh registration initializes its first Repository binding and application Workspace before sealing. A later worktree B under the same common directory first resolves the existing Project P; never allocate a second P or replace A's location.

If P is not the active writable Project, confirmation returns `requires-project-selection` with P's identity and the original registration request; it does not switch Project or publish B as attached. UI offers a separate explicit selection of P. If P is active read-only, return `PROJECT_READ_ONLY` and retain a pending association without creating canonical rows. These pre-admission outcomes consume no canonical command settlement and may be retried with the original registration request after authority changes.

With P active writable, the registration application constructs the closed canonical command `identity.workspace.attach`, version 1. Its immutable payload binds Repository binding ID, proposed Workspace ID, expected binding revision, registration request ID and the exact admitted observation identity/digest; it contains no physical path or writer token. The trusted handler verifies the current Project/binding, observation authority and expected revision and atomically appends the canonical Workspace association, revision/current pointers and command event through the existing writer transaction. Installation records remain location/reservation authority only; the handler cannot trust a renderer-supplied observation.

Use one stable Command ID/fingerprint per exact confirmed association request, persisted before dispatch. Exact retry returns the original receipt. A stale expected binding revision is a typed rejection; changed content requires a new reviewed proposal/request, never mutation of the settled command. An equivalent association already established by another command returns unchanged after proving equivalence, without duplicating Workspace identity. Only applied settlement emits the association event.

Keep the installation location pending until the exact canonical association and receipt are verified. Lost writer response is reconciled by the original command identity through the existing fenced writer/repository path; no new command ID is invented. If the canonical association exists but location publication acknowledgment was lost, query exact persistent state and publish the same association once. An uncertain canonical outcome remains recovery-required. Switching away mid-attachment closes admission and drains the already admitted settlement before release; an old activation cannot settle a subsequent attachment.

### D5 — Closed public outcomes and deterministic precedence

Registration operations return discriminated outcomes: `cancelled`, `prepared`, `registered`, `already-registered`, `requires-project-selection`, `pending-recovery`, `unavailable`, `rejected` or `broken`. Each failure has one stable code below and generic path-free text. Preserve more detailed local diagnostics only as typed metadata, never raw Git/config text.

| Condition | Outcome / code | Writes permitted |
| --- | --- | --- |
| User declines before dispatch | cancelled | no Project/Storage allocation |
| Missing selected directory | rejected / REPOSITORY_NOT_FOUND | no reservation |
| Access denied observing selected target | unavailable / REPOSITORY_INACCESSIBLE | no reservation |
| Not a working tree or selected bare root | rejected / NOT_WORKING_TREE or BARE_REPOSITORY | no reservation |
| Malformed administration or malformed complete Git result | rejected / REPOSITORY_INVALID or OBSERVATION_INVALID | no successful association |
| Unsupported executable/options/layout/physical capability | unavailable / GIT_UNAVAILABLE, GIT_INCOMPATIBLE, REPOSITORY_UNSUPPORTED or IDENTITY_CAPABILITY_UNAVAILABLE | no reservation |
| Deadline/output/call limit exceeded | unavailable / OBSERVATION_LIMIT_EXCEEDED | no successful observation; retain cleanup fact |
| Physical association changed | rejected / REPOSITORY_IDENTITY_CHANGED | preserve old registration |
| Executable changed/unconfirmed | unavailable / GIT_CONFIRMATION_REQUIRED | no dispatch until confirmation |
| Existing P not active | requires-project-selection | no canonical attachment |
| Active P read-only or stale activation | unavailable / PROJECT_READ_ONLY or STALE_PROJECT_ACTIVATION | no canonical attachment |
| Stale binding revision or reused request with different content | rejected / ASSOCIATION_REVISION_CONFLICT or REGISTRATION_IDEMPOTENCY_CONFLICT | only prescribed durable rejection, no association |
| Unrelated prior-state witness / incomplete owned creation | pending-recovery / PRIOR_STATE_WITNESS or REGISTRATION_INCOMPLETE | no fresh initialization |
| Unsettled child or cleanup | pending-recovery / OBSERVER_CLEANUP_UNCONFIRMED | no new observer dispatch |
| Missing registry bytes with witnesses | pending-recovery / REGISTRY_MISSING_WITH_WITNESS | no new registry |
| Registry contention | unavailable / REGISTRY_BUSY | no unlocked bypass |
| Unknown/newer/corrupt registry | broken / REGISTRY_SCHEMA_UNKNOWN, REGISTRY_SCHEMA_NEWER or REGISTRY_CORRUPT | no migration/reset |
| Unexpected internal observation/registry failure | broken / INTERNAL_FAILURE | no false rejection or successful publication |

Validate request shape first; invalid protocol input retains the existing protocol failure contract. Next check unresolved observer ownership and installation compatibility, then executable consent, active-target authority where needed, target observation, proposal revalidation, reservation/idempotency and publication. Stop at the first failing stage; do not launch later stages to choose a more convenient code. Within one observer phase, cleanup-unconfirmed is the primary public result over its recorded trigger; output overflow beats parsing, nonzero exit beats parsing, capability inability beats identity comparison. Within registry inspection, missing witnessed bytes precede opening; malformed metadata/integrity corruption precedes head compatibility; known newer precedes unknown head; current/known-old healthy cases proceed. Retain the original trigger as a secondary typed code without changing success semantics.

For interrupted creation, the registration result is determined by exact persistent publication state, not an arbitrary completed-or-recovery choice: reservation only or staging/physical rename without committed active Storage pointer → `REGISTRATION_INCOMPLETE`; committed active Storage plus matching canonical initial binding but registration publication absent → `REGISTRATION_INCOMPLETE` until the narrow publication reconciler validates and settles that same registration; committed registered result with exact matching active generation/binding → return that original registered result even if its reply was lost. Inconsistent committed records → `broken`, never a completed association. No physical creation/migration is replayed during publication-only reconciliation.

## Next Slice

Retain `PC-S1` and PC-B1…PC-B9 unchanged in identity; no slice was accepted or built. Effective scope is register/list/select/reopen plus the exact observer/registry/association contracts above. Conversation message persistence remains the following slice. Source seams, affected owners and integration target stay those of v1. Build worktree/branch and treatment of uncommitted product documents require explicit approval after reviewed intent.

## Test Contracts

The complete PC-B1…PC-B9 definitions and public test seams remain at the frozen v1 brief's `## Test Contracts` under the exact hash above. Apply these replacements/additions to their Oracles; retain their behavior, seam, named tests and Expected red unless explicitly stated. Additional tests below use the same real transport/Electron seams, not private collaborator assertions. These are intent obligations, not recorded passes.

### Test Contract: revised oracles

- **PC-B2 (replacement flow):** register A and select P writable; confirm linked B under the same common directory. Assert one Project, two distinct canonically attached Workspace IDs, two retained private locations and the exact applied `identity.workspace.attach` receipt/current binding revision. Repeat B and assert no new Workspace/Project or applied event. Independent clone C creates a distinct Project. Also confirm B while another P2 is active → `requires-project-selection`, P2 unchanged and zero canonical writes; read-only P → `PROJECT_READ_ONLY` with zero canonical writes. Explicitly select writable P and retry original request to complete the same pending association. Test missing writer response before/after committed attachment and before/after location publication with exact original command/receipt identity. No pending location alone satisfies “attached”.
- **PC-B5 (additional matrix):** use D5's exact outcome/code pairs and precedence for every previous failure fixture; combine output overflow with invalid UTF-8, nonzero exit with malformed stdout, cleanup-unconfirmed with deadline and changed-directory input, and corrupt metadata with unknown head to prove stated precedence. No failure fixture can pass by matching only an arbitrary non-success union arm.
- **PC-B6 (replacement crash oracle):** individually inject interruption at reservation commit, staging creation, physical rename, active Storage commit, registration publication commit and lost response. Assert D5's exact persistent-state result and original IDs for each point. A committed registered result with a lost reply must return registered, not recovery. Add unrelated manifest/directory/registry/witness fixtures beside a new request: return `PRIOR_STATE_WITNESS`, allocate no new generation and preserve every witness byte. The request's own precise reservation is the only recognized bootstrap antecedent; it never suppresses unrelated witnesses.
- **PC-B7 (additional race):** in `apps/harness/tests/integration/project-registration.integration.test.ts`, hold an admitted attachment before settlement; request switch/close. New writes immediately fail admission while the existing operation can settle. No source writer release or target activation appears before the held operation completes. After release, submit using old activation and assert `STALE_PROJECT_ACTIVATION` with no receipt/event/Workspace/location publication. An observer-only pending operation follows D2's bounded cancellation instead of indefinitely blocking shutdown. Electron test verifies the pending/switching UI prevents new confirm actions and preserves the true active Project.
- **PC-B8 (additional exact cases):** current supported head → complete current validation and zero DDL/head/row changes; known-old healthy head → exactly one transactional migration with equal prior rows; missing application.db with an independent witness → `REGISTRY_MISSING_WITH_WITNESS`, no file creation and unchanged witnesses. Verify these across two competing processes. At each precommit fault the old committed schema remains exact; after uncertain commit, reopening yields exact old/current classification or explicit corruption, never a partially accepted schema. Old Project databases/manifests are byte-identical in all cases.
- **PC-B9 (replacement configuration oracle):** permit effective-config includes only after the visible D1 grant. In a controlled test fixture, include an external configuration file containing a sensitive canary. Its being read is permitted and demonstrated, while no canary/raw config or stderr reaches public results, logs, disk records, telemetry or model input. Refusing the grant produces no Git spawn. Configure failing credential/askpass/hook/network sentinels and prove none are called. Preserve all no-repository-mutation and narrow preload assertions from v1. This explicitly tests allowed reading separately from prohibited disclosure.
- **PC-B10 — Executable confirmation:** Seam: real Electron/preload plus observer transport; Test: `requires confirmation of the actual Git executable` → `apps/desktop/tests/e2e/project-registration.test.ts`. Oracle: no stored confirmation → show exact executable/version and launch zero identity queries until accepted; decline → cancelled; replace executable after confirmation → `GIT_CONFIRMATION_REQUIRED` and zero identity queries; reconfirm exact replacement → allowed observation. PATH and repository-local lookalikes never substitute. Expected red: current application has no such registration/executable-consent flow.
- **PC-B11 — Physical identity conformance:** Seam: the platform identity adapter exercised by registration transport over disposable directories; Test: `preserves lossless common-directory identity` → `apps/harness/tests/integration/project-registration.integration.test.ts`. Oracle: actual supported local volume reports lossless tuple; dot/case aliases match only when physically identical; linked worktrees share common key; independent clone differs; replace directory at same location → `REPOSITORY_IDENTITY_CHANGED`; process restart preserves established tuple; unsupported locality/FS/birthtime fallback → `IDENTITY_CAPABILITY_UNAVAILABLE`, no reservation. Include decimal values above 2^53 in portable contract cases and real Windows/Linux package conformance. A sampled positive inode alone is not a platform pass. Expected red: the platform capability/identity contract and registry matching do not exist.
- **PC-B12 — Cleanup and restart admission:** Seam: registration observer application/transport, plus real child integration; Test: `blocks observation until prior child ownership is settled` → `apps/harness/src/project-registration-observer.test.ts` and registration integration tests. Oracle: hold child terminal/EOF indefinitely, trigger deadline, then submit another observation → `OBSERVER_CLEANUP_UNCONFIRMED` and no second spawn. Observe requests at offsets 0/2,000 ms and public settlement by 5,000 ms under D2; no late output publishes. Confirm exact child absence and settle persistent marker → a later new request may spawn. Restart with dispatch-intent but no child identity stays blocked; never infer absence. Restart with exact provably absent child settles it before reopening. Exercise graceful success, force needed, exit without EOF, EOF without exit, termination error, POSIX/Windows supported owner, PID reuse and unsupported owner capability. At equality timeout wins, and no user/unrelated process is terminated. Expected red: the durable observer lifecycle and closed admission do not exist.

Retain v1's Success Criteria, adding focused new B10–B12 selections, actual platform capability/child-owner integration and revised code/status matrix. Unsupported platform support is a blocked required package proof, never a skipped success. No mutation gate or full-plan review is claimed to have run. Exact execution commands will use the verified repository scripts and scoped test names, preserving existing gate definitions.

## Deferred Work

Unchanged: local-message Conversation, model integration, Frame/map/Board, full onboarding, explicit old-Project migration, relocation/reassociation, broad storage operations, Execution/Evidence/Memory/Convergence. No current PC-S1 failure or platform requirement is silently deferred into those programs. Unknown child identity recovery stays explicitly unavailable in PC-S1, not a reset UI.

## Verification Notes

The v1 report remains failed and immutable: `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-review.md`. All findings are mapped to D1–D5 and PC-B2/B5–B12. SV-1/code-config → D1/B9; SV-2/code-cleanup → D2/B12; SV-3/code-association → D4/B2/B7; code-identity/coverage-identity → D3/B11; code-codes → D5/B5; code-crash → D5/B6; remaining coverage witnesses/registry/executable → B6/B8/B10. Developer approved addressing all recommendations; approval of the corrected exact intent remains pending review.

No product source/test/config change or candidate execution has occurred. Research samples were read-only observations of the current environment; they are not product verification. The earlier writer deep/Sonar qualifications remain unchanged. The new composite contract hash binds this entire amendment and the frozen v1 owner plus all prior normative references; v1 reviewer clearance cannot transfer to it.

## Developer Context And Follow-Up — 2026-09-12T23:59:35+0100

The developer approved effective local configuration reads after the coordinator explained that includes can reference external sensitive configuration, and approved fixing all remaining v1 findings. Preserve the accepted Conversation-first sequence, new-Projects-first policy, shared-Project linked-worktree rule and use of installed Git. No new source build or integration authority was requested or implied.

The canonical artifact path is unchanged. Its former bytes now live at the v1 snapshot path above with the exact original digest; the old packet's brief-path binding resolves there for historical reproduction. All other v1 bindings remain unchanged. There was no accepted candidate or TDD evidence to move. New PC-B10–PC-B12 refine verification at the same PC-S1 boundary rather than renumbering existing commitments.

## References

- Frozen v1 brief, raw hash and content hash given in Contract Identity And Inheritance; its referenced authorities remain part of this contract.
- `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1.json`
- `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-review.md`
- `docs/ragnarok-prototype-coordination.md`
- [Delivery #85](https://github.com/TheMastermindPT/slopstop/issues/85)
- [Node filesystem stat time semantics](https://nodejs.org/docs/latest-v24.x/api/fs.html#stat-time-values)
- [Git configuration includes](https://git-scm.com/docs/git-config#_includes)
