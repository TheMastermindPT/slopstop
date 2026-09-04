import { integer, text } from "drizzle-orm/sqlite-core";

export function createSchemaMetadataColumns() {
  return {
    metadataKey: text("metadata_key").primaryKey(),
    databaseKind: text("database_kind").notNull(),
    formatVersion: integer("format_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    lastMigrationId: text("last_migration_id").notNull(),
  };
}
