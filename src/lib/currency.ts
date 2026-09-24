import { useMemo, useSyncExternalStore } from "react";
import { formatCompactMoney, formatMoney, locale } from "./format";

/** Borg reports every amount in lei; euro amounts are converted at the viewer's rate. */
export type Currency = "RON" | "EUR";

/** Lei for one euro until the viewer sets their own rate. */
export const DEFAULT_EUR_RATE = 5.1;
const MIN_RATE = 0.01;
const MAX_RATE = 100;

export interface CurrencyPrefs {
  currency: Currency;
  eurRate: number;
}

export const isValidRate = (rate: number) =>
  Number.isFinite(rate) && rate >= MIN_RATE && rate <= MAX_RATE;

/** Accepts a Romanian decimal comma ("5,0975") as well as a dot; null when invalid. */
export function parseRate(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const rate = Math.round(Number(normalized) * 10_000) / 10_000;
  return isValidRate(rate) ? rate : null;
}

export const formatRate = (rate: number) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);

export const convertFromLei = (lei: number, prefs: CurrencyPrefs) =>
  prefs.currency === "EUR" ? lei / prefs.eurRate : lei;

// A per-viewer display preference, not sales data, so it may live in storage.
const STORAGE_KEY = "ags.currency";

function load(): CurrencyPrefs {
  const prefs: CurrencyPrefs = { currency: "RON", eurRate: DEFAULT_EUR_RATE };
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (typeof saved === "object" && saved !== null) {
      const { currency, eurRate } = saved as Partial<CurrencyPrefs>;
      if (currency === "EUR") prefs.currency = "EUR";
      if (typeof eurRate === "number" && isValidRate(eurRate))
        prefs.eurRate = eurRate;
    }
  } catch {
    // Blocked or corrupt storage: use the defaults.
  }
  return prefs;
}

let snapshot = load();
const listeners = new Set<() => void>();

function update(next: Partial<CurrencyPrefs>) {
  snapshot = { ...snapshot, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Keep the choice for this tab only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The display currency, with formatters that take lei amounts as Borg returns them. */
export function useCurrency() {
  const prefs = useSyncExternalStore(subscribe, () => snapshot);
  return useMemo(() => {
    const convert = (lei: number) => convertFromLei(lei, prefs);
    return {
      ...prefs,
      isDefaultRate: prefs.eurRate === DEFAULT_EUR_RATE,
      convert,
      money: (lei: number) => formatMoney(convert(lei), prefs.currency),
      compactMoney: (lei: number) =>
        formatCompactMoney(convert(lei), prefs.currency),
      setCurrency: (currency: Currency) => update({ currency }),
      setEurRate: (eurRate: number) => update({ eurRate }),
    };
  }, [prefs]);
}
