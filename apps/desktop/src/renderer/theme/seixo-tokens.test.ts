import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const renderer = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(file, "utf8");
const theme = read(path.join(renderer, "theme/seixo.module.css"));
const designLines = read(path.resolve(renderer, "../../../../DESIGN.md")).split(/\r?\n/);

/** A flat front-matter block of DESIGN.md: two-space keys with quoted values. */
function designBlock(name: "colors" | "rounded" | "spacing"): [string, string][] {
  const start = designLines.indexOf(`${name}:`);
  if (start === -1) return [];
  const entries: [string, string][] = [];
  for (const line of designLines.slice(start + 1)) {
    const entry = /^ {2}"?([\w-]+)"?: "([^"]*)"$/.exec(line);
    if (entry?.[1] === undefined || entry[2] === undefined) break;
    entries.push([entry[1], entry[2]]);
  }
  return entries;
}

/** The `backgroundColor` of one entry under `components`. */
function componentBackground(name: "button-primary-hover" | "button-secondary-hover"): string {
  const start = designLines.indexOf(`  ${name}:`);
  const line = designLines
    .slice(start + 1, start + 4)
    .find((next) => next.includes("backgroundColor"));
  return /"([^"]*)"/.exec(line ?? "")?.[1] ?? "";
}

/** The code span of one "Shadow Vocabulary" bullet, without `box-shadow: ` and any trailing `;`. */
function shadow(bullet: "Soft lift" | "Button lift" | "Frost lift" | "Composer lift"): string {
  const line = designLines.find((next) => next.startsWith(`- **${bullet}** (`)) ?? "";
  return /`box-shadow: ([^`;]*);?`/.exec(line)?.[1] ?? "";
}

const expectedProperties: [string, string][] = [
  ...designBlock("colors").map(([name, value]): [string, string] => [`--${name}`, value]),
  ...designBlock("rounded").map(([name, value]): [string, string] => [`--radius-${name}`, value]),
  ...designBlock("spacing").map(([name, value]): [string, string] => [`--space-${name}`, value]),
  ["--button-primary-hover", componentBackground("button-primary-hover")],
  ["--button-secondary-hover", componentBackground("button-secondary-hover")],
  ["--shadow-soft-lift", shadow("Soft lift")],
  ["--shadow-button-lift", shadow("Button lift")],
  ["--shadow-frost-lift", shadow("Frost lift")],
  ["--shadow-composer-lift", shadow("Composer lift")],
];

/** Lower-cases a value and collapses its whitespace, as the formatter may rewrap and re-case it. */
const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/** Every declaration of one custom property in the theme module, normalised. */
function declarations(property: string): string[] {
  return [...theme.matchAll(new RegExp(`(?:^|[\\s;{])${property}:\\s*([^;]+);`, "g"))].map(
    (match) => normalise(match[1] ?? ""),
  );
}

type Rule = { selector: string; body: string; media: string | null };

/** The style rules of a CSS file, with the `@media` query that contains each, if any. */
function rules(css: string): Rule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: Rule[] = [];
  const pattern = /(@media[^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}|([^{}@]+)\{([^{}]*)\}/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] !== undefined) {
      for (const inner of rules(match[2] ?? "")) found.push({ ...inner, media: match[1].trim() });
    } else {
      found.push({ selector: (match[3] ?? "").trim(), body: match[4] ?? "", media: null });
    }
  }
  return found;
}

/** Splits a selector list on the commas that are not inside parentheses. */
function selectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of selector) {
    depth += character === "(" ? 1 : character === ")" ? -1 : 0;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  return [...parts, current.trim()];
}

const legacyClasses = new Set(
  [
    ...read(path.join(renderer, "projects-workspace.module.css")).matchAll(/\.([a-zA-Z][\w-]*)/g),
  ].map((match) => match[1]),
);
const conversation = path.join(renderer, "conversation");
const regionModules = [
  path.join(renderer, "theme/seixo.module.css"),
  ...(existsSync(conversation) ? readdirSync(conversation, { withFileTypes: true }) : [])
    .filter((entry) => entry.isFile() && entry.name.endsWith(".module.css"))
    .map((entry) => path.join(conversation, entry.name)),
];
const colourLiteral =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
/** The 148 CSS named colours (CSS Color 4). */
const namedColours = new Set(
  `
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
  brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
  darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue
  darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey
  dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray
  green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
  lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray
  lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy
  oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise
  palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
  rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise
  violet wheat white whitesmoke yellow yellowgreen
`
    .trim()
    .split(/\s+/),
);

/**
 * Whether a declaration's value holds a colour literal: a hex, a colour function or a named
 * colour. Quoted strings (font names such as "Red Hat Text") are ignored.
 */
function holdsColour(declaration: string): boolean {
  const value = declaration.slice(declaration.indexOf(":") + 1).replace(/"[^"]*"|'[^']*'/g, "");
  const words = value.toLowerCase().match(/[a-z-]+/g) ?? [];
  return colourLiteral.test(value) || words.some((word) => namedColours.has(word));
}

/** Every declaration of a style sheet, in order, as "property: value". */
const declarationsOf = (css: string) =>
  rules(css)
    .flatMap((rule) => rule.body.split(";"))
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.includes(":"));
const systemColour =
  /\b(?:currentColor|Canvas|CanvasText|ButtonText|ButtonFace|ButtonBorder|Highlight|HighlightText|LinkText|GrayText|Field|FieldText|Mark|MarkText|AccentColor|AccentColorText)\b/;
const forcedColours = "@media (forced-colors: active)";

/** sRGB relative luminance of a `#RRGGBB` colour (WCAG 2.1). */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

type ToneName =
  | "frost"
  | "blood"
  | "ink"
  | "ink-muted"
  | "ink-dim"
  | "canvas"
  | "plate"
  | "frost-tint"
  | "ember-tint"
  | "moss-tint"
  | "blood-tint";

function contrast(foreground: ToneName, background: ToneName): number {
  const [light, dark] = [luminance(token(foreground)), luminance(token(background))].sort(
    (first, second) => second - first,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const token = (name: ToneName) => declarations(`--${name}`)[0] ?? "";

describe("the Seixo theme module", () => {
  it.each([
    ["colors", 18],
    ["rounded", 4],
    ["spacing", 9],
  ] as const)("reads the whole DESIGN.md %s block (%i tokens)", (block, size) => {
    expect(designBlock(block)).toHaveLength(size);
  });

  it.each(expectedProperties)("declares %s exactly once, equal to DESIGN.md", (property, value) => {
    expect(value).not.toBe("");
    expect(declarations(property)).toEqual([normalise(value)]);
  });

  it("writes the focus halo from --frost and keeps colour literals in the token declarations", () => {
    // Derived tones are written from their token, never as a new literal (decisions log §54).
    const derived = {
      "--focus-halo": "rgb(from var(--frost) r g b / 0.22)",
      "--fault-edge": "rgb(from var(--blood) r g b / 0.35)",
      "--fault-halo": "rgb(from var(--blood) r g b / 0.14)",
    } as const;
    for (const [property, value] of Object.entries(derived))
      expect(declarations(property)).toEqual([value]);
    const allowed = new Set([
      ...expectedProperties.map(([property]) => property),
      ...Object.keys(derived),
    ]);
    const strays = rules(theme)
      .flatMap((rule) => rule.body.split(";"))
      .map((declaration) => declaration.trim())
      .filter((declaration) => holdsColour(declaration))
      .filter((declaration) => !allowed.has(declaration.split(":")[0]?.trim() ?? ""));
    expect(strays).toEqual([]);
  });

  it("uses transparent and system colours only where the forced-colours and focus rules allow", () => {
    for (const rule of rules(theme)) {
      if (rule.media === forcedColours) continue;
      expect(rule.body).not.toMatch(systemColour);
      const transparent = rule.body
        .split(";")
        .filter((declaration) => declaration.includes("transparent"));
      expect(transparent.map((declaration) => declaration.trim())).toEqual(
        transparent.length === 0 ? [] : ["outline: 2px solid transparent"],
      );
    }
  });

  it("keeps every other region module free of colour literals", () => {
    for (const file of regionModules.slice(1)) {
      const css = read(file);
      expect(declarationsOf(css).filter(holdsColour)).toEqual([]);
      expect(css).not.toMatch(systemColour);
      expect(css).not.toContain("transparent");
    }
  });

  it("scopes every region selector to a module-local class", () => {
    for (const file of regionModules) {
      for (const rule of rules(read(file))) {
        for (const selector of selectorList(rule.selector)) {
          expect(selector).toMatch(/\.[a-zA-Z][\w-]*/);
          expect(selector).not.toMatch(/:root|:global\(|(^|[\s>+~(])(html|body)\b/);
          const classes = [...selector.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]);
          expect(classes.filter((name) => legacyClasses.has(name))).toEqual([]);
        }
      }
    }
  });

  it("ports the forced-colours rules of the decided accessibility board", () => {
    const forced = rules(theme).filter((rule) => rule.media === forcedColours);
    const declared = (selector: string) =>
      forced
        .filter((rule) => selectorList(rule.selector).includes(selector))
        .map((rule) => normalise(rule.body));
    expect(declared(".seixo :focus-visible:not(textarea)").join(" ")).toContain(
      "outline: 2px solid transparent; outline-offset: 2px;",
    );
    expect(declared(".seixo .button")).toEqual(["border: 1px solid buttontext;"]);
    const toneEdge = '.seixo .toneEdge:is([data-tone="unknown"], [data-tone="failure"])';
    for (const selector of [toneEdge, ".seixo .notice", ".seixo .failure"]) {
      expect(declared(selector)).toEqual(["border: 1px solid canvastext;"]);
    }
  });

  it("nests the forced-colours block under the region root", () => {
    const forced = rules(theme).filter((rule) => rule.media === forcedColours);
    expect(forced.length).toBeGreaterThan(0);
    const root = /^\.([a-zA-Z][\w-]*)/.exec(
      rules(theme)[0]?.selector.replace(/^:where\(/, "") ?? "",
    )?.[1];
    for (const rule of forced) {
      for (const selector of selectorList(rule.selector))
        expect(selector.startsWith(`.${root}`)).toBe(true);
    }
  });

  it.each([
    ["frost", "canvas", 3],
    ["frost", "plate", 3],
    ["blood", "canvas", 3],
    ["ink-muted", "frost-tint", 4.5],
    ["ink-muted", "ember-tint", 4.5],
    ["ink-muted", "moss-tint", 4.5],
    ["ink-muted", "blood-tint", 4.5],
    ["ink", "canvas", 4.5],
    ["ink", "plate", 4.5],
    ["ink-dim", "canvas", 4.5],
    ["ink-dim", "plate", 4.5],
  ] satisfies [ToneName, ToneName, number][])(
    "gives %s on %s at least %s:1 contrast",
    (foreground, background, minimum) => {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
    },
  );
});
