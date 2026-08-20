---
name: SlopStop Foundation Shell
description: Provisional technical-cartography shell for local harness status.
colors:
  surface: "#101411"
  ink: "#edf0e8"
  ink-muted: "#aeb8ab"
  line: "rgb(196 210 189 / 0.22)"
  line-strong: "rgb(196 210 189 / 0.42)"
  grid-line: "rgb(196 210 189 / 0.055)"
  axis-line: "rgb(196 210 189 / 0.11)"
  signal: "#9eb58c"
  danger: "#dc8873"
typography:
  display:
    fontFamily: '"Segoe UI Variable", Aptos, "Segoe UI", sans-serif'
    fontSize: "clamp(3.2rem, 8vw, 6rem)"
    fontWeight: 540
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  body:
    fontFamily: '"Segoe UI Variable", Aptos, "Segoe UI", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.65
  measure:
    fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace'
    fontSize: "0.72rem"
    letterSpacing: "0.14em"
rounded:
  none: "0"
  circle: "50%"
spacing:
  shell: "clamp(1.25rem, 3vw, 2.5rem)"
  instrument-gap: "clamp(2rem, 8vw, 7rem)"
  compact-gap: "clamp(1.5rem, 4vw, 2.5rem)"
components:
  retry-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.72rem 1rem"
  retry-button-hover:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "0.72rem 1rem"
---

# Design System: SlopStop Foundation Shell

## Overview

**Creative North Star: "The Local Survey Instrument"**

The foundation shell uses a provisional technical-cartography language: a dark working surface, measured grid, restrained signal colors, and one reticle that makes the harness link feel observable. It is an operational status surface, not a marketing page or a preview of the full workspace.

**Provisional foundation verdict: PASS.** The real Electron window was inspected at the default 1120x720 outer size and the 640x480 minimum. A clipping defect at the minimum size was repaired; the resulting 1106x657 and 626x418 renderer viewports contain the heading, status, and footer without overflow. The accessibility tree exposes one heading and a polite textual status region.

The final visual identity remains explicitly deferred. These rules describe the replaceable foundation shell and must not be treated as approval for the eventual project map, boards, supervision views, or product brand.

**Known limitations:**

- Only the ready state received visual inspection in a real Electron window. Automated tests cover startup, crash, retry, and error behavior, but those visual states still need later review.
- Windows is the only reviewed platform. System-font metrics and native chrome may differ on macOS and Linux.
- The shell demonstrates one status instrument, not the density or interaction model of the future product workspace.
- The minimum supported application window is 640x480. Smaller web-style mobile layouts are not a foundation requirement.

**Key Characteristics:**

- Sparse, instrument-like status presentation.
- Text, geometry, and color communicate state together.
- Flat surfaces with hairline structure instead of card stacks.
- Responsive composition driven by both available width and height.

## Colors

The palette is a low-glare dark field with warm off-white text, a muted green operational signal, and a soft terracotta danger signal.

### Primary

- **Survey Signal** (`signal`): active coordinates, focus outlines, selection, and healthy status.

### Secondary

- **Fault Marker** (`danger`): crashed, stopped, and retry-error states only.

### Neutral

- **Night Field** (`surface`): the single application background.
- **Instrument Ink** (`ink`): primary readable content.
- **Muted Reading** (`ink-muted`): explanatory status and chrome labels.
- **Measured Lines** (`line`, `line-strong`, `grid-line`, `axis-line`): structural geometry that stays subordinate to text.

**The Signal Scarcity Rule.** Signal colors indicate state or focus. They do not decorate neutral content.

## Typography

**Display Font:** Segoe UI Variable with Aptos and Segoe UI fallbacks

**Body Font:** Segoe UI Variable with Aptos and Segoe UI fallbacks

**Label/Measure Font:** Cascadia Mono with SFMono-Regular and Consolas fallbacks

The sans face carries readable product and status text. Monospace is reserved for coordinates, versions, and instrument labels where measurement is the content.

### Hierarchy

- **Display:** the product name, large and compact, with tightly controlled tracking.
- **Status title:** semibold and direct; it names the current harness condition.
- **Body:** muted explanatory text with a relaxed line height and a maximum readable measure.
- **Measure label:** small uppercase monospace with wide tracking for coordinates and versions.

**The Measurement Rule.** Monospace belongs to machine coordinates and version data, never as a generic technical costume.

## Layout

The shell is a three-row grid: coordinates, one centered instrument, and a footer. At wide desktop sizes, the reticle and readout share two columns. Narrow windows normally stack them, but a narrow and low desktop viewport returns to a compact two-column composition so core status remains visible above native window chrome.

The default window is 1120x720 and the enforced minimum is 640x480. Responsive checks must use the renderer viewport, not only the outer Electron bounds. The shell must have no horizontal or vertical document overflow at either supported size.

## Elevation & Depth

The system is flat. Depth comes from tonal contrast, grid density, axis lines, and the reticle hierarchy rather than panels or shadows. The beacon may use a small state ring and acquisition pulse because it represents an active signal, not elevation.

**The Flat Instrument Rule.** Structural lines and measured spacing create hierarchy; floating cards do not.

## Shapes

The reticle, orbit, and beacon use exact circles. Controls use square corners and one-pixel borders. This contrast separates the live signal geometry from human actions without adding ornamental containers.

## Components

### Status Instrument

- **Reticle:** concentric circular lines with horizontal and vertical axes.
- **Beacon:** signal color for starting, ready, or recovering; danger color for crashed or stopped.
- **Readout:** coordinate, product name, textual status title, and diagnostic detail in that order.
- **Responsive behavior:** large two-column, narrow stacked, and narrow-low compact two-column.

### Retry Button

- **Shape:** square, transparent, one-pixel signal border.
- **Hover:** filled signal surface with dark text.
- **Focus:** global two-pixel signal outline with a visible offset.
- **Disabled:** reduced opacity and wait cursor while retrying.

## Do's and Don'ts

### Do:

- **Do** keep every state understandable from text without relying on color or motion.
- **Do** test the 640x480 outer Electron window against its smaller renderer viewport.
- **Do** preserve keyboard focus and reduced-motion behavior.
- **Do** keep grid and axis lines quieter than body text.

### Don't:

- **Don't** present this provisional shell as the final SlopStop identity.
- **Don't** add rounded card stacks, decorative gradients, or ambient shadows to this shell.
- **Don't** hide status, recovery controls, or diagnostics to make a small window fit.
- **Don't** use monospace for ordinary prose or product headings.
