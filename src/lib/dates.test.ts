import { describe, expect, it } from "vitest";
import {
  chunkRange,
  daysInclusive,
  presetRange,
  previousRange,
  weekStart,
} from "./dates";

describe("chunkRange", () => {
  it("keeps a range of up to 30 inclusive days in one request", () => {
    expect(chunkRange({ from: "2026-09-01", to: "2026-09-30" })).toEqual([
      { from: "2026-09-01", to: "2026-09-30" },
    ]);
    expect(chunkRange({ from: "2026-09-23", to: "2026-09-23" })).toEqual([
      { from: "2026-09-23", to: "2026-09-23" },
    ]);
  });

  it("splits longer ranges into consecutive, non-overlapping ≤30-day requests", () => {
    const chunks = chunkRange({ from: "2026-07-01", to: "2026-09-24" });
    expect(chunks).toEqual([
      { from: "2026-07-01", to: "2026-07-30" },
      { from: "2026-07-31", to: "2026-08-29" },
      { from: "2026-08-30", to: "2026-09-24" },
    ]);
    for (const chunk of chunks)
      expect(daysInclusive(chunk)).toBeLessThanOrEqual(30);
  });

  it("never crosses a calendar year, as the backend requires", () => {
    expect(chunkRange({ from: "2025-12-20", to: "2026-01-05" })).toEqual([
      { from: "2025-12-20", to: "2025-12-31" },
      { from: "2026-01-01", to: "2026-01-05" },
    ]);
  });

  it("handles leap days", () => {
    expect(chunkRange({ from: "2024-02-01", to: "2024-03-01" })).toEqual([
      { from: "2024-02-01", to: "2024-03-01" },
    ]);
    expect(daysInclusive({ from: "2024-02-01", to: "2024-03-01" })).toBe(30);
  });
});

describe("date helpers", () => {
  it("builds the previous period of equal length", () => {
    expect(previousRange({ from: "2026-09-01", to: "2026-09-24" })).toEqual({
      from: "2026-08-08",
      to: "2026-08-31",
    });
    expect(previousRange({ from: "2026-01-01", to: "2026-01-01" })).toEqual({
      from: "2025-12-31",
      to: "2025-12-31",
    });
  });

  it("resolves presets relative to today", () => {
    const today = "2026-09-24";
    expect(presetRange("last30", today)).toEqual({
      from: "2026-08-26",
      to: today,
    });
    expect(presetRange("thisMonth", today)).toEqual({
      from: "2026-09-01",
      to: today,
    });
    expect(presetRange("lastMonth", today)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(presetRange("lastMonth", "2026-03-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(presetRange("thisYear", today)).toEqual({
      from: "2026-01-01",
      to: today,
    });
  });

  it("finds the Monday of the week", () => {
    expect(weekStart("2026-09-24")).toBe("2026-09-21");
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
    expect(weekStart("2026-09-27")).toBe("2026-09-21");
  });
});
