import {
  decodeStrict,
  decodeStrictResult,
  ProjectIdSchema,
  ProjectListEntrySchema,
  ProjectListSchema,
  ProjectStorageCloseResultSchema,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { Effect, Result, Schema } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../storage/project-storage-store.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { observeRepositoryDirectory } from "../storage/repository-identity-observer.js";
import { readHiddenProjectIds } from "./list-visibility.js";
import { samePhysicalIdentity } from "./physical-identity.js";
import { registeredName } from "./registered-name.js";
import {
  type Reservation,
  readProjectRegistrationRecords,
} from "./registration-confirmation-store.js";
import {
  applicationDatabaseFor,
  type RegistrationDatabaseOptions,
  registryRows,
  withRegistrationDatabase,
} from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";

const storedProjectRowsSchema = Schema.Array(Schema.Struct({ projectId: ProjectIdSchema }));

// A removed Project leaves the list only once published; incomplete ones stay.
function visibleRecords(
  records: Awaited<ReturnType<typeof readProjectRegistrationRecords>>,
  hidden: ReadonlySet<string>,
) {
  return records.filter(
    ({ reservation, publication }) =>
      publication === undefined || !hidden.has(reservation.projectId),
  );
}

function byProjectId(a: Readonly<{ projectId: string }>, b: Readonly<{ projectId: string }>) {
  if (a.projectId === b.projectId) return 0;
  return a.projectId < b.projectId ? -1 : 1;
}

// Storage with a reservation, shown or removed, is bound; only the rest lists as unbound.
function boundProjectIds(
  records: ReadonlyArray<Readonly<{ reservation: Reservation }>>,
  hidden: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set([...hidden, ...records.map(({ reservation }) => reservation.projectId)]);
}

async function location(reservation: Reservation) {
  const result = await observeRepositoryDirectory(
    reservation.proposal.authority.repositoryDirectory,
  );
  if (result.status === "observed")
    return samePhysicalIdentity(result.key, reservation.proposal.observation.physical.worktree)
      ? { status: "present" as const }
      : { status: "changed" as const, code: "REPOSITORY_IDENTITY_CHANGED" as const };
  if (result.status === "unavailable" || result.status === "broken") return result;
  return result.code === "REPOSITORY_NOT_FOUND"
    ? { status: "missing" as const, code: result.code }
    : { status: "invalid" as const, code: result.code };
}

async function inspectStorageHealth(
  owner: ReturnType<typeof createProjectStorageOwner>,
  projectId: Reservation["projectId"],
) {
  const opened = await owner.open({ projectId });
  if (opened.status === "broken")
    return { status: "broken" as const, code: "PROJECT_STORAGE_OWNER_FAILED" as const };
  if (opened.status === "unavailable")
    return { status: "unavailable" as const, code: "PROJECT_STORAGE_UNAVAILABLE" as const };
  const result = decodeStrict(ProjectStorageOpenResultSchema, opened.result);
  if (result.status === "opened")
    return {
      status: "healthy" as const,
      storageId: result.identity.storageId,
      generationId: result.identity.generationId,
    };
  if (result.status === "safe-mode")
    return {
      status: "safe-mode" as const,
      storageId: result.identity.storageId,
      generationId: result.identity.generationId,
      canonical: result.canonicalHealth.status,
      runtime: result.runtimeHealth.status,
    };
  if (result.status === "not-registered") return { status: "not-registered" as const };
  return { status: result.status, code: result.diagnostic.code };
}

async function storageHealth(
  owner: ReturnType<typeof createProjectStorageOwner>,
  projectId: Reservation["projectId"],
) {
  const inspected = await inspectStorageHealth(owner, projectId)
    .then((value) => ({ kind: "read" as const, value }))
    .catch((error: unknown) => ({ kind: "failed" as const, error }));
  const closed = await owner.close({ projectId });
  if (
    closed.status !== "ready" ||
    decodeStrict(ProjectStorageCloseResultSchema, closed.result).status !== "closed"
  )
    throw new Error("Project listing storage release failed.");
  if (inspected.kind === "failed") throw inspected.error;
  return inspected.value;
}

type StorageOwner = ReturnType<typeof createProjectStorageOwner>;
type Entry = typeof ProjectListEntrySchema.Type;

async function readListingState(transaction: LocalLibsqlTransaction) {
  const records = await readProjectRegistrationRecords(transaction);
  const hidden = await Effect.runPromise(readHiddenProjectIds(transaction));
  const stored = decodeStrictResult(
    storedProjectRowsSchema,
    registryRows(
      await transaction.execute(
        "SELECT project_id AS projectId FROM storage_registrations ORDER BY project_id",
      ),
    ),
  );
  if (Result.isFailure(stored))
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  return { records: visibleRecords(records, hidden), storedProjects: stored.success, hidden };
}

type ListingState = Awaited<ReturnType<typeof readListingState>>;

async function registeredEntry(
  { reservation, publication }: ListingState["records"][number],
  owner: StorageOwner,
) {
  return decodeStrict(ProjectListEntrySchema, {
    registration: publication === undefined ? "incomplete" : "registered",
    ...(publication === undefined ? { code: "REGISTRATION_INCOMPLETE" } : {}),
    projectId: reservation.projectId,
    name: registeredName(reservation.proposal.observation.paths.worktree),
    repositoryBindingId: reservation.repositoryBindingId,
    workspaceId: reservation.workspaceId,
    repositoryLocation: await location(reservation),
    storage: await storageHealth(owner, reservation.projectId),
    access: "not-assessed",
  });
}

async function unboundEntry(projectId: Reservation["projectId"], owner: StorageOwner) {
  return decodeStrict(ProjectListEntrySchema, {
    registration: "unbound",
    projectId,
    repositoryLocation: { status: "not-bound" },
    storage: await storageHealth(owner, projectId),
    access: "not-assessed",
  });
}

// Entries in listing order, one Storage health check at a time; undefined once cancelled.
async function collectEntries(state: ListingState, owner: StorageOwner, signal: AbortSignal) {
  const bound = boundProjectIds(state.records, state.hidden);
  const pending = [
    ...state.records.map((record) => () => registeredEntry(record, owner)),
    ...state.storedProjects
      .filter(({ projectId }) => !bound.has(projectId))
      .map(
        ({ projectId }) =>
          () =>
            unboundEntry(projectId, owner),
      ),
  ];
  const entries: Entry[] = [];
  for (const next of pending) {
    if (signal.aborted) return undefined;
    entries.push(await next());
  }
  return entries;
}

function listingStorageOwner(
  options: RegistrationDatabaseOptions & { applicationVersion: string },
) {
  return createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: options.applicationStorageRoot,
      migrationResourcesRoot: options.migrationResourcesRoot,
      applicationVersion: options.applicationVersion,
      applicationDatabase: applicationDatabaseFor(options),
    }),
  );
}

export async function listRegisteredProjects(
  options: RegistrationDatabaseOptions & { applicationVersion: string },
  signal: AbortSignal,
) {
  try {
    const state = await withRegistrationDatabase(options, (client) =>
      withWriteTransaction(client, readListingState),
    );
    const owner = listingStorageOwner(options);
    let entries: Entry[] | undefined;
    try {
      entries = await collectEntries(state, owner, signal);
    } finally {
      await owner.stop();
    }
    if (entries === undefined || signal.aborted) return { status: "cancelled" } as const;
    return decodeStrict(ProjectListSchema, {
      status: "listed",
      projects: entries.sort(byProjectId),
    });
  } catch (error) {
    return registryFailure(error);
  }
}
