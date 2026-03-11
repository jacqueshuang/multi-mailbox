import { ENV } from "../_core/env";
import { ProxyAgent } from "undici";

// Google OAuth2 配置
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

const googleProxyAgent = ENV.googleProxyUrl ? new ProxyAgent(ENV.googleProxyUrl) : undefined;

type RequestInitWithDispatcher = RequestInit & { dispatcher?: unknown };

function withGoogleProxy(init: RequestInit = {}): RequestInitWithDispatcher {
  if (!googleProxyAgent) return init;
  return { ...init, dispatcher: googleProxyAgent };
}

// Gmail API 所需的权限范围
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

/**
 * 生成 Google OAuth2 授权 URL
 */
export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const clientId = ENV.googleClientId;
  
  if (!clientId) {
    throw new Error("Google Client ID not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // 获取 refresh_token
    prompt: "consent", // 强制显示同意页面以获取 refresh_token
    state: state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * 使用授权码交换 access token
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const clientId = ENV.googleClientId;
  const clientSecret = ENV.googleClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch(
    GOOGLE_TOKEN_URL,
    withGoogleProxy({
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Token exchange failed:", error);
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * 使用 refresh token 获取新的 access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const clientId = ENV.googleClientId;
  const clientSecret = ENV.googleClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch(
    GOOGLE_TOKEN_URL,
    withGoogleProxy({
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Token refresh failed:", error);
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  return response.json();
}

/**
 * 获取 Google 用户信息
 */
export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(
    GOOGLE_USERINFO_URL,
    withGoogleProxy({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Failed to get user info:", error);
    throw new Error(`Failed to get user info: ${error}`);
  }

  return response.json();
}

/**
 * 获取 Gmail 配置文件
 */
export async function getGmailProfile(
  accessToken: string
): Promise<GmailProfile> {
  const response = await fetch(
    `${GMAIL_API_URL}/users/me/profile`,
    withGoogleProxy({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Failed to get Gmail profile:", error);
    throw new Error(`Failed to get Gmail profile: ${error}`);
  }

  return response.json();
}

/**
 * 获取 Gmail 邮件列表
 */
export async function getGmailMessages(
  accessToken: string,
  options: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    labelIds?: string[];
  } = {}
): Promise<{
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}> {
  const params = new URLSearchParams();
  
  if (options.maxResults) {
    params.set("maxResults", options.maxResults.toString());
  }
  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
  }
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.labelIds) {
    options.labelIds.forEach(id => params.append("labelIds", id));
  }

  const url = `${GMAIL_API_URL}/users/me/messages?${params.toString()}`;
  
  const response = await fetch(
    url,
    withGoogleProxy({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Failed to get Gmail messages:", error);
    throw new Error(`Failed to get Gmail messages: ${error}`);
  }

  return response.json();
}

/**
 * 获取单个 Gmail 邮件详情
 */
export async function getGmailMessage(
  accessToken: string,
  messageId: string,
  format: "full" | "metadata" | "minimal" | "raw" = "full"
): Promise<any> {
  const response = await fetch(
    `${GMAIL_API_URL}/users/me/messages/${messageId}?format=${format}`,
    withGoogleProxy({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Failed to get Gmail message:", error);
    throw new Error(`Failed to get Gmail message: ${error}`);
  }

  return response.json();
}

/**
 * 获取 Gmail 附件
 */
export async function getGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ size: number; data: string }> {
  const response = await fetch(
    `${GMAIL_API_URL}/users/me/messages/${messageId}/attachments/${attachmentId}`,
    withGoogleProxy({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Google OAuth] Failed to get Gmail attachment:", error);
    throw new Error(`Failed to get Gmail attachment: ${error}`);
  }

  return response.json();
}

/**
 * 解析 Gmail 邮件内容
 */
export function parseGmailMessage(message: any): {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  date: Date;
  snippet: string;
  body: string;
  bodyHtml: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
} {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => 
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const subject = getHeader("Subject");
  const from = getHeader("From");
  const to = getHeader("To");
  const dateStr = getHeader("Date");

  // 解析发件人名称和地址
  const fromMatch = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  const fromName = fromMatch?.[1]?.trim() || fromMatch?.[2] || from;
  const fromAddress = fromMatch?.[2] || from;

  // 解析邮件正文
  let body = "";
  let bodyHtml = "";
  
  const extractBody = (part: any): void => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      body = Buffer.from(part.body.data, "base64url").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, "base64url").toString("utf-8");
    } else if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (message.payload) {
    extractBody(message.payload);
  }

  // 提取附件信息
  const attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }> = [];

  const extractAttachments = (part: any): void => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }
    if (part.parts) {
      part.parts.forEach(extractAttachments);
    }
  };

  if (message.payload) {
    extractAttachments(message.payload);
  }

  return {
    id: message.id,
    threadId: message.threadId,
    subject,
    from: fromAddress,
    fromName,
    to,
    date: dateStr ? new Date(dateStr) : new Date(parseInt(message.internalDate)),
    snippet: message.snippet || "",
    body,
    bodyHtml,
    isRead: !message.labelIds?.includes("UNREAD"),
    isStarred: message.labelIds?.includes("STARRED") || false,
    labels: message.labelIds || [],
    attachments,
  };
}

/**
 * 检查 Google OAuth 是否已配置
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(ENV.googleClientId && ENV.googleClientSecret);
}
