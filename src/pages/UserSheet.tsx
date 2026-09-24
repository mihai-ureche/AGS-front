import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { useAdminData } from "../admin/AdminData";
import { errorMessage } from "../api/client";
import { targetEntities } from "../api/types";
import type { TargetEntity, User } from "../api/types";
import { useSession } from "../auth/AuthProvider";
import { Alert, Badge, Dialog } from "../components/ui";
import { dateTime, initials } from "../lib/format";
import { entityLabels } from "../lib/labels";
import { displayName, userStatus } from "../admin/users";

export function UserSheet({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      variant="sheet"
      title="Manage access"
      description={user ? displayName(user) : undefined}
    >
      {user && <UserForm key={user.id} user={user} onClose={onClose} />}
    </Dialog>
  );
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

function UserForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { me, can } = useSession();
  const { roles, saveAccess, deleteUser } = useAdminData();
  const [role, setRole] = useState(user.role);
  const [entities, setEntities] = useState<TargetEntity[]>(user.targetEntities);
  const [isActive, setIsActive] = useState(user.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isMe = user.microsoftUserId === me.id;
  const deleted = Boolean(user.deletedAt);
  const editable = can("users:roles:update") && !deleted;
  const state = userStatus(user);
  const selectedRole = roles?.find((item) => item.name === role);
  const readsSales = selectedRole?.permissions.includes("sales:read") ?? false;
  const dirty =
    role !== user.role ||
    !sameSet(entities, user.targetEntities) ||
    isActive !== user.isActive;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveAccess(user, {
        role,
        targetEntities: sameSet(entities, user.targetEntities)
          ? undefined
          : targetEntities.filter((entity) => entities.includes(entity)),
        isActive,
      });
      setSaved(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await deleteUser(user);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
      setSaving(false);
    }
  }

  return (
    <div className="user-form">
      <div className="user-summary">
        <span className="avatar avatar-large">
          {initials(displayName(user))}
        </span>
        <div>
          <strong>
            {displayName(user)} {isMe && <Badge tone="accent">You</Badge>}
          </strong>
          <span>{user.email ?? "No email"}</span>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>

      {deleted && (
        <Alert tone="warning" title="This account was deleted">
          Deleted {dateTime(user.deletedAt!)}. Deleted accounts keep their
          history but can't sign in, be reactivated or be assigned a role.
        </Alert>
      )}
      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" onDismiss={() => setSaved(false)}>
          Changes saved. They apply on the user's next request.
        </Alert>
      )}

      <section className="form-section">
        <h3>Role</h3>
        <select
          className="control control-block"
          aria-label="Role"
          value={role}
          disabled={!editable || isMe || saving}
          onChange={(event) => setRole(event.target.value)}
        >
          {!roles?.some((item) => item.name === role) && (
            <option value={role}>{role}</option>
          )}
          {roles?.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <p className="form-hint">
          {isMe
            ? "You can't change your own role. Another administrator, or the backend's user:role command, can."
            : selectedRole?.description}
        </p>
      </section>

      <section className="form-section">
        <h3>Entity access</h3>
        <p className="form-hint">
          Sales data needs both an entity grant here and a role that includes
          sales access.
        </p>
        <div className="option-cards">
          {targetEntities.map((entity) => (
            <label
              key={entity}
              className={`option-card ${entities.includes(entity) ? "is-checked" : ""}`}
            >
              <input
                type="checkbox"
                checked={entities.includes(entity)}
                disabled={!editable || saving}
                onChange={(event) =>
                  setEntities(
                    event.target.checked
                      ? [...entities, entity]
                      : entities.filter((item) => item !== entity),
                  )
                }
              />
              <span>{entityLabels[entity]}</span>
            </label>
          ))}
        </div>
        {editable && entities.length > 0 && !readsSales && (
          <Alert tone="warning">
            The <code>{role}</code> role can't read sales, so these grants have
            no effect until the user has a sales role.
          </Alert>
        )}
      </section>

      <section className="form-section">
        <h3>Account status</h3>
        <label className="switch-row">
          <input
            type="checkbox"
            role="switch"
            aria-describedby="account-status-help"
            checked={isActive}
            disabled={!editable || isMe || saving}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <strong>Account active</strong>
        </label>
        <p className="form-hint" id="account-status-help">
          {isMe
            ? "You can't deactivate your own account."
            : "Inactive users are refused on every request. Role and grants are kept for reactivation."}
        </p>
      </section>

      <dl className="detail-list">
        <dt>Created</dt>
        <dd>{dateTime(user.createdAt)}</dd>
        <dt>Last sign-in</dt>
        <dd>{dateTime(user.lastSeenAt)}</dd>
        <dt>AGS user ID</dt>
        <dd>
          <code>{user.id}</code>
          <button
            className="icon-button"
            aria-label="Copy AGS user ID"
            onClick={() => void navigator.clipboard?.writeText(user.id)}
          >
            <Copy size={14} />
          </button>
        </dd>
      </dl>

      {editable && (
        <div className="sheet-actions">
          <button
            className="button button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
          <button
            className="button button-primary"
            onClick={() => void save()}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}

      {editable && !isMe && (
        <section className="danger-zone">
          <div>
            <h3>Delete user</h3>
            <p>
              Revokes access permanently, clears entity grants and resets the
              role to user. Use Inactive for a temporary suspension.
            </p>
          </div>
          {confirmDelete ? (
            <div className="confirm-row">
              <button
                className="button button-secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="button button-danger"
                onClick={() => void remove()}
                disabled={saving}
              >
                <Trash2 size={15} /> Delete {displayName(user)}
              </button>
            </div>
          ) : (
            <button
              className="button button-danger-ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Trash2 size={15} /> Delete user…
            </button>
          )}
        </section>
      )}
    </div>
  );
}
