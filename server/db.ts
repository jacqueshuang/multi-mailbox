import { eq, and, desc, asc, sql, like, or, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  emailAccounts, InsertEmailAccount, EmailAccount,
  emails, InsertEmail, Email,
  attachments, InsertAttachment, Attachment,
  apiKeys, InsertApiKey, ApiKey,
  userPasswordCredentials, InsertUserPasswordCredential, UserPasswordCredential,
  notificationLogs, InsertNotificationLog,
  labels, InsertLabel, Label,
  emailLabels, InsertEmailLabel, EmailLabel,
  accountGroups, InsertAccountGroup, AccountGroup,
  tempMailboxes, InsertTempMailbox, TempMailbox
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let ensureEmailAccountsSchemaPromise: Promise<void> | null = null;
let isEmailAccountsSchemaReady = false;

function isDuplicateColumnError(error: unknown): boolean {
  let current: unknown = error;

  while (current && typeof current === 'object') {
    const dbError = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (
      dbError.code === 'ER_DUP_FIELDNAME' ||
      dbError.errno === 1060 ||
      dbError.message?.includes('Duplicate column name') === true
    ) {
      return true;
    }
    current = dbError.cause;
  }

  return false;
}

function isEmailAccountsSchemaMismatchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const dbError = error as { code?: string; errno?: number; message?: string };
  return (
    dbError.code === 'ER_BAD_FIELD_ERROR' ||
    dbError.errno === 1054 ||
    dbError.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' ||
    dbError.errno === 1366 ||
    dbError.message?.includes('Unknown column') === true
  );
}

async function addEmailAccountsColumnIfMissing(db: ReturnType<typeof drizzle>, statement: string) {
  try {
    await db.execute(sql.raw(statement));
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error;
    }
  }
}

async function ensureEmailAccountsSchema(db: ReturnType<typeof drizzle>) {
  if (isEmailAccountsSchemaReady) return;

  if (!ensureEmailAccountsSchemaPromise) {
    ensureEmailAccountsSchemaPromise = (async () => {
      try {
        await addEmailAccountsColumnIfMissing(db, "ALTER TABLE `email_accounts` ADD COLUMN `microsoftAccessToken` text");
        await addEmailAccountsColumnIfMissing(db, "ALTER TABLE `email_accounts` ADD COLUMN `microsoftRefreshToken` text");
        await addEmailAccountsColumnIfMissing(db, "ALTER TABLE `email_accounts` ADD COLUMN `microsoftTokenExpiry` timestamp NULL");
        await addEmailAccountsColumnIfMissing(db, "ALTER TABLE `email_accounts` ADD COLUMN `notes` text");

        await db.execute(
          sql.raw("ALTER TABLE `email_accounts` MODIFY COLUMN `accountType` enum('imap','google','microsoft','temp') NOT NULL")
        );

        isEmailAccountsSchemaReady = true;
      } catch (error) {
        console.warn("[Database] Failed to auto-ensure email_accounts microsoft schema:", error);
      } finally {
        ensureEmailAccountsSchemaPromise = null;
      }
    })();
  }

  await ensureEmailAccountsSchemaPromise;
}

let ensureUsersSchemaPromise: Promise<void> | null = null;
let isUsersSchemaReady = false;

async function ensureUsersSchema(db: ReturnType<typeof drizzle>) {
  if (isUsersSchemaReady) return;

  if (!ensureUsersSchemaPromise) {
    ensureUsersSchemaPromise = (async () => {
      try {
        await addEmailAccountsColumnIfMissing(db, "ALTER TABLE `users` ADD COLUMN `isActive` boolean NOT NULL DEFAULT true");
        isUsersSchemaReady = true;
      } catch (error) {
        console.warn("[Database] Failed to auto-ensure users schema:", error);
      } finally {
        ensureUsersSchemaPromise = null;
      }
    })();
  }

  await ensureUsersSchemaPromise;
}

let ensureTempMailSchemaPromise: Promise<void> | null = null;
let isTempMailSchemaReady = false;

async function ensureTempMailSchema(db: ReturnType<typeof drizzle>) {
  if (isTempMailSchemaReady) return;

  if (!ensureTempMailSchemaPromise) {
    ensureTempMailSchemaPromise = (async () => {
      try {
        await addEmailAccountsColumnIfMissing(db, "CREATE TABLE IF NOT EXISTS `temp_mailboxes` (\n  `id` int NOT NULL AUTO_INCREMENT,\n  `userId` int NOT NULL,\n  `accountId` int NOT NULL,\n  `address` varchar(320) NOT NULL,\n  `domain` varchar(255) NOT NULL,\n  `expiresAt` timestamp NULL,\n  `isActive` boolean NOT NULL DEFAULT true,\n  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  KEY `idx_temp_mailboxes_userId` (`userId`),\n  KEY `idx_temp_mailboxes_address` (`address`),\n  KEY `idx_temp_mailboxes_accountId` (`accountId`)\n)");
        await db.execute(sql.raw("ALTER TABLE `temp_mailboxes` MODIFY COLUMN `expiresAt` timestamp NULL"));
        isTempMailSchemaReady = true;
      } catch (error) {
        console.warn("[Database] Failed to auto-ensure temp_mailboxes schema:", error);
      } finally {
        ensureTempMailSchemaPromise = null;
      }
    })();
  }

  await ensureTempMailSchemaPromise;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  if (_db) {
    await ensureEmailAccountsSchema(_db);
    await ensureUsersSchema(_db);
    await ensureTempMailSchema(_db);
  }

  return _db;
}

// ==================== User Operations ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(id: number, role: "user" | "admin"): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ role }).where(eq(users.id, id));
  return getUserById(id);
}

export async function updateUserStatus(id: number, isActive: boolean): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ isActive }).where(eq(users.id, id));
  return getUserById(id);
}

export async function createTempMailbox(data: InsertTempMailbox): Promise<TempMailbox> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tempMailboxes).values(data);
  const insertId = result[0].insertId;
  const created = await db.select().from(tempMailboxes).where(eq(tempMailboxes.id, insertId)).limit(1);
  return created[0];
}

export async function listTempMailboxesByUserId(userId: number): Promise<TempMailbox[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tempMailboxes).where(eq(tempMailboxes.userId, userId)).orderBy(desc(tempMailboxes.createdAt));
}

export async function getTempMailboxByAddress(address: string): Promise<TempMailbox | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tempMailboxes).where(eq(tempMailboxes.address, address)).limit(1);
  return result[0];
}

export async function getTempMailboxById(id: number, userId: number): Promise<TempMailbox | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(tempMailboxes)
    .where(and(eq(tempMailboxes.id, id), eq(tempMailboxes.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateTempMailbox(id: number, userId: number, data: Partial<InsertTempMailbox>): Promise<TempMailbox | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db
    .update(tempMailboxes)
    .set(data)
    .where(and(eq(tempMailboxes.id, id), eq(tempMailboxes.userId, userId)));
  return getTempMailboxById(id, userId);
}

export async function listExpiredTempMailboxes(now: Date): Promise<TempMailbox[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tempMailboxes)
    .where(
      and(
        eq(tempMailboxes.isActive, true),
        sql`${tempMailboxes.expiresAt} IS NOT NULL`,
        sql`${tempMailboxes.expiresAt} < ${now}`
      )
    );
}

export async function getPasswordCredentialByUsernameNormalized(usernameNormalized: string): Promise<UserPasswordCredential | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(userPasswordCredentials)
    .where(eq(userPasswordCredentials.usernameNormalized, usernameNormalized))
    .limit(1);
  return result[0];
}

export async function createPasswordCredential(data: InsertUserPasswordCredential): Promise<UserPasswordCredential> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(userPasswordCredentials).values(data);
  const insertId = result[0].insertId;

  const created = await db.select().from(userPasswordCredentials)
    .where(eq(userPasswordCredentials.id, insertId))
    .limit(1);
  return created[0];
}

// ==================== Email Account Operations ====================

export async function createEmailAccount(account: InsertEmailAccount): Promise<EmailAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.insert(emailAccounts).values(account);
    const insertId = result[0].insertId;

    const created = await db.select().from(emailAccounts).where(eq(emailAccounts.id, insertId)).limit(1);
    return created[0];
  } catch (error) {
    if (!isEmailAccountsSchemaMismatchError(error)) {
      throw error;
    }

    await ensureEmailAccountsSchema(db);

    const result = await db.insert(emailAccounts).values(account);
    const insertId = result[0].insertId;

    const created = await db.select().from(emailAccounts).where(eq(emailAccounts.id, insertId)).limit(1);
    return created[0];
  }
}

export async function getEmailAccountsByUserId(userId: number): Promise<EmailAccount[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(emailAccounts)
    .where(eq(emailAccounts.userId, userId))
    .orderBy(asc(emailAccounts.sortOrder), desc(emailAccounts.createdAt));
}

export async function getEmailAccountById(id: number, userId: number): Promise<EmailAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(emailAccounts)
    .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateEmailAccount(id: number, userId: number, data: Partial<InsertEmailAccount>): Promise<EmailAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  try {
    await db.update(emailAccounts)
      .set(data)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)));
  } catch (error) {
    if (!isEmailAccountsSchemaMismatchError(error)) {
      throw error;
    }

    await ensureEmailAccountsSchema(db);

    await db.update(emailAccounts)
      .set(data)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)));
  }

  return getEmailAccountById(id, userId);
}

export async function deleteEmailAccount(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Delete associated emails and attachments first
  const account = await getEmailAccountById(id, userId);
  if (!account) return false;
  
  // Delete attachments for emails in this account
  await db.delete(attachments)
    .where(and(
      eq(attachments.userId, userId),
      inArray(attachments.emailId, 
        db.select({ id: emails.id }).from(emails).where(eq(emails.accountId, id))
      )
    ));
  
  // Delete emails
  await db.delete(emails).where(eq(emails.accountId, id));
  
  // Delete account
  const result = await db.delete(emailAccounts)
    .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)));
  
  return result[0].affectedRows > 0;
}

export async function getActiveEmailAccounts(): Promise<EmailAccount[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(emailAccounts)
    .where(eq(emailAccounts.isActive, true));
}

export async function updateAccountSyncStatus(
  id: number, 
  status: 'idle' | 'syncing' | 'error', 
  error?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emailAccounts)
    .set({
      syncStatus: status,
      lastSyncAt: status === 'idle' ? new Date() : undefined,
      lastSyncError: error || null,
    })
    .where(eq(emailAccounts.id, id));
}

// ==================== Email Operations ====================

export async function createEmail(email: InsertEmail): Promise<Email> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emails).values(email);
  const insertId = result[0].insertId;
  
  const created = await db.select().from(emails).where(eq(emails.id, insertId)).limit(1);
  return created[0];
}

export async function createEmailsBatch(emailList: InsertEmail[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (emailList.length === 0) return 0;
  
  const result = await db.insert(emails).values(emailList);
  return result[0].affectedRows;
}

function buildEmailListConditions(
  db: ReturnType<typeof drizzle>,
  userId: number,
  options: {
    accountId?: number;
    folder?: string;
    isRead?: boolean;
    isStarred?: boolean;
    search?: string;
    labelId?: number;
  } = {}
) {
  const conditions = [eq(emails.userId, userId)];

  if (options.accountId) {
    conditions.push(eq(emails.accountId, options.accountId));
  }
  if (options.folder) {
    conditions.push(eq(emails.folder, options.folder));
  }
  if (options.isRead !== undefined) {
    conditions.push(eq(emails.isRead, options.isRead));
  }
  if (options.isStarred !== undefined) {
    conditions.push(eq(emails.isStarred, options.isStarred));
  }
  if (options.labelId) {
    // Filter by label using subquery
    conditions.push(
      inArray(
        emails.id,
        db.select({ emailId: emailLabels.emailId })
          .from(emailLabels)
          .where(eq(emailLabels.labelId, options.labelId))
      )
    );
  }
  if (options.search) {
    conditions.push(
      or(
        like(emails.subject, `%${options.search}%`),
        like(emails.fromAddress, `%${options.search}%`),
        like(emails.fromName, `%${options.search}%`),
        like(emails.snippet, `%${options.search}%`)
      )!
    );
  }

  return conditions;
}

export async function getEmailsByUserId(
  userId: number,
  options: {
    accountId?: number;
    folder?: string;
    isRead?: boolean;
    isStarred?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    labelId?: number;
  } = {}
): Promise<Email[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = buildEmailListConditions(db, userId, options);

  return db.select().from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.date))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
}

export async function getEmailCountByUserId(
  userId: number,
  options: {
    accountId?: number;
    folder?: string;
    isRead?: boolean;
    isStarred?: boolean;
    search?: string;
    labelId?: number;
  } = {}
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = buildEmailListConditions(db, userId, options);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(emails)
    .where(and(...conditions));

  return result[0]?.count || 0;
}

export async function getEmailById(id: number, userId: number): Promise<Email | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(emails)
    .where(and(eq(emails.id, id), eq(emails.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getEmailByMessageId(messageId: string, accountId: number): Promise<Email | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(emails)
    .where(and(eq(emails.messageId, messageId), eq(emails.accountId, accountId)))
    .limit(1);
  return result[0];
}

export async function updateEmail(id: number, userId: number, data: Partial<InsertEmail>): Promise<Email | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(emails)
    .set(data)
    .where(and(eq(emails.id, id), eq(emails.userId, userId)));
  
  return getEmailById(id, userId);
}

export async function markEmailAsRead(id: number, userId: number, isRead: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emails)
    .set({ isRead })
    .where(and(eq(emails.id, id), eq(emails.userId, userId)));
}

export async function toggleEmailStar(id: number, userId: number, isStarred: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emails)
    .set({ isStarred })
    .where(and(eq(emails.id, id), eq(emails.userId, userId)));
}

export async function getUnreadCount(userId: number, accountId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions = [eq(emails.userId, userId), eq(emails.isRead, false)];
  if (accountId) {
    conditions.push(eq(emails.accountId, accountId));
  }
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(emails)
    .where(and(...conditions));
  
  return result[0]?.count || 0;
}

export async function getLatestEmailUid(accountId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({ uid: emails.uid })
    .from(emails)
    .where(eq(emails.accountId, accountId))
    .orderBy(desc(emails.uid))
    .limit(1);
  
  return result[0]?.uid || null;
}

// ==================== Attachment Operations ====================

export async function createAttachment(attachment: InsertAttachment): Promise<Attachment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(attachments).values(attachment);
  const insertId = result[0].insertId;
  
  const created = await db.select().from(attachments).where(eq(attachments.id, insertId)).limit(1);
  return created[0];
}

export async function createAttachmentsBatch(attachmentList: InsertAttachment[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (attachmentList.length === 0) return 0;
  
  const result = await db.insert(attachments).values(attachmentList);
  return result[0].affectedRows;
}

export async function getAttachmentsByEmailId(emailId: number, userId: number): Promise<Attachment[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(attachments)
    .where(and(eq(attachments.emailId, emailId), eq(attachments.userId, userId)));
}

export async function getAttachmentById(id: number, userId: number): Promise<Attachment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateAttachment(id: number, data: Partial<InsertAttachment>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(attachments)
    .set(data)
    .where(eq(attachments.id, id));
}

// ==================== API Key Operations ====================

export async function createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(apiKeys).values(apiKey);
  const insertId = result[0].insertId;
  
  const created = await db.select().from(apiKeys).where(eq(apiKeys.id, insertId)).limit(1);
  return created[0];
}

export async function getApiKeysByUserId(userId: number): Promise<ApiKey[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
    .limit(1);
  return result[0];
}

export async function updateApiKeyUsage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${apiKeys.usageCount} + 1`
    })
    .where(eq(apiKeys.id, id));
}

export async function updateApiKeyActiveStatus(id: number, userId: number, isActive: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(apiKeys)
    .set({ isActive })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  return result[0].affectedRows > 0;
}

export async function deleteApiKey(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
  
  return result[0].affectedRows > 0;
}

// ==================== Notification Log Operations ====================

export async function createNotificationLog(log: InsertNotificationLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(notificationLogs).values(log);
}

export async function getNotificationLogs(userId: number, limit: number = 50): Promise<typeof notificationLogs.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(notificationLogs)
    .where(eq(notificationLogs.userId, userId))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
}


// ==================== Label Operations ====================

export async function createLabel(label: InsertLabel): Promise<Label> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(labels).values(label);
  const insertId = result[0].insertId;
  
  const created = await db.select().from(labels).where(eq(labels.id, insertId)).limit(1);
  return created[0];
}

export async function getLabelsByUserId(userId: number): Promise<Label[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(labels)
    .where(eq(labels.userId, userId))
    .orderBy(asc(labels.sortOrder), asc(labels.name));
}

export async function getLabelById(id: number, userId: number): Promise<Label | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(labels)
    .where(and(eq(labels.id, id), eq(labels.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateLabel(id: number, userId: number, data: Partial<InsertLabel>): Promise<Label | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(labels)
    .set(data)
    .where(and(eq(labels.id, id), eq(labels.userId, userId)));
  
  return getLabelById(id, userId);
}

export async function deleteLabel(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Check if it's a system label
  const label = await getLabelById(id, userId);
  if (!label || label.isSystem) return false;
  
  // Delete email-label associations
  await db.delete(emailLabels)
    .where(and(eq(emailLabels.labelId, id), eq(emailLabels.userId, userId)));
  
  // Delete the label
  const result = await db.delete(labels)
    .where(and(eq(labels.id, id), eq(labels.userId, userId)));
  
  return result[0].affectedRows > 0;
}

// ==================== Email-Label Operations ====================

export async function addLabelToEmail(emailId: number, labelId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Check if already exists
  const existing = await db.select().from(emailLabels)
    .where(and(
      eq(emailLabels.emailId, emailId),
      eq(emailLabels.labelId, labelId),
      eq(emailLabels.userId, userId)
    ))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(emailLabels).values({ emailId, labelId, userId });
  }
}

export async function removeLabelFromEmail(emailId: number, labelId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(emailLabels)
    .where(and(
      eq(emailLabels.emailId, emailId),
      eq(emailLabels.labelId, labelId),
      eq(emailLabels.userId, userId)
    ));
}

export async function getLabelsForEmail(emailId: number, userId: number): Promise<Label[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({ label: labels })
    .from(emailLabels)
    .innerJoin(labels, eq(emailLabels.labelId, labels.id))
    .where(and(eq(emailLabels.emailId, emailId), eq(emailLabels.userId, userId)));

  return result.map(r => r.label);
}

export async function getLabelsForEmails(emailIds: number[], userId: number): Promise<(Label & { emailId: number })[]> {
  const db = await getDb();
  if (!db || emailIds.length === 0) return [];

  const result = await db.select({
      id: labels.id,
      userId: labels.userId,
      name: labels.name,
      color: labels.color,
      description: labels.description,
      icon: labels.icon,
      isSystem: labels.isSystem,
      sortOrder: labels.sortOrder,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt,
      emailId: emailLabels.emailId
    })
    .from(emailLabels)
    .innerJoin(labels, eq(emailLabels.labelId, labels.id))
    .where(and(
      inArray(emailLabels.emailId, emailIds),
      eq(emailLabels.userId, userId)
    ));

  return result;
}

export async function getEmailsByLabelId(
  labelId: number, 
  userId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<Email[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({ email: emails })
    .from(emailLabels)
    .innerJoin(emails, eq(emailLabels.emailId, emails.id))
    .where(and(eq(emailLabels.labelId, labelId), eq(emailLabels.userId, userId)))
    .orderBy(desc(emails.date))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
  
  return result.map(r => r.email);
}

export async function getEmailCountByLabel(labelId: number, userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(emailLabels)
    .where(and(eq(emailLabels.labelId, labelId), eq(emailLabels.userId, userId)));
  
  return result[0]?.count || 0;
}

// ==================== Account Group Operations ====================

export async function createAccountGroup(group: InsertAccountGroup): Promise<AccountGroup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accountGroups).values(group);
  const insertId = result[0].insertId;
  
  const created = await db.select().from(accountGroups).where(eq(accountGroups.id, insertId)).limit(1);
  return created[0];
}

export async function getAccountGroupsByUserId(userId: number): Promise<AccountGroup[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(accountGroups)
    .where(eq(accountGroups.userId, userId))
    .orderBy(asc(accountGroups.sortOrder), asc(accountGroups.name));
}

export async function getAccountGroupById(id: number, userId: number): Promise<AccountGroup | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(accountGroups)
    .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateAccountGroup(id: number, userId: number, data: Partial<InsertAccountGroup>): Promise<AccountGroup | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(accountGroups)
    .set(data)
    .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, userId)));
  
  return getAccountGroupById(id, userId);
}

export async function deleteAccountGroup(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Remove group reference from accounts
  await db.update(emailAccounts)
    .set({ groupId: null })
    .where(and(eq(emailAccounts.groupId, id), eq(emailAccounts.userId, userId)));
  
  // Delete the group
  const result = await db.delete(accountGroups)
    .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, userId)));
  
  return result[0].affectedRows > 0;
}

export async function getAccountsByGroupId(groupId: number | null, userId: number): Promise<EmailAccount[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (groupId === null) {
    return db.select().from(emailAccounts)
      .where(and(
        eq(emailAccounts.userId, userId),
        sql`${emailAccounts.groupId} IS NULL`
      ))
      .orderBy(asc(emailAccounts.sortOrder));
  }
  
  return db.select().from(emailAccounts)
    .where(and(eq(emailAccounts.groupId, groupId), eq(emailAccounts.userId, userId)))
    .orderBy(asc(emailAccounts.sortOrder));
}

export async function updateAccountGroup_ForAccount(accountId: number, userId: number, groupId: number | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emailAccounts)
    .set({ groupId })
    .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)));
}

export async function updateAccountSortOrder(accountId: number, userId: number, sortOrder: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emailAccounts)
    .set({ sortOrder })
    .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)));
}
