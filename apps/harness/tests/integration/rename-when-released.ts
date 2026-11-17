import { rename } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { isHeldFileError } from "../../src/storage/project-storage-node-errors.js";

/** The rename and the wait between attempts, injectable so rows need no real sleeps. */
export type RenameIo = Readonly<{
  rename(from: string, to: string): Promise<void>;
  delay(ms: number): Promise<void>;
}>;

const nodeIo: RenameIo = { rename, delay: (ms) => sleep(ms) };

const maxAttempts = 10;
const retryDelayMs = 50;

/**
 * Renames `from` to `to`, retrying while Windows has not yet released the directory's new files:
 * up to 10 attempts 50 ms apart while the failure is a held file (`isHeldFileError`, the owner of
 * those codes). Any other failure, and the last one, is rethrown.
 */
export async function renameWhenReleased(
  from: string,
  to: string,
  io: RenameIo = nodeIo,
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await io.rename(from, to);
      return;
    } catch (error) {
      if (attempt >= maxAttempts || !isHeldFileError(error)) throw error;
      await io.delay(retryDelayMs);
    }
  }
}
