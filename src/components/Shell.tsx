import { useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSession } from "../auth/AuthProvider";
import { initials } from "../lib/format";
import { hrefFor } from "../lib/route";

export type NavItem = { page: string; label: string; icon: LucideIcon };

export const navIcons = { sales: BarChart3, users: Users, roles: ShieldCheck };

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon" aria-hidden="true">
        <BarChart3 size={20} strokeWidth={2.4} />
      </span>
      <span>
        AGS<span className="brand-light"> Insights</span>
      </span>
    </div>
  );
}

export function Shell({
  nav,
  page,
  children,
}: {
  nav: NavItem[];
  page: string;
  children: ReactNode;
}) {
  const { me, account, logout } = useSession();
  const [open, setOpen] = useState(false);
  const name = me.displayName || account.name || me.email || "Signed in";
  return (
    <div className="app-layout">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(({ page: target, label, icon: Icon }) => (
            <a
              key={target}
              href={hrefFor(target)}
              className={`nav-item ${page === target ? "active" : ""}`}
              aria-current={page === target ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials(name)}</span>
          <span className="sidebar-user-text">
            <strong>{name}</strong>
            <small title={me.email ?? undefined}>
              <span className="mono">{me.role}</span> · {me.email}
            </small>
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void logout()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar mobile-only">
          <button
            className="icon-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <Brand />
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
