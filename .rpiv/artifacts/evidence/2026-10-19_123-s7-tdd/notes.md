# s7 TDD running notes (raw; summarized in ../2026-10-19_123-s7-tdd-evidence.md)

- Coordinator decision (decisions log §137), B10 `partial construction`: option (a) - the fault is injected on the core's subscribe (the only one in the shared path); the unreachable "bridge constructor throws -> unsubscribe the core" cleanup (design point 6, last sentence) is dropped, with no defensive branch. Under (a) the row is a pin at the scaffold (the first subscribe already throws, so nothing stays behind).
- scaffold-red-attempt1-timeouts.log: two B10 rows (`release answers and order`, `cross-bridge uncorrelated result`) awaited requests that stay pending at the scaffold and ended in a 5 s test timeout, which S7-R20 forbids as a red. Fixed (fixture only) with a settled/value watch after a bounded flush.
- scaffold-red.log: 30 failed / 285 passed; b8-register-red.log: register still 7 ids. Every failure is an assertion, no timeout.
- Final gates re-run on tree 68732e76 after the session edit, then on 09fdfb18 after the mutate-range fix (harness-session.ts:105-134), then on 94190546 after the title fix.
- Preflight on 9da01af: 3 missing-test-title findings (%s vs the contract's $case/$failure); fixed in f3d2c8f with object rows, no assertion change; preflight clean.
