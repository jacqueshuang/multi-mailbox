import * as jose from "jose";
import { ENV } from "./env";
import { getUserByOpenId } from "../db";

interface SessionPayload {
  userId: number;
  openId: string;
}

/**
 * Verify a session token and return the session data
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    
    const { payload } = await jose.jwtVerify(token, secret);
    
    if (!payload.sub) {
      return null;
    }
    
    // Get user from database
    const user = await getUserByOpenId(payload.sub as string);
    
    if (!user) {
      return null;
    }
    
    return {
      userId: user.id,
      openId: user.openId,
    };
  } catch (error) {
    console.error("[Session] Verification failed:", error);
    return null;
  }
}

/**
 * Create a session token for a user
 */
export async function createSessionToken(openId: string): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  
  const token = await new jose.SignJWT({ sub: openId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  
  return token;
}
