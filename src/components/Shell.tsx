import { useId, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSession } from "../auth/AuthProvider";
import { initials } from "../lib/format";
import { hrefFor } from "../lib/route";

export type NavLink = { page: string; label: string; icon: LucideIcon };
/** A collapsible menu of related pages, e.g. administration. */
export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLink[];
};
export type NavEntry = NavLink | NavGroup;

export const isNavGroup = (entry: NavEntry): entry is NavGroup =>
  "items" in entry;

export const navIcons = {
  sales: BarChart3,
  admin: Settings,
  users: Users,
  roles: ShieldCheck,
};

/** The Agritehnica mark from agritehnica.ro: two lime wings and a forest square. */
function BrandMark() {
  return (
    <svg viewBox="0 0 6 4" width={24} height={16} aria-hidden="true">
      <path fill="#bfd131" d="M0 2 2 0v4H0zm4-2 2 2v2H4z" />
      <path fill="#144225" d="M2 0h2v2H2z" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <BrandMark />
      </span>
      <span>
        AGS<span className="brand-light"> Insights</span>
      </span>
    </div>
  );
}

function NavLinkItem({
  link,
  page,
  onNavigate,
  nested = false,
}: {
  link: NavLink;
  page: string;
  onNavigate: () => void;
  nested?: boolean;
}) {
  const { page: target, label, icon: Icon } = link;
  return (
    <a
      href={hrefFor(target)}
      className={`nav-item ${nested ? "nav-sub-item" : ""} ${page === target ? "active" : ""}`}
      aria-current={page === target ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon size={nested ? 16 : 18} aria-hidden="true" />
      {label}
    </a>
  );
}

function NavGroupItem({
  group,
  page,
  onNavigate,
}: {
  group: NavGroup;
  page: string;
  onNavigate: () => void;
}) {
  const panelId = useId();
  const containsPage = group.items.some((item) => item.page === page);
  const [expanded, setExpanded] = useState(containsPage);
  // Arriving on one of its pages (from a link elsewhere) opens the group.
  const [shownFor, setShownFor] = useState(containsPage);
  if (containsPage !== shownFor) {
    setShownFor(containsPage);
    if (containsPage) setExpanded(true);
  }
  const Icon = group.icon;
  return (
    <div className="nav-group">
      <button
        className={`nav-item nav-group-toggle ${containsPage && !expanded ? "active" : ""}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon size={18} aria-hidden="true" />
        {group.label}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`nav-chevron ${expanded ? "is-open" : ""}`}
        />
      </button>
      <div id={panelId} className="nav-sub" hidden={!expanded}>
        {group.items.map((link) => (
          <NavLinkItem
            key={link.page}
            link={link}
            page={page}
            onNavigate={onNavigate}
            nested
          />
        ))}
      </div>
    </div>
  );
}

export function Shell({
  nav,
  page,
  children,
}: {
  nav: NavEntry[];
  page: string;
  children: ReactNode;
}) {
  const { me, account, logout } = useSession();
  const [open, setOpen] = useState(false);
  const name = me.displayName || account.name || me.email || "Autentificat";
  const close = () => setOpen(false);
  return (
    <div className="app-layout">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Închide navigarea"
          onClick={close}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Închide navigarea"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Navigare principală">
          {nav.map((entry) =>
            isNavGroup(entry) ? (
              <NavGroupItem
                key={entry.id}
                group={entry}
                page={page}
                onNavigate={close}
              />
            ) : (
              <NavLinkItem
                key={entry.page}
                link={entry}
                page={page}
                onNavigate={close}
              />
            ),
          )}
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
            aria-label="Deconectare"
            title="Deconectare"
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
            aria-label="Deschide navigarea"
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
