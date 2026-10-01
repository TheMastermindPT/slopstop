CREATE TABLE `registration_requests` (
	`request_id` text PRIMARY KEY NOT NULL,
	`input_fingerprint` text NOT NULL,
	`request_json` text NOT NULL,
	`reservation_id` text NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `registration_reservations`(`reservation_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_request_json" CHECK(json_valid("registration_requests"."request_json"))
);
--> statement-breakpoint
CREATE TABLE `registration_reservations` (
	`reservation_id` text PRIMARY KEY NOT NULL,
	`common_platform` text NOT NULL,
	`common_volume_identity` text NOT NULL,
	`common_file_identity` text NOT NULL,
	`common_birth_identity` text NOT NULL,
	`record_json` text NOT NULL,
	`record_fingerprint` text NOT NULL,
	CONSTRAINT "registration_reservation_json" CHECK(json_valid("registration_reservations"."record_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_common_identity_uq` ON `registration_reservations` (`common_platform`,`common_volume_identity`,`common_file_identity`,`common_birth_identity`);