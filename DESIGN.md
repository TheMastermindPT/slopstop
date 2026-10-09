---
name: Ragnarok
description: A quiet, machined supervision instrument in carbon and graphite, signed with the Raidho rune.
colors:
  canvas: "#050606"
  iron: "#0A0B0C"
  forged: "#101214"
  plate: "#16191C"
  line-subtle: "#202429"
  line-strong: "#3A4148"
  ink: "#ECEFF1"
  ink-muted: "#9AA3AB"
  ink-dim: "#79828A"
  frost: "#9CC9E0"
  frost-on: "#08131A"
  frost-tint: "#14232B"
  ember: "#E09A4A"
  ember-tint: "#2A1D10"
  moss: "#8DB892"
  moss-tint: "#132019"
  blood: "#E5766A"
  blood-tint: "#2A1513"
typography:
  wordmark:
    fontFamily: "Cinzel, serif"
    fontSize: "16px"
    fontWeight: 400
    letterSpacing: "0.16em"
  wordmark-display:
    fontFamily: "Cinzel, serif"
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.14em"
  section-label:
    fontFamily: "Cinzel, serif"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "0.16em"
  headline:
    fontFamily: "Inter, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Inter, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  card-title:
    fontFamily: "Inter, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "Inter, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Inter, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "-0.006em"
  meta:
    fontFamily: "Inter, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  code:
    fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  control: "6px"
  surface: "8px"
  field: "10px"
  band: "10px"
  pill: "11px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.frost}"
    textColor: "{colors.frost-on}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-primary-hover:
    backgroundColor: "#B2D6E8"
    textColor: "{colors.frost-on}"
  button-secondary:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    size: "28px"
  chip-needs-you:
    backgroundColor: "{colors.ember-tint}"
    textColor: "{colors.ember}"
    rounded: "{rounded.control}"
    height: "22px"
    padding: "0 8px"
  chip-accepted:
    backgroundColor: "{colors.moss-tint}"
    textColor: "{colors.moss}"
    rounded: "{rounded.control}"
    height: "22px"
    padding: "0 8px"
  chip-in-force:
    backgroundColor: "{colors.frost-tint}"
    textColor: "{colors.frost}"
    rounded: "{rounded.control}"
    height: "22px"
    padding: "0 8px"
  card:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px 20px"
  composer-field:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
  rail-item-active:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

# Design System: Ragnarok

## Overview

**Creative North Star: "The Runesmith's Instrument"**

Ragnarok is a precision instrument first. You supervise agents, read conversations and accept decisions in it for hours. Every working surface is matte carbon and graphite: three tonal steps separated by hairlines, with light only where something is live. The identity is a signature, not a costume. It shows as the Raidho rune (ᚱ) on the rail and the Cinzel wordmark. The rune rule sits under surface titles. The full brand world appears only at the big moments: the eclipse, the fire-and-ice glow and the ash at startup, plus the loading and recovery mark.

Density is medium. Text is set in Inter and is never decorative. Colour is scarce, and when it appears it always means something: frost for live work, focus and the primary action; ember for a decision only a human can make; moss for accepted; blood for failure. Components are quiet and machined. They stay recessive at rest and become exact under the cursor or keyboard focus. The user chose this feel over a heavier "forged" alternative on 2026-10-09.

Linear sets the quality bar for craft, never the look. A screen fails review if it could be mistaken for Linear, or described as "Linear in other colours".

**Key Characteristics:**
- Matte carbon fields in tonal steps: canvas, iron, forged and plate.
- Hairline structure, plus a 1px "machined" top-edge highlight on raised surfaces.
- One primary action per region, filled with frost.
- Status is always shown as an icon or diamond plus words; never colour alone.
- The Raidho rune and Cinzel carry the brand; Inter carries all the work.
- The glow and the ash appear only on the startup screen; the eclipse only at big moments; none of them on working screens.

## Colors

The world is carbon and graphite. Four state colours each carry exactly one meaning, and each has a dark tint for backgrounds.

### Primary
- **Frost** (frost): focus rings, selection, active work ("agent working", the "now" layer), the primary button and links. When frost fills a button, its text uses Frost-On (frost-on).

### Secondary
- **Ember** (ember): only for genuine human attention: "Needs you" chips, the Attention count on the rail, the frame around a map item or card that waits for a human decision. It is also the destination's colour on the map.
- **Moss** (moss): accepted, healthy, done. Always paired with a word ("Accepted · r4").
- **Blood** (blood): failures (a failed response, a crash line). Never used for merely destructive-looking actions such as Retire. Retire keeps history, so it stays neutral.

### Neutral
- **Canvas** (canvas): the app background, the rail, the Attention sidebar and the right panel.
- **Iron** (iron): the central work area: Conversation, Map, Decisions.
- **Forged** (forged): cards, the composer, the active rail item, selected list rows.
- **Plate** (plate): quotes ("Came from"), stub surfaces and secondary emphasis.
- **Line Subtle** (line-subtle) and **Line Strong** (line-strong): separators and outlines; strong lines are for fields, map edges and selected authority.
- **Ink** (ink), **Ink Muted** (ink-muted) and **Ink Dim** (ink-dim): three text roles only: what you read, resting icons, and secondary text (times, provenance, meta).
- **Tints** (frost-tint, ember-tint, moss-tint, blood-tint): backgrounds for chips, the "now" band (frost-tint at 55% opacity), confirmations and failures.

### Named Rules
**The Signal Scarcity Rule.** State colour appears only where a real state exists. Neutral information stays neutral.

**The Ember Means You Rule.** Ember marks only things that wait for a human. A screen with nothing for you to do contains no ember.

**The Three Voices Rule.** Text uses exactly three tones: ink, ink-muted and ink-dim. A fourth body tone needs the user's approval. On tinted surfaces (the frost, ember, moss and blood tints), secondary text uses ink-muted instead of ink-dim, to keep WCAG AA contrast (4.5:1).

## Typography

**Brand font:** Cinzel, regular weight only.
**UI font:** Inter, falling back to Segoe UI Variable and the system UI font.
**Code and identity font:** Cascadia Code, falling back to Cascadia Mono and Consolas.

**Character:** Cinzel is the carved inscription: the wordmark and a few fixed section names. Inter is the instrument panel: compact, neutral and readable for long sessions. Cascadia marks anything a machine identifies (D-04, r4, Run 14, code).

### Hierarchy
- **Wordmark display** (Cinzel 400, 44px, 0.14em): the startup screen only.
- **Wordmark** (Cinzel 400, 16px, 0.16em, uppercase): the top bar.
- **Section label** (Cinzel 400, 11–15px, 0.14–0.18em, uppercase): short fixed names such as ATTENTION, DECISIONS, PROPOSED, IN FORCE, WHY, CHAPTER and DESTINATION.
- **Headline** (Inter 600, 22/28, −0.018em): surface and decision titles. These are user content, so they stay in Inter.
- **Title** (Inter 600, 16/24): sections inside surfaces.
- **Card title** (Inter 600, 14/20): checkpoint, chapter and theme titles.
- **Body** (Inter 400, 14/22): conversation prose and decision text, with a measure of about 720px.
- **Label** (Inter 500, 13/18): buttons, lists and navigation.
- **Meta** (Inter 400, 12/16): provenance, times and counts, with tabular figures.
- **Code** (Cascadia 12.5/20): code blocks, revision ids and Waypoint ids.

### Named Rules
**The Cinzel Rule.** Cinzel appears only in the wordmark and in short, fixed section names. Never use it for user content, sentences or buttons.

**The Measurement Rule.** Monospace means machine identity or code, never a "technical" costume for prose.

## Layout

The desktop shell has five parts:
- a 44px top bar;
- a labelled activity rail: 72px with labels at 1280px and wider, 56px icons-only below that;
- one replaceable sidebar, 272px (Attention, Projects, Files, Runs or Settings);
- a flexible centre with Map and Conversation tabs, plus temporary tabs such as Decisions and Review;
- a 360px right panel that opens on demand.

Conversation content sits in one centred column with a measure of 720px; the header, stream and composer share it. Spacing follows a 4px grid. Groups are tight (4–8px); sections are separated by 24–32px.

Breakpoints:
- **Below 1280px:** the rail loses its labels; the sidebar narrows to 248px and the panel to 320px.
- **Below 1100px:** the right panel becomes an overlay and starts closed; the Decisions detail stacks under its board.
- **Below 860px:** the sidebar hides.

The map is a derived layered graph. Rows come from dependencies, with at most 3 nodes per row and visible wrapping; nodes shrink to fit when the panel opens. Edges are routed orthogonally in the gaps between rows and never cross a node or its text.

## Elevation & Depth

The system is flat by default. Depth comes from tonal steps (canvas, then iron, then forged, then plate), from hairlines, and from one machined detail: a 1px top-edge highlight in ink at 6% on raised surfaces (cards, the composer, the active rail item).

Real shadows exist only for things that float above content:
- menus: `0 18px 40px -8px rgb(0 0 0 / 0.75)`;
- the composer's lift: `0 12px 32px -12px rgb(0 0 0 / 0.7)`;
- the narrow-window panel overlay: `-24px 0 48px -12px rgb(0 0 0 / 0.8)`.

### Named Rules
**The Brand Moment Rule.** The fire-and-ice glow (ember top-left, frost bottom-right) and the ash belong to the startup screen only. The eclipse is reserved for big moments: startup, empty states, loading and recovery. Daily working screens carry no background glow. The eclipse is an ornament, never a domain object.

**The Structural Depth Rule.** If tone, spacing or a hairline can separate two regions, no shadow is used.

## Shapes

Corners are modest and machined:
- 6px on controls and chips;
- 8px on cards, rows and surfaces;
- 10px on the composer and the "now" band;
- 11px on pill-shaped counts.

State markers are diamonds: 6–8px squares rotated 45°, filled for active states, outlined for waiting. Map Waypoints are 10px circles: filled for accepted, working or your move; outlined for ready or waiting. Same step side by side means parallel work; a short link means the next step.

Borders are 1px. Coloured side stripes thicker than 1px are not part of the system. Chamfered (cut) corners were tried and rejected (2026-10-09).

## Components

### Buttons
Quiet and machined: recessive at rest, exact on interaction.
- **Shape:** gently rounded (6px), 30px tall; the small variant is 26px and the icon variant 28px square.
- **Primary:** frost fill with frost-on text and a soft inner top light. Use at most one per region; hover lightens it, press darkens it.
- **Secondary:** forged plate with a strong 1px outline and the machined top edge.
- **Ghost:** text only, in ink-dim; on hover it brightens to ink over a faint wash.
- **Focus:** a 2px frost ring, offset 2px, on every control.
- **Motion:** 120ms. Press nudges the button down by 0.5px.

### Chips
- **Style:** 22px tall, 6px corners, tint background with matching text, and an icon or diamond followed by words. Variants: Needs you (ember), Accepted (moss), In force (frost), and a neutral plate.

### Cards / Containers
- **Corner style:** 8px.
- **Background:** forged, with a subtle 1px outline and the machined top edge.
- **Attention framing:** an ember outline at 50–60% plus an ember-tint wash at the top. Only cards that wait for a human get this.
- **Internal padding:** 16 by 20px for cards; 12 by 16px for list rows.

### Inputs / Fields
- **Composer:** forged, 10px corners, strong outline. On focus it shows a frost border and a 3px frost halo at 14%.
- **To: selector:** a bordered, clickable button, never typed text. Choosing a recipient sends nothing.
- **Search:** iron background with a subtle outline; on focus it uses the same frost treatment as the composer.

### Navigation
- **Rail:** Lucide icons at one stroke width (1.5), with labels at 1280px and wider. The active item is a forged plate with the top edge; Attention is a flame with an ember count of actionable items.
- **Centre tabs:** dim text that turns ink when active, with a 1px frost underline. Temporary tabs carry a close button.
- **Scope breadcrumb:** Project › scope, plus a branch pill in Cascadia.

### Signature components
- **Raidho mark and rune rule:** ᚱ in frost (stroke 2, square caps) at the top of the rail. Under surface titles, the rune rule: a hairline, a 6px frost diamond, then a hairline.
- **Decision checkpoint:** a card with Accept on each decision, Accept all for the ones still pending, and Correct. Proposed checkpoints wear the ember frame; accepted ones turn moss.
- **Map graph node:** a forged card showing its chapter label in Cinzel, the name, Waypoint dots, a status line (diamond plus words), and a decision count pill ("2 in force"). The selected node gets a frost border; while "Show on map" is active, unrelated nodes dim to 38%.

## Do's and Don'ts

### Do:
- **Do** keep one frost-filled primary button per region.
- **Do** pair every state colour with words or a diamond (Accepted · r4, Needs you).
- **Do** use Lucide icons only, at one stroke width (1.5).
- **Do** keep conversation and decision text in Inter at 14/22, at about 720px measure.
- **Do** give every control a hover, focus (2px frost ring), pressed and disabled state. Use 120–200ms motion with `cubic-bezier(0.16, 1, 0.3, 1)`, made instant under reduced motion.
- **Do** keep broken, stale, provisional and unknown states visible, each with its own words. Never show them as clean or absent.

### Don't:
- **Don't** imitate another product's look. Linear is the quality bar, not the reference.
- **Don't** use background glow, the eclipse or ash on daily working screens.
- **Don't** set user content, sentences or buttons in Cinzel.
- **Don't** use ember for anything that does not wait for a human, or blood for non-failures such as Retire.
- **Don't** nest bordered boxes more than two deep, or use coloured side stripes thicker than 1px.
- **Don't** use chamfered corners, Phosphor icons, or Unicode glyphs or emoji as icons.
- **Don't** add a fourth text tone or new palette roles without the user's approval.
