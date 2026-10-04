import type { BusinessValueKind } from "../api/types";
import { eachDay, parseIso, weekStart } from "./dates";
import type { DateRange } from "./dates";
import { capitalize, locale } from "./format";

/** A Borg sales row (`/api/borg/sales`), normalized from its camelCase JSON. */
export interface SaleLine {
  id: string;
  /** Borg's `miscareId`; allocated discount shares each have their own. */
  movementId: string | null;
  documentId: string | null;
  docType: string;
  channel: string;
  series: string | null;
  number: string | null;
  date: string;
  /** Hour of day the document was issued, when Borg provides a time. */
  hour: number | null;
  /** Borg's gestiune ID; `warehouse` is its name (`depozit`). */
  warehouseId: number | null;
  warehouse: string;
  /** Borg's client ID; tells apart clients that share a name. */
  clientId: string | null;
  client: string;
  clientTaxId: string | null;
  operator: string;
  agent: string;
  productCode: string;
  product: string;
  category: string;
  revenueGroupId: string | null;
  revenueGroup: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  discountPct: number | null;
  vatRate: number | null;
  net: number;
  vat: number;
  gross: number;
  cost: number | null;
  margin: number | null;
  invoice: string | null;
  /** AGS's classification; missing or unknown values are "unclassified". */
  kind: BusinessValueKind;
  /**
   * The discount is already in the product lines' net and this row carries 0.
   * Null when Borg does not report the flag.
   */
  discountInLines: boolean | null;
  /** The Borg movement an allocated discount share was split from. */
  sourceMovementId: string | null;
  /** AGS's allocation details for a discount share, as readable text. */
  allocation: string | null;
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

const businessValueKinds: readonly BusinessValueKind[] = [
  "sale",
  "discount",
  "special",
  "unclassified",
];

/** Flattens an allocation object to "key: value; …" so it reads in tables and CSV. */
function allocationText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return text(value);
  const parts = Object.entries(value).flatMap(([key, item]) => {
    const shown = typeof item === "boolean" ? String(item) : text(item);
    return shown ? [`${key}: ${shown}`] : [];
  });
  return parts.length ? parts.join("; ") : JSON.stringify(value);
}

function hourOf(value: unknown): number | null {
  if (typeof value !== "string") return null;
  // Zoned timestamps convert to the viewer's clock; naive ones are Borg wall time.
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getHours();
  }
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) : null;
}

/** Returns null for lines without a usable date or net value. */
export function normalizeLine(
  raw: Record<string, unknown>,
  index: number,
): SaleLine | null {
  const date = typeof raw.data === "string" ? raw.data.slice(0, 10) : null;
  const net = num(raw.valoareNet);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || net === null) return null;
  const vat = num(raw.valoareTVA);
  const cost = num(raw.costTotal);
  const margin = num(raw.marja) ?? (cost === null ? null : net - cost);
  const invoiceSeries = text(raw.facturaSerie);
  const invoiceNumber = text(raw.facturaNumar);
  const movementId = text(raw.miscareId);
  return {
    id: movementId ?? `line-${index}`,
    movementId,
    documentId: text(raw.documentId),
    docType: text(raw.tipDocument) ?? NONE,
    channel: text(raw.canal) ?? NONE,
    series: text(raw.serie),
    number: text(raw.numar),
    date,
    hour: hourOf(raw.oraDocument),
    warehouseId: num(raw.gestiuneId),
    warehouse:
      text(raw.depozit) ??
      (text(raw.gestiuneId) ? `Gestiunea ${text(raw.gestiuneId)}` : NONE),
    clientId: text(raw.clientId),
    client: text(raw.client) ?? NONE,
    clientTaxId: text(raw.clientCodFiscal),
    operator: text(raw.operator) ?? NONE,
    agent: text(raw.agent) ?? NONE,
    productCode: text(raw.codProdus) ?? "",
    product: text(raw.produs) ?? text(raw.codProdus) ?? NONE,
    category: text(raw.grupa) ?? NONE,
    revenueGroupId: text(raw.revenueGroupId),
    revenueGroup: text(raw.revenueGroupName) ?? NONE,
    unit: text(raw.um) ?? "",
    quantity: num(raw.cantitate) ?? 0,
    unitPrice: num(raw.pretUnitarNet),
    discountPct: num(raw.discountProcent),
    vatRate: num(raw.cotaTVA),
    net,
    vat: vat ?? 0,
    gross: num(raw.valoareTotal) ?? net + (vat ?? 0),
    cost,
    margin,
    invoice:
      invoiceSeries || invoiceNumber
        ? [invoiceSeries, invoiceNumber].filter(Boolean).join(" ")
        : null,
    kind:
      businessValueKinds.find((kind) => kind === raw.businessValueKind) ??
      "unclassified",
    discountInLines:
      typeof raw.discountInclusInLinii === "boolean"
        ? raw.discountInclusInLinii
        : null,
    sourceMovementId: text(raw.sourceMiscareId),
    allocation: allocationText(raw.discountAllocation),
  };
}

export function normalizeLines(rows: Record<string, unknown>[]) {
  return rows.flatMap((row, index) => normalizeLine(row, index) ?? []);
}

export const docTypeLabels: Record<string, string> = {
  BFD: "Bonuri fiscale (BFD)",
  AIM: "Avize (AIM)",
  AIMS: "Stornări avize (AIMS)",
};

export function documentLabel(line: SaleLine) {
  const reference = [line.series, line.number].filter(Boolean).join(" ");
  return `${line.docType}${reference ? ` ${reference}` : ""}`;
}

// ---------------------------------------------------------------------------
// Dimensions

const weekdays = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
export const weekdayOf = (iso: string) => (parseIso(iso).getDay() + 6) % 7;

export type Dimension =
  | "revenueGroup"
  | "product"
  | "category"
  | "warehouse"
  | "docType"
  | "channel"
  | "client"
  | "operator"
  | "agent"
  | "vatRate"
  | "day"
  | "week"
  | "month"
  | "weekday"
  | "hour";

type DimensionSpec = {
  label: string;
  key: (line: SaleLine) => string;
  name?: (line: SaleLine) => string;
  /** Time-like dimensions sort by key instead of by value. */
  ordered?: boolean;
  /** Offered as a refine filter. */
  filterable?: boolean;
};

export const dimensions: Record<Dimension, DimensionSpec> = {
  revenueGroup: {
    label: "Tip venit",
    key: (line) => line.revenueGroupId ?? NONE,
    name: (line) => line.revenueGroup,
    filterable: true,
  },
  product: {
    label: "Produs",
    key: (line) => line.productCode || line.product,
    name: (line) =>
      line.productCode ? `${line.product} · ${line.productCode}` : line.product,
    filterable: true,
  },
  category: {
    label: "Categorie",
    key: (line) => line.category,
    filterable: true,
  },
  warehouse: {
    label: "Gestiune",
    key: (line) =>
      line.warehouseId === null ? line.warehouse : `id:${line.warehouseId}`,
    name: (line) => line.warehouse,
    filterable: true,
  },
  docType: {
    label: "Tip document",
    key: (line) => line.docType,
    name: (line) => docTypeLabels[line.docType] ?? line.docType,
    filterable: true,
  },
  channel: { label: "Canal", key: (line) => line.channel, filterable: true },
  client: {
    label: "Client",
    key: (line) =>
      line.clientId
        ? `id:${line.clientId}`
        : line.clientTaxId
          ? `cf:${line.clientTaxId}`
          : line.client,
    name: (line) =>
      line.clientTaxId ? `${line.client} · ${line.clientTaxId}` : line.client,
    filterable: true,
  },
  operator: {
    label: "Operator",
    key: (line) => line.operator,
    filterable: true,
  },
  agent: { label: "Agent", key: (line) => line.agent, filterable: true },
  vatRate: {
    label: "Cotă TVA",
    key: (line) => (line.vatRate === null ? NONE : String(line.vatRate)),
    name: (line) => (line.vatRate === null ? NONE : `${line.vatRate}%`),
    filterable: true,
  },
  day: { label: "Zi", key: (line) => line.date, ordered: true },
  week: {
    label: "Săptămână",
    key: (line) => weekStart(line.date),
    ordered: true,
  },
  month: {
    label: "Lună",
    key: (line) => line.date.slice(0, 7),
    ordered: true,
  },
  weekday: {
    label: "Zi a săptămânii",
    key: (line) => String(weekdayOf(line.date)),
    name: (line) => weekdays[weekdayOf(line.date)]!,
    ordered: true,
  },
  hour: {
    label: "Oră din zi",
    key: (line) =>
      line.hour === null ? "99" : String(line.hour).padStart(2, "0"),
    name: (line) =>
      line.hour === null
        ? "Necunoscută"
        : `${String(line.hour).padStart(2, "0")}:00`,
    ordered: true,
  },
};

export const groupableDimensions = Object.keys(dimensions) as Dimension[];
export const filterableDimensions = groupableDimensions.filter(
  (dimension) => dimensions[dimension].filterable,
);

function nameFor(dimension: Dimension, line: SaleLine) {
  const spec = dimensions[dimension];
  if (spec.name) return spec.name(line);
  const key = spec.key(line);
  if (dimension === "day")
    return capitalize(
      new Date(`${key}T12:00:00`).toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    );
  if (dimension === "week")
    return `Săptămâna din ${new Date(`${key}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
  if (dimension === "month")
    return capitalize(
      new Date(`${key}-01T12:00:00`).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
    );
  return key;
}

// ---------------------------------------------------------------------------
// Metrics

/**
 * Totals of authoritative Borg amounts, in lei. Product net values already
 * include their line discounts; `discounts` covers only separate commercial
 * discount rows.
 */
export interface Metrics {
  /** Every row's net: products, separate discounts, services, unclassified. */
  net: number;
  vat: number;
  gross: number;
  quantity: number;
  margin: number;
  /** Net value of the lines that have a known margin; the margin % denominator. */
  marginBase: number;
  documents: number;
  lines: number;
  /** Product rows (S); returns are negative and reduce it. */
  productSales: number;
  /** Product returns, negative; already part of `productSales`. */
  returns: number;
  returnLines: number;
  /** Separate discounts as a positive reduction (D = −Σ discount net). */
  discounts: number;
  /** Discount rows with a negative net, as a positive amount. */
  discountsGranted: number;
  /** Discount reversals (positive net), as a positive amount; they reduce D. */
  discountsReversed: number;
  /** Separate discount transactions; allocated shares of one count once. */
  discountTransactions: number;
  /** Services and other special lines, kept out of product sales. */
  special: number;
  specialLines: number;
  unclassified: number;
  unclassifiedLines: number;
}

/** Rounds lei to whole cents, symmetrically, so returns mirror sales. */
export const toCents = (lei: number) =>
  Math.sign(lei) * Math.round(Math.abs(lei) * 100);

const moneyKeys = [
  "net",
  "vat",
  "gross",
  "margin",
  "marginBase",
  "productSales",
  "returns",
  "discountsGranted",
  "discountsReversed",
  "special",
  "unclassified",
] as const;
type MoneyKey = (typeof moneyKeys)[number];

class Accumulator {
  /** Money adds up in integer cents so long periods don't drift. */
  private cents = Object.fromEntries(
    moneyKeys.map((key) => [key, 0]),
  ) as Record<MoneyKey, number>;
  quantity = 0;
  lines = 0;
  returnLines = 0;
  specialLines = 0;
  unclassifiedLines = 0;
  private documents = new Set<string>();
  private discountSources = new Set<string>();

  add(line: SaleLine) {
    const cents = this.cents;
    const net = toCents(line.net);
    cents.net += net;
    cents.vat += toCents(line.vat);
    cents.gross += toCents(line.gross);
    if (line.margin !== null) {
      cents.margin += toCents(line.margin);
      cents.marginBase += net;
    }
    if (line.kind !== "discount") this.quantity += line.quantity;
    this.lines += 1;
    switch (line.kind) {
      case "sale":
        cents.productSales += net;
        if (isReturn(line)) {
          cents.returns += net;
          this.returnLines += 1;
        }
        break;
      case "discount":
        if (net < 0) cents.discountsGranted -= net;
        else cents.discountsReversed += net;
        // Discounts already inside product prices carry 0 and aren't transactions.
        if (line.discountInLines !== true)
          this.discountSources.add(line.sourceMovementId ?? line.id);
        break;
      case "special":
        cents.special += net;
        this.specialLines += 1;
        break;
      case "unclassified":
        cents.unclassified += net;
        this.unclassifiedLines += 1;
        break;
    }
    this.documents.add(
      line.documentId ??
        `${line.docType}:${line.series}:${line.number}:${line.id}`,
    );
  }

  result(): Metrics {
    const { cents } = this;
    const lei = Object.fromEntries(
      moneyKeys.map((key) => [key, cents[key] / 100]),
    ) as Record<MoneyKey, number>;
    return {
      ...lei,
      discounts: (cents.discountsGranted - cents.discountsReversed) / 100,
      quantity: this.quantity,
      lines: this.lines,
      returnLines: this.returnLines,
      specialLines: this.specialLines,
      unclassifiedLines: this.unclassifiedLines,
      documents: this.documents.size,
      discountTransactions: this.discountSources.size,
    };
  }
}

export function summarize(lines: SaleLine[]): Metrics {
  const accumulator = new Accumulator();
  for (const line of lines) accumulator.add(line);
  return accumulator.result();
}

export const marginPct = (metrics: Metrics) =>
  metrics.marginBase ? (metrics.margin / metrics.marginBase) * 100 : null;
export const averageDocument = (metrics: Metrics) =>
  metrics.documents ? metrics.net / metrics.documents : 0;
/** Product sales after separate discounts: S − D. */
export const salesAfterDiscounts = (metrics: Metrics) =>
  (toCents(metrics.productSales) - toCents(metrics.discounts)) / 100;
/** D / S × 100; null without positive product sales. */
export const discountPct = (metrics: Metrics) =>
  metrics.productSales > 0
    ? (metrics.discounts / metrics.productSales) * 100
    : null;
/** Reversals as they reduce D: negative, and never "−0,00" when there are none. */
export const signedReversals = (metrics: Metrics) =>
  metrics.discountsReversed ? -metrics.discountsReversed : 0;
export const isReturn = (line: SaleLine) =>
  line.kind === "sale" && (line.net < 0 || line.quantity < 0);
/** Share of net sales whose cost is known, 0–100. */
export const costCoverage = (metrics: Metrics) =>
  metrics.net ? (metrics.marginBase / metrics.net) * 100 : 100;

/** How a line reads in tables and exports. */
export function lineLabel(line: SaleLine) {
  switch (line.kind) {
    case "sale":
      return isReturn(line) ? "Retur produs" : "Vânzare produs";
    case "discount":
      if (line.discountInLines) return "Discount inclus în preț";
      return line.net < 0
        ? "Discount acordat"
        : line.net > 0
          ? "Discount stornat"
          : "Discount fără valoare";
    case "special":
      return "Serviciu / special";
    case "unclassified":
      return "Neclasificat";
  }
}

export type MetricKey =
  | "net"
  | "productSales"
  | "discounts"
  | "gross"
  | "margin"
  | "quantity"
  | "documents";
export const metricOptions: {
  key: MetricKey;
  label: string;
  money: boolean;
}[] = [
  { key: "net", label: "Vânzări nete", money: true },
  { key: "productSales", label: "Vânzări produse", money: true },
  { key: "discounts", label: "Discounturi", money: true },
  { key: "gross", label: "Vânzări brute (cu TVA)", money: true },
  { key: "margin", label: "Marjă brută", money: true },
  { key: "quantity", label: "Cantitate", money: false },
  { key: "documents", label: "Documente", money: false },
];
export const metricValue = (metrics: Metrics, key: MetricKey) => metrics[key];

// ---------------------------------------------------------------------------
// Grouping

export interface Group {
  key: string;
  name: string;
  metrics: Metrics;
  children?: Group[];
}

export function groupLines(
  lines: SaleLine[],
  dimension: Dimension,
  sortBy: MetricKey = "net",
  thenBy?: Dimension,
): Group[] {
  const spec = dimensions[dimension];
  const buckets = new Map<string, { name: string; lines: SaleLine[] }>();
  for (const line of lines) {
    const key = spec.key(line);
    let bucket = buckets.get(key);
    if (!bucket)
      buckets.set(
        key,
        (bucket = { name: nameFor(dimension, line), lines: [] }),
      );
    bucket.lines.push(line);
  }
  const groups: Group[] = [...buckets].map(([key, bucket]) => ({
    key,
    name: bucket.name,
    metrics: summarize(bucket.lines),
    children:
      thenBy && thenBy !== dimension
        ? groupLines(bucket.lines, thenBy, sortBy)
        : undefined,
  }));
  return groups.sort((a, b) =>
    spec.ordered
      ? a.key.localeCompare(b.key)
      : metricValue(b.metrics, sortBy) - metricValue(a.metrics, sortBy) ||
        a.name.localeCompare(b.name),
  );
}

/** Distinct values of a dimension, most valuable first, for filter pickers. */
export function dimensionValues(lines: SaleLine[], dimension: Dimension) {
  return groupLines(lines, dimension).map(({ key, name, metrics }) => ({
    key,
    name,
    net: metrics.net,
  }));
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
 * `paletteLines` keep their slot (and color) while the view is refined; the
 * rest fold into one "other" segment. Negative values can't be parts of a
 * whole, so then there are no segments, only rows.
 */
export function composition(
  lines: SaleLine[],
  dimension: Dimension,
  metric: MetricKey,
  paletteLines: SaleLine[] = lines,
  slots = 3,
) {
  const groups = groupLines(lines, dimension, metric);
  const total = groups.reduce(
    (sum, group) => sum + metricValue(group.metrics, metric),
    0,
  );
  const shareOf = (value: number) => (total > 0 ? (value / total) * 100 : null);
  const palette = groupLines(paletteLines, dimension, metric)
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
// Refinement (client-side filters on loaded lines)

export type LineKind =
  "all" | "sales" | "returns" | "discounts" | "special" | "unclassified";
export const lineKindOptions: { value: LineKind; label: string }[] = [
  { value: "all", label: "Toate liniile" },
  { value: "sales", label: "Vânzări" },
  { value: "returns", label: "Retururi" },
  { value: "discounts", label: "Discounturi" },
  { value: "special", label: "Servicii / speciale" },
  { value: "unclassified", label: "Neclasificate" },
];

export function matchesKind(line: SaleLine, kind: LineKind) {
  switch (kind) {
    case "all":
      return true;
    case "sales":
      return line.kind === "sale" && !isReturn(line);
    case "returns":
      return isReturn(line);
    case "discounts":
      return line.kind === "discount";
    case "special":
      return line.kind === "special";
    case "unclassified":
      return line.kind === "unclassified";
  }
}

export interface Refine {
  search: string;
  kind: LineKind;
  filters: Partial<Record<Dimension, string[]>>;
}
export const emptyRefine: Refine = { search: "", kind: "all", filters: {} };

export function refineLines(
  lines: SaleLine[],
  { search, kind, filters }: Refine,
) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const active = (Object.entries(filters) as [Dimension, string[]][]).filter(
    ([, values]) => values.length,
  );
  const sets = active.map(
    ([dimension, values]) =>
      [dimensions[dimension].key, new Set(values)] as const,
  );
  return lines.filter((line) => {
    if (!matchesKind(line, kind)) return false;
    if (!sets.every(([key, values]) => values.has(key(line)))) return false;
    if (!terms.length) return true;
    const haystack = [
      line.product,
      line.productCode,
      line.client,
      line.clientTaxId,
      line.category,
      line.warehouse,
      documentLabel(line),
      line.invoice,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
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
  lines: SaleLine[],
  range: DateRange,
  metric: MetricKey,
  options: {
    split?: Dimension;
    splitKeys?: string[];
    previous?: { lines: SaleLine[]; range: DateRange };
  } = {},
): SeriesPoint[] {
  const bucket = bucketFor(range);
  const keys = bucketsFor(range, bucket);
  const seriesOf = (line: SaleLine) => {
    if (!options.split) return "value";
    const key = dimensions[options.split].key(line);
    return options.splitKeys?.includes(key) ? `s:${key}` : "other";
  };
  const cells = new Map<string, SaleLine[]>();
  for (const line of lines) {
    const cell = `${bucketKey(bucket, line.date)}|${seriesOf(line)}`;
    const list = cells.get(cell);
    if (list) list.push(line);
    else cells.set(cell, [line]);
  }
  const series = options.split
    ? [...(options.splitKeys ?? []).map((key) => `s:${key}`), "other"]
    : ["value"];

  let previousValues: { key: string; value: number }[] | undefined;
  if (options.previous) {
    const previousKeys = bucketsFor(options.previous.range, bucket);
    const byBucket = new Map<string, SaleLine[]>();
    for (const line of options.previous.lines) {
      const key = bucketKey(bucket, line.date);
      const list = byBucket.get(key);
      if (list) list.push(line);
      else byBucket.set(key, [line]);
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

// ---------------------------------------------------------------------------
// Weekday × hour heatmap

export function heatmap(lines: SaleLine[], metric: MetricKey) {
  const cells = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => [] as SaleLine[]),
  );
  let timed = 0;
  for (const line of lines) {
    if (line.hour === null) continue;
    timed += 1;
    cells[weekdayOf(line.date)]![line.hour]!.push(line);
  }
  const values = cells.map((row) =>
    row.map((cell) => metricValue(summarize(cell), metric)),
  );
  const max = Math.max(0, ...values.flat());
  const hours = new Set(
    lines.flatMap((line) => (line.hour === null ? [] : [line.hour])),
  );
  return {
    values,
    max,
    weekdays,
    timedShare: lines.length ? timed / lines.length : 0,
    distinctHours: hours.size,
  };
}
