import { describe, expect, it } from "vitest";
import {
  readParams,
  toQuery,
  validateCustomRange,
  writeParams,
} from "./params";

describe("sales URL params", () => {
  it("defaults to the current month without comparison", () => {
    const state = readParams(new URLSearchParams());
    expect(state.range).toBe("thisMonth");
    expect(state.compare).toBe(false);
    expect(state.group).toBe("all");
    expect(state.warehouse).toBe("all");
  });

  it("reads and writes the gestiune group, ignoring unknown ones", () => {
    for (const group of ["piese", "utilaje", "irigatii", "unassigned"]) {
      const state = readParams(new URLSearchParams(`group=${group}`));
      expect(state.group).toBe(group);
      expect(writeParams(state).group).toBe(group);
    }
    expect(readParams(new URLSearchParams("group=nope")).group).toBe("all");
    // Links from the first version of the groups.
    expect(readParams(new URLSearchParams("group=main")).group).toBe("all");
    expect(
      writeParams(readParams(new URLSearchParams())).group,
    ).toBeUndefined();
  });

  it("does not query again when only the group changes", () => {
    const params = new URLSearchParams("range=last7");
    expect(toQuery(readParams(params))).toEqual(
      toQuery(readParams(new URLSearchParams("range=last7&group=piese"))),
    );
  });

  it("round-trips a custom range", () => {
    const state = readParams(
      new URLSearchParams(
        "range=custom&from=2026-07-01&to=2026-09-24&compare=1",
      ),
    );
    expect(state).toMatchObject({
      range: "custom",
      from: "2026-07-01",
      to: "2026-09-24",
      compare: true,
    });
    expect(writeParams(state)).toEqual({
      range: "custom",
      from: "2026-07-01",
      to: "2026-09-24",
      compare: "1",
      group: undefined,
      warehouse: undefined,
    });
  });

  it("ignores parameters from the former product-line dashboard", () => {
    const state = readParams(
      new URLSearchParams(
        "entity=green&range=last7&doc=BFD&gestiune=2&transfers=1",
      ),
    );
    expect(state.range).toBe("last7");
    expect(writeParams(state)).toEqual({
      range: "last7",
      from: undefined,
      to: undefined,
      compare: undefined,
      group: undefined,
      warehouse: undefined,
    });
  });

  it("always queries Agritehnica", () => {
    expect(toQuery(readParams(new URLSearchParams("entity=green")))).toEqual({
      targetEntity: "agritehnica",
      from: expect.any(String),
      to: expect.any(String),
    });
  });

  it("round-trips depot filters without adding unsupported API filters", () => {
    for (const warehouse of ["2", "none"]) {
      const state = readParams(new URLSearchParams(`warehouse=${warehouse}`));
      expect(writeParams(state).warehouse).toBe(warehouse);
      expect(toQuery(state)).toEqual(
        toQuery(readParams(new URLSearchParams())),
      );
    }
    for (const warehouse of ["bad", "0", "-1", "1.5", "9007199254740992"])
      expect(
        readParams(new URLSearchParams(`warehouse=${warehouse}`)).warehouse,
      ).toBe("all");
  });

  it("clears depot filters that conflict with the selected group", () => {
    expect(
      readParams(new URLSearchParams("group=piese&warehouse=2")).warehouse,
    ).toBe(2);
    expect(
      readParams(new URLSearchParams("group=utilaje&warehouse=2")).warehouse,
    ).toBe("all");
    expect(
      readParams(new URLSearchParams("group=piese&warehouse=none")).warehouse,
    ).toBe("all");
    expect(
      readParams(new URLSearchParams("group=unassigned&warehouse=none"))
        .warehouse,
    ).toBe("none");
  });

  it("falls back to the default preset for invalid custom ranges", () => {
    const state = readParams(
      new URLSearchParams("range=custom&from=2026-09-30&to=2026-09-01"),
    );
    expect(state.range).toBe("thisMonth");
  });

  it("validates custom ranges", () => {
    expect(validateCustomRange("2026-01-01", "2026-12-31")).toBeNull();
    expect(validateCustomRange("2025-01-01", "2026-01-02")).toMatch(/cel mult/);
    expect(validateCustomRange("2026-02-30", "2026-03-01")).toMatch(/Alegeți/);
  });
});
