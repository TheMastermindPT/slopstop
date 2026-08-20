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
