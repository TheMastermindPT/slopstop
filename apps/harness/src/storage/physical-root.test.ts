import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  physicalRoot,
  physicalRootResult,
  StorageRootCanonicalizationError,
} from "./physical-root.js";

// A NUL byte fails argument validation before any disk access.
const uninspectableRoot = "invalid\0root";

it("answers an uninspectable root as an inspection refusal, never as the raw path", () => {
  const result = physicalRootResult(uninspectableRoot);
  expect(Result.isFailure(result)).toBe(true);
  if (Result.isSuccess(result)) return;
  expect(result.failure).toBeInstanceOf(StorageRootCanonicalizationError);
  expect(result.failure).toMatchObject({
    reason: "inspection-failed",
    message: "Root could not be inspected.",
    cause: expect.objectContaining({ code: "ERR_INVALID_ARG_VALUE" }),
  });
});

it("fails the Effect form on its typed channel with the same refusal", async () => {
  const refusal = await Effect.runPromise(Effect.flip(physicalRoot(uninspectableRoot)));
  expect(refusal).toBeInstanceOf(StorageRootCanonicalizationError);
  expect(refusal.reason).toBe("inspection-failed");
});
