import { useEffect, useState } from "react";
import { ApiError, errorMessage, isAbort } from "../../api/client";
import type { Api } from "../../api/client";
import { getSales } from "../../api/endpoints";
import type { SalesQuery } from "../../api/types";
import { chunkRange, previousRange } from "../../lib/dates";
import type { DateRange } from "../../lib/dates";
import { normalizeLines } from "../../lib/sales";
import type { SaleLine } from "../../lib/sales";

/** Highest limit the backend accepts; a full page may mean truncated data. */
export const LINE_LIMIT = 50_000;

export interface Dataset {
  range: DateRange;
  lines: SaleLine[];
  /** Request intervals that returned exactly LINE_LIMIT lines. */
  truncated: DateRange[];
}

export interface SalesState {
  status: "idle" | "loading" | "ready" | "error";
  current?: Dataset;
  previous?: Dataset;
  error?: string;
  progress?: { done: number; total: number };
  loadedAt?: Date;
}

// In-memory only, per browser tab; cleared by refresh or "Reload from Borg".
const cache = new Map<string, Record<string, unknown>[]>();
const cacheKey = (query: SalesQuery) =>
  [
    query.targetEntity,
    query.from,
    query.to,
    query.docType ?? "",
    query.gestiune ?? "",
    query.includeTransfers ? 1 : 0,
  ].join("|");

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

async function fetchChunk(api: Api, query: SalesQuery, signal: AbortSignal) {
  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached) return cached;
  let rows: Record<string, unknown>[];
  try {
    rows = await getSales(api, { ...query, limit: LINE_LIMIT }, signal);
  } catch (error) {
    // Borg has intermittent 502/503s; retry once before failing the whole range.
    if (!(error instanceof ApiError) || ![502, 503].includes(error.status))
      throw error;
    await wait(1500, signal);
    rows = await getSales(api, { ...query, limit: LINE_LIMIT }, signal);
  }
  cache.set(key, rows);
  return rows;
}

export function useSalesData(
  api: Api,
  query: SalesQuery | null,
  compare: boolean,
  reloadToken: number,
) {
  const [state, setState] = useState<SalesState>({ status: "idle" });
  const key = query ? `${cacheKey(query)}|${compare}` : "";

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const { signal } = controller;
    const ranges = [
      { from: query.from, to: query.to },
      ...(compare ? [previousRange(query)] : []),
    ];
    const plans = ranges.map((range) => ({ range, chunks: chunkRange(range) }));
    const total = plans.reduce((sum, plan) => sum + plan.chunks.length, 0);
    let done = 0;
    setState((previous) => ({
      ...previous,
      status: "loading",
      error: undefined,
      progress: { done, total },
    }));

    (async () => {
      const datasets: Dataset[] = [];
      for (const plan of plans) {
        const rows: Record<string, unknown>[] = [];
        const truncated: DateRange[] = [];
        for (const chunk of plan.chunks) {
          const batch = await fetchChunk(api, { ...query, ...chunk }, signal);
          if (batch.length >= LINE_LIMIT) truncated.push(chunk);
          rows.push(...batch);
          done += 1;
          if (!signal.aborted)
            setState((previous) => ({
              ...previous,
              progress: { done, total },
            }));
        }
        datasets.push({
          range: plan.range,
          lines: normalizeLines(rows),
          truncated,
        });
      }
      if (signal.aborted) return;
      setState({
        status: "ready",
        current: datasets[0],
        previous: datasets[1],
        loadedAt: new Date(),
      });
    })().catch((error: unknown) => {
      if (isAbort(error) || signal.aborted) return;
      setState((previous) => ({
        ...previous,
        status: "error",
        error: errorMessage(error),
        progress: undefined,
      }));
    });
    return () => controller.abort();
    // `key` captures every query field; the object identity changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, reloadToken]);

  return state;
}

export function clearSalesCache() {
  cache.clear();
}
