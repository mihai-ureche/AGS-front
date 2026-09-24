import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  change,
  money,
  number,
  percent,
  signedPercent,
} from "../../lib/format";
import { averageDocument, costCoverage, marginPct } from "../../lib/sales";
import type { Metrics } from "../../lib/sales";

type Tile = {
  label: string;
  value: string;
  detail?: string;
  current: number;
  previous?: number;
  /** Whether a rising value is good news. */
  upIsGood?: boolean;
  hero?: boolean;
};

export function Kpis({
  current,
  previous,
}: {
  current: Metrics;
  previous?: Metrics;
}) {
  const coverage = costCoverage(current);
  const tiles: Tile[] = [
    {
      label: "Net sales",
      value: money(current.net),
      detail: `${money(current.gross)} incl. VAT`,
      current: current.net,
      previous: previous?.net,
      hero: true,
    },
    {
      label: "Gross margin",
      value: money(current.margin),
      detail: `${percent(marginPct(current))} of net${coverage < 99.5 ? ` · cost known for ${percent(coverage, 0)} of sales` : ""}`,
      current: current.margin,
      previous: previous?.margin,
    },
    {
      label: "Documents",
      value: number(current.documents),
      detail: `${number(current.lines)} product lines`,
      current: current.documents,
      previous: previous?.documents,
    },
    {
      label: "Average document",
      value: money(averageDocument(current)),
      detail: "Net sales per receipt or delivery note",
      current: averageDocument(current),
      previous: previous ? averageDocument(previous) : undefined,
    },
    {
      label: "Returns",
      value: money(current.returns),
      detail: `${number(current.returnLines)} return lines`,
      // Compare magnitudes: more returned value is worse.
      current: Math.abs(current.returns),
      previous: previous ? Math.abs(previous.returns) : undefined,
      upIsGood: false,
    },
  ];
  return (
    <div className="kpi-row">
      {tiles.map((tile) => (
        <article
          key={tile.label}
          className={`kpi ${tile.hero ? "kpi-hero" : ""}`}
        >
          <span className="kpi-label">{tile.label}</span>
          <strong className="kpi-value">{tile.value}</strong>
          {tile.previous !== undefined && (
            <Delta
              current={tile.current}
              previous={tile.previous}
              upIsGood={tile.upIsGood ?? true}
            />
          )}
          {tile.detail && <span className="kpi-detail">{tile.detail}</span>}
        </article>
      ))}
    </div>
  );
}

function Delta({
  current,
  previous,
  upIsGood,
}: {
  current: number;
  previous: number;
  upIsGood: boolean;
}) {
  const delta = change(current, previous);
  if (delta === null)
    return <span className="delta">No data in previous period</span>;
  const flat = Math.abs(delta) < 0.05;
  const good = flat ? null : delta > 0 === upIsGood;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`delta ${good === null ? "" : good ? "delta-good" : "delta-bad"}`}
    >
      <Icon size={14} aria-hidden="true" />
      <strong>{signedPercent(delta)}</strong> vs previous period
    </span>
  );
}
