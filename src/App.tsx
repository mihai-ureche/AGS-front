import { useEffect } from "react";
import { AdminDataProvider } from "./admin/AdminData";
import { useAuth, useSession } from "./auth/AuthProvider";
import { isNavGroup, navIcons, Shell } from "./components/Shell";
import type { NavEntry, NavLink } from "./components/Shell";
import { missingConfig } from "./config";
import { useRoute } from "./lib/route";
import {
  BlockedScreen,
  LoadingScreen,
  LoginScreen,
  NoAccessScreen,
  SetupScreen,
} from "./pages/Gates";
import { RolesPage } from "./pages/RolesPage";
import { SalesPage } from "./pages/SalesPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  const { session } = useAuth();
  if (missingConfig.length) return <SetupScreen />;
  switch (session.status) {
    case "loading":
      return <LoadingScreen />;
    case "signed-out":
      return <LoginScreen error={session.error} />;
    case "blocked":
    case "error":
      return <BlockedScreen message={session.message} tone={session.status} />;
    case "ready":
      return <Workspace />;
  }
}

function Workspace() {
  const { can } = useSession();
  const { page, navigate } = useRoute();
  // Navigation mirrors backend permissions; the backend enforces them independently.
  const adminPages: NavLink[] = [
    can("users:read") && {
      page: "users",
      label: "Utilizatori",
      icon: navIcons.users,
    },
    can("roles:read") && {
      page: "roles",
      label: "Roluri",
      icon: navIcons.roles,
    },
  ].filter((item): item is NavLink => Boolean(item));
  const nav: NavEntry[] = [
    ...(can("sales:read")
      ? [{ page: "sales", label: "Vânzări", icon: navIcons.sales }]
      : []),
    ...(adminPages.length
      ? [
          {
            id: "admin",
            label: "Administrare",
            icon: navIcons.admin,
            items: adminPages,
          },
        ]
      : []),
  ];
  const pages = nav.flatMap((entry) =>
    isNavGroup(entry) ? entry.items : [entry],
  );
  const current =
    pages.find((item) => item.page === page)?.page ?? pages[0]?.page;

  useEffect(() => {
    if (current && current !== page) navigate(current, {}, true);
  }, [current, page, navigate]);

  if (!current) return <NoAccessScreen />;
  const content =
    current === "sales" ? (
      <SalesPage />
    ) : current === "users" ? (
      <UsersPage />
    ) : (
      <RolesPage />
    );
  const admin = can("users:read") || can("roles:read");
  return (
    <Shell nav={nav} page={current}>
      {admin ? <AdminDataProvider>{content}</AdminDataProvider> : content}
    </Shell>
  );
}
