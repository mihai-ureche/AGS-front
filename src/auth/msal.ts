import {
  InteractionRequiredAuthError,
  PublicClientApplication,
} from "@azure/msal-browser";
import { config, missingConfig } from "../config";

// The backend verifies identity by calling Microsoft Graph with this token.
const scopes = ["User.Read"];

const msal = missingConfig.length
  ? null
  : new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}`,
        redirectUri: config.redirectUri,
        postLogoutRedirectUri: config.redirectUri,
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: "sessionStorage" },
    });

// Module-level so React StrictMode cannot process the redirect response twice.
const ready = msal
  ? msal
      .initialize()
      .then(() => msal.handleRedirectPromise())
      .then((result) => {
        const account =
          result?.account ??
          msal.getActiveAccount() ??
          msal.getAllAccounts()[0];
        if (account) msal.setActiveAccount(account);
        return account ?? null;
      })
  : Promise.resolve(null);
void ready.catch(() => undefined);

export async function restoreAccount() {
  const account = await ready;
  return account ? { name: account.name ?? "", email: account.username } : null;
}

export async function signIn() {
  await ready;
  await msal?.loginRedirect({ scopes, prompt: "select_account" });
}

export async function signOut() {
  await ready;
  await msal?.logoutRedirect({ account: msal.getActiveAccount() });
}

export async function acquireToken(forceRefresh = false): Promise<string> {
  await ready;
  const account = msal?.getActiveAccount();
  if (!msal || !account) throw new Error("Not signed in.");
  try {
    const result = await msal.acquireTokenSilent({
      scopes,
      account,
      forceRefresh,
    });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes, account });
      // The redirect navigates away; never resolve.
      return new Promise<never>(() => undefined);
    }
    throw error;
  }
}
