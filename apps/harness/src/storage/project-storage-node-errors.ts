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

function rethrowKnownStorageError(error: unknown): void {
  if (error instanceof ProjectStorageBrokenError) throw error;
  if (error instanceof ProjectStorageUnavailableError) throw error;
}

export function isUnavailableStorageError(input: { error: unknown }): boolean {
  const code = storageErrorCode(input);
  if (unavailableExactCodes.has(code ?? "")) return true;
  return unavailableSqliteCodeFamilies.some((family) => belongsToErrorCodeFamily(code, family));
}

export function normalizeStorageError(input: { error: unknown; message: string }): never {
  rethrowKnownStorageError(input.error);
  if (isUnavailableStorageError({ error: input.error })) {
    throw new ProjectStorageUnavailableError("Project Storage authority is unavailable.");
  }
  throw new ProjectStorageBrokenError(input.message, { cause: input.error });
}
