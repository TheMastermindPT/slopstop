---
date: 2026-10-04
author: coordenador-claude (Claude Code), for the implementer agent
repository: slopstop
status: approved-to-run
tags: [spike, claude-cli, subscription, waypoint-parent, conversation, viability]
---

# Spike brief: can `claude -p` serve Ragnarok in subscription mode?

Decision context: `research/2026-10-04_agent-runtime-options-discussion.md` (section "Decisão do utilizador: um só modo de pagamento"). The answer feeds the user's viability decision. This is a disposable prototype: no product code, no ADR change.

## Questions, in priority order

1. **Control for Waypoint parent and Conversation.** Can one `claude -p` call run with:
   - Ragnarok's own system prompt (replacing, not appending to, the default);
   - every tool disabled;
   - no `CLAUDE.md`, memory, hooks, MCP servers, plugins or skills from the user's setup leaking in;
   - output in a fixed format that Ragnarok validates (JSON schema or strict text), with the failure rate measured;
   - a context Ragnarok knows exactly?
   For each requirement, record the flag or setting that achieves it, and the evidence that it worked (for example, the init event listing tools, MCP servers and memory files).
2. **Consumption.** For a minimal call and for a realistic call, record:
   - input, output and cache tokens, plus the cost the CLI reports (`--output-format json` / `stream-json`);
   - the hidden overhead, i.e. tokens present when Ragnarok sends almost nothing;
   - latency.
   Estimate how many parent and Conversation calls a day fit in the user's plan limit, stating the assumptions.
3. **Multi-turn Conversation.** Resume a session by id across calls:
   - is history kept;
   - is the cache reused (cache-read tokens on turn 2+);
   - can Ragnarok cap or replace the history?
4. **Waypoint parent scenario.**
   - Input: a small task description plus repository facts.
   - Output: a plan in a fixed schema (steps, Worker assignment, acceptance checks).
   - Run it 5 times and report schema validity and how much the plans vary.
5. **Secondary, only if 1–4 finish within the timebox: Worker governance.** In a throwaway worktree of a scratch repository (not slopstop):
   - run `claude -p` with `stream-json`;
   - approve or deny one tool call through a hook Ragnarok controls;
   - after the Worker finishes, run that repository's tests from outside the Worker.

## Rules

- **Billing and credentials.**
  - Use the user's existing Claude Code subscription login.
  - No API key.
  - Never print or log credentials or tokens from the credentials store.
- **Where the work lives.** Spike code goes in a scratch folder outside every repository. It is never committed to slopstop. Results come back to the coordinator, who records them in the main repository.
- **Call budget and data.**
  - At most ~60 model calls in total.
  - Use small prompts.
  - Send no private source or secrets: use synthetic tasks and the scratch repository.
- **Sources.** Verify every flag against `claude --help` and the current official Claude Code documentation (Context7 or the docs site). Do not trust memory.
- **Timebox and checkpoint.** About one working day. Report after question 2 with an interim result.
- **The other repository.** Do not touch the slopstop worktree `ragnarok-effect` beyond reading. The libsql crash investigation is parked.

## Report format

For each question:
- **Answer:** yes, no or partial.
- **Evidence:** the command, plus a redacted output excerpt.
- **Numbers.**
- **Known and unknown.**

At the end, list what blocks or enables subscription mode for each of the parent, Conversation and Worker roles.
