import type { User } from "../api/types";

export function userStatus(user: User) {
  if (user.deletedAt)
    return { key: "deleted", label: "Deleted", tone: "critical" } as const;
  if (!user.isActive)
    return { key: "inactive", label: "Inactive", tone: "warning" } as const;
  return { key: "active", label: "Active", tone: "good" } as const;
}

export const displayName = (user: User) =>
  user.displayName || user.email || "Unnamed user";
