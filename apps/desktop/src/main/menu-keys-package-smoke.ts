import { Data, Effect } from "effect";

/** Where the packaged menu's keys proof failed. */
export type MenuKeysProofStage =
  | "menu-zoom-in"
  | "menu-zoom-out"
  | "menu-zoom-reset"
  | "menu-reload"
  | "menu-devtools";

export class MenuKeysProofError extends Data.TaggedError("MenuKeysProofError")<{
  readonly message: string;
  readonly stage: MenuKeysProofStage;
}> {
  constructor(stage: MenuKeysProofStage) {
    super({ message: "Packaged menu keys proof failed.", stage });
  }
}

/** One key press, as `webContents.sendInputEvent` takes it (Electron accelerator key codes). */
export type MenuKey = Readonly<{
  keyCode: "R" | "I" | "Plus" | "-" | "0";
  modifiers: readonly ("control" | "shift")[];
}>;

/** The proof's ports to the packaged window. */
export type MenuKeysProofPorts = Readonly<{
  sendKey(key: MenuKey): Effect.Effect<void>;
  zoomLevel(): Effect.Effect<number>;
  /** How many loads the window has started so far. */
  loadsStarted(): Effect.Effect<number>;
  devToolsOpen(): Effect.Effect<boolean>;
}>;

const reload: MenuKey = { keyCode: "R", modifiers: ["control"] };
const devTools: MenuKey = { keyCode: "I", modifiers: ["control", "shift"] };
const zoomIn: MenuKey = { keyCode: "Plus", modifiers: ["control"] };
const zoomOut: MenuKey = { keyCode: "-", modifiers: ["control"] };
const zoomReset: MenuKey = { keyCode: "0", modifiers: ["control"] };

/** How long a zoom key has to answer, and how often the level is read meanwhile. */
const answerWithin = "5 seconds";
const readEvery = "50 millis";

/** Waits until the zoom level `holds`; fails with `stage` when it has not within 5 s. */
function zoomAnswers(
  ports: MenuKeysProofPorts,
  holds: (level: number) => boolean,
  stage: MenuKeysProofStage,
): Effect.Effect<void, MenuKeysProofError> {
  const poll: Effect.Effect<void> = Effect.flatMap(ports.zoomLevel(), (level) =>
    holds(level) ? Effect.void : Effect.andThen(Effect.sleep(readEvery), poll),
  );
  return Effect.timeoutOrElse(poll, {
    duration: answerWithin,
    orElse: () => Effect.fail(new MenuKeysProofError(stage)),
  });
}

/**
 * Proves the packaged menu keeps only zoom: Ctrl+R and Ctrl+Shift+I are sent first, then the
 * zoom keys. Keys are handled in the order sent, so once zoom has answered the later keys, the
 * earlier reload and DevTools keys have been handled too: no sleep proves the negative.
 */
export function menuKeysProof(ports: MenuKeysProofPorts): Effect.Effect<void, MenuKeysProofError> {
  return Effect.gen(function* () {
    const start = yield* ports.zoomLevel();
    const loadsAtStart = yield* ports.loadsStarted();
    yield* ports.sendKey(reload);
    yield* ports.sendKey(devTools);
    yield* ports.sendKey(zoomIn);
    yield* zoomAnswers(ports, (level) => level > start, "menu-zoom-in");
    yield* ports.sendKey(zoomOut);
    yield* ports.sendKey(zoomOut);
    yield* zoomAnswers(ports, (level) => level < start, "menu-zoom-out");
    yield* ports.sendKey(zoomReset);
    yield* zoomAnswers(ports, (level) => level === start, "menu-zoom-reset");
    if ((yield* ports.loadsStarted()) !== loadsAtStart)
      return yield* new MenuKeysProofError("menu-reload");
    if (yield* ports.devToolsOpen()) return yield* new MenuKeysProofError("menu-devtools");
  });
}
