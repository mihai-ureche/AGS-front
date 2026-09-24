import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { errorMessage, isAbort } from "../api/client";
import * as endpoints from "../api/endpoints";
import type { Permission, Role, TargetEntity, User } from "../api/types";
import { useSession } from "../auth/AuthProvider";

export type AccessChanges = {
  role?: string;
  targetEntities?: TargetEntity[];
  isActive?: boolean;
};

type AdminData = {
  users: User[] | null;
  roles: Role[] | null;
  assignablePermissions: Permission[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  saveAccess: (user: User, changes: AccessChanges) => Promise<User>;
  deleteUser: (user: User) => Promise<void>;
  createRole: (role: Role) => Promise<Role>;
  deleteRole: (name: string) => Promise<void>;
  /** Active and inactive (not deleted) users per role name. */
  roleCounts: Map<string, number>;
};

const AdminContext = createContext<AdminData | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { api, can, me, reload: reloadSession } = useSession();
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [assignablePermissions, setAssignable] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const canReadUsers = can("users:read");
  const canReadRoles = can("roles:read");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      canReadUsers
        ? endpoints.listAllUsers(api, controller.signal)
        : Promise.resolve(null),
      canReadRoles
        ? endpoints.listRoles(api, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([nextUsers, roleData]) => {
        setUsers(nextUsers);
        setRoles(roleData?.roles ?? null);
        setAssignable(roleData?.assignablePermissions ?? []);
      })
      .catch((reason: unknown) => {
        if (!isAbort(reason)) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, canReadUsers, canReadRoles, token]);

  const replaceUser = useCallback((next: User) => {
    setUsers(
      (list) =>
        list?.map((user) => (user.id === next.id ? next : user)) ?? null,
    );
  }, []);

  const saveAccess = useCallback(
    async (user: User, changes: AccessChanges) => {
      let saved = user;
      // Two endpoints: a failure in the second leaves the first change saved.
      if (changes.role !== undefined && changes.role !== user.role) {
        saved = await endpoints.updateUserRole(api, user.id, changes.role);
        replaceUser(saved);
      }
      const body: { targetEntities?: TargetEntity[]; isActive?: boolean } = {};
      if (changes.targetEntities) body.targetEntities = changes.targetEntities;
      if (changes.isActive !== undefined && changes.isActive !== user.isActive)
        body.isActive = changes.isActive;
      if (Object.keys(body).length) {
        saved = await endpoints.updateUser(api, user.id, body);
        replaceUser(saved);
      }
      // An admin editing their own grants needs the new entities in the session.
      if (user.microsoftUserId === me.id) await reloadSession();
      return saved;
    },
    [api, me.id, reloadSession, replaceUser],
  );

  const deleteUser = useCallback(
    async (user: User) => {
      await endpoints.deleteUser(api, user.id);
      // Mirror the backend's soft delete without refetching every page.
      replaceUser({
        ...user,
        isActive: false,
        deletedAt: new Date().toISOString(),
        role: "user",
        targetEntities: [],
      });
    },
    [api, replaceUser],
  );

  const createRole = useCallback(
    async (role: Role) => {
      const created = await endpoints.createRole(api, role);
      setRoles((list) =>
        [...(list ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return created;
    },
    [api],
  );

  const deleteRole = useCallback(
    async (name: string) => {
      await endpoints.deleteRole(api, name);
      setRoles((list) => list?.filter((role) => role.name !== name) ?? null);
    },
    [api],
  );

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users ?? []) {
      if (!user.deletedAt)
        counts.set(user.role, (counts.get(user.role) ?? 0) + 1);
    }
    return counts;
  }, [users]);

  const value: AdminData = {
    users,
    roles,
    assignablePermissions,
    loading,
    error,
    reload: () => setToken((value) => value + 1),
    saveAccess,
    deleteUser,
    createRole,
    deleteRole,
    roleCounts,
  };
  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdminData() {
  const data = useContext(AdminContext);
  if (!data)
    throw new Error("useAdminData must be used within AdminDataProvider");
  return data;
}
