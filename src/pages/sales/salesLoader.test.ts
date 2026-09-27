import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { Api } from "../../api/client";
import type { SalesQuery } from "../../api/types";
import { clearSalesCache, loadSales } from "./salesLoader";

const query: SalesQuery = {
  targetEntity: "agritehnica",
  from: "2026-09-01",
  to: "2026-09-02",
};
const raw = {
  data: "2026-09-01",
  valoareNet: 100,
  miscareId: 1,
  revenueGroupId: "utilaje",
  revenueGroupName: "Utilaje",
};
function mockApi() {
  const state = {
    version: "user-a-all-v1",
    denied: false,
    truncated: false,
    lines: [raw],
  };
  const get = vi.fn(async (path: string) => {
    if (state.denied) throw new ApiError(403, "Access revoked");
    return path === "/api/revenue-groups"
      ? {
          accessVersion: state.version,
          groups: [{ id: "utilaje", name: "Utilaje" }],
        }
      : {
          accessVersion: state.version,
          lines: state.lines,
          possiblyTruncated: state.truncated,
        };
  });
  const api = { get } as unknown as Api;
  return { api, get, state };
}
const load = (api: Api, compare = false) =>
  loadSales(api, query, compare, new AbortController().signal, () => {});
afterEach(clearSalesCache);

describe("sales cache and access", () => {
  it("revalidates access before cached reads and never shares chunks between scopes", async () => {
    const { api, get, state } = mockApi();
    await load(api);
    await load(api);
    expect(
      get.mock.calls.filter(([path]) => path === "/api/borg/sales"),
    ).toHaveLength(1);
    expect(
      get.mock.calls.filter(([path]) => path === "/api/revenue-groups"),
    ).toHaveLength(4);
    state.version = "user-b-utilaje-v1";
    state.lines = [{ ...raw, valoareNet: 25 }];
    expect((await load(api)).current.lines[0]?.net).toBe(25);
    expect(
      get.mock.calls.filter(([path]) => path === "/api/borg/sales"),
    ).toHaveLength(2);
    state.denied = true;
    await expect(load(api)).rejects.toMatchObject({ status: 403 });
  });

  it("keeps upstream truncation warnings even when only one authorized row remains", async () => {
    const { api, state } = mockApi();
    state.truncated = true;
    const result = await load(api);
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.truncated).toEqual([
      { from: query.from, to: query.to },
    ]);
  });

  it("rejects changed policy during a comparison or before publishing a result", async () => {
    const { api, get, state } = mockApi();
    let salesCalls = 0;
    get.mockImplementation(async (path) => {
      if (path === "/api/revenue-groups")
        return { accessVersion: state.version, groups: [] };
      salesCalls++;
      if (salesCalls === 2) state.version = "new-scope";
      return {
        accessVersion: state.version,
        lines: state.lines,
        possiblyTruncated: false,
      };
    });
    await expect(load(api, true)).rejects.toMatchObject({ status: 409 });
    clearSalesCache();
    get.mockImplementation(async (path) => {
      if (path === "/api/revenue-groups")
        return { accessVersion: state.version, groups: [] };
      const old = state.version;
      state.version = "revoked-after-fetch";
      return {
        accessVersion: old,
        lines: state.lines,
        possiblyTruncated: false,
      };
    });
    await expect(load(api)).rejects.toMatchObject({ status: 409 });
  });

  it("does not cache or publish a late response after logout clears sales", async () => {
    const { api, get, state } = mockApi();
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetching = new Promise<void>((resolve) => {
      started = resolve;
    });
    get.mockImplementation(async (path) => {
      if (path === "/api/revenue-groups")
        return { accessVersion: state.version, groups: [] };
      started();
      await pending;
      return {
        accessVersion: state.version,
        lines: state.lines,
        possiblyTruncated: false,
      };
    });
    const result = load(api);
    const rejection = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await fetching;
    clearSalesCache();
    release();
    await rejection;
    await load(api);
    expect(
      get.mock.calls.filter(([path]) => path === "/api/borg/sales"),
    ).toHaveLength(2);
  });
});
