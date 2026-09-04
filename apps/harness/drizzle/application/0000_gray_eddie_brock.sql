CREATE TABLE `schema_metadata` (
	`metadata_key` text PRIMARY KEY NOT NULL,
	`database_kind` text NOT NULL,
	`format_version` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`last_migration_id` text NOT NULL,
	CONSTRAINT "application_metadata_key" CHECK("schema_metadata"."metadata_key" = 'application'),
	CONSTRAINT "application_metadata_kind" CHECK("schema_metadata"."database_kind" = 'application'),
	CONSTRAINT "application_format_nonnegative" CHECK("schema_metadata"."format_version" >= 0),
	CONSTRAINT "application_schema_nonnegative" CHECK("schema_metadata"."schema_version" >= 0),
	CONSTRAINT "application_migration_nonempty" CHECK(length(trim("schema_metadata"."last_migration_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE `storage_generations` (
	`storage_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`project_id` text NOT NULL,
	`location_id` text NOT NULL,
	`canonical_lineage_id` text NOT NULL,
	`runtime_lineage_id` text NOT NULL,
	`create_request_id` text NOT NULL,
	`create_request_fingerprint` text NOT NULL,
	`generation_directory_name` text NOT NULL,
	`creation_state` text NOT NULL,
	`created_at` text NOT NULL,
	`activated_at` text,
	PRIMARY KEY(`storage_id`, `generation_id`),
	FOREIGN KEY (`storage_id`,`location_id`) REFERENCES `storage_locations`(`storage_id`,`location_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "storage_generations_storage_id_uuid" CHECK(
    length("storage_generations"."storage_id") = 36
    and "storage_generations"."storage_id" = lower("storage_generations"."storage_id")
    and substr("storage_generations"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."storage_id", 9, 1) = '-'
    and substr("storage_generations"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."storage_id", 14, 1) = '-'
    and substr("storage_generations"."storage_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."storage_id", 19, 1) = '-'
    and substr("storage_generations"."storage_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."storage_id", 24, 1) = '-'
    and substr("storage_generations"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_generation_id_uuid" CHECK(
    length("storage_generations"."generation_id") = 36
    and "storage_generations"."generation_id" = lower("storage_generations"."generation_id")
    and substr("storage_generations"."generation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."generation_id", 9, 1) = '-'
    and substr("storage_generations"."generation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."generation_id", 14, 1) = '-'
    and substr("storage_generations"."generation_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."generation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."generation_id", 19, 1) = '-'
    and substr("storage_generations"."generation_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."generation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."generation_id", 24, 1) = '-'
    and substr("storage_generations"."generation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_project_id_uuid" CHECK(
    length("storage_generations"."project_id") = 36
    and "storage_generations"."project_id" = lower("storage_generations"."project_id")
    and substr("storage_generations"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."project_id", 9, 1) = '-'
    and substr("storage_generations"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."project_id", 14, 1) = '-'
    and substr("storage_generations"."project_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."project_id", 19, 1) = '-'
    and substr("storage_generations"."project_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."project_id", 24, 1) = '-'
    and substr("storage_generations"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_location_id_uuid" CHECK(
    length("storage_generations"."location_id") = 36
    and "storage_generations"."location_id" = lower("storage_generations"."location_id")
    and substr("storage_generations"."location_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."location_id", 9, 1) = '-'
    and substr("storage_generations"."location_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."location_id", 14, 1) = '-'
    and substr("storage_generations"."location_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."location_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."location_id", 19, 1) = '-'
    and substr("storage_generations"."location_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."location_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."location_id", 24, 1) = '-'
    and substr("storage_generations"."location_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_canonical_lineage_uuid" CHECK(
    length("storage_generations"."canonical_lineage_id") = 36
    and "storage_generations"."canonical_lineage_id" = lower("storage_generations"."canonical_lineage_id")
    and substr("storage_generations"."canonical_lineage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."canonical_lineage_id", 9, 1) = '-'
    and substr("storage_generations"."canonical_lineage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."canonical_lineage_id", 14, 1) = '-'
    and substr("storage_generations"."canonical_lineage_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."canonical_lineage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."canonical_lineage_id", 19, 1) = '-'
    and substr("storage_generations"."canonical_lineage_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."canonical_lineage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."canonical_lineage_id", 24, 1) = '-'
    and substr("storage_generations"."canonical_lineage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_runtime_lineage_uuid" CHECK(
    length("storage_generations"."runtime_lineage_id") = 36
    and "storage_generations"."runtime_lineage_id" = lower("storage_generations"."runtime_lineage_id")
    and substr("storage_generations"."runtime_lineage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."runtime_lineage_id", 9, 1) = '-'
    and substr("storage_generations"."runtime_lineage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."runtime_lineage_id", 14, 1) = '-'
    and substr("storage_generations"."runtime_lineage_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."runtime_lineage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."runtime_lineage_id", 19, 1) = '-'
    and substr("storage_generations"."runtime_lineage_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."runtime_lineage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."runtime_lineage_id", 24, 1) = '-'
    and substr("storage_generations"."runtime_lineage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_create_request_uuid" CHECK(
    length("storage_generations"."create_request_id") = 36
    and "storage_generations"."create_request_id" = lower("storage_generations"."create_request_id")
    and substr("storage_generations"."create_request_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."create_request_id", 9, 1) = '-'
    and substr("storage_generations"."create_request_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."create_request_id", 14, 1) = '-'
    and substr("storage_generations"."create_request_id", 15, 1) glob '[1-8]'
    and substr("storage_generations"."create_request_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."create_request_id", 19, 1) = '-'
    and substr("storage_generations"."create_request_id", 20, 1) glob '[89ab]'
    and substr("storage_generations"."create_request_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_generations"."create_request_id", 24, 1) = '-'
    and substr("storage_generations"."create_request_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_generations_fingerprint_sha256" CHECK(
        length("storage_generations"."create_request_fingerprint") = 64
        and "storage_generations"."create_request_fingerprint" = lower("storage_generations"."create_request_fingerprint")
        and "storage_generations"."create_request_fingerprint" not glob '*[^0-9a-f]*'
      ),
	CONSTRAINT "storage_generations_directory_identity" CHECK("storage_generations"."generation_directory_name" = "storage_generations"."generation_id"),
	CONSTRAINT "storage_generations_activation_time" CHECK(
        ("storage_generations"."creation_state" = 'active' and "storage_generations"."activated_at" is not null)
        or ("storage_generations"."creation_state" = 'staging' and "storage_generations"."activated_at" is null)
      )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_generations_create_request_uq` ON `storage_generations` (`create_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `storage_generations_directory_uq` ON `storage_generations` (`storage_id`,`generation_directory_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `storage_generations_one_active_uq` ON `storage_generations` (`storage_id`) WHERE "storage_generations"."creation_state" = 'active';--> statement-breakpoint
CREATE INDEX `storage_generations_project_idx` ON `storage_generations` (`project_id`);--> statement-breakpoint
CREATE INDEX `storage_generations_state_idx` ON `storage_generations` (`storage_id`,`creation_state`);--> statement-breakpoint
CREATE TABLE `storage_locations` (
	`storage_id` text NOT NULL,
	`location_id` text NOT NULL,
	`normalized_path` text NOT NULL,
	`location_state` text NOT NULL,
	`observed_at` text NOT NULL,
	PRIMARY KEY(`storage_id`, `location_id`),
	CONSTRAINT "storage_locations_storage_id_uuid" CHECK(
    length("storage_locations"."storage_id") = 36
    and "storage_locations"."storage_id" = lower("storage_locations"."storage_id")
    and substr("storage_locations"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."storage_id", 9, 1) = '-'
    and substr("storage_locations"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."storage_id", 14, 1) = '-'
    and substr("storage_locations"."storage_id", 15, 1) glob '[1-8]'
    and substr("storage_locations"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."storage_id", 19, 1) = '-'
    and substr("storage_locations"."storage_id", 20, 1) glob '[89ab]'
    and substr("storage_locations"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."storage_id", 24, 1) = '-'
    and substr("storage_locations"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_locations_location_id_uuid" CHECK(
    length("storage_locations"."location_id") = 36
    and "storage_locations"."location_id" = lower("storage_locations"."location_id")
    and substr("storage_locations"."location_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."location_id", 9, 1) = '-'
    and substr("storage_locations"."location_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."location_id", 14, 1) = '-'
    and substr("storage_locations"."location_id", 15, 1) glob '[1-8]'
    and substr("storage_locations"."location_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."location_id", 19, 1) = '-'
    and substr("storage_locations"."location_id", 20, 1) glob '[89ab]'
    and substr("storage_locations"."location_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_locations"."location_id", 24, 1) = '-'
    and substr("storage_locations"."location_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_locations_state" CHECK("storage_locations"."location_state" in ('staging', 'committed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_locations_normalized_path_uq` ON `storage_locations` (`normalized_path`);--> statement-breakpoint
CREATE TABLE `storage_registrations` (
	`storage_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`active_generation_id` text,
	`active_location_id` text,
	`created_at` text NOT NULL,
	`activated_at` text,
	FOREIGN KEY (`storage_id`,`active_generation_id`) REFERENCES `storage_generations`(`storage_id`,`generation_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`storage_id`,`active_location_id`) REFERENCES `storage_locations`(`storage_id`,`location_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "storage_registrations_storage_id_uuid" CHECK(
    length("storage_registrations"."storage_id") = 36
    and "storage_registrations"."storage_id" = lower("storage_registrations"."storage_id")
    and substr("storage_registrations"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."storage_id", 9, 1) = '-'
    and substr("storage_registrations"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."storage_id", 14, 1) = '-'
    and substr("storage_registrations"."storage_id", 15, 1) glob '[1-8]'
    and substr("storage_registrations"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."storage_id", 19, 1) = '-'
    and substr("storage_registrations"."storage_id", 20, 1) glob '[89ab]'
    and substr("storage_registrations"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."storage_id", 24, 1) = '-'
    and substr("storage_registrations"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_registrations_project_id_uuid" CHECK(
    length("storage_registrations"."project_id") = 36
    and "storage_registrations"."project_id" = lower("storage_registrations"."project_id")
    and substr("storage_registrations"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."project_id", 9, 1) = '-'
    and substr("storage_registrations"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."project_id", 14, 1) = '-'
    and substr("storage_registrations"."project_id", 15, 1) glob '[1-8]'
    and substr("storage_registrations"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."project_id", 19, 1) = '-'
    and substr("storage_registrations"."project_id", 20, 1) glob '[89ab]'
    and substr("storage_registrations"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("storage_registrations"."project_id", 24, 1) = '-'
    and substr("storage_registrations"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "storage_registrations_active_pair" CHECK(
        (
          "storage_registrations"."active_generation_id" is null
          and "storage_registrations"."active_location_id" is null
          and "storage_registrations"."activated_at" is null
        )
        or (
          "storage_registrations"."active_generation_id" is not null
          and "storage_registrations"."active_location_id" is not null
          and "storage_registrations"."activated_at" is not null
        )
      )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_registrations_project_uq` ON `storage_registrations` (`project_id`);