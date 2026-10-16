import { decodeStrict, type ProjectId, type ProjectStorageCreateRequest } from "@slopstop/protocol";
import { Schema } from "effect";
import type { LocalLibsqlResultSet } from "./local-libsql-worker-client.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { witnessOrder } from "./project-storage-filesystem-authority.js";
import {
  type Activation,
  type GenerationRow,
  generationRowColumns,
  generationRowSchema,
  type LocationRow,
  locationRowSchema,
  type RegistrationRow,
  registrationRowSchema,
  resultObjects,
  type StagingDeclaration,
} from "./project-storage-node-schemas.js";
import {
  assertRowsAffected,
  type LocalClient,
  type LocalTransaction,
} from "./project-storage-node-support.js";
import type {
  PriorStateWitnessKind,
  ProjectStorageStoreDependencies,
} from "./project-storage-store.js";

const maximumRegistryGenerationsPerProject = 256;

export async function generationRowsByRequest(
  client: LocalClient | LocalTransaction,
  createRequestId: ProjectStorageCreateRequest["createRequestId"],
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT ${generationRowColumns}
      FROM storage_generations WHERE create_request_id = ?`,
    args: [createRequestId],
  });
  return decodeStrict(Schema.Array(generationRowSchema), resultObjects(result));
}

export async function registrationRowsByProject(
  client: LocalClient | LocalTransaction,
  projectId: ProjectId,
): Promise<readonly RegistrationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, project_id AS projectId,
      active_generation_id AS activeGenerationId,
      active_location_id AS activeLocationId,
      created_at AS createdAt, activated_at AS activatedAt
      FROM storage_registrations WHERE project_id = ?`,
    args: [projectId],
  });
  return decodeStrict(Schema.Array(registrationRowSchema), resultObjects(result));
}

export async function generationRowsByProject(
  client: LocalClient | LocalTransaction,
  projectId: ProjectId,
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT ${generationRowColumns} FROM storage_generations
      WHERE project_id = ? LIMIT ?`,
    args: [projectId, maximumRegistryGenerationsPerProject + 1],
  });
  const generations = decodeStrict(Schema.Array(generationRowSchema), resultObjects(result));
  if (generations.length > maximumRegistryGenerationsPerProject) {
    throw new ProjectStorageBrokenError("Project Storage registry witness set is unbounded.");
  }
  return generations;
}

export async function locationRowsByStorage(
  client: LocalClient | LocalTransaction,
  storageId: GenerationRow["storageId"],
  locationId: GenerationRow["locationId"],
): Promise<readonly LocationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, location_id AS locationId,
      normalized_path AS normalizedPath, location_state AS locationState,
      observed_at AS observedAt FROM storage_locations
      WHERE storage_id = ? AND location_id = ?`,
    args: [storageId, locationId],
  });
  return decodeStrict(Schema.Array(locationRowSchema), resultObjects(result));
}

export async function locationRowsByNormalizedPath(
  client: LocalClient | LocalTransaction,
  normalizedProjectRoot: string,
): Promise<readonly LocationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, location_id AS locationId,
      normalized_path AS normalizedPath, location_state AS locationState,
      observed_at AS observedAt FROM storage_locations
      WHERE normalized_path = ?`,
    args: [normalizedProjectRoot],
  });
  return decodeStrict(Schema.Array(locationRowSchema), resultObjects(result));
}

export async function hasGenerationLocationWitness(
  client: LocalClient,
  generations: readonly GenerationRow[],
): Promise<boolean> {
  let found = false;
  for (const generation of generations) {
    const linked = await locationRowsByStorage(client, generation.storageId, generation.locationId);
    if (linked.length > 1) {
      throw new ProjectStorageBrokenError("Project Storage location authority is not unique.");
    }
    if (linked.length === 1) found = true;
  }
  return found;
}

/** The Project's registration reservation rows; none when the reservation table is absent. */
export async function reservationRows(
  client: LocalClient,
  projectId: ProjectId,
): Promise<LocalLibsqlResultSet["rows"]> {
  const reservationTable = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'registration_reservations'",
  );
  if (reservationTable.rows.length === 0) return [];
  const reservations = await client.execute({
    sql: "SELECT reservation_id, record_fingerprint FROM registration_reservations WHERE json_extract(record_json, '$.projectId') = ?",
    args: [projectId],
  });
  return reservations.rows;
}

export function registryWitnessKinds(input: {
  registrations: readonly RegistrationRow[];
  directLocations: readonly LocationRow[];
  generations: readonly GenerationRow[];
  hasGenerationLinkedLocation: boolean;
}): readonly PriorStateWitnessKind[] {
  const kinds = new Set<PriorStateWitnessKind>();
  if (input.registrations.length === 1) kinds.add("registration-record");
  if (input.directLocations.length === 1) kinds.add("location-record");
  if (input.hasGenerationLinkedLocation) kinds.add("location-record");
  if (input.generations.length > 0) kinds.add("generation-record");
  return witnessOrder.filter((kind) => kinds.has(kind));
}

export function requireUniqueRegistryWitnessRows(input: {
  registrations: readonly RegistrationRow[];
  directLocations: readonly LocationRow[];
}): void {
  if (input.registrations.length > 1) {
    throw new ProjectStorageBrokenError("Project Storage registry witness authority is invalid.");
  }
  if (input.directLocations.length > 1) {
    throw new ProjectStorageBrokenError("Project Storage registry witness authority is invalid.");
  }
}

export async function insertStagingRows(
  transaction: LocalTransaction,
  declaration: StagingDeclaration,
): Promise<void> {
  const location = await transaction.execute({
    sql: `INSERT INTO storage_locations
      (storage_id, location_id, normalized_path, location_state, observed_at)
      VALUES (?, ?, ?, ?, ?)`,
    args: [
      declaration.storageId,
      declaration.locationId,
      declaration.normalizedPath,
      declaration.locationState,
      declaration.observedAt,
    ],
  });
  assertRowsAffected(location.rowsAffected, "Staging location was not inserted exactly once.");
  const generation = await transaction.execute({
    sql: `INSERT INTO storage_generations
      (storage_id, generation_id, project_id, location_id,
        canonical_lineage_id, runtime_lineage_id, create_request_id,
        create_request_fingerprint, generation_directory_name,
        creation_state, created_at, activated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    args: [
      declaration.storageId,
      declaration.generationId,
      declaration.projectId,
      declaration.locationId,
      declaration.canonicalDatabaseLineageId,
      declaration.runtimeDatabaseLineageId,
      declaration.createRequestId,
      declaration.createRequestFingerprint,
      declaration.generationDirectoryName,
      declaration.creationState,
      declaration.createdAt,
    ],
  });
  assertRowsAffected(generation.rowsAffected, "Staging generation was not inserted exactly once.");
  const registration = await transaction.execute({
    sql: `INSERT INTO storage_registrations
      (storage_id, project_id, active_generation_id, active_location_id,
        created_at, activated_at)
      VALUES (?, ?, NULL, NULL, ?, NULL)`,
    args: [declaration.storageId, declaration.projectId, declaration.createdAt],
  });
  assertRowsAffected(
    registration.rowsAffected,
    "Staging registration was not inserted exactly once.",
  );
}

export async function activateRows(
  transaction: LocalTransaction,
  activation: Activation,
  failures: ProjectStorageStoreDependencies["failures"],
): Promise<void> {
  const generation = await transaction.execute({
    sql: `UPDATE storage_generations SET creation_state = 'active', activated_at = ?
      WHERE storage_id = ? AND generation_id = ? AND project_id = ?
        AND location_id = ? AND creation_state = 'staging' AND activated_at IS NULL`,
    args: [
      activation.activatedAt,
      activation.storageId,
      activation.generationId,
      activation.projectId,
      activation.locationId,
    ],
  });
  assertRowsAffected(generation.rowsAffected, "Staging generation was not activated exactly once.");
  const location = await transaction.execute({
    sql: `UPDATE storage_locations SET location_state = 'committed'
      WHERE storage_id = ? AND location_id = ? AND location_state = 'staging'`,
    args: [activation.storageId, activation.locationId],
  });
  assertRowsAffected(location.rowsAffected, "Staging location was not committed exactly once.");
  const registration = await transaction.execute({
    sql: `UPDATE storage_registrations
      SET active_generation_id = ?, active_location_id = ?, activated_at = ?
      WHERE storage_id = ? AND project_id = ?
        AND active_generation_id IS NULL AND active_location_id IS NULL
        AND activated_at IS NULL`,
    args: [
      activation.generationId,
      activation.locationId,
      activation.activatedAt,
      activation.storageId,
      activation.projectId,
    ],
  });
  assertRowsAffected(
    registration.rowsAffected,
    "Staging registration was not activated exactly once.",
  );
  await failures.checkpoint("during-activation-transaction");
}
