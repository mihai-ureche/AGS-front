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
        <Spinner label="Se deschide AGS" />
        <p>Se deschide spațiul de lucru…</p>
      </div>
    </GateLayout>
  );
}

export function SetupScreen() {
  return (
    <GateLayout>
      <h1>Configurare necesară</h1>
      <p>
        Acestei versiuni îi lipsesc setări publice. Adăugați-le în{" "}
        <code>.env</code> (sau în mediul Render) și reconstruiți aplicația.
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
      <h1>Autentificare</h1>
      <p>
        Folosiți contul Microsoft de serviciu al organizației. Ce puteți vedea
        depinde de rolul și entitățile alocate de un administrator.
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
        {busy ? "Redirecționare…" : "Continuați cu Microsoft"}
        <ArrowRight size={17} />
      </button>
      <p className="gate-footnote">
        <ShieldCheck size={15} /> Autentificarea are loc pe site-ul Microsoft.
        AGS nu vă vede niciodată parola.
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
      <h1>{tone === "blocked" ? "Acces refuzat" : "AGS nu este disponibil"}</h1>
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
          <RefreshCw size={15} className={busy ? "spin" : ""} /> Încercați din
          nou
        </button>
        <button
          className="button button-secondary"
          onClick={() => void logout()}
        >
          <LogOut size={15} /> Deconectare
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
      <h1>Se așteaptă accesul</h1>
      <p>
        Sunteți autentificat ca <strong>{me.email ?? me.displayName}</strong> cu
        rolul <code>{me.role}</code>, care nu include vânzări sau administrare.
        Cereți unui administrator să vă aloce un rol.
      </p>
      <div className="id-box">
        <span>
          <small>ID-ul dumneavoastră de utilizator AGS</small>
          <code>{profile.id}</code>
        </span>
        <button
          className="icon-button"
          aria-label="Copiați ID-ul de utilizator"
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
        {copied ? "Copiat. " : ""}Configurați primul administrator? Rulați{" "}
        <code>npm run user:role -- {profile.id} admin</code> în AGS-backend.
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
          <RefreshCw size={15} className={busy ? "spin" : ""} /> Verificați din
          nou
        </button>
        <button
          className="button button-secondary"
          onClick={() => void logout()}
        >
          <LogOut size={15} /> Deconectare
        </button>
      </div>
    </GateLayout>
  );
}
