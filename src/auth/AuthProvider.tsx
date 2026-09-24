import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ApiError, createApi, errorMessage } from "../api/client";
import type { Api } from "../api/client";
import { getMe, saveCurrentUser } from "../api/endpoints";
import type { Me, Permission, User } from "../api/types";
import { config } from "../config";
import { acquireToken, restoreAccount, signIn, signOut } from "./msal";

type Account = { name: string; email: string };

export type Session =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  /** Signed in with Microsoft, but AGS refused access (inactive, deleted, other tenant). */
  | { status: "blocked"; account: Account; message: string }
  /** Signed in with Microsoft, but AGS could not be reached or failed. */
  | { status: "error"; account: Account; message: string }
  | { status: "ready"; account: Account; me: Me; profile: User };

type Auth = {
  session: Session;
  api: Api;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads role, permissions and entity grants from the backend. */
  reload: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);
const api = createApi(config.apiUrl, acquireToken);

async function loadSession(account: Account): Promise<Session> {
  try {
    // POST registers first-time users; /me carries the resolved permissions.
    const [profile, me] = await Promise.all([saveCurrentUser(api), getMe(api)]);
    return { status: "ready", account, me, profile };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { status: "blocked", account, message: error.message };
    }
    return { status: "error", account, message: errorMessage(error) };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  useEffect(() => {
    let active = true;
    restoreAccount()
      .then((account) =>
        account ? loadSession(account) : ({ status: "signed-out" } as const),
      )
      .catch((): Session => ({
        status: "signed-out",
        error:
          "Autentificarea Microsoft nu a putut fi finalizată. Încercați din nou sau verificați înregistrarea aplicației.",
      }))
      .then((next) => {
        if (active) setSession(next);
      });
    return () => {
      active = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const account = await restoreAccount();
    setSession(account ? await loadSession(account) : { status: "signed-out" });
  }, []);

  const value = useMemo<Auth>(
    () => ({
      session,
      api,
      reload,
      async login() {
        try {
          await signIn();
        } catch {
          setSession({
            status: "signed-out",
            error:
              "Autentificarea a fost anulată sau nu a putut fi finalizată. Încercați din nou.",
          });
        }
      },
      async logout() {
        try {
          await signOut();
        } catch {
          setSession({ status: "signed-out" });
        }
      },
    }),
    [session, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within AuthProvider");
  return auth;
}

/** The signed-in session; only valid below the ready gate in App. */
export function useSession() {
  const { session, api, reload, logout } = useAuth();
  if (session.status !== "ready") throw new Error("Session is not ready");
  const { me, profile, account } = session;
  const can = (permission: Permission) => me.permissions.includes(permission);
  return { me, profile, account, api, reload, logout, can };
}
