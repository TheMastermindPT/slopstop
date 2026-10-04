---
date: 2026-10-04
author: coordenador-claude (Claude Code), from the implementer agent's report
repository: slopstop
status: complete
tags: [spike, claude-cli, subscription, waypoint-parent, conversation, worker, viability]
---

# Results: `claude -p` in subscription mode

Brief: `handoffs/2026-10-04_claude-p-subscription-prototype-brief.md`.

## Run conditions

- Claude Code 2.1.289, signed in with a claude.ai Max login, no API key.
- 35 of the 60 budgeted model calls used.
- Synthetic tasks and a scratch repository only. Nothing was committed.
- Deleted afterwards because they held the account email: the raw request bodies (captured with `OTEL_LOG_RAW_API_BODIES`) and the spike session transcripts.

## Summary per role

| Role | Verdict | Main limits |
| --- | --- | --- |
| Waypoint parent | Works | Context not exact (see Q1); daily plan quota unmeasured; an Opus plan takes ~10–19 s and ~1–2k output tokens |
| Conversation | Works as stateless turns with a Ragnarok-owned, capped history | Same injected context; `--resume` cannot cap or edit history, loses history caching, and persists transcripts under `~/.claude` |
| Worker | Works via a PreToolUse hook in `--settings`, plus tests run outside the Worker | Hooks do not run under `--safe-mode`; an attribution reminder is injected |

## Q1: control (partial)

Isolation flags:

```
-p --safe-mode --system-prompt(-file) --tools "" --strict-mcp-config --setting-sources ""
--disable-slash-commands --no-session-persistence
```

Plus the environment variables `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` and `ENABLE_TOOL_SEARCH=false`.

- `--bare` cannot be used here: it reads only an API key and never the OAuth login.
- **Tools off.** The init event and the request both list no tools. With `--json-schema` the only tool is `StructuredOutput`.
- **No user configuration leaks.** No `CLAUDE.md`, memory, hooks, MCP servers, plugins or skills appear. Only the built-in plugins load, and they register 0 hooks.
- **System prompt is replaced, but not fully.** The CLI always prepends one fixed line: "You are a Claude agent, built on Anthropic's Claude Agent SDK."
- **The context is not exact.** With no flag to remove them, the CLI always injects:
  - a `<system-reminder>` carrying the account email;
  - an `# Environment` block with cwd, git status, platform, shell, OS version, model, token budget and date.
- **Fixed format is reliable.**
  - `--json-schema`: 8/8 valid. One run took 3 turns because of an internal retry.
  - Strict-text JSON requested in the system prompt: 5/5 valid.

## Q2: consumption

The dollar figures below are the list prices the CLI reports. A subscription does not bill per call.

| Call | Input tokens | Output tokens | Time | List price |
| --- | --- | --- | --- | --- |
| Minimal (Sonnet) | ~626, almost all injected overhead | 4 | ~3 s | $0.0025 |
| Same, with `--json-schema` | ~1,170 | — | ~7 s | — |
| Realistic parent (Sonnet) | ~2,400 | ~515 | ~4 s | $0.015 first, $0.006 cached |
| Realistic parent (Opus) | ~2,400 | ~950 | ~9 s | $0.038 |

- The prompt cache is reused across calls even without a session (1 h TTL).
- For comparison, a normal Claude Code session sends 260k–490k tokens per call.
- **Plan quota: unknown.**
  - Anthropic publishes no Max token limits.
  - `stream-json` emits a `rate_limit_event` with five-hour and seven-day utilization, in 1% steps.
  - To measure it: run a batch of identical calls with no other Claude session active, and compare utilization before and after.

## Q3: multi-turn (partial)

- `--session-id` then `--resume` keeps history.
- Cache reuse on turns 2 and later is weak. The CLI rewrites its own injected blocks between turns (`cache_miss_reason: messages_changed`), so only a larger system prompt gets cached.
- **Better option: stateless turns.** Use `--no-session-persistence` and send Ragnarok's own capped transcript in the prompt. This gives the same cache benefit as resume, with full control of the history. It also keeps transcripts out of `~/.claude`, as the AGENTS.md rule on runtime data requires.

## Q4: Waypoint parent (yes)

- Schema-valid plans: 8/8 in total (5/5 on Opus). Every plan also passed the semantic checks: it ends with a verifier step and has no dangling dependencies.
- Plan shape is stable: 4 of the 5 Opus runs produced the same 4 steps, and the fifth merged two implementer steps. Only the wording varies.

## Q5: Worker governance (yes, with one constraint)

- **Setup.** A worktree of a scratch repository, with a PreToolUse hook set through `--settings`, `--setting-sources ""`, `--permission-mode dontAsk` and `stream-json`.
- **What happened.**
  - The hook denied `npm test` and allowed Read, Read and Edit.
  - The model adapted and fixed the bug.
  - Ragnarok then ran the tests from outside: 2 passed, 0 failed, 1 line changed.
- **Constraint.** Hooks from `--settings` do not run under `--safe-mode`. Workers must rely on `--setting-sources ""` instead. A leak check found no user configuration under this setup.

## Open items

- **Terms, a user decision.** Whether Anthropic's subscription terms allow a third-party tool to drive `claude -p` this way. Opening Ragnarok to the public needs written confirmation from Anthropic.
- **Daily plan quota.** Needs a measurement with no other Claude session running.
- **Unexplained ~4 s** of extra wall time with `--json-schema`.
- **No off-switch found** for the email and environment injection.
- **Not tested:** whether `--setting-sources ""` without `--safe-mode` also gives a clean parent or Conversation context. Likely yes, given the Worker leak check.
