import { rename } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

/** The rename and the wait between attempts, injectable so rows need no real sleeps. */
export type RenameIo = Readonly<{
  rename(from: string, to: string): Promise<void>;
  delay(ms: number): Promise<void>;
}>;

const nodeIo: RenameIo = { rename, delay: (ms) => sleep(ms) };

/** The codes Windows answers while a scanner or the indexer still holds a just-written file. */
const releaseCodes = new Set(["EPERM", "EACCES", "EBUSY"]);
const maxAttempts = 10;
const retryDelayMs = 50;

const awaitsRelease = (error: unknown) => releaseCodes.has(Reflect.get(Object(error), "code"));

/**
 * Renames `from` to `to`, retrying while Windows has not yet released the directory's new files:
 * up to 10 attempts 50 ms apart on EPERM, EACCES or EBUSY. Any other failure, and the last one,
 * is rethrown.
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
      if (attempt >= maxAttempts || !awaitsRelease(error)) throw error;
      await io.delay(retryDelayMs);
    }
  }
}
