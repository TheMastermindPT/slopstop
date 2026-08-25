---
name: SlopStop Workspace Prototype
description: Provisional carbon-and-graphite supervision workspace for attention, conversation, and evidence.
colors:
  night: "#090b0a"
  deep: "#0e1110"
  raised: "#151817"
  panel: "#1a1d1c"
  ink: "#f0f2ef"
  ink-muted: "#a3aaa6"
  ink-dim: "#69716d"
  line: "rgb(205 214 209 / 0.14)"
  line-strong: "rgb(205 214 209 / 0.29)"
  work-signal: "#d6ddd9"
  work-secondary: "#8d9892"
  attention: "#d8a85f"
  danger: "#d97863"
  success: "#83ad90"
typography:
  headline:
    fontFamily: '"Segoe UI Variable", Aptos, "Segoe UI", sans-serif'
    fontSize: "clamp(1.35rem, 2vw, 2rem)"
    fontWeight: 580
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Segoe UI Variable", Aptos, "Segoe UI", sans-serif'
    fontSize: "1.18rem"
    fontWeight: 660
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Segoe UI Variable", Aptos, "Segoe UI", sans-serif'
    fontSize: "0.7rem"
    fontWeight: 400
    lineHeight: 1.55
  measure:
    fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace'
    fontSize: "0.57rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  sm: "0.35rem"
  md: "0.45rem"
  lg: "0.65rem"
  pill: "999px"
  circle: "50%"
spacing:
  compact: "0.3rem"
  control: "0.55rem"
  panel: "0.8rem"
  surface: "1rem"
  section: "1.2rem"
components:
  primary-action:
    backgroundColor: "#343936"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.42rem 0.65rem"
  quiet-action:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.42rem 0.65rem"
  context-strip:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.4rem"
---

# Design System: SlopStop Workspace Prototype

## Overview

**Creative North Star: "The Carbon Supervision Instrument"**

SlopStop extends the foundation shell's Local Survey Instrument into a dense desktop control surface. Matte carbon fields, graphite planes, measured hairlines, and restrained neutral light keep concurrent work readable without making the product resemble a game, a constellation, or a generic dashboard. The workspace leads with human attention, then gives direct Conversation, evidence, and relationships enough room to remain understandable over long sessions.

The built React workspace is the richest current expression of this direction. It is still an isolated fixture-backed prototype, not the final product identity or a production component library. On 25 August 2026, the user accepted the structural and visual revision as provisional prototype Evidence, with the explicit expectation that the final identity may still change. Wide and narrow Electron journeys passed. The Impeccable detector returned no regex findings but ran in degraded mode because its HTML parser modules were unavailable, so that result is not a clean bill of health. The smaller harness-status shell remains valid as a sparse foundation-state application of the same measured, dark instrument lineage.

**Key Characteristics:**

- Matte near-black fields separated by one-pixel graphite structure.
- One persistent activity rail, one replaceable sidebar, and one dominant work surface.
- Dense operational information with clear reading order and generous space around consequential decisions.
- Text, geometry, icon state, and color working together so color never carries status alone.
- Conversation, Review, Memory, Map, Runs, source, and diagnostics remaining visually distinct without becoming separate visual worlds.

## Colors

The palette is a restrained neutral field. Work light is nearly white, while green, amber, and terracotta appear only when a real state earns them.

### Primary

- **Work Signal** (`work-signal`): focus outlines, active tabs, selected relationships, and neutral active work. It is not a decorative brand accent.
- **Verified State** (`success`): accepted decisions, verified evidence, healthy local state, and complete traceability.

### Secondary

- **Attention Amber** (`attention`): decisions, proposed content, and unresolved human attention.
- **Fault Terracotta** (`danger`): broken recovery, critical failures, destructive states, and unavailable proof.
- **Secondary Work Light** (`work-secondary`): quiet relationship lines and subordinate technical emphasis.

### Neutral

- **Night Carbon** (`night`): the deepest application and work-canvas field.
- **Deep Graphite** (`deep`): sidebars, composers, and contained working regions.
- **Raised Graphite** (`raised`) and **Panel Graphite** (`panel`): temporary menus, overlays, and contextual surfaces.
- **Instrument Ink** (`ink`): primary readable content.
- **Muted Reading** (`ink-muted`) and **Dim Reading** (`ink-dim`): explanatory text, provenance, and secondary labels.
- **Measured Lines** (`line`, `line-strong`): hierarchy, grouping, and boundaries. Strong lines mark authority or temporary elevation, not decoration.

**The Signal Scarcity Rule.** State color must identify a real status, selection, or focus condition. Neutral information stays neutral.

**The Failure Stays Visible Rule.** Broken, stale, excluded, truncated, provisional, and unsupported states keep their own text and geometry; they never fade into a clean or absent appearance.

## Typography

**Headline Font:** Segoe UI Variable with Aptos and Segoe UI fallbacks

**Body Font:** Segoe UI Variable with Aptos and Segoe UI fallbacks

**Label/Mono Font:** Cascadia Code with Cascadia Mono and Consolas fallbacks

The interface face is compact, familiar, and optimized for sustained desktop operation. Cascadia belongs only to code, revisions, scope paths, timestamps, branch names, and other machine-measured content.

### Hierarchy

- **Headline** (weight 580, 1.35-2rem, line-height 1.08): restrained large statements in Review and end-state summaries; compact enough to coexist with technical evidence.
- **Surface title** (weight 660, 1.18rem, line-height 1.2): names Conversation, Map, Memory, Runs, and contextual work surfaces.
- **Body** (weight 400, 0.7rem, line-height 1.55): short operational prose with a readable maximum measure around 65-72 characters.
- **Measure label** (weight 400, 0.57rem, tracking 0.06em): technical identity, provenance, status counts, and scope paths. Uppercase is reserved for genuinely categorical labels such as Accepted or Proposed.

**The Measurement Rule.** Monospace communicates machine identity or exact provenance. It is never a generic technical costume for ordinary prose.

## Layout

The workspace uses a bounded desktop instrument grid: a narrow activity rail, one replaceable Project sidebar, a flexible central workspace, and an optional contextual right panel beneath a compact top bar. Map and Conversation are permanent central destinations. Review and Project Memory temporarily occupy the same central authority instead of opening inside the right panel or stacking another permanent column.

Conversation uses the center at full width and collapses the right panel on entry. Its scope breadcrumb sits above a two-part working region: the live Decision Canvas and the direct dialogue. The Context proposal and composer form one lower control zone. Review pairs a readable revision document with a narrower Traceable Mirror. Memory pairs filters with a flat, provenance-led list rather than a grid of cards.

At narrower desktop widths, the right panel becomes an overlay. At the smallest supported prototype composition, Decision Canvas, Review, and Memory restack into one readable column while preserving deterministic return. Height pressure shortens explanatory copy and composer depth before hiding controls or state. The foundation shell still requires proof at the 640x480 outer Electron minimum; workspace prototype reviews additionally cover its representative wide window and a 900x700 narrow window.

**The One Authority Rule.** Only one surface owns the center at a time. Temporary work replaces the center and always offers an explicit return path.

## Elevation & Depth

The system is flat by default. Depth comes from tonal steps, one-pixel structure, carbon texture, and controlled density rather than card shadows. Shadows are reserved for genuinely floating layers: searchable navigators, menus, dialogs, and the narrow-window context overlay. Small state glows may reinforce a live signal, but they never imply a raised content card.

**The Structural Depth Rule.** If a region can be separated by tone, spacing, or a measured line, it does not receive a shadow.

## Shapes

The form language is rectilinear with modest machining. Controls and inputs use small corners; temporary menus may use the larger corner. Pills are limited to branch identity, compact badges, and status chips. Exact circles belong to status lights, focus beacons, and the foundation reticle. Map nodes and traceability markers use square geometry to distinguish canonical structure from ambient status.

Borders are normally one pixel. A thicker colored side stripe is not part of the system; narrow one-pixel state lines may connect content to verified, stale, proposed, or agent-authored provenance.

## Components

### Activity Rail and Sidebar

- The rail uses icons from one Phosphor family, with filled variants reserved for the active destination.
- The adjacent sidebar is replaced by Projects, Attention, Files, or Runs; destinations never create stacked permanent docks.
- Counts and state marks pair text or icons with color.

```html
<button class="rail-button" type="button" data-active="true" aria-label="Projects" aria-pressed="true">
  <!-- Phosphor icon -->
</button>
```

```css
.rail-button {
  position: relative;
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--prototype-dim);
}

.rail-button:hover,
.rail-button[data-active="true"] {
  background: rgb(215 223 218 / 0.07);
  color: var(--prototype-ink);
}
```

### Surface Tabs

- Map and Conversation remain directly recoverable.
- Temporary tabs identify opened source, Run, Review, Changes, Settings, or Memory surfaces.
- The active tab uses neutral work light and a one-pixel underline rather than a filled brand-color block.

```html
<div class="center-tabs" role="tablist" aria-label="Open workspace surfaces">
  <button type="button" role="tab" aria-selected="true" data-active="true">Conversation</button>
</div>
```

```css
.center-tabs button {
  position: relative;
  display: flex;
  min-width: max-content;
  align-items: center;
  gap: 0.4rem;
  border-right: 1px solid var(--prototype-line);
  background: transparent;
  padding: 0 0.85rem;
  color: var(--prototype-dim);
  font-size: 0.7rem;
}

.center-tabs button[data-active="true"]::after {
  background: var(--prototype-blue);
  box-shadow: 0 0 9px rgb(220 227 223 / 0.48);
}
```

### Buttons and Inputs

- Primary actions use a compact graphite plate, neutral light border, and high-contrast text.
- Quiet actions remain transparent until hover or focus.
- Inputs use the deepest carbon field, one measured border, a visible neutral focus outline, and a themed caret and selection.
- Disabled controls retain their label and lose emphasis; they never disappear.

```html
<button class="primary-button" type="button">Review Frame</button>
<button class="quiet-button" type="button">Return to Conversation</button>
```

```css
.primary-button {
  border: 1px solid rgb(221 228 224 / 0.34);
  background: linear-gradient(145deg, #343936, #202421);
  box-shadow:
    0 8px 20px rgb(0 0 0 / 0.34),
    inset 0 1px rgb(255 255 255 / 0.06);
  color: var(--prototype-ink);
}

.quiet-button {
  background: transparent;
  color: var(--prototype-muted);
}
```

### Context Proposal and Context Record

- The proposal is compact, correctable, and placed immediately above the message composer.
- Included material appears as bounded strips; exclusions remain readable in text.
- The post-response record is visually distinct, immutable in language, and separates exact inclusion from exclusion.

```html
<div class="context-strips">
  <span data-source="memory">Rest-session recovery contract</span>
</div>
```

```css
.context-strips > span {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  border: 1px solid rgb(205 214 209 / 0.18);
  background: rgb(205 214 209 / 0.055);
  padding: 0.25rem 0.4rem;
  color: #c6cdc9;
  font-size: 0.56rem;
}

.context-strips > span[data-source="memory"] {
  border-color: rgb(103 215 166 / 0.26);
  color: #a7d9bd;
}
```

### Decision Canvas

- Accepted and proposed groups remain separate and use state color sparingly.
- Natural Decision checkpoints occupy the Canvas edge as explicit review boundaries.
- The Canvas looks provisional until acceptance and never visually merges with the canonical map.

```html
<aside class="decision-canvas" aria-label="Decision Canvas">
  <section data-state="proposed"><span>Proposed</span><p>Restore the exact active interval.</p></section>
</aside>
```

```css
.decision-canvas {
  display: grid;
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--prototype-line-strong);
  background:
    repeating-linear-gradient(135deg, rgb(255 255 255 / 0.012) 0 1px, transparent 1px 5px),
    #0c0f0d;
}

.decision-canvas > section[data-state="proposed"] > span {
  color: var(--prototype-amber);
}
```

### Review and Traceable Mirror

- Review reads as one revision document, not a card dashboard.
- Summary, user stories, proposed diff, technical plan, and coverage remain separate sections.
- The Traceable Mirror uses a narrow relationship column to connect expectation, decision, and planned Waypoint.

```html
<aside class="traceable-mirror">
  <div><span>Restore the same interval</span><strong>Wall time is authoritative</strong></div>
</aside>
```

```css
.traceable-mirror {
  min-width: 0;
  overflow-y: auto;
  border-left: 1px solid var(--prototype-line-strong);
  background: #111512;
  padding: 1rem;
}

.traceable-mirror > div {
  position: relative;
  display: grid;
  gap: 0.22rem;
  border-bottom: 1px solid var(--prototype-line);
  padding: 0.8rem 0 0.8rem 0.85rem;
}
```

### Project Memory

- Memory is a central library opened from the Project menu, not an activity-rail destination.
- Accepted, stale, and proposal rows use a flat list, explicit provenance, and one-pixel state markers.
- Proposals remain visually non-blocking and never borrow Attention styling.

```html
<div class="memory-list">
  <article data-status="stale"><header><span>Stale</span><small>Revision 625137c</small></header></article>
</div>
```

```css
.memory-list article {
  position: relative;
  display: grid;
  max-width: 54rem;
  gap: 0.35rem;
  border-bottom: 1px solid var(--prototype-line);
  padding: 0.9rem 0.25rem 1rem 0.8rem;
}

.memory-list article[data-status="stale"]::before {
  background: var(--prototype-amber);
}
```

## Do's and Don'ts

### Do:

- **Do** keep the carbon and graphite field readable during long technical sessions.
- **Do** reserve green, amber, and terracotta for verified, attention, and failure meaning.
- **Do** give Conversation, Review, and Map enough central width to perform their real task.
- **Do** preserve explicit scope, provenance, authority, revision, and return paths.
- **Do** provide keyboard focus, reduced motion, plain-text equivalents, and non-color state cues.
- **Do** test both renderer viewport size and outer Electron window size.

### Don't:

- **Don't** present the accepted workspace prototype as the final SlopStop identity; Stable Product Identity remains a separate selection and review boundary.
- **Don't** turn Conversation into an activity feed or project operational log.
- **Don't** use rounded card grids as the default information architecture.
- **Don't** introduce space, constellation, skill-progression, or game imagery for relationship semantics.
- **Don't** use ambient glow, decorative gradients, or floating shadows on ordinary content.
- **Don't** hide broken, stale, excluded, provisional, unsupported, or incomplete states to simplify a narrow layout.
- **Don't** use monospace for ordinary prose or general product headings.
