---
date: 2026-10-03
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
status: active
tags: [metrics, baseline, dogfooding]
---

# Baseline measurement log — work before Ragnarok

User decision (2026-10-03): measure a baseline now, with the current manual method (Herdr + existing agent CLIs), so later Ragnarok runs on equivalent work can be compared. First baseline project: `C:/Users/pedro/Documents/GitHub/chess` (personal chess coach, spec complete, no code). MaxReps (the v1 proof scenario in earlier research) is the user's gymapp project and remains the later comparison candidate.

Metrics follow `research/2026-10-03_product-thesis.md`. Keep each entry to five lines; no extra ceremony.

## Entry template

```
### <date> — <project> — <task in one line>
- Method: <manual Herdr / agents used>
- "Não era isto" corrections: <count> (one-line examples)
- Time to usable result: <wall-clock>, human attention: <approx.>
- Resumptions: <count>, cost: <what had to be re-read or re-explained>
- Defects after integration: <count / not yet known>
```

## Entries

### 2026-10-03 — slopstop — coordination handoff and application.db checkpoint (reference, not chess)
- Method: manual Herdr; OpenCode coordinator → Claude coordinator, Claude implementer.
- "Não era isto" corrections: 4 at handoff teach-back (SQL in worker "not approved now" vs forbidden; skills timing; conditional merge; pre-existing ≠ waiver).
- Time to usable result: handoff ≈ 20 min to confirmed transfer; human acted as router for every message.
- Resumptions: 1 coordinator handoff, cost: 363-line handoff document plus teach-back exchange.
- Defects after integration: not applicable (no integration); independent review found R-1 before package proof.
