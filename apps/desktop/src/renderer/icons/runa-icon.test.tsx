import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunaIcon, type RunaIconName } from "./runa-icon.js";

/** Path data copied from `ragnarok-hero/icons-runa-v2/<name>.svg` (Runa v2, decisions log :359). */
const runaV2 = {
  "circle-x": "M12 2.5L21.5 12L12 21.5L2.5 12ZM9 9L15 15M15 9L9 15",
  "triangle-alert": "M12 3L22 20H2ZM12 9V13.5M12 17V17.5",
  "rotate-ccw": "M4.5 9L12 3L21 12L12 21L4.5 13.5M4.5 4.5V9H9",
  check: "M4.5 12L9.5 17L19.5 7",
  lock: "M5 11H19V21H5ZM8 11V6L10 4H14L16 6V11",
  info: "M12 2.5L21.5 12L12 21.5L2.5 12ZM12 7V7.5M10.5 11H12V17H13.5",
  // ragnarok-hero/icons-runa-v2/circle-help.svg, added for the Unknown tone (decisions log §54).
  "circle-help": "M12 2.5L21.5 12L12 21.5L2.5 12ZM8.5 9L12 6.5L15.5 9V10.5L12 13V14M12 17V17.5",
} as const;

/** The rail's staves: `icons-runa-v2/folder.svg` and `flame.svg` (the Kenaz rune). */
const shellStaves = {
  folder: "M3 5.5H9L12 8.5H21V19H3Z",
  flame: "M15.5 4L7.5 12L15.5 20M16 10L18 12L16 14L14 12Z",
} as const;

/** The harness strip's staves: `icons-runa-v2/loader-circle.svg` and `refresh-cw.svg`. */
const stripStaves = {
  "loader-circle": "M5 9L12 2L22 12L18 16M16 18L12 22L6 16M4 14L2 12",
  "refresh-cw": "M4.5 9L12 3L19.5 9M19.5 4.5V9H15M19.5 15L12 21L4.5 15M4.5 19.5V15H9",
} as const;

/** `name` renders one decorative stave drawing `path`. */
function expectStave(name: RunaIconName, path: string) {
  const { container } = render(<RunaIcon name={name} />);
  const svg = container.querySelector("svg");
  expect(svg?.getAttribute("aria-hidden")).toBe("true");
  expect(svg?.getAttribute("focusable")).toBe("false");
  expect(svg?.getAttribute("stroke")).toBe("currentColor");
  expect(svg?.getAttribute("stroke-width")).toBe("1.5");
  expect(svg?.getAttribute("stroke-linecap")).toBe("square");
  expect(svg?.getAttribute("stroke-linejoin")).toBe("miter");
  expect(svg?.getAttribute("fill")).toBe("none");
  expect([...(svg?.querySelectorAll("path") ?? [])].map((p) => p.getAttribute("d"))).toEqual([
    path,
  ]);
}

describe("RunaIcon", () => {
  it.each(Object.entries(runaV2) as [keyof typeof runaV2, string][])(
    "renders %s as a decorative stave",
    expectStave,
  );

  it.each(Object.entries(shellStaves) as [keyof typeof shellStaves, string][])(
    "SH-B2: renders %s as a decorative stave",
    expectStave,
  );

  it.each(Object.entries(stripStaves) as [keyof typeof stripStaves, string][])(
    "SH-B11: renders %s as a decorative stave",
    expectStave,
  );
});
