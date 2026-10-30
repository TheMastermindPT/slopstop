import { Effect, Result } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { WriterProofReportFailed, writeWriterProofReport } from "./writer-proof-report.js";

const report = "Package smoke writer processes terminal.\nPackage smoke writer proof passed.\n";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Replaces `process.stderr.write` with one that calls back with `error`. */
function stderrCallingBack(error: Error | undefined) {
  return vi.spyOn(process.stderr, "write").mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") callback(error);
    return true;
  });
}

it("writes the report and succeeds when stderr confirms it", async () => {
  const write = stderrCallingBack(undefined);
  const outcome = await Effect.runPromise(Effect.result(writeWriterProofReport(report)));
  expect(outcome).toEqual(Result.succeed(undefined));
  expect(write).toHaveBeenCalledOnce();
  expect(write.mock.calls[0]?.[0]).toBe(report);
});

it("fails with the report failure when stderr calls back with an error", async () => {
  const write = stderrCallingBack(new Error("C:\\private\\stderr closed"));
  const outcome = await Effect.runPromise(Effect.result(writeWriterProofReport(report)));
  expect(Result.isFailure(outcome)).toBe(true);
  if (!Result.isFailure(outcome)) return;
  const failure = outcome.failure;
  expect(failure).toBeInstanceOf(WriterProofReportFailed);
  expect(failure._tag).toBe("WriterProofReportFailed");
  expect(failure.message).toBe("Writer proof terminal reporting failed.");
  expect(Object.hasOwn(failure, "cause")).toBe(false);
  expect(write).toHaveBeenCalledOnce();
});
