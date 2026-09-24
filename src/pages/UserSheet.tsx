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
      title="Gestionare acces"
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
            {displayName(user)} {isMe && <Badge tone="accent">Dvs.</Badge>}
          </strong>
          <span>{user.email ?? "Fără e-mail"}</span>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>

      {deleted && (
        <Alert tone="warning" title="Acest cont a fost șters">
          Șters pe {dateTime(user.deletedAt!)}. Conturile șterse își păstrează
          istoricul, dar nu se pot autentifica, nu pot fi reactivate și nu li se
          poate aloca un rol.
        </Alert>
      )}
      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" onDismiss={() => setSaved(false)}>
          Modificările au fost salvate. Se aplică la următoarea cerere a
          utilizatorului.
        </Alert>
      )}

      <section className="form-section">
        <h3>Rol</h3>
        <select
          className="control control-block"
          aria-label="Rol"
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
            ? "Nu vă puteți schimba propriul rol. O poate face alt administrator sau comanda user:role din backend."
            : selectedRole?.description}
        </p>
      </section>

      <section className="form-section">
        <h3>Acces la entități</h3>
        <p className="form-hint">
          Pentru datele de vânzări sunt necesare atât accesul la entitate de
          aici, cât și un rol care include vânzările.
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
            Rolul <code>{role}</code> nu poate citi vânzările, așa că aceste
            accese nu au efect până când utilizatorul primește un rol cu acces
            la vânzări.
          </Alert>
        )}
      </section>

      <section className="form-section">
        <h3>Starea contului</h3>
        <label className="switch-row">
          <input
            type="checkbox"
            role="switch"
            aria-describedby="account-status-help"
            checked={isActive}
            disabled={!editable || isMe || saving}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <strong>Cont activ</strong>
        </label>
        <p className="form-hint" id="account-status-help">
          {isMe
            ? "Nu vă puteți dezactiva propriul cont."
            : "Utilizatorii inactivi sunt refuzați la fiecare cerere. Rolul și accesele se păstrează pentru reactivare."}
        </p>
      </section>

      <dl className="detail-list">
        <dt>Creat</dt>
        <dd>{dateTime(user.createdAt)}</dd>
        <dt>Ultima autentificare</dt>
        <dd>{dateTime(user.lastSeenAt)}</dd>
        <dt>ID utilizator AGS</dt>
        <dd>
          <code>{user.id}</code>
          <button
            className="icon-button"
            aria-label="Copiați ID-ul de utilizator AGS"
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
            Închide
          </button>
          <button
            className="button button-primary"
            onClick={() => void save()}
            disabled={!dirty || saving}
          >
            {saving ? "Se salvează…" : "Salvează modificările"}
          </button>
        </div>
      )}

      {editable && !isMe && (
        <section className="danger-zone">
          <div>
            <h3>Ștergere utilizator</h3>
            <p>
              Revocă definitiv accesul, elimină accesul la entități și resetează
              rolul la user. Pentru o suspendare temporară, folosiți Inactiv.
            </p>
          </div>
          {confirmDelete ? (
            <div className="confirm-row">
              <button
                className="button button-secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
                Anulează
              </button>
              <button
                className="button button-danger"
                onClick={() => void remove()}
                disabled={saving}
              >
                <Trash2 size={15} /> Șterge {displayName(user)}
              </button>
            </div>
          ) : (
            <button
              className="button button-danger-ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Trash2 size={15} /> Șterge utilizatorul…
            </button>
          )}
        </section>
      )}
    </div>
  );
}
