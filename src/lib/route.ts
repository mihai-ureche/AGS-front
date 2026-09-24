import { useCallback, useSyncExternalStore } from "react";

export type Route = { page: string; params: URLSearchParams };

function read(): Route {
  const [path = "", query = ""] = window.location.hash
    .replace(/^#\/?/, "")
    .split("?");
  return { page: path.split("/")[0] ?? "", params: new URLSearchParams(query) };
}

let snapshot = { hash: window.location.hash, route: read() };
function getSnapshot() {
  if (snapshot.hash !== window.location.hash)
    snapshot = { hash: window.location.hash, route: read() };
  return snapshot.route;
}
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function hrefFor(
  page: string,
  params?: Record<string, string | undefined>,
) {
  const query = new URLSearchParams(
    Object.entries(params ?? {}).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
  return `#/${page}${query ? `?${query}` : ""}`;
}

export function useRoute() {
  const route = useSyncExternalStore(subscribe, getSnapshot);
  const navigate = useCallback(
    (
      page: string,
      params?: Record<string, string | undefined>,
      replace = false,
    ) => {
      const href = hrefFor(page, params);
      if (href === window.location.hash) return;
      if (replace) {
        window.history.replaceState(null, "", href);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else window.location.hash = href;
    },
    [],
  );
  return { ...route, navigate };
}
