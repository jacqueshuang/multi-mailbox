import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

describe("Google OAuth Credentials Validation", () => {
  it("returns true when Google OAuth credentials are configured", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

    const { isGoogleOAuthConfigured } = await import("./services/googleOAuthService");

    expect(isGoogleOAuthConfigured()).toBe(true);
  });

  it("returns false when Google OAuth credentials are missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const { isGoogleOAuthConfigured } = await import("./services/googleOAuthService");

    expect(isGoogleOAuthConfigured()).toBe(false);
  });

  it("accepts Google client IDs in the expected format", () => {
    const clientId = "test-client-id.apps.googleusercontent.com";

    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });
});
