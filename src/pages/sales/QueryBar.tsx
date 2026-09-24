import { useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { DocType, TargetEntity } from "../../api/types";
import { Field, Popover } from "../../components/ui";
import { chunkRange, daysInclusive, presets } from "../../lib/dates";
import { longDate, shortDate } from "../../lib/format";
import { entityLabels } from "../../lib/labels";
import { validateCustomRange } from "./params";
import type { SalesParams } from "./params";

export function QueryBar({
  state,
  entities,
  onChange,
  onReload,
  loading,
}: {
  state: SalesParams;
  entities: TargetEntity[];
  onChange: (next: Partial<SalesParams>) => void;
  onReload: () => void;
  loading: boolean;
}) {
  const advanced = Number(Boolean(state.gestiune)) + Number(state.transfers);
  return (
    <div className="filter-row" role="group" aria-label="Sales query">
      <label className="control control-select">
        <Building2 size={16} aria-hidden="true" />
        <select
          aria-label="Entity"
          value={state.entity}
          onChange={(event) =>
            onChange({ entity: event.target.value as TargetEntity })
          }
        >
          {entities.map((entity) => (
            <option key={entity} value={entity}>
              {entityLabels[entity]}
            </option>
          ))}
        </select>
      </label>

      <DateRangePicker state={state} onChange={onChange} />

      <label className="control control-select">
        <select
          aria-label="Document type"
          value={state.docType ?? ""}
          onChange={(event) =>
            onChange({
              docType: (event.target.value || undefined) as DocType | undefined,
            })
          }
        >
          <option value="">All documents</option>
          <option value="BFD">Receipts (BFD)</option>
          <option value="AIM">Delivery notes (AIM)</option>
        </select>
      </label>

      <Popover label="Options" icon={SlidersHorizontal} badge={advanced}>
        {() => <AdvancedOptions state={state} onChange={onChange} />}
      </Popover>

      <label className="toggle-control">
        <input
          type="checkbox"
          role="switch"
          checked={state.compare}
          onChange={(event) => onChange({ compare: event.target.checked })}
        />
        <span>Compare with previous period</span>
      </label>

      <button
        className="button button-secondary filter-row-end"
        onClick={onReload}
        disabled={loading}
        title="Fetch fresh data from Borg"
      >
        <RefreshCw size={15} className={loading ? "spin" : ""} /> Reload
      </button>
    </div>
  );
}

function DateRangePicker({
  state,
  onChange,
}: {
  state: SalesParams;
  onChange: (next: Partial<SalesParams>) => void;
}) {
  const label =
    state.range === "custom"
      ? `${shortDate(state.from)} – ${longDate(state.to)}`
      : presets.find((preset) => preset.key === state.range)?.label;
  return (
    <Popover label={label} icon={CalendarDays} className="date-popover">
      {(close) => (
        <div className="date-menu">
          <ul role="listbox" aria-label="Date range presets">
            {presets.map((preset) => (
              <li key={preset.key}>
                <button
                  role="option"
                  aria-selected={state.range === preset.key}
                  onClick={() => {
                    onChange({ range: preset.key });
                    close();
                  }}
                >
                  <span className="check-slot">
                    {state.range === preset.key && (
                      <Check size={16} strokeWidth={3} />
                    )}
                  </span>
                  {preset.label}
                </button>
              </li>
            ))}
          </ul>
          <CustomRange
            from={state.from}
            to={state.to}
            onApply={(from, to) => {
              onChange({ range: "custom", from, to });
              close();
            }}
          />
        </div>
      )}
    </Popover>
  );
}

function CustomRange({
  from: initialFrom,
  to: initialTo,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const error = validateCustomRange(from, to);
  const requests = error ? 0 : chunkRange({ from, to }).length;
  return (
    <form
      className="custom-range"
      onSubmit={(event) => {
        event.preventDefault();
        if (!error) onApply(from, to);
      }}
    >
      <span className="eyebrow">Custom range</span>
      <div className="custom-range-inputs">
        <input
          type="date"
          aria-label="Start date"
          className="input"
          value={from}
          max={to || undefined}
          onChange={(event) => setFrom(event.target.value)}
        />
        <span aria-hidden="true">–</span>
        <input
          type="date"
          aria-label="End date"
          className="input"
          value={to}
          min={from || undefined}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <p className={error ? "field-error" : "field-hint"}>
        {error ??
          `${daysInclusive({ from, to })} days${requests > 1 ? ` · loaded in ${requests} requests to Borg` : ""}`}
      </p>
      <button
        className="button button-primary"
        type="submit"
        disabled={Boolean(error)}
      >
        Apply range
      </button>
    </form>
  );
}

function AdvancedOptions({
  state,
  onChange,
}: {
  state: SalesParams;
  onChange: (next: Partial<SalesParams>) => void;
}) {
  const [gestiune, setGestiune] = useState(
    state.gestiune ? String(state.gestiune) : "",
  );
  const invalid = gestiune !== "" && !/^[1-9]\d*$/.test(gestiune);
  return (
    <form
      className="options-menu stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid)
          onChange({ gestiune: gestiune ? Number(gestiune) : undefined });
      }}
    >
      <Field
        label="Warehouse ID (gestiune)"
        hint="Optional. Filters in Borg before download."
        error={invalid ? "Enter a positive whole number." : null}
      >
        {(control) => (
          <div className="input-with-button">
            <input
              {...control}
              className="input"
              inputMode="numeric"
              placeholder="Any"
              value={gestiune}
              onChange={(event) => setGestiune(event.target.value.trim())}
            />
            <button
              className="button button-secondary"
              type="submit"
              disabled={
                invalid ||
                gestiune === (state.gestiune ? String(state.gestiune) : "")
              }
            >
              Apply
            </button>
          </div>
        )}
      </Field>
      <label className="check-row">
        <input
          type="checkbox"
          checked={state.transfers}
          onChange={(event) => onChange({ transfers: event.target.checked })}
        />
        <span>
          Include transfers
          <small>Stock moves between warehouses. Off by default.</small>
        </span>
      </label>
    </form>
  );
}
