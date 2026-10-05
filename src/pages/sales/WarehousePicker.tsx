import { useMemo } from "react";
import { dimensions } from "../../lib/sales";
import type { SaleEntry, WarehouseFilter } from "../../lib/sales";

export function WarehousePicker({
  entries,
  value,
  onChange,
}: {
  entries: SaleEntry[];
  value: WarehouseFilter;
  onChange: (value: WarehouseFilter) => void;
}) {
  const choices = useMemo(
    () =>
      [
        ...new Map(
          entries.map((entry) => [
            entry.warehouseId === null ? "none" : String(entry.warehouseId),
            dimensions.warehouse.name(entry),
          ]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "ro-RO")),
    [entries],
  );
  const selected = String(value);
  return (
    <div className="toolbar warehouse-picker">
      <label className="inline-select">
        <span>Depozit</span>
        <select
          className="control"
          aria-label="Filtrați vânzările după depozit"
          value={selected}
          onChange={(event) =>
            onChange(
              event.target.value === "all" || event.target.value === "none"
                ? event.target.value
                : Number(event.target.value),
            )
          }
        >
          <option value="all">Toate depozitele din grupă</option>
          {value !== "all" && !choices.some(([key]) => key === selected) && (
            <option value={selected}>
              {value === "none" ? "Fără gestiune" : `Gestiunea ${value}`} (fără
              vânzări)
            </option>
          )}
          {choices.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {value !== "all" && (
        <button
          className="button button-secondary"
          onClick={() => onChange("all")}
        >
          Toate depozitele
        </button>
      )}
    </div>
  );
}
