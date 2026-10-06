CREATE TABLE `storage_upgrades` (
	`upgrade_id` text PRIMARY KEY NOT NULL,
	`storage_id` text NOT NULL,
	`project_id` text NOT NULL,
	`location_id` text NOT NULL,
	`source_generation_id` text NOT NULL,
	`target_generation_id` text NOT NULL,
	`source_canonical_lineage_id` text NOT NULL,
	`source_runtime_lineage_id` text NOT NULL,
	`source_create_request_id` text NOT NULL,
	`source_create_request_fingerprint` text NOT NULL,
	`source_created_at` text NOT NULL,
	`source_activated_at` text NOT NULL,
	`state` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	CONSTRAINT "storage_upgrades_state" CHECK("storage_upgrades"."state" in ('in-progress', 'completed')),
	CONSTRAINT "storage_upgrades_completion" CHECK(("storage_upgrades"."state" = 'in-progress') = ("storage_upgrades"."completed_at" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_upgrades_one_in_progress_uq` ON `storage_upgrades` (`storage_id`) WHERE "storage_upgrades"."state" = 'in-progress';--> statement-breakpoint
CREATE UNIQUE INDEX `storage_upgrades_source_generation_uq` ON `storage_upgrades` (`source_generation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `storage_upgrades_source_create_request_uq` ON `storage_upgrades` (`source_create_request_id`);