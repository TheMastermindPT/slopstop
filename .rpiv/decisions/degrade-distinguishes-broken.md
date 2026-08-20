---
key: degrade-distinguishes-broken
status: accepted
scope: standing
rule: "A degrade-to-clean/absent branch must never swallow a genuine failure (parse error, broken invocation, dropped candidate); every broken case emits a distinct diagnostic and never reports as clean — especially on a gate another skill trusts."
decided: 2026-07-23
updated: 2026-07-23
author: Pedro Mesquita
source: .rpiv/artifacts/plans/2026-07-23_00-15-31_shared-and-ar-helpers-hardening.md
---

# Decision: A degrade path must distinguish "absent" from "broken"

## Context

The 2026-07-21 architecture review found three sites where the helpers' "always exit 0, degrade gracefully" contract also swallowed genuine failures into the same signal as absence: the `ready` artifact gate could flip green on a broken `--check` invocation (silent exit 0), one swallowed AST exception silently disabled the whole dead-code lens, and a corrupt `package.json` probed identically to no manifest.

## Decision

The "always exit 0, degrade gracefully" contract is correct for *absence* (a tool/report/manifest isn't there). It is wrong when it also swallows *failure* (a parse error, a broken invocation, a dropped candidate) into the same clean/absent signal. Every degrade branch must emit a distinct diagnostic for the broken case and must not let a failure masquerade as "clean" — especially on a gate another skill trusts.

## Consequences

Best-effort telemetry, cleanup, feature-detection, and documented degrade-to-default where absence IS the signal stay as they are. Swallows on write/gate paths, parse failures reported as empty results, and completeness checks that read "block present" as "block complete" must be fixed on sight. New degrade branches carry the distinct-diagnostic requirement from day one.

## History
- 2026-07-23 accepted — promoted from the shared+AR-helpers hardening plan (methodology principle M2 of the 2026-07-21 architecture review). source: .rpiv/artifacts/plans/2026-07-23_00-15-31_shared-and-ar-helpers-hardening.md
