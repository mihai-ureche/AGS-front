// Public build-time configuration. Never put secrets in VITE_ variables.
const env = import.meta.env;

export const config = {
  clientId: env.VITE_MICROSOFT_CLIENT_ID?.trim() ?? "",
  tenantId: env.VITE_MICROSOFT_TENANT_ID?.trim() ?? "",
  redirectUri:
    env.VITE_MICROSOFT_REDIRECT_URI?.trim() || `${window.location.origin}/`,
  apiUrl: env.VITE_API_URL?.trim().replace(/\/+$/, "") ?? "",
};

export const missingConfig = [
  !config.clientId && "VITE_MICROSOFT_CLIENT_ID",
  !config.tenantId && "VITE_MICROSOFT_TENANT_ID",
  !config.apiUrl && "VITE_API_URL",
].filter((name): name is string => Boolean(name));
