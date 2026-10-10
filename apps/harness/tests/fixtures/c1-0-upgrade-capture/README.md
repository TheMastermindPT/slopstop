# C1-0 upgrade capture

`capture.jsonl` is the normalised picture of a real C1-0 upgrade (a generation-two Project upgraded
once to canonical schema 3), captured at revision `9aab1cc` with no C1 code. CNV-B23 compares
`createUpgradedOnceProject` with it.

- Normaliser: `tests/integration/storage-root-capture.ts` (the same file runs at both revisions).
  Ids become first-appearance ordinals; the application root, instants, SHA-256 digests and sizes
  are erased.
- Capture test: `capture-run.test.ts.txt` (copied into the capture worktree as
  `tests/integration/c1-0-capture.integration.test.ts`).
- Format: JSON Lines, one registry table, manifest or listing per line (`serializeStorageRootCapture`). The first capture was written as pretty JSON and converted mechanically to this form; the data is unchanged.
- Application root: a fresh directory under the OS temporary folder; never the real `userData`.

Capture command (2026-10-09, Windows, Git Bash):

```sh
git worktree add --detach "$TEMP/slopstop-c1-capture-9aab1cc" 9aab1cc
cd "$TEMP/slopstop-c1-capture-9aab1cc" && pnpm install --frozen-lockfile
cp <c1>/apps/harness/tests/integration/storage-root-capture.ts apps/harness/tests/integration/
cp <c1>/apps/harness/tests/fixtures/c1-0-upgrade-capture/capture-run.test.ts.txt \
  apps/harness/tests/integration/c1-0-capture.integration.test.ts
cd apps/harness && C1_CAPTURE_OUT=<c1>/apps/harness/tests/fixtures/c1-0-upgrade-capture/capture.jsonl \
  pnpm exec vitest run -c vitest.integration.config.ts tests/integration/c1-0-capture.integration.test.ts
git worktree remove --force "$TEMP/slopstop-c1-capture-9aab1cc"
```

Re-capture (2026-10-09, S1 review round 1 F6): the same command at `9aab1cc`, writing JSON
Lines directly with `serializeStorageRootCapture`, produced a file byte-identical to
`capture.jsonl` (sha256 `1ad6004bc92582ce16c5042a2efec3308e6eddd455c1ab6da2ce427468380c9a`).
