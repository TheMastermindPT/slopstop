---
date: 2026-08-26T18:25:37+01:00
author: Pedro Mesquita
researcher: OpenCode
repository: slopstop
branch: decision/ticket-77-artifact-retention
commit: 3fb07604b406
topic: "Measured Artifact-retention threshold basis for issue 77"
status: complete
last_updated: 2026-08-26T18:25:37+01:00
last_updated_by: Pedro Mesquita
source_issue: https://github.com/TheMastermindPT/slopstop/issues/77
tags:
  - research
  - ticket-77
  - artifact-retention
  - capacity
  - measurement
content_hash: 65e2300ea92cdce5fb9b0e24619d922e34624c5896f456818581642385166fd7
---

# Ticket 77: Artifact-Retention Threshold Basis

## Research Question

What measured local evidence supports the accepted Artifact-retention thresholds, and how confident may ADR 0018 be before production Artifact workloads exist?

## Conclusion

The accepted thresholds are useful safety guardrails but are not calibrated workload limits. The repository contains no Project database or implemented Artifact store from which representative Artifact size, count, hold duration, reservation accuracy, or removal behavior can be measured. Repository size and current volume capacity provide only sanity checks.

ADR 0018 must therefore label `0.1.0-local-balanced` as immutable, provisional, and low-confidence. Later measured use must create a new profile rather than rewriting this one.

## Accepted Guardrails

| Dimension | Attention | Hard admission |
| --- | ---: | ---: |
| Project logical bytes | 8 GiB | 10 GiB |
| Installation physical bytes | 24 GiB | 30 GiB |
| Project Artifact IDs | 40,000 | 50,000 |
| Installation Artifact IDs | 200,000 | 250,000 |

The volume floor is `max(2 GiB, 2% of volume capacity)`. Generated output becomes eligible after 30 hold-free days and receives age Attention after 90 hold-free days.

## Local Measurements

Measured from commit `3fb07604b406` on 2026-08-26:

| Probe | Result | Interpretation |
| --- | ---: | --- |
| Tracked files | 159 | Repository shape only |
| Tracked Git blob bytes at commit | 2,082,230 | Not Artifact workload evidence |
| Loose Git objects | 682 | Repository history only |
| Loose Git object size | 2.96 MiB | Not Artifact-store physical use |
| Packed Git objects | 0 | No pack-based comparison available |
| Local `.db` or SQLite files | 0 | No production Project or Artifact data exists |
| Observed C: capacity | 510,457,335,808 bytes | One development machine only |
| Observed C: free bytes | 17,495,691,264 bytes | Volatile point-in-time value |
| Two-percent floor | 10,209,146,717 bytes | Greater than the fixed 2 GiB floor |

On this observation, the percentage floor was about 9.51 GiB. Only about 6.79 GiB remained above that floor, so the floor would block further production before this machine could newly consume the nominal 30 GiB installation allowance. That precedence is intentional but not representative of other machines.

## Evidence Gaps

No current measurement establishes typical or worst-case Artifact size, count per Run or Project, physical-to-logical ratio, deduplication, reservation error, daily growth, hold duration, age distribution, proposal decisions, reclaimed physical bytes, multi-Project pressure, or filesystem allocated-size behavior.

Confidence in the exact thresholds is `low`. Confidence in the safety shape is higher: separate warning and hard levels leave reaction space; Project and installation scopes protect different failures; byte and identity limits cover different growth; reservations close check-then-write races; the free-space floor protects the host; and explicit removal prevents quota pressure from destroying Evidence.

## Recalibration Requirement

Keep `0.1.0-local-balanced` provisional until both are available:

- 90 days of representative local use.
- 10,000 terminal Artifact productions with settled reservations and complete usage observations.

The next profile must use measured p50, p95, and p99 logical use, physical use, Artifact counts, daily growth, reservation error, hold duration, proposal response, and reclaimed bytes. Recalibration creates a new immutable profile.

## Reproduction Commands

```bash
git rev-parse --short=12 3fb07604b406
git ls-tree -r -l 3fb07604b406
git count-objects -vH
```

```powershell
$rows = @(git ls-tree -r -l 3fb07604b406)
$sizes = foreach ($row in $rows) {
  if ($row -match '^\d+\s+\w+\s+[0-9a-f]+\s+(\d+)\t') {
    [int64]$matches[1]
  }
}

[pscustomobject]@{
  tracked_files = $rows.Count
  tracked_blob_bytes = ($sizes | Measure-Object -Sum).Sum
} | ConvertTo-Json -Compress
```

```powershell
$drive = Get-PSDrive -Name C
$capacity = [int64]$drive.Used + [int64]$drive.Free
$twoPercent = [int64][math]::Ceiling($capacity * 0.02)

[pscustomobject]@{
  free_bytes = [int64]$drive.Free
  capacity_bytes = $capacity
  two_percent_bytes = $twoPercent
  effective_floor_bytes = [math]::Max(2GB, $twoPercent)
} | ConvertTo-Json -Compress
```

The following command should return no paths until Project databases exist:

```bash
rg --files -g '*.db' -g '*.db-shm' -g '*.db-wal' -g '*.sqlite' -g '*.sqlite3'
```

## Sources

- GitHub issue `#77` and its accepted decision comments.
- `PRODUCT.md`
- `CONTEXT.md`
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md`
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md`
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md`
