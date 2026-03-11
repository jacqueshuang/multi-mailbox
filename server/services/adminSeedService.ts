import { ENV } from "../_core/env";
import * as db from "../db";
import { hashPassword, normalizeUsername } from "./passwordAuthService";

const LOCAL_OPENID_PREFIX = "local:";
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const remindDisableSeed = () => {
  console.warn("[AdminSeed] Bootstrap completed. For security, set ADMIN_SEED_ENABLED=false after initial setup.");
};

const isMissingPasswordCredentialTableError = (error: unknown): boolean => {
  let current: unknown = error;

  while (current && typeof current === "object") {
    const dbError = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (
      dbError.code === "ER_NO_SUCH_TABLE" ||
      dbError.errno === 1146 ||
      dbError.message?.includes("user_password_credentials") === true
    ) {
      return true;
    }
    current = dbError.cause;
  }

  return false;
};

const assertSeedConfig = () => {
  if (!ENV.adminSeedUsername) {
    throw new Error("ADMIN_SEED_USERNAME is required when ADMIN_SEED_ENABLED=true");
  }
  if (!ENV.adminSeedPassword) {
    throw new Error("ADMIN_SEED_PASSWORD is required when ADMIN_SEED_ENABLED=true");
  }
  if (!USERNAME_PATTERN.test(ENV.adminSeedUsername) || ENV.adminSeedUsername.length < 3 || ENV.adminSeedUsername.length > 64) {
    throw new Error("ADMIN_SEED_USERNAME must match /^[a-zA-Z0-9._-]+$/ and be 3-64 chars");
  }
  if (ENV.adminSeedPassword.length < 8 || ENV.adminSeedPassword.length > 128) {
    throw new Error("ADMIN_SEED_PASSWORD must be 8-128 chars");
  }
};

export async function initializeDefaultAdminFromEnv(): Promise<void> {
  if (!ENV.adminSeedEnabled) {
    return;
  }

  assertSeedConfig();

  const usernameNormalized = normalizeUsername(ENV.adminSeedUsername);

  let existingCredential;
  try {
    existingCredential = await db.getPasswordCredentialByUsernameNormalized(usernameNormalized);
  } catch (error) {
    if (isMissingPasswordCredentialTableError(error)) {
      console.warn("[AdminSeed] Skipped: user_password_credentials table does not exist yet. Run migrations first.");
      return;
    }
    throw error;
  }

  if (existingCredential) {
    const existingUser = await db.getUserById(existingCredential.userId);
    if (!existingUser) {
      throw new Error(`Seed credential user not found for username: ${ENV.adminSeedUsername}`);
    }

    await db.upsertUser({
      openId: existingUser.openId,
      role: "admin",
    });

    console.log(`[AdminSeed] Existing credential found, ensured admin role for ${ENV.adminSeedUsername}`);
    remindDisableSeed();
    return;
  }

  const openId = `${LOCAL_OPENID_PREFIX}${usernameNormalized}`;
  const displayName = ENV.adminSeedDisplayName || ENV.adminSeedUsername;

  await db.upsertUser({
    openId,
    name: displayName,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) {
    throw new Error("Failed to create seeded admin user");
  }

  const passwordHash = await hashPassword(ENV.adminSeedPassword);
  await db.createPasswordCredential({
    userId: user.id,
    username: ENV.adminSeedUsername,
    usernameNormalized,
    passwordHash,
    passwordUpdatedAt: new Date(),
  });

  console.log(`[AdminSeed] Created default admin account: ${ENV.adminSeedUsername}`);
  remindDisableSeed();
}
