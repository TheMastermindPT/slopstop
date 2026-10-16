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

function isKnownStorageError(
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

/** Busy-class storage errors, directly or as the cause another error wraps them in. */
export function isBusyStorageError(input: { error: unknown }): boolean {
  if (input.error instanceof ProjectStorageUnavailableError) return true;
  if (isUnavailableStorageError(input)) return true;
  const { error } = input;
  return (
    error instanceof Error &&
    error.cause !== undefined &&
    isBusyStorageError({ error: error.cause })
  );
}

/** The storage failure an error stands for: a known one as is, else unavailable or broken. */
export function storageFailureFor(input: {
  error: unknown;
  message: string;
}): ProjectStorageBrokenError | ProjectStorageUnavailableError {
  if (isKnownStorageError(input.error)) return input.error;
  if (isUnavailableStorageError({ error: input.error })) {
    return new ProjectStorageUnavailableError("Project Storage authority is unavailable.");
  }
  return new ProjectStorageBrokenError(input.message, { cause: input.error });
}

export function normalizeStorageError(input: { error: unknown; message: string }): never {
  throw storageFailureFor(input);
}
