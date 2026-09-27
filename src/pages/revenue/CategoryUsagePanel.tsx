import { useEffect, useMemo, useState } from "react";
import { errorMessage, isAbort } from "../../api/client";
import type { RevenueGroup, TargetEntity } from "../../api/types";
import { Alert, Spinner } from "../../components/ui";
import { presetRange, presets } from "../../lib/dates";
import type { PresetKey } from "../../lib/dates";
import type { SaleLine } from "../../lib/sales";
import { summarizeGroups } from "./groupContents";
import { useSession } from "../../auth/AuthProvider";
import { loadSales } from "../sales/salesLoader";

const periods: PresetKey[] = ["last30", "last90", "thisYear"];

type State =
  | { status: "loading" }
  | { status: "ready"; lines: SaleLine[]; truncated: boolean }
  | { status: "error"; error: string };

export function CategoryUsagePanel({
  entity,
  groups,
  revision,
}: {
  entity: TargetEntity;
  groups: RevenueGroup[];
  /** Saved configuration revision; a save reloads the classification. */
  revision: number;
}) {
  const { api } = useSession();
  const [period, setPeriod] = useState<PresetKey>("last30");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadSales(
      api,
      { targetEntity: entity, ...presetRange(period) },
      false,
      controller.signal,
      () => {},
    )
      .then(({ current }) => {
        if (!controller.signal.aborted)
          setState({
            status: "ready",
            lines: current.lines,
            truncated: current.truncated.length > 0,
          });
      })
      .catch((reason) => {
        if (!isAbort(reason) && !controller.signal.aborted)
          setState({ status: "error", error: errorMessage(reason) });
      });
    return () => controller.abort();
  }, [api, entity, period, revision]);

  const usage = useMemo(
    () =>
      state.status === "ready" ? summarizeGroups(state.lines, groups) : [],
    [state, groups],
  );

  return (
    <section className="panel" aria-labelledby="category-usage-title">
      <div className="panel-heading">
        <div>
          <h2 id="category-usage-title">Conținutul grupelor</h2>
          <p>Categoriile de produs găsite în vânzări, după regulile salvate.</p>
        </div>
        <select
          className="control"
          aria-label="Perioadă"
          value={period}
          onChange={(event) => setPeriod(event.target.value as PresetKey)}
        >
          {presets
            .filter((preset) => periods.includes(preset.key))
            .map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
        </select>
      </div>
      {state.status === "loading" && (
        <div className="panel-loading">
          <Spinner label="Se încarcă vânzările" />
        </div>
      )}
      {state.status === "error" && <Alert tone="error">{state.error}</Alert>}
      {state.status === "ready" && (
        <>
          {state.truncated && (
            <Alert tone="warning">
              Borg a limitat numărul de linii; unele categorii pot lipsi.
            </Alert>
          )}
          {usage.length === 0 ? (
            <p className="muted">Nicio vânzare în perioada aleasă.</p>
          ) : (
            <table className="data-table category-usage">
              <thead>
                <tr>
                  <th>Tip venit</th>
                  <th>Categorii produs (Borg)</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((group) => (
                  <tr key={group.id ?? ""}>
                    <th scope="row">{group.name}</th>
                    <td>
                      <div className="chip-row">
                        {group.categories.map((category) => (
                          <span key={category} className="chip">
                            {category}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
