import type { Permission, TargetEntity } from "../api/types";

export const entityLabels: Record<TargetEntity, string> = {
  agritehnica: "Agritehnica",
  green: "Green",
  babyhub: "BabyHub",
};

export const builtInRoles = ["user", "support", "admin"];

export const permissionInfo: Record<
  Permission,
  { label: string; group: "Sales" | "Support requests" | "Administration" }
> = {
  "sales:read": { label: "Read sales for granted entities", group: "Sales" },
  "requests:create": { label: "Create requests", group: "Support requests" },
  "requests:read:own": {
    label: "View own requests",
    group: "Support requests",
  },
  "requests:read:all": {
    label: "View all requests",
    group: "Support requests",
  },
  "requests:update": {
    label: "Update request status",
    group: "Support requests",
  },
  "users:read": { label: "View users", group: "Administration" },
  "users:roles:update": {
    label: "Manage users and roles",
    group: "Administration",
  },
  "roles:read": { label: "View roles", group: "Administration" },
};

export const permissionLabel = (permission: string) =>
  permissionInfo[permission as Permission]?.label ?? permission;

export const roleNamePattern = /^[a-z][a-z0-9_-]{0,49}$/;
