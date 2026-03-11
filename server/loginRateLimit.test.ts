import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  __resetLoginRateLimitStateForTests,
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginFailures,
  LOGIN_RATE_LIMIT_CONFIG,
  recordLoginFailure,
} from "./services/loginRateLimitService";

describe("loginRateLimitService", () => {
  beforeEach(() => {
    __resetLoginRateLimitStateForTests();
    vi.useRealTimers();
  });

  it("blocks after configured failed attempts", () => {
    const key = buildLoginRateLimitKey("admin", "127.0.0.1");

    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxFailedAttempts; i++) {
      recordLoginFailure(key);
    }

    const status = checkLoginRateLimit(key);
    expect(status.blocked).toBe(true);
    expect(status.blockedForMs).toBeGreaterThan(0);
  });

  it("unblocks after block window elapses", () => {
    vi.useFakeTimers();
    const key = buildLoginRateLimitKey("admin", "127.0.0.1");

    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxFailedAttempts; i++) {
      recordLoginFailure(key);
    }

    expect(checkLoginRateLimit(key).blocked).toBe(true);

    vi.advanceTimersByTime(LOGIN_RATE_LIMIT_CONFIG.blockMs + 1);
    expect(checkLoginRateLimit(key).blocked).toBe(false);
  });

  it("clearLoginFailures resets state immediately", () => {
    const key = buildLoginRateLimitKey("admin", "127.0.0.1");

    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxFailedAttempts; i++) {
      recordLoginFailure(key);
    }

    expect(checkLoginRateLimit(key).blocked).toBe(true);
    clearLoginFailures(key);
    expect(checkLoginRateLimit(key).blocked).toBe(false);
  });

  it("normalizes username impact via caller-provided normalized key", () => {
    const keyA = buildLoginRateLimitKey("admin", "127.0.0.1");
    const keyB = buildLoginRateLimitKey("admin", "127.0.0.1");

    recordLoginFailure(keyA);

    expect(checkLoginRateLimit(keyB).blocked).toBe(false);
  });
});
