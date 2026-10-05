import { useState } from "react";
import { CalendarDays, Check, RefreshCw } from "lucide-react";
import { Popover } from "../../components/ui";
import { chunkRange, daysInclusive, presets } from "../../lib/dates";
import { longDate, plural, shortDate } from "../../lib/format";
import { SALES_ACCOUNTS } from "../../lib/sales";
import { validateCustomRange } from "./params";
import type { SalesParams } from "./params";

export function QueryBar({
  state,
  onChange,
  onReload,
  loading,
}: {
  state: SalesParams;
  onChange: (next: Partial<SalesParams>) => void;
  onReload: () => void;
  loading: boolean;
}) {
  return (
    <div className="filter-row" role="group" aria-label="Interogare vânzări">
      <DateRangePicker state={state} onChange={onChange} />

      <label className="toggle-control">
        <input
          type="checkbox"
          role="switch"
          checked={state.compare}
          onChange={(event) => onChange({ compare: event.target.checked })}
        />
        <span>Compară cu perioada anterioară</span>
      </label>

      <button
        className="button button-secondary filter-row-end"
        onClick={onReload}
        disabled={loading}
        title="Descarcă date noi din Borg"
      >
        <RefreshCw size={15} className={loading ? "spin" : ""} /> Reîncarcă
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
          <ul role="listbox" aria-label="Intervale predefinite">
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
  const chunks = error ? 0 : chunkRange({ from, to }).length;
  return (
    <form
      className="custom-range"
      onSubmit={(event) => {
        event.preventDefault();
        if (!error) onApply(from, to);
      }}
    >
      <span className="eyebrow">Interval personalizat</span>
      <div className="custom-range-inputs">
        <input
          type="date"
          aria-label="Data de început"
          className="input"
          value={from}
          max={to || undefined}
          onChange={(event) => setFrom(event.target.value)}
        />
        <span aria-hidden="true">–</span>
        <input
          type="date"
          aria-label="Data de sfârșit"
          className="input"
          value={to}
          min={from || undefined}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <p className={error ? "field-error" : "field-hint"}>
        {error ??
          `${plural(daysInclusive({ from, to }), "zi", "zile")}${chunks > 1 ? ` · încărcat în ${plural(chunks * SALES_ACCOUNTS.length, "cerere", "cereri")} către Borg` : ""}`}
      </p>
      <button
        className="button button-primary"
        type="submit"
        disabled={Boolean(error)}
      >
        Aplică intervalul
      </button>
    </form>
  );
}
