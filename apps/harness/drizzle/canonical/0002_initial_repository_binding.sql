CREATE TABLE `project_workspaces` (
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`binding_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `workspace_id`),
	FOREIGN KEY (`project_id`,`binding_id`) REFERENCES `repository_bindings`(`project_id`,`binding_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `repository_bindings` (
	`project_id` text NOT NULL,
	`binding_id` text NOT NULL,
	`revision` integer NOT NULL,
	`registration_request_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `binding_id`),
	FOREIGN KEY (`project_id`) REFERENCES `project_state`(`project_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repository_binding_revision" CHECK(
    typeof("repository_bindings"."revision") = 'integer'
    and "repository_bindings"."revision" >= 0
    and "repository_bindings"."revision" <= 9007199254740991
  )
);
