import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Popover, Segmented } from "../../components/ui";
import { compactMoney } from "../../lib/format";
import {
  dimensionValues,
  dimensions,
  emptyRefine,
  filterableDimensions,
} from "../../lib/sales";
import type { Dimension, LineKind, Refine, SaleLine } from "../../lib/sales";

const kindOptions: { value: LineKind; label: string }[] = [
  { value: "all", label: "All lines" },
  { value: "sales", label: "Sales" },
  { value: "returns", label: "Returns" },
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

  return (
    <div className="refine">
      <div className="filter-row" role="group" aria-label="Refine loaded lines">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search lines"
            placeholder="Search product, code, client, document…"
            value={refine.search}
            onChange={(event) =>
              onChange({ ...refine, search: event.target.value })
            }
          />
        </label>
        <Segmented
          label="Line type"
          value={refine.kind}
          options={kindOptions}
          onChange={(kind) => onChange({ ...refine, kind })}
        />
        <Popover label="Filter" icon={Filter} badge={active.length}>
          {() => (
            <FilterPicker lines={lines} refine={refine} onChange={setFilter} />
          )}
        </Popover>
        {hasRefine && (
          <button className="text-button" onClick={() => onChange(emptyRefine)}>
            Clear all
          </button>
        )}
      </div>
      {active.length > 0 && (
        <div className="chip-row">
          {active.flatMap(([dimension, values]) =>
            values.map((value) => (
              <span
                className="chip chip-removable"
                key={`${dimension}|${value}`}
              >
                <span className="muted">{dimensions[dimension].label}:</span>{" "}
                {names.get(`${dimension}|${value}`) ?? value}
                <button
                  aria-label={`Remove ${dimensions[dimension].label} filter ${names.get(`${dimension}|${value}`) ?? value}`}
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
            )),
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
  const [query, setQuery] = useState("");
  const values = useMemo(
    () => dimensionValues(lines, dimension),
    [lines, dimension],
  );
  const selected = refine.filters[dimension] ?? [];
  const term = query.trim().toLowerCase();
  const shown = values
    .filter((value) => !term || value.name.toLowerCase().includes(term))
    .slice(0, 200);
  return (
    <div className="filter-picker">
      <div
        className="filter-picker-dimensions"
        role="tablist"
        aria-label="Filter dimension"
      >
        {filterableDimensions.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={dimension === item}
            className={dimension === item ? "is-selected" : ""}
            onClick={() => {
              setDimension(item);
              setQuery("");
            }}
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
      <div className="filter-picker-values">
        <input
          className="input"
          aria-label={`Search ${dimensions[dimension].label.toLowerCase()} values`}
          placeholder={`Search ${values.length} values`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          className="value-list"
          role="group"
          aria-label={`${dimensions[dimension].label} values`}
        >
          {shown.map((value) => (
            <label key={value.key} className="check-row">
              <input
                type="checkbox"
                checked={selected.includes(value.key)}
                onChange={(event) =>
                  onChange(
                    dimension,
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
          {!shown.length && <p className="muted">No values match.</p>}
          {values.length > 200 && shown.length === 200 && (
            <p className="muted">
              Showing the first 200. Search to narrow the list.
            </p>
          )}
        </div>
        {selected.length > 0 && (
          <button
            className="text-button"
            onClick={() => onChange(dimension, [])}
          >
            Clear {dimensions[dimension].label.toLowerCase()} filter
          </button>
        )}
      </div>
    </div>
  );
}
