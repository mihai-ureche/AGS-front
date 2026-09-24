import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  Filter,
} from "lucide-react";
import { downloadCsv } from "../../lib/csv";
import { useCurrency } from "../../lib/currency";
import { number, percent, plural } from "../../lib/format";
import {
  dimensions,
  groupableDimensions,
  groupLines,
  marginPct,
  metricOptions,
  metricValue,
} from "../../lib/sales";
import type {
  Dimension,
  Group,
  Metrics,
  MetricKey,
  SaleLine,
} from "../../lib/sales";

type Column = {
  key: string;
  label: string;
  value: (metrics: Metrics) => number | null;
  kind: "money" | "number" | "percent" | "share";
};
const columns: Column[] = [
  { key: "net", label: "Vânzări nete", value: (m) => m.net, kind: "money" },
  { key: "share", label: "Pondere", value: (m) => m.net, kind: "share" },
  {
    key: "quantity",
    label: "Cantitate",
    value: (m) => m.quantity,
    kind: "number",
  },
  {
    key: "documents",
    label: "Documente",
    value: (m) => m.documents,
    kind: "number",
  },
  { key: "margin", label: "Marjă", value: (m) => m.margin, kind: "money" },
  { key: "marginPct", label: "Marjă %", value: marginPct, kind: "percent" },
];

function formatCell(
  column: Column,
  value: number | null,
  money: (lei: number) => string,
) {
  switch (column.kind) {
    case "money":
      return money(value ?? 0);
    case "number":
      return number(value ?? 0);
    case "percent":
      return percent(value);
    case "share":
      return "";
  }
}

type Sort = { key: string; direction: "asc" | "desc" } | null;
const PAGE = 25;

function sortGroups(groups: Group[], sort: Sort): Group[] {
  if (!sort) return groups;
  const column = columns.find((item) => item.key === sort.key)!;
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...groups]
    .sort(
      (a, b) =>
        sign *
        ((column.value(a.metrics) ?? -Infinity) -
          (column.value(b.metrics) ?? -Infinity)),
    )
    .map((group) =>
      group.children
        ? { ...group, children: sortGroups(group.children, sort) }
        : group,
    );
}

export function Breakdown({
  lines,
  metric,
  dimension,
  thenBy,
  onDimension,
  onThenBy,
  onFocus,
  total,
  filename,
}: {
  lines: SaleLine[];
  metric: MetricKey;
  dimension: Dimension;
  thenBy: Dimension | "none";
  onDimension: (dimension: Dimension) => void;
  onThenBy: (dimension: Dimension | "none") => void;
  /** Narrows the refine filters to one value, e.g. a single client. */
  onFocus: (dimension: Dimension, key: string) => void;
  total: Metrics;
  filename: string;
}) {
  const { currency, convert, money } = useCurrency();
  const [sort, setSort] = useState<Sort>(null);
  const [limit, setLimit] = useState(PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const metricInfo = metricOptions.find((option) => option.key === metric)!;
  const format = (value: number) =>
    metricInfo.money ? money(value) : number(value);
  const focusable = (item: Dimension) => dimensions[item].filterable;

  const groups = useMemo(
    () =>
      groupLines(
        lines,
        dimension,
        metric,
        thenBy === "none" ? undefined : thenBy,
      ),
    [lines, dimension, metric, thenBy],
  );
  const sorted = useMemo(() => sortGroups(groups, sort), [groups, sort]);

  // Bars rank by the chart metric; time dimensions keep calendar order and
  // skip the bars when too long to read (the trend chart covers them).
  const bars = dimensions[dimension].ordered
    ? groups.length <= 31
      ? groups
      : []
    : [...groups]
        .sort(
          (a, b) =>
            metricValue(b.metrics, metric) - metricValue(a.metrics, metric),
        )
        .slice(0, 10);
  const maxBar = Math.max(
    0,
    ...bars.map((group) => metricValue(group.metrics, metric)),
  );
  const hasNegative = bars.some(
    (group) => metricValue(group.metrics, metric) < 0,
  );

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key !== key
        ? { key, direction: "desc" }
        : current.direction === "desc"
          ? { key, direction: "asc" }
          : null,
    );
  }

  function exportCsv() {
    const header = [
      dimensions[dimension].label,
      ...(thenBy === "none" ? [] : [dimensions[thenBy].label]),
      `Vânzări nete (${currency})`,
      `TVA (${currency})`,
      `Vânzări brute (${currency})`,
      "Cantitate",
      "Documente",
      "Linii",
      `Marjă (${currency})`,
      "Marjă %",
    ];
    const row = (metrics: Metrics) => [
      convert(metrics.net),
      convert(metrics.vat),
      convert(metrics.gross),
      metrics.quantity,
      metrics.documents,
      metrics.lines,
      convert(metrics.margin),
      marginPct(metrics),
    ];
    const rows = sorted.flatMap((group) =>
      thenBy === "none" || !group.children
        ? [[group.name, ...row(group.metrics)]]
        : group.children.map((child) => [
            group.name,
            child.name,
            ...row(child.metrics),
          ]),
    );
    downloadCsv(filename, [
      header,
      ...rows.map((cells) =>
        cells.map((cell) =>
          typeof cell === "number" ? Math.round(cell * 100) / 100 : cell,
        ),
      ),
    ]);
  }

  return (
    <section className="panel" aria-labelledby="breakdown-title">
      <div className="panel-heading">
        <div>
          <h2 id="breakdown-title">Defalcare</h2>
          <p>
            {metricInfo.label} după {dimensions[dimension].label.toLowerCase()}
            {thenBy !== "none" &&
              `, apoi după ${dimensions[thenBy].label.toLowerCase()}`}
          </p>
        </div>
        <div className="panel-controls">
          <label className="inline-select">
            <span>Grupează după</span>
            <select
              className="control"
              value={dimension}
              onChange={(event) => {
                onDimension(event.target.value as Dimension);
                setLimit(PAGE);
                setExpanded(new Set());
              }}
            >
              {groupableDimensions.map((item) => (
                <option key={item} value={item}>
                  {dimensions[item].label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-select">
            <span>apoi după</span>
            <select
              className="control"
              value={thenBy}
              onChange={(event) => {
                onThenBy(event.target.value as Dimension | "none");
                setExpanded(new Set());
              }}
            >
              <option value="none">—</option>
              {groupableDimensions
                .filter((item) => item !== dimension)
                .map((item) => (
                  <option key={item} value={item}>
                    {dimensions[item].label}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            onClick={exportCsv}
            disabled={!groups.length}
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {bars.length > 0 && (
        <ol
          className="bar-list"
          aria-label={`${metricInfo.label} după ${dimensions[dimension].label.toLowerCase()}${dimensions[dimension].ordered ? "" : ", primele 10"}`}
        >
          {bars.map((group) => {
            const value = metricValue(group.metrics, metric);
            const width = maxBar > 0 ? Math.max(0, (value / maxBar) * 100) : 0;
            return (
              <li key={group.key} title={`${group.name}: ${format(value)}`}>
                <span className="bar-label">{group.name}</span>
                <span className="bar-track">
                  <span
                    className={`bar-fill ${value < 0 ? "is-negative" : ""}`}
                    style={{
                      width: `${hasNegative && value < 0 ? 2 : width}%`,
                    }}
                  />
                  <span className="bar-value">{format(value)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="table-scroll">
        <table className="data-table group-table">
          <thead>
            <tr>
              <th>{dimensions[dimension].label}</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="num"
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <button
                    className="sort-button"
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.label}
                    {sort?.key === column.key &&
                      (sort.direction === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((group) => {
              const open = expanded.has(group.key);
              return (
                <Fragment key={group.key}>
                  <GroupRow
                    group={group}
                    total={total}
                    money={money}
                    expandable={Boolean(group.children?.length)}
                    open={open}
                    onToggle={() => {
                      const next = new Set(expanded);
                      if (open) next.delete(group.key);
                      else next.add(group.key);
                      setExpanded(next);
                    }}
                    onFocus={
                      focusable(dimension)
                        ? () => onFocus(dimension, group.key)
                        : undefined
                    }
                  />
                  {open &&
                    thenBy !== "none" &&
                    group.children?.map((child) => (
                      <GroupRow
                        key={child.key}
                        group={child}
                        total={total}
                        money={money}
                        nested
                        onFocus={
                          focusable(thenBy)
                            ? () => onFocus(thenBy, child.key)
                            : undefined
                        }
                      />
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Total · {plural(groups.length, "grup", "grupuri")}</th>
              {columns.map((column) => (
                <td key={column.key} className="num">
                  {column.kind === "share"
                    ? "100%"
                    : formatCell(column, column.value(total), money)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="table-footer">
          <span className="muted">
            Se afișează {limit} din {number(sorted.length)}
          </span>
          <button
            className="button button-secondary"
            onClick={() => setLimit(limit + PAGE * 4)}
          >
            Afișează mai multe
          </button>
        </div>
      )}
    </section>
  );
}

function GroupRow({
  group,
  total,
  money,
  expandable = false,
  open = false,
  nested = false,
  onToggle,
  onFocus,
}: {
  group: Group;
  total: Metrics;
  money: (lei: number) => string;
  expandable?: boolean;
  open?: boolean;
  nested?: boolean;
  onToggle?: () => void;
  onFocus?: () => void;
}) {
  const share = total.net ? (group.metrics.net / total.net) * 100 : null;
  return (
    <tr className={nested ? "nested-row" : ""}>
      <th scope="row">
        <div className="group-cell">
          {expandable ? (
            <button
              className="expand-button"
              aria-expanded={open}
              onClick={onToggle}
            >
              <ChevronRight size={14} className={open ? "rotate-90" : ""} />
              <span>{group.name}</span>
            </button>
          ) : (
            <span className="group-name">{group.name}</span>
          )}
          {onFocus && (
            <button
              className="icon-button focus-button"
              aria-label={`Afișează doar ${group.name}`}
              title="Afișează doar această valoare"
              onClick={onFocus}
            >
              <Filter size={13} />
            </button>
          )}
        </div>
      </th>
      {columns.map((column) =>
        column.kind === "share" ? (
          <td key={column.key} className="num">
            <span className="share-cell">
              <span className="share-track" aria-hidden="true">
                <span
                  className="share-bar"
                  style={{
                    width: `${Math.max(0, Math.min(100, share ?? 0))}%`,
                  }}
                />
              </span>
              <span className="share-value">{percent(share)}</span>
            </span>
          </td>
        ) : (
          <td
            key={column.key}
            className={`num ${(column.value(group.metrics) ?? 0) < 0 ? "negative" : ""}`}
          >
            {formatCell(column, column.value(group.metrics), money)}
          </td>
        ),
      )}
    </tr>
  );
}
