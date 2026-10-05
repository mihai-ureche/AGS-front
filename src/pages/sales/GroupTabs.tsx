import { Segmented } from "../../components/ui";
import { useCurrency } from "../../lib/currency";
import {
  inGroup,
  salesAfterDiscounts,
  salesGroups,
  summarize,
} from "../../lib/sales";
import type { GroupFilter, SaleEntry } from "../../lib/sales";

/**
 * Switches between all gestiuni and each group. Every option shows its sales
 * after discounts, so the groups can be compared without switching.
 */
export function GroupTabs({
  entries,
  value,
  onChange,
}: {
  /** The whole period, before any group filter. */
  entries: SaleEntry[];
  value: GroupFilter;
  onChange: (group: GroupFilter) => void;
}) {
  const { compactMoney } = useCurrency();
  const total = (group: GroupFilter) =>
    compactMoney(salesAfterDiscounts(summarize(inGroup(entries, group))));
  return (
    <Segmented<GroupFilter>
      label="Grupă de gestiuni"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: `Toate · ${total("all")}` },
        ...salesGroups.map((group) => ({
          value: group.key,
          label: `${group.label} · ${total(group.key)}`,
        })),
      ]}
    />
  );
}
