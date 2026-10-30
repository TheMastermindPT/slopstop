import { Writable } from "node:stream";
import type { HarnessRequestBoundary } from "@slopstop/protocol";
import type { HarnessRequestDiagnostics } from "../../src/harness-request-diagnostics.js";

/** Request diagnostics for runtimes and applications whose request failures no test reads. */
export const silentRequestDiagnostics: HarnessRequestDiagnostics = {
  requestFailed: () => undefined,
};

/** One reported request failure, with the value as the boundary received it. */
export type RecordedRequestFailure = Readonly<{
  boundary: HarnessRequestBoundary;
  failure: unknown;
}>;

/** Request diagnostics that record every reported failure in order, keeping each value as is. */
export function recordingRequestDiagnostics() {
  const calls: RecordedRequestFailure[] = [];
  const diagnostics: HarnessRequestDiagnostics = {
    requestFailed: (boundary, failure) => {
      calls.push({ boundary, failure });
    },
  };
  return { calls, diagnostics };
}

/** A log destination that keeps every line the logger writes. */
export function memoryLogDestination() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(
        ...chunk
          .toString("utf8")
          .split("\n")
          .filter((line) => line !== ""),
      );
      done();
    },
  });
  return { lines, stream };
}
