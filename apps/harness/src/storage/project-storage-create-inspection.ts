import { createHash } from "node:crypto";
import path from "node:path";
import type { ProjectStorageCreateRequest } from "@slopstop/protocol";
import { chainRootCreatedAt } from "./application-database-migration.js";
import { projectStorageCreateRequestFingerprintInput } from "./project-storage-create-request.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import type { GenerationRow, RegistrationRow } from "./project-storage-node-schemas.js";
import {
  exactlyOne,
  type LocalClient,
  type LocalTransaction,
} from "./project-storage-node-support.js";
import {
  generationRowsByProject,
  generationRowsByRequest,
  locationRowsByStorage,
  registrationRowsByProject,
} from "./project-storage-registry-rows.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";
import {
  type UpgradedCreateRequest,
  upgradeChainFor,
  upgradedCreateRequest,
} from "./project-storage-upgrade-node-adapter.js";

export type CreateInspection = Awaited<
  ReturnType<ProjectStorageStoreDependencies["registry"]["inspectCreate"]>
>;

async function createAuthorityRows(input: {
  client: LocalClient | LocalTransaction;
  generation: GenerationRow;
  message: string;
}) {
  return Promise.all([
    registrationRowsByProject(input.client, input.generation.projectId).then((rows) =>
      exactlyOne(rows, input.message),
    ),
    locationRowsByStorage(
      input.client,
      input.generation.storageId,
      input.generation.locationId,
    ).then((rows) => exactlyOne(rows, input.message)),
  ]);
}

async function requireStagingCreateAuthority(input: {
  client: LocalClient | LocalTransaction;
  expectedProjectRoot: string;
  generation: GenerationRow;
}): Promise<void> {
  const [registration, location] = await createAuthorityRows({
    ...input,
    message: "Staging create request authority is inconsistent.",
  });
  const rowsAgree = [
    registration.storageId === input.generation.storageId,
    registration.activeGenerationId === null,
    registration.activeLocationId === null,
    registration.createdAt === input.generation.createdAt,
    registration.activatedAt === null,
    location.locationState === "staging",
    location.normalizedPath === input.expectedProjectRoot,
    input.generation.generationDirectoryName === input.generation.generationId,
    input.generation.activatedAt === null,
  ].every(Boolean);
  if (!rowsAgree) {
    throw new ProjectStorageBrokenError("Staging create request authority is inconsistent.");
  }
}

async function requireActiveCreateAuthority(input: {
  client: LocalClient | LocalTransaction;
  expectedProjectRoot: string;
  generation: GenerationRow;
  message: string;
}): Promise<void> {
  const [registration, location] = await createAuthorityRows(input);
  const chain = await upgradeChainFor(input.client, input.generation.storageId);
  const rowsAgree = [
    registration.storageId === input.generation.storageId,
    registration.activeGenerationId === input.generation.generationId,
    registration.activeLocationId === input.generation.locationId,
    registration.createdAt === (chainRootCreatedAt(chain) ?? input.generation.createdAt),
    registration.activatedAt === input.generation.activatedAt,
    location.locationState === "committed",
    location.normalizedPath === input.expectedProjectRoot,
    input.generation.generationDirectoryName === input.generation.generationId,
    input.generation.activatedAt !== null,
  ].every(Boolean);
  if (!rowsAgree) throw new ProjectStorageBrokenError(input.message);
}

function requireCanonicalCreateRequestFingerprint(generation: GenerationRow): void {
  const expectedFingerprint = createHash("sha256")
    .update(
      projectStorageCreateRequestFingerprintInput({
        projectId: generation.projectId,
        createRequestId: generation.createRequestId,
      }),
    )
    .digest("hex");
  if (generation.createRequestFingerprint !== expectedFingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
}

export async function requireRegisteredProjectAuthority(input: {
  client: LocalClient | LocalTransaction;
  expectedProjectRoot: string;
  registration: RegistrationRow;
}): Promise<void> {
  const message = "Registered Project Storage authority is inconsistent.";
  const generation = exactlyOne(
    await generationRowsByProject(input.client, input.registration.projectId),
    message,
  );
  requireCanonicalCreateRequestFingerprint(generation);
  if (generation.storageId !== input.registration.storageId) {
    throw new ProjectStorageBrokenError(message);
  }
  if (input.registration.activeGenerationId === null) {
    if (generation.creationState !== "staging") throw new ProjectStorageBrokenError(message);
    await requireStagingCreateAuthority({
      client: input.client,
      expectedProjectRoot: input.expectedProjectRoot,
      generation,
    });
    return;
  }
  if (generation.creationState !== "active") throw new ProjectStorageBrokenError(message);
  await requireActiveCreateAuthority({
    client: input.client,
    expectedProjectRoot: input.expectedProjectRoot,
    generation,
    message,
  });
}

async function inspectExistingCreateGeneration(input: {
  client: LocalClient | LocalTransaction;
  request: ProjectStorageCreateRequest;
  createRequestFingerprint: string;
  expectedProjectRoot: string;
  generation: GenerationRow;
}): Promise<CreateInspection> {
  if (input.generation.projectId !== input.request.projectId) {
    requireCanonicalCreateRequestFingerprint(input.generation);
    const generationProjectRoot = path.resolve(
      path.dirname(input.expectedProjectRoot),
      input.generation.projectId,
    );
    if (input.generation.creationState === "staging") {
      await requireStagingCreateAuthority({
        client: input.client,
        expectedProjectRoot: generationProjectRoot,
        generation: input.generation,
      });
    } else {
      await requireActiveCreateAuthority({
        client: input.client,
        expectedProjectRoot: generationProjectRoot,
        generation: input.generation,
        message: "Active create request authority is inconsistent.",
      });
    }
    return { status: "idempotency-conflict" };
  }
  if (input.generation.createRequestFingerprint !== input.createRequestFingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
  if (input.generation.creationState === "staging") {
    await requireStagingCreateAuthority(input);
    return { status: "incomplete-request" };
  }
  await requireActiveCreateAuthority({
    client: input.client,
    expectedProjectRoot: input.expectedProjectRoot,
    generation: input.generation,
    message: "Active create request authority is inconsistent.",
  });
  return activeReplay(input.generation);
}

function activeReplay(generation: GenerationRow): CreateInspection {
  return {
    status: "active-replay",
    identity: {
      storageId: generation.storageId,
      generationId: generation.generationId,
      canonicalDatabaseLineageId: generation.canonicalDatabaseLineageId,
      runtimeDatabaseLineageId: generation.runtimeDatabaseLineageId,
    },
  };
}

export async function inspectCreateRows(
  client: LocalClient | LocalTransaction,
  request: ProjectStorageCreateRequest,
  createRequestFingerprint: string,
  expectedProjectRoot: string,
): Promise<CreateInspection> {
  const requestRows = await generationRowsByRequest(client, request.createRequestId);
  if (requestRows.length > 1) {
    throw new ProjectStorageBrokenError("Create request authority is not unique.");
  }
  const generation = requestRows[0];
  if (generation !== undefined) {
    return inspectExistingCreateGeneration({
      client,
      request,
      createRequestFingerprint,
      expectedProjectRoot,
      generation,
    });
  }
  const upgraded = await upgradedCreateRequest(client, request.createRequestId);
  if (upgraded !== undefined) {
    return inspectUpgradedCreate({
      client,
      request,
      createRequestFingerprint,
      expectedProjectRoot,
      upgraded,
    });
  }
  return inspectProjectRegistration({ client, request, expectedProjectRoot });
}

/** A create request whose generation an upgrade superseded replays the current generation. */
async function inspectUpgradedCreate(input: {
  client: LocalClient | LocalTransaction;
  request: ProjectStorageCreateRequest;
  createRequestFingerprint: string;
  expectedProjectRoot: string;
  upgraded: UpgradedCreateRequest;
}): Promise<CreateInspection> {
  const { projectId } = input.upgraded;
  const message = "Active create request authority is inconsistent.";
  const generation = exactlyOne(
    (await generationRowsByProject(input.client, projectId)).filter(
      (row) => row.creationState === "active",
    ),
    message,
  );
  await requireActiveCreateAuthority({
    client: input.client,
    expectedProjectRoot: path.resolve(path.dirname(input.expectedProjectRoot), projectId),
    generation,
    message,
  });
  if (projectId !== input.request.projectId) return { status: "idempotency-conflict" };
  if (input.upgraded.createRequestFingerprint !== input.createRequestFingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
  return activeReplay(generation);
}

async function inspectProjectRegistration(input: {
  client: LocalClient | LocalTransaction;
  request: ProjectStorageCreateRequest;
  expectedProjectRoot: string;
}): Promise<CreateInspection> {
  const registrations = await registrationRowsByProject(input.client, input.request.projectId);
  if (registrations.length > 1) {
    throw new ProjectStorageBrokenError("Project registration authority is not unique.");
  }
  const registration = registrations[0];
  if (registration === undefined) {
    const generations = await generationRowsByProject(input.client, input.request.projectId);
    if (generations.length > 0) {
      throw new ProjectStorageBrokenError("Registered Project Storage authority is inconsistent.");
    }
    return { status: "fresh" };
  }
  await requireRegisteredProjectAuthority({
    client: input.client,
    expectedProjectRoot: input.expectedProjectRoot,
    registration,
  });
  return { status: "already-registered" };
}
