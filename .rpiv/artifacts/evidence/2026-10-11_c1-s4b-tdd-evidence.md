---
date: 2026-10-11T12:00:00+0100
author: Pedro Mesquita
repository: slopstop
branch: feat/c1-s4-conversation-window
commit: 07651a2
status: in-progress
tags: [evidence, tdd, conversation, c1, desktop, renderer, bridge, ipc, preload, accessibility]
---

# Conversation C1 S4b — the Conversation window — TDD evidence

## Method

S4b follows the approved design revision 5.3 (`content_hash e05cac0b…9180`). It also follows these decisions-log entries:
- §48: the forced-colours axe oracle, which also applies to CNV-B47;
- §51: S4a was accepted at `07651a2`;
- §52: the NVDA speech-log pass is unavailable because of an incompatibility.

S4b also applies the S4a handoff notes.

- **Base and workspace.** The base is the accepted S4a head `07651a2`, on the same branch and worktree (G30), with no push.
- **Lane.** Rigorous. `lane.mjs --paths` reports files 15 > 5, `ipc` and `preload`; the label was recorded.
- **Discipline.** As in S3 and S4a: each step is one commit, red first.
- **Binding.** Every run is bound to its parent commit and a patch digest of the whole working tree, untracked files included.
  - From step 3 on, the digest is computed with a temporary index (`GIT_INDEX_FILE`), so no intent-to-add mark is left in the real index (see Deviations).
- **Logs.** The logs live in `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/30527fd8-ca4b-4fda-8d20-1582088ffedf/scratchpad/s4b/logs/`, called `logs/` below.
- **Guards.** A row that passes on arrival is a guard, bound by a recorded mutation whose restored digest equals the green one.

## Steps

| Step | Commit | Behaviours | Red | Green | Bindings |
|---|---|---|---|---|---|
| 1 | `06d82d5` | CNV-B16: bridge read and save, `unsent` fault, pure `project-conversation-failure.ts` (G25, G28) | A: methods absent (54 rows, `logs/b1-b16-red-a.log`); B: with the upgrade-style scaffold, the 3 sent-then-lost save rows answered `unavailable` (`logs/b1-b16-red-b.log`) | 96/96 with the IPC tests (`logs/b1-b16-green-2.log`) | the upgrade "call after stop" row is a guard |
| 2 | `03d3210` | CNV-B17: IPC channels, strict preload, API lists, shared fakes | IPC scaffold decoded without forwarding; the preload methods were absent (`logs/b2-b17-red.log`) | 82/82 (`logs/b2-b17-green-2.log`) | — |
| H1 | `474d860` | CNV-B47 journey file (red evidence) | all 7 tests failed on the missing surface: no Message textbox, no status text, no alert, no read-only line (`logs/h1-b47-red.log`) | turns green at H2 | — |
| 3 | `22e77e5` | pure rules: `savedAtLabel` (CNV-B45), save outcome, slot precedence | function absent (6 rows); module absent (70 rows) (`logs/b3-*-red.log`) | 76/76 (`logs/b3-outcome-green.log`) | — |
| 4a | `1521751` | CNV-B18: save path | no Message textbox, no read (`logs/b4a-b18-red.log`) | renderer 237/237 | — |
| 4b | `cd2f3bc` | CNV-B31: every page, 300 ms loading line, focus rules, per-Project memory, older-activation drop | only the first page showed, 120 of 201 (`logs/b4b-b31-red.log`) | renderer 244/244 (`logs/b4b-b31-green-3.log`) | focus moving on every load failed the add, removal and remount rows; an unkeyed region failed the older-activation row |
| 4c | `d30b74a` | CNV-B34: text rules | Save available for whitespace-only text (`logs/b4c-b34-red.log`) | renderer 249/249 | — |
| 4d | `dbe2b49` | CNV-B33: read-only | with a draft in the field, Save was available (`logs/b4d-b33-red-3.log`) | renderer 250/250 (`logs/b4d-b33-green-3.log`) | — |
| 4e | `fe24c98` | CNV-B35: failed loads, Reload, stale activation with no action | no notice, no Reload (23 rows, `logs/b4e-b35-red.log`) | renderer 273/273 (`logs/b4e-b35-green-3.log`) | — |
| 4f | `1348ef7` | CNV-B32: outcome table, Try again, saveId, drain order, isolation, harness epoch; plus the CNV-B31 epoch read row | 34 rows (`logs/b4f-b32-red.log`) | renderer 323/323, twice (`logs/b4f-b32-green-5.log`) | the epoch read row is a guard, by the same keyed remount the 4b binding proved |
| 4g | `f95811b` | CNV-B45: rendering rows | the time showed the raw instant (`logs/b4g-b45-red.log`) | renderer 324/324 | the dateTime and plain-text rows are guards (React text nodes never parse markup) |
| 4h | `eedbc8a` | CNV-B46: scroll; keyboard, focus and announcement rows | no scroll after a save (`logs/b4h-b46-red.log`) | renderer 329/329 (`logs/b4h-b46-green-2.log`) | each failed its row: Enter alone saving, focus leaving Save after a fault, `role="status"` on the slot |
| 5 | `5e08753` | styles: field ring, textarea override, forced Highlight outline, Save hover, 120 ms transitions, Broken outline; CNV-B42 guard extension | the old guard passed `color: red` and an `oklch()` background in a region module (`logs/b5-b42-guard-gap.log`) | the extended guard refuses both (`logs/b5-b42-guard-binding.log`); renderer 329/329 | — |
| H2 | `9a1cc94` | CNV-B47 green, plus two product fixes | earlier H2 runs: `logs/h2-b47-green.log` to `-4.log` | 7/7 on a fresh package (`logs/h2-b47-green-5.log`) | H3 below |

## H2 — what the real window found

The real window found two product faults, both fixed in `9a1cc94`:
- **Reduced motion.** Save still ran its 120 ms transitions under reduced motion. The parts module loads after the theme, so its `transition` won at equal specificity; the module now sets its own transitions to 0 s.
- **Scroll timing.** A saved row joined the list one render after "Saved", so the stream reached its end a frame late. The row now renders with "Saved", derived from the outcome, and the stream scrolls before paint (`useLayoutEffect`).

It also found four test defects, each fixed in the helper:
- Chromium serializes the halo's relative colour as `color(srgb …)`, which the shadow parser now reads.
- Try again and Reload are reached by Tab, because the ring is `:focus-visible`.
- The stale-activation message is read from the notice, not the slot.
- Focus facts now wait for the 120 ms transitions to finish.

No seed or launch timeout occurred.

## H3 — bindings (coordinator D2)

| Mutation | Row that failed | Log |
|---|---|---|
| textarea override removed | CNV-B47 step 2: the textarea's `outline-style` `none` | `logs/h3-binding-textarea-override.log` |
| Save not described by the 300 ms loading line | CNV-B31 (jsdom; that row lives there) | `logs/h3-binding-loading-description.log` |
| the slot not announcing "Saved" | CNV-B47 step 2: expected "Saved", got "" | `logs/h3-binding-status-announcement.log` |

Every restored digest equalled the clean one, and the build was repackaged clean.

## Screenshots

- **Scale 1, for the ui-ux review:** `…/scratchpad/s4b/visual/scale-1/`. It holds 23 files: empty, saved, over-limit, many messages, and the states 8a–8f, each in normal and forced colours.
- **Scale 1.5, for Pedro:** `…/scratchpad/s4b/visual/scale-1.5/`, 21 files. The coordinator approved a full set: empty, saved, over-limit, many, and the states 8a uncertain and broken, 8b, 8c, 8e and 8f, each in normal and forced colours at 1280×800, plus the 853×533 journey shot.
  - They come from a temporary capture-only Playwright file, run once (`logs/capture-150.log`, 66 s) and then deleted, never committed. It has no assertions, because 1 px borders round down at 150 %.

## Deviations and disclosures

- **Design reds that no longer hold.** Earlier steps changed the starting point of several reds, and the actual reds are recorded:
  - CNV-B33's "button enabled" is observable only with a draft, because CNV-B34 already blocks an empty field;
  - CNV-B35's red is "no notice", not "an empty conversation shows", because since 4b a failed read leaves the region loading;
  - CNV-B46's red is the scroll, not Ctrl+Enter, which works since 4a.
- **Test file split.** CNV-B32 lives in `conversation-save-outcomes.test.tsx`, split from the design's `project-conversation.test.tsx` to keep each file readable.
- **Placement of the CNV-B31 epoch row.** The row for a read pending across a harness restart landed in 4f, together with the epoch save row.
- **Test fixes on the way.**
  - A CNV-B35 focus check raced under the full suite and now waits for the focus render; the product is unchanged.
  - In 4f, two of my CNV-B32 test defects were fixed: the return read lists the committed message, and the no-late-Saved check precedes Try again.
- **Process slips, both harmless.**
  - Intent-to-add marks (`git add -N`) broke a lint-staged commit. No stash was created and no file was lost; digests now use a temporary index.
  - A failed Python edit let a `;` chain run typecheck, a renderer Vitest run and a `biome --write` in the **main** repository directory. Main's status was checked: clean, apart from the pre-existing `.playwright-mcp/`, with no new stash, and those runs only read and tested. That one log was invalid and was replaced.
- **CodeScene.** Every flagged complexity (hooks, region state, settleSave, the table tests) was split before its commit.
- **Manual.** The NVDA speech-log pass is **unavailable (incompatibility)** (§52): NVDA 2026.2 crashes at start on this machine. It is not recorded as passed. Pedro's Narrator listen is the manual step and is pending.

## ui-ux review 1 (decisions log §54)

The ui-ux review returned CHANGES C1–C11. Pedro approved all of them through the coordinator (§54), including the contract amendments below. Each observable change started red; logs are in `…/scratchpad/s4b/logs/`.

| Commit | Change | Red | Green |
|---|---|---|---|
| `c13f4ab` | C7: a rejected desktop call shows the Failure tone | `c7-red.log` (4 rows) | in `copy-c2-green.log` |
| `4e2a6f1` | C2: Save inside the composer field; Save described by "Saving is off until the conversation loads." | `copy-red.log` (22 CNV-B35 rows) | `copy-c2-green.log` |
| `8c95786` | DESIGN.md `spacing.measure`, `button-ghost-sm(-hover)`; Seixo `--space-measure`, `.ghostSm`; CNV-B42 spacing count 8 → 9 | `tokens-red.log` | `tokens-green.log` |
| `d01ecb8` | CNV-B49 `circle-help` stave from Runa v2 | `circle-help-red.log` | `circle-help-green.log` |
| `9a070b9` | 8e detail "This Project was reopened elsewhere. Restart Ragnarok to open it again.", no action | `stale-detail-red.log` (2 rows) | `stale-detail-green.log` |
| `145d84a` | C5–C9: status-row tones (Failure slot, Unknown with circle-help, Saved check), Try again as ghost sm at the row end, notice `data-tone`, ghost sm Reload; derived `--fault-edge`/`--fault-halo` | `tones-red.log` (27 rows) | `tones-green-1…4.log` |
| `fa3642b` | C1, C3, C4, C6, C10, C11 (CSS) plus CNV-B47 rows for C1, C4 and C6 | the review's observation of the `9a1cc94` shots | `layout-green.log`, `h2b-b47-3.log` |

**Contract amendments (§54), all disclosed:** CNV-B32/B35 (the rejected-call tone, the Save reason copy, the stale detail); the Unknown tone for uncertain and dropped saves (the unit rows now expect Unknown); CNV-B42 (spacing count and the derived-token rule by exact value); CNV-B49 (circle-help).

**H2 again.** The first rerun (`h2b-b47.log`) failed 2 of 7 for a **real** product fault: axe `color-contrast` on the ghost Reload over the blood tint in 8b and 8d, which used ink-dim. Reload now uses ink-muted (the Three Voices rule). The reruns `h2b-b47-2.log` and `h2b-b47-3.log` pass 7/7 on a fresh package. The empty state sat outside the column in the first capture; it now joins the column rule.

**Fresh screenshots (`visual-r2`).**
- Scale 1: `…/scratchpad/s4b/visual-r2/scale-1/`, 23 files.
- Scale 1.5: `…/scratchpad/s4b/visual-r2/scale-1.5/`, 25 files: every state in normal and forced colours at 1280×800, now including 8a-rejected and 8d, plus the 853×533 journey shot. Same temporary capture method as before (`capture-150-r2.log`, `capture-150-r2b.log`), never committed.

**Disclosures.**
- Message plates use `border: 1px solid var(--forged)` (equal to their fill) instead of `transparent`, because CNV-B42 forbids `transparent` in region modules. The effect is the same, and forced colours draw it.
- In 8b, "Could not load this conversation." appears in the notice and in the Failure-tone status row. This follows the contract (the title is announced through the slot); the ui-ux agent was asked to judge it.

## ui-ux reviews 2 and 3, and approval

**Review 2** approved the rest of review 1's result (plate borders `var(--forged)`, the ghost Reload in ink-muted) and asked for two changes. Pedro also approved an optional change.

| Commit | Change | Red | Green |
|---|---|---|---|
| `d4afee5` | D1: one left edge. The plates' later `margin: 0` had cancelled the column's centring and is now `margin-block: 0`. The header and context lines take `padding-inline: max(var(--space-8), calc((100% - var(--space-measure)) / 2))`, which gives the same edge at every width and keeps the header rule full width. D2: while a load notice shows, the status row is visually hidden but keeps `#conversation-status`, its `aria-live` and its text. | `r2-red.log`: the header and context lines at x 392, not 460 (1-empty, 8f); the slot row 720×40 in 8b, 8d, 8e. The 2-saved plate check was not reached, because 1-empty failed first. | `r2-green-3.log`, H2 7/7 |
| `07f964e` | A read-only Project's composer has no placeholder; a pending save keeps its hint | `placeholder-red.log` (CNV-B33: `'Write a message'`, not `''`) | `placeholder-green.log` (336/336), `r2-placeholder-h2.log` (H2 7/7) |

- One defect was found on the way (`r2-green.log`): `.statusRow`'s 22px min-height left the hidden row 1×22. The hidden rule now adds `min-height: 0`.
- CodeScene flagged `StatusSlot` at complexity 11; it was split (`SlotLine`) before the commit.
- **Disclosure:** Try again is not rendered while the row is hidden, so no invisible button takes focus. Reload is that state's action.
- **Disclosure:** the pending-save placeholder row is a guard that passed before the change; it is not a red.
- Screenshots: `…/scratchpad/s4b/visual-r3/` and `…/visual-r4/` (scale 1: 23 files; scale 1.5: 25 files; `capture-150-r3.log`, `capture-150-r4.log`).

**Review 3: APPROVED,** with one spacing fix and no further review.

| Commit | Change | Red | Green |
|---|---|---|---|
| `0c9d5b7` | The composer always has `padding-bottom: var(--space-5)`; the visible status row keeps its 8px top margin | `r3-red.log`: the field's gap to the window edge in 8b was 0, not 20 | `r3-green.log`, H2 7/7 |

The visible status row also keeps its 16px bottom margin; review 3 did not mention it. The coordinator relayed the approval and the GO for the final-head heavy runs, with no further ask.

## Final-head runs (coordinator GO after ui-ux review 3)

Sequential runs on clean trees (digest `e3b0c442…`); logs are in `…/scratchpad/s4b/logs/`.

| Run | Head | Result | Log |
|---|---|---|---|
| E4 full `pnpm test:e2e` | `719f753` | 25/25, 266 s | `final-e4.log` |
| `9fb9934` adds the S4b mutate list to `stryker.config.json` | | | |
| E5 `pnpm package:launch-smoke` | `9fb9934` | passed, 40 s | `final-e5.log` |
| root `pnpm exec stryker run --force` | `9fb9934` | 84.82 (break 80), 3607 mutants, 3502 s | `final-stryker.log`, `reports/mutation/mutation.json` |
| `pnpm check`, knip, jscpd (0 clones) | `9fb9934` | pass | `final-gates.log` |
| CodeScene `analyze_change_set` against `main` | `9fb9934` | passed, 55 files, no issues | — |

**Duration.** My estimate of 8–9 minutes was wrong. S4a's root run had about 2700 mutants. The renderer files added about 900, and each of those runs jsdom tests. The config has no progress reporter, so the log showed nothing from 13:00 to 13:57. The coordinator asked for the run to finish; a progress reporter will be proposed as a separate change.

**Per-file scores (S4b files)** = (killed + timeout) / (killed + timeout + survived + no coverage).

| File | Score | Killed | Timeout | Survived | No coverage |
|---|---|---|---|---|---|
| `main/project-conversation-failure.ts` | 97.06 | 66 | 0 | 2 | 0 |
| `renderer/conversation/saved-at.ts` | 92.11 | 35 | 0 | 2 | 1 |
| `renderer/conversation/save-outcome.ts` | 88.70 | 102 | 0 | 13 | 0 |
| `renderer/conversation/conversation-region.tsx` | 82.57 | 90 | 0 | 19 | 0 |
| `renderer/conversation/use-conversation-load.ts` | 80.51 | 91 | 4 | 23 | 0 |
| `renderer/conversation/settle-save.ts` | 79.55 | 35 | 0 | 9 | 0 |
| `renderer/conversation/use-conversation-save.ts` | 78.48 | 62 | 0 | 17 | 0 |
| `renderer/conversation/conversation-memory.ts` | 73.68 | 14 | 0 | 4 | 1 |
| `renderer/conversation/load-notice.tsx` | 70.83 | 34 | 0 | 14 | 0 |
| `renderer/projects-workspace.tsx` (S4b ranges) | 66.67 | 6 | 0 | 3 | 0 |
| `renderer/conversation/use-project-conversation.ts` | 55.56 | 25 | 0 | 20 | 0 |
| `renderer/conversation/status-row.tsx` | 55.32 | 26 | 0 | 21 | 0 |
| `renderer/conversation/conversation-parts.tsx` | 54.55 | 42 | 0 | 35 | 0 |
| `renderer/workspace-view.tsx` (S4b ranges) | 53.85 | 42 | 0 | 36 | 0 |

`use-conversation-save.ts` also had 2 runtime-error mutants, which are left out of the score.

**Survivors (218 in the renderer S4b files).**
- 64 are string mutations of CSS module class names. jsdom applies no CSS, so unit tests cannot see them; the e2e rows (CNV-B47) observe the styling instead.
- 63 are conditional-expression mutations, mostly in the hooks and in `workspace-view.tsx`.
- The rest are other strings (29), logical operators (12), equality operators (10), booleans (10), and a few others.
- No survivor rows have been added. The coordinator decides whether a survivor step is needed.

## Survivor step (coordinator GO after the #94 check:deep)

**Classification** of the 157 survivors in the eight weak files of the `9fb9934` root run:

| Class | Count | Meaning |
|---|---|---|
| Real | 51 | Behaviour with no unit row |
| Styling | 60 | CSS-module class strings and data attributes; jsdom applies no CSS, and the CNV-B47 e2e rows cover the styling |
| Layout or timing | 11 | Stream scroll and the same-frame row; both e2e |
| Equivalent | 18 | No observable effect |
| Pre-existing | 16 | `workspace-view.tsx` code that was moved but not changed; the mutate ranges were too wide and are kept as they are, not narrowed to lift the score |
| Narrow | 1 | An upgrade problem on an active Project; not covered |

The full table is in `…/scratchpad/s4b/survivor-classification.md`.

**Pedro's decision (decisions log §54): Try again after an edit.** Editing the draft after a kept failure ends its save identity, so Try again goes. The failure line stays as information, and Save locally sends the edit as a new save.
- Red (`tryagain-red.log`): with the two fix files back at HEAD, the row failed with `expected <button…> to be null`.
- The fix files were restored from a backup, with matching sha256 (`8781036…`, `4267a83…`).
- Green (`tryagain-green.log`): renderer 355/355.

**Survivor rows and bindings** (`survivor-bindings.log`). Each row passed on arrival as a guard and is bound by one hand mutant, restored from a backup with an equal digest. All 18 were red; the tree digest was `c88ab387…` before and after.
- `settle-save.test.ts`: four rows, bound by T1–T4.
- `conversation-memory.test.tsx`: two rows, bound by M1–M2.
- `conversation-details.test.tsx`: eleven rows, bound by P1, P2, U1a, U1b, S1, S2, L1, L2, W1, W2.
- `conversation-save-outcomes.test.tsx`: Try again while the return read is pending, bound by D1a and D1b.

**Commits:** `5a10573` holds the fix and the rows; gates and CodeScene pass. `27150c2` adds the Stryker reporters `clear-text` and `progress-append-only`.

**Targeted Stryker** (`targeted-stryker.log`) on `5a10573`: 14 files, 915 mutants, 3119 s. Every S4b file scored at or above its root-run score:

| File | Root `9fb9934` | Targeted `5a10573` |
|---|---|---|
| settle-save.ts | 79.55 | 100.00 |
| conversation-memory.ts | 73.68 | 94.74 |
| use-project-conversation.ts | 55.56 | 87.50 |
| use-conversation-save.ts | 78.48 | 87.34 |
| conversation-region.tsx | 82.57 | 85.59 |
| load-notice.tsx | 70.83 | 77.08 |
| status-row.tsx | 55.32 | 63.83 |
| conversation-parts.tsx | 54.55 | 61.04 |
| workspace-view.tsx (ranges) | 53.85 | 60.26 |
| project-conversation-failure.ts, save-outcome.ts, saved-at.ts, use-conversation-load.ts, projects-workspace.tsx (ranges) | unchanged | unchanged |

The survivors left in the weak files match the classification exactly:
- conversation-parts: 30 = 21 styling + 6 layout + 3 equivalent;
- status-row: 17 = 15 styling + 2 equivalent;
- load-notice: 11 styling;
- use-project-conversation: 6 = 5 timing + 1 equivalent;
- use-conversation-save: 10 equivalent;
- conversation-memory: 1 equivalent;
- workspace-view: 31 = 13 styling + 1 equivalent + 16 pre-existing + 1 narrow.

The log's "All files" line (86.53) mixes in incremental results reused from files outside this run; it is not a root score.

## Final-head runs after the survivor step (coordinator GO, `aac55b5`)

`aac55b5` has no code change since `5a10573`. The runs went one after another on a clean tree (digest `e3b0c442…`).

| Run | Result | Log |
|---|---|---|
| E5 `pnpm package:launch-smoke` | passed, 42 s | `final2-e5.log` |
| E4 full `pnpm test:e2e` | 25/25, 265 s | `final2-e4.log` |
| root `pnpm exec stryker run --force` | 86.53 (break 80), 3612 mutants, 3538 s | `final2-stryker.log`, `…/scratchpad/s4b/final-mutation-aac55b5.json` |

**Root per-file scores, S4b files.** Each cell is the score as killed / timeout / survived / no coverage.

| File | `9fb9934` | `aac55b5` |
|---|---|---|
| main/project-conversation-failure.ts | 97.06 | 97.06 (66/0/2/0) |
| renderer/conversation/settle-save.ts | 79.55 | 100.00 (44/0/0/0) |
| renderer/conversation/conversation-memory.ts | 73.68 | 94.74 (18/0/1/0) |
| renderer/conversation/saved-at.ts | 92.11 | 92.11 (35/0/2/1) |
| renderer/conversation/save-outcome.ts | 88.70 | 88.70 (102/0/13/0) |
| renderer/conversation/use-project-conversation.ts | 55.56 | 87.50 (42/0/6/0) |
| renderer/conversation/use-conversation-save.ts | 78.48 | 87.34 (69/0/10/0) |
| renderer/conversation/conversation-region.tsx | 82.57 | 85.59 (95/0/16/0) |
| renderer/conversation/use-conversation-load.ts | 80.51 | 80.51 (91/4/23/0) |
| renderer/conversation/load-notice.tsx | 70.83 | 77.08 (37/0/11/0) |
| renderer/projects-workspace.tsx (ranges) | 66.67 | 66.67 (6/0/3/0) |
| renderer/conversation/status-row.tsx | 55.32 | 63.83 (30/0/17/0) |
| renderer/conversation/conversation-parts.tsx | 54.55 | 61.04 (47/0/30/0) |
| renderer/workspace-view.tsx (ranges) | 53.85 | 60.26 (47/0/31/0) |

**Survivor diff against the classification.** Survivors were keyed by mutator, replacement and source line, so the matching holds even where lines moved.
- New survivors: **none**.
- Killed since the root run, in the eight weak files: 4 + 5 + 4 + 7 + 14 + 3 + 9 + 5 = **51**. That is exactly the classification's "real" count.
- `conversation-region.tsx` also lost 3 survivors.
- Every survivor left is in the classification's styling, layout or timing, equivalent, pre-existing or narrow class.

## Candidate review round 1 (coordinator, decisions log §56)

Source: the consolidated review of candidate `e3706d3`. Logs are in `…/scratchpad/s4b/logs/`.

**Correction to "Final-head runs after the survivor step" (T4).** That E5 ran first, and `package:launch-smoke` does not package. So the "E5 passed on `aac55b5`" smoke tested the package built before `5a10573`, not `5a10573` itself. That record stays as written, and this note corrects it. The next final-head order is a fresh package, then E5, E4 and the root Stryker.

**Behaviour fixes, red then green.**

| Item | Change | Red | Green | Commit |
|---|---|---|---|---|
| T2 | "Saved" ends at the next input; failure lines stay. CNV-B47 step 2 and `saveByKeyboard` wait for the previous "Saved" to go. | `r1-red.log`: `expected 'Saved' to be ''` | `r1-green-2.log`, 368/368 | `ca839da` |
| T6 | No Try again under a read-only activation; the hook refuses it too | `r1-red.log`: Try again present on the read-only return (2 rows) | as above | `ca839da` |
| T13 | A pending save settles only from its own activation's answer; a dropped save takes any late answer | `r1-red.log`: settled, not undefined | as above | `ca839da` |
| T14 | The stale-activation save line uses the load notice's copy, through one renderer constant `staleActivationDetail`. The save-outcome unit copy row is amended for §56. | `r1-red.log`: old copy | as above | `ca839da` |
| T1 | A focused unavailable control keeps its focus ring and lifts from 0.45 to 0.7 opacity (ui-ux approved 0.7) | `t1-red.log`: no ring on the focused unavailable Save, Reload and Try again | `t1-green.log`, `t1-green-2.log`, and `t1-green-3.log` (H2 8/8, with opacity 0.7 pinned on all three) | `c8427d8` |

**Guard rows, each bound by a hand mutant restored from a backup with an equal digest.**
- T5, T7a/b, T8, T9, T10, T11: 8/8 red (`r1-bindings.log`).
- Re-bindings after a refactor (S1, T10, D1a, T6): 4/4 red (`r1-bindings-b.log`).
- R0 (the region heading's `tabIndex -1`) and R1 (the loading timer cleared after a fast load): 2/2 red (`r1-bindings-c.log`, commit `31c6aeb`).
- **Deviation (T9, accepted):** CLDR's en-GB short form of September is "Sept", so the row pins "10 Sept, 14:02", not "10 Sep".

**T3.** `project-entry-bridge.ts` :44, :82 and :191-204 joined the mutate list (`522ea56`).
- The first targeted attempt never started: `--incremental false` was read as a config file, so it exited 1 after 6 s with zero mutants (`t3-stryker.log`, kept).
- The corrected run (`t3-stryker-2.log`) scored 100.00: 6/6 killed, no survivors.

**T1 screenshots.** `…/scratchpad/s4b/visual-t1/scale-1/` and `scale-1.5/`, normal and forced colours. They were taken at opacity 0.45; ui-ux approved the structure from them and set the focused opacity to 0.7.

**T12: the other 60 survivors of the `aac55b5` root run.**

| File | Real (now guarded) | Styling | e2e | Equivalent | Narrow | Pre-existing |
|---|---|---|---|---|---|---|
| saved-at.ts (3) | 1 (T9) | | | 2: optional chaining and `?? ""` on parts that always exist | | |
| conversation-region.tsx (16) | 4: T11, T10/D1 ×2, R0 heading | 10 | 2: D2 concealment | | | |
| save-outcome.ts (13) | | 3: tone strings | | 10: the stale Try again (staleActivation is not retryable), dropped on return, `{kind: "none"}` shape, and slot-line `tryAgain` flags the region never reads | | |
| use-conversation-load.ts (23) | 7: T7 ×3, T8 ×3, R1 | | | 13: ref optional chaining, the focus-request reset, firstLoad, the deps arrays, the initial and refresh load shapes, messages on failure | 3: dead-instance guard and cleanup (S1 family) | |
| project-conversation-failure.ts (2) | | | | 2: a malformed reply falls through to the same result in both mappings | | |
| projects-workspace.tsx (3) | | | | | | 3: the `busy` prop, moved into the memory provider, not changed |
| **Total 60** | **12** | **13** | **2** | **27** | **3** | **3** |

The evidence line "Every S4b file scored at or above its root-run score" covers only the S4b mutate entries of that run, not files outside them (T12 scope).

**Follow-ups for the React port (S1, S2, accepted).**
- S1: `use-conversation-load.ts:154`, a dead instance's read writes `expectedRevision`.
- S2: `use-conversation-save.ts:55`, the captured `scope.refresh` re-reads through an unmounted instance.
- Both are hidden by the writer slot and in-order answers, and are not reachable or visible in the real app today. A test would need an artificial remount race, so they are recorded here instead of fixed.

## Final-head runs after round 1 (coordinator GO for (d), `10c23d8`)

The runs went one after another on a clean tree (digest `e3b0c442…`).

| Step | Result | Log |
|---|---|---|
| 1. Fresh package (`electron-forge package`) | exit 0, 10 s, 17:45:26–17:45:36 | `final3-package.log` |
| 2. E5 `pnpm package:launch-smoke` on that package | passed, 42 s | `final3-e5.log` |
| 3. E4 full `pnpm test:e2e` | 26/26, 264 s; its own package step rebuilt `out/` at 17:46:28 from the same clean `10c23d8` | `final3-e4.log` |
| 4. Root Stryker | **not run** | — |

- **Why the root Stryker did not run.** The coordinator corrected the GO: mutation runs once, on the final candidate after the last review round, and round 2 may still bring fixes. I created `final3-stryker.log` as a **blocker, not evidence**: the chain refuses a step whose log already exists, so it stopped before Stryker without interrupting E4. The root run after round 2 will use a new log name.
- **Package check (R4, stale package).** The current `out/SlopStop-win32-x64/resources/app.asar` is dated 17:46:28, written by E4's package step from the same clean `10c23d8`. Its renderer CSS (`assets/index-BboRyeGG.css`) holds the T1 rules: `[aria-disabled=true]{opacity:.45;cursor:not-allowed}`, `[aria-disabled=true]:not(:focus-visible){box-shadow:none}` and `[aria-disabled=true]:focus-visible{opacity:.7}`. Step 1's package, which E5 tested, was rebuilt from the same tree by E4's package step 43 s later, so it can no longer be inspected; its log shows a clean `10c23d8` digest.

## Candidate review round 2 (the last; decisions log §58)

All three reviewers passed `ff2cd8e`: no blocker, and T1–T14 hold. Pedro chose to apply F1–F7 without a third review round. **Residual risk:** the F1–F7 fix delta was not reviewed by the reviewers. F8–F10 are follow-ups.

**F1, correction (line 274 stays as written).** Line 274 ("Every survivor left is in the classification's styling, layout or timing, equivalent, pre-existing or narrow class") holds only for the **eight weak files** of the survivor step. It does not hold for the whole `aac55b5` run: of the other 60 survivors, 12 were real. The T12 table in "Candidate review round 1" classifies them, and all 12 are now guarded.

**F2, binding of the 0.7 opacity pins** (`f2-binding.log`). With the focus-visible opacity rule removed, the three pins failed: `Expected "0.7"`, `Received "0.45"` on the focused unavailable Save (step 1), Reload (8b) and Try again (g). The CSS was restored from a backup with an equal digest.

**F3, forced outline on the focused unavailable Save.**
- `f3-guard.log`: H2 8/8, so the assertion passed on arrival, as a guard.
- Bound by a hand mutant that adds `outline-style: none` for a focused unavailable button under forced colours (`f3-binding.log`). It failed with `Expected "solid"`, `Received "none"` on Save, Reload and Try again, and was restored with an equal digest.
- The packaged `out/` was last built with that mutant in place, before the restore. The final chain starts with a fresh package.

**F4, disclosure.** The T5 Try again rows start from an `unavailable` answer settled before the switch. They do not start from the design's :875 isolation case: a save pending across the switch, shown as "Not confirmed." on return. The code path is the same, but the case differs, and it was not disclosed before.

**F5, recorded; no code change.**
- `canResend`'s `!readOnly` in `use-conversation-save.ts` is defensive and unreachable at the seam: under a read-only activation the region never renders Try again (T6).
- It is pre-classified as **equivalent** for the final root run.
- Label correction: in `r1-bindings-b.log`, the binding "T6 read-only Try again in the hook" mutated `conversation-region.tsx` (the region's `!readOnly`), not the hook.

**F6, reclassification.** Mutant 1820 at `use-conversation-load.ts:163` (`load.kind !== "failed"` → false) is **equivalent**, not guarded. The T12 counts become **11 real and 28 equivalent**; styling 13, e2e 2, narrow 3 and pre-existing 3 are unchanged.

**F7, behaviour, red then green** (`ef3f92f`). Under a read-only activation, a kept uncertain or dropped outcome now says only "The save could not be confirmed.", without "Try again to check it.".
- Red (`f7-red.log`): `Received: "Not confirmed. The save could not be confirmed. Try again to check it."`.
- Green (`f7-green.log`): renderer 372/372.
- After the setup-helper refactor that removed a jscpd clone, it was re-bound by dropping `readOnly` from `outcomeLine` in the region: red, restored with an equal digest (`f7-binding.log`).

**Follow-ups (F8–F10, Pedro §58).**
- F8: one exported activation fixture with an `access` parameter, instead of `activationFor` and the harness `readWrite`.
- F9: an optional UI row for T13, with the a1 answer arriving after the a2 Try again.
- F10: a neutral owner module for `staleActivationDetail`.

## Final candidate: the mutation exception (Pedro's decision)

**Exception to the run-once rule (recorded).** Pedro decided against a root Stryker run on the final candidate.
- A root run started on `020cb6a` and was stopped by decision after about a minute (450 of 3245 tested). Its processes were stopped, the `.stryker-tmp` sandbox was removed, and the tree digest went back to `e3b0c442…`. The partial log is kept and marked "stopped by decision", so it is not evidence of a score (`final4-stryker.log`).
- In its place, a targeted `stryker run --force` covered only the **5 source files changed since `aac55b5`** (`final4-targeted-stryker.log`, `…/scratchpad/s4b/final4-targeted-020cb6a.json`): 446 mutants, 1166 s, exit 0.
- Every other mutate entry keeps its `aac55b5` root-run score, because its source has not changed since then. `project-entry-bridge.ts` keeps its T3 score of 100.00.

| File | `aac55b5` | `020cb6a` targeted |
|---|---|---|
| conversation-region.tsx | 85.59 | 89.47 (102 killed, 12 survived) |
| load-notice.tsx | 77.08 | 76.60 (36/11) |
| save-outcome.ts | 88.70 | 89.15 (115/14) |
| settle-save.ts | 100.00 | 100.00 (49/0) |
| use-conversation-save.ts | 87.34 | 87.37 (83/12; 2 runtime errors excluded) |

**Survivor diff against `aac55b5`,** keyed by mutator, replacement and source line. There are 7 new keys:
- **Real and unguarded: mutant 234,** `save-outcome.ts:94`. `line?.tone === "unknown"` → `true` would put the read-only not-confirmed copy on every kept line. Under a read-only return with a kept unavailable answer, the line would then read "Not saved. The save could not be confirmed.". The run was stopped after step 1, as the coordinator's rule requires.
  - **Fixed in tests only.** The T6 read-only rows now pin the line text: "Not saved. Project Storage is unavailable." for unavailable, and "Not confirmed. The save could not be confirmed." for uncertain.
  - **Bound by mutant 234 by hand:** the unavailable row went red while the uncertain and dropped rows stayed green, and the file was restored with an equal digest (`m234-binding.log`).
  - **No Stryker rerun:** the binding is the proof for 234.
- **Equivalent (6):**
  - 384 (`canResend`'s `memory.saveId !== undefined` → true) and 433 (`tryAgain`'s `memory.saveId === undefined` → false) each fall back on the other check, the same class as the old 77:37;
  - `idle`'s pending check → true, and its string: Try again is not rendered while pending;
  - `afterInput`'s `{ kind: "none" }` → `{}`, and `"none"` → `""`: an outcome without a known kind shows no line, the same as none.
- F5: the `canResend` `!readOnly` mutant (380) was **killed** in this run, so it is not a survivor.

## Final-candidate runs (`58c4c96`)

Gates on the clean `58c4c96` (`final5-candidate-gates.log`): `pnpm check`, knip and jscpd all passed (0 clones), and CodeScene `analyze_change_set` against `b96b305` passed on 58 files. The digest was `e3b0c442…` before and after.

The runs went one after another on a clean tree:

| Step | Result | Log |
|---|---|---|
| Fresh package | exit 0, 11 s (18:49:35) | `final5-package.log` |
| E5 `pnpm package:launch-smoke` | passed, 40 s | `final5-e5.log` |
| E4 full `pnpm test:e2e` | 26/26, 263 s; its package step rebuilt `out/` at 18:50:35 from the same clean tree | `final5-e4.log` |

**Package check.** The packaged renderer CSS has the three T1 rules: opacity .45 at rest, no box-shadow when not focused, and opacity .7 when focused. It has no `outline-style: none`, so the F3 binding mutant is gone.

## Deep-review fix round (decisions log §61)

Review: `.rpiv/artifacts/reviews/2026-10-11_19-07-31_b96b305-a1fc648-c1-s4-conversation-window.md`. This is the one fix round deep-review allows. The agreed list is recorded in the design's `## Developer Context`, which passes the append-only check against approved copy `e05cac0b…`; the new `content_hash` is `70a66b60…`.

| Finding | Change | Red | Green |
|---|---|---|---|
| I3, Q17 | One flag, `resendable = !readOnly && kept saveId`, now drives both Try again and its wording; `outcomeLine(outcome, withoutTryAgain)` | `dr-i3-red.log`: after the edit, `Received: "…Try again to check it."` | `dr-i3-green.log`, renderer 373/373 |
| I4, Q10 | `.action` keeps layout only (the theme's `.seixo .ghostSm` owns the look; the removed declarations were dead, so nothing visible changes). Under reduced motion, `.seixo .ghostSm` gets `transition-duration: 0s` at the theme's specificity. | `dr-i4-q12-red.log`: transition `0.12s, 0.12s` with Try again (group a) and with Reload (group b) mounted | `dr-step1.log` (motion checks pass) and `dr-green.log` |
| Q12 | The dead `.seixo .statusChip` became `.seixo .toneEdge:is([data-tone="unknown"], [data-tone="failure"])`, and the status row carries `toneEdge`. The token test pins the new selector, and the e2e checks the rendered Unknown row under forced colours. | `dr-step1.log` and `dr-diag.log`: `['unknown', 'none', '0px']` | `dr-green.log`: H2 8/8 |
| Q5 | The theme exposes its tokens through `.seixo, .seixoTokens`; the note strip carries `seixoTokens` and uses `var(--canvas)`, so the `#050606` literal is gone | — (its guard is the S4a strip-seam e2e, which runs in E4) | renderer 373/373 |
| Q23 | `firstOf` and `firstSave` helpers fail by name, replacing the four `as` casts | — | the save-outcomes file passes 64/64 |

**Observed failures and the diagnosis** (no product or timeout change):
- `dr-i4-q12-red.log` (2026-10-11): group f failed with `page.screenshot: Timeout 30000ms exceeded`.
- `dr-step1.log` (2026-10-11 20:12, interrupted by Pedro):
  - group c failed with the same screenshot timeout;
  - test 1 step 6 failed with `Timeout 8000ms exceeded while waiting on the predicate` (height 1660, not 1600);
  - renderer-foundation was killed by the interrupt, so it is not a result;
  - durations were slow: test 1 46 s, b 37 s, c 39 s.
  - The coordinator noted heavy desktop apps were running at that time.
- `dr-diag.log` (2026-10-15, CPU 12 %, temporary timing lines later removed with matching sha256):
  - every group ran at its usual speed: test 1 30.1 s, a 6.9, b 8.2, c 7.6, d 7.6, e 7.3, g 7.7, f 7.2;
  - every forced screenshot took 54–69 ms, zoom 0.5 took 6 ms and zoom 2 took 30 ms;
  - the only failure was the expected Q12 red.
  - **The stalls are attributed to machine load.**
- One renderer full-suite run had a single failure of the CNV-B32 "conflict" row (1211 ms); the next full run passed 373/373 (`dr-renderer-full-2.log`). It is recorded as an intermittent failure under load.
- `dr-green.log` ran with CPU at 39 % before the run.

## Final chain after the deep-review fix round (`66a29a1`)

`a940be8` was amended to `66a29a1`, still the one fix commit with its `Review:` trailer: the new theme import shifted the `workspace-view.tsx` mutate ranges by one line, to 46-58, 82-116 and 122-178. Gates on `66a29a1` passed (`dr-amend-gates.log`).

Each step ran on a clean tree, one after another, with the CPU load logged first:

| Step | CPU before | Result | Log |
|---|---|---|---|
| 1. Targeted `stryker run --force` on the production source changed since `a1fc648` | 24 % | 383 mutants, 2140 s, exit 0: conversation-region 89.66, save-outcome 89.92, status-row 61.22, workspace-view ranges 58.75 | `final6-targeted-stryker.log`, `…/scratchpad/s4b/final6-targeted-66a29a1.json` |
| 2. Fresh package | 16 % | exit 0, 10 s; the packaged CSS has the focus-visible opacity .7 rule and no `outline-style: none` | `final6-package.log` |
| — | 62 % | The chain stopped before E5, by the CPU rule. A spot check a minute later read 4 %; the coordinator allowed a resume from step 3 on the same package, with an averaged reading | — |
| 3. E5 `pnpm package:launch-smoke` on the step-2 package | 27 % (average of 3 readings) | passed, 40 s | `final6-e5.log` |
| 4. E4 full `pnpm test:e2e` | 38 % (average of 3 readings) | 26/26, 284 s, including the S4a strip-seam row (the Q5 guard) | `final6-e4.log` |

**Survivor diff of step 1** against the earlier bases:
- 6 new survivors, all CSS-module class strings (styling): 3 on the status row's `className` with the added `toneEdge`, and 3 on the note strip's `className` with the added `seixoTokens`. The e2e covers them: the Q12 rendered-row edge check (H2) and the strip-seam check (E4).
- Gone: mutant 234, now killed, and the two old single-class strings.
- No real unguarded survivor.

## Re-review fix (decisions log §62, `6add959`)

Review: `.rpiv/artifacts/reviews/2026-10-15_09-38-54_b96b305-cec7422-c1-s4-fix-round-rereview.md`. Pedro chose to fix I1 and Q1 without a further review. One new fix commit, `6add959`, on top of `cec7422` (no amend), with the `Review:` and `Co-Authored-By:` trailers in its last paragraph (both parse).

| Finding | Test | Observed red | Fix | Green |
|---|---|---|---|---|
| Q1 | `conversation-save-outcomes.test.tsx` › "drops the Try again wording when a kept uncertain save returns to a broken load" | `Received: "Not confirmed. The save could not be confirmed. Try again to check it."` (`rr-q1-red.log`) | `resendable` in `conversation-region.tsx` also requires `load.kind !== "failed"`, so the concealed row and Try again share the one condition | renderer 374/374 (`rr-q1-green.log`) |
| I1 (Q2, Q3) | `tests/e2e/renderer-foundation.test.ts` › "captures the region frame for the visual review": the strip's font must equal the shell's, and its colour must follow a `--canvas` override set on the strip | On the `66a29a1` package (CPU 20 %): `stripFont` was the Red Hat Text stack (`rr-i1-red.log`) | `seixo.module.css`: one tokens-only rule for `.seixo, .seixoTokens`; the appearance (box-sizing, background, colour, font, line-height) on `.seixo` alone. The layered `.noteStrip` `background: var(--canvas)` owns the strip colour again | Fresh package and the row (CPU 20 %, `rr-i1-green.log`) |

Notes:
- The token-follow check already passed before the fix, because both owners used the token. The red comes from the font check. The token-follow check guards against a literal colour coming back.
- Visual: in the new note-strip screenshot, the strip band is pixel-identical to the `a1fc648` shot (before `66a29a1`). The only differences start at y = 173, in the per-run project id. So the fix only restores the old strip look, and no screenshots went to ui-ux.
- Design `## Developer Context` entry for §62 appended. It passes the append-only check against `approved-e05cac0b…` and is re-stamped as `content_hash 0457b36e…`.
- Gates on the clean staged tree (`rr-gates.log`): the first `pnpm check` failed on Biome formatting of the new test. After `biome format --write` (formatting only), check passed 2983/2983, with knip, jscpd and the CodeScene pre_commit safeguard passing too.

## Final chain after the re-review fix (`6add959`)

Each step ran on a clean tree, one after another, with the CPU load (average of 3 readings over 10 s) logged first:

| Step | CPU before | Result | Log |
|---|---|---|---|
| 1. Targeted `stryker run --force` on the production source changed since `cec7422` (`conversation-region.tsx`; the CSS is not mutated) | 20 % | 124 mutants, 10 min, exit 0: conversation-region 90.08 (109 killed, 12 survived, 3 ignored) | `final7-targeted-stryker.log`, `…/scratchpad/s4b/final7-targeted-6add959.json` |
| 2. Fresh package | 30 % | exit 0, 12 s | `final7-package.log` |
| 3. E5 `package:launch-smoke` on the step-2 package | 32 % | passed, 49 s | `final7-e5.log` |
| 4. E4 full `test:e2e` | 33 % | 26/26, 301 s, including the extended strip-seam row | `final7-e4.log` |
| 5. CodeScene `analyze_change_set` against `b96b305` | — | passed: 58 files checked, no issues | `final7-codescene-change-set.json` |

**Survivors of step 1**: 10 CSS-module class strings (styling, covered by the e2e) and the `concealed` flag at line 139. Both `concealed` survivors (`ConditionalExpression` false and the `"failed"` string) were already survivors in the `aac55b5` run. The concealed row's visual hiding (D2) is checked by the e2e helper at `tests/e2e/conversation-window.ts:62`. Its Try-again hiding is now also implied by `resendable`. No real unguarded survivor.

**Residual risk**: the `cec7422..6add959` delta (the I1 CSS split, the Q1 condition and their tests) had no independent review. By Pedro's §62 choice, it was fixed without a further review round.

## Pending

- Pedro's Narrator listen and Pedro's acceptance.
- Deep-review and validate over the S4 range `b96b305..final`, then the squash into `main` (decisions log §57). S4a and S4b go to `main` together (G30).
