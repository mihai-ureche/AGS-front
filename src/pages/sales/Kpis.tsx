import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgePercent,
  Minus,
} from "lucide-react";
import { Badge } from "../../components/ui";
import { useCurrency } from "../../lib/currency";
import {
  change,
  number,
  percent,
  plural,
  signedPercent,
} from "../../lib/format";
import { discountPct, salesAfterDiscounts } from "../../lib/sales";
import type { Metrics } from "../../lib/sales";

type Tile = {
  label: string;
  value: string;
  detail?: ReactNode;
  current: number;
  previous?: number;
  /** Whether a rising value is good news. */
  upIsGood?: boolean;
};

export function Kpis({
  current,
  previous,
  incomplete = false,
  previousIncomplete = false,
}: {
  current: Metrics;
  previous?: Metrics;
  /** Borg truncated the current period: totals are partial. */
  incomplete?: boolean;
  previousIncomplete?: boolean;
}) {
  const { money } = useCurrency();
  // A partial period can't be compared as if it were complete.
  const before = incomplete || previousIncomplete ? undefined : previous;
  const comparison = (value: (metrics: Metrics) => number, upIsGood = true) =>
    before ? (
      <Delta
        current={value(current)}
        previous={value(before)}
        upIsGood={upIsGood}
      />
    ) : (
      previous && (
        <span className="delta">Comparație indisponibilă: date incomplete</span>
      )
    );
  const partial = incomplete && (
    <Badge tone="warning">
      <span title="Borg a limitat rezultatele; totalul nu acoperă întreaga perioadă">
        Parțial
      </span>
    </Badge>
  );
  const pct = discountPct(current);

  const tiles: Tile[] = [
    {
      label: "Documente",
      value: number(current.documents),
      detail: plural(current.entries, "înregistrare", "înregistrări"),
      current: current.documents,
      previous: before?.documents,
    },
    {
      label: "Stornări",
      value: money(current.returns),
      detail: plural(
        current.returnEntries,
        "înregistrare de stornare",
        "înregistrări de stornare",
      ),
      // Compare magnitudes: more reversed value is worse.
      current: Math.abs(current.returns),
      previous: before ? Math.abs(before.returns) : undefined,
      upIsGood: false,
    },
  ];

  return (
    <div className="kpis">
      <div
        className="kpi-lead-row"
        role="group"
        aria-label="Vânzări și discounturi"
      >
        <article className="kpi kpi-lead kpi-sales">
          <span className="kpi-label">Vânzări {partial}</span>
          <strong className="kpi-value">{money(current.sales)}</strong>
          {comparison((metrics) => metrics.sales)}
          <span className="kpi-detail">
            Net, fără TVA · include stornările de {money(current.returns)}
          </span>
        </article>

        <article className="kpi kpi-lead kpi-discount">
          <span className="kpi-label">
            <BadgePercent size={16} aria-hidden="true" /> Discounturi {partial}
          </span>
          <strong className="kpi-value">{money(current.discounts)}</strong>
          <span className="kpi-share">
            {pct === null
              ? "Procent indisponibil fără vânzări"
              : `${percent(pct)} din vânzări`}
          </span>
          {comparison((metrics) => metrics.discounts, false)}
          <span className="kpi-detail">
            Net, fără TVA · discounturi acordate minus cele stornate
          </span>
        </article>

        <article className="kpi kpi-lead kpi-after">
          <span className="kpi-label">Vânzări după discounturi {partial}</span>
          <strong className="kpi-value">
            {money(salesAfterDiscounts(current))}
          </strong>
          {comparison(salesAfterDiscounts)}
          <span className="kpi-detail">Vânzări − discounturi, fără TVA</span>
        </article>
      </div>

      <div className="kpi-row">
        {tiles.map((tile) => (
          <article key={tile.label} className="kpi">
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
