---
date: 2026-08-20T19:27:59+0100
author: Pedro Mesquita
commit: cb4a683
branch: main
repository: slopstop
topic: "Runtime constraints that materially affect v1 program order"
tags: [research, wayfinder, electron, mastra, libsql, drizzle, git, worktree, typescript, lsp]
status: complete
last_updated: 2026-08-20T19:41:15+0100
last_updated_by: Pedro Mesquita
source_issue: https://github.com/TheMastermindPT/slopstop/issues/12
---

# Research: Runtime Constraints That Affect Program Order

## Research Question

Which current Mastra, libSQL/Drizzle, Electron utility-process, Git/worktree, model-provider, and TypeScript language-intelligence constraints materially change SlopStop's v1 program boundaries or ordering?

## Bottom Line

The confirmed architecture remains viable, with five important qualifications:

1. Electron `utilityProcess` is a supervised crash and lifecycle boundary, not a proven security sandbox. The harness has Node.js capability and must be constrained by SlopStop policy, permissions, workspace isolation, and process ownership.
2. ADR 0001 assigns libSQL ownership to the harness, but the reviewed Turso multi-process documentation does not cover the selected `@libsql/client` package. Windows multi-process behavior remains unknown and requires an exact-version packaged probe before any broader access design.
3. Deterministic run identity, recovery, approvals, cancellation, and event persistence must precede production Mastra background concurrency and effectful tools that may suspend, retry, or be redelivered. Small compatibility probes and provider capability probes may happen earlier without becoming canonical product evidence.
4. TypeScript's official `tsserver` is not an LSP server. Accepted product intent requires LSP lifecycle behavior, so the language-intelligence program must select a TypeScript/JavaScript LSP implementation or explicitly reopen that intent; direct tsserver is evidence, not an assumed substitute.
5. Git worktrees and language servers both need canonical workspace identity, process-job ownership, and explicit failure recovery before their results become canonical evidence or their side effects become product behavior. Isolated compatibility probes do not need to wait for the full production boundary.

This research establishes a partial order only. It does not choose the complete v1 program sequence.

## Local Baseline

| Area | Current repository fact | Authority |
| --- | --- | --- |
| Runtime | Node 24.19.0, pnpm 11.5.1, ESM/ES2022 | `package.json:7-10,55-60`; `docs/adr/0001-repository-foundation.md:15-21` |
| Electron | Electron 43.4.0; desktop already starts one supervised harness utility process | `pnpm-workspace.yaml:21-25`; `apps/desktop/src/main/harness-supervisor.ts:201-267` |
| Harness | The current harness proves only the versioned message-port handshake | `apps/harness/src/process-entry.ts:60-88`; `apps/harness/src/harness-runtime.ts:33-58` |
| Mastra | Not installed; must be added behind the project-owned `AgentRuntime` adapter with its first exercised behavior | `PRODUCT.md:41-43`; `docs/adr/0001-repository-foundation.md:28-31,79`; `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md:132` |
| Persistence | libSQL and Drizzle are not installed; the harness will own separate canonical and Mastra databases | `PRODUCT.md:42-43`; `docs/adr/0001-repository-foundation.md:52-59,79` |
| Providers | No product provider SDK is installed; credentials belong in Electron `safeStorage` | `apps/harness/package.json:13-16`; `pnpm-lock.yaml:229-236`; `docs/adr/0001-repository-foundation.md:61-66` |
| Git | No Git library is installed; Git/worktree operations are future harness capabilities | `apps/harness/package.json:13-16`; `docs/adr/0001-repository-foundation.md:26-31`; `docs/architecture/model.c4:54-60` |
| Language intelligence | TypeScript 6.0.2 is pinned, but no LSP client/server or tsserver adapter exists | `pnpm-workspace.yaml:48`; `.rpiv/artifacts/discover/2026-08-14_16-18-18_lsp-debugger-refinement.md:53-83` |

## Verified Constraints

### Electron Utility Process

| Constraint | Primary evidence | Program effect |
| --- | --- | --- |
| `utilityProcess.fork()` is available only after Electron app readiness and creates a Node.js child process with MessagePort support. | [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process#utilityprocessforkmodulepath-args-options), [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model#the-utility-process) | Keep process creation and supervision in desktop main. Require an application handshake before accepting work. |
| Utility processes have Node.js APIs. Electron's renderer sandbox guidance does not establish a capability sandbox for an application-created utility process. | [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model#the-utility-process), [Electron sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox) | Treat the harness as trusted local code with explicit capabilities, not as containment for arbitrary untrusted code. The convergence threat model must state this plainly. |
| Fatal V8 errors are followed by exit; Electron also reports child-process termination reasons such as crash, OOM, launch failure, and Windows integrity failure. | [UtilityProcess events](https://www.electronjs.org/docs/latest/api/utility-process#event-exit), [app child-process-gone](https://www.electronjs.org/docs/latest/api/app#event-child-process-gone) | A crash is a terminal transport failure. Reject outstanding work, preserve uncertainty where side effects may have started, restart with a bound, and replay only proven-safe state. |
| Windows shutdown, restart, or logout may skip `before-quit`, `will-quit`, and `quit`. | [Electron app lifecycle](https://www.electronjs.org/docs/latest/api/app#event-before-quit) | Electron proves that graceful finalizers are insufficient. SlopStop's separate Recovery Journal safety rule therefore requires durable intent before an effect begins; that second step is a project requirement, not an Electron guarantee. |
| Packaged assets live below `resources`; ASAR is read-only and cannot be a process working directory. Some APIs need real unpacked paths. | [Electron distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution#manual-packaging), [process.resourcesPath](https://www.electronjs.org/docs/latest/api/process#processresourcespath-readonly), [ASAR limitations](https://www.electronjs.org/docs/latest/tutorial/asar-archives#limitations-of-the-node-api) | Every bundled worker, native dependency, and language-server path needs a packaged Windows proof. Do not resolve from CWD or development paths. |
| Context isolation and narrow context-bridge methods are required; raw IPC must not be exposed and senders must be validated. | [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security#checklist-security-recommendations) | Renderer work follows typed desktop/harness contracts. The renderer cannot select arbitrary executables, filesystem roots, or Node flags. |

### Mastra And Model Providers

| Constraint | Primary evidence | Program effect |
| --- | --- | --- |
| Current Mastra supports Node 22.13+ and requires an ESM-compatible TypeScript setup. SlopStop's Node 24/ESM baseline satisfies the documented floor. | [Mastra deployment overview](https://mastra.ai/docs/deployment/overview), [Mastra manual installation](https://mastra.ai/docs/getting-started/manual-install) | Run an exact-version compatibility probe against Node 24.19, TypeScript 6, pnpm, Vite, and the packaged harness before adopting Mastra. |
| Agents are open-ended tool loops; workflows are defined typed steps; tools use validated schemas. | [Mastra agents](https://mastra.ai/docs/agents/overview), [Mastra workflows](https://mastra.ai/docs/workflows/overview) | Canonical run state and completion contracts remain project-owned. Use typed tool/workflow boundaries; do not let a model conversation become canonical state. |
| Workflow fan-out and background tasks have separate concurrency, timeout, retry, and backpressure behavior. Background tasks require storage. | [Mastra workflow control flow](https://mastra.ai/docs/workflows/control-flow), [Mastra background tasks](https://mastra.ai/docs/harness/background-tasks) | Define durable run/task identity, idempotency, cancellation, and budgets before enabling background concurrency. |
| Split Mastra workers require shared storage, distributed pull-capable PubSub, and internal API connectivity. The feature is documented as beta and event re-delivery requires idempotent handlers. | [Mastra workers](https://mastra.ai/docs/deployment/workers) | Keep v1 execution inside the one supervised harness process. Do not adopt distributed Mastra workers or a horizontally scaled scheduler. |
| Default Mastra storage is in-memory; restart survival and cross-process sharing require persistent storage. Memory sharing depends on resource/thread identifiers. | [Mastra storage](https://mastra.ai/docs/storage/overview), [Mastra memory](https://mastra.ai/docs/memory/overview) | Define identity ownership and separate canonical `slopstop.db` from framework-owned `mastra.db` before resumable agent behavior. |
| Approval-gated tools can suspend; durable restart of suspended runs requires storage and exact tool-call identity. | [Mastra human-in-the-loop](https://mastra.ai/docs/agents/human-in-the-loop) | SlopStop approval records must bind to exact reviewed arguments, run identity, worker identity, and workspace fingerprint before effectful tools execute. |
| Tools receive abort signals, but transport disconnection is not proof of cancellation. Mastra 1.60.0 added/fixed timeout and abort behavior. | [Mastra agents](https://mastra.ai/docs/agents/overview), [Mastra 1.60.0 release](https://github.com/mastra-ai/mastra/releases/tag/%40mastra%2Fcore%401.60.0) | Cancellation propagation and distinct terminal states precede streaming UI. Late or partial output cannot silently complete a run. |
| Provider tool calls are application-executed loops. Structured output and tool use vary by model; refusals and partial streamed arguments are separate states. | [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Anthropic tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [Anthropic fine-grained tool streaming](https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming) | Validate complete tool arguments at SlopStop's boundary. Never execute partial streamed JSON. Capability-test the selected provider/model and stop visibly when it is unavailable. |
| Provider credentials must not be exposed to browser/client code. | [OpenAI API overview](https://developers.openai.com/api/reference/overview/), [Anthropic TypeScript SDK](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript) | Desktop main owns OS-backed credential storage; the harness owns provider SDK calls. Their boundary must prevent renderer, log, project-file, or Git exposure, but whether it transfers a secret, short-lived token, opaque handle, or proxied request remains a later design decision. |
| Static tool mocks and deterministic function scorers exist; LLM judges can drift. | [Mastra experiments](https://mastra.ai/docs/datasets/running-experiments), [Mastra custom scorers](https://mastra.ai/docs/evals/custom-scorers) | Deterministic `AgentRuntime` and fake tools remain CI correctness gates. Real-model acceptance is a separate manual proof. |

### libSQL And Drizzle

| Constraint | Primary evidence | Program effect |
| --- | --- | --- |
| Drizzle supports libSQL file URLs through `@libsql/client`. Exact native targets and Electron packaging behavior depend on the version eventually pinned and its transitive packages. | [Drizzle SQLite setup](https://orm.drizzle.team/docs/get-started-sqlite), [libSQL client manifest](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/main/packages/libsql-client/package.json) | Add both packages only with first persistence behavior. Prove exact-version native loading in the packaged Windows artifact before schema work expands; current moving manifests are not a release guarantee. |
| Turso documents one-process and Windows multi-process limitations for `@tursodatabase/libsql`, not the selected `@libsql/client`. | [Turso multi-process access](https://docs.turso.tech/sql-reference/multiprocess-access) | Treat `@libsql/client` multi-process behavior as unknown until the exact-version probe. ADR 0001 still assigns product DB access to the harness; coordination between multiple desktop/harness instances remains a design question. |
| Turso Database documents one-writer and conflict/retry behavior, but applicability to the eventual `@libsql/client` local-file version must be proven. | [Turso concurrent writes](https://docs.turso.tech/tursodb/concurrent-writes) | Keep canonical transactions short and serialize canonical writes because ADR 0001 already requires it. Do not claim the driver's conflict or retry semantics before the exact-version probe. |
| Drizzle supports transactions/savepoints and version-controlled SQL migrations with migration history. | [Drizzle SQLite transactions](https://orm.drizzle.team/docs/sqlite/transactions), [Drizzle migrations](https://orm.drizzle.team/docs/sqlite/migrations) | Canonical schema ownership and verified backup/forward-migration recovery must exist before later programs depend on persisted state. Do not use schema push as the shipped upgrade protocol. |
| Embedded replicas normally write to cloud; explicit local-first sync has conflict semantics such as last-push-wins. | [Turso embedded replicas](https://docs.turso.tech/features/embedded-replicas/introduction), [Turso Sync usage](https://docs.turso.tech/sync/usage) | Cloud sync is outside v1. A local `file:` database is the simpler confirmed boundary and avoids importing unresolved sync conflicts. |

### Git And Worktrees

| Constraint | Primary evidence | Program effect |
| --- | --- | --- |
| `git worktree add` normally refuses a branch already checked out elsewhere; `--force` bypasses safety. `remove` refuses dirty worktrees by default. | [Git worktree](https://git-scm.com/docs/git-worktree) | List worktrees before creation, never force routine creation/removal, and surface the existing owner or dirty state for an explicit decision. |
| Worktree metadata must be managed with Git. `lock`, `repair`, `remove`, and `prune` have distinct meanings. | [Git worktree](https://git-scm.com/docs/git-worktree) | SlopStop owns workspace lifecycle records. Never delete a managed worktree directory as the primary removal operation or prune without proving the path is gone. |
| Git itself validates branch names. Ref creation remains race-sensitive even after preflight checks. | [Git check-ref-format](https://git-scm.com/docs/git-check-ref-format), [Git update-ref](https://git-scm.com/docs/git-update-ref) | Validate generated branch names through Git, avoid shell interpolation, and treat create-time collision as authoritative. |
| Porcelain status is the stable script interface; v2 plus `-z` preserves machine-readable distinctions and paths. | [Git status](https://git-scm.com/docs/git-status) | Parse `git status --porcelain=v2 -z --branch`. Keep staged, unstaged, untracked, conflicted, committed, and clean states distinct. |

### TypeScript Language Intelligence

| Constraint | Primary evidence | Program effect |
| --- | --- | --- |
| `tsserver` is a Node executable using TypeScript's own JSON protocol over stdin/stdout; it is not LSP. It uses absolute paths and maintains configured/inferred projects. | [TypeScript standalone server](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver)), [TypeScript protocol source](https://github.com/microsoft/TypeScript/blob/main/src/server/protocol.ts) | Keep the project-owned `LanguageIntelligenceService`. Accepted intent requires LSP lifecycle behavior, so the language program must select an LSP implementation or explicitly reopen that intent; it must not label direct tsserver as LSP. |
| Open/change/close and project configuration are client responsibilities; unsaved text requires explicit synchronization. | [TypeScript standalone server](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver)#project-system) | Any tsserver-backed implementation needs one private language process per concurrent repository workspace and must replay configuration plus open document contents after restart before serving semantic requests. |
| tsserver supports request-specific named-pipe cancellation on Windows. | [TypeScript server cancellation](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver)#cancellation) | Process cancellation and stale-result suppression are separate. A cancelled request may still produce late output that must be discarded by document/request generation. |
| Stable LSP 3.17 uses JSON-RPC framed by byte `Content-Length`, requires initialize/initialized and shutdown/exit lifecycles, and defines cancellation responses. LSP 3.18 remains under development. | [LSP 3.17 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/), [LSP 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/) | If an LSP server is selected, baseline protocol claims on 3.17, parse byte streams rather than lines, and distinguish graceful protocol shutdown from worker death. |
| LSP document versions increase and Windows file-URI casing/encoding can vary; UTF-16 is the default position encoding. | [LSP 3.17 text documents](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocuments) | Canonicalize workspace paths/URIs once and test drive letters, case, spaces, Unicode, CRLF, unsaved versions, rename/delete, and restart replay. |

## Candidate Ordering Constraints

The following edges combine documented runtime constraints with accepted SlopStop safety rules. Program charter tickets decide ownership, and the sequencing ticket decides which edges become hard blockers. Compatibility probes may run earlier when they are isolated and cannot become canonical product evidence or side effects.

| Must exist first | Before | Reason |
| --- | --- | --- |
| Desktop/harness protocol, supervised lifecycle, narrow renderer API | Any persistence, provider, Git, command, or language behavior | These capabilities belong behind the existing process boundary. |
| A designated DB owner per project | Product persistence | ADR 0001 assigns DB access to the harness; exact cross-process behavior and multi-instance coordination still require a probe and design decision. |
| Canonical project/workspace identity | Workspace-scoped product processes and evidence | Git, language, command, and evidence ownership require an unambiguous workspace; isolated compatibility probes are exempt. |
| Canonical schema, migration/backup recovery, and recovery journal | Durable Waypoint runs, accepted memory, approvals, or resumable Mastra state | Later programs cannot safely persist against an undefined or unrecoverable schema. |
| Deterministic run/task/tool identity, terminal states, cancellation, and idempotency | Production Mastra background tasks, split workers, or effectful tools that may suspend/retry | Framework retries, suspensions, and redelivery must not become canonical truth; isolated compatibility probes are exempt. |
| A reviewed desktop-to-harness credential boundary | Product provider calls | The renderer and project repository must never receive provider secrets; the transfer/proxy design remains open. |
| Workspace mode, fingerprint, process-job ownership, and recovery policy | Accepting repository mutations, command results, analyzer results, or language results as canonical evidence | Attribution and staleness require the exact workspace; isolated non-product probes may run earlier. |
| Deterministic `AgentRuntime` tests and fake tools | CI correctness gates and final real-model acceptance | Correctness cannot depend on provider availability or model drift; provider capability probes may precede the complete deterministic suite. |
| Private per-workspace process lifecycle and path canonicalization | TypeScript semantic reads or edit proposals | Language state must not leak across worktrees or survive a crash without replay. |
| Durable typed event semantics | Supervision UI that claims run/task completion | Stream or process loss is not a terminal success state. |
| All program charters and packaged compatibility proofs | Final convergence/release gate | Native packages, worker paths, abrupt shutdown, and real-model behavior require packaged Windows evidence. |

## Required Entry Probes

These probes are deliberately deferred to the first behavior in the owning program. Installing unused dependencies now would violate ADR 0001.

| Owning program | Probe required before expansion | Pass condition |
| --- | --- | --- |
| Canonical state | Package exact libSQL/Drizzle versions in Windows Electron; open, migrate, transact, restart, back up, test a competing open, and reject a newer schema through the designated harness owner. | Packaged executable loads exact native dependencies; observed process/locking behavior is recorded; competing access is safely coordinated or refused; interrupted/failed migration is distinct from clean. |
| Supervised execution | Pin one Mastra version and run its smallest typed tool/workflow through `AgentRuntime` under Node 24.19, TypeScript 6, pnpm, Vite, and the packaged harness. | No framework type leaks into kernel/protocol; cancellation/error/refusal are typed; deterministic fake remains interchangeable. |
| Provider onboarding | Exercise one selected real provider/model through the approved credential boundary, with tool schema, structured output, refusal, timeout, and unavailable-model failure. | Secret never reaches renderer/log/Git; no automatic fallback; concrete provider/model and chosen transfer/proxy behavior are recorded. |
| Repository integration | On Windows, create two related worktrees, detect branch collision/dirty state, parse porcelain v2 `-z`, survive interruption, and integrate only an approved delta. | Parent work remains untouched; failure states are distinct; no routine `--force`. |
| Language intelligence | Package the chosen TypeScript language server and private language process; resolve it from packaged resources; sync a worktree, cancel a request, crash/restart, and replay open state. | No development-path dependency; no cross-worktree state; late results are rejected; failure is not empty diagnostics. |
| Convergence | Force abrupt Windows app/process termination during each durable boundary. | Restart uses durable records, identifies uncertain effects, and never depends on quit hooks. |

## Questions For Existing Program Tickets

- [Charter the project onboarding and canonical-state program](https://github.com/TheMastermindPT/slopstop/issues/20) should decide project/database exclusion, migration and backup recovery, workspace identity, and the desktop-to-harness configuration boundary.
- [Charter the supervised Waypoint execution program](https://github.com/TheMastermindPT/slopstop/issues/17) should decide the minimum deterministic identities, typed tools, approvals, cancellation, and durable events required before first provider use, streaming, and later Mastra concurrency.
- [Charter the evidence, validation, recovery, and integration program](https://github.com/TheMastermindPT/slopstop/issues/19) should decide ownership of machine-readable Git state, managed worktree lifecycle, uncertain effects, and explicit delta integration.
- [Charter the TypeScript language-intelligence program](https://github.com/TheMastermindPT/slopstop/issues/24) should select a TypeScript/JavaScript LSP implementation consistent with accepted intent, using tsserver protocol facts as evidence rather than assuming direct tsserver is equivalent.
- [Charter the Frame and supervision experience program](https://github.com/TheMastermindPT/slopstop/issues/25) should decide how durable event completion/failure semantics are presented so stream loss is not shown as completion.
- [Charter the v1 convergence and release-proof program](https://github.com/TheMastermindPT/slopstop/issues/23) should account for the fact that utility-process separation is not a proven OS security sandbox and should place the packaged entry probes in the release evidence.
- [Sequence the v1 programs and convergence gates](https://github.com/TheMastermindPT/slopstop/issues/21) should adjudicate these candidate edges after program ownership is accepted rather than inheriting every inference as a hard blocker.

## Explicit Unknowns

- The first provider/model remains undecided. Its exact tool, structured-output, pricing, rate-limit, and data-handling behavior requires provider-specific acceptance.
- Mastra's exact adopted version remains undecided. Current docs and release notes do not guarantee Electron-specific lifecycle behavior or exactly-once execution after process failure.
- Electron documentation does not promise that every utility-process entry, native module, or language-server executable works from ASAR. The packaged path/layout must be tested.
- Exact native targets, Electron compatibility, locking, and cross-process behavior for the eventual pinned `@libsql/client` version remain unverified.
- TypeScript language intelligence has no selected LSP server/client package. Direct tsserver is not an accepted LSP substitute unless product intent is explicitly reopened.
- Coordination when two desktop/harness instances attempt to open the same Project remains undecided; a global single-instance application is only one possible answer.
- A utility process limits crash blast radius but does not by itself constrain filesystem, process-spawn, or network capability. The v1 threat model must decide what trusted-local execution means.

## Source Register

Primary sources retrieved on 2026-08-20:

- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron ASAR archives](https://www.electronjs.org/docs/latest/tutorial/asar-archives)
- [Electron app lifecycle](https://www.electronjs.org/docs/latest/api/app)
- [Electron distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [Electron process.resourcesPath](https://www.electronjs.org/docs/latest/api/process#processresourcespath-readonly)
- [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Mastra manual installation](https://mastra.ai/docs/getting-started/manual-install)
- [Mastra deployment](https://mastra.ai/docs/deployment/overview)
- [Mastra agents](https://mastra.ai/docs/agents/overview)
- [Mastra workflows](https://mastra.ai/docs/workflows/overview)
- [Mastra workflow control flow](https://mastra.ai/docs/workflows/control-flow)
- [Mastra background tasks](https://mastra.ai/docs/harness/background-tasks)
- [Mastra workers](https://mastra.ai/docs/deployment/workers)
- [Mastra storage](https://mastra.ai/docs/storage/overview)
- [Mastra memory](https://mastra.ai/docs/memory/overview)
- [Mastra human-in-the-loop](https://mastra.ai/docs/agents/human-in-the-loop)
- [Mastra 1.60.0 release](https://github.com/mastra-ai/mastra/releases/tag/%40mastra%2Fcore%401.60.0)
- [Mastra experiments](https://mastra.ai/docs/datasets/running-experiments)
- [Mastra custom scorers](https://mastra.ai/docs/evals/custom-scorers)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI API overview](https://developers.openai.com/api/reference/overview/)
- [Anthropic tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Anthropic fine-grained tool streaming](https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming)
- [Anthropic TypeScript SDK](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript)
- [libSQL client manifest](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/main/packages/libsql-client/package.json)
- [Drizzle SQLite setup](https://orm.drizzle.team/docs/get-started-sqlite)
- [Drizzle transactions](https://orm.drizzle.team/docs/sqlite/transactions)
- [Drizzle migrations](https://orm.drizzle.team/docs/sqlite/migrations)
- [Turso multi-process access](https://docs.turso.tech/sql-reference/multiprocess-access)
- [Turso concurrent writes](https://docs.turso.tech/tursodb/concurrent-writes)
- [Turso embedded replicas](https://docs.turso.tech/features/embedded-replicas/introduction)
- [Turso Sync](https://docs.turso.tech/sync/usage)
- [Git worktree](https://git-scm.com/docs/git-worktree)
- [Git status](https://git-scm.com/docs/git-status)
- [Git check-ref-format](https://git-scm.com/docs/git-check-ref-format)
- [Git update-ref](https://git-scm.com/docs/git-update-ref)
- [TypeScript standalone server](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver))
- [TypeScript server protocol](https://github.com/microsoft/TypeScript/blob/main/src/server/protocol.ts)
- [Language Server Protocol 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
- [Language Server Protocol 3.18](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/)
