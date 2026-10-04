import path from "node:path";
import {
  decodeStrict,
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
import {
  applicationDatabaseFor,
  type RegistrationDatabaseOptions,
  withRegistrationDatabase,
} from "./registry-database.js";
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

type BootstrapOptions = RegistrationDatabaseOptions & {
  applicationVersion: string;
  storageFailures?: ProjectStorageStoreDependencies["failures"];
};
type BootstrapRequest = Parameters<RegistrationBootstrap>[1];
type InitialBinding = typeof InitialRepositoryBindingSchema.Type;
type CreationOutcome = Awaited<ReturnType<ReturnType<typeof createProjectStorageOwner>["create"]>>;
type CreateResult = typeof ProjectStorageCreateResultSchema.Type;
type CreatedStorage = Extract<CreateResult, { status: "created" }>;

const brokenCreation = { status: "broken", code: "INTERNAL_FAILURE" } as const;

function initialBindingSeed(reservation: Reservation, request: BootstrapRequest): InitialBinding {
  return decodeStrict(InitialRepositoryBindingSchema, {
    projectId: reservation.projectId,
    createRequestId: reservation.createRequestId,
    repositoryBindingId: reservation.repositoryBindingId,
    workspaceId: reservation.workspaceId,
    reservationId: reservation.reservationId,
    registrationRequestId: request.requestId,
    reservationFingerprint: reservationFingerprint(reservation),
  });
}

// Creates the Project's Storage through a private owner sharing the application database.
async function createRegisteredStorage(
  options: BootstrapOptions,
  seed: InitialBinding,
  signal: AbortSignal,
): Promise<CreationOutcome | "cancelled"> {
  const owner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: options.applicationStorageRoot,
      migrationResourcesRoot: options.migrationResourcesRoot,
      applicationVersion: options.applicationVersion,
      applicationDatabase: applicationDatabaseFor(options),
      initialRepositoryBinding: seed,
      ...(options.storageFailures === undefined ? {} : { failures: options.storageFailures }),
    }),
  );
  try {
    if (signal.aborted) return "cancelled";
    return await owner.create(
      decodeStrict(ProjectStorageCreateRequestSchema, {
        projectId: seed.projectId,
        createRequestId: seed.createRequestId,
      }),
    );
  } finally {
    await owner.stop();
  }
}

function incompleteCreationCode(created: Exclude<CreateResult, CreatedStorage>) {
  if (created.status !== "blocked") return "REGISTRATION_INCOMPLETE";
  return created.reason === "prior-state-witness"
    ? "PRIOR_STATE_WITNESS"
    : "REGISTRATION_INCOMPLETE";
}

function createdStorageOrFailure(creation: CreationOutcome, request: BootstrapRequest) {
  if (creation.status === "broken") return brokenCreation;
  if (creation.status !== "ready")
    return {
      status: "pending-recovery",
      code: "REGISTRATION_INCOMPLETE",
      requestId: request.requestId,
    } as const;
  const created = decodeStrict(ProjectStorageCreateResultSchema, creation.result);
  if (created.status === "created") return created;
  if (created.status === "broken") return brokenCreation;
  return {
    status: "pending-recovery",
    code: incompleteCreationCode(created),
    requestId: request.requestId,
  } as const;
}

async function verifyCanonicalBinding(
  options: BootstrapOptions,
  created: CreatedStorage,
  seed: InitialBinding,
): Promise<void> {
  const databasePath = path.join(
    options.applicationStorageRoot,
    "projects",
    seed.projectId,
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
}

type BootstrapRun = Readonly<{
  registry: RepositoryTrustOwner;
  options: BootstrapOptions;
  reservation: Reservation;
  request: BootstrapRequest;
  signal: AbortSignal;
}>;

// Creates Storage only for a still-matching repository; returns the seed and the creation.
async function createAfterRevalidation(run: BootstrapRun) {
  const before = await revalidate(run.registry, run.reservation, run.signal);
  if (before.status !== "matched") return before;
  if (run.signal.aborted) return { status: "cancelled" } as const;
  const seed = initialBindingSeed(run.reservation, run.request);
  const creation = await createRegisteredStorage(run.options, seed, run.signal);
  if (creation === "cancelled") return { status: "cancelled" } as const;
  return { status: "storage-created", seed, creation } as const;
}

// Publishes the registration once the binding is verified and the repository still matches.
async function publishVerifiedRegistration(
  run: BootstrapRun,
  created: CreatedStorage,
  seed: InitialBinding,
) {
  const { options, reservation, request, signal } = run;
  if (signal.aborted) return incomplete(request);
  await verifyCanonicalBinding(options, created, seed);
  const after = await revalidate(run.registry, reservation, signal);
  if (after.status === "broken") return after;
  if (after.status !== "matched" || signal.aborted) return incomplete(request);
  const result = decodeStrict(RegisteredProjectSchema, {
    status: "registered",
    requestId: request.requestId,
    proposalId: request.proposalId,
    projectId: reservation.projectId,
    repositoryBindingId: reservation.repositoryBindingId,
    workspaceId: reservation.workspaceId,
    storageId: created.identity.storageId,
    generationId: created.identity.generationId,
  });
  return withRegistrationDatabase(
    options,
    (database) =>
      withWriteTransaction(database, async (transaction) =>
        signal.aborted
          ? incomplete(request)
          : publishRegistration(transaction, reservation, result, signal),
      ),
    "existing-only",
  );
}

export function createRegistrationStorageBootstrap(
  registry: RepositoryTrustOwner,
  options: BootstrapOptions,
): RegistrationBootstrap {
  return async (reservation, request, signal) => {
    const run = { registry, options, reservation, request, signal };
    try {
      const prepared = await createAfterRevalidation(run);
      if (prepared.status !== "storage-created") return prepared;
      const created = createdStorageOrFailure(prepared.creation, request);
      if (created.status !== "created") return created;
      return await publishVerifiedRegistration(run, created, prepared.seed);
    } catch (error) {
      if (error instanceof RegistrationPublicationCancelled) return incomplete(request);
      return registryFailure(error);
    }
  };
}
