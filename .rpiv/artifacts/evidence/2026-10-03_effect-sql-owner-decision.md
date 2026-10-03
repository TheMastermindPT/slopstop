---
date: 2026-10-03
author: OpenCode
commit: 11b1989
branch: feat/effect-migration
repository: slopstop
status: in-progress
---

# Effect Migration — SQL Ownership Decision

The user explicitly answered **“sim”** to the joint recommendation presented after the bounded SQL experiment and the OpenCode/Claude discussion.

## Approved Choice

- Retain the libSQL engine and its file format.
- Retain a dedicated database worker as an intentional native boundary.
- Migrate the worker's parent-side ownership, requests, resources and lifecycle coordination to Effect in the applicable migration unit, rather than keeping the replaced handwritten coordination as a legacy path.
- Retain Drizzle as the schema-definition/generation tool.
- Do not adopt direct Effect SQL execution on the harness thread in this migration. Adding Effect SQL inside the worker is not part of this approval either.

Preserve the product's writer fencing, idempotency, uncertain-commit reconciliation, bounded close and explicit pending-recovery behavior. Merely interrupting an Effect or calling dispose is not proof of native work completion.

The existing forced-GC mechanism is not approved as a permanent unchangeable design, nor diagnosed as the cause of the historical crashes. Changing or removing native resource-release mechanisms still requires a bounded implementation with evidence that file handles and outstanding work are correctly released. This decision does not authorize exposing new GC flags on the Electron utility process or changing Electron security settings.

## Basis And Current Work

The [SQL experiment](../research/2026-10-03_effect-sql-windows-experiment.md) observed immediate close/rename/delete success with the current worker and EBUSY with direct SDK/Effect SQL clients. It also demonstrated controlled commit-acknowledgement uncertainty. Those observations support this choice without constituting a complete native-crash diagnosis or a performance benchmark.

The [full migration authority](2026-10-03_effect-migration-authority.md) remains applicable. This closes its previously deferred SQL-client choice. The Schema-only first unit remains in review/remediation; this decision does not accept that candidate, erase baseline failures, or authorize a commit/merge/push.
