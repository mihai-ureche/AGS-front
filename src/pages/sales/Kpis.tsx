import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
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
import {
  averageDocument,
  costCoverage,
  discountPct,
  marginPct,
  salesAfterDiscounts,
  signedReversals,
} from "../../lib/sales";
import type { Metrics } from "../../lib/sales";

type Tile = {
  label: string;
  value: string;
  detail?: ReactNode;
  current: number;
  previous?: number;
  /** Whether a rising value is good news. */
  upIsGood?: boolean;
  tone?: "warning";
};

export function Kpis({
  current,
  previous,
  incomplete = false,
  previousIncomplete = false,
  discountsShown = false,
  onShowDiscounts,
}: {
  current: Metrics;
  previous?: Metrics;
  /** Borg truncated the current period: totals are partial. */
  incomplete?: boolean;
  previousIncomplete?: boolean;
  /** The discount lines filter is on. */
  discountsShown?: boolean;
  onShowDiscounts: () => void;
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
  const coverage = costCoverage(current);
  const hasOther = current.specialLines > 0 || current.unclassifiedLines > 0;

  const tiles: Tile[] = [];
  if (current.specialLines || previous?.specialLines) {
    tiles.push({
      label: "Servicii / speciale",
      value: money(current.special),
      detail: `${plural(current.specialLines, "linie", "linii")} · separat de vânzările de produse`,
      current: current.special,
      previous: before?.special,
    });
  }
  if (current.unclassifiedLines || previous?.unclassifiedLines) {
    tiles.push({
      label: "Neclasificate",
      value: money(current.unclassified),
      detail: `${plural(current.unclassifiedLines, "linie", "linii")} fără tip de valoare cunoscut`,
      current: current.unclassified,
      previous: before?.unclassified,
      tone: "warning",
    });
  }
  tiles.push(
    {
      label: "Marjă brută",
      value: money(current.margin),
      detail: `${percent(marginPct(current))} din net${coverage < 99.5 ? ` · cost cunoscut pentru ${percent(coverage, 0)} din vânzări` : ""}`,
      current: current.margin,
      previous: before?.margin,
    },
    {
      label: "Documente",
      value: number(current.documents),
      detail: plural(current.lines, "linie", "linii"),
      current: current.documents,
      previous: before?.documents,
    },
    {
      label: "Valoare medie document",
      value: money(averageDocument(current)),
      detail: "Valoare netă per bon sau aviz",
      current: averageDocument(current),
      previous: before ? averageDocument(before) : undefined,
    },
    {
      label: "Retururi",
      value: money(current.returns),
      detail: plural(current.returnLines, "linie de retur", "linii de retur"),
      // Compare magnitudes: more returned value is worse.
      current: Math.abs(current.returns),
      previous: before ? Math.abs(before.returns) : undefined,
      upIsGood: false,
    },
  );

  return (
    <div className="kpis">
      <div
        className="kpi-lead-row"
        role="group"
        aria-label="Vânzări de produse și discounturi"
      >
        <article className="kpi kpi-lead kpi-sales">
          <span className="kpi-label">Vânzări produse {partial}</span>
          <strong className="kpi-value">{money(current.productSales)}</strong>
          {comparison((metrics) => metrics.productSales)}
          <span className="kpi-detail">
            Net, fără TVA · include retururile de {money(current.returns)}
          </span>
        </article>

        <article
          className={`kpi kpi-lead kpi-discount ${discountsShown ? "is-active" : ""}`}
        >
          <span className="kpi-label">
            <BadgePercent size={16} aria-hidden="true" /> Discounturi {partial}
          </span>
          <strong className="kpi-value">{money(current.discounts)}</strong>
          <span className="kpi-share">
            {pct === null
              ? "Procent indisponibil fără vânzări de produse"
              : `${percent(pct)} din vânzările de produse`}
          </span>
          {comparison((metrics) => metrics.discounts, false)}
          <dl className="kpi-split">
            <div>
              <dt>Acordate</dt>
              <dd>{money(current.discountsGranted)}</dd>
            </div>
            <div>
              <dt>Stornate</dt>
              <dd>{money(signedReversals(current))}</dd>
            </div>
          </dl>
          <span className="kpi-detail">
            Net, fără TVA ·{" "}
            {plural(current.discountTransactions, "tranzacție", "tranzacții")}.
            Discounturi comerciale separate. Reducerile incluse în prețul
            produselor nu se scad din nou.
          </span>
          <button
            type="button"
            className="kpi-action"
            aria-pressed={discountsShown}
            onClick={onShowDiscounts}
          >
            {discountsShown
              ? "Afișați toate liniile"
              : "Vedeți liniile de discount"}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </article>

        <article className="kpi kpi-lead kpi-after">
          <span className="kpi-label">Vânzări după discounturi {partial}</span>
          <strong className="kpi-value">
            {money(salesAfterDiscounts(current))}
          </strong>
          {comparison(salesAfterDiscounts)}
          <span className="kpi-detail">
            Vânzări produse − discounturi, fără TVA
            {hasOther &&
              ` · cu servicii și neclasificate, valoarea netă este ${money(current.net)}`}
          </span>
        </article>
      </div>

      <div className="kpi-row">
        {tiles.map((tile) => (
          <article
            key={tile.label}
            className={`kpi ${tile.tone === "warning" ? "kpi-warning" : ""}`}
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
