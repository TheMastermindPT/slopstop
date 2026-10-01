import path from "node:path";
import {
  InitialRepositoryBindingSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  RegisteredProjectSchema,
} from "@slopstop/protocol";
import { verifyInitialRepositoryBinding } from "../storage/initial-repository-binding.js";
import { createWorkerLocalLibsqlClient } from "../storage/local-libsql-worker-client.js";
import { requirePlainEntry } from "../storage/project-storage-filesystem-authority.js";
import { createNodeProjectStorageDependencies } from "../storage/project-storage-node-adapters.js";
import type { ProjectStorageStoreDependencies } from "../storage/project-storage-store.js";
import { createProjectStorageOwner } from "../storage/project-storage-store.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { createIdentityQueryControl } from "./identity-query-control.js";
import { samePhysicalIdentity } from "./physical-identity.js";
import {
  incomplete,
  publishRegistration,
  type RegistrationBootstrap,
  RegistrationPublicationCancelled,
  type Reservation,
  reservationFingerprint,
} from "./registration-confirmation-store.js";
import { type RegistrationDatabaseOptions, withRegistrationDatabase } from "./registry-database.js";
import { registryFailure } from "./registry-failure.js";
import { discoverSelectedPhysical } from "./repository-physical-observation.js";
import type { RepositoryTrustOwner } from "./repository-trust.js";

async function revalidate(
  registry: RepositoryTrustOwner,
  reservation: Reservation,
  signal: AbortSignal,
) {
  if (signal.aborted) return { status: "cancelled" } as const;
  const admitted = await registry.admitRepositoryIdentityQueries(
    reservation.proposal.request.admission,
    { admit: async () => {} },
  );
  if (signal.aborted) return { status: "cancelled" } as const;
  if (admitted.status !== "admitted") return admitted;
  const phase = createIdentityQueryControl(signal);
  try {
    const original = reservation.proposal;
    const captured = await discoverSelectedPhysical(
      {
        directory: original.authority.repositoryDirectory,
        identity: original.authority.repositoryIdentity,
      },
      phase.control,
    );
    if (captured.status === "unresolved")
      return { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" } as const;
    if (captured.status !== "captured") return captured;
    if (
      !(["worktree", "gitDirectory", "commonDirectory"] as const).every((key) =>
        samePhysicalIdentity(original.observation.physical[key], captured.snapshot.physical[key]),
      )
    )
      return { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" } as const;
    return { status: "matched" } as const;
  } finally {
    phase.dispose();
  }
}

export function createRegistrationStorageBootstrap(
  registry: RepositoryTrustOwner,
  options: RegistrationDatabaseOptions & {
    applicationVersion: string;
    storageFailures?: ProjectStorageStoreDependencies["failures"];
  },
): RegistrationBootstrap {
  return async (reservation, request, signal) => {
    try {
      const before = await revalidate(registry, reservation, signal);
      if (before.status !== "matched") return before;
      if (signal.aborted) return { status: "cancelled" } as const;
      const seed = InitialRepositoryBindingSchema.parse({
        projectId: reservation.projectId,
        createRequestId: reservation.createRequestId,
        repositoryBindingId: reservation.repositoryBindingId,
        workspaceId: reservation.workspaceId,
        reservationId: reservation.reservationId,
        registrationRequestId: request.requestId,
        reservationFingerprint: reservationFingerprint(reservation),
      });
      const dependencies = createNodeProjectStorageDependencies({
        applicationStorageRoot: options.applicationStorageRoot,
        migrationResourcesRoot: options.migrationResourcesRoot,
        applicationVersion: options.applicationVersion,
        initialRepositoryBinding: seed,
        ...(options.storageFailures === undefined ? {} : { failures: options.storageFailures }),
      });
      const owner = createProjectStorageOwner(dependencies);
      let creation: Awaited<ReturnType<typeof owner.create>>;
      try {
        if (signal.aborted) return { status: "cancelled" } as const;
        creation = await owner.create(
          ProjectStorageCreateRequestSchema.parse({
            projectId: seed.projectId,
            createRequestId: seed.createRequestId,
          }),
        );
      } finally {
        await owner.stop();
      }
      if (creation.status === "broken")
        return { status: "broken", code: "INTERNAL_FAILURE" } as const;
      if (creation.status !== "ready")
        return {
          status: "pending-recovery",
          code: "REGISTRATION_INCOMPLETE",
          requestId: request.requestId,
        } as const;
      const created = ProjectStorageCreateResultSchema.parse(creation.result);
      if (created.status === "broken")
        return { status: "broken", code: "INTERNAL_FAILURE" } as const;
      if (created.status !== "created")
        return {
          status: "pending-recovery",
          code:
            created.status === "blocked" && created.reason === "prior-state-witness"
              ? "PRIOR_STATE_WITNESS"
              : "REGISTRATION_INCOMPLETE",
          requestId: request.requestId,
        } as const;
      if (signal.aborted) return incomplete(request);
      const databasePath = path.join(
        options.applicationStorageRoot,
        "projects",
        reservation.projectId,
        created.identity.generationId,
        "slopstop.db",
      );
      await requirePlainEntry({
        entryPath: databasePath,
        kind: "file",
        message: "Registered canonical database is unavailable.",
      });
      const client = createWorkerLocalLibsqlClient(databasePath, "generation");
      try {
        await verifyInitialRepositoryBinding(client, seed);
      } finally {
        await client.close();
      }
      const after = await revalidate(registry, reservation, signal);
      if (after.status === "broken") return after;
      if (after.status !== "matched" || signal.aborted) return incomplete(request);
      const result = RegisteredProjectSchema.parse({
        status: "registered",
        requestId: request.requestId,
        proposalId: request.proposalId,
        projectId: reservation.projectId,
        repositoryBindingId: reservation.repositoryBindingId,
        workspaceId: reservation.workspaceId,
        storageId: created.identity.storageId,
        generationId: created.identity.generationId,
      });
      return await withRegistrationDatabase(
        options,
        (database) =>
          withWriteTransaction(database, async (transaction) =>
            signal.aborted
              ? incomplete(request)
              : publishRegistration(transaction, reservation, result, signal),
          ),
        "existing-only",
      );
    } catch (error) {
      if (error instanceof RegistrationPublicationCancelled) return incomplete(request);
      return registryFailure(error);
    }
  };
}
