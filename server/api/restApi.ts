import { Router, Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import * as db from '../db';

const router = Router();

// API Key authentication middleware
async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const apiKey = authHeader.substring(7);
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const key = await db.getApiKeyByHash(keyHash);
  
  if (!key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Defense-in-depth check for active status
  if (!key.isActive) {
    return res.status(401).json({ error: 'API key is disabled' });
  }

  // Check expiration
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'API key has expired' });
  }
  
  // Update usage stats
  await db.updateApiKeyUsage(key.id);
  
  // Attach user info to request
  (req as any).apiUser = { userId: key.userId, permissions: key.permissions || [] };
  
  next();
}

// Check permission middleware
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = (req as any).apiUser?.permissions || [];
    if (!permissions.includes(permission) && !permissions.includes('admin')) {
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    }
    next();
  };
}

// ==================== Email Accounts ====================

/**
 * GET /api/v1/accounts
 * List all email accounts
 */
router.get('/accounts', authenticateApiKey, requirePermission('read'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    const accounts = await db.getEmailAccountsByUserId(userId);
    
    // Remove sensitive fields
    const safeAccounts = accounts.map(a => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      accountType: a.accountType,
      isActive: a.isActive,
      lastSyncAt: a.lastSyncAt,
      syncStatus: a.syncStatus,
      createdAt: a.createdAt,
    }));
    
    res.json({ accounts: safeAccounts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/accounts/:id
 * Get single email account
 */
router.get('/accounts/:id', authenticateApiKey, requirePermission('read'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    const accountId = parseInt(req.params.id);
    
    const account = await db.getEmailAccountById(accountId, userId);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      accountType: account.accountType,
      isActive: account.isActive,
      lastSyncAt: account.lastSyncAt,
      syncStatus: account.syncStatus,
      createdAt: account.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Emails ====================

/**
 * GET /api/v1/emails
 * List emails with optional filters
 * Query params: accountId, folder, isRead, isStarred, search, limit, offset
 */
router.get('/emails', authenticateApiKey, requirePermission('read'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    
    const options = {
      accountId: req.query.accountId ? parseInt(req.query.accountId as string) : undefined,
      folder: req.query.folder as string | undefined,
      isRead: req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined,
      isStarred: req.query.isStarred !== undefined ? req.query.isStarred === 'true' : undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    
    const emails = await db.getEmailsByUserId(userId, options);
    
    // Return summary view
    const emailSummaries = emails.map(e => ({
      id: e.id,
      accountId: e.accountId,
      messageId: e.messageId,
      subject: e.subject,
      fromAddress: e.fromAddress,
      fromName: e.fromName,
      toAddresses: e.toAddresses,
      snippet: e.snippet,
      date: e.date,
      isRead: e.isRead,
      isStarred: e.isStarred,
      isImportant: e.isImportant,
      hasAttachments: e.hasAttachments,
      attachmentCount: e.attachmentCount,
      folder: e.folder,
    }));
    
    res.json({ 
      emails: emailSummaries,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        count: emails.length,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/emails/:id
 * Get single email with full content
 */
router.get('/emails/:id', authenticateApiKey, requirePermission('read'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    const emailId = parseInt(req.params.id);
    
    const email = await db.getEmailById(emailId, userId);
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    const attachments = await db.getAttachmentsByEmailId(emailId, userId);
    
    res.json({
      ...email,
      attachments: attachments.map(a => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        isInline: a.isInline,
        downloadUrl: a.s3Url,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/v1/emails/:id
 * Update email (mark read, star, etc.)
 */
router.patch('/emails/:id', authenticateApiKey, requirePermission('write'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    const emailId = parseInt(req.params.id);
    
    const { isRead, isStarred } = req.body;
    
    if (isRead !== undefined) {
      await db.markEmailAsRead(emailId, userId, isRead);
    }
    
    if (isStarred !== undefined) {
      await db.toggleEmailStar(emailId, userId, isStarred);
    }
    
    const email = await db.getEmailById(emailId, userId);
    res.json(email);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Attachments ====================

/**
 * GET /api/v1/attachments/:id
 * Get attachment info and download URL
 */
router.get('/attachments/:id', authenticateApiKey, requirePermission('read'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    const attachmentId = parseInt(req.params.id);
    
    const attachment = await db.getAttachmentById(attachmentId, userId);
    
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    res.json({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      isInline: attachment.isInline,
      downloadUrl: attachment.s3Url,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Stats ====================

/**
 * GET /api/v1/stats
 * Get account statistics
 */
router.get('/stats', authenticateApiKey, requirePermission('read'), async (req, res) => {
  try {
    const userId = (req as any).apiUser.userId;
    
    const accounts = await db.getEmailAccountsByUserId(userId);
    const unreadCount = await db.getUnreadCount(userId);
    
    // Get per-account stats
    const accountStats = await Promise.all(
      accounts.map(async (account) => ({
        accountId: account.id,
        email: account.email,
        unreadCount: await db.getUnreadCount(userId, account.id),
        syncStatus: account.syncStatus,
        lastSyncAt: account.lastSyncAt,
      }))
    );
    
    res.json({
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.isActive).length,
      totalUnread: unreadCount,
      accounts: accountStats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Health Check ====================

/**
 * GET /api/v1/health
 * Health check endpoint (no auth required)
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
