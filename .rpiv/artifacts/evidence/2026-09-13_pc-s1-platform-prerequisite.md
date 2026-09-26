# PC-S1 Platform Prerequisite — Build Blocker

## Observed State

The approved candidate worktree exists on `feat/project-registration`, base `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, with naming documents transferred identically and pinned dependencies installed. Independent platform research and implementation preflight both found a required D2/D3 capability gap. Product/test implementation has not begun and no Red/Green result exists.

Candidate evidence owner: `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1/.rpiv/artifacts/evidence/2026-09-13_pc-s1-implementation.md`. Herdr implementation session: `pc-s1-builder`, `ses_f67ebbf5cffeaMVBrxdJOhpi3V`, pane `w3:pB`, tab `w3:t6`; it is stopped pending this dependency decision. The developer authorized the coordinator to answer its requests to read the source workspace's RPIV artifacts and shared RPIV guidance; this did not authorize source-main edits.

## Verified Gap

- Pinned Node 24.19.0/libuv1.52.1 reports Windows `statfs.type=0`; neither that nor bigint inode/birth values prove local NTFS as D3 requires.
- Installed `fs-native-extensions@1.5.1` supplies file locks/attributes and related filesystem operations, not volume classification or Windows Job Object process ownership.
- Pinned Node's Windows process source retains a handle for the direct child, but its internal global job permits child descendants to break away. `ChildProcess.kill()` is not the required per-observation child/tree owner. Existing supervisor/smoke helpers do not prove the stronger D2 behavior.
- These are missing exposed platform APIs in the current dependency set, not missing Windows facilities and not a reason to implement the entire Effect/Execution portfolio.
- The reviewed design explicitly required selecting and proving those platform capabilities before constructing their adapters. Intent-review passes were not capability proof; preflight correctly blocks instead of claiming support or implementing a weak fallback.

## Bounded Resolution — Original Proposal

Evaluate an exact pinned `koffi@3.2.1` dependency behind harness-owned narrow platform adapters. Koffi provides calls into native system APIs; public docs cover Win32 DLL functions and Windows/Linux prebuilds, and its license is MIT. The docs identify Node16+ support. Version3 uses platform-specific optional packages, so real Electron/ASAR packaging must be proved rather than assumed.

Observed npm metadata: version `3.2.1`, MIT, integrity `sha512-0qE3lZ8jllRqPN4Ob6Ajl7c2bJSJDhQWuKLGP5hIEpHLllJWv1ydHFMhHmHc5p/W9GticKVDbYzZd7TBoQ4CZg==`. This is registry metadata and documentation, not a security audit or runtime pass. No package was installed or lockfile changed for this proposal.

The bounded proof would test local-volume identification, exact suspended-child/job ownership before execution on Windows, terminal cleanup and required Linux birth/identity capability through system APIs. Use disposable fixtures/processes and retain the approved no-generic-renderer/process-tool boundary. Koffi stays an internal adapter dependency; it is not exposed to the renderer, models or project-controlled code.

The developer must approve the new dependency and lockfile/platform-package changes before installation. The proof may fail; do not silently choose another dependency, weaken D2/D3, add global toolchains or claim the full PC-S1 feature is delivered. Successful proof only unblocks the already-approved implementation and its normal RPIV checks.

## Sources

- Context7 resolution `/websites/koffi_dev`, followed by Win32/platform and packaging documentation queries from the approved Temp directory.
- https://koffi.dev/start — native Win32 function calls.
- https://koffi.dev/ — requirements, supported platforms and MIT license.
- https://koffi.dev/migration — version3 platform-specific optional packages.
- `npm view koffi version license engines dist.integrity --json` — read-only registry metadata.
- Exact Node release source URLs/hashes and actual pinned-runtime observations are retained in the candidate evidence owner above.

## Explicit Dependency-Proof Approval And Installation

The coordinator asked whether to add exact `koffi@3.2.1` and its platform dependencies to the candidate lockfile and run a disposable platform proof, explicitly noting that Electron package compatibility was unproven. The developer selected **“Autorizar a prova”**. This authorizes the bounded proof in the existing candidate, no global installations or original-workspace source changes.

The coordinator added `koffi: catalog:` only to `apps/harness/package.json`, pinned catalog version `3.2.1` and its package-specific build allow entry, then ran `pnpm install --no-frozen-lockfile` in the candidate. Installation completed. The lockfile change is additive (174 inserted lines); the manifest and catalog changes add three lines, with no existing dependency version removal or replacement. The package's declared install hook completed normally.

`pnpm --filter @slopstop/harness exec node -e <load koffi and report versions>` returned Node `v24.19.0`, Koffi `3.2.1`, Windows x64. This proves loading under pinned Node only, not volume/process capability, Electron compatibility or product Red/Green. Subsequent implementation must continue from test-first public behavior, and raw feasibility scripts cannot be relabelled product TDD proof.

The implementation owner may now conduct the bounded capability proof with this approved dependency and must stop on real incompatibility rather than install other versions, weaken guarantees, change host policies or fabricate a pass. The first unresolved capabilities remain exact local-volume identity, process ownership from creation through cleanup, and packaged-runtime loading.

## Windows Feasibility Handback And Production Continuation

The parent inspected the candidate implementation evidence at lines 89-181 after the Windows proof. Passed on the tested Windows x64 host: NTFS/locality through directory-handle APIs, lossless native physical identity, alias/rename stability and replacement distinction; creation-time `PROC_THREAD_ATTRIBUTE_JOB_LIST` ownership before resume; exact tree termination, last-job-handle close and abrupt owner-exit cleanup with observed process handles and pipe EOF. The first exact-two-members assumption failed because the owned job also contained conhost; corrected membership checks and both failed attempts remain preserved. These are feasibility results, not product Red/Green.

A disposable packaged Electron utility-process fixture also passed with Electron43.4.0, embedded Node24.18.1 (different from CLI Node24.19.0), Koffi3.2.1, ASAR/native unpacking and the project's relevant fuses. Its initial fixture-shutdown failure remains recorded. This is not the real Ragnarok package; product bundling still needs to stage Koffi and the matching optional native package and prove actual use.

Based on those results the parent authorized resumption of the original PC-S1 source/test work in the candidate, with prospective public Red/Green. The native prototype scripts are not copied as already-tested product code. Linux proof remains separately assigned to `board-research`; the implementation owner was explicitly told not to duplicate Linux/toolchain discovery.

Linux discovery initially failed to find the pinned runtime. The parent recovered exact prior S7 toolchain paths from `Temp/slopstop-s7-final-2451keys/environment.started.json`: Node `/var/tmp/slopstop-s3-igyrrwdx/tools/node-v24.19.0-linux-x64/bin/node`, pnpm `/var/tmp/slopstop-s3-igyrrwdx/pnpm-home`. The Linux owner must reverify versions and use new disposable caches/stores; earlier proof roots/toolchains are read-only. The developer separately authorized read-only installed-tool discovery in Ubuntu. No replacement Linux toolchain or global installation was authorized.

Sonar preflight on the candidate bootstrap returned **SonarQube for IDE is not available**. This is a pending/unavailable required candidate check, not a pass. CodeScene OAuth readiness passed earlier; neither tool readiness nor this platform handback certifies PC-S1 implementation.

## Linux Mechanism And Disposable Package Handback

The Linux proof initially demonstrated ext4/statx birth-mask identity but not atomic group signalling on the local WSL6.6 kernel. Developer explicitly approved compiler preparation and a bounded native-supervisor alternative without changing the kernel. The existing package manager had interrupted unrelated Vim state; the agent did not repair it. Instead, exact compiler packages were extracted to an owned disposable sysroot; the installed global package inventory remained unchanged.

A private-group native helper demonstrated four positive EOF/parent-loss cleanup cases using `kill(0, signal)` only from its own verified session/group. Supervisor-first loss intentionally retained cleanup-unconfirmed/admission-blocked. Targeted independent contract assessment (`ses_f677cc7f6ffeZl1IwBdqAPlpVG`) confirmed that this expected uncertainty is permitted by D2/B12, while distinguishing mechanism feasibility from still-missing product journals/restart/package proof. It was not formal candidate approval.

The final bounded follow-up used actual installed Git2.53.0 and the fixed version/six-query vocabulary, then a disposable Linux Electron43.4.0 package with Koffi3.2.1, the native helper and a sandboxed/context-isolated renderer. It passed normal results/EOF, actual controller and parent loss under Node, and retained expected supervisor-first uncertainty. The successful package used the six project fuse settings and no `--no-sandbox`; only newly copied pinned chrome-sandbox files received owned-temp root/4755 preparation. Previous caches and failed attempts remained preserved.

Final report: `//wsl.localhost/Ubuntu/var/tmp/pc-s1-linux-koffi-proof-20260913-a/git-electron-proof-20260913-c/REPORT.md`; report SHA-256 `635db82a3fd0a5d6f7a6dbba13698cdbc56088eb6160a465c9b5ed7f06e1e672`. Its `results/final-seal.json` binds sources/results and records `productD2B12Certified: false`, `registrationImplemented: false`, `candidateChanged: false`.

Parent verified the actual reporting Herdr session and independently checked all 29 authored/result-file hashes using the read-only `Temp/verify-pc-s1-linux-proof.mjs` under pinned candidate Node. It returned verified/29 and retained the exact unconfirmed outcome. This verifies report identity and its scoped evidence; it is not a rerun of the native tests or an independent proof of every package binary.

The parent relayed these results to the implementation owner as sufficient prerequisite mechanism feasibility to implement the Linux adapter under existing PC-S1 authority. Production executable selection/consent, helper source/build provenance, complete D2/B12/journal/restart scenarios and actual Ragnarok packaging remain mandatory. Packaged Electron parent-loss was not tested in the disposable proof; Node parent-loss was. The proof owner is now idle with roots frozen, and no further proof runs or installs were requested.
