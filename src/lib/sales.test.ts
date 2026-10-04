import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import {
  composition,
  discountPct,
  emptyRefine,
  groupLines,
  heatmap,
  lineLabel,
  marginPct,
  normalizeLine,
  normalizeLines,
  refineLines,
  salesAfterDiscounts,
  summarize,
  timeSeries,
} from "./sales";
import type { LineKind } from "./sales";

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
  businessValueKind: "sale",
};
const ofKind = (rows: ReturnType<typeof normalizeLines>, kind: LineKind) =>
  refineLines(rows, { ...emptyRefine, kind }).map((line) => line.id);

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
    gestiuneId: 3,
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
      groups[1]!.children!.map((child) => [
        child.key,
        child.name,
        child.metrics.net,
      ]),
    ).toEqual([
      ["id:3", "STOC", 200],
      ["id:2", "COPOU", 50],
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

describe("composition", () => {
  const gestiune = (id: number, net: number, marja: number | null = null) => ({
    ...base,
    miscareId: id * 10 + net,
    gestiuneId: id,
    depozit: `G${id}`,
    valoareNet: net,
    marja,
  });

  it("gives each gestiune its share of the total", () => {
    const { total, rows, segments } = composition(lines, "warehouse", "net");
    expect(total).toBe(550);
    expect(rows.map((row) => [row.name, row.value, row.slot])).toEqual([
      ["COPOU", 350, 0],
      ["STOC", 200, 1],
    ]);
    expect(rows[0]!.share).toBeCloseTo(63.64, 2);
    expect(segments.map((segment) => segment.name)).toEqual(["COPOU", "STOC"]);
  });

  it("folds everything past the third gestiune into one segment", () => {
    const five = normalizeLines(
      [50, 40, 30, 20, 10].map((net, index) => gestiune(index + 1, net)),
    );
    const { segments, folded } = composition(five, "warehouse", "net");
    expect(segments.map((segment) => [segment.key, segment.value])).toEqual([
      ["id:1", 50],
      ["id:2", 40],
      ["id:3", 30],
      ["__other", 30],
    ]);
    expect(folded).toBe(2);
  });

  it("keeps colors on the gestiune, not its rank, while refining", () => {
    const all = normalizeLines([gestiune(1, 500), gestiune(2, 300)]);
    const onlySecond = all.filter((line) => line.warehouseId === 2);
    const { rows } = composition(onlySecond, "warehouse", "net", all);
    expect(rows.map((row) => [row.key, row.slot])).toEqual([["id:2", 1]]);
  });

  it("drops the segments when a part is negative", () => {
    const mixed = normalizeLines([gestiune(1, 100, 30), gestiune(2, 50, -40)]);
    const { rows, segments, total } = composition(mixed, "warehouse", "margin");
    expect(total).toBe(-10);
    expect(rows.every((row) => row.share === null)).toBe(true);
    expect(segments).toEqual([]);
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
        filters: { warehouse: ["id:3"] },
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

describe("revenue groups", () => {
  it("uses the backend classification for grouping, filtering and returns", () => {
    const rows = normalizeLines([
      {
        ...base,
        miscareId: 1,
        grupa: "Utilaje",
        revenueGroupId: "utilaje",
        revenueGroupName: "Utilaje",
        valoareNet: 100,
      },
      {
        ...base,
        miscareId: 2,
        grupa: "Manipulare",
        revenueGroupId: "manopera",
        revenueGroupName: "Manoperă",
        valoareNet: 20,
      },
      {
        ...base,
        miscareId: 3,
        grupa: "Utilaje",
        revenueGroupId: "utilaje",
        revenueGroupName: "Utilaje",
        valoareNet: -10,
      },
    ]);
    expect(
      groupLines(rows, "revenueGroup", "net").map((group) => [
        group.key,
        group.metrics.net,
      ]),
    ).toEqual([
      ["utilaje", 90],
      ["manopera", 20],
    ]);
    expect(summarize(rows).net).toBe(110);
    expect(
      refineLines(rows, {
        search: "",
        kind: "all",
        filters: { revenueGroup: ["manopera"] },
      }).map((line) => line.id),
    ).toEqual(["2"]);
    expect(
      normalizeLine({ ...base, grupa: "Utilaje" }, 0)?.revenueGroupId,
    ).toBeNull();
  });
});

describe("product sales and separate discounts", () => {
  // The supplied September 1–29 Piese CSV snapshot. Test expectations only:
  // production always shows what the API returns.
  const september = normalizeLines([
    { ...base, miscareId: "1", tipDocument: "AIM", valoareNet: 5916626.47 },
    {
      ...base,
      miscareId: "2",
      documentId: 2,
      tipDocument: "AIMS",
      cantitate: -1,
      valoareNet: -528744.3,
    },
    {
      ...base,
      miscareId: "3",
      valoareNet: -229041.31,
      businessValueKind: "discount",
      discountInclusInLinii: false,
    },
    {
      ...base,
      miscareId: "4",
      documentId: 2,
      tipDocument: "AIMS",
      valoareNet: 1306.25,
      businessValueKind: "discount",
      discountInclusInLinii: false,
    },
  ]);

  it("matches the September snapshot to the cent", () => {
    const metrics = summarize(september);
    expect(metrics.productSales).toBe(5387882.17);
    expect(metrics.discounts).toBe(227735.06);
    expect(salesAfterDiscounts(metrics)).toBe(5160147.11);
    expect(metrics.discountsGranted).toBe(229041.31);
    expect(metrics.discountsReversed).toBe(1306.25);
    expect(metrics.discountTransactions).toBe(2);
    expect(discountPct(metrics)).toBeCloseTo((227735.06 / 5387882.17) * 100, 6);
    expect(metrics.net).toBe(5160147.11);
  });

  it("keeps product returns negative inside product sales", () => {
    const metrics = summarize(september);
    expect(metrics.returns).toBe(-528744.3);
    expect(metrics.returnLines).toBe(1);
    expect(ofKind(september, "returns")).toEqual(["2"]);
    expect(ofKind(september, "sales")).toEqual(["1"]);
    // A discount reversal is not a product return.
    expect(ofKind(september, "discounts")).toEqual(["3", "4"]);
  });

  it("lets discount reversals reduce the discount instead of adding to it", () => {
    const onlyReversal = summarize(september.filter((line) => line.id === "4"));
    expect(onlyReversal.discounts).toBe(-1306.25);
    expect(onlyReversal.discountsGranted).toBe(0);
    expect(lineLabel(september[2]!)).toBe("Discount acordat");
    expect(lineLabel(september[3]!)).toBe("Discount stornat");
  });

  it("adds sums in cents, without floating-point drift", () => {
    const cents = normalizeLines(
      [0.1, 0.2, 0.7].map((net, index) => ({
        ...base,
        miscareId: index,
        valoareNet: net,
      })),
    );
    expect(summarize(cents).productSales).toBe(1);
  });

  it("does not count discounts already included in product prices again", () => {
    const rows = normalizeLines([
      { ...base, miscareId: "p", cantitate: 1, valoareNet: 90 },
      {
        ...base,
        miscareId: "d",
        valoareNet: 0,
        valoareSalvata: 10,
        businessValueKind: "discount",
        discountInclusInLinii: true,
      },
    ]);
    const metrics = summarize(rows);
    expect(metrics.productSales).toBe(90);
    expect(metrics.discounts).toBe(0);
    expect(metrics.discountTransactions).toBe(0);
    expect(salesAfterDiscounts(metrics)).toBe(90);
    expect(ofKind(rows, "discounts")).toEqual(["d"]);
    expect(lineLabel(rows[1]!)).toBe("Discount inclus în preț");
    expect(rows[1]!.discountInLines).toBe(true);
    expect(normalizeLine(base, 0)!.discountInLines).toBeNull();
  });

  it("keeps services and unknown kinds out of product sales", () => {
    const rows = normalizeLines([
      { ...base, miscareId: "p", valoareNet: 100 },
      {
        ...base,
        miscareId: "s",
        grupa: "Manipulare",
        revenueGroupId: "manopera",
        revenueGroupName: "Manoperă",
        valoareNet: 40,
        businessValueKind: "special",
      },
      { ...base, miscareId: "u", valoareNet: 7, businessValueKind: "new-kind" },
      { ...base, miscareId: "m", valoareNet: 3, businessValueKind: undefined },
    ]);
    expect(rows.map((line) => line.kind)).toEqual([
      "sale",
      "special",
      "unclassified",
      "unclassified",
    ]);
    const metrics = summarize(rows);
    expect(metrics.productSales).toBe(100);
    expect(salesAfterDiscounts(metrics)).toBe(100);
    expect(metrics.special).toBe(40);
    expect(metrics.specialLines).toBe(1);
    expect(metrics.unclassified).toBe(10);
    expect(metrics.unclassifiedLines).toBe(2);
    expect(metrics.net).toBe(150);
    expect(ofKind(rows, "special")).toEqual(["s"]);
    expect(ofKind(rows, "unclassified")).toEqual(["u", "m"]);
    expect(ofKind(rows, "sales")).toEqual(["p"]);
    // Manoperă still reports its service revenue by revenue group.
    expect(
      groupLines(rows, "revenueGroup").find((group) => group.key === "manopera")
        ?.metrics.net,
    ).toBe(40);
  });

  it("keeps allocated discount shares as rows in AGS's revenue groups", () => {
    const share = {
      ...base,
      grupa: "Discounturi",
      businessValueKind: "discount",
      discountInclusInLinii: false,
      sourceMiscareId: 900,
    };
    const rows = normalizeLines([
      { ...base, miscareId: "1", revenueGroupId: "piese", valoareNet: 1000 },
      { ...base, miscareId: "2", revenueGroupId: "utilaje", valoareNet: 3000 },
      {
        ...share,
        miscareId: "900:piese",
        revenueGroupId: "piese",
        revenueGroupName: "Piese",
        valoareNet: -25,
        discountAllocation: { share: 0.25, basis: "valoareNet" },
      },
      {
        ...share,
        miscareId: "900:utilaje",
        revenueGroupId: "utilaje",
        revenueGroupName: "Utilaje",
        valoareNet: -75,
        discountAllocation: { share: 0.75, basis: "valoareNet" },
      },
    ]);
    expect(rows.map((line) => line.id)).toEqual([
      "1",
      "2",
      "900:piese",
      "900:utilaje",
    ]);
    expect(rows[2]).toMatchObject({
      sourceMovementId: "900",
      allocation: "share: 0.25; basis: valoareNet",
    });
    const metrics = summarize(rows);
    expect(metrics.discounts).toBe(100);
    expect(metrics.discountTransactions).toBe(1);
    expect(
      groupLines(rows, "revenueGroup").map((group) => [
        group.key,
        group.metrics.productSales,
        group.metrics.discounts,
      ]),
    ).toEqual([
      ["utilaje", 3000, 75],
      ["piese", 1000, 25],
    ]);
    expect(
      refineLines(rows, {
        ...emptyRefine,
        kind: "discounts",
        filters: { revenueGroup: ["piese"] },
      }).map((line) => line.id),
    ).toEqual(["900:piese"]);
  });
});
