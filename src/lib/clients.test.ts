import { describe, expect, it } from "vitest";
import {
  clientComposition,
  clientDocuments,
  filterClients,
  groupClients,
  OTHER_CLIENTS,
} from "./clients";
import {
  inGroup,
  inWarehouse,
  normalizeEntries,
  normalizeEntry,
  summarize,
  toCents,
} from "./sales";

let nextId = 1;
const ledger = (fields: Record<string, unknown> = {}) => ({
  id: nextId++,
  documentId: 1,
  dataInregistrare: "2026-09-01T00:00:00.000Z",
  tipDocument: "FC",
  numarDocument: "BRAT.1.BR",
  gestiuneId: 6,
  depozit: "DEPOZIT BRAILA",
  contDebit: "4111.G",
  contCredit: "707.G.06",
  tertDebitId: 42,
  tertDebit: "Ferma Ștefan SRL",
  tertDebitCodFiscal: "RO 12345",
  tertCreditId: 99,
  tertCredit: "Alt terț",
  tertCreditCodFiscal: "RO 999",
  explicatii: "Vânzare marfă",
  suma: 100,
  ...fields,
});
const normalize = (rows: Record<string, unknown>[]) =>
  normalizeEntries(rows).entries;

describe("ledger clients", () => {
  it("reads the debit client for sales, returns and 707 discounts", () => {
    for (const fields of [
      {},
      { suma: -20, tipDocument: "FCS" },
      { contCredit: "707.Discount.06", suma: -10 },
    ]) {
      expect(normalizeEntry(ledger(fields))).toMatchObject({
        clientId: "42",
        client: "Ferma Ștefan SRL",
        clientTaxId: "RO 12345",
        description: "Vânzare marfă",
      });
    }
  });

  it("reads the credit client for 709 discounts and reversals", () => {
    for (const suma of [10, -10]) {
      expect(
        normalizeEntry(
          ledger({ contDebit: "709.Discount.06", contCredit: "4111.G", suma }),
        ),
      ).toMatchObject({
        clientId: "99",
        client: "Alt terț",
        clientTaxId: "RO 999",
        amount: suma,
      });
    }
  });

  it("does not take an unrelated opposite-side third party when the client is missing", () => {
    expect(
      normalizeEntry(
        ledger({
          tertDebitId: null,
          tertDebit: null,
          tertDebitCodFiscal: null,
        }),
      ),
    ).toMatchObject({
      clientId: null,
      client: "Fără client",
      clientTaxId: null,
    });
  });

  it("combines client sales and both discount accounts without changing totals", () => {
    const rows = normalize([
      ledger({ suma: 100.1 }),
      ledger({ suma: 0.2 }),
      ledger({ suma: -20, documentId: 2 }),
      ledger({ contCredit: "707.Discount.06", suma: -10 }),
      ledger({
        contDebit: "709.Discount.06",
        contCredit: "4111.G",
        tertCreditId: 42,
        tertCredit: "Ferma Ștefan SRL",
        suma: 5,
      }),
      ledger({ tertDebitId: 50, tertDebit: "Alt client", suma: 200 }),
      ledger({
        tertDebitId: null,
        tertDebit: null,
        tertDebitCodFiscal: null,
        suma: 1,
      }),
    ]);
    const clients = groupClients(rows);
    expect(clients.find((c) => c.id === "42")?.metrics).toMatchObject({
      sales: 80.3,
      discounts: 15,
      returns: -20,
      documents: 2,
    });
    for (const metric of ["sales", "discounts", "returns"] as const)
      expect(
        clients.reduce((sum, c) => sum + toCents(c.metrics[metric]), 0),
      ).toBe(toCents(summarize(rows)[metric]));
  });

  it("keeps namesakes with different IDs separate and unknown clients visible", () => {
    const clients = groupClients(
      normalize([
        ledger(),
        ledger({ tertDebitId: 51 }),
        ledger({
          tertDebitId: null,
          tertDebit: null,
          tertDebitCodFiscal: null,
        }),
      ]),
    );
    expect(clients).toHaveLength(3);
    expect(clients.find((c) => c.key === "none")?.metrics.sales).toBe(100);
  });

  it("uses tax IDs and then names as fallbacks when Borg has no client ID", () => {
    const clients = groupClients(
      normalize([
        ledger({ tertDebitId: null }),
        ledger({
          tertDebitId: null,
          tertDebit: "Nume actualizat",
          tertDebitCodFiscal: "ro12345",
        }),
        ledger({ tertDebitId: null, tertDebitCodFiscal: null }),
        ledger({
          tertDebitId: null,
          tertDebitCodFiscal: null,
          tertDebit: " FERMA ȘTEFAN SRL ",
        }),
      ]),
    );
    expect(clients).toHaveLength(2);
    expect(clients.map((c) => c.metrics.sales)).toEqual([200, 200]);
  });

  it("searches all clients by name and CUI without case or diacritic sensitivity", () => {
    const clients = groupClients(
      normalize([
        ledger(),
        ledger({
          tertDebitId: 50,
          tertDebit: "Alt client",
          tertDebitCodFiscal: "RO 999",
        }),
      ]),
    );
    expect(
      filterClients(clients, "  STEFAN   ferma ").map((c) => c.id),
    ).toEqual(["42"]);
    expect(filterClients(clients, "12345").map((c) => c.id)).toEqual(["42"]);
    expect(filterClients(clients, "missing")).toEqual([]);
    expect(filterClients(clients, "  ")).toHaveLength(2);
  });

  it("respects the selected warehouse group before grouping clients", () => {
    const rows = normalize([ledger(), ledger({ gestiuneId: 8, suma: 1000 })]);
    expect(groupClients(inGroup(rows, "piese"))[0]?.metrics.sales).toBe(100);
  });

  it("isolates sales, discounts and client documents to the chosen depot", () => {
    const rows = normalize([
      ledger({ suma: 100, documentId: 1 }),
      ledger({
        suma: 900,
        gestiuneId: 2,
        depozit: "DEPOZIT IASI",
        documentId: 2,
      }),
      ledger({ contCredit: "707.Discount.06", suma: -10, documentId: 1 }),
      ledger({ gestiuneId: null, suma: 50 }),
    ]);
    const clients = groupClients(inWarehouse(inGroup(rows, "piese"), 6));
    expect(clients[0]?.metrics).toMatchObject({
      sales: 100,
      discounts: 10,
      documents: 1,
    });
    expect(clientDocuments(clients[0]!.entries)).toHaveLength(1);
    expect(inWarehouse(rows, "none").map((row) => row.warehouseId)).toEqual([
      null,
    ]);
    expect(inWarehouse(rows, "all")).toBe(rows);
  });

  it("keeps the depot denominator when a client search narrows the chart", () => {
    const clients = groupClients(
      normalize([ledger({ suma: 80 }), ledger({ tertDebitId: 50, suma: 20 })]),
    );
    const data = clientComposition(clients, ["id:50"]);
    expect(data.total).toBe(100);
    expect(
      data.segments.map((segment) => [
        segment.key,
        segment.value,
        segment.share,
      ]),
    ).toEqual([
      ["id:50", 20, 20],
      [OTHER_CLIENTS, 80, 80],
    ]);
    expect(data.shares.get("id:50")).toBe(20);
  });

  it("folds the tail into other and pins a selected client outside the top five", () => {
    const clients = groupClients(
      normalize(
        Array.from({ length: 7 }, (_, i) =>
          ledger({ tertDebitId: i + 1, suma: 7 - i }),
        ),
      ),
    );
    const data = clientComposition(clients, undefined, "id:7");
    expect(data.segments).toHaveLength(6);
    expect(data.segments.some((segment) => segment.key === "id:7")).toBe(true);
    expect(
      data.segments.reduce((sum, segment) => sum + toCents(segment.value), 0),
    ).toBe(toCents(data.total));
    expect(
      data.segments.reduce((sum, segment) => sum + segment.share, 0),
    ).toBeCloseTo(100);
  });

  it("separates net returns instead of inventing negative pie slices", () => {
    const clients = groupClients(
      normalize([
        ledger({ suma: 100 }),
        ledger({ tertDebitId: 50, suma: -20 }),
      ]),
    );
    const data = clientComposition(clients);
    expect(data.total).toBe(100);
    expect(data.negative).toBe(-20);
    expect(data.shares.get("id:50")).toBeNull();
    expect(data.segments.map((segment) => segment.value)).toEqual([100]);
    expect(
      clientComposition(clients.filter((client) => client.id === "50"))
        .segments,
    ).toEqual([]);
    expect(clientComposition([]).total).toBe(0);
  });

  it("combines postings on a document across warehouses, retaining descriptions and signed amounts", () => {
    const docs = clientDocuments(
      normalize([
        ledger({ suma: 50 }),
        ledger({ gestiuneId: 2, depozit: "DEPOZIT IASI", suma: 25 }),
        ledger({
          contCredit: "707.Discount.06",
          suma: -10,
          explicatii: "Discount comercial",
        }),
        ledger({
          documentId: 2,
          tipDocument: "FCS",
          suma: -5,
          dataInregistrare: "2026-09-02T00:00:00.000Z",
        }),
        ledger({ documentId: null }),
        ledger({ documentId: null }),
      ]),
    );
    expect(docs).toHaveLength(4);
    expect(docs[0]?.type).toBe("FCS");
    expect(docs.find((d) => d.key === "document:1")).toMatchObject({
      warehouses: ["DEPOZIT BRAILA", "DEPOZIT IASI"],
      descriptions: ["Vânzare marfă", "Discount comercial"],
      metrics: { sales: 75, discounts: 10, documents: 1 },
    });
  });
});
