import { storageErrorCode } from "./project-storage-node-errors.js";

/**
 * The one busy classification for SQLite: the database is locked by another connection
 * (`SQLITE_BUSY`) or by this one's shared cache (`SQLITE_LOCKED`). Every other code, extended
 * codes included, is not busy; callers treat it as broken.
 */
export function isSqliteBusy(error: unknown): boolean {
  const code = storageErrorCode({ error });
  return code === "SQLITE_BUSY" || code === "SQLITE_LOCKED";
}
