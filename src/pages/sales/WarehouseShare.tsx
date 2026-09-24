import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { useCurrency } from "../../lib/currency";
import { number, percent, plural } from "../../lib/format";
import {
  composition,
  dimensions,
  metricOptions,
  OTHER_KEY,
} from "../../lib/sales";
import type { Dimension, MetricKey, SaleLine, Share } from "../../lib/sales";
import { OTHER_COLOR, SERIES_COLORS } from "./TrendChart";

const ROWS = 8;

/** Part-to-whole: how much of the total each gestiune contributes. */
export function WarehouseShare({
  lines,
  paletteLines,
  metric,
  onFocus,
}: {
  lines: SaleLine[];
  /** Unrefined lines: the top gestiuni (and so their colors) stay put while refining. */
  paletteLines: SaleLine[];
  metric: MetricKey;
  onFocus: (dimension: Dimension, key: string) => void;
}) {
  const { money } = useCurrency();
  const [hover, setHover] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const metricInfo = metricOptions.find((option) => option.key === metric)!;
  const format = (value: number) =>
    metricInfo.money ? money(value) : number(value);
  const data = useMemo(
    () => composition(lines, "warehouse", metric, paletteLines),
    [lines, metric, paletteLines],
  );
  const gestiuni = useMemo(
    () => new Set(paletteLines.map(dimensions.warehouse.key)).size,
    [paletteLines],
  );

  // A single gestiune is all of the total; there is nothing to compare.
  if (gestiuni < 2) return null;

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

  return (
    <section className="panel" aria-labelledby="warehouse-title">
      <div className="panel-heading">
        <div>
          <h2 id="warehouse-title">Pondere pe gestiuni</h2>
          <p>
            {metricInfo.label} · {format(data.total)} în total,{" "}
            {plural(data.rows.length, "gestiune", "gestiuni")}
          </p>
        </div>
        {readout && (
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
      </div>

      {data.segments.length ? (
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
          Unele gestiuni au valori negative pentru această măsură, așa că nu pot
          fi afișate ca părți dintr-un întreg.
        </p>
      )}

      <div className="table-scroll">
        <table className="data-table share-table">
          <thead>
            <tr>
              <th>Gestiune</th>
              <th className="num">{metricInfo.label}</th>
              <th className="num">Pondere</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={highlighted(row) ? "is-hover" : ""}
                onPointerEnter={() => setHover(row.key)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(row.key)}
                onBlur={() => setHover(null)}
              >
                <th scope="row">
                  <div className="group-cell">
                    <i
                      className="legend-swatch"
                      style={{ background: colorOf(row.slot) }}
                      aria-hidden="true"
                    />
                    <span className="group-name">{row.name}</span>
                    <button
                      className="icon-button focus-button"
                      aria-label={`Afișează doar ${row.name}`}
                      title="Afișează doar această gestiune"
                      onClick={() => onFocus("warehouse", row.key)}
                    >
                      <Filter size={13} />
                    </button>
                  </div>
                </th>
                <td className={`num ${row.value < 0 ? "negative" : ""}`}>
                  {format(row.value)}
                </td>
                <td className="num">{percent(row.share)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <td className="num">{format(data.total)}</td>
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
