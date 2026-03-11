import { ENV } from "../_core/env";
import { decodeJwt } from "jose";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "https://outlook.office.com/IMAP.AccessAsUser.All",
].join(" ");

export interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

export interface MicrosoftUserInfo {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  userPrincipalName?: string;
  mail?: string;
}

export function getMicrosoftAuthUrl(redirectUri: string, state: string): string {
  const clientId = ENV.microsoftClientId;

  if (!clientId) {
    throw new Error("Microsoft Client ID not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(
  code: string,
  redirectUri: string
): Promise<MicrosoftTokenResponse> {
  const clientId = ENV.microsoftClientId;
  const clientSecret = ENV.microsoftClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth credentials not configured");
  }

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Microsoft OAuth] Token exchange failed:", error);
    throw new Error(`Failed to exchange Microsoft code for tokens: ${error}`);
  }

  return response.json();
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<MicrosoftTokenResponse> {
  const clientId = ENV.microsoftClientId;
  const clientSecret = ENV.microsoftClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth credentials not configured");
  }

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Microsoft OAuth] Token refresh failed:", error);
    throw new Error(`Failed to refresh Microsoft access token: ${error}`);
  }

  return response.json();
}

export async function getMicrosoftUserInfo(
  idToken?: string
): Promise<MicrosoftUserInfo> {
  if (!idToken) {
    throw new Error("Microsoft id_token is missing from token response");
  }

  const claims = decodeJwt(idToken) as Record<string, unknown>;

  return {
    id: typeof claims.oid === "string" ? claims.oid : "",
    displayName: typeof claims.name === "string" ? claims.name : undefined,
    givenName: typeof claims.given_name === "string" ? claims.given_name : undefined,
    surname: typeof claims.family_name === "string" ? claims.family_name : undefined,
    userPrincipalName:
      typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
    mail: typeof claims.email === "string" ? claims.email : undefined,
  };
}

export function getMicrosoftAccountEmail(userInfo: MicrosoftUserInfo): string {
  return userInfo.mail || userInfo.userPrincipalName || "";
}

export function isMicrosoftOAuthConfigured(): boolean {
  return !!(ENV.microsoftClientId && ENV.microsoftClientSecret);
}
