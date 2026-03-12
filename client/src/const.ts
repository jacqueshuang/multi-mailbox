export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const runtimeConfig = (window as any).__RUNTIME_CONFIG__ || {};
  const oauthPortalUrl = runtimeConfig.VITE_OAUTH_PORTAL_URL ?? import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = runtimeConfig.VITE_APP_ID ?? import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  if (!oauthPortalUrl) {
    console.error("VITE_OAUTH_PORTAL_URL is not defined");
    return "/login"; // Fallback or handle error
  }

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch (e) {
    console.error("Invalid OAuth portal URL:", oauthPortalUrl);
    return "/login";
  }
};
