import { useMemo, useState } from "react";
import { ChevronRight, RefreshCw, Search, UserX, Users } from "lucide-react";
import { useAdminData } from "../admin/AdminData";
import { useSession } from "../auth/AuthProvider";
import { Alert, Badge, EmptyState, Spinner } from "../components/ui";
import { dateTime, initials, relativeTime } from "../lib/format";
import { entityLabels } from "../lib/labels";
import { useRoute } from "../lib/route";
import { displayName, userStatus } from "../admin/users";
import { UserSheet } from "./UserSheet";

type StatusFilter = "current" | "active" | "inactive" | "deleted" | "all";
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "current", label: "Activi și inactivi" },
  { value: "active", label: "Activi" },
  { value: "inactive", label: "Inactivi" },
  { value: "deleted", label: "Șterși" },
  { value: "all", label: "Toți utilizatorii" },
];

export function UsersPage() {
  const { me } = useSession();
  const { users, roles, loading, error, reload } = useAdminData();
  const { params, navigate } = useRoute();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("current");
  const editing = users?.find((user) => user.id === params.get("user")) ?? null;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (users ?? [])
      .filter((user) => {
        const state = userStatus(user).key;
        if (status === "current" && state === "deleted") return false;
        if (status !== "current" && status !== "all" && state !== status)
          return false;
        if (role !== "all" && user.role !== role) return false;
        return (
          !term ||
          `${user.displayName ?? ""} ${user.email ?? ""}`
            .toLowerCase()
            .includes(term)
        );
      })
      .sort(
        (a, b) =>
          Number(b.microsoftUserId === me.id) -
            Number(a.microsoftUserId === me.id) ||
          displayName(a).localeCompare(displayName(b)),
      );
  }, [users, search, role, status, me.id]);

  const current = (users ?? []).filter((user) => !user.deletedAt);
  const stats = [
    { label: "Utilizatori", value: current.length },
    { label: "Activi", value: current.filter((user) => user.isActive).length },
    {
      label: "Administratori",
      value: current.filter((user) => user.role === "admin").length,
    },
    {
      label: "Fără acces la entități",
      value: current.filter((user) => !user.targetEntities.length).length,
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Utilizatori</h1>
          <p>
            Roluri, acces la entități și starea contului pentru toți cei care
            s-au autentificat în AGS.
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
        </div>
      </div>

      {error && (
        <Alert
          tone="error"
          title="Utilizatorii nu au putut fi încărcați"
          action={
            <button className="button button-secondary" onClick={reload}>
              Încercați din nou
            </button>
          }
        >
          {error}
        </Alert>
      )}

      {users && (
        <div className="stat-strip">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      )}

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Căutați utilizatori"
              placeholder="Căutați după nume sau e-mail"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className="control"
            aria-label="Filtrați după rol"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="all">Toate rolurile</option>
            {roles?.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="control"
            aria-label="Filtrați după stare"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading && !users ? (
          <div className="panel-loading">
            <Spinner label="Se încarcă utilizatorii" />
          </div>
        ) : visible.length ? (
          <div className="table-scroll">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>Utilizator</th>
                  <th>Rol</th>
                  <th>Acces la entități</th>
                  <th>Stare</th>
                  <th>Ultima autentificare</th>
                  <th aria-label="Acțiuni" />
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => {
                  const state = userStatus(user);
                  const isMe = user.microsoftUserId === me.id;
                  return (
                    <tr
                      key={user.id}
                      className="clickable-row"
                      onClick={() => navigate("users", { user: user.id })}
                    >
                      <td>
                        <div className="person-cell">
                          <span className="avatar">
                            {initials(displayName(user))}
                          </span>
                          <span>
                            <strong>
                              {displayName(user)}{" "}
                              {isMe && <Badge tone="accent">Dvs.</Badge>}
                            </strong>
                            <small>{user.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="mono-chip">{user.role}</span>
                      </td>
                      <td>
                        {user.targetEntities.length ? (
                          <div className="chip-row">
                            {user.targetEntities.map((entity) => (
                              <span key={entity} className="chip">
                                {entityLabels[entity]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Niciuna</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td
                        className="muted nowrap"
                        title={dateTime(user.lastSeenAt)}
                      >
                        {relativeTime(user.lastSeenAt)}
                      </td>
                      <td className="row-action">
                        <button
                          className="icon-button"
                          aria-label={`Gestionați ${displayName(user)}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate("users", { user: user.id });
                          }}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : users ? (
          <EmptyState
            icon={users.length ? UserX : Users}
            title={
              users.length
                ? "Niciun utilizator nu corespunde filtrelor"
                : "Încă nu există utilizatori"
            }
          >
            {users.length
              ? "Încercați altă căutare, alt rol sau altă stare."
              : "Utilizatorii apar aici după prima autentificare în AGS."}
          </EmptyState>
        ) : null}
      </section>

      <UserSheet user={editing} onClose={() => navigate("users", {}, true)} />
    </>
  );
}
