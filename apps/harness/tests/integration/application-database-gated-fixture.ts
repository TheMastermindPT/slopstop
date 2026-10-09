import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApplicationDatabaseAuthority } from "../../src/storage/application-database-authority.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";

export const migrationResourcesRoot = path.resolve(import.meta.dirname, "../../drizzle");

/**
 * An authority on a fresh root whose first client is created only after `release`, holding
 * the first initializer between its missing-file policy and the file's creation. With
 * `firstFailure`, that client's first transaction fails with it after the file exists.
 */
export async function createGatedFirstClientAuthority(prefix: string, firstFailure?: Error) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reachOpen: () => void = () => undefined;
  const firstOpen = new Promise<void>((resolve) => {
    reachOpen = resolve;
  });
  let opens = 0;
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot,
    openClient: (databasePath) => {
      opens += 1;
      if (opens !== 1) return createWorkerLocalLibsqlClient(databasePath, "application");
      reachOpen();
      const real = gate.then(() => createWorkerLocalLibsqlClient(databasePath, "application"));
      return {
        execute: async (statement, args) => (await real).execute(statement, args),
        transaction: async (mode) => {
          const client = await real;
          if (firstFailure !== undefined) throw firstFailure;
          return client.transaction(mode);
        },
        close: async () => (await real).close(),
      };
    },
  });
  return { root, authority, firstOpen, release: () => release(), opens: () => opens };
}
