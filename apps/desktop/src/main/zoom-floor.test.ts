import { describe, expect, it, vi } from "vitest";
import {
  liftSavedZoom,
  savedZoomCorrection,
  zoomedIn,
  zoomedOut,
  zoomFloorLevel,
  zoomTopLevel,
} from "./zoom-floor.js";

/** Chromium's zoom level for a factor, and back: a level is `log(factor) / log(1.2)`. */
const levelOf = (factor: number) => Math.log(factor) / Math.log(1.2);
const factorOf = (level: number) => 1.2 ** level;

/** A factor as a percentage to one decimal place, as the brief writes it. */
const percent = (level: number) => Math.round(factorOf(level) * 1000) / 10;

/** The levels a page at `start` goes through, one press of `press` after another. */
function pressFrom(start: number, press: (level: number) => number, presses: number): number[] {
  const levels: number[] = [];
  let level = start;
  for (let count = 0; count < presses; count += 1) {
    level = press(level);
    levels.push(level);
  }
  return levels;
}

/** The doubles just above and just below `level`. */
const ulpOver = (level: number) => level + Math.abs(level) * Number.EPSILON;
const ulpUnder = (level: number) => level - Math.abs(level) * Number.EPSILON;

describe("the zoom floor", () => {
  it("SH-B26: stops zooming out at 80% and comes back to 100% in as many zoom ins", () => {
    const out = pressFrom(0, zoomedOut, 5);
    expect(out.map(percent)).toEqual([91.3, 83.3, 80, 80, 80]);
    expect(factorOf(out[2] ?? 0)).toBe(0.8);
    const back = pressFrom(zoomFloorLevel, zoomedIn, 3);
    expect(back.map(percent)).toEqual([83.3, 91.3, 100]);
    expect(factorOf(back[2] ?? 1)).toBe(1);
  });

  it("SH-B26: steps down from 200% by half a level, with no jump", () => {
    const start = levelOf(2);
    expect(zoomedOut(start)).toBeCloseTo(start - 0.5, 12);
  });

  it("SH-B26: brings a page already under 80% to 80% on zoom out", () => {
    expect(zoomedOut(levelOf(0.5))).toBe(zoomFloorLevel);
  });

  it.each([
    { name: "100%", start: 0, next: 0.5 },
    { name: "87.6%, between two steps", start: levelOf(0.876), next: -0.5 },
    { name: "one ulp under the step 0.5", start: ulpUnder(0.5), next: 1 },
    { name: "one ulp over the step 0.5", start: ulpOver(0.5), next: 1 },
    { name: "one ulp under the floor", start: ulpUnder(zoomFloorLevel), next: -1 },
    { name: "one ulp over the floor", start: ulpOver(zoomFloorLevel), next: -1 },
    { name: "471%", start: 8.5, next: zoomTopLevel },
    { name: "500%", start: zoomTopLevel, next: zoomTopLevel },
  ])("SH-B26: zooms in to the next step above: $name", ({ start, next }) => {
    expect(zoomedIn(start)).toBe(next);
  });

  it.each([
    { name: "one ulp under the floor", start: ulpUnder(zoomFloorLevel) },
    { name: "one ulp over the floor", start: ulpOver(zoomFloorLevel) },
  ])("SH-B26: zooms out to the floor: $name", ({ start }) => {
    expect(zoomedOut(start)).toBe(zoomFloorLevel);
  });

  it("SH-B26: names the floor and the top as zoom levels of 80% and 500%", () => {
    expect([factorOf(zoomFloorLevel), factorOf(zoomTopLevel)]).toEqual([
      0.8,
      expect.closeTo(5, 12),
    ]);
  });

  it("SH-B27: brings a saved zoom under 80% to 80%", () => {
    expect(savedZoomCorrection(levelOf(0.5))).toBe(zoomFloorLevel);
  });

  it.each([
    { name: "80%", saved: zoomFloorLevel },
    { name: "80%, read back one ulp under it", saved: ulpUnder(zoomFloorLevel) },
    { name: "100%", saved: 0 },
    { name: "200%", saved: levelOf(2) },
  ])("SH-B27: leaves a saved zoom of $name as it is", ({ saved }) => {
    expect(savedZoomCorrection(saved)).toBeUndefined();
  });

  it.each([
    { name: "50%", saved: levelOf(0.5), sets: [[zoomFloorLevel]] },
    { name: "80%", saved: zoomFloorLevel, sets: [] },
    { name: "100%", saved: 0, sets: [] },
  ])(
    "SH-B27: sets the loaded page's zoom once only when it opened under 80%: $name",
    ({ saved, sets }) => {
      const contents = { getZoomLevel: vi.fn().mockReturnValue(saved), setZoomLevel: vi.fn() };
      liftSavedZoom(contents);
      expect(contents.setZoomLevel.mock.calls).toEqual(sets);
    },
  );
});
