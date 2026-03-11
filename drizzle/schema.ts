import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Username/password credentials for local authentication
 */
export const userPasswordCredentials = mysqlTable("user_password_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 64 }).notNull(),
  usernameNormalized: varchar("usernameNormalized", { length: 64 }).notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  passwordUpdatedAt: timestamp("passwordUpdatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPasswordCredential = typeof userPasswordCredentials.$inferSelect;
export type InsertUserPasswordCredential = typeof userPasswordCredentials.$inferInsert;

/**
 * Account Groups table - for organizing email accounts
 */
export const accountGroups = mysqlTable("account_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6366f1").notNull(),
  icon: varchar("icon", { length: 50 }),
  
  // Ordering
  sortOrder: int("sortOrder").default(0).notNull(),
  
  // Collapsed state in sidebar
  isCollapsed: boolean("isCollapsed").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountGroup = typeof accountGroups.$inferSelect;
export type InsertAccountGroup = typeof accountGroups.$inferInsert;

/**
 * Email accounts table - stores user's connected email accounts
 * Supports IMAP, Google OAuth2, and Microsoft OAuth2 authentication
 */
export const emailAccounts = mysqlTable("email_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Account basic info
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  
  // Account type: 'imap', 'google', 'microsoft', or 'temp'
  accountType: mysqlEnum("accountType", ["imap", "google", "microsoft", "temp"]).notNull(),
  
  // Account group (for organization)
  groupId: int("groupId"),
  sortOrder: int("sortOrder").default(0).notNull(),
  
  // IMAP configuration (for IMAP accounts)
  imapHost: varchar("imapHost", { length: 255 }),
  imapPort: int("imapPort"),
  imapSecure: boolean("imapSecure").default(true),
  imapUsername: varchar("imapUsername", { length: 255 }),
  imapPassword: text("imapPassword"), // Encrypted password
  
  // Google OAuth2 tokens (for Google accounts)
  googleAccessToken: text("googleAccessToken"),
  googleRefreshToken: text("googleRefreshToken"),
  googleTokenExpiry: timestamp("googleTokenExpiry"),

  // Microsoft OAuth2 tokens (for Microsoft accounts)
  microsoftAccessToken: text("microsoftAccessToken"),
  microsoftRefreshToken: text("microsoftRefreshToken"),
  microsoftTokenExpiry: timestamp("microsoftTokenExpiry"),
  
  // Sync status
  isActive: boolean("isActive").default(true).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastSyncError: text("lastSyncError"),
  syncStatus: mysqlEnum("syncStatus", ["idle", "syncing", "error"]).default("idle").notNull(),

  // Notes
  notes: text("notes"),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = typeof emailAccounts.$inferInsert;

/**
 * Temporary mailboxes table
 */
export const tempMailboxes = mysqlTable("temp_mailboxes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accountId: int("accountId").notNull(),
  address: varchar("address", { length: 320 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TempMailbox = typeof tempMailboxes.$inferSelect;
export type InsertTempMailbox = typeof tempMailboxes.$inferInsert;

/**
 * Labels table - user-defined labels for email organization
 */
export const labels = mysqlTable("labels", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6366f1").notNull(), // Hex color code
  description: varchar("description", { length: 255 }),
  
  // Icon (optional, for visual distinction)
  icon: varchar("icon", { length: 50 }),
  
  // Ordering
  sortOrder: int("sortOrder").default(0).notNull(),
  
  // System labels (cannot be deleted by user)
  isSystem: boolean("isSystem").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Label = typeof labels.$inferSelect;
export type InsertLabel = typeof labels.$inferInsert;

/**
 * Emails table - stores synchronized emails from all accounts
 */
export const emails = mysqlTable("emails", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  userId: int("userId").notNull(),
  
  // Email identifiers
  messageId: varchar("messageId", { length: 512 }).notNull(), // Unique message ID from server
  uid: bigint("uid", { mode: "number" }), // IMAP UID or Gmail message ID
  
  // Email headers
  subject: text("subject"),
  fromAddress: varchar("fromAddress", { length: 320 }),
  fromName: varchar("fromName", { length: 255 }),
  toAddresses: json("toAddresses").$type<string[]>(),
  ccAddresses: json("ccAddresses").$type<string[]>(),
  bccAddresses: json("bccAddresses").$type<string[]>(),
  replyTo: varchar("replyTo", { length: 320 }),
  
  // Email content
  textBody: text("textBody"),
  htmlBody: text("htmlBody"),
  snippet: varchar("snippet", { length: 500 }), // Preview text
  
  // Email metadata
  date: timestamp("date"),
  receivedAt: timestamp("receivedAt"),
  isRead: boolean("isRead").default(false).notNull(),
  isStarred: boolean("isStarred").default(false).notNull(),
  isImportant: boolean("isImportant").default(false).notNull(),
  folder: varchar("folder", { length: 100 }).default("INBOX"),
  
  // Attachment info
  hasAttachments: boolean("hasAttachments").default(false).notNull(),
  attachmentCount: int("attachmentCount").default(0),
  
  // Raw email data (for debugging)
  rawHeaders: json("rawHeaders").$type<Record<string, string>>(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Email = typeof emails.$inferSelect;
export type InsertEmail = typeof emails.$inferInsert;

/**
 * Email-Label junction table - many-to-many relationship
 */
export const emailLabels = mysqlTable("email_labels", {
  id: int("id").autoincrement().primaryKey(),
  emailId: int("emailId").notNull(),
  labelId: int("labelId").notNull(),
  userId: int("userId").notNull(),
  
  // When the label was applied
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailLabel = typeof emailLabels.$inferSelect;
export type InsertEmailLabel = typeof emailLabels.$inferInsert;

/**
 * Attachments table - stores email attachment metadata and S3 references
 */
export const attachments = mysqlTable("attachments", {
  id: int("id").autoincrement().primaryKey(),
  emailId: int("emailId").notNull(),
  userId: int("userId").notNull(),
  
  // Attachment info
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  size: bigint("size", { mode: "number" }), // Size in bytes
  
  // S3 storage
  s3Key: varchar("s3Key", { length: 512 }),
  s3Url: text("s3Url"),
  
  // Content ID (for inline attachments)
  contentId: varchar("contentId", { length: 255 }),
  isInline: boolean("isInline").default(false).notNull(),
  
  // Download status
  isDownloaded: boolean("isDownloaded").default(false).notNull(),
  downloadError: text("downloadError"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

/**
 * API Keys table - for external API access
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: varchar("keyHash", { length: 128 }).notNull(), // SHA-256 hash of the key
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // First 8 chars for identification
  
  // Permissions
  permissions: json("permissions").$type<string[]>(),
  
  // Usage tracking
  lastUsedAt: timestamp("lastUsedAt"),
  usageCount: int("usageCount").default(0),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Notification logs - track sent notifications
 */
export const notificationLogs = mysqlTable("notification_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  type: mysqlEnum("type", ["new_email", "sync_error", "important_email", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  
  // Related entities
  emailId: int("emailId"),
  accountId: int("accountId"),
  
  // Status
  isSent: boolean("isSent").default(false).notNull(),
  sentAt: timestamp("sentAt"),
  error: text("error"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;
