CREATE TABLE `registration_executable_selections` (
	`selection_id` text PRIMARY KEY NOT NULL,
	`executable_path` text NOT NULL,
	`platform` text NOT NULL,
	`volume_identity` text NOT NULL,
	`file_identity` text NOT NULL,
	`birth_identity` text NOT NULL,
	`sha256` text NOT NULL,
	`captured_at` text NOT NULL,
	CONSTRAINT "registration_executable_selection_uuid" CHECK(
    length("registration_executable_selections"."selection_id") = 36
    and "registration_executable_selections"."selection_id" = lower("registration_executable_selections"."selection_id")
    and substr("registration_executable_selections"."selection_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("registration_executable_selections"."selection_id", 9, 1) = '-'
    and substr("registration_executable_selections"."selection_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("registration_executable_selections"."selection_id", 14, 1) = '-'
    and substr("registration_executable_selections"."selection_id", 15, 1) glob '[1-8]'
    and substr("registration_executable_selections"."selection_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("registration_executable_selections"."selection_id", 19, 1) = '-'
    and substr("registration_executable_selections"."selection_id", 20, 1) glob '[89ab]'
    and substr("registration_executable_selections"."selection_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("registration_executable_selections"."selection_id", 24, 1) = '-'
    and substr("registration_executable_selections"."selection_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "registration_executable_path_nonempty" CHECK(length("registration_executable_selections"."executable_path") > 0),
	CONSTRAINT "registration_executable_platform" CHECK("registration_executable_selections"."platform" in ('win32', 'linux')),
	CONSTRAINT "registration_executable_volume_positive" CHECK(substr("registration_executable_selections"."volume_identity", 1, 1) between '1' and '9' and "registration_executable_selections"."volume_identity" not glob '*[^0-9]*'),
	CONSTRAINT "registration_executable_file_positive" CHECK(substr("registration_executable_selections"."file_identity", 1, 1) between '1' and '9' and "registration_executable_selections"."file_identity" not glob '*[^0-9]*'),
	CONSTRAINT "registration_executable_birth_positive" CHECK(substr("registration_executable_selections"."birth_identity", 1, 1) between '1' and '9' and "registration_executable_selections"."birth_identity" not glob '*[^0-9]*'),
	CONSTRAINT "registration_executable_sha256" CHECK(length("registration_executable_selections"."sha256") = 64 and "registration_executable_selections"."sha256" = lower("registration_executable_selections"."sha256") and "registration_executable_selections"."sha256" not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE TABLE `registration_observer_children` (
	`observation_id` text PRIMARY KEY NOT NULL,
	`identity_json` text NOT NULL,
	FOREIGN KEY (`observation_id`) REFERENCES `registration_observer_intents`(`observation_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_observer_child_json" CHECK(json_valid("registration_observer_children"."identity_json"))
);
--> statement-breakpoint
CREATE TABLE `registration_observer_intents` (
	`observation_id` text PRIMARY KEY NOT NULL,
	`selection_id` text NOT NULL,
	`consent_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`selection_id`) REFERENCES `registration_executable_selections`(`selection_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`consent_id`) REFERENCES `registration_version_consents`(`consent_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_observer_observation_uuid" CHECK(
    length("registration_observer_intents"."observation_id") = 36
    and "registration_observer_intents"."observation_id" = lower("registration_observer_intents"."observation_id")
    and substr("registration_observer_intents"."observation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("registration_observer_intents"."observation_id", 9, 1) = '-'
    and substr("registration_observer_intents"."observation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("registration_observer_intents"."observation_id", 14, 1) = '-'
    and substr("registration_observer_intents"."observation_id", 15, 1) glob '[1-8]'
    and substr("registration_observer_intents"."observation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("registration_observer_intents"."observation_id", 19, 1) = '-'
    and substr("registration_observer_intents"."observation_id", 20, 1) glob '[89ab]'
    and substr("registration_observer_intents"."observation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("registration_observer_intents"."observation_id", 24, 1) = '-'
    and substr("registration_observer_intents"."observation_id", 25, 12) not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_observer_consent_uq` ON `registration_observer_intents` (`consent_id`);--> statement-breakpoint
CREATE TABLE `registration_observer_outcomes` (
	`observation_id` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`settled_at` text NOT NULL,
	FOREIGN KEY (`observation_id`) REFERENCES `registration_observer_intents`(`observation_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_observer_outcome_json" CHECK(json_valid("registration_observer_outcomes"."result_json"))
);
--> statement-breakpoint
CREATE TABLE `registration_observer_terminals` (
	`observation_id` text PRIMARY KEY NOT NULL,
	`exit_code` integer NOT NULL,
	`stdout_closed` integer NOT NULL,
	`stderr_closed` integer NOT NULL,
	`tree_empty` integer NOT NULL,
	`observed_at` text NOT NULL,
	FOREIGN KEY (`observation_id`) REFERENCES `registration_observer_children`(`observation_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_observer_stdout_boolean" CHECK("registration_observer_terminals"."stdout_closed" in (0, 1)),
	CONSTRAINT "registration_observer_stderr_boolean" CHECK("registration_observer_terminals"."stderr_closed" in (0, 1)),
	CONSTRAINT "registration_observer_tree_boolean" CHECK("registration_observer_terminals"."tree_empty" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `registration_version_consents` (
	`consent_id` text PRIMARY KEY NOT NULL,
	`selection_id` text NOT NULL,
	`decision` text NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`selection_id`) REFERENCES `registration_executable_selections`(`selection_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_version_consent_uuid" CHECK(
    length("registration_version_consents"."consent_id") = 36
    and "registration_version_consents"."consent_id" = lower("registration_version_consents"."consent_id")
    and substr("registration_version_consents"."consent_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("registration_version_consents"."consent_id", 9, 1) = '-'
    and substr("registration_version_consents"."consent_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("registration_version_consents"."consent_id", 14, 1) = '-'
    and substr("registration_version_consents"."consent_id", 15, 1) glob '[1-8]'
    and substr("registration_version_consents"."consent_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("registration_version_consents"."consent_id", 19, 1) = '-'
    and substr("registration_version_consents"."consent_id", 20, 1) glob '[89ab]'
    and substr("registration_version_consents"."consent_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("registration_version_consents"."consent_id", 24, 1) = '-'
    and substr("registration_version_consents"."consent_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "registration_version_consent_decision" CHECK("registration_version_consents"."decision" in ('accepted', 'declined'))
);
--> statement-breakpoint
CREATE TABLE `registration_identity_consents` (
  `consent_id` text PRIMARY KEY NOT NULL,
  `selection_id` text NOT NULL,
  `observation_id` text NOT NULL,
  `decision` text NOT NULL,
  `decided_at` text NOT NULL,
  FOREIGN KEY (`selection_id`) REFERENCES `registration_executable_selections`(`selection_id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`observation_id`) REFERENCES `registration_observer_outcomes`(`observation_id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "registration_identity_consent_decision" CHECK("registration_identity_consents"."decision" in ('accepted', 'declined'))
);
--> statement-breakpoint
CREATE TABLE `registration_repository_selections` (
  `selection_id` text PRIMARY KEY NOT NULL,
  `directory_path` text NOT NULL,
  `identity_json` text NOT NULL,
  `captured_at` text NOT NULL,
  CONSTRAINT "registration_repository_identity_json" CHECK(json_valid("registration_repository_selections"."identity_json"))
);
--> statement-breakpoint
CREATE TABLE `registration_repository_trust` (
  `trust_id` text PRIMARY KEY NOT NULL,
  `selection_id` text NOT NULL,
  `decision` text NOT NULL,
  `decided_at` text NOT NULL,
  FOREIGN KEY (`selection_id`) REFERENCES `registration_repository_selections`(`selection_id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "registration_repository_trust_decision" CHECK("registration_repository_trust"."decision" in ('accepted', 'declined'))
);
