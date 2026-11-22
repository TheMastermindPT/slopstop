import { readFileSync } from "node:fs";
import path from "node:path";
import type { HarnessStatus } from "@slopstop/protocol";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessStrip, useStripShown } from "./harness-strip.js";

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

const diagnostic = { code: "HARNESS_PROCESS_EXITED", message: "The harness exited." } as const;
const crashed = { state: "crashed", attempt: 3, canRetry: true, diagnostic } as const;
const copy = { heading: "Harness unavailable", detail: "It stopped." };

/** The strip for `status`, with no retry pressed and no failure, unless `props` says so. */
function strip(
  status: Exclude<HarnessStatus, { state: "ready" }>,
  props: Partial<{
    retrying: boolean;
    retryFailure: { code: "DESKTOP_RETRY_FAILED"; message: string };
  }> = {},
) {
  return (
    <HarnessStrip
      status={status}
      copy={copy}
      retrying={props.retrying ?? false}
      retryFailure={props.retryFailure ?? null}
      onRetry={() => undefined}
    />
  );
}

/** The path data of each icon in `element`. */
const iconPaths = (element: Element) =>
  [...element.querySelectorAll("svg path")].map((icon) => icon.getAttribute("d"));

describe("the harness strip by state", () => {
  it.each([
    {
      state: { state: "degraded", attempt: 2, diagnostic },
      tone: "warn",
      icon: "M12 3L22 20H2ZM12 9V13.5M12 17V17.5",
    },
    { state: crashed, tone: "fault", icon: "M12 2.5L21.5 12L12 21.5L2.5 12ZM9 9L15 15M15 9L9 15" },
    {
      state: { state: "stopped" },
      tone: "dim",
      icon: "M12 2.5L21.5 12L12 21.5L2.5 12ZM12 7V7.5M10.5 11H12V17H13.5",
    },
  ] as const)("SH-B10: gives the $tone tone its own icon", ({ state, tone, icon }) => {
    render(strip(state));
    const region = screen.getByRole("region", { name: copy.heading });
    expect([region.getAttribute("data-tone"), iconPaths(region)[0]]).toEqual([tone, icon]);
  });

  it.each([
    {
      retrying: false,
      icon: "M4.5 9L12 3L19.5 9M19.5 4.5V9H15M19.5 15L12 21L4.5 15M4.5 19.5V15H9",
      spins: false,
    },
    { retrying: true, icon: "M5 9L12 2L22 12L18 16M16 18L12 22L6 16M4 14L2 12", spins: true },
  ])(
    "SH-B8: draws the Retry icon for retrying $retrying, turning only the loader",
    ({ retrying, icon, spins }) => {
      render(strip(crashed, { retrying }));
      const button = screen.getByRole("button");
      expect([
        iconPaths(button),
        /spin/.test(button.querySelector("svg")?.getAttribute("class") ?? ""),
      ]).toEqual([[icon], spins]);
    },
  );

  it("SH-B8: shows a retry failure only while the harness is unavailable", () => {
    const retryFailure = { code: "DESKTOP_RETRY_FAILED", message: "No answer." } as const;
    render(strip({ state: "degraded", attempt: 2, diagnostic }, { retryFailure }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the harness strip leaving", () => {
  it("SH-B8: leaves with Retry focused and no work heading in the page, without failing", () => {
    const { unmount } = render(strip(crashed));
    screen.getByRole("button").focus();
    expect(() => unmount()).not.toThrow();
  });
});

describe("whether the strip shows", () => {
  afterEach(() => vi.useRealTimers());

  /** Renders the hook at `state`, and answers each value it gave and a way to change the state. */
  function shown(state: HarnessStatus["state"]) {
    const values: boolean[] = [];
    function Probe({ at }: Readonly<{ at: HarnessStatus["state"] }>) {
      values.push(useStripShown(at));
      return null;
    }
    const { rerender } = render(<Probe at={state} />);
    return { values, to: (next: HarnessStatus["state"]) => rerender(<Probe at={next} />) };
  }

  it("SH-B7: never shows while ready", () => {
    expect(shown("ready").values).toEqual([false]);
  });

  it("SH-B7: shows a state that is not starting from the first render", () => {
    expect(shown("crashed").values[0]).toBe(true);
  });

  it("SH-B7: waits a second again for a start that follows ready", () => {
    vi.useFakeTimers();
    const probe = shown("crashed");
    probe.to("ready");
    probe.to("starting");
    expect(probe.values.at(-1)).toBe(false);
  });

  it("SH-B7: drops the wait of a start that ended before its second", () => {
    vi.useFakeTimers();
    const probe = shown("starting");
    act(() => vi.advanceTimersByTime(500));
    probe.to("ready");
    act(() => vi.advanceTimersByTime(1000));
    probe.to("starting");
    expect(probe.values.at(-1)).toBe(false);
  });
});
