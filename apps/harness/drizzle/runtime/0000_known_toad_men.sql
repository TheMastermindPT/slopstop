CREATE TABLE `slopstop_runtime_schema_metadata` (
	`metadata_key` text PRIMARY KEY NOT NULL,
	`database_kind` text NOT NULL,
	`format_version` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`last_migration_id` text NOT NULL,
	CONSTRAINT "runtime_metadata_key" CHECK("slopstop_runtime_schema_metadata"."metadata_key" = 'slopstop-runtime-adapter'),
	CONSTRAINT "runtime_metadata_kind" CHECK("slopstop_runtime_schema_metadata"."database_kind" = 'runtime-adapter'),
	CONSTRAINT "runtime_format_nonnegative" CHECK("slopstop_runtime_schema_metadata"."format_version" >= 0),
	CONSTRAINT "runtime_schema_nonnegative" CHECK("slopstop_runtime_schema_metadata"."schema_version" >= 0),
	CONSTRAINT "runtime_migration_nonempty" CHECK(length(trim("slopstop_runtime_schema_metadata"."last_migration_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE `slopstop_runtime_storage_identity` (
	`identity_key` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`storage_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`runtime_database_lineage_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "runtime_identity_singleton" CHECK("slopstop_runtime_storage_identity"."identity_key" = 'storage'),
	CONSTRAINT "runtime_identity_project_uuid" CHECK(
    length("slopstop_runtime_storage_identity"."project_id") = 36
    and "slopstop_runtime_storage_identity"."project_id" = lower("slopstop_runtime_storage_identity"."project_id")
    and substr("slopstop_runtime_storage_identity"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."project_id", 9, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."project_id", 14, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."project_id", 15, 1) glob '[1-8]'
    and substr("slopstop_runtime_storage_identity"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."project_id", 19, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."project_id", 20, 1) glob '[89ab]'
    and substr("slopstop_runtime_storage_identity"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."project_id", 24, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "runtime_identity_storage_uuid" CHECK(
    length("slopstop_runtime_storage_identity"."storage_id") = 36
    and "slopstop_runtime_storage_identity"."storage_id" = lower("slopstop_runtime_storage_identity"."storage_id")
    and substr("slopstop_runtime_storage_identity"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."storage_id", 9, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."storage_id", 14, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."storage_id", 15, 1) glob '[1-8]'
    and substr("slopstop_runtime_storage_identity"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."storage_id", 19, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."storage_id", 20, 1) glob '[89ab]'
    and substr("slopstop_runtime_storage_identity"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."storage_id", 24, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "runtime_identity_generation_uuid" CHECK(
    length("slopstop_runtime_storage_identity"."generation_id") = 36
    and "slopstop_runtime_storage_identity"."generation_id" = lower("slopstop_runtime_storage_identity"."generation_id")
    and substr("slopstop_runtime_storage_identity"."generation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."generation_id", 9, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."generation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."generation_id", 14, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."generation_id", 15, 1) glob '[1-8]'
    and substr("slopstop_runtime_storage_identity"."generation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."generation_id", 19, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."generation_id", 20, 1) glob '[89ab]'
    and substr("slopstop_runtime_storage_identity"."generation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."generation_id", 24, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."generation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "runtime_identity_lineage_uuid" CHECK(
    length("slopstop_runtime_storage_identity"."runtime_database_lineage_id") = 36
    and "slopstop_runtime_storage_identity"."runtime_database_lineage_id" = lower("slopstop_runtime_storage_identity"."runtime_database_lineage_id")
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 9, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 14, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 15, 1) glob '[1-8]'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 19, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 20, 1) glob '[89ab]'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 24, 1) = '-'
    and substr("slopstop_runtime_storage_identity"."runtime_database_lineage_id", 25, 12) not glob '*[^0-9a-f]*'
  )
);
