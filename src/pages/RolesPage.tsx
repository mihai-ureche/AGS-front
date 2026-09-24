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
import { plural } from "../lib/format";

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
      setNotice({ tone: "success", text: `Rolul ${role.name} a fost șters.` });
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
          <h1>Roluri</h1>
          <p>
            Fiecare utilizator are un singur rol. Permisiunile rolului stabilesc
            ce permite backend-ul.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="button button-secondary"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
            Reîmprospătare
          </button>
          {canManage && (
            <button
              className="button button-primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> Rol nou
            </button>
          )}
        </div>
      </div>

      {error && (
        <Alert
          tone="error"
          title="Rolurile nu au putut fi încărcate"
          action={
            <button className="button button-secondary" onClick={reload}>
              Încercați din nou
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
          <Spinner label="Se încarcă rolurile" />
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
                      {plural(count, "utilizator", "utilizatori")}
                    </span>
                  </div>
                  {builtIn ? (
                    <Badge>Predefinit</Badge>
                  ) : (
                    <Badge tone="accent">Personalizat</Badge>
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
                  <p className="muted">Nicio permisiune.</p>
                )}
                {canManage && !builtIn && (
                  <footer>
                    <button
                      className="button button-danger-ghost"
                      disabled={count > 0 || deleting === role.name}
                      title={
                        count > 0
                          ? "Mutați utilizatorii pe alt rol înainte de a-l șterge."
                          : undefined
                      }
                      onClick={() => void remove(role)}
                    >
                      <Trash2 size={15} />{" "}
                      {deleting === role.name ? "Se șterge…" : "Șterge rolul"}
                    </button>
                    {count > 0 && (
                      <span className="muted">
                        Pentru ștergere, mutați{" "}
                        {count === 1
                          ? "utilizatorul"
                          : `cei ${plural(count, "utilizator", "utilizatori")}`}{" "}
                        pe alt rol.
                      </span>
                    )}
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      ) : roles ? (
        <EmptyState icon={ShieldCheck} title="Nu s-au găsit roluri" />
      ) : null}

      {canManage && (
        <CreateRoleDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(role) =>
            setNotice({
              tone: "success",
              text: `Rolul ${role.name} a fost creat. Îl puteți aloca din pagina Utilizatori.`,
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
    ? "Introduceți numele rolului."
    : !roleNamePattern.test(name)
      ? "Folosiți 1–50 de litere mici, cifre, _ sau -, începând cu o literă."
      : roles?.some((role) => role.name === name)
        ? "Există deja un rol cu acest nume."
        : null;
  const descriptionError = !description.trim()
    ? "Introduceți o descriere."
    : description.trim().length > 500
      ? "Folosiți cel mult 500 de caractere."
      : null;
  // Sales first: it is the permission this app actually uses.
  const groups = [
    ...new Set(
      assignablePermissions.map(
        (permission) => permissionInfo[permission]?.group ?? "Altele",
      ),
    ),
  ].sort((a, b) => Number(b === "Vânzări") - Number(a === "Vânzări"));

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
      title="Rol nou"
      description="Rolurile personalizate pot acorda acces la date. Administrarea utilizatorilor și a rolurilor rămâne la rolul predefinit admin."
      footer={
        <>
          <button
            className="button button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Anulează
          </button>
          <button
            className="button button-primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Se creează…" : "Creează rolul"}
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
          label="Nume"
          hint="De exemplu sales-reader. Numele nu mai poate fi schimbat ulterior."
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
        <Field label="Descriere" error={touched ? descriptionError : null}>
          {(control) => (
            <textarea
              {...control}
              className="input"
              rows={2}
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Citește vânzările entităților alocate"
            />
          )}
        </Field>
        <fieldset className="permission-picker">
          <legend>Permisiuni</legend>
          {groups.map((group) => (
            <div key={group}>
              <span className="eyebrow">
                {group}
                {group === "Solicitări de suport" &&
                  " · doar prin API, nefolosite în această aplicație"}
              </span>
              {assignablePermissions
                .filter(
                  (permission) =>
                    (permissionInfo[permission]?.group ?? "Altele") === group,
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
