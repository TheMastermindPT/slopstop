import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";
import { type MenuKey, menuKeysProof, PageTokenUnread } from "./menu-keys-package-smoke.js";

/** Which keys the fake window answers; each answer lands 100 ms after its key. */
type FakeBehaviour = Readonly<{
  zoomIn: boolean;
  zoomOut: boolean;
  reset: boolean;
  reloadActs: boolean;
  devToolsOpens: boolean;
  /** The lowest level a zoom-out key reaches. */
  zoomOutFloor: number;
  /**
   * When the page's marker arrives: this many ms after Ctrl+Shift+I is sent (the page's keyup of
   * it); never when `undefined`.
   */
  markerAfter: number | undefined;
  /** A load, or DevTools, that starts 50 ms after zoom reset has answered. */
  lateLoad: boolean;
  lateDevTools: boolean;
  /**
   * How the token round trip answers, 100 ms after it is asked: the armed token (`same`),
   * another one or none (`other`), a failure (`fails`), or never (`silent`).
   */
  token: "same" | "other" | "fails" | "silent";
  /** A load that starts 50 ms into the token round trip. */
  loadDuringToken: boolean;
}>;

const zoomOnly: FakeBehaviour = {
  zoomIn: true,
  zoomOut: true,
  reset: true,
  reloadActs: false,
  devToolsOpens: false,
  zoomOutFloor: Number.NEGATIVE_INFINITY,
  markerAfter: 100,
  lateLoad: false,
  lateDevTools: false,
  token: "same",
  loadDuringToken: false,
};

/** A key as text, for the order of the keys sent. */
const keyName = (key: MenuKey) =>
  [...key.modifiers.map((modifier) => (modifier === "control" ? "Ctrl" : "Shift")), key.keyCode]
    .join("+")
    .replace("+-", "+Minus");

type WindowState = { level: number; loads: number; devTools: boolean; marker: boolean };

/** What happens to the window at `due`; it may schedule what follows it. */
type Pending = { due: number; act: (due: number) => void };

/** Adds `entry` to the queue, kept in order of when each is due (in the order sent, on a tie). */
function schedule(pending: Pending[], entry: Pending): void {
  pending.push(entry);
  pending.sort((first, second) => first.due - second.due);
}

/** What each key does to the window, and whether `behaviour` lets it act. */
const keyEffects = (
  behaviour: FakeBehaviour,
  late: (due: number) => void,
): Record<MenuKey["keyCode"], readonly [boolean, (state: WindowState, due: number) => void]> => ({
  Plus: [behaviour.zoomIn, (state) => (state.level += 0.5)],
  "-": [
    behaviour.zoomOut,
    (state) => (state.level = Math.max(state.level - 0.5, behaviour.zoomOutFloor)),
  ],
  "0": [
    behaviour.reset,
    (state, due) => {
      state.level = 0;
      late(due);
    },
  ],
  R: [behaviour.reloadActs, (state) => (state.loads += 1)],
  I: [behaviour.devToolsOpens, (state) => (state.devTools = true)],
});

/** The token round trip as `behaviour` says; `loadDuring` starts the load in its middle. */
function tokenRoundTrip(behaviour: FakeBehaviour, loadDuring: () => Effect.Effect<void>) {
  if (behaviour.token === "silent") return Effect.never;
  const answer =
    behaviour.token === "fails"
      ? Effect.fail(new PageTokenUnread())
      : Effect.succeed(behaviour.token === "same");
  return Effect.andThen(
    Effect.andThen(
      behaviour.loadDuringToken ? loadDuring() : Effect.void,
      Effect.sleep("100 millis"),
    ),
    answer,
  );
}

/**
 * A packaged window under the test clock: a key acts 100 ms after it is sent, in the order sent,
 * and only as `behaviour` says; the page's marker comes as `behaviour.markerAfter` says.
 */
function fakeWindow(behaviour: FakeBehaviour) {
  const sent: string[] = [];
  const pending: Pending[] = [];
  const state: WindowState = { level: 0, loads: 0, devTools: false, marker: false };
  const late = (due: number) =>
    schedule(pending, {
      due: due + 50,
      act: () => {
        if (behaviour.lateLoad) state.loads += 1;
        if (behaviour.lateDevTools) state.devTools = true;
      },
    });
  const effects = keyEffects(behaviour, late);
  const settled = <A>(read: () => A) =>
    Effect.map(Clock.currentTimeMillis, (now) => {
      for (let next = pending[0]; next !== undefined && next.due <= now; next = pending[0]) {
        pending.shift();
        next.act(next.due);
      }
      return read();
    });
  const later = (after: number, act: (due: number) => void) =>
    Effect.map(Clock.currentTimeMillis, (now) => schedule(pending, { due: now + after, act }));
  const { markerAfter } = behaviour;
  return {
    sent,
    ports: {
      sendKey: (key: MenuKey) => {
        const [acts, effect] = effects[key.keyCode];
        return Effect.all([
          Effect.sync(() => sent.push(keyName(key))),
          later(100, (due) => acts && effect(state, due)),
          key.keyCode === "I" && markerAfter !== undefined
            ? later(markerAfter, () => (state.marker = true))
            : Effect.void,
        ]);
      },
      markerSeen: () => settled(() => state.marker),
      samePage: () => tokenRoundTrip(behaviour, () => later(50, () => (state.loads += 1))),
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
    {
      name: "zoom out stops at the start",
      behaviour: { ...zoomOnly, zoomOutFloor: 0 },
      stage: "menu-zoom-out",
    },
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

  it("SH-B29: passes once the page's marker has arrived and nothing has loaded", async () => {
    // The marker comes 2 s after Ctrl+Shift+I, long after zoom has answered: the proof waits.
    const run = await runProof({ ...zoomOnly, markerAfter: 2000 });
    expect(run).toEqual({
      outcome: { passed: true },
      // The marker at 2 s, then the token round trip of 100 ms.
      at: 2100,
      sent: ["Ctrl+R", "Ctrl+Shift+I", "Ctrl+Plus", "Ctrl+Minus", "Ctrl+Minus", "Ctrl+0"],
    });
  });

  it.each([
    {
      name: "a load that starts after zoom answered, before the marker",
      behaviour: { ...zoomOnly, lateLoad: true, markerAfter: 2000 },
      stage: "menu-reload",
    },
    {
      name: "DevTools opening after zoom answered, before the marker",
      behaviour: { ...zoomOnly, lateDevTools: true, markerAfter: 2000 },
      stage: "menu-devtools",
    },
    {
      name: "a marker that never arrives",
      behaviour: { ...zoomOnly, markerAfter: undefined },
      stage: "menu-keys-unseen",
    },
  ] as const)("SH-B29: fails the proof on $name", async ({ behaviour, stage }) => {
    const run = await runProof(behaviour);
    expect(run.outcome).toEqual({ passed: false, tag: "MenuKeysProofError", stage });
    // Each fails only once the marker has arrived (at 2 s), or once its wait of 5 s is over.
    expect(Math.floor(run.at / 1000)).toBe(stage === "menu-keys-unseen" ? 5 : 2);
  });

  it.each([
    {
      name: "a load that starts during the token round trip",
      behaviour: { ...zoomOnly, loadDuringToken: true },
      stage: "menu-reload",
      second: 0,
    },
    {
      name: "another token, or none, with no load counted",
      behaviour: { ...zoomOnly, token: "other" },
      stage: "menu-reload",
      second: 0,
    },
    {
      name: "a token round trip that fails, with no load counted",
      behaviour: { ...zoomOnly, token: "fails" },
      stage: "menu-keys-unseen",
      second: 0,
    },
    {
      name: "a token round trip that never answers, with no load counted",
      behaviour: { ...zoomOnly, token: "silent" },
      stage: "menu-keys-unseen",
      second: 5,
    },
  ] as const)("SH-B29: fails the proof on $name", async ({ behaviour, stage, second }) => {
    const run = await runProof(behaviour);
    expect(run.outcome).toEqual({ passed: false, tag: "MenuKeysProofError", stage });
    // The round trip has its own wait of 5 s, from the marker on (at 0.3 s).
    expect(Math.floor(run.at / 1000)).toBe(second);
  });
});
