CREATE TABLE IF NOT EXISTS `account_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#6366f1',
	`icon` varchar(50),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isCollapsed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`keyHash` varchar(128) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`permissions` json,
	`lastUsedAt` timestamp,
	`usageCount` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emailId` int NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(512) NOT NULL,
	`mimeType` varchar(128),
	`size` bigint,
	`s3Key` varchar(512),
	`s3Url` text,
	`contentId` varchar(255),
	`isInline` boolean NOT NULL DEFAULT false,
	`isDownloaded` boolean NOT NULL DEFAULT false,
	`downloadError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `email_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(255),
	`accountType` enum('imap','google') NOT NULL,
	`groupId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`imapHost` varchar(255),
	`imapPort` int,
	`imapSecure` boolean DEFAULT true,
	`imapUsername` varchar(255),
	`imapPassword` text,
	`googleAccessToken` text,
	`googleRefreshToken` text,
	`googleTokenExpiry` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSyncAt` timestamp,
	`lastSyncError` text,
	`syncStatus` enum('idle','syncing','error') NOT NULL DEFAULT 'idle',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `email_labels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emailId` int NOT NULL,
	`labelId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`userId` int NOT NULL,
	`messageId` varchar(512) NOT NULL,
	`uid` bigint,
	`subject` text,
	`fromAddress` varchar(320),
	`fromName` varchar(255),
	`toAddresses` json,
	`ccAddresses` json,
	`bccAddresses` json,
	`replyTo` varchar(320),
	`textBody` text,
	`htmlBody` text,
	`snippet` varchar(500),
	`date` timestamp,
	`receivedAt` timestamp,
	`isRead` boolean NOT NULL DEFAULT false,
	`isStarred` boolean NOT NULL DEFAULT false,
	`isImportant` boolean NOT NULL DEFAULT false,
	`folder` varchar(100) DEFAULT 'INBOX',
	`hasAttachments` boolean NOT NULL DEFAULT false,
	`attachmentCount` int DEFAULT 0,
	`rawHeaders` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `labels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#6366f1',
	`description` varchar(255),
	`icon` varchar(50),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('new_email','sync_error','important_email','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`emailId` int,
	`accountId` int,
	`isSent` boolean NOT NULL DEFAULT false,
	`sentAt` timestamp,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
