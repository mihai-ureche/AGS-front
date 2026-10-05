import { describe, expect, it } from "vitest";
import {
  composition,
  discountPct,
  groupChoices,
  groupEntries,
  inGroup,
  normalizeEntries,
  normalizeEntry,
  salesAfterDiscounts,
  salesGroupOf,
  salesGroups,
  summarize,
  timeSeries,
} from "./sales";
import type { GroupFilter } from "./sales";

// Shaped like live Borg ledger entries; every value is invented.
let nextId = 1;
const entry = (fields: Record<string, unknown> = {}) => ({
  id: nextId++,
  dataInregistrare: "2026-09-01T00:00:00.000Z",
  dataDocument: "2026-09-01T00:00:00.000Z",
  tipCompunere: 11,
  tipDocument: "FC",
  numarDocument: "BRAT.1.BR",
  documentId: 100,
  gestiuneId: 6,
  depozit: "DEPOZIT BRAILA",
  contDebit: "4111.G",
  contCredit: "707.G.06",
  suma: 100,
  sumaValuta: 100,
  curs: 1,
  ...fields,
});
const sale = (fields?: Record<string, unknown>) => entry(fields);
const discount707 = (suma: number, fields?: Record<string, unknown>) =>
  entry({ contCredit: "707.Discount.06", suma, ...fields });
const discount709 = (suma: number, fields?: Record<string, unknown>) =>
  entry({
    contDebit: "709.Discount.06",
    contCredit: "4111.G",
    suma,
    ...fields,
  });
const normalize = (rows: Record<string, unknown>[]) =>
  normalizeEntries(rows).entries;

describe("normalizeEntry", () => {
  it("reads a sale from a credit on 707 and names its gestiune", () => {
    expect(normalizeEntry(sale({ id: 7, suma: 943.5 }))).toEqual({
      id: "7",
      documentId: "100",
      docType: "FC",
      number: "BRAT.1.BR",
      date: "2026-09-01",
      warehouseId: 6,
      warehouse: "DEPOZIT BRAILA",
      clientId: null,
      client: "Fără client",
      clientTaxId: null,
      description: null,
      account: "707.G.06",
      kind: "sale",
      amount: 943.5,
    });
  });

  it("keeps storno negative and delivery notes on 418 as sales", () => {
    expect(
      normalizeEntry(sale({ tipDocument: "FCS", suma: -250.25 }))?.amount,
    ).toBe(-250.25);
    expect(
      normalizeEntry(sale({ tipDocument: "AIM", contDebit: "418.G" }))?.kind,
    ).toBe("sale");
  });

  it("turns the negative 707.Discount credit into a positive discount", () => {
    expect(normalizeEntry(discount707(-120.5))).toMatchObject({
      kind: "discount",
      account: "707.Discount.06",
      amount: 120.5,
    });
    // A positive amount there reverses a discount.
    expect(normalizeEntry(discount707(20))?.amount).toBe(-20);
  });

  it("reads a debit on 709 as a discount", () => {
    expect(normalizeEntry(discount709(615.88))).toMatchObject({
      kind: "discount",
      account: "709.Discount.06",
      amount: 615.88,
    });
  });

  it("does not match other revenue, VAT, cost or the document total line", () => {
    for (const fields of [
      { contCredit: "704.G.06" },
      { contCredit: "7588.G.06" },
      { contCredit: "4427" },
      { contDebit: "607.G.06", contCredit: "371.G.06" },
      // The total line of a sale document has no credit account.
      { tipCompunere: 10, contCredit: null, suma: 565.55 },
    ])
      expect(normalizeEntry(entry(fields))).toBeNull();
  });

  it("uses the amount in lei and the posting date", () => {
    const foreign = normalizeEntry(
      sale({
        suma: 92.16,
        sumaValuta: 17.4592,
        curs: 5.2788,
        dataInregistrare: "2026-09-10T00:00:00.000Z",
        dataDocument: "2026-09-12T00:00:00.000Z",
      }),
    );
    expect(foreign).toMatchObject({ amount: 92.16, date: "2026-09-10" });
  });

  it("falls back to the document date and to named placeholders", () => {
    const loose = normalizeEntry(
      sale({
        dataInregistrare: null,
        gestiuneId: null,
        depozit: null,
        documentId: null,
        tipDocument: null,
      }),
    );
    expect(loose).toMatchObject({
      date: "2026-09-01",
      warehouseId: null,
      warehouse: "Fără gestiune",
      documentId: null,
      docType: "—",
    });
    expect(normalizeEntry(sale({ depozit: null }))?.warehouse).toBe(
      "Gestiunea 6",
    );
  });

  it("accepts numeric strings", () => {
    expect(
      normalizeEntry(sale({ suma: "12.5", gestiuneId: "2" })),
    ).toMatchObject({ amount: 12.5, warehouseId: 2 });
  });
});

describe("normalizeEntries", () => {
  it("reports entries that touch 707/709 but cannot count", () => {
    const closing = entry({
      id: 900,
      contDebit: "707.G.06",
      contCredit: "121",
      suma: 5000,
    });
    const reversal = entry({
      id: 901,
      contDebit: "4111.G",
      contCredit: "709.G",
    });
    const noDate = sale({
      id: 902,
      dataInregistrare: null,
      dataDocument: null,
    });
    const noAmount = sale({ id: 903, suma: null });
    const result = normalizeEntries([
      sale({ id: 1 }),
      closing,
      reversal,
      noDate,
      noAmount,
      // Not related to sales at all: neither counted nor reported.
      entry({ id: 904, contDebit: "401.G", contCredit: "5121" }),
    ]);
    expect(result.entries.map((item) => item.id)).toEqual(["1"]);
    expect(result.ignored).toEqual(["900", "901", "902", "903"]);
  });
});

describe("metrics", () => {
  it("sums sales, discounts and distinct documents in cents", () => {
    const entries = normalize([
      sale({ suma: 0.1, documentId: 1 }),
      sale({ suma: 0.2, documentId: 1 }),
      sale({ suma: 100, documentId: 2 }),
      discount707(-10),
      discount709(5),
    ]);
    const metrics = summarize(entries);
    // 0.1 + 0.2 is exact in cents.
    expect(metrics.sales).toBe(100.3);
    expect(metrics.discounts).toBe(15);
    expect(metrics.documents).toBe(2);
    expect(metrics.entries).toBe(5);
    expect(salesAfterDiscounts(metrics)).toBe(85.3);
    expect(discountPct(metrics)).toBeCloseTo((15 / 100.3) * 100, 6);
  });

  it("keeps storno inside sales and reports it separately", () => {
    const metrics = summarize(
      normalize([
        sale({ suma: 1000, documentId: 1 }),
        sale({ suma: -200, tipDocument: "FCS", documentId: 2 }),
      ]),
    );
    expect(metrics).toMatchObject({
      sales: 800,
      returns: -200,
      returnEntries: 1,
      documents: 2,
    });
  });

  it("lets a discount reversal reduce the discount", () => {
    const metrics = summarize(normalize([discount707(-100), discount707(30)]));
    expect(metrics.discounts).toBe(70);
  });

  it("has no discount percentage without sales", () => {
    expect(discountPct(summarize(normalize([discount709(10)])))).toBeNull();
    expect(discountPct(summarize([]))).toBeNull();
  });
});

describe("grouping by gestiune", () => {
  const entries = normalize([
    sale({ suma: 100, gestiuneId: 2, depozit: "DEPOZIT IASI" }),
    sale({ suma: 500, gestiuneId: 6, depozit: "DEPOZIT BRAILA" }),
    sale({ suma: 300, gestiuneId: 6, depozit: "DEPOZIT BRAILA" }),
    discount709(50, { gestiuneId: 2, depozit: "DEPOZIT IASI" }),
    sale({ suma: 200, gestiuneId: null, depozit: null }),
  ]);

  it("groups by gestiune ID, largest first, with a row for entries without one", () => {
    const groups = groupEntries(entries, "warehouse", "sales");
    expect(groups.map((group) => [group.name, group.metrics.sales])).toEqual([
      ["DEPOZIT BRAILA", 800],
      ["Fără gestiune", 200],
      ["DEPOZIT IASI", 100],
    ]);
    expect(groups.map((group) => group.key)).toEqual(["id:6", "none", "id:2"]);
  });

  it("ranks by the chosen measure", () => {
    expect(
      groupEntries(entries, "warehouse", "afterDiscounts").map(
        (group) => group.name,
      ),
    ).toEqual(["DEPOZIT BRAILA", "Fără gestiune", "DEPOZIT IASI"]);
    expect(
      groupEntries(entries, "warehouse", "discounts").map(
        (group) => group.name,
      ),
    ).toEqual(["DEPOZIT IASI", "DEPOZIT BRAILA", "Fără gestiune"]);
  });

  it("splits groups that sum to the overall figures", () => {
    const groups = groupEntries(entries, "warehouse");
    expect(groups.reduce((sum, group) => sum + group.metrics.sales, 0)).toBe(
      summarize(entries).sales,
    );
  });
});

describe("composition", () => {
  const many = (values: [number, number][]) =>
    normalize(
      values.map(([gestiuneId, suma]) =>
        sale({ gestiuneId, depozit: `G${gestiuneId}`, suma }),
      ),
    );

  it("gives each gestiune its share of the total", () => {
    const { total, rows, segments } = composition(
      many([
        [1, 300],
        [2, 100],
      ]),
      "warehouse",
      "sales",
    );
    expect(total).toBe(400);
    expect(rows.map((row) => [row.name, row.share, row.slot])).toEqual([
      ["G1", 75, 0],
      ["G2", 25, 1],
    ]);
    expect(segments.map((segment) => segment.key)).toEqual(["id:1", "id:2"]);
  });

  it("folds everything past the third gestiune into one segment", () => {
    const { segments, folded } = composition(
      many([
        [1, 400],
        [2, 300],
        [3, 200],
        [4, 60],
        [5, 40],
      ]),
      "warehouse",
      "sales",
    );
    expect(segments.map((segment) => segment.name)).toEqual([
      "G1",
      "G2",
      "G3",
      "Altele",
    ]);
    expect(segments[3]!.value).toBe(100);
    expect(folded).toBe(2);
  });

  it("drops the segments when a part is negative", () => {
    const { segments, rows } = composition(
      many([
        [1, 300],
        [2, -50],
      ]),
      "warehouse",
      "sales",
    );
    expect(segments).toEqual([]);
    expect(rows).toHaveLength(2);
  });
});

describe("timeSeries", () => {
  const range = { from: "2026-09-01", to: "2026-09-03" };
  const entries = normalize([
    sale({ suma: 100, gestiuneId: 6, depozit: "BRAILA" }),
    sale({ suma: 50, gestiuneId: 2, depozit: "IASI" }),
    sale({
      suma: 200,
      gestiuneId: 6,
      depozit: "BRAILA",
      dataInregistrare: "2026-09-02T00:00:00.000Z",
    }),
    discount709(20, { dataInregistrare: "2026-09-02T00:00:00.000Z" }),
  ]);

  it("plots every day in the range, including empty ones", () => {
    expect(
      timeSeries(entries, range, "sales").map((point) => [
        point.key,
        point.value,
      ]),
    ).toEqual([
      ["2026-09-01", 150],
      ["2026-09-02", 200],
      ["2026-09-03", 0],
    ]);
    expect(
      timeSeries(entries, range, "afterDiscounts").map((point) => point.value),
    ).toEqual([150, 180, 0]);
  });

  it("splits by gestiune and folds the rest into other", () => {
    const [first] = timeSeries(entries, range, "sales", {
      split: "warehouse",
      splitKeys: ["id:6"],
    });
    expect(first).toMatchObject({ "s:id:6": 100, other: 50 });
  });

  it("aligns the previous period by position", () => {
    const previous = {
      entries: normalize([
        sale({ dataInregistrare: "2026-08-29T00:00:00.000Z", suma: 70 }),
      ]),
      range: { from: "2026-08-29", to: "2026-08-31" },
    };
    const points = timeSeries(entries, range, "sales", { previous });
    expect(points.map((point) => point.previous)).toEqual([70, 0, 0]);
  });
});

describe("gestiune groups", () => {
  const ids = {
    piese: [1, 2, 6, 9, 10, 14],
    utilaje: [8, 16, 17, 18, 19, 20],
    irigatii: [15],
    unassigned: [3, 4, 5, 7, 11, 13, 99, null],
  };
  const entries = normalize(
    Object.values(ids)
      .flat()
      .map((gestiuneId) =>
        sale({ gestiuneId, depozit: gestiuneId && `G${gestiuneId}`, suma: 10 }),
      ),
  );
  const idsOf = (group: GroupFilter) =>
    inGroup(entries, group).map((item) => item.warehouseId);

  it("puts each listed gestiune in its group", () => {
    expect(idsOf("piese")).toEqual(ids.piese);
    expect(idsOf("utilaje")).toEqual(ids.utilaje);
    expect(idsOf("irigatii")).toEqual(ids.irigatii);
  });

  it("leaves unlisted gestiuni and entries without one unassigned", () => {
    expect(idsOf("unassigned")).toEqual(ids.unassigned);
    expect(salesGroupOf({ warehouseId: null })).toBe("unassigned");
    expect(salesGroupOf({ warehouseId: 99 })).toBe("unassigned");
  });

  it("lists every gestiune in at most one group", () => {
    const listed = salesGroups.flatMap((group) =>
      group.warehouses.map(([id]) => id),
    );
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("splits the sales exactly, with nothing counted in two groups or none", () => {
    const total = summarize(entries);
    const parts = groupChoices.map((group) =>
      summarize(inGroup(entries, group.key)),
    );
    expect(parts.reduce((sum, part) => sum + part.sales, 0)).toBe(total.sales);
    expect(parts.reduce((sum, part) => sum + part.entries, 0)).toBe(
      total.entries,
    );
    expect(inGroup(entries, "all")).toBe(entries);
  });
});
