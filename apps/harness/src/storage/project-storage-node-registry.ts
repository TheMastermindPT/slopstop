import path from "node:path";
import { decodeStrict, type InitialRepositoryBinding, type ProjectId } from "@slopstop/protocol";
import { Effect } from "effect";
import { untypedRejection } from "../effect-rejection.js";
import type { LocalLibsqlResultSet } from "./local-libsql-worker-client.js";
import { type CreateInspection, inspectCreateRows } from "./project-storage-create-inspection.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { isKnownStorageFailure, storageFailureFor } from "./project-storage-node-errors.js";
import {
  type Activation,
  activationSchema,
  type StagingDeclaration,
  stagingDeclarationSchema,
} from "./project-storage-node-schemas.js";
import {
  type AllocatedCreation,
  exactlyOne,
  type LocalClient,
  type LocalTransaction,
} from "./project-storage-node-support.js";
import {
  activateRows,
  generationRowsByProject,
  generationRowsByRequest,
  hasGenerationLocationWitness,
  insertStagingRows,
  locationRowsByNormalizedPath,
  registrationRowsByProject,
  registryWitnessKinds,
  requireUniqueRegistryWitnessRows,
  reservationRows,
} from "./project-storage-registry-rows.js";
import type {
  PriorStateWitnessKind,
  ProjectStorageStoreDependencies,
} from "./project-storage-store.js";
import { withWriteTransaction } from "./project-storage-transaction.js";

type CreationPaths = Parameters<ProjectStorageStoreDependencies["registry"]["activate"]>[1];

/** What the registry operations need from the composition; read at call time. */
type NodeRegistryInput = Readonly<{
  existingApplicationClient: () => Promise<LocalClient | undefined>;
  mutableApplicationClient: () => Promise<LocalClient>;
  requireApplicationAuthority: (
    client: LocalClient,
    requirement: "known" | "current",
  ) => Promise<void>;
  prepareCreate: () => Promise<void>;
  projectRootFor: (projectId: ProjectId) => string;
  clock: ProjectStorageStoreDependencies["clock"];
  failures: ProjectStorageStoreDependencies["failures"];
  databases: ProjectStorageStoreDependencies["databases"];
  options: Readonly<{ initialRepositoryBinding?: InitialRepositoryBinding }>;
}>;

/** A Promise step whose every failure becomes the operation's storage failure. */
function normalizedStep<A>(message: string, step: () => Promise<A>) {
  return Effect.tryPromise({
    try: step,
    catch: (error) => storageFailureFor({ error, message }),
  });
}

/** Keeps a storage failure on the error channel and leaves anything else a defect. */
function keepStorageFailure(error: unknown) {
  return isKnownStorageFailure(error) ? Effect.fail(error) : Effect.die(error);
}

/** A Promise step that keeps a storage failure and leaves anything else a defect. */
function storageStep<A>(step: () => Promise<A>) {
  return Effect.tryPromise({ try: step, catch: untypedRejection }).pipe(
    Effect.catch((rejection) => keepStorageFailure(rejection.cause)),
  );
}

/** A synchronous step that keeps a storage failure and leaves anything else a defect. */
function storageSyncStep<A>(step: () => A) {
  return Effect.try({ try: step, catch: untypedRejection }).pipe(
    Effect.catch((rejection) => keepStorageFailure(rejection.cause)),
  );
}

function isSeededReservation(
  seed: InitialRepositoryBinding | undefined,
  projectId: ProjectId,
  rows: LocalLibsqlResultSet["rows"],
): boolean {
  return (
    seed !== undefined &&
    seed.projectId === projectId &&
    JSON.stringify(rows) === JSON.stringify([[seed.reservationId, seed.reservationFingerprint]])
  );
}

type CreateRowsClient = Parameters<typeof inspectCreateRows>[0];

function createRows(
  input: NodeRegistryInput,
  client: CreateRowsClient,
  creation: AllocatedCreation,
) {
  return inspectCreateRows(
    client,
    {
      projectId: creation.projectId,
      createRequestId: creation.createRequestId,
    },
    creation.createRequestFingerprint,
    input.projectRootFor(creation.projectId),
  );
}

const registryWitnesses = Effect.fn("ProjectStorage.registryWitnesses")(function* (
  input: NodeRegistryInput,
  projectId: ProjectId,
  normalizedProjectRoot: string,
) {
  const client = yield* storageStep(() => input.existingApplicationClient());
  if (client === undefined) return [];
  yield* storageStep(() => input.requireApplicationAuthority(client, "known"));
  const [registrations, directLocations, generations] = yield* storageStep(() =>
    Promise.all([
      registrationRowsByProject(client, projectId),
      locationRowsByNormalizedPath(client, normalizedProjectRoot),
      generationRowsByProject(client, projectId),
    ]),
  );
  yield* storageSyncStep(() =>
    requireUniqueRegistryWitnessRows({ registrations, directLocations }),
  );
  const hasGenerationLinkedLocation = yield* storageStep(() =>
    hasGenerationLocationWitness(client, generations),
  );
  const kinds = registryWitnessKinds({
    registrations,
    directLocations,
    generations,
    hasGenerationLinkedLocation,
  });
  const reservations = yield* storageStep(() => reservationRows(client, projectId));
  if (reservations.length === 0) return kinds;
  const seed = input.options.initialRepositoryBinding;
  if (isSeededReservation(seed, projectId, reservations)) return kinds;
  const withRecord: readonly PriorStateWitnessKind[] = [...kinds, "registration-record"];
  return withRecord;
});

/** The staging write: re-inspects inside the transaction, inserts and checks the staging rows. */
async function stagingTransaction(work: {
  input: NodeRegistryInput;
  transaction: LocalTransaction;
  declaration: StagingDeclaration;
  creation: AllocatedCreation;
}): Promise<CreateInspection> {
  const { input, transaction, declaration, creation } = work;
  const transactionInspection = await createRows(input, transaction, creation);
  if (transactionInspection.status !== "fresh") return transactionInspection;
  await insertStagingRows(transaction, declaration);
  await input.failures.checkpoint("during-staging-transaction");
  const row = exactlyOne(
    await generationRowsByRequest(transaction, creation.createRequestId),
    "Staging generation was not persisted exactly once.",
  );
  const rowAgrees = [
    row.storageId === creation.storageId,
    row.generationId === creation.generationId,
    row.creationState === "staging",
    row.activatedAt === null,
  ].every(Boolean);
  if (!rowAgrees) {
    throw new ProjectStorageBrokenError("Staging generation authority does not agree.");
  }
  return { status: "fresh" };
}

const declareStaging = Effect.fn("ProjectStorage.declareStaging")(function* (
  input: NodeRegistryInput,
  creation: AllocatedCreation,
  creationPaths: CreationPaths,
) {
  const declaration = decodeStrict(stagingDeclarationSchema, {
    ...creation,
    observedAt: input.clock.now(),
    normalizedPath: path.resolve(creationPaths.projectRoot),
    generationDirectoryName: creation.generationId,
    locationState: "staging",
    creationState: "staging",
  });
  const step = <A>(run: () => Promise<A>) =>
    normalizedStep("Project Storage staging declaration failed.", run);
  yield* step(() => input.prepareCreate());
  const client = yield* step(() => input.mutableApplicationClient());
  const current = yield* step(() => createRows(input, client, creation));
  if (current.status !== "fresh") return current;
  // Re-open the pre-transaction checkpoint after the optimistic read.
  yield* step(() => input.failures.checkpoint("before-staging-transaction"));
  return yield* step(() =>
    withWriteTransaction(client, (transaction) =>
      stagingTransaction({ input, transaction, declaration, creation }),
    ),
  );
});

/** The activation write: activates the rows and checks the replayed identity agrees. */
async function activationTransaction(work: {
  input: NodeRegistryInput;
  transaction: LocalTransaction;
  activation: Activation;
  creation: AllocatedCreation;
}): Promise<void> {
  const { input, transaction, activation, creation } = work;
  await activateRows(transaction, activation, input.failures);
  const replay = await createRows(input, transaction, creation);
  const replayAgrees =
    replay.status === "active-replay" &&
    [
      replay.identity.storageId === creation.storageId,
      replay.identity.generationId === creation.generationId,
      replay.identity.canonicalDatabaseLineageId === creation.canonicalDatabaseLineageId,
      replay.identity.runtimeDatabaseLineageId === creation.runtimeDatabaseLineageId,
    ].every(Boolean);
  if (!replayAgrees) {
    throw new ProjectStorageBrokenError("Activated Project Storage authority does not agree.");
  }
}

const activate = Effect.fn("ProjectStorage.activate")(function* (
  input: NodeRegistryInput,
  creation: AllocatedCreation,
  creationPaths: CreationPaths,
) {
  const activation = decodeStrict(activationSchema, {
    projectId: creation.projectId,
    storageId: creation.storageId,
    locationId: creation.locationId,
    generationId: creation.generationId,
    activatedAt: input.clock.now(),
  });
  const step = <A>(run: () => Promise<A>) =>
    normalizedStep("Project Storage activation failed.", run);
  yield* step(() => input.databases.verifySealed(creationPaths.active, creation));
  const client = yield* step(() => input.existingApplicationClient());
  if (client === undefined) {
    return yield* new ProjectStorageBrokenError(
      "Project Storage application authority is missing.",
    );
  }
  yield* step(() => input.requireApplicationAuthority(client, "current"));
  yield* step(() =>
    withWriteTransaction(client, (transaction) =>
      activationTransaction({ input, transaction, activation, creation }),
    ),
  );
});

/** The registry operations that need the composition's parts, as Effect programs. */
export function createNodeRegistryOperations(input: NodeRegistryInput) {
  return {
    registryWitnesses: (projectId: ProjectId, normalizedProjectRoot: string) =>
      registryWitnesses(input, projectId, normalizedProjectRoot),
    declareStaging: (creation: AllocatedCreation, creationPaths: CreationPaths) =>
      declareStaging(input, creation, creationPaths),
    activate: (creation: AllocatedCreation, creationPaths: CreationPaths) =>
      activate(input, creation, creationPaths),
  };
}
