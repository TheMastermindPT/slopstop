import { describe, expect, it, vi } from "vitest";
import { liftSavedZoom, savedZoomCorrection, zoomedOut, zoomFloor } from "./zoom-floor.js";

/** One press of Electron's zoomOut role: half a zoom level down. */
const roleStep = 1.2 ** -0.5;

/** The factors after each of `presses` zoom outs from `start`. */
function pressZoomOut(start: number, presses: number): number[] {
  const factors: number[] = [];
  let factor = start;
  for (let press = 0; press < presses; press += 1) {
    factor = zoomedOut(factor);
    factors.push(factor);
  }
  return factors;
}

describe("the zoom floor", () => {
  it("SH-B26: steps down from 100% as the role does, reaches exactly 80% and stays there", () => {
    expect(zoomFloor).toBe(0.8);
    const factors = pressZoomOut(1, 10);
    const reached = factors.indexOf(0.8);
    expect(reached).toBeGreaterThan(0);
    // Before the floor, each press is the role's step; from the floor on, every press is 80%.
    expect(factors.slice(0, reached)).toEqual(
      factors.slice(0, reached).map((_, press) => roleStep ** (press + 1)),
    );
    expect(factors.slice(reached)).toEqual(Array(factors.length - reached).fill(0.8));
  });

  it("SH-B26: steps down from 200% with no jump", () => {
    expect(zoomedOut(2)).toBe(2 * roleStep);
  });

  it("SH-B26: brings a page already under 80% to 80%", () => {
    expect(zoomedOut(0.5)).toBe(0.8);
  });

  it("SH-B27: brings a saved zoom under 80% to 80%", () => {
    expect(savedZoomCorrection(0.5)).toBe(0.8);
  });

  it.each([0.8, 1, 2])("SH-B27: leaves a saved zoom of %s as it is", (saved) => {
    expect(savedZoomCorrection(saved)).toBeUndefined();
  });

  it.each([
    { saved: 0.5, sets: [[0.8]] },
    { saved: 0.8, sets: [] },
    { saved: 1, sets: [] },
  ])(
    "SH-B27: sets the loaded page's zoom once only when it opened under 80%: $saved",
    ({ saved, sets }) => {
      const contents = { getZoomFactor: vi.fn().mockReturnValue(saved), setZoomFactor: vi.fn() };
      liftSavedZoom(contents);
      expect(contents.setZoomFactor.mock.calls).toEqual(sets);
    },
  );
});
