const parseBooleanEnv = (value: string | undefined): boolean => value === "true";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminSeedEnabled: parseBooleanEnv(process.env.ADMIN_SEED_ENABLED),
  adminSeedUsername: process.env.ADMIN_SEED_USERNAME ?? "",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "",
  adminSeedDisplayName: process.env.ADMIN_SEED_DISPLAY_NAME ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Google OAuth2 配置
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleProxyUrl: process.env.GOOGLE_PROXY_URL ?? "",
  // Microsoft OAuth2 配置
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID ?? "",
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
  // Temp mail
  tempMailDomains: process.env.TEMP_MAIL_DOMAINS ?? "",
  tempMailInboundSecret: process.env.TEMP_MAIL_INBOUND_SECRET ?? "",
};
