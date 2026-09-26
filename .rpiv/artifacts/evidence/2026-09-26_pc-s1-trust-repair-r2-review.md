---
date: 2026-09-26
author: OpenCode
commit: 97678d2
branch: feat/project-registration
repository: slopstop
topic: "PC-S1 four trust repairs and Node 24.20.0 scoped review"
tags: [evidence, review, pc-s1, trust]
status: in-progress
last_updated: 2026-09-26
last_updated_by: OpenCode
---

# Four Trust Repairs — Final Scoped Review

## Human Scope And Authority

The user explicitly requested **“corrige os QUATRO pontos”**, then **“continua”**. This selects correction of TR-1 through TR-4 from [the original review](2026-09-24_pc-s1-trust-parent-review.md). TR-5 mutation was not included and remains pending, not waived. The later instruction **“node needs to be set to the version i have”** authorized aligning the candidate runtime to the installed Node24.20.0. Parent observed bare Node24.20.0 and subsequently independently confirmed `pnpm exec node --version` also returned24.20.0.

All implementation remains in `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`, branch `feat/project-registration`, base/original target `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`. No candidate acceptance or integration authority is implied.

## Frozen Review Identity

- Mode `candidate`, slice `PC-S1`, limited to the four repairs and runtime alignment.
- Workflow: `C:/Users/pedro/rpiv-claude/rpiv/skills/_shared/candidate-workflow.md`.
- Approved artifact remains `2026-09-12_22-45-37_persistent-project-conversation.md`; contract content hash `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e` and26 unchanged bindings.
- Snapshot: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-trust-runtime-2026-09-26-r2-snapshot.json`.
- Snapshot SHA-256: `b162de65c0cce306c9310afbc6d7e530bec009523fe4e610cfc25646642ec9b4`.
- Complete manifest:53 files; final50-file code/configuration capture map SHA-256 `c1968c6a44f795b281efc2a391050eaa92c78bfadaaa9938d7bc44dee83a39fa`. The three additional files are unchanged naming documents.
- Evidence: candidate `.rpiv/artifacts/evidence/2026-09-13_pc-s1-implementation.md`,170819 bytes, SHA-256 `3cbc976e9c09ed44b12351f72a528910994deac590946633f447cc4c0ba89589`. The previous160193-byte prefix is preserved.
- Full retained contents, modes/statuses, ordered patches and materialization recipe are bound by the snapshot. No staging was needed.

The three reviewers received the same frozen identity and evidence; their findings were independent. Code and slice reviewers verified all53 retained/current file hashes and26 contracts before and after inspection, with zero drift. This report is outside candidate inputs.

## Repair Outcomes

| Finding | Resolution in this identity | Evidence |
| --- | --- | --- |
| TR-1 | Invalid stored directory identity produces `REGISTRY_CORRUPT`, with zero admission. Unexpected failures retain distinct handling. | Red `xuDryo`, Green `ilpxBq` |
| TR-2 | Native selection waits outside the database transaction. Reopening requires the previously observed registry, preventing fresh recreation after disappearance. Cancelled selection returns before reopening. Stop still drains previously admitted selection work. | Red/Green `l9KzAF`/`lCtv1d`; R2 `zVHdgQ`/`vljl3j` and `LasM9g`/`2FyJhd` |
| TR-3 | Independent SQLite oracle compares complete persisted decision rows through replay, conflict and restart. A sentinel timestamp makes rewrites observable. | Characterization `PFtMot`; no fabricated Red |
| TR-4 | Windows error5 maps to `REPOSITORY_INACCESSIBLE` during selection and revalidation, with zero admission; missing and unexpected errors remain distinct. | Red `OafdPD`, Green `0ApAWq`, controls `Otq601` |

The first repair review against snapshot `d5e1f9d5c80f7ab8c22523c3d3b93a534a9afc232bc0072dc6304c5fc72a91c8` **failed**: reopening could silently recreate a disappeared registry, and cancellation could become `REGISTRY_BUSY`. Both were regressions within TR-2 and were corrected in R2 with separate prospective Red/Green. The prior failure remains historical; R2 does not rewrite it.

Runtime changes are limited to `.node-version`, `package.json` and generated Node runtime resolutions/checksums in `pnpm-lock.yaml`. Node is24.20.0, pnpm remains11.5.1, CI already reads `.node-version`, and unrelated lockfile contents were verified unchanged. Historical evidence and pins in historical snapshots were preserved.

## Independent Final Reviews

| Role | Session | Final scoped outcome |
| --- | --- | --- |
| Code | `ses_f2b90d9b3ffeM2qAf9Ui2C5IPu` | Passed; all four points and both introduced regressions closed; no new findings |
| Coverage | `ses_f2b90d8c1ffe8471GBa5LBxfD9` | Passed for the bounded repairs and runtime alignment; no new coverage findings |
| Slice | `ses_f2b90d877ffeI5P9qqYoIaGLoR` | Decisions OK, Research OK; four repairs closed; full readiness still incomplete due to TR-5 |

Both artifact reviewers completed the same scoped target with zero new findings. This clears only the reviewed repairs, not PC-S1 acceptance or its remaining proof obligations. Reviewers performed no writes or test reruns. Report-row Jev lint was unavailable due to absent `TYPESAFE_API_KEY`; no installation or credential action occurred.

## Final Checks

Captures live under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-<ID>/`, with exact commands, source bytes/maps and results. All final captures use Node24.20.0 and the identical final source map.

| Capture | Check | Result |
| --- | --- | --- |
| BdjTfg | Registration + Storage create/open integration | 230/230, exit0 |
| hGoCMg | Observer unit | 20/20, exit0 |
| V6mT8j | Harness typecheck | exit0 |
| 1e894c | Biome over eight changed code/config files | exit0 |

Author recorded CodeScene10.0 for the four R2 files and a passing safeguard without new degradation; the earlier seven repair files also received10.0. Sonar remains not assessed under the explicit earlier developer direction.

Historical `51UIMw` recorded227/228 and peer exit3221225477 (`0xC0000005`). It and qRsIkh/TQYB8a remain unexplained; DIV4g4's historical cleanup qualification also remains. Passing later tests or switching Node does not establish the crash cause or a crash fix.

TR-5 mutation remains pending outside this repair request and blocking for full readiness. No new whole-PC-S1 fast/deep, Electron/Linux/package proof, six-query executor, complete registration/list/select/reopen or UI delivery is claimed. Candidate remains isolated and unaccepted; no commit, staging, push or integration occurred.
