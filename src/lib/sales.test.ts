import { describe, expect, it } from "vitest";
import {
  change,
  createSampleOrders,
  ordersCsv,
  periodOrders,
  summarize,
} from "./sales";
import type { Order } from "./sales";

const order: Order = {
  id: "AGS-1",
  customer: "Alex",
  email: "alex@example.com",
  product: "Keyboard",
  category: "Electronics",
  date: "2026-01-01",
  amount: 100,
  status: "Completed",
  channel: "Retail",
};

describe("sales reporting", () => {
  it("counts only completed revenue and calculates average from completed orders", () => {
    expect(
      summarize([
        order,
        { ...order, id: "AGS-2", amount: 500, status: "Refunded" },
        { ...order, id: "AGS-3", amount: 200, status: "Processing" },
      ]),
    ).toEqual({ revenue: 100, orders: 3, customers: 1, average: 100 });
    expect(summarize([])).toEqual({
      revenue: 0,
      orders: 0,
      customers: 0,
      average: 0,
    });
  });
  it("uses inclusive date boundaries and disjoint comparison periods across a year boundary", () => {
    const now = new Date(2026, 0, 3, 0, 0);
    const data = [
      "2025-12-20",
      "2025-12-21",
      "2025-12-27",
      "2025-12-28",
      "2026-01-03",
      "2026-01-04",
    ].map((date) => ({ ...order, date }));
    expect(periodOrders(data, 7, now).map((item) => item.date)).toEqual([
      "2025-12-28",
      "2026-01-03",
    ]);
    expect(periodOrders(data, 7, now, true).map((item) => item.date)).toEqual([
      "2025-12-21",
      "2025-12-27",
    ]);
  });
  it("avoids invalid comparisons when no previous revenue exists", () => {
    expect(change(100, 0)).toBeNull();
    expect(change(90, 100)).toBe(-10);
  });
  it("quotes CSV fields and neutralizes spreadsheet formulas", () => {
    const csv = ordersCsv([
      { ...order, customer: '=HYPERLINK("bad")', product: "Desk, large" },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"Desk, large"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
  it("provides unique, deterministic demo orders spanning both 90-day periods", () => {
    const now = new Date(2026, 8, 22);
    const orders = createSampleOrders(now);
    expect(orders).toEqual(createSampleOrders(now));
    expect(new Set(orders.map((item) => item.id)).size).toBe(orders.length);
    expect(
      periodOrders(orders, 90, now).length +
        periodOrders(orders, 90, now, true).length,
    ).toBe(orders.length);
  });
});
