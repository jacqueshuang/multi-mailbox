
import { Router } from "express";
import { randomUUID } from "crypto";

const router = Router();

// Mock data
const MOCK_USER = {
  openId: process.env.OWNER_OPEN_ID || "user_123456",
  name: "Admin User",
  email: "admin@example.com",
  projectId: process.env.VITE_APP_ID || "app_id_123",
  platform: "email",
  platforms: ["REGISTERED_PLATFORM_EMAIL"],
};

const MOCK_CODES = new Map<string, string>(); // code -> openId
const MOCK_TOKENS = new Map<string, typeof MOCK_USER>(); // accessToken -> user

// 1. Authorization Page (GET /app-auth)
router.get("/app-auth", (req, res) => {
  const { redirectUri, state } = req.query;

  if (!redirectUri || !state) {
    return res.status(400).send("Missing redirectUri or state");
  }

  // Simple login form
  res.send(`
    <html>
      <head>
        <title>Mock Login</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 300px; }
          h1 { margin-top: 0; text-align: center; color: #333; }
          .btn { display: block; width: 100%; padding: 0.75rem; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; margin-top: 1rem; }
          .btn:hover { background: #005bb5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Mock Login</h1>
          <p>Login as Admin</p>
          <form method="POST" action="/app-auth/submit">
            <input type="hidden" name="redirectUri" value="${redirectUri}" />
            <input type="hidden" name="state" value="${state}" />
            <button type="submit" class="btn">Sign In</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// 2. Handle Login Submission (POST /app-auth/submit)
router.post("/app-auth/submit", (req, res) => {
  const { redirectUri, state } = req.body;

  // Generate auth code
  const code = randomUUID();
  MOCK_CODES.set(code, MOCK_USER.openId);

  // Redirect back to app
  const url = new URL(redirectUri as string);
  url.searchParams.set("code", code);
  url.searchParams.set("state", state as string);

  res.redirect(url.toString());
});

// 3. Exchange Code for Token (POST /webdev.v1.WebDevAuthPublicService/ExchangeToken)
router.post("/webdev.v1.WebDevAuthPublicService/ExchangeToken", (req, res) => {
  const { code } = req.body;

  const openId = MOCK_CODES.get(code);
  if (!openId) {
    return res.status(400).json({ error: "Invalid code" });
  }

  MOCK_CODES.delete(code); // Consume code

  const accessToken = `mock_at_${randomUUID()}`;
  MOCK_TOKENS.set(accessToken, MOCK_USER);

  res.json({
    accessToken,
    tokenType: "Bearer",
    expiresIn: 3600,
    refreshToken: `mock_rt_${randomUUID()}`,
    scope: "all",
    idToken: "mock_id_token",
  });
});

// 4. Get User Info (POST /webdev.v1.WebDevAuthPublicService/GetUserInfo)
router.post("/webdev.v1.WebDevAuthPublicService/GetUserInfo", (req, res) => {
  const { accessToken } = req.body;

  const user = MOCK_TOKENS.get(accessToken);
  if (!user) {
    return res.status(401).json({ error: "Invalid access token" });
  }

  res.json(user);
});

// 5. Get User Info with JWT (POST /webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt)
// Used when syncing user info from cookie
router.post("/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt", (req, res) => {
  // In mock mode, we just return the mock user for any JWT,
  // because we don't have the real OAuth server's private key to verify it properly here
  // (unless we share the secret, but sdk.ts uses jwtVerify with a secret).
  // Wait, sdk.ts verifySession uses local cookieSecret.
  // But sdk.getUserInfoWithJwt sends the cookie value to the OAuth server.
  // The OAuth server is supposed to decode it.

  // We'll just return the mock user.
  res.json(MOCK_USER);
});

export const mockAuthRouter = router;
