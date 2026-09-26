---
date: 2026-09-24
author: "OpenCode pc-s1-recovery (AI)"
commit: 97678d2a131daaf0791822ed3f5a7c3977ee7e7c
branch: feat/project-registration
repository: slopstop
topic: "PC-S1 append-only implementation evidence; metadata added during bounded recovery packet"
status: in-progress
---

# PC-S1 Implementation Evidence

Append-only implementation-owner record. Parent coordinator: Herdr `w3:p1`.

## 2026-09-13 — Authority and prerequisite reconciliation

- Candidate: `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`.
- Branch: `feat/project-registration`.
- Base/observed HEAD: `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`.
- Original workspace, read-only: `C:/Users/pedro/Documents/GitHub/slopstop`.
- Human authority: original `.rpiv/artifacts/evidence/2026-09-13_pc-s1-build-authority.md`.
- Approved design: original `.rpiv/artifacts/designs/2026-09-12_22-45-37_persistent-project-conversation.md`.
- Approved content hash: `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e`.
- Approved raw design hash: `b3ea5c1e4a88b44e6c30b0b1398c0f8df768569babf6bcf02035fadda4006476`.
- Verified all 26 distinct raw-file bindings in original `2026-09-13_pc-s1-intent-v4.json`: 3 direct, 4 inherited from v3, 19 inherited from v1. Read the v4 review: slice, code and coverage intent gates passed. This does not establish candidate readiness.
- Binding verification used `ctx_execute` JavaScript with `fs.readFileSync`, `path.resolve(originalRoot, bindingPath)`, and `crypto.createHash('sha256')`. First attempt used `path.join` and failed when it encountered an absolute plugin binding after 23 matching files. Corrected read-only verification using `path.resolve` completed with `Bindings 26 / 26`. The first failure was a verification-script path bug, not a changed contract.
- Read candidate AGENTS, PRODUCT, CONTEXT, package/catalog configuration, CodeScene guidance, frozen v2/v3 amendments and current v4 design. Loaded implement/shared candidate workflow, TypeScript, TDD, Vitest and documentation lookup skills. Implementation-specific remaining source/ADR exploration was stopped at the mandatory platform prerequisite below.

### Commands and observed results

Unless separately specified, working directory was the candidate above. Commands ran sequentially where dependent; no tests/builds competed for resources.

1. `git status --short --branch` → `feat/project-registration`; only `CONTEXT.md`, `PRODUCT.md`, `README.md` modified at entry.
2. `git rev-parse HEAD` → exact base above.
3. `pnpm exec node --version` → `v24.19.0`.
4. `pnpm exec node "C:/Users/pedro/rpiv-claude/rpiv/skills/_shared/validate-artifact.mjs" "C:/Users/pedro/Documents/GitHub/slopstop/.rpiv/artifacts/designs/2026-09-12_22-45-37_persistent-project-conversation.md" --root "C:/Users/pedro/Documents/GitHub/slopstop"` → `validate-artifact: OK`; no stamp flag or original-workspace write.
5. `Test-Path -LiteralPath "C:/Users/pedro/AppData/Local/Temp/opencode"` → `True`.
6. In that approved Temp directory: `npx ctx7@latest library "Node.js" "Node.js 24 Windows child_process kill descendants Job Object filesystem statfs type volume filesystem identity"` → resolved official v24 documentation `/websites/nodejs_latest-v24_x_api`.
7. Same Temp directory: `npx ctx7@latest docs /websites/nodejs_latest-v24_x_api "Windows child_process ChildProcess.kill process descendants detached process group Job Object termination guarantees"` → documentation retrieval succeeded. Its generic shell example was not treated as Windows platform proof; exact-version source was checked below.
8. Same Temp directory: `npx ctx7@latest docs /websites/nodejs_latest-v24_x_api "Windows fs.statfs type zero filesystem type birthtimeNs creation time fallback"` → documentation retrieval succeeded. Platform-dependent `type` and bigint birth fields do not supply locality proof.
9. `pnpm exec node -e "const fs=require('node:fs'); const d='C:/Users/pedro/AppData/Local/Temp/opencode'; const s=fs.statSync(d,{bigint:true}); const v=fs.statfsSync(d,{bigint:true}); console.log(JSON.stringify({node:process.version,uv:process.versions.uv,platform:process.platform,arch:process.arch,statfs:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,String(x)])),identity:{dev:String(s.dev),ino:String(s.ino),birthtimeNs:String(s.birthtimeNs)}}));"` → exit 0; Node `v24.19.0`, libuv `1.52.1`, `win32`, `x64`; `statfs.type="0"`; `dev="4195564178"`, `ino="51509920738823581"`, `birthtimeNs="1785884984567512900"`. This read-only diagnostic proves returned fields, not local NTFS conformance. No fixture or user-data directory was created.
10. `pnpm exec node -e "const fs=require('fs-native-extensions');console.log(JSON.stringify({node:process.version,uv:process.versions.uv,release:process.release,fsNativeExtensions:require('fs-native-extensions/package.json').version,exports:Object.keys(fs)},null,2));"` → exit 0; installed version `1.5.1`; runtime source URL `https://nodejs.org/download/release/v24.19.0/node-v24.19.0.tar.gz`. Public exports cover locks, trim, sparse, swap and extended attributes. No process/tree ownership or volume-type/locality API.

Read-only `ctx_execute` inspections independently scanned the installed native package `.c`, `.h`, `.js` sources (excluding prebuilds/dependency directories) for `JobObject|GetVolumeInformation|GetDriveType|NtQueryVolume|TerminateProcess|CreateProcess`: zero matches. Harness source search found the existing native lock consumer in `apps/harness/src/storage/canonical-writer-lease.ts:161`; no platform observer owner. Lockfile inspection found no declared general-purpose FFI/Job Object/volume adapter to substitute. No dependency reinstall, version change or native build was attempted.

### Blocking capability diagnostic — D2 / PC-B12

Frozen v2 brief lines 48–56 requires an exact platform-owned child/tree, finite termination and stream closure, OS-qualified identity, and restart reconciliation. Lines 52 and 129 explicitly prohibit weaker fallback and make missing platform capability blocking. V3 lines 30 and 36 retain this obligation despite ISOL-1 deferral.

Independently fetched exact `nodejs/node` tag `v24.19.0` sources using `ctx_execute` with `fetch`, SHA-256 and line-numbered extraction:

- `https://raw.githubusercontent.com/nodejs/node/v24.19.0/src/process_wrap.cc`, lines 348–359: kill delegates to `uv_process_kill`.
- `https://raw.githubusercontent.com/nodejs/node/v24.19.0/deps/uv/src/win/process.c`, lines 65–98: global job handle, `JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK`, explicit comment that subprocesses of children are not included. Lines 1082–1101: non-detached children assigned to the global job; certain assignment errors are swallowed. Lines 1304 and 1364 onward: direct-process termination/handle path, not per-observation tree termination.

Conclusion: the inspected pinned public Node child-process path does not satisfy the required per-observation Windows child/tree owner. Its internal global Job Object is not that capability. `detached`, PID-only task termination, broad process killing, an unowned wrapper, or an unconditional supported flag would not satisfy the approved contract. No such workaround was implemented. No kill experiment against uncontrolled processes was run.

### Blocking capability diagnostic — D3 / PC-B11

Frozen v2 brief lines 58–66 requires proof of local Windows NTFS (or separately proved Linux ext4/XFS) plus lossless physical-directory identity; a positive birthtime/inode or Windows `statfs.type=0` is explicitly insufficient.

- Actual pinned-runtime probe above returns `type=0`.
- `https://raw.githubusercontent.com/nodejs/node/v24.19.0/deps/uv/src/win/fs.c:3149` explicitly sets `stat_fs->f_type = 0`.
- Neither the inspected public native dependency exports nor Node stat/statfs results supply the missing NTFS/local-volume capability proof. This finding does not claim that Windows itself lacks the necessary APIs; it identifies the missing authorized adapter in this candidate.

### Inspected source identities

| Input | SHA-256 |
| --- | --- |
| Candidate `AGENTS.md` | `6b64e7b756753220a362992bb11e8e16bd970d259883219233da7e28d375f943` |
| Candidate `PRODUCT.md` | `d6184abfa7679fd56243e4ca8e3d313a207fd51be759f20462277e73fb32267c` |
| Candidate `CONTEXT.md` | `c7e57244535a9c39a7e6cf976a1e86b7c5122c087e792dbb13fd6e1c8999c72a` |
| Candidate `README.md` | `70a11f176e020686e4e9bb29609d4b602394b9c14c3792536657164b83fe0074` |
| Candidate `package.json` | `f1f104a03ccc73e361ac292b51263f7e1d231df1879b910a445231b833362d39` |
| Candidate `pnpm-workspace.yaml` | `8eb3b50b511735ea1fe99f6ac06973c99b8faca0ccdb20dab8f901280400c63b` |
| Candidate `pnpm-lock.yaml` | `20969c9456b491005b8d076328a838e8ee4c7fdea133a41ad8a19d05fccf8e5d` |
| Candidate `apps/harness/package.json` | `8657c63e88e040b0014b9a6071ea86835bbf980bcc5a61ed1f8a6fdcc3f7983d` |
| Installed `fs-native-extensions/package.json` | `d23dd712121d3d2faaf54b81c4e45c18d7cc273463d56dea521af4568b8e4c00` |
| Installed `fs-native-extensions/index.js` | `607e535d8f99cd601b172cdb4844519468e61a6101e36910bff959adcd7f663d` |
| Installed `fs-native-extensions/binding.c` | `62ed334889611c44dcff10d845f439dd33da84166e205ec18483d6ee4e7a074b` |
| Fetched Node `v24.19.0/deps/uv/src/win/process.c` | `3613437d5b1511789fe4ea9ba6c3ab228c9d42a8d2eec56227f6d6919e917d91` |
| Fetched Node `v24.19.0/deps/uv/src/win/fs.c` | `41633b8f58bb08c21f2dc8daa32990365e2df7154bb167a076e470339a218d18` |
| Fetched Node `v24.19.0/src/process_wrap.cc` | `f4db549965708ad031d372b7b1a2a7d821527316ef9c9d8de4ca3a85b3e9b45f` |

The three naming documents were independently verified byte-identical to the original workspace and preserved. Remote source checks bind to the runtime's release tag; no compiled-binary reproducibility or actual Windows/Linux package conformance is claimed.

### Stop and handback

- **State: blocked before production/test/platform-adapter edits.** Per the user's explicit instruction, stop rather than add an unapproved native dependency or weaken D2/D3.
- Red: **not run**. Green: **not run**. No behavior test or placeholder seam was written after discovering the mandatory prerequisite failure. The metadata probe is feasibility evidence, not expected-red evidence.
- Sonar/CodeScene: **not run**; no cohesive implementation group or analyzable product/test edit exists. Full checks, mutation, integration/Electron/package proof and independent candidate review remain **pending**, not passed.
- Only newly authored candidate path: this append-only evidence file. No staging, commit, push, merge, source-main edits, user-data migration or repository cleanup occurred.
- Parent owns resolution: identify and authorize a packaged platform API/adapter satisfying exact child/tree ownership and local-volume proof, or route any intended D2/D3 change through new contract review. The parent is already investigating source-matched APIs. Implementation cannot resume on an unsupported-platform claim.
- This is a bounded PC-S1 prerequisite finding, not a request to implement the full Effect portfolio or the deferred ISOL-1 program.

### Post-write diagnostic

The evidence-file patch succeeded. Its automatic RPIV `validate-on-write.mjs` hook reported `spawnSync C:\Program Files\nodejs\node.exe ETIMEDOUT`; automatic hook validation is **broken**, not passed. The earlier explicit approved-design validation with the pinned runtime passed as recorded above. A final `git status --short --branch` in the candidate confirmed only the three pre-existing naming modifications and this untracked evidence file. No product/test/config edits were made.

## 2026-09-13 — Authorized Koffi prerequisite proof resumed

The developer selected `Autorizar a prova`; authority is the final section of original `.rpiv/artifacts/evidence/2026-09-13_pc-s1-platform-prerequisite.md`. Parent added exact `koffi@3.2.1`, platform packages, catalog/build allow entry and additive lockfile changes. Ownership of later proof work transferred here. No additional dependencies or global tools were installed by this implementation session.

`git diff --stat` in candidate reconciled six tracked changed paths: three naming documents, `apps/harness/package.json` (+1), `pnpm-workspace.yaml` (+2), `pnpm-lock.yaml` (+174). The prior D2/D3 finding remains historical, not erased by this new authorized capability.

### Documentation

From approved Temp, ran `npx ctx7@latest library "Koffi" "Windows structs output pointers Win32 CreateProcessW STARTUPINFOEX UpdateProcThreadAttribute job object list"`, followed by `/websites/koffi_dev` queries `Win32 CreateProcessW STARTUPINFO structure pointer output handles UTF16 Buffer pointers koffi.alloc encode decode` and `bundling Electron ASAR packaging native optional platform packages koffi 3`. Retrieval passed; v3 explicitly requires redistribution of the optional platform-specific native package.

Microsoft primary API references fetched read-only:

- `https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute`: creation-time `PROC_THREAD_ATTRIBUTE_JOB_LIST` (Windows 10+) and explicit inheritable `HANDLE_LIST`.
- `https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw`: extended startup information and suspended creation.
- `https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-createjobobjectw`, `nf-jobapi2-setinformationjobobject`, and `https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information`.
- `https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getvolumeinformationbyhandlew`, `https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info`.
- `https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntqueryvolumeinformationfile` and `https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/ns-wdm-_file_fs_device_information`.

### Disposable native probe — actual results

Files authored via apply_patch in approved Temp: `pc-s1-native-capability-proof.mjs` and `pc-s1-native-proof-child.mjs`. No production adapter/test has been authored. Every run below used candidate cwd and exact command `pnpm exec node "C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-native-capability-proof.mjs"`. Each creates its own retained `pc-s1-native-proof-*` Temp directory containing `events.json`; no real Project data is opened.

1. `2026-09-13T00:32:17Z`: failed probe, script SHA-256 `07aa02ea95c34cf5c539de2176e5ed331a4382438b051c84fb4b6b4e540736e4`; raw results `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-native-proof-TNe9rQ/events.json`. Local identity and creation-time membership passed; waiting for exactly two live processes timed out. Finally terminated the exact owned job. This was not product Red.
2. `2026-09-13T00:32:45Z`: added failure diagnostics; script hash `9d8e7fde165044c4a0b59e73cc8c5989c21816553085df7f504dfb43f047d46a`; raw results `.../pc-s1-native-proof-tnAGMF/events.json`. Failed with active=3, both fixture processes ready, direct process live. This established that the probe's exact-two assumption was wrong, not a missing descendant.
3. `2026-09-13T00:33:27Z`: corrected probe to require both exact fixture identities to be in the owned job and enumerate every job member; script hash `4f8c7770069d493717af785fb6ae2daef31e3432de011ff6862b6cd6a3175759`; raw results `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-native-proof-Lo0MLR/events.json`. **Passed** under Node24.19.0, Koffi3.2.1, Windows x64. The third member was `C:\Windows\System32\conhost.exe`, owned by the same job, not an unrelated process.

Successful native observations:

- Open directory handle with sharing and `FILE_FLAG_BACKUP_SEMANTICS`. Query `FILE_ID_INFO` and `FILE_BASIC_INFO` through that same handle, preserving uint64 volume, uint128 file ID and native creation time without Number conversion. Creation time is converted exactly from FILETIME ticks to Unix nanoseconds using bigint.
- `GetVolumeInformationByHandleW` returned `NTFS`; `NtQueryVolumeInformationFile(FileFsDeviceInformation)` returned disk type7 and characteristics131104, with `FILE_REMOTE_DEVICE` bit absent. Probe asserts a directory, valid nonzero identity and positive birth identity.
- Case alias and same-volume rename preserved the exact tuple; recreating a directory at the original path gave a different tuple. Successful sample volume ID `3240924279274158738`, initial file ID `8444249302506395`, replacement `8444249302506406`; this is only the tested local volume, not all Windows/Linux filesystem conformance.
- Created noninheritable Job Object with kill-on-last-close and no breakaway. Passed its handle through `PROC_THREAD_ATTRIBUTE_JOB_LIST` in `STARTUPINFOEX` to `CreateProcessW`; inherited handles explicitly limited by `HANDLE_LIST`. **No create-then-assign race:** no `AssignProcessToJobObject` call exists in the probe.
- While still suspended, `IsProcessInJob` returned true and job accounting returned one active process. Recorded PID25000 plus exact process creation time `134337332078489306` (100ns FILETIME units), then resumed.
- The fixture launched a real descendant. Queried job membership and image names for all three members; both fixture PIDs were contained. `TerminateJobObject` produced zero active members, signalled direct-process handle, and pipe EOF (both stdout/stderr share the bounded probe pipe) after approximately29.8ms. No PID-only or image-name termination was used.

This is feasibility only: no full observer deadlines/cancellation/persistence/restart semantics, separate output streams, Git consent, Linux adapter or product proof is claimed. Packaged Electron loading and additional owner-loss proof remain pending. Temp script edits also triggered the previously observed automatic hook timeout; that diagnostic has not been converted to a passing gate.

## 2026-09-13 — Windows owner-loss and packaged Electron proof completed

### Exact owner loss

All commands below ran in the candidate with its pinned `pnpm exec node` runtime. Only disposable fixture processes and newly created Temp data were used.

- `pnpm exec node "C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-native-capability-proof.mjs" --last-handle-close` → exit0, **passed**, `2026-09-13T00:37:42Z`. Root `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-native-proof-DruMka`; retained `events.json`, `probe-source.mjs`, `child-source.mjs`. Probe hash at this run `1fbaaf8714b81d705cd4128b7ff10755709e22c938ba77ad08a1c86c7f5c6a5a`. Opened handles for all three exact job members, rechecked their membership, then closed the sole job handle. All three process handles signalled and the shared output pipe reached EOF after approximately28.1ms. This exercises last-handle-close independently from explicit `TerminateJobObject`.
- `pnpm exec node "C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-native-owner-exit-proof.mjs"` → exit0, **passed** both cases. Root `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-owner-exit-nxOPp1`; retained `results.json`, `driver-source.mjs`, and separate `owner-exit-before-resume`/`owner-exit-running` stdout JSONL and stderr captures. Each native owner run also retained its own input source snapshots and events at the root named in its stdout.
  - Before resume: child belonged to the creation-time job while suspended. Driver independently opened its process handle and matched PID plus native creation time before asking the owner to exit86. Owner deliberately called `process.exit(86)` without executing the native cleanup `finally`. The exact suspended-child handle then signalled; one member observed.
  - Running tree: driver held handles for direct fixture, descendant and conhost, matching each creation time and proving each was live before the owner exit. Owner again bypassed JS cleanup. All three held handles signalled; observed approximately20.9ms after owner exit.
- Driver performs no PID-based kill of native children. Normal successful cases terminate through OS closure of the noninheritable job handle. Its timeout path targets only the driver-owned Node owner process, but that path did not run in these successful cases.

These probes establish creation-time ownership, exact process observation, explicit job termination, last-handle-close and owner-process-exit mechanisms on the tested Windows host. They do not establish the future application's durable dispatch-intent journal, restart reconciliation, cleanup precedence, independent stdout/stderr budgets or all PC-B12 scenarios. In particular, an application crash before recording the OS-qualified child identity must still retain unknown-dispatch uncertainty under the approved contract, even when OS cleanup is available.

### Packaged Electron

Disposable proof inputs: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-electron-proof-app/{package.json,main.cjs,worker.cjs}` and runner `pc-s1-electron-package-proof.mjs`. The fixture has no renderer and uses a utility process. It sets Electron `userData` to a newly created owned Temp directory before readiness. Both Koffi packages were copied from the approved candidate installation; no installation/rebuild/version change was needed.

Command for both attempts: `pnpm exec node "C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-electron-package-proof.mjs"`, candidate cwd.

1. Root `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-electron-run-gxRzMR`: **failed overall** with host exit92 (15s fixture deadline). Retained `inputs.json`, `launch.json`, `electron-result.json`, `failure.txt`, staged source and packaged app. Native load/call had succeeded and utility result said passed, but the fixture had left its parent communication port alive and did not complete shutdown. This is a failed feasibility harness attempt, not a product Red or a native compatibility failure. Its original failed status remains retained.
2. Corrected only the disposable fixture shutdown: host acknowledges received proof result, utility exits explicitly after acknowledgement. Reused the same approved Electron43.4.0 download in the first probe's Temp cache. Root `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-electron-run-73MhFL`: **passed**, runner and packaged host exit0; utility exit0; empty stdout/stderr. Retained exact staged source, packaged application, `inputs.json`, `launch.json`, `electron-result.json`.

Observed packaged result:

- Electron **43.4.0**, its actual bundled Node **24.18.1**, Koffi **3.2.1**, win32-x64. This is intentionally distinguished from the CLI's Node24.19.0.
- `app.isPackaged=true`; both JS package resolutions came from this disposable package's `resources/app.asar`, not the candidate or a global installation.
- Native `@koromix/koffi-win32-x64/win32_x64/koffi.node` was present under `app.asar.unpacked`; its hash matched the installed approved native binary exactly.
- The utility process loaded Koffi, called native `GetCurrentProcessId` with equality to `process.pid`, and created/closed a native Job Object successfully.
- Packager was the existing installed `@electron/packager@18.4.4`. Enabled ASAR and unpacked `**/*.node`. Applied the candidate's six relevant fuse settings: RunAsNode off, CookieEncryption on, NodeOptions off, NodeCliInspect off, EmbeddedAsarIntegrityValidation on, OnlyLoadAppFromAsar on. `getCurrentFuseWire` captured the resulting wire in `inputs.json` (48=disabled,49=enabled).
- Packaged executable SHA-256 `9907e37d37a3637eba21b0f69d440c76951a428fd24811d65ff9968feaf55560`; ASAR SHA-256 `97116ae3134a71d75dc59b2279d146e0c1d8c1e89c39434eb2cd7cea47629ed6`; native binary SHA-256 `8623dc57f3093a457f71fcbe31fad77741f5b648d8015f7c1dac959595f0972b`.

This proves disposable packaged-runtime loading and native calls, not Ragnarok's current package. `apps/desktop/vite.harness.config.ts` currently stages only the predecessor runtime packages; future product integration must stage `koffi` plus its matching optional platform package, keep it external to the JS bundle, and verify the actual candidate package. No production packaging configuration or product adapter was changed by this proof.

### Final input hashes for this proof revision

| Input | SHA-256 |
| --- | --- |
| Candidate `apps/harness/package.json` after parent dependency edit | `dc65af751d5b138d4a9655248bc2ca7a46443f5063756b60b3dd5af20c62e7e9` |
| Candidate `pnpm-workspace.yaml` after parent dependency edit | `50d33b659031e28fe049dc62905be32412fd9a87c199803e9f93427f0a4e61ac` |
| Candidate `pnpm-lock.yaml` after parent dependency edit | `4f34a716b500e6277f475a67c6cd424a115057e7ab6209e279df6aaf7c868054` |
| Installed `koffi/package.json` | `9ed5909da5972d5c0edf9d0f6f936393bc00d92cec8aa28df7e1c02240ef9b48` |
| Installed `@koromix/koffi-win32-x64/package.json` | `3c6d427795e7c1e18220dfa56d9dfdf392c62b074e7a061f84a55fe44857670f` |
| Temp `pc-s1-native-capability-proof.mjs` after owner-exit additions | `c95653c4ba4839362911f966f4aabdd45d23216a3aea5442efe1000fa6c2a5a8` |
| Temp `pc-s1-native-proof-child.mjs` | `928b84dc22e9819a5ea3a56a3da9396879db378b2f53e99b1fcbe2b863df4c7a` |
| Temp `pc-s1-native-owner-exit-proof.mjs` | `d99b8e619853ffe74e8e9f2ed13c91f82957bcea6a8714ca5e56de967aa4c690` |
| Temp `pc-s1-electron-package-proof.mjs` | `ca2898e9e408292ab012e03d642ecf850bba3968ddc47a51129510c20e1cd31c` |
| Temp Electron `main.cjs` | `56d17abb659db5a903e0d3bf6a179132beb27b3c815391acbe920bdadeca9258` |
| Temp Electron `worker.cjs` | `f269808d42e3b9951652939e86a62f2869554a338abb4a06bbc2b8a16f4575eb` |
| Temp Electron `package.json` | `33369ab2ed3e532bf5f91590b934610af70067e5424907559f23ef45ce34c250` |

### Parent handback / remaining scope

Windows native and disposable packaged Electron feasibility assignment is complete and handed back to parent `w3:p1`. Parent explicitly assigned Linux feasibility/toolchain resolution to `board-research` and requested this handback now. Before that coordination correction, two read-only commands were run here: `docker version --format '{{.Server.Version}}'` returned29.4.0; `docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}'` listed existing images. No container was started, image pulled, Linux toolchain installed or Linux proof executed. Linux discovery stops here; the other owner's pending proof is not counted as ours.

No PC-S1 behavior implementation, prospective product Red/Green, Sonar/CodeScene implementation gate, real Ragnarok package proof, or candidate acceptance is claimed. Those remain pending under parent coordination. Current authored repository change remains this append-only evidence; parent manifest/catalog/lockfile edits and prior naming documents are preserved. Disposable probe failure histories remain retained. Automatic write-hook timeouts remain the previously recorded broken hook diagnostic, not passing validation.

## 2026-09-13 — Prospective production observer admission cycles

Parent accepted Windows feasibility as sufficient to begin PC-S1 production implementation under the original authority. Linux remains assigned separately; no further Linux discovery is performed here. The following are incremental PC-B10 observer-port subclauses, not completion of PC-B10 or full registration.

Public seam: `createProjectRegistrationObserver(...).inspectGitVersion(...)`, tested at the approved `apps/harness/src/project-registration-observer.test.ts`. Typed minimal unavailable scaffolding was established before Red; no failing import/compilation was counted. The executable-authority/execution ports in these first tests are deterministic test adapters. They prove application admission and routing, not real child lifecycle, durable consent storage, executable identity matching or native dispatch. Those remain next work.

Capture runner: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-capture.mjs`. Invocation from candidate: `pnpm exec node "<capture-runner>" "<label>" "pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness"`. The runner captures the exact command/cwd/runtime, all changed non-Markdown source/config bytes and SHA-256 hashes into each root's `inputs.json` and `source/`, plus actual `stdout.txt`, `stderr.txt`, `result.json`. Captures are distinct per invocation; no staging is used.

| Cycle / label prefix | Exact expected Red observed | Red capture root suffix | Green capture root suffix | Green |
| --- | --- | --- | --- | --- |
| `PC-B10-no-stage-one` | Missing stage-one consent returned scaffold `GIT_UNAVAILABLE`, expected `GIT_CONFIRMATION_REQUIRED` | `pc-s1-test-bc3WwA` | `pc-s1-test-wioYVJ` | 1/1 passed |
| `PC-B10-unknown-decision` | Non-null unknown decision returned `GIT_UNAVAILABLE`, expected `GIT_CONFIRMATION_REQUIRED` | `pc-s1-test-MYyUhv` | `pc-s1-test-MgUhmj` | 2/2 passed |
| `PC-B10-approved-inspection` | Accepted stored authority could not reach the execution port: unavailable instead of its prepared version observation | `pc-s1-test-wPHdDG` | `pc-s1-test-eyoPmM` | 3/3 passed |

Every capture root is under `C:/Users/pedro/AppData/Local/Temp/opencode/`; label suffix was `-red` or `-green`. Red runs exited1 with the named assertion failure; Green runs exited0. Test names are respectively `requires stage-one consent before inspecting an executable version`, `refuses an unknown stage-one decision without dispatching a version child`, and `returns the version observation admitted by the stored stage-one decision`. Refusal assertions also observed no execution-port admission. No native child was launched by these tests.

After the first two cycles, separate local review/check pass:

- CodeScene configuration/connection checked using required guidance: no PAT/on-prem/account override; OAuth verification5/5 passed. Configuration reference: `https://codescene.io/docs/integrations/mcp.html#configuration`.
- Detailed CodeScene reviews of `project-registration-observer.ts`, its test, and `registration/git-version-inspection.ts`: each10.0, no findings at that pre-third-cycle revision. Later edits make those results historical; they are not current final approval.
- Sonar MCP invocation returned `Not authorized. Please check server credentials.` before analysis. **Broken authentication gate**, reported to parent for resolution; no Sonar pass is claimed.
- `pnpm exec biome check apps/harness/src/project-registration-observer.ts apps/harness/src/project-registration-observer.test.ts apps/harness/src/registration/git-version-inspection.ts` found import ordering and signature formatting. Corrected with apply_patch. These style corrections and schema-derived prepared-result typing were included in the third cycle's subsequent source snapshots.
- Automated RPIV write hook continues to time out under the system Node executable. Required checks have not been weakened.

### Continued observer cycles — through first real Windows version child

Same candidate cwd and capture runner. Unit command remains `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness`. Root suffixes below resolve beneath `C:/Users/pedro/AppData/Local/Temp/opencode/`, with exact source bytes/hashes and raw output retained in each capture.

| Label prefix | Observed expected Red | Red root | Green root | Green scope |
| --- | --- | --- | --- | --- |
| `PC-B10-durable-version` | Unavailable scaffolding instead of parsed prepared observation through journal/execution ports | `pc-s1-test-91sJAq` | `pc-s1-test-m2glCh` | 4/4 |
| `PC-B10-before-replacement` | Replaced physical file ID was accepted and yielded prepared | `pc-s1-test-GxwkPz` | `pc-s1-test-HwdffD` | 5/5 |
| `PC-B10-during-replacement` | Version stdout was accepted after identity changed during dispatch, rather than invalidating | `pc-s1-test-r5XBge` | `pc-s1-test-tyrf0K` | 6/6 |
| `PC-B10-nonzero-version` | Nonzero23 with valid-looking stdout yielded prepared instead of `GIT_QUERY_FAILED` | `pc-s1-test-h4ONX8` | `pc-s1-test-kBgvqq` | 7/7 |
| `PC-B10-invalid-version` | Invalid UTF-8 escaped as decoder error; extra line used unavailable; NUL and non-version text were accepted | `pc-s1-test-IzeRRC` | `pc-s1-test-0sj3Bi` | 11/11 |
| `PC-B10-output-limit` | Each8193-byte stream plus nonzero exit was classified as query failure instead of higher-priority limit failure | `pc-s1-test-Migwj8` | `pc-s1-test-wLfN3E` | 13/13 |
| `PC-B10-internal-failure` | An unexpected identity-port error escaped with a synthetic private-path canary instead of `broken / INTERNAL_FAILURE` | `pc-s1-test-jpnQAx` | `pc-s1-test-o54LdQ` | 14/14 |

All Red commands exited1 with the named behavioral failures, not import/type/setup failures. All corresponding Green commands exited0. The journal in unit scenarios remains test-owned in memory: `durable-version` names the journal-before-dispatch/publication ordering subclause and does **not** prove SQLite durability or full PC-B12 settlement. Native executable-identity reading, persistent authority, full lifecycle/failure precedence and second-stage admission remain in progress.

The v4 exact test name `invalidates a version result when executable identity changes during dispatch` now has a prospective Red/Green pair through the observer public port. It records invalidation rather than a reusable prepared result in the test journal; the unchanged identity control remains positive. Complete v4 consent/history/reconfirmation/transport obligations are still pending.

Separate review/refactor after minimal version parsing: extracted reusable test scenario without changing assertions; `PC-B10-version-refactor-green` capture `pc-s1-test-iFTINj` passed4/4. CodeScene subsequently scored `version-observation-execution.ts`, `executable-identity.ts` and the test file10.0 at that reviewed revision. Focused harness typecheck passed. Style findings were corrected via apply_patch; no formatter write command was used.

### Native production version-child cycle

Public seam: the same observer with real `createWindowsVersionChild` execution in `apps/harness/tests/integration/project-registration.integration.test.ts`. Exact test: `inspects the admitted installed Git version through the owned native child`. The consent, executable identity and journal ports are explicitly test-owned; only the Windows child implementation is real in this first integration control.

Capture command: `pnpm exec node "<capture-runner>" "<label>" "pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts"`.

- `PC-B10-native-version-red`, root `pc-s1-test-zi3jtq`: unavailable instead of prepared; exit1.
- Before native source implementation, strengthened the same prospective test to require child ownership notification before version validation and the exact observation-bound job name plus OS creation identity. `PC-B10-native-owned-version-red`, root `pc-s1-test-0ol5CT`: same expected unavailable assertion; exit1. This adds the already approved D2 ownership oracle, not a changed authority document.
- Authored `registration/windows-observer-api.ts` and implemented `registration/windows-version-child.ts` after these Reds. They use the approved Koffi3.2.1 binding, a creation-time job list, explicit inherited handle list, closed NUL stdin, separate bounded stdout/stderr pipes, clean environment, controlled non-repository cwd, owned process/thread handles and native creation time. Owner notification is awaited before resume. Success requires process exit, zero job members and EOF on both pipes.
- `PC-B10-native-owned-version-green`, root `pc-s1-test-J5kt0b`: exit0,1/1 passed, approximately165ms test duration. Observed installed Git version `2.53.0.windows.1`.
- Unsupported host/architecture returns `GIT_UNAVAILABLE`; no Linux native-child support is claimed. Failure/cleanup branches are still conservative internal failures pending their exact typed lifecycle implementation/tests, not full D2 conformance.

### Native review/refactor and current checks

- Initial CodeScene `windows-version-child.ts`: **8.15**, with complex `runVersion`, complex `readPipe` and compound conditions. `windows-observer-api.ts` and native integration test scored10.0.
- Separated admission predicates/validation and native attribute-size predicate. CodeScene improved to9.68 with only `readPipe` remaining; native test passed in `PC-B10-native-admission-refactor`, root `pc-s1-test-Ogp30y`.
- Separated pipe availability/EOF observation from bounded receiving. CodeScene improved to**10.0**, no findings; native test passed in `PC-B10-native-pipes-refactor`, root `pc-s1-test-LYJQtb`.
- Confirmed both byte ceilings were exactly8192 with the same stream meaning, then extracted one shared `REGISTRATION_STREAM_BYTE_LIMIT` owner. Child deadline and forced-cleanup delay both happen to be2000ms but retain separate meanings; they were not conflated.
- Applied Biome's proposed formatting through apply_patch. Focused `pnpm exec biome check apps/harness/src/project-registration-observer.ts apps/harness/src/project-registration-observer.test.ts apps/harness/src/registration apps/harness/tests/integration/project-registration.integration.test.ts` passed:9 files, no fixes. `pnpm --filter @slopstop/harness typecheck` passed after native introduction.
- `PC-B10-version-group-unit-green` root `pc-s1-test-tG8asG`:13/13 at that pre-internal-error-test revision. `PC-B10-version-group-native-green` root `pc-s1-test-1uOZAX`:1/1 after refactor/shared limit/formatting. The later internal-failure pair above is the latest unit14/14 result.
- Sonar authentication remains the reported broken external gate; no repeated request or waived result is claimed. Parent owns independent final candidate review. No broad baseline/full gate was run.

### Linux coordination update

Parent supplied `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-linux-koffi-proof-20260913-a/RESULT.md`: Linux statx/ext4 identity passed in the other owner's proof, but WSL kernel6.6.87.2 rejected process-group pidfd signalling with EINVAL. Numeric PGID fallback is not shipping authority. Continue Windows and portable work; retain Linux D2/platform acceptance as pending with parent owning environment/mechanism choice. No Linux investigation or source modification was performed here in response.

### Native physical identity / executable digest cycles

Integration command remains `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts`, wrapped in the same pinned capture runner from candidate cwd. Root prefixes below are the approved Temp directory.

| Cycle | Expected Red observed | Red root suffix | Green root suffix | Green |
| --- | --- | --- | --- | --- |
| `PC-B11-native-directory` | Directory observation unavailable instead of an observed physical key | `pc-s1-test-AtBsUJ` | `pc-s1-test-JrMPFe` | 2/2 |
| `PC-B5-missing-directory` | Missing location classified as internal broken instead of `REPOSITORY_NOT_FOUND` | `pc-s1-test-bjFcEf` | `pc-s1-test-DaGTxr` | 3/3 |
| `PC-B10-native-executable-identity` | Selected executable observation unavailable instead of native identity plus digest | `pc-s1-test-zNBQAB` | `pc-s1-test-Qyp6Ct` | 4/4 |
| `PC-B10-identity-capability` (unit command) | Capability failure before/after child mapped to renewed consent instead of preserving `IDENTITY_CAPABILITY_UNAVAILABLE` | `pc-s1-test-EiTQnl` | `pc-s1-test-y41p5Z` | 16/16 |

The native directory test observes a real local NTFS directory, compares inode and birth nanoseconds with independent bigint Node metadata, proves case-alias equality, same-volume rename equality and different identity for a replacement at the original path. It does not by itself prove registration linkage or reboot/remount continuity. The native executable test hashes the exact held file handle in finite initial-size-bounded chunks, checks creation/write/size stability, and compares against an independent complete file read. Access time is not used as identity or a content-stability condition.

The installed-Git integration control now uses `observeSelectedExecutable` for the immutable test selection and both execution-time identity checks instead of its former synthetic physical identity. Native and version components together passed4/4 in `PC-B10-native-identity-version-composed-green`, root `pc-s1-test-lmLRvL`. Consent authority and journal remain test ports, explicitly not database persistence proof.

CodeScene initially scored `windows-file-identity.ts`9.38 (overall complexity) and `version-observation-execution.ts`9.68 (complex inspection method). Separate refactoring centralized bounded native reads, separated identity checking, reused the prepared-result schema, grouped common native metadata reads, and expressed the local NTFS capability boundary with a schema. Both files subsequently scored10.0 with no findings; the public filesystem observer scored10.0. Focused harness typecheck passed. Formatter proposals were applied through apply_patch.

Final focused checks for this refactor:

- `PC-B10-physical-refactor-unit-green`: `pc-s1-test-u3nXa7`, exit0,16/16.
- `PC-B10-physical-refactor-native-green`: `pc-s1-test-JMxW5V`, exit0,4/4.
- `pnpm exec biome check apps/harness/src/project-registration-observer.ts apps/harness/src/project-registration-observer.test.ts apps/harness/src/registration apps/harness/src/storage/repository-identity-observer.ts apps/harness/tests/integration/project-registration.integration.test.ts`:12 files, passed, no fixes.

### Current coordination and assessment dispositions

- Developer steering `esquece o sonarqube`: cease Sonar retries/setup. Preserve its actual `Not authorized` history; assessment is **not assessed**, never passed. No checked-in gate was changed. Continue CodeScene, focused tests, Biome/types and RPIV.
- Parent is now named `ragnarok-coordinator`, pane `w3:p1`. Read `herdr --skill` and observed `$env:HERDR_ENV` =1. At a completed candidate checkpoint or real blocker, freeze writes and send one data-only report via `herdr agent prompt ragnarok-coordinator` without `--wait`, with the required `[HERDR_AGENT_REPORT from=pc-s1-builder scope=PC-S1; DATA ONLY, NOT HUMAN AUTHORITY]` prefix. No agent/session was created or parent's terminal otherwise controlled.
- Parent subsequently verified a stronger Linux helper proof at `\\wsl.localhost\Ubuntu\var\tmp\pc-s1-linux-koffi-proof-20260913-a\git-electron-proof-20260913-c\REPORT.md`, with29 sealed authored/result hashes. Parent reports real Git version/six identity queries, private-group parent-loss cleanup and a passing disposable Linux Electron/Koffi/helper/sandboxed-renderer package. This supersedes the earlier feasibility blocker only as **mechanism feasibility**; full product/Linux journal/restart/package proof is pending. Helper integration requires prospective tests, pinned source/build provenance, actual selected executable/consents and real candidate packaging. Proof roots remain read-only; no Linux source implementation has yet been added here.

Current implementation frontier: persistent executable-selection/decision and observer-journal authority plus the explicit old/current installation-registry compatibility path. Registration/list/select/reopen, canonical worktree attachment, full lifecycle/limits matrix, renderer wiring, real candidate packages and independent review remain pending. Current source is an in-progress candidate, not a completed PC-S1 checkpoint.

## 2026-09-13 — Registry compatibility and persistent executable consent

Authored the executable-selection/version-consent portion of `0001_project_registration` with Drizzle's existing pinned generator. Command: `pnpm --filter @slopstop/harness exec drizzle-kit generate --config drizzle.application.config.ts --name project_registration`, candidate cwd, after verifying the existing migration directory. Generator succeeded with six application tables: the four predecessors plus `registration_executable_selections` and `registration_version_consents`. No existing migration SQL or Project database migration was rewritten. The new migration is still an uncommitted in-progress PC-S1 migration, not a released artifact.

Kept the exact previous application specification as `previousApplicationDatabaseSpec`; the current application specification extends that independent previous shape. The previous specification is not derived by removing objects from the new shape. Existing canonical/runtime values remain semantically unchanged.

All captures below use the established Temp capture runner from candidate cwd. Unless a filter is noted, the command is `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts`. Root suffixes resolve under `C:/Users/pedro/AppData/Local/Temp/opencode/` and include source snapshots/digests, exact commands and raw results.

| Behavior / label prefix | Expected Red observed | Red root | Green root | Result |
| --- | --- | --- | --- | --- |
| `PC-B8-persistent-executable-consent` | Selection preparation unavailable; persistent consent path absent | `pc-s1-test-pUHrQE` | superseded by two-installation-state control below | initial prior-registry Red |
| `PC-B8-consent-fresh-previous` | Fresh and previous installations both unavailable instead of prepared | `pc-s1-test-DqRpuL` | `pc-s1-test-UpzRqI` | 6/6 integration tests |
| `PC-B8-unknown-registry` | Unknown head returned generic internal failure | `pc-s1-test-Ze3WRu` | `pc-s1-test-DyAvQT` | 7/7 |
| `PC-B8-newer-registry` | Newer format/schema plus unknown head returned generic internal failure | `pc-s1-test-0gMHKU` | `pc-s1-test-TsXDGV` | 9/9 |
| `PC-B8-corrupt-registry` | Corrupt metadata plus newer/unknown values returned generic internal failure | `pc-s1-test-astALT` | `pc-s1-test-1t5yyy` | 10/10 |
| `PC-B8-registry-witness` | Missing witnessed registry returned internal failure instead of explicit recovery | `pc-s1-test-055tae` | `pc-s1-test-vY2H82` | 11/11; no new DB, witness preserved |
| `PC-B8-schema-drift` | Extra old-schema column/table/view/index/trigger reported generic internal failure instead of corruption | `pc-s1-test-OCJDPy` | `pc-s1-test-ITpPEj` | 16/16; previous head and no added registration tables preserved |
| `PC-B8-registry-contention` | Held SQLite writer reported broken instead of `REGISTRY_BUSY` | `pc-s1-test-IMEmz1` | `pc-s1-test-tSqqid` | focused1/1,16 filtered |
| `PC-B8-metadata-no-coercion` | NULL metadata version was coerced to an older version and reported unknown | `pc-s1-test-dh0h6x` | `pc-s1-test-O9lobe` | focused1/1,17 filtered |
| `PC-B10-consent-replay` | Exact consent retry hit duplicate INSERT and returned broken | `pc-s1-test-gLjn0l` | `pc-s1-test-hz8XQF` | focused1/1,18 filtered; original row unchanged |
| `PC-B10-consent-conflict` | Changed selection under the same consent ID returned internal failure | `pc-s1-test-aJuaFX` | `pc-s1-test-FZJHMZ` | focused1/1,19 filtered; original decision still replays |
| `PC-B8-commit-ack-reconciliation` | A real committed migration with an injected lost acknowledgement returned broken instead of verified continuation | `pc-s1-test-mqPCrK` | `pc-s1-test-rD6WX6` | focused1/1,24 filtered; current head confirmed, one DDL attempt |

Focused filter suffixes were respectively `-t reports.registry.contention`, `-t rejects.malformed.metadata`, `-t replays.a.version.consent`, `-t rejects.changed.consent`, and `-t reconciles.a.lost.migration.commit`. Filtered tests are not claimed as executed.

The consent persistence tests use real native executable identity and real SQLite, reopen the registry and exercise the observer's authority resolver. Their execution adapter remains deterministic: they prove persisted selection/consent, not a durable native process journal. They verify the original legacy registration row's values remain equal and the application format/schema stay1 with the new migration head. Valid older Project-generation safe-mode proof remains pending.

### Rollback control correction

Capture `pc-s1-test-Wvu7Uk`, labelled `PC-B8-migration-rollback-red`, is **not counted as prospective failure proof**: the newly declared fault hook was not yet connected, so no intended failure was actually injected. Preserve that failed test attempt, but do not interpret its label as a valid Red.

After connecting the approved public failure-injection points, `PC-B8-migration-rollback-controls`, root `pc-s1-test-BPFTNo`, executed actual failures before DDL, after DDL, before metadata advancement and before commit. All4 controls passed with the previous head, previous row and no registration extension left behind. This verifies reuse of the existing transaction executor's rollback behavior; it is not invented new rollback implementation proof.

For the lost-commit-acknowledgement cycle above, the hook was connected **before Red** around actual transaction commit. The Red test independently read `0001_project_registration` before failing its prepared-outcome assertion, proving commit had occurred. Implementation then retained the classified transaction result, closed the uncertain client, reopened and revalidated exact old/current authority without replaying DDL. Only verified current authority continues; verified previous authority remains failure rather than automatic retry.

### Review/refactor and regression checks

- Initial CodeScene registry implementation: `registry-database.ts`8.73 (nested/complex migration logic), `registration-registry.ts`10, `application-schema.ts`10, shared database specifications9.68 (string-heavy arguments).
- Extracted metadata reading, version admission, head classification and migration statement application. Registry score initially improved to9.38; later schema-based integrity checks and typed helpers cleared the regression gate.
- Pre-commit safeguard initially failed with registry complexity, repeated negative-test setup and string-heavy specification arguments. Refactored common fixture setup and table/column references; no CodeScene thresholds or checked-in gates changed.
- Refactor integration captures: `pc-s1-test-LeOXd3` and `pc-s1-test-9cMcQv`,16/16 passed at their bound revisions. Earlier `pc-s1-test-RwrGT6` was a **broken verification command** because its guessed test filename did not exist; no tests ran and it is not proof. Dedicated file discovery then resolved the real predecessor test.
- `PC-B8-existing-storage-create-regression`, root `pc-s1-test-8aZupo`:60/61 existing storage creation tests passed; the remaining assertion expected the former four application tables. Updated that exact-list assertion with only the two approved registration tables, retaining strict equality. `PC-B8-existing-create-exact-schema-green`, root `pc-s1-test-WXCJKQ`, reran that one case with `-t creates.the.exact.canonical.generation-2.schema`:1 passed,60 filtered. This aligns the predecessor oracle with the already approved additive schema; it is not a weakened table check.
- CodeScene pre-commit safeguard then passed with17 eligible/checked files and `status=no-issues-found` (27 modified paths at that revision). Subsequent failure/replay work makes this historical rather than final candidate clearance.
- Harness typecheck passed during the registry review. Additional formatting/current checks and the remaining PC-B8 concurrency/uncertainty cases are still in progress. Sonar remains not assessed per explicit user steering.

## 2026-09-19 — Resumed candidate, durable observer journal and partial handback

Resumed with explicit candidate cwd. Read the latest registry/consent evidence before edits. `git rev-parse --show-toplevel` returned `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`; HEAD remained `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, branch `feat/project-registration`. All existing dirty work was preserved. Earlier tool timestamps in this session reported2026-09-13; this heading follows the current harness date rather than rewriting those timestamps.

Reconciliation found pending journal scaffolding after the recorded consent work. The pending prospective Red was already captured in `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-eWCLEN` under label `PC-B12-durable-observer-red`: the observer returned broken rather than prepared because its persistent journal was unavailable. The previously added admission guard also has `PC-B12-unsettled-admission-red` at `pc-s1-test-GMpK3h` and Green at `pc-s1-test-ofLSwn` (17 unit tests), proving unsettled ownership precedes missing executable consent through the public observer port.

Implemented `registration/observer-journal.ts` and extracted the shared executable-consent row readers into `registration/executable-consent-store.ts`. The registry now supplies the journal and admission port. Intent is stored before child dispatch; child identity and confirmed terminal facts precede outcome publication. Unsettled state derives from intents without outcomes. Completed version observations are read back to avoid repeating a version child. The implementation validates stored consent/selection bindings again in journal admission.

The in-progress, unreleased `0001_project_registration` migration was regenerated from the unchanged0000 baseline to include four journal tables: `registration_observer_intents`, `registration_observer_children`, `registration_observer_terminals`, `registration_observer_outcomes`. Its earlier six-table form remains in prior capture source snapshots. Only this session's generated0001 SQL/snapshot were replaced; no released migration or original-workspace file was changed. Generator command remained `pnpm --filter @slopstop/harness exec drizzle-kit generate --config drizzle.application.config.ts --name project_registration`; result:10 application tables. No real user-data migration was executed.

### Actual verification

All commands below ran from the candidate with the established capture runner and pinned Node. Roots are under `C:/Users/pedro/AppData/Local/Temp/opencode/`.

- `PC-B12-durable-observer-green`, root `pc-s1-test-jTDNip`: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts -t persists.observer.intent`;1 passed,25 filtered. This uses a real Windows Git child, real SQLite journal, an independent registry reader before dispatch, terminal publication and exact version-result replay with only one dispatch.
- `PC-B8-independent-process-control`, root `pc-s1-test-dqM7nP`: same integration command with `-t holds.registry.write.exclusion`;1 passed,26 filtered. Two actual Node processes exercised the registry: the first held the migration transaction, the second returned `REGISTRY_BUSY`, then succeeded on explicit retry after release. Only the first process entered DDL. This is a new verification control over existing transaction behavior, not an invented prospective Red.
- `pnpm --filter @slopstop/harness typecheck`: passed before the subsequent structural refactor. Do not treat it as a final full-candidate check.
- CodeScene initially reported new complexity in journal/version/migration functions, a fixture conditional, and the predecessor test crossing its file-size threshold. Refactored journal admission/completion, post-child publication, migration failure hooks and fixture condition. Moved the independent exact application-table oracle into `tests/integration/registration-schema-fixture.ts`, including all10 approved current tables; strict equality is retained.
- `PC-B12-journal-unit-refactor`, root `pc-s1-test-1g0g7O`: `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness`;17/17 passed.
- `PC-B12-journal-integration-refactor`, root `pc-s1-test-RNr1Xw`: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts`;27/27 passed. This capture contains the latest tested non-Markdown source bytes/hashes.
- CodeScene pre-commit safeguard after those refactors: **passed**,23 eligible/checked files,33 modified paths, `status=no-issues-found`. This is a local Code Health result, not independent candidate acceptance.
- Read-only targeted Biome check using the pinned binary and JSON reporter: **failed**,16 errors and1 informational diagnostic across23 checked files. Remaining diagnostics are formatting/import organization plus `useTemplate` in `registration-registry-peer.mjs`. No automatic source rewrite or gate weakening was performed.
- Sonar: **not assessed**, per explicit user instruction; no authentication setup or retry was performed.

The peer fixture uses the existing pinned Node24 runtime's `--experimental-transform-types` and synchronous `module.registerHooks` only to resolve this candidate's TypeScript source in a separate test process. This is test infrastructure, not a shipped runtime loader. Current Node documentation was retrieved through Context7. No new dependency version, global tool, agent or session was installed/created.

### Partial handback / explicit limitations

**This is not a completed PC-S1 candidate.** Source writes are frozen at this partial handback. The implementation session cannot reliably continue the remaining large contract in its current execution state. No model/API/authentication error response was observed, and none is claimed; this is an execution-reliability limitation, not a fabricated tool failure. No model was switched.

Remaining work includes:

1. Finish targeted formatting/import fixes and recheck current types/tests; verify the updated10-table predecessor assertion.
2. Complete registry concurrency/uncertain-commit coverage, including prior-state classification after uncommitted uncertainty, global relationship checks and all required old-Project preservation cases.
3. Complete observer lifecycle: cancellation/close, exact timeout/cleanup precedence, explicit no-dispatch/unconfirmed handling, restart reconciliation and actual owner-loss candidate tests. Current native failure handling is still incomplete. Terminal facts currently rely on the native child port's `exited` contract; negative lifecycle paths need their prospective tests and implementation.
4. Implement second-stage executable consent, exact repository trust decisions, the six closed Git identity queries, preparation/confirmation limits and immutable proposals.
5. Implement real repository registration, common-directory reservations, request replay/publication recovery, list/select/reopen and canonical `identity.workspace.attach` with all PC-B1…PC-B12 obligations.
6. Integrate the parent-provided Linux helper only with prospective tests and sealed build provenance; no Linux product adapter/package pass exists here.
7. Wire protocol/runtime/main/preload/renderer, verify real Electron journeys and actual Windows/Linux candidate packages. No renderer work has been authored in this session.
8. Run applicable final scope gates and obtain parent-owned independent reviews and human acceptance. No commit, staging, push or integration is authorized or performed.

All earlier failed, broken, invalid-Red and limited-scope results remain historical as recorded. The latest CodeScene pass and focused Green results must not be described as all required gates passing or full feature completion.

## 2026-09-19 — Observer continuation: identity and nonbehavioral repair

Exclusive candidate continuation follows the source `2026-09-19_pc-s1-observer-continuation.md` and the current user instruction. Branch/base remain `feat/project-registration` / `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`. All 26 v4 direct/inherited raw authority bindings matched, including absolute shared-workflow paths; the first verification invocation mishandled absolute paths and failed before completion, then the corrected read-only verification passed. Explicit `validate-artifact.mjs <source-design> --root <source-workspace>` passed without stamping. All non-Markdown inputs in `pc-s1-test-RNr1Xw/inputs.json` matched the incoming candidate exactly. The three naming documents and existing migration/config/dependency work were preserved.

Reproduced Biome's 16 errors and one informational `useTemplate` diagnostic. Applied formatting/import organization and the equivalent template literal using `apply_patch`. Formatter stdin was used only to derive suggested text, never to write repository files. This is a nonbehavioral exemption: no intended behavior or test oracle changed, and no retrospective Red is claimed.

Source-bound captures under `C:/Users/pedro/AppData/Local/Temp/opencode/`:

- `pc-s1-test-PxDADW`, `PC-observer-continuation-types`: `pnpm --filter @slopstop/harness typecheck`, passed.
- `pc-s1-test-o8To7j`, `PC-observer-continuation-unit`: focused observer unit command, 17/17 passed.
- `pc-s1-test-iCG7U2`, `PC-observer-continuation-integration`: focused registration integration command, 27/27 passed.
- Read-only pinned Biome JSON check: 23 files, zero errors/warnings/info after repairs.
- Separate CodeScene review found two newly expanded large test methods. Extracted the unchanged old-row oracle and independent unsettled-state reader, preserving assertions. `pc-s1-test-X1DnPV`, `PC-observer-continuation-refactor`: registration plus `project-storage-create.integration.test.ts`, 88/88 passed, including the exact ten-table predecessor oracle. CodeScene then passed 23/23 eligible files, `no-issues-found`.

Tool limitations preserved: the automatic RPIV write hook repeatedly reports `spawnSync C:\Program Files\nodejs\node.exe ETIMEDOUT`; this is a broken hook, not validation success. Direct read-only artifact validation passed separately. Context7 invocation from candidate failed `EBADDEVENGINES` (host Node24.20.0 versus pinned24.19.0); documentation lookup from approved Temp succeeded without changing the candidate toolchain. Sonar remains **not assessed**, with no setup/retry. Independent candidate review and human acceptance remain parent-owned and pending.

### PC-B8 — Registry uncertainty and relationship controls

Seam: existing registration application in `apps/harness/tests/integration/project-registration.integration.test.ts`, real worker-backed SQLite and independent readback. Exact v1 registry compatibility plus v2 B8/D5 remain the oracle.

- **Predecessor characterization, not Red:** `preserves the exact previous registry after uncertain uncommitted migration`, capture `pc-s1-test-v8WYJN`, label `PC-B8-uncommitted-characterization`, passed1/1. The pre-existing commit-before-boundary fault yields `broken / INTERNAL_FAILURE`, reopens and validates the old head without repeating DDL. All four previous tables' rows and the complete `sqlite_schema` remain equal. This confirms the old-state branch rather than claiming newly implemented behavior.
- **Prospective Red → Green, global Project ownership:** `rejects inconsistent Project relationships across the previous/current registry`. Red `pc-s1-test-GOqLSN` returned `INTERNAL_FAILURE` after failing to reject a schema-valid, FK-valid generation belonging to a different Project. Required `REGISTRY_CORRUPT` was absent. Added locked global generation-to-registration ownership validation; Green `pc-s1-test-5BeWPj`,2/2. Both heads reject without changing the captured schema/old rows.
- **Prospective Red → Green, active relationships:** `rejects an inconsistent active registry relationship: %s`, four cases (staging selected location, inactive selected generation, unselected active generation, mismatched activation timestamp). Red `pc-s1-test-wDNHN5`,4 assertion failures (`INTERNAL_FAILURE` instead of `REGISTRY_CORRUPT`). Added locked global active-generation/location/pointer agreement checks; Green `pc-s1-test-94YQD7`,4/4. All fixtures pass foreign-key checks independently, proving the additional relational check is necessary; corrupt inputs preserve complete schema and prior rows.

Every capture uses the established runner, stores intermediate source bytes/SHA-256 in `inputs.json` and `source/`, and executes the smallest `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts -t <named-pattern>` command. These results do not yet close all PC-B8 old-Project/safe-mode cases or D2/B12 lifecycle work.

### PC-B12 — Prospective observer lifecycle work

Same capture runner and Temp prefix. All Red failures below are observed behavioral assertions, not compile/import/framework timeout failures. Native tests use the installed trusted Git executable created suspended in the candidate's Windows Job Object; delayed ownership callbacks are test barriers, not alternate process owners.

| Behavior / exact test | Red capture | Green capture | Observed proof |
| --- | --- | --- | --- |
| `settles proven no-dispatch capability refusal without inventing child exit` | `pc-s1-test-rXVmF3` | `pc-s1-test-u47kTf` | Previously returned cleanup-unconfirmed for an explicit pre-dispatch capability refusal. Now records the unavailable result without child/terminal rows, clears the intent and replays without a second admission. Real registry; controlled child port, not native unsupported-platform certification. |
| `settles a native observer deadline while child ownership publication is held` | `pc-s1-test-q14K3j` | `pc-s1-test-bvvzIW` | Red returned the explicit `deadline-not-settled` oracle after7500ms while ownership callback remained held. Native Green honors the2000ms observation deadline, forcibly settles the suspended owned child after the cleanup grace interval, independently observes exit/tree-empty/pipe EOF, records terminal facts, returns `OBSERVATION_LIMIT_EXCEEDED` and never resumes the late callback. |
| `cancels an owned native observation on close without publishing late output` | `pc-s1-test-0KeqSn` | `pc-s1-test-H6T0Yy` | Minimal `close` signature scaffold initially did not cancel; Red returned observation-limit rather than cancelled. Green propagates cancellation to the native owner, records actual terminal proof and durable cancellation, closes new admission, and remains settled across registry restart. |
| `closes by the cleanup deadline and refuses a late successful observation` | `pc-s1-test-rgDBzv` | `pc-s1-test-UKaxfi` | Public observer with a controlled unresponsive inspection port: no close result at4999ms, explicit cleanup-unconfirmed at5000ms, late success refused. Close shares one memoized budget. Unit clock control; no native timing claim for this case. |
| `retains uncertain dispatch across restart with child identity=%s` | `pc-s1-test-fiQX7i` | `pc-s1-test-RHy3rH` | Two cases: error before recording child identity and after recording it. Cleanup-unconfirmed is primary with typed `INTERNAL_FAILURE` trigger; marker survives real registry restart and prevents a second admission. No absence inference from a missing child row and no raw canary disclosure. |
| `never persists a late successful version after the observer has closed` | `pc-s1-test-SxyMST` | `pc-s1-test-p59RnG` | Controlled child port plus real SQLite: close times out with cleanup-unconfirmed; later terminal proof may settle cancellation, but cannot store a prepared version. Independent outcome-row read asserts exact cancelled JSON. This is not an OS owner-loss test. |

Separate review/refactor after these focused Greens extracted registry relationship checks, child outcome settlement and native cleanup predicates. Earlier whole-focused checkpoint: `pc-s1-test-0mZB1C` unit18/18, `pc-s1-test-4sNbzw` integration39/39. Typecheck capture `pc-s1-test-IXSfWH` passed before those later edits. CodeScene identified complexity/conditional/primitive-argument regressions; structural remediation is in progress and requires a fresh final result. Do not transfer those earlier whole-focused/type passes to subsequent source edits.

Still unproved/unimplemented at this point: automatic exact-absence restart reconciliation and its durable no-late-publisher fence; actual owner-loss/PID-reuse controls; native failure-trigger preservation through cleanup errors; complete D2 equality/EOF/termination-error matrix; close during earlier admission or journal phases; full B8 old-Project byte/safe-mode controls and all global relationship variants. No candidate acceptance or completed bounded packet is claimed.

### 2026-09-20 — Further prospective proof and frozen partial checkpoint

The preceding remaining-work paragraph records its earlier frontier. Subsequent work below supersedes only the explicitly proved cases. Source writes are now frozen for coordinator inspection; **the bounded observer/registry packet remains incomplete**, as do PC-S1 and candidate acceptance.

| Behavior | Prospective Red | Green | Scope actually proved |
| --- | --- | --- | --- |
| `reconciles durable native terminal proof and fences the former publisher` | `pc-s1-test-e9tVwW` | `pc-s1-test-MPKdrQ` | Real native Git and SQLite. Hold the old publisher after durable exit/EOF/tree-empty facts; an independent registry transaction records the interrupted result and fences late publication through the unique outcome. Reconciliation is idempotent. |
| `reconciles an exact absent native owner after terminal publication is lost` | `pc-s1-test-YeBBWP` | `pc-s1-test-2EuU8m` | Native child completes but its terminal return is lost before journal publication. Explicit reconciliation proves process/tree absence and records `broken / INTERNAL_FAILURE` with `reconciliation: exact-owner-absence`, without inventing terminal/EOF rows. This is not a killed-harness test. |
| `closes dispatch while %s admission is pending` | `pc-s1-test-NdRmZr` | `pc-s1-test-FH6hV5` | Two public observer unit cases: registry and executable-consent admission held across close. No later execution admission, cancelled observation and closed result. |
| `cancels a durable intent before child dispatch when close wins admission` | `pc-s1-test-rkxdjB` | `pc-s1-test-F5gzf3` | Real journal intent committed before close, then admission released. No child dispatch, durable no-dispatch cancellation, marker settled. |
| `preserves the deadline trigger when native cleanup cannot be proved` | `pc-s1-test-dBXGqE` | `pc-s1-test-zKlS0D` | Real suspended native child plus injected Job-query failure. Cleanup-unconfirmed stays primary, `OBSERVATION_LIMIT_EXCEEDED` is retained as secondary trigger, durable admission stays closed. This tests the named query-failure path, not every native failure path. |

Windows absence observation uses query-only process handles with creation FILETIME, complete Toolhelp process enumeration when an open reports an invalid PID, and named Job queries in the recorded Windows session. An open error alone is never treated as process absence. New native child identities record `sessionId`; historical identities without it cannot use the new absence probe and remain unconfirmed unless complete terminal proof already exists. A different Windows session remains unconfirmed. Reconciliation runs explicitly through `registry.reconcileObservers(...)`; final application startup wiring is not delivered here. No PID/image-name termination fallback was added. Current Win32 docs were retrieved with Context7 for OpenProcess, OpenJobObjectW, GetProcessTimes and Toolhelp enumeration.

**Additional predecessor characterization:** `preserves old Projects while extending the installation registry`, capture `pc-s1-test-y1q9R0`, passed. A real historically shaped canonical generation, runtime database and sealed manifest remain byte-identical; every prior registration/location/generation row remains equal; public Storage opening still returns the exact migration-required safe-mode result. The existing historical fixture was extracted unchanged into `project-storage-historical-fixture.ts` and its original control passed in `pc-s1-test-Hm51gt`. These are characterization/refactor checks, not retrospective Red.

The first combined name-filter command (`pc-s1-test-vqTaK7`) was **broken**: unquoted `|` was interpreted by cmd.exe, exit255. Corrected separate commands produced the captures above. A broader run (`pc-s1-test-atUjkq`) then found two genuine predecessor-test fixture failures: its copied migration tree contained new0001 while its invented successor journal replaced that migration. Updated the disposable successor fixture to retain0001 and append0002, with exact successor-head assertions retained. This was a fixture compatibility repair, not a weakened production gate.

#### Current source-bound checks

All captures below share exactly the current33 non-Markdown changed source/config files. Their inputs were rehashed against the worktree with zero mismatches after the final edit.

- `pc-s1-test-XBbUyj`: targeted Biome over all27 authored JS/TS files, **passed**, zero fixes.
- `pc-s1-test-AmgyB6`: `pnpm --filter @slopstop/harness typecheck`, **passed**.
- `pc-s1-test-0TV6sN`: observer unit suite, **20/20 passed**.
- `pc-s1-test-VilEQT`: registration + Storage create + Storage open integration suites, **150/150 passed** (45 registration,61 create,44 open).
- Final CodeScene safeguard: **passed**,27 eligible/checked files,37 modified paths, `status=no-issues-found`. Earlier degraded results remain historical. Fixture preparation/oracles and native lifecycle functions were factored without weakening assertions to resolve the reported file-size/complexity findings.
- Sonar remains **not assessed** by explicit user direction. No setup/retry.
- Existing Stryker configurations were inspected: none targets the behavior-changing observer/registry modules; the configured changed schema-spec file had only nonbehavioral formatting in this continuation. No mutation run or new mutation scope is claimed.
- RPIV automatic post-write hook remains broken with the recorded timeout. Explicit approved-design validation passed without stamping; no independent candidate review was run in this child session, per the no-nested-agent direction.

Current source identity anchor: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-VilEQT/inputs.json`, SHA-256 `4ba5629d6d782d7410cc00d6b929dda12a7a12886f3e139b87f16dbba295479d`. That file lists all33 source digests and its sibling `source/` retains the bytes. This is source-bound test evidence, not a substitute for the parent's complete RPIV review snapshot including Markdown/binary patch metadata. Base/branch remain unchanged. All26 approval bindings matched again. PRODUCT/CONTEXT/README retain their exact build-authority hashes. Existing migration0001, lockfile and dependency pins were preserved throughout this continuation.

#### Blocking remainder at this partial checkpoint

Focused Green is **not** full D2/B12 conformance. Local source inspection still identifies a concrete native classification gap: `readPipe` throws a generic error for real native overflow, whereas `settleFailedVersion` recognizes the deadline class for a settled limit result. The dispatcher can consequently return cleanup-unconfirmed/internal for that path even after cleanup proves terminal facts. This needs a prospective native-fault Red/Green, not a claim that the existing buffered-result unit overflow test covers it. Resource-close failures can also replace a prior typed trigger; cancellation-trigger preservation and native wait-error classification are not complete.

Other blocking proof/control work still within the requested packet:

1. Complete D2 exact0/2000/4000/5000 ordering and equality, graceful/no-graceful branches, EOF-without-exit, exit-without-EOF, termination errors and late-callback tests. The current process-cutoff branch can settle before the final cleanup offset; its exact contract timing still requires reconciliation/proof.
2. Actual killed-harness/owner-loss and PID-reuse controls, live-owner/session-mismatch/unsupported-capability negatives, and proof that later **new** requests resume only after exact recovery. Current real tests prove publication-loss and fencing, not every OS owner-loss window.
3. Extend old-Project byte preservation across the complete registry fault/uncertainty/concurrency matrix and complete global relationship controls beyond the Project/active-generation cases already proved. No broader registered/list/select/reopen functionality was added.
4. Parent-owned complete candidate snapshot, independent reviews, required remaining checks and human acceptance. No commit, staging, push, merge, main-source write, dependency/global install, UI/Conversation/model/Frame/Board implementation or nested agent was performed.

This is a **partial implementation checkpoint with blocking conformance work**, not a completed packet or an accepted candidate. No external service/model/tool error is invented as an explanation for the remaining implementation. Coordinator receives the exact source/evidence and retains the decision on continuation and review.

## Narrow Native Trigger Repair — Parent-Authorized Continuation

Authority: the user resumed the same unaccepted PC-S1 candidate and bounded this packet to native overflow/trigger preservation and affected D2 deadline/EOF semantics. Read the source continuation's appended `2026-09-20 Partial Checkpoint And Narrow Repair Continuation` first. Reverified candidate `feat/project-registration` / `97678d2a131daaf0791822ed3f5a7c3977ee7e7c` and exact incoming VilEQT source bytes before editing. No new slice/predecessor acceptance is implied.

**This narrow repair packet is implemented and locally checked; PC-S1 and the larger observer/registry packet remain in-progress and unaccepted.** The previous checkpoint's native generic-overflow, lost original cleanup trigger and affected timing defects below are superseded by the source-bound repairs, not erased from history.

### Behavior And Proof

All capture suffixes below resolve under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-`. Each contains the exact command, intermediate source map/bytes, stdout/stderr and actual exit status. Tests remain at the agreed public registration integration seam in `apps/harness/tests/integration/project-registration.integration.test.ts`.

| Repair / oracle | Prospective Red | Green | Actual scope |
| --- | --- | --- | --- |
| Native stdout/stderr overflow becomes typed limit failure after confirmed cleanup | `7ksUJK` | `VnfwtX` | Two cases write8193 actual bytes into the selected real native anonymous pipe. The fixture verifies native pipe capacity before its bounded WriteFile, then the real `readPipe` path rejects overflow. Red returned cleanup-unconfirmed/internal; Green records terminal proof and `unavailable / OBSERVATION_LIMIT_EXCEEDED`. No buffered-child-result substitute. |
| Original overflow/deadline/cancellation trigger survives resource-close, Job-query and native-wait faults | `cbf338` | `qQ3YSK` | Eleven cases: five new expected assertion failures and six passing controls, including the preceding overflow cases. Resource-close faults are injected after actual CloseHandle as acknowledgement loss; Job queries throw; native waits return WAIT_FAILED. Final public results retain typed `OBSERVATION_LIMIT_EXCEEDED` or `CANCELLED`; unconfirmed cleanup leaves durable admission closed and publishes no terminal/outcome rows. |
| D2 force/process/EOF/settlement offsets | `9I5vRU` | `IUhFzQ` | Eight clock-driven native-path cases initially failed. Force is observed at2000ms, not delayed by a1999ms poll; process proof is accepted only before4000ms; late process disappearance cannot restore success; EOF is separate and must complete before5000ms; unconfirmed cleanup settles at5000ms rather than aborting early on a failed probe. |
| Native proof calls that themselves cross a cutoff; resource-close uses the original budget | `sQq6MN` | `mKzNr1` | Three additional failures with eight earlier controls passing. A process query finishing at4000ms is too late; a terminal proof finishing at5000ms is too late; a close error after otherwise completed proof retains the first failure's5000ms deadline. |
| Delayed handling cannot restart cancellation cleanup budget | `zCzyrA` | `w95O5u` | Cancellation is observed at0; handling resumes at5000. Result is already cleanup-unconfirmed/CANCELLED rather than starting another5000ms budget. |
| The child deadline is rechecked after native completion | `Wr62kS` | `GNnRL6` | Actual installed Git child/tree exit is established by a native fixture barrier. Completion at1999ms remains prepared; completion at2000ms becomes a limit failure. Red incorrectly published prepared at equality. |
| A native query reaching the force boundary must not defer the force request | `jHnJ2j` | `0m6xVs` | The query starts at1999ms and returns at2000ms; the force request is stamped2000ms, not a later poll. |

Qualification of earlier captures: initial overflow capture `d0iBj0` was followed by the stronger `7ksUJK` Red, which asserts the actual8193-byte fixture write **before** the outcome assertion. Initial child-deadline capture `6BkKmc` failed because the fixture had not established complete child-tree exit before advancing its clock; it is **not** the expected behavioral Red. The corrected native barrier plus terminal-read assertion produced `Wr62kS` before the production fix. Neither earlier attempt is retroactively represented as stronger proof.

Timing tests use an explicit native observer clock port whose default remains monotonic `performance.now`, timer scheduling and bounded waits. The fixture advances to named policy checkpoints and observes the next actual native-loop wait/result event; it does not guess correctness from sleeps. Fault-controlled process/EOF notifications and operation duration exercise acceptance at exact boundaries, while retaining a real suspended child/Job and actual owned Job termination. These deterministic fault cases are policy proofs, **not** a claim that the operating system schedules termination at an exact wall-clock millisecond. Separate real-clock/real-pipe cases exercise the actual native cleanup mechanism.

Production changes retain one original trigger and occurrence time. Deadline failures are anchored to their absolute deadline, cancellation to its observed signal time, and overflow to its native observation. Cleanup polls cannot skip2000/4000/5000 cutoffs; evidence is rechecked after native calls before being accepted. Resource closure no longer throws over a prior outcome in `finally`; an unconfirmed close retains the original trigger and remaining absolute budget. `CANCELLED` is now an explicit validated secondary-trigger value, not a successful cancellation result when cleanup is unconfirmed. The failed observation never becomes successful merely because cleanup succeeds.

### Separate Review / Refactor And Final Checks

After minimal Greens, performed the separate local refactor gate. CodeScene initially found native cleanup complexity, fixture callback complexity/argument count and a growing public test file. Factored the cleanup state/budget steps and fixture setup/observation recording. Kept public assertions and fixed policy oracles in the agreed test flow; preserved legacy native test names/results and real native barriers. No gate threshold was weakened. Independent candidate review remains parent-owned; no nested agents were used.

Final current-source captures:

| Capture | Command / scope | Result |
| --- | --- | --- |
| `2ZRrT7` | `pnpm --filter @slopstop/harness typecheck` | passed |
| `Rb3sy5` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness` |20/20 passed |
| `p6aidn` | `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts` |71/71 passed;45 retained cases plus26 repair cases |
| `P6nMfT` | targeted `pnpm exec biome check` over all30 authored JS/TS files | passed, no fixes |

Final CodeScene safeguard: **passed**,30 eligible/checked files,40 modified paths, no degraded verdict. Its sole finding is an improved pre-existing schema-spec difference from HEAD; that file was **not edited in this repair packet**, verified against VilEQT. Do not describe `metadata.status=issues-found` as an empty/no-findings result; the gate passed with that improvement.

All four final captures have exit0, identical36-file source maps, and zero mismatches against the current candidate. The complete tracked/untracked non-Markdown change inventory equals that map. Final integration identity anchor:

- `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-p6aidn/inputs.json`
- SHA-256: `08128836b4ce538d6b23ade1ff8a55309e93ef484dd32baaa931371b11dccee4`
- Sibling `source/` retains every mapped file's exact bytes.

Only five incoming source files changed: `project-registration-observer.ts`, `registration/version-observation-execution.ts`, `registration/windows-version-child.ts`, the public registration integration test, and its `registration-version-fixture.ts`. Added `registration/observer-clock.ts` and the native clock/fault fixtures. The registry, migration, dependencies, other application code and three naming documents remain byte-identical to the incoming checkpoint. All26 approved authority bindings matched again.

Sonar remains **not assessed**, with setup/retries stopped. The automatic RPIV post-write hook still reports its prior timeout; direct read-only approved-design validation is recorded separately. No mutation result is claimed: the configured mutation target sets do not cover these changed native observer owners, and no new mutation configuration/scope was introduced in this bounded packet. The earlier150-test Storage-inclusive capture remains historical; this packet's final rerun is the focused71-case registration suite plus20 observer unit cases, not a claimed whole-PC-S1 gate.

### Frozen Handback Scope

Source writes are frozen after this locally completed **narrow repair**. No candidate acceptance, integration permission or completion of PC-S1/the larger observer-registry matrix is claimed. Remaining actual owner-loss/PID-reuse/negative capability, broader lifecycle and old-data/concurrency controls from the parent continuation remain pending. General first-failure classification without an existing limit/cancellation trigger, other platform behavior, final startup/transport/UI wiring, full packaging and independent whole-candidate gates are not certified by this packet. No new dependency/global install, Git mutation, source-main write, registration implementation, UI/model/Conversation/Frame/Board work or nested agent occurred.

Final hook diagnostic update: on this append the RPIV hook executed instead of timing out and reported six missing frontmatter fields on this existing append-only evidence record (`date`, `author`, `commit`, `branch`, `repository`, `status`). This is a reported validation failure, not a pass; prior timeout results remain historical. No `ready` state or invented artifact approval/frontmatter was added to conceal it. The original approved design's direct validator and26 raw authority bindings are separate checks.

## NR-1 / NR-2 — Corrections After Failed Independent Review

Read the parent's `2026-09-24_pc-s1-native-repair-review.md` before resuming. **That independent scoped gate remains historically failed; previous local Green is not review clearance.** The user authorized only the two existing-D2 corrections, in the same unaccepted PC-S1 candidate. This entry records the new author checkpoint for independent re-review, not acceptance or a new predecessor.

Before edits, verified all39 reviewed included-file hashes/modes, all36 captured non-Markdown sources, all26 intent bindings and the saved binary patch. The parent's review packet and snapshot remain unchanged:

- Review packet SHA-256: `bb2ba1ef82b9688ee0986a74f594eaf57a0552c61907cc3b332a0010686ef4e4`.
- Snapshot manifest SHA-256: `69e25b8e0fb354290c65382f21fb633082707fde440a96683732b7fcca0fa345`.
- Original base/branch: `97678d2a131daaf0791822ed3f5a7c3977ee7e7c` / `feat/project-registration`.

### NR-1 — Post-Resume Cancellation Origin And Precedence

Added public/native-path cases in `project-registration.integration.test.ts`, using the existing native clock fixture. Every case asserts that the **real ResumeThread succeeded exactly once and the observer entered its post-resume polling wait** before cancellation. Process/EOF notifications are deliberately held through fault-controlled API responses so first-cause choice, force time and the original cleanup budget remain observable. This is distinct from the older held-`onOwned` test and is not an import/setup failure or a buffered-result substitute.

| Input | Required first cause | Required force time | Required diagnostic deadline |
| --- | --- | --- | --- |
| Cancel1999, poll2000 | `CANCELLED` at1999 |3999 |6999 |
| Cancel1000, poll1500 | `CANCELLED` at1000 |3000 |6000 |
| Cancel and deadline both2000 | `OBSERVATION_LIMIT_EXCEEDED` at2000 |4000 |7000 |
| Deadline2000, cancel/poll2001 | `OBSERVATION_LIMIT_EXCEEDED` at2000 |4000 |7000 |

Prospective Red `pc-s1-test-ubIqR4` (`-t NR-1`): the first two cases failed their behavioral assertions; both simultaneous/later-deadline controls passed. The first case returned a limit trigger instead of cancellation, and both failed to settle at the original cancellation deadline. The precondition assertions proved real resume/post-resume observation was reached.

Minimal implementation: one cancellation watcher retains its first observed timestamp across ownership publication and resumed observation, rather than using polling time. The watcher is disposed in the native run's `finally`. Both the ownership wait and post-resume checks use the retained timestamp; cancellation strictly before the child deadline wins, while exact equality retains deadline precedence. No D2 value or normative policy changed.

Focused Green `pc-s1-test-g8UFeb`: **4/4 passed**. Force requests use the exact owned Job; unresolved cleanup retains `OBSERVER_CLEANUP_UNCONFIRMED` and durable admission stays closed.

### NR-2 — Successful Resource Closure Must Still Meet The Original Deadline

Added before/equal/after controls with terminal proof at cleanup offset4999 and successful native resource closure finishing at4999,5000 or5001. The fixture calls the actual native release operation successfully, advances only the controlled operation duration, and asserts the release callback occurred. It injects **no close failure** in these cases.

Prospective Red `pc-s1-test-VM0Ptn` (`-t NR-2`): close-at5000 and close-at5001 incorrectly produced a settled limit result; close-at4999 passed as the control. The native release and exact-time assertions passed before the result assertions failed.

Minimal implementation: after successful `resources.close()`, recheck `startedAt + REGISTRATION_CLEANUP_BUDGET_MS`. At or beyond that original deadline, return cleanup-unconfirmed with the retained original trigger. Existing thrown-close handling is unchanged. Focused Green `pc-s1-test-U3ZKHm`: **3/3 passed**, including durable uncertainty on the two late cases. A synchronous native call returning after its deadline is rejected when it returns; no exact wall-clock preemption is claimed.

### Separate Refactor And Same-Source Final Checks

After both minimal Greens, CodeScene identified primitive-heavy fixture arguments. Grouped the existing native-completion fixture's root/time inputs without changing its behavior or assertions, then applied Biome formatting through `apply_patch`. No gate was weakened and no additional product behavior was introduced.

All capture suffixes below are under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-` and retain their own exact command, source bytes/hashes and observed output:

| Capture | Final check | Result |
| --- | --- | --- |
| `Ny0Gik` | `pnpm --filter @slopstop/harness typecheck` | passed |
| `SBUr8i` | public observer unit suite |20/20 passed |
| `4nbXil` | public registration integration suite |78/78 passed;71 retained cases plus7 NR-1/NR-2 cases |
| `tunAA1` | targeted Biome across30 authored JS/TS files | passed, no fixes |

Final CodeScene safeguard **passed**,30 eligible/checked files,40 modified paths, no degraded verdict. Its sole improvement is the pre-existing schema-spec difference from HEAD, unchanged in this packet; `issues-found` is not described as an empty findings list. Sonar remains **not assessed**, with no setup/retry. No mutation result or newly configured mutation scope is claimed. The parent's optional Jev-unavailable qualification and the existing append-only-record frontmatter warning are not converted to passing checks.

The four final captures all have exit0, the same36-file source map, and zero mismatches against current bytes. Their map equals the complete tracked/untracked non-Markdown inventory. Final source identity anchor:

- `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-4nbXil/inputs.json`
- SHA-256: `bb7cf26925ed81099a345b525c29f38593ed44ef9e986af801d688cebedaf77c`.
- The sibling `source/` directory preserves every mapped source file.

Only three reviewed source files changed: `registration/windows-version-child.ts`, `tests/integration/project-registration.integration.test.ts`, and `tests/integration/registration-native-clock-fixture.ts`. No new source file was added. All other reviewed sources, naming documents, dependency/migration bytes, original review packet/snapshot and saved patch remain intact; all26 intent bindings matched again after the fixes.

Source writes are frozen for parent re-review of **NR-1/NR-2 only**. The failed review is preserved, and these author results do not clear the independent gate or supply human acceptance. The incomplete whole PC-S1, broader lifecycle/registry matrices, owner-loss/PID-reuse/capability work, UI, packages and integration remain pending. No source-main edit, Git mutation, new dependency/global change, registration implementation or nested agent occurred.

## 2026-09-24 — Bounded Windows Owner-Recovery Characterization

Author: `pc-s1-recovery` (OpenCode AI), exclusive candidate writer after the previous authors were frozen. This is the SAME **in-progress, unaccepted PC-S1** under the original build authority. The original workspace's read-only `2026-09-24_pc-s1-owner-recovery-continuation.md` bounds this packet. Parent owns independent review and human acceptance. Nothing in this author record changes the failed R1 review or converts the scoped R2 pass into whole-slice acceptance.

### Incoming Identity And Scope

Before source edits, ran the retained `verify-pc-s1-native-repair-r2.mjs` against the incoming snapshot and independently resolved all26 direct/inherited v4 bindings. Results: **39 included files,36 retained source files,26 bindings matched**, no staged changes, branch `feat/project-registration`, original base/target `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`.

- Incoming snapshot SHA-256: `7ba7de384bfbd2ca80d72de2fb70c02628730abbba274b06d4afce4179b1fe13`.
- Incoming integration `pc-s1-test-4nbXil/inputs.json`: `bb7cf26925ed81099a345b525c29f38593ed44ef9e986af801d688cebedaf77c`.
- Approved v4 content hash: `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e`; packet raw hash `c3d1f79762fa6b75b044e8206661aee8a66830541f6d22dce76807c05bf4d0ef`.
- Original tracked binary patch remains `0c49fca56846980249eee6336c37737f4c4662da0c488bf3592112ee767b770c`.

Read the candidate guidance, naming documents, standing failure/absence and shared-vocabulary decisions, original build authority, v4/v3/v2 observer contract, R2 review packet/report, implement/shared workflow and TypeScript/TDD/Vitest skills. This packet changes tests/fixtures and evidence only. **Every production source, migration, dependency/lockfile and naming document is byte-identical to the incoming R2.** No native feasibility or overflow/timing redesign was performed.

### Characterization, Not Fabricated Red

All16 new cases passed against the existing production implementation on their first executed behavioral checks. These are explicitly **already-correct characterization** under the continuation's characterization rule, not a Red/Green implementation claim. No production repair or retrospective Red was invented. The new tests exercise the public observer and registry recovery interfaces with actual disposable Windows processes and durable application registries.

| Public case group | Concrete observation and oracle |
| --- | --- |
| Actual owner death after durable intent | Kill the owned Node peer while `begin` is durably recorded and before native dispatch. No child identity exists; reconciliation and both original/new requests remain `pending-recovery / OBSERVER_CLEANUP_UNCONFIRMED`, zero new dispatches. |
| Actual owner death before child identity publication | Real suspended child and Job already exist; hold before `recordChild`. Native inspection confirms the live child before peer death and absence afterward. Nevertheless missing **durable** identity keeps admission closed; ephemeral fixture knowledge is not recovery authority. |
| Actual owner death after child identity publication | Kill peer while the real suspended child/Job is durably owned. Live child is unconfirmed before death and absent afterward. A newly constructed registry/observer settles exact absence, returns the original interrupted result without dispatch, and admits exactly one later fresh request. Both old and new results replay unchanged. |
| Actual owner death before terminal publication | Real native execution has completed, but terminal facts have not been recorded. Exact child/tree absence settles the original as `broken / INTERNAL_FAILURE` with `reconciliation: exact-owner-absence`; a distinct fresh request succeeds. |
| Actual owner death after terminal publication | Durable terminal facts settle the original as `broken / INTERNAL_FAILURE` without the absence annotation. New request succeeds; original result remains unchanged. |
| Actual owner death after result publication | Original `prepared` result and observation ID survive lost response; repeated original/new requests retain their settlements and only the fresh request dispatches. |
| Live exact process, wrong session, missing session | Public journal fixture names only a disposable owned live Node process. Exact creation identity, a different session, and absent session metadata each retain uncertainty and block fresh dispatch. The subject remains alive before and after reconciliation. |
| Historical creation identity at the same live PID | Deliberately store a creation time one100ns tick before the owned live subject's actual creation, with its exact attempt-specific absent Job name. Reconciler can prove the historical identity absent without signalling that live process; fresh request succeeds and original interrupted result remains fixed. **This simulates historical PID reuse; it does not force OS PID reuse.** |
| Historical creation mismatch with a still-active native Job | Hold a real suspended version child; journal fixture alters only its historical creation identity. Even though the PID creation differs, the actual nonempty Job prevents settlement. After owned completion and controlled lost-terminal publication, exact absence can settle and admit a new request. |
| Inaccessible process/Job, incomplete snapshot, unsupported API | Controlled native fault notifications exercise OpenProcess access-denied, OpenJob access-denied, failed enumeration of a real owned snapshot handle, and native-factory failure. Each actual fault is observed, returns distinct `broken / INTERNAL_FAILURE`, preserves the unsettled record with no outcome, and leaves fresh dispatch closed. The owned live subject survives. These are injected failure-path proofs, not claims that this host actually lacks the API or denied normal access. |
| Old publisher after a new request | Hold the old publisher after durable terminal storage. Reconcile it, complete a distinct fresh request, then release the old publisher. It cannot publish prepared or overwrite the original interrupted result; the new result is also unchanged and exactly two outcomes remain. |

The six owner-death cases use `registration-observer-peer.mjs`, running the actual observer, registry, executable checks, native child and journal in another Node process. Termination addresses only the `ChildProcess` created by the fixture and waits for its closure; no guessed PID/image kill or unrelated process handle is used. This is **actual observer-owner process death**, not the pending final Electron utility-process startup/wiring proof. The native reconciler's existing read-only process snapshot may enumerate process IDs to establish absence; no unrelated process is opened or signalled by the fixtures.

Disposable databases/directories belong to the current test roots and are removed by the existing integration cleanup. Captures and all predecessor evidence are retained separately. No Linux integration, external service mutation, new dependency/global, native fallback, UI/Conversation/model/Frame/Board work, nested agent, staging, commit, push, merge or source-main edit occurred.

### Captured Progress And Separate Refactor

All capture suffixes resolve under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-`; each contains exact input hashes, retained source bytes, command, runtime and raw result/output.

- `J56dEl`: first actual child-stored owner-death characterization,1 passed.
- `mkEkii`: all six owner-death windows,6 passed.
- `r3zepJ`: adds session/creation/native-failure controls,14 passed.
- `MI06oF`: adds nonempty-Job and old-publisher/new-request controls,16 passed.
- `cK6XDd`: initial focused typecheck passed.
- `tPOu1r`: post-refactor16-case check passed, including newly explicit real-live-child/absent-after-death observations.

The separate CodeScene/refactor stage found a complex loader condition, a nested death-test branch and growth of the public integration file. First refactoring removed the branch smell but the safeguard still **failed** the1215-line file warning; this remains a historical failed gate. Resolved it by keeping the agreed `project-registration.integration.test.ts` entrypoint and registering its cohesive owner-recovery case group from `registration-owner-recovery-cases.ts`. All public assertions/test cases remain executable through the original test command; none was removed or weakened. Setup/observation collection lives in dedicated fixtures, not production internals.

Extracted the existing registry peer's unchanged TypeScript loader into `registration-peer-loader.mjs`, shared by both peers, instead of retaining duplicated resolution rules. The complete integration suite exercises both peer consumers. Detailed CodeScene reviews for all eight authored/modified JS/TS files finish at10.0; final safeguard passed36 checked/eligible files with no degraded verdict. Its one improvement remains the pre-existing schema-spec change against HEAD, not a change made by this packet.

CodeScene installation verification returned5/6: Git, OAuth, CLI, API and runtime passed; its automatic Agent Instructions detector reported missing guidance. Actual candidate `AGENTS.md:9` points to `docs/agents/codescene.md`, which was read and followed. This diagnostic is preserved, not relabelled as passed or used to modify guidance. No token/account override is configured; configuration reference: https://codescene.io/docs/integrations/mcp.html#configuration . The real Code Health analyses and regression gate ran successfully.

### Final Same-Source Checks

| Capture | Command / scope | Result |
| --- | --- | --- |
| `ModlJT` | `pnpm --filter @slopstop/harness typecheck` | passed |
| `gDT3Vs` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness` |20/20 passed |
| `IBQ3O6` | `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts` |94/94 passed:78 retained plus16 new characterizations |
| `tyNsXg` | targeted `pnpm exec biome check`, all36 authored JS/TS files | passed; no fixes |

All four captures ran pinned Node `v24.19.0`, have exit0, identical42-file source maps, and retained bytes matching the complete current non-Markdown dirty/untracked inventory. Final source anchor:

- `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-IBQ3O6/inputs.json`
- SHA-256 `f29a92897dcbf606e72b8c930ef3f367a6396cc6b9086bf0528bca6cbd020bbf`.

Other final inputs hashes: types `a83684e00345225b4bcd7ee99b0be5409375acebda9c69489c3041082333509e`; unit `39287cdcb3e381a8ae7242b8826f00ad92eb47382acb18d94cda52405bf5e6f4`; Biome `520dc09e91650b05b1004dc6c0d1e8c558900e2e50168b10c20583e02c6933ba`.

Only two incoming source files changed: the public registration integration entrypoint and `registration-registry-peer.mjs` (loader extraction). Six new test/fixture modules are retained in the final capture: `registration-absence-fixture.ts`, `registration-observer-peer.mjs`, `registration-owner-recovery-cases.ts`, `registration-owner-recovery-fixture.ts`, `registration-peer-loader.mjs`, `registration-recovery-scenarios.ts`. Together with the three unchanged naming documents, this is45 included files,42 source files; this append-only record is separately bound.

All26 approved bindings matched again. The approved design and this evidence record both passed the direct read-only artifact validator. Sonar remains **not assessed**, with setup/retries stopped. No new mutation execution is claimed for this characterization/test-only packet, and no optional Jev-lint, whole-project, Electron, Linux or package pass is claimed. A documentation query initially hit the repository's npm runtime guard under host Node24.20; the Context7 query ran from approved Temp afterward. No candidate runtime/dependency was changed.

### Metadata Repair With Exact Historical Preservation

The continuation expressly allowed correcting this record's missing frontmatter. Before adding it, captured raw length **93778 bytes** and SHA-256 `096dc609fa98d7abb914f2a26ec38a4c3213631f334c6022d5f7419bb012adc4`. Added truthful metadata identifying this AI author/date as the metadata addition, original base/branch/repository and `status: in-progress`.

The entire historical input is reproduced by taking **93778 bytes at zero-based byte offset287** of this file. That subrange was rehashed and exactly equals the before digest. Only the287-byte metadata prefix precedes it; this new packet entry follows it. All historical body bytes, failed outcomes, author statements and prior frozen handbacks remain unchanged. No past approval, creation date or ready/completed slice status was fabricated. The direct validator now passes the format check; previous missing-frontmatter diagnostics remain historical.

### Frozen Packet Handback

This bounded packet has local characterization and focused check evidence; parent independent review is **pending**. Whole PC-S1 remains **in-progress and unaccepted**. The remaining wider registry/relationship/old-data matrices, full registration/list/select/reopen flow, final Electron startup/protocol/preload/UI wiring, package/platform proof and full candidate acceptance/integration remain outside this packet. Current source is frozen for the one DATA ONLY coordinator report and subsequent wait. No next slice or broader work is authorized by these results.

## 2026-09-24 — OR-1 / OR-2 Exact Preservation Oracle Corrections

Resumed only the two test-oracle corrections authorized after independent owner-recovery review R1. Before edits, verified actual cwd/root `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`, branch `feat/project-registration`, base/original target `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, the45-file/42-source frozen snapshot, all26 approved intent bindings and the unchanged tracked binary patch. Read the original read-only review and the shared workflow at `C:/Users/pedro/rpiv-claude/rpiv/skills/_shared/candidate-workflow.md`; prior skills/guidance remain applicable.

**The R1 scoped independent gate remains historically failed.** Its report at original `.rpiv/artifacts/evidence/2026-09-24_pc-s1-owner-recovery-review.md` has raw SHA-256 `6abcd927558b106318f1db0ef54619187adaf2769556e03831c17f8c63a4546f`. The previous snapshot at `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-owner-recovery-2026-09-24-snapshot.json` remains byte-identical, SHA-256 `eb9c86af7824418848743150397bc90d00b6301ef96d10f5184f8dd36d96ede9`. Neither review mapping passes nor this author correction supplies acceptance.

### OR-1 — Exact Interrupted Outcomes

In `registration-owner-recovery-cases.ts`, before-terminal and terminal-stored now use `toEqual` against their complete literal expected outcomes. Before-terminal requires exactly `broken / INTERNAL_FAILURE` plus `reconciliation: exact-owner-absence`; terminal-stored requires exactly `broken / INTERNAL_FAILURE` without that annotation or any additional field. Replayed originals must still equal those exact original outcomes.

Capture `pc-s1-test-QMOPe2` ran `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts -t PC-OR.*preserves.original.settlement`:3/3 selected cases passed with production unchanged. Earlier `pc-s1-test-lYctmU` used single quotes through the Windows command capture, selected no tests and reported94 skipped; its exit0 is **not** behavioral pass evidence. Corrected selection did not require any source or production change.

### OR-2 — Full Independent Pre-Death Durable Baseline

`registration-recovery-scenarios.ts` now opens a separate storage client and reads the complete `result_json` for the exact observation ID **while the outcome-stored peer is paused, before calling `peer.kill()` and before recovery**. The query requires exactly one string-valued row and decodes it as unknown JSON, preserving every field rather than applying a schema that could strip fields or reconstructing an expected value from recovery output. Missing/malformed durable input fails the fixture instead of providing an absent baseline.

After reconciliation, fresh-request execution and replay, another independent read captures the persisted result for the same original observation ID. The outcome-stored case checks the baseline is prepared, has the checkpoint observation ID and contains a version, then requires **each** recovered original response, repeated original response and persisted original result to equal the complete pre-death value. Equality includes the version and all other fields. Existing fresh-request result/replay and exact dispatch-count controls remain.

Capture `pc-s1-test-3qQCZy` ran the same focused3-case command after OR-2:3/3 passed. Both corrections strengthen **already-correct characterization**, not production behavior. No failing production behavior was observed and no Red was manufactured.

### Separate Quality Gate And Final Source-Bound Checks

After the stronger assertions passed, separate detailed CodeScene reviews scored both changed files10.0 with no smells; no refactor was required. Final safeguard passed36 eligible/checked files across46 modified paths, no degradation. Its sole improvement is still the pre-existing schema-spec difference against HEAD, untouched by these corrections. Sonar remains not assessed; setup/retries remain stopped.

| Capture suffix | Final command / scope | Observed result |
| --- | --- | --- |
| `zGuhDD` | `pnpm --filter @slopstop/harness typecheck` | passed |
| `377R8P` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness` |20/20 passed |
| `148j8l` | `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts` |94/94 passed; all retained cases still execute |
| `y6N9kw` | targeted Biome over all36 authored JS/TS files | passed, no fixes |

Every capture lives under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-`, retains exact source bytes/output, ran pinned Node `v24.19.0`, and has exit0. All four final42-file source maps match one another and current files. Main source anchor: `pc-s1-test-148j8l/inputs.json`, SHA-256 `b2078143fba0aad24bd9b09908d0b925ba950e4b63e8219b78a5a3bf09c1c799`. Other input hashes: types `9a701941d304bff0ef6c0990beab012b0f2292380f5a9681d778d942ecd6c0d9`; unit `f83b58095817d06007d687eacfe8a72f33d97109d9d2cf1496e78382dd8516e0`; Biome `0c74311ec485cc86e38acc73e0856960ffb91178df59868c549f7d62dd51ee23`.

Exactly two incoming source files changed: `registration-owner-recovery-cases.ts` (`a6e7d87da396c8361ccf9e4316e9a323daba77eb7c35317282f68c098bd89916`) and `registration-recovery-scenarios.ts` (`c1c4928f27e43228a349346eef879c67649035392cc1cf76b2d074428935e1bf`). No source files were added/deleted. The agreed public entrypoint, all94 test names/cases, shared loader and both peer modules, production, migrations, dependencies/runtime and naming documents remain unchanged. No new mutation/Jev/Electron/Linux/package proof is claimed.

### Preservation And Re-Review Boundary

The incoming evidence remains an exact **107539-byte prefix**, SHA-256 `838857469d5d4271edc6dc1cdb620b147e032f17fa5ed53ca3d5d66c4accaebc`; the older93778-byte body at zero-based offset287 remains intact as previously bound. This entry is appended after that prefix. The failed review, old snapshots, original base and earlier captures are retained.

This is a locally checked OR-1/OR-2 correction awaiting **fresh parent-owned independent review**, not a cleared review gate or human acceptance. The same PC-S1 remains incomplete/unaccepted. Source/evidence freeze follows final identity verification and the single DATA ONLY handback to the rediscovered coordinator. No source-main write, dependency/global change, Git mutation, nested agent, Sonar setup or broader PC-S1 work was performed.

## 2026-09-24 — Bounded Trust Admission Packet: Frozen With Verification Blocker

### Authority, Incoming Identity And Scope

Implementer: `pc-s1-trust`, under exclusive write ownership dispatched by the human. Read the original read-only `2026-09-24_pc-s1-trust-admission-continuation.md` first. The existing PC-S1 v4 intent/build authority remains unchanged: base/original target `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, branch `feat/project-registration`, approved content hash `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e`. All26 direct/inherited raw bindings matched before edits and again at source freeze. The read-only approved-artifact validator passed. Targeted retained D6/D7/D8, B9/B10 and v4 oracles govern this authority-only work.

Incoming snapshot `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-owner-recovery-or1-or2-2026-09-24-snapshot.json` matched SHA-256 `ab5797cbfdca5f6f596c0e26c497fc64027ea95e6e67cb09751ef827aa13a5ad`. Ran the existing read-only `verify-pc-s1-owner-recovery-or2.mjs`: all45 included paths,42 retained source byte copies, ancestor manifests, modes, unchanged binary patch and old evidence/history matched. Incoming evidence was exactly114044 bytes, SHA-256 `fa8ff178dae073ad16990992754ace32b49243820074b0ef14b07ea9a1f05262`; this section is appended after those bytes. Original native/owner-recovery passes remain scoped historical results, never a whole-PC-S1 accepted predecessor.

Live routing was verified as `ragnarok-coordinator`, pane `w3:p1E`, exact session `ses_f6f38c4caffec1tsm38xSqxlRr`. Original source-main and shared workflow were read-only. No nested agents, Git writes, dependency/global changes, Sonar setup or credential changes were performed. Context7 was read through the already-cached CLI with pinned Node; failed bare-CLI/npm invocation attempts installed nothing and were replaced by direct use of its cached entrypoint. Current Zod, Drizzle and Vitest documentation was retrieved.

### Implemented Authority Boundary And Its Limits

- New `identity-query-consent.ts` persists a separate accepted/declined second-stage decision bound to exact executable selection and completed version-observation identities. A version result alone returns `GIT_CONFIRMATION_REQUIRED`. A matching decision can be resolved after closing/recreating the registry; conflicting reuse is `REGISTRATION_IDEMPOTENCY_CONFLICT` and never overwrites its first decision. Decline resolves to cancellation. Favorable resolution reobserves physical executable identity plus digest. A replaced executable cannot use the old second-stage grant; the existing version executor also refuses its old first-stage grant without dispatching another version child.
- New `repository-trust.ts` accepts selection only from an installation-owner-injected `NativeRepositorySelectionPort`, allocates an opaque UUID and stores the observed physical directory key plus private path in `application.db`. There is no renderer path/boolean endpoint. The future desktop native-dialog adapter remains unwired by design in this bounded packet; fixture callbacks supply selections of real disposable directories, not a real UI interaction.
- Exact trusted-local decisions persist separately from selection. Missing/wrong selection or trust identity returns `REPOSITORY_TRUST_REQUIRED`; an explicit decline returns cancellation. A's decision cannot authorize B. A changed physical directory at A's same path is rejected before admission. New-work admission retains registry validation, unresolved-observer refusal, exact executable-stage authority and repository trust/physical revalidation in that order.
- `IdentityQueryAdmissionPort` is an explicit internal authorization seam only. Its `admitted` result proves that this port was reached, **not** six completed Git queries, a prepared repository observation, registration, active selection or canonical attachment. No executor or production caller is wired to this port. A future real executor still needs its exact request/observation attribution, per-child executable checks, limits, journal and cleanup ownership. The separate completed-registration replay path must precede this new-work seam; this packet does not implement that missing whole-registration owner or reinterpret its result.
- Existing migration0001 and snapshot were extended with the three exercised authority tables and matching exact current-schema specification. Immutable0000 SQL and its snapshot remain byte-identical to HEAD. Previous-schema compatibility and existing current-table declarations were retained; there was no real user-data migration. Final full compatibility/regeneration proof is pending because of the verification blocker below.
- Future UI must still display exact executable/version and exact repository choice, explain effective local configuration/external includes, and disclose that hostile-config/OS-network isolation is not provided. No UI, full register/list/select, canonical attachment, Conversation/model/Frame/Board or Linux product integration is claimed.

### Observed Prospective Red → Green

All captures in this table are under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-test-<suffix>/`. Each `inputs.json` stores its exact command, pinned Node `v24.19.0`, timestamp, source hashes and retained bytes; `stdout.txt`, `stderr.txt`, `result.json` store the observed run. Tests execute from `apps/harness/tests/integration/project-registration.integration.test.ts` through public registry/observer ports. No missing-import/compiler failure is counted as Red.

| Behavior | Red capture and observed assertion | Minimal Green capture |
| --- | --- | --- |
| Separate persisted stage-two decision and registry restart | `Qx61vf`: decision returned `GIT_CONFIRMATION_REQUIRED`, expected `recorded` | `K3CwsM` |
| Exact idempotent stage-two recording/conflict | `UYOnIV`: duplicate decision returned `INTERNAL_FAILURE`, expected `recorded` | `HTfAna` |
| Explicit stage-two refusal survives restart | `j9sVeX`: refused grant returned `authorized`, expected cancellation | `8Hktmb` |
| Physical executable replacement invalidates admission | `ysKhc1`: replacement still returned `authorized`, expected `GIT_CONFIRMATION_REQUIRED` | `olr3mz` |
| Persisted native-selection authority, trust and restart admission | `isESVG`: selection returned unavailable, expected prepared opaque selection | `QPTunB` |
| Exact physical repository scope | `dcyPIh`: replaced A returned `admitted`, expected `REPOSITORY_TRUST_REQUIRED`; A→B refusal already passed and is characterization | `RCJpIX` |
| Repository decision idempotency/conflict and retained refusal | `vYpanR`: duplicate refusal returned `INTERNAL_FAILURE`; after minimal idempotency support `FqU5ip` separately exposed refused admission returning `admitted` | `0ORjbM` |
| Unresolved observer closes new admission | `fVDjxL`: admitted with a durable unresolved intent, expected `OBSERVER_CLEANUP_UNCONFIRMED` | `YMbp98` |
| Version-outcome identity consistency | `8G6gnp`: foreign observation identity returned authority, expected `REGISTRY_CORRUPT` | `RNm2tu` |
| Malformed persisted outcome is broken, not absent consent | `qhUxVZ`: extra persisted JSON member became `GIT_CONFIRMATION_REQUIRED`, expected `REGISTRY_CORRUPT` | `VtReCe` |

`LOhGAn` is **invalid setup evidence, not Red**: the disposable executable was initially placed in the empty installation root, correctly triggering `REGISTRY_MISSING_WITH_WITNESS`; the fixture was corrected to use a separate installation directory before `ysKhc1`. It also recorded unexpected worker termination. Earlier quoted multiword filters matched some additional existing tests; exact outputs/case counts remain in captures and are not rewritten. Later filters use the single regex token `identity-query` or `repository-trust`.

Unchanged guards were characterized without invented Red in `x1PtkF`:10 repository-authority cases passed, including all five inapplicable identity fields, native-port cancellation and absent native capability. These are pre-final-refactor results, not final combined proof. The initial real version/restart/idempotency/decline tests use installed Git and the existing Windows native child. Replacement/selection/admission tests use a clearly labeled controlled version-child output with **real persisted journal, real executable file identity and real directory identity**; they do not claim native Git execution for that controlled output.

### Separate Review/Refactor And Frozen Checks

After each minimal Green, CodeScene reviewed the changed authority modules. One intermediate result on `identity-query-consent.ts` scored9.38 with Complex Method/Conditional findings. Separate extraction of decision recording/resolution and exact-decision comparison removed both:10.0, no findings; focused recheck `uu2KSk` passed. Final refactoring centralized identical four-field physical identity equality and identical `RegistryRunner` signatures, reused the existing journal's unresolved-owner query, formatted the new code and extracted test setup/capture helpers. It did not introduce another grant or alter native lifecycle rules. Parent-owned independent candidate review remains pending; no nested reviewer was created.

CodeScene setup reported authenticated OAuth/CLI/API/runtime and repository success but a failed agent-guidance autodetection check; applicable on-disk `AGENTS.md` and `docs/agents/codescene.md` were read and unchanged. No setup repair was attempted. Detailed final new-source/test reviews scored10.0. Frozen safeguard returned `quality_gates: passed`,41 checked/eligible files,51 total modified paths and no degradation; its only finding was the retained earlier `project-storage-database-specs.ts` string-heavy-arguments improvement. Sonar remains stopped/not assessed.

Final capture roots use `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-test-<suffix>/`. All six following capture input maps are identical to each other and current source:47 non-Markdown candidate files, zero hash mismatches. The owned evidence runner allows300000ms for the whole test command; no product or individual test deadline was changed.

| Frozen capture | Exact command / result | `inputs.json` SHA-256 |
| --- | --- | --- |
| `qRsIkh` | full project-registration integration: exit1, **worker exited unexpectedly**, only1/111 tests reported passed; broken run, not pass | `11724bc0d3bdeef2c71b3153c4a4338cd4162842c2af47ad424d6dc31d83c2e4` |
| `IRP93n` | same integration file with `-t identity-query`:7/7 selected passed,104 skipped, exit0 | `83c149f3837b91df8fdfd99b37f25ff170114dca9d02174f777fed4eb883dbe6` |
| `TQYB8a` | same integration file with `-t repository-trust`: exit1, **worker exited unexpectedly**,8 passed/101 skipped before interruption; not10/10 proof | `36cc2432eba051c8086b193a6e2975f237ba9947aa4e8a678a3b458226a929af` |
| `wk7XqY` | `pnpm --filter @slopstop/harness typecheck`: passed | `16e2b2e924e9bfd08c718716ac32b624434791d9fa7cee2ad08a8d7594e5e71c` |
| `3oI0K3` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness`:20/20 passed | `22fbdb809adade97a2b3bdfd7a48ddcb30e8cde1a276c5303a7514f9ee3bbeed` |
| `pvyPP1` | targeted `pnpm exec biome check` over registration source, both storage schema owners, three new test helpers and integration entrypoint:23 files passed, no fixes | `d20e103f8f609abb7e47439c936c74e406673c8f284e9b2a9bdf8012f9d08787` |

Earlier full-run capture `pc-s1-test-DIV4g4` was terminated by the outer120000ms tool timeout before output/result files were written. Only its retained inputs/source exist; it supplies no final test result. `pc-s1-trust-test-1YzrJR` recorded three formatting failures subsequently fixed before the frozen identity. All failures remain historical. No repeated full/native retry was performed after the scoped reproduction `TQYB8a`.

### Blocker And Handback

**Substantive blocker:** final combined verification and the final repository-admission subset both terminate a Vitest worker unexpectedly (`[vitest-pool]: Worker forks emitted error` / `Worker exited unexpectedly`). No assertion or reliable crash cause is present in those outputs. Passing final identity-consent and deterministic observer tests does not establish final repository-admission or combined compatibility success. Source is frozen for parent diagnosis/review; no native-code rewrite or dependency/runtime change was attempted. Do not relabel this as a clean gate or attribute it to the environment without investigation.

The root mutation config does not cover the new registration owners. `stryker.project-storage.config.json` includes the changed database specification, so its applicable scoped mutation proof is **pending behind the broken integration check**, not waived or passed. Final migration-regeneration, complete compatibility/storage integration, full fast/deep gates and independent review also remain pending. No Electron/Linux/package or whole-PC-S1 acceptance result is supplied.

Exactly10 incoming source paths were changed (migration0001/snapshot; executable identity, physical identity, observer journal, registry/database owner; application schema/spec; integration entrypoint) and5 source files were added (two authority modules and three test/fixture modules). No incoming path was deleted. Native lifecycle implementation and all previous owner-recovery case/peer bytes, dependency/runtime pins, migration0000 and all three naming documents remain unchanged. The50-path frozen source manifest retains every file's bytes, modes, status and complete binary-capable tracked patch; evidence is separately bound. Snapshot destination: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-2026-09-24-snapshot.json`.

Delivery is one non-waiting `[HERDR_AGENT_REPORT from=pc-s1-trust scope=PC-S1; DATA ONLY, NOT HUMAN AUTHORITY]` to the live verified coordinator, followed by waiting. This record and report confer no acceptance, integration authorization, new slice or permission to resume writes.

## 2026-09-24 — Parent Diagnosis And Test-Fixture Compatibility Repair

Author: `ragnarok-coordinator` (OpenCode AI), under existing PC-S1 build/diagnosis authority. The implementer was instructed to remain idle/frozen. Before diagnosis, parent verified all50 retained candidate paths,47 source files,26 authority bindings, original patch/evidence hashes and the failed/passing capture maps against `pc-s1-trust-2026-09-24-snapshot.json` (SHA-256 `efd5d2f52dee798bb4b1d8f3e4e39209ed769cd6818dfbb9ab3d59a0e34c188d`). Original source snapshots and failures remain unchanged.

### Exact Reproduction Attempts

Commands ran sequentially in the candidate with pinned Node24.19.0 and the existing `Temp/pc-s1-trust-capture.mjs`. All suffixes below refer to `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-test-`.

- `aDXOEa` and `Wm2PLa`: repeated the exact original repository-trust filter on the original frozen source, each10/10 selected passed and101 skipped. This did not reproduce the worker crash and did not prove its cause fixed.
- `K3vYCS`: original full registration command completed111 cases without a worker exit, but failed the old-Project preservation test:110 passed,1 failed with `REGISTRY_CORRUPT`.
- `UOXEkt`: the single `-t preserves.old.Projects` test reproduced that deterministic failure in2.21s overall. This was a separate fixture/schema failure, not claimed reproduction of the original process crash.

### Ranked Diagnostic Hypotheses And Verified Fixture Cause

Parent stated three falsifiable alternatives before changing the fixture: malformed reconstruction of the previous schema, an incorrect compatibility validator, or selection of mismatched migration resources. Inspection showed `restorePreviousRegistryFixture` still dropped only the six older registration tables, leaving the three new trust/selection tables while assigning the0000 head.

Added an independent exact four-table old-schema assertion before the fixture fix. Capture `Ul9XO1` failed that assertion and explicitly showed the unexpected `registration_identity_consents`, `registration_repository_selections` and `registration_repository_trust` tables. Production's strict corruption refusal was correct for that malformed test database.

Removed only those three new tables, in dependency order, from the disposable fixture's current-to-old reconstruction. Kept the new exact old-table assertion. `YZRNeI` then passed the single preservation case. This is fixture repair/characterization, not a claimed new production Red/Green behavior.

A broader predecessor check `vIPHsT` then executed105 Storage create/open cases:104 passed and one exact-current-schema assertion failed because its independent list still had10 names rather than the13 now legitimately implemented. Added exactly the three new authority names; retained full equality. `J3TnBu` passed that exact case,60 filtered.

In a separate small refactor, the identical previous-registry vocabulary (schema_metadata, storage_generations, storage_locations, storage_registrations, in that order) received one **test-owned literal** `previousApplicationRegistryTables` in `registration-schema-fixture.ts`. The previous-row reader, current table-list suffix and historical shape assertion reuse it. It is not derived from production schema declarations and does not remove the independent old/current oracles.

Parent changed only `project-storage-historical-fixture.ts` and `registration-schema-fixture.ts`. No production source, migration, dependency, gate threshold or runtime was changed by diagnosis.

### Worker-Exit Investigation Remains Qualified

Read-only process-boundary instrumentation lived only in clearly marked `Temp/pc-s1-worker-exit-trace.cjs` and `Temp/pc-s1-worker-exit-traces/`; no debug code/config was added to the product. It observed owned Node fork/exit/kill events without logging environment or request contents.

- `QdtpQQ`: instrumented repository subset passed10/10.
- `DkAsh1`: instrumented full registration suite passed111/111.
- `tVioSK`: the ordinary, uninstrumented original full registration command also passed111/111 after the fixture correction.
- Matching Windows Application Error/Windows Error Reporting events were not found in the captured failure time window. This is only an event-log query result, not proof that no native fault occurred.
- A scoped process query found zero currently matching candidate Vitest/fork/peer processes after the completed runs. It does not retrospectively prove cleanup of the old interrupted invocation.
- The original implementer confirmed qRsIkh and TQYB8a were sequential in its own session, but could not exclude other sessions or a surviving child of the outer-timeout DIV4g4 run. Only command-level exit1/signal-null was captured, not the failed worker's own exit status. No complete tree-cleanup record exists for DIV4g4.

**Do not claim the original unexpected-worker-exit root cause is resolved.** It was not reproduced in the parent's valid runs; test-process instrumentation is retained if it recurs. Parent did not upgrade dependencies, weaken deadlines, switch pools, add retries or attribute the original failure to the environment without proof.

### Current Source-Bound Verification

After the two fixture repairs and shared-literal refactor, the following captures use the same current source (no debug preload in the final runs):

| Capture | Result |
| --- | --- |
| `rRKmFx` | Harness typecheck passed |
| `3ZEDrU` | Biome on both edited fixtures passed |
| `B8bmk6` | Registration + Storage create + Storage open integration:216/216 passed |
| `ptkmwD` | `pnpm --filter @slopstop/harness db:generate:check` passed; all three generation passes reported no schema changes and the migration tree stayed unchanged |
| `ITKXFw` | Observer unit20/20 passed |
| `XrJpZj` | Biome over harness source and integration tests:138 files passed, no fixes |

`qoeOzP` was an incomplete broader-Biome capture terminated by the outer120000ms tool deadline while the recorder allowed300000ms; it is not pass evidence. Parent inspected remaining process metadata rather than blindly killing by image name; the subsequent same command with a sufficient outer bound completed in178s. Neither product deadlines nor Biome rules changed.

Detailed CodeScene reviews of the two edited fixtures returned10.0/no findings; parent safeguard passed41 checked files without degradation, retaining only the pre-existing schema-spec improvement. Sonar remains not assessed with setup/retries stopped. No mutation, full fast/deep, independent trust-packet review or whole-PC-S1 acceptance is claimed. Those remain pending, and the unexplained historical worker exits remain an explicit qualification.

## 2026-09-26 — User-approved TR-1 through TR-4 repairs

### Authority, input identity, and scope

The current user explicitly instructed implementation of the four approved findings, quoting the prior decisions **“corrige os QUATRO pontos”** and **“continua”**. Scope is TR-1, TR-2, TR-3, and TR-4 from the source-workspace `2026-09-24_pc-s1-trust-parent-review.md` and its matching packet. TR-5 mutation is outside this repair request and remains pending. Parent owns independent reviews. Exclusive candidate writes were authorized in `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`; no old implementer was contacted and no nested agent was created.

Before any edit, `pnpm exec node C:/Users/pedro/AppData/Local/Temp/opencode/verify-pc-s1-trust-parent-repair.mjs` ran from the candidate and exited 0. It verified the original 50 included paths / 47 sources, both exact fixture overrides, base `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, empty index, unchanged binary patch, 26 contract references, and six prior successful capture maps. Input evidence was exactly 134845 bytes, SHA-256 `d2fc0f97b6dda2aa2938d563a21d4e33c3daeb22acce2aa57f2e7a56c84a14de`. Those bytes remain an immutable prefix of this appendix.

Effective v4 contract remains `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e`. Build authority and trust-admission continuation were read together with candidate AGENTS, PRODUCT/CONTEXT, the standing decisions, applicable persistence guidance, CodeScene instructions, shared candidate workflow/test-contract authoring, and TypeScript/Vitest/TDD skills. Current Zod safeParse, Vitest spies/assertions, and Node 24 SQLite documentation was fetched through Context7. Initial direct npx and pnpm-exec-npx resolution selected global Node 24.20.0 and failed EBADDEVENGINES; using `pnpm exec node "C:/Program Files/nodejs/node_modules/npm/bin/npx-cli.js" --no-install ctx7@latest ...` resolved the documentation calls without installing dependencies. Product/test commands used pinned pnpm 11.5.1 and recorder-verified Node v24.19.0.

No contract, dependency, lockfile, schema, migration, configuration, or prior snapshot was changed by this repair. All previous dirty/untracked work and the two prior fixture overrides were preserved. No Git stage/commit/push/merge, Sonar call, real ACL mutation, or user-data migration occurred.

### Behavior and separate review/refactor

- **TR-1:** Added a public registry-owner test which first stores an accepted trust decision, replaces persisted `identity_json` with syntactically valid `{}`, then requests admission. Red observed `broken / INTERNAL_FAILURE` instead of `broken / REGISTRY_CORRUPT`, with zero admissions. Minimal implementation uses `PhysicalDirectoryKeySchema.safeParse` only for the stored identity and raises the existing typed corruption fault on invalid shape. No blanket catch or unrelated-error relabelling was added. Green passed. Separate detailed CodeScene reviews of owner and tests both returned 10.0/no findings; no refactor was needed.
- **TR-2:** Held the native selection callback pending while an independent registry owner tried to record a trust decision against the same database. Red observed `unavailable / REGISTRY_BUSY` instead of `recorded`; minimal Green permits the second operation before releasing the choice. A lifecycle-tracked preparation runner now validates/closes the registry before native choice, waits without an open database, then reopens/revalidates the actual current registry before the short physical-observation/persistence transaction. In-flight choice remains tracked by stop; already-admitted work drains and new operations after stop fail through the existing mapping. Additional characterization proves draining stop, late admission refusal, unexpected selector failure, changed registry head and a moved directory before saving; the last two leave zero selection rows. Existing absent-native/cancellation cases remain in the final integration run. Detailed CodeScene reviews of the changed runner/owner files and tests returned 10.0/no findings.
- **TR-3:** Strengthened both identity-query and repository-trust replay/conflict tests with an independent `node:sqlite` oracle, reading complete `SELECT *` decision rows rather than production schemas/projections. A valid past timestamp sentinel (`2001-02-03T04:05:06.000Z`) makes a duplicate new-Date timestamp rewrite detectably different even within one millisecond. Each test asserts the full expected row, then unchanged rows after replay, conflict, restart, post-restart replay/conflict and authority resolution/admission. This is characterization of already-correct production behavior; no Red was fabricated. Five selected decision tests passed. The new oracle and changed tests returned 10.0/no CodeScene findings.
- **TR-4:** Added public owner tests for native error 5 both during selection and after consent at admission revalidation. Both Red cases returned `broken / INTERNAL_FAILURE`; both had zero admissions. Minimal translation returns `unavailable / REPOSITORY_INACCESSIBLE`. Both Green cases passed, including successful admission after the controlled fault is removed. Separate CodeScene review reported new complexity in `observeWindowsDirectory` (9.68, cc=9); the translation was extracted into `directoryObservationFailure`, returning the file to 10.0/no findings. Added controls retain errors 2/3 as `REPOSITORY_NOT_FOUND`, error 6 and a genuine unexpected exception as `INTERNAL_FAILURE`, with zero admissions through selection and revalidation. No ACLs were altered.

The first combined run found a defect in the newly added unexpected-error **test fixture**, not a worker crash: a global string-valued `lastError` also affected the executable identity read, so the second directory injection was never reached (`hits` was 1, expected 2). The fixture now scopes its last-error override to the selected directory and delegates all other reads to the real API. The exact two-hit assertion was retained. Six focused Windows controls then passed. Formatting failures were fixed through patches without weakening rules.

### Source-bound command captures

Every row below is retained at `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-test-<ID>/`. Each directory contains exact `inputs.json` (command, cwd, runtime, source hashes), retained source bytes under `source/`, `stdout.txt`, `stderr.txt`, and `result.json`. All captured commands were invoked from the candidate through `pnpm exec node C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-capture.mjs <label> <command>`. The recorder's 300000ms limit and an outer 310000ms timeout were retained throughout.

For compactness, **I** below expands exactly to `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts` and **C** expands to `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts project-storage-create.integration.test.ts project-storage-open.integration.test.ts`.

| ID | Exact command / suffix | Exit | Observed result | inputs.json SHA-256 |
| --- | --- | --- | --- | --- |
| `xuDryo` | I `-t malformed.stored.repository.identity` | 1 | TR-1 expected Red, 1 failed | `45b8668f5fa09483d3dc1febc86b1549a51773841bc224b2efcf496abb05c3ae` |
| `ilpxBq` | I `-t malformed.stored.repository.identity` | 0 | TR-1 Green, 1 passed | `43111516b03fcfd9906661270b85f71e1e109bf311c0485f96a55f20fd0c6f44` |
| `l9KzAF` | I `-t another.registry.decision` | 1 | TR-2 expected Red, 1 failed | `abd40456c9fde69e8eae1684f6da3aa5bc6f0e7a226566f30d19f2eb8a1358b9` |
| `lCtv1d` | I `-t another.registry.decision` | 0 | TR-2 Green, 1 passed | `cea2f7dd98c9fa30dee77715ba46583a907f417f7e67c16bb24c5835d36d4224` |
| `M7IYla` | I `-t native.selection` | 0 | 5 characterization tests passed | `cddf28aca675ebda3b0f903fbf5e7e37a0343dfd4862b64c1ddfc256d12664ca` |
| `PFtMot` | I `-t decision` | 0 | TR-3 characterization, 5 passed | `c5c83011ab3728ee12c15a21cfcb07e15f48951e30c2f6cb181cedf3f7d0abaf` |
| `OafdPD` | I `-t Windows.directory.access.denied` | 1 | TR-4 expected Red, 2 failed | `164b0dd074e74b92d37a83200da24d34c3220f3c1ada070c8d30a0304304e278` |
| `0ApAWq` | I `-t Windows.directory.access.denied` | 0 | TR-4 Green, 2 passed | `56ba030239945668bef06339732975746fb5597805746d27f413156860db6209` |
| `4kSdys` | `pnpm --filter @slopstop/harness typecheck` | 0 | Intermediate types passed | `c26a382660a3440d3890c1563e7ab2408d0bb59cd662635632498bcdb6c87c6a` |
| `QBzcI1` | `pnpm exec biome check apps/harness/src/registration apps/harness/tests/integration/registration-repository-trust-cases.ts apps/harness/tests/integration/registration-identity-consent-cases.ts apps/harness/tests/integration/registration-decision-oracle.ts` | 1 | 20 files checked; 3 formatting failures subsequently corrected | `5f0ebd76f9646a93d236621261d8bb4550080e804da5163ae4cbdaa4db5a4eec` |
| `eFNecb` | C | 1 | 227 passed, 1 new fixture assertion failed as described above | `c2b72852ed4c18afe98267c20fd231d30f6b18d2d91d1c4820115f71973d9ad7` |
| `Otq601` | I `-t Windows.directory` | 0 | 6 post-refactor/error controls passed | `ec02eba0af286de1c6c92bab1acad69968dcc3d6444019403dea58efcc9a8f5b` |
| `I7OZSO` | `pnpm exec biome check apps/harness/src apps/harness/tests/integration` | 1 | 139 files checked; 1 formatting failure subsequently corrected | `cade907eabb74dd7538fbb43d92bc0434f04000a9bf2816ce8cd79bd80dd50d0` |
| `51UIMw` | C | 1 | Final combined check **broken** by peer process crash; 227 passed, 1 failed | `4d3b5d81e693c92a47e83c472357d5f92553fa524ada18034fe596a1cafc330d` |
| `DMSDua` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness` | 0 | Final observer unit 20/20 passed | `4d4c6678b067d44b0ec70d5d995ee24dac9d28be8d0d2df607e0147328df3176` |
| `AeziDO` | `pnpm --filter @slopstop/harness typecheck` | 0 | Final harness types passed | `c89f1be5e9b64c96e188369c669977e05fb17d9656921fccef74acc8a8559ff5` |
| `l6J8ur` | `pnpm exec biome check apps/harness/src/registration/registration-registry.ts apps/harness/src/registration/registry-database.ts apps/harness/src/registration/repository-trust.ts apps/harness/src/registration/windows-file-identity.ts apps/harness/tests/integration/registration-identity-consent-cases.ts apps/harness/tests/integration/registration-repository-trust-cases.ts apps/harness/tests/integration/registration-decision-oracle.ts` | 0 | Final relevant Biome: 7 files passed, no fixes | `c0ff411d6b0278be402398c07bb2569ed29ef16d93ae9e5288ed563a681230e0` |

One attempted TR-3 shell invocation used incompatible PowerShell quote escaping around a regex alternation and failed before starting the recorder/Vitest. It supplies no Red or test evidence. The subsequent `-t decision` command above is the actual successful characterization run.

### New crash diagnostic and validation limit

Final capture `51UIMw` reports a failure in `holds registry write exclusion across independent-process migration and retry`: `Registry peer exit 3221225477` (`0xC0000005`), raised by `registration-peer-fixture.ts:47`. Captured peer stderr only reports Node's ExperimentalWarning for Transform Types (PID 7844); no demonstrated root cause is available. The recorder itself exited 1 with signal null. Both Storage integration files passed and the registration file reported 122/123 passing, totaling 227/228. These counts do **not** make the combined check pass. No further combined or crash-test retry was attempted; only the independent observer-unit, typecheck and Biome checks were completed afterward.

Historical `qRsIkh` and `TQYB8a` worker exits remain unexplained and broken. This peer crash is preserved separately; neither equivalence of cause nor a fix is claimed. The historical `DIV4g4` cleanup qualification remains. Required combined validation is blocked on diagnosis and a justified later run under parent coordination.

### Quality checks and final source identity

CodeScene configuration had no token/on-prem/account pin overrides. Installation verification passed Git, OAuth, CLI connectivity, API connectivity and runtime (5/6). Its agent-guidance check reported that candidate AGENTS lacks the MCP guidance block; `docs/agents/codescene.md` was read and followed explicitly. No authentication/configuration mutation or installation was performed. Configuration reference: https://codescene.io/docs/integrations/mcp.html#configuration .

Detailed reviews of all seven authored TypeScript files returned **10.0/no findings** at their final source contents. The introduced Windows complexity finding was fixed in the separate refactor described above. Final safeguard returned `quality_gates: passed`, 42 checked/eligible files, 52 total modified paths and `status: issues-found`; its sole result is the pre-existing improvement in `project-storage-database-specs.ts`, with no degradation. This gate is a check of the dirty candidate, not staging or a commit and not an independent parent review. Sonar remains stopped/**not assessed** under the explicit user direction.

Final `51UIMw`, `DMSDua`, `AeziDO`, and `l6J8ur` inputs have identical complete 48-source maps, verified against the live files and retained `51UIMw/source/` bytes. SHA-256 of `JSON.stringify(inputs.hashes)` is `7b077779292ebe25816a3b5a1c075e058add707cf5e2c3601e3c9236f3809e91`. Resolve final candidate identity from the original 50-file manifest and its two parent fixture overrides, replacing only the six existing source entries below and adding the one oracle. Original entry modes/statuses remain unchanged. The resulting manifest has 51 included files; the separately append-only evidence file makes 52 dirty/untracked paths in the full Git inventory. The new regular untracked oracle has filesystem mode 33206, is not a symlink, and its complete bytes are retained in the final capture. No original included file was removed.

| Authored source (candidate-relative) | Final SHA-256 |
| --- | --- |
| `apps/harness/src/registration/registration-registry.ts` | `109a271ec36b075e3076c651114c39ea46340ea41687fbf2aab52a6dcfa621b3` |
| `apps/harness/src/registration/registry-database.ts` | `68caa8e1cbeeecacc4f45929c97ef68071e6505a6b6dc18921eae6ae358468b4` |
| `apps/harness/src/registration/repository-trust.ts` | `1bfef46d1f68fbe873c8d051ead74b2dae39b5c42af00e4c366a6b66de5ba305` |
| `apps/harness/src/registration/windows-file-identity.ts` | `77569382ee5edb35a551f80561497eb660bc02906a58d70a6f36e35f99db880b` |
| `apps/harness/tests/integration/registration-identity-consent-cases.ts` | `1db541ec8c9d567a51f920aeec76cfe24ed2c0e7837c4152a118941f895c8099` |
| `apps/harness/tests/integration/registration-repository-trust-cases.ts` | `a3e25f236a30d51f29268e1ba3807d51313ad156bb63db6cf0987134e965e911` |
| `apps/harness/tests/integration/registration-decision-oracle.ts` (new) | `ec721d52c21fae601940fafae50674e2e107202b76a5f56fc3472458da212e1e` |

Read-only final verification confirmed all 26 contract bindings, exact base, empty index, original included-file modes, preserved unrelated bytes, and unchanged complete tracked binary patch `373a3179c9f1c66f6fa681215703cdc664d7475158ab4f3d206c48dc9d31cdee`. All source repairs were to already-untracked files plus the new oracle, explaining why the tracked patch is unchanged. Final evidence bytes/hash and preserved-prefix verification are returned in the handback after this append.

**Handback state:** TR-1..TR-4 repairs implemented with the source-bound evidence above; final combined validation **broken**, independent parent review **pending**, human acceptance **not claimed**. TR-5 mutation remains pending outside this request. No whole-PC-S1 completion, six-query executor, registration/list/select/reopen, Electron/Linux/package or fast/deep proof is asserted. Writes freeze at handback.

## 2026-09-26 — Explicit runtime alignment to installed Node 24.20.0

### New user authority and preserved predecessor

The user steered the task with **“node needs to be set to the version i have”** and explicitly authorized aligning the exact project runtime to the installed Node **24.20.0**, including supported pnpm lock regeneration and local install/sync. This supersedes the previous runtime freeze only for this bounded adjustment in the same candidate. The parent will review the four repairs plus this adjustment. No contract amendment, unrelated dependency update, staging/commit/push/merge, Sonar, nested agent or mutation run was authorized or performed.

Before editing, the preceding handback was verified: this evidence was 150740 bytes with SHA-256 `b4a111a14cea1c63e10482b3f5217cabd8fef6c8eb65657b70c7af422081ff8d`, and all 48 source/config hashes in `pc-s1-trust-test-51UIMw/inputs.json` matched current files. That complete evidence remains an exact prefix. Every historical Red/Green source map and capture, the old runtime recorder, all contracts and the source-main workspace remain untouched.

### Configuration, documentation and installation

Read the actual root `package.json`, `.node-version`, `pnpm-workspace.yaml`, lock resolution, and `.github/workflows/ci.yml`. A scan of live configuration/source found the two active exact pins in `.node-version` and `package.json#devEngines.runtime.version`. Both CI jobs already use `node-version-file: .node-version`, so no workflow edit was necessary. ADR 0001's historical 24.19 statement was preserved under the no-contract-edits constraint.

Current pnpm documentation was fetched before configuration/install through exactly three Context7 commands in the approved temporary directory: `npx --no-install ctx7@latest library pnpm "devEngines runtime version update lockfile install runtime Node.js"`; `npx --no-install ctx7@latest docs /websites/pnpm_io "devEngines.runtime exact version pnpm install update runtime lockfile checksum onFail download"`; and `npx --no-install ctx7@latest docs /websites/pnpm_io "pnpm install --no-frozen-lockfile --lockfile-only update manifest changed dependencies preserve versions"`. The runtime documentation explicitly describes `pnpm install` resolving the runtime and recording exact version/checksum. The optional third query returned no matching documentation; no additional lookup or undocumented lock editing followed.

Patched only the two active pins to `24.20.0`, retaining `onFail: download`, the existing engine range, pnpm **11.5.1**, and all package dependency declarations. Ran documented `pnpm install` from the candidate. It exited 0 and generated Node 24.20.0 runtime platform resolutions/checksums in `pnpm-lock.yaml`; no checksum/integrity data was hand-authored. Local installation completed with its existing Electron postinstall and Husky prepare hooks. The output's platform-package pruning and Node shim replacement were local install synchronization, not a dependency-version update.

An independent parsed-YAML comparison against the pre-install lock retained at `pc-s1-node2420-uibb14/source/pnpm-lock.yaml` proved unchanged non-runtime package/snapshot resolutions, importers, catalog and settings. Only the root Node runtime dependency and its `node@runtime:24.19.0` → `node@runtime:24.20.0` package/snapshot changed. All 47 non-lock hashes from the prior 48-source capture still match, including every source/test of TR-1..TR-4. The new pins are the only additional tracked files relative to that capture.

Observed from the candidate, before and after synchronization: bare `node --version` returned `v24.20.0`. After install, `pnpm exec node --version` also returned `v24.20.0` (captured below), and `pnpm --version` returned `11.5.1`.

### Separate recorder and one final validation on the new runtime

Read and preserved `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-capture.mjs`, which requires v24.19.0. Created a separate `pc-s1-node2420-capture.mjs` with the same capture/deadline behavior, an exact v24.20.0 check and a distinct `pc-s1-node2420-` directory prefix. Old recorder SHA-256 remains `961617bdfbd38d48fa089aa4ca65213d58acf9f6b079d3216f3f0c558aaff70a`; new recorder SHA-256 is `9014649f83402fd25e851b6364cc0a81eed50ccd284009d8b68714104ae3373f`. Neither product deadlines nor recorder limits changed (300000ms internal, 310000ms outer).

All captures below live in `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-<ID>/` and retain inputs, exact source bytes, stdout/stderr and exit/signal. Install used bare Node v24.20.0 to start the new recorder before the old local pin was synchronized. Subsequent captures used `pnpm exec node C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-capture.mjs <label> <command>`. Every recorded runtime is `v24.20.0` and every result has signal null.

| ID | Exact inner command | Exit | Result | inputs.json SHA-256 |
| --- | --- | --- | --- | --- |
| `uibb14` | `pnpm install` | 0 | Runtime lock resolution and local synchronization completed | `cce58c107b0421245a3be6b3aaa6cb9f96a9e579c44fd9b782d3b2dda2a982e1` |
| `4BOyPE` | `pnpm exec node --version` | 0 | `v24.20.0` | `a4c454ee5a13babbb4b746c7d04ec44faaea6a9b55862b995ab6a2e9448e358e` |
| `6veRZV` | `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts project-storage-create.integration.test.ts project-storage-open.integration.test.ts` | 0 | **228/228 passed**, 3 files, 186.20s; one execution on this runtime | `b9ebd76b1c30972c30d1cb2dc12ec25286a4a5c9875b0c1fd64d3d770dd8f5d6` |
| `FHFB0W` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness` | 0 | **20/20 passed**, one execution | `24964ba583a54bf151b7068143fd1aa9780ce6c04dde72b083f0724fcdb3fd6a` |
| `WM09Lx` | `pnpm --filter @slopstop/harness typecheck` | 0 | Harness typecheck passed, one execution | `10cfff0e2e2c23f0ed23606a175cb269927507fecd68e03ae1275a43cb3ad2cb` |
| `sHh3cR` | `pnpm exec biome check package.json apps/harness/src/registration/registration-registry.ts apps/harness/src/registration/registry-database.ts apps/harness/src/registration/repository-trust.ts apps/harness/src/registration/windows-file-identity.ts apps/harness/tests/integration/registration-identity-consent-cases.ts apps/harness/tests/integration/registration-repository-trust-cases.ts apps/harness/tests/integration/registration-decision-oracle.ts` | 0 | 8 changed source/config files passed, no fixes, one execution | `14978c8f9d54bced5e9ab3d8f7da365cbd2911a585e23c6b5f6fc50740102fe1` |

The text runtime pin and generated YAML lock were checked directly for exact runtime alignment and dependency preservation; they are not represented as Biome-checked TypeScript/JSON. CodeScene safeguard again passed, 42 checked/eligible files and 54 total modified paths; its only finding remains the earlier schema-spec improvement. The seven authored TypeScript files remain byte-identical to their detailed 10.0 reviews. No code behavior was edited for this runtime adjustment, and historical prospective TDD evidence was not recreated or relabelled.

### Final identity and truthful outcome

The five post-install captures (`4BOyPE`, `6veRZV`, `FHFB0W`, `WM09Lx`, `sHh3cR`) have identical **50-source/config** maps, checked against live bytes. SHA-256 of `JSON.stringify(inputs.hashes)` is `3e79039ef1dec7b241b3d658ce83764ef633c30ecd4a13be7d4c121580a9bc8d`. The exact current source/config bytes are retained under `pc-s1-node2420-6veRZV/source/`.

Runtime-only changed files (all regular files, filesystem mode 33206):

| Path | Final SHA-256 |
| --- | --- |
| `.node-version` | `5b9d0e73029969ae9000117cb877f17bb9841c1279bfe8024e294acfcf017800` |
| `package.json` | `db2ab21defc9ebf45c677ea4aea2db6ec92e9b13bf9b602e86d78025d115a0b6` |
| `pnpm-lock.yaml` | `e2e207bdd4d9123279603f7cacc5122e650ccb93dd6bb96900c800ec712191e8` |

Compose these three exact replacements/additions with the seven repair-source hashes in the preceding appendix and the preserved predecessor manifest/fixture overrides. The complete candidate now has 53 included paths plus this separate evidence file (54 dirty/untracked paths). Base is still `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, index remains empty, all 26 contract bindings still match, and the full current tracked binary patch hash is `c0473d9874c4815d705b7c2622ac65f48d40f020b4c8067f094a0b528491761c`. The effective contract hash remains `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e`.

**Current bounded validation passed on Node 24.20.0.** This is a new source/runtime-bound observation, not an explanation or correction of historical crashes. The prior `51UIMw` result remains **broken: 227/228, peer exit 3221225477**, and `qRsIkh`/`TQYB8a` remain unexplained historical worker failures. Their causes and any relationship to runtime version remain unproven. No crash occurred in the single new-runtime integration execution, and no retry was needed.

**Handback:** Four repairs plus exact Node alignment are ready for the parent's independent inspection, not human acceptance or whole-PC-S1 completion. TR-5 mutation remains pending outside this request; Sonar remains not assessed. No new Electron/Linux/package or full fast/deep proof is claimed. Final evidence hash/bytes are reported after append-prefix verification. Writes freeze again at handback.

## 2026-09-26 — TR-2 independent re-review findings and R2 correction

### Failed intermediate review and renewed bounded authority

The parent reported that independent re-review of frozen snapshot `pc-s1-trust-runtime-2026-09-26-snapshot.json`, SHA-256 `d5e1f9d5c80f7ab8c22523c3d3b93a534a9afc232bc0072dc6304c5fc72a91c8`, **failed** on two regressions introduced in TR-2. This failed disposition applies to that intermediate identity even though its 228-test validation passed. Preserve the original review result and evidence; this appendix records remediation, not retroactive clearance.

| Reported finding | Independent observation supplied by parent | R2 disposition |
| --- | --- | --- |
| Previously observed registry disappears during native choice | Both code and slice reviewers verified that moving/deleting the installation root permits the second `withRegistrationDatabase` call to initialize a fresh registry, losing the prior-existence witness. | Prospectively reproduced; corrected to `pending-recovery / REGISTRY_MISSING_WITH_WITNESS` with no directory/database recreation. Fresh initial setup remains permitted. |
| Native cancellation becomes registry contention | Another reviewer verified that the second database open happens before testing the native cancelled outcome, so another owner's write transaction turns cancellation into `REGISTRY_BUSY`. | Prospectively reproduced; non-selected preparation outcomes now return before any second database open. |

The current user explicitly authorized completion of this same TR-2 correction, with exclusive candidate writes, preserving the four-fix history and exact Node 24.20.0 alignment. Parent retains all three independent review roles. No new product scope, contract edit, dependency change, mutation work, Sonar, agent nesting or Git write operation was authorized or performed.

Before editing, all 53 incoming manifest entries matched, the base remained `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`, the index was empty, and evidence was exactly 160193 bytes / `620b7c77f0590770e654d76295db70f62505e319ec6a650d950794314eafcd32`. This complete prefix remains intact. The old snapshot, its retained bytes, both patch-chain files, all captures and all 26 contract references remain unchanged.

### Prospective repair sequence and separate review/refactor

1. **Registry disappearance test first:** the public owner's selector is paused after initial registry validation/closure. The test reads the initialized disposable database, moves the whole disposable `installation` directory, and releases a selected result. Expected outcome is `REGISTRY_MISSING_WITH_WITNESS`; both original directory and database paths must remain ENOENT, and the moved database bytes must be unchanged. Red actually returned `prepared` with a new selection ID. The minimal fix adds an explicit existing-only reopening mode which uses the established missing-registry fault before opening; the first-open default still initializes legitimately. Green passed all outcome/no-recreation/preservation assertions. Detailed CodeScene reviews of the two production files and tests returned 10.0/no findings. In the separate refactor step, the repeated open-mode union was given one `RegistryOpenMode` owner; no behavior was added.
2. **Cancellation test first:** the public selector is paused while another real local database client acquires and retains its write transaction. Releasing a cancelled choice must return `cancelled` before releasing that competing transaction; the holder also observes zero stored repository selections. Red actually returned `unavailable / REGISTRY_BUSY`. The minimal fix makes `PreparedRegistryRunner` give the continuation a lazy existing-only reopen function instead of an already-open client. The repository owner returns any non-selected result directly and invokes reopening only for a selected directory. Green passed while the competing lock remained held. No transaction or database is retained across the native choice.
3. **Separate final review:** all four changed TypeScript files returned 10.0/no CodeScene findings; no additional refactor was required. Lifecycle tracking encloses preparation and its continuation, so stop still drains admitted work and refuses later work. Preparation exceptions still cross the existing `registryFailure` boundary. Existing cancellation, absent-native, preparation-error, physical-change, registry-head-change and stop-drain tests were retained and passed in the final combined run.

Only these candidate files changed relative to the intermediate snapshot: `registration/registration-registry.ts`, `registration/registry-database.ts`, `registration/repository-trust.ts`, and `tests/integration/registration-repository-trust-cases.ts` under `apps/harness/src` or `apps/harness/tests` as listed below. Existing four-fix tests were preserved, with exactly two additional tests. Node config, lock resolution, pnpm version, schema/migrations, the other tests and all naming documents were unchanged. All test filesystem effects were inside owned disposable roots; no real installation or user directory was moved.

### Exact captures and results on Node 24.20.0

Each capture is retained at `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-<ID>/`, including `inputs.json`, full source bytes, stdout/stderr and `result.json`. Commands used `pnpm exec node C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-capture.mjs <label> <command>` from `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`. The unchanged recorder enforces v24.20.0, with 300000ms internal / 310000ms outer limits. All signals were null.

**I** below expands exactly to `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts`.

| ID | Exact inner command | Exit | Observed result | inputs.json SHA-256 |
| --- | --- | --- | --- | --- |
| `zVHdgQ` | I `-t does.not.recreate.a.registry` | 1 | Expected Red: `prepared` instead of missing-registry recovery | `234b4577ae9c238c64b56ac151fb1052015e8f8e9dc974079ca64fed92ec9691` |
| `vljl3j` | I `-t does.not.recreate.a.registry` | 0 | Green: 1 passed, including no recreation and preserved moved bytes | `4a6fc8996f6c26ea40dd1cb145ecc145f11823ae91c30d52fa1e7d178cde2604` |
| `LasM9g` | I `-t returns.native.cancellation` | 1 | Expected Red: `REGISTRY_BUSY` instead of cancellation | `50cb7738321c24c2e5d490718b099084e62d0f31d47ddd6d07186929809a79ad` |
| `2FyJhd` | I `-t returns.native.cancellation` | 0 | Green: 1 passed while competing write lock remained held | `70309c88508bc9c17f9a8d1a27fd6866cb1638e0c3222527c98aa5ca51da2d31` |
| `V6mT8j` | `pnpm --filter @slopstop/harness typecheck` | 0 | Final harness typecheck passed | `be267aadaa0887adae73818ebb9cfb7ef47c13e6ee2ebf2735ea805b49d0900f` |
| `1e894c` | `pnpm exec biome check package.json apps/harness/src/registration/registration-registry.ts apps/harness/src/registration/registry-database.ts apps/harness/src/registration/repository-trust.ts apps/harness/src/registration/windows-file-identity.ts apps/harness/tests/integration/registration-identity-consent-cases.ts apps/harness/tests/integration/registration-repository-trust-cases.ts apps/harness/tests/integration/registration-decision-oracle.ts` | 0 | 8 files passed, no fixes | `d81633a07d2595d890ca37957ae612ecb172a989e6c5e2c60b14db82570df847` |
| `BdjTfg` | `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-registration.integration.test.ts project-storage-create.integration.test.ts project-storage-open.integration.test.ts` | 0 | **230/230 passed**, 3 files, 157.51s; exactly one final combined execution | `685d36c97cc1b6c156979a570b2eafdd5eb23429daafb1dcbab20d5385f1f29e` |
| `hGoCMg` | `pnpm exec vitest run apps/harness/src/project-registration-observer.test.ts --project harness` | 0 | **20/20 passed** | `826abbeb1630157259b1aed943d81f3f655e1f672b36f349de7c202741020b8a` |

No crash occurred, and no final combined retry was performed. Prior `51UIMw`, `qRsIkh` and `TQYB8a` crashes remain unexplained historical failures; this run does not establish their cause fixed. The intermediate 228/228 runtime result remains a valid historical test observation but did not detect the two reviewer findings.

Final CodeScene safeguard passed with 42 checked/eligible files and 54 modified paths. Its only result remains the pre-existing improvement in `project-storage-database-specs.ts`; no new degradation. Sonar remains not assessed. No mutation, full fast/deep, Electron/Linux or package validation was run.

### Final R2 source identity and handback

The final typecheck, Biome, integration and observer captures have the same complete 50-source/config map. Every live source hash was compared with that map and with retained `BdjTfg/source/` bytes. SHA-256 of `JSON.stringify(inputs.hashes)` is `c1968c6a44f795b281efc2a391050eaa92c78bfadaaa9938d7bc44dee83a39fa`.

| Changed path | Final SHA-256 |
| --- | --- |
| `apps/harness/src/registration/registration-registry.ts` | `20564d3fc3468751653b7ea2cf3d3fa09e0fe00df2833b06108c14c863d6e8bb` |
| `apps/harness/src/registration/registry-database.ts` | `735f5faa7ef0a34d3180e89a7c232a1dac12b31e7c4534a163d6fc8b0df44b1e` |
| `apps/harness/src/registration/repository-trust.ts` | `40b4be12a4005e8a8244bcd5340a6250ebcfdaa64543cf7cb4efa3c332dd0a0c` |
| `apps/harness/tests/integration/registration-repository-trust-cases.ts` | `591416bf2a0ca1d8d903ef753ae69027ab7b5495d6d126d764abce8e00ebd6e1` |

All four remain added-untracked relative to the original base, so the complete tracked patch remains `c0473d9874c4815d705b7c2622ac65f48d40f020b4c8067f094a0b528491761c`. The original binary-capable patch plus the unchanged runtime-only delta still reconstruct the tracked portion exactly. The new full manifest will be `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-runtime-2026-09-26-r2-snapshot.json`: same 53 sorted included paths, fresh retained source root `pc-s1-node2420-BdjTfg/source`, original unchanged naming-document byte root, all 26 original contract bindings and current separately bound evidence. Snapshot and final evidence hash/bytes are returned after append verification; old snapshot bytes remain immutable.

**State:** both reported TR-2 regressions corrected with prospective Red/Green and final bounded validation passed. The prior independent review remains failed for its original identity. The new R2 identity awaits the parent's three-role independent re-review; no acceptance or whole-PC-S1 completion is claimed. TR-5 remains pending outside this request. Writes freeze at handback.
