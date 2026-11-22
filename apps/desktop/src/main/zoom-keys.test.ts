import { describe, expect, it, vi } from "vitest";
import { zoomFloorLevel } from "./zoom-floor.js";
import { attachZoomKeys } from "./zoom-keys.js";

type KeyInput = Readonly<{
  type: string;
  key: string;
  code: string;
  control: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}>;
type KeyListener = (event: { preventDefault(): void }, input: KeyInput) => void;

const packagedWindows = { packaged: true, platform: "win32" } as const;

/** A window's `webContents` at zoom level `start`: it keeps the level it is set to. */
function fakeContents(start: number) {
  const state = { level: start };
  return {
    getZoomLevel: vi.fn(() => state.level),
    setZoomLevel: vi.fn((level: number) => {
      state.level = level;
    }),
    on: vi.fn((_name: "before-input-event", _listener: KeyListener) => undefined),
  };
}

/** Gives `input` to the one listener `attachZoomKeys` set on packaged Windows. */
function press(input: KeyInput, start: number) {
  const contents = fakeContents(start);
  attachZoomKeys(packagedWindows, contents);
  const event = { preventDefault: vi.fn() };
  const listener = contents.on.mock.calls[0]?.[1];
  listener?.(event, input);
  return {
    levels: contents.setZoomLevel.mock.calls,
    prevented: event.preventDefault.mock.calls.length,
  };
}

/** The recorded rows of the brief's table "Recorded inputs for SH-B28" (US keyboard), and row 11. */
const keyDown = { type: "keyDown", control: true, shift: false, alt: false, meta: false };
const row = {
  1: { ...keyDown, key: "=", code: "Equal" },
  2: { ...keyDown, key: "+", code: "Equal", shift: true },
  3: { ...keyDown, key: "-", code: "Minus" },
  4: { ...keyDown, key: "0", code: "Digit0" },
  5: { ...keyDown, key: "+", code: "NumpadAdd" },
  6: { ...keyDown, key: "-", code: "NumpadSubtract" },
  7: { ...keyDown, key: "+", code: "NumpadAdd", shift: true },
  8: { ...keyDown, key: "_", code: "Minus", shift: true },
  9: { ...keyDown, key: "0", code: "Numpad0" },
  10: { ...keyDown, key: "Insert", code: "Numpad0" },
  11: { ...keyDown, key: "à", code: "Digit0" },
} as const;

describe("the zoom keys", () => {
  it.each([
    { name: "row 1, Ctrl and =", input: row[1], start: 0, level: 0.5 },
    { name: "row 2, Ctrl, Shift and =", input: row[2], start: 0, level: 0.5 },
    { name: "row 3, Ctrl and minus", input: row[3], start: 0, level: -0.5 },
    { name: "row 4, Ctrl and 0", input: row[4], start: 0.5, level: 0 },
    { name: "row 5, Ctrl and numpad plus", input: row[5], start: 0, level: 0.5 },
    { name: "row 6, Ctrl and numpad minus", input: row[6], start: 0, level: -0.5 },
    { name: "row 7, Ctrl, Shift and numpad plus", input: row[7], start: 0, level: 0.5 },
    { name: "row 9, Ctrl and numpad 0, Num Lock on", input: row[9], start: 0.5, level: 0 },
    { name: "row 11, Ctrl and the AZERTY 0 key", input: row[11], start: 0.5, level: 0 },
    {
      name: "row 2 with a plus key of its own",
      input: { ...row[2], shift: false, code: "BracketLeft" },
      start: 0,
      level: 0.5,
    },
    {
      name: "row 3 with the minus on another key",
      input: { ...row[3], code: "Slash" },
      start: 0,
      level: -0.5,
    },
    {
      name: "row 1 typed by Shift and the 0 key",
      input: { ...row[1], shift: true, code: "Digit0" },
      start: 0,
      level: 0.5,
    },
    {
      name: "Ctrl and minus at the floor",
      input: row[3],
      start: zoomFloorLevel,
      level: zoomFloorLevel,
    },
    // What the key types decides before the 0 key's place does.
    {
      name: "row 3 typed by the 0 key",
      input: { ...row[3], code: "Digit0" },
      start: 0,
      level: -0.5,
    },
    { name: "row 4 from the floor", input: row[4], start: zoomFloorLevel, level: 0 },
    { name: "row 4 from 200%", input: row[4], start: Math.log(2) / Math.log(1.2), level: 0 },
    { name: "row 3 above the top", input: row[3], start: 9, level: 8.5 },
  ])("SH-B28: answers a zoom key once and stops it: $name", ({ input, start, level }) => {
    expect(press(input, start)).toEqual({ levels: [[level]], prevented: 1 });
  });

  it.each([
    { name: "row 8, Ctrl, Shift and minus", input: row[8] },
    { name: "row 10, Ctrl and numpad 0, Num Lock off", input: row[10] },
    { name: "row 1 without Ctrl", input: { ...row[1], control: false } },
    { name: "row 1 with Alt", input: { ...row[1], alt: true } },
    { name: "row 1 with meta", input: { ...row[1], meta: true } },
    { name: "row 4 with Alt, as AltGr and 0 sends", input: { ...row[4], alt: true } },
    { name: "row 1 on key up", input: { ...row[1], type: "keyUp" } },
    { name: "row 1 as Ctrl and A", input: { ...row[1], key: "a", code: "KeyA" } },
    { name: "row 11 with Shift", input: { ...row[11], shift: true } },
  ])("SH-B28: leaves a key that is not a zoom key alone: $name", ({ input }) => {
    expect(press(input, 0)).toEqual({ levels: [], prevented: 0 });
  });

  it("SH-B28: stops zoom in above the top and sets nothing", () => {
    expect(press(row[1], 9)).toEqual({ levels: [], prevented: 1 });
  });

  it("SH-B28: reads the level at each key, not when the listener was set", () => {
    const contents = fakeContents(0);
    attachZoomKeys(packagedWindows, contents);
    // The level changes from outside the listener, after it was set.
    contents.setZoomLevel(zoomFloorLevel);
    contents.setZoomLevel.mockClear();
    contents.on.mock.calls[0]?.[1]({ preventDefault: vi.fn() }, row[1]);
    expect(contents.setZoomLevel.mock.calls).toEqual([[-1]]);
  });

  it("SH-B28: sets one key listener on the window on packaged Windows", () => {
    const contents = fakeContents(0);
    attachZoomKeys(packagedWindows, contents);
    expect(contents.on).toHaveBeenCalledExactlyOnceWith("before-input-event", expect.any(Function));
  });

  it.each([
    { name: "development on win32", packaged: false, platform: "win32" },
    { name: "packaged on linux", packaged: true, platform: "linux" },
  ] as const)("SH-B28: sets no key listener elsewhere: $name", ({ packaged, platform }) => {
    const contents = fakeContents(0);
    attachZoomKeys({ packaged, platform }, contents);
    expect(contents.on).not.toHaveBeenCalled();
  });
});
