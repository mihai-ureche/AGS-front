// Shapes returned by AGS-backend. Timestamps arrive as ISO strings.

export const targetEntities = ["agritehnica", "green", "babyhub"] as const;
export type TargetEntity = (typeof targetEntities)[number];

export type Permission =
  | "requests:create"
  | "requests:read:own"
  | "requests:read:all"
  | "requests:update"
  | "users:read"
  | "users:roles:update"
  | "roles:read"
  | "sales:read";

/** GET /api/me — `id` is the Microsoft user ID, not the database ID. */
export interface Me {
  id: string;
  tenantId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isAdmin: boolean;
  permissions: Permission[];
  targetEntities: TargetEntity[];
  isActive: boolean;
}

/** A saved user row from POST/GET/PATCH /api/users. */
export interface User {
  id: string;
  tenantId: string;
  microsoftUserId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  targetEntities: TargetEntity[];
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface Role {
  name: string;
  description: string;
  permissions: Permission[];
}

export type DocType = "BFD" | "AIM";

export interface SalesQuery {
  targetEntity: TargetEntity;
  from: string;
  to: string;
  docType?: DocType;
  gestiune?: number;
  includeTransfers?: boolean;
}
