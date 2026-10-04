import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { Badge } from "../../components/ui";
import { downloadCsv } from "../../lib/csv";
import { useCurrency } from "../../lib/currency";
import { number, plural, shortDate } from "../../lib/format";
import {
  documentLabel,
  isReturn,
  lineLabel,
  signedReversals,
  summarize,
} from "../../lib/sales";
import type { SaleLine } from "../../lib/sales";

type SortKey = "date" | "net" | "quantity" | "margin" | "product";
const PAGE_SIZE = 25;

function KindBadge({ line }: { line: SaleLine }) {
  const tone =
    line.kind === "discount"
      ? line.net < 0 && !line.discountInLines
        ? "discount"
        : line.net > 0
          ? "accent"
          : "neutral"
      : line.kind === "unclassified"
        ? "warning"
        : "neutral";
  return <Badge tone={tone}>{lineLabel(line)}</Badge>;
}

const yesNo = (value: boolean | null) =>
  value === null ? null : value ? "da" : "nu";

export function LinesTable({
  lines,
  filename,
  discounts = false,
}: {
  lines: SaleLine[];
  filename: string;
  /** Every line is a discount: show the discount columns. */
  discounts?: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>(
    { key: "date", direction: "desc" },
  );
  const [page, setPage] = useState(0);
  const { currency, convert, money } = useCurrency();

  const sorted = useMemo(() => {
    const sign = sort.direction === "asc" ? 1 : -1;
    const value = (line: SaleLine): number | string => {
      switch (sort.key) {
        case "date":
          return `${line.date}${String(line.hour ?? 0).padStart(2, "0")}${line.documentId ?? ""}`;
        case "product":
          return line.product.toLowerCase();
        case "margin":
          return line.margin ?? -Infinity;
        default:
          return line[sort.key];
      }
    };
    return [...lines].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return (
        sign *
        (typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right)))
      );
    });
  }, [lines, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  function header(key: SortKey, label: string, numeric = false) {
    const active = sort.key === key;
    return (
      <th
        className={numeric ? "num" : ""}
        aria-sort={
          active
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
      >
        <button
          className="sort-button"
          onClick={() => {
            setSort(
              active
                ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
                : { key, direction: key === "product" ? "asc" : "desc" },
            );
            setPage(0);
          }}
        >
          {label}
          {active &&
            (sort.direction === "asc" ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            ))}
        </button>
      </th>
    );
  }

  function exportCsv() {
    // Lei stay exactly as Borg returns them; converted amounts are rounded.
    const amount = (lei: number | null, digits = 2) => {
      if (lei === null || currency === "RON") return lei;
      const factor = 10 ** digits;
      return Math.round(convert(lei) * factor) / factor;
    };
    downloadCsv(filename, [
      [
        "Data",
        "Ora",
        "Tip document",
        "Canal",
        "Serie",
        "Număr",
        "ID document",
        "Gestiune",
        "ID gestiune",
        "ID client",
        "Client",
        "Cod fiscal client",
        "Operator",
        "Agent",
        "Cod produs",
        "Produs",
        "Categorie",
        "Tip venit",
        "ID tip venit",
        "UM",
        "Cantitate",
        `Preț unitar net (${currency})`,
        "Discount %",
        "Cotă TVA %",
        `Net (${currency})`,
        `TVA (${currency})`,
        `Brut (${currency})`,
        `Cost (${currency})`,
        `Marjă (${currency})`,
        "Factură",
        "Tip linie",
        "Tip valoare AGS",
        "Discount inclus în linii",
        "ID mișcare",
        "ID mișcare sursă",
        "Alocare discount",
      ],
      ...sorted.map((line) => [
        line.date,
        line.hour,
        line.docType,
        line.channel,
        line.series,
        line.number,
        line.documentId,
        line.warehouse,
        line.warehouseId,
        line.clientId,
        line.client,
        line.clientTaxId,
        line.operator,
        line.agent,
        line.productCode,
        line.product,
        line.category,
        line.revenueGroup,
        line.revenueGroupId,
        line.unit,
        line.quantity,
        amount(line.unitPrice, 4),
        line.discountPct,
        line.vatRate,
        amount(line.net),
        amount(line.vat),
        amount(line.gross),
        amount(line.cost),
        amount(line.margin),
        line.invoice,
        lineLabel(line),
        line.kind,
        yesNo(line.discountInLines),
        line.movementId,
        line.sourceMovementId,
        line.allocation,
      ]),
    ]);
  }

  const discountTotals = useMemo(
    () => (discounts ? summarize(lines) : null),
    [discounts, lines],
  );

  return (
    <section className="panel" id="sales-lines" aria-labelledby="lines-title">
      <div className="panel-heading">
        <div>
          <h2 id="lines-title">
            {discounts ? "Linii de discount" : "Linii de vânzare"}
          </h2>
          <p>
            {plural(lines.length, "linie corespunde", "linii corespund")}{" "}
            filtrelor curente
            {discountTotals
              ? `. Acordate ${money(discountTotals.discountsGranted)} · stornate ${money(signedReversals(discountTotals))} · discount net ${money(discountTotals.discounts)}, fără TVA.`
              : "."}
          </p>
        </div>
        <div className="panel-controls">
          <button
            className="button button-secondary"
            onClick={exportCsv}
            disabled={!lines.length}
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>
      <div className="table-scroll">
        {discounts ? (
          <table className="data-table lines-table">
            <thead>
              <tr>
                {header("date", "Data")}
                <th>Document</th>
                <th>Client</th>
                <th>Gestiune</th>
                <th>Tip venit</th>
                {header("product", "Descriere")}
                <th>Tip</th>
                {header("net", "Valoare netă", true)}
              </tr>
            </thead>
            <tbody>
              {visible.map((line) => (
                <tr key={line.id}>
                  <td className="nowrap">{shortDate(line.date)}</td>
                  <td className="nowrap">
                    {documentLabel(line)}
                    {line.invoice && (
                      <small className="muted block">
                        Factura {line.invoice}
                      </small>
                    )}
                  </td>
                  <td title={line.client}>
                    <span className="truncate">{line.client}</span>
                  </td>
                  <td>{line.warehouse}</td>
                  <td>{line.revenueGroupId ? line.revenueGroup : "—"}</td>
                  <td className="product-cell" title={line.product}>
                    <span className="truncate">{line.product}</span>
                    {line.sourceMovementId && (
                      <small className="muted">
                        Cotă alocată din mișcarea {line.sourceMovementId}
                        {line.allocation ? ` · ${line.allocation}` : ""}
                      </small>
                    )}
                  </td>
                  <td>
                    <KindBadge line={line} />
                  </td>
                  <td className={`num ${line.net < 0 ? "negative" : ""}`}>
                    {money(line.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table lines-table">
            <thead>
              <tr>
                {header("date", "Data")}
                <th>Document</th>
                <th>Gestiune</th>
                <th>Client</th>
                {header("product", "Produs")}
                {header("quantity", "Cant.", true)}
                {header("net", "Net", true)}
                <th className="num">Brut</th>
                {header("margin", "Marjă", true)}
              </tr>
            </thead>
            <tbody>
              {visible.map((line) => (
                <tr key={line.id} className={isReturn(line) ? "is-return" : ""}>
                  <td className="nowrap">
                    {shortDate(line.date)}
                    {line.hour !== null && (
                      <small className="muted">
                        {" "}
                        {String(line.hour).padStart(2, "0")}h
                      </small>
                    )}
                  </td>
                  <td className="nowrap">
                    {documentLabel(line)}
                    {line.invoice && (
                      <small className="muted block">
                        Factura {line.invoice}
                      </small>
                    )}
                  </td>
                  <td>{line.warehouse}</td>
                  <td title={line.client}>
                    <span className="truncate">{line.client}</span>
                  </td>
                  <td className="product-cell" title={line.product}>
                    <span className="truncate">
                      {line.product}
                      {line.kind !== "sale" && (
                        <>
                          {" "}
                          <KindBadge line={line} />
                        </>
                      )}
                    </span>
                    <small className="muted">
                      {[
                        line.productCode,
                        line.category,
                        line.revenueGroupId ? line.revenueGroup : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </td>
                  <td className="num nowrap">
                    {number(line.quantity)}{" "}
                    <small className="muted">{line.unit}</small>
                  </td>
                  <td className={`num ${line.net < 0 ? "negative" : ""}`}>
                    {money(line.net)}
                  </td>
                  <td className="num muted">{money(line.gross)}</td>
                  <td
                    className={`num ${(line.margin ?? 0) < 0 ? "negative" : ""}`}
                  >
                    {line.margin === null ? "—" : money(line.margin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <div className="table-footer">
          <span className="muted">
            {number(current * PAGE_SIZE + 1)}–
            {number(Math.min((current + 1) * PAGE_SIZE, sorted.length))} din{" "}
            {number(sorted.length)}
          </span>
          <div className="pager">
            <button
              className="button button-secondary"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Înapoi
            </button>
            <button
              className="button button-secondary"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              Înainte
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
