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

export async function listRegisteredProjects(
  options: RegistrationDatabaseOptions & { applicationVersion: string },
  signal: AbortSignal,
) {
  try {
    const { records, storedProjects, hidden } = await withRegistrationDatabase(options, (client) =>
      withWriteTransaction(client, async (transaction) => {
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
        return {
          records: visibleRecords(records, hidden),
          storedProjects: stored.success,
          hidden,
        };
      }),
    );
    const owner = createProjectStorageOwner(
      createNodeProjectStorageDependencies({
        applicationStorageRoot: options.applicationStorageRoot,
        migrationResourcesRoot: options.migrationResourcesRoot,
        applicationVersion: options.applicationVersion,
        applicationDatabase: applicationDatabaseFor(options),
      }),
    );
    const projects = [];
    try {
      for (const { reservation, publication } of records) {
        if (signal.aborted) return { status: "cancelled" } as const;
        projects.push(
          decodeStrict(ProjectListEntrySchema, {
            registration: publication === undefined ? "incomplete" : "registered",
            ...(publication === undefined ? { code: "REGISTRATION_INCOMPLETE" } : {}),
            projectId: reservation.projectId,
            name: registeredName(reservation.proposal.observation.paths.worktree),
            repositoryBindingId: reservation.repositoryBindingId,
            workspaceId: reservation.workspaceId,
            repositoryLocation: await location(reservation),
            storage: await storageHealth(owner, reservation.projectId),
            access: "not-assessed",
          }),
        );
      }
      const bound = boundProjectIds(records, hidden);
      for (const { projectId } of storedProjects) {
        if (bound.has(projectId)) continue;
        if (signal.aborted) return { status: "cancelled" } as const;
        projects.push(
          decodeStrict(ProjectListEntrySchema, {
            registration: "unbound",
            projectId,
            repositoryLocation: { status: "not-bound" },
            storage: await storageHealth(owner, projectId),
            access: "not-assessed",
          }),
        );
      }
    } finally {
      await owner.stop();
    }
    if (signal.aborted) return { status: "cancelled" } as const;
    projects.sort(byProjectId);
    return decodeStrict(ProjectListSchema, { status: "listed", projects });
  } catch (error) {
    return registryFailure(error);
  }
}
