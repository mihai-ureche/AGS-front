// Calendar dates as YYYY-MM-DD strings in the device's local calendar.
export type DateRange = { from: string; to: string };

/** The backend accepts at most 30 inclusive days in one calendar year per request. */
export const MAX_REQUEST_DAYS = 30;
/** Longer ranges are split into several requests; cap the total to protect Borg. */
export const MAX_RANGE_DAYS = 366;

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function isValidIso(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isoDate(parseIso(value)) === value
  );
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function daysInclusive({ from, to }: DateRange) {
  // Round to absorb daylight-saving hour shifts.
  return (
    Math.round(
      (parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000,
    ) + 1
  );
}

export function eachDay({ from, to }: DateRange) {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Splits a range into consecutive requests of ≤30 days that never cross a year. */
export function chunkRange(
  { from, to }: DateRange,
  maxDays = MAX_REQUEST_DAYS,
) {
  const chunks: DateRange[] = [];
  let start = from;
  while (start <= to) {
    const yearEnd = `${start.slice(0, 4)}-12-31`;
    let end = addDays(start, maxDays - 1);
    if (end > yearEnd) end = yearEnd;
    if (end > to) end = to;
    chunks.push({ from: start, to: end });
    start = addDays(end, 1);
  }
  return chunks;
}

/** The period of equal length immediately before the range. */
export function previousRange(range: DateRange): DateRange {
  const length = daysInclusive(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** Monday of the ISO week containing the date. */
export function weekStart(iso: string) {
  const date = parseIso(iso);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return isoDate(date);
}

export type PresetKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "last90"
  | "thisYear";

export const presets: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "last90", label: "Last 90 days" },
  { key: "thisYear", label: "Year to date" },
];

export function presetRange(
  key: PresetKey,
  today = isoDate(new Date()),
): DateRange {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const day = addDays(today, -1);
      return { from: day, to: day };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "thisMonth":
      return { from: monthStart, to: today };
    case "lastMonth": {
      const to = addDays(monthStart, -1);
      return { from: `${to.slice(0, 8)}01`, to };
    }
    case "last90":
      return { from: addDays(today, -89), to: today };
    case "thisYear":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

export function isPresetKey(value: unknown): value is PresetKey {
  return presets.some((preset) => preset.key === value);
}
