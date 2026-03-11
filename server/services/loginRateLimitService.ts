type LoginRateLimitState = {
  windowStartedAt: number;
  failedAttempts: number;
  blockedUntil: number;
};

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

const state = new Map<string, LoginRateLimitState>();

const now = () => Date.now();

const getOrCreate = (key: string, currentTime: number): LoginRateLimitState => {
  const existing = state.get(key);
  if (!existing) {
    const created: LoginRateLimitState = {
      windowStartedAt: currentTime,
      failedAttempts: 0,
      blockedUntil: 0,
    };
    state.set(key, created);
    return created;
  }

  if (existing.blockedUntil <= currentTime && currentTime - existing.windowStartedAt > WINDOW_MS) {
    existing.windowStartedAt = currentTime;
    existing.failedAttempts = 0;
  }

  return existing;
};

export const buildLoginRateLimitKey = (usernameNormalized: string, clientIp: string) =>
  `${usernameNormalized}::${clientIp}`;

export const checkLoginRateLimit = (key: string) => {
  const currentTime = now();
  const current = getOrCreate(key, currentTime);
  const blockedForMs = current.blockedUntil > currentTime ? current.blockedUntil - currentTime : 0;

  return {
    blocked: blockedForMs > 0,
    blockedForMs,
  };
};

export const recordLoginFailure = (key: string) => {
  const currentTime = now();
  const current = getOrCreate(key, currentTime);

  if (current.blockedUntil > currentTime) {
    return;
  }

  if (currentTime - current.windowStartedAt > WINDOW_MS) {
    current.windowStartedAt = currentTime;
    current.failedAttempts = 0;
  }

  current.failedAttempts += 1;

  if (current.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    current.blockedUntil = currentTime + BLOCK_MS;
  }
};

export const clearLoginFailures = (key: string) => {
  state.delete(key);
};

export const __resetLoginRateLimitStateForTests = () => {
  state.clear();
};

export const LOGIN_RATE_LIMIT_CONFIG = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  windowMs: WINDOW_MS,
  blockMs: BLOCK_MS,
};
