import {
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";

export function storageErrorCode(input: { error: unknown }): string | undefined {
  if (typeof input.error !== "object" || input.error === null) return undefined;
  try {
    const code = Reflect.get(input.error, "code");
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

export function isCorruptStorageError(input: { error: unknown }): boolean {
  const code = storageErrorCode(input);
  return code === "SQLITE_CORRUPT" || code === "SQLITE_NOTADB";
}

/**
 * The one busy classification for SQLite: the database is locked by another connection
 * (`SQLITE_BUSY`) or by this one's shared cache (`SQLITE_LOCKED`). Every other code, extended
 * codes included, is not busy; callers treat it as broken.
 */
export function isSqliteBusy(error: unknown): boolean {
  const code = storageErrorCode({ error });
  return code === "SQLITE_BUSY" || code === "SQLITE_LOCKED";
}

const unavailableExactCodes = new Set(["EACCES", "EPERM", "EBUSY"]);
const unavailableSqliteCodeFamilies = [
  "SQLITE_AUTH",
  "SQLITE_BUSY",
  "SQLITE_CANTOPEN",
  "SQLITE_IOERR",
  "SQLITE_LOCKED",
  "SQLITE_PERM",
  "SQLITE_READONLY",
] as const;

function belongsToErrorCodeFamily(code: string | undefined, family: string): boolean {
  if (code === family) return true;
  return code?.startsWith(`${family}_`) === true;
}

/**
 * A typed Project Storage failure, known by its class alone, subclasses included. This is the
 * single owner of that check (`.rpiv/decisions/shared-vocab-union.md`); error codes are classified
 * by {@link isUnavailableStorageError} and {@link isCorruptStorageError} instead.
 */
export function isKnownStorageFailure(
  error: unknown,
): error is ProjectStorageBrokenError | ProjectStorageUnavailableError {
  if (error instanceof ProjectStorageBrokenError) return true;
  return error instanceof ProjectStorageUnavailableError;
}

export function isUnavailableStorageError(input: { error: unknown }): boolean {
  const code = storageErrorCode(input);
  if (unavailableExactCodes.has(code ?? "")) return true;
  return unavailableSqliteCodeFamilies.some((family) => belongsToErrorCodeFamily(code, family));
}

/**
 * A storage error worth retrying: busy or unavailable ({@link isUnavailableStorageError}, or a
 * {@link ProjectStorageUnavailableError}), directly or as the cause another error wraps it in.
 * Wider than {@link isSqliteBusy}: the staged upgrade waits out Windows file locks, access and
 * I/O failures rather than abandon.
 */
export function isRetryableStorageError(input: { error: unknown }): boolean {
  if (input.error instanceof ProjectStorageUnavailableError) return true;
  if (isUnavailableStorageError(input)) return true;
  const { error } = input;
  // An undefined cause answers false in the recursion, so it needs no guard here.
  return error instanceof Error && isRetryableStorageError({ error: error.cause });
}

/** The storage failure an error stands for: a known one as is, else unavailable or broken. */
export function storageFailureFor(input: {
  error: unknown;
  message: string;
}): ProjectStorageBrokenError | ProjectStorageUnavailableError {
  if (isKnownStorageFailure(input.error)) return input.error;
  if (isUnavailableStorageError({ error: input.error })) {
    return new ProjectStorageUnavailableError("Project Storage authority is unavailable.");
  }
  return new ProjectStorageBrokenError(input.message, { cause: input.error });
}

export function normalizeStorageError(input: { error: unknown; message: string }): never {
  throw storageFailureFor(input);
}
