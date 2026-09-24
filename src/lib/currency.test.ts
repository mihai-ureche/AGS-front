import { describe, expect, it } from "vitest";
import { convertFromLei, formatRate, parseRate } from "./currency";
import { formatMoney, plural } from "./format";

describe("currency", () => {
  it("parses rates with a decimal comma or dot", () => {
    expect(parseRate("5,0975")).toBe(5.0975);
    expect(parseRate(" 4.97 ")).toBe(4.97);
    expect(parseRate("5")).toBe(5);
    expect(parseRate(formatRate(5.1))).toBe(5.1);
  });

  it("rejects empty, malformed and out-of-range rates", () => {
    for (const text of ["", "abc", "5,1,2", "-5", "0", "1000"])
      expect(parseRate(text)).toBeNull();
  });

  it("converts lei to euro at the chosen rate and leaves lei untouched", () => {
    expect(convertFromLei(510, { currency: "EUR", eurRate: 5.1 })).toBe(100);
    expect(convertFromLei(510, { currency: "RON", eurRate: 5.1 })).toBe(510);
  });

  it("formats amounts the Romanian way", () => {
    // Intl keeps the amount and symbol together with a no-break space.
    expect(formatMoney(1234.5, "RON")).toBe("1.234,50\u00a0lei");
    expect(formatMoney(1234.5, "EUR")).toBe("1.234,50\u00a0€");
  });
});

describe("plural", () => {
  it('adds Romanian "de" from 20 on, except after 01–19', () => {
    expect(plural(1, "linie", "linii")).toBe("1 linie");
    expect(plural(19, "linie", "linii")).toBe("19 linii");
    expect(plural(20, "linie", "linii")).toBe("20 de linii");
    expect(plural(101, "linie", "linii")).toBe("101 linii");
    expect(plural(1199, "linie", "linii")).toBe("1.199 de linii");
    expect(plural(0, "linie", "linii")).toBe("0 linii");
  });
});
