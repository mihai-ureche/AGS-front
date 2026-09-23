import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { Capacitor } from "@capacitor/core";

type User = { name: string; email: string };
type Auth = {
  user: User | null;
  loading: boolean;
  error: string | null;
  demo: boolean;
  configured: boolean;
  demoEnabled: boolean;
  login: () => Promise<void>;
  enterDemo: () => void;
  logout: () => Promise<void>;
};

const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim();
const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID?.trim();
const configured = Boolean(clientId && tenantId);
const native = Capacitor.isNativePlatform();
const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenantId || "organizations")}`;
const redirectUri =
  import.meta.env.VITE_MICROSOFT_REDIRECT_URI || `${window.location.origin}/`;
const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "");
// The backend verifies identity by calling Microsoft Graph with this token.
const graphScopes = ["User.Read"];
const saveUserError =
  "You are signed in, but your account could not be saved to AGS. Refresh the page or sign in again.";
const demoEnabled =
  import.meta.env.VITE_ENABLE_DEMO === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO !== "false");

const msal =
  configured && !native
    ? new PublicClientApplication({
        auth: {
          clientId,
          authority,
          redirectUri,
          postLogoutRedirectUri: redirectUri,
          navigateToLoginRequestUrl: false,
        },
        cache: { cacheLocation: "sessionStorage" },
      })
    : null;

// One initialization promise also prevents duplicate redirect processing in React StrictMode.
const ready = msal
  ? msal.initialize().then(async () => {
      const result = await msal.handleRedirectPromise();
      const account =
        result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0];
      if (account) msal.setActiveAccount(account);
      return account
        ? { name: account.name || "AGS member", email: account.username }
        : null;
    })
  : Promise.resolve(null);
// The provider handles the error; attach a handler immediately to avoid an unhandled rejection.
void ready.catch(() => undefined);

// Creates or refreshes the signed-in user in the AGS backend.
async function saveUser(accessToken: string) {
  if (!apiUrl) return;
  const response = await fetch(`${apiUrl}/api/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error);
}

// Runs once per page load, including restored sessions, so StrictMode cannot call it twice.
// Sign-in failures are reported through `ready`, not as a failed save.
const webUserSaved = ready
  .catch(() => null)
  .then(async (account) => {
    if (!account || !msal || !apiUrl) return;
    const { accessToken } = await msal.acquireTokenSilent({
      scopes: graphScopes,
    });
    await saveUser(accessToken);
  });
void webUserSaved.catch(() => undefined);

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let active = true;
    ready
      .then((account) => {
        if (active) setUser(account);
      })
      .catch(() => {
        if (active)
          setError(
            "Microsoft sign-in could not be completed. Please try again or check your app registration.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Saving the user does not block the workspace; failures are shown as a notice.
    webUserSaved.catch(() => {
      if (active) setError(saveUserError);
    });
    return () => {
      active = false;
    };
  }, []);

  async function login() {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      if (native) {
        const { GenericOAuth2 } =
          await import("@capacitor-community/generic-oauth2");
        const result = await GenericOAuth2.authenticate({
          appId: clientId,
          authorizationBaseUrl: `${authority}/oauth2/v2.0/authorize`,
          accessTokenEndpoint: `${authority}/oauth2/v2.0/token`,
          resourceUrl: "https://graph.microsoft.com/v1.0/me",
          responseType: "code",
          redirectUrl:
            import.meta.env.VITE_MICROSOFT_NATIVE_REDIRECT_URI ||
            "com.ags.insights://oauth/redirect",
          scope: "openid profile email User.Read",
          pkceEnabled: true,
          logsEnabled: false,
          additionalParameters: { prompt: "select_account" },
          android: { pkceEnabled: true },
          ios: { pkceEnabled: true, logsEnabled: false },
        });
        // The native plugin retrieves this profile from Graph with the issued access token.
        if (typeof result.id !== "string")
          throw new Error("Missing Microsoft profile");
        setUser({
          name: result.displayName || "AGS member",
          email: result.mail || result.userPrincipalName || "",
        });
        setDemo(false);
        const accessToken: unknown = result.access_token_response?.access_token;
        if (typeof accessToken !== "string") setError(saveUserError);
        else void saveUser(accessToken).catch(() => setError(saveUserError));
      } else if (msal) {
        await ready;
        await msal.loginRedirect({
          scopes: ["openid", "profile", "email", ...graphScopes],
          prompt: "select_account",
        });
      }
    } catch {
      setError(
        "Sign-in was canceled or could not be completed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setError(null);
    if (demo || native) {
      // Native session is memory-only. The system browser keeps its Microsoft SSO session.
      setUser(null);
      setDemo(false);
      return;
    }
    if (msal) {
      setLoading(true);
      try {
        await msal.logoutRedirect({ account: msal.getActiveAccount() });
      } catch {
        setError("Sign-out could not be completed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        demo,
        configured,
        demoEnabled,
        login,
        logout,
        enterDemo: () => {
          if (!demoEnabled) return;
          setError(null);
          setDemo(true);
          setUser({ name: "Alex Morgan", email: "alex@example.com" });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within AuthProvider");
  return auth;
}
