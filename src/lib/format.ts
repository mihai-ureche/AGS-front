import type { Currency } from "./currency";

export const locale = "ro-RO";

const moneyFormat = (currency: Currency, compact = false) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    // "lei" and "€" read more naturally in Romanian than "RON" and "EUR".
    currencyDisplay: "narrowSymbol",
    ...(compact
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { maximumFractionDigits: 2, minimumFractionDigits: 2 }),
  });
const moneyFormats = { RON: moneyFormat("RON"), EUR: moneyFormat("EUR") };
const compactMoneyFormats = {
  RON: moneyFormat("RON", true),
  EUR: moneyFormat("EUR", true),
};
const compactFormat = new Intl.NumberFormat(locale, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const numberFormat = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 2,
});
const fixedFormat = (digits: number) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Formats an amount that is already in `currency`; see useCurrency for lei amounts. */
export const formatMoney = (value: number, currency: Currency) =>
  moneyFormats[currency].format(value);
export const formatCompactMoney = (value: number, currency: Currency) =>
  Math.abs(value) < 10_000
    ? formatMoney(value, currency)
    : compactMoneyFormats[currency].format(value);
export const compact = (value: number) => compactFormat.format(value);
export const number = (value: number) => numberFormat.format(value);

/**
 * A count with its noun: "1 linie", "19 linii", "20 de linii", "101 linii".
 * Romanian adds "de" from 20 on, unless the last two digits are 01–19.
 */
export function plural(value: number, one: string, many: string) {
  if (value === 1) return `1 ${one}`;
  const rest = Math.abs(value) % 100;
  const de = Math.abs(value) >= 20 && (rest === 0 || rest >= 20);
  return `${number(value)} ${de ? "de " : ""}${many}`;
}
export const percent = (value: number | null, digits = 1) =>
  value === null || !Number.isFinite(value)
    ? "—"
    : `${fixedFormat(digits).format(value)}%`;

export function signedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${fixedFormat(1).format(Math.abs(value))}%`;
}

export function change(current: number, previous: number): number | null {
  return previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}

/** Romanian writes weekdays and months in lowercase; labels start with a capital. */
export const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

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
  return "chiar acum";
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
