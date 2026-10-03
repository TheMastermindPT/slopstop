import {
  type CanonicalProjectActivationRequest,
  type CanonicalProjectActivationResult,
  CanonicalProjectActivationResultSchema,
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
  return CanonicalProjectActivationResultSchema.parse({
    status,
    request,
    diagnostic: {
      code: failure.code,
      message: "Registered Project selection could not be admitted.",
      retryable: status === "unavailable",
    },
  });
}

export function createRegisteredProjectSessionValidation(options: RegistrationDatabaseOptions) {
  return async (
    request: CanonicalProjectActivationRequest,
    session: Extract<ProjectStorageActivationSession, { mode: "read-write" }>,
  ): Promise<CanonicalProjectActivationResult | undefined> => {
    try {
      const records = await withRegistrationDatabase(
        options,
        (client) => withWriteTransaction(client, readProjectRegistrationRecords),
        "existing-only",
      );
      const record = records.find(({ reservation }) => reservation.projectId === request.projectId);
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

// Runs inside the existing coordinator lifecycle. It does not acquire a writer,
// execute Git or hold a registry transaction while Storage opens.
export function createRegisteredProjectTargetValidation(options: RegistrationDatabaseOptions) {
  return async (
    request: CanonicalProjectActivationRequest,
  ): Promise<CanonicalProjectActivationResult | undefined> => {
    try {
      const records = await withRegistrationDatabase(
        options,
        (client) => withWriteTransaction(client, readProjectRegistrationRecords),
        "existing-only",
      );
      const record = records.find(({ reservation }) => reservation.projectId === request.projectId);
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
        if (observed.status === "unresolved")
          return refused(request, { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" });
        if (observed.status === "unavailable" && observed.code === "REPOSITORY_TRUST_REQUIRED")
          return refused(request, { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" });
        if (observed.status === "cancelled")
          return refused(request, { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" });
        if (observed.status !== "captured") return refused(request, observed);
        if (
          !(["worktree", "gitDirectory", "commonDirectory"] as const).every((key) =>
            samePhysicalIdentity(saved.observation.physical[key], observed.snapshot.physical[key]),
          )
        )
          return refused(request, { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" });
        return undefined;
      } finally {
        phase.dispose();
      }
    } catch (error) {
      return refused(request, registryFailure(error));
    }
  };
}
