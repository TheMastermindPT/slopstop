import type { HarnessMessage } from "@slopstop/protocol";
import { DesktopMessageSchema, decodeStrictResult, parseHarnessMessage } from "@slopstop/protocol";
import { Result } from "effect";

export interface HarnessMessagePort {
  close(): void;
  off(event: "message", listener: (event: Readonly<{ data: unknown }>) => void): this;
  on(event: "message", listener: (event: Readonly<{ data: unknown }>) => void): this;
  postMessage(message: unknown): void;
  start(): void;
}

export type HarnessSessionEvent =
  | Readonly<{ type: "message"; message: HarnessMessage }>
  | Readonly<{ type: "protocol-error" }>
  | Readonly<{ type: "disconnected" }>;

export type HarnessSessionSendResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code:
          | "HARNESS_SESSION_UNAVAILABLE"
          | "HARNESS_SESSION_MESSAGE_INVALID"
          | "HARNESS_SESSION_SEND_FAILED";
      }>;
    }>;

export interface HarnessSessionClient {
  send(message: unknown): HarnessSessionSendResult;
  subscribe(listener: (event: HarnessSessionEvent) => void): () => void;
}

export class HarnessSession implements HarnessSessionClient {
  readonly #listeners = new Set<(event: HarnessSessionEvent) => void>();
  #port: HarnessMessagePort | undefined;
  #delivering = false;
  readonly #queued: HarnessSessionEvent[] = [];

  readonly #receive = (event: Readonly<{ data: unknown }>): void => {
    const parsed = parseHarnessMessage(event.data);
    if (!parsed.ok) {
      this.#emit({ type: "protocol-error" });
      return;
    }
    this.#emit({ type: "message", message: parsed.value });
  };

  attach(port: HarnessMessagePort): void {
    this.detach();
    this.#port = port;
    port.on("message", this.#receive);
    port.start();
  }

  detach(): void {
    const port = this.#port;
    if (port === undefined) {
      return;
    }
    this.#port = undefined;
    port.off("message", this.#receive);
    port.close();
    this.#emit({ type: "disconnected" });
  }

  send(message: unknown): HarnessSessionSendResult {
    const parsed = decodeStrictResult(DesktopMessageSchema, message);
    if (Result.isFailure(parsed)) {
      return {
        ok: false,
        error: { code: "HARNESS_SESSION_MESSAGE_INVALID" },
      };
    }
    if (this.#port === undefined) {
      return {
        ok: false,
        error: { code: "HARNESS_SESSION_UNAVAILABLE" },
      };
    }
    try {
      this.#port.postMessage(parsed.success);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: { code: "HARNESS_SESSION_SEND_FAILED" },
      };
    }
  }

  subscribe(listener: (event: HarnessSessionEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Delivers an event to every listener. An emit made while another is delivering (a listener
   * that detaches) is queued and delivered after it, in order and in the same turn; listener
   * failures are thrown once, after the queue has drained.
   */
  #emit(event: HarnessSessionEvent): void {
    if (this.#delivering) {
      this.#queued.push(event);
      return;
    }
    this.#delivering = true;
    const failures: unknown[] = [];
    try {
      for (let next: HarnessSessionEvent | undefined = event; next; next = this.#queued.shift()) {
        this.#deliver(next, failures);
      }
      if (failures.length > 1)
        throw new AggregateError(failures, "Harness session subscribers failed.");
      if (failures.length === 1) throw failures[0];
    } finally {
      // Reset even when the failures are thrown, so a later emit is delivered at once.
      this.#delivering = false;
    }
  }

  /** Delivers one event to every listener, collecting their failures. */
  #deliver(event: HarnessSessionEvent, failures: unknown[]): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        failures.push(error);
      }
    }
  }
}
