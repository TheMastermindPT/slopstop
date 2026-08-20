# CodeScene Operations

## Authentication Contract

Use CodeScene Cloud OAuth for interactive work on this machine. Keep `access_token`, `CS_ACCESS_TOKEN`, `onprem_url`, and `account_id` unset while there is one Cloud account and no headless consumer.

The CodeScene CLI owns the OAuth session outside this repository. Rotate it with the CodeScene `logout` tool followed by `login`. Never copy credentials into repository files, issue comments, logs, or chat output.

A PAT is a separate contract for CI, headless environments, or approved automation without a browser session. Introduce it only for a concrete consumer, store it in that consumer's secret store, and record its rotation owner. A configured `CS_ACCESS_TOKEN` takes precedence over OAuth and blocks interactive login.

If another Cloud account is added, switch with the CodeScene `switch_account` tool. Setting `account_id` alone does not retarget an active session.

## Verification

1. Run CodeScene `get_config`; confirm no unexpected token, on-prem URL, or account pin overrides OAuth.
2. Run `verify_installation` against the repository root; Git, authentication, CLI connectivity, API connectivity, and runtime must all pass.
3. Exercise the API-backed project lookup needed by the task without exposing returned credentials or private data.
4. Run the relevant Code Health gate. Before the repository has an initial `HEAD`, report the pre-commit safeguard's `HEAD` failure as a sequencing constraint, not as a clean result or an authentication failure.

## Foundation Baseline Rule

- Run a detailed Code Health review for every authored, analyzable JavaScript or TypeScript file in the initial baseline. Exclude generated output, dependencies, and vendored code.
- Each reviewed file must score at least 9.0 (Green Code). Do not use an average to hide a lower-scoring file.
- A score below 9.0 blocks the baseline until the code is improved or the user explicitly accepts the named finding and records the reason and follow-up in the foundation review issue.
- Authentication, CLI, API, or analyzer execution failures are broken gates and block the baseline.
- Unsupported files, missing `HEAD`, and unavailable project-scoped data are explicit `not assessed` results. Record the reason and the compensating evidence; never report them as clean.
- The exhaustive file reviews prove the root baseline before its first commit. After `HEAD` exists, the pre-commit safeguard becomes the required regression gate for later changes; an empty post-commit result does not retroactively prove the baseline.

Official references:

- [Authentication](https://github.com/codescene-oss/codescene-mcp-server/blob/main/docs/authentication.md)
- [Configuration options](https://github.com/codescene-oss/codescene-mcp-server/blob/main/docs/configuration-options.md)
