---
name: Ragnarok
description: A calm supervision instrument in matte carbon and graphite, with soft rounded forms like polished stone, signed with the Raidho rune.
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
    fontFamily: "'Red Hat Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.018em"
  title:
    fontFamily: "'Red Hat Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  card-title:
    fontFamily: "'Red Hat Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "'Red Hat Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "'Red Hat Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "-0.006em"
  meta:
    fontFamily: "'Red Hat Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  code:
    fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  row: "12px"
  card: "14px"
  band: "16px"
  pill: "999px"
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
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "#B2D6E8"
    textColor: "{colors.frost-on}"
  button-secondary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "34px"
  button-secondary-hover:
    backgroundColor: "#1B1F23"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "34px"
  button-ghost-hover:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    size: "34px"
  button-send:
    backgroundColor: "{colors.frost}"
    textColor: "{colors.frost-on}"
    rounded: "{rounded.pill}"
    padding: "0 12px 0 16px"
    height: "34px"
  chip-needs-you:
    backgroundColor: "{colors.ember-tint}"
    textColor: "{colors.ember}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 10px"
  chip-accepted:
    backgroundColor: "{colors.moss-tint}"
    textColor: "{colors.moss}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 10px"
  chip-in-force:
    backgroundColor: "{colors.frost-tint}"
    textColor: "{colors.frost}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 10px"
  card:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px 22px"
  row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "11px 12px"
  composer-field:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  search-field:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  to-selector:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "30px"
  rail-item-active:
    backgroundColor: "{colors.forged}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
---

# Design System: Ragnarok

## Overview

**Creative North Star: "The Runesmith's Instrument"**

Ragnarok is a precision instrument first. You supervise agents, read conversations and accept decisions in it for hours. The material is matte carbon and graphite, with soft rounded forms like polished stone. Surfaces sit in calm tonal steps and are lifted by soft shadows instead of outlines; light appears only where something is live. The identity is a signature, not a costume. It shows as the Raidho rune (ᚱ) on the rail and the Cinzel wordmark, with the rune rule under surface titles. On every Send button it also appears as the forge: an anvil the hammer strikes once.

The full brand world appears only at the big moments. The fire-and-ice glow and the ash belong to the startup screen; the eclipse belongs to startup, empty states, loading and recovery.

Density is medium. Text is set in Red Hat Text: open, humanist and clear at small sizes, never decorative. Colour is scarce, and when it appears it always means something: frost for live work, focus and the primary action; ember for a decision only a human can make; moss for accepted; blood for failure. Components follow the "Seixo" (polished stone) family the user chose on 2026-10-09: pill-shaped controls, generously rounded cards, borderless tonal fills, soft real shadows, and focus shown as a soft frost halo.

Linear sets the quality bar for craft, never the look. A screen fails review if it could be mistaken for Linear, or described as "Linear in other colours".

**Key Characteristics:**
- Matte carbon fields in tonal steps: canvas, iron, forged and plate.
- Soft rounded forms: pill controls, 12–14px cards and rows, 16px bands.
- Borderless tonal fills and soft shadows instead of hairline boxes; hairlines remain only as separators.
- One primary action per region, filled with frost.
- Status is always shown as an icon or diamond plus words; never colour alone.
- The Raidho rune and Cinzel carry the brand; Red Hat Text carries all the work.
- The glow and the ash appear only on the startup screen; the eclipse only at big moments; none of them on working screens.

## Colors

The world is carbon and graphite. Four state colours each carry exactly one meaning, and each has a dark tint for backgrounds.

### Primary
- **Frost** (frost): the focus halo, selection, active work ("agent working", the "now" layer), the primary and Send buttons, and links. When frost fills a button, its text uses Frost-On (frost-on).

### Secondary
- **Ember** (ember): only for genuine human attention: "Needs you" chips, the Attention count on the rail, the frame around a map item or card that waits for a human decision.
- **Moss** (moss): accepted, healthy, done. Always paired with a word ("Accepted · r4").
- **Blood** (blood): failures (a failed response, a crash line). Never used for merely destructive-looking actions such as Retire. Retire keeps history, so it stays neutral.

### Neutral
- **Canvas** (canvas): the app background, the rail, the Attention sidebar and the right panel.
- **Iron** (iron): the central work area: Conversation, Map, Decisions.
- **Forged** (forged): cards, selected rows, the active rail item, the hover fill of ghost buttons.
- **Plate** (plate): borderless fills for fields, secondary buttons, chips and counts, plus quotes ("Came from").
- **Line Subtle** (line-subtle) and **Line Strong** (line-strong): separators inside cards and lists, map edges, and dashed outlines for stubs and "not specified" items.
- **Ink** (ink), **Ink Muted** (ink-muted) and **Ink Dim** (ink-dim): three text roles only: what you read, resting icons, and secondary text (times, provenance, meta).
- **Tints** (frost-tint, ember-tint, moss-tint, blood-tint): backgrounds for chips, the "now" band (frost-tint at 55% opacity), confirmations and failures.

### Named Rules
**The Signal Scarcity Rule.** State colour appears only where a real state exists. Neutral information stays neutral.

**The Ember Means You Rule.** Ember marks only things that wait for a human. A screen with nothing for you to do contains no ember.

**The Three Voices Rule.** Text uses exactly three tones: ink, ink-muted and ink-dim. A fourth body tone needs the user's approval. On tinted surfaces (the frost, ember, moss and blood tints), secondary text uses ink-muted instead of ink-dim, to keep WCAG AA contrast (4.5:1).

## Typography

**Brand font:** Cinzel, regular weight only.
**UI font:** Red Hat Text (weights 400, 500 and 600), falling back to Segoe UI Variable, Segoe UI and the system UI font. Chosen by the user on 2026-10-09, replacing Inter.
**Code and identity font:** Cascadia Code, falling back to Cascadia Mono and Consolas.

All three faces are under the SIL Open Font License 1.1. The desktop app must bundle them locally: its Content Security Policy forbids Google Fonts. Red Hat Text's source is github.com/RedHatOfficial/RedHatFont.

**Character:** Cinzel is the carved inscription: the wordmark and a few fixed section names. Red Hat Text is the worker's hand: open, humanist and unambiguous at small sizes, readable for long sessions. Cascadia marks anything a machine identifies (D-04, r4, Run 14, code).

### Hierarchy
- **Wordmark display** (Cinzel 400, 44px, 0.14em): the startup screen only.
- **Wordmark** (Cinzel 400, 16px, 0.16em, uppercase): the top bar.
- **Section label** (Cinzel 400, 11–15px, 0.14–0.18em, uppercase): short fixed names such as ATTENTION, DECISIONS, PROPOSED, IN FORCE, WHY, CHAPTER and DESTINATION.
- **Headline** (Red Hat Text 600, 22/28, −0.018em): surface and decision titles. These are user content, so they never use Cinzel.
- **Title** (Red Hat Text 600, 16/24): sections inside surfaces.
- **Card title** (Red Hat Text 600, 14/20): checkpoint, chapter and theme titles.
- **Body** (Red Hat Text 400, 14/22): conversation prose and decision text, with a measure of about 720px.
- **Label** (Red Hat Text 500, 13/18): buttons, lists and navigation.
- **Meta** (Red Hat Text 400, 12/16): provenance, times and counts, with tabular figures.
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

Conversation content sits in one centred column with a measure of 720px; the header, stream and composer share it. Spacing follows a 4px grid. Groups are tight (4–8px); sections are separated by 24–32px. Seixo padding is generous inside components: buttons 16px across, cards 18 by 22px, rows 11 by 12px.

Breakpoints:
- **Below 1280px:** the rail loses its labels; the sidebar narrows to 248px and the panel to 320px.
- **Below 1100px:** the right panel becomes an overlay and starts closed; the Decisions detail stacks under its board.
- **Below 860px:** the sidebar hides.

The map is a derived layered graph. Rows come from dependencies, with at most 3 nodes per row and visible wrapping; nodes shrink to fit when the panel opens. Edges are routed orthogonally in the gaps between rows and never cross a node or its text.

## Elevation & Depth

Depth comes from tonal steps (canvas, then iron, then forged, then plate) and from soft real shadows. Raised items carry the soft lift instead of an outline; floating layers carry stronger shadows.

### Shadow Vocabulary
- **Soft lift** (`box-shadow: 0 10px 28px -14px rgb(0 0 0 / 0.9), inset 0 1px 0 rgb(236 239 241 / 0.04)`): cards, checkpoints, map nodes, theme groups, quotes, notices, the user's message, code blocks, menus.
- **Row lift** (`box-shadow: 0 8px 20px -12px rgb(0 0 0 / 0.9)`): the current Attention item and the active rail item.
- **Button lift** (`box-shadow: 0 4px 12px -6px rgb(0 0 0 / 0.8), inset 0 1px 0 rgb(236 239 241 / 0.05)`): secondary buttons.
- **Frost lift** (`box-shadow: 0 6px 16px -8px rgb(156 201 224 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.35)`): the primary and Send buttons.
- **Composer lift** (`box-shadow: 0 10px 28px -14px rgb(0 0 0 / 0.9)`): the message field above the stream.
- **Overlay** (`box-shadow: -24px 0 48px -12px rgb(0 0 0 / 0.8)`): the right panel as an overlay on narrow windows.
- **Focus halo** (`box-shadow: 0 0 0 4px rgb(156 201 224 / 0.28)`; fields use 0.22): every focusable control.

### Named Rules
**The Brand Moment Rule.** The fire-and-ice glow (ember top-left, frost bottom-right) and the ash belong to the startup screen only. The eclipse is reserved for big moments: startup, empty states, loading and recovery. Daily working screens carry no background glow. The eclipse is an ornament, never a domain object.

**The Soft Stone Rule.** Separate regions with tone and soft lift, not with boxes inside boxes. An outline appears only to carry meaning: an ember frame for "needs you", a blood outline for broken, a frost border for selection, a dashed line for another Feature or something not yet specified.

## Shapes

The form language is soft and rounded, like polished stone:
- pill shapes (fully rounded) for buttons, chips, counts, the search field, the To: selector, the model pill, the scope breadcrumb and segmented controls;
- 12px corners on rows, list items, the rail items and menu items;
- 14px corners on cards, checkpoints, map nodes, theme groups, quotes, notices, menus and the composer;
- 16px corners on bands such as the map's "now" band.

State markers are diamonds: 6–8px squares rotated 45°, filled for active states, outlined for waiting. Map Waypoints are 10px diamonds (Runa geometry): filled for accepted, working or your move; outlined for ready or waiting. Same step side by side means parallel work; a short link means the next step.

Coloured side stripes thicker than 1px are not part of the system. Chamfered (cut) corners were tried and rejected (2026-10-09).

## Components

### Buttons
Soft and calm: pill-shaped, recessive at rest, clear on interaction.
- **Shape:** fully rounded pill, 34px tall; the small variant is 28px and the icon variant 34px round.
- **Primary:** frost fill with frost-on text and the frost lift. Use at most one per region; hover lightens it, press darkens it.
- **Secondary:** borderless plate fill with the button lift; hover deepens the plate.
- **Ghost:** text only, in ink-dim; on hover it brightens to ink over a forged fill.
- **Send (brand exception):** the primary style, with its label naming the destination ("Send to Project") followed by the anvil-and-hammer mark instead of an arrow. See Signature components.
- **Focus:** the soft frost halo on every control.
- **Motion:** 120ms. Press nudges the button down by 0.5px.

### Chips
- **Style:** pill-shaped, 24px tall, tint background with matching text, and an icon or diamond followed by words. Variants: Needs you (ember), Accepted (moss), In force (frost), and a neutral plate. Counts are plate-filled pills.

### Cards / Containers
- **Corner style:** 14px.
- **Background:** forged, with no outline and the soft lift.
- **Attention framing:** an ember outline at 35% plus an ember-tint wash at the top. Only cards that wait for a human get this.
- **Selection:** a frost border at 60%.
- **Internal padding:** 18 by 22px for checkpoints, 16 by 18px for map nodes, 11 by 12px for rows.

### Inputs / Fields
- **Composer:** borderless plate fill, 14px corners, composer lift. On focus it shows the frost halo (no border change).
- **To: selector:** a plate-filled pill, never typed text. Choosing a recipient sends nothing.
- **Search:** a plate-filled pill; on focus, the frost halo.
- **Edit field (decision wording):** plate fill, 14px corners, frost halo while editing.

### Navigation
- **Rail:** Runa icons at one stroke width (1.5), with labels at 1280px and wider. The active item is a forged fill with 12px corners and the row lift; Attention is the Kenaz (torch) rune mark with an ember count of actionable items.
- **Centre tabs:** dim text that turns ink when active, with a 1px frost underline. Temporary tabs carry a close button and mark the current page.
- **Scope breadcrumb:** a pill with Project › scope, plus a branch pill in Cascadia.

### Signature components
- **Raidho mark and rune rule:** ᚱ in frost (a thin stroke in the ratio of the approved startup frame 109:49, about 1.25px non-scaling; square caps) at the top of the rail. Under surface titles, the rune rule: a hairline, a 6px frost diamond, then a hairline.
- **Send anvil (approved brand exception, 2026-10-09):** on Send buttons only, a custom anvil-and-hammer mark replaces the arrow. Its parts stay separable (anvil body, hammer, sparks) so a Rive version can replace them later. On each send the hammer strikes once and a few sparks fly (about 420ms, once per send, never looping). Nothing plays under reduced motion. The label always names the destination.
- **Decision checkpoint:** a card with Accept on each decision, Accept all for the ones still pending, and Correct. Proposed checkpoints wear the ember frame; accepted ones turn moss.
- **Map graph node:** a forged card with the soft lift, showing its chapter label in Cinzel, the name, Waypoint dots, a status line (diamond plus words), and a decision count pill ("2 in force"). The selected node gets a frost border; while "Show on map" is active, unrelated nodes dim to 38%.

## Do's and Don'ts

### Do:
- **Do** keep one frost-filled primary button per region.
- **Do** pair every state colour with words or a diamond (Accepted · r4, Needs you).
- **Do** use the Ragnarok-owned Runa icon set, version 2 (Figma 139:30 on page 125:30; SVG source ragnarok-hero/icons-runa-v2, 77 icons; superseding V1 at 126:30: straight rune-stave strokes, no curves, diamonds instead of circles, 1.5px, square caps, mitred joins) everywhere; the anvil on Send buttons is the only exception. A missing icon is drawn in the Runa style, never borrowed from another set.
- **Do** keep conversation and decision text in Red Hat Text at 14/22, at about 720px measure, and bundle the fonts with the app.
- **Do** give every control a hover, focus (the soft frost halo), pressed and disabled state. Use 120–200ms motion with `cubic-bezier(0.16, 1, 0.3, 1)`, made instant under reduced motion.
- **Do** keep broken, stale, provisional and unknown states visible, each with its own words. Never show them as clean or absent.

### Don't:
- **Don't** imitate another product's look. Linear is the quality bar, not the reference.
- **Don't** use background glow or ash outside the startup screen, or the eclipse on daily working screens.
- **Don't** set user content, sentences or buttons in Cinzel.
- **Don't** use ember for anything that does not wait for a human, or blood for non-failures such as Retire.
- **Don't** wrap regions in hairline boxes inside boxes, or use coloured side stripes thicker than 1px.
- **Don't** use chamfered corners, third-party icon sets (Lucide, Phosphor), Unicode glyphs or emoji as icons, or any icon outside the Runa set except the Send anvil.
- **Don't** add a fourth text tone or new palette roles without the user's approval.
