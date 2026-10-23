---
date: 2026-10-23T16:18:47+0100
author: Pedro Mesquita
commit: e2ef472
branch: main
repository: slopstop
topic: "#133 harness-to-desktop log link: log a successful Project Storage upgrade, prove the link in the real app, and forward the harness fatal-summary lines (§141)"
tags: [design, logging, harness, desktop, protocol, project-storage, upgrade, fatal-diagnostics, issue-133]
lane: normal
lane_reasons: ["no upstream lane", "lane.mjs --paths: files: 9 > 5"]
status: in-review
last_updated: 2026-10-23T17:05:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Pedro's decisions appended (Q1 a, Q2 a, Q3 a, Q4 a); brief approved from f6afcee7. Earlier: lean brief written, Q1-Q4 open."
content_hash: d199549249e807f71c0670591189fac5414e32a5764893c7e898a7a82f41aad9
---

# Design: #133 harness-to-desktop log link

Lane: **normal**. `lane.mjs --paths` over the planned files answers `normal` ("files: 9 > 5"; slices, lines and hub signal unknown). No upstream artifact carries a lane. So: linked worktree, no intent review (Pedro, §144: proportional process), slice-verifier at candidate review with **one** candidate review round, full deep review, and Pedro's acceptance of the combined result.

## Intent

**Outcome.** When something important happens in the harness, the desktop main log (`userData/logs/slopstop.jsonl`) shows it, and a test in the real app proves that the link works. Today the link has only negative proof: C1 S5 showed that no failure line was forwarded, because a successful upgrade writes nothing (§70, §88; C1 design `:1004`). After this slice:
1. A successful Project Storage upgrade writes one redacted harness line, and the desktop forwards it.
2. The e2e test of a real upgrade reads that line in the desktop log. This is the positive proof that settles the C1 carry-forward row.
3. The harness fatal lines (s9 of #123 Part A: `HARNESS_SHUTDOWN_FAILED` and `HARNESS_RUNTIME_START_FAILED` with the failure summary; §141, #133 comment) reach the desktop log. They are decoded by a strict protocol schema, so a line carrying anything beyond the known metadata is rejected, never logged.

**Scope.** Issue #133 (body and the §141 comment), decisions log §88, §141, §144.

**Non-goals.**
- Distinct desktop diagnostics for upgrade failures (#133 "Not in scope"; carry-forward, re-deferred).
- Changing the upgrade failure lines (`abandoned`, `discard-failed`): unchanged, byte for byte, in both processes.
- Forwarding any other harness stdout line (for example "Harness message port connected."). It stays dropped.
- The s9 mutation residuals `process-fatal-diagnostics.ts:69` and `:78` (§141, accepted). They stay as they are, but the LOG-B3 schema rejects what they would let through (see Verification Notes).
- Sentry. Nothing here is sent anywhere outside the local log.

**Constraints.**
- AGENTS.md Safety And Privacy: no full local path, Project name, content, message text, cause or stack in any line. Ids (UUIDs) and closed vocabularies only.
- AGENTS.md TypeScript: the schemas are the source of truth at the process boundary, and the desktop decodes with `decodeStrictResult` (unknown keys rejected at every level).
- `degrade-distinguishes-broken`: a line that looks like a fatal or upgrade line but fails to decode is reported as `HARNESS_LOG_LINE_INVALID`, never dropped silently and never logged as valid.
- `shared-vocab-union`: the cleanup part names and tag, and the epoch-milliseconds bound, get one owner in `packages/protocol`.

## Architecture

**Data flow (unchanged shape).** Harness Pino logger (`apps/harness/src/harness-logger.ts:4`, JSON lines on stdout, `base: { service: "harness" }`) → utility-process stdout → `HarnessSupervisor#watchOutput` (`apps/desktop/src/main/harness-supervisor.ts:400-433`) → `createHarnessLogLineForwarder` (`apps/desktop/src/main/harness-log-lines.ts:53`) → main Pino logger (`apps/desktop/src/main/logger.ts:22`). The forwarder today selects lines by `event` (`harness-log-lines.ts:18-28`) and decodes them with `HarnessUpgradeLogLineSchema` (`packages/protocol/src/project-upgrade-protocol.ts:176`).

**Ownership.**

| Owner | Responsibility in this slice |
|---|---|
| `packages/protocol` `project-upgrade-protocol.ts` | New event `harnessUpgradeLogEvents.completed = "project-storage.upgrade.completed"` and its union member in `HarnessUpgradeLogLineSchema`. |
| `packages/protocol`, new `harness-fatal-log-protocol.ts` | `HarnessFatalLogLineSchema` and its vocabularies (fatal codes, their fixed messages, value kinds, cleanup tag and part names, the summary bound 16). Exported through the package index. |
| `packages/protocol`, shared | `EpochMillisecondsSchema` (today private at `project-upgrade-protocol.ts:161`) moves to one exported owner that both line schemas use. |
| `apps/harness` storage | The upgrade diagnostics port gains `completed(event)`; the pipeline calls it once after the committed switch. |
| `apps/harness` `upgrade-diagnostics-logger.ts` | Writes the `completed` line at info. |
| `apps/harness` `process-fatal-diagnostics.ts`, `registration-listing.ts` | Import the cleanup tag, part names and the summary bound from protocol (no shape change). |
| `apps/desktop` `harness-log-lines.ts` | Selects and decodes fatal lines too, and forwards them at `error`. |
| `apps/desktop/tests/e2e` | `project-upgrade.test.ts` reads the forwarded `completed` line; `expectDesktopLog` takes the expected forwarded events. |

**The completed upgrade line** (one JSON line, what Pino serializes):

```
{ level: 30, time: <epoch ms>, service: "harness",
  event: "project-storage.upgrade.completed",
  projectId, upgradeId, sourceGenerationId, targetGenerationId }
```

The values come from the pipeline's `upgraded` result (`project-storage-upgrade-pipeline.ts:418-424`). No path, Project name or migration list. Whether the line also names the upgrade path (single or chained) is **Q1**.

**Where it is emitted.** In `runDeclaredUpgrade`, right after `switchActive` commits (`project-storage-upgrade-pipeline.ts:412-417`), because that is the moment the upgrade has really happened. The later `after-upgrade-switch` checkpoint (`:388-394`) cannot undo a committed switch, so the line is still true if that checkpoint fails. The port call is guarded like the discard diagnostics: a throwing `completed` never changes the upgrade's answer (precedent: `project-storage-store.test.ts:996`).

**The fatal line** (what `logger.fatal(metadata, message)` serializes; source `process-fatal-diagnostics.ts:30-46`, `process-entry.ts:33-42`):

```
{ level: 60, time, service: "harness", msg: <fixed message of code>, code, ...metadata }
metadata by code:
  HARNESS_SHUTDOWN_FAILED | HARNESS_RUNTIME_START_FAILED:
      failures: Entry[] (0..16), omittedFailures: int >= 0
  HARNESS_START_FAILED: either the same summary, or no metadata (failStartup)
  HARNESS_UNCAUGHT_EXCEPTION | HARNESS_UNHANDLED_REJECTION: valueKind   (scope: Q2)
Entry = { tag: <identifier, /^[A-Za-z][A-Za-z0-9]{0,63}$/> }
      | { tag: "RegistrationCleanupUnconfirmed", parts: ("registry"|"observer"|"listing")[] }
      | { kind: "error"|"string"|...|"undefined" }
```

`msg` is pinned to the one fixed message of each code (for example `"Harness shutdown failed."`; `process-shutdown.ts:24`, `process-connection.ts:25,37`, `process-entry.ts:68,96`). So the schema accepts no free text. The forwarder drops `msg`, `level`, `time` and `service`, and logs `{ source: "harness", attempt, code, ...metadata, harnessTime }` at `error` with the message `"Harness fatal event."` (level: **Q3**). The `source: "harness"` field keeps a forwarded `HARNESS_START_FAILED` apart from the desktop's own diagnostic of the same code (`harness-supervisor.ts:370`; `protocol.ts:352`).

**Selection.** A line is a candidate when it is a JSON object whose `event` is a known upgrade event (today), or whose `level` is 60 and whose `code` is a known fatal code (new). Only candidates are decoded; any other line stays dropped. A candidate that fails to decode gives one `warn` `{ code: "HARNESS_LOG_LINE_INVALID", attempt, event | fatalCode }`. The echoed value is already known to be in the closed vocabulary, so the warning never repeats unknown text.

**Why the line arrives before the exit.** The harness calls `process.exit(1)` right after `logger.fatal` (`process-fatal-diagnostics.ts:146-147`). Pino 10.3.1's default stdout stream is asynchronous, but it registers a synchronous flush on exit (`pino/lib/tools.js:271-276`, `:366`). LOG-B6 proves this on a real piped child (**Q4**).

## Decisions

- **D1. One slice.** Every behavior shares the same two files at the boundary (the protocol line schemas and the desktop forwarder), and only the e2e proves the link. Splitting would leave a schema with no consumer, or a forwarder with no proof.
- **D2. The completed line joins `HarnessUpgradeLogLineSchema`** as a third union member at level 30. It shares the base `time`, `service`, `projectId` and `upgradeId` (`project-upgrade-protocol.ts:168-173`). The forwarder already logs level 30 at info as "Harness upgrade event." (`harness-log-lines.ts:44`). Rejected: a separate schema or message, which would duplicate the selection path for no gain.
- **D3. A separate fatal schema file** in protocol, because fatal lines are process lifecycle, not Project Storage. It uses a union by `code`, `msg` pinned per code, and closed vocabularies. Rejected: forwarding fatal lines without a schema (AGENTS.md TypeScript; §141 "needs a protocol schema").
- **D4. The vocabularies move to protocol** (`shared-vocab-union`): `REGISTRATION_CLEANUP_TAG`, `REGISTRATION_CLEANUP_PARTS`, the summary bound 16, the value kinds, the fatal codes and their messages. Harness imports them, and protocol owns the union. The identity proof comes first: the existing s9 tests stay green unchanged.
- **D5. Emit on the committed switch**, not on the final answer (see Architecture). A failed `after-upgrade-switch` checkpoint after a committed switch still logs `completed`.
- **D6. The failure lines are unchanged.** `abandoned` and `discard-failed` keep their schema members, and the existing forwarder rows stay as they are. The only change on the upgrade side is that `expectDesktopLog` gets a parameter.
- **D7. Heavy runs, sized to the change** (Pedro, 2026-10-23; §144). The slice touches the e2e surface (`project-upgrade.test.ts`, `electron-launch.ts`), so that **one e2e file** runs at the candidate, with the coordinator's GO. Harness integration: only `harness-logger.integration.test.ts` (and LOG-B6 if Q4 (a)). The full `test:integration`, the other e2e files and `package:smoke` run in the `check:deep` before the push. No mutation run, because #133 asks for none and the changed logic is a schema plus a selector. Pedro may ask for a scoped run.
- **D8. Approach check: not run.** This follows Pedro's proportional process, as in #105. It can run on request.

## Next Slice

### Slice log-s1-harness-desktop-log-link (detailed 2026-10-23)

- `slice_id`: `log-s1-harness-desktop-log-link`. Lane: **normal** (`lane.mjs --paths`, "files: 9 > 5").
- Base: main `e2ef472`.
- Behaviors: LOG-B1..LOG-B7.
- Deliverable: the completed upgrade line, written and forwarded; the fatal lines forwarded through a strict schema; the e2e reads the completed line in the real app's desktop log.
- Source paths:
  - `packages/protocol/src/project-upgrade-protocol.ts`, `packages/protocol/src/harness-fatal-log-protocol.ts` (new), `packages/protocol/src/index.ts`;
  - `apps/harness/src/storage/project-storage-upgrade.ts` (port type), `apps/harness/src/storage/project-storage-upgrade-pipeline.ts`, `apps/harness/src/storage/project-storage-upgrade-node-adapter.ts` (`:75`, `:405` pass-through), `apps/harness/src/upgrade-diagnostics-logger.ts`;
  - `apps/harness/src/process-fatal-diagnostics.ts`, `apps/harness/src/registration/registration-listing.ts` (vocabulary imports only);
  - `apps/desktop/src/main/harness-log-lines.ts`.
- Test paths:
  - `packages/protocol/src/harness-fatal-log-protocol.test.ts` (new);
  - `apps/harness/src/storage/project-storage-store.test.ts`, `apps/harness/src/upgrade-diagnostics-logger.test.ts`, `apps/harness/tests/integration/harness-logger.integration.test.ts`;
  - `apps/desktop/src/main/harness-log-lines.test.ts`;
  - `apps/desktop/tests/e2e/project-upgrade.test.ts`, `apps/desktop/tests/e2e/electron-launch.ts`.
  - Fakes that build the full port (`project-storage-store.test.ts:148`, `:870`) gain `completed`.
- Dependencies: #123 Part A s9 (`271b418`, on main), C1 S5 e2e (`project-upgrade.test.ts`).

### Test Contract: log-s1-harness-desktop-log-link

Public seams: the protocol schemas through `decodeStrictResult`; the Project Storage owner through `createProjectStorageOwner` with a recording diagnostics port (as `project-storage-store.test.ts:860-880`); the real harness logger through a memory destination (as `harness-logger.integration.test.ts:19-32`); the desktop forwarder through `createHarnessLogLineForwarder` with a recording logger; and the built app through the Playwright e2e.

- **Behavior LOG-B1**: the completed upgrade line has a strict schema.
  - Test: `decodes the completed upgrade line` → `harness-log-lines.test.ts` (forwarder with a recording logger). Input: a completed line with all six fields. Output: exactly one `info` call `({ source: "harness", event: "project-storage.upgrade.completed", projectId, upgradeId, sourceGenerationId, targetGenerationId, harnessTime: <ISO of time> }, "Harness upgrade event.")`.
  - Test: `rejects an invalid completed line: $name` → same file, `it.each`. Rows: an extra `path` key; `level: 40`; `targetGenerationId` missing; `sourceGenerationId` not a lowercase UUID. Each gives exactly one `warn` `({ code: "HARNESS_LOG_LINE_INVALID", attempt: 1, event: "project-storage.upgrade.completed" }, "Harness upgrade log line rejected.")` and no `info`.
  - Expected red: the event is not selected, so no `info` (first test) and no `warn` (second).
- **Behavior LOG-B2**: a committed upgrade reports `completed` once, and only then.
  - Test: `reports a committed upgrade once: owner` → `project-storage-store.test.ts`. A fake eligible upgrade that switches: the recorded events are exactly `[["completed", { projectId, upgradeId, sourceGenerationId, targetGenerationId }]]`, with the ids of the `upgraded` answer.
  - Test: `reports no completion without a committed switch: $name` → same file, `it.each`. Rows: refused (`unsupported`); failed (`backup invalid`); failed (`verification mismatch`); the switch step rejects; `not-required`. None of them records a `completed` event; the failure rows keep their existing `abandoned` event.
  - Test: `still reports completion when the after-switch checkpoint fails: owner`: a committed switch, then an injected `after-upgrade-switch` failure. The answer is whatever it is today (unchanged), and the events include `completed` exactly once.
  - Test: `keeps the upgrade answer when completion reporting throws: owner`: the answer with a throwing `completed` equals the answer with a recording one (precedent `:996`).
  - Test: `writes the completed line` → `upgrade-diagnostics-logger.test.ts`: one `info` object `{ event: "project-storage.upgrade.completed", projectId, upgradeId, sourceGenerationId, targetGenerationId }` and nothing else.
  - Expected red: the port has no `completed` (type error, then a missing event).
- **Behavior LOG-B3**: the fatal line has a strict, metadata-only schema.
  - Test: `accepts each harness fatal line: $name` → `harness-fatal-log-protocol.test.ts`, `it.each`. Rows: shutdown with `failures: [{ tag: "RegistrationCleanupUnconfirmed", parts: ["registry", "listing"] }, { kind: "error" }]`, `omittedFailures: 0`; runtime start with 16 entries and `omittedFailures: 3`; start with summary; start without metadata; and, if Q2 (a), uncaught exception and unhandled rejection with `valueKind`.
  - Test: `rejects a fatal line that could carry text: $name` → same file. Rows: an extra `message`, `stack`, `cause` or `path` key at the top or inside an entry; `msg` other than the code's fixed message; a tag with `/`, `\`, `.`, `:`, a space or 65 characters; 17 entries; an unknown part `"storage"`; `parts` on a tag other than `RegistrationCleanupUnconfirmed`; `parts` not an array; a non-string `tag` (the s9 `:69` shape); `omittedFailures` negative or fractional; an unknown code; `level` other than 60. Each fails to decode.
  - Expected red: the schema does not exist (import fails).
- **Behavior LOG-B4**: the harness writes fatal lines the desktop accepts.
  - Test: `writes fatal lines the desktop accepts` → `harness-logger.integration.test.ts`. The real `createHarnessLogger` on a memory destination; `reportHarnessFailure` with a fake sink that forwards to it (exit recorded, not taken), for `HARNESS_SHUTDOWN_FAILED` with an `AggregateError` of a `RegistrationCleanupUnconfirmed` and a plain `Error("C:\\private\\project\\slopstop.db")`, and for `HARNESS_RUNTIME_START_FAILED` with a tagged error; plus the `failStartup` shape and, if Q2 (a), the two handler shapes. Every line decodes with `HarnessFatalLogLineSchema`, and the serialized text does not contain `private`.
  - Expected red: the schema does not exist.
- **Behavior LOG-B5**: the desktop forwards valid fatal lines and reports invalid ones.
  - Test: `forwards a harness fatal line` → `harness-log-lines.test.ts`. A valid shutdown line gives exactly one `error` call `({ source: "harness", attempt: 1, code: "HARNESS_SHUTDOWN_FAILED", failures, omittedFailures, harnessTime }, "Harness fatal event.")`. No `msg`, `level` or `service` field is logged.
  - Test: `rejects an invalid fatal line: $name` → same file. Rows: an extra `message` key; 17 entries; a path in a tag. Each gives exactly one `warn` `({ code: "HARNESS_LOG_LINE_INVALID", attempt: 1, fatalCode: "<code>" }, "Harness fatal log line rejected.")` and no `error`.
  - Test: `ignores other harness lines: $name`: an info line `"Harness message port connected."`; a level-60 line with an unknown `code`; a level-50 line with a known code. None produces a call.
  - Pins: the existing upgrade rows and the line-limit, partial-line and split-chunk rows stay unchanged and green.
  - Expected red: fatal lines are not selected (no call).
- **Behavior LOG-B6** (if Q4 (a)): a fatal line written right before `process.exit(1)` reaches a piped parent.
  - Test: `flushes the fatal line before the exit` → `harness-logger.integration.test.ts`. A Node child with stdout piped writes one fatal line through `createHarnessLogger()` (default destination) and calls `process.exit(1)` at once. The parent receives exactly one complete line, which decodes, and the exit code is 1.
  - Expected red: none, a pin. It guards against a logger change (for example a transport) that would lose the line.
- **Behavior LOG-B7**: the real app shows the completed upgrade in the desktop log.
  - Test: `updates an older Project in the window` → `project-upgrade.test.ts` (extended). After close, the desktop log holds exactly one line with `msg: "Harness upgrade event."`. Its `event` is `"project-storage.upgrade.completed"`, its `projectId` is the fixture's, `sourceGenerationId` and `targetGenerationId` are both UUID strings that differ, and its `source` is `"harness"`. No `HARNESS_LOG_LINE_` code appears.
  - `expectDesktopLog(userData, launches, forwarded = [])` checks the forwarded upgrade events against the expected list. The other e2e callers keep the empty list (no change in their assertions), and its TSDoc no longer says the positive link is unexercised.
  - Expected red: zero forwarded lines (the harness writes none today).

### Success Criteria: log-s1-harness-desktop-log-link

**Automated:**
- Red then green for each behavior with the smallest Vitest command (protocol, harness unit, desktop unit), then `pnpm check`.
- `vitest run apps/harness/tests/integration/harness-logger.integration.test.ts` (cheap, under 2 minutes).
- E2E: `project-upgrade.test.ts` only, once at the candidate, with the coordinator's GO (D7).
- Bindings, each restored by digest: LOG-B3, where dropping the tag pattern makes the path-tag row pass; LOG-B5, where forwarding `msg` makes the "No `msg`" assertion fail; LOG-B2, where emitting on the final `upgraded` answer instead of the switch makes the checkpoint row fail.
- CodeScene `code_health_score` on every changed source file (target 10, AGENTS.md).
- Not per slice: the full `test:integration`, the other e2e files and `package:smoke` run in `check:deep` before the push.

**Manual (Pedro, at the combined acceptance):**
- Packaged or dev build: open an older Project that needs an upgrade. `slopstop.jsonl` shows one "Harness upgrade event." line with `event` `project-storage.upgrade.completed` and no path.

## Deferred Work

- **Distinct desktop diagnostics for upgrade failures** (#133 "Not in scope"; upgrade-window design `:339-350`). Trigger: a real occurrence.
- **A real-app proof of a fatal line.** No e2e can make the harness fail at shutdown or start without a test-only fault hook in the built artifact. LOG-B4 to LOG-B6 prove each hop instead. Trigger: the first harness fatal in a real run that is missing from `slopstop.jsonl`, or a fault-injection seam added for another reason.
- **The upgrade path field** if Q1 (a): it can be added later from the chain rule (`application-database-migration.ts:180`). Trigger: a support case that needs it.

## Verification Notes

- **Risk: privacy through the fatal summary.** The s9 summary keeps only tags matching `IDENTIFIER_TAG` (`process-fatal-diagnostics.ts:59`), part names in the closed list, and value kinds. The accepted mutation gaps `:69` (a non-string `_tag`) and `:78` (non-array parts) are covered at the desktop boundary: a non-string tag or non-array parts fails to decode (LOG-B3), so it is reported as invalid, never logged.
- **Risk: losing the line at exit.** Pino's default stdout stream is asynchronous with an exit-time `flushSync` (`node_modules/.pnpm/pino@10.3.1/.../lib/tools.js:271-276`). This is fine for a pipe in Node 24, but it is not proven in this repo. LOG-B6 proves it if Q4 (a).
- **Risk: the desktop drains stdout after the exit.** `#observeChild` drains on `exit` and finishes only on stdout `end`/`close` (`harness-supervisor.ts:387-391`, `:420-424`), so late lines are still forwarded. Existing supervisor rows cover this, and nothing here changes it.
- **Risk: code collision.** The desktop's own `HARNESS_START_FAILED` (`harness-supervisor.ts:370`) and the forwarded harness one share a code. The `source: "harness"` field and the message tell them apart, and LOG-B5 asserts both fields.
- **Baseline:** the e2e helper `expectDesktopLog` (`electron-launch.ts:65-75`) asserts *no* forwarded upgrade event today. Any e2e that performs an upgrade other than `project-upgrade.test.ts` would now fail. Search at build time: only `project-upgrade.test.ts` upgrades today.
- Evidence folder: `.rpiv/evidence/2026-10-23_16-18-47_harness-desktop-log-link/`.

## Developer Context

- 2026-10-23, the coordinator (§144) relayed Pedro's choice of #133 as the next item, with the scope addition from §141 and a proportional process (no intent review unless rigorous; heavy runs only where the slice touches their surface; at most one candidate review round).
- Open questions for Pedro, with recommendations:
  - **Q1. The "upgrade path" field (single or chained).** #133 asks the line to carry it. The pipeline does not know it: the source `GenerationRow` has no "made by an upgrade" field (`project-storage-node-schemas.ts:95-108`), and only the chain rule reads completed upgrades (`application-database-migration.ts:180-192`).
    - (a) **Recommended:** omit it. The line carries the source and target generation ids, so a chain can be read by linking one line's target to the next line's source. #133's checklist is updated with Pedro's approval.
    - (b) Derive it: "chained" when the source generation was the target of an earlier completed upgrade. This adds a registry read to the pipeline, with its own failure path (it must never fail the upgrade), and more test rows.
  - **Q2. Which fatal lines to forward.**
    - (a) **Recommended:** all five harness fatal codes. The two s9 codes plus `HARNESS_START_FAILED` share one shape, and the uncaught and unhandled codes carry only `valueKind`. The mechanism and the privacy guarantee are the same, and an uncaught exception is the line most worth seeing.
    - (b) Only the two s9 codes, as §141 wrote them.
  - **Q3. The desktop level of a forwarded fatal.**
    - (a) **Recommended:** `error`, with "Harness fatal event.". The desktop process keeps running and reports the child exit itself (`harness-supervisor.ts:315`).
    - (b) `fatal`, which would read as if the desktop itself crashed.
  - **Q4. Prove the flush before `process.exit`.**
    - (a) **Recommended:** LOG-B6, one cheap integration row with a real piped child.
    - (b) Skip it. The risk is then accepted as residual, because no e2e covers a fatal line.
- **2026-10-23, Pedro's decisions (AskUserQuestion in the coordinator's session, relayed by coordenador-claude):** Q1 (a), Q2 (a), Q3 (a), Q4 (a). Pedro approved the brief with these choices applied, from the stamped copy `f6afcee7c6b9…`. What they settle:
  - Q1 (a): the completed line carries no upgrade-path field. Its fields are exactly those in Architecture and LOG-B1. The coordinator updates the #133 checklist with a comment on the issue.
  - Q2 (a): all five harness fatal codes are forwarded. In LOG-B3 and LOG-B4, the rows marked "if Q2 (a)" (uncaught exception and unhandled rejection with `valueKind`) are part of the contract.
  - Q3 (a): forwarded fatal lines are logged at `error` with "Harness fatal event." (LOG-B5 as written).
  - Q4 (a): LOG-B6 is part of the contract (the piped-child flush row).
  - Lane normal confirmed; the approval is of document intent only. Build authority and the workspace (a linked worktree) are agreed at `/rpiv:implement`.

## References

- Issue #133 and its §141 comment (GitHub `TheMastermindPT/slopstop`).
- Decisions log `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §70, §88, §141, §144.
- C1 design `.rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md:1004` (carry-forward row).
- #123 Part A design (s9) `.rpiv/artifacts/designs/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a.md`, approved `content_hash e0cf6eff…` (§142).
- Source: `apps/desktop/src/main/harness-log-lines.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/logger.ts`, `apps/harness/src/harness-logger.ts`, `apps/harness/src/process-fatal-diagnostics.ts`, `apps/harness/src/process-entry.ts`, `apps/harness/src/process-connection.ts`, `apps/harness/src/process-shutdown.ts`, `apps/harness/src/upgrade-diagnostics-logger.ts`, `apps/harness/src/storage/project-storage-upgrade-pipeline.ts`, `packages/protocol/src/project-upgrade-protocol.ts`, `apps/desktop/tests/e2e/project-upgrade.test.ts`, `apps/desktop/tests/e2e/electron-launch.ts`.
- Standing decisions: `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`.
