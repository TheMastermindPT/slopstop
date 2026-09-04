CREATE TABLE `schema_metadata` (
	`metadata_key` text PRIMARY KEY NOT NULL,
	`database_kind` text NOT NULL,
	`format_version` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`last_migration_id` text NOT NULL,
	CONSTRAINT "canonical_metadata_key" CHECK("schema_metadata"."metadata_key" = 'canonical'),
	CONSTRAINT "canonical_metadata_kind" CHECK("schema_metadata"."database_kind" = 'canonical'),
	CONSTRAINT "canonical_format_nonnegative" CHECK("schema_metadata"."format_version" >= 0),
	CONSTRAINT "canonical_schema_nonnegative" CHECK("schema_metadata"."schema_version" >= 0),
	CONSTRAINT "canonical_migration_nonempty" CHECK(length(trim("schema_metadata"."last_migration_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE `storage_identity` (
	`identity_key` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`storage_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`canonical_database_lineage_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "canonical_identity_singleton" CHECK("storage_identity"."identity_key" = 'storage'),
	CONSTRAINT "canonical_identity_project_uuid" CHECK(
    length("storage_identity"."project_id") = 36
    and "storage_identity"."project_id" = lower("storage_identity"."project_id")
    and substr("storage_identity"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."project_id", 9, 1) = '-'
    and substr("storage_identity"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."project_id", 14, 1) = '-'
    and substr("storage_identity"."project_id", 15, 1) glob '[1-8]'
    and substr("storage_identity"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."project_id", 19, 1) = '-'
    and substr("storage_identity"."project_id", 20, 1) glob '[89ab]'
    and substr("storage_identity"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."project_id", 24, 1) = '-'
    and substr("storage_identity"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_storage_uuid" CHECK(
    length("storage_identity"."storage_id") = 36
    and "storage_identity"."storage_id" = lower("storage_identity"."storage_id")
    and substr("storage_identity"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."storage_id", 9, 1) = '-'
    and substr("storage_identity"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."storage_id", 14, 1) = '-'
    and substr("storage_identity"."storage_id", 15, 1) glob '[1-8]'
    and substr("storage_identity"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."storage_id", 19, 1) = '-'
    and substr("storage_identity"."storage_id", 20, 1) glob '[89ab]'
    and substr("storage_identity"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."storage_id", 24, 1) = '-'
    and substr("storage_identity"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_generation_uuid" CHECK(
    length("storage_identity"."generation_id") = 36
    and "storage_identity"."generation_id" = lower("storage_identity"."generation_id")
    and substr("storage_identity"."generation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."generation_id", 9, 1) = '-'
    and substr("storage_identity"."generation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."generation_id", 14, 1) = '-'
    and substr("storage_identity"."generation_id", 15, 1) glob '[1-8]'
    and substr("storage_identity"."generation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."generation_id", 19, 1) = '-'
    and substr("storage_identity"."generation_id", 20, 1) glob '[89ab]'
    and substr("storage_identity"."generation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."generation_id", 24, 1) = '-'
    and substr("storage_identity"."generation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_lineage_uuid" CHECK(
    length("storage_identity"."canonical_database_lineage_id") = 36
    and "storage_identity"."canonical_database_lineage_id" = lower("storage_identity"."canonical_database_lineage_id")
    and substr("storage_identity"."canonical_database_lineage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."canonical_database_lineage_id", 9, 1) = '-'
    and substr("storage_identity"."canonical_database_lineage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."canonical_database_lineage_id", 14, 1) = '-'
    and substr("storage_identity"."canonical_database_lineage_id", 15, 1) glob '[1-8]'
    and substr("storage_identity"."canonical_database_lineage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."canonical_database_lineage_id", 19, 1) = '-'
    and substr("storage_identity"."canonical_database_lineage_id", 20, 1) glob '[89ab]'
    and substr("storage_identity"."canonical_database_lineage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_identity"."canonical_database_lineage_id", 24, 1) = '-'
    and substr("storage_identity"."canonical_database_lineage_id", 25, 12) not glob '*[^0-9a-f]*'
  )
);
