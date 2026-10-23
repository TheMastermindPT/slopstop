import path from "node:path";
import { Effect } from "effect";
import { type UntypedRejection, untypedRejection } from "../effect-rejection.js";
import {
  type ApplicationDatabaseAuthority,
  createApplicationDatabaseAuthority,
} from "../storage/application-database-authority.js";
import {
  type ApplicationDatabaseMigrationFailures,
  applicationDatabaseRows,
  missingWithWitnessFailure,
} from "../storage/application-database-migration.js";
import type {
  LocalLibsqlClient,
  LocalLibsqlResultSet,
} from "../storage/local-libsql-worker-client.js";
import { requirePhysicalRoot } from "../storage/physical-root.js";
import {
  lstatIfPresent,
  requirePlainEntry,
} from "../storage/project-storage-filesystem-authority.js";
import { RegistryFault } from "./registry-failure.js";

export type RegistrationDatabaseOptions = Readonly<{
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
  failures?: ApplicationDatabaseMigrationFailures;
  // The harness's shared application database authority; standalone owners get their own.
  applicationDatabase?: ApplicationDatabaseAuthority;
}>;

export type RegistryRunner = <Result>(
  operation: (client: LocalLibsqlClient) => Promise<Result>,
) => Promise<Result>;

export type PreparedRegistryRunner = <Prepared, Result>(
  prepare: () => Promise<Prepared>,
  operation: (prepared: Prepared, reopen: RegistryRunner) => Promise<Result>,
) => Promise<Result>;

export function registryRows(result: LocalLibsqlResultSet): unknown[] {
  return applicationDatabaseRows(result);
}

// Owners pass one options object to all of their helpers, so a default authority is
// created once per standalone owner rather than once per database operation.
const standaloneAuthorities = new WeakMap<
  RegistrationDatabaseOptions,
  ApplicationDatabaseAuthority
>();

/**
 * Whether `applicationDatabasePath`, which an authority keeps under its physical root, belongs
 * to `applicationStorageRoot` in any spelling. The disk is read only when the spellings differ.
 */
function sameInstallation(applicationStorageRoot: string, applicationDatabasePath: string) {
  const databaseUnder = (root: string) => path.join(root, "application.db");
  if (databaseUnder(path.resolve(applicationStorageRoot)) === applicationDatabasePath) return true;
  return databaseUnder(requirePhysicalRoot(applicationStorageRoot)) === applicationDatabasePath;
}

export function applicationDatabaseFor(
  options: RegistrationDatabaseOptions,
): ApplicationDatabaseAuthority {
  const injected = options.applicationDatabase;
  if (injected !== undefined) {
    if (!sameInstallation(options.applicationStorageRoot, injected.applicationDatabasePath))
      throw new Error("Application database authority belongs to another installation root.");
    return injected;
  }
  const existing = standaloneAuthorities.get(options);
  if (existing !== undefined) return existing;
  const created = createApplicationDatabaseAuthority({
    applicationStorageRoot: options.applicationStorageRoot,
    migrationResourcesRoot: options.migrationResourcesRoot,
    failures: options.failures,
  });
  standaloneAuthorities.set(options, created);
  return created;
}

/**
 * Stops the standalone authority kept for `options`, with its bounded close, then releases its
 * entry whatever the outcome, so the next owner of `options` gets a fresh authority. During
 * the stop, owners still get the stopped one, never a second authority over the same file.
 * It never creates one. An injected authority is the harness's and is never in the map, so it
 * is left alone.
 */
export function stopStandaloneAuthority(
  options: RegistrationDatabaseOptions,
): Effect.Effect<void, UntypedRejection> {
  return Effect.suspend(() => {
    const authority = standaloneAuthorities.get(options);
    if (authority === undefined) return Effect.void;
    return Effect.ensuring(
      Effect.tryPromise({ try: () => authority.stop(), catch: untypedRejection }),
      Effect.sync(() => standaloneAuthorities.delete(options)),
    );
  });
}

type RegistryOpenMode = "initialize-or-open" | "existing-only";

// Plain-entry checks only: whether a missing database is created, refused as a witness, or
// waited for while another caller creates it is the application database authority's call.
async function requirePlainEntries(options: RegistrationDatabaseOptions): Promise<void> {
  const root = path.resolve(options.applicationStorageRoot);
  const databasePath = path.join(root, "application.db");
  if ((await lstatIfPresent({ targetPath: root })) !== undefined) {
    await requirePlainEntry({
      entryPath: root,
      kind: "directory",
      message: "Registration root is invalid.",
    });
  }
  if ((await lstatIfPresent({ targetPath: databasePath })) !== undefined) {
    await requirePlainEntry({
      entryPath: databasePath,
      kind: "file",
      message: "Registration registry is invalid.",
    });
  }
}

export async function withRegistrationDatabase<Result>(
  options: RegistrationDatabaseOptions,
  operation: (client: LocalLibsqlClient) => Promise<Result>,
  mode: RegistryOpenMode = "initialize-or-open",
): Promise<Result> {
  const authority = applicationDatabaseFor(options);
  await requirePlainEntries(options);
  const client = await authority.openCurrent({ createIfMissing: mode === "initialize-or-open" });
  if (client === undefined) {
    throw new RegistryFault(missingWithWitnessFailure);
  }
  try {
    return await operation(client);
  } finally {
    await client.close();
  }
}
