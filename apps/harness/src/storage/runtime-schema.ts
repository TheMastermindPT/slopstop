import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createSchemaMetadataColumns } from "./schema-metadata-columns.js";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

export const runtimeSchemaMetadata = sqliteTable(
  "slopstop_runtime_schema_metadata",
  createSchemaMetadataColumns(),
  (table) => [
    check("runtime_metadata_key", sql`${table.metadataKey} = 'slopstop-runtime-adapter'`),
    check("runtime_metadata_kind", sql`${table.databaseKind} = 'runtime-adapter'`),
    check("runtime_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("runtime_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check("runtime_migration_nonempty", sql`length(trim(${table.lastMigrationId})) > 0`),
  ],
);

export const runtimeStorageIdentity = sqliteTable(
  "slopstop_runtime_storage_identity",
  {
    identityKey: text("identity_key").primaryKey(),
    projectId: text("project_id").notNull(),
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    runtimeDatabaseLineageId: text("runtime_database_lineage_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("runtime_identity_singleton", sql`${table.identityKey} = 'storage'`),
    check("runtime_identity_project_uuid", domainIdentityCheck(table.projectId)),
    check("runtime_identity_storage_uuid", domainIdentityCheck(table.storageId)),
    check("runtime_identity_generation_uuid", domainIdentityCheck(table.generationId)),
    check("runtime_identity_lineage_uuid", domainIdentityCheck(table.runtimeDatabaseLineageId)),
  ],
);
