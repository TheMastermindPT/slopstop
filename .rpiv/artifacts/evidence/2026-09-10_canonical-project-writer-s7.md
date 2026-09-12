# S7 execution evidence — authorization and protocol preflight

## Authority and scope

- The current human instruction explicitly authorizes S7.1/S7.2 in `C:/Users/pedro/Documents/GitHub/slopstop`, on `feat/canonical-project-writer`, after the parent completed the confirmed six-commit plan. This is current build authority, not retrospective proof or acceptance of missing historical checks.
- Starting HEAD: `77f7667ea89b521472660d3e1bea7e85fbf5168b`. Initial index and working tree were clean. All 314 files in the retained S6 manifest matched their exact raw SHA-256 values. Retained S6 snapshot identity: `6c8a0c879441f90f27d44d03aed804dd3f89914ebb8dcf7c5f8cbf65669cb99c`.
- The parent recorded the approved commit plan and completed execution in `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-phase-commit-plan-20260910.md`. This execution performs no staging, commits, ref updates, pushes, installs, upgrades, builds, package/native proof, deep validation, or mutation testing.
- S7 is the final numbered slice. Combined validation follows S7; there is no S8.
- This packet implements only scenario admission and ordinary-dispatch refusal within S7.1. Private main/process composition and executable launcher changes remain for the later runner group. S7.2 is blocked by the concrete MessageId oracle contradiction below. No smoke schema or export has been added while that choice is unresolved.
- Parent owns independent candidate review and human acceptance. Neither passing local checks nor the new commits supplies that review or waives the S5/S6 historical driver/runtime/evidence qualifications.

### Verified predecessor commits

| Phase | Full commit | Subject |
| --- | --- | --- |
| S1 | `8a0658d7047ace0966b200a8854186638cbeecae` | `fix(protocol): isolate correlated request failures` |
| S2 | `37e3f83a9b0ce1868d8b896b9f9b0a9cdfe3f2e2` | `feat(storage): add canonical generation two` |
| S3 | `9bbad734cbea2dca05b7c9d5008d8b142346e8d2` | `feat(writer): enforce exclusive project activation` |
| S4 | `bbfefed7babd566507dbfa89913c226a598021e2` | `feat(writer): switch projects after draining work` |
| S5 | `d0fe4a3e9c98300dba6aa3823b5f32be1fa0ad82` | `feat(writer): settle typed commands atomically` |
| S6 | `77f7667ea89b521472660d3e1bea7e85fbf5168b` | `feat(writer): reconcile uncertain command commits` |

## Contract identity

Owner: `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md`.

Read the complete original S7 contract and criteria (original lines 12106–12295), its Decisions, protocol and ordinary smoke Architecture guidance, and the original static approval in Developer Context. The Architecture remains cumulative guidance, not copied implementation truth. Read `AGENTS.md`, `PRODUCT.md`, `CONTEXT.md`, shared candidate workflow/test-contract instructions, the standing decisions, CodeScene guidance, and applicable ADR 0004/0006 boundaries.

The unmodified artifact passed `validate-artifact.mjs <absolute-design-path> --root <repository-path>` without stamping. Original raw design SHA-256: `c2cf2be8ceb6a1b70f62356ff63d3d959a18b38beff82027f9a8f89a434d6812`.

The existing 24 bindings from `slopstop-s6-intent-packet-v2-20260909.json` remain byte-for-byte unchanged, including the original S6 contract, corrected uppercase-negative literal, shared guidance, full Decisions and Architecture sections. Their identity remains `562825304608f6d8eaf46680845f012fb9d00570b32a0a5a00a942a06327c1ee`. A new HEAD does not alter these behavioral bindings.

Four additional exact selectors bind S7. Normalize CRLF/CR to LF; require unique exact heading lines; include the start heading and exclude the end heading; join selected lines with LF and append one LF. Hash with SHA-256.

| Binding | Start heading | Exclusive end heading | SHA-256 |
| --- | --- | --- | --- |
| S7 original | `### Slice 7: Packaged Cross-Process Proof` | `## Desired End State` | `491f2d82a4cb221306f4243ff0096b4c1ef1ec5b0834405ea34ad5b787f91793` |
| S7 Decisions | `### Slice 7 private process ownership and proof-only limits` | `## Architecture` | `75bb9c8cdaa6e1c8037a88e5b2f73cd1044be6ca265207bdc3c1f77eb0c159f9` |
| S7 protocol Architecture guidance | `### packages/protocol/src/canonical-writer-smoke-protocol.ts - NEW` | `### packages/protocol/src/domain-identity-schema.ts:1-12 - MODIFY` | `1ed5df4cf159ea18c8ac507f40a866d5bce7266fe17595d5a6790b3edd23ca8d` |
| S7 static approval | `### Slice 7 additional proof-seam decision` | `## Design History` | `d24e617d653f32180228e8b7c41bd4b819ead7a16aa7d564837a7693f3f9e09a` |

Ordered combined 28-binding JSON SHA-256: `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`. Every recorded test/check verified the old and new bindings before and after execution. Each `inputs.json` includes the complete selector records, digests, command, working directory, and raw-file manifest.

## Capture and execution method

External evidence root: `C:/Users/pedro/AppData/Local/Temp/opencode/` (abbreviated `Temp/` below).

Runner: `Temp/slopstop-s7-proof.mjs`. Before each Red, Green, characterization, and command gate it creates a fresh directory and copies every Git-tracked/nonignored source, test, configuration, manifest and lockfile, plus the runner, predecessor intent packet, and all 28 raw binding files. Capture is serial, one file at a time; no whole-tree source buffer is built. Copies and live files are hash-compared before execution, and inputs are checked again afterward. Each ordinary run initially captured 344 files: 314 repository files plus 30 proof/binding files. Later evidence-file additions are included by subsequent captures.

Installed dependency trees, generated outputs, caches, secrets and unrelated external evidence are excluded explicitly; dependency manifests and `pnpm-lock.yaml` are retained in full. These are source/configuration/dependency-definition snapshots, not vendored installed-dependency archives. No retrospective reconstruction substitutes for the captured intermediate test contents.

Focused commands run through the installed pnpm runtime, Node `v24.19.0`; the capture process uses global Node `v24.20.0`. Test options are `--maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=json --outputFile=<fresh-dir>/report.json`, with `NODE_OPTIONS=--max-old-space-size=768`. Raw stdout/stderr is retained in `output.log`; no checks ran concurrently.

## S7.1 observed Red → Green

### Scenario authorization

Test: `package smoke authorization admits writer proof only through authorized private package composition` in `apps/desktop/src/main/package-smoke-authorization.test.ts`.

- Before any production edit, add the real public authorization test with a valid root/token/marker and `scenario:"writer-proof"`. Expect exact `{root,scenario:"writer-proof"}`, one setter call and unchanged root entries.
- Red command: `pnpm exec vitest run apps/desktop/src/main/package-smoke-authorization.test.ts -t "admits writer proof only through authorized private package composition"` plus the recorded bounded runner options.
- Observed Red: `PackageSmokeAuthorizationError: Package smoke authorization failed.` The existing parser rejected the new scenario. This was an actual assertion-path failure, not an import, type, absent-module or native setup failure.
- Minimal implementation: add `writer-proof` to the existing scenario union and parser.
- Green command: the same file without the name filter. All 3 tests passed, including existing authorization characterization.
- Separate local review: production CodeScene score 10.0, no findings. Sonar MCP unavailable in this session; no Sonar cleanliness claim.

| Step | Directory under Temp/ | inputs.json SHA-256 | report.json SHA-256 |
| --- | --- | --- | --- |
| Red | `slopstop-s7-authorization-red-2026-09-10T21-41-04-012Z` | `1870cc131ff0bc75d1db2d9be8e31ffcaa6b4d16e28a675db6bd16a07d481310` | `1d1dafc359500820e0fe301f1f8ceb50321ca7b97c5127c8d1c9ece694cc88aa` |
| Green | `slopstop-s7-authorization-green-2026-09-10T21-41-32-583Z` | `819cb655fe6323ef1d06702f80c120df4f921f9b5d92f3492edfd0c7aad2a9e9` | `f0399cd60198658bd53e45574d796f803812b7fa1341443a3f56e13d673766b4` |

### Ordinary Storage dispatch refusal

Test: `refuses writer proof through ordinary Storage dispatch` in `apps/desktop/src/main/project-storage-package-smoke.test.ts`.

- Red command: that file with `-t "refuses writer proof through ordinary Storage dispatch"`.
- Observed Red: `promise resolved "undefined" instead of rejecting`.
- Minimal implementation: the ordinary dispatcher throws exactly `Writer proof requires the private process owner.` for writer-proof. The test also proves zero open/create/close/stop calls through its public bridge.
- Green command: both changed test files. All 5 tests passed.
- Separate local production review: CodeScene 10.0, no findings; Sonar MCP unavailable.

| Step | Directory under Temp/ | inputs.json SHA-256 | report.json SHA-256 |
| --- | --- | --- | --- |
| Red | `slopstop-s7-private-dispatch-red-2026-09-10T21-42-17-340Z` | `3e7ca33f218ac7b6023b031a8d7e32c5ad6d1cd37b5529f7a4cfe74bb3ada1c4` | `7491fa58e09f8fa3cbd1b176112e5c2d3c93a766b157959d671ef977d3dba785` |
| Green | `slopstop-s7-private-dispatch-green-2026-09-10T21-42-41-312Z` | `a65242c008f84369bea56758acddcc61b2a8d0240c2d351f544f5f662302acfd` | `b144f3f5ab69c54277bb82be0f50a315ec9fc7aadfe96ec182050d9e082b7800` |

## Characterization and local review/refactor

- Parser matrix accepts the four exact scenario strings. Undefined/null/empty/whitespace/unknown/non-string values, padding and wrong case reject with the exact existing parser error.
- Bootstrap and writer-proof authorization matrices cover missing/empty/relative/nonexistent/non-directory roots, root junctions, missing/malformed/mismatched tokens, missing/nonregular/malformed JSON markers, wrong marker version, extra marker fields and invalid scenarios. Each refusal checks the existing exact error and zero setter calls. Root entries remain unchanged by authorization.
- Existing-root writer authorization additionally proves that the bootstrap-only empty-root guard is not reapplied to a populated authorized root.
- The original executable authorization matrix is preserved unchanged. Executable writer variants, packaged/non-prototype gating and real child/main ordering are later-group proof, not claimed by these unit tests.
- The added bootstrap characterization proves the prior Project create/open/close identity is exactly `00000000-0000-4000-8000-000000000101` and create request `00000000-0000-4000-8000-000000000111`. It passed before any identity-owner extraction. Extraction remains pending with S7.2; no replacement constant owner was introduced prematurely.
- Initial expanded characterization ran 95 passing tests and 2 setup failures in `slopstop-s7-authorization-characterization-2026-09-10T21-45-27-088Z`: real file-symlink creation was denied by Windows with `EPERM`. These are infrastructure failures, not behavioral Red. The tests now visibly skip only that exact capability failure, consistent with the existing executable's permission-limited symlink handling. Other errors still throw. Both real file-symlink marker cases remain unproved on this host; directory-root junction cases ran successfully.
- CodeScene found score 9.09 in the authorization test (complex conditional and duplicated successful-authorization tests). Refactored only the test error predicate and table-driven success cases. Subsequent CodeScene score 10.0 with no findings; all three changed TypeScript files now score 10.0.
- Biome's first check identified one blank line; removed it. Final Biome passes. Write hooks reported Node unavailable and skipped their own checks; these automatic hooks are not represented as passing. Explicit validator, Vitest, TypeScript and Biome commands did execute successfully.
- CodeScene OAuth config had no token/on-prem/account overrides. Installation verification passed all five reported checks. The final safeguard inspected 3 eligible/modified files and returned `quality_gates:"passed"`, `status:"no-issues-found"`, `results:[]`. [CodeScene configuration reference](https://codescene.io/docs/integrations/mcp.html#configuration).
- Sonar tools were absent from the exposed tool catalog/resources. MAIN/TEST bytes were not analyzed by Sonar; no substitute unrelated project or global clean claim was made. Parent review still needs that check where available.

## Final source-bound checks

Final focused command: `pnpm exec vitest run packages/protocol/src apps/desktop/src/main/project-storage-package-smoke.test.ts apps/desktop/src/main/package-smoke-authorization.test.ts apps/desktop/src/main/project-storage-bridge.test.ts` plus the serial/reporting options above.

Result: **438 passed, 0 failed, 2 skipped**, seven test files. Breakdown: canonical-project protocol 270; storage protocol 5; product protocol 42; workspace protocol 13; authorization 62 passed plus the 2 permission-limited skips; Storage bridge 12; package smoke 34.

| Check | Directory under Temp/ | inputs.json SHA-256 | Result |
| --- | --- | --- | --- |
| Final focused regression | `slopstop-s7-final-root-regression-2026-09-10T21-51-04-785Z` | `36bea8940c2279aa1bbec4a10199bc7893f427b0980198ea222b38f908eafb1e` | 438 passed, 2 skipped; report SHA-256 `bc3032f92d892b021565bc705e174f43bd631b3485a9aa57bbb7753be2dc3874` |
| Protocol typecheck | `slopstop-s7-protocol-types-2026-09-10T21-48-13-660Z` | `e5607a4ab336b2688f2a1a12031dceafc260ffc318cf3d6aca6ee35d047c4c73` | `pnpm --filter @slopstop/protocol typecheck`, exit 0 |
| Final Desktop typecheck | `slopstop-s7-final-desktop-types-2026-09-10T21-51-52-933Z` | `c166b146f772c2e0a4405f5d4c333935bb114c29c075d8c93ac70116bbde9723` | `pnpm --filter @slopstop/desktop typecheck`, exit 0 |
| Final Biome | `slopstop-s7-terminal-biome-2026-09-10T21-52-06-404Z` | `504d025e3a7b32bf287b38e7c3f17eee21705e1502ab5da04559a018ffb5ef2f` | `pnpm exec biome check` on the three changed TypeScript files, exit 0 |

No Harness consumer or protocol production source changed, so no additional Harness compiler/build/native run was needed for this bounded packet. Full later-group requirements remain pending.

| Current source | Raw SHA-256 |
| --- | --- |
| `apps/desktop/src/main/project-storage-package-smoke.ts` | `b242d9376a5ca5aa65e1f30e3e94aec4ac4b55c38a1c84e08aca0140bb2b1b8d` |
| `apps/desktop/src/main/project-storage-package-smoke.test.ts` | `1db2338cd5987e5ccbca8ac69aab39a11241472967c52f1e677a49af28048d66` |
| `apps/desktop/src/main/package-smoke-authorization.test.ts` | `dd437fea5bb93033e5dfcefa2974c494bf8ea8f27397e4f2ffa87eae46ac1f97` |

## S7.2 actual contract blocker — MessageId NIL/MAX

The original S7.2 oracle at original design line 12141 requires `NIL/MAX/malformed message identity per existing MessageIdSchema` to reject. The Architecture explicitly references the existing owner for proofId/requestId. That owner is `packages/protocol/src/protocol.ts:49`:

`export const MessageIdSchema = z.uuid().brand<"MessageId">();`

Installed Zod is `4.4.3`. A read-only preflight imports this actual module with Node's TypeScript source resolution; it does not substitute a schema or alter a validation rule. Global preliminary evaluation and the actual pnpm Node 24.19.0 import agree:

| Actual input | Existing owner accepts |
| --- | --- |
| `00000000-0000-0000-0000-000000000000` (NIL) | true |
| `ffffffff-ffff-ffff-ffff-ffffffffffff` (MAX) | true |
| `FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF` | false |
| `abcdefab-cdef-4abc-8abc-abcdefabcdef` | true |
| `ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF` | true |
| `not-a-uuid` | false |

Owner raw SHA-256: `da283d0c2c4f906de8bcbd6c5f86c8bbdc946ba307e53b716ea908ce4b0c63e4`.

Reproduction: `pnpm exec node C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-message-id-preflight.mjs`. Retained directory: `Temp/slopstop-s7-message-id-preflight-2026-09-10T21-50-34-305Z`; 345 raw inputs including the probe; inputs SHA-256 `dc44b41a80a4ace008aec3bc3f17a7c7726605380d5f08cddb28cf3447119894`. `output.log` contains the actual owner results. This is preflight characterization, never feature Red.

Current Context7 documentation was retrieved using library resolution plus docs for `/colinhacks/zod` (UUID validation) and `/vitest-dev/vitest` (serial CLI filtering/reporting). Runtime observations of the pinned installed owner settle the factual discrepancy; documentation alone is not used to override it.

**Decision needed before S7.2 guards:** either correct the smoke oracle to inherit the existing MessageId acceptance (including NIL/lowercase MAX), or explicitly approve a smoke-only NIL/MAX exclusion while preserving the product owner. No global MessageId tightening, fabricated uppercase negative, weakened raw oracle, or silent choice was made.

Once clarified, author all actual contradictory S7.2 envelope/receipt/native metadata cases before their guards, implement the separate strict schema family and named exports, and migrate the already-characterized Project101 constant. After that, proceed to the parent-owned next runner/native-origin group and ultimately real Windows/Linux package proof. Those later obligations are not completed by this packet.

## Continuation — parent clarification of S7.2

The continuation instruction resolves the implementation interpretation without changing any original normative text or negative oracle: reuse `MessageIdSchema` as the base and apply a local smoke-only non-NIL/non-MAX refinement to proofId/requestId. Preserve its brand and acceptance of otherwise-valid uppercase UUIDs. The plain Architecture projection is guidance, not a prohibition on the local refinement required by the exact Oracle.

The preceding preflight remains an accurate observation of the general MessageId owner. Its proposed weakening was not applied and is superseded by this clarification; it is not recorded as human approval to change a contract. The general owner remains unchanged. The two Windows file-symlink cases remain pending due to EPERM; no privilege, host configuration, or authorization guard change is authorized. Sonar availability below refers only to tools exposed to this executing session, not global or parent availability.

## S7.2 completed protocol group

The earlier interpretation blocker is resolved by the parent clarification above. Original S7 normative sections, all original negative oracles, all 24 predecessor bindings and all four added S7 bindings remain unchanged. Combined contract identity remains `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`.

### Implementation and public seam

- Added `packages/protocol/src/canonical-writer-smoke-protocol.ts` and its colocated test. Start, five control variants, five result variants and native metadata are strict independently versioned schemas. Unknown/missing fields, invalid kinds/versions/step numbers and contradictory proof observations reject rather than being stripped or normalized.
- A private `smokeMessageIdSchema` refines the existing `MessageIdSchema` to exclude exactly NIL/MAX in the smoke boundary. proofId/requestId retain the existing MessageId brand and otherwise-valid uppercase UUID spelling. The general `packages/protocol/src/protocol.ts` is byte-identical to HEAD and to the earlier S7.1 preflight source hash.
- Durable identity validation reuses existing owners. Expected receipt metadata reuses `CommandReceiptMetadataSchema`, with exact Project/Command/type/version/sequence/original-generation/rejection constraints. The audit tuple requires two distinct receipt identities and two distinct activation epochs; the stale result also refuses equal old/replacement epochs.
- Native metadata permits exactly the approved five target names and pinned `fs-native-extensions`/`1.5.1`, with `unpackedTargetBinding:true` and `fallbackLoaded:false`. This validates the transport vocabulary. Comparing a valid declared target to the actual spawned process's executing target and proving native origin remain the later runner/native checks; schema acceptance is not native execution evidence.
- Added explicit named schema, constant and type exports in `packages/protocol/src/index.ts`; tests exercise these exported owners. The product Desktop/Harness unions are unchanged and reject both raw fixture messages and otherwise-complete v4 product envelopes using fixture-only kinds.
- Moved only the collaborating Project101 constant to the protocol owner, keeping the ordinary smoke module's local alias. The existing independent-literal bootstrap characterization passed immediately before and after the move, unchanged.
- No main/runner/fixture execution, native module import, test handler registration, build declaration, package operation, or product command union was introduced. The new module imports only Zod and existing local protocol identity/schema owners.

### Negatives authored before guards

The full initial matrix was in the captured test file before validation implementation. Minimal `z.unknown()` exports made the public schema seam executable without missing-file/import failures; negatives then observed the incorrect acceptance. These scaffolds were fully replaced and are absent from the final source.

The pre-implementation matrix includes:

- Every required field omitted from each start/control/result variant; extra `path`, `token`, `fingerprint`, `cause`, `sql`, `rawRows`, and `extra` fields; versions `0`, `2`, `"1"`, `null`; unknown kind/step; each mismatched step number from `0,1,2,3,4,5,1.5,"1",null`.
- Both correlation fields using NIL, lowercase MAX, malformed/empty/padded UUID text and uppercase MAX. The real letterful uppercase positive is `ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF`, not a numeric fixture transformed to the same string. Separate positive cases preserve global NIL/MAX/uppercase acceptance.
- Invalid bootstrap kind, HTTP/remote-file/encoded-separator roots and extra token data. Existing bootstrap validators remain the syntax authority.
- Empty/short/long/repeated activation tuples; NIL/MAX/malformed/padded/uppercase durable activation identities; wrong receipt order/cardinality/repeated receipt identities; wrong Project/Command/type/version/outcome/sequence/generation/rejection/event/time values; original R1 generation falsely relabelled 2; private receipt/rejection fields.
- Replacement generations `-1,0,1,3,2.5,"2",null`; malformed Project/activation/Command result identities; repeated old/replacement epoch; wrong stale status/code, retryability, row-unchanged flag, each nonzero work counter, successful writer-close label or operational release authorization.
- Wrong audit Project/label/sequence/generation/counts/recovery counts/fence; wrong initialization generation; false release witnesses; weakened teardown strings.
- Native versions `1.5.0`/`1.5.2`, wrong package name, unsupported `win32-arm64`/`linux-ia32`/`linux-x64-musl`, wrong-case/padded target, fallback true, unpacked false, missing or private native fields. Every approved target independently round-trips exact native metadata.

After the first complete Green, review added public-export/type-brand verification, complete v4 product-envelope negatives, missing nested bootstrap/receipt fields and explicit first/second sequence/generation relabelling cases. These reinforce already-enforced behavior and are recorded as review coverage, not fabricated new Red. Final new protocol test count is 644; initial matrix count was 627.

### Observed Red → Green records

All directories below are under the same approved Temp root. Every run captured 347 raw inputs (317 repository files plus runner/predecessor/binding files), full test/config/dependency-definition contents, commands and hashes before execution. The existing exclusion of installed dependency trees is unchanged and explicit. All runs reverified 28 contract bindings and live input hashes afterward.

The first start filter `^start ` selected only the explicitly named bootstrap/legacy-owner describe block because Vitest quotes interpolated `$name` descriptions. Its 5 actual bootstrap assertion failures are retained in `slopstop-s7-start-envelope-red-2026-09-10T22-02-24-495Z`; it is not claimed as complete start/UUID proof. Before implementation, the corrected `-t start` selection exercised the full start negatives, including NIL/MAX.

| Step | Temp directory | Observed result | inputs.json SHA-256 |
| --- | --- | --- | --- |
| Complete start Red | `slopstop-s7-start-envelope-complete-red-2026-09-10T22-03-12-608Z` | 27 failed, 6 passed; incorrect acceptance (`expected true to be false`) | `ef48d83cff14cebeb4ef2e24abc49ae69bbbf6d582f6da5f9428475ba4738751` |
| Start Green | `slopstop-s7-start-envelope-green-2026-09-10T22-03-55-883Z` | 33 passed | `fc42e64e3bd3be920b7eabc10d56b85242eb77723a9e9528099e55942a7921ad` |
| Control Red | `slopstop-s7-control-envelope-red-2026-09-10T22-04-31-247Z` | 245 failed, 25 passed; incorrect acceptance | `ebf37b0cf856b4da12a7832c1f11ed1e8edcb3682aaa16c2464bffa0aaceca84` |
| Start/control Green | `slopstop-s7-control-envelope-green-2026-09-10T22-05-54-652Z` | 303 passed | `ca4b1fe18efe61d70d0420fe844283d2a27b7675731f3575ddebc40a6eeba571` |
| Result/native Red | `slopstop-s7-result-native-red-2026-09-10T22-06-15-616Z` | 294 failed, 30 passed; incorrect acceptance | `91a8a80136680ac06170e0cd0184510acbaa7049fcf43f5deb3b71f22352e7e6` |
| Complete schema Green | `slopstop-s7-protocol-envelope-green-2026-09-10T22-07-11-390Z` | 627 passed, no skips | `45de3e5f0c5acdf456b348348c17461875a183b04bbbdebe4800d93764626914` |

Commands use `pnpm exec vitest run packages/protocol/src/canonical-writer-smoke-protocol.test.ts`, respectively `-t start`, `-t control`, `-t "start|control"`, `-t "result|native"`, or no filter, plus the previously documented serial/reporting options. Unselected tests during focused runs are not completed evidence; the final unfiltered run executed all schema cases. Full assertion results and raw output live beside each manifest.

Report SHA-256 values, in the same table order:

1. `9678b5f6cf6d6fd84a0e288f814bad61cc360253875645015047599221f23d84`
2. `3ba7a25e099da332b7b28d6b312ba918a0977eea2014120c570d4bbeba439dec`
3. `ccf149293f7ec47d98617f3471ccc2aca1417cf075beda592e179e9342221aa1`
4. `f7c73edcad0b15ac2cae283f5a7ea5c3c77f0a9f9a716a58bc05984718a9fd85`
5. `eb130cfb0c8374dc553b3b240fe61a009856a8ffe4b3c5586c61eca4d3be068b`
6. `73ac0e722fa7fe3f1e74386f1c410e2a3b7dcb4419774b79cd8f2758f733e73b`

CodeScene reviewed production after each schema Green: 10.0, no findings. The tiny initial permissive scaffold and the export-only index returned `score:null`; these are not scored baseline passes. Final source/test reviews and the safeguard below provide the applicable checks.

### Project101 extraction characterization

Identical test and command before/after: `pnpm exec vitest run apps/desktop/src/main/project-storage-package-smoke.test.ts -t "preserves the original Project101"` plus bounded options. Both ran the named test and passed; 33 other tests were deliberately unselected. This is the approved non-behavioral extraction exemption, not a new behavior Red.

| Step | Temp directory | inputs.json SHA-256 | report.json SHA-256 |
| --- | --- | --- | --- |
| Before | `slopstop-s7-project101-before-extraction-2026-09-10T22-08-25-089Z` | `e4cfd24d32e5e03121dbdeadc9591f25c44cb1bd9e6835e17458e249782d55bd` | `dc215797cda408783cbbccadf38d59cb168c73807c71874dee8231aea47ebd4c` |
| After | `slopstop-s7-project101-after-extraction-2026-09-10T22-09-25-294Z` | `f181505f37ffce2a959afb289e0124a8ae84d7c16692122f617af3056a1d5703` | `488f563c58eb4be4d8b56f5c28d07755555031b02f0b40ec0c47723f85474c70` |

### Final available checks and limits

| Check | Temp directory | inputs.json SHA-256 | Result |
| --- | --- | --- | --- |
| Protocol + Desktop authorization/storage regression | `slopstop-s7-protocol-group-regression-2026-09-10T22-16-27-097Z` | `5851091cb303545e2bb5f0efecc3606261a9fd5174fd3273fda9bce0528508ab` | 1082 passed, 0 failed, 2 Windows symlink skips; report SHA-256 `1ad0c5ab6499c05b9e00b170445a22628494a902afed3fdf5c035b5a6c20c5bf` |
| Protocol types | `slopstop-s7-protocol-group-types-2026-09-10T22-18-10-585Z` | `83cfe49b1d0b6cea667d4d44c34ec49cdf2741fb481fdc007ba5a660f212edb6` | exit 0 |
| Desktop consumer types | `slopstop-s7-protocol-desktop-consumer-types-2026-09-10T22-18-20-559Z` | `330b6b114e0399727a3e4950b3429e2c775dede0d9ba942bbd4081328716084a` | exit 0 |
| Harness consumer types | `slopstop-s7-protocol-harness-consumer-types-2026-09-10T22-18-35-807Z` | `0315fc9f0efcab4a646a611e08a3c6d6d8376c27a913ab27c2b2422d1d6b7a03` | exit 0 |
| Biome, all six changed TypeScript files | `slopstop-s7-protocol-group-biome-2026-09-10T22-18-56-721Z` | `cae108adb252939c212e89ce80dcf89e051e79d97ab6c331a6e6a88b27e7e9a4` | exit 0, no findings |
| Source dependency boundaries | `slopstop-s7-protocol-group-boundaries-2026-09-10T22-19-21-352Z` | `ce059990c686affff3fe396bc54d344dba63dc6b30003efe26b21fcca92b4057` | exit 0; 217 modules, 623 dependencies, no violations |

The regression uses the same four path selections as the S7.1 final regression, now including the new protocol test. Types use the three individual `pnpm --filter @slopstop/<workspace> typecheck` commands. No concurrent compiler programs were used. Biome required only formatting/import ordering corrections, all applied before these final checks; earlier diagnostic reports are retained. Boundary command: `pnpm check:boundaries`.

Final CodeScene reviews: new protocol implementation 10.0, new protocol test 10.0, ordinary smoke consumer 10.0, all with no findings. The S7.1 tests remain unchanged from their 10.0 review. Final safeguard: `quality_gates:"passed"`, 6 eligible and checked source files, 7 total modified paths, no issues. No staging was needed or performed.

Sonar remains **not executed by this session**, not globally unavailable. No Sonar analysis tool is exposed here. Resource lookup reported no Sonar resource support; the earlier S6 local MCP script was inspected to locate its actual transport. Read-only Docker inspection confirmed its `sad_shannon` container is absent (`no such object`), and no Sonar container appeared among running containers. No installation, replacement container, privilege or project-key change was made. Thus no final MAIN/TEST Sonar result or global clean claim exists; the parent may run that gate with its own available tools. Independent final review/acceptance remains parent-owned.

The 2 skipped file-symlink marker tests remain a Windows EPERM environment limitation. They are not converted to passes; actual Linux symlink and Windows/Linux native/package proof remain later work. No builds, packaging, global deep gate or mutation testing ran.

### Final protocol-group source identities

| Path | Lines | Raw SHA-256 |
| --- | ---: | --- |
| `packages/protocol/src/canonical-writer-smoke-protocol.ts` | 217 | `b878792db3cdb19a1f830fb3e87f2db27ba30b2fead13c280b6435e93670e66c` |
| `packages/protocol/src/canonical-writer-smoke-protocol.test.ts` | 570 | `389b5c33dd378f0f0dd17dbdf1b1b3724658ce8417a8eef52b3c9d13e3ee91a0` |
| `packages/protocol/src/index.ts` | 207 | `92d0a3f5ab87288acdd7905a9c49566ed7f408882ccb7a8fd83ae64a816c5a89` |
| `apps/desktop/src/main/project-storage-package-smoke.ts` | 139 | `e10bc2032f9d47147925e3d6b515d871a10280ed20ab89f081d1ee236b6701af` |
| `apps/desktop/src/main/project-storage-package-smoke.test.ts` | 147 | `1db2338cd5987e5ccbca8ac69aab39a11241472967c52f1e677a49af28048d66` |
| `apps/desktop/src/main/package-smoke-authorization.test.ts` | 197 | `dd437fea5bb93033e5dfcefa2974c494bf8ea8f27397e4f2ffa87eae46ac1f97` |

Unchanged general MessageId owner SHA-256 remains `da283d0c2c4f906de8bcbd6c5f86c8bbdc946ba307e53b716ea908ce4b0c63e4`; unchanged original design SHA-256 remains `c2cf2be8ceb6a1b70f62356ff63d3d959a18b38beff82027f9a8f89a434d6812`. Source/schema implementation for the requested S7.1/S7.2 group is complete. Next work is the separately scoped runner/native-origin group, followed by the remaining S7 behavior and combined validation; it is not implemented here.

## S7.3 bounded native-origin owner — unit proof

### Authority, preserved inputs, and remaining ownership

- The current execution instruction delegates only the S7.3 native-origin owner and focused tests in the existing workspace. The parent reports the human's S7 build direction after the six commits; this entry records the bounded execution instruction, not a new human acceptance or independent review. HEAD remains `77f7667ea89b521472660d3e1bea7e85fbf5168b`.
- Changed only `apps/desktop/src/main/package-smoke-verifier.ts`, its colocated test, and this append-only evidence. All other raw repository inputs match the first S7.3 capture, including the dirty S7.1/S7.2 files, the global MessageId owner, original renderer test, executable libSQL preflight, and old scenarios. S7.2's 644 tests and local NIL/MAX refinement remain unchanged.
- Read the original S7.3 oracle (12145–12153), verifier Architecture (10356–10432), published preflight pins (10606–10612), S3 source/staging evidence, protocol metadata, AGENTS/PRODUCT/CONTEXT, both standing decisions, shared candidate workflow/test-contract guidance and CodeScene operational guidance. No normative contract was changed; the 28-binding identity remains `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`.
- This group is **unit preflight proof only**. The tests read installed published prebuild bytes without modifying them and mock the public filesystem, CommonJS resolver and `process.dlopen` ports. No actual native library is loaded by these tests. Native compatibility, independent fixture-origin observation, executable libSQL preflight execution, Windows/Linux package execution, runner/process composition and final independent review remain parent-owned.

### Implemented public interface

- `verifyPackagedWriterNative({ resourcesPath, mainBundleDirectory }): void` is synchronous. It returns normally only after proving the exact executing-target file, canonical physical spelling, regular/non-symlink/nonempty metadata, approved SHA-256, virtual package name/version, exact virtual `index.js`, exactly one successful delegated native load and both `tryLock`/`unlock` functions.
- `mainBundleDirectory` must equal `resourcesPath/app.asar/.vite/build`; resourcesPath must be absolute and normalized. The permitted binary spellings are exactly the ASAR virtual package path and corresponding `app.asar.unpacked` path. Normalized aliases, suffixes, alternate targets and renamed files are not accepted loader candidates.
- The observer delegates with the original `process` receiver, module, filename and flags. Its count advances only after the original loader returns successfully. A rejected bad candidate can be caught by the resolver before the legitimate pinned candidate succeeds; the bad candidate is never delegated. A failed legitimate delegation is not itself a successful witness. Zero observations, including cached-load behavior, fail.
- Every preflight exception is replaced by `WriterProofError`, stage `native-preflight`, exact message `Packaged Writer proof failed.`, with no private cause. The original observer is restored on success and exception.
- Same-file exports `WriterProofError`, `WriterProofStage` and `requireWriterProof(condition, stage)` provide the Architecture-defined shared error boundary for the next runner. They introduce no runner import or dependency cycle. The full Architecture stage vocabulary is retained. The runner must call preflight before native-dependent loading; it must not treat prior cache contents as origin proof or clear the cache to manufacture evidence. Fixture verification remains independent and must not import Desktop source across the application boundary.

### Red → Green and exact source captures

All test/compiler/Biome gates below ran serially through the existing `Temp/slopstop-s7-proof.mjs`, using its unchanged 768-MiB limit, one Vitest worker, full verbose/JSON reporting, raw output and before/after binding/input checks. Each captured 347 complete raw source/test/configuration/dependency-definition/binding inputs in a fresh directory before execution. Installed dependency trees remain explicitly excluded; their manifests and lockfile are captured. No build, package, main-runner test, deep gate, mutation run, install/upgrade or Git write occurred.

The first executable scaffold exported the public preflight function with an empty body. All 57 new initial cases were authored before production guards: positive target/origin delegation plus actual contradictory file, metadata, entry, candidate, witness, API, target and input values. The first run produced 57 assertion failures and preserved the existing renderer pass. This is missing preflight behavior at an executable public seam, not an import/setup error. Before implementation, corrected malformed-JSON setup to preserve valid binary bytes and added a caught legitimate-load failure followed by success. The complete pre-guard run produced 58 assertion failures, then implementation produced 59 passes. No missing-function capability check is claimed as full proof.

| Gate | Directory under `Temp/` | Result | `inputs.json` SHA-256 | `report.json` SHA-256 |
| --- | --- | --- | --- | --- |
| Initial Red | `slopstop-s7-native-origin-red-2026-09-10T22-37-08-527Z` | 57 failed, 1 passed | `c293d5b8c023f12b19db439c6cff1ecc3aba5841acd22257bd99c4d739789218` | `983b438c18adced37ced68564a2b5040452a68b08043fe9be8f198549f43ce24` |
| Complete pre-guard Red | `slopstop-s7-native-origin-complete-red-2026-09-10T22-37-48-477Z` | 58 failed, 1 passed | `3d3c68570caa43298ffd8f746d361a775fc88266c919c1f45e594b63ff59a581` | `fb13282f8263b99e57464bbae0a0357e5fac6ffec50cb27f6fbbac972ab1120f` |
| Focused Green | `slopstop-s7-native-origin-green-2026-09-10T22-38-58-965Z` | 59 passed, zero skips | `4a430530deb5690bde235f9248a0cdfbba7d4977f7e0c27e4e62e97ca429b263` | `2e080fc0a16fab2220b2804038a4408d57650fafa13988bc96f292fe33b95e90` |
| Initial types | `slopstop-s7-native-origin-types-2026-09-10T22-39-23-194Z` | exit 0 | `e56521c5242089588d11b5327b8f41e819b9f0d7e9d07b04beabaccd46ce9397` | `93401a58d380ce4b4f3d019120594b65f91edd076db9c13332c0fcd35c49c99d` |
| Initial Biome | `slopstop-s7-native-origin-biome-2026-09-10T22-39-44-848Z` | formatting findings, exit 1 | `f47f957ee6f6329a9ade7cd3e6d194e1c4090469c21602f449c941b87380793d` | `2a7cfd9c3597e31fd43523981562a341fb09d9cb42e4d594b21041301c18989e` |
| Final regression | `slopstop-s7-native-origin-final-regression-2026-09-10T22-43-23-007Z` | 1141 passed, 0 failed, 2 existing skips | `8843b52b02a4de90f50ef6580c43a08aae2b3df6f0a5c99ea356c4dcacccccb0` | `30107219ce7ced501adc4aa0a25dad5befdb95bb78debce4f8881cce83ede1ac` |
| Final Biome | `slopstop-s7-native-origin-final-biome-2026-09-10T22-43-36-344Z` | exit 0, no findings | `a6943dc077fbc752a100b6569fcc252a334d3a0394d3c256fd0c7550dd0efade` | `93401a58d380ce4b4f3d019120594b65f91edd076db9c13332c0fcd35c49c99d` |
| Final Desktop types | `slopstop-s7-native-origin-final-types-2026-09-10T22-44-38-384Z` | exit 0 | `81d648058915c07b0ac34555d147ba67a3b5acfb506c028f5ae2f1b8711303e9` | `93401a58d380ce4b4f3d019120594b65f91edd076db9c13332c0fcd35c49c99d` |

Focused command selects only `apps/desktop/src/main/package-smoke-verifier.test.ts`. Final regression additionally selects `packages/protocol/src`, `package-smoke-authorization.test.ts`, `project-storage-package-smoke.test.ts` and `project-storage-bridge.test.ts`. The 2 skips are the unchanged authorization file-symlink EPERM limitations; all 58 new native unit cases ran. Compiler command is `pnpm --filter @slopstop/desktop typecheck`; Biome checks only the two owned TypeScript files. After Green, the only source edits were formatter-derived whitespace, applied with `apply_patch`; no negative was added after its guard.

### Quality checks and documentation

- CodeScene OAuth configuration had no token/on-prem/account overrides; installation verification passed 5/5. Both owned files scored **10.0, no findings** before changes, after Green and after formatting. Final safeguard passed with 8 eligible/checked source files, 9 modified paths and `results:[]`. It assessed the cumulative dirty tree without staging. This is automated Code Health evidence, not independent candidate approval.
- No Sonar analysis tool is exposed to **this session**; resource discovery exposed no Sonar resource. Sonar MAIN/TEST analysis is unexecuted here and remains available for the parent to perform in its own session. No service/container/tool installation was attempted and no global Sonar cleanliness/unavailability claim is made.
- TypeScript and Vitest skills were loaded. Current Context7 Electron documentation was resolved as `/electron/electron`: [ASAR archive behavior](https://github.com/electron/electron/blob/main/docs/tutorial/asar-archives.md), including separate unpacked files, virtual realpath behavior and dlopen's physical-file requirement. Node 24 documentation was resolved as `/websites/nodejs_latest-v24_x_api`: [process.dlopen](https://nodejs.org/docs/latest-v24.x/api/process.html#processdlopenmodule-filename-flags), including module/filename/flags forwarding and require-based native loading.
- The initial Context7 command in the repository failed `EBADDEVENGINES` because global Node is 24.20.0 versus the repository's 24.19.0 requirement. Retried documentation commands only in the approved Temp directory; project dependency definitions and installed packages were not changed. Automatic write hooks reported Node unavailable and were not counted as passing. LSP write diagnostics reported stale duplicate/parse locations; the actual captured compiler and Vitest commands both passed.

### Exact final source and native pins

| Owned source | Lines | Raw SHA-256 |
| --- | ---: | --- |
| `apps/desktop/src/main/package-smoke-verifier.ts` | 266 | `9dd97d9e8c453d648f9e91a2730b9c1ba5b206e8bddeb3de8255b6620542fa80` |
| `apps/desktop/src/main/package-smoke-verifier.test.ts` | 436 | `1c86ced3f104b5cefc0d86f77e72af56733f435de2d3989ad333d8f0d3ccb357` |

The production pins are the approved Architecture's SHA-256 base64 literals, not hashes learned from arbitrary test input. Read-only inspection of the installed v1.5.1 prebuild bytes confirms the equivalent hexadecimal values below. The Windows and Linux x64 values also match the retained S3 published/source-stage proof; this inspection does not rerun that proof.

| Executing target | Published `fs-native-extensions@1.5.1` binary SHA-256 |
| --- | --- |
| `win32-x64` | `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4` |
| `linux-x64` | `13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3` |
| `linux-arm64` | `895dd0dca09438454f28bba250bcafa3e69c937fe97ea46b1b6212dc3a81315c` |
| `darwin-x64` | `973e4b2addf30901b955c75626ac153d3a37cebcfa621375bcd490f199884c8e` |
| `darwin-arm64` | `1e93b74e556b7d1767d57fabb197d9d1df5641453967170537278f72ed46f018` |

The native-origin owner and focused unit group are complete for parent review. No Windows/Linux package pass, complete S7 acceptance, independent approval or production-native compatibility is asserted.

## S7 runner continuation — incomplete inventory checkpoint

### Authority and preserved inputs

The current instruction authorizes the remaining S7 runner/main composition in the same workspace, after the six predecessor commits, with no Git writes or parallel agents. S7 remains one incomplete phase; this checkpoint is neither a separately accepted subphase nor a claim of independent review. Parent owns final independent reviews.

HEAD is still `77f7667ea89b521472660d3e1bea7e85fbf5168b`. Initial serial capture is `Temp/slopstop-s7-capture-2026-09-10T22-51-22-537Z`, inputs SHA-256 `e47c00157b8fa338211a40987a1593a5b08ea3f1d9a8b2784ff89f332dbdeb2d`. All 28 bindings verified; combined contract identity remains `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`. Before this evidence append, every pre-existing captured repository file still matched its original raw hash. Only the two new runner files were added. In particular, main, native owner, protocol, product Writer/coordinator/repository/runtime, packaging and fixture implementation remain byte-identical to the initial capture.

### Implemented and exercised, not complete

The exported `runCanonicalWriterPackageSmoke` now drives six independent scripted peers: production holder, contender, production takeover, audit fixture, stale fixture, and a separate production Q replacement. It calls the existing native preflight before fork; owns a returned utility before setup; validates product event/cause/per-process sequence and smoke control correlation; records PID and observed exit independently of EOF; performs PID-qualified hard kill; compares original replay receipts; and retains primary versus secondary cleanup failures. Cleanup attempts are concurrent while commands/tests themselves run serially.

The final focused suite has **76 passing tests: 3 positive scripted cases and 73 negative cases**, zero skips. The positives are immediate full sequence, deferred full sequence, and same-Project source-qualified takeover after exactly 100ms. These are discrimination/composition tests only, not actual native, SQLite, OS crash release, or packaged fixture proof. All process.kill calls in this suite are intercepted and checked against fake child handles; no actual user process is killed.

**Incomplete obligations:** main private admission/quit/reporting wiring and its public startup tests are not implemented. Complete just-before/at/after deadline matrices, exact output-boundary positives/binary cases, additional spawn/late/cross-peer/fixture lifecycle variants, and the pre-guard reachability proof for every planned negative remain incomplete. The selected existing tests were rerun after the addition; no separately captured pre-change ordinary-main startup characterization was run. Do not infer those obligations from the existing passing subset or retroactively classify already-enforced cases as original Red.

### Actual chronological evidence

All directories below are beneath the approved Temp root. Each uses the unchanged `slopstop-s7-proof.mjs`, captures 349 complete raw input files before execution (including both untracked runner files), verifies all bindings and input hashes after execution, retains verbose output plus JSON, and uses one worker and the existing 768-MiB limit. Installed dependencies are excluded as before; their manifests and lockfile are captured.

| Checkpoint | Directory suffix after `slopstop-s7-` | Actual result | inputs.json SHA-256 |
| --- | --- | --- | --- |
| Initial executable export scaffold | `runner-transport-red-2026-09-10T22-56-10-756Z` | 20 failed; runner returned passed without entering peers. Capability evidence only, not actual contradictory transport reachability. | `14c765d73f7409e62696f44ebf80d1df6c6f97bf940ececca6804acde431edda` |
| Transport scaffold reaching peer | `runner-transport-reachable-red-2026-09-10T22-57-28-651Z` | 20 failed; actual public sends/errors exercised before discrimination. | `f7a2a993e40f33d20e3c0823b3d5f74d018b237d1a410cab140e6139c2a9c222` |
| Initial owner negatives | `runner-owner-reachable-red-2026-09-10T22-58-22-570Z` | 29 failed. | `114779e0763a9ac0e525396f71f67948b35fe48603fc2815f654ea9e94c01a16` |
| Owner Green | `runner-owner-green-2026-09-10T23-01-17-807Z` | 29 passed. Full sequence still explicitly incomplete. | `5026301cf602eadab4803d640b50b4ed9f53b0603c4b45249f365bd2fba1fc7a` |
| First full-sequence positive Red | `runner-sequence-positive-red-2026-09-10T23-03-38-159Z` | 2 failed, 46 unselected; incomplete runner failed instead of completing both full sequences. | `adfdf429870c478667014431e91cebfcab840e366ccc9432739ba4aae1b17e60` |
| Positive choreography, semantic negatives before their guards | `runner-sequence-reachable-red-2026-09-10T23-06-03-337Z` | 43 passed, 14 failed. Both complete-sequence positives first passed here; incorrect observations could still advance. | `84459c1d7122824b15a4fe9d24110fe36887bd55c2bd4ff5e11a33389f290f88` |
| Expanded semantic matrix before remaining observation guards | `runner-semantic-complete-red-2026-09-10T23-07-25-491Z` | 48 passed, 28 failed. “complete” in this command label refers to this authored subset, not the full S7 contract. | `63eb659c463360820eaff9ea772d492915160a78314117aff254d44b131e7d35` |
| Semantic Green | `runner-semantic-green-2026-09-10T23-08-49-233Z` | 76 passed. Temporary choreography casts/scaffold removed. | `7646eb89e2b9160f7cbdb389012a7c64631ad3a2f0e4a14cc64cbf51431093ec` |
| After local refactor | `runner-refactor-regression-2026-09-10T23-15-20-534Z` | 76 passed; report SHA-256 `f9a503673ae6d5e421d30f499a813acf4b5c40df1a9b9c56908cae995825fed5`. | `09a104907ac35e2af2195406705e75989cb07b6eb08d74656a38f935a166895c` |

All focused commands select `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`; the positive-only command adds `-t "completes all six"`. The wrapper supplies the previously documented worker/report options. These records are actual observations, not a certification that all required pre-guard families have been completed.

### Checkpoint checks, corrections, and remaining gates

- Current Electron docs were resolved through Context7 `/electron/electron`; actual installed package and `electron.d.ts` were read and confirm **43.4.0**, postMessage returning void, undefined PID before spawn/after exit, and nullable streams. Additional inherited event listeners use the Node EventEmitter interface rather than changing Electron types. Context7 `/vitest-dev/vitest` supplied async fake-timer and class-mock documentation. All documentation npx calls ran in approved Temp; no repository install occurred.
- Initial scaffold bootstrap field names were corrected to the actual `harness.connect` schema before the first test execution. Initial TypeScript feedback on Electron event overloads/void comparison was corrected using inherited event typing and an unknown send result. Missing mock return narrowing was corrected. The captured Desktop typecheck passed, not merely LSP feedback.
- Desktop typecheck: `Temp/slopstop-s7-runner-desktop-types-2026-09-10T23-14-51-884Z`, `pnpm --filter @slopstop/desktop typecheck`, exit0; inputs SHA-256 `8f49531803f254bb2cfcaa3be148208a2880c40d8dc9a5ea34af36e383b8b3a0`.
- Regression: `Temp/slopstop-s7-runner-checkpoint-regression-2026-09-10T23-15-43-968Z`, **1217 passed, zero failed, 2 existing Windows EPERM symlink skips**. This preserves the prior 1141-result qualification and adds 76 cases; it is not global Green. inputs SHA-256 `0c86dabdcce8ad9c720eaf8289fc3f586dc66a8aa7ec8d6f54f11af1457bb5a8`, report SHA-256 `9136b8f9975becedb06879787f749eb2e55e2ce3e04ca288b20abf61630b9960`. Selects `packages/protocol/src` and desktop authorization, ordinary smoke, Storage bridge, native verifier, and new runner tests.
- CodeScene installation/authentication 5/5. Main baseline **9.68**, pre-existing complex method `runPackageSmokeIfReady`; main was not edited. Runner initially **9.09** (spawn complexity, exit conditional, command arguments), test **8.22** (nested peer setup and variant branches). Local helper extraction within the owned files addressed all reported findings: final current runner **10.0**, test **10.0**, no findings. Test intermediary **9.68** was not represented as final no-smells. Formatting or subsequent main/test work requires fresh review. No independent review or acceptance is claimed.
- Biome checkpoint **failed**: `Temp/slopstop-s7-runner-biome-checkpoint-2026-09-10T23-16-05-114Z`, inputs SHA-256 `40494c58db4f98d179eba06602af3ddfb942d4ed450ad5aaf52cb940df0a3c47`. It reports formatting in both files, import ordering information, and a test string-concatenation style finding. No formatting gate pass is claimed.
- Sonar MAIN/TEST analysis is unavailable to this session: no exposed Sonar analysis tool. No service was installed. Protocol/Harness/boundary terminal checks, actual main characterization, complete runner bounds, and packaging proof are pending at this incomplete checkpoint. No builds, package/native crash execution, global/deep checks, mutation, Git writes, or parallel agents ran.

### Inventory decision required before continuation

Read-only formatting through the installed Biome executable measured **848 formatted source lines** and **901 formatted test lines**, before main startup/quit/reporting tests or the remaining complete deadline/ownership matrix. Current raw files are 417/513 lines; compressed formatting is not a solution to the strict fewer-than-1000-line requirement. The additional main setup and behavioral families cannot be fitted into the remaining 98 test lines while retaining meaningful public-seam assertions and readable helpers.

Requested parent inventory extension, **not yet created**:

1. `apps/desktop/src/main/canonical-writer-package-smoke-test-peers.ts`: test-only scripted process/port, fixed observations and scenario helpers. Production runner never imports it.
2. `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts`: actual `main.ts` dynamic startup through mocked public app/process ports, including ordinary characterization and private quit/reporting matrix.

Keep runner source and public runner assertions in their existing owned files, complete every remaining family, format, rerun types/tests/Biome/boundaries and CodeScene, then return the same whole S7 phase for parent independent review. This request does not authorize reducing tests, changing contract limits, or starting packaging/fixture groups.

### Current raw identities

| Path under `apps/desktop/src/main/` | SHA-256 |
| --- | --- |
| `canonical-writer-package-smoke.ts` | `bb45c706259dc2935c004b3232cd5c735d515aba74298cc51ad9438e548ad90b` |
| `canonical-writer-package-smoke.test.ts` | `3f7f1acc84f4db1e479d9a379bb0080ef8ae1014d46eab5fef2ea590e24fd239` |
| `main.ts` (unchanged) | `0afda08d8cdf2f14e9e99fa234ac9aa7faa4027c2bb8642837b0da53f7705429` |

## Parent-authorized continuation — runner/main source checkpoint

### Provenance and scope

The parent explicitly authorized `canonical-writer-package-smoke-test-peers.ts` and `canonical-writer-package-smoke-main.test.ts` as necessary test organization within the existing human-authorized S7 build. **The exact filename extension is the parent's decision, not a newly asserted direct human filename approval, domain decision, or accepted subphase.** It resolves the preceding inventory request. Parent continues to own independent final review and acceptance.

This continuation completes the requested source runner/main composition and its scripted checks for S7.4/S7.6/S7.11/S7.12. It does not complete all S7 packaging/fixture obligations. The five owned TypeScript files are the runner, its original test, the new test peer helper, the new actual-main startup test, and `main.ts`. No protocol/product/native-owner/Forge/Vite/launcher/fixture implementation was added in this continuation. Future `harness.cjs` and `writer-proof-fixture.cjs` remain built-path strings, not imports from another app's source.

HEAD and the 28 original bindings remain pinned to the same predecessor and contract identity. Commands ran serially; no agents, real process kills, builds, packaging, native crash runs, mutation, installs, or Git writes were performed. Standard formatter output was obtained through stdin previews and applied with `apply_patch`; previews are editing assistance, not passing gates.

### Implemented main composition

- Authorization still runs first. An authorized writer scenario records its abort owner before waiting for readiness, so an early quit cannot enter ordinary shutdown while readiness is pending.
- After `app.whenReady()`, the private branch returns before ordinary application model/log setup, logging, Sentry initialization, security/session registration, supervisor, BrowserWindow and IPC setup.
- `before-quit` prevents default and aborts that owner. `window-all-closed` cannot authorize ordinary shutdown for the private owner.
- The actual `main.ts` module is dynamically started in tests through mocked public Electron/app/process dependencies. Its private functions/classes are not directly invoked. Existing authorization tests retain the real authorization/marker matrix.
- Success and known failure flush exactly the fixed two-line stderr report before app.exit. Unconfirmed cleanup chooses the unconfirmed line. Startup/runner/write exceptions choose the unconfirmed + `writer-internal` fallback; a throwing fallback still exits1. Returned cleanup metadata is not printed. The tests include all 28 fixed stage labels (transport in the outcome table and the other 27 in the explicit stage table), no stdout, held writes, and early quit.
- Six ordinary-main characterizations passed before the first main edit and again afterward: all three existing smoke scenarios plus unpackaged, prototype, and ordinary quit ownership. Their earlier malformed-ready mock failures were setup errors, not product Red.

### Runner matrix and source correction

The initial 76 tests remain in the suite with their causal evidence above. Cases already enforced by existing guards are retained Green characterization, not relabelled as fresh Red. New cases cover:

| Family | Public observations and exact obligations exercised |
| --- | --- |
| Process ownership/admission | Returned handle retained through channel/start/transfer failure; throwing fork without a fictional handle; no spawn, exit before spawn, spawn without PID; invalid/fractional/unsafe/self PID before port admission; replacement PID reuse; another owned child's error failing a healthy pending peer. |
| Product correlation | Protocol4, event, causation and first/contiguous sequence; malformed and valid request.failure/system.failure; wrong Project/epoch/Command/result metadata; immediate/deferred responses, duplicate, unsolicited-start, late-old-peer, cross-peer causation, late-after-timeout, child disconnect, direct parent messages, port error, thrown/false sends. |
| Fixture correlation | Both fixture processes' transfer/send failures; all five controls with wrong proof/request/step/number and deferred duplicates; old/replacement epoch and executing-native-target mismatches; exact audit inputs carry the captured activations and original receipts. |
| Crash/takeover | Recorded still-matching actual handle PID and SIGKILL; no holder port close before crash; contender exit precedes kill; thrown/absent/changed/self PID, exit0/no exit/missing EOF; valid read-only retry after100ms with the exact source epoch; no retry for malformed, broken, unavailable, safe-mode, not-registered, stale-source or wrong-source results. |
| Absolute bounds | Actual spawn/response at9999/10000/10001ms; whole proof89999/90000/90001; takeover14999/15000/15001 including2999ms holder EOF plus9999ms replacement spawn before acquisition; clean exit4999/5000/5001; independent EOF2999/3000/3001; failed cleanup exit9999/10000/10001. Matching events and owned terminal observations are required; timer advancement alone is not success. |
| Output/abort | Exactly65536 versus65537 bytes for binary, text and multibyte chunks; UTF-8 overflow in either stream; null/error/missing EOF in either stream; error remains permanent despite subsequent EOF; abort before entry, spawn, held response, retry, clean stop and every fixture control. |
| Cleanup metadata | Exact process0 transport/throwing-kill/later-nonzero-exit/missing-stdout oracle; unconfirmed listeners retained; concurrent kill attempts while another child never exits; six-owned-child failure with8 exact frozen entries and exact per-process ordering; <=24 structural bound; cleanup port-close exception retained separately. |

The expanded matrix found an actual missing admission guard: fractional PID1.5 and unsafe integer9007199254740992 allowed four product requests before eventual refusal. Both exact negative inputs were present and reached the public spawn seam in the captured Red. The minimal fix uses `Number.isSafeInteger` at spawn admission and hard-kill validation. Neither case now admits a port/request or attempts to kill the invalid PID.

The first whole-proof89999 test incorrectly advanced one still-active10000ms step by89999ms. That was a test setup/oracle-placement error, not a product defect. The corrected test advances each preceding valid response by4500ms, keeping each step and takeover valid, then supplies the final actual response at the selected overall boundary. No production deadline was widened.

### Chronological continuation runs

Every listed command has its own retained pre-run `inputs.json`, raw copies, `output.log` and `report.json`. The original proof wrapper captured351 inputs after the two authorized test files were added. It was then extended only to retain the installed Electron43.4.0 `electron.d.ts`/package manifest and an explicit verification-selection overlay, yielding353 inputs. Capture remains one file at a time; no source-tree RAM aggregate or file mask was introduced.

The final overlay explicitly includes `canonical-writer-package-smoke-main.test.ts` in the S7 verification selection and identifies the test peer helper. Its SHA-256 is `007fa44444461726788457f4cda184e26c7d3b7aa786f5e864be0ae2939b49f7`. Captured wrapper SHA-256 is `a2d7e72c3e0c10c357097dd790906eb87763411bdca8d6c46049fa1a42de8fab`. Existing historical snapshots are not reconstructed or relabelled.

Directories below are relative to the approved Temp root and have prefix `slopstop-s7-`.

| Run | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `main-ordinary-before-2026-09-10T23-26-27-151Z` | 3 passed,3 setup failures: mocked ready event omitted required attempt/harnessVersion. | `dccfa23e6d262df87c1518644aca6d5fc524dcaee7a9b7692a3f0155d2f54474` |
| `main-ordinary-before-corrected-2026-09-10T23-27-46-498Z` | 6 ordinary characterizations passed before main edits;12 private cases unselected. | `5637ca2d5d0577e297a8e99531032ace3173a0ad18f7c1abaca2df4a46fb58e8` |
| `main-private-red-2026-09-10T23-28-00-726Z` | 11 failed,1 passed,6 unselected: old main entered ordinary startup and lacked private outcomes. | `1f771551bb1b89cbc255e9e329b1c1fa49773944cbb856728f42fd423410fe23` |
| `main-reporting-reachable-red-2026-09-10T23-28-41-104Z` | 11 failed,7 passed: private runner branch now entered, but fixed reporting/quit ownership was absent. | `6efadefcdb9d2959fb7f1e64b5de50bf98f83abd97a542a0b2da968b6792f842` |
| `main-private-green-2026-09-10T23-29-23-059Z` | 94 passed: existing76 runner +18 actual-main cases. | `e63d8926a82da1abb60fb9e6549124ba53ae19dadb7c8f13a93e71e64d2a2b44` |
| `runner-complete-matrices-before-guards-2026-09-10T23-34-17-044Z` | 142 passed,1 whole-proof test timing setup failure described above. | `1768a5c839352f748be181bfd465e3e50f3cf76cafa82bff4b0fecdb42960b4c` |
| `runner-matrix-pid-red-2026-09-10T23-36-25-728Z` | 152 passed,2 expected PID admission failures: observed4 sends instead of0. | `e9ce3f16451479b35710523eaaa0c63c4be70cad7a1dddae25450bebabe7bebe` |
| `runner-matrix-green-2026-09-10T23-37-01-639Z` | 154 passed after the safe-integer guard. | `d1376bed39b9c5ac097e5f13c7326d61e31c2edd5a009e2368cd5e1c6371f1ba` |
| `runner-main-review-regression-2026-09-10T23-56-54-908Z` | 184 passed after review coverage/refactoring, including all fixed main failure-stage labels. | `ef4efe432eddd0d74710d53849b85f34e3cafd82aecd2fa8f117f232bede897c` |

Main Red runs demonstrate missing public composition/reporting outcomes, not fabricated import errors or individually reconstructed historical first-trigger failures. Callback-failure variants were authored in the pre-implementation test and exercised by the resulting reporting implementation. Additional already-enforced stale-source and stderr cases are review characterization. The detailed raw inputs allow parent review of that distinction.

Focused commands select the runner and/or main test files explicitly. The first ordinary command adds `-t "ordinary main characterization"`; first private Red adds `-t "private main composition"`. Existing serial worker/JSON/verbose options are unchanged. A blocked `ctx_execute_file` read of an external Temp log was retried using the approved native Read tool; it was not a test or product failure.

### Terminal source-bound verification

The exact final regression command is:

`pnpm exec vitest run packages/protocol/src apps/desktop/src/main/package-smoke-authorization.test.ts apps/desktop/src/main/project-storage-package-smoke.test.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/package-smoke-verifier.test.ts apps/desktop/src/main/canonical-writer-package-smoke.test.ts apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=json --outputFile=<fresh-evidence-directory>/report.json`

Result: **1329 passed,0 failed,2 retained Windows EPERM symlink skips**. Of those, **143 are runner tests and45 actual-main tests**,188 added to the previously qualified1141. The runner count contains9 all-success cases,131 expected-failed-proof cases and3 mixed output-boundary tests (each exercises one accepted boundary and one rejected overflow). Table cases with an internal variation loop are not counted as extra Vitest tests. The45 main tests contain6 ordinary characterizations,1 exact success-report case,35 failure/reporting cases and3 quit-ownership cases. Initial full-sequence positive/negative counts and their first observed results remain in the preceding chronological section; this terminal regression does not replace them.

| Gate / directory suffix | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `runner-main-terminal-regression-2026-09-11T00-16-34-720Z` | 1329 passed,2 existing skips. report SHA-256 `3996d26aa93b30ae441d3531da706a3baa0166663dd2a013c511363d67ba5ec1`. | `373114b29bfcbebd3e177846a706a705aa8f864a2a2ccd5eb84eb5c75c3d1b93` |
| `runner-main-terminal-biome-2026-09-11T00-16-50-759Z` | `pnpm exec biome check` on all five owned files: exit0, no fixes/findings. | `71e082fc8f1d6d8c4696850dbe4d306a482d49a5a59026ec2fe65e86dbcf6721` |
| `runner-main-terminal-desktop-types-2026-09-11T00-17-23-937Z` | `pnpm --filter @slopstop/desktop typecheck`: exit0. | `17ae30eac93ffbfdc6d3292c5914446818826b3effae080d1defacc109364493` |
| `runner-main-terminal-protocol-types-2026-09-11T00-17-37-433Z` | `pnpm --filter @slopstop/protocol typecheck`: exit0. | `0b7bfa936f580811e5e2a820b1a93eee7775aaf7a3f0cb75b86048542bda3589` |
| `runner-main-terminal-harness-types-2026-09-11T00-17-47-343Z` | `pnpm --filter @slopstop/harness typecheck`: exit0. | `61a9729a951cf958c527fec283b14d0fa3de61ba99b64af2dff830a33853682c` |
| `runner-main-terminal-boundaries-2026-09-11T00-17-59-307Z` | `pnpm check:boundaries`: exit0,222 modules/647 dependencies, no violations. | `78a10e3c94212e7cb2ccd0ff5bc3f3e4538727e21445b3e708daabb29d42060b` |

All non-Vitest report hashes in that table are `93401a58d380ce4b4f3d019120594b65f91edd076db9c13332c0fcd35c49c99d` (the exact successful command-envelope bytes). Final live source hashes were compared against the **already retained pre-run copies**, not used to manufacture a posthoc source identity for earlier tests.

### Final quality and preserved limits

- Detailed CodeScene on the final exact files: runner10.0, runner test10.0, test peers10.0, main test10.0; no findings in those four. Main9.68, with only the same pre-existing `runPackageSmokeIfReady` complexity10 finding as its baseline. No new smell or threshold change was accepted.
- The global CodeScene safeguard passed: `quality_gates:"passed"`, `status:"no-issues-found"`,13 eligible/checked source files,14 total modified paths, empty results. It ran against the frozen source that passed the terminal gates; it is not independent parent review.
- Intermediate CodeScene findings were fixed by coherent helper extraction: peer fault setup, semantic-case data, grouped denial observations, main reporting exception setup and the initial holder sequence. Physical formatting exposed the sequence's77-line method; extracting its initial holder preparation resolved that finding. No tests or assertions were removed to lower a score.
- Earlier Biome failures remain recorded as failures. Formatting, imports and the text concatenation finding were corrected. The window mock uses a genuine class rather than accepting a formatter conversion to an unconstructable arrow. The final gate passes all five files.
- Sonar MAIN/TEST analysis is **unavailable in this session's exposed tool scope**, not asserted globally unavailable. No replacement service or installation was attempted; no Sonar clean result is claimed.
- Independent final reviews/acceptance remain parent-owned. Actual Windows/Linux native compatibility, packaged crash release, SQLite/audit/stale-Writer fixture execution, Forge/Vite multi-entry packaging, external launcher, and combined S7 validation remain pending for the later authorized groups. Scripted peers do not satisfy those proofs. The two EPERM cases remain pending, and this selected regression is not global/deep Green.

### Exact terminal source identities

These hashes and physical line counts come from the final regression's pre-run retained file copies and match the live five files after all source checks and CodeScene review.

| File under `apps/desktop/src/main/` | Lines | Raw SHA-256 |
| --- | ---: | --- |
| `canonical-writer-package-smoke.ts` | 853 | `99473a8f4ae4c4a7e5139a8c6351da9e687b6a0d70af3f658d30a8b28cb40dd8` |
| `canonical-writer-package-smoke.test.ts` | 968 | `937bf1941f91ef30575476da3eb3a52cb923ecc6434c287dc0f425c4cd7be79f` |
| `canonical-writer-package-smoke-test-peers.ts` | 479 | `4402e9cb199393c5896e00af1ee569f15cfbc5d0d65d7c95a58ee101d74ff68c` |
| `canonical-writer-package-smoke-main.test.ts` | 387 | `ef7603297a67fe89028d0874b13bff11252d4ba56550351e67dac9e152973535` |
| `main.ts` | 414 | `746627d8651c7cdbc876c8908b37a56c83ca440c4985690ff56569eb2e0201fa` |

## S7.8–S7.10 fixture and S7.14 multi-entry source checkpoint

### Authority and identity

- This execution implements the independently owned fixture, its protocol-driven integration tests, and the two approved build declarations in the existing workspace. HEAD remains `77f7667ea89b521472660d3e1bea7e85fbf5168b`. No Git write was performed. Parent retains independent final review and acceptance.
- The additional `canonical-writer-package-smoke-fixture.ts` is the **parent's implementation-organization choice** within the existing S7 build authorization, not a newly asserted human literal-filename approval. It contains the test-owned Storage/Writer/audit implementation; the separate entry owns admission, transport, and independent native observation.
- Initial capture: `Temp/slopstop-s7-capture-2026-09-11T00-34-59-593Z`, inputs SHA-256 `80e7d6f56b6314434382020ef031d35b75bafcdb2b4fd5c35ebbe5bf6064175a`. Every completed wrapper run verified the existing 28 contract bindings. Contract identity remains `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`. Original design validation also passed without stamping in `fixture-contract-validation-2026-09-11T01-38-26-841Z`.
- The production Harness sources, command registry, schema, repository, Writer, coordinator, main runner, native main verifier, and protocol were not edited by this packet. The two configuration edits change only entry declarations and entry-specific output naming.

### Implemented interfaces and observations

`canonical-writer-package-smoke-entry.ts` exports `startWriterProofController` for source tests, a narrow `WriterProofPort`, and `verifyFixtureNativeOrigin`. The actual utility entry registers the parent message listener without starting Storage or a proof. On the one validated start it receives the one transferred Electron port, verifies physical nonoverlapping bootstrap roots, performs the native preflight, and only then dynamically imports the fixture implementation. Default production bootstrap never imports this entry or its test definition.

The controller accepts one mode, one pending control, and the exact protocol-owned order. It rejects repeated starts (including closing newly transferred ports), malformed/cross-proof/reused/out-of-order controls, pipelining, early close, and work/resource failures with fixed `Writer proof fixture failed.\n` and exit1 after owned cleanup. Successful final results follow resource cleanup; the result port remains open until parent close, which is the only successful exit0 path. Fixed stderr failure reporting is awaited before actual process exit.

The helper exports `createWriterProofFixture(roots, decorators?)`. Decorators are test-owned wrappers around the public client, Storage owner, and lease resources. Default construction always uses real owners; it does not disable production quarantine or substitute a fence. The fixture's internal data exceptions are caught at the controller and are never printed as private SQL/row/path output.

- **Audit:** real `owner.open(P)` followed by a separate worker-backed SQL client using the owner's selected generation path. No audit activation, registry preparation, or settlement occurs. All 11 current canonical tables are included in the exact table inventory. This implementation's migration authority is `schema_metadata` (`canonical`, format1/schema2, `0001_canonical_project_writer`); no separate `__drizzle_migrations` table is declared or silently allowed. The fixture validates complete nonempty rows, cross-row bindings, immutable receipt metadata, independent literal/node-crypto command fingerprints and rejection details hash, initial/recovery handoffs, abandoned recovery, released fence, foreign keys and integrity, then compares a second full row snapshot before closing clients/Storage and emitting the strict audit result.
- **Live stale:** real Q creation/request114, activation Storage session, native lease, generation1 repository and real Writer retained independently. Only this test fixture registers strict-empty `conformance.writer.noop`. Lease release waits for real unlock and file close without retiring generation1. Source tests use an independent public Storage/lease/repository/Writer factory to acquire generation2 while the old Writer remains alive. The fixture validates replacement authority from all rows, settles C3 directly through the old Writer, verifies exact stale-writer diagnostic and four zero work counters, requires stale refusal of `Writer.close` at fixed UTC, and compares all rows including the close attempt. Final cleanup uses direct retained resources and never retries old Writer.close.
- **Native observer:** independent approved five-target v1.5.1 hashes, exact virtual JS entry/manifest, exact physical unpacked binary metadata and hash, exactly one successful delegated dlopen, both lock API functions, restored observer on success/failure. It imports no Desktop source. The protocol metadata owner is unchanged.

### Actual source test coverage and chronology

Final suite has **147 passed, 0 failed, 0 skipped** through real Node MessageChannel ports and real worker-backed database resources. This is not an Electron utility-process or packaged proof.

| Group | Vitest cases | Qualification |
| --- | ---: | --- |
| Correct seeded audit | 1 | Exact independent output after real Storage/SQL inspection |
| Legal database corruptions | 22 | Real constrained SQL updates/deletions or extra table, exit1/no audit result |
| Constraint-impossible field corruptions | 67 | Public SELECT decorator after real open; each named column checkpoint must be reached |
| Missing/extra row matrices | 10 | Each case runs both missing and duplicate rows; 20 variations, not 20 Vitest cases |
| Live stale Writer positive | 1 | Real native lease and independent public factory in the same source test process |
| Incoherent replacement | 2 | No replacement and wrong epoch |
| SQL/client/lease/Storage failures | 4 | Actual public resource wrappers, fixed failure and no corresponding success |
| Admission, initial controls, repeated start, early close, pipeline, after-final | 16 | Public controller/ports; includes rejection and newly received port cleanup |
| Held real-resource early close | 4 | Initialize/create, release/lease, attempt/SQL, finish/client close |
| Valid but misbound Storage result | 1 | Result schema is valid but request belongs to P/111 instead of Q/114 |
| Contradictory controls with valid replacement | 6 | Request reuse, repeated release, wrong mode, early finish, cross-proof, wrong step number |
| Native-origin unit discrimination | 12 | Disposable fake package JS plus published binary bytes and **mocked dlopen**; never actual native-origin proof |
| Closed P-owner to Q-create characterization | 1 | Source test preparation ordering |

The initial audit/field-corruption/initial-control matrix was written before fixture implementation. The fixture is test infrastructure under the recorded exemption: the initial correct/corrupt runs are proof-setup validation, **not product chronology Red**. Cardinality, native-copy, live-stale, held-stage, and expanded transition cases were added during implementation/review and are current discrimination coverage. **The requested full pre-implementation negative-matrix chronology is therefore not completely demonstrated.** These later cases are not relabelled as earlier tests; this remains a parent-review qualification, not an implicit waiver.

Two later concrete missing fixture checks have their own honest Test-Contract Red/Green pairs, not a fabricated product regression:

| Fixture check | Red directory suffix | Actual Red | Green directory suffix |
| --- | --- | --- | --- |
| Misbound creation result | `fixture-create-binding-red-2026-09-11T01-24-09-243Z` | Expected exit1, got no exit; valid wrong request reached owner boundary | `fixture-create-binding-green-2026-09-11T01-24-54-513Z` — 141 passed |
| Newly transferred port on repeated start | `fixture-repeated-port-red-2026-09-11T01-32-41-666Z` | Expected one public peer-close event, observed0 | `fixture-repeated-port-green-2026-09-11T01-33-21-193Z` — 141 passed |

All suffixes in this section have prefix `Temp/slopstop-s7-`. Initial standalone audit passed in `fixture-audit-first-2026-09-11T00-46-28-689Z`; the corrected initial full matrix passed102 in `fixture-audit-matrix-corrected-2026-09-11T00-48-40-250Z`. The expanded pre-final suite passed140 in `fixture-expanded-protocol-2026-09-11T01-02-39-928Z`.

### Retained failures and limits

- The first matrix exposed a **test decorator error**: spreading the real class instance lost its prototype methods, including close, leaving database files held. The decorators now delegate every public method explicitly. The resulting unavailable/EBUSY setup failures are not behavior Red. Their full outputs remain in `fixture-audit-matrix-2026-09-11T00-46-42-845Z` and `fixture-audit-one-corruption-2026-09-11T00-47-44-311Z`. Some disposable test roots from these unsuccessful teardown attempts were not removed by their failing afterEach; their exact paths remain in those logs.
- Source Q creation initially returned unavailable while the seed retained its read client. The actual intended ordering closes all P setup handles first. That corrected public characterization passed in `fixture-storage-closed-prerequisite-2026-09-11T00-55-50-387Z`; stale cases then passed in `fixture-stale-closed-seed-2026-09-11T00-56-22-171Z`. No production driver or ownership workaround was applied.
- `fixture-final-integration-2026-09-11T01-46-27-639Z` is **broken**: Vitest reported `Worker exited unexpectedly` after five passes. Its incomplete report is retained, SHA-256 `31ea7495572b1838a23843579ca0f562629b68c60116feab84435bc5a23902ec`. The worker-exit cause is unresolved; later passing execution is not a claimed root-cause fix.
- `fixture-final-integration-rerun-2026-09-11T01-47-46-899Z` was interrupted by the tool's120-second timeout while tests were still progressing. No JSON report exists for that interrupted invocation; its original inputs and raw output are retained, not replaced by a synthetic report. Read-only process inspection afterwards found no live process in the recorded wrapper PID27288 ancestry. The next invocation used a240-second **tool-call** allowance; no test, production, or packaged-proof deadline was changed.
- The six new controls passed separately in `fixture-final-controls-isolated-2026-09-11T01-47-22-187Z`. The subsequent whole147-case run completed successfully below. The prior unexpected worker exit remains an explicit reliability qualification for parent review.
- The 2 pre-existing Windows EPERM symlink cases and all historical S5/S6 qualifications remain unwaived. No investigation or substitute acceptance of those historical gates was performed.

### Source-bound gates

Every ordinary completed wrapper run captures356 full raw input files, including the new helper, entry, test and both build configurations. Commands, raw output and verbose/JSON results have unique directories. Capture and checks run serially with the same one-worker/768-MiB settings. The wrapper's selection overlay now explicitly names the fixture scope. Build inspection additionally captures its script and actual built CJS files/pinned staged binary/migration bytes (366 inputs); installed dependency trees otherwise remain excluded as before.

| Check / directory suffix | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `fixture-final-integration-complete-2026-09-11T01-50-51-345Z` | 147 passed; report `87559068b7d1717975be120e9f6a09c749750b6b64577071e7b9352cb7675811` | `5cc1ea92e147f0e0e0292a6a0cdb9b2b49abbbda3e9d7b94361b30716cf5576d` |
| `fixture-existing-s7-regression-2026-09-11T01-36-49-042Z` | 1329 passed,2 existing EPERM skips | `2ec18acabc832950318e87b9d11b8d03f1d53941d4a9b5d65aa4455087c3d5e3` |
| `fixture-existing-stale-regression-2026-09-11T01-37-04-676Z` | 45 existing fence tests passed,305 intentionally unselected | `83a7a36e2052a2c1b256c6940d4edabba19aa01a4263b64b4778198aca401ee3` |
| `fixture-expanded-harness-types-2026-09-11T01-53-16-132Z` | Harness typecheck exit0, includes final expanded test | `4a64408f9b9047a03233c4cb2d1f82c8bbf8a35c2207f3c5451e9c5ee961f1ab` |
| `fixture-final-desktop-types-2026-09-11T01-42-30-552Z` | Desktop typecheck exit0 | `e67fc3f11ed916d52a12f99a517e897605e4263de255f3d83383a820fc7978b7` |
| `fixture-final-protocol-types-2026-09-11T01-42-44-157Z` | Protocol typecheck exit0 | `b1b0b55bba8b4a4b39b7fbbd48f2ae8cefc3350d9614f542170a329780c5f8fd` |
| `fixture-expanded-biome-2026-09-11T01-53-31-724Z` | All five owned files, exit0 | `571751c1c57130aa414707a6588e94e5660d80d9ed6ab2c1e146d5303881cbf5` |
| `fixture-terminal-boundaries-2026-09-11T01-35-35-421Z` | 230 modules/699 dependencies, no violations | `f9421a2c83fa35bb10d37296de8cf737b696703acfcb5f71d772e73f9c74896e` |
| `fixture-terminal-architecture-2026-09-11T01-35-48-864Z` |3 architecture files,0 errors | `44fc902016f3a8176eca28272143cdb2e7615236a1b1682db4a8f01fadc427ba` |
| `fixture-terminal-build-2026-09-11T01-40-36-199Z` | Approved Vite harness build exit0 | `1f5c16aa6b413f8cefbba63ba49e9c246a2a9bbe4263b5422b03cdefbb450cb4` |
| `fixture-terminal-built-closure-2026-09-11T01-40-48-311Z` | Both entry graphs and staged native hash inspected, exit0 | `05dd7015f4c2fd31c961501a49fe663dfe95beb0b2f3d58896132b5c7d75a15e` |

Only the final six test cases were added after the selected existing regression, Desktop/Protocol types, boundary and build checks. Their consumed production/configuration files did not change; the final Harness types, fixture run and Biome include those extra tests. No global fast/deep/package/mutation pass is asserted.

CodeScene: both configuration baselines10.0; new files have no pre-existing source baseline. Initial implementation reviews found entry8.5, helper9.68 and test9.15. Coherent helper extraction, a closed fixture-step type and method delegation addressed the reported findings. Final detailed reviews are10.0/no findings for all five files, each below1000 normally formatted lines. Cumulative safeguard passed18 eligible/checked files with no issues. OAuth verification passed5/5 with no token/on-prem/account overrides. Sonar analysis is **unavailable in this session's exposed tool scope**; no full-byte Sonar result or global cleanliness claim is made.

### Wiring and next launcher inputs

Before wiring, `fixture-wiring-baseline-2026-09-11T01-28-22-660Z` verified both current declarations named only harness and inspected retained outputs `harness.cjs`, `main.cjs`, `preload.js`. This is read-only configuration/retained-output characterization, **not a fresh baseline build or behavioral Red**.

The approved build emitted `harness.cjs`, `writer-proof-fixture.cjs`, `src-Osz18vx4.cjs`, `project-storage-store-HwnyGHoZ.cjs`, and dynamically imported `canonical-writer-package-smoke-fixture-70fysFAk.cjs`. One unchanged staging plugin runs for the one multi-entry build; no second staging declaration was introduced. Actual parsed CJS import closure shows:

- Production: harness -> protocol/shared src and production Storage chunk; no fixture implementation.
- Fixture eager imports: fixture entry -> protocol/shared src; **no fs-native-extensions**.
- Fixture deferred imports: implementation -> production Storage/native dependencies, after preflight.

Staged `fs-native-extensions` version is1.5.1; Windows x64 SHA-256 is `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4`. All five approved hashes remain in the independent entry and match the earlier S7.3 pin table. Vite is8.2.1; it still reports `EMPTY_IMPORT_META` for the existing worker-client fallback. That warning was retained, not suppressed or represented as native/package compatibility proof.

For the next launcher group, use the existing runner's `writer-proof.connect`/one-port start and the unchanged protocol controls: audit.initialize/1 with actual[A1,A2]/[R1,R2], or stale.initialize/1 -> stale.release/2 -> separate production Q activation -> stale.attempt/3 carrying its actual activation/generation2 -> stale.finish/4 -> parent result-port close. Fixture success remains strict schema output, never an external pass line. Main's existing terminal/pass lines and external launcher's remaining exact validation/isolation/resource rules remain separate work.

Raw test data definitions are `seed`, `seedGenerations`, `seedSecondReceipt`, `legalCorruptions`, `tableColumns`, `nativeCopy` and the protocol-driving cases in the integration test. Successful per-test SQLite/native-copy roots under the OS temporary directory are removed after owned close. Reproducible source/configuration copies are in each evidence directory's `files/`; actual final compiled artifacts are in the terminal built-closure capture's `files/evidence/built/`. The external capture/inspection scripts remain `Temp/slopstop-s7-proof.mjs` and `Temp/slopstop-s7-fixture-build-proof.mjs`.

Real Electron utility-process ports, real packaged native-origin/load compatibility, cross-process crash/replay/audit/stale proof, Windows/Linux package execution, external launcher implementation, combined validation and parent independent acceptance remain pending. The incomplete pre-implementation matrix chronology and unexplained worker exit above must remain visible at that checkpoint.

| Final owned file | Lines | Raw SHA-256 |
| --- | ---: | --- |
| `apps/harness/tests/integration/canonical-writer-package-smoke-entry.ts` |329| `871d838f41498409162ca9876e7100a256a2ffab1aa0126ee14b00d1d83d1a63` |
| `apps/harness/tests/integration/canonical-writer-package-smoke-fixture.ts` |523| `b2e4a9b3963281ac2ffd9c52be6031809b24de8c390341b74a1692644438bd76` |
| `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts` |974| `4f9b102db5b5402228d7168d6c9f52805a0bf7e455d75677b7d12ec03a37f0f1` |
| `apps/desktop/forge.config.ts` |79| `f226f1d380c2c89eec25b72d0cc45b75f6a8d525a2465f28aa6a881e5a1a701c` |
| `apps/desktop/vite.harness.config.ts` |157| `e670fbf26cb24cc6429d58b287e0a79ddf3393b6f1fa0d8db4f501d293c2a21b` |

## S7.13/S7.14 launcher — implemented locally; actual Windows proof BLOCKED

### Authority and input identity

The current instruction authorizes the external launcher and its new Desktop test after the fixture/build group, with necessary S7-owned native-observer fixes only after actual new-bug Red. It does not authorize a seventh commit by this agent. No staging, commits, pushes, dependency upgrade/install, host setting, service, privilege, fuse, sandbox, preload, product Writer/coordinator/repository/schema, or Linux change was made. No additional helper was added to the repository.

HEAD remains `77f7667ea89b521472660d3e1bea7e85fbf5168b`. Before this append, comparison with the first capture shows exactly five pre-existing source/test files changed: the launcher, Desktop native verifier/test, and fixture entry/integration test. The new launcher test is the sixth owned source path. All other initially captured repository files, including the parent's dirty runner/main/build/protocol work, match their initial raw bytes.

Read the whole original S7 contract, exact S7.13/.14, PRODUCT/CONTEXT/AGENTS, standing decisions, shared workflow/test-contract guidance, existing public launcher, private owner/native fixture interfaces and CodeScene guidance. All 28 bindings remain exact; combined identity is still `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`. No normative oracle was rewritten to fit Windows.

Every test/build/package/compiler/check command below uses the serial `Temp/slopstop-s7-proof.mjs` wrapper. It captures all tracked/nonignored source, new tests, configs and dependency definitions, itself, the 28 binding sources, Electron declaration/package metadata and the pinned staged native file/package before execution. Later captures also retain all existing built CJS files. Each run has a unique directory, full raw copies, command, hashes, raw output and report, and rechecks input/binding identity afterward. Counts progress from358 to366 inputs. The initial read-only `git status --short` preceded these captures; it is not test evidence. Initial baseline captures did not yet include all existing compiled CJS files; this limitation is not retroactively repaired. Fresh package artifacts cannot be pre-captured before their build: the final actually executed EXE/ASAR/native bytes are retained separately below.

### Observed chronological Red and local Green

All directories in these tables have prefix `Temp/slopstop-s7-`. Test commands use `pnpm exec vitest run`, the named paths/filters and the wrapper's one-worker/no-file-parallelism/verbose+JSON options. A failed `command` report records its exit status; exit0 for a diagnostic capture is not a passing package verdict.

| Step / directory suffix | Actual observation | inputs.json SHA-256 |
| --- | --- | --- |
| `launcher-windows-baseline-2026-09-11T02-03-24-222Z` | Actual pre-change `pnpm package:smoke` exited0, printed only the old renderer/Storage summary; no required Writer completion observation | `ec32880d839e4df61cabce7b643fc182b3ce415ab5fc5eb78a8bf7c6b9d8bca2` |
| `launcher-red-2026-09-11T02-07-21-240Z` | Public executable import through mocked spawn/fs:34 assertion failures,1 pass; Writer stage absent and missing witness incorrectly exits0 | `7414a7b9075403d977d54601884dcb7a018ba233a5602d7b04b68a1ace2c562e` |
| `launcher-reachable-red-2026-09-11T02-08-21-259Z` | Add only Writer launch sequencing:28 failures,7 passes; contradictory output now reaches the actual public launcher before completion guards | `908261e9c940d1322770c2d7d171c19226b99533a73f636a9f4763f669e52fe3` |
| `launcher-resource-red-2026-09-11T02-10-17-197Z` |7 native preflight assertions fail before native resource guards | `faf7c2a3c05e380bca4e269badcbe0950bb322e52e0b5114444b92e8c8c2e322` |
| `launcher-completion-green-resource-red-2026-09-11T02-12-22-762Z` |35 completion/ownership/Storage cases pass;10 resource cases still fail before their guards | `6738b3e2685cba7dfde8fe3052dbb9eafec274949ee2a00a9a19d0a48a35632c` |
| `launcher-green-2026-09-11T02-13-23-279Z` |45 passed | `e4a7ade47489bcc06fee9f7a6b6f51f1db7e67c53ad8c6e23b7bb212715e6c4b` |
| `launcher-windows-native-red-2026-09-11T02-22-04-616Z` | Windows namespaced native candidate rejected; proposed console-child option absent:2 assertion failures,1 pass | `8167c53836bc1c132229ea4deb1ed4e6f7b19aee10a9f87a9e4feb08cf4594a3` |
| `launcher-fixture-native-red-2026-09-11T02-22-14-533Z` | Independent fixture rejects the same actual namespaced native spelling:1 failure,1 pass | `23d4001a541e833ba1145ee6e20d1f5cfd27cdbd3dd1874aef1a30bd17cef83f` |
| `launcher-native-fixed-green-2026-09-11T02-23-05-487Z` |106 launcher/native cases passed at that revision | `8d9638947f9fe0536240415bc8b76c8028f5526e8dbf275d6f66c2b51d99e8d1` |
| `launcher-binary-boundary-red-2026-09-11T02-36-21-128Z` |55 passed; one real assertion failure:4000 binary bytes were incorrectly counted after UTF8 replacement decoding | `6d3cab53e1ec8c82a6901cf743b77a51fc975775b3f665ea1092f0e07d707d26` |
| `launcher-safe-diagnostic-red-2026-09-11T02-49-14-369Z` | CI failure text reflects actual `private-child-detail` from old-scenario stderr | `12393c61c795509fa2e0436e9c09e234a2400eef17a1c13e42741ddcefb6262d` |
| `launcher-safe-diagnostic-green-2026-09-11T02-49-45-335Z` |57 launcher tests pass after fixed diagnostic selection | `197772bbda15945a6311cfb15cacfc51bd477d100fcf9053a43bbabb058e62f0` |
| `launcher-final-refactor-unit-2026-09-11T02-50-50-845Z` |57 passed,0 failed/skipped; report SHA-256 `918f0653a7402f97b754a54838f88631f08d150f8867a0c19499c616c51d6f12` | `fce18be6e0b2a8cb1aab51149339516e87c136a7fb8a1ff486b24b996a0063ca` |

The initial35-case matrix was authored before launcher guards. Native/ASAR cases were then authored before their corresponding guards. Later binary-boundary and raw-child-diagnostic corrections have their own captured Red. Added legacy-deadline and literal Windows CRLF checks are reinforcement/characterization, not fabricated original feature Red. Writer authorization variants reuse the existing executable authorization cases; permission-limited file symlinks remain unproved. The mock cases labelled other-target/renamed currently exercise absence at the exact required path; they are not a claim that a real alternate binary was executed. Real disposable-package adversarial execution remains pending with actual package completion.

The retained pre-change Windows log is additionally evaluated by `launcher-baseline-witness-assertion-2026-09-11T02-43-32-945Z` (inputs `adc06c4fd447bdb2eb14e3911d2b1afefd99b9d8f680fbc43e63af326262f4f6`): actual assertion `false !== true`, `Required Writer completion observation absent from the retained actual Windows baseline.` This assertion was run later against the original retained log; it is not falsely dated before implementation. The original public-entry Red above already precedes launcher changes.

### Implemented external behavior

- The executable imports actual platform ports and runs bootstrap -> writer-proof -> missing-runtime -> witnessed-staging on one authorized root. Its tests import the executable entry with scripted spawn/fs ports; they never call private helpers or assert against implementation source text.
- Writer pass requires the exact ordered complete terminal/pass stderr pair, code0, outer close, empty stdout, no transport error/timeout/overflow. Only a closed nonzero failure with an exact terminal plus allowlisted fixed Writer failure line can authorize cleanup without pass. All other outcomes revoke cleanup; subsequent completion cannot restore it. Timeout revokes immediately, best-effort main SIGKILL is not descendant proof, and the terminal cap resolves failed/unclosed.
- Limits remain Writer120000+5000ms and old scenarios30000+5000ms. Output capture retains at most4000 actual bytes per stream, counts bytes before decoding, preserves overflow irreversibly, and supports split data. Unknown child-provided stage text is never reflected into CI diagnostics.
- Same-volume rename isolation remains outside the workspace, with no package copy/ownership reset; NODE_PATH/NODE_OPTIONS are removed only from child environments. Completed safe runs rename the exact package back and remove its container. Unconfirmed runs preserve both package/root. The final success summary is exactly the required renderer/Storage/Writer line and is absent in every actual failed Writer run.
- Preflight retains libSQL/migrations and inspects actual ASAR entries/shared CJS references plus native package metadata, exact physical regular/non-symlink canonical target and published v1.5.1 hash. This scan cannot substitute for the main/fixture's actual load witness.
- Bootstrap generation path and complete manifest bytes are retained and compared after Writer completion. The only admitted extra Project entry is its plain `.slopstop-writer.lock`. Runtime removal and staging-witness creation happen only afterward.

### Actual Windows failures and narrow native fix

Actual host: **Windows_NT10.0.26200, x64; Electron43.4.0; embedded Node24.18.1 / native module ABI148 / N-API10; pnpm11.5.1; fs-native-extensions1.5.1**. Commands use pinned project Node24.19.0; capture host Node remains24.20.0. No versions changed.

The first new launcher run failed because an over-strict old-scenario stdout check rejected Electron's existing CRLF. Restored the unchanged old-scenario trim behavior. This was an introduced launcher regression, not a product S5/S6 Red. Writer's required zero-byte check remains strict.

The next actual run emitted `writer-native-preflight`. The independently recorded installed-Electron diagnostic loaded the already pinned file from the retained package and observed the exact filename `path.toNamespacedPath(unpackedBinding)` (`\\?\` Windows spelling). The verifier had rejected this OS representation even though realpath and the published hash agreed. Following the two focused Reds, both independent S7 native observers now allow only this exact namespaced physical spelling in addition to their existing exact paths. They do not normalize arbitrary candidates, accept alternate binaries, change pins, suppress errors, or allow cached-load success. The probe delegates the actual native loader; it is a diagnostic, not full packaged-fuse/six-process proof.

The proposed child-only `ELECTRON_NO_ATTACH_CONSOLE=1` was tried, proved ineffective in the real package, then removed with its now-unjustified test. **Electron43.4.0 itself unconditionally writes a newline for the Windows browser process in `ElectronMainDelegate::BasicStartupComplete`, before application JS.** The exact pinned source is [electron_main_delegate.cc](https://github.com/electron/electron/blob/v43.4.0/shell/app/electron_main_delegate.cc), `if (IsBrowserProcess()) std::wcout << std::endl;`. Current Context7 environment-variable documentation and issue28072 corroborate the mechanism. This conflicts with S7.13's zero-stdout-byte requirement. No filtering, ignored stdout pipe, modified Electron executable, dependency upgrade, security flag or contract waiver was applied.

Independently, real Writer execution now reaches **`writer-clean-stop` and reports unconfirmed process termination**. The specific utility/EOF cause remains unresolved; do not label it fixed, successful cleanup, or merely the newline issue. No actual six-PID contention/crash/takeover/replay/audit/stale-proof completion was observed, so none is claimed. No main-PID observation is substituted for the six utility identities.

`launcher-final-windows-trace-2026-09-11T02-52-51-172Z` ran the required **`pnpm package:smoke`** on the final source (inputs `94c7b9bf39f23166e4a61cb002a1bcee73722de7635ed04551d1d519ea2f4c23`). Forge packaging succeeded; launcher failed at package isolation. Its caught error code was not captured, so no EPERM/antivirus cause is invented. A read-only process inventory afterward returned no live SlopStop.exe; this does not retroactively grant cleanup. A subsequent **`pnpm package:launch-smoke` on that same generated package** succeeded at rename isolation and reproduced Writer failure (`launcher-final-isolation-trace-2026-09-11T02-54-34-442Z`, inputs `8b672952c959b216b13dcc96a6dad92df8e47be98eaed6e8b0d9b0dc1bfd9f90`). Earlier full `pnpm package:smoke` runs also reproduced the Writer failure; no source-only replacement is being claimed.

Final actual outer observation: PID25816, start `2026-09-11T02:54:45.260Z`, close `2026-09-11T02:54:54.356Z`, code1, stdout exactly `\r\n`, stderr exactly:

```text
Package smoke writer process exit unconfirmed.
Package smoke proof failed at writer-clean-stop.
```

The authorized root `Temp/../slopstop-package-smoke-NRRiL0` and package `C:/Users/pedro/Documents/GitHub/slopstop-packaged-app-Pcn3CX/SlopStop-win32-x64` remain preserved. Older failed-run relocations also remain retained; no subsequent clean process inventory or successful new build was used to authorize their removal.

Full actual EXE/ASAR/native copies, outer trace, diagnostic and manifest are retained at **`Temp/slopstop-s7-windows-retained-2026-09-11T02-55-38-653Z/`**. Report SHA-256: `4e48c17ffe7361381781f608f7462bfa6cfc1401e55420cec7ba47e0e2e8d172`. This report explicitly says blocked and utility PIDs not captured.

| Actual retained bytes | SHA-256 |
| --- | --- |
| `SlopStop.exe` | `7f9e426c0ed69f177c288095641eb3ec4df32b90598473bf9dcf78e7ca1fd751` |
| `app.asar` | `1d37852e62716b4cfeb8f30c4c0b4b742475a21de2cfc333fdc1c89fd7763043` |
| `fs-native-extensions.node` | `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4` |
| `external-observations.jsonl` | `952a8ee52b90133a2e039a470006c94b483484523a80fd0d3ba52ee12d5a13ff` |
| `native-diagnostic.jsonl` | `251246b3f693139281c0142c802e728942779bcc64e746907a75491987420470` |

The native hash is compared with the previously approved published pin, not learned from a newly built binary. EXE/ASAR hashes identify the failed artifact, not endorse it. External trace tooling only delegates imported spawn/filesystem ports and retains local observations; it is removed from the Electron child environment with NODE_OPTIONS and changes no product output contract.

### Final available local gates

| Gate / directory suffix | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `launcher-final-scoped-unit-2026-09-11T02-37-26-435Z` |1386 passed,2 existing Windows EPERM skips; report `f940e8af72a830dcc8bb022555ddf2da028f0b31fdb2c9c1a3652a7a4a7fcd02` | `bfe60252d71103a128665065ea21318c98a291e902765ea4363b603badb15204` |
| `launcher-final-fixture-integration-2026-09-11T02-37-44-146Z` |148 passed,0 skipped; report `6f0ecd93db220d0e42acbc0c0e41b4f0387c33d3dc9575ffcc3834f4470ce1fe` | `7388925ce5ead459c3ef26ede3a62e49735f772fd825cba7c9fedfad5d5541f5` |
| `launcher-protocol-types-2026-09-11T02-39-58-208Z` |Protocol typecheck exit0 | `9c63b0df9e08250cf17f8e5d0cfe72c6b35b8c3d2deeaf11d56bc12bf51b0689` |
| `launcher-harness-types-2026-09-11T02-40-09-247Z` |Harness/fixture typecheck exit0 | `824b11db09e390840164ae5f23f6e1ffa3cd5f09491582a0b3bde9bf70880820` |
| `launcher-final-desktop-types-2026-09-11T02-51-08-356Z` |Final Desktop typecheck exit0 | `07b288de418f5fe30c9c7915f3f5693564be2bff42e1b58abf8fd15d47e3608d` |
| `launcher-final-biome-2026-09-11T02-52-10-147Z` |All six owned files, no findings | `627d1cb3262e816cb12bb8567b3ef1e4b42eee6f8cafeee80ee1fb1de1752eae` |
| `launcher-boundaries-2026-09-11T02-43-41-134Z` |231 modules/713 dependencies, no violations | `f552a2ced89d7a51ea768c98d7b335e9eb3c7be8dc81377e04f19bfabe30cd48` |
| `launcher-architecture-2026-09-11T02-43-54-080Z` |3 files,0 errors | `6a927232064097eb6611dc7d55276abdbd8844eb828825e9400f06b13142fc24` |
| `launcher-migration-authority-2026-09-11T02-44-05-829Z` |db:generate:check exit0; no schema changes | `a4aca47fe802922f8b7daca931e935fe4328910d121a14bf3992bf99c6eb2e37` |

The final safe-diagnostic test/refactor followed the1386-case combined run. Its complete57-test executable suite, final Desktop typecheck and Biome were rerun afterward; the other S7 inputs did not change. Do not present the combined run as1387 executed tests. Full fixture integration includes the one new namespaced case,148 total; source/native mocks still are not packaged process proof.

CodeScene: launcher baseline10.0. Initial added complexity lowered launcher8.92/test8.6; bounded output ownership, separated completion validation, fake-process preparation and filesystem setup removed the findings. Final detailed reviews of all six files are10.0/no findings, each below1000 lines. Cumulative safeguard inspected20 eligible/checked files and passed. CodeScene OAuth verification passed5/5. These tool results are local automated review, not parent independent acceptance. Sonar MCP is not exposed to this execution; no Sonar result is claimed, and parent review availability is not treated as the runtime blocker. Formatter-preview tooling initially had a Windows text-decoding failure; corrected UTF8 and applied its edits with apply_patch. Hook/LSP transient duplicate/parse diagnostics are not counted as validation; actual captured compiler/Biome/Vitest results are above.

Final owned source hashes:

| Path | Lines | SHA-256 |
| --- | ---: | --- |
| `apps/desktop/tests/e2e/package-smoke.mjs` |824| `cd5d3eff5a0251414c64dc2b3a0517e13eaa28e300b8d68b68c8dee814e47df4` |
| `apps/desktop/src/main/package-smoke-launcher.test.ts` |536| `25787b774c460a880d3df2166b62be3d6701b56c56c7df1852afa0fbaed79359` |
| `apps/desktop/src/main/package-smoke-verifier.ts` |268| `4b4f7c0dc2ee616ba63212075c47423b25e3d6aca0ac30481648d3880e00f782` |
| `apps/desktop/src/main/package-smoke-verifier.test.ts` |437| `bec9a440b2cded01fa88d96657e6a476f6ff87c156125453fe30212ba125e631` |
| `apps/harness/tests/integration/canonical-writer-package-smoke-entry.ts` |333| `3b932b66f0e451a0f4ebc28e3ff296f8e71a4c2f2c1e5661b3e9ecd1e691a9fb` |
| `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts` |978| `5fdad5fb005d8f99857bffe81fef48e2ed7429eed06859988682a8db897ff38e` |

### Remaining acceptance

**Windows package proof is blocked, not passed; S7 is not accepted/completed.** The pinned Electron startup output conflicts with the unchanged external oracle, and the separate clean-stop/unconfirmed failure still needs diagnosis. Six actual utility PIDs, holder SIGKILL-before-release/nonzero-exit+EOF, bounded takeover, exact replay/old-epoch denial/C2, independent all-table crash audit and live cross-process stale proof remain unverified in a completed real package run. Do not infer them from the148 fixture tests or the scripted runner positives. Actual disposable-package bad-copy cases remain pending.

Linux proof, real symlink cases, terminal `pnpm check` and Windows `pnpm check:deep`, historical S5/S6 reruns/qualifications and parent independent review remain separate outstanding obligations. Mutation was not requested and was not run. No historical waiver, new human file approval, global health claim, or source/simulated substitute for actual packaging is recorded.

## Windows continuation — clean-stop fixed; strict startup-stdout decision remains

The current human instruction explicitly resumes Windows diagnosis and authorizes a bounded S7 private-owner fix. Only `canonical-writer-package-smoke.ts`, its existing test, its existing test-peer helper and this append change in this continuation. No production harness/default entry, coordinator, ownership policy, protocol, fixture, launcher stdout rule, dependencies, security settings or Git state was changed. Earlier failed artifacts and roots remain preserved. The28-binding identity remains `5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`; previous evidence is retained, not relabelled.

### Concrete diagnosis at real public process ports

Read the harness index, process-entry, process-bootstrap, process-shutdown, runtime shutdown ordering, ordinary HarnessSupervisor.stop and the S7 owner. `process-shutdown.ts` reports `Harness message port closed.` only after the full `stopRuntime()` promise resolves. Runtime awaits Canonical shutdown before Storage shutdown. The default entry does not call process.exit on this successful path. Ordinary Supervisor.stop closes its session then eventually calls utilityProcess.kill; unlike S7, it neither requires an exit0 nor independently observes EOF.

The bounded Temp diagnostic starts the unchanged packaged `harness.cjs` through real Electron43.4 utilityProcess with a fresh diagnostic Storage root, closes both public main-side port handles, observes the existing structured shutdown record, then terminates only its own still-matching recorded child handle. It never terminates a prior orphan, deletes an old root, patches the executable, or forwards child content to product output. These observations isolate the mechanism; the separate full packaged run below verifies the actual private composition.

- First real diagnostic: main PID24524, child PID26520. Port close occurred at1132.7842ms; the harness shutdown-complete log arrived at1135.4502ms. At6136.6665ms the same child was still alive and neither stream had ended. Public `child.kill()` returned true, then exit0 arrived at6139.4567ms. Neither EOF listener fired before the9139ms diagnostic cap. Raw trace: `Temp/slopstop-s7-close-observed-XYCJq5/events.jsonl`, SHA-256 `79c4ac67bdfdaf5b52ba62bf71f38cdedda5399ad8ca0136d9c4d8802cb0c04e`.
- Exact Electron43.4 implementation of `ForkUtilityProcess` emits exit and then synchronously removes **all listeners** from its public stdout/stderr PassThrough objects and clears their getters. The underlying Socket pipes can deliver EOF afterward. The old scripted peers emitted EOF immediately without this listener reset, hiding the mismatch.
- Differential diagnostic retained the original public stream references and reattached their listeners in a microtask after exit. Child PID32220 returned exit0 at6103.0531ms; actual stderr EOF arrived at6104.592ms and stdout EOF at6105.1747ms. Both were independently observed before reporting confirmed terminal. Raw trace: `Temp/slopstop-s7-close-observed-laehEq/events.jsonl`, SHA-256 `ba065c2906a29ad783a873a0d80ae974d2b140475310accdb8ff407647993b64`.

Diagnostic invocations were captured as `shutdown-real-utility-diagnostic-2026-09-11T03-04-20-620Z` (inputs `cfbe43dbe7f298ef8fc91ad3a5486b7d890d65538742f95524c1c58d1da49714`, exit1) and `shutdown-real-utility-rearm-2026-09-11T03-06-36-581Z` (inputs `2d907bc389772995f0b298b56f7ab9e39d5f72d619a21bb0fc5b64fa8ba7a934`, exit0). Prefix is `Temp/slopstop-s7-`. Actual exit/EOF observations, not a wrapped unknown timeout, identify the two separate defects.

### S7-only fix and regression proof

The private owner retains the public stream references and reattaches only its own data/end/error listeners after Electron's exit-listener reset. Observed process exit never substitutes for EOF; the existing3000ms drain budget and65536-byte bounds remain unchanged. An already observed EOF is not manufactured again, and uncertain streams continue to withhold cleanup.

For a production utility that remains alive after port close, the private owner waits for the **existing** pinned harness structured completion record (`level30`, integer time, service `harness`, exact closed message and exactly those four fields). That record is emitted only after Canonical and Storage stop complete. Only then may it call public utilityProcess.kill on its own unchanged, distinct, non-main PID. False/throwing kill remains clean-stop failure; exit0 and both EOFs are still required. No new wire acknowledgement, product shutdown capability or raw log forwarding was added. An early/duplicate completion record fails. A fixture still completes via its existing final-step/port-close exit. Natural clean exit remains supported. Missing completion plus a still-living process times out and cannot authorize graceful termination or a pass.

This is an explicit proof-tool dependency on the existing pinned process shutdown log, not permission to treat arbitrary logs as successful state or change the product entry. The holder crash remains the original PID-qualified `process.kill(pid,"SIGKILL")` before port/resource release; graceful service termination is only for subsequently requested clean stops.

Before the owner fix, five public runner cases were added via the existing peer helper: real Electron listener reset, service remaining alive after completed shutdown, kill returning false, kill throwing and missing shutdown witness. All five failed as actual behavioral assertions. After only the stream repair, four passed and the service-still-alive positive remained Red. After the bounded service termination fix, all five passed. The missing-witness case asserts zero graceful kill calls. Full existing runner/main and output/deadline failures remain passing; these tests do not alter product Writer behavior or use unexported owner fields.

| Capture suffix | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `shutdown-public-lifecycle-red-2026-09-11T03-09-12-730Z` |5 failed; report `0df051356b31f9383f058a0a818fe5b3f80a27a57297e36fbacb5470e925dcb0` | `d60982f82c6d31e7645e1ef57a9ba4d5e7f40869094f6e8c4347639578d7139e` |
| `shutdown-stream-green-service-red-2026-09-11T03-09-53-962Z` |4 passed,1 failed | `00e10fdcba402f15d28baedc0635a2975569aa3a8bf941ab431b2860ce067fdc` |
| `shutdown-public-owner-green-2026-09-11T03-11-21-980Z` |5 passed | `a3a211cc4b35e8a186817b22298692421f2147642d42580a40aaa85ce85c6adc` |
| `shutdown-owner-scoped-unit-2026-09-11T03-11-37-410Z` |193 runner/main tests passed | `2c4e1f802161d5bb5d560979167ebce68e4150840bd2368b1c650a2c126a996c` |
| `shutdown-final-scoped-unit-2026-09-11T03-17-24-191Z` |310 runner/main/launcher/native tests passed; report `4e5974febee3ee710b53ea86dac997f17b3befe61d91ef54e0a7f7665486fe37` | `478fd905199b4fd66267dd859decb9de0ced328233828f1da8b253cdbe8c8316` |
| `shutdown-final-fixture-2026-09-11T03-17-58-847Z` |148 fixture integration cases passed; report `1624aa283c36030d19e839111fbb9068cfe73a690c609e30885495f971930c9c` | `262cee43eecffd9e38dfb4d8bd78571bfabdcb6b7592d54c84dc1b564cb35d56` |
| `shutdown-final-desktop-types-2026-09-11T03-20-15-189Z` |Desktop typecheck exit0 | `e32679a9441223d8d9f4deafd18eb09e80a10caf51476365425034e761d9e0b9` |
| `shutdown-final-biome-2026-09-11T03-20-31-647Z` |3 changed source/test files, no findings | `c6d6bf1701ec0293f348874122129c9a69928394fc1c0b37288faf0521f61cb2` |

CodeScene final detailed scores are10.0/no findings on all three files. Their line counts are916,989,504; no new test-support module, format compression, threshold override or suppressed check was introduced. Current Context7 Electron utility-process/message-port and Node24 spawn/overlapped/detached documentation was retrieved before the corresponding library-specific changes/experiments. Sonar remains unexecuted in this tool scope; parent review availability is not a blocker. Protocol/Harness source and their prior typechecked consumers are unchanged by this continuation; Desktop compilation was rerun for the changed owner and tests.

### Actual packaged Writer result after the fix

Both `shutdown-windows-owner-trace-2026-09-11T03-12-44-121Z` and final `shutdown-final-windows-trace-2026-09-11T03-21-59-782Z` executed **`pnpm package:smoke`**, including a real Forge package. Each actual private Writer scenario now exits0 with the exact terminal/pass pair. Final command inputs hash is `712d31f0675b2ba670d7323b4ec0b6dc4bc6a6789a5325095a576d1336635bcf`.

Final actual Writer main PID33680 started at `2026-09-11T03:22:24.274Z` and closed at `2026-09-11T03:22:30.054Z`. stderr is exactly:

```text
Package smoke writer processes terminal.
Package smoke writer proof passed.
```

The actual private runner reaches this pair only after its production contention, holder hard kill, observed exit/drain, bounded replacement, receipt replay/old-epoch rejection/C2, independent durable fixture audit, live stale-Writer fixture and all six terminal checks. Those unchanged self-oracles were inspected; the public result deliberately does not export the six utility PIDs. The separate PID/EOF diagnostic above is not mislabelled as those six identities. Complete independent six-PID capture/manual inspection remains distinguishable from the actual runner's own validated result.

**Overall `pnpm package:smoke` still exits1**, solely because the Writer outer stdout is exactly hex `0d0a`. The launcher keeps its strict zero-byte rule and therefore does not run later Storage mutations, print the final summary, restore the package or remove the authorized root. This supersedes the unresolved clean-stop diagnosis in the previous entry, but not its historical failed observations.

Fresh actual copies are at `Temp/slopstop-s7-windows-retained-2026-09-11T03-23-17-645Z/`, report SHA-256 `2a9f3540d56193b0c9d33e63f9117f5a65179a037ce9756b436f58b89061e56c`. It explicitly records overall blocked and `writerScenarioPassed:true`.

| Artifact | SHA-256 |
| --- | --- |
| `SlopStop.exe` | `3c2fe4f879c1a31d6dd692b1bb6a871f1d2ce92029dd0bc21f05956bfae994a9` |
| `app.asar` | `4f61dbb3d1b9e3d6db1dc46d2b2b5a491ad62f2fe47ece2de85b98040dcac362` |
| Native v1.5.1, compared with original published pin | `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4` |
| `external-observations.jsonl` | `22ff1efac3f0816d14c4472909cc29b555830ebde5696de70fed32fcab7c7098` |

Retained new authorized root is `C:/Users/pedro/AppData/Local/Temp/slopstop-package-smoke-HI5PAl`; retained package is `C:/Users/pedro/Documents/GitHub/slopstop-packaged-app-7yyy76/SlopStop-win32-x64`. Prior failed roots/packages are not restored or removed. Diagnostic utility termination was restricted to a handle created by that exact diagnostic, with observed PID matching its live handle and known packaged entry, never a guessed orphan PID.

### Windows startup stdout: concrete invocation matrix

`shutdown-windows-console-matrix-2026-09-11T03-14-59-522Z` tested all16 combinations of:

- `stdio: pipe` or Windows-supported `overlapped`, with separate captured stdout/stderr;
- `windowsHide:false/true`;
- `detached:false/true`, always retaining the child handle and waiting for close; no unref;
- child-local `ELECTRON_NO_ATTACH_CONSOLE` absent/present.

Each run used the same pinned real packaged executable with invalid authorization, ensuring no proof utility or prior Storage mutation. All16 closed normally with expected authorization failure/code1, all16 produced exactly stdout hex `0d0a`, and none timed out. The executable assertion `some captured invocation has zero stdout bytes` failed. No pipe was ignored, redirected to null, trimmed or filtered. Matrix report: `Temp/slopstop-s7-console-matrix-K5bf3Z/report.json`, SHA-256 `2d682e33a30bddafc5d328da6953418833a54697b014b2a95bf598753879566b`; command inputs `ba6e1224f351d34bc434caad877bf703870ef5a0d090a46de5b9cfb8edffbe72`.

Exact Electron43.4 upstream sources are retained at `Temp/slopstop-s7-upstream-43-4-KkBvQF/`:

- `electron_main_delegate.cc`: SHA-256 `c0a8c15c303ea946b3d45452198629aeb1bbdca7eb24a537a487b9fa7c05cdd2`; browser-process startup unconditionally executes `std::wcout << std::endl` on Windows, independent of the tested console flags.
- `utility-process.ts`: SHA-256 `40f471f5936f872096478fbdf331b241d872ad6f905423f0910e0b1433ffd5e9`; actual exit callback removes every public output-stream listener after emitting exit.

These observations cover the supported console/pipe arrangements under discussion, not a claim to enumerate every conceivable process flag. Together with the unconditional browser-process startup source, they provide a concrete reason no such arrangement yields strict zero captured stdout for this pinned runtime. Changing the process type, discarding a stream, causing output I/O failure or patching Electron would not satisfy the same proof.

**Smallest pending contract decision:** explicitly allow exactly one native startup `\r\n` on stdout for this pinned Windows Electron runtime, while retaining the raw bytes and rejecting every other/additional byte; keep zero stdout on other platforms. This is a proposed contract change, not applied implementation or assumed approval. If strict absolute zero must remain, the present pinned Electron runtime cannot meet it via the tested supported invocation options. No runtime/dependency/security change or contract exception was made.

Final changed source hashes: owner `0f6513f40ef0fc195229c1a0f80c569a61b2294f3abbb4ffc61c44e736d10cb5`; runner test `7ac74cdc7efb102257b6961608d6a365127f1b3ddb9d3e0f62f469f9c1be7642`; existing peer helper `88f5a7903ef9b82d38903bf22a64a9fe45c63e0775130d722bf1bf87050b5de4`. No Git writes, Linux proof, global fast/deep run, mutation run or historical waiver occurred. S7 overall remains awaiting the stdout decision and the previously outstanding combined acceptance gates.

## Document-only amendment — 2026-09-11T10:00:24+0100

- Human literal choice: **`Aceitar bytes exatos (Recomendado)`**. The parent supplied decision timestamp metadata `2026-09-11T09:59:33+0100` and explicitly confirmed exact semantic approval of contract plus launcher stdout: exactly native `0D 0A` only for Windows with positively identified actual packaged Electron43.4.0, zero elsewhere; every process/stderr/exit/cleanup check unchanged. This is not merely edit permission. This later record is not backdated and does not retroactively approve a candidate or relabel old failures.
- Canonical amendment: owner design `## Follow-up: 2026-09-11T10:00:24+0100`, immediately before TDD Evidence. It supersedes only the stdout-zero condition in S7.12/S7.13/S7.14 and corresponding Decisions terminal-output conditions. Missing/unsupported/mismatched/untrusted runtime identity fails closed; host version or untrusted response is insufficient. No added private wire fields or product API is required; the same implementation owner chooses and proves the runtime-binding method. Application stdout remains prohibited.
- Pre-edit read-only validator passed. The original capture runner's capture-only mode verified all28 live bindings and preserved365 raw input files at `Temp/slopstop-s7-capture-2026-09-11T09-01-29-494Z/`; inputs SHA-256 `a0c01bc9a9767fe9d1f92a1d354016e5f97eb3a2acb6e8c00c809a254f8a69d9`. This capture executed no tests. Original contract identity remains reproducible from its frozen raw binding files: **`5425b648468bd8faccf91281005ba5ccc9b95c26e14d079e5f04a34b81bd20be`**.
- All28 prior content hashes were independently checked against frozen capture and revised live text. Only binding24's end heading changes to the new follow-up, preserving its content hash. Append binding29 for the amendment, SHA-256 `5bb36ae9f6338f543b847adf873636e3bc6081201cc5d5f3870559aec7cffb2a`. New ordered normalized-LF29-binding contract identity: **`b04a1341e0cb15842cdf5e6a6efb67d7b14ddbb93d9303d4fba25b6da5dbed75`**. The canonical section states the exact selection/serialization recipe; frontmatter and evidence are excluded. This pin precedes any future implementation under the new contract.
- `validate-artifact.mjs <owner> --root <repository> --finalizing --stamp` passed after preservation, followed by a separate read-only validator pass. Automatic write hooks reported Node unavailable; their skipped checks are not passes. No source/test changes, tests, native execution, package build or quality-analysis scope reduction occurred in this document task.
- The16-invocation matrix, retained packaged report and raw external observations were rehashed and match their original recorded values. They retain the exact observed private exit0/terminal+pass pair and overall external failure due to `0d0a`. They establish the motivation, not a new-contract Windows pass. Runtime source reference remains pinned v43.4.0 `electron_main_delegate.cc`, SHA-256 `c0a8c15c303ea946b3d45452198629aeb1bbdca7eb24a537a487b9fa7c05cdd2`. Future runtime identity must bind the actual launched package rather than trust this report's version string alone.
- Base/current HEAD: `77f7667ea89b521472660d3e1bea7e85fbf5168b`; original integration main: `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`. The six commits above remain recorded predecessors, not invented missing human acceptance. Current S7 implementation is unreviewed/unaccepted and still enforces old zero stdout. All historical S5/S6 and S7 proof warnings remain open as recorded.
- Whole-S7 review scope includes original `Smoke fixture (Recommended)` and `Approve (Recommended)` design decisions, the parent-authorized `canonical-writer-package-smoke-test-peers.ts`/`canonical-writer-package-smoke-main.test.ts` layout, and the parent-organized `canonical-writer-package-smoke-fixture.ts` helper. Parent layout choices are not fabricated direct human filename approvals. All fixtures, launcher, main, native, build and package proof remain included; no CodeScene exclusions or new native/hash/version/security/host/elevation change is granted.
- Common `mode=intent` packet: `Temp/slopstop-s7-windows-stdout-intent-packet-20260911.json`. It supplies the complete29 bindings, frozen original28 references, current source-reference manifest, retained proof/reference hashes and exact revision range. Its file digest is reported separately to avoid self-reference. Parent owns sequential independent review after the earlier OOM; no reviewers were dispatched here. Semantic amendment approval is recorded; independent intent review, future source-bound red/green, whole-S7 candidate review/acceptance and integration remain distinct and pending.

## Intent findings reconciliation — 2026-09-11T10:40:59+0100

The parent reported these completed independent tool outcomes for **v1 only**, contract `b04a1341e0cb15842cdf5e6a6efb67d7b14ddbb93d9303d4fba25b6da5dbed75`, packet raw SHA-256 `dbfc26ce087adbb2ec6a3ee412a971e33ef2e624402f6507d8a603ced999fdb0`:

| Role/session | Parent-reported result | Finding |
| --- | --- | --- |
| code `ses_f7044d45bffeSZPg8QtoUR67bn` | passed | No blocker reported by parent. |
| coverage `ses_f703edf50ffewkvt7wZMcGzAP4` | failed, blocker | Actual launched-runtime binding remained unspecified. |
| slice `ses_f703ca3c7ffeZsuOvZCvqQAipY` | failed | Normative Architecture (prior10597) and Verification Notes (prior12471) still required zero stdout. |

These are parent-attributed tool outcomes, not direct human quotes, not reviews rerun by this author, and not reviews of v2. Original failed revision/packet remain retained. The human's exact CRLF/Windows43.4.0 versus empty-elsewhere semantic approval remains the same; concrete method detail needs fresh independent intent inspection, not a fabricated new human choice.

### Concrete method and observed limitation

- Proposal source `Temp/slopstop-runtime-binding-method.md`, raw SHA-256 `25ee0d5da101c56342f1416e54a94c0b8afbc85daed180d6d2487f88fd7431d7`, was read as a parent-worker diagnostic/proposal. Its bounded local method is now specified in the canonical follow-up `2026-09-11T10:40:59+0100`: exclusive fresh `.slopstop-runtime-challenge.json` (256 bytes maximum, exact version1/64-lowercase-hex nonce), then exclusive `.slopstop-runtime-witness.json` (512 bytes maximum, exact version/nonce/mainPid/platform/arch/electronVersion/executableSha256). Main facts come from its actual runtime and executable. Launcher binds pre/post canonical EXE hashes, fresh nonce, observed spawn PID and package target after close/EOF, before any pass/cleanup allowance. Files live directly under the authorized smoke root, outside P. This is local test-process provenance, not machine-owner-resistant attestation; no live witness is implemented or demonstrated.
- The real retained EXE `--version` probe was unsuccessful as a version source: PID27620, `2026-09-11T09:33:35.629Z` through `2026-09-11T09:33:36.196Z`, exit1, close and both EOFs observed, stdout `0d0a`, stderr exactly `Package smoke writer processes terminal.\nPackage smoke proof failed at writer-activate.\n`, no version. Report `Temp/slopstop-native-version-probe-U2cudP/report.json`, verified raw SHA-256 `6638b13a15481a8da8488f5e80d1c9e27361638dc589dc927f36ddc4fc6961cb`. Pre/post EXE SHA-256 remains `3c2fe4f879c1a31d6dd692b1bb6a871f1d2ce92029dd0bc21f05956bfae994a9`. Parent diagnostic command capture inputs: `Temp/slopstop-runtime-binding-native-probe-2026-09-11T09-33-34-229Z/inputs.json`, recorded SHA-256 `f1296257e1ce36d7faabe0c0ea63a11a586e4cfeac3f3957f88c4c312f98861b`. This document task did not rerun the probe; `--version` is not the proposed solution.
- The earlier16-invocation matrix remains at `Temp/slopstop-s7-console-matrix-K5bf3Z/report.json`, SHA-256 `2d682e33a30bddafc5d328da6953418833a54697b014b2a95bf598753879566b`. Every prior failed package attempt and the native probe remain failed under their stated old purpose/contract. Neither is promoted to v2 runtime-witness or package success.
- Precedence now explicitly covers **all** S7 outer-Writer stdout-zero/reject-whitespace/reject-carriage-return repetitions, including the old Decisions, Architecture prose/classifier projection, S7.12-S7.14 and Verification Notes. Only that same stdout condition is superseded. Original code projections remain historical; no new shadow implementation is required. All fixed stderr, exit/EOF, irreversible cleanup revocation, bounds, Storage P generation/lock, native/resource/security and whole-S7 obligations survive without CodeScene exclusions.

### Preservation and exact v2 identity

- Pre-edit read-only validator passed and all29 current bindings plus original packet digest were verified. Capture-only preservation used the existing `slopstop-runtime-binding-capture.mjs` wrapper with the **read-only document validator** as its sole child command; no source/test/runtime command ran. It preserved raw repository files at `Temp/slopstop-runtime-binding-intent-v2-preservation-2026-09-11T09-41-38-804Z/files/`, inputs SHA-256 `1aa52cc7a1ed385b5400a140555984cd957ca1e7f7b23336dc3e6f7dbd60ab1a`. The wrapper's generic diagnostic label does not mean runtime execution or contract approval.
- Prior raw design `43e2c44195e4e703f3c4addbff5ea23ac49985e325338f129780d5ef4507c496` is retained there; original v1 packet stays unchanged. First29 content hashes remain identical. Only binding29's exclusive end changes to the new follow-up heading; append binding30 with content SHA-256 **`0a7d95efa9254fafeaa1853e8a59fe372d42080b6de43409b5418e691c82f12d`**. New ordered30-binding normalized-LF contract SHA-256: **`8715f75d1e5a11bbc9ca6a8bc2e492a7f3520be7ad32f96d8b3cd8370825c8ad`**. Earlier28/29 identities remain reproducible from their retained raw captures and original packets.
- After preservation, finalizing stamp passed, followed by read-only validator `OK`. Current raw design SHA-256 **`cfdafb86d40ef268d2cf923eb76d07aa397a62e0758dc2120cfec49ba96155c3`**; validator content_hash `af58edc44a79d11b629d421cfd51bc2ce379d30dbad6e29905cf38e533591a36`. New normative range is lines13034-13078 inclusive, ending before TDD Evidence at13079. Metadata remains in-review. Write hooks skipped due to Node unavailable; their skip is not a pass.
- V2 common intent packet: `Temp/slopstop-s7-windows-stdout-intent-packet-v2-20260911.json`, with complete30 bindings, preserved prior references, method/probe hashes, attributed findings and current implementation-reference manifest. Packet digest is reported separately without self-reference. No new review dispatch, implementation or test execution occurred. Current S7 is still unreviewed/unaccepted as an implementation; fresh intent inspection is parent-owned. Base `77f7667ea89b521472660d3e1bea7e85fbf5168b`, original integration main `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`, all six recorded commits and historical proof/acceptance qualifications remain unchanged.

## V2 runtime witness implementation and actual Windows package pass

### Current authority and review provenance

The current instruction authorizes implementation of the precise CRLF/runtime-binding method and reports **all three independent v2 intent inspections completed/passed** against contract `8715f75d1e5a11bbc9ca6a8bc2e492a7f3520be7ad32f96d8b3cd8370825c8ad`, common packet `Temp/slopstop-s7-windows-stdout-intent-packet-v2-20260911.json`, raw packet SHA-256 `e84ed4e87691a86372b2a4508bbe270947d8a65b02ce6b39c57e8bd672d7df3b`:

| Role | Session | Current parent-received tool result |
| --- | --- | --- |
| Code intent | `ses_f7044d45bffeSZPg8QtoUR67bn` | completed, passed v2 |
| Coverage intent | `ses_f703edf50ffewkvt7wZMcGzAP4` | completed, passed v2 |
| Slice intent | `ses_f703ca3c7ffeZsuOvZCvqQAipY` | completed, passed v2 |

These are current results supplied by the parent, not inspections rerun by this execution, direct human hash approvals or candidate acceptance. The previous v1 failures remain recorded above. The human semantic choice authorizes exact bytes with positively bound runtime identity. The parent organizational allowance permits one cohesive same-app implementation helper, `apps/desktop/src/main/package-smoke-runtime.ts`, to keep file validation and executable hashing shared between launcher and main. This is not fabricated human approval of a literal filename, a new product API, a protocol export, or an added utility process.

Read the exact follow-up at13034-13078 and the v2 packet. The command capture runner now verifies the packet's exact raw hash and all30 ordered bindings, including the reviewed recipe. Prior28/29 packets, source snapshots, review failures, startup-byte failures and failed `--version` probe remain immutable historical evidence. No normative section was edited by this implementation. Early v2 command manifests retained an old metadata label that called the current identity `previousContractIdentity`; the authoritative `contractIdentity` and all30 checked binding hashes were correct. Subsequent manifests explicitly distinguish v1, original28 and current v2 identities without rewriting old captures.

### Implemented public behavior

- Launcher captures the isolated canonical regular nonsymlink EXE's raw SHA-256, requires the witness absent, and exclusively creates the fresh32-byte/64-lowercase-hex nonce challenge. Existing files are never deleted or overwritten to earn freshness.
- The existing authorized private main branch reads the challenge before utility admission. It derives its own PID, platform, architecture, `process.versions.electron` and hash of `process.execPath`; no caller version, host npm metadata or version-probe result is an authority input.
- Only a runner result with all owned utilities terminal and separately drained publishes the exclusive witness. Complete write and file close precede fixed stderr reporting/app exit. Known terminal failure may publish for safe-failure cleanup; unconfirmed ownership cannot publish an authorizing witness.
- The shared helper uses descriptor-owned reads of at most257/513 bytes, fatal UTF-8 decoding, exact fields/types, duplicate-key detection including escaped property names, canonical/nonsymlink checks, descriptor/path identity checks and exclusive file creation. The root-level companions never enter P's generation directory. Native TypeScript import by the Node24 launcher was verified in the real command; the helper uses only built-in Node modules, erasable TypeScript and ordinary same-app imports, without dependency installation or declaration-only type escapes.
- After actual outer spawn/exit/close and both EOFs, launcher compares fresh nonce, observed PID, intended target, supported43.4.0 version and pre/main/post EXE hashes. Only that matching runtime permits Windows stdout exactly `0d0a`; supported non-Windows requires empty stdout. Missing/mismatched evidence cannot grant pass or cleanup. Existing timeout revocation, output bounds, terminal/failure grammar, native-origin checks and six-utility limit are unchanged.
- Previous clean-stop/service termination and post-exit EOF listener repair remain unchanged. No production harness/Writer/coordinator/schema, renderer/preload, native versions/hashes, security setting, host configuration or dependency manifest changed in this packet.

### Red before guards, then Green and local refactor

The public launcher and actual main-entry tests were extended before adding the helper or new validation guards. The initial matrix includes CRLF success and safe-failure cleanup, nonce/PID/hash/version/target spoofing, missing/pre-existing evidence, malformed/truncated/duplicate and escaped-duplicate JSON, invalid UTF-8,256/257 and512/513-byte boundaries, nonregular/symlink companions and EXE, changed EXE, publication race/write/close failure, held publication, held/unconfirmed ownership, close without EOF, exact-byte variants and non-Windows binding. Existing timeout/output/terminal cases now run with the valid bound runtime fixture. Cases already rejected by the old zero-byte condition are characterization, not newly invented Red.

`runtime-witness-v2-red-2026-09-11T10-10-22-208Z` captured **135 passed,32 actual assertion failures**. Required positive `binds native CRLF to this packaged main invocation` failed `expected1 to be0`; safe nonzero terminal failure cleanup failed `expected ['rename'] to have length2 but got1`. Main publication failed because no witness existed, and held file-close assertions observed premature reporting. There was no missing-module, import, native setup or type-error substitute. Report SHA-256 `4b2708db38b880b9ff91a64c196f6646715831494dc259dbc4859c5e0f92d48e`, inputs `c275d18cc5de85bf9cf492c168ce4656fc46a58917e8d4a58d2a2e29e3ebef56`.

Initial implementation Green: `runtime-witness-v2-green-2026-09-11T10-14-44-955Z`,167 passed, inputs `5c0ea56c6d37bf01efbe020b9453b311af434a3ed928afcd5de08876e7ac4555`, report `c948f6ef160bbb37101657c4eaf9f9e127000d24ae0b729a8f5f1c417acebeb3`. The separate review/refactor grouped evidence-file path/bound inputs, isolated fake filesystem/child completion setup, and extracted the unchanged ordinary S7 diagnostic formatter from main. No failure predicate or timeout was weakened. Current main tests additionally assert witness absence for unconfirmed outcomes. Final focused suite is **100 launcher +67 main-entry tests**, all passing, through imported public platform ports rather than private-helper calls.

All command directories below have prefix `Temp/slopstop-s7-`; the existing serial capture wrapper keeps full raw source/test/config/lockfile bytes, helper and executable CJS inputs, native baseline, packet, all binding sources, exact commands and verbose/JSON/raw reports before execution, and rechecks source/bindings afterward. Counts are368 inputs,369 when a diagnostic script is also included. No build, test, proof or scanner ran concurrently.

| Gate / directory suffix | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `runtime-v2-final-scoped-unit-2026-09-11T10-36-40-096Z` |1457 passed,2 existing EPERM skips; report `233ced845715c4abe123ef9fd00989170d558bfa7f51c54e4bfa269b7e14e7a4` | `f2b1d7b93cc5bf940c484bf2b064a81cd8947ce01697f64215e96281306d61ac` |
| `runtime-v2-terminal-unit-2026-09-11T10-44-20-639Z` |167 focused tests passed after final formatting; report `8ae585000e4fd48ec73b85fd0cd73d6a27ad852e9792757f1fd5b30f0e6b8f20` | `23f7867fbd6ecbbb45d3bbbb356791ec86116bf43c1e8c14a48f510d1e262d06` |
| `runtime-v2-fixture-integration-2026-09-11T10-39-13-466Z` |148 passed,0 skipped; report `42432408abc4058ffd970520ac1566b3020c8e08da0ef3cfc74114b1eb0ee071` | `2a64740a0335cc4fb79ff02f458c57b800448017c43d66678ed5066158c96e82` |
| `runtime-v2-final-protocol-types-2026-09-11T10-41-25-497Z` |exit0 | `b7036d679ab891ae7876ab6baeeb8ca70533e019b47c1bbf7b7d78432ce958b2` |
| `runtime-v2-final-harness-types-2026-09-11T10-41-38-489Z` |exit0 | `92bb3593986d1a25b8382bccae0be1ba99c643eef923fa531874ee4220b23f1c` |
| `runtime-v2-final-desktop-types-2026-09-11T10-41-55-022Z` |exit0 | `6ef71fb84def53d10926e8cb4c9f0708890936374d3e2adfdc8872c4abc135ff` |
| `runtime-v2-terminal-biome-2026-09-11T10-43-54-126Z` |5 files, no findings | `7e27384ed0c3685a035afd21970ba8f3b9ae6d24257c20d0eecb65cea409da4d` |
| `runtime-v2-boundaries-2026-09-11T10-42-15-664Z` |232 modules/722 dependencies, no violations | `8cbe4783673ae015e6b0fb02f5a2a99b0a4042aded6aac5c8d42a32df5570cf2` |
| `runtime-v2-architecture-2026-09-11T10-42-36-450Z` |3 files,0 errors | `023a2b7bbabc97a03372ebefceb9d7b5f016b5ab141b0359ca0d8776b564d0fc` |
| `runtime-v2-migrations-2026-09-11T10-42-56-758Z` |db:generate:check exit0; unchanged schema | `a6fe63831a46add4f6b16616446f7332e551c0d34cc530f930ea479c92728e42` |

Final CodeScene detailed scores are10.0/no findings for all five current files. Cumulative safeguard passed21 eligible/checked files; its one reported finding is an **improvement** fixing the pre-existing complex ordinary smoke method in main, not a regression. Source files remain under1000 lines. Sonar MCP is not exposed in this execution's tool scope; no Sonar pass or service installation is claimed. Tool upgrade notices and skipped automatic hooks are not validation passes; explicit checks above are the evidence.

### Actual Windows proof: PASS under v2

`pnpm package:smoke` passed twice under the new method. Final execution: `runtime-v2-final-windows-trace-2026-09-11T10-44-47-633Z`, inputs `bf1d385ad51671b3382d59c9e93dc5f17a832204970f28412eaac3973300d317`, exit0. The actual Forge package built both entries and then the public launcher completed **bootstrap -> writer-proof -> missing-runtime -> witnessed-staging** on one fresh authorized root. Original renderer/Storage/native/fencing/audit self-oracles completed; no mock, earlier private-only pass or failed version probe substitutes for this run.

Actual environment: Windows_NT10.0.26200, target win32/x64; **Electron43.4.0 from this main's witness**, fs-native-extensions1.5.1 with the unchanged published native pin. Capture host/project Node versions remain metadata only, never Electron identity evidence.

| Stage | Actual spawn PID | Exit/close | Both EOFs |
| --- | ---: | --- | --- |
| bootstrap |31348|0, observed|observed|
| writer-proof |10988|0, observed|observed|
| missing-runtime |32712|0, observed|observed|
| witnessed-staging |26564|0, observed|observed|

These are four outer application PIDs, not substituted names for the private six utilities. The unchanged private runner still validates its six owned process identities/exit/EOF/crash/takeover/replay/audit/stale sequence before its fixed pass pair; no seventh utility or runtime-version probe was added.

The actual Writer record binds:

- Fresh challenge nonce `5dc4cd27f1a7ff27a96ca8da5e44b0f9ed3e47dab9fbea25c178c4f8c13b47ef`; exactly the same nonce in the main witness. Raw challenge88 bytes; witness249 bytes.
- Actual spawn-observed PID10988 equals witness mainPid10988; target win32/x64 and actual Electron43.4.0 agree.
- Canonical isolated EXE SHA before launch, hash observed by main, hash after close, and hash of the exact restored image are all `3ec2c28c60e9b34719470816e2da79c4be3ae8a998550b0bab72ba7137ce76c6`.
- Writer stdout exactly `\r\n` (hex0d0a). Writer stderr exactly `Package smoke writer processes terminal.\nPackage smoke writer proof passed.\n`, code0, actual exit/close and both stream EOFs.
- All four stages use the same fresh root. The launcher revalidated unchanged P generation/manifest and its plain lock companion before runtime removal/staging. After all stages, rename restored the exact original package and removed only this authorized root and isolation container. Previous uncertain roots/packages remain preserved.

Final executable stdout is exactly:

```text
Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.
```

including one final LF. Raw product streams were never trimmed, filtered or suppressed to pass this rule.

### Retained same-invocation runtime/image report

**`Temp/slopstop-runtime-v2-windows-proof-2026-09-11T10-47-42-630Z/report.json`**, SHA-256 **`cc27d4568fa1bd2ab7351eea81a25bbe20ce0db8aeec2fe20496694845d17924`**. It includes exact stage records, spawn/exit/close/EOF observations, nonce/target/hash comparisons and confirmed same-image restoration/root/container removal. Sibling `challenge.json` and `witness.json` contain the exact bytes independently captured before successful cleanup, not fabricated replacement observations. Full EXE/ASAR/native and current source copies are retained beside them.

| Retained bytes | SHA-256 |
| --- | --- |
| `SlopStop.exe` | `3ec2c28c60e9b34719470816e2da79c4be3ae8a998550b0bab72ba7137ce76c6` |
| `app.asar` | `faf13db1305bb227a952f367f049a667c7989770b6b85d2801adf862a933caf0` |
| Published target `fs-native-extensions.node` | `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4` |
| `external-observations.jsonl` | `d38b56b7b5cf942bd783a4023bbba7a51c586b0429d67574fdd000b36ebbe764` |
| `execution-output.log` | `bdcd346f9af371eccc5a0cf6523772a781900abea7efd238a987d304d9fe68dd` |

The local observation shim delegates actual spawn/fs operations, captures bounded challenge/witness reads and independently hashes the exact image around spawn/close. It is removed from Electron's environment by the unchanged child NODE_OPTIONS stripping. A separate assertion script checks the report against the final command's source manifest and the restored binary; its own exit0 is report verification, while package success comes from the actual `pnpm package:smoke` command above.

| Current source | Lines | Raw SHA-256 |
| --- | ---: | --- |
| `apps/desktop/src/main/package-smoke-runtime.ts` |220| `fa1a7fb2be28ecbbb685769cf41d7c90a46cb3e33dd220a0d2749a158b48fb4e` |
| `apps/desktop/src/main/main.ts` |420| `0bc1f384a419aaa50be249614ac5f3fb44a205c714067a710c21c24991f56c4a` |
| `apps/desktop/tests/e2e/package-smoke.mjs` |868| `37fa2284a3570b392b8b50f1e3ca0307eda5f4d8f23b3876faa153bef1f9e070` |
| `apps/desktop/src/main/package-smoke-launcher.test.ts` |731| `d4f1d523d3e20a19d9a30b68c54f6f478361713f9db0cdf2a271d702ae7cda30` |
| `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` |585| `d1cd8dcc0bf54082f2bc835323f60c5d7700c7ae8e7328bd9df84107feee2fe3` |

Windows end-to-end execution under the reviewed v2 binding is now passed. Independent Linux package proof, the2 Windows EPERM-qualified symlink cases, parent terminal `pnpm check`/`pnpm check:deep`, historical S5/S6 qualifications and whole-candidate review/acceptance remain separate. No global deep gate, mutation run, Git stage/commit/push, dependency upgrade, host change, automatic old-root cleanup or retrospective promotion of old failures occurred.

## Linux S7 prerequisite check — blocked before source transfer (2026-09-11)

The human authorized real Linux x64 source/unit and packaged proof against the current Windows-proven dirty S7 source, with an explicit stop if required host libraries are missing. Ubuntu runs as existing non-root `pedro` (UID/GID 1000). The retained S3 toolchain executes Node `v24.19.0` and pnpm `11.5.1`; their current executable/entrypoint SHA-256 values match the retained S3 handoff (`bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12` and `ff3224d46b47fbb24a7e9fe15fededef7e00892d07d4e376b6762d4899906bfd`).

Read-only `ldd` against the retained S3 Electron **43.4.0** Linux executable reports five unresolved host dependencies: `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, `libsmime3.so`, and `libasound.so.2`. Although `ldd` returns exit 0, these explicit `not found` rows are a failed prerequisite, not a passing gate. `command -v xvfb-run` also returns exit 1. The retained executable SHA-256 is `6853bb400e98582dcc104ca8b9e90f013cd2223575253731e0c429925981c733`; this identifies only the inspected prerequisite binary, not a new S7 package.

The existing CI sequence prepares the disposable packaged `chrome-sandbox` using root ownership and mode 4755 before `pnpm package:launch-smoke`. The retained S3 helper is `pedro:pedro`, mode 0755. No helper permission change or host configuration change was attempted. Missing shared libraries are already a concrete stopping condition; sandbox execution has not been tested.

Fresh evidence-only root: `/var/tmp/slopstop-s7-rbzqxj12`, created by UID 1000 after checking `/var/tmp`. Matching Windows evidence: `Temp/slopstop-s7-rbzqxj12/`. Both retain `report.json`, the exact `probe.py`, Electron package metadata, and separate raw stdout/stderr for eight serial probes with command arguments, exit codes and timings. The initial Windows invocation suffered MSYS path conversion before Python could open the script; the successful capture explicitly used `MSYS_NO_PATHCONV=1`.

**No source transfer, dependency installation, S7 unit selection, or `pnpm package:smoke` execution occurred.** Linux selected-test execution count is zero; both real symlink cases remain pending. No current-source manifest comparison, Linux runtime witness, utility-process PID, native-origin package proof, or Linux stdout-empty success is claimed. The current contract identity supplied by the parent (`8715f75d1e5a11bbc9ca6a8bc2e492a7f3520be7ad32f96d8b3cd8370825c8ad`) was not independently rebound by this prerequisite-only check. All probe processes completed synchronously; the new evidence roots and all earlier roots are retained. Application source and normative design were not edited. Resumption requires a human decision on host prerequisite preparation; full transfer identity, source tests, package proof and parent final gates remain pending.

## Linux S7 execution after explicit Ubuntu preparation approval — failed candidate

### Current human authority and environment preparation

The subsequent human instruction explicitly selected **Preparar Ubuntu (Recomendado)** and authorized NSPR/NSS/ALSA, Xvfb/xauth and the dependencies of those packages, plus root ownership/mode 4755 only on the disposable packaged `chrome-sandbox`. This is new prospective permission; it does not alter the preceding blocked record. Electron ran as existing `pedro` UID 1000 throughout. No blanket upgrade, service configuration, security sysctl, sandbox disabling, Windows configuration change or application-source edit was performed.

Ubuntu uses the `resolute` distribution repositories. `apt-get update` completed successfully, followed by `apt-cache policy` and `apt-get install --no-install-recommends -y libnspr4 libnss3 libasound2t64 xvfb xauth`, exit 0. `libasound2t64` is the actual distro package. Direct installed versions are retained in `installed-host-packages.stdout`; complete install output and dependency actions are in `apt-install.stdout`/`.stderr`. The first update output is in the tool transcript rather than a separately captured raw file. No additional D-Bus package or configuration change was attempted. Final `ldd` output for the packaged Electron and native binding is retained separately.

### Byte-identical source and command capture

Fresh owned root: `/var/tmp/slopstop-s7-arp02cen`. The preceding S7 root and every S3 source/proof root remain untouched. The new root was created as UID 1000 after checking `/var/tmp`. Full source lives in `source/`; retained command evidence lives in `proof/`. The Windows mirror is `Temp/slopstop-s7-arp02cen/`, including a complete raw source copy under `source/`.

The snapshot includes all **326 unique Git-tracked/nonignored untracked files** from the current worktree, including dirty S7 files, documentation, assets, package definitions and lockfile; it is not a HEAD archive. Installed Windows dependencies and generated outputs were not transferred. Raw SHA-256 maps before transfer, from Linux after transfer, and from Windows after transfer are identical: `manifest-before.json`, `manifest-transferred.json`, `manifest-windows-after.json`, each SHA-256 **`778fce6e347c6a5943fa306544b6f8992709e2c5a4d583852006a2d865c65a15`**. Reverification after integration and after all execution again found all 326 Windows/Linux files unchanged. This evidence append occurred only after that final comparison and is not included in the tested source identity.

The existing S3 Node 24.19.0/pnpm 11.5.1 toolchain was reused. `pnpm install --frozen-lockfile` succeeded only in the new source, using fresh owned home/cache/store/temp directories. No lockfile or version change occurred. Commands ran serially with a 768-MiB Node heap and Vitest `--maxWorkers=1 --no-file-parallelism`. Forge retained its unchanged internal `concurrent: 2` configuration; only one top-level build was run. `HUSKY=0` suppressed hook installation in this source snapshot, which contains no `.git` directory; no commit hook was bypassed because no Git writes were attempted.

### Actual Linux source results

| Selection | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| All protocol source tests | 974 | 0 | 0 |
| Writer runner | 148 | 0 | 0 |
| Authorization | 64 | 0 | 0 |
| Package launcher | 100 | 0 | 0 |
| Native verifier | 60 | 0 | 0 |
| Ordinary Storage smoke | 34 | 0 | 0 |
| Storage bridge | 12 | 0 | 0 |
| Private main composition | 29 | **38** | 0 |
| **Source selection total** | **1421** | **38** | **0** |
| Harness Writer fixture integration | **148** | **0** | **0** |

Both actual marker-file symlink authorization cases ran and passed on Linux. The earlier Windows EPERM inability remains correctly recorded as Windows-specific; this Linux run supplies separate platform execution evidence. Native verifier/launcher unit cases use their authored mocks, including Windows target simulations; their passing result is not actual Windows-native execution on Linux. Fixture integration is real Linux execution under its existing test seam, not the six-role packaged proof.

All 38 source failures occur in `canonical-writer-package-smoke-main.test.ts`. The test fixture returns `C:/proof/user` from authorization/getPath (lines 278–281), while the real runtime witness owner requires `path.isAbsolute(root)` (runtime line 43). On Linux this fixture path is relative, so preparation fails before the mocked runner. The test's success witness is absent, the runner is not called, and terminal-stage expectations receive `writer-internal`/unconfirmed output. **Proposed canonical-source correction, not applied here:** define the fixture root as a host-absolute path using the platform path API and derive all related fixture paths from it; retain the failing Linux tests as observed regression evidence, run the test-first correction in the canonical Windows task and retransfer a complete newly identified source. Do not weaken `canonicalRoot` or skip these 38 tests.

The first source command suffered MSYS conversion of its absolute JSON report destination; it still ran the tests and recorded the same 38 failures. The complete command was rerun with `MSYS_NO_PATHCONV=1` and the correct Linux destination. Final source report: `source-units-report.json`, SHA-256 `d23d94af677047e9f4a640bf8eff0c78c7ee22de1b32a20fc3d8350ae85eca20`. Integration report: `fixture-report.json`, SHA-256 `a3043dadec475373e4b25a609b316f11ecf5db252700b1c80c0956b8a837a242`. Protocol, Harness and Desktop typechecks each exited 0 on unchanged source.

### Actual packaged execution and concrete failure

The explicitly permitted CI-equivalent sequence was executed:

1. `pnpm package` — exit 0.
2. Root-owned preparation of exactly `/var/tmp/slopstop-s7-arp02cen/source/apps/desktop/out/SlopStop-linux-x64/chrome-sandbox` — ownership root, mode 4755, exit 0.
3. As UID 1000: `xvfb-run --auto-servernum env CI=true pnpm package:launch-smoke` — **exit 1**, `Packaged SlopStop smoke failed at writer-proof scenario.`

This is **not** a claim that literal `pnpm package:smoke` ran. No watcher, monkeypatch, injected preload, or race was used for sandbox preparation or launcher execution. The unchanged launcher removes NODE_OPTIONS/NODE_PATH from Electron. Package isolation used the existing same-volume rename; because its strict writer completion failed, the launcher deliberately retained its package and storage instead of reporting safe restoration/cleanup.

Retained package: `/var/tmp/slopstop-s7-arp02cen/slopstop-packaged-app-B8V9ZP/SlopStop-linux-x64`. Retained original CLI storage: `tmp/slopstop-package-smoke-CNTYj3/` under the owned root. Its actual runtime witness records Linux x64, Electron 43.4.0, main PID **1157**, and executable SHA-256 **`5ddc46108967a08a0fae75d8b12cb5faa2a2bf22cee6ef0a2af8199bd88e7eb2`**. The original CLI's full child pipe bytes were not externally retained; its own strict verifier determined failure, and they are not reconstructed from the later diagnostic.

A separate unchanged-image diagnostic, after confirming no owned executable remained live, renamed that retained package within the same volume, created a fresh authorized storage root, and ran bootstrap then writer directly. This is explicitly diagnostic evidence, not a replacement for the failed CLI. Bootstrap PID **442** exited 0; writer PID **578** exited **1**, stdout **0 bytes**, stderr **808 bytes**, both pipe EOFs observed. Raw writer stderr includes four Chromium D-Bus diagnostics followed by exactly:

```text
Package smoke writer processes terminal.
Package smoke proof failed at writer-native-preflight.
```

The writer published the actual Linux x64/Electron 43.4.0 witness for PID 578 with a fresh nonce. Before/after executable hashes agree with the witness. The diagnostic rename was restored to the retained isolation location and preserved root ownership/mode 4755. Its complete observations are in `direct-diagnostic-retained.stdout`; child bytes are in `writer-proof-direct.stdout`/`.stderr`. A diagnostic report filename collided with the earlier failed invocation's command-record filename; the intact stdout is the authoritative diagnostic result, not `direct-diagnostic.json`.

Physical checks confirm the packaged Linux native binary has published SHA-256 **`13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3`**, exactly matching the production pin. `ldd` on this binary resolves all dependencies. Packaged `app.asar` SHA-256 is `126a5a64d2e8aca3af597cb9b9b84ed519a43d1475cc66e0d9142164c4a78464`. Correct file bytes do not prove successful observed ASAR native loading: that preflight still fails. Its internal failing guard/loader cause is not exposed by the deliberately generic error boundary and has not been established here. No speculative native-source fix was applied. Next canonical-task diagnosis needs a bounded test-first reproduction of the actual packaged native load; D-Bus stderr is a separate strict-output failure requiring an explicit solution rather than output filtering or new unapproved host configuration.

### Completion limits and retained state

This is a **failed Linux candidate**, not completed S7 proof. The native-preflight failure occurs before the six utility roles, so SIGKILL/takeover timing, replay/audit/stale-writer assertions and all four sequential scenarios have no completed packaged Linux proof. The source selection also remains red. Final process inspection found no live executable under the owned root. Source, package, original storage and diagnostic storage are retained; no earlier retained root was deleted. `summary.json` indexes command/artifact hashes and exact per-file test counts in both evidence locations. Parent full fast/deep gates, independent reviews and acceptance remain pending. No global deep gate, mutation run, Git stage/commit/push or CI dispatch occurred.

## Linux portability continuation — canonical fixes and passing packaged proof

### Explicit scope and unchanged contract

The subsequent parent instruction explicitly authorized two bounded canonical-worktree fixes: portable private-main fixture paths and the genuine S7 native-loader observation fault, with observed Red/Green before implementation and complete byte-identical retransfers. It also authorized an ephemeral test-owned D-Bus session, without persistent services, system configuration, extra OS installations, output filtering or relaxed stderr/stdout rules. The earlier failed candidates remain retained evidence rather than being relabelled successful.

Before editing, `slopstop-s7-proof.mjs capture` retained 368 complete source/config/test/binding and selected build-baseline inputs in `Temp/slopstop-s7-capture-2026-09-11T12-43-15-784Z`, inputs SHA-256 `41609f8466384a5d28b2cb680cb67380732a4e0c5d4ee4da0a6f235b4b8ac436`. All **30 bindings** verified against unchanged contract identity **`8715f75d1e5a11bbc9ca6a8bc2e492a7f3520be7ad32f96d8b3cd8370825c8ad`**. Every subsequent canonical gate reverified those bindings and raw inputs. No normative design, protocol schema, product-core behavior, version, hash pin, sandbox guard, fuse or credential configuration was changed.

### Fixture path correction

The retained Linux matrix's 38 actual failures are the authorized Red for fixture portability. `canonical-writer-package-smoke-main.test.ts` now derives one host-absolute `/proof/user` or drive-root `proof/user` path using the existing `node:path` API and returns that same root from both mocked authorization and getPath. Challenge/witness filenames, fake executable bytes, nonce, field oracles and all negative guards remain intact. No real host `/proof` directory is created; these are mocked filesystem entries.

Windows focused Green: **67 passed**, `Temp/slopstop-s7-linux-fixture-path-windows-green-2026-09-11T12-43-52-444Z`. A fresh full snapshot at `/var/tmp/slopstop-s7-70ivnq86/source` then ran those same **67 tests successfully on Linux**. The test command exited 0; a subsequent UNC evidence-copy operation failed transiently, so its Windows command record and Linux `proof/main-report.json` are the result authorities. This copying failure is not a failed test. The final complete Linux matrix below independently includes all 67 again.

### Exact native cause, independent runtime diagnosis, and Red/Green

The bounded diagnostic used an independent copy of installed Electron 43.4.0 under `/var/tmp/slopstop-s7-70ivnq86/native-diagnostic/`, with only its copied chrome-sandbox prepared root:4755. It compiled the **unchanged pre-fix verifier source** with the existing esbuild into a disposable diagnostic module and ran it as UID 1000 against the earlier retained package's real `app.asar`. The retained package/executable/ASAR/native binary and installed dependencies were not edited. Public filesystem/resolver/dlopen observations were recorded only to a local private report.

`proof/native-probe-result.json` records actual Electron PID **10866** and proves these steps succeeded: exact regular physical binary, canonical realpath, published SHA-256, virtual package manifest, and exact virtual JS resolver. The delegated load then failed with:

```text
invalid mode for dlopen(): Invalid argument
```

**Root cause:** the caller invokes `process.dlopen(module, filename)` with two arguments. Both S7 observers converted this to `original.call(process, module, filename, flags)` with an explicit third `undefined`. That is observably different on this Electron/Linux runtime: the native loader rejects the resulting mode. The generic outer `WriterProofError` hid the underlying loader exception as designed; the fault was not the published binary, checksum, resolved path or missing host library. Current Node 24 documentation confirms the optional flags parameter and default RTLD_LAZY; actual runtime observations and pre-fix test failures establish the argument-count bug.

Before changing either observer:

| Gate | Actual result | Directory under Temp/ |
| --- | --- | --- |
| Main native omitted-flags regression Red | 1 failed; delegated mock rejects the synthesized third argument, public verifier throws | `slopstop-s7-dlopen-arity-main-red-2026-09-11T12-53-34-017Z` |
| Independent fixture argument-count Red | 2 failed, explicit-flags positive passed; expected two arguments, received three | `slopstop-s7-dlopen-arity-fixture-red-2026-09-11T12-53-45-385Z` |
| Main native + private-main Green | **128 passed**, no skips | `slopstop-s7-dlopen-arity-main-green-2026-09-11T12-54-43-046Z` |
| Independent fixture focused Green | **3 passed**, 146 deliberately unselected | `slopstop-s7-dlopen-arity-fixture-green-2026-09-11T12-54-56-848Z` |

The minimal canonical correction in `package-smoke-verifier.ts` and `canonical-writer-package-smoke-entry.ts` uses a typed rest-argument tuple and `original.apply(process, args)`. It preserves exact arity, argument values and receiver. Successful-load counting still advances only after delegation returns; exact filename checks, zero/multiple-load refusals, API checks and unconditional observer restoration are unchanged. Existing explicit-flags tests remain active; the independent fixture now also verifies explicit flags and receiver. No shared cross-application import was introduced; fixture origin observation remains independent.

### Final identical transfer and source validation

Fresh final root: **`/var/tmp/slopstop-s7-w4yp1s8l`**. Windows evidence mirror: **`Temp/slopstop-s7-w4yp1s8l/`**. All earlier source/proof/package roots remain intact.

All **326 tracked/nonignored untracked source files** were copied from the current canonical worktree, with full raw Windows snapshot and equal Windows-before/Linux-after/Windows-after hash maps. Final tested manifest SHA-256: **`72510da7636fbb1add68c6fd412be3ce8ebc648b3d4266d10f8bbb67f742ebb3`**. The enhanced external runner captures full canonical source plus all 30 raw binding files before each command and checks canonical/Linux file equality before and after it. Installed dependencies were freshly installed with frozen lockfile only in this owned source; Windows node_modules were not transferred. Final source verification again found all 326 files unchanged. This append is subsequent documentation, outside the tested source snapshot.

| Linux gate | Result |
| --- | --- |
| Complete selected S7/protocol/Storage source matrix | **1460 passed, 0 failed, 0 skipped**, including both real symlink cases |
| Complete Writer fixture integration | **149 passed, 0 failed, 0 skipped** |
| Desktop types | exit 0 |
| Harness types | exit 0 |
| Frozen dependency install | exit 0; actual Node 24.19.0, Electron 43.4.0, fs-native-extensions 1.5.1 reconfirmed |

Source report SHA-256: `573feba32da831bfcf9e6fb6e0ab6a602760fc5f71d9fb7cd6db068fa6f272dc`. Integration report SHA-256: `8c06e6a1156ece1053a8a00ccffed0bf64d910ffc45469efb7302c7fdc89d7d4`. Windows EPERM history remains Windows-specific; the Linux cases are actual separately executed coverage. Mocked target unit cases are not claimed as native execution on those simulated platforms.

### Legitimate D-Bus session and actual full Linux package success

The already installed `/usr/bin/dbus-run-session` and `/usr/bin/dbus-daemon` were used. A private session configuration binds its socket under this owned root's `tmp`, uses EXTERNAL authentication and ordinary private session send/receive/name policy. It defines no service activation directories. The session exists only around the command and supplies its normal `DBUS_SESSION_BUS_ADDRESS` to descendants. No private system bus, global socket/service changes, additional packages or log suppression was needed.

Executed pipeline:

1. `pnpm package`, exit 0, from the byte-identical source.
2. Prepare **only** the new package's `chrome-sandbox` as root:root, mode 4755.
3. As UID 1000, Xvfb + `dbus-run-session --config-file=<owned-session-config> -- env CI=true pnpm package:launch-smoke`.

This is the explicitly authorized build/preparation/launch equivalent, **not literal `pnpm package:smoke`**. There were two complete successful launches on the same final source/package: one with a transparent Node-side stdout/stderr/witness/rename recorder, and a terminal run with **no Node observer import**. Electron received no NODE_OPTIONS/NODE_PATH; the unchanged launcher removes them. Neither run altered the launcher, image, ASAR, fuses or native binding. The recorder does not change output bytes; a separate report asserts exact captured bytes and image/witness identity.

The first recorder attempt itself mishandled an intentionally missing authorization root and stopped during the negative matrix. Its failed command and records are retained as **instrumentation failure**, not a product Red or a package pass. The recorder was corrected to tolerate missing/non-directory observation paths without changing the actual spawn. The subsequent full observed run and independent uninstrumented run both exited **0**. A later metadata-only Node `-p` query hit WSL shell argument parsing; rerunning through `--exec` succeeded. No failed diagnostic is promoted to application evidence.

| Observed successful scenario | Actual main PID | Exit | stdout bytes | stderr bytes |
| --- | ---: | ---: | ---: | ---: |
| bootstrap | 3094 | 0 | 0 | 0 |
| writer-proof | **3228** | **0** | **0** | **76** |
| missing-runtime | 3510 | 0 | 0 | 0 |
| witnessed-staging | 3640 | 0 | 0 | 0 |

All four used the same authorized storage root in that order. Actual Writer stderr was **exactly**:

```text
Package smoke writer processes terminal.
Package smoke writer proof passed.
```

Actual Writer stdout was the empty byte sequence, not the Windows CRLF allowance. The fresh bounded runtime witness reports main PID **3228**, `platform: linux`, `arch: x64`, `electronVersion: 43.4.0`; nonce agrees with the launch challenge. The independently hashed executable before launch, the main-published hash, after close and restored package all agree:

| Artifact | SHA-256 |
| --- | --- |
| Electron executable | `5ddc46108967a08a0fae75d8b12cb5faa2a2bf22cee6ef0a2af8199bd88e7eb2` |
| Final `app.asar` | `e0a43d3d6efb09a8176a67ed8f73de561da892238ef6ac057aa9283d0c9c204e` |
| Published Linux x64 native binding | `13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3` |

The unchanged real runner completed its six roles and enforced the nonzero hard-killed holder exit plus both EOFs, observed-exit takeover deadline, C1/R1 replay and stale-epoch denial, C2/R2, independent exact-row audit/generic abandonment, live old Writer/new Q generation with zero stale work, and terminal/EOF cleanup before main success. The report does not invent a separately retained numeric takeover duration; success is evidence that the existing <=15000ms guard passed.

The second uninstrumented launch independently returned the final package success summary. External read-only `/proc` sampling recorded Writer main **3235** and six direct Node utility children **3310, 3342, 3377, 3412, 3446, 3480**. These PIDs belong to that second run, not the PID-3228 witness run. Role order/semantics come from the unchanged runner's successful contract checks; process polling alone is not SQL/EOF proof. The first report revision looked for inherited scenario env in utility children and therefore showed an empty utility list; `linux-final-report-v2.json` correctly uses observed parentage and asserts six children from the already retained process trace.

Both package and storage isolation used the existing same-volume rename. Before/after helper device, inode, ownership and mode agree; the package returned to its original output path, and the successful scenario storage and temporary package-isolation root were removed. The terminal process trace includes the temporary bus/Xvfb/process tree and reports **no live observed PIDs** after completion. All earlier failed packages/storage and all source/evidence roots remain retained.

### Final checks, artifacts and remaining parent work

- CodeScene baseline reviews for the modified runtime owners and private-main test: **10.0**. Post-change detailed reviews for all five touched TS files: **10.0**, no findings. Final cumulative safeguard: **passed**, 21 eligible/checked files; the only reported finding was an existing improvement in main.ts, not a degradation.
- Biome: all five touched TS files passed. Windows Desktop/Harness types passed. Dependency boundaries passed: 232 modules, 722 dependencies, no violations. `git diff --check` passed before this evidence append. Stale LSP/write-hook diagnostics are not represented as actual compiler failures; explicit tests/types/format checks are the authorities.
- Sonar MCP tools are **not exposed in this session**, so Sonar was not executed here. This is not a global Sonar cleanliness or availability claim.
- Primary final report: `Temp/slopstop-s7-w4yp1s8l/linux-final-report-v2.json`, SHA-256 **`1864cba15089d3409e6d388008acb1f170dc005baf414fbed85992e113369ff8`**. Linux counterpart: `/var/tmp/slopstop-s7-w4yp1s8l/proof/linux-final-report-v2.json`. `summary.json` indexes raw outputs, reports and hashes; `captures/<command>/` holds full pre-command source/binding contents in Windows Temp. `terminal-processes.json` SHA-256: `0d20d13bd9825f12cb7096a22d016793f87e40d1c36bb57e0491de81e7335824`.
- The Linux requested source/unit/integration/package proof is now **passed** for this exact corrected source. The final native observer changes modify packaged source, so the earlier Windows package pass does **not** establish byte-identical Windows proof of this new candidate. As explicitly permitted, the parent still owns a refreshed Windows package run, final fast/deep gates, independent review, Sonar where available and human acceptance/commit confirmation. No full Windows deep run, mutation, stage/commit/push or CI dispatch was performed.

| Canonical changed source | Final raw SHA-256 |
| --- | --- |
| `apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts` | `fed2dd7412f5dfb0d3161e1b263cb99efc88be942dbb2cd0a5262084c6f60207` |
| `apps/desktop/src/main/package-smoke-verifier.test.ts` | `ee43d2b50de9a3fcf0791cb47e5925f806e52df1891368c065d0de5c3ef25d9d` |
| `apps/desktop/src/main/package-smoke-verifier.ts` | `9eec71872b4b593937d4d3722d201f6ef1d3701c38bd8c480fa8d6ee558b5d71` |
| `apps/harness/tests/integration/canonical-writer-package-smoke-entry.ts` | `93d94ba37b0ca7c7c0db28d62eb4a530455f727c58105802f75d151c6c805fbc` |
| `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts` | `af98d697d854a5cce0686a7e5d2a643f8cd11823f4cc4fd4fa4cf0859c8c172b` |

## Canonical Windows terminal validation — package/fast passed; deep and current binding blocked

### Tested source correlation and renewed package runs

At entry, all326 files in the Linux manifest `72510da7636fbb1add68c6fd412be3ce8ebc648b3d4266d10f8bbb67f742ebb3` were compared with the canonical Windows tree. All source/configuration/lockfile bytes matched; only this subsequently appended evidence document differed. Report: `Temp/slopstop-s7-canonical-correlation-M4pQa7/report.json`, SHA-256 `ada91c923e643ed6958bca44e2591c025246f6543e4f6454eef6747b4fd6ee67`. This is the source that includes the Linux dlopen-arity correction and portable main-test root. Earlier pre-correction Windows passes were not reused.

The canonical worktree then executed two fresh, literal **`pnpm package:smoke`** runs on this same source:

| Run / suffix under `Temp/slopstop-s7-` | Result | inputs.json SHA-256 |
| --- | --- | --- |
| `terminal-windows-observed-trace-2026-09-11T13-30-07-883Z` |exit0; full four stages, bound runtime, exact stdout/stderr | `655977eecf5fbd3cd86615940f7d05c1899e6e94994edf3fb4f294eb7e80bc20` |
| `terminal-windows-unobserved-2026-09-11T13-30-59-821Z` |exit0; independent normal run with no Node observer import | `32019e11bf7acadab2ec855799421588501a5c0739c3d5e9cc1d3cdfaabcde93` |

The observation shim delegates original argument arrays unchanged and uses separately owned, closed read descriptors; it does not modify dlopen arity or runtime-owned file references. The unobserved run independently verifies that the observer is not necessary for success. The Node memory bound is not an observer, and the launcher removes NODE_OPTIONS/NODE_PATH from Electron's environment as before.

Observed outer stage PIDs were bootstrap4848, writer21960, missing-runtime20884 and witnessed-staging27960. All exited0 with actual spawn, exit, close and both EOFs; all four used the same authorized root. Writer's main-produced witness identified win32/x64/Electron43.4.0 and nonce `8ecd4ffe764b5a79f2ec8ebdd09d35616e89f649b1265f7b5b735956175dd0f5`. Its PID equals observed spawn PID21960. Isolated pre-image, main witness, post-close image and restored-image hash all equal `0123f96782d15e8f46eecb27f7784379c0099e02c492684944bd8000a55b04b2`. Actual stdout was exactly0d0a; stderr exactly `Package smoke writer processes terminal.\nPackage smoke writer proof passed.\n`. The unchanged runner's six-utility ownership/crash/drain/takeover/replay/audit/live-stale self-oracles completed before that pair; the four outer PIDs are not relabelled as utility PIDs.

Both runs emitted the exact final summary plus LF: `Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.` Successful root/container removal and original package restoration were independently checked. Older uncertain resources remain untouched. Windows native SHA remains the published `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4`; tested ASAR SHA is `9b009b5e135e7b4205f60250442fb82faa085c57fc0e00046f7595be841c1284`.

### Exact fast/deep commands and actual outcomes

Commands were sequential and captured full source/test/config/lockfile/script/binding inputs before execution, with raw output and after-run hash checks whenever the command completed. `VITEST_MAX_WORKERS=1` is the documented per-invocation resource control; it preserves all cases and thresholds. A read-only attempt to query workspace concurrency through npm_config returned undefined, so it was not represented as effective or used for the gates. No persistent configuration, test timeout, coverage threshold, exclusion, dependency or host service was changed.

**`pnpm check` passed** in `terminal-fast-check-2026-09-11T13-33-45-798Z`, inputs SHA-256 `f6d931a077b693dd0683ebfb6b583fab176857dcd83aa24bfc77b1924c1b4147`: format, lint, all workspace typechecks,51 unit files/**2381 passed +2 existing Windows EPERM skips**, and boundaries232 modules/722 dependencies all succeeded. The same fast subchain passed again inside each deep attempt. Linux's actual corresponding symlink passes remain separately recorded, not fabricated Windows zero-skip evidence.

First `pnpm check:deep`, `terminal-deep-check-2026-09-11T13-37-50-846Z`, was interrupted by the tool's20-minute limit during coverage. Its partial log/inputs are retained; no completed report or pass is invented. Partial coverage files demonstrated progress. A subsequent exact ancestry/command inventory for wrapper PID33928 found no live owned descendants and no leftover coverage command. No arbitrary process kill was used.

Second exact **`pnpm check:deep` completed with exit1**, using a longer tool allowance without altering any test deadline: `terminal-deep-check-complete-2026-09-11T14-02-56-207Z`, inputs `fc49a0a5dfa5013ec61e811dbbcc65bec709b0e656691aea493b7f5b0729004a`. Its fast subchain passed, then coverage reported **two `Worker exited unexpectedly` / `[vitest-pool]: Worker forks emitted error` failures**. Result:65/67 test files passed;3716 tests passed,2 skipped,97 unfinished from3815 total. Aggregate coverage was statements92.98%, branches88.17%, functions93.05%, lines94.01%, with no threshold failure reported. This is still a **failed/incomplete coverage run**, not a coverage pass. Worker crash cause remains unresolved; neither the historical F1/F2/S6 issues nor the repaired native arity are asserted to be its cause.

Focused diagnosis ran unchanged `canonical-command-driver.integration.test.ts`:5 passed without coverage (`terminal-driver-diagnostic-2026-09-11T14-28-54-065Z`) and5 passed with coverage (`terminal-driver-coverage-diagnostic-2026-09-11T14-29-18-415Z`). Those small positives neither reproduce nor resolve the full-load worker exits, and do not replace the failed root gate.

Downstream cheap sub-gates were inspected independently after the deep chain stopped:

| Sub-gate | Actual terminal result |
| --- | --- |
| Format/lint/types/unit/boundaries |passed within fast and repeated deep fast subchains, on the pre-export-change source|
| Coverage |failed:2 unexpected worker exits and incomplete cases|
| Full standalone integration |not reached by deep; not executed separately in full here; focused driver only passed|
| Knip |failed:9 unused exports,2 unused exported types,1 duplicate export group|
| jscpd |failed:21 clones,851 duplicated lines/1.28%, configured threshold0 retained|
| Architecture sub-gate |not reached by this deep chain; earlier scoped result remains historical|
| Electron journeys |not reached|
| Final deep package-launch sub-gate |not reached; independent full Windows package commands above passed|

Knip capture: `terminal-dead-code-2026-09-11T14-30-01-520Z`, inputs `283e27c3be9dc9906df107a7540e1ff4addc3548e72e60582e2e1118da4db9df`. jscpd capture: `terminal-duplicates-2026-09-11T14-30-56-856Z`, inputs `9118b9cabe86f4c242dbe8447722898c22cebbae6b9f4a60db842afa6b08da02`. Neither command was softened to pass.

### Narrow S7 correction and grounded predecessor findings

Knip identified `writerProofLimits` and `WriterProofCleanupFailure` as unused exports in `canonical-writer-package-smoke.ts`. Source search confirmed all their uses are within that owner. Only the two `export` keywords were removed: values, types, process limits, behavior and public `runCanonicalWriterPackageSmoke` outcome remain unchanged. This is a non-behavioral export-wiring correction with an actual Knip failing observation, not manufactured product Red. The source edit was explicitly announced as requiring renewed Linux proof. Current owner hash is `fe708b3b2a23db0837cb7086daa2d1121acbd5038feaa7a69e1b10c183fc503c`; tested Linux/Windows owner hash was `0f6513f40ef0fc195229c1a0f80c569a61b2294f3abbb4ffc61c44e736d10cb5`. An assertion verifies the current file differs by exactly those two removals. Static CodeScene review of this pending edit returned10.0/no findings; tests/types/package and a final Knip rerun have **not** validated it because the binding blocker below intervened.

The other10 Knip findings concern predecessor-owned fixture exports (`conflictInput`, `expectConflictRows`, `prepareConflict`, `rejectedText`, `prepareRejected`, `expectRejectedRows`, `recoveryRetryTime`, `recoveryRuntimeTime`), `CanonicalRepositoryActivationInput`, and duplicate export aliases `settlementFixtureTime|settlementT1`. They were not silently removed outside S7.

All21 clone pairs are in predecessor-owned files: the two Storage/Workspace bridges, migration SQL versus its golden SQL fixture, coordinator/Storage fixture, conformance/Canonical application tests, runtime tests, repository tests, settlement/reconciliation/recovery tests and fixtures, bootstrap tests and protocol/Storage fixture cases. No S7-only clone was reported. Removing golden-oracle bytes, ignoring files or changing threshold0 was not used as a workaround.

Grounded comparison against `77f7667` retained original Git blobs and found **all28 inspected source/config/lockfile inputs byte-identical** to the predecessor, including every clone/remaining-Knip file, both analyzer configs, lockfile and driver/transaction dependencies. Report: `Temp/slopstop-s7-predecessor-findings-aazmJd/report.json`, SHA-256 `d6a3606cdb77f1d1a1ed5bb4fc770a12bdf9f8957ca5309f94ebd41847216697`. This proves the clone bytes and identified definitions/configurations predate S7; it is expressly a raw blob comparison, **not a fresh execution of the predecessor's complete gates** or proof of the worker-crash cause.

### Unexpected current contract drift: further gates stopped

After the Knip export correction, the next ordinary captured command was refused **before execution** with `Contract drift: PRODUCT.md`. Other work changed PRODUCT/CONTEXT/README during this session to record **Ragnarok** as the product name while expressly deferring the technical rename. These changes were not authored or reverted here. The technical S7 stdout policy was not silently renamed or changed.

The active30-binding packet requires PRODUCT normalized SHA `4ea1cb0c6f28a0f8d38f430390fe2515520444370f94e8990c2cf179f596d732`; current PRODUCT SHA is `d6184abfa7679fd56243e4ca8e3d313a207fd51be759f20462277e73fb32267c`. CONTEXT also changed from its pinned `79bab811451c7935213ba431ac77b71807ac5c4ff022f964176b2081dd198fe5` to `c7e57244535a9c39a7e6cf976a1e86b7c5122c087e792dbb13fd6e1c8999c72a`. Current README SHA is `70a11f176e020686e4e9bb29609d4b602394b9c14c3792536657164b83fe0074`. The binding verifier was not weakened, the packet was not rewritten and no further test/build gate was run under a false claim of identity8715.

Only read-only predecessor comparison and report preservation then used the independent diagnostic capture wrapper, which captures current bytes without granting contract approval. Their diagnostic labels are not successful S7 gates. The pending export-only change remains in the canonical tree; the earlier Windows and Linux passes and fast result are valid for their captured **pre-export-change** source, not for the current final tree. Parent must refresh the binding after the product-document change, authorize any remediation outside S7, and renew affected Windows/Linux/final gates before freeze/acceptance.

### Retained terminal report and limits

**`Temp/slopstop-s7-terminal-report-5qcLs3/report.json`**, SHA-256 **`1f71148869471b7a81a0db08349a83ae2e37a0a0487b1248c71b93bc4431be0d`**, records status **blocked**, exact observed Windows witness/image/stages, the separate unobserved output, fast/deep/Knip/jscpd raw logs and input manifests, Linux report, predecessor comparison, and separately named tested versus pending owner source. It verifies current source differences from the Linux snapshot are the evidence append, PRODUCT/CONTEXT/README and the two-export owner edit.

Key retained hashes: tested Windows EXE `0123f96782d15e8f46eecb27f7784379c0099e02c492684944bd8000a55b04b2`; tested ASAR `9b009b5e135e7b4205f60250442fb82faa085c57fc0e00046f7595be841c1284`; Windows observations `992e9c2d8dec7e5dd4f0ec79a222d792606171377390ca2d7d5f7c4e9182604e`; unobserved run log `e36dabf3f12597e7bd91649ec73d768169a4de4f0c81593953e4dbfe666594f8`; completed deep failure log `07d80b1d03fa0d4be51fb1b449a2d759f6b62e75d2ab8f87e6c31d2d647971db`; unchanged Linux report `1864cba15089d3409e6d388008acb1f170dc005baf414fbed85992e113369ff8`.

No stage/commit/push, CI dispatch, global mutation test, OS/dependency/service install, persistent resource config, broad process kill or cleanup of previous uncertain roots occurred. Sonar MCP remains unexposed here and was not executed; no global tool-availability/cleanliness claim is made. Historical F1/F2, S6 and native warnings remain qualified. **S7 final validation is not complete and no all-passed claim is made.**

## Guidance reconciliation and final-validation scope — 2026-09-11T15:58:48+0100

Human literal choice: **`Concluir validação (Recomendado)`**. The user explicitly authorized preserving the independently changed PRODUCT/CONTEXT/README outside the S7 commit, updating contract references without technical rename, and minimal behavior-preserving Knip/duplication/coverage cleanup required by the deep gate with no threshold weakening, ignored warnings, disabled checks or newly skipped tests. The user clarified that prior OOM coincided with TFT gaming and requested no special new global resource policy. That is attributed user context, not proven worker-crash causation; failed/interrupted attempts remain failed and normal full coverage/deep retry remains required. No further semantic choice is pending for this bounded reconciliation; parent owns independent delta inspection and later acceptance.

### Guidance and protected user bytes

Read the current PRODUCT/CONTEXT/README diff against full HEAD77. PRODUCT records Ragnarok as official product name and expressly defers technical rename; CONTEXT changes heading and adds the two name definitions; README explains the same identity decision. Brand/UI exploration remains provisional. No S1-S7 technical behavior changes follow. All exact SlopStop runtime labels, package/application IDs, database/storage/private filenames, stderr/summary strings, stdout amendment and runtime witness stay unchanged. None of these three user documents was edited, reverted, staged or committed here; all are excluded from the eventual S7 commit list and protected through future checkpoints.

| Path | Prior contract normalized SHA-256 | Current protected raw SHA-256 (also normalized-LF SHA) |
| --- | --- | --- |
| PRODUCT.md | `4ea1cb0c6f28a0f8d38f430390fe2515520444370f94e8990c2cf179f596d732` | `d6184abfa7679fd56243e4ca8e3d313a207fd51be759f20462277e73fb32267c` |
| CONTEXT.md | `79bab811451c7935213ba431ac77b71807ac5c4ff022f964176b2081dd198fe5` | `c7e57244535a9c39a7e6cf976a1e86b7c5122c087e792dbb13fd6e1c8999c72a` |
| README.md | Not bound by prior30; remains outside contract | `70a11f176e020686e4e9bb29609d4b602394b9c14c3792536657164b83fe0074` |

Pre-edit read-only artifact validator returned OK, separately from contract verification, which found exactly the two expected PRODUCT/CONTEXT binding mismatches. Old guide files at the earlier09:41 capture path were absent; this was not treated as a clean replay. Recovered the old bytes and all30 raw binding files from **`Temp/slopstop-s7-capture-2026-09-11T13-24-19-973Z/`**, inputs SHA `07ad48c37f6f361c5fe9bff9f34c8ccad6c8714ca40cb389998604cc29dcb382`. Every old bound section/file was rehashed against the original30 packet, reproducing **`8715f75d1e5a11bbc9ca6a8bc2e492a7f3520be7ad32f96d8b3cd8370825c8ad`**. Old packet remains unchanged, raw SHA `e84ed4e87691a86372b2a4508bbe270947d8a65b02ce6b39c57e8bd672d7df3b`; no historical identity or report is restamped.

Current raw repository/user files were preserved before edits under `Temp/slopstop-runtime-binding-guidance-preservation-2026-09-11T14-59-41-027Z/files/`, inputs SHA `cc91c887b3c6a68d83ae27145f6b3c1b9f81ecfdecd940895f970f99ce943dc1`. The wrapper invoked only the read-only document validator, not tests or runtime proof. Pre-edit raw design SHA is `cfdafb86d40ef268d2cf923eb76d07aa397a62e0758dc2120cfec49ba96155c3`.

### Confirmed cleanup inventory, recorded before any cleanup edit

Source: `Temp/slopstop-s7-terminal-report-5qcLs3/report.json`, SHA `1f71148869471b7a81a0db08349a83ae2e37a0a0487b1248c71b93bc4431be0d`. Its retained `knip.log` SHA is `f90adfeb84472aba3d801395e472c131920165f264417af45973834c44a093c1`; `jscpd.log` SHA is `dd7c4379b18d2fe2c4403f8b10bdf3fe3ea7915a7e8324522999b7fafb9d8b58`; `predecessor-findings.json` SHA is `d6a3606cdb77f1d1a1ed5bb4fc770a12bdf9f8957ca5309f94ebd41847216697`. Read-only current/Git-blob hash comparison reconfirmed all28 report paths equal the predecessor; this was not an analyzer/test execution or proof of crash cause.

**Ten remaining Knip findings:**

| Exact path | Recorded finding |
| --- | --- |
| apps/harness/tests/integration/canonical-command-fixture.ts | Unused exports `conflictInput`270, `expectConflictRows`299, `prepareConflict`410, `rejectedText`541, `prepareRejected`567, `expectRejectedRows`589 |
| apps/harness/tests/integration/canonical-writer-recovery-runtime-fixture.ts | Unused exports `recoveryRetryTime`60, `recoveryRuntimeTime`62 |
| apps/harness/src/storage/canonical-command-repository.ts | Unused exported type `CanonicalRepositoryActivationInput`73 |
| apps/harness/tests/integration/canonical-command-database-fixture.ts | Duplicate aliases `settlementFixtureTime` / `settlementT1` |

The two earlier S7-only export removals in `apps/desktop/src/main/canonical-writer-package-smoke.ts` remain pending validation; they are outside the remaining-ten count and not authored in this document task. Any future removal must reconfirm consumers and preserve runtime/type behavior.

**Twenty-one exact jscpd clone pairs:** ranges below are the retained diagnostic line ranges, not new measurements after refactoring. `H/` means `apps/harness/`, `D/` means `apps/desktop/`, `P/` means `packages/protocol/`.

| # | First exact path and lines | Second exact path and lines |
| --- | --- | --- |
| 1 | D/src/main/project-storage-bridge.ts 189-204 | D/src/main/workspace-bridge.ts 215-230 |
| 2 | H/drizzle/canonical/0001_canonical_project_writer.sql 1-534 | H/tests/fixtures/canonical-project-writer-generation-2.sql 1-534 |
| 3 | H/src/active-project-coordinator.ts 108-142 | H/tests/integration/project-storage-create-fixture.ts 122-156 |
| 4 | H/src/canonical-project-application.test.ts 53-64 | H/tests/integration/conformance-counter-command.ts 281-292 |
| 5 | H/src/harness-runtime.test.ts 112-145 | H/tests/integration/harness-runtime.integration.test.ts 405-438 |
| 6 | H/src/storage/canonical-command-repository.test.ts 436-449 | H/src/storage/canonical-command-repository.test.ts 580-593 |
| 7 | H/src/storage/canonical-command-repository.test.ts 449-460 | H/src/storage/canonical-command-repository.test.ts 596-607 |
| 8 | H/src/storage/canonical-command-repository.test.ts 509-519 | H/src/storage/canonical-command-repository.test.ts 564-574 |
| 9 | H/src/storage/canonical-command-repository.test.ts 737-749 | H/src/storage/canonical-command-repository.test.ts 923-935 |
| 10 | H/src/storage/canonical-command-repository.test.ts 867-880 | H/src/storage/canonical-command-repository.test.ts 933-946 |
| 11 | H/tests/integration/canonical-command-repository.integration.test.ts 338-348 | H/tests/integration/canonical-command-repository.integration.test.ts 821-831 |
| 12 | H/tests/integration/canonical-command-repository.integration.test.ts 815-829 | H/tests/integration/canonical-command-repository.integration.test.ts 875-889 |
| 13 | H/tests/integration/canonical-command-repository.integration.test.ts 948-964 | H/tests/integration/canonical-command-repository.integration.test.ts 1159-1174 |
| 14 | H/tests/integration/canonical-command-repository.integration.test.ts 1055-1070 | H/tests/integration/canonical-command-repository.integration.test.ts 1175-1190 |
| 15 | H/tests/integration/canonical-project-settlement.integration.test.ts 32-46 | H/tests/integration/canonical-project-settlement.integration.test.ts 93-107 |
| 16 | H/tests/integration/canonical-writer-reconciliation.integration.test.ts 342-362 | H/tests/integration/canonical-writer-reconciliation.integration.test.ts 537-557 |
| 17 | H/tests/integration/canonical-writer-recovery-fixture.ts 372-387 | H/tests/integration/conformance-counter-command.ts 600-615 |
| 18 | H/tests/integration/canonical-writer-recovery.integration.test.ts 422-434 | H/tests/integration/canonical-writer-recovery.integration.test.ts 567-579 |
| 19 | H/tests/integration/process-bootstrap.integration.test.ts 206-219 | H/tests/integration/process-bootstrap.integration.test.ts 267-281 |
| 20 | H/tests/integration/project-storage-create-fixture.ts 812-829 | P/src/canonical-project-protocol.test.ts 305-322 |
| 21 | H/tests/integration/project-storage-create-fixture.ts 829-849 | P/src/canonical-project-protocol.test.ts 322-342 |

The union of the clone paths and remaining-Knip paths is22 files. The other six of the28 compared inputs are `knip.jsonc`, `jscpd.json`, `pnpm-lock.yaml` (reference/configuration identity, no permission to weaken/change them), and `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`, `apps/harness/src/storage/local-libsql-worker-client.ts`, `apps/harness/src/storage/project-storage-transaction.ts` (coverage/driver diagnosis context, not asserted causes). Before an edit, record the exact confirmed finding, affected existing consumer/support paths and any minimal same-boundary helper in evidence. A diagnosis-only reference is not automatically an edit target. No unlimited features, technical rename or boundary expansion is authorized.

Preserve independent golden-oracle meaning, assertions and complete selection; do not solve the SQL clone by replacing independent expected bytes with the migration being tested. No removed golden proof, lowered coverage, ignored warnings, new analyzer/CodeScene exclusions, skipped tests, disabled checks, changed native/dependency version, host/global resource policy or security workaround. Minimal behavior-preserving refactors may address confirmed findings under existing ownership/boundary rules; renewed source-bound checks/review must verify them. If a safe correction is not established, report the blocker rather than hide it.

### Continuation boundary

Future validators must load the new31-binding packet, not disable the PRODUCT assertion or claim updated guidance still hashes to8715. All previous code/package/coverage/reviewer reports remain bound to their original source/contract; the new authority does not backdate cleanup scope. Root full coverage/deep must be retried normally with all cases and thresholds; the user explanation does not prove the two worker-exit causes. Existing2 EPERM skips and97 unfinished cases stay qualified, not converted to passed tests, and no new skips are allowed.

This author changes only canonical design metadata/follow-up, this append-only evidence, and a new Temp intent packet. No code/test edits, source/test/analyzer execution, Git writes or review dispatch occur. Parent owns independent metadata/cleanup-delta inspection, later source-bound review and acceptance. S7 remains work in progress; original main59, base77, six commits, fixture/helper authority and S5/S6 proof qualifications remain unwaived. Guidance naming has **no runtime behavior impact**.

### New measured contract pin

- Original30 content hashes stay identical except the two explicitly reconciled whole PRODUCT/CONTEXT hashes. Binding30 only changes its exclusive end to the new heading, preserving `0a7d95efa9254fafeaa1853e8a59fe372d42080b6de43409b5418e691c82f12d`; binding31 is the complete follow-up at lines13079-13109 (TDD starts13110), section SHA **`716c43b5dab93b62ee4baec183984cc24b48f799914a1485698cbbc3c3099e46`**. All31 live hashes were recomputed with exact unique heading selection and normalized LF.
- New contract SHA-256: **`cb41ffc2228d6892b2ba7e27d3886fa9b4fd07c41c51108f5f0a34f3b69d2f2f`**. Prior contract **`8715f75d1e5a11bbc9ca6a8bc2e492a7f3520be7ad32f96d8b3cd8370825c8ad`** remains reproducible from the saved13:24 raw archive; no old packet was edited.
- Finalizing stamp ran only after reconciliation/preservation, then the separate read-only validator returned OK. Raw design SHA **`484be67e43e7f0b3429c0c5a3a399a07f88d5f679d70567d1236ed9a57421418`**; validator content_hash `691a7b8923b620a004ec7d59168e74c1309759a41f21bfc4b2e0f5f0855656ef`. Automatic write hooks skipped due to Node unavailable, not passed.
- New common `mode=intent` packet: `Temp/slopstop-s7-guidance-intent-packet-20260911.json`. It binds all31 records, current protected user-document hashes, recoverable original30 archive, confirmed cleanup report/logs/path inventory, and current source-reference capture. Packet digest is reported separately to avoid self-reference. New31 bindings are required before future captured checks; weakening assertions or reusing stale8715 identity is prohibited. Parent may inspect this approved semantic delta; no dispatch or implementation acceptance is claimed here.

## Knip/coverage execution — confirmed consumer map BEFORE cleanup edits

Current delegation follows the human `Concluir validação (Recomendado)` choice. Parent reports completed/passed narrow intent inspections under contract `cb41ffc2228d6892b2ba7e27d3886fa9b4fd07c41c51108f5f0a34f3b69d2f2f`: code `ses_f7044d45bffeSZPg8QtoUR67bn`, coverage `ses_f703edf50ffewkvt7wZMcGzAP4`, slice `ses_f703ca3c7ffeZsuOvZCvqQAipY`. These are parent-received tool results, not rerun reviews or a fabricated human hash approval. Packet raw SHA is `ee0af1a15ab392d9fa71d80dd9cf3f81520326bc38c08c5c8512da5ea8a4c618`. The capture runner now checks all31 bindings and exact raw protected PRODUCT/CONTEXT/README hashes before and after commands. No protected document is an edit target. Existing captures/packets remain unchanged.

This execution is limited to the ten remaining Knip findings, verification of the two existing S7 export removals and full coverage. Duplication cleanup and renewed package/OS proofs are parent-following work. Before any source cleanup, `pnpm check:dead-code` reconfirmed exactly8 unused exports,1 unused exported type and1 duplicate export group, with no remaining `writerProofLimits`/`WriterProofCleanupFailure` finding. Capture `Temp/slopstop-s7-knip-cleanup-baseline-2026-09-11T15-21-11-394Z`, inputs SHA `64947db2de5676a2b21ffe11af0830423a1169038f32ebdc94143f0d0338008c`.

Concrete current consumer search and source inspection establish the following planned minimal edits; no function body, assertion, scenario, case ID/order, SQL fixture or literal value will be changed by these export corrections:

| Finding | Definition/owner | Actual current consumer(s) | Authorized correction |
| --- | --- | --- | --- |
| E1214 `conflictInput` | `apps/harness/tests/integration/canonical-command-fixture.ts:270` | Same-file conflict preparation/replay cases, e.g.139,144,334,422,439,456,464,519,564 | Remove only `export`; retain used function |
| E1215 `expectConflictRows` | same file:299 | Same-file row/replay checks257,335,403,426,460,497 | Remove only `export`; retain assertions |
| E1216 `prepareConflict` | same file:410 | Same-file121,448,517 | Remove only `export` |
| E1217 `rejectedText` | same file:541 | Same-file replay matrix563 and rejected-command cases616-762 | Remove only `export` |
| E1218 `prepareRejected` | same file:567 | Same-file614,630,644,661,684,705,752 | Remove only `export` |
| E1219 `expectRejectedRows` | same file:589 | Same-file617,633,647,733 | Remove only `export`; retain assertions |
| E1220 `recoveryRetryTime` | `apps/harness/tests/integration/canonical-writer-recovery-runtime-fixture.ts:60` | Same-file receipt68 and retry clock331 | Remove only `export`; retain exact UTC literal |
| E1221 `recoveryRuntimeTime` | same file:62 | Same-file message91/175 and runtime clock163 | Remove only `export`; retain exact UTC literal |
| E1222 `CanonicalRepositoryActivationInput` | `apps/harness/src/storage/canonical-command-repository.ts:73` | Same-file factory interface82, owned input191 and implementation362 | Remove only `export`; retain the internal type and exposed factory signature structure |
| E1223 duplicate time aliases | `apps/harness/tests/integration/canonical-command-database-fixture.ts:22/26` | `settlementT1` is used internally53, re-exported by `canonical-command-fixture.ts` and consumed by recovery/reconciliation helpers. `settlementFixtureTime` is imported only by `conformance-counter-command.ts:48` and used at195,247,251,295 | Keep one exported owner, `settlementT1`, with the **same literal** `2026-09-05T12:00:01.000Z`; update those four uses and their import to that owner. Existing dynamic settlementT1 import at547 already selects the same owner |

The five edit paths are the four definition files above plus the actual alias consumer `apps/harness/tests/integration/conformance-counter-command.ts`. No new helper or compatibility alias is needed. CodeScene detailed baseline on all five files is10.0/no findings; OAuth configuration is unchanged and verification passed5/5. This mapping is recorded before source edits and does not turn unused exports into unused definitions.

The normal full `pnpm test:coverage` baseline ran without an injected heap limit, pool override, worker cap or changed timeout: `Temp/slopstop-s7-full-coverage-normal-baseline-2026-09-11T15-21-53-444Z`, inputs SHA `1a7fabf2e5bc6bb9b53dbee26ccb91999610ec167538eeed4b1cb95ac7e6758f`. It completed selection of3815 cases:3808 passed,5 failed,2 existing skips, no unfinished cases and no reported unexpected worker exit. Failures were a5000ms coordinator-test timeout plus four fixture result-wait assertions with secondary EBUSY cleanup errors. This does **not** prove the old worker exits were caused by TFT; it is the new actual observation. No timeouts or tests have been changed to hide it. Full coverage must be rerun after the bounded cleanup, with any recurring failure diagnosed separately.

### Coverage synchronization correction — recorded before edit

Knip is now clean (`knip-cleanup-green-2026-09-11T15-36-16-532Z`, inputs `e6e96553e93d5ac3a82ba3eac280290b80c88e87047ff1224d0b16452083441a`). A second unchanged normal full coverage run, `full-coverage-normal-after-knip-2026-09-11T15-41-50-292Z`, inputs `ff5a5b98bf6983b23c63cc236ca5861ee6b43e5c2651aea764139b3b775436fe`, reproduced the same four S7 fixture result-wait failures and EBUSY cleanup, plus one unclassified unexpected worker exit (3750 passed,4 failed,2 skipped,59 unfinished). The coordinator timeout did not recur. The old/new worker exits still have no proved native or gaming cause.

Concrete defect in `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`: `step` sends an asynchronous real MessagePort request and uses polling as completion synchronization; repeated full runs reach its empty-result assertion. On that failure, launch's cleanup closes the two ports and returns immediately, while `startWriterProofController` still awaits in-flight fixture work and owned resource cleanup before its public exit callback. Root removal therefore races still-open `application.db`, producing the observed EBUSY. Node's documented close event is channel disconnection, not completion of the fixture's asynchronous resource shutdown.

The permitted minimal same-boundary fix is test infrastructure only: add `apps/harness/tests/integration/canonical-writer-smoke-test-transport.ts` to own response/terminal promises at the **public Node port and controller-exit callback**, and use it in the existing launch/step helpers. Register the response listener before sending, reject on terminal/error instead of manufacturing a result, preserve the existing result-count/exit/schema assertions, and await the actual controller exit during cleanup before later root-removal callbacks. No test/scenario name, ID, expected value or ordering changes. No pool option, numeric timeout, include/exclude or coverage threshold changes; synchronization uses actual completion under the existing test/hook deadlines rather than extending polling time. This additional helper is organizational scope under the already authorized concrete coverage correction, not a new human filename approval, product behavior or packaged API. Both full failing runs precede the correction; no isolated pass is substituted for a future full coverage run.

### Focused-only continuation after user cancellation — before remaining wait correction

The user explicitly selected focused-first work and prohibited further full coverage/check/deep/package commands in this continuation. The `full-coverage-normal-final-2026-09-11T16-19-55-462Z` invocation was cancelled: its log exists, but no terminal report exists and no completed result is claimed. Parent reports no remaining matching Node processes. Its one observed failing fixture case was `writer_generations / token_digest`; that partial suite observation is not a full-run result.

On the existing transport implementation, exactly five selected cases (retained live Writer; no-replacement; wrong-epoch; release-failure; writer_generations/token_digest corruption) passed initially both without coverage and with focused coverage. Captures: `focused-fixture-races-before-2026-09-11T16-36-51-591Z` (inputs `2e918e0b1af68af8f08d311d1cf05d54f7089e4901a9f8d3647fc3f921418640`) and `focused-fixture-races-coverage-before-2026-09-11T16-37-15-377Z` (inputs `9eb62f50680aeb49e9e6f1b7fe295dbdc59d9c0831813f261c751fa7f03f72ef`). Each executed5 and left144 deliberately unselected; these are not new skips or a full-suite replacement.

The remaining race is an exit assertion still wrapped in polling: the corruption path may already have reached and rejected the actual tampered SELECT, yet its asynchronous owned SQL close has not completed and the controller has not emitted its exit callback. Port disconnection and that callback are distinct. The already-added `transport.terminated` is the correct existing completion seam; cleanup already waits on it.

A controlled **diagnostic-only** setup in Temp delegates the actual fixture and original SQL decorator, delaying completion of its public `client.close()` by1200ms. It changes no repository config, concurrency, test/hook deadline, SQL result, assertion or canned outcome. On exactly the token_digest case, the old polling assertion fails deterministically with `expected [] to deeply equal [1]`: `focused-corrupt-audit-close-red-2026-09-11T16-42-51-608Z`, inputs `75df0a578229b5ee1ba343552400bf9ca7e3018510336454844c24a8ea232291`, report `3662820337168bdac6fe73edf9ce401aad40ea684d6e57d542a45d7037720188`. This reproduces the race before the source correction, not a missing-module/setup error or a claim that the historic run had exactly that latency.

The bounded source correction will replace exit polling only in these affected fixture paths with awaiting the actual controller termination promise, then retain the exact exit-array, reached-SELECT, absent-success-frame and fixed-diagnostic assertions. It will not touch product/runtime code, timeout values, the completed Knip cleanup, jscpd work, or protected user documents. The controlled delay remains solely in captured Temp diagnostic files and is not added to the canonical tests.

### Focused correction completed — stop at targeted proof

Changed only the affected wait sites in `canonical-writer-package-smoke.integration.test.ts`: await `run.transport.terminated`, then perform the unchanged exact exit assertion. The retained-live-Writer success, incoherent-replacement failure, resource-failure and corrupted-row audit paths now wait for the actual controller callback rather than treating the polling window as resource completion. The existing transport still subscribes before send, rejects terminal/channel errors without inventing responses, and cleanup still awaits termination before subsequent root removal. No fixed event-loop turn count or new deadline was introduced. Product/fixture implementation and test expectations, scenario IDs and row-tamper logic remain unchanged.

The controlled token_digest reproducer now passes with the same delayed actual SQL-client close: `focused-corrupt-audit-close-green-2026-09-11T16-46-19-583Z`, inputs SHA `3b489e6520282d64a46781d8becf7fb9f46b8293f65e43eca5f387eccb11671a`, report SHA `f92bc8bd70c911cb707c4df8f28365aee2eb9fd68463d5d24d687b5e4276dcfe` (1 passed,148 unselected). Raw diagnostic close traces show actual close completed1216ms after start in Red and1209ms after start in Green. Their hashes are `785f1e4c2c18333796a7b51767baacb49d50ac00b0fcc713e3706ca4bb7bf333` (`Temp/slopstop-focused-close-mZqu2M/events.jsonl`) and `a0d4dc87f8c9e9bc26ac981c24457c053ba719d0ed6c4b553ad090e6a645b3cf` (`Temp/slopstop-focused-close-VykAlN/events.jsonl`). This is a controlled completion-order proof, not a measured explanation of every old worker crash or an assertion that the historic interrupted case had identical timing.

| Final focused check | Result | Capture suffix under `Temp/slopstop-s7-` | inputs / report SHA-256 |
| --- | --- | --- | --- |
| Exact five cases, no coverage |5 passed,144 deliberately unselected | `focused-fixture-races-final-2026-09-11T16-46-35-197Z` | `fd63f0f5bc06b299a7c39e662febf0606933bbd11e2b29559affdede828def8a` / `0beb581bfd540808efcf47a0179008b360aa8760997018688a6d78c3e86a3f00` |
| Same five cases, focused coverage |5 passed,144 deliberately unselected | `focused-fixture-races-coverage-final-2026-09-11T16-47-11-823Z` | `c0db6a2bc35444afb92be8c835567ade67b7fbf3e622df2e12775cce02c13be5` / `07b14842024b54412ce31dce9eb895d44c1bae088076ca1a7a5db597a92f5885` |
| Harness/test-helper typecheck |exit0 | `focused-fixture-final-types-2026-09-11T16-48-19-082Z` | `20f4d1cd9a494f6678dcae3b13176debe17a8906ee9e82ffaf90673960eced07` |
| Biome, integration test + transport helper |exit0, no findings | `focused-fixture-final-biome-2026-09-11T16-48-40-380Z` | `f20d82fd576264f138de308d0b7a1150d592c4233f4c59304e336213855f6e29` |

The normal focused runs use the existing integration configuration and only the exact selected-name regex. The Temp delayed-close configuration adds a diagnostic dependency decorator only, inheriting the existing test configuration; it changes no concurrency or timeout. No canonical slow-close delay, new skip, ignored error, canned SQL/result or relaxed assertion was added. The token_digest case still proves its real SELECT checkpoint was reached, the column exists, the tampered row is rejected, exact exit `[1]`, zero successful frames and exactly `Writer proof fixture failed.\n`. No EBUSY or unhandled error remained in these focused runs, and cleanup completed through the existing real terminal callback.

CodeScene detailed scores: integration test10.0 (990 lines), existing transport helper10.0 (49 lines), no findings. Harness types and Biome passed after the final edit. No full suite, full coverage, fast/deep gate or package command ran in this focused-only continuation. The100%-selected claim is only5/5 targeted cases, not149/149 or3815/3815; the remaining144 are filter-unselected, not new skips.

Compact report: **`Temp/slopstop-s7-focused-fixture-proof-PIsBW9/report.json`**, SHA-256 **`43e2352b17301aa66ef4734fefb9578821b995ab300b41c40ad15f33b57ead40`**. It indexes all focused Red/Green/final captures and keeps exact current source copies. Final integration-test SHA `61917bde497bf346f5b34ac8ebf60953ba2113d1c5024921745a89ef735ef074`; transport-helper SHA remains `264cbad011f6afbb6679f4e9a248628f999035f87a3a7dda8c851d3994467e20`.

The cancelled full run's output SHA is `e8b76224449f6e019568a0306ee83edf40569c5372ba66c308939aa576feea57`; terminal report remains absent. Its partial149-case suite output and token_digest failure are preserved without manufacturing a completed full result. Prior normal full passes/failures remain bound to their earlier source. Knip cleanup, protected PRODUCT/CONTEXT/README, jscpd work and all old package evidence were not edited by this continuation. No Git writes or host changes occurred. Full combined validation and renewed package proofs remain parent-owned after source cleanup is final; this targeted proof does not mark them complete.

## Duplication cleanup — current baseline and bridge owner map

Fresh31-binding capture `Temp/slopstop-s7-duplicates-baseline-2026-09-11T17-01-34-195Z` (inputs `8899d4e461e749e8147a8f099a7616b013e72c818d1a14cf9cb0fe386db6048a`) ran unchanged `pnpm check:duplicates`: exit1, exactly the21 pairs enumerated above,20 TypeScript plus1 SQL. No source edit preceded this measurement. Preserve the independent SQL bytes and unchanged detector policy.

Before clone1 edits: `project-storage-bridge.ts` and `workspace-bridge.ts` each subscribe to `HarnessSessionClient` and dispatch disconnect/protocol/request failures. Existing `harness-pending-request.ts` already owns shared pending-request creation for exactly these consumers. Extend that same owner with common session/request-failure dispatch. Preserve separate maps, causation IDs and each bridge's pending settlement; preserve the deliberately different system.failure handling (fixed Project Storage diagnostic versus Workspace payload). Forward all other messages to the existing bridge-specific switches. No new module or boundary is required. Both bridge files and the pending owner score10.0/no findings before extraction; CodeScene OAuth verification5/5, no configuration overrides ([configuration reference](https://codescene.io/docs/integrations/mcp.html#configuration)). SonarQube MCP is not exposed in this session; not assessed, no service installation.

Exact affected baseline: `pnpm exec vitest run apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.test.ts`,35/35 passed in2 files; capture `Temp/slopstop-s7-duplicates-bridge-before-2026-09-11T17-03-01-030Z`, inputs `3211a7054e94371e19baa7b0a223c6c94a4d5eb3d84126a4d8b76e8c92a4db19`. This is characterization for pure extraction, not fabricated Red.

Clone6-10 pre-edit map: all consumers are in `apps/harness/src/storage/canonical-command-repository.test.ts`. G8 rejection corruption and G6 idempotency corruption repeat a transaction-result column decorator and the same genuine-failure/snapshot assertion. G7 unchanged-child corruption uses the same transaction-result transformation seam. `verifyBrokenQueries` and row-shape cases repeat transparent transaction forwarding; configuration-failure and row-shape cases repeat activation failure assertions. Keep helpers local to this test file, all matrices/titles/values and timing of injection unchanged. The G8 catch and G6 then rejection paths remain distinct. Baseline CodeScene10.0/no findings; current source-bound unit baseline `duplicates-harness-unit-before-2026-09-11T17-05-39-737Z`, inputs `ef62b8d5c31e89f8fe82a0d8f88c6d0e61acaa06d27486ce8aa466d6de4d38e8`,637/637 in four named files. No production-derived expected data or cross-workspace test exports.

Clone15 pre-edit map: the two named tests in `canonical-project-settlement.integration.test.ts` repeat the exact successful activation/first-command event and applied-row assertions. Extract one local `expectFirstAppliedSettlement` assertion helper, invoked inside each existing try/finally with the original real-port fixture; preserve every literal, event order and later replay check. Baseline105/105, capture `duplicates-settlement-before-2026-09-11T17-12-57-879Z`, inputs `12569d70b059583605271fc2e60ac4df18c2b834a5a1ccc94b18b070594b2854`; CodeScene10.0/no findings.

The six-file integration baseline `duplicates-integration-before-2026-09-11T17-16-27-143Z`, inputs `6ee281dd06e0105825fdb7491025046726aa158a518a5cd58830c816b0c3a987`, failed with one unexpected worker exit:5/6 files passed,833/1035 cases passed,202 without completed results. Preserve this failure; no cause or complete baseline is claimed. Continue exact-name checks without pool/timeout changes.

Clone19 pre-edit map: `process-bootstrap.integration.test.ts` repeats the same trusted-root bootstrap constructor in the unsupported-command and persistent-storage tests. One local helper receives the existing root and public transport, calls the same constructor with identical URLs, and returns its stop function; both try/finally scopes, port ownership and all assertions remain. Baseline exact two names2/2 passed (2 unselected), capture `duplicates-bootstrap-before-2026-09-11T17-21-59-895Z`, inputs `4032020014591706311ed0c448fa4ab2b1e576107e4b8072e4273a2fbd7efc24`; CodeScene10.0/no findings.

Clone16/18 pre-edit map: reconciliation's two restart matrices share the inactive first-command response plus eight untouched-dependency assertions and snapshot identity; recovery's unresolved-authority and existing-marker matrices share release rejection, zero new marker INSERTs since the previously captured call offset, and snapshot identity. Extract one local assertion helper in each respective file, preserve offsets/snapshots captured before injection, fixture construction and finally scopes. Exact names baseline23/23 (585 unselected), capture `duplicates-recovery-focused-before-2026-09-11T17-23-57-483Z`, inputs `2d8644e81cb59c1a381fc7d0f410a61087adbdfbb045c0880e06201d2a454c76`; both files CodeScene10.0/no findings.

Clone11-14 pre-edit map: `canonical-command-repository.integration.test.ts` owns all consumers. Replay and stale/malformed fence cases share four no-work dependency checks; stale/malformed/observation cases share the first-two-SQL fence order check. Retained-close cases share ownership rejection and explicit cleanup assertions. Nil/max handler and full malformed-handler matrices share invalid-decision installation and the known-body-failure/update witness. Extract local assertion helpers only; retain all cases, close scopes, sentinels, frozen receipt checks and snapshot comparisons. Focused baseline100/100 (250 unselected), capture `duplicates-repository-integration-focused-before-2026-09-11T17-26-50-167Z`, inputs `9a5b50f15a665f85d4c3b1a9fd0e31b269651d105edae6b160dcfe319d15711c`; CodeScene10.0/no findings.

Clone3 pre-edit map: `project-storage-create-fixture.ts` expected diagnostics are consumed by `switchCommandFailure`, its source-unavailable diagnostic and coordinator/runtime/switch tests. Production `active-project-coordinator.ts` keeps its own independent diagnostic table. Consolidate only test-side diagnostic-object construction with a local literal-input helper; every status/code/message/retryability remains explicit. Coordinator baseline29/29, capture `duplicates-coordinator-unit-before-2026-09-11T17-32-55-739Z`, inputs `6f82a11b51f7e182a97402b031b98e8366125b60db24acd5d5bca3bc93db1ba0`.

Clone20/21 pre-edit map: protocol switch expected cases and harness application targets intentionally belong to different seams. Keep their data independent. In `canonical-project-protocol.test.ts`, consolidate the genuinely repeated safe-mode outcome construction in activation and switch cases; each caller keeps its exact literal identity and canonical-health inputs. Represent the switch diagnostic cases as a code-keyed table with named status/message/retryable fields, preserving insertion order, case names and all seven variants. No production fixture import/export, no golden derivation. Protocol's existing unit baseline is in the637/637 capture above. Both edited files CodeScene10.0/no findings before these edits.

Clone4/17 pre-edit map: `conformance-counter-command.ts` already owns literal `settledCommand(request, receipt)` envelopes. Route `migratedUnsupported` through that existing helper, retaining its complete independent receipt literal. Its coordinator/runtime/switch/lifecycle consumers compare the returned envelope; `canonical-project-application.test.ts` stays independent. `recoveryStoragePort` in `canonical-writer-recovery-fixture.ts` and extended activation storage in `conformance-counter-command.ts` repeat the same parsed static opened/read-write/healthy identity from `fixedCreationIds`. New test-only `tests/integration/canonical-storage-selection-fixture.ts` will own that concrete input constructor; callers retain their distinct impossible-result messages, path derivation, close callbacks and actual storage/port behavior. Existing2 settlement/23 recovery focused captures plus coordinator/runtime unit captures characterize these compositions; both definition files baseline10.0. No production import of test support.

Clone5 pre-edit map: unit `canonicalRuntimeFixture` and integration `canonicalChannelFixture` repeat the same independent noop request/read-only activation/command result and stub application. New test-only `canonical-runtime-application-fixture.ts` owns those static inputs and the public application stub constructor. Callers provide their existing stop/switch behavior and optional before-activate/execute failure hooks. Unit retains mock observation; integration retains real MessageChannel transport and exact private exception strings. Baseline integration1/1 (7 unselected), capture `duplicates-runtime-integration-before-2026-09-11T17-37-42-599Z`, inputs `01aa77216f4be74535c3db6aa93507849a169af69be64cb6f0cb9e0ee7f79664`; unit source baseline already passed, both files CodeScene10.0.

Post-extraction CodeScene review requires two further local refinements: runtime unit fixture remains1002 non-comment lines (9.38); repository unit configuration-failure callback reports complexity13 (9.63). Do not waive these findings. Runtime unit `unusedCanonicalApplication` and integration `startRuntimeFixture` contain identical unused canonical application implementations with the same exception literals; consolidate that concrete common stub into the already introduced application-fixture owner, preserving switch callback and all ports. Repository unit configuration cases will extract their existing execute decorator into one local constructor that reads the live injection flag both before and after the awaited real execution. Preserve exact SQL comparisons, begin count, mutations and exception strings. No test case removal or analyzer configuration change.

## Duplication cleanup — terminal focused proof, 2026-09-11

### Result and sole remaining duplication-policy blocker

All20 TypeScript clone pairs from the original inventory are eliminated. Final unchanged `pnpm check:duplicates` finds **1 clone**, the original pair2 only: `apps/harness/drizzle/canonical/0001_canonical_project_writer.sql:1-534` versus `apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql:1-534`. Detector totals:190 files,66803 lines,414355 tokens;533 duplicated lines (0.80%),5067 duplicated tokens (1.22%);163 TypeScript files with0 clones. Exit1 remains correct under threshold0/minLines10/minTokens60. This is not a green duplicate gate.

Final capture: `Temp/slopstop-s7-duplicates-terminal-scan-2026-09-11T17-55-06-169Z`; inputs SHA `4e8d495ad33d5ef31e512b7d9a97a4e3b3c88f055b08142237fd88c366e55409`. Every command used the existing runner's31-binding verification and fresh pre-command full source/test/config copies; raw `output.log`, `inputs.json`, `report.json`, `git-status.txt` and `working-tree.diff` are retained. In command mode the report records exit/success only; test counts below come from the raw Vitest output, not invented JSON assertion records. The repeated report hash `93401a58d380ce4b4f3d019120594b65f91edd076db9c13332c0fcd35c49c99d` identifies that small exit0 report, not a shared source or test-run identity. Use the unique inputs and raw output of each capture.

Preserving both independent SQL files and an unchanged zero-duplication policy leaves this pair irreducible in the approved scope. Neither file was changed, encoded, compressed, relocated, excluded or made production-derived. Their pre-existing raw hashes differ: the fixture is exactly the migration plus one trailing LF. Each remains byte-identical **to its own baseline**, rather than falsely claiming the two raw files are identical to one another.

| Protected path | Unchanged raw SHA-256 |
| --- | --- |
| `apps/harness/drizzle/canonical/0001_canonical_project_writer.sql` | `d1abcf781ec35e969baaf50aac2695d22c8b8c7f01bffc03fa5fbf54ad06edfc` |
| `apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql` | `56bc8d7b40285618d64dbae88dbe7cf94f38f4f83e905f8add62f4d74b4b5ca2` |
| `PRODUCT.md` | `d6184abfa7679fd56243e4ca8e3d313a207fd51be759f20462277e73fb32267c` |
| `CONTEXT.md` | `c7e57244535a9c39a7e6cf976a1e86b7c5122c087e792dbb13fd6e1c8999c72a` |
| `README.md` | `70a11f176e020686e4e9bb29609d4b602394b9c14c3792536657164b83fe0074` |
| `jscpd.json` | `370a361cce97eb56dc23c0fe6203504ea3df2cd487f5c26e29dd4c9e575ade9f` |
| `knip.jsonc` | `7c7eb9db130e282a48e743a86f69316c4bee911e1942751cca6c8a32ee0c6973` |
| `pnpm-lock.yaml` | `20969c9456b491005b8d076328a838e8ee4c7fdea133a41ad8a19d05fccf8e5d` |

### Final checks and exact selection

All capture suffixes below are under `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-`. Commands and source manifests are stored verbatim in each `inputs.json`.

| Check | Actual result | Capture suffix | Inputs SHA-256 |
| --- | --- | --- | --- |
| Six affected unit files: both desktop bridges, coordinator, runtime, repository, protocol |521/521 passed;6 files | `duplicates-final-refined-unit-2026-09-11T17-49-16-071Z` | `9900b6fa176ea91c35ef3512264d728606ea3b7ef78bfb117a63937fb34eb7b4` |
| Selected repository integration cases plus six runtime round-trip cases |106 passed;252 filter-unselected;2 files | `duplicates-final-repository-runtime-2026-09-11T17-50-27-340Z` | `b1524bb2e4dcf9f1d7d7e6593eb4b024fb32addc6a7ec7b2ba10c840a6bacf14` |
| Two settlement,23 recovery/reconciliation, two bootstrap and one canonical runtime case |28 passed;697 filter-unselected;5 files | `duplicates-final-integration-2026-09-11T17-43-45-083Z` | `64e480348a1f13f5e0328d46df454699262aed0a8506d71026b8e959fcd72664` |
| Harness typecheck after final quality refinement |exit0 | `duplicates-final-refined-types-2026-09-11T17-48-42-971Z` | `e1db91c3705c92a61f90a1c4e2e89d4e6d0b97c341690908d26d7acd4c411b20` |
| Desktop typecheck |exit0 | `duplicates-final-desktop-types-2026-09-11T17-44-30-684Z` | `8fc4e6e79388303f491ea5818cbdc872970eb1c8fbf7db6d608492e8f76f2a77` |
| Protocol typecheck |exit0 | `duplicates-final-protocol-types-2026-09-11T17-44-45-368Z` | `6527050b65c20ab5fc47cb8939cff550a076b1b2c1a6f3ba3282c747acca6496` |
| Biome check of all17 changed/new TypeScript files |exit0;17 checked, no fixes/findings | `duplicates-final-biome-2026-09-11T17-52-11-619Z` | `116278b3bc7842c55d1e60b82f5b7fc358617b62f9d5fc3f9523575e5ac16044` |
| `pnpm check:dead-code` |exit0; Knip clean | `duplicates-final-dead-code-2026-09-11T17-48-42-792Z` | `908f2b0aa01c8f49b84296cabb34e58e2e54700eb421fdc6612e2edf59e473d3` |
| `pnpm check:boundaries` |exit0;235 modules,729 dependencies, no violations | `duplicates-final-boundaries-2026-09-11T17-48-42-866Z` | `49173dac90a2c689faa52931ca50e91ab387d23adc62dec4fddf160f98e073bf` |

The28-case group and106-case group overlap in one canonical runtime test; do not sum them as134 unique cases. The other27 cases in the earlier group retain unchanged test/helper dependencies through the final runtime-only/repository-unit quality refinement. Final tested unique scope is521 unit cases plus133 selected integration cases. Filter-unselected cases are not newly skipped tests. The current runtime unused-stub refinement is exercised by the six later round-trip cases. Repository's100-case final selection also renews proof after shared fixture/source and formatter changes.

CodeScene detailed terminal review: **all17 changed/new TypeScript files score10.0, with no findings**, including both new helpers. The two intermediate findings above were corrected with concrete shared-stub and decorator extraction. Required whole-working-tree safeguard passed:43 checked/eligible files,48 total modified files, only existing S7 `main.ts` reported improved; no degraded result. SonarQube MCP remains unavailable/not assessed, not passed. No service/configuration installation or analyzer exclusion was introduced. Automatic write hooks reported Node unavailable and were skipped; explicit type/lint/CodeScene checks above actually executed.

The retained six-file baseline failure remains833 passed/202 incomplete/one unexpected worker exit; focused passes do not diagnose that worker exit or substitute for combined validation. No full check, full coverage, deep, packaging, Linux, native/dependency upgrade or Git write occurred in this cleanup. Parent still owns the single final deep run after prerequisites are resolved and any explicit SQL-policy decision.

### Exact cleanup delta and continuation

Relative to the fresh17:01 baseline this author changed15 existing TypeScript files, added2 test helpers, and appended only this evidence file. Existing S7/Knip/transport work was preserved. Complete current working-tree paths including pre-existing work are captured in the terminal `git-status.txt`; `working-tree.diff` retains the entire tracked HEAD delta. The cleanup-specific paths are:

- `apps/desktop/src/main/harness-pending-request.ts`
- `apps/desktop/src/main/project-storage-bridge.ts`
- `apps/desktop/src/main/workspace-bridge.ts`
- `apps/harness/src/harness-runtime.test.ts`
- `apps/harness/src/storage/canonical-command-repository.test.ts`
- `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`
- `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`
- `apps/harness/tests/integration/canonical-writer-reconciliation.integration.test.ts`
- `apps/harness/tests/integration/canonical-writer-recovery-fixture.ts`
- `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`
- `apps/harness/tests/integration/conformance-counter-command.ts`
- `apps/harness/tests/integration/harness-runtime.integration.test.ts`
- `apps/harness/tests/integration/process-bootstrap.integration.test.ts`
- `apps/harness/tests/integration/project-storage-create-fixture.ts`
- `packages/protocol/src/canonical-project-protocol.test.ts`
- NEW `apps/harness/tests/integration/canonical-runtime-application-fixture.ts`, SHA `4efd9cd8913a6f41520c8df543311725e9baaee1380a7380599b3a4d97b87d54`
- NEW `apps/harness/tests/integration/canonical-storage-selection-fixture.ts`, SHA `798fb0bedff792b030eb0788ad4fd6b258ca26a4badf14a2cfa891afef23f676`

A syntax-tree comparison of all literal test/suite registrations in the nine edited test files found identical ordered titles against the baseline (24,13,66,20,22,16,8,4,38 registrations respectively); original table variants, literal expected data, reference checks and temporal assertions remain. This title check does not claim to replace behavioral tests or independent review.

Production changes are confined to the desktop bridge/pending owner. Their new bytes invalidate old packaged desktop/main evidence as proof of the current candidate; renewed Windows/Linux/package evidence remains parent-owned. Harness production, protocol production, canonical migration and frozen SQL fixture are unchanged by this cleanup. Test-only fixture/refactor changes invalidate source-bound test evidence for their affected consumers as detailed above; they do not justify claiming a new packaged harness pass. The private S7 smoke fixture and its prior transport correction were preserved. No automatic acceptance or integration is claimed; S7 remains pending independent review, policy resolution and final combined validation. PRODUCT/CONTEXT/README remain outside any S7 commit, and technical rename remains deferred.

## Golden SQL guard — authority and pre-edit preservation, 2026-09-11

Human choice `Validar referência por hash (Recomendado)` authorizes one exact reference-fixture exclusion plus immutable raw checks for both independent files. Parent's continuation resolves its inaccurate byte-identical shorthand: source32611 bytes and fixture32612 bytes differ only by the fixture's additional final LF. This is a factual correction and implementation clarification, not a new human approval. Both current forms exactly match their respective blobs at S2 `37e3f83a9b0ce1868d8b896b9f9b0a9cdfe3f2e2`. Migration SHA `d1abcf781ec35e969baaf50aac2695d22c8b8c7f01bffc03fa5fbf54ad06edfc`; fixture SHA `56bc8d7b40285618d64dbae88dbe7cf94f38f4f83e905f8add62f4d74b4b5ca2`. Both are independent regular files, no symlinks, nlink1, distinct inode identities. Preserve every byte and both fixed literal hashes.

Before any edit, old31 capture `Temp/slopstop-s7-capture-2026-09-11T18-08-42-887Z/` retained372 raw inputs, including all31 binding files, pre-existing source changes, configs, old runner and prior packet. Inputs SHA `e77712d2f78969574695e1b88580573b44e105c9b511b86a320b3acb0769d2fd`; verified contract `cb41ffc2228d6892b2ba7e27d3886fa9b4fd07c41c51108f5f0a34f3b69d2f2f`. All three protected document hashes match the parent packet exactly. Old clone#2 failures/reports above remain retained; twenty TypeScript clones were already removed by the predecessor cleanup, not by this guard.

Before code/test editing, the owning design gains only `## Follow-up: 2026-09-11T19:10:00+0100` before TDD Evidence. Named new owners: `apps/harness/scripts/check-golden-sql.mjs` and `apps/harness/scripts/check-golden-sql.test.mjs`; narrow config edits: root `check:duplicates` and single exact fixture ignore. These filenames are author-selected implementation details under the approved semantics, not user-authored filenames. Normative guard policy is this follow-up; package/jscpd are raw operational inputs with their referenced fields pinned in that policy. Original31 bound content stays unchanged; append32 uses the existing hash recipe. Independent intent/candidate reviews are pending with parent. No full/deep/coverage/package execution is authorized for this task.

### Golden guard contract identity and executed chronology

New32 contract identity: `351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d`. New intent packet `Temp/slopstop-s7-golden-guard-intent-packet-20260911.json` raw SHA `75c54048fbb61ffd0cc0f37d5cd8135420c11ada83ebfc73dc1227874687d7b7`. Design body content stamp `a959f34fcf68b7e832c9bb9b41f611e0ef45a105c6d084ced8119cfb33481c6d`; raw design `215fa85e0e79c9b160d1faa0273b347a08a8f912e2b075c503dfcbda61aa3a41`. All31 previous bound contents match, with only the last exclusive end changed; binding32 SHA `128680a0983755bb99c9be16d9e58fe668eda5fa7fe52ac545ddb1835dca3119`. Removing the appended follow-up from the current body reproduces the entire initial body exactly; no S1-S7/history edits. The old packet remains unchanged. Packet transcription was corrected before identity verification or use; no test or review used an incorrect packet.

After computation and stamping, the existing capture helper was redirected to the new packet with fixed packet and contract checks intact. It also captures the unchanged parent packet; final runner SHA `a7235e292d238ba9844af23ade7ad284b7a00c3bb32d20c1bb61099159b4b645`. Protected-document and all32 binding checks remain active before/after execution. The read-only document validator passed before creating code/tests, with fresh raw inputs. The helper retains inherited focused selection/maxWorkers1/no-file-parallelism settings; no pool, timeout or threshold change was made. Existing wrapper Node DEP0190 shell-argument deprecation notices are retained, not suppressed or declared resolved. Automatic write hooks reported Node unavailable; explicit document/Biome/type/test gates ran instead and are the actual proof.

Each row below is a distinct actual run under `C:/Users/pedro/AppData/Local/Temp/opencode/`, prefix `slopstop-s7-`, with full pre-run `inputs.json`, raw `files/` copies, `output.log` and `report.json`. Manifests contain exact commands and cwd. Focused runs use the installed pnpm runtime and select only the new test file through the existing Vitest include. Every completed run verified the new32 contract and input identities; 376 files were captured once the two new owners existed. No failed report is overwritten.

| Capture stem after prefix | Actual result | Pre-run inputs SHA-256 |
| --- | --- | --- |
| golden-intent-validate-2026-09-11T18-14-59-066Z | document validator exit0 | `3c32240567cca4cea5caba850cb9a0fbffe9eda090eccba1e5d908dcf5deeea3` |
| golden-hash-red-2026-09-11T18-16-30-217Z | 1 passed /6 failed /0 pending, exit1 | `b8d8c4bbb054729c488c78e090bf546287379445cdea0e402076d0f8f92d69a0` |
| golden-hash-green-2026-09-11T18-17-27-854Z | 7 passed /0 failed /0 pending, exit0 | `badba4f309887902b9d1df62021617a80f722785dae87a41443078c96853fdc1` |
| golden-files-red-2026-09-11T18-18-42-578Z | 7 passed /13 failed /0 pending, exit1 | `c6168c4814b63f23cec3faecbc3bb420dfc46e84bdce8f12022633cb536634d8` |
| golden-files-green-2026-09-11T18-19-26-090Z | 20 passed /0 failed /0 pending, exit0 | `4fdc6e49915714d667cf9971777891436ba59d8daedb039ca90d736acfe5a239` |
| golden-order-red-2026-09-11T18-20-29-056Z | 20 passed /4 failed /0 pending, exit1 | `dc1aaf3b988c04e997f2d0dd85e44fa348e26b33a0597ddcc8bdeaf974d6fe32` |
| golden-order-green-2026-09-11T18-20-52-823Z | 24 passed /0 failed /0 pending, exit0 | `958a74896aa8a1274dfb039860b5503c0213bdcf00c4d6e2dc0873694272367e` |
| golden-biome-2026-09-11T18-21-06-992Z | exit1, two formatting errors; no lint findings | `6c966ceb662bcb78a0c486bf8ff355b9df5c475fab5d80cc441eeba0c4bfc4f0` |
| golden-duplicates-2026-09-11T18-22-23-620Z | actual pnpm check:duplicates exit0, golden verified then0 clones/191 scanned files | `5f1b1d0cbae4bbe0c5b7c0d6e2a6eea2a6358fc2a23ce8c200f6988c09a41deb` |
| golden-final-focused-2026-09-11T18-22-39-118Z | post-format24 passed /0 failed /0 pending, exit0 | `87ad5fd6ee8c9f52902754727c6d1e177ef2b40d9409bec12f6f4a6b29adebca` |
| golden-dead-code-2026-09-11T18-22-49-383Z | pnpm check:dead-code exit0, Knip clean | `347e9a46e8ae7a675e3a090e7d931fba93d64b36e0daa94e3e0630b98584d948` |
| golden-types-2026-09-11T18-22-58-407Z | harness typecheck exit0 | `f3e44c8ac2a4f16157da41214e61f1c2bed3fc151fe304e2d00d30625a83b0c3` |
| golden-final-biome-2026-09-11T18-23-11-743Z | four changed code/config files checked, exit0, no fixes/findings | `14ef2c32cfaa48716a5cec5cc1dfd6eb858f25d6457383c478f341a4335bb31a` |

S7.GG1 Red loaded a callable no-validation scaffold, accepting bad inputs; the success case passed and six genuine raw-mutation cases failed. Its minimal Green introduced only the two fixed hash comparisons. GG2 Red reached real missing/directory failures without classification and accepted linked/aliased or injected-failure cases; Green added regular-file, link-count, identity/realpath and distinct IO diagnostics through a narrow filesystem port. GG3 Red ran the old real root command against an isolated scanner witness: it scanned despite invalid golden bytes and omitted the guard success output. Green changed only the root command and exact reference ignore. No setup/import error is counted as behavioral Red. Test bytes within each Red/Green pair are retained in the corresponding raw copies.

The24 unique final cases cover unchanged separate raw copies; each file changed alone; both changed identically; swap; each terminal-newline mutation; each missing/directory/hardlink; each symbolic link with active EPERM metadata fallback rather than skipped tests; each parent-directory alias; each file's metadata/realpath/read fault through the public port; equal inode/device identities even with nlink1; exact config; fail-before-scan; scanner exit0 and23 propagation. Existing migration/schema/table/SQL tests are untouched. Real byte mutations and physical links use disposable copies; synthetic fault tests do not replace raw-byte proof. CLI negatives assert exit1 and empty success output; narrow-port IO faults assert distinct structured failures. The scanner witness is only ordering/exit proof; the separately recorded actual jscpd command proves the real scan. TypeScript's existing harness check does not claim to typecheck MJS; the new MJS files were parsed/executed by Vitest and real Node CLI and checked by Biome.

Final focused report SHA `3596b27fd11000158331287ad446d7cd4dbc6b50e1959d3ba9b424e8d03fa3e3`, output SHA `dffbfd786fe7cddbb26fbcdc49d66b6707619783921cb9ad4040f1cfb122b8b4`. Actual jscpd output SHA `d7778a205943761b63d729394f6b550259b5361cd76d07b1d88d4229215cfac7`. Repeated small command-report SHA `93401a58d380ce4b4f3d019120594b65f91edd076db9c13332c0fcd35c49c99d` means identical exit0/success envelopes, not identical command logs or source identity; use each unique inputs/log above.

### Golden guard automated review, final bytes and handoff

CodeScene OAuth configuration had no token/on-prem/account override; installation checks passed5/5. Both the executable scaffold and seven-case baseline test scored10.0/no findings before hash behavior was enabled. Both completed files scored10.0/no findings before formatting, and again after formatting. Post-Green work corrected only the two Biome formatting findings; no analyzer exclusion or new smell was accepted. Final pre-analyzer capture `Temp/slopstop-s7-capture-2026-09-11T18-23-52-027Z/`, inputs SHA `3441da4a88c4dfbac501e2914033c9ca8855d04eb1ad86670059c1ca3d9ef449`. Whole-working-tree CodeScene safeguard PASSED,45 checked/eligible of52 modified; only inherited `apps/desktop/src/main/main.ts` is reported improved, none degraded. Exact observed results and baseline/final input references: `Temp/slopstop-s7-golden-guard-quality-20260911.json`, raw SHA `302902ebc71df656b334d71b543bfc57fef4e5fc48f17ee040d63ccde8b69222`. SonarQube MCP is unavailable in this session and not assessed; no service was installed. CodeScene version-update notices do not represent a performed upgrade. These automated checks are not the parent's independent intent/code/coverage/slice reviews.

| Final implementation/operational path | Raw SHA-256 |
| --- | --- |
| apps/harness/scripts/check-golden-sql.mjs | `539740a1f17a9b2d5151252baec00ba4c6a2ea17cac53462b807eec7992446a5` |
| apps/harness/scripts/check-golden-sql.test.mjs | `2a94ad5f4be1df58c04a124b232dbf3b4309d93bf5ceabfe950a07cbe71e08f3` |
| package.json | `f1f104a03ccc73e361ac292b51263f7e1d231df1879b910a445231b833362d39` |
| jscpd.json | `59fc064980233cc6d4a551760a8e90e01d9265a16bfce7ceb0d6eb1c1ae16467` |

Final comparison against the initial18:08 capture identifies exactly four changed starting files: design metadata/append, this append-only evidence, package.json and jscpd.json; exactly the two named script/test files are new. All other starting source/test/config/lockfile bytes and the entire earlier evidence prefix remain unchanged. Both raw SQL hashes still match their respective S2 blobs and the new fixed pins. PRODUCT `d6184abfa7679fd56243e4ca8e3d313a207fd51be759f20462277e73fb32267c`, CONTEXT `c7e57244535a9c39a7e6cf976a1e86b7c5122c087e792dbb13fd6e1c8999c72a`, README `70a11f176e020686e4e9bb29609d4b602394b9c14c3792536657164b83fe0074` remain exact and outside the S7 commit overlay. All previous failures, proof limitations and pending whole-S7 reviews remain historical facts. No Git write, full coverage/deep/package or native/security/dependency change occurred.

Bounded guard prerequisites are green and ready for parent independent review and the later full-deep prerequisite checkpoint. This is not full-deep success, renewed package proof, human candidate acceptance or integration authorization. The new intent packet keeps its creation-time implementation status; actual24-test execution and final bytes are recorded here separately rather than fabricated as prior review.

## Final-validation attempt — 2026-09-11T18:47Z — Windows isolation blocked

Scope: verification only, fresh standard Windows package first, then one normal `pnpm check:deep` only after prerequisites clear. The package prerequisite failed, so **zero deep commands were launched**. This records a failed prerequisite, not final acceptance. Parent owns final candidate freeze, independent candidate reviews, Linux renewal, and S7 commit confirmation.

### Current input and preservation

- HEAD verified as `77f7667ea89b521472660d3e1bea7e85fbf5168b`.
- Contract: `351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d`, all32 bindings verified. The existing Temp proof tool already used the requested golden32 packet/recipe; no binding check was removed or bypassed.
- Packet raw SHA-256: `75c54048fbb61ffd0cc0f37d5cd8135420c11ada83ebfc73dc1227874687d7b7`.
- Initial capture: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-capture-2026-09-11T18-40-18-099Z`; `inputs.json` SHA-256 `43da27f89004422394a72099d539ece8d7ebdab3245e83ce93b2d550319c8909`. Includes376 captured entries, of which331 are complete current nonignored repository files; additional entries bind external normative documents, tool, native baseline and built executables. Includes new golden checker/test and `canonical-writer-smoke-test-transport.ts`.
- Ordered repository file manifest identity: SHA256 of UTF8 `JSON.stringify(inputs.files.filter(file => !file.path.startsWith('evidence/')))` = `1662bce920f013108a4282ba89dcdb73eaa6c0d632acf9f159bdcca5241228af`. All331 repository file hashes remained identical through package and diagnostic execution, before this evidence-only append.
- Prior package, `.vite` and existing root coverage outputs copied under `slopstop-s7-finalvalidation-package-2026-09-11T18-44-06-593Z/prior/` before rebuilding. Earlier reports and unconfirmed roots retained.
- PRODUCT, CONTEXT and README raw hashes verified before/after against the packet: respectively `d6184abfa7679fd56243e4ca8e3d313a207fd51be759f20462277e73fb32267c`, `c7e57244535a9c39a7e6cf976a1e86b7c5122c087e792dbb13fd6e1c8999c72a`, `70a11f176e020686e4e9bb29609d4b602394b9c14c3792536657164b83fe0074`.
- SQL32611 raw SHA-256 `d1abcf781ec35e969baaf50aac2695d22c8b8c7f01bffc03fa5fbf54ad06edfc`; SQL32612 raw SHA-256 `56bc8d7b40285618d64dbae88dbe7cf94f38f4f83e905f8add62f4d74b4b5ca2`. Both current bytes also independently matched `git show 37e3f83a9b0ce1868d8b896b9f9b0a9cdfe3f2e2:<path>`; no literal or terminal-newline change.

### Standard Windows execution and first failure

Actual command: `pnpm package:smoke`, using repository defaults, no observer or injected `NODE_OPTIONS`. Proof wrapper PID24612, with child PID/tree observations and live output retained by a separate command supervisor. Total elapsed61.552s including terminal inventory/hashes. Progress sampling is10s; these are observation windows, not falsely precise stage durations.

| Stage | Observed result |
| --- | --- |
| System/package manager checks | Passed; pnpm11.5.1 |
| Production main/preload/harness/fixture/renderer build | Passed; completion observed by +51.031s |
| Windows x64 packaging/native preparation/postPackage | Passed; completion observed by +60.691s |
| Package isolation, before resource preflight | **Failed**; standard command exit1 |
| Authorization matrix | Not reached |
| Bootstrap | Not reached |
| Writer proof / strict CRLF / nonce-PID-image witness | Not reached; no runtime witness claimed |
| Missing-runtime | Not reached |
| Witnessed-staging / application DB audit | Not reached |

Standard proof capture: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-finalvalidation-package-2026-09-11T18-44-08-687Z`; `inputs.json` SHA-256 `49391d1cbb553df6a68e169329929bf9f9f8ff2e3434d3207dbc255cd5b050c2`; `report.json` SHA-256 `2a7cfd9c3597e31fd43523981562a341fb09d9cb42e4d594b21041301c18989e`. The raw standard message is `Packaged SlopStop smoke failed.`.

Supervisor artifacts: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-finalvalidation-package-2026-09-11T18-44-06-593Z/{execution.json,process-tree.jsonl,processes-before.json,processes-after.json,progress.jsonl,terminal.json,package-files.json,pins-before.json,pins-after.json}`. Package manifest SHA-256 `47b08cecab81f7414ea6256fa93720c0e10589a84a4b6cc2e989ee6e0a3eecda`.

Fresh packaged image hashes:

| Artifact | Raw SHA-256 |
| --- | --- |
| `apps/desktop/out/SlopStop-win32-x64/SlopStop.exe` | `a8f20f926936e8a7800a610480150ef12525c24a606e8d464da3bb78cc858660` |
| `resources/app.asar` | `e982d6617a116a70069ba7e7ec6c8492e6229e536fe417416f1310a066308e55` |
| Win32 x64 `fs-native-extensions.node` | `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4` |
| Packaged canonical SQL | `d1abcf781ec35e969baaf50aac2695d22c8b8c7f01bffc03fa5fbf54ad06edfc` |

These are built artifact hashes, not hashes of a successfully observed running application. The fresh package remains at its normal output location.

### Bounded diagnostic

One diagnostic-only `CI=true pnpm package:launch-smoke` used the launcher's existing diagnostic switch, without changing repository configuration or limits. It failed immediately with `Packaged SlopStop smoke failed at package isolation.`. Capture: `slopstop-s7-finalvalidation-package-diagnostic-2026-09-11T18-45-32-798Z`; inputs SHA-256 `55e8f7ea55093e2d55bd19637e81e9aa005367c44c1f05c1c0f57e1dbdd68868`. This is separate diagnostic evidence, not a standard-run pass.

One smaller reproduction then invoked only the directory isolation operation, with no application launch: `node C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-isolation-diagnostic.mjs`. Actual error: `EPERM`, errno `-4048`, syscall `rename`, moving `apps/desktop/out/SlopStop-win32-x64` to `C:/Users/pedro/Documents/GitHub/slopstop-packaged-app-TmWH0d/SlopStop-win32-x64`. Exact result: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-finalvalidation-isolation-diagnostic-20260911.json`. The failing production operation is `apps/desktop/tests/e2e/package-smoke.mjs:238`, after isolation-root creation at234. Original standard/diagnostic isolation roots `slopstop-packaged-app-zdYcLK` and `slopstop-packaged-app-DD7wr6` are empty and retained, as is the smaller reproduction root.

Recommendation for parent: diagnose Windows directory-rename permissions/open handles for this exact freshly built output and destination. No particular locking process, ACL fault or security product has been established. Resolve that focused prerequisite before renewing standard Windows proof and authorizing the single deep run; do not bypass package isolation or infer that the existing symlink exceptions cover this error.

### Deep-stage status and closing qualifications

| Required deep stage | Status in this attempt |
| --- | --- |
| Format, lint, typecheck, unit tests, dependency boundaries (`check`) | Not run — package prerequisite blocked |
| Full coverage and thresholds | Not run — package prerequisite blocked |
| Integration | Not run — package prerequisite blocked |
| Knip | Not run; earlier evidence retained |
| Mandatory golden guard and jscpd | Not run; earlier24 guard cases and zero-clone evidence retained |
| LikeC4 model | Not run — package prerequisite blocked |
| Real Electron E2E | Not run — package prerequisite blocked |
| Final package launch | Not run as part of deep |

No standalone root coverage or mutation run, concurrency/worker/pool/heap/timeout changes, app-source cleanup, Git stage/commit/push, Linux execution or host installation occurred. No new skips: neither of the two previously qualified Windows EPERM symlink cases was reached here. Prior Linux results remain historical, and fresh Linux package/source binding still needs parent renewal after final source freeze.

Initial live inventory found no canceled-coverage task runner. Standard execution's tracked process descendants had **zero leftovers** at terminal; a final process scan after both diagnostics also found no matching Vitest, proof-runner or package-launch Node/Electron/SlopStop process. Unrelated user processes were untouched.

No fresh CodeScene global gate was run after the prerequisite failed; earlier quality reports are retained, not reclassified as a current global pass. SonarQube unavailable in this tool scope. Final technical status: **Windows package constructed; runtime proof failed at isolation; deep blocked/not started; no formal candidate acceptance or integration authorization recorded**.

### Single authorized same-package launch retry — 2026-09-11T18:52Z

The parent explicitly authorized exactly one normal `pnpm package:launch-smoke` retry against the already built package, then deep only if that retry passed. Before execution, all prior repository source/test/config/lockfile pins were unchanged (only the preceding authorized evidence append differed), no existing task-owned runner was found, and package hashes matched the original fresh build:

- `resources/app.asar`: `e982d6617a116a70069ba7e7ec6c8492e6229e536fe417416f1310a066308e55`.
- `SlopStop.exe`: `a8f20f926936e8a7800a610480150ef12525c24a606e8d464da3bb78cc858660`.

Actual retry: **exit1**, elapsed **2.785s** including terminal inventory and hash collection. No rebuild, observer, CI switch, sleep, retry loop or changed isolation behavior. Raw terminal output: `Packaged SlopStop smoke failed.`. Wrapper PID1504. Supervisor directory: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-finalvalidation-launch-2026-09-11T18-51-28-672Z`. Fresh376-entry input capture: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-finalvalidation-launch-2026-09-11T18-51-29-390Z`; `inputs.json` SHA-256 `90558c3269e1ced637fc50bb59a1dab1ce93f6632c171f6fe2974f4566cccc17`. All32 contract bindings and source pins passed the wrapper's pre/post checks. Report SHA-256 `2a7cfd9c3597e31fd43523981562a341fb09d9cb42e4d594b21041301c18989e`. Package manifest SHA-256 remained `47b08cecab81f7414ea6256fa93720c0e10589a84a4b6cc2e989ee6e0a3eecda`.

The new `C:/Users/pedro/Documents/GitHub/slopstop-packaged-app-yxetQr` isolation root was created at18:51:30.901Z and remains empty, while the package remains at its original output path. This is consistent with failure at the previously diagnosed directory rename before any application launch. The normal retry deliberately retains generic error reporting, so **its raw error code was not separately exposed**; the exact EPERM/-4048 diagnostic above belongs to the preceding isolated reproduction and is not fabricated as a new trace. No bootstrap, Writer proof, missing-runtime, witnessed-staging or runtime nonce/PID/hash witness completed.

The requested read-only process executable/module inspection was restricted in its returned matches to the exact `apps/desktop/out/SlopStop-win32-x64/` package path. It found **zero matching executable or loaded-module paths/PIDs**. No enumeration exceptions were counted; this is not a complete Windows open-handle inventory and does not establish absence of other file handles. Recorded metadata: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-package-lock-metadata-2026-09-11T18-52-15-715Z.json`. Both package hashes were verified again by that inspection. The locking/permission cause remains **unresolved**, with no process blamed or terminated. All old and new unconfirmed isolation roots remain untouched.

Final retry status: **package launch failed; prerequisite unresolved; total deep invocations remains0**. Every deep stage (check, full coverage, integration, Knip, golden+jscpd, model, E2E, package launch) remains not started, with no coverage duration or exit code to claim. The earlier successful build and failed `pnpm package:smoke` retain their actual distinct outcomes. No new skips or app-source changes. Parent should inspect open directory/file handles and permissions for the exact source package directory before another explicitly authorized attempt; no source bug or confirmed transient cause has been established.

## Fresh source materialization — terminal validation 2026-09-12T18:12Z

**Windows standard package proof passed in the authorized fresh source materialization. The single normal deep invocation failed in integration: one early-parent-close case observed no exit instead of exit1.** This is a failed final-validation checkpoint, with no source fix, acceptance or commit. Original canonical-package EPERM attempts and their unknown cause remain unchanged historical facts.

### Materialization identity and actual execution location

The parent explicitly authorized source-only copying and fresh frozen installation/build under Temp. This is neither a branch/worktree nor a package-copy fallback. The launcher itself remained byte-identical and moved its newly built package outside the copied source root on the same Windows volume.

- Canonical source: `C:/Users/pedro/Documents/GitHub/slopstop`.
- **Actual tested cwd**: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-validation-2026-09-11T19-06-31-473Z`.
- Evidence directory (abbreviated `E` below): `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-validation-evidence-2026-09-11T19-06-31-473Z`.
- Complete331-file tracked/nonignored-untracked source/test/config/scripts/lock/guidance copy; no `.git`, `node_modules`, `.vite`, package output or coverage cache was copied from canonical. The evidence directory is outside tested source. Raw canonical-before and copied-after manifests are identical: each file SHA-256 `793dbc7f7b2339b9f59f88788d43c2b8aaf75e3559af303811927c55f5681ea3`.
- Ordered semantic manifest identity, SHA256 UTF8 `JSON.stringify([{path,bytes,sha256},...])`: `02a6c2f798b962d4717ef2f7a55818948152543bff8bfa1bb1a8deb073895afd`. This recipe differs from the preceding file-only manifest and includes the preceding evidence append; it is not a claimed change to application sources.
- Canonical HEAD `77f7667ea89b521472660d3e1bea7e85fbf5168b`; contract32 `351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d`; packet SHA-256 `75c54048fbb61ffd0cc0f37d5cd8135420c11ada83ebfc73dc1227874687d7b7`. Canonical bindings were verified before each command and at terminal; relative runtime input bytes were independently checked against the complete copied manifest.
- `pnpm install --frozen-lockfile --prefer-offline` ran only in the copied cwd and passed on2026-09-11 in41.554s:918 packages added,884 reused,0 downloaded, pnpm11.5.1. Lockfile remained unchanged. The normal Husky prepare reported `.git can't be found` and returned successfully; no fake Git metadata/pointer was created.
- Resume inventory on2026-09-12 found install terminal exit0, no package/deep start records and no owned runners. It continued to package once, without re-installing or restarting completed work.
- Copied dependency resolution: Electron43.4.0, Forge7.11.2, Vite8.2.1, Vitest4.1.10, Biome2.5.8, TypeScript6.0.2. Actual package paths resolve under copied `node_modules`; kernel/protocol workspace links resolve under the copy's own `packages/`, not canonical source. Detailed paths in `E/closing-report.json` and per-command versions files. `pnpm-workspace.yaml`'s existing `nodeLinker: hoisted` was unchanged.

### Fresh Windows standard package proof

Command: **`pnpm package:smoke`** in the actual copied cwd, PID32524, no observer, no CI override, no launcher modification. Exit **0**, duration **41.963s**, terminal `2026-09-12T17:43:45.414Z`.

The standard launcher reached its final `Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.` message. Its unchanged sequence completed fresh production build, native packaging, package rename outside source, resource preflight, authorization matrix, bootstrap, writer-proof, missing-runtime, witnessed-staging, database audit, root cleanup and package restore. Strict Windows CRLF and the exact Writer terminal/pass stderr pair remained enforced by the launcher with real runtime challenge/witness verification. There was no copied-package isolation fallback and no workspace dependency fallback introduced.

Witness retention qualification: the standard launcher verified nonce/PID/runtime-image binding internally and removed the private runtime-root files during successful normal cleanup. This unobserved run retained the standard terminal output and source/package hashes, **not a separate raw four-scenario nonce/PID/stdout transcript**; no nonce values or independent replayable transcript are invented. Successful execution of the unchanged strict verifier is the evidence for those assertions.

| Fresh copied package artifact | Raw SHA-256 |
| --- | --- |
| `resources/app.asar` | `43c4ed1606fdc0acc728ff4fec4431c353fcb3ac893cc081291da7b9eb963a43` |
| `SlopStop.exe` | `ce2b6d4c78249465dee38fc737f4c91b1417cb0220f7aaf6bcd41c4358a97d1d` |
| Win32 x64 `fs-native-extensions.node` | `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4` |

The package manifests immediately after smoke and after deep are byte-identical, SHA-256 `75a4f1b7ee562a7778a60c1599db8f2ae336400eff4b64f681884622c8380b77`. The new package remains in the copied source's normal output directory. The canonical blocked package and all previous unconfirmed roots were untouched. A passing fresh directory does not identify or fix the cause of the original EPERM.

### Exactly one full normal deep execution

Actual command: **`pnpm check:deep`**, root command PID30856, supervisor PID24452. Started `2026-09-12T17:44:12.165Z`; terminal `2026-09-12T18:08:27.982Z`; total **1455.831s (24m15.831s), exit1**. The initial tool wait detached while the same supervised process continued; retained start/terminal/PID records prove this was not a repeated invocation. No standalone root coverage was run.

| Stage | Result and observed duration/count |
| --- | --- |
| Format | Passed;228 files,137ms reported |
| Lint | Passed;230 files,89s reported |
| Typecheck | Passed; kernel, protocol, harness and desktop; approximately11.44s command-to-next-command |
| Unit | Passed;52 files,2405 tests passed +2 skipped;61.50s |
| Dependency boundaries | Passed;236 modules,739 dependencies,0 violations |
| Full coverage | Passed;68 files,3837 tests passed +2 skipped;559.37s |
| Integration | **Failed**;15 files passed +1 failed;1431 tests passed +1 failed,0 skips;721.79s |
| Knip | Not reached after integration failure; prior focused evidence retained |
| Golden guard + jscpd | Not reached after integration failure; prior24 guard cases /0 clones retained |
| LikeC4 model | Not reached |
| Electron E2E / its build | Not reached |
| Final package launch inside deep | Not reached; earlier independent standard package smoke remains passed |

Coverage totals: statements **93.09% (5002/5373)**; branches **88.25% (2141/2426)**; functions **93.22% (1266/1358)**; lines **94.10% (4610/4899)**. Existing thresholds passed without modification: global branches75/functions80/lines80/statements80; kernel+protocol branches90/functions95/lines95/statements95; harness branches80/functions85/lines85/statements85. Coverage summary retained at `<tested-cwd>/coverage/coverage-summary.json`, SHA-256 `34d41607ba0551fc7fbb122d67f17c4b893fbcaef803b4b24a61f0bc25dee7b7`. Unit and coverage retain the same two existing Windows file-symlink EPERM skips; source guard unchanged, no new skip added, prior Linux qualifications retained.

### Exact first failing case and focused recommendation

`apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts` > **`fails early parent close at a held real resource stage: stale.initialize`**.

The149-case file first reported1 failure after269.769s; the failing case took3.221s. Final assertion at **920:46**:

```text
AssertionError: expected [] to deeply equal [ 1 ]
918  expect(run.exits).toEqual([]);
919  release();
920  await vi.waitFor(() => expect(run.exits).toEqual([1]));
```

The test reached the held create stage, closed the parent port, observed no premature exit, released the held operation, then still observed `run.exits === []` during its existing wait. This does not establish whether terminal cleanup was late or lost. The same source had passed the preceding full-coverage stage. Parent's focused next step: trace parent-port-close delivery, release of the held `stale.initialize` create operation, and its failure-cleanup/terminal-exit handoff through the existing test transport. Preserve the exit1 oracle and limits; do not infer a fix from a larger timeout. No isolated test rerun or implementation change was performed here.

### Evidence files, quality checks and final identity

| Evidence under `E` | Raw SHA-256 |
| --- | --- |
| `state.json` | `22cd9303978cbdc803ee31e545869780df5e61c21884892b0393938bf2d52c21` |
| `package-inputs.json` | `8943b37db393b3b23ae96582e67ab70adb08c0899feab937e5db5fb91dc6dfec` |
| `package-terminal.json` | `eed0f4d9b2cf2b2c43149fd2a84139bd44b41f8a304922342e4cdbf9bacf6658` |
| `package-output.log` | `16645baec3684ea2d46e03a4fc98ef02cea2f8e1ebe41def7713c4eb8501cb67` |
| `deep-inputs.json` | `fa6f11b3f4d906c7c936e40afa2c117e6ca70178d8c27e88c41058e51685bd0d` |
| `deep-terminal.json` | `e80b0e5aa7dbac1b982f8f05aadb21194deddbd2ce05166e287edc935965d504` |
| `deep-output.log` | `c3cba9fdee1219d01853d4c54fbd37a6561281ea59286940508a632a1fa846b6` |
| `deep-progress.jsonl` | `077f8cfa547be7749fd9884ff5ac0fe0b402d0b0fdb4811ff38762deeeb9223b` |
| `deep-process-tree.jsonl` | `ca08c524cf312c3afca14d53eea1e78bf11252d05009a9d733939e5ba6732e47` |

CodeScene global regression safeguard was attempted against the canonical Git repository with identical source bytes: **MCP request timed out**, no pass/fail result returned. OAuth configuration had no token/on-prem/account overrides; `verify_installation` passed5/5 before and after the timeout. This quality gate is **broken/unconfirmed**, not green, and was not retried. Configuration documentation: <https://codescene.io/docs/integrations/mcp.html#configuration>. Existing file-level reports remain historical. SonarQube was unavailable in the requested tool scope; no Docker/services were installed.

Process attribution correction: the raw supervisor's PPID-only descendant closure included13 unrelated Firefox/crashhelper processes due to Windows PID reuse. Their creation times all predate this deep invocation; they were present user processes, not test leftovers. The raw observations/terminal file remain unchanged. `E/closing-report.json` records the creation-time correction: **0 possible current task leftovers,0 live matching test runners**, and no unrelated process was killed.

At terminal and closing inspection, all331 canonical/copied input hashes still matched, with0 unexpected copied-source files outside excluded build/dependency outputs. The protected PRODUCT/CONTEXT/README and both SQL32611/32612 raw pins remain unchanged in both locations; canonical SQL hashes retain their prior S2 match. Only this canonical evidence append is authorized after that check; the copied evidence remains the exact historical input to the run. No app code, configuration, test limits, thresholds, Git metadata or host settings changed.

Retain this copied source, installed dependencies, package, coverage and all evidence for parent diagnosis. Linux renewal against final source remains pending. Parent owns the focused failure resolution, candidate freeze, independent final reviews, formal acceptance and S7 commit confirmation. **Final status: fresh Windows package proof pass; one full deep fail in integration; no formal acceptance.**

## Complete fixture terminal-wait correction — focused scope, pre-edit record

Current delegation requires replacing every terminal-exit polling wait in the canonical `canonical-writer-package-smoke.integration.test.ts`, not rerunning full coverage/deep or modifying the materialized validation copy. Read the preceding actual report under `Temp/slopstop-s7-validation-evidence-2026-09-11T19-06-31-473Z`: full coverage3837 passed +2 skips, then integration1431 passed/1 failed at the held `stale.initialize` exit assertion. That completed deep failure and its raw hashes remain historical evidence, not a new pass.

Capture uses the existing verified32-binding contract `351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d`, packet `slopstop-s7-golden-guard-intent-packet-20260911.json` raw hash `75c54048fbb61ffd0cc0f37d5cd8135420c11ada83ebfc73dc1227874687d7b7`. Protected user-document pins and SQL files remain untouched. No packaging, full coverage, full check/deep or unrelated cleanup is in this continuation.

Before editing, the existing canonical held-initialize case was rerun with the previously retained Temp diagnostic that delegates real SQL while delaying its public close completion1200ms. It failed exactly at the old line920 exit poll (`expected [] to deeply equal [1]`), while the real held operation and20ms no-early-exit assertion remained active. Capture `Temp/slopstop-s7-all-terminal-held-initialize-red-2026-09-12T18-23-30-521Z`, inputs `c16a08c40a74e139ba4590a86811119c6e18b7f981eabe4ddf84bdef0ee4de81`, report `66a89ae7ff8602bf81388d8bf73e33217c64abeef2af49a6204b0558d0cb8a10`:1 actual assertion failure,148 filter-unselected. The diagnostic changes no test/config deadline, concurrency, assertion or product guard and is not a shadow test copy.

Confirmed remaining exit-poll sites before edit:311,515 (manual startup),525,634,647,665,680,689,713,831,920,953,957,987. Every normal `run` will await its existing registered `transport.terminated` then perform the same exact exit assertion. Manual-start cases will create the existing transport before controller.start and use its real exit callback and termination promise; their cleanup will await the same promise. The ordinary audit's response synchronization will use the existing subscribed-before-send transport instead of its analogous result poll, preserving the result-count/schema assertions. Checkpoint polls for `reached`/`closed` remain unchanged, as does the20ms held-stage no-exit checkpoint.

For cohesion and to keep the integration test compact, move its existing unchanged `portAdapter` into the existing same-boundary `canonical-writer-smoke-test-transport.ts`; no new module or API to production is needed. All test names/rows, SQL mutation/checkpoint logic, exit/result/no-success/diagnostic assertions, real resources and deadlines remain. This records the helper layout before editing; it is implementation organization within the current delegated test-only scope, not a new literal human filename approval.

### All terminal waits corrected and this fixture file verified

All14 identified terminal-exit polling sites are replaced with the registered termination promise followed by the same exact exit-array assertion. Manual admission cases instantiate `observeFixturePort` before `controller.start`, supply its real `exited` callback and await its termination during cleanup; no synthetic/no-op exit is used. The successful audit also uses subscribed-before-send response synchronization and retains its exact result-count/schema assertions. `portAdapter` moved unchanged into the existing transport helper with a type-only entry import.

Source audit now finds **zero exit or result polling waits** in this file. Four remaining `vi.waitFor` calls concern only `reached`/`closed` checkpoints; they are unchanged. The20ms idle observation, no-exit-before-release assertion, held resource gates, all SQL tamper/checkpoint assertions, no-success checks, every test name/row and all configured deadlines remain. Production controller/schema/runtime/configuration and the materialized validation copy were not edited.

The same controlled held-initialize reproducer that failed before the edit now passes: `all-terminal-held-initialize-green-2026-09-12T18-29-50-457Z`, inputs `a14d9b24c96000f3ebe8913f6c4fa87ca28529ece10b9f2466e6abe40005c388`, report `664580ddb5e782a0a61e2341f72ef2cff6d11f27257c1790b657e7224617581a` (1 passed,148 filter-unselected). This proves the existing canonical case waits for actual cleanup/exit after its retained release, rather than increasing polling deadlines or changing a Temp-only assertion. The delay is only a Temp diagnostic adapter; the normal canonical tests contain no new delay.

| Check | Actual result | Capture suffix under `Temp/slopstop-s7-` | inputs.json SHA-256 |
| --- | --- | --- | --- |
| All affected terminal-wait families, plain |62 passed,87 filter-unselected | `all-terminal-focused-plain-2026-09-12T18-30-25-661Z` | `2a0d10fd64ccbb58b6126bb68e647a8edd1e26308bcf0d09cbcfe6420bcd087e` |
| Same families, focused coverage |62 passed,87 filter-unselected | `all-terminal-focused-coverage-2026-09-12T18-31-40-384Z` | `aa33e0d038177d3babf850a1351233e153f827e4212730bc66f3a774c2dd9ff3` |
| Entire existing149-case fixture file, once, normal configuration/no coverage or diagnostic setup |**149 passed,0 failed,0 skipped/unselected** | `all-terminal-entire-fixture-once-2026-09-12T18-35-04-904Z` | `965223cbaf805dab29915a22484172a3f806f3e2e1d46a66c0c16d17c16a8036` |
| Harness typecheck |exit0 | `all-terminal-harness-types-2026-09-12T18-34-45-345Z` | `fbc3d3f975025344a31131f962ad1239fb0be104eecce52987e53c5d4bc2db85` |
| Biome, both changed files |exit0, no findings | `all-terminal-biome-2026-09-12T18-33-03-493Z` | `bb7d76688465a113787a669ec9a81462d67383b358d968d1bd86d5de110c34a5` |

Report SHA-256 values: focused plain `fdae1e9cbde37d640cde7bcfaaf9e33c0c16b64bf4c5b7f5c28c7e6463a71e8e`; focused coverage `7cfd661ae339723ece834aa94def137481f9fb5234cc79ae7acb21937bff2c92`; entire fixture `92acaf2ce6249a841e15399c34f4728ce05bb446f8befb47cd6a21f951044bd6`. No unhandled error or EBUSY was reported in these executions. Filter-unselected cases are not new skips. CodeScene detailed review returned10.0/no findings for both files (992 and63 lines).

Compact handoff report with all capture pointers and exact source copies: **`Temp/slopstop-s7-all-terminal-proof-zRDVD8/report.json`**, SHA-256 **`e6f0de1ed220fb8810ca787a5d7d9cb43164e9c72500151c3d7733c5d0f28a49`**.

| Canonical file for parent copy/verification | Raw SHA-256 |
| --- | --- |
| `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts` | `5c5b422c8bd3f9ded063eedef86530bd8906accba7d6e364f498e3b6c985c422` |
| `apps/harness/tests/integration/canonical-writer-smoke-test-transport.ts` | `6912fff3624ceb46337e25cbe464496939946c965f1cb552cd5222ba23c14bd1` |

This continuation ran no root full coverage/check/deep, package build/proof, unrelated Knip/duplication work, installation or Git write. Protected user documents and SQL pins remained unchanged under the32-binding capture checks. Parent can verify/copy these two files into the retained materialized validation tree and continue the remaining validation plan. The previous materialized full coverage/integration outcomes retain their original source identity; this149-case pass is not a claim that full deep or final candidate acceptance now passed.

## Remaining component verification completed — 2026-09-12T19:04Z

**All remaining components passed. This is distributed component evidence, not a new or relabeled `pnpm check:deep` exit0. The original deep exit1 and its raw failed assertion remain preserved.**

Actual tested cwd: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-validation-2026-09-11T19-06-31-473Z`. New evidence directory, abbreviated `R`: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-remaining-2026-09-12T18-52-51-701Z`.

### Updated inputs and reused evidence

The original331-file copied manifest was verified before updating. Canonical differences were exactly the two repaired test files above and S7 evidence. Only these three files were copied, with old bytes preserved under `R/prior/`. All production source/build inputs, configuration, lockfile, user guidance and SQL remained identical. The test transport is consumed only by the integration test; its new type-only entry import was additionally checked by the fresh boundary gate.

The parent report raw hash `e6f0de1ed220fb8810ca787a5d7d9cb43164e9c72500151c3d7733c5d0f28a49` and every referenced input/report hash were verified. Current62-case plain/covered greens,149-case normal green, Biome and harness-typecheck captures match both repaired source hashes `5c5b422c8bd3f9ded063eedef86530bd8906accba7d6e364f498e3b6c985c422` and `6912fff3624ceb46337e25cbe464496939946c965f1cb552cd5222ba23c14bd1`. Verification details: `R/parent-proof-verification.json`, SHA-256 `9ae0f7c331dc8a382f12421fea0a105280768d51c5fc17abbf7ea798dac123a3`.

Before/after raw manifest hashes: `R/before.json` = `793dbc7f7b2339b9f59f88788d43c2b8aaf75e3559af303811927c55f5681ea3`; `R/after.json` = `21bb4535e0fa3e33976dc014953644d63f540b7cbeac3e75160f702f28abaa8c`. Current ordered `{path,bytes,sha256}` JSON manifest identity: **`da7ddafe8dfda2af824c4bd30d6b93e34552d94506e8cf79573f1030c15b4e0d`**. Contract32 remains `351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d`.

Prior unit2405+2 skips and global coverage3837+2 skips remain passes at their original raw test inputs, **not new executions on the changed test hashes**. The current repair has62 selected cases passing plain/covered and149 passing normally. Focused coverage is not a replacement global threshold report. The1283 unaffected cases outside the149-case file retain exact source inputs and prior integration passes; combining them with current149-case proof gives1432 cases of distributed evidence, not a single new1432-case run. Parent owns acceptance of this test-only equivalence argument. No unit/global coverage/all-integration/deep or mutation rerun was made here.

### One normal execution per remaining component

Each component directory retains all331 raw inputs in `files/`, current32 binding recipe, actual cwd/command/start PID, raw output, timestamped progress, process tree and terminal exit. Canonical and copied inputs were checked before and after every command. Existing concurrency, timeouts, thresholds and skips were unchanged.

| Command | Exit | Duration | Result |
| --- | --- | --- | --- |
| `pnpm check:boundaries` |0|4.409s|No dependency violations after new test import|
| `pnpm check:dead-code` |0|2.984s|Knip clean|
| `pnpm check:duplicates` |0|0.869s|Golden guard verified2 independent pinned SQL files before jscpd;191 files/66594 lines/411546 tokens,0 clones/duplicated lines/tokens|
| `pnpm check:architecture` |0|1.576s|LikeC4 valid;3 files,0 errors|
| `pnpm test:e2e` |0|34.930s|4 real Electron tests passed,0 failed/0 skipped; Playwright21.3s, existing configuration1 worker|
| `pnpm package:launch-smoke` |0|28.161s|All4 standard scenarios, strict runtime checks and safe cleanup completed|

The requested normal E2E script inherently builds through Forge; it was kept intact, with **no separate build command**. The pre-E2E package was preserved under `R/pre-e2e-package/` as evidence, not an isolation fallback. Complete package manifests before/after are byte-identical, SHA-256 **`75a4f1b7ee562a7778a60c1599db8f2ae336400eff4b64f681884622c8380b77`**. Final launch therefore used exactly the same proven package bytes: ASAR `43c4ed1606fdc0acc728ff4fec4431c353fcb3ac893cc081291da7b9eb963a43`; EXE `ce2b6d4c78249465dee38fc737f4c91b1417cb0220f7aaf6bcd41c4358a97d1d`; native Win32 x64 binding `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4`.

The unchanged Electron43.4.0 launcher returned `Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.` after bootstrap, Writer proof, missing-runtime and witnessed-staging. Exact Windows CRLF, stdout/stderr EOF, Writer terminal/pass pair and nonce/PID/image witness remain enforced internally. The standard unobserved launcher consumes/removes its private witness files; **no separate raw nonce/PID transcript is retained or invented**. Runtime claims are bounded to successful execution of that exact launcher on the recorded package. The original blocked canonical package and roots remain untouched; its EPERM cause remains unknown.

### Capture hashes and final qualifications

| Directory under `R` | `inputs.json` SHA-256 | `output.log` SHA-256 |
| --- | --- | --- |
|`boundaries-resumed`|`78a742ac4456be7c15d8b1d3a3cf98a62e6296076097ee9b290eaeac84455fb9`|`b4e2e8cae9eefbd2e37d24df49b385015a2eb3e2caae8da1f23a640ff40042b6`|
|`dead-code`|`94537e48f705460c1fd6357c7c9a4bda7c67ffddc77396c969bc3af9c8cbf641`|`daa78c62defd32cfe45e8193016880c25efa2229e923d0018ab14d0f327f4a65`|
|`duplicates`|`fb5379ec2bb347b6bfb8f87e290f4a4397bb1a3b3b501297703118761897d737`|`02a54cc8d89038b7fd1ead974d461a1a08046e77228e06258826bac4cb8a1f9c`|
|`architecture`|`1036e38c1c6eb8797579ce04b1456db40b98b838886d2c5c0f51b9722bdcbf2b`|`ee27277394f8fa93697b074ec1494943913082441b91696138aaca8519ed0850`|
|`e2e`|`dbd1d0bc570fe66813f7d2e6f2b5cb31e4d05bcd3212a03829c74a50052cfc28`|`f0f655ab6c3fbe121f7e2201b0c73a3462308c4e3abba0020197c6d4729e4697`|
|`launch`|`390366bf8c9e510e910e7571136caf53af9206888bf7ee6255caab18da06a08c`|`f14768d30ce0c5a02a59632b24fc690c038f221417c673cfdf962098a90a7f05`|

Aggregate `R/terminal.json` SHA-256 **`9dead5af225e40ff1c04130989cc520e8bf1329dc33b10ba49f5091f871dcd90`**: all6 exits0, all source verifications passed and every owned-process leftover list empty. Preflight initially mistook existing user Playwright `test-server` PID25856 for an executing test and stopped before spawning any component. The verifier-only predicate was corrected to distinguish `test` from `test-server`; the user server stayed untouched, both runner versions/preflight capture were preserved, and each component ran only once. Actual boundary output is in `boundaries-resumed`; original `boundaries` has no command start. Creation times also prevent prior Windows PPID-reuse attribution errors.

Final process scan found0 active task test runners; the unrelated test server remains. Protected Ragnarok documents and SQL pins remain exact, outside the S7 commit. All331 copied/canonical inputs remained unchanged through terminal; only this canonical append follows verification. No app-source edits, installs, Git writes, ACL/host settings, service changes or process kills occurred. The previous CodeScene global timeout is still unconfirmed and was not retried here. Linux renewal, test-only evidence-equivalence assessment, final candidate reviews, acceptance and S7 commit confirmation remain parent-owned. **Remaining components passed; original literal deep exit1 preserved.**

## Final-source Linux renewal — 32-binding candidate (2026-09-12)

**The final current source passed the real Linux x64 packaged proof, including a second standard launcher run without Node observation instrumentation.** This renewal changes no application/test/configuration source. It follows the explicitly authorized focused-first validation scope after duplication cleanup, the golden guard and terminal-wait fixes; it does not rerun full Linux coverage/deep or any Windows gate.

### Exact inputs, protected documents and independent copies

- New owned Linux root (`L`): **`/var/tmp/slopstop-s7-final-2451keys`**; source under `L/source`, evidence under `L/proof`.
- Matching Windows Temp root (`W`): **`C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s7-final-2451keys`**. `W/source` is a full raw source snapshot; `captures/<command>/` exists in both evidence locations.
- HEAD remains `77f7667ea89b521472660d3e1bea7e85fbf5168b`. All **331 tracked/nonignored untracked files**, including dirty S7 source, extracted helpers, checker scripts, assets, manifests, lockfile and guidance documents, were copied from the current worktree rather than from HEAD. Neither Windows dependencies nor generated outputs were transferred.
- The before-transfer, Linux-after-transfer and Windows-after-transfer raw SHA-256 maps agree. Tested source manifest SHA-256: **`d3dc52f6141ebcc9d3fbd8dbab2c8d5500bd9b8db3b75a9a4f7fd34276669995`**.
- Packet: `Temp/slopstop-s7-golden-guard-intent-packet-20260911.json`. All **32 bindings** verified using its exact ordered JSON/normalized-section recipe, identity **`351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d`**. Absolute Windows shared-guidance owners were read at their real locations, preserved as indexed raw binding copies, and copied into each Linux capture; no Product/global-guidance assertion was skipped.
- Each command retained full raw source/config/test/lockfile/binding inputs before execution, arguments, pinned-runtime observations, stdout, stderr, exit status and timings. Canonical and Linux source hashes were checked before and after execution. Terminal verification additionally hash-compared every file in all **10 full capture mirrors**, including external guidance copies.
- Comparison with `Temp/slopstop-s7-validation-2026-09-11T19-06-31-473Z` found **zero runtime-source, test, asset or dependency/configuration differences**. The sole difference was the accumulated evidence Markdown. The complete comparison is `windows-copy-delta.json`; it is not hidden by excluding tests from the source manifest.
- `PRODUCT.md`, `CONTEXT.md` and `README.md` retain exactly the packet's protected raw hashes (`d6184abf…`, `c7e57244…`, `70a11f17…`). They were copied as required inputs and remain excluded from the eventual S7 commit. No technical/product rename was performed.
- Both golden SQL inputs were copied independently, with their distinct original fixed hashes. Before install/tests and at final report verification, both were plain regular non-symlink files, **nlink 1**, with distinct inodes. No source hardlinks were used.

### Environment and focused results

Ubuntu ran as existing non-root `pedro`, UID 1000. Existing Node **24.19.0**, pnpm **11.5.1**, Electron **43.4.0** and fs-native-extensions **1.5.1** were reconfirmed. Frozen-lockfile installation ran only in the fresh source, reusing the existing Linux package store cache; it did not use prior source/node_modules as a module fallback. No new apt install, global configuration, service, sysctl, dependency upgrade or lockfile change occurred. All top-level tests/builds ran sequentially, using the existing 768-MiB Node limit and one Vitest worker. Forge kept its unchanged internal build concurrency.

| Focused Linux selection | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| `package-smoke-authorization.test.ts` | 64 | 0 | 0 |
| `project-storage-bridge.test.ts` | 12 | 0 | 0 |
| `workspace-bridge.test.ts` | 23 | 0 | 0 |
| `check-golden-sql.test.mjs` | 24 | 0 | 0 |
| **Focused total** | **123** | **0** | **0** |
| Current Writer fixture integration, including shared terminal helper | **149** | **0** | **0** |

Both authorization marker symlink cases really executed on Linux; the earlier Windows EPERM limitation remains separately qualified. The bridge suites exercise the new shared request/event helper without mocking that helper. The 149 integration selection was run to verify the new shared test transport and terminal synchronization on Linux; it is not the full harness integration or coverage suite.

`pnpm check:duplicates` ran the current mandatory golden check before current jscpd: **2 independent pinned files verified; 191 files analyzed; 0 clones**. No exclusion, threshold or checker source was changed for Linux.

### Actual build, sandbox preparation and both package runs

The authorized existing CI-equivalent pipeline ran from `L/source`:

1. **`pnpm package`**, exit 0; new package built by Forge from this exact source.
2. Root ownership and mode **4755** applied only to `L/source/apps/desktop/out/SlopStop-linux-x64/chrome-sandbox`, after checking that exact disposable regular file and its owned parent. Its inode did not change.
3. As UID 1000: **Xvfb → `dbus-run-session --config-file=L/proof/session.conf` → `pnpm package:launch-smoke`**, exit 0.
4. A second **standard, uninstrumented Node launcher** invocation under its own Xvfb/private bus session also exited 0. An external Python process sampler observed the owned process tree without modifying launcher/application code.

This is explicitly the build/preparation/launch sequence, **not a claim of literal `pnpm package:smoke`**. The private session bus uses the existing installed daemon and a socket under the fresh owned root; it is not a persistent/system bus. No output trimming, log-level suppression, sandbox/ASAR/fuse weakening or monkeypatched sandbox preparation was used. The optional recorder delegates spawn/fs operations unchanged and only retains bytes/witness/rename observations. The second run supplies independent standard-launcher success without its Node import.

| Observed full-run scenario | Actual main PID | Exit | stdout bytes | stderr bytes |
| --- | ---: | ---: | ---: | ---: |
| bootstrap | 19403 | 0 | 0 | 0 |
| writer-proof | **19536** | **0** | **0** | **76** |
| missing-runtime | 19820 | 0 | 0 | 0 |
| witnessed-staging | 19949 | 0 | 0 | 0 |

All four ran sequentially on the same authorized storage root; the unchanged launcher verified preservation of the active generation/manifest across Writer proof. The actual Writer stdout was **empty**, not Windows CRLF. Its stderr was exactly:

```text
Package smoke writer processes terminal.
Package smoke writer proof passed.
```

The fresh nonce matched the main-published witness, which identified PID **19536**, Linux x64 and Electron43.4.0. Before-launch, main-published, after-close and restored-image executable hashes agree. The independent fixture native preflight and main native preflight completed as part of the real package run, using the exact Linux1.5.1 prebuild and actual ASAR/unpacked loader observation.

| Runtime artifact | SHA-256 |
| --- | --- |
| Actual executable, before/main/after/restored | `5ddc46108967a08a0fae75d8b12cb5faa2a2bf22cee6ef0a2af8199bd88e7eb2` |
| Current packaged `app.asar` | **`a9cf120998b887d2602efa0dc096a60eb5e8b29bb60df042773a1ed63baf0c69`** |
| Published Linux x64 fs-native-extensions1.5.1 binding | `13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3` |

`built-output-manifest.json` retains individual hashes for the complete current generated harness/main/fixture/chunk/resource tree, alongside the full source/dependency-definition manifest. Thus the package is bound to the final extraction/cleanup inputs, not an earlier S7 build that happened to share the Electron executable hash.

The actual unchanged runner completed all six roles and its holder nonzero crash + EOF checks, <=15000ms observed-exit takeover guard, R1 replay/old-epoch denial/C2-R2 sequence, independent exact-row/generic-abandonment audit, live old Q Writer with replacement-generation/no-work checks, and all utility terminal/EOF checks before main exit0. No separately retained numeric takeover duration is invented; success proves the unchanged guard passed. The raw process sampler is additional PID evidence, not a substitute for the runner's receipt/audit/EOF checks.

The second, uninstrumented run recorded Writer main **26100** and six direct Node utility children **26178, 26245, 26291, 26349, 26405, 26490**. These belong to that second run, not the PID19536 witness execution. Its raw tree also identifies the test-owned bus and Xvfb processes and confirms no live observed descendants after completion.

### Cleanup, report identity and limits

Both successful package runs used same-volume **rename isolation and restoration**, preserving helper device/inode/root ownership/mode. The package is restored at its original new-source output location. Both runs' scenario storage and temporary package-isolation roots were removed. The final scan found **no remaining owned package/bus/Xvfb executables**. All prior failed or successful retained roots, packages, archives and reports remain intact; only the new runs' normal disposable scenario/isolation roots were cleaned.

Final proof report in both `W/renewed-linux-report.json` and `L/proof/renewed-linux-report.json`: SHA-256 **`54d7a323a9553fbb62c23a98cb76c2c110badacd312c837c22f3372d910e63f0`**. `evidence-hashes.json`, the per-command records, `terminal-processes.json`, raw observation JSONL, `final-source-verification.json` and full capture mirrors retain supporting evidence. The report checker itself exited0 after asserting exact bytes, nonce/PID/image agreement, all four stages, six sampled utilities, golden independence, protected hashes and cleanup.

Only warning: Forge/Vite reports **`inlineDynamicImports option is deprecated, please use codeSplitting: false instead.`** Build and both launches still exited0; no unrelated config change was made to suppress it.

All331 canonical/copied inputs remained unchanged through final verification. Only this evidence append follows the tested input capture, so it is not misreported as a source mismatch or as part of the earlier package input bytes. No code fixes were needed. No full coverage/deep, Windows gate rerun, CodeScene/Sonar rerun, mutation, Git stage/commit/push, CI dispatch or historical acceptance claim was made. The parent owns final candidate review/acceptance, test-only evidence-equivalence assessment and S7 commit confirmation; the previous literal deep failure remains recorded independently of this passing Linux renewal.

## Fractional wait timer correction — 2026-09-12

One public-runner regression leaves the handshake unanswered and both EOFs absent, advancing fractional `performance.now()` against integer fake timers. Before production edits, `expect(settled).toBe(true)` failed at controlled 13001ms (not a test timeout); the 9999ms pending/no-kill assertions passed. Minimal correction makes each pending `check` clear/rearm its timer with positive ceiling remaining time, preserving the absolute deadline and deadline-before-predicate ordering. `finish` retains its once-only timer/listener cleanup. The unchanged regression then passed; final whole-file run passed149/149, including existing deadline/cleanup cases. Missing EOF correctly produces failed handshake, unsafe cleanup and one `stdio-drain` diagnostic, with no remaining timer.

Existing `Temp/slopstop-s7-proof.mjs` captured raw inputs before every run; `command` mode preserved default concurrency. Capture directories under `C:/Users/pedro/AppData/Local/Temp/opencode/`: `slopstop-s7-fractional-wait-red-2026-09-12T20-01-15-008Z` (input SHA256 `f7487523431e3debc975b307b11c5857647db7fd867e566db92a5aa854161c09`), `slopstop-s7-fractional-wait-green-2026-09-12T20-01-51-824Z`, and `slopstop-s7-fractional-wait-final-file-2026-09-12T20-04-42-589Z` (input SHA256 `02007344e643876c6f13ecec5dc3925e299d16655ffdab403585e27573cec019`). Actual Vitest JSONs are adjacent: `slopstop-s7-fractional-wait-{red,green,final-file}-vitest.json`, respectively SHA256 `fcf82f3df08cecf5a04b9370b0228ff10b067fb476b15b5259a4700b1865c963`, `4f9a94bec726e1a494070cad2eafccdea19ed2755ae58f59b8f0b6f68b2a75e5`, `1459c335b0a100a40aec63b3a5ad4711e24ec5f174ae6f41fbfd4ce262a966f2`. Commands: `pnpm exec vitest run apps/desktop/src/main/canonical-writer-package-smoke.test.ts` (Red/first Green add `-t "settles silent response and EOF waits"`; JSON reporter/output paths captured), `pnpm --filter @slopstop/desktop typecheck`, and `pnpm exec biome check apps/desktop/src/main/canonical-writer-package-smoke.ts apps/desktop/src/main/canonical-writer-package-smoke.test.ts`. Final types/Biome captures end `final-types-2026-09-12T20-04-45-764Z` and `final-biome-2026-09-12T20-04-53-856Z`; both exit0. CodeScene initially flagged complexity9/score9.68; removing a redundant undefined guard restored source10.0, test10.0, no findings. Sonar MCP could not request analysis (`Check logs for details`); not assessed.

Final source SHA256 `19ccdfdd2bc0e74f339ccbf954286580c0e7f9ad41d4ff23d19000dfa47d7876`; Red production `fe708b3b2a23db0837cb7086daa2d1121acbd5038feaa7a69e1b10c183fc503c`; identical Red/Green/final test `28df684a94ecef025540c1864b6c3e79479cb0900830b4fd74b5b81f6aab949a`. All32 bindings and contract `351a0e41a3d9310655036ab9d4b784b357b1364dbcbb6479ddcfb72c3597754d` verified before/after runs; only production changed after Red until this append. Existing base77/S7 work and protected documents remain preserved. Parent owns renewed two-OS package proof.

## Final practical review and package renewal

The user requested a simpler closeout. Read-only reviewer `ses_f68d3a1c1ffeHbl23TvBNE4sll` identified the fractional one-shot timer defect; the preceding focused Red/Green fixes it. Parent inspected the final rearm/finish logic. No further design packets were created.

Both operating systems then renewed real package proof on source `19ccdfdd2bc0e74f339ccbf954286580c0e7f9ad41d4ff23d19000dfa47d7876`: Windows normal `pnpm package:smoke` exit0 in58.791s (`Temp/slopstop-finalwindows-package-2026-09-12T20-11-12-903Z/report.json`, ASAR `58ed4814655fec4fcf778551115209ccec87f86e0e42b15ca93e4d3d2c227885`, EXE `64d6ba9304ebb0a88993c49943b63e63431171562e243b2a4da662d9ed155d5f`); Linux standard proof exit0 in34.8s (`Temp/slopstop-s7-deadline-linux-1789243940792003400/result.json`, ASAR `f913e123297558a8a2d170bbf3939ee20e582927b2d0c2a5a32daadbbd6fcc16`, EXE `5ddc46108967a08a0fae75d8b12cb5faa2a2bf22cee6ef0a2af8199bd88e7eb2`, witnessed main PID8323). All four scenarios, required runtime/output checks and rename-based isolation/cleanup passed; no owned processes remained. Earlier packages and failed records were preserved.

The literal full deep invocation remains exit1 historically; its completed coverage and subsequent focused fixes/remaining component passes are not relabelled as a single fresh deep pass. Historical proof qualifications and failed Sonar requests remain explicit. No S8 is defined. The pending S7 commit excludes the user's PRODUCT.md, CONTEXT.md and README.md changes; no push or integration is implied.
