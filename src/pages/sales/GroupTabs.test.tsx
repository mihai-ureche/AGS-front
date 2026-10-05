import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeEntries } from "../../lib/sales";
import type { GroupFilter } from "../../lib/sales";
import { GroupTabs } from "./GroupTabs";

const ledger = (id: number, gestiuneId: number | null, suma: number) => ({
  id,
  dataInregistrare: "2026-09-01T00:00:00.000Z",
  documentId: id,
  gestiuneId,
  contDebit: "4111.G",
  contCredit: "707.G.06",
  suma,
});
const assigned = [
  ledger(1, 6, 1000), // Piese
  ledger(2, 8, 250), // Utilaje
  ledger(3, 15, 40), // Irigații
];
const entries = normalizeEntries([...assigned, ledger(4, null, 50)]).entries;
const render = (value: GroupFilter, rows = entries) =>
  renderToStaticMarkup(
    <GroupTabs entries={rows} value={value} onChange={() => {}} />,
  ).replace(/\s/g, " ");

describe("GroupTabs", () => {
  it("shows each option's sales after discounts", () => {
    const html = render("all");
    expect(html).toContain("Toate · 1.340,00 lei");
    expect(html).toContain("Piese · 1.000,00 lei");
    expect(html).toContain("Utilaje · 250,00 lei");
    expect(html).toContain("Irigații · 40,00 lei");
    expect(html).toContain("Nealocate · 50,00 lei");
  });

  it("only shows Nealocate when something is unassigned or it is selected", () => {
    const clean = normalizeEntries(assigned).entries;
    expect(render("all", clean)).not.toContain("Nealocate");
    expect(render("unassigned", clean)).toContain("Nealocate · 0,00 lei");
  });

  it("marks the selected group", () => {
    const selected = (html: string) =>
      /aria-checked="true"[^>]*>([^<]*)</.exec(html)?.[1];
    expect(selected(render("all"))).toMatch(/^Toate/);
    expect(selected(render("piese"))).toMatch(/^Piese/);
    expect(selected(render("irigatii"))).toMatch(/^Irigații/);
    expect(selected(render("unassigned"))).toMatch(/^Nealocate/);
  });
});
