---
date: 2026-10-04
author: ui-ux (Claude), for Pedro Mesquita
status: draft for user review
tags: [ui, ux, prototype, pc-s1, throwaway]
---

# PC-S1 "Add existing repository" — throwaway prototype

Static HTML/CSS/JS. No build, no dependencies. Open `index.html` in a browser.
It answers one question: **are the steps, wording, states and keyboard/focus flow clear?**
Visual style copies the current provisional carbon/graphite tokens from the renderer prototype; it is not a visual identity proposal.

Files: `index.html` (shell + controls), `styles.css`, `flow.js` (state switching only), `README.md`.

## How to use

- The purple dashed strip at the top is **prototype controls**, not app UI: platform (Windows/Linux), saved-Projects state (listed, empty, busy, broken), *Jump to screen*, *Show wording questions* (adds `Q#` tags next to the text the questions below refer to) and *Reset*.
- **Add existing repository** opens a placeholder for the native Windows folder dialog. Each folder in it simulates one case (its label says which). Cancel/Esc there simulates closing the system dialog.

## Screens and states covered

| # | Screen | What it shows |
|---|---|---|
| 1 | Projects list + **Add existing repository** | Entry button with a one-line hint. Cancelling the folder dialog changes nothing and returns focus to the button. |
| 2 | **Trust decision** (step 2 of 5) | Names the selected folder (name + exact path). Explains Git reads `.git` and local configuration, including includes outside the folder. Warning: this version does not protect against hostile configuration; an include can make Windows reach a network location. Actions: *Trust and continue* / *Cancel*. Footnote: applies only to this folder. |
| 3 | **Git stage 1** | Exact absolute `git.exe` path, the single command `git --version`, "nothing in the repository is read yet". Option to choose a different Git program (placeholder dialog). Busy state while it runs. |
| 4 | **Git stage 2** | Same executable + observed version + where it runs. Lists the six exact `git rev-parse` queries (taken from the implementer's `identity-query-child.ts`) each with a plain-language meaning. *Allow 6 queries* / *Cancel*. |
| 5 | **Preparing → Proposal → Confirm** | Live 1-of-6 progress, then a summary (Project name, folder, working tree, Git), "what confirming does", "checks again just before creating", busy state on confirm. |
| 6 | **Outcomes** | Registered (Project appears in list with *New*); worktree of existing Project (exact brief text, nothing created); **already registered** (same folder again returns the existing Project, action *Open*, no duplicate); incomplete/interrupted (shown in list as "Registration incomplete — recovery required", no recovery action); not found; inaccessible; inside a `.git` folder; bare repository; Git could not read the folder (`GIT_QUERY_FAILED`); drive without stable identity (network/virtual, `IDENTITY_CAPABILITY_UNAVAILABLE`, only known **after** picking the folder); Git changed → confirm again; Git unavailable; registry busy on confirm (retry). |
| — | **Linux** | The OS is known at start-up, so *Add existing repository* is disabled **before** the folder dialog, with the reason under it (still focusable, so screen readers hear why). |
| — | **List states** | Registry busy (amber, "use Refresh in a moment") vs registry broken (red alert, "nothing was changed or reset", Add disabled with reason). Neither is ever shown as an empty list. |
| 7 | **Remove from list** (user decision 2026-10-04: option A only) | Each list entry has a *Remove* action. Disabled for the open Project with a visible reason ("Open now. Switch to another Project first to remove it."), and for an incomplete registration ("Needs recovery; it stays visible until recovered."). Confirmation in the workspace (not a modal) says: it leaves the list; Ragnarok data stays saved; the repository is not changed; adding the same folder again brings the same Project back, not a copy. Failures: registry busy (retry, list unchanged) vs registry broken (distinct, nothing removed/changed/reset). Re-adding the folder shows "*name* is back in your list". Deleting data (option B, ADR 0018) is **not** included. |

Each outcome has a status word + icon + colour (never colour alone), a plain title, what to do next, a "Nothing was created" line where true, and no raw Git output or full local paths in errors.

## Keyboard and focus model (to judge)

- Every new step moves focus to its **heading**, not to the primary button, so Enter cannot accidentally trust or allow something. Tab then goes: content → primary → Cancel.
- **Esc = Cancel** on every decision step. Running steps (version check, six queries, confirm) cannot be cancelled and say so.
- Cancel returns focus to **Add existing repository** and shows a short note saying exactly what did or did not run (e.g. "Cancelled. Git only read its own version; no repository query was run.").
- Outcome actions move focus deliberately: *Show ragnarok-effect* focuses that Project in the list; *Choose another folder* reopens the dialog.
- Selection, trust and Git approval are separate decisions. Trust (D6) is **always per folder**. Git approval (D8) is bound to the executable's physical identity: a second folder skips both Git steps (the trust screen says which Git will be used) until the executable changes; a replacement invalidates both stages.
- **Remove:** *Remove* opens the confirmation with focus on its heading. Esc/Cancel returns focus to that entry's *Remove* button. After removing, focus goes to the next entry (previous one if it was last), or to *Add existing repository* if the list is empty. Failure screens: Esc / *Back to Projects* also return focus to that *Remove* button.
- Status changes are announced through a polite live region.

Verified in Chromium (Playwright, 1366×860 and 390×844): focus lands as described for add and remove (including blocked, busy, broken, re-add and empty-list cases), no console errors, no horizontal scroll.

## Open wording questions (for the user)

- **Q1** Hint under the button: "Choose a Git repository folder on this computer." Useful, or remove?
- **Q2** Trust heading as a question ("Do you trust this repository?") vs a statement ("Trust this repository before continuing").
- **Q3** Warning text: "This version doesn't protect against a hostile Git configuration. An include … can make Windows connect to a network location, such as a shared drive." Clear enough? Too alarming?
- **Q4** "This decision applies only to this folder. Choosing another folder asks again." Keep visible?
- **Q5** Offer "Choose a different Git program…" on stage 1, or only show the detected one?
- **Q6** Show the six raw `git rev-parse` commands with plain meanings, or only the plain meanings (commands behind a "Show commands" toggle)?
- **Q7** Button "Allow 6 queries" vs "Allow and identify".
- **Q8** "Confirm registration" vs "Add Project".
- **Q9** Show the stable code ("Reference: REPOSITORY_NOT_FOUND") under errors, or hide it?
- **Q10** Worktree text is the exact brief wording; action "Show ragnarok-effect". OK?
- **Q11** Incomplete: "this repository stays blocked for now. Nothing was deleted." Is "blocked" right?
- **Q12** Cancel note ("Cancelled. Nothing was run.") — reassuring, or noise? Brief only requires it for nothing to change.
- **Q13** "Git's own messages are not shown here." — explain why there is no detail, or leave it out?

- **Q14** (wording) Linux reason under the disabled button: "Not available on Linux in this version. Adding repositories works on Windows only."
- **Q18** Reason under the open Project: "Open now. Switch to another Project first to remove it."
- **Q20** Re-add: "chess is back in your list. This folder was already registered, so Ragnarok brought back the same Project with its saved data."
- **Q21** Confirmation heading "Remove chess from the list?" + the four lines (leaves the list / data stays saved / repository not changed / adding again brings it back).
- **Q22** Button "Remove from list" vs "Remove". The list action is the short "Remove"; the confirm button repeats "from list" so it is never read as delete.
- **Q17** (wording) "ragnarok-effect is already registered. This folder already belongs to Project ragnarok-effect. No second Project was created." + *Open ragnarok-effect*.

## Product questions — answered by the coordinator (2026-10-04)

- **Q23** An incomplete / recovery-required registration **cannot** leave the list: it is the only visible sign of a stuck reservation and recovery does not exist yet; hiding it would make a broken state look clean (standing decision `degrade-distinguishes-broken`). Action shown disabled with reason "Needs recovery; it stays visible until recovered."
- **Q24** Bringing a removed Project back goes through the folder trust decision and the six queries (fresh physical identity); if it matches the existing Project it returns as `already-registered` with "*name* is back in your list", **without** *Confirm registration* (creates nothing, reversible).

- **Q14** OS is known at start-up → Linux (out of PC-S1, B4) is explained before the folder dialog with a disabled action and reason. Volume capability (network/virtual drive, no birth identity) is only known after selection → explicit `IDENTITY_CAPABILITY_UNAVAILABLE`. Both cases shown.
- **Q15** Git approval (D8) is bound to the executable's physical identity, valid across folders until it changes; replacement invalidates both stages. Trust (D6) is always per folder. Prototype matches.
- **Q16** Not in the contracts → user decision. **Closed 2026-10-04: the user approved the worktree root folder name as the default Project name, not editable in PC-S1.**
- **Q17** In scope: D5 `already-registered`, PC-B2/B3 require repeating the same folder to return the existing Project without duplicating. Shown as "already registered" with an *Open* action.
