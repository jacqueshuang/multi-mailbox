import * as db from "../db";
import { broadcastNewEmail } from "./emailPollingService";
import { notifyOwner } from "../_core/notification";
import { refreshMicrosoftAccessToken } from "./microsoftOAuthService";
import { syncImapEmails } from "./imapService";

export async function syncMicrosoftEmails(
  account: NonNullable<Awaited<ReturnType<typeof db.getEmailAccountById>>>
): Promise<{ success: boolean; newEmails: number; error?: string }> {
  if (account.accountType !== "microsoft" || !account.microsoftRefreshToken) {
    return { success: false, newEmails: 0, error: "Invalid Microsoft account" };
  }

  console.log(`[Microsoft Sync] Starting sync for account ${account.id} (${account.email})`);

  try {
    await db.updateEmailAccount(account.id, account.userId, {
      syncStatus: "syncing",
    });

    const tokens = await refreshMicrosoftAccessToken(account.microsoftRefreshToken);

    await db.updateEmailAccount(account.id, account.userId, {
      microsoftAccessToken: tokens.access_token,
      microsoftRefreshToken: tokens.refresh_token || account.microsoftRefreshToken,
      microsoftTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      lastSyncError: null,
    });

    const refreshedAccount = await db.getEmailAccountById(account.id, account.userId);
    if (!refreshedAccount) {
      throw new Error("Account not found after Microsoft token refresh");
    }

    const syncResult = await syncImapEmails(refreshedAccount, 50);

    if (!syncResult.success) {
      const errorMessage = syncResult.errors.join(", ") || "Microsoft IMAP sync failed";
      await db.updateEmailAccount(account.id, account.userId, {
        syncStatus: "error",
        lastSyncError: errorMessage,
      });

      await notifyOwner({
        title: "⚠️ Microsoft 邮箱同步失败",
        content: `邮箱 ${account.email} 同步失败: ${errorMessage}`,
      });

      return {
        success: false,
        newEmails: syncResult.newEmails,
        error: errorMessage,
      };
    }

    if (syncResult.newEmails > 0) {
      const newEmails = await db.getEmailsByUserId(account.userId, {
        accountId: account.id,
        limit: syncResult.newEmails,
      });

      for (const email of newEmails) {
        broadcastNewEmail(account.userId, email, refreshedAccount);
      }

      await notifyOwner({
        title: `📬 收到 ${syncResult.newEmails} 封 Microsoft 新邮件`,
        content: `邮箱 ${account.email} 同步完成，收到 ${syncResult.newEmails} 封新邮件。`,
      });
    }

    return { success: true, newEmails: syncResult.newEmails };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Microsoft Sync] Sync failed for account ${account.id}:`, error);

    await db.updateEmailAccount(account.id, account.userId, {
      syncStatus: "error",
      lastSyncError: errorMessage,
    });

    await notifyOwner({
      title: "⚠️ Microsoft 邮箱同步失败",
      content: `邮箱 ${account.email} 同步失败: ${errorMessage}`,
    });

    return { success: false, newEmails: 0, error: errorMessage };
  }
}
