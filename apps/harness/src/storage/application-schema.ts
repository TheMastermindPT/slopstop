import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createSchemaMetadataColumns } from "./schema-metadata-columns.js";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

export const applicationSchemaMetadata = sqliteTable(
  "schema_metadata",
  createSchemaMetadataColumns(),
  (table) => [
    check("application_metadata_key", sql`${table.metadataKey} = 'application'`),
    check("application_metadata_kind", sql`${table.databaseKind} = 'application'`),
    check("application_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("application_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check("application_migration_nonempty", sql`length(trim(${table.lastMigrationId})) > 0`),
  ],
);

export const storageLocations = sqliteTable(
  "storage_locations",
  {
    storageId: text("storage_id").notNull(),
    locationId: text("location_id").notNull(),
    normalizedPath: text("normalized_path").notNull(),
    locationState: text("location_state", {
      enum: ["staging", "committed"],
    }).notNull(),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_locations_pk",
      columns: [table.storageId, table.locationId],
    }),
    uniqueIndex("storage_locations_normalized_path_uq").on(table.normalizedPath),
    check("storage_locations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_locations_location_id_uuid", domainIdentityCheck(table.locationId)),
    check("storage_locations_state", sql`${table.locationState} in ('staging', 'committed')`),
  ],
);

export const storageGenerations = sqliteTable(
  "storage_generations",
  {
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    projectId: text("project_id").notNull(),
    locationId: text("location_id").notNull(),
    canonicalLineageId: text("canonical_lineage_id").notNull(),
    runtimeLineageId: text("runtime_lineage_id").notNull(),
    createRequestId: text("create_request_id").notNull(),
    createRequestFingerprint: text("create_request_fingerprint").notNull(),
    generationDirectoryName: text("generation_directory_name").notNull(),
    creationState: text("creation_state", {
      enum: ["staging", "active"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
  },
  (table) => [
    primaryKey({
      name: "storage_generations_pk",
      columns: [table.storageId, table.generationId],
    }),
    foreignKey({
      name: "storage_generations_location_fk",
      columns: [table.storageId, table.locationId],
      foreignColumns: [storageLocations.storageId, storageLocations.locationId],
    }).onDelete("restrict"),
    uniqueIndex("storage_generations_create_request_uq").on(table.createRequestId),
    uniqueIndex("storage_generations_directory_uq").on(
      table.storageId,
      table.generationDirectoryName,
    ),
    uniqueIndex("storage_generations_one_active_uq")
      .on(table.storageId)
      .where(sql`${table.creationState} = 'active'`),
    index("storage_generations_project_idx").on(table.projectId),
    index("storage_generations_state_idx").on(table.storageId, table.creationState),
    check("storage_generations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_generations_generation_id_uuid", domainIdentityCheck(table.generationId)),
    check("storage_generations_project_id_uuid", domainIdentityCheck(table.projectId)),
    check("storage_generations_location_id_uuid", domainIdentityCheck(table.locationId)),
    check(
      "storage_generations_canonical_lineage_uuid",
      domainIdentityCheck(table.canonicalLineageId),
    ),
    check("storage_generations_runtime_lineage_uuid", domainIdentityCheck(table.runtimeLineageId)),
    check("storage_generations_create_request_uuid", domainIdentityCheck(table.createRequestId)),
    check(
      "storage_generations_fingerprint_sha256",
      sql`
        length(${table.createRequestFingerprint}) = 64
        and ${table.createRequestFingerprint} = lower(${table.createRequestFingerprint})
        and ${table.createRequestFingerprint} not glob '*[^0-9a-f]*'
      `,
    ),
    check(
      "storage_generations_directory_identity",
      sql`${table.generationDirectoryName} = ${table.generationId}`,
    ),
    check(
      "storage_generations_activation_time",
      sql`
        (${table.creationState} = 'active' and ${table.activatedAt} is not null)
        or (${table.creationState} = 'staging' and ${table.activatedAt} is null)
      `,
    ),
  ],
);

export const storageRegistrations = sqliteTable(
  "storage_registrations",
  {
    storageId: text("storage_id").primaryKey(),
    projectId: text("project_id").notNull(),
    activeGenerationId: text("active_generation_id"),
    activeLocationId: text("active_location_id"),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
  },
  (table) => [
    uniqueIndex("storage_registrations_project_uq").on(table.projectId),
    foreignKey({
      name: "storage_registrations_active_generation_fk",
      columns: [table.storageId, table.activeGenerationId],
      foreignColumns: [storageGenerations.storageId, storageGenerations.generationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "storage_registrations_active_location_fk",
      columns: [table.storageId, table.activeLocationId],
      foreignColumns: [storageLocations.storageId, storageLocations.locationId],
    }).onDelete("restrict"),
    check("storage_registrations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_registrations_project_id_uuid", domainIdentityCheck(table.projectId)),
    check(
      "storage_registrations_active_pair",
      sql`
        (
          ${table.activeGenerationId} is null
          and ${table.activeLocationId} is null
          and ${table.activatedAt} is null
        )
        or (
          ${table.activeGenerationId} is not null
          and ${table.activeLocationId} is not null
          and ${table.activatedAt} is not null
        )
      `,
    ),
  ],
);
