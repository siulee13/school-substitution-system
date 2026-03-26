CREATE TABLE `substitution_record_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`absentTeacher` varchar(64) NOT NULL,
	`timeSlot` varchar(32) NOT NULL,
	`className` varchar(16) NOT NULL,
	`subject` varchar(64) NOT NULL,
	`substitutionTeacher` varchar(64) NOT NULL,
	`isSwap` int NOT NULL DEFAULT 0,
	`swapNote` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `substitution_record_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `substitution_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateStr` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`note` text,
	CONSTRAINT `substitution_records_id` PRIMARY KEY(`id`)
);
