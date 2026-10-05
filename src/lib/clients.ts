import { locale } from "./format";
import { metricValue, summarize, toCents } from "./sales";
import type { MetricKey, Metrics, SaleEntry } from "./sales";

/** Search ignores case, Romanian diacritics and repeated whitespace. */
export const clientSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase(locale)
    .trim()
    .replace(/\s+/g, " ");

export function clientKey(entry: SaleEntry) {
  if (entry.clientId !== null) return `id:${entry.clientId}`;
  if (entry.clientTaxId !== null)
    return `tax:${clientSearchText(entry.clientTaxId).replace(/\s/g, "")}`;
  return entry.client === "Fără client"
    ? "none"
    : `name:${clientSearchText(entry.client)}`;
}

export interface ClientGroup {
  key: string;
  id: string | null;
  name: string;
  taxId: string | null;
  entries: SaleEntry[];
  metrics: Metrics;
}

export function groupClients(
  entries: SaleEntry[],
  metric: MetricKey = "afterDiscounts",
): ClientGroup[] {
  const groups = new Map<string, Omit<ClientGroup, "metrics">>();
  for (const entry of entries) {
    const key = clientKey(entry);
    const group = groups.get(key);
    if (group) {
      group.entries.push(entry);
      group.taxId ??= entry.clientTaxId;
      if (group.name === "Fără client" || group.name === `Client ${group.id}`)
        group.name = entry.client;
    } else {
      groups.set(key, {
        key,
        id: entry.clientId,
        name: entry.client,
        taxId: entry.clientTaxId,
        entries: [entry],
      });
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, metrics: summarize(group.entries) }))
    .sort(
      (a, b) =>
        metricValue(b.metrics, metric) - metricValue(a.metrics, metric) ||
        a.name.localeCompare(b.name, locale) ||
        a.key.localeCompare(b.key),
    );
}

export function filterClients(clients: ClientGroup[], search: string) {
  const terms = clientSearchText(search).split(" ").filter(Boolean);
  return clients.filter((client) => {
    const text = clientSearchText(`${client.name} ${client.taxId ?? ""}`);
    return terms.every((term) => text.includes(term));
  });
}

export const OTHER_CLIENTS = "__other_clients";

/** The denominator always includes every positive client in the depot scope. */
export function clientComposition(
  clients: ClientGroup[],
  focusKeys?: string[],
  selected?: string | null,
  slots = 5,
) {
  const positive = clients
    .filter((client) => toCents(client.metrics.sales) > 0)
    .sort(
      (a, b) => b.metrics.sales - a.metrics.sales || a.key.localeCompare(b.key),
    );
  const totalCents = positive.reduce(
    (sum, client) => sum + toCents(client.metrics.sales),
    0,
  );
  const negativeCents = clients.reduce(
    (sum, client) => sum + Math.min(0, toCents(client.metrics.sales)),
    0,
  );
  const focus = focusKeys === undefined ? undefined : new Set(focusKeys);
  const candidates = focus
    ? positive.filter((client) => focus.has(client.key))
    : positive;
  let shown = candidates.slice(0, slots);
  const pinned = candidates.find((client) => client.key === selected);
  if (pinned && !shown.includes(pinned))
    shown = [...shown.slice(0, slots - 1), pinned];
  const shareOf = (sales: number) =>
    totalCents > 0 && sales >= 0 ? (toCents(sales) / totalCents) * 100 : null;
  const segments = shown.map((client) => ({
    key: client.key,
    name: client.name,
    value: toCents(client.metrics.sales) / 100,
    share: shareOf(client.metrics.sales)!,
  }));
  const otherCents =
    totalCents -
    shown.reduce((sum, client) => sum + toCents(client.metrics.sales), 0);
  if (otherCents > 0)
    segments.push({
      key: OTHER_CLIENTS,
      name: `Alți clienți (${positive.length - shown.length})`,
      value: otherCents / 100,
      share: (otherCents / totalCents) * 100,
    });
  return {
    total: totalCents / 100,
    negative: negativeCents / 100,
    segments,
    shares: new Map(
      clients.map((client) => [client.key, shareOf(client.metrics.sales)]),
    ),
  };
}

export interface ClientDocument {
  key: string;
  date: string;
  type: string;
  number: string | null;
  warehouses: string[];
  descriptions: string[];
  metrics: Metrics;
}

/** Combine sale and discount postings belonging to the same document. */
export function clientDocuments(entries: SaleEntry[]): ClientDocument[] {
  const documents = new Map<string, SaleEntry[]>();
  for (const entry of entries) {
    const key =
      entry.documentId === null
        ? `entry:${entry.id}`
        : `document:${entry.documentId}`;
    const bucket = documents.get(key);
    if (bucket) bucket.push(entry);
    else documents.set(key, [entry]);
  }
  return [...documents]
    .map(([key, rows]) => ({
      key,
      date: rows[0]!.date,
      type: rows[0]!.docType,
      number: rows[0]!.number,
      warehouses: [...new Set(rows.map((row) => row.warehouse))],
      descriptions: [
        ...new Set(
          rows.flatMap((row) => (row.description ? [row.description] : [])),
        ),
      ],
      metrics: summarize(rows),
    }))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (a.number ?? "").localeCompare(b.number ?? "", locale),
    );
}
