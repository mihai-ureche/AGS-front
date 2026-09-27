import type { RevenueGroup } from "../../api/types";
import { locale } from "../../lib/format";
import type { SaleLine } from "../../lib/sales";

export interface GroupContents {
  id: string | null;
  name: string;
  categories: string[];
}

/** The categories the backend classified into each revenue group. */
export function summarizeGroups(
  lines: SaleLine[],
  order: RevenueGroup[],
): GroupContents[] {
  const groups = new Map<string, { name: string; categories: Set<string> }>();
  for (const line of lines) {
    const key = line.revenueGroupId ?? "";
    let group = groups.get(key);
    if (!group) {
      group = {
        name: line.revenueGroupId ? line.revenueGroup : "Fără grupă",
        categories: new Set(),
      };
      groups.set(key, group);
    }
    group.categories.add(line.category);
  }
  const rank = (id: string | null) => {
    const index = order.findIndex((group) => group.id === id);
    return index === -1 ? order.length : index;
  };
  return [...groups]
    .map(([key, group]) => ({
      id: key || null,
      name: group.name,
      categories: [...group.categories].sort((a, b) =>
        a.localeCompare(b, locale),
      ),
    }))
    .sort((a, b) => rank(a.id) - rank(b.id));
}
