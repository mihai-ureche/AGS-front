import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes text and neutralizes spreadsheet formulas", () => {
    const csv = toCsv([
      ["Product", "Net"],
      ['=HYPERLINK("bad")', -12.5],
      ["Desk, large", null],
    ]);
    expect(csv.split("\r\n")).toEqual([
      '"Product","Net"',
      '"\'=HYPERLINK(""bad"")",-12.5',
      '"Desk, large",',
    ]);
  });
});
