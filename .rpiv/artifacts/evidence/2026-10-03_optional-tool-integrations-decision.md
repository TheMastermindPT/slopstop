---
date: 2026-10-03
author: OpenCode
commit: 8f58420
branch: main
repository: slopstop
status: in-progress
---

# Optional And Replaceable Tool Integrations

## Human Requirement

The user wants Ragnarok to benefit from tools used in RPIV/Claude, including **jscpd, opengrep and ast-grep**, as well as better alternatives discovered later. The user explicitly does **not** want to bind developers to that personal toolset: these integrations must be optional.

## Product Direction

- Describe useful capabilities independently of particular tool brands. A developer can select an implementation appropriate to their Project and workflow, substitute an alternative or leave an optional integration disabled.
- The named tools are examples of future integrations, not mandatory dependencies or an approved implementation shortlist.
- Recommendations or convenient tool profiles must not become compulsory installation, hidden activation or execution on every task.
- Keep tool availability, configuration, permission and actual result distinct. Disabled/not-configured/not-run is not a successful analysis; a selected tool's failure must remain visible rather than becoming a clean result.
- Evaluate quality by the agreed behavior and evidence, not by whether the developer installed the same tools as the product author.

This is a requirement for the future Ragnarok capability catalogue and tool experience. It does not install any tool, alter current application code, or remove the repository's own existing development checks. Current Effect migration and lifecycle repair continue under their existing scope. Detailed connector APIs, configuration/profile UI and rollout order remain future design work.
