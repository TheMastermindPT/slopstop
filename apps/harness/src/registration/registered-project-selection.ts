import {
  type CanonicalProjectActivationRequest,
  type CanonicalProjectActivationResult,
  CanonicalProjectActivationResultSchema,
  decodeStrict,
} from "@slopstop/protocol";
import type { ProjectStorageActivationSession } from "../project-storage-application.js";
import { createWorkerLocalLibsqlClient } from "../storage/local-libsql-worker-client.js";
import { requirePlainEntry } from "../storage/project-storage-filesystem-authority.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { createIdentityQueryControl } from "./identity-query-control.js";
import { samePhysicalIdentity } from "./physical-identity.js";
import { readProjectRegistrationRecords } from "./registration-confirmation-store.js";
import { type RegistrationDatabaseOptions, withRegistrationDatabase } from "./registry-database.js";
import { registryFailure } from "./registry-failure.js";
import { discoverSelectedPhysical } from "./repository-physical-observation.js";

function refused(
  request: CanonicalProjectActivationRequest,
  failure: { status: string; code: string },
): CanonicalProjectActivationResult {
  const status = failure.status === "pending-recovery" ? "unavailable" : failure.status;
  return decodeStrict(CanonicalProjectActivationResultSchema, {
    status,
    request,
    diagnostic: {
      code: failure.code,
      message: "Registered Project selection could not be admitted.",
      retryable: status === "unavailable",
    },
  });
}

/** Reads the Project's registration record, if any, in one admitted transaction. */
async function readRegistrationRecord(
  options: RegistrationDatabaseOptions,
  request: CanonicalProjectActivationRequest,
) {
  const records = await withRegistrationDatabase(
    options,
    (client) => withWriteTransaction(client, readProjectRegistrationRecords),
    "existing-only",
  );
  return records.find(({ reservation }) => reservation.projectId === request.projectId);
}

export function createRegisteredProjectSessionValidation(options: RegistrationDatabaseOptions) {
  return async (
    request: CanonicalProjectActivationRequest,
    session: Extract<ProjectStorageActivationSession, { mode: "read-write" }>,
  ): Promise<CanonicalProjectActivationResult | undefined> => {
    try {
      const record = await readRegistrationRecord(options, request);
      if (record === undefined) return undefined;
      if (record.publication === undefined)
        return refused(request, { status: "unavailable", code: "REGISTRATION_INCOMPLETE" });
      await requirePlainEntry({
        entryPath: session.canonicalDatabasePath,
        kind: "file",
        message: "Registered Project database is unavailable.",
      });
      const client = createWorkerLocalLibsqlClient(session.canonicalDatabasePath, "generation");
      try {
        const { publication } = record;
        const binding = await client.execute({
          sql: "SELECT b.registration_request_id FROM repository_bindings b JOIN project_workspaces w ON w.project_id = b.project_id AND w.binding_id = b.binding_id WHERE b.project_id = ? AND b.binding_id = ? AND w.workspace_id = ?",
          args: [request.projectId, publication.repositoryBindingId, publication.workspaceId],
        });
        if (
          session.result.identity.storageId !== publication.storageId ||
          JSON.stringify(binding.rows) !== JSON.stringify([[publication.requestId]])
        )
          return refused(request, { status: "broken", code: "PROJECT_STORAGE_BROKEN" });
      } finally {
        await client.close();
      }
      return undefined;
    } catch (error) {
      return refused(request, registryFailure(error));
    }
  };
}

type SavedProposal = NonNullable<
  Awaited<ReturnType<typeof readRegistrationRecord>>
>["reservation"]["proposal"];
type PhysicalObservation = Awaited<ReturnType<typeof discoverSelectedPhysical>>;

const identityChanged = { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" } as const;

/** The refusal for a fresh observation that no longer matches the saved repository, if any. */
function observationFailure(saved: SavedProposal, observed: PhysicalObservation) {
  if (observed.status === "unresolved") return identityChanged;
  if (observed.status === "unavailable" && observed.code === "REPOSITORY_TRUST_REQUIRED")
    return identityChanged;
  if (observed.status === "cancelled")
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;
  if (observed.status !== "captured") return observed;
  const unchanged = (["worktree", "gitDirectory", "commonDirectory"] as const).every((key) =>
    samePhysicalIdentity(saved.observation.physical[key], observed.snapshot.physical[key]),
  );
  return unchanged ? undefined : identityChanged;
}

// Runs inside the existing coordinator lifecycle. It does not acquire a writer,
// execute Git or hold a registry transaction while Storage opens.
export function createRegisteredProjectTargetValidation(options: RegistrationDatabaseOptions) {
  return async (
    request: CanonicalProjectActivationRequest,
  ): Promise<CanonicalProjectActivationResult | undefined> => {
    try {
      const record = await readRegistrationRecord(options, request);
      // Existing Storage-only Projects retain the coordinator's legacy opening contract.
      if (record === undefined) return undefined;
      if (record.publication === undefined)
        return refused(request, { status: "unavailable", code: "REGISTRATION_INCOMPLETE" });
      const phase = createIdentityQueryControl(undefined);
      try {
        const saved = record.reservation.proposal;
        const observed = await discoverSelectedPhysical(
          {
            directory: saved.authority.repositoryDirectory,
            identity: saved.authority.repositoryIdentity,
          },
          phase.control,
        );
        const failure = observationFailure(saved, observed);
        return failure === undefined ? undefined : refused(request, failure);
      } finally {
        phase.dispose();
      }
    } catch (error) {
      return refused(request, registryFailure(error));
    }
  };
}
