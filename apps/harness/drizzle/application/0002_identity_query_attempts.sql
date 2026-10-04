CREATE TABLE `registration_identity_query_attempts` (
	`observation_id` text PRIMARY KEY NOT NULL,
	`repository_selection_id` text NOT NULL,
	`consent_id` text NOT NULL,
	`query_kind` text NOT NULL,
	`scope_json` text NOT NULL,
	`child_json` text,
	`terminal_json` text,
	`result_json` text,
	`created_at` text NOT NULL,
	`settled_at` text,
	FOREIGN KEY (`repository_selection_id`) REFERENCES `registration_repository_selections`(`selection_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`consent_id`) REFERENCES `registration_identity_consents`(`consent_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "identity_query_kind" CHECK("registration_identity_query_attempts"."query_kind" in ('inside-work-tree', 'bare-repository', 'inside-git-dir', 'show-toplevel', 'absolute-git-dir', 'git-common-dir')),
	CONSTRAINT "identity_query_scope_json" CHECK(json_valid("registration_identity_query_attempts"."scope_json")),
	CONSTRAINT "identity_query_child_json" CHECK("registration_identity_query_attempts"."child_json" is null or json_valid("registration_identity_query_attempts"."child_json")),
	CONSTRAINT "identity_query_terminal_json" CHECK("registration_identity_query_attempts"."terminal_json" is null or json_valid("registration_identity_query_attempts"."terminal_json")),
	CONSTRAINT "identity_query_result_json" CHECK("registration_identity_query_attempts"."result_json" is null or json_valid("registration_identity_query_attempts"."result_json"))
);
