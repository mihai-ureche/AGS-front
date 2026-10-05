import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeEntries, summarize } from "../../lib/sales";
import { Kpis } from "./Kpis";

let nextId = 1;
const ledger = (fields: Record<string, unknown> = {}) => ({
  id: nextId++,
  dataInregistrare: "2026-09-01T00:00:00.000Z",
  documentId: nextId,
  tipDocument: "FC",
  gestiuneId: 6,
  depozit: "DEPOZIT BRAILA",
  contDebit: "4111.G",
  contCredit: "707.G.06",
  suma: 1000,
  ...fields,
});
const discount = (suma: number) =>
  ledger({ contDebit: "709.Discount.06", contCredit: "4111.G", suma });
const metrics = (rows: Record<string, unknown>[]) =>
  summarize(normalizeEntries(rows).entries);
const render = (props: Partial<Parameters<typeof Kpis>[0]> = {}) =>
  renderToStaticMarkup(
    <Kpis current={metrics([ledger()])} {...props} />,
  ).replace(/\s/g, " ");
/** The markup of the card whose class list contains `name`. */
const card = (html: string, name: string) =>
  new RegExp(`<article class="[^"]*${name}[^"]*">(.*?)</article>`).exec(
    html,
  )?.[1] ?? "";

describe("Kpis", () => {
  it("always shows sales, discounts and their difference, even with no discounts", () => {
    const html = render();
    expect(html.indexOf("Vânzări")).toBeLessThan(html.indexOf("Discounturi"));
    expect(html.indexOf("Discounturi")).toBeLessThan(
      html.indexOf("Vânzări după discounturi"),
    );
    expect(card(html, "kpi-sales")).toContain("1.000,00 lei");
    const discounts = card(html, "kpi-discount");
    expect(discounts).toContain("0,00 lei");
    expect(discounts).toContain("0,0% din vânzări");
    expect(discounts).not.toContain("-0,00");
    expect(card(html, "kpi-after")).toContain("1.000,00 lei");
  });

  it("shows discounts with their share of sales and subtracts them", () => {
    const current = metrics([ledger(), discount(100)]);
    const html = render({ current });
    expect(card(html, "kpi-discount")).toContain("100,00 lei");
    expect(card(html, "kpi-discount")).toContain("10,0% din vânzări");
    expect(card(html, "kpi-after")).toContain("900,00 lei");
  });

  it("shows storno and distinct documents", () => {
    const current = metrics([
      ledger({ documentId: 1 }),
      ledger({ documentId: 1 }),
      ledger({ documentId: 2, suma: -300, tipDocument: "FCS" }),
    ]);
    const html = render({ current });
    expect(card(html, "kpi-sales")).toContain(
      "include stornările de -300,00 lei",
    );
    expect(html).toContain("Stornări");
    expect(html).toContain("-300,00 lei");
    expect(html).toContain("1 înregistrare de stornare");
    expect(html).toContain("3 înregistrări");
  });

  it("compares with the previous period only when both are complete", () => {
    const previous = metrics([ledger({ suma: 800 })]);
    expect(card(render({ previous }), "kpi-sales")).toContain("+25,0%");
    const partial = render({ previous, incomplete: true });
    expect(card(partial, "kpi-sales")).toContain("Parțial");
    expect(card(partial, "kpi-sales")).toContain(
      "Comparație indisponibilă: date incomplete",
    );
    expect(partial).not.toContain("+25,0%");
  });
});
