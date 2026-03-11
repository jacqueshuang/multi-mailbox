import { Router, Request, Response } from "express";
import { simpleParser } from "mailparser";
import * as db from "../db";
import { broadcastNewEmail } from "../services/emailPollingService";

const router = Router();

function getSecret(req: Request): string | undefined {
  const header = req.headers["x-temp-mail-secret"];
  if (Array.isArray(header)) return header[0];
  return header as string | undefined;
}

router.post("/temp-mail", async (req: Request, res: Response) => {
  const expectedSecret = process.env.TEMP_MAIL_INBOUND_SECRET;
  const providedSecret = getSecret(req);

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  const payload = req.body as {
    raw?: string;
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    date?: string;
  };

  let from = payload.from || "";
  let to = payload.to || "";
  let subject = payload.subject || "";
  let textBody = payload.text || "";
  let htmlBody = payload.html || "";
  let date = payload.date ? new Date(payload.date) : new Date();

  if (payload.raw) {
    const parsed = await simpleParser(payload.raw);
    from = parsed.from?.text || from;
    to = parsed.to?.text || to;
    subject = parsed.subject || subject;
    textBody = parsed.text || textBody;
    htmlBody = parsed.html ? String(parsed.html) : htmlBody;
    date = parsed.date || date;
  }

  if (!to) {
    return res.status(400).json({ error: "Missing recipient" });
  }

  const address = to.split(/[ ,;]/)[0]?.toLowerCase();
  if (!address) {
    return res.status(400).json({ error: "Invalid recipient" });
  }

  const mailbox = await db.getTempMailboxByAddress(address);
  if (!mailbox || !mailbox.isActive || (mailbox.expiresAt && mailbox.expiresAt < new Date())) {
    return res.status(404).json({ error: "Mailbox not found or expired" });
  }

  const account = await db.getEmailAccountById(mailbox.accountId, mailbox.userId);
  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  const email = await db.createEmail({
    accountId: mailbox.accountId,
    userId: mailbox.userId,
    messageId: `${mailbox.id}-${Date.now()}`,
    subject,
    fromAddress: from,
    toAddresses: [address],
    textBody: textBody || null,
    htmlBody: htmlBody || null,
    snippet: textBody?.slice(0, 200) || subject || "",
    date,
    receivedAt: new Date(),
    isRead: false,
    isStarred: false,
    isImportant: false,
    folder: "INBOX",
    hasAttachments: false,
    attachmentCount: 0,
  });

  broadcastNewEmail(mailbox.userId, email, account);

  return res.json({ success: true });
});

export default router;
