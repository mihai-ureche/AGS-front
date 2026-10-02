import { ApiError } from "../../api/client";
import type { Api } from "../../api/client";
import { getSales, getSalesAccess } from "../../api/endpoints";
import type {
  SalesQuery,
  SalesReconciliation,
  SalesResponse,
} from "../../api/types";
import { chunkRange, previousRange } from "../../lib/dates";
import type { DateRange } from "../../lib/dates";
import { normalizeLines } from "../../lib/sales";
import type { SaleLine } from "../../lib/sales";

export const LINE_LIMIT = 50_000;
export interface Dataset {
  range: DateRange;
  lines: SaleLine[];
  truncated: DateRange[];
  reconciliations: SalesReconciliation[];
}

const cache = new Map<string, SalesResponse>();
const requests = new Set<AbortController>();
export function clearSalesCache() {
  for (const request of requests) request.abort();
  cache.clear();
}

export const salesQueryKey = (query: SalesQuery) => JSON.stringify(query);

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function loadSales(
  api: Api,
  query: SalesQuery,
  compare: boolean,
  parentSignal: AbortSignal,
  onProgress: (progress: { done: number; total: number }) => void,
) {
  const controller = new AbortController();
  const { signal } = controller;
  const abort = () => controller.abort();
  parentSignal.throwIfAborted();
  parentSignal.addEventListener("abort", abort, { once: true });
  requests.add(controller);
  try {
    // Recheck access even when every chunk is cached.
    const access = await getSalesAccess(api, query.targetEntity, signal);
    signal.throwIfAborted();
    const checkVersion = (version: string) => {
      if (version !== access.accessVersion) {
        cache.clear();
        throw new ApiError(
          409,
          "Accesul sau grupele de venit s-au schimbat. Reîncărcați datele.",
        );
      }
    };
    const ranges = [
      { from: query.from, to: query.to },
      ...(compare ? [previousRange(query)] : []),
    ];
    const plans = ranges.map((range) => ({ range, chunks: chunkRange(range) }));
    const total = plans.reduce((sum, plan) => sum + plan.chunks.length, 0);
    let done = 0;
    onProgress({ done, total });
    const datasets: Dataset[] = [];
    for (const plan of plans) {
      const rows: Record<string, unknown>[] = [];
      const truncated: DateRange[] = [];
      const reconciliations = new Map<string, SalesReconciliation>();
      for (const chunk of plan.chunks) {
        signal.throwIfAborted();
        const chunkQuery = { ...query, ...chunk };
        const key = `${access.accessVersion}|${salesQueryKey(chunkQuery)}`;
        let batch = cache.get(key);
        if (!batch) {
          try {
            batch = await getSales(
              api,
              { ...chunkQuery, limit: LINE_LIMIT },
              signal,
            );
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              ![502, 503].includes(error.status)
            )
              throw error;
            await wait(1500, signal);
            batch = await getSales(
              api,
              { ...chunkQuery, limit: LINE_LIMIT },
              signal,
            );
          }
          signal.throwIfAborted();
          checkVersion(batch.accessVersion);
          cache.set(key, batch);
          if (cache.size > 24) cache.delete(cache.keys().next().value!);
        }
        if (batch.possiblyTruncated) truncated.push(chunk);
        rows.push(...batch.lines);
        for (const report of batch.reconciliations ?? []) {
          reconciliations.set(
            `${report.groupId}:${report.month}:${report.revision}`,
            report,
          );
        }
        onProgress({ done: ++done, total });
      }
      datasets.push({
        range: plan.range,
        lines: normalizeLines(rows),
        truncated,
        reconciliations: [...reconciliations.values()],
      });
    }
    // Do not publish a long load or comparison after access/config changed.
    const latest = await getSalesAccess(api, query.targetEntity, signal);
    signal.throwIfAborted();
    checkVersion(latest.accessVersion);
    return {
      current: datasets[0]!,
      previous: datasets[1],
      groups: access.groups,
      loadedAt: new Date(),
    };
  } catch (error) {
    if (!signal.aborted) cache.clear();
    throw error;
  } finally {
    requests.delete(controller);
    parentSignal.removeEventListener("abort", abort);
  }
}
