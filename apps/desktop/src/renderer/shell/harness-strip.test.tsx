import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HarnessStrip } from "./harness-strip.js";

/** The strip's style sheet, read as text: no journey can hold these states still. */
const sheet = readFileSync(path.resolve(import.meta.dirname, "harness-strip.module.css"), "utf8");

/** The body of the first rule whose selector is exactly `selector`, at any depth. */
function ruleBody(selector: string): string {
  const start = sheet.indexOf(`${selector} {`);
  if (start === -1) return "";
  const open = sheet.indexOf("{", start);
  return sheet.slice(open + 1, sheet.indexOf("}", open));
}

/** The text of every `@media` block whose condition is `condition`, braces matched. */
function mediaBlocks(condition: string): string[] {
  const blocks: string[] = [];
  let from = sheet.indexOf(`@media ${condition}`);
  while (from !== -1) {
    const open = sheet.indexOf("{", from);
    let depth = 1;
    let at = open + 1;
    for (; depth > 0 && at < sheet.length; at += 1) {
      if (sheet[at] === "{") depth += 1;
      if (sheet[at] === "}") depth -= 1;
    }
    blocks.push(sheet.slice(open + 1, at - 1));
    from = sheet.indexOf(`@media ${condition}`, at);
  }
  return blocks;
}

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

describe("the harness strip", () => {
  it.each([
    { tone: "warn", paint: "var(--ember-tint)" },
    { tone: "busy", paint: "var(--frost-tint)" },
    { tone: "dim", paint: "var(--forged)" },
  ])("SH-B10: paints the $tone tone", ({ tone, paint }) => {
    const body = ruleBody(`.strip[data-tone="${tone}"]`);
    expect(body).toContain(`background: ${paint};`);
    if (tone === "dim") expect(body).not.toContain("blood");
  });

  it("SH-B12: turns the busy icon only when motion is allowed, and names the state in words", () => {
    render(
      <HarnessStrip
        status={{ state: "starting", attempt: 2 }}
        copy={{ heading: "Harness starting", detail: "Establishing process link, attempt 2." }}
        retrying={false}
        retryFailure={null}
        onRetry={() => undefined}
      />,
    );
    const region = screen.getByRole("region", { name: "Harness starting" });
    const icons = [...region.querySelectorAll("svg path")].map((icon) => icon.getAttribute("d"));
    expect(icons).toEqual(["M5 9L12 2L22 12L18 16M16 18L12 22L6 16M4 14L2 12"]);
    // The loader carries the spin class, which the style sheet animates only when allowed.
    expect(region.querySelector("svg")?.getAttribute("class")).toMatch(/spin/);
    expect(within(region).getByText("Harness starting")).toBeTruthy();
    expect(within(region).getByText("Establishing process link, attempt 2.")).toBeTruthy();
    const animations = count(sheet, /\banimation\s*:/g);
    const allowed = mediaBlocks("(prefers-reduced-motion: no-preference)").join("\n");
    expect(animations).toBeGreaterThan(0);
    expect(count(allowed, /\banimation\s*:/g)).toBe(animations);
  });
});
