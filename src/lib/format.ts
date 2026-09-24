// Borg values are in Romanian lei.
export const CURRENCY = "RON";
const locale = "en-GB";

const moneyFormat = new Intl.NumberFormat(locale, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const compactFormat = new Intl.NumberFormat(locale, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const numberFormat = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 2,
});

export const money = (value: number) => moneyFormat.format(value);
export const compactMoney = (value: number) =>
  Math.abs(value) < 10_000
    ? money(value)
    : `${CURRENCY} ${compactFormat.format(value)}`;
export const compact = (value: number) => compactFormat.format(value);
export const number = (value: number) => numberFormat.format(value);
export const percent = (value: number | null, digits = 1) =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;

export function signedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
}

export function change(current: number, previous: number): number | null {
  return previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

export function longDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function initials(name: string) {
  const letters = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
  return letters || "?";
}
