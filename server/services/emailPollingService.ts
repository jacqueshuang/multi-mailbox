import { EmailAccount } from '../../drizzle/schema';
import * as db from '../db';
import { syncImapEmails, SyncResult } from './imapService';
import { syncGmailEmails } from './gmailSyncService';
import { syncMicrosoftEmails } from './microsoftSyncService';
import { notifyOwner } from '../_core/notification';
import { refreshAccessToken } from './googleOAuthService';
import { refreshMicrosoftAccessToken } from './microsoftOAuthService';

// Store for WebSocket connections
const wsConnections = new Map<number, Set<any>>();

// Polling interval in milliseconds (default: 2 minutes)
const POLLING_INTERVAL = 2 * 60 * 1000;
const AUTH_CHECK_INTERVAL = 30 * 60 * 1000;
const AUTH_EXPIRY_WARNING_MS = 10 * 60 * 1000;
const TEMP_MAIL_CLEANUP_INTERVAL = 30 * 60 * 1000;

let lastAuthCheckAt = 0;
let lastTempMailCleanupAt = 0;

// Track polling state
let isPolling = false;
let pollingTimer: NodeJS.Timeout | null = null;

/**
 * Register a WebSocket connection for a user
 */
export function registerWsConnection(userId: number, ws: any): void {
  if (!wsConnections.has(userId)) {
    wsConnections.set(userId, new Set());
  }
  wsConnections.get(userId)!.add(ws);
  
  console.log(`[WebSocket] User ${userId} connected. Total connections: ${wsConnections.get(userId)!.size}`);
}

/**
 * Unregister a WebSocket connection
 */
export function unregisterWsConnection(userId: number, ws: any): void {
  const connections = wsConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      wsConnections.delete(userId);
    }
  }
  console.log(`[WebSocket] User ${userId} disconnected.`);
}

/**
 * Send notification to user via WebSocket
 */
export function notifyUser(userId: number, event: string, data: any): void {
  const connections = wsConnections.get(userId);
  if (!connections || connections.size === 0) {
    console.log(`[WebSocket] No connections for user ${userId}`);
    return;
  }
  
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  
  connections.forEach((ws) => {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
    }
  });
}

/**
 * Broadcast new email notification
 */
export function broadcastNewEmail(userId: number, email: any, account: EmailAccount): void {
  notifyUser(userId, 'new_email', {
    email: {
      id: email.id,
      subject: email.subject,
      fromAddress: email.fromAddress,
      fromName: email.fromName,
      snippet: email.snippet,
      date: email.date,
      accountId: account.id,
      accountEmail: account.email,
    },
    account: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
    },
  });
}

/**
 * Broadcast sync status update
 */
export function broadcastSyncStatus(userId: number, accountId: number, status: string, error?: string): void {
  notifyUser(userId, 'sync_status', {
    accountId,
    status,
    error,
    timestamp: Date.now(),
  });
}

/**
 * Sync all active accounts
 */
export async function syncAllAccounts(): Promise<Map<number, SyncResult>> {
  const results = new Map<number, SyncResult>();

  try {
    const accounts = await db.getActiveEmailAccounts();
    console.log(`[Polling] Starting sync for ${accounts.length} active accounts`);

    const now = Date.now();
    if (now - lastAuthCheckAt >= AUTH_CHECK_INTERVAL) {
      lastAuthCheckAt = now;
      await checkAccountsAuthAvailability(accounts);
    }

    if (now - lastTempMailCleanupAt >= TEMP_MAIL_CLEANUP_INTERVAL) {
      lastTempMailCleanupAt = now;
      await cleanupExpiredTempMailboxes();
    }

    for (const account of accounts) {
      try {
        // Notify user that sync is starting
        broadcastSyncStatus(account.userId, account.id, 'syncing');

        let result: SyncResult;

        if (account.accountType === 'imap') {
          result = await syncImapEmails(account);
        } else if (account.accountType === 'google') {
          const gmailResult = await syncGmailEmails(account);
          result = {
            success: gmailResult.success,
            newEmails: gmailResult.newEmails,
            errors: gmailResult.error ? [gmailResult.error] : [],
          };
        } else if (account.accountType === 'microsoft') {
          const microsoftResult = await syncMicrosoftEmails(account);
          result = {
            success: microsoftResult.success,
            newEmails: microsoftResult.newEmails,
            errors: microsoftResult.error ? [microsoftResult.error] : [],
          };
        } else {
          result = { success: false, newEmails: 0, errors: ['Unknown account type'] };
        }

        results.set(account.id, result);

        // Notify user of sync completion
        broadcastSyncStatus(
          account.userId,
          account.id,
          result.success ? 'idle' : 'error',
          result.errors.length > 0 ? result.errors.join('; ') : undefined
        );

        // If new emails were found, fetch and notify
        if (result.newEmails > 0) {
          const newEmails = await db.getEmailsByUserId(account.userId, {
            accountId: account.id,
            limit: result.newEmails,
          });

          for (const email of newEmails) {
            broadcastNewEmail(account.userId, email, account);
          }

          // Notify owner about important emails (e.g., from specific senders)
          await checkAndNotifyImportantEmails(newEmails, account);
        }

        // Handle sync errors
        if (!result.success && result.errors.length > 0) {
          await notifyOwnerAboutSyncError(account, result.errors);
        }

      } catch (error: any) {
        console.error(`[Polling] Error syncing account ${account.id}:`, error);
        results.set(account.id, {
          success: false,
          newEmails: 0,
          errors: [error.message],
        });

        broadcastSyncStatus(account.userId, account.id, 'error', error.message);
      }
    }

  } catch (error) {
    console.error('[Polling] Error fetching active accounts:', error);
  }

  return results;
}

/**
 * Check for important emails and notify owner
 */
async function checkAndNotifyImportantEmails(emails: any[], account: EmailAccount): Promise<void> {
  // Define criteria for important emails
  const importantKeywords = ['urgent', 'important', 'critical', 'asap', 'emergency'];
  
  for (const email of emails) {
    const subject = (email.subject || '').toLowerCase();
    const isImportant = email.isImportant || 
      importantKeywords.some(keyword => subject.includes(keyword));
    
    if (isImportant) {
      try {
        await notifyOwner({
          title: `📧 Important Email: ${email.subject}`,
          content: `From: ${email.fromName || email.fromAddress}\nAccount: ${account.email}\nSnippet: ${email.snippet}`,
        });
        
        // Log the notification
        await db.createNotificationLog({
          userId: account.userId,
          type: 'important_email',
          title: `Important Email: ${email.subject}`,
          content: `From: ${email.fromAddress}`,
          emailId: email.id,
          accountId: account.id,
          isSent: true,
          sentAt: new Date(),
        });
      } catch (error) {
        console.error('[Notification] Failed to notify owner:', error);
      }
    }
  }
}

/**
 * Notify owner about sync errors
 */
async function notifyOwnerAboutSyncError(account: EmailAccount, errors: string[]): Promise<void> {
  try {
    await notifyOwner({
      title: `⚠️ Email Sync Error: ${account.email}`,
      content: `Account: ${account.email}\nErrors: ${errors.join(', ')}`,
    });

    await db.createNotificationLog({
      userId: account.userId,
      type: 'sync_error',
      title: `Sync Error: ${account.email}`,
      content: errors.join('; '),
      accountId: account.id,
      isSent: true,
      sentAt: new Date(),
    });
  } catch (error) {
    console.error('[Notification] Failed to notify owner about sync error:', error);
  }
}

async function checkAccountsAuthAvailability(accounts: EmailAccount[]): Promise<void> {
  const now = Date.now();

  for (const account of accounts) {
    try {
      if (account.accountType === 'google') {
        if (!account.googleTokenExpiry || !account.googleRefreshToken) continue;
        const expiresAt = account.googleTokenExpiry.getTime();
        if (expiresAt - now > AUTH_EXPIRY_WARNING_MS) continue;

        const tokens = await refreshAccessToken(account.googleRefreshToken);
        await db.updateEmailAccount(account.id, account.userId, {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || account.googleRefreshToken,
          googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          lastSyncError: null,
          syncStatus: 'idle',
        });
      }

      if (account.accountType === 'microsoft') {
        if (!account.microsoftTokenExpiry || !account.microsoftRefreshToken) continue;
        const expiresAt = account.microsoftTokenExpiry.getTime();
        if (expiresAt - now > AUTH_EXPIRY_WARNING_MS) continue;

        const tokens = await refreshMicrosoftAccessToken(account.microsoftRefreshToken);
        await db.updateEmailAccount(account.id, account.userId, {
          microsoftAccessToken: tokens.access_token,
          microsoftRefreshToken: tokens.refresh_token || account.microsoftRefreshToken,
          microsoftTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          lastSyncError: null,
          syncStatus: 'idle',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const message = `认证已失效，请重新连接邮箱。${errorMessage ? ` ${errorMessage}` : ''}`;
      await db.updateEmailAccount(account.id, account.userId, {
        lastSyncError: message,
        syncStatus: 'error',
      });
      broadcastSyncStatus(account.userId, account.id, 'error', message);
    }
  }
}

async function cleanupExpiredTempMailboxes(): Promise<void> {
  const expired = await db.listExpiredTempMailboxes(new Date());
  for (const mailbox of expired) {
    await db.updateTempMailbox(mailbox.id, mailbox.userId, { isActive: false });
    await db.updateEmailAccount(mailbox.accountId, mailbox.userId, { isActive: false });
  }
}

/**
 * Start the polling service
 */
export function startPolling(): void {
  if (isPolling) {
    console.log('[Polling] Already running');
    return;
  }
  
  isPolling = true;
  console.log(`[Polling] Starting email polling service (interval: ${POLLING_INTERVAL / 1000}s)`);
  
  // Initial sync
  syncAllAccounts().catch(console.error);
  
  // Set up interval
  pollingTimer = setInterval(() => {
    syncAllAccounts().catch(console.error);
  }, POLLING_INTERVAL);
}

/**
 * Stop the polling service
 */
export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  isPolling = false;
  console.log('[Polling] Stopped email polling service');
}

/**
 * Manually trigger sync for a specific account
 */
export async function syncAccount(accountId: number): Promise<SyncResult> {
  const accounts = await db.getActiveEmailAccounts();
  const account = accounts.find(a => a.id === accountId);
  
  if (!account) {
    return { success: false, newEmails: 0, errors: ['Account not found'] };
  }
  
  broadcastSyncStatus(account.userId, account.id, 'syncing');
  
  let result: SyncResult;
  
  if (account.accountType === 'imap') {
    result = await syncImapEmails(account);
  } else if (account.accountType === 'google') {
    const gmailResult = await syncGmailEmails(account);
    result = {
      success: gmailResult.success,
      newEmails: gmailResult.newEmails,
      errors: gmailResult.error ? [gmailResult.error] : [],
    };
  } else if (account.accountType === 'microsoft') {
    const microsoftResult = await syncMicrosoftEmails(account);
    result = {
      success: microsoftResult.success,
      newEmails: microsoftResult.newEmails,
      errors: microsoftResult.error ? [microsoftResult.error] : [],
    };
  } else {
    result = { success: false, newEmails: 0, errors: ['Unknown account type'] };
  }
  
  broadcastSyncStatus(
    account.userId,
    account.id,
    result.success ? 'idle' : 'error',
    result.errors.length > 0 ? result.errors.join('; ') : undefined
  );
  
  return result;
}

/**
 * Get polling status
 */
export function getPollingStatus(): { isRunning: boolean; interval: number } {
  return {
    isRunning: isPolling,
    interval: POLLING_INTERVAL,
  };
}
