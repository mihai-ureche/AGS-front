import type { TargetEntity } from "../api/types";
import { eachDay, weekStart } from "./dates";
import type { DateRange } from "./dates";
import { locale } from "./format";

/** The dashboard covers one entity; the other ledgers are not shown yet. */
export const SALES_ENTITY: TargetEntity = "agritehnica";

/**
 * Reporting groups of gestiuni. List each gestiune, by ID, in at most one group
 * (the names are for reading only; entries are matched by ID). A gestiune in no
 * list, and an entry with no gestiune, is "Nealocate", so the groups always add
 * up to the total and a new gestiune shows up instead of being filed under a
 * group by default. Editing the split means editing these lists.
 */
export type SalesGroupKey = "piese" | "utilaje" | "irigatii";
export type GroupKey = SalesGroupKey | "unassigned";
export interface SalesGroup {
  key: GroupKey;
  label: string;
  /** For file names. */
  slug: string;
  warehouses: [id: number, name: string][];
}
export const salesGroups: SalesGroup[] = [
  {
    key: "piese",
    label: "Piese",
    slug: "piese",
    warehouses: [
      [1, "DEPOZIT VALEA SEACA"],
      [2, "DEPOZIT IASI"],
      [6, "DEPOZIT BRAILA"],
      [9, "DEPOZIT FILIPESTI"],
      [10, "DEPOZIT BOTOSANI"],
      [14, "DEPOZIT VASLUI"],
    ],
  },
  {
    key: "utilaje",
    label: "Utilaje",
    slug: "utilaje",
    warehouses: [
      [8, "DEPOZIT UTILAJE"],
      [16, "UTILAJE BRAILA"],
      [17, "UTILAJE FILIPESTI"],
      [18, "UTILAJE IASI"],
      [19, "UTILAJE BOTOSANI"],
      [20, "UTILAJE VASLUI"],
    ],
  },
  {
    key: "irigatii",
    label: "Irigații",
    slug: "irigatii",
    warehouses: [[15, "DEPOZIT IRIGATII"]],
  },
];
export const unassignedGroup: SalesGroup = {
  key: "unassigned",
  label: "Nealocate",
  slug: "nealocate",
  warehouses: [],
};
/** Every group a view can show. */
export const groupChoices = [...salesGroups, unassignedGroup];

/**
 * Ledger accounts requested from Borg, one request each. A request matches an
 * account (or prefix) on either side. `707` returns both `707.G.nn` (sales)
 * and `707.Discount.nn` (negative sales rows that are really discounts).
 */
export const SALES_ACCOUNTS = ["707", "709"] as const;

/**
 * A ledger entry that counts toward sales or discounts, read from Borg's
 * accounting ledger (`/api/borg/sales`). Entries carry client information,
 * but no product lines or categories.
 */
export interface SaleEntry {
  /** Borg's ledger entry ID; unique, so the same entry is never counted twice. */
  id: string;
  documentId: string | null;
  docType: string;
  number: string | null;
  date: string;
  /** Borg's gestiune ID; `warehouse` is its name (`depozit`). */
  warehouseId: number | null;
  warehouse: string;
  clientId: string | null;
  client: string;
  clientTaxId: string | null;
  description: string | null;
  /** The 707/709 account this entry was classified by. */
  account: string;
  kind: "sale" | "discount";
  /**
   * Lei, excluding VAT. A sale is positive and a storno negative. A discount is
   * the reduction it grants: positive when granted, negative when reversed.
   */
  amount: number;
}

const NONE = "—";

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const salesAccount = /^707(\.|$)/;
const discountAccount = /^707\.discount(\.|$)/i;
const contraAccount = /^709(\.|$)/;
const touchesSales = (account: unknown) =>
  typeof account === "string" &&
  (salesAccount.test(account) || contraAccount.test(account));

/**
 * Sales are credits on 707 and discounts are credits on 707.Discount (booked
 * as negative amounts) or debits on 709. Only these natural sides count, so a
 * period-end closing (debit 707 against profit and loss) cannot cancel sales.
 * Each sale document also carries a total line with no credit account, which
 * is never matched here, so nothing is counted twice. Returns null for entries
 * that are not sales or discounts, or that lack an ID, date or amount.
 */
export function normalizeEntry(raw: Record<string, unknown>): SaleEntry | null {
  const debit = text(raw.contDebit) ?? "";
  const credit = text(raw.contCredit) ?? "";
  const suma = num(raw.suma);
  const id = text(raw.id);
  const date = (text(raw.dataInregistrare) ?? text(raw.dataDocument))?.slice(
    0,
    10,
  );
  let kind: SaleEntry["kind"];
  let account: string;
  let amount: number | null;
  let clientSide: "Debit" | "Credit" = "Debit";
  if (discountAccount.test(credit)) {
    [kind, account, amount] = [
      "discount",
      credit,
      suma === null ? null : -suma,
    ];
  } else if (salesAccount.test(credit)) {
    [kind, account, amount] = ["sale", credit, suma];
  } else if (contraAccount.test(debit)) {
    [kind, account, amount] = ["discount", debit, suma];
    clientSide = "Credit";
  } else {
    return null;
  }
  if (!id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount === null)
    return null;
  const warehouseId = num(raw.gestiuneId);
  const clientId = text(raw[`tert${clientSide}Id`]);
  return {
    id,
    documentId: text(raw.documentId),
    docType: text(raw.tipDocument) ?? NONE,
    number: text(raw.numarDocument),
    date,
    warehouseId,
    warehouse:
      text(raw.depozit) ??
      (warehouseId === null ? "Fără gestiune" : `Gestiunea ${warehouseId}`),
    clientId,
    client:
      text(raw[`tert${clientSide}`]) ??
      (clientId === null ? "Fără client" : `Client ${clientId}`),
    clientTaxId: text(raw[`tert${clientSide}CodFiscal`]),
    description: text(raw.explicatii),
    account,
    kind,
    amount,
  };
}

export interface NormalizedEntries {
  entries: SaleEntry[];
  /**
   * IDs of entries that touch 707/709 but are left out of the totals: the
   * opposite side of the account (e.g. closings) or a missing ID, date or amount.
   */
  ignored: string[];
}

export function normalizeEntries(
  rows: Record<string, unknown>[],
): NormalizedEntries {
  const entries: SaleEntry[] = [];
  const ignored: string[] = [];
  rows.forEach((row, index) => {
    const entry = normalizeEntry(row);
    if (entry) entries.push(entry);
    else if (touchesSales(row.contDebit) || touchesSales(row.contCredit))
      ignored.push(text(row.id) ?? `row-${index}`);
  });
  return { entries, ignored };
}

// ---------------------------------------------------------------------------
// Gestiune groups

export type GroupFilter = GroupKey | "all";

const groupOfWarehouse = new Map(
  salesGroups.flatMap((group) =>
    group.warehouses.map(([id]) => [id, group.key] as const),
  ),
);

export const salesGroupOf = (entry: Pick<SaleEntry, "warehouseId">): GroupKey =>
  (entry.warehouseId === null
    ? undefined
    : groupOfWarehouse.get(entry.warehouseId)) ?? "unassigned";

export const inGroup = <T extends Pick<SaleEntry, "warehouseId">>(
  entries: T[],
  group: GroupFilter,
) =>
  group === "all"
    ? entries
    : entries.filter((entry) => salesGroupOf(entry) === group);

export type WarehouseFilter = "all" | "none" | number;

export const inWarehouse = <T extends Pick<SaleEntry, "warehouseId">>(
  entries: T[],
  warehouse: WarehouseFilter,
) =>
  warehouse === "all"
    ? entries
    : entries.filter(
        (entry) =>
          entry.warehouseId === (warehouse === "none" ? null : warehouse),
      );

// ---------------------------------------------------------------------------
// Dimensions

export type Dimension = "warehouse";

type DimensionSpec = {
  label: string;
  key: (entry: SaleEntry) => string;
  name: (entry: SaleEntry) => string;
};

export const dimensions: Record<Dimension, DimensionSpec> = {
  warehouse: {
    label: "Gestiune",
    key: (entry) =>
      entry.warehouseId === null ? "none" : `id:${entry.warehouseId}`,
    name: (entry) => entry.warehouse,
  },
};

// ---------------------------------------------------------------------------
// Metrics

/** Totals of ledger amounts, in lei. */
export interface Metrics {
  /** Sales (credits on 707), storno entries included as negatives. */
  sales: number;
  /** Storno entries, negative; already part of `sales`. */
  returns: number;
  returnEntries: number;
  /** Discounts granted less reversals, as a positive reduction. */
  discounts: number;
  /** Distinct sale documents. */
  documents: number;
  entries: number;
}

/** Rounds lei to whole cents, symmetrically, so storno mirrors sales. */
export const toCents = (lei: number) =>
  Math.sign(lei) * Math.round(Math.abs(lei) * 100);

class Accumulator {
  /** Money adds up in integer cents so long periods don't drift. */
  private sales = 0;
  private returns = 0;
  private discounts = 0;
  private returnEntries = 0;
  private entries = 0;
  private documents = new Set<string>();

  add(entry: SaleEntry) {
    const cents = toCents(entry.amount);
    this.entries += 1;
    if (entry.kind === "discount") {
      this.discounts += cents;
      return;
    }
    this.sales += cents;
    if (cents < 0) {
      this.returns += cents;
      this.returnEntries += 1;
    }
    this.documents.add(
      entry.documentId ?? `${entry.docType}:${entry.number}:${entry.id}`,
    );
  }

  result(): Metrics {
    return {
      sales: this.sales / 100,
      returns: this.returns / 100,
      returnEntries: this.returnEntries,
      discounts: this.discounts / 100,
      documents: this.documents.size,
      entries: this.entries,
    };
  }
}

export function summarize(entries: SaleEntry[]): Metrics {
  const accumulator = new Accumulator();
  for (const entry of entries) accumulator.add(entry);
  return accumulator.result();
}

/** Sales less discounts. */
export const salesAfterDiscounts = (metrics: Metrics) =>
  (toCents(metrics.sales) - toCents(metrics.discounts)) / 100;
/** Discounts as a percent of sales; null without positive sales. */
export const discountPct = (metrics: Metrics) =>
  metrics.sales > 0 ? (metrics.discounts / metrics.sales) * 100 : null;

export type MetricKey = "afterDiscounts" | "sales" | "discounts" | "documents";
export const metricOptions: {
  key: MetricKey;
  label: string;
  money: boolean;
}[] = [
  { key: "afterDiscounts", label: "Vânzări după discounturi", money: true },
  { key: "sales", label: "Vânzări", money: true },
  { key: "discounts", label: "Discounturi", money: true },
  { key: "documents", label: "Documente", money: false },
];
export const metricValue = (metrics: Metrics, key: MetricKey) =>
  key === "afterDiscounts" ? salesAfterDiscounts(metrics) : metrics[key];

// ---------------------------------------------------------------------------
// Grouping

export interface Group {
  key: string;
  name: string;
  metrics: Metrics;
}

export function groupEntries(
  entries: SaleEntry[],
  dimension: Dimension,
  sortBy: MetricKey = "afterDiscounts",
): Group[] {
  const spec = dimensions[dimension];
  const buckets = new Map<string, { name: string; entries: SaleEntry[] }>();
  for (const entry of entries) {
    const key = spec.key(entry);
    let bucket = buckets.get(key);
    if (!bucket)
      buckets.set(key, (bucket = { name: spec.name(entry), entries: [] }));
    bucket.entries.push(entry);
  }
  return [...buckets]
    .map(([key, bucket]) => ({
      key,
      name: bucket.name,
      metrics: summarize(bucket.entries),
    }))
    .sort(
      (a, b) =>
        metricValue(b.metrics, sortBy) - metricValue(a.metrics, sortBy) ||
        a.name.localeCompare(b.name, locale),
    );
}

// ---------------------------------------------------------------------------
// Part-to-whole

export const OTHER_KEY = "__other";

export interface Share {
  key: string;
  name: string;
  value: number;
  /** Percent of the total; null when the total isn't positive. */
  share: number | null;
  /** Color slot (0-based) for the top values; null when folded into "other". */
  slot: number | null;
}

/**
 * Each value's share of the total, largest first. The top `slots` values of
 * `paletteEntries` keep their slot (and color); the rest fold into one "other"
 * segment. Negative values can't be parts of a whole, so then there are no
 * segments, only rows.
 */
export function composition(
  entries: SaleEntry[],
  dimension: Dimension,
  metric: MetricKey,
  paletteEntries: SaleEntry[] = entries,
  slots = 3,
) {
  const groups = groupEntries(entries, dimension, metric);
  const total = groups.reduce(
    (sum, group) => sum + metricValue(group.metrics, metric),
    0,
  );
  const shareOf = (value: number) => (total > 0 ? (value / total) * 100 : null);
  const palette = groupEntries(paletteEntries, dimension, metric)
    .slice(0, slots)
    .map((group) => group.key);
  const rows: Share[] = groups.map((group) => {
    const value = metricValue(group.metrics, metric);
    const slot = palette.indexOf(group.key);
    return {
      key: group.key,
      name: group.name,
      value,
      share: shareOf(value),
      slot: slot < 0 ? null : slot,
    };
  });
  const stackable = total > 0 && rows.every((row) => row.value >= 0);
  const folded = rows.filter((row) => row.slot === null);
  const otherValue = folded.reduce((sum, row) => sum + row.value, 0);
  // Slot order, not current rank, so neighboring colors never change.
  const segments: Share[] = stackable
    ? [
        ...palette.flatMap((key) =>
          rows.filter((row) => row.key === key && row.value > 0),
        ),
        ...(otherValue > 0
          ? [
              {
                key: OTHER_KEY,
                name: folded.length === 1 ? folded[0]!.name : "Altele",
                value: otherValue,
                share: shareOf(otherValue),
                slot: null,
              },
            ]
          : []),
      ]
    : [];
  return { total, rows, segments, folded: folded.length };
}

// ---------------------------------------------------------------------------
// Time series

export type Bucket = "day" | "week" | "month";

export function bucketFor(range: DateRange): Bucket {
  const days = eachDay(range).length;
  return days <= 45 ? "day" : days <= 120 ? "week" : "month";
}

const bucketKey = (bucket: Bucket, iso: string) =>
  bucket === "day" ? iso : bucket === "week" ? weekStart(iso) : iso.slice(0, 7);

/** Every bucket in the range, in order, so empty days still plot as zero. */
export function bucketsFor(range: DateRange, bucket: Bucket) {
  return [...new Set(eachDay(range).map((day) => bucketKey(bucket, day)))];
}

export function bucketLabel(bucket: Bucket, key: string) {
  if (bucket === "month") {
    return new Date(`${key}-01T12:00:00`).toLocaleDateString(locale, {
      month: "short",
      year: "2-digit",
    });
  }
  return new Date(`${key}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

export interface SeriesPoint {
  key: string;
  label: string;
  /** Previous-period value at the same position, when comparing. */
  previous?: number;
  previousLabel?: string;
  [series: string]: number | string | undefined;
}

/**
 * Metric per time bucket. With `split`, each of `splitKeys` becomes its own
 * series and everything else folds into "other".
 */
export function timeSeries(
  entries: SaleEntry[],
  range: DateRange,
  metric: MetricKey,
  options: {
    split?: Dimension;
    splitKeys?: string[];
    previous?: { entries: SaleEntry[]; range: DateRange };
  } = {},
): SeriesPoint[] {
  const bucket = bucketFor(range);
  const keys = bucketsFor(range, bucket);
  const seriesOf = (entry: SaleEntry) => {
    if (!options.split) return "value";
    const key = dimensions[options.split].key(entry);
    return options.splitKeys?.includes(key) ? `s:${key}` : "other";
  };
  const cells = new Map<string, SaleEntry[]>();
  for (const entry of entries) {
    const cell = `${bucketKey(bucket, entry.date)}|${seriesOf(entry)}`;
    const list = cells.get(cell);
    if (list) list.push(entry);
    else cells.set(cell, [entry]);
  }
  const series = options.split
    ? [...(options.splitKeys ?? []).map((key) => `s:${key}`), "other"]
    : ["value"];

  let previousValues: { key: string; value: number }[] | undefined;
  if (options.previous) {
    const previousKeys = bucketsFor(options.previous.range, bucket);
    const byBucket = new Map<string, SaleEntry[]>();
    for (const entry of options.previous.entries) {
      const key = bucketKey(bucket, entry.date);
      const list = byBucket.get(key);
      if (list) list.push(entry);
      else byBucket.set(key, [entry]);
    }
    previousValues = previousKeys.map((key) => ({
      key,
      value: metricValue(summarize(byBucket.get(key) ?? []), metric),
    }));
  }

  return keys.map((key, index) => {
    const point: SeriesPoint = { key, label: bucketLabel(bucket, key) };
    for (const name of series)
      point[name] = metricValue(
        summarize(cells.get(`${key}|${name}`) ?? []),
        metric,
      );
    const previous = previousValues?.[index];
    if (previous) {
      point.previous = previous.value;
      point.previousLabel = bucketLabel(bucket, previous.key);
    }
    return point;
  });
}
