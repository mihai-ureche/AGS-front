import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { Api } from "../../api/client";
import type { Me, SalesQuery } from "../../api/types";
import { clearSalesCache, loadSales } from "./salesLoader";

const query: SalesQuery = {
  targetEntity: "agritehnica",
  from: "2026-09-01",
  to: "2026-09-02",
};
const entry = (id: number, fields: Record<string, unknown> = {}) => ({
  id,
  dataInregistrare: "2026-09-01T00:00:00.000Z",
  documentId: id,
  tipDocument: "FC",
  gestiuneId: 6,
  depozit: "DEPOZIT BRAILA",
  contDebit: "4111.G",
  contCredit: "707.G.06",
  suma: 100,
  ...fields,
});
const discount = (id: number) =>
  entry(id, {
    contDebit: "709.Discount.06",
    contCredit: "4111.G",
    suma: 10,
  });

function mockApi() {
  const state = {
    me: {
      tenantId: "t",
      id: "user-a",
      role: "sales",
      permissions: ["sales:read"],
      salesGroups: null,
      targetEntities: ["agritehnica"],
      isActive: true,
    } as unknown as Me,
    denied: false,
    truncated: false as boolean | undefined,
    entries: {
      "707": [entry(1)],
      "709": [discount(2)],
    } as Record<string, Record<string, unknown>[]>,
  };
  const get = vi.fn(
    async (path: string, options?: { query?: Record<string, unknown> }) => {
      if (state.denied) throw new ApiError(403, "Access revoked");
      if (path === "/api/me") return { user: state.me };
      return {
        meta: { truncated: state.truncated },
        entries: state.entries[String(options?.query?.account)],
      };
    },
  );
  const api = { get } as unknown as Api;
  return { api, get, state };
}
const calls = (get: ReturnType<typeof mockApi>["get"], path: string) =>
  get.mock.calls.filter(([called]) => called === path);
const load = (api: Api, compare = false, range: SalesQuery = query) =>
  loadSales(api, range, compare, new AbortController().signal, () => {});
afterEach(() => {
  clearSalesCache();
  vi.useRealTimers();
});

describe("loadSales", () => {
  it("requests accounts 707 and 709 and nothing the backend rejects", async () => {
    const { api, get } = mockApi();
    const { current } = await load(api);
    const sales = calls(get, "/api/borg/sales");
    expect(sales).toHaveLength(2);
    expect(sales.map(([, options]) => options?.query)).toEqual([
      {
        targetEntity: "agritehnica",
        from: "2026-09-01",
        to: "2026-09-02",
        account: "707",
        limit: 50_000,
      },
      {
        targetEntity: "agritehnica",
        from: "2026-09-01",
        to: "2026-09-02",
        account: "709",
        limit: 50_000,
      },
    ]);
    expect(current.entries.map((item) => [item.id, item.kind])).toEqual([
      ["1", "sale"],
      ["2", "discount"],
    ]);
    expect(current.truncated).toEqual([]);
  });

  it("counts an entry once when both requests return it", async () => {
    const { api, state } = mockApi();
    const both = entry(5, {
      contDebit: "709.Discount.06",
      contCredit: "707.G.06",
    });
    state.entries = { "707": [both], "709": [both] };
    const { current } = await load(api);
    expect(current.entries).toHaveLength(1);
  });

  it("splits long ranges into 30-day requests per account and reports progress", async () => {
    const { api, get } = mockApi();
    const progress: number[] = [];
    const result = await loadSales(
      api,
      { ...query, from: "2026-08-01", to: "2026-09-15" },
      false,
      new AbortController().signal,
      ({ done, total }) => progress.push(done, total),
    );
    expect(
      calls(get, "/api/borg/sales").map(
        ([, options]) =>
          `${options?.query?.from}..${options?.query?.to}:${options?.query?.account}`,
      ),
    ).toEqual([
      "2026-08-01..2026-08-30:707",
      "2026-08-01..2026-08-30:709",
      "2026-08-31..2026-09-15:707",
      "2026-08-31..2026-09-15:709",
    ]);
    expect(progress.slice(0, 2)).toEqual([0, 4]);
    expect(progress.slice(-2)).toEqual([4, 4]);
    // The same entries come back for every chunk; they are one ledger.
    expect(result.current.entries).toHaveLength(2);
  });

  it("loads the previous period of equal length when comparing", async () => {
    const { api, get } = mockApi();
    const { previous } = await load(api, true);
    expect(previous?.range).toEqual({ from: "2026-08-30", to: "2026-08-31" });
    expect(calls(get, "/api/borg/sales")).toHaveLength(4);
  });

  it("revalidates access before cached reads and never shares chunks between scopes", async () => {
    const { api, get, state } = mockApi();
    await load(api);
    await load(api);
    expect(calls(get, "/api/borg/sales")).toHaveLength(2);
    expect(calls(get, "/api/me")).toHaveLength(4);
    state.me = { ...state.me, id: "user-b" };
    state.entries = { "707": [entry(9, { suma: 25 })], "709": [] };
    expect((await load(api)).current.entries[0]?.amount).toBe(25);
    expect(calls(get, "/api/borg/sales")).toHaveLength(4);
    state.denied = true;
    await expect(load(api)).rejects.toMatchObject({ status: 403 });
  });

  it("treats a changed role or entity grant as a different scope", async () => {
    const { api, get, state } = mockApi();
    await load(api);
    state.me = {
      ...state.me,
      permissions: ["sales:read", "stock:read"] as never,
    };
    await load(api);
    expect(calls(get, "/api/borg/sales")).toHaveLength(4);
  });

  it("flags truncation unless Borg says the period is complete", async () => {
    const { api, state } = mockApi();
    state.truncated = true;
    expect((await load(api)).current.truncated).toEqual([
      { from: query.from, to: query.to },
    ]);
    clearSalesCache();
    state.truncated = undefined;
    expect((await load(api)).current.truncated).toHaveLength(1);
    clearSalesCache();
    state.truncated = false;
    expect((await load(api)).current.truncated).toHaveLength(0);
  });

  it("counts entries it cannot place, once, without adding them to the totals", async () => {
    const { api, state } = mockApi();
    const closing = entry(7, { contDebit: "707.G.06", contCredit: "121" });
    state.entries = { "707": [entry(1), closing], "709": [closing] };
    const { current } = await load(api);
    expect(current.entries).toHaveLength(1);
    expect(current.ignored).toBe(1);
  });

  it("rejects a response in an unexpected format", async () => {
    const { api, state } = mockApi();
    state.entries = { "707": "nope" as never, "709": [] };
    await expect(load(api)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("format neașteptat"),
    });
  });

  it("retries once after a temporary Borg failure", async () => {
    vi.useFakeTimers();
    const { api, get } = mockApi();
    let failed = false;
    const original = get.getMockImplementation()!;
    get.mockImplementation(async (path, options) => {
      if (path === "/api/borg/sales" && !failed) {
        failed = true;
        throw new ApiError(503, "Borg is busy");
      }
      return original(path, options);
    });
    const result = load(api);
    await vi.advanceTimersByTimeAsync(1500);
    expect((await result).current.entries).toHaveLength(2);
    expect(calls(get, "/api/borg/sales")).toHaveLength(3);
  });

  it("does not retry other failures", async () => {
    const { api, get } = mockApi();
    get.mockImplementation(async (path) => {
      if (path === "/api/me") return { user: mockApi().state.me };
      throw new ApiError(403, "Forbidden");
    });
    await expect(load(api)).rejects.toMatchObject({ status: 403 });
    expect(calls(get, "/api/borg/sales")).toHaveLength(1);
  });

  it("rejects changed access during a load before publishing a result", async () => {
    const { api, get, state } = mockApi();
    const original = get.getMockImplementation()!;
    get.mockImplementation(async (path, options) => {
      const result = await original(path, options);
      if (path === "/api/borg/sales" && options?.query?.account === "709")
        state.me = { ...state.me, role: "revoked-after-fetch" };
      return result;
    });
    await expect(load(api)).rejects.toMatchObject({ status: 409 });
    // Nothing from the stale scope is reused.
    get.mockImplementation(original);
    await load(api);
    expect(calls(get, "/api/borg/sales")).toHaveLength(4);
  });

  it("does not cache or publish a late response after logout clears sales", async () => {
    const { api, get } = mockApi();
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetching = new Promise<void>((resolve) => {
      started = resolve;
    });
    const original = get.getMockImplementation()!;
    get.mockImplementation(async (path, options) => {
      if (path === "/api/borg/sales") {
        started();
        await pending;
      }
      return original(path, options);
    });
    const result = load(api);
    const rejection = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await fetching;
    clearSalesCache();
    release();
    await rejection;
    get.mockImplementation(original);
    await load(api);
    expect(calls(get, "/api/borg/sales").length).toBeGreaterThanOrEqual(3);
  });
});
