import { expect, it, vi } from "vitest";
import { createHarnessFatalHandlers } from "./process-fatal-diagnostics.js";

it("reports process fatal values as metadata only", () => {
  const fatal = vi.fn();
  const exit = vi.fn();
  const handlers = createHarnessFatalHandlers({ fatal, exit });

  handlers.uncaughtException(new Error("private C:\\repo\\source.ts"));
  handlers.unhandledRejection({ token: "secret" });

  expect(fatal).toHaveBeenNthCalledWith(
    1,
    { code: "HARNESS_UNCAUGHT_EXCEPTION", valueKind: "error" },
    "Harness encountered an uncaught exception.",
  );
  expect(fatal).toHaveBeenNthCalledWith(
    2,
    { code: "HARNESS_UNHANDLED_REJECTION", valueKind: "object" },
    "Harness encountered an unhandled rejection.",
  );
  expect(exit.mock.calls).toEqual([[1], [1]]);
  const serialized = JSON.stringify(fatal.mock.calls);
  expect(serialized).not.toContain("private");
  expect(serialized).not.toContain("source.ts");
  expect(serialized).not.toContain("token");
  expect(serialized).not.toContain("secret");
});

it("classifies null separately from objects", () => {
  const fatal = vi.fn();
  const exit = vi.fn();
  const handlers = createHarnessFatalHandlers({ fatal, exit });

  handlers.unhandledRejection(null);

  expect(fatal).toHaveBeenCalledWith(
    { code: "HARNESS_UNHANDLED_REJECTION", valueKind: "null" },
    "Harness encountered an unhandled rejection.",
  );
  expect(exit).toHaveBeenCalledWith(1);
});
