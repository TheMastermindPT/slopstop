CREATE TABLE `registration_proposals` (
	`request_id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`input_fingerprint` text NOT NULL,
	`proposal_fingerprint` text NOT NULL,
	`record_json` text NOT NULL,
	CONSTRAINT "registration_proposal_json" CHECK(json_valid("registration_proposals"."record_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_proposal_id_uq` ON `registration_proposals` (`proposal_id`);