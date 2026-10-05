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
  salesGroups: string[] | null;
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
  /** null grants all groups; an empty list grants no sales groups. */
  salesGroups: string[] | null;
}

export interface RevenueGroup {
  id: string;
  name: string;
}
export interface RevenueRule {
  category: string;
  groupId: string;
}
export interface RevenueConfiguration {
  targetEntity: TargetEntity;
  enabled: boolean;
  revision: number;
  defaultGroupId: string;
  rules: RevenueRule[];
  groups: RevenueGroup[];
}

/** `meta` of GET /api/borg/sales, as Borg reports it. */
export interface SalesMeta {
  targetEntity: TargetEntity;
  from: string;
  to: string;
  account: string | null;
  docType: string | null;
  limit: number;
  entries: number;
  /** Exact: Borg read one entry beyond `limit`. */
  truncated: boolean;
}

/**
 * GET /api/borg/sales: Borg's accounting ledger entries, forwarded unchanged.
 * There are no product lines or categories. Clients are the third parties on
 * the debit side of 707 entries and the credit side of 709 entries. Amounts are
 * `suma` in lei, posted between `contDebit` and `contCredit`. Fields are read defensively in
 * lib/sales.ts because the backend does not validate Borg's format.
 */
export interface SalesResponse {
  meta?: Partial<SalesMeta>;
  entries?: Record<string, unknown>[];
}

export interface SalesQuery {
  targetEntity: TargetEntity;
  from: string;
  to: string;
}
