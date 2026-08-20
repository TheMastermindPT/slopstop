# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

SlopStop is delivered as a Windows-first, cross-platform Electron desktop application. Its interface uses web technology, while operating-system and repository capabilities remain behind strict process boundaries.

## Stack

Electron, React, TypeScript, CSS Modules, pnpm workspaces, and a separate TypeScript harness utility process.

## Users

The first user is one developer working locally across Git repositories. They need to supervise several bounded agent sessions while understanding what each session is doing, why work is blocked, and which evidence supports its claims.

## Product Purpose

SlopStop combines continuity and verified memory, visible multi-agent coordination, and non-linear project control. It lets work branch, pause, reopen, and evolve without forcing every task through one fixed pipeline.

Success means the developer can steer concurrent Waypoint work, inspect durable evidence and decisions, recover safely after interruption, and trust that failed or unknown checks never appear clean.

## Positioning

SlopStop treats project intent, execution attempts, and model conversations as separate graphs. A deterministic application coordinator owns canonical project truth while resumable AI parents supervise bounded, non-nesting workers.

## Operating Context

- Local Git repositories are the implementation workspaces and historical evidence source.
- One project is active at a time; many projects may be saved.
- A Project is visualized as a galaxy, Features as star systems, Waypoints as planets, and active parents/workers as satellites.
- The initial actions are Frame, Research, Implement, and Validate, but they are capabilities rather than mandatory stages.
- The user approves delegation plans, permissions, workspace mode, model changes, and integration actions.

## Capabilities and Constraints

- Project state, boards, revisions, evidence, memory, approvals, and recovery records are local-first.
- Electron renderer code receives no unrestricted Node access.
- The harness runs in one supervised utility process per desktop application.
- Mastra is the first agent runtime behind a project-owned adapter and is added only when its first behavior is implemented.
- Canonical and Mastra persistence use separate local libSQL databases with Drizzle-owned canonical migrations.
- Test-first preferred is the default discipline. Behavior uses red-green at an agreed public seam, followed by a separate review/refactor gate.
- Workers do not nest. Repository reads that become evidence, mutations, commands, analyzers, Git operations, and external effects belong to attributed workers.
- Automatic model fallback, silent isolation downgrade, and failure-to-clean degradation are prohibited.
- Live debugger implementation follows the first resilient proof; its safety seam is designed earlier.

## Brand Commitments

The product name is SlopStop. The final visual identity is deliberately open and will be selected through explicit variants. The foundation shell may use a provisional technical-cartography direction, but it must remain cheap to replace.

## Evidence on Hand

- `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md`
- `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md`
- `.rpiv/artifacts/discover/2026-08-14_16-18-18_lsp-debugger-refinement.md`
- `.rpiv/artifacts/research/2026-08-14_12-09-42_custom-coding-harness-options.md`

No customer claims, benchmarks, release claims, final brand assets, or final visual system exist yet. Future work must not fabricate them.

## Product Principles

- Durable application state outranks model conversation state.
- Every side effect is attributable, bounded, and recoverable without touching unrelated user work.
- Evidence and failure states remain explicit; unknown is never presented as clean.
- Rich visual control always has a keyboard-accessible and plain-text equivalent.
- Frameworks remain behind project-owned boundaries so measured requirements can replace them.

## Accessibility & Inclusion

Every map, Decision Canvas, board, approval, memory, evidence, and supervision interaction requires a keyboard-accessible and plain-text equivalent. Status must use text, shape, icon, and motion in addition to color. Reduced-motion behavior is required.
