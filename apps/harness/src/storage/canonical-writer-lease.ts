import { retryableAttempt } from "./retryable-attempt.js";

export type CanonicalWriterLeaseFailureCode =
  | "WRITER_LEASE_OPEN_FAILED"
  | "WRITER_LEASE_LOCK_FAILED"
  | "WRITER_LEASE_UNLOCK_FAILED"
  | "WRITER_LEASE_CLOSE_FAILED";
export interface CanonicalWriterLease {
  release(): Promise<void>;
}
export interface CanonicalWriterLeaseCleanup {
  close(): Promise<void>;
}
export type CanonicalWriterLeaseAcquisition =
  | Readonly<{ status: "acquired"; lease: CanonicalWriterLease }>
  | Readonly<{ status: "contended" }>
  | Readonly<{
      status: "broken";
      error: Error & { code: CanonicalWriterLeaseFailureCode };
      cleanup?: CanonicalWriterLeaseCleanup;
    }>;
export interface CanonicalWriterLeaseFactory {
  acquire(path: string): Promise<CanonicalWriterLeaseAcquisition>;
}
export type CanonicalWriterLeaseDependencies = Readonly<{
  platform: NodeJS.Platform;
  openLeaseFile(path: string): Promise<{ fd: number; close(): Promise<void> }>;
  tryLock(fd: number, offset: number, length: number): boolean;
  unlock(fd: number, offset: number, length: number): void;
}>;
const messages = {
  WRITER_LEASE_OPEN_FAILED: "Writer lease file could not be opened.",
  WRITER_LEASE_LOCK_FAILED: "Writer lease could not be acquired.",
  WRITER_LEASE_UNLOCK_FAILED: "Writer lease could not be unlocked.",
  WRITER_LEASE_CLOSE_FAILED: "Writer lease file could not be closed.",
} as const;

export class CanonicalWriterLeaseError extends Error {
  override readonly name = "CanonicalWriterLeaseError";
  constructor(
    readonly code: CanonicalWriterLeaseFailureCode,
    options?: ErrorOptions,
  ) {
    super(messages[code], options);
  }
}

function sharedRetry(operation: () => Promise<void>): () => Promise<void> {
  // Starts asynchronously, as before, even for a synchronously throwing operation.
  return retryableAttempt(() => Promise.resolve().then(operation));
}

type LeaseFile = Awaited<ReturnType<CanonicalWriterLeaseDependencies["openLeaseFile"]>>;

function retainedLease(
  file: LeaseFile,
  dependencies: CanonicalWriterLeaseDependencies,
): CanonicalWriterLease {
  let locked = true;
  return {
    release: sharedRetry(async () => {
      if (locked) {
        try {
          dependencies.unlock(file.fd, 0, 1);
        } catch (cause) {
          throw new CanonicalWriterLeaseError("WRITER_LEASE_UNLOCK_FAILED", { cause });
        }
        locked = false;
      }
      try {
        await file.close();
      } catch (cause) {
        throw new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED", { cause });
      }
    }),
  };
}

async function closeUnacquired(
  file: LeaseFile,
  prior?: CanonicalWriterLeaseError,
): Promise<CanonicalWriterLeaseAcquisition> {
  const cleanup = { close: sharedRetry(() => file.close()) };
  try {
    await cleanup.close();
  } catch (cause) {
    return {
      status: "broken",
      cleanup,
      error: new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED", {
        cause:
          prior === undefined
            ? cause
            : new AggregateError([prior, cause], "Writer lease acquisition and close failed."),
      }),
    };
  }
  return prior === undefined ? { status: "contended" } : { status: "broken", error: prior };
}

function errorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  return "code" in error ? error.code : undefined;
}

async function lockOpenedFile(
  file: LeaseFile,
  dependencies: CanonicalWriterLeaseDependencies,
): Promise<CanonicalWriterLeaseAcquisition> {
  let granted: boolean;
  try {
    granted = dependencies.tryLock(file.fd, 0, 1);
  } catch (cause) {
    if (dependencies.platform === "win32" && errorCode(cause) === "EBUSY")
      return closeUnacquired(file);
    return closeUnacquired(
      file,
      new CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED", { cause }),
    );
  }
  return granted
    ? { status: "acquired", lease: retainedLease(file, dependencies) }
    : closeUnacquired(file);
}

export function createCanonicalWriterLeaseFactory(
  dependencies: CanonicalWriterLeaseDependencies,
): CanonicalWriterLeaseFactory {
  return {
    acquire: async (path) => {
      let file: LeaseFile;
      try {
        file = await dependencies.openLeaseFile(path);
      } catch (cause) {
        return {
          status: "broken",
          error: new CanonicalWriterLeaseError("WRITER_LEASE_OPEN_FAILED", { cause }),
        };
      }
      return lockOpenedFile(file, dependencies);
    },
  };
}

export function createNodeCanonicalWriterLeaseFactory(): CanonicalWriterLeaseFactory {
  return createCanonicalWriterLeaseFactory({
    platform: process.platform,
    openLeaseFile: (path) => open(path, "a+", 0o600),
    tryLock,
    unlock,
  });
}

import { open } from "node:fs/promises";
import { tryLock, unlock } from "fs-native-extensions";
