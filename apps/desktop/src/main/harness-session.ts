import type { HarnessMessage } from "@slopstop/protocol";
import { DesktopMessageSchema, parseHarnessMessage } from "@slopstop/protocol";

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
    const parsed = DesktopMessageSchema.safeParse(message);
    if (!parsed.success) {
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
      this.#port.postMessage(parsed.data);
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

  #emit(event: HarnessSessionEvent): void {
    const failures: unknown[] = [];
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Harness session subscribers failed.");
  }
}
