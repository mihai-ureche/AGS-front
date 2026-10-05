import { ApiError } from "../../api/client";
import type { Api } from "../../api/client";
import { getMe, getSales } from "../../api/endpoints";
import type { SalesQuery } from "../../api/types";
import { chunkRange, previousRange } from "../../lib/dates";
import type { DateRange } from "../../lib/dates";
import { normalizeEntries, SALES_ACCOUNTS } from "../../lib/sales";
import type { SaleEntry } from "../../lib/sales";

export const ENTRY_LIMIT = 50_000;
export interface Dataset {
  range: DateRange;
  entries: SaleEntry[];
  /** Ledger entries on 707/709 that are not in the totals; see `normalizeEntries`. */
  ignored: number;
  /** Chunks where Borg hit its entry limit; totals over them are partial. */
  truncated: DateRange[];
}

/** One account's entries for one chunk, already reduced to what the totals use. */
interface Batch {
  entries: SaleEntry[];
  ignored: string[];
  truncated: boolean;
}

const cache = new Map<string, Batch>();
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

/**
 * What the user may read, as one string. The sales endpoint is checked by the
 * backend on every request, but cached chunks skip it, so they are only reused
 * while the user's role, permissions and entity grants are unchanged.
 */
async function accessVersion(api: Api, signal: AbortSignal) {
  const me = await getMe(api, signal);
  return JSON.stringify([
    me.tenantId,
    me.id,
    me.role,
    [...me.permissions].sort(),
    me.salesGroups,
    [...me.targetEntities].sort(),
    me.isActive,
  ]);
}

async function fetchBatch(
  api: Api,
  query: SalesQuery & { account: string },
  signal: AbortSignal,
): Promise<Batch> {
  const request = () => getSales(api, { ...query, limit: ENTRY_LIMIT }, signal);
  let response;
  try {
    response = await request();
  } catch (error) {
    if (!(error instanceof ApiError) || ![502, 503].includes(error.status))
      throw error;
    await wait(1500, signal);
    response = await request();
  }
  // The backend forwards Borg's JSON unchecked, so a format change arrives as-is.
  if (!Array.isArray(response?.entries))
    throw new ApiError(
      502,
      "Borg a returnat vânzările într-un format neașteptat.",
    );
  return {
    ...normalizeEntries(response.entries),
    // Only an explicit false proves the period is complete.
    truncated: response.meta?.truncated !== false,
  };
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
    const access = await accessVersion(api, signal);
    signal.throwIfAborted();
    const ranges = [
      { from: query.from, to: query.to },
      ...(compare ? [previousRange(query)] : []),
    ];
    const plans = ranges.map((range) => ({ range, chunks: chunkRange(range) }));
    const total =
      plans.reduce((sum, plan) => sum + plan.chunks.length, 0) *
      SALES_ACCOUNTS.length;
    let done = 0;
    onProgress({ done, total });
    const datasets: Dataset[] = [];
    for (const plan of plans) {
      // An entry touching both 707 and 709 comes back from both requests.
      const entries = new Map<string, SaleEntry>();
      const ignored = new Set<string>();
      const truncated: DateRange[] = [];
      for (const chunk of plan.chunks) {
        let incomplete = false;
        for (const account of SALES_ACCOUNTS) {
          signal.throwIfAborted();
          const chunkQuery = { ...query, ...chunk, account };
          const key = `${access}|${salesQueryKey(chunkQuery)}`;
          let batch = cache.get(key);
          if (!batch) {
            batch = await fetchBatch(api, chunkQuery, signal);
            signal.throwIfAborted();
            cache.set(key, batch);
            if (cache.size > 48) cache.delete(cache.keys().next().value!);
          }
          if (batch.truncated) incomplete = true;
          for (const entry of batch.entries) entries.set(entry.id, entry);
          for (const id of batch.ignored) ignored.add(id);
          onProgress({ done: ++done, total });
        }
        if (incomplete) truncated.push(chunk);
      }
      datasets.push({
        range: plan.range,
        entries: [...entries.values()],
        ignored: ignored.size,
        truncated,
      });
    }
    // Do not publish a long load or comparison after access changed.
    const latest = await accessVersion(api, signal);
    signal.throwIfAborted();
    if (latest !== access) {
      cache.clear();
      throw new ApiError(
        409,
        "Accesul dumneavoastră s-a schimbat. Reîncărcați datele.",
      );
    }
    return {
      current: datasets[0]!,
      previous: datasets[1],
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
