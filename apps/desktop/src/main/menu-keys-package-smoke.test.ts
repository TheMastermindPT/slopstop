import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";
import { type MenuKey, menuKeysProof } from "./menu-keys-package-smoke.js";

/** Which keys the fake window answers; each answer lands 100 ms after its key. */
type FakeBehaviour = Readonly<{
  zoomIn: boolean;
  zoomOut: boolean;
  reset: boolean;
  reloadActs: boolean;
  devToolsOpens: boolean;
}>;

const zoomOnly: FakeBehaviour = {
  zoomIn: true,
  zoomOut: true,
  reset: true,
  reloadActs: false,
  devToolsOpens: false,
};

/** A key as text, for the order of the keys sent. */
const keyName = (key: MenuKey) =>
  [...key.modifiers.map((modifier) => (modifier === "control" ? "Ctrl" : "Shift")), key.keyCode]
    .join("+")
    .replace("+-", "+Minus");

type WindowState = { level: number; loads: number; devTools: boolean };

/** What each key does to the window, and whether `behaviour` lets it act. */
const keyEffects = (
  behaviour: FakeBehaviour,
): Record<MenuKey["keyCode"], readonly [boolean, (state: WindowState) => void]> => ({
  Plus: [behaviour.zoomIn, (state) => (state.level += 0.5)],
  "-": [behaviour.zoomOut, (state) => (state.level -= 0.5)],
  "0": [behaviour.reset, (state) => (state.level = 0)],
  R: [behaviour.reloadActs, (state) => (state.loads += 1)],
  I: [behaviour.devToolsOpens, (state) => (state.devTools = true)],
});

/** The pending keys due by `now`, taken off the front of the queue in the order sent. */
function takeDue(pending: { due: number; key: MenuKey }[], now: number): MenuKey[] {
  const dueCount = pending.findIndex((entry) => entry.due > now);
  return pending.splice(0, dueCount === -1 ? pending.length : dueCount).map((entry) => entry.key);
}

/**
 * A packaged window under the test clock: a key acts 100 ms after it is sent, in the order sent,
 * and only as `behaviour` says.
 */
function fakeWindow(behaviour: FakeBehaviour) {
  const sent: string[] = [];
  const pending: { due: number; key: MenuKey }[] = [];
  const state: WindowState = { level: 0, loads: 0, devTools: false };
  const effects = keyEffects(behaviour);
  const settled = <A>(read: () => A) =>
    Effect.map(Clock.currentTimeMillis, (now) => {
      for (const key of takeDue(pending, now)) {
        const [acts, effect] = effects[key.keyCode];
        if (acts) effect(state);
      }
      return read();
    });
  return {
    sent,
    ports: {
      sendKey: (key: MenuKey) =>
        Effect.map(Clock.currentTimeMillis, (now) => {
          sent.push(keyName(key));
          pending.push({ due: now + 100, key });
        }),
      zoomLevel: () => settled(() => state.level),
      loadsStarted: () => settled(() => state.loads),
      devToolsOpen: () => settled(() => state.devTools),
    },
  };
}

/** Runs the proof under the test clock for a minute; answers its outcome and when it ended. */
function runProof(behaviour: FakeBehaviour) {
  const window = fakeWindow(behaviour);
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          menuKeysProof(window.ports).pipe(
            Effect.match({
              onSuccess: () => ({ passed: true }),
              onFailure: (error) => ({ passed: false, tag: error._tag, stage: error.stage }),
            }),
            Effect.flatMap((outcome) =>
              Effect.map(Clock.currentTimeMillis, (at) => ({ outcome, at })),
            ),
          ),
        );
        yield* TestClock.adjust("60 seconds");
        const ended = yield* Fiber.join(fiber);
        return { ...ended, sent: window.sent };
      }),
      TestClock.layer(),
    ),
  );
}

describe("the packaged menu's keys proof", () => {
  it.each([
    { name: "zoom only", behaviour: zoomOnly, stage: undefined },
    { name: "zoom in dead", behaviour: { ...zoomOnly, zoomIn: false }, stage: "menu-zoom-in" },
    { name: "zoom out dead", behaviour: { ...zoomOnly, zoomOut: false }, stage: "menu-zoom-out" },
    { name: "reset dead", behaviour: { ...zoomOnly, reset: false }, stage: "menu-zoom-reset" },
    { name: "reload acts", behaviour: { ...zoomOnly, reloadActs: true }, stage: "menu-reload" },
    {
      name: "DevTools opens",
      behaviour: { ...zoomOnly, devToolsOpens: true },
      stage: "menu-devtools",
    },
  ] as const)("proves the packaged menu's keys: $name", async ({ behaviour, stage }) => {
    const run = await runProof(behaviour);
    if (stage === undefined) {
      expect(run.outcome).toEqual({ passed: true });
      expect(run.sent).toEqual([
        "Ctrl+R",
        "Ctrl+Shift+I",
        "Ctrl+Plus",
        "Ctrl+Minus",
        "Ctrl+Minus",
        "Ctrl+0",
      ]);
      return;
    }
    expect(run.outcome).toEqual({ passed: false, tag: "MenuKeysProofError", stage });
    // A dead zoom key fails once its wait of 5 s is over, not before and not much later.
    if (stage.startsWith("menu-zoom")) expect(Math.floor(run.at / 1000)).toBe(5);
  });
});
