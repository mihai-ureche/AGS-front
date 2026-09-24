import { useEffect } from "react";
import { AdminDataProvider } from "./admin/AdminData";
import { useAuth, useSession } from "./auth/AuthProvider";
import { navIcons, Shell } from "./components/Shell";
import type { NavItem } from "./components/Shell";
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
  const nav: NavItem[] = [
    can("sales:read") && {
      page: "sales",
      label: "Sales",
      icon: navIcons.sales,
    },
    can("users:read") && {
      page: "users",
      label: "Users",
      icon: navIcons.users,
    },
    can("roles:read") && {
      page: "roles",
      label: "Roles",
      icon: navIcons.roles,
    },
  ].filter((item): item is NavItem => Boolean(item));
  const current = nav.find((item) => item.page === page)?.page ?? nav[0]?.page;

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
