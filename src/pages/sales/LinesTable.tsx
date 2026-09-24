import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { downloadCsv } from "../../lib/csv";
import { money, number, shortDate } from "../../lib/format";
import { documentLabel } from "../../lib/sales";
import type { SaleLine } from "../../lib/sales";

type SortKey = "date" | "net" | "quantity" | "margin" | "product";
const PAGE_SIZE = 25;

export function LinesTable({
  lines,
  filename,
}: {
  lines: SaleLine[];
  filename: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>(
    { key: "date", direction: "desc" },
  );
  const [page, setPage] = useState(0);

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
    downloadCsv(filename, [
      [
        "Date",
        "Hour",
        "Document type",
        "Channel",
        "Series",
        "Number",
        "Document ID",
        "Warehouse",
        "Warehouse ID",
        "Client",
        "Client tax ID",
        "Operator",
        "Agent",
        "Product code",
        "Product",
        "Category",
        "Unit",
        "Quantity",
        "Unit price (net)",
        "Discount %",
        "VAT rate %",
        "Net",
        "VAT",
        "Gross",
        "Cost",
        "Margin",
        "Invoice",
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
        line.client,
        line.clientTaxId,
        line.operator,
        line.agent,
        line.productCode,
        line.product,
        line.category,
        line.unit,
        line.quantity,
        line.unitPrice,
        line.discountPct,
        line.vatRate,
        line.net,
        line.vat,
        line.gross,
        line.cost,
        line.margin,
        line.invoice,
      ]),
    ]);
  }

  return (
    <section className="panel" aria-labelledby="lines-title">
      <div className="panel-heading">
        <div>
          <h2 id="lines-title">Product lines</h2>
          <p>{number(lines.length)} lines match the current filters.</p>
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
        <table className="data-table lines-table">
          <thead>
            <tr>
              {header("date", "Date")}
              <th>Document</th>
              <th>Warehouse</th>
              <th>Client</th>
              {header("product", "Product")}
              {header("quantity", "Qty", true)}
              {header("net", "Net", true)}
              <th className="num">Gross</th>
              {header("margin", "Margin", true)}
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <tr key={line.id} className={line.net < 0 ? "is-return" : ""}>
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
                      Invoice {line.invoice}
                    </small>
                  )}
                </td>
                <td>{line.warehouse}</td>
                <td title={line.client}>
                  <span className="truncate">{line.client}</span>
                </td>
                <td className="product-cell" title={line.product}>
                  <span className="truncate">{line.product}</span>
                  <small className="muted">
                    {[line.productCode, line.category]
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
      </div>
      {pages > 1 && (
        <div className="table-footer">
          <span className="muted">
            {number(current * PAGE_SIZE + 1)}–
            {number(Math.min((current + 1) * PAGE_SIZE, sorted.length))} of{" "}
            {number(sorted.length)}
          </span>
          <div className="pager">
            <button
              className="button button-secondary"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
