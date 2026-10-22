import { randomUUID } from "node:crypto";
import {
  createProjectListResultEvent,
  createReadyEvent,
  createSystemFailureEvent,
  type DesktopMessage,
  DesktopMessageSchema,
  decodeStrict,
  type HarnessMessage,
  MessageIdSchema,
} from "@slopstop/protocol";
import type {
  HarnessSessionClient,
  HarnessSessionEvent,
  HarnessSessionSendResult,
} from "./harness-session.js";

/** A UUID message id; `n` makes it stable across a test. */
export function messageId(n: number): string {
  return decodeStrict(MessageIdSchema, `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
}

/** Event metadata for a reply to `causationId` (or an uncorrelated event, with `null`). */
export function replyMetadata(causationId: string | null) {
  return { messageId: randomUUID(), sentAt: "2026-10-19T12:00:00.000Z", sequence: 1, causationId };
}

/** A `project.list.result` that answers `causationId`. */
export function listReply(causationId: string | null): HarnessMessage {
  return createProjectListResultEvent(replyMetadata(causationId), {
    status: "listed",
    projects: [],
    hiddenCount: 0,
  });
}

/** A `system.failure` (always uncorrelated) with `text` as its payload message. */
export function systemFailure(text: string): HarnessMessage {
  return createSystemFailureEvent(
    { messageId: randomUUID(), sentAt: "2026-10-19T12:00:00.000Z", sequence: 1, causationId: null },
    { code: "HARNESS_INTERNAL_FAILURE", message: text, retryable: false },
  );
}

/**
 * A reply of `event` to `causationId` whose payload belongs to another event, so it cannot be
 * decoded: a list result, or a readiness payload for `project.list.result` itself.
 */
export function undecodableReply(
  event: HarnessMessage["event"],
  causationId: string | null,
): HarnessMessage {
  const carrier =
    event === "project.list.result"
      ? createReadyEvent(replyMetadata(causationId), "0.0.0")
      : listReply(causationId);
  return Object.assign(carrier, { event });
}

type Listener = (event: HarnessSessionEvent) => void;

/**
 * A scripted harness session for the request core and the bridges (s7 fixture). It records the
 * commands sent, can throw or refuse a send, can answer synchronously inside `send`, can throw on
 * the n-th subscribe or on one chosen subscription's unsubscribe, and emits any event on demand.
 */
export class ScriptedHarnessSession implements HarnessSessionClient {
  readonly sent: DesktopMessage[] = [];
  readonly #listeners = new Map<number, Listener>();
  sendResult: HarnessSessionSendResult = { ok: true };
  sendError: unknown;
  /** Runs inside `send`, after the command was recorded (a reply during send). */
  duringSend: ((command: DesktopMessage) => void) | undefined;
  /** The 1-based subscribe call that throws `subscribeError`. */
  failSubscribe: number | undefined;
  subscribeError: unknown = new Error("private subscribe failure");
  /** The 1-based subscription whose unsubscribe throws `unsubscribeError`. */
  failUnsubscribe: number | undefined;
  unsubscribeError: unknown = new Error("private unsubscribe failure");
  subscribeCalls = 0;
  unsubscribeCalls = 0;

  /** The subscriptions still open. */
  get subscriptions(): number {
    return this.#listeners.size;
  }

  emit(event: HarnessSessionEvent): void {
    for (const listener of [...this.#listeners.values()]) listener(event);
  }

  message(message: HarnessMessage): void {
    this.emit({ type: "message", message });
  }

  /** The id of the last command sent. */
  lastId(): string {
    const command = this.sent.at(-1);
    if (command === undefined) throw new Error("No command sent");
    return command.messageId;
  }

  send(message: unknown): HarnessSessionSendResult {
    if (this.sendError !== undefined) throw this.sendError;
    if (!this.sendResult.ok) return this.sendResult;
    const command = decodeStrict(DesktopMessageSchema, message);
    this.sent.push(command);
    this.duringSend?.(command);
    return this.sendResult;
  }

  subscribe(listener: Listener): () => void {
    this.subscribeCalls += 1;
    const subscription = this.subscribeCalls;
    if (subscription === this.failSubscribe) throw this.subscribeError;
    this.#listeners.set(subscription, listener);
    return () => {
      this.unsubscribeCalls += 1;
      this.#listeners.delete(subscription);
      if (subscription === this.failUnsubscribe) throw this.unsubscribeError;
    };
  }
}

/** Records a promise's settlement, so a pending request is observable without a timeout. */
export function watch<T>(promise: Promise<T>) {
  const outcome: { settled: boolean; value?: T } = { settled: false };
  void promise.then((value) => {
    outcome.settled = true;
    outcome.value = value;
  });
  return outcome;
}

/** Lets every queued microtask run (a bounded flush, never a timer). */
export async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

/**
 * A recording harness session: it records accepted commands, can throw on send or on unsubscribe,
 * and delivers an event to every listener before it rethrows the first failure, as the real
 * session does.
 */
export class RecordingHarnessSession implements HarnessSessionClient {
  readonly sent: DesktopMessage[] = [];
  readonly #listeners = new Set<Listener>();
  sendResult: HarnessSessionSendResult = { ok: true };
  sendError: unknown;
  unsubscribeError: unknown;
  unsubscribeCalls = 0;

  get listenerCount(): number {
    return this.#listeners.size;
  }

  emit(event: HarnessSessionEvent): void {
    const failures: unknown[] = [];
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw failures[0];
  }

  send(message: unknown): HarnessSessionSendResult {
    if (this.sendError !== undefined) throw this.sendError;
    if (this.sendResult.ok) this.sent.push(decodeStrict(DesktopMessageSchema, message));
    return this.sendResult;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.unsubscribeCalls += 1;
      this.#listeners.delete(listener);
      if (this.unsubscribeError !== undefined) throw this.unsubscribeError;
    };
  }
}
