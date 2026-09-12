import type { MessagePort } from "node:worker_threads";
import type { WriterProofPort } from "./canonical-writer-package-smoke-entry.js";

export function portAdapter(port: MessagePort): WriterProofPort {
  return {
    start: () => port.start(),
    close: () => port.close(),
    send: (message) => port.postMessage(message),
    subscribe: (receive, closed) => {
      port.on("message", receive);
      port.on("close", closed);
      port.on("messageerror", closed);
    },
  };
}

export function observeFixturePort(port: MessagePort) {
  const results: unknown[] = [];
  const exits: number[] = [];
  let completeExit = () => {};
  const terminated = new Promise<void>((resolve) => {
    completeExit = resolve;
  });
  port.on("message", (value: unknown) => results.push(value));

  function send(message: unknown): Promise<void> {
    if (exits.length > 0) return Promise.reject(new Error("Fixture already terminated."));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        port.off("message", received);
        port.off("close", closed);
        port.off("messageerror", closed);
        if (error === undefined) resolve();
        else reject(error);
      };
      const received = () => finish();
      const closed = () => finish(new Error("Fixture terminated before its response."));
      port.once("message", received);
      port.once("close", closed);
      port.once("messageerror", closed);
      void terminated.then(closed);
      try {
        port.postMessage(message);
      } catch (error) {
        finish(error);
      }
    });
  }

  return {
    results,
    exits,
    terminated,
    send,
    exited: (code: number) => {
      exits.push(code);
      completeExit();
    },
  };
}
