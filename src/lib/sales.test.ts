import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import {
  groupLines,
  heatmap,
  marginPct,
  normalizeLine,
  normalizeLines,
  refineLines,
  summarize,
  timeSeries,
} from "./sales";

const base = {
  documentId: 2157,
  miscareId: 1,
  tipDocument: "BFD",
  canal: "retail",
  serie: "BF",
  numar: 10,
  data: "2026-09-01T00:00:00",
  oraDocument: "2026-09-01T14:23:00",
  gestiuneId: 2,
  depozit: "COPOU",
  client: "Persoana fizica",
  codProdus: "P-1",
  produs: "Scutece 4",
  grupa: "Scutece",
  um: "buc",
  cantitate: 2,
  valoareNet: 100,
  valoareTVA: 19,
  valoareTotal: 119,
  costTotal: 70,
  marja: 30,
  facturaSerie: null,
};

describe("normalizeLine", () => {
  it("maps Borg fields and keeps nullable values", () => {
    const line = normalizeLine(base, 0)!;
    expect(line).toMatchObject({
      id: "1",
      documentId: "2157",
      docType: "BFD",
      date: "2026-09-01",
      hour: 14,
      warehouse: "COPOU",
      product: "Scutece 4",
      productCode: "P-1",
      quantity: 2,
      net: 100,
      vat: 19,
      gross: 119,
      cost: 70,
      margin: 30,
      invoice: null,
    });
  });

  it("accepts numeric strings and derives missing gross and margin", () => {
    const line = normalizeLine(
      {
        ...base,
        valoareNet: "50.5",
        valoareTotal: undefined,
        valoareTVA: "9.5",
        marja: undefined,
        costTotal: "40",
      },
      0,
    )!;
    expect(line.net).toBe(50.5);
    expect(line.gross).toBe(60);
    expect(line.margin).toBe(10.5);
  });

  it("drops lines without a date or net value and tolerates missing times", () => {
    expect(normalizeLine({ ...base, data: null }, 0)).toBeNull();
    expect(normalizeLine({ ...base, valoareNet: "n/a" }, 0)).toBeNull();
    expect(normalizeLine({ ...base, oraDocument: null }, 0)!.hour).toBeNull();
  });
});

const lines = normalizeLines([
  base,
  {
    ...base,
    miscareId: 2,
    codProdus: "P-2",
    produs: "Lapte praf",
    grupa: "Hrana",
    valoareNet: 300,
    valoareTotal: 357,
    marja: null,
    costTotal: null,
  },
  {
    ...base,
    miscareId: 3,
    documentId: 2158,
    depozit: "STOC",
    tipDocument: "AIM",
    data: "2026-09-02",
    oraDocument: "2026-09-02T09:05:00",
    valoareNet: 200,
    valoareTotal: 238,
    marja: 50,
  },
  // A return on the first document.
  {
    ...base,
    miscareId: 4,
    cantitate: -1,
    valoareNet: -50,
    valoareTotal: -59.5,
    marja: -15,
  },
]);

describe("metrics", () => {
  it("sums values, counts distinct documents and tracks returns", () => {
    const totals = summarize(lines);
    expect(totals.net).toBe(550);
    expect(totals.documents).toBe(2);
    expect(totals.lines).toBe(4);
    expect(totals.returns).toBe(-50);
    expect(totals.returnLines).toBe(1);
  });

  it("computes margin % only over lines with a known margin", () => {
    const totals = summarize(lines);
    expect(totals.margin).toBe(65);
    expect(totals.marginBase).toBe(250);
    expect(marginPct(totals)).toBe(26);
    expect(marginPct(summarize([]))).toBeNull();
  });
});

describe("grouping", () => {
  it("groups by a dimension, largest first, with nested groups", () => {
    const groups = groupLines(lines, "category", "net", "warehouse");
    expect(groups.map((group) => [group.key, group.metrics.net])).toEqual([
      ["Hrana", 300],
      ["Scutece", 250],
    ]);
    expect(
      groups[1]!.children!.map((child) => [child.key, child.metrics.net]),
    ).toEqual([
      ["STOC", 200],
      ["COPOU", 50],
    ]);
  });

  it("groups clients by Borg client ID, so namesakes stay apart", () => {
    const clients = normalizeLines([
      {
        ...base,
        miscareId: 10,
        clientId: 7,
        client: "Agro SRL",
        valoareNet: 10,
      },
      {
        ...base,
        miscareId: 11,
        clientId: 7,
        client: "Agro SRL",
        valoareNet: 5,
      },
      {
        ...base,
        miscareId: 12,
        clientId: 8,
        client: "Agro SRL",
        clientCodFiscal: "RO123",
        valoareNet: 40,
      },
    ]);
    expect(
      groupLines(clients, "client").map((group) => [
        group.key,
        group.name,
        group.metrics.net,
      ]),
    ).toEqual([
      ["id:8", "Agro SRL · RO123", 40],
      ["id:7", "Agro SRL", 15],
    ]);
    expect(
      refineLines(clients, {
        search: "",
        kind: "all",
        filters: { client: ["id:7"] },
      }).map((line) => line.id),
    ).toEqual(["10", "11"]);
  });

  it("keeps time dimensions in calendar order", () => {
    expect(groupLines(lines, "day").map((group) => group.key)).toEqual([
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("refineLines", () => {
  it("filters by dimension values, line kind and search terms", () => {
    expect(
      refineLines(lines, { search: "", kind: "returns", filters: {} }).map(
        (line) => line.id,
      ),
    ).toEqual(["4"]);
    expect(
      refineLines(lines, {
        search: "",
        kind: "sales",
        filters: { warehouse: ["STOC"] },
      }).map((line) => line.id),
    ).toEqual(["3"]);
    expect(
      refineLines(lines, { search: "lapte P-2", kind: "all", filters: {} }).map(
        (line) => line.id,
      ),
    ).toEqual(["2"]);
  });
});

describe("timeSeries", () => {
  const range = { from: "2026-09-01", to: "2026-09-03" };

  it("plots every day in the range, including empty ones", () => {
    expect(
      timeSeries(lines, range, "net").map((point) => [point.key, point.value]),
    ).toEqual([
      ["2026-09-01", 350],
      ["2026-09-02", 200],
      ["2026-09-03", 0],
    ]);
  });

  it("splits into the chosen series and folds the rest into other", () => {
    const [first] = timeSeries(lines, range, "net", {
      split: "category",
      splitKeys: ["Hrana"],
    });
    expect(first).toMatchObject({ "s:Hrana": 300, other: 50 });
  });

  it("aligns the previous period by position", () => {
    const previous = {
      lines: normalizeLines([{ ...base, data: "2026-08-29" }]),
      range: { from: "2026-08-29", to: "2026-08-31" },
    };
    const points = timeSeries(lines, range, "net", { previous });
    expect(points.map((point) => point.previous)).toEqual([100, 0, 0]);
  });
});

describe("heatmap", () => {
  it("places values by weekday and hour", () => {
    const map = heatmap(lines, "net");
    // 2026-09-01 is a Tuesday (index 1).
    expect(map.values[1]![14]).toBe(350);
    expect(map.values[2]![9]).toBe(200);
    expect(map.distinctHours).toBe(2);
  });
});

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
