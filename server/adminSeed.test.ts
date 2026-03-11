import { beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDefaultAdminFromEnv } from "./services/adminSeedService";

const { envState, dbMocks } = vi.hoisted(() => ({
  envState: {
    adminSeedEnabled: false,
    adminSeedUsername: "",
    adminSeedPassword: "",
    adminSeedDisplayName: "",
  },
  dbMocks: {
    getPasswordCredentialByUsernameNormalized: vi.fn(),
    getUserById: vi.fn(),
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    createPasswordCredential: vi.fn(),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: envState,
}));

vi.mock("./db", () => dbMocks);

vi.mock("./services/passwordAuthService", () => ({
  normalizeUsername: (username: string) => username.trim().toLowerCase(),
  hashPassword: vi.fn(async () => "salt:hash"),
}));

describe("initializeDefaultAdminFromEnv", () => {
  beforeEach(() => {
    envState.adminSeedEnabled = false;
    envState.adminSeedUsername = "";
    envState.adminSeedPassword = "";
    envState.adminSeedDisplayName = "";

    Object.values(dbMocks).forEach((fn) => fn.mockReset());
  });

  it("does nothing when seed is disabled", async () => {
    await initializeDefaultAdminFromEnv();

    expect(dbMocks.upsertUser).not.toHaveBeenCalled();
    expect(dbMocks.createPasswordCredential).not.toHaveBeenCalled();
  });

  it("throws when enabled but username/password are missing", async () => {
    envState.adminSeedEnabled = true;

    await expect(initializeDefaultAdminFromEnv()).rejects.toThrow(
      "ADMIN_SEED_USERNAME is required when ADMIN_SEED_ENABLED=true"
    );
  });

  it("creates admin user and credential when credential does not exist", async () => {
    envState.adminSeedEnabled = true;
    envState.adminSeedUsername = "Admin";
    envState.adminSeedPassword = "12345678";
    envState.adminSeedDisplayName = "Administrator";

    dbMocks.getPasswordCredentialByUsernameNormalized.mockResolvedValue(undefined);
    dbMocks.getUserByOpenId.mockResolvedValue({ id: 10, openId: "local:admin" });
    dbMocks.createPasswordCredential.mockResolvedValue({ id: 20 });

    await initializeDefaultAdminFromEnv();

    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "local:admin",
        role: "admin",
        loginMethod: "password",
        name: "Administrator",
      })
    );

    expect(dbMocks.createPasswordCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        username: "Admin",
        usernameNormalized: "admin",
        passwordHash: "salt:hash",
      })
    );
  });

  it("promotes existing credential user to admin without creating a credential", async () => {
    envState.adminSeedEnabled = true;
    envState.adminSeedUsername = "admin";
    envState.adminSeedPassword = "12345678";

    dbMocks.getPasswordCredentialByUsernameNormalized.mockResolvedValue({
      id: 1,
      userId: 99,
      username: "admin",
      usernameNormalized: "admin",
      passwordHash: "x:y",
    });
    dbMocks.getUserById.mockResolvedValue({ id: 99, openId: "local:admin" });

    await initializeDefaultAdminFromEnv();

    expect(dbMocks.upsertUser).toHaveBeenCalledWith({
      openId: "local:admin",
      role: "admin",
    });
    expect(dbMocks.createPasswordCredential).not.toHaveBeenCalled();
  });
});
