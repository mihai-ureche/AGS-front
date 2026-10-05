import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CircleOff, KeyRound, Layers } from "lucide-react";
import { useSession } from "../auth/AuthProvider";
import { Alert, EmptyState, Spinner } from "../components/ui";
import { chunkRange, presets } from "../lib/dates";
import { locale, longDate, number, plural, shortDate } from "../lib/format";
import { entityLabels } from "../lib/labels";
import { useRoute } from "../lib/route";
import {
  inGroup,
  inWarehouse,
  metricOptions,
  SALES_ACCOUNTS,
  SALES_ENTITY,
  groupChoices,
  summarize,
} from "../lib/sales";
import type { MetricKey } from "../lib/sales";
import { CurrencyControl } from "./sales/CurrencyControl";
import { ClientsPanel } from "./sales/ClientsPanel";
import { WarehousePicker } from "./sales/WarehousePicker";
import { GestiuniPanel } from "./sales/GestiuniPanel";
import { GroupTabs } from "./sales/GroupTabs";
import { Kpis } from "./sales/Kpis";
import { readParams, toQuery, writeParams } from "./sales/params";
import type { SalesParams } from "./sales/params";
import { QueryBar } from "./sales/QueryBar";
import { splitOptions, TrendChart } from "./sales/TrendChart";
import type { SplitBy } from "./sales/TrendChart";
import {
  clearSalesCache,
  ENTRY_LIMIT,
  useSalesData,
} from "./sales/useSalesData";

export function SalesPage() {
  const { me, profile, can } = useSession();
  const { params, navigate } = useRoute();

  if (!me.targetEntities.includes(SALES_ENTITY)) {
    return (
      <>
        <SalesHeading />
        <section className="panel">
          <EmptyState
            icon={KeyRound}
            title={`Contului dumneavoastră nu i-a fost alocat accesul la ${entityLabels[SALES_ENTITY]}`}
            action={
              can("users:roles:update") ? (
                <button
                  className="button button-primary"
                  onClick={() => navigate("users", { user: profile.id })}
                >
                  Acordați-vă acces la entități
                </button>
              ) : undefined
            }
          >
            Datele de vânzări apar doar pentru entitățile alocate de un
            administrator, inclusiv pentru administratori.
          </EmptyState>
        </section>
      </>
    );
  }
  // Ledger entries have no product category, so the backend refuses them to
  // roles that are limited to some revenue groups.
  if (me.salesGroups !== null) {
    return (
      <>
        <SalesHeading />
        <section className="panel">
          <EmptyState
            icon={Layers}
            title="Rolul dumneavoastră este limitat pe grupe de venit"
          >
            Vânzările provin din registrul contabil Borg, care nu are categorii
            de produs și nu poate fi împărțit pe grupe de venit. Doar rolurile
            cu acces la toate grupele le pot citi; cereți unui administrator să
            vă schimbe accesul.
          </EmptyState>
        </section>
      </>
    );
  }
  const state = readParams(params);
  return (
    <SalesDashboard
      state={state}
      onChange={(next) =>
        navigate("sales", writeParams({ ...state, ...next }), true)
      }
    />
  );
}

function SalesHeading({
  subtitle,
  status,
  actions,
}: {
  subtitle?: string;
  status?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>Vânzări</h1>
        <p>
          {subtitle ??
            `Vânzările ${entityLabels[SALES_ENTITY]} din registrul contabil Borg.`}
        </p>
      </div>
      {(status || actions) && (
        <div className="page-actions">
          {status && <p className="page-status">{status}</p>}
          {actions}
        </div>
      )}
    </div>
  );
}

function SalesDashboard({
  state,
  onChange,
}: {
  state: SalesParams;
  onChange: (next: Partial<SalesParams>) => void;
}) {
  const { api } = useSession();
  const [reloadToken, setReloadToken] = useState(0);
  const query = toQuery(state);
  const data = useSalesData(api, query, state.compare, reloadToken);
  const [metric, setMetric] = useState<MetricKey>("afterDiscounts");
  const [split, setSplit] = useState<SplitBy>("none");

  // After a failed load, hide older data: it may belong to different filters.
  const current = data.status === "error" ? undefined : data.current;
  const previous = state.compare ? data.previous : undefined;
  // The group is a view over the loaded period, so switching never refetches.
  const group = groupChoices.find((item) => item.key === state.group);
  const groupedEntries = useMemo(
    () => (current ? inGroup(current.entries, state.group) : []),
    [current, state.group],
  );
  const entries = useMemo(
    () => inWarehouse(groupedEntries, state.warehouse),
    [groupedEntries, state.warehouse],
  );
  const previousEntries = useMemo(
    () =>
      previous
        ? inWarehouse(inGroup(previous.entries, state.group), state.warehouse)
        : undefined,
    [previous, state.group, state.warehouse],
  );
  const summary = useMemo(
    () => (current ? summarize(entries) : undefined),
    [current, entries],
  );
  const previousSummary = useMemo(
    () => (previousEntries ? summarize(previousEntries) : undefined),
    [previousEntries],
  );

  const loading = data.status === "loading";
  const rangeLabel =
    state.range === "custom"
      ? `${shortDate(state.from)} – ${longDate(state.to)}`
      : `${presets.find((preset) => preset.key === state.range)?.label} (${shortDate(state.from)} – ${longDate(state.to)})`;
  const truncated = [
    ...(current?.truncated ?? []),
    ...(previous?.truncated ?? []),
  ];
  const warehouseName =
    state.warehouse === "all"
      ? undefined
      : (groupedEntries.find(
          (entry) =>
            entry.warehouseId ===
            (state.warehouse === "none" ? null : state.warehouse),
        )?.warehouse ??
        (state.warehouse === "none"
          ? "Fără gestiune"
          : `Gestiunea ${state.warehouse}`));
  const file = `ags-${SALES_ENTITY}-${state.from}_${state.to}${group ? `-${group.slug}` : ""}${state.warehouse === "all" ? "" : `-depozit-${state.warehouse}`}`;
  const status =
    current && data.loadedAt
      ? `${plural(current.entries.length, "înregistrare", "înregistrări")} · încărcate la ${data.loadedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
      : undefined;

  return (
    <>
      <SalesHeading
        subtitle={`Registrul contabil Borg · ${entityLabels[SALES_ENTITY]} · ${rangeLabel}${group ? ` · ${group.label}` : ""}${warehouseName ? ` · ${warehouseName}` : ""}`}
        status={status}
        actions={<CurrencyControl />}
      />
      <QueryBar
        state={state}
        onChange={onChange}
        loading={loading}
        onReload={() => {
          clearSalesCache();
          setReloadToken((value) => value + 1);
        }}
      />

      {loading && data.progress && (
        <div
          className="progress"
          role="progressbar"
          aria-label="Se încarcă vânzările"
          aria-valuemin={0}
          aria-valuemax={data.progress.total}
          aria-valuenow={data.progress.done}
        >
          <span
            style={{
              width: `${Math.max(6, (data.progress.done / data.progress.total) * 100)}%`,
            }}
          />
        </div>
      )}

      {data.status === "error" && (
        <Alert
          tone="error"
          title="Vânzările nu au putut fi încărcate"
          action={
            <button
              className="button button-secondary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Încercați din nou
            </button>
          }
        >
          {data.error}
        </Alert>
      )}

      {truncated.length > 0 && (
        <Alert tone="warning" title="Unele rezultate pot fi incomplete">
          Borg a returnat numărul maxim de {number(ENTRY_LIMIT)} de înregistrări
          pentru{" "}
          {truncated
            .map((range) => `${shortDate(range.from)}–${shortDate(range.to)}`)
            .join(", ")}
          . Totalurile afișate sunt parțiale și nu acoperă întreaga perioadă.
          Alegeți un interval mai scurt pentru a vedea toate înregistrările.
        </Alert>
      )}

      {!current || !summary ? (
        data.status !== "error" && (
          <section className="panel panel-loading">
            <Spinner label="Se încarcă vânzările" />
            <p>
              Se încarcă vânzările din Borg
              {data.progress && data.progress.total > SALES_ACCOUNTS.length
                ? ` · ${data.progress.done} din ${plural(data.progress.total, "cerere", "cereri")}`
                : ""}
              …
            </p>
            {chunkRange(state).length > 3 && (
              <p className="muted">
                Intervalele lungi durează mai mult; Borg oferă cel mult 30 de
                zile per cerere.
              </p>
            )}
          </section>
        )
      ) : (
        <div
          className={`dashboard-body ${loading ? "is-stale" : ""}`}
          aria-busy={loading}
        >
          {!current.entries.length ? (
            <section className="panel">
              <EmptyState
                icon={CircleOff}
                title="Nicio vânzare în această perioadă"
              >
                Borg nu a returnat înregistrări de vânzare pentru{" "}
                {entityLabels[SALES_ENTITY]} în intervalul {rangeLabel}.
                Încercați alt interval.
              </EmptyState>
            </section>
          ) : (
            <>
              <GroupTabs
                entries={current.entries}
                value={state.group}
                onChange={(next) => onChange({ group: next, warehouse: "all" })}
              />
              <WarehousePicker
                entries={groupedEntries}
                value={state.warehouse}
                onChange={(warehouse) => onChange({ warehouse })}
              />
              {!entries.length ? (
                <section className="panel">
                  <EmptyState
                    icon={CircleOff}
                    title={
                      warehouseName
                        ? `Nicio vânzare în depozitul „${warehouseName}”`
                        : `Nicio vânzare în ${group ? `grupa „${group.label}”` : "depozitele selectate"}`
                    }
                    action={
                      <button
                        className="button button-secondary"
                        onClick={() =>
                          onChange({ group: "all", warehouse: "all" })
                        }
                      >
                        Afișați toate gestiunile
                      </button>
                    }
                  >
                    Gestiunile din această grupă nu au înregistrări de vânzare
                    în intervalul {rangeLabel}.
                  </EmptyState>
                </section>
              ) : (
                <>
                  <Kpis
                    current={summary}
                    previous={previousSummary}
                    incomplete={current.truncated.length > 0}
                    previousIncomplete={(previous?.truncated.length ?? 0) > 0}
                  />
                  {current.ignored > 0 && (
                    <p className="kpi-note">
                      {plural(current.ignored, "înregistrare", "înregistrări")}{" "}
                      pe conturile 707/709 nu{" "}
                      {current.ignored === 1 ? "este" : "sunt"} incluse în
                      totaluri: partea opusă a contului (de exemplu o închidere
                      de lună) sau date incomplete.
                    </p>
                  )}

                  <label className="inline-select measure-select">
                    <span>Măsură</span>
                    <select
                      className="control"
                      value={metric}
                      onChange={(event) =>
                        setMetric(event.target.value as MetricKey)
                      }
                    >
                      {metricOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <section className="panel" aria-labelledby="trend-title">
                    <div className="panel-heading">
                      <div>
                        <h2 id="trend-title">Evoluție</h2>
                        <p>
                          {
                            metricOptions.find(
                              (option) => option.key === metric,
                            )?.label
                          }
                          {split === "none" && state.compare
                            ? " comparativ cu perioada anterioară"
                            : ""}
                          {split !== "none"
                            ? `, primele 3 valori după ${splitOptions.find((option) => option.value === split)?.label.toLowerCase()}`
                            : ""}
                        </p>
                      </div>
                      <div className="panel-controls">
                        <label className="inline-select">
                          <span>Împarte după</span>
                          <select
                            className="control"
                            value={split}
                            onChange={(event) =>
                              setSplit(event.target.value as SplitBy)
                            }
                          >
                            {splitOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <TrendChart
                      entries={entries}
                      range={current.range}
                      metric={metric}
                      split={split}
                      previous={
                        previous && previousEntries
                          ? { entries: previousEntries, range: previous.range }
                          : undefined
                      }
                    />
                  </section>

                  <GestiuniPanel
                    entries={entries}
                    metric={metric}
                    filename={`${file}-pe-gestiuni.csv`}
                    selected={state.warehouse}
                    onSelect={(warehouse) => onChange({ warehouse })}
                  />
                  <ClientsPanel
                    entries={entries}
                    metric={metric}
                    incomplete={current.truncated.length > 0}
                    filename={file}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
