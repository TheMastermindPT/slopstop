import type { HarnessTransport } from "../../src/index.js";

export class TestTransport implements HarnessTransport {
  readonly sent: unknown[] = [];
  #listener: ((message: unknown) => void) | undefined;

  emit(message: unknown): void {
    this.#listener?.(message);
  }

  send(message: unknown): void {
    this.sent.push(message);
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = undefined;
    };
  }
}
