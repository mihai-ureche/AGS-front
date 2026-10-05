import type { SalesQuery } from "../../api/types";
import {
  daysInclusive,
  isPresetKey,
  isValidIso,
  MAX_RANGE_DAYS,
  presetRange,
} from "../../lib/dates";
import type { PresetKey } from "../../lib/dates";
import { groupChoices, SALES_ENTITY, salesGroupOf } from "../../lib/sales";
import type { GroupFilter, WarehouseFilter } from "../../lib/sales";

/** Query settings; kept in the URL so views can be bookmarked and shared. */
export interface SalesParams {
  range: PresetKey | "custom";
  from: string;
  to: string;
  compare: boolean;
  /** Which gestiune group to show; a view filter, so it never refetches. */
  group: GroupFilter;
  /** A depot view filter; applied locally to both current and previous periods. */
  warehouse: WarehouseFilter;
}

export const DEFAULT_PRESET: PresetKey = "thisMonth";

export function validateCustomRange(from: string, to: string): string | null {
  if (!isValidIso(from) || !isValidIso(to))
    return "Alegeți data de început și data de sfârșit.";
  if (from > to)
    return "Data de început trebuie să fie cel târziu data de sfârșit.";
  if (daysInclusive({ from, to }) > MAX_RANGE_DAYS)
    return `Alegeți cel mult ${MAX_RANGE_DAYS} de zile.`;
  return null;
}

export function readParams(params: URLSearchParams): SalesParams {
  const rangeParam = params.get("range");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  let range: SalesParams["range"] = isPresetKey(rangeParam)
    ? rangeParam
    : DEFAULT_PRESET;
  let dates = presetRange(range);
  if (rangeParam === "custom" && !validateCustomRange(from, to)) {
    range = "custom";
    dates = { from, to };
  }
  const group = params.get("group");
  const groupFilter =
    groupChoices.find((item) => item.key === group)?.key ?? "all";
  const warehouseParam = params.get("warehouse");
  let warehouse: WarehouseFilter = "all";
  if (warehouseParam === "none") warehouse = "none";
  else if (
    warehouseParam &&
    /^[1-9]\d*$/.test(warehouseParam) &&
    Number.isSafeInteger(Number(warehouseParam))
  )
    warehouse = Number(warehouseParam);
  if (
    warehouse !== "all" &&
    groupFilter !== "all" &&
    salesGroupOf({ warehouseId: warehouse === "none" ? null : warehouse }) !==
      groupFilter
  )
    warehouse = "all";
  return {
    range,
    ...dates,
    compare: params.get("compare") === "1",
    group: groupFilter,
    warehouse,
  };
}

export function writeParams(
  state: SalesParams,
): Record<string, string | undefined> {
  return {
    range: state.range,
    from: state.range === "custom" ? state.from : undefined,
    to: state.range === "custom" ? state.to : undefined,
    compare: state.compare ? "1" : undefined,
    group: state.group === "all" ? undefined : state.group,
    warehouse: state.warehouse === "all" ? undefined : String(state.warehouse),
  };
}

export function toQuery(state: SalesParams): SalesQuery {
  return { targetEntity: SALES_ENTITY, from: state.from, to: state.to };
}
