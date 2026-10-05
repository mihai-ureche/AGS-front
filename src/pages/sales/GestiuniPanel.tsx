import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "../../lib/csv";
import { useCurrency } from "../../lib/currency";
import { number, percent, plural } from "../../lib/format";
import {
  composition,
  groupEntries,
  metricOptions,
  OTHER_KEY,
  salesAfterDiscounts,
  summarize,
} from "../../lib/sales";
import type { MetricKey, SaleEntry, Share } from "../../lib/sales";
import { OTHER_COLOR, SERIES_COLORS } from "./TrendChart";

const ROWS = 8;

/** Sales grouped by gestiune: each one's share of the total, and its figures. */
export function GestiuniPanel({
  entries,
  metric,
  filename,
}: {
  entries: SaleEntry[];
  metric: MetricKey;
  filename: string;
}) {
  const { currency, convert, money } = useCurrency();
  const [hover, setHover] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const metricInfo = metricOptions.find((option) => option.key === metric)!;
  const format = (value: number) =>
    metricInfo.money ? money(value) : number(value);
  const data = useMemo(
    () => composition(entries, "warehouse", metric),
    [entries, metric],
  );
  const figures = useMemo(
    () =>
      new Map(
        groupEntries(entries, "warehouse", metric).map((group) => [
          group.key,
          group.metrics,
        ]),
      ),
    [entries, metric],
  );
  const totals = useMemo(() => summarize(entries), [entries]);

  const colorOf = (slot: number | null) =>
    slot === null ? OTHER_COLOR : SERIES_COLORS[slot]!;
  const nameOf = (share: Share) =>
    share.key === OTHER_KEY
      ? `Alte ${plural(data.folded, "gestiune", "gestiuni")}`
      : share.name;
  // The "other" segment stands for every gestiune without a slot.
  const highlighted = (row: Share) =>
    hover === row.key || (hover === OTHER_KEY && row.slot === null);
  const segmentLit = (segment: Share) =>
    !hover ||
    hover === segment.key ||
    (segment.key === OTHER_KEY &&
      data.rows.some((row) => row.key === hover && row.slot === null));
  const readout =
    data.segments.find((segment) => segment.key === hover) ??
    data.rows.find((row) => row.key === hover) ??
    data.rows[0];
  const rows = showAll ? data.rows : data.rows.slice(0, ROWS);

  function exportCsv() {
    const round = (value: number) => Math.round(value * 100) / 100;
    downloadCsv(filename, [
      [
        "Gestiune",
        "ID gestiune",
        `Vânzări (${currency})`,
        `Discounturi (${currency})`,
        `Vânzări după discounturi (${currency})`,
        "Documente",
        `Pondere din ${metricInfo.label.toLowerCase()} (%)`,
      ],
      ...data.rows.map((row) => {
        const metrics = figures.get(row.key)!;
        return [
          row.name,
          row.key.startsWith("id:") ? row.key.slice(3) : "",
          round(convert(metrics.sales)),
          round(convert(metrics.discounts)),
          round(convert(salesAfterDiscounts(metrics))),
          metrics.documents,
          row.share === null ? "" : round(row.share),
        ];
      }),
    ]);
  }

  return (
    <section className="panel" aria-labelledby="gestiuni-title">
      <div className="panel-heading">
        <div>
          <h2 id="gestiuni-title">Vânzări pe gestiuni</h2>
          <p>
            {metricInfo.label} · {format(data.total)} în total,{" "}
            {plural(data.rows.length, "gestiune", "gestiuni")}
          </p>
        </div>
        <div className="panel-controls">
          {readout && data.rows.length > 1 && (
            <p className="heatmap-readout" aria-live="polite">
              <span>
                {hover ? "" : "Cea mai mare · "}
                {nameOf(readout)}
              </span>
              <strong>
                {format(readout.value)} · {percent(readout.share)}
              </strong>
            </p>
          )}
          <button className="button button-secondary" onClick={exportCsv}>
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {data.rows.length > 1 &&
        (data.segments.length ? (
          <div
            className="share-strip"
            role="img"
            aria-label={`Ponderea gestiunilor: ${data.segments
              .map((segment) => `${nameOf(segment)} ${percent(segment.share)}`)
              .join(", ")}`}
            onPointerLeave={() => setHover(null)}
          >
            {data.segments.map((segment) => (
              <span
                key={segment.key}
                className={`share-segment ${segmentLit(segment) ? "" : "is-dimmed"}`}
                style={{
                  flexGrow: segment.value,
                  background: colorOf(segment.slot),
                }}
                onPointerEnter={() => setHover(segment.key)}
              />
            ))}
          </div>
        ) : (
          <p className="muted">
            Unele gestiuni au valori negative pentru această măsură, așa că nu
            pot fi afișate ca părți dintr-un întreg.
          </p>
        ))}

      <div className="table-scroll">
        <table className="data-table share-table">
          <thead>
            <tr>
              <th>Gestiune</th>
              <th className="num">Vânzări</th>
              <th className="num">Discounturi</th>
              <th className="num">După discounturi</th>
              <th className="num">Documente</th>
              <th className="num">Pondere</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const metrics = figures.get(row.key)!;
              return (
                <tr
                  key={row.key}
                  className={highlighted(row) ? "is-hover" : ""}
                  onPointerEnter={() => setHover(row.key)}
                  onPointerLeave={() => setHover(null)}
                >
                  <th scope="row">
                    <div className="group-cell">
                      <i
                        className="legend-swatch"
                        style={{ background: colorOf(row.slot) }}
                        aria-hidden="true"
                      />
                      <span className="group-name">{row.name}</span>
                    </div>
                  </th>
                  <td className={`num ${metrics.sales < 0 ? "negative" : ""}`}>
                    {money(metrics.sales)}
                  </td>
                  <td className="num">{money(metrics.discounts)}</td>
                  <td
                    className={`num ${salesAfterDiscounts(metrics) < 0 ? "negative" : ""}`}
                  >
                    {money(salesAfterDiscounts(metrics))}
                  </td>
                  <td className="num">{number(metrics.documents)}</td>
                  <td className="num">{percent(row.share)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <td className="num">{money(totals.sales)}</td>
              <td className="num">{money(totals.discounts)}</td>
              <td className="num">{money(salesAfterDiscounts(totals))}</td>
              <td className="num">{number(totals.documents)}</td>
              <td className="num">{data.total > 0 ? "100%" : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {data.rows.length > ROWS && (
        <div className="table-footer">
          <span className="muted">
            {showAll
              ? plural(data.rows.length, "gestiune", "gestiuni")
              : `Se afișează ${ROWS} din ${data.rows.length}`}
          </span>
          <button
            className="button button-secondary"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? "Afișează mai puține"
              : `Afișează toate cele ${plural(data.rows.length, "gestiune", "gestiuni")}`}
          </button>
        </div>
      )}
    </section>
  );
}
