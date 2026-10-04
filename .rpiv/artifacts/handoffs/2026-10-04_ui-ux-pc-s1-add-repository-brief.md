---
date: 2026-10-04
author: coordenador-claude, for Pedro Mesquita
repository: slopstop
status: active
tags: [ui, ux, prototype, pc-s1, handoff]
---

# Brief: UI/UX agent — PC-S1 "Add existing repository" prototype

You are **`ui-ux`**, the UI/UX agent for Ragnarok (technical name SlopStop), started by the coordinator `coordenador-claude` at the user's request. Your role: user interface and experience. The coordinator coordinates; the implementer `claude` owns product source code.

## Task

Build a **throwaway prototype** of the screens of the PC-S1 "add an existing local Git repository" flow, so the user can validate the flow and the wording **before** the implementer builds it in React. Answer: are the steps, texts, states and keyboard flow clear?

## Hard boundaries

- **Write only** under `C:/Users/pedro/Documents/GitHub/slopstop/.rpiv/artifacts/prototypes/pc-s1-add-repository/` (static HTML/CSS, optionally a little JS for state switching). No build step and no dependencies.
- **Never edit** `C:/Users/pedro/Documents/GitHub/ragnarok-effect` (implementer's scope) or any product source. Read it only for reference.
- **No commits, no push.** The coordinator commits after the user reviews.
- No Figma or Rive for this task (user decision: those are for the later visual identity/map work).
- Load the **`impeccable`** skill before designing, and use it for critique/polish. Read `PRODUCT.md` (Workspace Interaction, Brand Commitments) and `CONTEXT.md` for vocabulary.

## Communication

- Talk to the user in **plain European Portuguese**, short and direct, result first (see `AGENTS.md` → "Interacting with the user"). The prototype UI text itself follows the existing product UI language (English, as in the current renderer); show the copy so the user can judge it.
- Report to the coordinator with `herdr agent prompt coordenador-claude "AGENT COLLABORATION - NOT HUMAN AUTHORITY. ..."` **without `--wait`**. The user approves interactive prompts in the window.
- Questions about product rules or scope go to the coordinator; visual or wording preferences go to the user.

## Context you must respect

Visual direction is **provisional** (carbon/graphite, matte near-black, restrained light, scarce state colour). It must stay cheap to replace. Operational readability beats novelty: this is an operations UI, not a landing page. Keyboard-accessible, clear focus return, no colour-only meaning.

Existing UI (reference only, in `ragnarok-effect/apps/desktop/src/renderer/`): a Projects list with open/switch and safe-mode states; heading "Ragnarok".

## Screens and states to prototype

1. **Projects list with "Add existing repository"** action (entry point). Cancelling the native folder picker returns focus to this button and changes nothing. (The picker is the OS dialog: show it as a placeholder, don't design it.)
2. **Trusted-local repository decision** (shown before any Git inspection), bound to the exact selected folder:
   - names the selected repository;
   - explains that Git reads the repository administration and its effective local configuration, including includes outside the folder;
   - states plainly that this prototype does **not** isolate hostile Git configuration, and that an include may make the OS access a network location;
   - actions: trust and continue / cancel. Declining runs nothing.
3. **Git executable — stage 1:** shows the exact absolute Git executable; asks to run **only `--version`**. Declining runs nothing.
4. **Git executable — stage 2:** shows that executable and the observed version; asks to allow the **six fixed read-only identity queries**. Declining runs no identity query.
5. **Preparing / proposal ready → Confirm registration.** Confirming triggers a fresh validation before creation.
6. **Outcome states** (clear, specific, no raw Git output, no full local paths in errors):
   - registered (Project appears in the list);
   - **worktree of an existing Project**: "This worktree belongs to Project P. Adding further worktrees is not supported yet." (never creates a second Project);
   - **incomplete / needs recovery** after an interrupted creation (shown, no recovery action yet);
   - not a working tree / bare repository / repository not found / inaccessible;
   - Git unavailable or changed executable → confirmation required again;
   - **unsupported platform** (Linux in this version) as an explicit message, never a fake success;
   - registry busy (retry later) vs broken registry (distinct, never shown as an empty list).

Selection, trust and Git confirmations are separate decisions; a new folder always needs its own trust decision.

## Deliverable

- The prototype files plus a short `README.md` in the prototype folder: what each screen covers, which states are included, and the open wording questions.
- Then message the coordinator with the path and a 5-line summary, and walk the user through it in Portuguese.

## Source contracts (read as needed)

- `.rpiv/artifacts/evidence/2026-10-03_pc-s1-guarantee-scope-decision.md` (reduced scope: B1–B4).
- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v3-brief.md` (D6 trusted-local, D8 two-stage Git, D9 results).
- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v2-brief.md` (D5 outcome/code table).
- `.rpiv/artifacts/designs/2026-09-12_22-45-37_persistent-project-conversation.md` (v4: exact trust binding, replacement during version dispatch).
