import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useSession } from "../auth/AuthProvider";
import { errorMessage, isAbort } from "../api/client";
import {
  getRevenueConfiguration,
  updateRevenueConfiguration,
} from "../api/endpoints";
import { targetEntities } from "../api/types";
import type { RevenueConfiguration, TargetEntity } from "../api/types";
import { Alert, Spinner } from "../components/ui";
import { entityLabels } from "../lib/labels";
import { clearSalesCache } from "./sales/salesLoader";

export function RevenueGroupsPage() {
  const { api } = useSession();
  const [entity, setEntity] = useState<TargetEntity>("agritehnica");
  const [config, setConfig] = useState<RevenueConfiguration | null>(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setConfig(null);
    setError(null);
    setSaved(false);
    getRevenueConfiguration(api, entity, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setConfig(next);
      })
      .catch((reason) => {
        if (!isAbort(reason) && !controller.signal.aborted)
          setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, entity, reload]);

  function change(next: RevenueConfiguration) {
    setConfig(next);
    setSaved(false);
  }
  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateRevenueConfiguration(api, config);
      clearSalesCache();
      setConfig(next);
      setSaved(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Grupe de venit</h1>
          <p>
            Asociați categoriile produselor cu grupele folosite în rapoarte și
            în accesul rolurilor.
          </p>
        </div>
        <div className="page-actions">
          <select
            className="control"
            aria-label="Entitate"
            value={entity}
            disabled={saving}
            onChange={(event) => setEntity(event.target.value as TargetEntity)}
          >
            {targetEntities.map((item) => (
              <option key={item} value={item}>
                {entityLabels[item]}
              </option>
            ))}
          </select>
          <button
            className="button button-secondary"
            disabled={loading || saving}
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={15} /> Reîncarcă
          </button>
        </div>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && (
        <Alert tone="success">
          Grupele au fost salvate. Rapoartele, inclusiv perioadele anterioare,
          folosesc aceste reguli la următoarea încărcare.
        </Alert>
      )}
      {loading ? (
        <section className="panel panel-loading">
          <Spinner label="Se încarcă grupele" />
        </section>
      ) : (
        config && (
          <form
            className="panel revenue-settings"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={saving}>
              <label className="toggle-control">
                <input
                  type="checkbox"
                  role="switch"
                  checked={config.enabled}
                  onChange={(event) =>
                    change({ ...config, enabled: event.target.checked })
                  }
                />
                <span>Grupează veniturile pentru {entityLabels[entity]}</span>
              </label>
              <p className="muted">
                Potrivire exactă după categorie, indiferent de majuscule,
                diacritice sau spații. Fiecare linie aparține unei singure
                grupe, inclusiv retururile.
              </p>
              <div className="table-scroll">
                <table className="data-table revenue-rules">
                  <thead>
                    <tr>
                      <th>Categorie produs (Borg)</th>
                      <th>Tip venit</th>
                      <th>Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.rules.map((rule, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            className="input"
                            aria-label={`Categorie ${index + 1}`}
                            required
                            maxLength={200}
                            value={rule.category}
                            onChange={(event) =>
                              change({
                                ...config,
                                rules: config.rules.map((item, i) =>
                                  i === index
                                    ? { ...item, category: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="input"
                            aria-label={`Tip venit pentru categoria ${index + 1}`}
                            value={rule.groupId}
                            onChange={(event) =>
                              change({
                                ...config,
                                rules: config.rules.map((item, i) =>
                                  i === index
                                    ? { ...item, groupId: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          >
                            {config.groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Elimină regula ${index + 1}`}
                            onClick={() =>
                              change({
                                ...config,
                                rules: config.rules.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="button button-secondary"
                disabled={config.rules.length >= 200}
                onClick={() =>
                  change({
                    ...config,
                    rules: [
                      ...config.rules,
                      { category: "", groupId: config.defaultGroupId },
                    ],
                  })
                }
              >
                <Plus size={16} /> Adaugă categorie
              </button>
              <label className="inline-select">
                <span>Restul categoriilor</span>
                <select
                  className="control"
                  value={config.defaultGroupId}
                  onChange={(event) =>
                    change({ ...config, defaultGroupId: event.target.value })
                  }
                >
                  {config.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Schimbarea unei reguli schimbă și vizibilitatea liniilor pentru
                rolurile cu acces limitat. Entitățile cu gruparea dezactivată
                pot fi citite numai de roluri cu acces la toate grupele.
              </p>
              <button className="button button-primary" type="submit">
                {saving ? "Se salvează…" : "Salvează grupele"}
              </button>
            </fieldset>
          </form>
        )
      )}
    </>
  );
}
