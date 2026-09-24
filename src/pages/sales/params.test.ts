import { describe, expect, it } from "vitest";
import { readParams, validateCustomRange, writeParams } from "./params";

describe("sales URL params", () => {
  it("defaults to the first granted entity and the last 30 days", () => {
    const state = readParams(new URLSearchParams(), ["green", "babyhub"])!;
    expect(state.entity).toBe("green");
    expect(state.range).toBe("last30");
    expect(state.compare).toBe(false);
  });

  it("ignores entities the user is not granted", () => {
    expect(
      readParams(new URLSearchParams("entity=agritehnica"), ["babyhub"])!
        .entity,
    ).toBe("babyhub");
    expect(readParams(new URLSearchParams(), [])).toBeNull();
  });

  it("round-trips a custom range and filters", () => {
    const params = new URLSearchParams(
      "entity=babyhub&range=custom&from=2026-07-01&to=2026-09-24&doc=BFD&gestiune=2&transfers=1&compare=1",
    );
    const state = readParams(params, ["babyhub"])!;
    expect(state).toMatchObject({
      from: "2026-07-01",
      to: "2026-09-24",
      docType: "BFD",
      gestiune: 2,
      transfers: true,
      compare: true,
    });
    expect(writeParams(state)).toEqual({
      entity: "babyhub",
      range: "custom",
      from: "2026-07-01",
      to: "2026-09-24",
      doc: "BFD",
      gestiune: "2",
      transfers: "1",
      compare: "1",
    });
  });

  it("falls back to the default preset for invalid custom ranges and filters", () => {
    const state = readParams(
      new URLSearchParams(
        "range=custom&from=2026-09-30&to=2026-09-01&doc=FC&gestiune=-1",
      ),
      ["babyhub"],
    )!;
    expect(state.range).toBe("last30");
    expect(state.docType).toBeUndefined();
    expect(state.gestiune).toBeUndefined();
  });

  it("validates custom ranges", () => {
    expect(validateCustomRange("2026-01-01", "2026-12-31")).toBeNull();
    expect(validateCustomRange("2025-01-01", "2026-01-02")).toMatch(/cel mult/);
    expect(validateCustomRange("2026-02-30", "2026-03-01")).toMatch(/Alegeți/);
  });
});
