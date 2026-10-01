---
date: 2026-09-27
author: OpenCode
commit: c92171c
branch: feat/project-registration
repository: slopstop
status: in-progress
---

# Prepared Registration Proposal Recovery — Human Decision

The user explicitly answered **“sim”** to recovering a saved preparation proposal after an application restart, while requiring fresh repository validation when confirming registration.

This adds a bounded clarification to the approved PC-S1 preparation contract; it does not rewrite the frozen v1-v4 documents or their historical reviews.

- Repeating the exact preparation request identity and input fingerprint returns the original saved proposal, without a new Git observation or a second proposal, even if the repository later disappears or changes. This returns historical preparation, not proof of current repository validity.
- Reusing that request identity with materially different inputs returns `REGISTRATION_IDEMPOTENCY_CONFLICT` and must not overwrite the original proposal.
- A genuinely new preparation request requires fresh observation under the existing executable and repository consent rules.
- Confirming registration requires fresh validation of the saved proposal's repository/authority dependencies before any reservation or creation. Recovering a proposal never authorizes registration by itself.
- Registry corruption or unreadability remains a distinct failure; missing or broken storage must not manufacture a historical proposal.

Authority: continue the same PC-S1 implementation in `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`. No commit, integration, extra query command, runtime/dependency change or wider feature is authorized by this clarification.
