CREATE TABLE `canonical_events` (
	`project_id` text NOT NULL,
	`event_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`receipt_outcome` text NOT NULL,
	`project_sequence` integer NOT NULL,
	`event_ordinal` integer NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`aggregate_version` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_version` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `event_id`),
	FOREIGN KEY (`project_id`,`receipt_id`,`receipt_outcome`,`project_sequence`) REFERENCES `command_receipts`(`project_id`,`receipt_id`,`outcome`,`project_sequence`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "canonical_events_id_uuid" CHECK(
    length("canonical_events"."event_id") = 36
    and "canonical_events"."event_id" = lower("canonical_events"."event_id")
    and substr("canonical_events"."event_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 9, 1) = '-'
    and substr("canonical_events"."event_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 14, 1) = '-'
    and substr("canonical_events"."event_id", 15, 1) glob '[1-8]'
    and substr("canonical_events"."event_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 19, 1) = '-'
    and substr("canonical_events"."event_id", 20, 1) glob '[89ab]'
    and substr("canonical_events"."event_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 24, 1) = '-'
    and substr("canonical_events"."event_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_events_outcome" CHECK("canonical_events"."receipt_outcome" = 'applied'),
	CONSTRAINT "canonical_events_sequence_positive_safe" CHECK(
    typeof("canonical_events"."project_sequence") = 'integer'
    and "canonical_events"."project_sequence" > 0
    and "canonical_events"."project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_ordinal_nonnegative_safe" CHECK(
    typeof("canonical_events"."event_ordinal") = 'integer'
    and "canonical_events"."event_ordinal" >= 0
    and "canonical_events"."event_ordinal" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_aggregate_type_nonempty" CHECK(length(trim("canonical_events"."aggregate_type")) > 0),
	CONSTRAINT "canonical_events_aggregate_id_uuid" CHECK(
    length("canonical_events"."aggregate_id") = 36
    and "canonical_events"."aggregate_id" = lower("canonical_events"."aggregate_id")
    and substr("canonical_events"."aggregate_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 9, 1) = '-'
    and substr("canonical_events"."aggregate_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 14, 1) = '-'
    and substr("canonical_events"."aggregate_id", 15, 1) glob '[1-8]'
    and substr("canonical_events"."aggregate_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 19, 1) = '-'
    and substr("canonical_events"."aggregate_id", 20, 1) glob '[89ab]'
    and substr("canonical_events"."aggregate_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 24, 1) = '-'
    and substr("canonical_events"."aggregate_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_events_aggregate_version_positive_safe" CHECK(
    typeof("canonical_events"."aggregate_version") = 'integer'
    and "canonical_events"."aggregate_version" > 0
    and "canonical_events"."aggregate_version" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_type_nonempty" CHECK(length(trim("canonical_events"."event_type")) > 0),
	CONSTRAINT "canonical_events_version_positive_safe" CHECK(
    typeof("canonical_events"."event_version") = 'integer'
    and "canonical_events"."event_version" > 0
    and "canonical_events"."event_version" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_payload_nonempty" CHECK(length(trim("canonical_events"."payload_json")) > 0),
	CONSTRAINT "canonical_events_payload_sha256" CHECK(
    length("canonical_events"."payload_hash") = 64
    and "canonical_events"."payload_hash" = lower("canonical_events"."payload_hash")
    and "canonical_events"."payload_hash" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_events_sequence_ordinal_uq` ON `canonical_events` (`project_id`,`project_sequence`,`event_ordinal`);--> statement-breakpoint
CREATE INDEX `canonical_events_receipt_idx` ON `canonical_events` (`project_id`,`receipt_id`);--> statement-breakpoint
CREATE INDEX `canonical_events_aggregate_idx` ON `canonical_events` (`project_id`,`aggregate_type`,`aggregate_id`,`aggregate_version`);--> statement-breakpoint
CREATE TABLE `project_state` (
	`project_id` text PRIMARY KEY NOT NULL,
	`last_project_sequence` integer NOT NULL,
	`last_writer_generation` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "project_state_project_uuid" CHECK(
    length("project_state"."project_id") = 36
    and "project_state"."project_id" = lower("project_state"."project_id")
    and substr("project_state"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 9, 1) = '-'
    and substr("project_state"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 14, 1) = '-'
    and substr("project_state"."project_id", 15, 1) glob '[1-8]'
    and substr("project_state"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 19, 1) = '-'
    and substr("project_state"."project_id", 20, 1) glob '[89ab]'
    and substr("project_state"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 24, 1) = '-'
    and substr("project_state"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "project_state_sequence_nonnegative_safe" CHECK(
    typeof("project_state"."last_project_sequence") = 'integer'
    and "project_state"."last_project_sequence" >= 0
    and "project_state"."last_project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "project_state_writer_generation_nonnegative_safe" CHECK(
    typeof("project_state"."last_writer_generation") = 'integer'
    and "project_state"."last_writer_generation" >= 0
    and "project_state"."last_writer_generation" <= 9007199254740991
  )
);
--> statement-breakpoint
CREATE TABLE `command_idempotency` (
	`project_id` text NOT NULL,
	`command_id` text NOT NULL,
	`original_command_fingerprint` text NOT NULL,
	`original_receipt_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `command_id`),
	FOREIGN KEY (`project_id`,`original_receipt_id`,`command_id`,`original_command_fingerprint`) REFERENCES `command_receipts`(`project_id`,`receipt_id`,`command_id`,`command_fingerprint`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "command_idempotency_command_uuid" CHECK(
    length("command_idempotency"."command_id") = 36
    and "command_idempotency"."command_id" = lower("command_idempotency"."command_id")
    and substr("command_idempotency"."command_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 9, 1) = '-'
    and substr("command_idempotency"."command_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 14, 1) = '-'
    and substr("command_idempotency"."command_id", 15, 1) glob '[1-8]'
    and substr("command_idempotency"."command_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 19, 1) = '-'
    and substr("command_idempotency"."command_id", 20, 1) glob '[89ab]'
    and substr("command_idempotency"."command_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 24, 1) = '-'
    and substr("command_idempotency"."command_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_idempotency_fingerprint_sha256" CHECK(
    length("command_idempotency"."original_command_fingerprint") = 64
    and "command_idempotency"."original_command_fingerprint" = lower("command_idempotency"."original_command_fingerprint")
    and "command_idempotency"."original_command_fingerprint" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `command_idempotency_receipt_uq` ON `command_idempotency` (`project_id`,`original_receipt_id`);--> statement-breakpoint
CREATE TABLE `command_receipts` (
	`project_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`command_id` text NOT NULL,
	`command_type` text NOT NULL,
	`command_version` integer NOT NULL,
	`command_fingerprint` text NOT NULL,
	`outcome` text NOT NULL,
	`project_sequence` integer NOT NULL,
	`writer_generation` integer NOT NULL,
	`settled_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `receipt_id`),
	FOREIGN KEY (`project_id`,`writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "command_receipts_id_uuid" CHECK(
    length("command_receipts"."receipt_id") = 36
    and "command_receipts"."receipt_id" = lower("command_receipts"."receipt_id")
    and substr("command_receipts"."receipt_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 9, 1) = '-'
    and substr("command_receipts"."receipt_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 14, 1) = '-'
    and substr("command_receipts"."receipt_id", 15, 1) glob '[1-8]'
    and substr("command_receipts"."receipt_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 19, 1) = '-'
    and substr("command_receipts"."receipt_id", 20, 1) glob '[89ab]'
    and substr("command_receipts"."receipt_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 24, 1) = '-'
    and substr("command_receipts"."receipt_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_receipts_command_uuid" CHECK(
    length("command_receipts"."command_id") = 36
    and "command_receipts"."command_id" = lower("command_receipts"."command_id")
    and substr("command_receipts"."command_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 9, 1) = '-'
    and substr("command_receipts"."command_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 14, 1) = '-'
    and substr("command_receipts"."command_id", 15, 1) glob '[1-8]'
    and substr("command_receipts"."command_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 19, 1) = '-'
    and substr("command_receipts"."command_id", 20, 1) glob '[89ab]'
    and substr("command_receipts"."command_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 24, 1) = '-'
    and substr("command_receipts"."command_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_receipts_type_nonempty" CHECK(length(trim("command_receipts"."command_type")) > 0),
	CONSTRAINT "command_receipts_version_positive_safe" CHECK(
    typeof("command_receipts"."command_version") = 'integer'
    and "command_receipts"."command_version" > 0
    and "command_receipts"."command_version" <= 9007199254740991
  ),
	CONSTRAINT "command_receipts_fingerprint_sha256" CHECK(
    length("command_receipts"."command_fingerprint") = 64
    and "command_receipts"."command_fingerprint" = lower("command_receipts"."command_fingerprint")
    and "command_receipts"."command_fingerprint" not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_receipts_outcome" CHECK("command_receipts"."outcome" in ('applied', 'unchanged', 'rejected')),
	CONSTRAINT "command_receipts_sequence_positive_safe" CHECK(
    typeof("command_receipts"."project_sequence") = 'integer'
    and "command_receipts"."project_sequence" > 0
    and "command_receipts"."project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "command_receipts_writer_generation_positive_safe" CHECK(
    typeof("command_receipts"."writer_generation") = 'integer'
    and "command_receipts"."writer_generation" > 0
    and "command_receipts"."writer_generation" <= 9007199254740991
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_command_fingerprint_uq` ON `command_receipts` (`project_id`,`command_id`,`command_fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_project_sequence_uq` ON `command_receipts` (`project_id`,`project_sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_idempotency_binding_uq` ON `command_receipts` (`project_id`,`receipt_id`,`command_id`,`command_fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_settlement_binding_uq` ON `command_receipts` (`project_id`,`receipt_id`,`outcome`,`project_sequence`);--> statement-breakpoint
CREATE TABLE `command_rejections` (
	`project_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`receipt_outcome` text NOT NULL,
	`project_sequence` integer NOT NULL,
	`rejection_code` text NOT NULL,
	`retryable` integer NOT NULL,
	`details_json` text NOT NULL,
	`details_hash` text NOT NULL,
	PRIMARY KEY(`project_id`, `receipt_id`),
	FOREIGN KEY (`project_id`,`receipt_id`,`receipt_outcome`,`project_sequence`) REFERENCES `command_receipts`(`project_id`,`receipt_id`,`outcome`,`project_sequence`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "command_rejections_outcome" CHECK("command_rejections"."receipt_outcome" = 'rejected'),
	CONSTRAINT "command_rejections_sequence_positive_safe" CHECK(
    typeof("command_rejections"."project_sequence") = 'integer'
    and "command_rejections"."project_sequence" > 0
    and "command_rejections"."project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "command_rejections_code_nonempty" CHECK(length(trim("command_rejections"."rejection_code")) > 0),
	CONSTRAINT "command_rejections_retryable_boolean" CHECK("command_rejections"."retryable" in (0, 1)),
	CONSTRAINT "command_rejections_details_nonempty" CHECK(length(trim("command_rejections"."details_json")) > 0),
	CONSTRAINT "command_rejections_details_sha256" CHECK(
    length("command_rejections"."details_hash") = 64
    and "command_rejections"."details_hash" = lower("command_rejections"."details_hash")
    and "command_rejections"."details_hash" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE TABLE `writer_fence` (
	`project_id` text PRIMARY KEY NOT NULL,
	`writer_generation` integer NOT NULL,
	`token_digest` text NOT NULL,
	`state` text NOT NULL,
	`activated_at` text NOT NULL,
	`released_at` text,
	FOREIGN KEY (`project_id`,`writer_generation`,`token_digest`) REFERENCES `writer_generations`(`project_id`,`writer_generation`,`token_digest`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_fence_generation_positive_safe" CHECK(
    typeof("writer_fence"."writer_generation") = 'integer'
    and "writer_fence"."writer_generation" > 0
    and "writer_fence"."writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_fence_token_sha256" CHECK(
    length("writer_fence"."token_digest") = 64
    and "writer_fence"."token_digest" = lower("writer_fence"."token_digest")
    and "writer_fence"."token_digest" not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_fence_state" CHECK("writer_fence"."state" in ('active', 'released')),
	CONSTRAINT "writer_fence_release_shape" CHECK(
        ("writer_fence"."state" = 'active' and "writer_fence"."released_at" is null)
        or ("writer_fence"."state" = 'released' and "writer_fence"."released_at" is not null)
      )
);
--> statement-breakpoint
CREATE TABLE `writer_generations` (
	`project_id` text NOT NULL,
	`writer_generation` integer NOT NULL,
	`activation_id` text NOT NULL,
	`token_digest` text NOT NULL,
	`acquired_at` text NOT NULL,
	`released_at` text,
	PRIMARY KEY(`project_id`, `writer_generation`),
	FOREIGN KEY (`project_id`) REFERENCES `project_state`(`project_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_generations_generation_positive_safe" CHECK(
    typeof("writer_generations"."writer_generation") = 'integer'
    and "writer_generations"."writer_generation" > 0
    and "writer_generations"."writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_generations_activation_uuid" CHECK(
    length("writer_generations"."activation_id") = 36
    and "writer_generations"."activation_id" = lower("writer_generations"."activation_id")
    and substr("writer_generations"."activation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 9, 1) = '-'
    and substr("writer_generations"."activation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 14, 1) = '-'
    and substr("writer_generations"."activation_id", 15, 1) glob '[1-8]'
    and substr("writer_generations"."activation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 19, 1) = '-'
    and substr("writer_generations"."activation_id", 20, 1) glob '[89ab]'
    and substr("writer_generations"."activation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 24, 1) = '-'
    and substr("writer_generations"."activation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_generations_token_sha256" CHECK(
    length("writer_generations"."token_digest") = 64
    and "writer_generations"."token_digest" = lower("writer_generations"."token_digest")
    and "writer_generations"."token_digest" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writer_generations_activation_uq` ON `writer_generations` (`project_id`,`activation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `writer_generations_fence_uq` ON `writer_generations` (`project_id`,`writer_generation`,`token_digest`);--> statement-breakpoint
CREATE TABLE `writer_handoffs` (
	`project_id` text NOT NULL,
	`handoff_id` text NOT NULL,
	`from_writer_generation` integer,
	`to_writer_generation` integer NOT NULL,
	`kind` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `handoff_id`),
	FOREIGN KEY (`project_id`,`from_writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`,`to_writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_handoffs_id_uuid" CHECK(
    length("writer_handoffs"."handoff_id") = 36
    and "writer_handoffs"."handoff_id" = lower("writer_handoffs"."handoff_id")
    and substr("writer_handoffs"."handoff_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 9, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 14, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 15, 1) glob '[1-8]'
    and substr("writer_handoffs"."handoff_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 19, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 20, 1) glob '[89ab]'
    and substr("writer_handoffs"."handoff_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 24, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_handoffs_from_generation_positive_safe" CHECK("writer_handoffs"."from_writer_generation" is null or (
    typeof("writer_handoffs"."from_writer_generation") = 'integer'
    and "writer_handoffs"."from_writer_generation" > 0
    and "writer_handoffs"."from_writer_generation" <= 9007199254740991
  )),
	CONSTRAINT "writer_handoffs_to_generation_positive_safe" CHECK(
    typeof("writer_handoffs"."to_writer_generation") = 'integer'
    and "writer_handoffs"."to_writer_generation" > 0
    and "writer_handoffs"."to_writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_handoffs_kind" CHECK("writer_handoffs"."kind" in ('initial', 'clean', 'recovery')),
	CONSTRAINT "writer_handoffs_predecessor_shape" CHECK(
        ("writer_handoffs"."kind" = 'initial' and "writer_handoffs"."from_writer_generation" is null)
        or ("writer_handoffs"."kind" in ('clean', 'recovery') and "writer_handoffs"."from_writer_generation" is not null)
      ),
	CONSTRAINT "writer_handoffs_generation_order" CHECK("writer_handoffs"."from_writer_generation" is null or "writer_handoffs"."to_writer_generation" > "writer_handoffs"."from_writer_generation")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writer_handoffs_to_generation_uq` ON `writer_handoffs` (`project_id`,`to_writer_generation`);--> statement-breakpoint
CREATE INDEX `writer_handoffs_from_generation_idx` ON `writer_handoffs` (`project_id`,`from_writer_generation`);--> statement-breakpoint
CREATE TABLE `writer_recovery_records` (
	`project_id` text NOT NULL,
	`recovery_record_id` text NOT NULL,
	`writer_generation` integer NOT NULL,
	`reason` text NOT NULL,
	`command_id` text,
	`command_fingerprint` text,
	`observed_at` text NOT NULL,
	`resolution` text,
	`resolved_by_writer_generation` integer,
	`resolved_at` text,
	PRIMARY KEY(`project_id`, `recovery_record_id`),
	FOREIGN KEY (`project_id`,`writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`,`resolved_by_writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_recovery_records_id_uuid" CHECK(
    length("writer_recovery_records"."recovery_record_id") = 36
    and "writer_recovery_records"."recovery_record_id" = lower("writer_recovery_records"."recovery_record_id")
    and substr("writer_recovery_records"."recovery_record_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 9, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 14, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 15, 1) glob '[1-8]'
    and substr("writer_recovery_records"."recovery_record_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 19, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 20, 1) glob '[89ab]'
    and substr("writer_recovery_records"."recovery_record_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 24, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_recovery_records_generation_positive_safe" CHECK(
    typeof("writer_recovery_records"."writer_generation") = 'integer'
    and "writer_recovery_records"."writer_generation" > 0
    and "writer_recovery_records"."writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_recovery_records_reason" CHECK("writer_recovery_records"."reason" in ('commit-uncertain', 'abandoned-active-fence')),
	CONSTRAINT "writer_recovery_records_command_uuid" CHECK("writer_recovery_records"."command_id" is null or (
    length("writer_recovery_records"."command_id") = 36
    and "writer_recovery_records"."command_id" = lower("writer_recovery_records"."command_id")
    and substr("writer_recovery_records"."command_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 9, 1) = '-'
    and substr("writer_recovery_records"."command_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 14, 1) = '-'
    and substr("writer_recovery_records"."command_id", 15, 1) glob '[1-8]'
    and substr("writer_recovery_records"."command_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 19, 1) = '-'
    and substr("writer_recovery_records"."command_id", 20, 1) glob '[89ab]'
    and substr("writer_recovery_records"."command_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 24, 1) = '-'
    and substr("writer_recovery_records"."command_id", 25, 12) not glob '*[^0-9a-f]*'
  )),
	CONSTRAINT "writer_recovery_records_fingerprint_sha256" CHECK("writer_recovery_records"."command_fingerprint" is null or (
    length("writer_recovery_records"."command_fingerprint") = 64
    and "writer_recovery_records"."command_fingerprint" = lower("writer_recovery_records"."command_fingerprint")
    and "writer_recovery_records"."command_fingerprint" not glob '*[^0-9a-f]*'
  )),
	CONSTRAINT "writer_recovery_records_command_shape" CHECK(
        (
          "writer_recovery_records"."reason" = 'commit-uncertain'
          and "writer_recovery_records"."command_id" is not null
          and "writer_recovery_records"."command_fingerprint" is not null
        )
        or (
          "writer_recovery_records"."reason" = 'abandoned-active-fence'
          and "writer_recovery_records"."command_id" is null
          and "writer_recovery_records"."command_fingerprint" is null
        )
      ),
	CONSTRAINT "writer_recovery_records_resolution" CHECK(
        "writer_recovery_records"."resolution" is null
        or (
          "writer_recovery_records"."reason" = 'commit-uncertain'
          and "writer_recovery_records"."resolution" in ('receipt-found', 'receipt-absent')
        )
        or (
          "writer_recovery_records"."reason" = 'abandoned-active-fence'
          and "writer_recovery_records"."resolution" = 'generation-superseded'
        )
      ),
	CONSTRAINT "writer_recovery_records_resolution_shape" CHECK(
        (
          "writer_recovery_records"."resolution" is null
          and "writer_recovery_records"."resolved_by_writer_generation" is null
          and "writer_recovery_records"."resolved_at" is null
        )
        or (
          "writer_recovery_records"."resolution" is not null
          and "writer_recovery_records"."resolved_by_writer_generation" is not null
          and "writer_recovery_records"."resolved_at" is not null
        )
      ),
	CONSTRAINT "writer_recovery_records_resolver_order" CHECK(
        "writer_recovery_records"."resolved_by_writer_generation" is null
        or (
          
    typeof("writer_recovery_records"."resolved_by_writer_generation") = 'integer'
    and "writer_recovery_records"."resolved_by_writer_generation" > 0
    and "writer_recovery_records"."resolved_by_writer_generation" <= 9007199254740991
  
          and "writer_recovery_records"."resolved_by_writer_generation" > "writer_recovery_records"."writer_generation"
        )
      )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writer_recovery_records_generation_uq` ON `writer_recovery_records` (`project_id`,`writer_generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `writer_recovery_records_unresolved_uq` ON `writer_recovery_records` (`project_id`) WHERE "writer_recovery_records"."resolution" is null;--> statement-breakpoint
CREATE INDEX `writer_recovery_records_command_idx` ON `writer_recovery_records` (`project_id`,`command_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_storage_identity` (
	`identity_key` text NOT NULL,
	`project_id` text NOT NULL,
	`storage_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`canonical_database_lineage_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `identity_key`),
	FOREIGN KEY (`project_id`) REFERENCES `project_state`(`project_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "canonical_identity_singleton" CHECK("__new_storage_identity"."identity_key" = 'storage'),
	CONSTRAINT "canonical_identity_project_uuid" CHECK(
    length("__new_storage_identity"."project_id") = 36
    and "__new_storage_identity"."project_id" = lower("__new_storage_identity"."project_id")
    and substr("__new_storage_identity"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 9, 1) = '-'
    and substr("__new_storage_identity"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 14, 1) = '-'
    and substr("__new_storage_identity"."project_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 19, 1) = '-'
    and substr("__new_storage_identity"."project_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 24, 1) = '-'
    and substr("__new_storage_identity"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_storage_uuid" CHECK(
    length("__new_storage_identity"."storage_id") = 36
    and "__new_storage_identity"."storage_id" = lower("__new_storage_identity"."storage_id")
    and substr("__new_storage_identity"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 9, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 14, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 19, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 24, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_generation_uuid" CHECK(
    length("__new_storage_identity"."generation_id") = 36
    and "__new_storage_identity"."generation_id" = lower("__new_storage_identity"."generation_id")
    and substr("__new_storage_identity"."generation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 9, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 14, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."generation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 19, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."generation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 24, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_lineage_uuid" CHECK(
    length("__new_storage_identity"."canonical_database_lineage_id") = 36
    and "__new_storage_identity"."canonical_database_lineage_id" = lower("__new_storage_identity"."canonical_database_lineage_id")
    and substr("__new_storage_identity"."canonical_database_lineage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 9, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 14, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 19, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 24, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 25, 12) not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
INSERT INTO `__new_storage_identity`("identity_key", "project_id", "storage_id", "generation_id", "canonical_database_lineage_id", "created_at") SELECT "identity_key", "project_id", "storage_id", "generation_id", "canonical_database_lineage_id", "created_at" FROM `storage_identity`;--> statement-breakpoint
DROP TABLE `storage_identity`;--> statement-breakpoint
ALTER TABLE `__new_storage_identity` RENAME TO `storage_identity`;--> statement-breakpoint
PRAGMA foreign_keys=ON;