import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail, Attachment as ParsedAttachment } from 'mailparser';
import { EmailAccount, InsertEmail, InsertAttachment } from '../../drizzle/schema';
import * as db from '../db';
import { storagePut } from '../storage';
import { nanoid } from 'nanoid';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass?: string;
    accessToken?: string;
  };
}

export interface SyncResult {
  success: boolean;
  newEmails: number;
  errors: string[];
}

/**
 * Create IMAP client connection
 */
export function createImapClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates
    },
  });
}

/**
 * Test IMAP connection
 */
function mapImapError(config: ImapConfig, error: any): string {
  const raw = String(error?.responseText || error?.response || error?.message || "Connection failed");
  const host = config.host.toLowerCase();

  if (/AUTHENTICATE failed|Invalid login|LOGIN failed|authentication failed/i.test(raw)) {
    if (host.includes("office365.com") || host.includes("outlook")) {
      return "Outlook/Hotmail 拒绝了 IMAP 登录。你当前密码本身可能没错，但微软通常不接受普通账户密码做 IMAP 基础认证。请先确认该账号已开启 IMAP；如果账号开启了两步验证，请改用应用专用密码；如果是个人 Outlook/Hotmail 账号且仍失败，通常需要改用微软 OAuth，而不是直接用密码登录。";
    }
    if (host.includes("gmail.com")) {
      return "Gmail 拒绝了 IMAP 登录。请确认已开启 IMAP，并使用应用专用密码，而不是普通登录密码。";
    }
    return "用户名或密码错误，或邮箱服务商已禁用当前这种 IMAP 登录方式。";
  }

  if (/ECONNREFUSED|connect ECONNREFUSED/i.test(raw)) {
    return "连接被拒绝。请检查 IMAP 服务器地址和端口是否正确，以及目标服务器是否可达。";
  }

  if (/ETIMEDOUT|timeout/i.test(raw)) {
    return "连接超时。请检查网络、服务器地址和端口。";
  }

  if (/certificate|tls|ssl/i.test(raw)) {
    return `TLS/SSL 握手失败：${raw}`;
  }

  return raw;
}

export async function testImapConnection(config: ImapConfig): Promise<{ success: boolean; error?: string }> {
  const client = createImapClient(config);
  
  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: mapImapError(config, error)
    };
  }
}

/**
 * Sync emails from IMAP account
 */
export async function syncImapEmails(account: EmailAccount, maxEmails: number = 50): Promise<SyncResult> {
  if (account.accountType !== 'imap' && account.accountType !== 'microsoft') {
    return { success: false, newEmails: 0, errors: ['Not an IMAP-capable account'] };
  }

  const isMicrosoftOAuth = account.accountType === 'microsoft';

  const config: ImapConfig = {
    host: account.imapHost || 'outlook.office365.com',
    port: account.imapPort || 993,
    secure: account.imapSecure ?? true,
    auth: {
      user: account.imapUsername || account.email,
      ...(isMicrosoftOAuth
        ? { accessToken: account.microsoftAccessToken! }
        : { pass: account.imapPassword! }),
    },
  };

  const client = createImapClient(config);
  const errors: string[] = [];
  let newEmails = 0;

  try {
    // Update sync status
    await db.updateAccountSyncStatus(account.id, 'syncing');
    
    await client.connect();
    
    // Select INBOX
    const mailbox = await client.mailboxOpen('INBOX');
    
    // Get the latest UID we have synced
    const latestUid = await db.getLatestEmailUid(account.id);
    
    // Fetch new messages
    let searchCriteria: any = { seen: false }; // Start with unread
    if (latestUid) {
      searchCriteria = { uid: `${latestUid + 1}:*` };
    }
    
    // Fetch recent messages
    const messages: any[] = [];
    for await (const message of client.fetch(
      latestUid ? { uid: `${latestUid + 1}:*` } : `${Math.max(1, mailbox.exists - maxEmails)}:*`,
      { 
        envelope: true, 
        source: true,
        uid: true,
        flags: true,
      }
    )) {
      messages.push(message);
    }
    
    // Process messages
    for (const message of messages) {
      try {
        // Check if email already exists
        const existingEmail = await db.getEmailByMessageId(message.envelope.messageId, account.id);
        if (existingEmail) continue;
        
        // Parse the email
        const parsed = await simpleParser(message.source);
        
        // Create email record
        const emailData: InsertEmail = {
          accountId: account.id,
          userId: account.userId,
          messageId: message.envelope.messageId || nanoid(),
          uid: Number(message.uid),
          subject: parsed.subject || '(No Subject)',
          fromAddress: parsed.from?.value[0]?.address || '',
          fromName: parsed.from?.value[0]?.name || '',
          toAddresses: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(t => t.value.map(v => v.address || '')) : [],
          ccAddresses: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap(t => t.value.map(v => v.address || '')) : [],
          replyTo: parsed.replyTo?.value[0]?.address,
          textBody: parsed.text || '',
          htmlBody: parsed.html || '',
          snippet: (parsed.text || '').substring(0, 200),
          date: parsed.date || new Date(),
          receivedAt: new Date(),
          isRead: message.flags?.has('\\Seen') || false,
          isStarred: message.flags?.has('\\Flagged') || false,
          isImportant: message.flags?.has('\\Important') || false,
          folder: 'INBOX',
          hasAttachments: (parsed.attachments?.length || 0) > 0,
          attachmentCount: parsed.attachments?.length || 0,
        };
        
        const createdEmail = await db.createEmail(emailData);
        newEmails++;
        
        // Process attachments
        if (parsed.attachments && parsed.attachments.length > 0) {
          await processAttachments(parsed.attachments, createdEmail.id, account.userId);
        }
        
      } catch (emailError: any) {
        errors.push(`Failed to process email: ${emailError.message}`);
      }
    }
    
    await client.logout();
    await db.updateAccountSyncStatus(account.id, 'idle');
    
    return { success: true, newEmails, errors };
    
  } catch (error: any) {
    await db.updateAccountSyncStatus(account.id, 'error', error.message);
    return { 
      success: false, 
      newEmails, 
      errors: [...errors, error.message] 
    };
  }
}

/**
 * Process and upload attachments to S3
 */
async function processAttachments(
  attachments: ParsedAttachment[], 
  emailId: number, 
  userId: number
): Promise<void> {
  for (const attachment of attachments) {
    try {
      const filename = attachment.filename || `attachment_${nanoid(8)}`;
      const s3Key = `attachments/${userId}/${emailId}/${nanoid()}_${filename}`;
      
      // Upload to S3
      const { url } = await storagePut(s3Key, attachment.content, attachment.contentType);
      
      // Create attachment record
      const attachmentData: InsertAttachment = {
        emailId,
        userId,
        filename,
        mimeType: attachment.contentType,
        size: attachment.size,
        s3Key,
        s3Url: url,
        contentId: attachment.contentId,
        isInline: attachment.contentDisposition === 'inline',
        isDownloaded: true,
      };
      
      await db.createAttachment(attachmentData);
      
    } catch (error: any) {
      // Log error but continue with other attachments
      console.error(`Failed to process attachment: ${error.message}`);
      
      // Create attachment record without S3 upload
      await db.createAttachment({
        emailId,
        userId,
        filename: attachment.filename || 'unknown',
        mimeType: attachment.contentType,
        size: attachment.size,
        isDownloaded: false,
        downloadError: error.message,
      });
    }
  }
}

/**
 * Fetch a specific email by UID
 */
export async function fetchEmailByUid(account: EmailAccount, uid: number): Promise<ParsedMail | null> {
  if (account.accountType !== 'imap' && account.accountType !== 'microsoft') {
    return null;
  }

  const isMicrosoftOAuth = account.accountType === 'microsoft';

  const config: ImapConfig = {
    host: account.imapHost || 'outlook.office365.com',
    port: account.imapPort || 993,
    secure: account.imapSecure ?? true,
    auth: {
      user: account.imapUsername || account.email,
      ...(isMicrosoftOAuth
        ? { accessToken: account.microsoftAccessToken! }
        : { pass: account.imapPassword! }),
    },
  };

  const client = createImapClient(config);

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    
    const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
    
    if (message && 'source' in message && message.source) {
      const parsed = await simpleParser(message.source as Buffer);
      await client.logout();
      return parsed;
    }
    
    await client.logout();
    return null;
    
  } catch (error) {
    console.error('Failed to fetch email:', error);
    return null;
  }
}
