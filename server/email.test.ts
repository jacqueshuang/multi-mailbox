import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getEmailAccountsByUserId: vi.fn(),
  getEmailAccountById: vi.fn(),
  createEmailAccount: vi.fn(),
  updateEmailAccount: vi.fn(),
  deleteEmailAccount: vi.fn(),
  getEmailsByUserId: vi.fn(),
  getEmailCountByUserId: vi.fn(),
  getEmailById: vi.fn(),
  markEmailAsRead: vi.fn(),
  toggleEmailStar: vi.fn(),
  getUnreadCount: vi.fn(),
  getAttachmentsByEmailId: vi.fn(),
  getAttachmentById: vi.fn(),
  getApiKeysByUserId: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getLabelsForEmails: vi.fn(),
}));

// Mock the IMAP service
vi.mock("./services/imapService", () => ({
  testImapConnection: vi.fn(),
  syncImapEmails: vi.fn(),
}));

// Mock the polling service
vi.mock("./services/emailPollingService", () => ({
  syncAccount: vi.fn(),
  getPollingStatus: vi.fn(),
}));

import * as db from "./db";
import { testImapConnection, syncImapEmails } from "./services/imapService";
import { syncAccount, getPollingStatus } from "./services/emailPollingService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("emailAccount router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists email accounts for authenticated user", async () => {
    const mockAccounts = [
      {
        id: 1,
        userId: 1,
        email: "user@gmail.com",
        displayName: "My Gmail",
        accountType: "imap",
        isActive: true,
        syncStatus: "idle",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(db.getEmailAccountsByUserId).mockResolvedValue(mockAccounts as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.emailAccount.list();

    expect(result).toEqual(mockAccounts);
    expect(db.getEmailAccountsByUserId).toHaveBeenCalledWith(1);
  });

  it("gets a single email account by ID", async () => {
    const mockAccount = {
      id: 1,
      userId: 1,
      email: "user@gmail.com",
      displayName: "My Gmail",
      accountType: "imap",
      isActive: true,
      syncStatus: "idle",
    };

    vi.mocked(db.getEmailAccountById).mockResolvedValue(mockAccount as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.emailAccount.get({ id: 1 });

    expect(result).toEqual(mockAccount);
    expect(db.getEmailAccountById).toHaveBeenCalledWith(1, 1);
  });

  it("deletes an email account", async () => {
    vi.mocked(db.deleteEmailAccount).mockResolvedValue(true);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.emailAccount.delete({ id: 1 });

    expect(result).toEqual({ success: true });
    expect(db.deleteEmailAccount).toHaveBeenCalledWith(1, 1);
  });

  it("tests IMAP connection", async () => {
    vi.mocked(testImapConnection).mockResolvedValue({ success: true });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.emailAccount.testConnection({
      imapHost: "imap.gmail.com",
      imapPort: 993,
      imapSecure: true,
      imapUsername: "user@gmail.com",
      imapPassword: "password",
    });

    expect(result).toEqual({ success: true });
    expect(testImapConnection).toHaveBeenCalledWith({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: "user@gmail.com",
        pass: "password",
      },
    });
  });
});

describe("email router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists emails for authenticated user", async () => {
    const mockEmails = [
      {
        id: 1,
        accountId: 1,
        messageId: "msg-1",
        subject: "Test Email",
        fromAddress: "sender@example.com",
        isRead: false,
        isStarred: false,
        date: new Date(),
      },
    ];

    vi.mocked(db.getEmailsByUserId).mockResolvedValue(mockEmails as any);
    vi.mocked(db.getEmailCountByUserId).mockResolvedValue(1);
    vi.mocked(db.getLabelsForEmails).mockResolvedValue([] as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.email.list({ limit: 50, offset: 0 });

    expect(result).toEqual({
      items: [{ ...mockEmails[0], labels: [] }],
      totalCount: 1,
    });
    expect(db.getEmailsByUserId).toHaveBeenCalledWith(1, { limit: 50, offset: 0 });
    expect(db.getEmailCountByUserId).toHaveBeenCalledWith(1, { limit: 50, offset: 0 });
    expect(db.getLabelsForEmails).toHaveBeenCalledWith([1], 1);
  });

  it("gets a single email and marks it as read", async () => {
    const mockEmail = {
      id: 1,
      accountId: 1,
      messageId: "msg-1",
      subject: "Test Email",
      fromAddress: "sender@example.com",
      isRead: false,
      isStarred: false,
      date: new Date(),
    };

    const mockAttachments: any[] = [];

    vi.mocked(db.getEmailById).mockResolvedValue(mockEmail as any);
    vi.mocked(db.getAttachmentsByEmailId).mockResolvedValue(mockAttachments);
    vi.mocked(db.markEmailAsRead).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.email.get({ id: 1 });

    expect(result).toEqual({ ...mockEmail, attachments: mockAttachments });
    expect(db.getEmailById).toHaveBeenCalledWith(1, 1);
    expect(db.markEmailAsRead).toHaveBeenCalledWith(1, 1, true);
  });

  it("toggles email star status", async () => {
    vi.mocked(db.toggleEmailStar).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.email.toggleStar({ id: 1, isStarred: true });

    expect(result).toEqual({ success: true });
    expect(db.toggleEmailStar).toHaveBeenCalledWith(1, 1, true);
  });

  it("gets unread count", async () => {
    vi.mocked(db.getUnreadCount).mockResolvedValue(5);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.email.unreadCount({});

    expect(result).toBe(5);
    expect(db.getUnreadCount).toHaveBeenCalledWith(1, undefined);
  });
});

describe("apiKey router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists API keys for authenticated user", async () => {
    const mockKeys = [
      {
        id: 1,
        userId: 1,
        name: "My API Key",
        keyPrefix: "mm_abc123",
        keyHash: "hashed",
        permissions: ["read"],
        isActive: true,
        usageCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(db.getApiKeysByUserId).mockResolvedValue(mockKeys as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.apiKey.list();

    // Should not include keyHash
    expect(result[0]).not.toHaveProperty("keyHash");
    expect(result[0]).toHaveProperty("name", "My API Key");
    expect(result[0]).toHaveProperty("keyPrefix", "mm_abc123");
  });

  it("creates a new API key", async () => {
    vi.mocked(db.createApiKey).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.apiKey.create({
      name: "New Key",
      permissions: ["read", "write"],
    });

    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("prefix");
    expect(result.key).toMatch(/^mm_/);
    expect(db.createApiKey).toHaveBeenCalled();
  });

  it("deletes an API key", async () => {
    vi.mocked(db.deleteApiKey).mockResolvedValue(true);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.apiKey.delete({ id: 1 });

    expect(result).toEqual({ success: true });
    expect(db.deleteApiKey).toHaveBeenCalledWith(1, 1);
  });
});

describe("stats router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard stats", async () => {
    const mockAccounts = [
      { id: 1, isActive: true },
      { id: 2, isActive: false },
    ];

    vi.mocked(db.getEmailAccountsByUserId).mockResolvedValue(mockAccounts as any);
    vi.mocked(db.getUnreadCount).mockResolvedValue(10);
    vi.mocked(getPollingStatus).mockReturnValue({
      isRunning: true,
      lastPollTime: Date.now(),
      activeAccounts: 1,
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.stats.dashboard();

    expect(result).toEqual({
      totalAccounts: 2,
      activeAccounts: 1,
      unreadEmails: 10,
      pollingStatus: {
        isRunning: true,
        lastPollTime: expect.any(Number),
        activeAccounts: 1,
      },
    });
  });
});
