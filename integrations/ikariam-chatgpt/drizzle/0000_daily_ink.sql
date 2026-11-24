CREATE TABLE `icariam_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`record_id` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`saved_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `icariam_records` (
	`owner_id` text NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`record_id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `account_id`, `kind`, `record_id`)
);
