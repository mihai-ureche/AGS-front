import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth, useSession } from "../auth/AuthProvider";
import { Brand } from "../components/Shell";
import { Alert, Spinner } from "../components/ui";
import { missingConfig } from "../config";

function GateLayout({ children }: { children: ReactNode }) {
  return (
    <main className="gate">
      <div className="gate-card">
        <Brand />
        {children}
      </div>
    </main>
  );
}

function MicrosoftMark() {
  return (
    <span className="microsoft-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function LoadingScreen() {
  return (
    <GateLayout>
      <div className="gate-loading">
        <Spinner label="Opening AGS" />
        <p>Opening your workspace…</p>
      </div>
    </GateLayout>
  );
}

export function SetupScreen() {
  return (
    <GateLayout>
      <h1>Configuration needed</h1>
      <p>
        This build is missing public settings. Add them to <code>.env</code> (or
        the Render environment) and rebuild.
      </p>
      <ul className="config-list">
        {missingConfig.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </GateLayout>
  );
}

export function LoginScreen({ error }: { error?: string }) {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <GateLayout>
      <h1>Sign in</h1>
      <p>
        Use your organization's Microsoft work account. What you can see depends
        on the role and entities an administrator assigned to you.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <button
        className="microsoft-button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void login().finally(() => setBusy(false));
        }}
      >
        <MicrosoftMark />
        {busy ? "Redirecting…" : "Continue with Microsoft"}
        <ArrowRight size={17} />
      </button>
      <p className="gate-footnote">
        <ShieldCheck size={15} /> Sign-in happens on Microsoft's site. AGS never
        sees your password.
      </p>
    </GateLayout>
  );
}

export function BlockedScreen({
  message,
  tone,
}: {
  message: string;
  tone: "blocked" | "error";
}) {
  const { reload, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <GateLayout>
      <span className="gate-icon gate-icon-warning">
        <AlertTriangle size={22} />
      </span>
      <h1>{tone === "blocked" ? "Access refused" : "AGS is unavailable"}</h1>
      <p>{message}</p>
      <div className="gate-actions">
        <button
          className="button button-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void reload().finally(() => setBusy(false));
          }}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} /> Try again
        </button>
        <button
          className="button button-secondary"
          onClick={() => void logout()}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </GateLayout>
  );
}

/** Signed in and active, but the role grants nothing this app shows. */
export function NoAccessScreen() {
  const { me, profile, reload, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <GateLayout>
      <span className="gate-icon">
        <KeyRound size={22} />
      </span>
      <h1>Waiting for access</h1>
      <p>
        You're signed in as <strong>{me.email ?? me.displayName}</strong> with
        the <code>{me.role}</code> role, which doesn't include sales or
        administration. Ask an administrator to assign you a role.
      </p>
      <div className="id-box">
        <span>
          <small>Your AGS user ID</small>
          <code>{profile.id}</code>
        </span>
        <button
          className="icon-button"
          aria-label="Copy user ID"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(profile.id)
              .then(() => setCopied(true));
          }}
        >
          <Copy size={15} />
        </button>
      </div>
      <p className="gate-note">
        {copied ? "Copied. " : ""}Setting up the first administrator? Run{" "}
        <code>npm run user:role -- {profile.id} admin</code> in AGS-backend.
      </p>
      <div className="gate-actions">
        <button
          className="button button-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void reload().finally(() => setBusy(false));
          }}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} /> Check again
        </button>
        <button
          className="button button-secondary"
          onClick={() => void logout()}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </GateLayout>
  );
}
