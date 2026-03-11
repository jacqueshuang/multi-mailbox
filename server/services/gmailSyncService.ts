import * as db from "../db";
import { storagePut } from "../storage";
import {
  refreshAccessToken,
  getGmailMessages,
  getGmailMessage,
  getGmailAttachment,
  parseGmailMessage,
} from "./googleOAuthService";
import { broadcastNewEmail } from "./emailPollingService";
import { notifyOwner } from "../_core/notification";

/**
 * 同步 Gmail 邮箱的邮件
 */
export async function syncGmailEmails(
  account: NonNullable<Awaited<ReturnType<typeof db.getEmailAccountById>>>
): Promise<{ success: boolean; newEmails: number; error?: string }> {
  if (account.accountType !== "google" || !account.googleRefreshToken) {
    return { success: false, newEmails: 0, error: "Invalid Google account" };
  }

  console.log(`[Gmail Sync] Starting sync for account ${account.id} (${account.email})`);

  try {
    // 更新同步状态
    await db.updateEmailAccount(account.id, account.userId, {
      syncStatus: "syncing",
    });

    // 刷新 access token
    const tokens = await refreshAccessToken(account.googleRefreshToken);
    const accessToken = tokens.access_token;

    // 如果返回了新的 refresh token，更新数据库
    if (tokens.refresh_token) {
      await db.updateEmailAccount(account.id, account.userId, {
        googleRefreshToken: tokens.refresh_token,
      });
    }

    // 获取最近的邮件列表
    const messagesResponse = await getGmailMessages(accessToken, {
      maxResults: 50,
      labelIds: ["INBOX"],
    });

    if (!messagesResponse.messages || messagesResponse.messages.length === 0) {
      console.log(`[Gmail Sync] No messages found for account ${account.id}`);
      await db.updateEmailAccount(account.id, account.userId, {
        syncStatus: "idle",
        lastSyncAt: new Date(),
      });
      return { success: true, newEmails: 0 };
    }

    let newEmailCount = 0;

    // 处理每封邮件
    for (const msgRef of messagesResponse.messages) {
      try {
        // 检查邮件是否已存在
        const existingEmail = await db.getEmailByMessageId(
          `gmail:${msgRef.id}`,
          account.id
        );

        if (existingEmail) {
          continue; // 跳过已存在的邮件
        }

        // 获取邮件详情
        const fullMessage = await getGmailMessage(accessToken, msgRef.id, "full");
        const parsed = parseGmailMessage(fullMessage);

        // 保存邮件到数据库
        const savedEmail = await db.createEmail({
          accountId: account.id,
          userId: account.userId,
          messageId: `gmail:${parsed.id}`,
          subject: parsed.subject,
          fromAddress: parsed.from,
          fromName: parsed.fromName,
          toAddresses: [parsed.to],
          date: parsed.date,
          snippet: parsed.snippet,
          textBody: parsed.body,
          htmlBody: parsed.bodyHtml,
          isRead: parsed.isRead,
          isStarred: parsed.isStarred,
          folder: "INBOX",
          hasAttachments: parsed.attachments.length > 0,
        });

        // 处理附件
        if (parsed.attachments.length > 0 && savedEmail) {
          for (const att of parsed.attachments) {
            try {
              // 下载附件
              const attachmentData = await getGmailAttachment(
                accessToken,
                parsed.id,
                att.id
              );

              // 解码 base64url 数据
              const buffer = Buffer.from(attachmentData.data, "base64url");

              // 上传到 S3
              const fileKey = `attachments/${account.userId}/${savedEmail.id}/${Date.now()}-${att.filename}`;
              const { url } = await storagePut(fileKey, buffer, att.mimeType);

              // 保存附件记录
              await db.createAttachment({
                emailId: savedEmail.id,
                userId: account.userId,
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                s3Key: fileKey,
                s3Url: url,
              });
            } catch (attError) {
              console.error(
                `[Gmail Sync] Failed to process attachment ${att.filename}:`,
                attError
              );
            }
          }
        }

        newEmailCount++;

        // 广播新邮件通知
        if (savedEmail) {
          broadcastNewEmail(account.userId, {
            id: savedEmail.id,
            accountId: account.id,
            subject: parsed.subject,
            fromAddress: parsed.from,
            fromName: parsed.fromName,
            snippet: parsed.snippet,
            date: parsed.date,
          }, account);
        }
      } catch (msgError) {
        console.error(
          `[Gmail Sync] Failed to process message ${msgRef.id}:`,
          msgError
        );
      }
    }

    // 更新同步状态
    await db.updateEmailAccount(account.id, account.userId, {
      syncStatus: "idle",
      lastSyncAt: new Date(),
      lastSyncError: null,
    });

    console.log(
      `[Gmail Sync] Completed sync for account ${account.id}, ${newEmailCount} new emails`
    );

    // 如果有新邮件，通知应用所有者
    if (newEmailCount > 0) {
      await notifyOwner({
        title: `📬 收到 ${newEmailCount} 封新邮件`,
        content: `邮箱 ${account.email} 同步完成，收到 ${newEmailCount} 封新邮件。`,
      });
    }

    return { success: true, newEmails: newEmailCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Gmail Sync] Sync failed for account ${account.id}:`, error);

    // 更新错误状态
    await db.updateEmailAccount(account.id, account.userId, {
      syncStatus: "error",
      lastSyncError: errorMessage,
    });

    // 通知所有者同步失败
    await notifyOwner({
      title: "⚠️ Gmail 同步失败",
      content: `邮箱 ${account.email} 同步失败: ${errorMessage}`,
    });

    return { success: false, newEmails: 0, error: errorMessage };
  }
}

/**
 * 同步单个 Gmail 账户（用于手动触发）
 */
export async function syncGmailAccount(accountId: number, userId: number): Promise<{
  success: boolean;
  newEmails: number;
  error?: string;
}> {
  const account = await db.getEmailAccountById(accountId, userId);
  
  if (!account) {
    return { success: false, newEmails: 0, error: "Account not found" };
  }

  if (account.accountType !== "google") {
    return { success: false, newEmails: 0, error: "Not a Google account" };
  }

  return syncGmailEmails(account);
}
