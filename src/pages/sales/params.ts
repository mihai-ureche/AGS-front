import type { SalesQuery } from "../../api/types";
import {
  daysInclusive,
  isPresetKey,
  isValidIso,
  MAX_RANGE_DAYS,
  presetRange,
} from "../../lib/dates";
import type { PresetKey } from "../../lib/dates";
import { SALES_ENTITY, salesGroups } from "../../lib/sales";
import type { GroupFilter } from "../../lib/sales";

/** Query settings; kept in the URL so views can be bookmarked and shared. */
export interface SalesParams {
  range: PresetKey | "custom";
  from: string;
  to: string;
  compare: boolean;
  /** Which gestiune group to show; a view filter, so it never refetches. */
  group: GroupFilter;
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
  return {
    range,
    ...dates,
    compare: params.get("compare") === "1",
    group: salesGroups.find((item) => item.key === group)?.key ?? "all",
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
  };
}

export function toQuery(state: SalesParams): SalesQuery {
  return { targetEntity: SALES_ENTITY, from: state.from, to: state.to };
}
