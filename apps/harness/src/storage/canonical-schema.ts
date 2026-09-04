import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createSchemaMetadataColumns } from "./schema-metadata-columns.js";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

export const canonicalSchemaMetadata = sqliteTable(
  "schema_metadata",
  createSchemaMetadataColumns(),
  (table) => [
    check("canonical_metadata_key", sql`${table.metadataKey} = 'canonical'`),
    check("canonical_metadata_kind", sql`${table.databaseKind} = 'canonical'`),
    check("canonical_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("canonical_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check("canonical_migration_nonempty", sql`length(trim(${table.lastMigrationId})) > 0`),
  ],
);

export const canonicalStorageIdentity = sqliteTable(
  "storage_identity",
  {
    identityKey: text("identity_key").primaryKey(),
    projectId: text("project_id").notNull(),
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    canonicalDatabaseLineageId: text("canonical_database_lineage_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("canonical_identity_singleton", sql`${table.identityKey} = 'storage'`),
    check("canonical_identity_project_uuid", domainIdentityCheck(table.projectId)),
    check("canonical_identity_storage_uuid", domainIdentityCheck(table.storageId)),
    check("canonical_identity_generation_uuid", domainIdentityCheck(table.generationId)),
    check("canonical_identity_lineage_uuid", domainIdentityCheck(table.canonicalDatabaseLineageId)),
  ],
);
