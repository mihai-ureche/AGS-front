import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useCurrency } from "../../lib/currency";
import {
  change,
  number,
  percent,
  plural,
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
  const { money } = useCurrency();
  const coverage = costCoverage(current);
  const tiles: Tile[] = [
    {
      label: "Vânzări nete",
      value: money(current.net),
      detail: `${money(current.gross)} cu TVA`,
      current: current.net,
      previous: previous?.net,
      hero: true,
    },
    {
      label: "Marjă brută",
      value: money(current.margin),
      detail: `${percent(marginPct(current))} din net${coverage < 99.5 ? ` · cost cunoscut pentru ${percent(coverage, 0)} din vânzări` : ""}`,
      current: current.margin,
      previous: previous?.margin,
    },
    {
      label: "Documente",
      value: number(current.documents),
      detail: plural(current.lines, "linie de produs", "linii de produs"),
      current: current.documents,
      previous: previous?.documents,
    },
    {
      label: "Valoare medie document",
      value: money(averageDocument(current)),
      detail: "Vânzări nete per bon sau aviz",
      current: averageDocument(current),
      previous: previous ? averageDocument(previous) : undefined,
    },
    {
      label: "Retururi",
      value: money(current.returns),
      detail: plural(current.returnLines, "linie de retur", "linii de retur"),
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
    return <span className="delta">Fără date în perioada anterioară</span>;
  const flat = Math.abs(delta) < 0.05;
  const good = flat ? null : delta > 0 === upIsGood;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`delta ${good === null ? "" : good ? "delta-good" : "delta-bad"}`}
    >
      <Icon size={14} aria-hidden="true" />
      <strong>{signedPercent(delta)}</strong> față de perioada anterioară
    </span>
  );
}
