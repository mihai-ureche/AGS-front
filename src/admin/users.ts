import type { User } from "../api/types";

export function userStatus(user: User) {
  if (user.deletedAt)
    return { key: "deleted", label: "Șters", tone: "critical" } as const;
  if (!user.isActive)
    return { key: "inactive", label: "Inactiv", tone: "warning" } as const;
  return { key: "active", label: "Activ", tone: "good" } as const;
}

export const displayName = (user: User) =>
  user.displayName || user.email || "Utilizator fără nume";
