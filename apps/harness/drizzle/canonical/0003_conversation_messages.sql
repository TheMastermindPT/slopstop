CREATE TABLE `conversation_branches` (
	`branch_id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`parent_branch_id` text,
	`fork_message_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`fork_message_id`) REFERENCES `conversation_messages`(`message_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`conversation_id`,`parent_branch_id`) REFERENCES `conversation_branches`(`conversation_id`,`branch_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "conversation_branches_id_uuid" CHECK(
    length("conversation_branches"."branch_id") = 36
    and "conversation_branches"."branch_id" = lower("conversation_branches"."branch_id")
    and substr("conversation_branches"."branch_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("conversation_branches"."branch_id", 9, 1) = '-'
    and substr("conversation_branches"."branch_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("conversation_branches"."branch_id", 14, 1) = '-'
    and substr("conversation_branches"."branch_id", 15, 1) glob '[1-8]'
    and substr("conversation_branches"."branch_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("conversation_branches"."branch_id", 19, 1) = '-'
    and substr("conversation_branches"."branch_id", 20, 1) glob '[89ab]'
    and substr("conversation_branches"."branch_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("conversation_branches"."branch_id", 24, 1) = '-'
    and substr("conversation_branches"."branch_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "conversation_branches_fork_shape" CHECK(
        ("conversation_branches"."parent_branch_id" is null and "conversation_branches"."fork_message_id" is null)
        or ("conversation_branches"."parent_branch_id" is not null and "conversation_branches"."fork_message_id" is not null)
      )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_branches_conversation_branch_uq` ON `conversation_branches` (`conversation_id`,`branch_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_branches_root_uq` ON `conversation_branches` (`conversation_id`) WHERE "conversation_branches"."parent_branch_id" is null;--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`message_id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`cursor` integer NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`save_id` text NOT NULL,
	`save_fingerprint` text NOT NULL,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`,`branch_id`) REFERENCES `conversation_branches`(`conversation_id`,`branch_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "conversation_messages_id_uuid" CHECK(
    length("conversation_messages"."message_id") = 36
    and "conversation_messages"."message_id" = lower("conversation_messages"."message_id")
    and substr("conversation_messages"."message_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."message_id", 9, 1) = '-'
    and substr("conversation_messages"."message_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."message_id", 14, 1) = '-'
    and substr("conversation_messages"."message_id", 15, 1) glob '[1-8]'
    and substr("conversation_messages"."message_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."message_id", 19, 1) = '-'
    and substr("conversation_messages"."message_id", 20, 1) glob '[89ab]'
    and substr("conversation_messages"."message_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."message_id", 24, 1) = '-'
    and substr("conversation_messages"."message_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "conversation_messages_cursor_positive_safe" CHECK(
    typeof("conversation_messages"."cursor") = 'integer'
    and "conversation_messages"."cursor" > 0
    and "conversation_messages"."cursor" <= 9007199254740991
  ),
	CONSTRAINT "conversation_messages_author" CHECK("conversation_messages"."author" in ('user', 'model')),
	CONSTRAINT "conversation_messages_body_size" CHECK(typeof("conversation_messages"."body") = 'text' and length(cast("conversation_messages"."body" as blob)) between 1 and 32768),
	CONSTRAINT "conversation_messages_save_uuid" CHECK(
    length("conversation_messages"."save_id") = 36
    and "conversation_messages"."save_id" = lower("conversation_messages"."save_id")
    and substr("conversation_messages"."save_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."save_id", 9, 1) = '-'
    and substr("conversation_messages"."save_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."save_id", 14, 1) = '-'
    and substr("conversation_messages"."save_id", 15, 1) glob '[1-8]'
    and substr("conversation_messages"."save_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."save_id", 19, 1) = '-'
    and substr("conversation_messages"."save_id", 20, 1) glob '[89ab]'
    and substr("conversation_messages"."save_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("conversation_messages"."save_id", 24, 1) = '-'
    and substr("conversation_messages"."save_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "conversation_messages_save_fingerprint_sha256" CHECK(
    length("conversation_messages"."save_fingerprint") = 64
    and "conversation_messages"."save_fingerprint" = lower("conversation_messages"."save_fingerprint")
    and "conversation_messages"."save_fingerprint" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_messages_branch_cursor_uq` ON `conversation_messages` (`branch_id`,`cursor`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_messages_save_uq` ON `conversation_messages` (`save_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`scope_kind` text NOT NULL,
	`waypoint_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project_state`(`project_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "conversations_id_uuid" CHECK(
    length("conversations"."conversation_id") = 36
    and "conversations"."conversation_id" = lower("conversations"."conversation_id")
    and substr("conversations"."conversation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("conversations"."conversation_id", 9, 1) = '-'
    and substr("conversations"."conversation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("conversations"."conversation_id", 14, 1) = '-'
    and substr("conversations"."conversation_id", 15, 1) glob '[1-8]'
    and substr("conversations"."conversation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("conversations"."conversation_id", 19, 1) = '-'
    and substr("conversations"."conversation_id", 20, 1) glob '[89ab]'
    and substr("conversations"."conversation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("conversations"."conversation_id", 24, 1) = '-'
    and substr("conversations"."conversation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "conversations_scope_kind" CHECK("conversations"."scope_kind" in ('project', 'waypoint')),
	CONSTRAINT "conversations_scope_shape" CHECK(
        ("conversations"."scope_kind" = 'project' and "conversations"."waypoint_id" is null)
        or ("conversations"."scope_kind" = 'waypoint' and "conversations"."waypoint_id" is not null)
      ),
	CONSTRAINT "conversations_waypoint_uuid" CHECK("conversations"."waypoint_id" is null or (
    length("conversations"."waypoint_id") = 36
    and "conversations"."waypoint_id" = lower("conversations"."waypoint_id")
    and substr("conversations"."waypoint_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("conversations"."waypoint_id", 9, 1) = '-'
    and substr("conversations"."waypoint_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("conversations"."waypoint_id", 14, 1) = '-'
    and substr("conversations"."waypoint_id", 15, 1) glob '[1-8]'
    and substr("conversations"."waypoint_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("conversations"."waypoint_id", 19, 1) = '-'
    and substr("conversations"."waypoint_id", 20, 1) glob '[89ab]'
    and substr("conversations"."waypoint_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("conversations"."waypoint_id", 24, 1) = '-'
    and substr("conversations"."waypoint_id", 25, 12) not glob '*[^0-9a-f]*'
  ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_project_scope_uq` ON `conversations` (`project_id`) WHERE "conversations"."scope_kind" = 'project';