import {
  type DesktopMessage,
  decodeStrictResult,
  type HarnessFailureCode,
  type HarnessMessage,
} from "@slopstop/protocol";
import { Deferred, Effect, Result, type Schema } from "effect";
import type { HarnessSessionClient, HarnessSessionSendResult } from "./harness-session.js";

type SendErrorCode = Extract<HarnessSessionSendResult, { ok: false }>["error"]["code"];

/**
 * Why a harness request ended without a payload. It is a value the bridges map into their
 * envelopes, never thrown.
 */
export type ProjectRequestFault =
  | Readonly<{ kind: "transport" }>
  | Readonly<{
      kind: "protocol";
      reason: "invalid-message" | "uncorrelated" | "system-failure" | "undecodable";
    }>
  | Readonly<{ kind: "harness"; code: HarnessFailureCode; message: string }>
  | Readonly<{ kind: "send"; code: SendErrorCode }>
  | Readonly<{ kind: "unsent" }>
  | Readonly<{ kind: "stopped" }>
  | Readonly<{
      kind: "desktop";
      reason: "invalid-command" | "identity-collision" | "mismatched-event" | "mismatched-echo";
    }>;

/** The `{ createId, now }` clock a bridge stamps its commands with. */
export type Clock = Readonly<{ createId(): string; now(): string }>;

/**
 * The fault texts that name no bridge, shared by the Project Storage and workspace bridges. The
 * bridge-specific texts (uncorrelated, undecodable, mismatched, stopped) stay with each bridge.
 */
export const bridgeNeutralText = {
  transport: "Harness session disconnected.",
  protocol: {
    "invalid-message": "Harness session received an invalid protocol message.",
    "system-failure": "Harness reported a failure.",
  },
  desktop: { "identity-collision": "Harness request identity collided." },
} as const;

/** The bridge a request belongs to, so a bridge stop settles only its own requests. */
type HarnessBridgeTag = "project-entry" | "project-storage" | "workspace";

type Entry = Readonly<{
  bridge: HarnessBridgeTag;
  expected: HarnessMessage["event"];
  done: Deferred.Deferred<unknown, ProjectRequestFault>;
}>;

export interface HarnessRequestCore {
  /** Sends one command and waits for its correlated reply payload. */
  request(
    bridge: HarnessBridgeTag,
    createCommand: () => DesktopMessage,
    expected: HarnessMessage["event"],
  ): Effect.Effect<unknown, ProjectRequestFault>;
  /** Settles every pending request of one bridge with `fault`. */
  failBridge(bridge: HarnessBridgeTag, fault: ProjectRequestFault): void;
  /** Settles every pending request with `fault`. */
  failAll(fault: ProjectRequestFault): void;
  /** Observes the session's non-reply messages; returns the unsubscribe. */
  observe(listener: (message: HarnessMessage) => void): () => void;
  /** Ends the core's one session subscription. */
  unsubscribe(): void;
}

/** Only `*.result` events and `request.failure` answer a request. */
function isReply(event: HarnessMessage["event"]): boolean {
  return event === "request.failure" || event.endsWith(".result");
}

export function makeHarnessRequestCore(session: HarnessSessionClient): HarnessRequestCore {
  const entries = new Map<string, Entry>();
  const observers = new Set<(message: HarnessMessage) => void>();
  const settle = (id: string, completion: Effect.Effect<unknown, ProjectRequestFault>) => {
    const entry = entries.get(id);
    if (entry === undefined) return;
    entries.delete(id);
    Deferred.doneUnsafe(entry.done, completion);
  };
  const failWhere = (match: (entry: Entry) => boolean, fault: ProjectRequestFault) => {
    for (const [id, entry] of [...entries]) if (match(entry)) settle(id, Effect.fail(fault));
  };
  const failAll = (fault: ProjectRequestFault) => failWhere(() => true, fault);
  const receive = (message: HarnessMessage) => {
    if (message.event === "system.failure") {
      failAll({ kind: "protocol", reason: "system-failure" });
      return;
    }
    if (!isReply(message.event)) {
      for (const observer of [...observers]) observer(message);
      return;
    }
    if (message.causationId === null) {
      failAll({ kind: "protocol", reason: "uncorrelated" });
      return;
    }
    if (message.event === "request.failure") {
      const { code, message: text } = message.payload;
      settle(message.causationId, Effect.fail({ kind: "harness", code, message: text }));
      return;
    }
    const entry = entries.get(message.causationId);
    if (entry === undefined) return;
    settle(
      message.causationId,
      entry.expected === message.event
        ? Effect.succeed(message.payload)
        : Effect.fail({ kind: "desktop", reason: "mismatched-event" }),
    );
  };
  // A throwing send is refused like a failed post: the request settles and frees its id.
  const sendGuarded = (command: DesktopMessage): HarnessSessionSendResult => {
    try {
      return session.send(command);
    } catch {
      return { ok: false, error: { code: "HARNESS_SESSION_SEND_FAILED" } };
    }
  };
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "disconnected") failAll({ kind: "transport" });
    else if (event.type === "protocol-error")
      failAll({ kind: "protocol", reason: "invalid-message" });
    else receive(event.message);
  });
  return {
    request: (bridge, createCommand, expected) =>
      Effect.suspend(() => {
        let command: DesktopMessage;
        try {
          command = createCommand();
        } catch {
          return Effect.fail({ kind: "desktop", reason: "invalid-command" } as const);
        }
        const id = command.messageId;
        if (entries.has(id))
          return Effect.fail({ kind: "desktop", reason: "identity-collision" } as const);
        const done = Deferred.makeUnsafe<unknown, ProjectRequestFault>();
        entries.set(id, { bridge, expected, done });
        const sent = sendGuarded(command);
        if (!sent.ok) settle(id, Effect.fail({ kind: "send", code: sent.error.code }));
        // An interrupted request frees its id, so the same id can be sent again.
        return Effect.onInterrupt(Deferred.await(done), () =>
          Effect.sync(() => {
            if (entries.get(id)?.done === done) entries.delete(id);
          }),
        );
      }),
    failBridge: (bridge, fault) => failWhere((entry) => entry.bridge === bridge, fault),
    failAll,
    observe: (observer) => {
      observers.add(observer);
      return () => {
        observers.delete(observer);
      };
    },
    unsubscribe,
  };
}

/** Decodes a reply payload; a payload that does not decode is a `protocol` `undecodable` fault. */
export function decodeReply<A>(
  schema: Schema.Decoder<A>,
  value: unknown,
): Effect.Effect<A, ProjectRequestFault> {
  const decoded = decodeStrictResult(schema, value);
  return Result.isSuccess(decoded)
    ? Effect.succeed(decoded.success)
    : Effect.fail({ kind: "protocol", reason: "undecodable" });
}

/**
 * Runs a bridge request to its envelope: a fault becomes `onFault`'s answer, so the promise never
 * rejects for an expected failure.
 *
 * Temporary Promise facade (P-S7-1 (b)): remove when C2 streaming moves the IPC edge and the
 * package-smoke callers onto the runtime.
 */
export function answerRequest<A>(
  request: Effect.Effect<A, ProjectRequestFault>,
  onFault: (fault: ProjectRequestFault) => A,
): Promise<A> {
  return Effect.runPromise(request.pipe(Effect.catch((fault) => Effect.succeed(onFault(fault)))));
}
