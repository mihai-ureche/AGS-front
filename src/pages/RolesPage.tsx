import { useState } from "react";
import { Lock, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useAdminData } from "../admin/AdminData";
import { errorMessage } from "../api/client";
import type { Permission, Role } from "../api/types";
import { useSession } from "../auth/AuthProvider";
import {
  Alert,
  Badge,
  Dialog,
  EmptyState,
  Field,
  Spinner,
} from "../components/ui";
import {
  builtInRoles,
  permissionInfo,
  permissionLabel,
  roleNamePattern,
} from "../lib/labels";

export function RolesPage() {
  const { can } = useSession();
  const { roles, roleCounts, loading, error, reload, deleteRole } =
    useAdminData();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const canManage = can("users:roles:update");

  async function remove(role: Role) {
    setDeleting(role.name);
    setNotice(null);
    try {
      await deleteRole(role.name);
      setNotice({ tone: "success", text: `Role ${role.name} deleted.` });
    } catch (reason) {
      setNotice({ tone: "error", text: errorMessage(reason) });
    } finally {
      setDeleting(null);
    }
  }

  const sorted = [...(roles ?? [])].sort(
    (a, b) =>
      Number(builtInRoles.includes(b.name)) -
        Number(builtInRoles.includes(a.name)) ||
      builtInRoles.indexOf(a.name) - builtInRoles.indexOf(b.name) ||
      a.name.localeCompare(b.name),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Roles</h1>
          <p>
            Each user has one role. A role's permissions decide what the backend
            allows.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="button button-secondary"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
          </button>
          {canManage && (
            <button
              className="button button-primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> New role
            </button>
          )}
        </div>
      </div>

      {error && (
        <Alert
          tone="error"
          title="Roles could not be loaded"
          action={
            <button className="button button-secondary" onClick={reload}>
              Try again
            </button>
          }
        >
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {loading && !roles ? (
        <div className="panel panel-loading">
          <Spinner label="Loading roles" />
        </div>
      ) : sorted.length ? (
        <div className="role-grid">
          {sorted.map((role) => {
            const builtIn = builtInRoles.includes(role.name);
            const count = roleCounts.get(role.name) ?? 0;
            return (
              <article className="panel role-card" key={role.name}>
                <header>
                  <span className="role-icon">
                    {builtIn ? <Lock size={16} /> : <ShieldCheck size={16} />}
                  </span>
                  <div>
                    <h2 className="mono">{role.name}</h2>
                    <span className="muted">
                      {count} {count === 1 ? "user" : "users"}
                    </span>
                  </div>
                  {builtIn ? (
                    <Badge>Built-in</Badge>
                  ) : (
                    <Badge tone="accent">Custom</Badge>
                  )}
                </header>
                <p>{role.description}</p>
                {role.permissions.length ? (
                  <ul className="permission-list">
                    {role.permissions.map((permission) => (
                      <li key={permission}>
                        <span>{permissionLabel(permission)}</span>
                        <code>{permission}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No permissions.</p>
                )}
                {canManage && !builtIn && (
                  <footer>
                    <button
                      className="button button-danger-ghost"
                      disabled={count > 0 || deleting === role.name}
                      title={
                        count > 0
                          ? "Reassign its users before deleting this role."
                          : undefined
                      }
                      onClick={() => void remove(role)}
                    >
                      <Trash2 size={15} />{" "}
                      {deleting === role.name ? "Deleting…" : "Delete role"}
                    </button>
                    {count > 0 && (
                      <span className="muted">
                        Reassign{" "}
                        {count === 1 ? "its user" : `its ${count} users`} to
                        delete.
                      </span>
                    )}
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      ) : roles ? (
        <EmptyState icon={ShieldCheck} title="No roles found" />
      ) : null}

      {canManage && (
        <CreateRoleDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(role) =>
            setNotice({
              tone: "success",
              text: `Role ${role.name} created. Assign it from the Users page.`,
            })
          }
        />
      )}
    </>
  );
}

function CreateRoleDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (role: Role) => void;
}) {
  const { roles, assignablePermissions, createRole } = useAdminData();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = !name
    ? "Enter a role name."
    : !roleNamePattern.test(name)
      ? "Use 1–50 lowercase letters, digits, _ or -, starting with a letter."
      : roles?.some((role) => role.name === name)
        ? "A role with this name already exists."
        : null;
  const descriptionError = !description.trim()
    ? "Enter a description."
    : description.trim().length > 500
      ? "Keep it under 500 characters."
      : null;
  // Sales first: it is the permission this app actually uses.
  const groups = [
    ...new Set(
      assignablePermissions.map(
        (permission) => permissionInfo[permission]?.group ?? "Other",
      ),
    ),
  ].sort((a, b) => Number(b === "Sales") - Number(a === "Sales"));

  function reset() {
    setName("");
    setDescription("");
    setPermissions([]);
    setTouched(false);
    setError(null);
  }

  async function submit() {
    setTouched(true);
    if (nameError || descriptionError) return;
    setSaving(true);
    setError(null);
    try {
      const role = await createRole({
        name,
        description: description.trim(),
        permissions: assignablePermissions.filter((permission) =>
          permissions.includes(permission),
        ),
      });
      onCreated(role);
      reset();
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New role"
      description="Custom roles can grant data access. User and role administration stays with the built-in admin role."
      footer={
        <>
          <button
            className="button button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create role"}
          </button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error && <Alert tone="error">{error}</Alert>}
        <Field
          label="Name"
          hint="For example sales-reader. Names can't be changed later."
          error={touched ? nameError : null}
        >
          {(control) => (
            <input
              {...control}
              className="input mono"
              value={name}
              maxLength={50}
              autoFocus
              onChange={(event) => setName(event.target.value.toLowerCase())}
              placeholder="sales-reader"
            />
          )}
        </Field>
        <Field label="Description" error={touched ? descriptionError : null}>
          {(control) => (
            <textarea
              {...control}
              className="input"
              rows={2}
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Read sales for assigned entities"
            />
          )}
        </Field>
        <fieldset className="permission-picker">
          <legend>Permissions</legend>
          {groups.map((group) => (
            <div key={group}>
              <span className="eyebrow">
                {group}
                {group === "Support requests" &&
                  " · API only, not used by this app"}
              </span>
              {assignablePermissions
                .filter(
                  (permission) =>
                    (permissionInfo[permission]?.group ?? "Other") === group,
                )
                .map((permission) => (
                  <label key={permission} className="check-row">
                    <input
                      type="checkbox"
                      checked={permissions.includes(permission)}
                      onChange={(event) =>
                        setPermissions(
                          event.target.checked
                            ? [...permissions, permission]
                            : permissions.filter((item) => item !== permission),
                        )
                      }
                    />
                    <span>
                      {permissionLabel(permission)}
                      <code>{permission}</code>
                    </span>
                  </label>
                ))}
            </div>
          ))}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
