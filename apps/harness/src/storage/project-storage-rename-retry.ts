import { Effect, Schedule } from "effect";
import { unwrapRejection } from "../effect-rejection.js";
import { isHeldFileError } from "./project-storage-node-errors.js";

/**
 * Retries after the first attempt, and the wait before each: 10 attempts 50 ms apart, at most
 * 450 ms of waiting. Provisional (#122): these are the test helper's numbers (commit `8990120`,
 * 2026-10-30); nobody has measured how long Windows holds a just-written folder.
 */
const heldRenameRetries = 9;
const heldRenameSpacing = "50 millis";

/**
 * Runs `rename`, and on Windows runs it again while its failure is a held file
 * ({@link isHeldFileError}), within the bound above. Any other failure, any failure on another
 * platform, and the last held failure are returned unchanged. The waits are Effect sleeps, so an
 * interruption ends them at once.
 */
export function renameWhenReleased<E, R>(
  rename: Effect.Effect<void, E, R>,
  platform: NodeJS.Platform,
): Effect.Effect<void, E, R> {
  if (platform !== "win32") return rename;
  return rename.pipe(
    Effect.retry({
      times: heldRenameRetries,
      while: (failure) => isHeldFileError(unwrapRejection(failure)),
      schedule: Schedule.spaced(heldRenameSpacing),
    }),
  );
}
