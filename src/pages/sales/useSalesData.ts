import { useEffect, useState } from "react";
import { errorMessage, isAbort } from "../../api/client";
import type { Api } from "../../api/client";
import type { RevenueGroup, SalesQuery } from "../../api/types";
import { loadSales, salesQueryKey } from "./salesLoader";
import type { Dataset } from "./salesLoader";

export { clearSalesCache, LINE_LIMIT } from "./salesLoader";
export type { Dataset } from "./salesLoader";

export interface SalesState {
  status: "idle" | "loading" | "ready" | "error";
  current?: Dataset;
  previous?: Dataset;
  groups?: RevenueGroup[];
  error?: string;
  progress?: { done: number; total: number };
  loadedAt?: Date;
}

export function useSalesData(
  api: Api,
  query: SalesQuery | null,
  compare: boolean,
  reloadToken: number,
): SalesState {
  const [state, setState] = useState<SalesState & { requestKey?: string }>({
    status: "idle",
  });
  const [focusToken, setFocusToken] = useState(0);
  const key = query
    ? `${salesQueryKey(query)}|${compare}|${reloadToken}|${focusToken}`
    : "";

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        setFocusToken((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setState({ status: "loading", requestKey: key });
    loadSales(api, query, compare, controller.signal, (progress) => {
      if (!controller.signal.aborted)
        setState({ status: "loading", requestKey: key, progress });
    })
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ ...result, status: "ready", requestKey: key });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setState({
          status: "error",
          requestKey: key,
          error: errorMessage(error),
        });
      });
    return () => controller.abort();
    // key captures the query, comparison, reload and focus state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key]);

  // Hide previous data immediately when switching query, before effects run.
  return state.requestKey === key ? state : { status: "loading" };
}
