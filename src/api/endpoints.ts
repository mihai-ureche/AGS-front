import type { Api } from "./client";
import type {
  Me,
  Permission,
  Role,
  SalesQuery,
  TargetEntity,
  User,
} from "./types";

const USERS_PAGE = 100;
const MAX_USER_PAGES = 50;

/** Creates or refreshes the signed-in user's database row. */
export async function saveCurrentUser(api: Api) {
  return (await api.post<{ user: User }>("/api/users")).user;
}

export async function getMe(api: Api) {
  return (await api.get<{ user: Me }>("/api/me")).user;
}

/** The backend pages users at 100 per request; organizations are small, so load them all. */
export async function listAllUsers(api: Api, signal?: AbortSignal) {
  const users: User[] = [];
  for (let page = 0; page < MAX_USER_PAGES; page++) {
    const { users: batch } = await api.get<{ users: User[] }>("/api/users", {
      query: { limit: USERS_PAGE, offset: page * USERS_PAGE },
      signal,
    });
    users.push(...batch);
    if (batch.length < USERS_PAGE) break;
  }
  return users;
}

export async function updateUserRole(api: Api, id: string, role: string) {
  return (
    await api.patch<{ user: User }>(`/api/users/${id}/role`, { body: { role } })
  ).user;
}

export async function updateUser(
  api: Api,
  id: string,
  body: { targetEntities?: TargetEntity[]; isActive?: boolean },
) {
  return (await api.patch<{ user: User }>(`/api/users/${id}`, { body })).user;
}

export function deleteUser(api: Api, id: string) {
  return api.delete(`/api/users/${id}`);
}

export function listRoles(api: Api, signal?: AbortSignal) {
  return api.get<{ roles: Role[]; assignablePermissions: Permission[] }>(
    "/api/roles",
    { signal },
  );
}

export async function createRole(api: Api, role: Role) {
  return (await api.post<{ role: Role }>("/api/roles", { body: role })).role;
}

export function deleteRole(api: Api, name: string) {
  return api.delete(`/api/roles/${encodeURIComponent(name)}`);
}

/** Raw Borg product lines; the backend passes them through unchanged. */
export function getSales(
  api: Api,
  query: SalesQuery & { limit: number },
  signal?: AbortSignal,
) {
  return api.get<Record<string, unknown>[]>("/api/borg/sales", {
    query: {
      targetEntity: query.targetEntity,
      from: query.from,
      to: query.to,
      docType: query.docType,
      gestiune: query.gestiune,
      limit: query.limit,
      includeTransfers: query.includeTransfers ?? false,
    },
    signal,
  });
}
