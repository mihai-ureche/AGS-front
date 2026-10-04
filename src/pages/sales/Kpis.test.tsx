import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeLines, summarize } from "../../lib/sales";
import { Kpis } from "./Kpis";

const sale = {
  data: "2026-09-01",
  miscareId: "1",
  documentId: 1,
  tipDocument: "AIM",
  cantitate: 1,
  valoareNet: 1000,
  businessValueKind: "sale",
};
const render = (props: Partial<Parameters<typeof Kpis>[0]> = {}) =>
  renderToStaticMarkup(
    <Kpis
      current={summarize(normalizeLines([sale]))}
      onShowDiscounts={() => {}}
      {...props}
    />,
  ).replace(/\s/g, " ");
/** The markup of the card whose class list contains `name`. */
const card = (html: string, name: string) =>
  new RegExp(`<article class="[^"]*${name}[^"]*">(.*?)</article>`).exec(
    html,
  )?.[1] ?? "";

describe("Kpis", () => {
  it("always shows the discount card, even with no discounts", () => {
    const html = render();
    expect(html.indexOf("Vânzări produse")).toBeLessThan(
      html.indexOf("Discounturi"),
    );
    expect(html.indexOf("Discounturi")).toBeLessThan(
      html.indexOf("Vânzări după discounturi"),
    );
    const discount = card(html, "kpi-discount");
    expect(discount).toContain("0,00 lei");
    expect(discount).toContain("0,0% din vânzările de produse");
    expect(discount).toContain("Acordate");
    expect(discount).toContain("Stornate");
    expect(discount).toContain(
      "Reducerile incluse în prețul produselor nu se scad din nou.",
    );
    expect(discount).not.toContain("-0,00");
    expect(discount).toContain('aria-pressed="false"');
    expect(card(html, "kpi-after")).toContain("1.000,00 lei");
  });

  it("shows granted, reversed and net discounts with their share of sales", () => {
    const current = summarize(
      normalizeLines([
        sale,
        {
          ...sale,
          miscareId: "2",
          valoareNet: -120,
          businessValueKind: "discount",
        },
        {
          ...sale,
          miscareId: "3",
          valoareNet: 20,
          businessValueKind: "discount",
        },
      ]),
    );
    const discount = card(render({ current }), "kpi-discount");
    expect(discount).toContain("100,00 lei");
    expect(discount).toContain("10,0% din vânzările de produse");
    expect(discount).toContain("120,00 lei");
    expect(discount).toContain("-20,00 lei");
    expect(card(render({ current }), "kpi-after")).toContain("900,00 lei");
  });

  it("compares with the previous period only when both are complete", () => {
    const previous = summarize(normalizeLines([{ ...sale, valoareNet: 800 }]));
    expect(card(render({ previous }), "kpi-sales")).toContain("+25,0%");
    const partial = render({ previous, incomplete: true });
    expect(card(partial, "kpi-sales")).toContain("Parțial");
    expect(card(partial, "kpi-sales")).toContain(
      "Comparație indisponibilă: date incomplete",
    );
    expect(partial).not.toContain("+25,0%");
  });
});
