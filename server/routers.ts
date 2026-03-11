import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { testImapConnection, syncImapEmails } from "./services/imapService";
import { syncAccount, getPollingStatus } from "./services/emailPollingService";
import { createHash, randomBytes } from "crypto";
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  getGmailProfile,
  isGoogleOAuthConfigured,
} from "./services/googleOAuthService";
import {
  getMicrosoftAuthUrl,
  exchangeMicrosoftCodeForTokens,
  getMicrosoftUserInfo,
  getMicrosoftAccountEmail,
  isMicrosoftOAuthConfigured,
} from "./services/microsoftOAuthService";
import { syncGmailEmails } from "./services/gmailSyncService";
import { syncMicrosoftEmails } from "./services/microsoftSyncService";
import { sdk } from "./_core/sdk";
import { hashPassword, normalizeUsername, verifyPassword } from "./services/passwordAuthService";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";
import {
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from "./services/loginRateLimitService";

const LOCAL_OPENID_PREFIX = "local:";

const adminRouter = router({
  listUsers: adminProcedure.query(async () => {
    const users = await db.listUsers();
    return users.map(user => ({
      id: user.id,
      openId: user.openId,
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
    }));
  }),

  setUserRole: adminProcedure
    .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const updated = await db.updateUserRole(input.id, input.role);
      if (!updated) throw new Error("User not found");
      return updated;
    }),

  setUserStatus: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const updated = await db.updateUserStatus(input.id, input.isActive);
      if (!updated) throw new Error("User not found");
      return updated;
    }),
});

const tempMailRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listTempMailboxesByUserId(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        localPart: z.string().min(3).max(64).optional(),
        expiresInMinutes: z.number().min(5).max(7 * 24 * 60).optional(),
        unlimited: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const domains = ENV.tempMailDomains
        .split(",")
        .map(d => d.trim())
        .filter(Boolean);

      if (domains.length === 0) {
        throw new Error("TEMP_MAIL_DOMAINS is not configured");
      }

      const domain = domains[0];
      const localPart = (input.localPart || nanoid(8)).toLowerCase();
      const address = `${localPart}@${domain}`;
      const expiresAt = input.unlimited
        ? null
        : new Date(Date.now() + (input.expiresInMinutes ?? 60) * 60 * 1000);

      const account = await db.createEmailAccount({
        userId: ctx.user.id,
        email: address,
        displayName: `临时邮箱 ${localPart}`,
        accountType: "temp",
        isActive: true,
        syncStatus: "idle",
      });

      return db.createTempMailbox({
        userId: ctx.user.id,
        accountId: account.id,
        address,
        domain,
        expiresAt,
        isActive: true,
      });
    }),

  extend: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        expiresInMinutes: z.number().min(5).max(7 * 24 * 60).optional(),
        unlimited: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.unlimited
        ? null
        : new Date(Date.now() + (input.expiresInMinutes ?? 60) * 60 * 1000);
      const updated = await db.updateTempMailbox(input.id, ctx.user.id, { expiresAt });
      if (!updated) throw new Error("Temp mailbox not found");
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mailbox = await db.getTempMailboxById(input.id, ctx.user.id);
      if (!mailbox) throw new Error("Temp mailbox not found");

      await db.updateTempMailbox(input.id, ctx.user.id, { isActive: false });
      await db.updateEmailAccount(mailbox.accountId, ctx.user.id, { isActive: false });

      return { success: true } as const;
    }),
});

const setAuthSessionCookie = async (
  req: { headers: Record<string, unknown> } & any,
  res: { cookie: (...args: any[]) => void },
  openId: string,
  name: string
) => {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
};

// ==================== Email Account Router ====================

const emailAccountRouter = router({
  // List all email accounts for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getEmailAccountsByUserId(ctx.user.id);
  }),

  // Get single email account
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getEmailAccountById(input.id, ctx.user.id);
    }),

  // Add IMAP email account
  addImap: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      displayName: z.string().optional(),
      imapHost: z.string(),
      imapPort: z.number().default(993),
      imapSecure: z.boolean().default(true),
      imapUsername: z.string(),
      imapPassword: z.string(),
      groupId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Test connection first
      const testResult = await testImapConnection({
        host: input.imapHost,
        port: input.imapPort,
        secure: input.imapSecure,
        auth: {
          user: input.imapUsername,
          pass: input.imapPassword,
        },
      });

      if (!testResult.success) {
        throw new Error(`Connection failed: ${testResult.error}`);
      }

      // Create account
      const account = await db.createEmailAccount({
        userId: ctx.user.id,
        email: input.email,
        displayName: input.displayName || input.email,
        accountType: 'imap',
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapSecure: input.imapSecure,
        imapUsername: input.imapUsername,
        imapPassword: input.imapPassword,
        isActive: true,
        syncStatus: 'idle',
        groupId: input.groupId,
      });

      // Trigger initial sync
      syncImapEmails(account).catch(console.error);

      return account;
    }),

  // Update email account
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      displayName: z.string().optional(),
      notes: z.string().max(2000).optional(),
      imapHost: z.string().optional(),
      imapPort: z.number().optional(),
      imapSecure: z.boolean().optional(),
      imapUsername: z.string().optional(),
      imapPassword: z.string().optional(),
      isActive: z.boolean().optional(),
      groupId: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      if (data.notes !== undefined) {
        data.notes = data.notes.trim();
        if (data.notes.length === 0) {
          data.notes = null;
        }
      }

      // If connection settings changed, test the new connection
      if (data.imapHost || data.imapPort || data.imapUsername || data.imapPassword) {
        const account = await db.getEmailAccountById(id, ctx.user.id);
        if (!account) throw new Error('Account not found');

        const testResult = await testImapConnection({
          host: data.imapHost || account.imapHost!,
          port: data.imapPort || account.imapPort!,
          secure: data.imapSecure ?? account.imapSecure!,
          auth: {
            user: data.imapUsername || account.imapUsername!,
            pass: data.imapPassword || account.imapPassword!,
          },
        });

        if (!testResult.success) {
          throw new Error(`Connection failed: ${testResult.error}`);
        }
      }

      return db.updateEmailAccount(id, ctx.user.id, data);
    }),

  // Delete email account
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.deleteEmailAccount(input.id, ctx.user.id);
      if (!success) throw new Error('Failed to delete account');
      return { success: true };
    }),

  // Reorder accounts
  reorder: protectedProcedure
    .input(z.array(z.object({
      id: z.number(),
      sortOrder: z.number(),
    })))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(input.map(item =>
        db.updateAccountSortOrder(item.id, ctx.user.id, item.sortOrder)
      ));
      return { success: true };
    }),

  // Test IMAP connection
  testConnection: protectedProcedure
    .input(z.object({
      imapHost: z.string(),
      imapPort: z.number(),
      imapSecure: z.boolean(),
      imapUsername: z.string(),
      imapPassword: z.string(),
    }))
    .mutation(async ({ input }) => {
      return testImapConnection({
        host: input.imapHost,
        port: input.imapPort,
        secure: input.imapSecure,
        auth: {
          user: input.imapUsername,
          pass: input.imapPassword,
        },
      });
    }),

  // Manually sync an account
  sync: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.getEmailAccountById(input.id, ctx.user.id);
      if (!account) throw new Error('Account not found');
      
      if (account.accountType === 'google') {
        return syncGmailEmails(account);
      }
      if (account.accountType === 'microsoft') {
        return syncMicrosoftEmails(account);
      }
      return syncAccount(account.id);
    }),

  // Check if Google OAuth is configured
  googleOAuthStatus: protectedProcedure.query(() => {
    return { configured: isGoogleOAuthConfigured() };
  }),

  // Check if Microsoft OAuth is configured
  microsoftOAuthStatus: protectedProcedure.query(() => {
    return { configured: isMicrosoftOAuthConfigured() };
  }),

  // Get Google OAuth authorization URL
  getGoogleAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) {
        throw new Error('Google OAuth is not configured');
      }
      
      // Create a state token to prevent CSRF
      const state = randomBytes(16).toString('hex');
      
      // Store state in session or database for verification
      // For simplicity, we'll encode the userId in the state
      const stateWithUser = Buffer.from(JSON.stringify({
        userId: ctx.user.id,
        nonce: state,
      })).toString('base64url');
      
      const authUrl = getGoogleAuthUrl(input.redirectUri, stateWithUser);
      return { authUrl, state: stateWithUser };
    }),

  // Handle Google OAuth callback
  handleGoogleCallback: protectedProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
      redirectUri: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify state
      try {
        const stateData = JSON.parse(
          Buffer.from(input.state, 'base64url').toString()
        );
        
        if (stateData.userId !== ctx.user.id) {
          throw new Error('Invalid state: user mismatch');
        }
      } catch (e) {
        throw new Error('Invalid state token');
      }
      
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(input.code, input.redirectUri);
      
      // Get user info
      const userInfo = await getGoogleUserInfo(tokens.access_token);
      
      // Get Gmail profile
      const gmailProfile = await getGmailProfile(tokens.access_token);
      
      // Check if account already exists
      const existingAccounts = await db.getEmailAccountsByUserId(ctx.user.id);
      const existingAccount = existingAccounts.find(
        a => a.email === gmailProfile.emailAddress && a.accountType === 'google'
      );
      
      if (existingAccount) {
        // Update existing account with new tokens
        await db.updateEmailAccount(existingAccount.id, ctx.user.id, {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || existingAccount.googleRefreshToken,
          googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          isActive: true,
          syncStatus: 'idle',
        });

        const updatedAccount = await db.getEmailAccountById(existingAccount.id, ctx.user.id);
        
        return {
          success: true,
          account: updatedAccount || existingAccount,
          isNew: false,
        };
      }
      
      // Create new account
      const newAccount = await db.createEmailAccount({
        userId: ctx.user.id,
        email: gmailProfile.emailAddress,
        displayName: userInfo.name || gmailProfile.emailAddress,
        accountType: 'google',
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
        syncStatus: 'idle',
      });
      
      // Trigger initial sync
      syncGmailEmails(newAccount).catch(console.error);
      
      return {
        success: true,
        account: newAccount,
        isNew: true,
      };
    }),

  // Get Microsoft OAuth authorization URL
  getMicrosoftAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isMicrosoftOAuthConfigured()) {
        throw new Error('Microsoft OAuth is not configured');
      }

      const state = randomBytes(16).toString('hex');
      const stateWithUser = Buffer.from(JSON.stringify({
        userId: ctx.user.id,
        nonce: state,
      })).toString('base64url');

      const authUrl = getMicrosoftAuthUrl(input.redirectUri, stateWithUser);
      return { authUrl, state: stateWithUser };
    }),

  // Handle Microsoft OAuth callback
  handleMicrosoftCallback: protectedProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
      redirectUri: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const stateData = JSON.parse(
          Buffer.from(input.state, 'base64url').toString()
        );

        if (stateData.userId !== ctx.user.id) {
          throw new Error('Invalid state: user mismatch');
        }
      } catch (e) {
        throw new Error('Invalid state token');
      }

      const tokens = await exchangeMicrosoftCodeForTokens(input.code, input.redirectUri);
      const userInfo = await getMicrosoftUserInfo(tokens.id_token);
      const accountEmail = getMicrosoftAccountEmail(userInfo);

      if (!accountEmail) {
        throw new Error('Microsoft account email not available from provider response');
      }

      const existingAccounts = await db.getEmailAccountsByUserId(ctx.user.id);
      const existingAccount = existingAccounts.find(
        a => a.email === accountEmail && a.accountType === 'microsoft'
      );

      const updatePayload = {
        displayName: userInfo.displayName || accountEmail,
        accountType: 'microsoft' as const,
        microsoftAccessToken: tokens.access_token,
        microsoftRefreshToken: tokens.refresh_token,
        microsoftTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapSecure: true,
        imapUsername: accountEmail,
        imapPassword: null,
        isActive: true,
        syncStatus: 'idle' as const,
        lastSyncError: null,
      };

      if (existingAccount) {
        await db.updateEmailAccount(existingAccount.id, ctx.user.id, {
          ...updatePayload,
          microsoftRefreshToken: tokens.refresh_token || existingAccount.microsoftRefreshToken,
        });

        const updatedAccount = await db.getEmailAccountById(existingAccount.id, ctx.user.id);
        if (updatedAccount) {
          syncMicrosoftEmails(updatedAccount).catch(console.error);
        }

        return {
          success: true,
          account: updatedAccount || existingAccount,
          isNew: false,
        };
      }

      const newAccount = await db.createEmailAccount({
        userId: ctx.user.id,
        email: accountEmail,
        ...updatePayload,
      });

      syncMicrosoftEmails(newAccount).catch(console.error);

      return {
        success: true,
        account: newAccount,
        isNew: true,
      };
    }),
});

// ==================== Email Router ====================

const emailRouter = router({
  // List emails with filters
  list: protectedProcedure
    .input(z.object({
      accountId: z.number().optional(),
      folder: z.string().optional(),
      isRead: z.boolean().optional(),
      isStarred: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
      labelId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const emails = await db.getEmailsByUserId(ctx.user.id, input);
      const totalCount = await db.getEmailCountByUserId(ctx.user.id, input);

      // Fetch labels for these emails
      const emailIds = emails.map(e => e.id);
      const labels = await db.getLabelsForEmails(emailIds, ctx.user.id);

      return {
        items: emails.map(email => ({
          ...email,
          labels: labels.filter(l => l.emailId === email.id)
        })),
        totalCount,
      };
    }),

  // Get single email with attachments
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const email = await db.getEmailById(input.id, ctx.user.id);
      if (!email) throw new Error('Email not found');

      const attachments = await db.getAttachmentsByEmailId(input.id, ctx.user.id);
      
      // Mark as read
      if (!email.isRead) {
        await db.markEmailAsRead(input.id, ctx.user.id, true);
      }

      return { ...email, attachments };
    }),

  // Mark email as read/unread
  markRead: protectedProcedure
    .input(z.object({ id: z.number(), isRead: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.markEmailAsRead(input.id, ctx.user.id, input.isRead);
      return { success: true };
    }),

  // Toggle star
  toggleStar: protectedProcedure
    .input(z.object({ id: z.number(), isStarred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.toggleEmailStar(input.id, ctx.user.id, input.isStarred);
      return { success: true };
    }),

  // Get unread count
  unreadCount: protectedProcedure
    .input(z.object({ accountId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getUnreadCount(ctx.user.id, input.accountId);
    }),
});

// ==================== Attachment Router ====================

const attachmentRouter = router({
  // Get attachment by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getAttachmentById(input.id, ctx.user.id);
    }),

  // List attachments for an email
  listByEmail: protectedProcedure
    .input(z.object({ emailId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getAttachmentsByEmailId(input.emailId, ctx.user.id);
    }),
});

// ==================== API Key Router ====================

const apiKeyRouter = router({
  // List API keys
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db.getApiKeysByUserId(ctx.user.id);
    // Don't return the hash, just the prefix and metadata
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      lastUsedAt: k.lastUsedAt,
      usageCount: k.usageCount,
      isActive: k.isActive,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  }),

  // Create new API key
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      permissions: z.array(z.string()).optional(),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate a random API key
      const rawKey = `mm_${randomBytes(32).toString('hex')}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 11); // "mm_" + first 8 chars

      await db.createApiKey({
        userId: ctx.user.id,
        name: input.name,
        keyHash,
        keyPrefix,
        permissions: input.permissions || ['read'],
        expiresAt: input.expiresAt,
        isActive: true,
      });

      // Return the raw key only once - it won't be shown again
      return { key: rawKey, prefix: keyPrefix };
    }),

  // Set API key active status
  setActive: protectedProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.updateApiKeyActiveStatus(input.id, ctx.user.id, input.isActive);
      if (!success) throw new Error('Failed to update API key status');
      return { success: true };
    }),

  // Delete API key
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.deleteApiKey(input.id, ctx.user.id);
      if (!success) throw new Error('Failed to delete API key');
      return { success: true };
    }),
});

// ==================== Label Router ====================

const labelRouter = router({
  // List all labels for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getLabelsByUserId(ctx.user.id);
  }),

  // Get single label
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getLabelById(input.id, ctx.user.id);
    }),

  // Create new label
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().default('#6366f1'),
      description: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.createLabel({
        userId: ctx.user.id,
        name: input.name,
        color: input.color,
        description: input.description,
        icon: input.icon,
      });
    }),

  // Update label
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateLabel(id, ctx.user.id, data);
    }),

  // Delete label
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.deleteLabel(input.id, ctx.user.id);
      if (!success) throw new Error('Failed to delete label or label is a system label');
      return { success: true };
    }),

  // Add label to email
  addToEmail: protectedProcedure
    .input(z.object({
      emailId: z.number(),
      labelId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.addLabelToEmail(input.emailId, input.labelId, ctx.user.id);
      return { success: true };
    }),

  // Remove label from email
  removeFromEmail: protectedProcedure
    .input(z.object({
      emailId: z.number(),
      labelId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.removeLabelFromEmail(input.emailId, input.labelId, ctx.user.id);
      return { success: true };
    }),

  // Get labels for an email
  getForEmail: protectedProcedure
    .input(z.object({ emailId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getLabelsForEmail(input.emailId, ctx.user.id);
    }),

  // Get emails by label
  getEmails: protectedProcedure
    .input(z.object({
      labelId: z.number(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      return db.getEmailsByLabelId(input.labelId, ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get email count for label
  getEmailCount: protectedProcedure
    .input(z.object({ labelId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getEmailCountByLabel(input.labelId, ctx.user.id);
    }),
});

// ==================== Account Group Router ====================

const accountGroupRouter = router({
  // List all groups for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getAccountGroupsByUserId(ctx.user.id);
  }),

  // Get single group
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getAccountGroupById(input.id, ctx.user.id);
    }),

  // Create new group
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().default('#6366f1'),
      icon: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.createAccountGroup({
        userId: ctx.user.id,
        name: input.name,
        color: input.color,
        icon: input.icon,
      });
    }),

  // Update group
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      sortOrder: z.number().optional(),
      isCollapsed: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateAccountGroup(id, ctx.user.id, data);
    }),

  // Delete group
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.deleteAccountGroup(input.id, ctx.user.id);
      if (!success) throw new Error('Failed to delete group');
      return { success: true };
    }),

  // Get accounts in a group
  getAccounts: protectedProcedure
    .input(z.object({ groupId: z.number().nullable() }))
    .query(async ({ ctx, input }) => {
      return db.getAccountsByGroupId(input.groupId, ctx.user.id);
    }),

  // Move account to group
  moveAccount: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      groupId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateAccountGroup_ForAccount(input.accountId, ctx.user.id, input.groupId);
      return { success: true };
    }),

  // Update account sort order
  updateAccountOrder: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      sortOrder: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateAccountSortOrder(input.accountId, ctx.user.id, input.sortOrder);
      return { success: true };
    }),
});

// ==================== Stats Router ====================

const statsRouter = router({
  // Get dashboard stats
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.getEmailAccountsByUserId(ctx.user.id);
    const unreadCount = await db.getUnreadCount(ctx.user.id);
    const pollingStatus = getPollingStatus();

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.isActive).length,
      unreadEmails: unreadCount,
      pollingStatus,
    };
  }),
});

// ==================== Main Router ====================

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    registerPassword: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
        password: z.string().min(8).max(128),
        displayName: z.string().max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const usernameNormalized = normalizeUsername(input.username);
        const existing = await db.getPasswordCredentialByUsernameNormalized(usernameNormalized);
        if (existing) {
          throw new Error('用户名已存在');
        }

        const openId = `${LOCAL_OPENID_PREFIX}${usernameNormalized}`;
        await db.upsertUser({
          openId,
          name: input.displayName || input.username,
          loginMethod: 'password',
          lastSignedIn: new Date(),
        });

        const user = await db.getUserByOpenId(openId);
        if (!user) {
          throw new Error('创建用户失败');
        }

        const passwordHash = await hashPassword(input.password);
        await db.createPasswordCredential({
          userId: user.id,
          username: input.username,
          usernameNormalized,
          passwordHash,
          passwordUpdatedAt: new Date(),
        });

        await setAuthSessionCookie(ctx.req, ctx.res, user.openId, user.name || input.username);
        return { success: true };
      }),

    loginPassword: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const usernameNormalized = normalizeUsername(input.username);
        const forwardedFor = ctx.req.headers["x-forwarded-for"];
        const clientIp =
          (typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : undefined) ||
          ctx.req.ip ||
          "unknown";
        const rateLimitKey = buildLoginRateLimitKey(usernameNormalized, clientIp);

        const rateLimitStatus = checkLoginRateLimit(rateLimitKey);
        if (rateLimitStatus.blocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "登录失败次数过多，请稍后再试",
          });
        }

        const credential = await db.getPasswordCredentialByUsernameNormalized(usernameNormalized);
        if (!credential) {
          recordLoginFailure(rateLimitKey);
          throw new Error('用户名或密码错误');
        }

        const isValid = await verifyPassword(input.password, credential.passwordHash);
        if (!isValid) {
          recordLoginFailure(rateLimitKey);
          throw new Error('用户名或密码错误');
        }

        const user = await db.getUserById(credential.userId);
        if (!user) {
          recordLoginFailure(rateLimitKey);
          throw new Error('用户名或密码错误');
        }

        clearLoginFailures(rateLimitKey);

        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        await setAuthSessionCookie(ctx.req, ctx.res, user.openId, user.name || credential.username);
        return { success: true };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  emailAccount: emailAccountRouter,
  email: emailRouter,
  attachment: attachmentRouter,
  apiKey: apiKeyRouter,
  label: labelRouter,
  accountGroup: accountGroupRouter,
  stats: statsRouter,
  admin: adminRouter,
  tempMail: tempMailRouter,
});

export type AppRouter = typeof appRouter;
