---
date: 2026-10-07
author: coordenador-claude (Claude Code), for Pedro Mesquita
topic: "Ideas from oh-my-pi and Prime Agent for SlopStop"
tags: [research, inspiration, agent-harness, oh-my-pi, prime-agent]
status: complete
---

# Ideas from oh-my-pi and Prime Agent for SlopStop

## Scope

- **oh-my-pi (`omp`)**, a fork of Mario Zechner's pi by can1357, described as a "coding agent with the IDE wired in".
  - Source: https://github.com/can1357/oh-my-pi.
  - Local copy studied: `C:\Users\pedro\Downloads\oh-my-pi-main`.
- **Prime Agent**, Prime Intellect's "self-improving RLM agent", also built on pi. It uses a Rust core with a Python runtime.
  - Source: https://github.com/PrimeIntellect-ai/prime-agent.
  - Local copy studied: `C:\Users\pedro\Downloads\prime-agent-main`.
- **Method:**
  - Exa web search for both projects.
  - Two read-only code studies, one per repository, comparing each idea with PRODUCT.md, CONTEXT.md and the ADRs.
  - "Verified" means the mechanism was read in source. "Doc" means it was read only in the README, docs or module headers.
- This is inspiration, not a contract. Nothing here changes an accepted design.

## Verdict

Neither project is a model for SlopStop's governance.
- Both let the model change state on its own: Prime auto-applies `/refine` edits; omp defaults to `yolo` approvals and forces it on subagents.
- That conflicts with "model output only proposes; user decisions are durable typed records".

The value is in small, deterministic mechanisms that fit SlopStop's existing rules.

## Adopt first (small effort, strong fit)

1. **Model proposes a partition, code validates it, the user confirms** (omp, verified).
   - `omp commit` rejects a split plan if a file is unstaged, duplicated, in two commits, or missing. Kahn topological sort rejects cyclic or out-of-range dependencies. The user then confirms before execution.
   - Paths: `packages/coding-agent/src/commit/agentic/{tools/split-commit.ts,topo-sort.ts,validation.ts}`.
   - SlopStop use: validate a Delegation plan proposal before the user sees it (each in-scope path owned by exactly one Worker, acyclic task DAG). The same check could split an integrated Candidate into atomic commits.
2. **No rerun of a failed gate on an unchanged workspace** (Prime, verified).
   - A failed quality gate stores a git snapshot. An identical snapshot on retry gives "not rerun: workspace unchanged" and counts as a retry.
   - Outcomes are a closed set: `Passed`, `Failed`, `RetryExhausted`, `LimitReached`, `MissingTerminalEvidence`.
   - Path: `crates/pa-core/src/autonomous/gates.rs`.
   - SlopStop use: Worker check loops (ADR 0012) and budgets, keyed on the Run-workspace fingerprint (ADR 0010); "not rerun" becomes a typed observation.
3. **"Outcome unknown" for interrupted tool calls** (omp, verified).
   - A start marker is persisted before each tool call and an exit marker at teardown. On resume, unpaired calls get a synthetic "outcome is unknown" result plus a warning.
   - Path: `packages/coding-agent/src/session/exit-diagnostics.ts`.
   - SlopStop use: the transcript-side counterpart to ADR 0013 `EFFECT_UNCERTAIN`; follows `degrade-distinguishes-broken`.
4. **Typed vetoes for reviving crashed work** (Prime, verified).
   - A dead worker is relaunched only if all four vetoes pass: supervisor gave up, archived, live lease elsewhere, stale busy evidence (with a clock-skew guard). Uncertainty never revives.
   - Paths: `crates/pa-daemon/src/revival_gate.rs`, `lease.rs`.
   - SlopStop use: a paused or stopped Run never returns through automatic recovery (ADR 0005, 0008, 0013).
5. **Edit only what was seen; snapshot-tagged edits** (omp "hashline", verified).
   - Reads tag each file with a content hash. Edits must cite it. `enforce_seen_lines` rejects edits to unseen lines. A stale tag is recovered only when the snapshot chain proves a unique result.
   - Paths: `crates/pi-edit/src/{store.rs,session.rs,modes/hashline/*}`.
   - SlopStop use: a seen-lines ledger enforced at the `claude -p` PreToolUse hook (ADR 0009), and stale-safe edits for other adapters.
   - Effort: S for the check, L for a full edit tool.
6. **Mandatory typed terminal result for subagents** (omp, verified).
   - A child must finish through a hidden `yield` tool with a schema. Three reminders, then the tool choice is forced.
   - Paths: `packages/coding-agent/src/task/{executor.ts,structured-subagent.ts}`.
   - SlopStop use: Worker results as strictly decoded envelopes. Use strict mode only.
7. **Scripted fake provider for end-to-end tests** (Prime, verified).
   - The real binary runs with a JSON script of model replies in an isolated home directory.
   - Paths: `crates/pa-ai/src/providers/faux/`, `crates/pa-cli/tests/eval_composition_e2e.rs`.
   - SlopStop use: deterministic Electron journeys through the ADR 0009 adapter seam without calling `claude -p`.
   - No scripted provider exists in `apps/harness/src` today. Most useful before Conversation C1.

## Later (medium effort, good fit with changes)

- **Streaming rule enforcement, TTSR** (omp, verified).
  - Regex and ast-grep rules abort generation on a match, inject a reason and retry.
  - Paths: `packages/coding-agent/src/session/ttsr-coordinator.ts`.
  - SlopStop: deterministic rules at the PreToolUse boundary; each hit becomes a typed observation or Finding. Do not copy the model-judged rules.
- **Advisor with an emission guard** (omp, verified).
  - A second model reviews only the transcript delta and emits `nit | concern | blocker`. Code enforces dedupe, filters content-free notes and caps volume. Their incident: 309 notes, 92 unique.
  - Path: `packages/coding-agent/src/advisor/emission-guard.ts`.
  - SlopStop: an admission guard for any model-to-Board channel; advice stays a proposal or Finding, with no mutating tools.
- **Remediation routed by file ownership** (omp "cleanse", verified).
  - Checker output from tsc, biome, eslint and 26 other formats is normalized and deduplicated. Each file is owned by one repair worker. A final verify pass dispatches nothing.
  - Paths: `packages/coding-agent/src/cleanse/*`.
  - SlopStop: ADR 0014 remediation; the parsers feed Evidence evaluators, never Evidence directly.
- **Summary of an abandoned conversation branch** (omp, verified).
  - Path: `packages/agent/src/compaction/branch-summarization.ts`.
  - SlopStop: offered as a Context proposal the user accepts or edits, never injected automatically.
- **Normalized subscription usage windows** (omp, verified types).
  - Claude 5h and 7d buckets, with a separate `unknown` status.
  - Path: `packages/ai/src/usage.ts`.
  - SlopStop: budget admission before dispatching Workers.
- **Reversible secret placeholders in provider traffic** (omp, code present; detail from docs).
  - Path: `packages/coding-agent/src/secrets/*`.
- **Memory Proposal cadence and noise filter** (Prime, verified).
  - Triggered after compaction or every 25 turns, with a cooldown. A cheap review rejects one-off noise. Optimistic concurrency at apply time.
  - Path: `crates/pa-core/src/refinement/*`.
  - SlopStop: queue proposals for the user (ADR 0017); never auto-apply.
- **Rollback as a new inverse decision** (Prime, verified).
  - Before and after copies; the rollback is a new entry with `rollbackOf`, so history is never rewritten.
  - SlopStop: undo a Memory or Capability decision as a superseding user decision.
- **Deterministic, fingerprinted memory digest at cold points** (Prime, verified).
  - Path: `crates/pa-core/src/refinement/ranking.rs`.
  - SlopStop: reproducible choice of trusted Memory Revisions for a Sealed invocation.
- **Other smaller items:**
  - fresh-only LSP diagnostics after each write (omp `lsp/diagnostics-ledger.ts`; model feedback only, never ADR 0016 Evidence);
  - forge-proof reserved message kinds (Prime `child_status_notices.rs`);
  - a fixed error classification that sends no raw provider text (Prime, doc);
  - untrusted-objective wrapping and a structured wrap-up when the budget runs out (Prime `goals.rs`);
  - a mutation-generated edit benchmark to measure language-intelligence value (omp `typescript-edit-benchmark`, ADR 0003).

## Do not copy

- **Self-modifying harness that applies itself** (Prime `/refine`, on by default).
  - Its "evidence" is a free-text rationale, weaker than the README claims. Conflicts with ADR 0017.
- **`yolo` approval defaults and forced `yolo` for subagents** (omp `task/executor.ts`).
- **Agent-curated memory without user acceptance** (omp learn/autolearn; Prime auto-refine).
- **Peer-to-peer agent messaging and waking siblings** (Prime).
  - Conflicts with non-nesting Workers and parent-mediated delegation.
- **Code kernels that call the agent's tools from inside code** (both).
  - Hides individual tool calls from typed records, approvals and Evidence lineage.
- **Corrupt state loaded as empty** (Prime `load_harness_state`).
  - Violates `degrade-distinguishes-broken`.
- **The model choosing a lesson's scope** (local or global).
- **Continuation prompts that "make a reasonable assumption"** (Prime autonomous mode).
- **Auto-loading foreign configs, extensions, hooks and MCP; pseudo-path write schemes** (omp).
- **Sheer scope:**
  - omp: 60+ providers, about 80k lines of Rust, browser control;
  - Prime: a roughly 100-file daemon stack.

## Not verified

- **omp:** the claimed 61% token saving; `willRenameFiles` behaviour; DAP; ACP; provider and tool counts.
- **Prime:** the skill creator; heartbeats and cron; the full trust model; compaction internals; the factory run engine beyond validation.
