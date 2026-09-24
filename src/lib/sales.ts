import { eachDay, parseIso, weekStart } from "./dates";
import type { DateRange } from "./dates";

/** A Borg product line (`/api2/borg/sales`), normalized from its camelCase JSON. */
export interface SaleLine {
  id: string;
  documentId: string | null;
  docType: string;
  channel: string;
  series: string | null;
  number: string | null;
  date: string;
  /** Hour of day the document was issued, when Borg provides a time. */
  hour: number | null;
  warehouseId: number | null;
  warehouse: string;
  client: string;
  clientTaxId: string | null;
  operator: string;
  agent: string;
  productCode: string;
  product: string;
  category: string;
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
  return {
    id: text(raw.miscareId) ?? `line-${index}`,
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
      (text(raw.gestiuneId) ? `#${text(raw.gestiuneId)}` : NONE),
    client: text(raw.client) ?? NONE,
    clientTaxId: text(raw.clientCodFiscal),
    operator: text(raw.operator) ?? NONE,
    agent: text(raw.agent) ?? NONE,
    productCode: text(raw.codProdus) ?? "",
    product: text(raw.produs) ?? text(raw.codProdus) ?? NONE,
    category: text(raw.grupa) ?? NONE,
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
  };
}

export function normalizeLines(rows: Record<string, unknown>[]) {
  return rows.flatMap((row, index) => normalizeLine(row, index) ?? []);
}

export const docTypeLabels: Record<string, string> = {
  BFD: "Receipts (BFD)",
  AIM: "Delivery notes (AIM)",
};

export function documentLabel(line: SaleLine) {
  const reference = [line.series, line.number].filter(Boolean).join(" ");
  return `${line.docType}${reference ? ` ${reference}` : ""}`;
}

// ---------------------------------------------------------------------------
// Dimensions

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const weekdayOf = (iso: string) => (parseIso(iso).getDay() + 6) % 7;

export type Dimension =
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
  product: {
    label: "Product",
    key: (line) => line.productCode || line.product,
    name: (line) =>
      line.productCode ? `${line.product} · ${line.productCode}` : line.product,
    filterable: true,
  },
  category: {
    label: "Category",
    key: (line) => line.category,
    filterable: true,
  },
  warehouse: {
    label: "Warehouse",
    key: (line) => line.warehouse,
    filterable: true,
  },
  docType: {
    label: "Document type",
    key: (line) => line.docType,
    name: (line) => docTypeLabels[line.docType] ?? line.docType,
    filterable: true,
  },
  channel: { label: "Channel", key: (line) => line.channel, filterable: true },
  client: { label: "Client", key: (line) => line.client, filterable: true },
  operator: {
    label: "Operator",
    key: (line) => line.operator,
    filterable: true,
  },
  agent: { label: "Agent", key: (line) => line.agent, filterable: true },
  vatRate: {
    label: "VAT rate",
    key: (line) => (line.vatRate === null ? NONE : String(line.vatRate)),
    name: (line) => (line.vatRate === null ? NONE : `${line.vatRate}%`),
    filterable: true,
  },
  day: { label: "Day", key: (line) => line.date, ordered: true },
  week: { label: "Week", key: (line) => weekStart(line.date), ordered: true },
  month: {
    label: "Month",
    key: (line) => line.date.slice(0, 7),
    ordered: true,
  },
  weekday: {
    label: "Weekday",
    key: (line) => String(weekdayOf(line.date)),
    name: (line) => weekdays[weekdayOf(line.date)]!,
    ordered: true,
  },
  hour: {
    label: "Hour of day",
    key: (line) =>
      line.hour === null ? "99" : String(line.hour).padStart(2, "0"),
    name: (line) =>
      line.hour === null
        ? "Unknown"
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
    return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  if (dimension === "week")
    return `Week of ${new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  if (dimension === "month")
    return new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  return key;
}

// ---------------------------------------------------------------------------
// Metrics

export interface Metrics {
  net: number;
  vat: number;
  gross: number;
  quantity: number;
  margin: number;
  /** Net value of the lines that have a known margin; the margin % denominator. */
  marginBase: number;
  documents: number;
  lines: number;
  returns: number;
  returnLines: number;
}

class Accumulator {
  net = 0;
  vat = 0;
  gross = 0;
  quantity = 0;
  margin = 0;
  marginBase = 0;
  lines = 0;
  returns = 0;
  returnLines = 0;
  private documents = new Set<string>();

  add(line: SaleLine) {
    this.net += line.net;
    this.vat += line.vat;
    this.gross += line.gross;
    this.quantity += line.quantity;
    this.lines += 1;
    if (line.margin !== null) {
      this.margin += line.margin;
      this.marginBase += line.net;
    }
    if (line.net < 0 || line.quantity < 0) {
      this.returns += line.net;
      this.returnLines += 1;
    }
    this.documents.add(
      line.documentId ??
        `${line.docType}:${line.series}:${line.number}:${line.id}`,
    );
  }

  result(): Metrics {
    const {
      net,
      vat,
      gross,
      quantity,
      margin,
      marginBase,
      lines,
      returns,
      returnLines,
    } = this;
    return {
      net,
      vat,
      gross,
      quantity,
      margin,
      marginBase,
      lines,
      returns,
      returnLines,
      documents: this.documents.size,
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
/** Share of net sales whose cost is known, 0–100. */
export const costCoverage = (metrics: Metrics) =>
  metrics.net ? (metrics.marginBase / metrics.net) * 100 : 100;

export type MetricKey = "net" | "gross" | "margin" | "quantity" | "documents";
export const metricOptions: {
  key: MetricKey;
  label: string;
  money: boolean;
}[] = [
  { key: "net", label: "Net sales", money: true },
  { key: "gross", label: "Gross sales (incl. VAT)", money: true },
  { key: "margin", label: "Gross margin", money: true },
  { key: "quantity", label: "Quantity", money: false },
  { key: "documents", label: "Documents", money: false },
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
// Refinement (client-side filters on loaded lines)

export type LineKind = "all" | "sales" | "returns";
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
    const isReturn = line.net < 0 || line.quantity < 0;
    if (kind === "sales" && isReturn) return false;
    if (kind === "returns" && !isReturn) return false;
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
    return new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
    });
  }
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
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
