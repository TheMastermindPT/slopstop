import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { normalizeStorageError as normalizeNodeStorageError } from "./project-storage-node-errors.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";

export type LocalClient = LocalLibsqlClient;
export type LocalTransaction = LocalLibsqlTransaction;
export type AllocatedCreation = Parameters<
  ProjectStorageStoreDependencies["registry"]["declareStaging"]
>[0];
export type ProjectStorageGenerationPaths = Parameters<
  ProjectStorageStoreDependencies["databases"]["verifySealed"]
>[0];

export function createLocalClient(
  databasePath: string,
  pool: "application" | "generation",
): LocalClient {
  return createWorkerLocalLibsqlClient(databasePath, pool);
}

export function normalizeStorageError(error: unknown, message: string): never {
  normalizeNodeStorageError({ error, message });
}

export function exactlyOne<Output>(rows: readonly Output[], message: string): Output {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw new ProjectStorageBrokenError(message);
  }
  return row;
}

export function assertRowsAffected(rowsAffected: number, message: string): void {
  if (rowsAffected !== 1) throw new ProjectStorageBrokenError(message);
}
