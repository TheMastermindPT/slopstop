CREATE TABLE `registration_publications` (
	`reservation_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`result_json` text NOT NULL,
	`result_fingerprint` text NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `registration_reservations`(`reservation_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`request_id`) REFERENCES `registration_requests`(`request_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "registration_publication_json" CHECK(json_valid("registration_publications"."result_json"))
);
