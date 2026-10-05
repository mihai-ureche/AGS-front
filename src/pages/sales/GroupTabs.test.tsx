import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeEntries } from "../../lib/sales";
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
const entries = normalizeEntries([
  ledger(1, 6, 1000),
  ledger(2, 2, 250),
  ledger(3, null, 50),
]).entries;
const render = (value: "all" | "main" | "rest") =>
  renderToStaticMarkup(
    <GroupTabs entries={entries} value={value} onChange={() => {}} />,
  ).replace(/\s/g, " ");

describe("GroupTabs", () => {
  it("shows each option's sales after discounts", () => {
    const html = render("all");
    expect(html).toContain("Toate · 1.300,00 lei");
    expect(html).toContain("Grupa 1 · 1.000,00 lei");
    expect(html).toContain("Restul gestiunilor · 300,00 lei");
  });

  it("marks the selected group", () => {
    const selected = (html: string) =>
      /aria-checked="true"[^>]*>([^<]*)</.exec(html)?.[1];
    expect(selected(render("all"))).toMatch(/^Toate/);
    expect(selected(render("main"))).toMatch(/^Grupa 1/);
    expect(selected(render("rest"))).toMatch(/^Restul/);
  });
});
