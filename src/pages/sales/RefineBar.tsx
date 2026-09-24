import { useMemo, useState } from "react";
import { Filter, Search, UserRound, X } from "lucide-react";
import { Popover, Segmented } from "../../components/ui";
import { useCurrency } from "../../lib/currency";
import { plural } from "../../lib/format";
import {
  dimensionValues,
  dimensions,
  emptyRefine,
  filterableDimensions,
} from "../../lib/sales";
import type { Dimension, LineKind, Refine, SaleLine } from "../../lib/sales";

const kindOptions: { value: LineKind; label: string }[] = [
  { value: "all", label: "Toate liniile" },
  { value: "sales", label: "Vânzări" },
  { value: "returns", label: "Retururi" },
];

export function RefineBar({
  lines,
  refine,
  onChange,
}: {
  lines: SaleLine[];
  refine: Refine;
  onChange: (next: Refine) => void;
}) {
  const active = (
    Object.entries(refine.filters) as [Dimension, string[]][]
  ).filter(([, values]) => values.length);
  const setFilter = (dimension: Dimension, values: string[]) =>
    onChange({
      ...refine,
      filters: { ...refine.filters, [dimension]: values },
    });
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const [dimension, values] of Object.entries(refine.filters) as [
      Dimension,
      string[],
    ][]) {
      if (!values.length) continue;
      for (const value of dimensionValues(lines, dimension))
        map.set(`${dimension}|${value.key}`, value.name);
    }
    return map;
  }, [lines, refine.filters]);
  const hasRefine = active.length > 0 || refine.search || refine.kind !== "all";
  const clients = refine.filters.client ?? [];

  return (
    <div className="refine">
      <div
        className="filter-row"
        role="group"
        aria-label="Rafinarea liniilor încărcate"
      >
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Căutați linii"
            placeholder="Căutați produs, cod, client, document…"
            value={refine.search}
            onChange={(event) =>
              onChange({ ...refine, search: event.target.value })
            }
          />
        </label>
        <Segmented
          label="Tip linie"
          value={refine.kind}
          options={kindOptions}
          onChange={(kind) => onChange({ ...refine, kind })}
        />
        <Popover
          label={
            clients.length === 1
              ? (names.get(`client|${clients[0]}`) ?? "Client")
              : "Client"
          }
          icon={UserRound}
          badge={clients.length > 1 ? clients.length : undefined}
          className="client-popover"
        >
          {() => (
            <div className="client-picker">
              <ValuePicker
                lines={lines}
                dimension="client"
                selected={clients}
                onChange={(values) => setFilter("client", values)}
              />
            </div>
          )}
        </Popover>
        <Popover label="Filtru" icon={Filter} badge={active.length}>
          {() => (
            <FilterPicker lines={lines} refine={refine} onChange={setFilter} />
          )}
        </Popover>
        {hasRefine && (
          <button className="text-button" onClick={() => onChange(emptyRefine)}>
            Șterge tot
          </button>
        )}
      </div>
      {active.length > 0 && (
        <div className="chip-row">
          {active.flatMap(([dimension, values]) =>
            values.map((value) => {
              const name = names.get(`${dimension}|${value}`) ?? value;
              return (
                <span
                  className="chip chip-removable"
                  key={`${dimension}|${value}`}
                >
                  <span className="muted">{dimensions[dimension].label}:</span>{" "}
                  {name}
                  <button
                    aria-label={`Eliminați filtrul ${dimensions[dimension].label} ${name}`}
                    onClick={() =>
                      setFilter(
                        dimension,
                        values.filter((item) => item !== value),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}

function FilterPicker({
  lines,
  refine,
  onChange,
}: {
  lines: SaleLine[];
  refine: Refine;
  onChange: (dimension: Dimension, values: string[]) => void;
}) {
  const [dimension, setDimension] = useState<Dimension>("category");
  return (
    <div className="filter-picker">
      <div
        className="filter-picker-dimensions"
        role="tablist"
        aria-label="Dimensiune filtru"
      >
        {filterableDimensions.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={dimension === item}
            className={dimension === item ? "is-selected" : ""}
            onClick={() => setDimension(item)}
          >
            {dimensions[item].label}
            {(refine.filters[item]?.length ?? 0) > 0 && (
              <span className="control-count">
                {refine.filters[item]!.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <ValuePicker
        key={dimension}
        lines={lines}
        dimension={dimension}
        selected={refine.filters[dimension] ?? []}
        onChange={(values) => onChange(dimension, values)}
      />
    </div>
  );
}

/** Searchable checklist of a dimension's values, most valuable first. */
function ValuePicker({
  lines,
  dimension,
  selected,
  onChange,
}: {
  lines: SaleLine[];
  dimension: Dimension;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const { compactMoney } = useCurrency();
  const [query, setQuery] = useState("");
  const values = useMemo(
    () => dimensionValues(lines, dimension),
    [lines, dimension],
  );
  const label = dimensions[dimension].label.toLowerCase();
  const term = query.trim().toLowerCase();
  const shown = values
    .filter((value) => !term || value.name.toLowerCase().includes(term))
    .slice(0, 200);
  return (
    <div className="filter-picker-values">
      <input
        className="input"
        aria-label={`Căutați valori pentru ${label}`}
        placeholder={`Căutați printre ${plural(values.length, "valoare", "valori")}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        className="value-list"
        role="group"
        aria-label={`Valori pentru ${label}`}
      >
        {shown.map((value) => (
          <label key={value.key} className="check-row">
            <input
              type="checkbox"
              checked={selected.includes(value.key)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, value.key]
                    : selected.filter((item) => item !== value.key),
                )
              }
            />
            <span className="value-name">{value.name}</span>
            <span className="value-amount">{compactMoney(value.net)}</span>
          </label>
        ))}
        {!shown.length && <p className="muted">Nicio valoare nu corespunde.</p>}
        {values.length > 200 && shown.length === 200 && (
          <p className="muted">
            Se afișează primele 200. Căutați pentru a restrânge lista.
          </p>
        )}
      </div>
      {selected.length > 0 && (
        <button className="text-button" onClick={() => onChange([])}>
          Șterge filtrul pentru {label}
        </button>
      )}
    </div>
  );
}
