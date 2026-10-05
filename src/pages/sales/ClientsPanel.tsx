import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import {
  clientDocuments,
  filterClients,
  groupClients,
  clientComposition,
} from "../../lib/clients";
import type { ClientGroup } from "../../lib/clients";
import { downloadCsv } from "../../lib/csv";
import { useCurrency } from "../../lib/currency";
import { longDate, number, percent, plural } from "../../lib/format";
import { ClientPieChart } from "./ClientPieChart";
import { salesAfterDiscounts, summarize, toCents } from "../../lib/sales";
import type { MetricKey, SaleEntry } from "../../lib/sales";

const ROWS = 20;

export function ClientsPanel({
  entries,
  metric,
  filename,
  incomplete = false,
}: {
  entries: SaleEntry[];
  metric: MetricKey;
  filename: string;
  incomplete?: boolean;
}) {
  const { currency, convert, money } = useCurrency();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const clients = useMemo(
    () => groupClients(entries, metric),
    [entries, metric],
  );
  const filtered = useMemo(
    () => filterClients(clients, search),
    [clients, search],
  );
  const totals = useMemo(
    () => summarize(filtered.flatMap((client) => client.entries)),
    [filtered],
  );
  const composition = useMemo(
    () =>
      clientComposition(
        clients,
        search.trim() ? filtered.map((client) => client.key) : undefined,
        selected,
      ),
    [clients, filtered, search, selected],
  );
  const rows = showAll ? filtered : filtered.slice(0, ROWS);
  const round = (value: number) => toCents(convert(value)) / 100;

  function exportCsv() {
    downloadCsv(`${filename}-pe-clienti.csv`, [
      [
        "Client",
        "ID client",
        "CUI",
        `Vânzări (${currency})`,
        `Discounturi (${currency})`,
        `După discounturi (${currency})`,
        "Documente de vânzare",
        "Pondere în vânzările pozitive (%)",
      ],
      ...filtered.map((client) => [
        client.name,
        client.id,
        client.taxId,
        round(client.metrics.sales),
        round(client.metrics.discounts),
        round(salesAfterDiscounts(client.metrics)),
        client.metrics.documents,
        composition.shares.get(client.key) ?? "",
      ]),
    ]);
  }

  return (
    <section className="panel" aria-labelledby="clients-title">
      <div className="panel-heading">
        <div>
          <h2 id="clients-title">Vânzări pe clienți</h2>
          <p>
            Clienții cu înregistrări în perioada și grupa selectate. Selectați
            un client pentru documente.
          </p>
        </div>
        <button
          className="button button-secondary"
          onClick={exportCsv}
          disabled={!filtered.length}
        >
          <Download size={15} /> CSV clienți
        </button>
      </div>
      <div className="toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Căutați clienți după nume sau CUI"
            placeholder="Căutați după nume sau CUI"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowAll(false);
            }}
          />
        </label>
        {search && (
          <button
            className="button button-secondary"
            onClick={() => setSearch("")}
          >
            Șterge căutarea
          </button>
        )}
      </div>
      <p className="muted" aria-live="polite">
        {plural(filtered.length, "client", "clienți")} din{" "}
        {number(clients.length)} · {money(salesAfterDiscounts(totals))} după
        discounturi
      </p>
      {incomplete && (
        <p className="field-hint">
          Lista și valorile sunt parțiale: Borg a limitat rezultatele pentru
          această perioadă.
        </p>
      )}
      <p className="field-hint">
        Sunt disponibile documentele, gestiunile și valorile. Produsele și
        cantitățile nu sunt disponibile în acest raport.
      </p>
      <ClientPieChart
        data={composition}
        onSelect={(key) => {
          const client = clients.find((item) => item.key === key);
          if (client) {
            setSearch(client.name);
            setShowAll(false);
            setSelected(key);
          }
        }}
      />
      {!filtered.length ? (
        <p className="muted">Niciun client nu corespunde căutării.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table clients-table">
            <thead>
              <tr>
                <th>Client / CUI</th>
                <th className="num">Vânzări</th>
                <th className="num">Discounturi</th>
                <th className="num">După discounturi</th>
                <th className="num">Documente de vânzare</th>
                <th className="num">Pondere în grafic</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => {
                const expanded = selected === client.key;
                const detailId = `client-details-${encodeURIComponent(client.key)}`;
                return (
                  <Fragment key={client.key}>
                    <tr>
                      <th scope="row">
                        <button
                          className="client-toggle"
                          aria-expanded={expanded}
                          aria-controls={expanded ? detailId : undefined}
                          onClick={() =>
                            setSelected(expanded ? null : client.key)
                          }
                        >
                          {expanded ? (
                            <ChevronDown size={16} aria-hidden="true" />
                          ) : (
                            <ChevronRight size={16} aria-hidden="true" />
                          )}
                          <span>
                            {client.name}
                            <small>
                              {client.taxId ??
                                (client.id
                                  ? `ID ${client.id}`
                                  : "Client neidentificat")}
                            </small>
                          </span>
                        </button>
                      </th>
                      <td
                        className={`num ${client.metrics.sales < 0 ? "negative" : ""}`}
                      >
                        {money(client.metrics.sales)}
                      </td>
                      <td className="num">{money(client.metrics.discounts)}</td>
                      <td
                        className={`num ${salesAfterDiscounts(client.metrics) < 0 ? "negative" : ""}`}
                      >
                        {money(salesAfterDiscounts(client.metrics))}
                      </td>
                      <td className="num">
                        {number(client.metrics.documents)}
                      </td>
                      <td className="num">
                        {percent(composition.shares.get(client.key) ?? null)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="client-detail-cell">
                          <ClientDocumentsView
                            key={client.key}
                            client={client}
                            id={detailId}
                            filename={filename}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">
                  {search.trim() ? "Total clienți filtrați" : "Total clienți"}
                </th>
                <td className="num">{money(totals.sales)}</td>
                <td className="num">{money(totals.discounts)}</td>
                <td className="num">{money(salesAfterDiscounts(totals))}</td>
                <td className="num">{number(totals.documents)}</td>
                <td className="num">
                  {percent(
                    composition.total > 0
                      ? filtered.reduce(
                          (sum, client) =>
                            sum + (composition.shares.get(client.key) ?? 0),
                          0,
                        )
                      : null,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {filtered.length > ROWS && (
        <div className="table-footer">
          <span className="muted">
            {showAll
              ? plural(filtered.length, "client", "clienți")
              : `Se afișează ${ROWS} din ${number(filtered.length)}`}
          </span>
          <button
            className="button button-secondary"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? "Afișează mai puțini"
              : `Afișează toți clienții (${number(filtered.length)})`}
          </button>
        </div>
      )}
    </section>
  );
}

export function ClientDocumentsView({
  client,
  id,
  filename,
}: {
  client: ClientGroup;
  id: string;
  filename: string;
}) {
  const { currency, convert, money } = useCurrency();
  const [showAll, setShowAll] = useState(false);
  const documents = useMemo(
    () => clientDocuments(client.entries),
    [client.entries],
  );
  const rows = showAll ? documents : documents.slice(0, ROWS);
  const round = (value: number) => toCents(convert(value)) / 100;

  function exportCsv() {
    downloadCsv(
      `${filename}-documente-client-${encodeURIComponent(client.key)}.csv`,
      [
        [
          "Client",
          "CUI",
          "Data",
          "Tip document",
          "Număr document",
          "Gestiuni",
          "Descriere",
          `Vânzări (${currency})`,
          `Discounturi (${currency})`,
          `După discounturi (${currency})`,
        ],
        ...documents.map((doc) => [
          client.name,
          client.taxId,
          doc.date,
          doc.type,
          doc.number,
          doc.warehouses.join(", "),
          doc.descriptions.join("; "),
          round(doc.metrics.sales),
          round(doc.metrics.discounts),
          round(salesAfterDiscounts(doc.metrics)),
        ]),
      ],
    );
  }

  return (
    <div
      className="client-documents"
      id={id}
      role="region"
      aria-label={`Documentele clientului ${client.name}`}
    >
      <div className="panel-heading">
        <div>
          <h3>{client.name}</h3>
          <p>
            {plural(documents.length, "document", "documente")} ·{" "}
            {money(salesAfterDiscounts(client.metrics))} după discounturi
          </p>
        </div>
        <button className="button button-secondary" onClick={exportCsv}>
          <Download size={15} /> CSV documente
        </button>
      </div>
      <div className="client-documents-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Document</th>
              <th>Gestiune</th>
              <th>Descriere</th>
              <th className="num">Vânzări</th>
              <th className="num">Discounturi</th>
              <th className="num">După discounturi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((doc) => (
              <tr key={doc.key}>
                <td className="client-document-date">{longDate(doc.date)}</td>
                <th scope="row">
                  {doc.type} {doc.number ?? "—"}
                </th>
                <td>{doc.warehouses.join(", ")}</td>
                <td>{doc.descriptions.join("; ") || "—"}</td>
                <td
                  className={`num ${doc.metrics.sales < 0 ? "negative" : ""}`}
                >
                  {money(doc.metrics.sales)}
                </td>
                <td className="num">{money(doc.metrics.discounts)}</td>
                <td className="num">
                  {money(salesAfterDiscounts(doc.metrics))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {documents.length > ROWS && (
        <div className="table-footer">
          <span className="muted">
            {showAll
              ? plural(documents.length, "document", "documente")
              : `Se afișează ${ROWS} din ${number(documents.length)}`}
          </span>
          <button
            className="button button-secondary"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Afișează mai puține" : "Afișează toate documentele"}
          </button>
        </div>
      )}
    </div>
  );
}
