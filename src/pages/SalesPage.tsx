import { useMemo, useState } from "react";
import { CircleOff, KeyRound, SearchX } from "lucide-react";
import { useSession } from "../auth/AuthProvider";
import { Alert, EmptyState, Spinner } from "../components/ui";
import { chunkRange, presets } from "../lib/dates";
import { longDate, number, shortDate } from "../lib/format";
import { entityLabels } from "../lib/labels";
import { useRoute } from "../lib/route";
import {
  emptyRefine,
  metricOptions,
  refineLines,
  summarize,
} from "../lib/sales";
import type { Dimension, MetricKey, Refine } from "../lib/sales";
import { Breakdown } from "./sales/Breakdown";
import { Heatmap } from "./sales/Heatmap";
import { Kpis } from "./sales/Kpis";
import { LinesTable } from "./sales/LinesTable";
import { readParams, toQuery, writeParams } from "./sales/params";
import type { SalesParams } from "./sales/params";
import { QueryBar } from "./sales/QueryBar";
import { RefineBar } from "./sales/RefineBar";
import { splitOptions, TrendChart } from "./sales/TrendChart";
import type { SplitBy } from "./sales/TrendChart";
import {
  clearSalesCache,
  LINE_LIMIT,
  useSalesData,
} from "./sales/useSalesData";

export function SalesPage() {
  const { me, profile, can } = useSession();
  const { params, navigate } = useRoute();
  const state = readParams(params, me.targetEntities);

  if (!state) {
    return (
      <>
        <SalesHeading />
        <section className="panel">
          <EmptyState
            icon={KeyRound}
            title="No entities are assigned to your account"
            action={
              can("users:roles:update") ? (
                <button
                  className="button button-primary"
                  onClick={() => navigate("users", { user: profile.id })}
                >
                  Grant yourself entity access
                </button>
              ) : undefined
            }
          >
            Sales data is only shown for entities an administrator has granted
            to you, even for administrators.
          </EmptyState>
        </section>
      </>
    );
  }
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
}: {
  subtitle?: string;
  status?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>Sales</h1>
        <p>
          {subtitle ??
            "Product lines from Borg: receipts (BFD) and delivery notes (AIM)."}
        </p>
      </div>
      {status && <p className="page-status">{status}</p>}
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
  const { me, api } = useSession();
  const [reloadToken, setReloadToken] = useState(0);
  const query = toQuery(state);
  const data = useSalesData(api, query, state.compare, reloadToken);
  const [refineState, setRefineState] = useState<{
    entity: string;
    refine: Refine;
  }>({ entity: state.entity, refine: emptyRefine });
  // Refinements name warehouses and categories of one entity; reset them when it changes.
  const refine =
    refineState.entity === state.entity ? refineState.refine : emptyRefine;
  const setRefine = (next: Refine) =>
    setRefineState({ entity: state.entity, refine: next });
  const [metric, setMetric] = useState<MetricKey>("net");
  const [split, setSplit] = useState<SplitBy>("none");
  const [dimension, setDimension] = useState<Dimension>("category");
  const [thenBy, setThenBy] = useState<Dimension | "none">("none");

  // After a failed load, hide older data: it may belong to different filters.
  const current = data.status === "error" ? undefined : data.current;
  const previous = state.compare ? data.previous : undefined;
  const lines = useMemo(
    () => (current ? refineLines(current.lines, refine) : []),
    [current, refine],
  );
  const previousLines = useMemo(
    () => (previous ? refineLines(previous.lines, refine) : undefined),
    [previous, refine],
  );
  const totals = useMemo(() => summarize(lines), [lines]);
  const previousTotals = useMemo(
    () => (previousLines ? summarize(previousLines) : undefined),
    [previousLines],
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
  const file = `ags-${state.entity}-${state.from}_${state.to}`;
  const status =
    current && data.loadedAt
      ? `${number(current.lines.length)} lines · loaded ${data.loadedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : undefined;

  return (
    <>
      <SalesHeading
        subtitle={`${entityLabels[state.entity]} · ${rangeLabel}`}
        status={status}
      />
      <QueryBar
        state={state}
        entities={me.targetEntities}
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
          aria-label="Loading sales"
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
          title="Sales could not be loaded"
          action={
            <button
              className="button button-secondary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Try again
            </button>
          }
        >
          {data.error}
        </Alert>
      )}

      {truncated.length > 0 && (
        <Alert tone="warning" title="Some results may be incomplete">
          Borg returned the maximum of {number(LINE_LIMIT)} lines for{" "}
          {truncated
            .map((range) => `${shortDate(range.from)}–${shortDate(range.to)}`)
            .join(", ")}
          . Choose a shorter range or a document type to see every line.
        </Alert>
      )}

      {!current ? (
        data.status !== "error" && (
          <section className="panel panel-loading">
            <Spinner label="Loading sales" />
            <p>
              Loading sales from Borg
              {data.progress && data.progress.total > 1
                ? ` · ${data.progress.done} of ${data.progress.total} requests`
                : ""}
              …
            </p>
            {chunkRange(state).length > 3 && (
              <p className="muted">
                Long ranges take a while; Borg serves at most 30 days per
                request.
              </p>
            )}
          </section>
        )
      ) : (
        <>
          <div className="refine-header">
            <RefineBar
              lines={current.lines}
              refine={refine}
              onChange={setRefine}
            />
            <label className="inline-select">
              <span>Measure</span>
              <select
                className="control"
                value={metric}
                onChange={(event) => setMetric(event.target.value as MetricKey)}
              >
                {metricOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            className={`dashboard-body ${loading ? "is-stale" : ""}`}
            aria-busy={loading}
          >
            {!current.lines.length ? (
              <section className="panel">
                <EmptyState icon={CircleOff} title="No sales in this period">
                  Borg returned no product lines for{" "}
                  {entityLabels[state.entity]} in {rangeLabel.toLowerCase()}.
                  Try a different range, document type or options.
                </EmptyState>
              </section>
            ) : !lines.length ? (
              <section className="panel">
                <EmptyState
                  icon={SearchX}
                  title="No lines match these filters"
                  action={
                    <button
                      className="button button-secondary"
                      onClick={() => setRefine(emptyRefine)}
                    >
                      Clear filters
                    </button>
                  }
                >
                  {number(current.lines.length)} lines are loaded; the search or
                  filters exclude all of them.
                </EmptyState>
              </section>
            ) : (
              <>
                <Kpis current={totals} previous={previousTotals} />

                <section className="panel" aria-labelledby="trend-title">
                  <div className="panel-heading">
                    <div>
                      <h2 id="trend-title">Trend</h2>
                      <p>
                        {
                          metricOptions.find((option) => option.key === metric)
                            ?.label
                        }
                        {split === "none" && state.compare
                          ? " compared with the previous period"
                          : ""}
                        {split !== "none"
                          ? `, top 3 ${splitOptions.find((option) => option.value === split)?.label.toLowerCase()} values`
                          : ""}
                      </p>
                    </div>
                    <div className="panel-controls">
                      <label className="inline-select">
                        <span>Split</span>
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
                    lines={lines}
                    paletteLines={current.lines}
                    range={current.range}
                    metric={metric}
                    split={split}
                    previous={
                      previous && previousLines
                        ? { lines: previousLines, range: previous.range }
                        : undefined
                    }
                  />
                </section>

                <Breakdown
                  lines={lines}
                  metric={metric}
                  dimension={dimension}
                  thenBy={thenBy}
                  onDimension={(next) => {
                    setDimension(next);
                    if (thenBy === next) setThenBy("none");
                  }}
                  onThenBy={setThenBy}
                  total={totals}
                  filename={`${file}-by-${dimension}${thenBy === "none" ? "" : `-${thenBy}`}.csv`}
                />

                <Heatmap lines={lines} metric={metric} />

                <LinesTable lines={lines} filename={`${file}-lines.csv`} />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
