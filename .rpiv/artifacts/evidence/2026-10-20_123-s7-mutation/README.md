# #123 s7 scoped mutation — STOPPED on survivors

- GO: Pedro "Arranca", relayed by the coordinator (decisions log §137). Rule: all killed, no pre-declared exceptions in s7.
- Code: **`cf95b0a`** (tree `721a9622a414c2889cc276b03e4fb521aa46a1cb`). The run's log header shows tree `336a339f` because that tree also holds the committed evidence and the uncommitted brief (`content_hash` `9f11fb36…`, committed unchanged with this evidence); outside `.rpiv` the code equals `cf95b0a` (`after-run.txt`).
- Before the run: the nine `mutate` sources, `stryker.desktop-s7.config.json`, `vitest.desktop-s7-mutation.config.ts` and `reports/mutation/` were backed up (`s7-mutation-backup` in the implementer's scratchpad, with `SHA256SUMS`). CPU 18.9/11.8/9.9, run alone.
- Command `pnpm exec stryker run stryker.desktop-s7.config.json` (`mutation.log`, exit 0, "Done in 2 minutes and 5 seconds"). The dry run ran 322 tests. No Defender alert, no timeout, no error.
- After: every source and both configs match the backup by sha256; `git status` shows only the brief and this folder (`after-run.txt`).

## Result

- Score **96.19**. **447 mutants: 429 Killed, 17 Survived, 0 Timeout, 0 NoCoverage, 1 Ignored.**
- Per file: `harness-request-core.ts` 119, `workspace-bridge.ts` 111, `project-entry-bridge.ts` 59, `project-storage-bridge.ts` 53, `project-conversation-failure.ts` 29, `harness-session.ts` 27, `harness-bridges.ts` 25, `project-upgrade-failure.ts` 15, `desktop-runtime.ts` 9.
- The rule (all killed) **fails**: 17 survivors. Stopped: no rerun, no test edit, no triage. The full list (file:line:column, status, mutator, replacement, source line) is in `non-killed.txt`.
- The 1 Ignored is `project-storage-bridge.ts:38` StringLiteral (`stoppedText`), a static initializer that `ignoreStatic: true` skips. It is not a survivor; listed for completeness.

Files: `mutation.log`, `mutation.json.txt` (the JSON report), `desktop-s7.html.txt` (the HTML report), `non-killed.txt`, `after-run.txt`, `run-meta.txt`, `SHA256SUMS`.
