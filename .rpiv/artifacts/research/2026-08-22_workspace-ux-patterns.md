# Workspace UX Patterns for SlopStop

## Question

Which established interaction patterns can inform SlopStop's Project map, left-side navigation, logs and operational views, settings access, model selection, right-side Waypoint workbench, and night-blue visual direction without copying another product's identity?

## Method and limits

The research used Exa search and page extraction on 2026-08-22. Exa reached its free search-rate limit before every planned query completed, so the findings deliberately rely on the primary sources successfully retrieved: Apple, Visual Studio Code, yFiles, PatternFly, and GitHub Copilot documentation. No unsupported claim is filled from a failed search.

## Findings

### 1. A dark workspace needs layered depth, not a tinted flat field

Apple Dark Mode distinguishes dimmer base backgrounds from brighter elevated backgrounds so foreground interfaces advance while the underlying surface recedes. Apple also requires adaptive semantic color roles and at least 4.5:1 contrast, recommending 7:1 for small custom text. This supports a midnight-blue base for the map and a slightly lighter blue-black Waypoint workbench, rather than a green cast or a permanent Cartesian grid.

Implications for SlopStop:

- Treat dark blue as a family of semantic layers: map base, raised navigation, elevated inspector, selection, attention, danger, and subdued relationships.
- Let the map atmosphere come from depth, sparse authored landmarks, and relationship geometry rather than an always-visible grid.
- Keep final palette, typography, and icon suite open until Impeccable init; the current prototype is structural evidence only.
- Respect operating-system contrast and reduced-transparency preferences even if v1 initially ships one dark visual direction.

Source: [Apple Human Interface Guidelines: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode).

### 2. Separate destination navigation from the content of the selected destination

VS Code separates a narrow Activity Bar from a Primary Sidebar. The Activity Bar selects a view container; the sidebar then shows the views belonging to that destination. It also places Account and Manage controls at the bottom. The guidance warns against excessive containers and excessive views, suggesting roughly three to five views for most sidebar sizes.

Implications for SlopStop:

- A narrow left activity rail can own top-level destinations such as Projects, Attention, Runs, Evidence/Findings, and Diagnostics.
- The adjacent left sidebar can show Projects by default and replace its contents when another destination is selected. This is stronger than permanently halving a narrow sidebar between unrelated information sets.
- A Settings/Manage button belongs naturally at the bottom-left rail. Its first layer can expose common commands and a clear route to a dedicated Settings surface.
- The number of always-visible destinations must stay small. Less frequent tools should remain commands or live inside a broader operational destination.

Sources: [VS Code UX Guidelines overview](https://code.visualstudio.com/api/ux-guidelines/overview), [VS Code sidebar guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars), and [VS Code custom layout](https://code.visualstudio.com/docs/configure/custom-layout).

### 3. Logs and output benefit from a supporting panel, not permanent sidebar residency

VS Code gives supporting, horizontally dense views such as Problems, Terminal, and Output a separate Panel region. The panel can be minimized, maximized, repositioned, split, or moved, and its toolbar changes with the active view. The official guidance explicitly warns not to put something there if it must always remain visible, because users often minimize the panel.

Implications for SlopStop:

- Structured logs, Process-job output, diagnostics, and raw operational traces are good candidates for a collapsible bottom panel with named views.
- Persistent high-level failure and recovery signals must still appear in Project/Waypoint state; the bottom panel is detail, never the only place a critical condition exists.
- A future customizable workbench may permit moving operational views, but v1 should ship one strong default before adding layout configuration.

Sources: [VS Code UX Guidelines overview](https://code.visualstudio.com/api/ux-guidelines/overview), [VS Code Panel guidelines](https://code.visualstudio.com/api/ux-guidelines/panel), and [VS Code custom layout](https://code.visualstudio.com/docs/configure/custom-layout).

### 4. The Waypoint workbench is an inline primary-detail drawer

PatternFly describes the drawer as a primary-detail pattern where the main content remains present while contextual detail opens beside it. An inline drawer compresses but preserves primary content; an overlay covers it. A splitter is recommended when the detail genuinely needs variable width.

Implications for SlopStop:

- Keep the right workbench inline at normal desktop widths so the selected Waypoint and useful relationships remain visible.
- Give the workbench a real resize handle rather than only compact/expanded presets if user testing shows variable content needs it.
- At narrow widths, switch to an overlay/full-workbench state with a deterministic return to the map.
- Reduce verbosity through progressive page content, not by hiding critical status. The persistent header should be short and pages should reveal detail on demand.

Source: [PatternFly Drawer design guidelines](https://www.patternfly.org/components/drawer/design-guidelines/).

### 5. Graph navigation needs level-of-detail changes, distinct focus states, and an overview

yFiles treats overview, selection, keyboard focus, and programmatic highlight as separate concepts. It supports level-of-detail rendering, filtering, fit-to-content, fit-to-selection, keyboard navigation, and a small overview that shows the whole graph and current viewport.

Implications for SlopStop:

- Preserve the domain distinction between Selected Waypoint, attention, active work, and keyboard focus in the visual treatment.
- Semantic zoom must change information, not merely scale it: Project view emphasizes Feature regions, Feature view exposes Waypoints and typed edges, and Waypoint focus emphasizes direct relationships.
- A minimap/overview becomes useful only after maps exceed one viewport; it should not be added decoratively to small maps.
- Filtering should reduce graph complexity while visibly declaring what is hidden.

Sources: [yFiles feature guide](https://docs.yfiles.com/yfiles-html/dguide/features/), [yFiles interaction support](https://docs.yfiles.com/yfiles-html/dguide/interaction-support/), and [yFiles selection, focus, and highlight](https://docs.yfiles.com/yfiles-html/dguide/view_selection/).

### 6. Model selection has global, Project, Run, and response-level concerns

GitHub Copilot documents that models differ by task fit, latency, reliability, capability, availability, and cost. Its Auto mode chooses using task complexity and service health, while the actual model used remains inspectable per response. It also notes that switching models mid-session can add cost without enough quality improvement.

Implications for SlopStop:

- Provider credentials, permitted model catalogue, privacy, and spending ceilings belong in dedicated Settings and policy surfaces.
- Project-level defaults belong in the Project profile, not in a global chat picker.
- Run, role, task, or future-dispatch overrides belong in contextual approval/supervision UI and must not silently change active Workers.
- An Auto/recommended strategy can reduce repeated choice, but the concrete model actually used must remain visible in Board/Run detail.
- A single model dropdown beside every text box would collapse these distinct scopes and misrepresent SlopStop authority.

Sources: [GitHub Copilot AI model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison), [About Copilot auto model selection](https://docs.github.com/en/copilot/concepts/models/auto-model-selection), and [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models).

## Candidate structure to test in discovery

1. Thin left activity rail: Projects, Attention, Runs, Evidence/Findings, Diagnostics; Settings/Manage at the bottom.
2. Replaceable primary sidebar: Project list by default; destination-specific tree/list for the selected activity.
3. Map as the central primary surface with semantic zoom and declared filtering.
4. Inline, resizable right Waypoint workbench with compact persistent context and progressively disclosed pages.
5. Collapsible bottom operational panel for logs, Process jobs, output, and diagnostics.
6. Model controls split by scope: Settings for catalogue/credentials/policy, Project profile for defaults, Run/role approvals for overrides, and per-response display for the actual model.

## Questions left for the user

- Which top-level destinations deserve permanent activity-rail positions?
- Are logs primarily a debugging tool, a routine supervision view, or both?
- Should Settings open as a dedicated full workspace, a separate window, or a layered sheet after the quick Manage menu?
- Which model choices does the user expect to make frequently, and at what scope?
- What minimum information must stay visible in the right workbench header, and what can move behind pages or disclosure controls?
- How much of the midnight-blue/iPhone-night reference is atmosphere versus a desire to follow Apple-like materials and motion?
