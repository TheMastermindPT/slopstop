import { Data, Effect } from "effect";

/** Where the packaged menu's keys proof failed. */
export type MenuKeysProofStage =
  | "menu-zoom-in"
  | "menu-zoom-out"
  | "menu-zoom-reset"
  | "menu-reload"
  | "menu-devtools"
  | "menu-keys-unseen";

export class MenuKeysProofError extends Data.TaggedError("MenuKeysProofError")<{
  readonly message: string;
  readonly stage: MenuKeysProofStage;
}> {
  constructor(stage: MenuKeysProofStage) {
    super({ message: "Packaged menu keys proof failed.", stage });
  }
}

/** The page did not answer the token round trip: it failed, or gave no answer. */
export class PageTokenUnread extends Data.TaggedError("PageTokenUnread") {}

/** One key press, as `webContents.sendInputEvent` takes it (Electron accelerator key codes). */
export type MenuKey = Readonly<{
  keyCode: "R" | "I" | "Plus" | "-" | "0";
  modifiers: readonly ("control" | "shift")[];
}>;

/** The proof's ports to the packaged window. */
export type MenuKeysProofPorts = Readonly<{
  sendKey(key: MenuKey): Effect.Effect<void>;
  /**
   * Whether the page's marker has arrived: the page gives it when Ctrl+Shift+I comes back up, so
   * once it has been through Ctrl+R and Ctrl+Shift+I.
   */
  markerSeen(): Effect.Effect<boolean>;
  /**
   * A second round trip to the page: whether it still holds the token set when the marker was
   * armed, so whether it is the same document. Fails when the page does not answer.
   */
  samePage(): Effect.Effect<boolean, PageTokenUnread>;
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

/** How long a zoom key, or the page's marker, has to answer, and how often it is read meanwhile. */
const answerWithin = "5 seconds";
const readEvery = "50 millis";

/** Waits until `read` answers a value that `holds`: true when it did within 5 s, false when not. */
function answers<A>(
  read: () => Effect.Effect<A>,
  holds: (value: A) => boolean,
): Effect.Effect<boolean> {
  const poll: Effect.Effect<void> = Effect.flatMap(read(), (value) =>
    holds(value) ? Effect.void : Effect.andThen(Effect.sleep(readEvery), poll),
  );
  return Effect.timeoutOrElse(Effect.as(poll, true), {
    duration: answerWithin,
    orElse: () => Effect.succeed(false),
  });
}

/** Waits until the zoom level `holds`; fails with `stage` when it has not within 5 s. */
function zoomAnswers(
  ports: MenuKeysProofPorts,
  holds: (level: number) => boolean,
  stage: MenuKeysProofStage,
): Effect.Effect<void, MenuKeysProofError> {
  return Effect.flatMap(answers(ports.zoomLevel, holds), (answered) =>
    answered ? Effect.void : Effect.fail(new MenuKeysProofError(stage)),
  );
}

/**
 * The token round trip, within 5 s: the same document, another one (a reload), or no answer.
 */
function samePageAnswer(ports: MenuKeysProofPorts): Effect.Effect<"same" | "other" | "unread"> {
  return ports.samePage().pipe(
    Effect.map((same): "same" | "other" => (same ? "same" : "other")),
    Effect.timeoutOrElse({
      duration: answerWithin,
      orElse: () => Effect.succeed("unread" as const),
    }),
    Effect.catchTag("PageTokenUnread", () => Effect.succeed("unread" as const)),
  );
}

/**
 * Proves the packaged window keeps only zoom: Ctrl+R and Ctrl+Shift+I are sent first, then the
 * zoom keys. The app answers zoom before the page sees a key, so zoom answering says nothing of
 * the earlier keys: the proof then waits for the page's marker, which comes only once the page
 * has been through them. A second round trip then reads back the token set at arming: another
 * document is a reload. Only after it does the proof read the load count, then DevTools. A
 * marker or round trip that never comes, with nothing loaded or opened, is its own failure: the
 * proof could not see the page.
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
    const caughtUp = yield* answers(ports.markerSeen, (seen) => seen);
    const page = yield* samePageAnswer(ports);
    if ((yield* ports.loadsStarted()) !== loadsAtStart || page === "other")
      return yield* new MenuKeysProofError("menu-reload");
    if (yield* ports.devToolsOpen()) return yield* new MenuKeysProofError("menu-devtools");
    if (!caughtUp || page === "unread") return yield* new MenuKeysProofError("menu-keys-unseen");
  });
}
