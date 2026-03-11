CREATE TABLE IF NOT EXISTS `user_password_credentials` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `username` varchar(64) NOT NULL,
  `usernameNormalized` varchar(64) NOT NULL,
  `passwordHash` text NOT NULL,
  `passwordUpdatedAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_password_credentials_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_password_credentials_userId_unique` UNIQUE(`userId`),
  CONSTRAINT `user_password_credentials_usernameNormalized_unique` UNIQUE(`usernameNormalized`)
);
