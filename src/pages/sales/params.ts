import type { DocType, SalesQuery, TargetEntity } from "../../api/types";
import {
  daysInclusive,
  isPresetKey,
  isValidIso,
  MAX_RANGE_DAYS,
  presetRange,
} from "../../lib/dates";
import type { PresetKey } from "../../lib/dates";

/** Server-side sales filters; kept in the URL so views can be bookmarked and shared. */
export interface SalesParams {
  entity: TargetEntity;
  range: PresetKey | "custom";
  from: string;
  to: string;
  docType?: DocType;
  gestiune?: number;
  transfers: boolean;
  compare: boolean;
}

export const DEFAULT_PRESET: PresetKey = "last30";

export function validateCustomRange(from: string, to: string): string | null {
  if (!isValidIso(from) || !isValidIso(to))
    return "Alegeți data de început și data de sfârșit.";
  if (from > to)
    return "Data de început trebuie să fie cel târziu data de sfârșit.";
  if (daysInclusive({ from, to }) > MAX_RANGE_DAYS)
    return `Alegeți cel mult ${MAX_RANGE_DAYS} de zile.`;
  return null;
}

export function readParams(
  params: URLSearchParams,
  entities: TargetEntity[],
): SalesParams | null {
  if (!entities.length) return null;
  const entityParam = params.get("entity");
  const entity = entities.find((item) => item === entityParam) ?? entities[0]!;
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
  const doc = params.get("doc");
  const gestiune = Number(params.get("gestiune"));
  return {
    entity,
    range,
    ...dates,
    docType: doc === "BFD" || doc === "AIM" ? doc : undefined,
    gestiune:
      Number.isSafeInteger(gestiune) && gestiune > 0 ? gestiune : undefined,
    transfers: params.get("transfers") === "1",
    compare: params.get("compare") === "1",
  };
}

export function writeParams(
  state: SalesParams,
): Record<string, string | undefined> {
  return {
    entity: state.entity,
    range: state.range,
    from: state.range === "custom" ? state.from : undefined,
    to: state.range === "custom" ? state.to : undefined,
    doc: state.docType,
    gestiune: state.gestiune ? String(state.gestiune) : undefined,
    transfers: state.transfers ? "1" : undefined,
    compare: state.compare ? "1" : undefined,
  };
}

export function toQuery(state: SalesParams): SalesQuery {
  return {
    targetEntity: state.entity,
    from: state.from,
    to: state.to,
    docType: state.docType,
    gestiune: state.gestiune,
    includeTransfers: state.transfers,
  };
}
