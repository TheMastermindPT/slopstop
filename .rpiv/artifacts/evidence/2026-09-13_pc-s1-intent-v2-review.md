# PC-S1 Independent Intent Review — v2

## Identity And Outcome

- Mode `intent`, PC-S1. Overall gate **failed**, all inspections complete.
- Review packet `2026-09-13_pc-s1-intent-v2.json`, SHA-256 `7ad0f78dfe779c9ba6794e2878d4101543bfe1035626aa17a2bd6399e5c16ee9`.
- Current amendment raw SHA-256 `cfdfe1b215b102187135fc62c45b96895ef5a0647e9911989d2720b86511d069`; content hash `15d5cc9583d1379710cefd6a6b6d79801b21f513a731d872e5d9251f9d26acde`.
- Frozen v1 raw SHA-256 `24d799c3d4d126f4ff7ecb60b16f6b72a862532ece8e568dbff6e33b65dd116f` at `2026-09-12_pc-s1-intent-v1-brief.md`.
- Source base/HEAD `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`; no source/test changes. Each reviewer verified 3 direct and 19 inherited bindings before and after.
- No tests/builds or file/Git mutations by reviewers. This is neither a candidate acceptance nor proof of platform support.

| Role/session | Inspection | Gate | Prior-findings disposition |
| --- | --- | --- | --- |
| slice-verifier / ses_f6844e50affeGSedEnyvQH0rDQ | complete | passed | All three own v1 blockers resolved; Decisions/Cross-slice/Research OK |
| code-reviewer / ses_f6844e3a8ffebWOGYAZqYDRaGa | complete | failed | Config-read authority, identity, cleanup, association and crash-state contracts resolved; code mapping and executable first-use remain incomplete; two new blockers |
| coverage-reviewer / ses_f6844e336ffe4pU44AJuW4fa05 | complete | failed | All six v1 coverage findings resolved; three additional verification gaps |

## Plan Review

References use v2 amendment line numbers unless explicitly marked frozen-v1. Resolution cells are intentionally blank pending triage. A passed slice-verifier result does not overrule pair findings.

| ID/source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C2-1/code | D1:42-46; B9:124 | n/a | blocker | code-quality | An external include may reference a UNC/network filesystem and cause OS SMB/authentication despite Git protocol restrictions. | Specify enforceable prevention before that read and test OS-level no-network/no-authentication, not merely absent Git helpers. | |
| C2-2/code | D5:105-107; B6:121 | project-storage-store.ts:465 | blocker | code-quality | Target observation precedes completed-request replay, so a lost response followed by directory disappearance wrongly prevents returning the original registered result. | Separate durable request lookup/reconciliation from new-work admission; current location health remains separate from original result. | |
| V2-1/coverage | D4 | n/a | blocker | verification-coverage | Equivalent-association unchanged behavior is only tested sequentially. | Add competing transport/process confirmations for B, stable same-request retry and different request identities, with exact one-association/event maxima and outcomes. | |
| V2-2/coverage | D5 | n/a | blocker | verification-coverage | Stage precedence has only within-observer/registry cases. | Add invalid-request versus pending cleanup, pending cleanup versus unconfirmed executable, and witnessed registry versus invalid target; prove no later-stage execution. | |
| V2-3/coverage | B9:124 | n/a | blocker | verification-coverage | Configuration/renderer oracle does not identify exact test file locations. | Name exact harness integration and Electron E2E files with the same public seams. | |
| C2-3/code | D5:94; B10:125; frozen-v1:134-135 | n/a | concern | actionability | Showing actual version before first confirmation conflicts with prohibiting all dispatch until confirmation. | Define separate executable-selection admission for one version query versus consent for identity queries; test both and replacement. | |
| C2-4/code | D5:84-105; B5:120 | n/a | concern | test-contract | Nonzero Git exit outranks parsing but has no exact public outcome/code. | Fix nonzero-with-confirmed-cleanup result and allowed additional classification without exposing stderr. | |
| C2-5/code | D4:74-76; B2:119 | canonical-command-registry.ts:54 | concern | test-contract | Attachment validates Project/binding, observation authority and revision without negative public cases for each. | Add cross-Project binding, untrusted observation and stale-revision cases with exact code/no-association and rejection-ledger expectations. | |

## Coordinator Interpretation

v1's authorization gap is resolved: local configuration contents may be read but not disclosed or used for credential helpers. C2-1 is a different issue: a path referenced by that configuration may itself trigger network-filesystem access. The developer has not authorized network/authentication through that mechanism. Do not silently broaden D1, pretend Git network flags sandbox filesystem reads, or accept a test that observes helpers only.

The remaining findings refine the approved registration behavior and do not establish new product implementation. A bounded read-only Herdr investigation has been requested to determine whether configuration-independent Git queries plus controlled parsing/local reads can resolve C2-1, or whether a real confinement capability/scope decision is required. No unproved mechanism has been selected.

All findings and the current failed gate remain preserved. v2's bound amendment and v1 snapshot were not edited during review. Any future revision needs its own identity and fresh affected reviews; v1/v2 inspection outcomes cannot be relabelled.

## Follow-up Research — Network-Filesystem Boundary

Herdr session `ux-research` completed the bounded follow-up against upstream Git v2.53.0 source. It reports that `rev-parse --resolve-git-dir` is handled before ordinary setup/config (`builtin/rev-parse.c:754-769`), but still follows gitfile/common-directory filesystem paths (`setup.c:325-343,417-448`); it is not a network barrier. `git config list --file - --no-includes --null` can parse immutable supplied config bytes without following include directives (`builtin/config.c:798-802`; `config.c:1591-1615`), but startup uses gentle repository discovery and therefore requires a controlled non-repository cwd/environment.

A parser-on-stdin approach could reject includes as data, but the parent still needs demonstrably local handle-based traversal before opening any directory, gitfile or config. Checking string prefixes or realpath after opening does not prove that SMB authentication did not already occur. Windows local traversal and process confinement capabilities have not been proven in this repository; upstream source inspection is not proof of the installed Git-for-Windows implementation.

Accordingly, strict prevention of network-filesystem reads remains a real technical blocker for the current hostile-configuration guarantee. There is no implemented safe fallback and no new permission. Before expanding PC-S1 into native traversal/confinement work, the coordinator should ask whether the initial personal prototype explicitly targets developer-trusted local repositories without a hostile-configuration sandbox guarantee, or whether strict confinement must be established first. The first option would be a material scope/threat-model change requiring explicit developer approval; it must retain command allowlists, no model-directed Git, no intentional Git network operations/helpers, no repository mutations and diagnostic privacy, and disclose that OS-level remote include reads are not mechanically confined. Neither option is silently selected here.

Sources: https://github.com/git/git/blob/v2.53.0/builtin/rev-parse.c#L754-L769 ; https://github.com/git/git/blob/v2.53.0/setup.c#L325-L343 ; https://github.com/git/git/blob/v2.53.0/builtin/config.c#L798-L802 ; https://github.com/git/git/blob/v2.53.0/config.c#L1591-L1615 ; https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntcreatefile .
