import type { Permission, TargetEntity } from "../api/types";

export const entityLabels: Record<TargetEntity, string> = {
  agritehnica: "Agritehnica",
  green: "Green",
  babyhub: "BabyHub",
};

export const builtInRoles = ["user", "support", "admin"];

export const permissionInfo: Record<
  Permission,
  { label: string; group: "Vânzări" | "Solicitări de suport" | "Administrare" }
> = {
  "sales:read": {
    label: "Citește vânzările entităților alocate",
    group: "Vânzări",
  },
  "requests:create": {
    label: "Creează solicitări",
    group: "Solicitări de suport",
  },
  "requests:read:own": {
    label: "Vede propriile solicitări",
    group: "Solicitări de suport",
  },
  "requests:read:all": {
    label: "Vede toate solicitările",
    group: "Solicitări de suport",
  },
  "requests:update": {
    label: "Actualizează starea solicitărilor",
    group: "Solicitări de suport",
  },
  "users:read": { label: "Vede utilizatorii", group: "Administrare" },
  "users:roles:update": {
    label: "Gestionează utilizatorii și rolurile",
    group: "Administrare",
  },
  "roles:read": { label: "Vede rolurile", group: "Administrare" },
};

export const permissionLabel = (permission: string) =>
  permissionInfo[permission as Permission]?.label ?? permission;

export const roleNamePattern = /^[a-z][a-z0-9_-]{0,49}$/;
