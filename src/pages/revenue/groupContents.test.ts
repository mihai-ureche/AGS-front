import { describe, expect, it } from "vitest";
import { normalizeLines } from "../../lib/sales";
import { summarizeGroups } from "./groupContents";

const line = (grupa: string, revenueGroupId: string | null) => ({
  data: "2026-09-01T00:00:00",
  grupa,
  revenueGroupId,
  revenueGroupName: revenueGroupId && revenueGroupId.toUpperCase(),
  valoareNet: 10,
});

describe("summarizeGroups", () => {
  const groups = [
    { id: "utilaje", name: "Utilaje" },
    { id: "piese", name: "Piese" },
  ];

  it("lists each group's distinct categories alphabetically", () => {
    const lines = normalizeLines([
      line("Rulmenti", "piese"),
      line("Utilaje", "utilaje"),
      line("Filtre", "piese"),
      line("Rulmenti", "piese"),
    ]);
    expect(summarizeGroups(lines, groups)).toEqual([
      { id: "utilaje", name: "UTILAJE", categories: ["Utilaje"] },
      { id: "piese", name: "PIESE", categories: ["Filtre", "Rulmenti"] },
    ]);
  });

  it("puts unclassified lines last", () => {
    const lines = normalizeLines([
      line("Filtre", null),
      line("Utilaje", "utilaje"),
    ]);
    expect(summarizeGroups(lines, groups).map((group) => group.name)).toEqual([
      "UTILAJE",
      "Fără grupă",
    ]);
  });
});
