# Issue Tracker: GitHub

Issues and specifications live in GitHub Issues at `TheMastermindPT/slopstop`. Use the `gh` CLI for all operations.

## Conventions

- Create an issue with `gh issue create --repo TheMastermindPT/slopstop --title "..." --body "..."`.
- Read an issue with `gh issue view <number> --repo TheMastermindPT/slopstop --comments`.
- List issues with `gh issue list --repo TheMastermindPT/slopstop --state open --json number,title,body,labels,assignees` and the filters needed for the task.
- Comment with `gh issue comment <number> --repo TheMastermindPT/slopstop --body "..."`.
- Apply or remove labels with `gh issue edit <number> --repo TheMastermindPT/slopstop --add-label "..."` or `--remove-label "..."`.
- Close with `gh issue close <number> --repo TheMastermindPT/slopstop --comment "..."`.
- Refer to issues by linked title in prose. Do not use a bare issue number as its human-readable name.

## Pull Requests As A Triage Surface

Pull requests are not a request surface. External requests enter through issues unless this file is explicitly changed later.

## Skill Operations

When a skill says to publish to the issue tracker, create a GitHub issue. When it says to fetch a ticket, read the issue and its comments with `gh issue view`.

## Wayfinding Operations

- A Wayfinder map is one issue labelled `wayfinder:map`.
- Decision tickets are child issues labelled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Link children through GitHub sub-issues. If sub-issues are unavailable, use a task list in the map and put `Part of #<map>` at the top of each ticket.
- Use GitHub's native issue dependencies for blocking. If dependencies are unavailable, put `Blocked by: #<n>` at the top of the blocked ticket.
- Claim a ticket before work with `gh issue edit <n> --repo TheMastermindPT/slopstop --add-assignee @me`.
- Resolve a ticket by posting its answer as a comment, closing it, and adding a one-line linked context pointer under the map's `Decisions so far` section.
- The frontier is the map's open, unassigned child issues with no open blockers.

For a native blocking edge, obtain the blocker's numeric database ID with `gh api repos/TheMastermindPT/slopstop/issues/<n> --jq .id`, then call `gh api --method POST repos/TheMastermindPT/slopstop/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.

## Implementation Roadmap Operations

- A Wayfinder map resolves decisions; it is not an implementation backlog. Do not implement product behavior directly from a map, charter, FRD, or prototype ticket.
- Production implementation starts only after an accepted design artifact has been converted into a phased plan with public behavior seams, test contracts, success criteria, and explicit blockers.
- Publish that approved plan as one implementation parent with tracer-bullet child issues. Each child must deliver one independently verifiable vertical slice, link the exact plan phase, and use native blocking dependencies.
- Apply `ready-for-agent` only when a child has no unresolved product or architecture decision, names its observable behavior and acceptance criteria, and every open blocker is represented in GitHub.
- An implementation agent selects an open, unassigned `ready-for-agent` child with no open blockers, reads its parent plus linked FRD, design, plan, ADRs, and standing decisions, then claims it before editing code.
- A passing implementation may close only its own slice. It must record verification Evidence and never infer completion of siblings or the parent.

## Revising Decisions During Implementation

- Accepted decisions and plans are revisable, but implementation must never reinterpret them silently.
- When a discovery changes user-visible behavior, domain vocabulary, authority, persistence ownership, a process boundary, security posture, or another accepted cross-slice contract, stop the affected slice before crossing that boundary.
- Record the discovery on the implementation issue and open or resume the owning decision ticket. Preserve the accepted history; the correction becomes a new explicit revision rather than an edit that hides the prior decision.
- Update `PRODUCT.md`, `CONTEXT.md`, an ADR, or a standing decision according to the type of accepted change, then revise the phased plan with the `rpiv-revise` flow.
- Recheck child scopes and native dependencies after the revised plan is accepted. Remove `ready-for-agent` from invalidated work and apply it again only when the ticket is independently executable.
- Local implementation details that preserve every accepted contract may be decided inside the slice and recorded in its issue or code; they do not require reopening product decisions.
