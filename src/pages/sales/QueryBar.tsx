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
import { longDate, plural, shortDate } from "../../lib/format";
import { entityLabels } from "../../lib/labels";
import { docTypeLabels } from "../../lib/sales";
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
    <div className="filter-row" role="group" aria-label="Interogare vânzări">
      <label className="control control-select">
        <Building2 size={16} aria-hidden="true" />
        <select
          aria-label="Entitate"
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
          aria-label="Tip document"
          value={state.docType ?? ""}
          onChange={(event) =>
            onChange({
              docType: (event.target.value || undefined) as DocType | undefined,
            })
          }
        >
          <option value="">Toate documentele</option>
          <option value="BFD">{docTypeLabels.BFD}</option>
          <option value="AIM">{docTypeLabels.AIM}</option>
        </select>
      </label>

      <Popover label="Opțiuni" icon={SlidersHorizontal} badge={advanced}>
        {() => <AdvancedOptions state={state} onChange={onChange} />}
      </Popover>

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
  const requests = error ? 0 : chunkRange({ from, to }).length;
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
          `${plural(daysInclusive({ from, to }), "zi", "zile")}${requests > 1 ? ` · încărcat în ${plural(requests, "cerere", "cereri")} către Borg` : ""}`}
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
        label="ID gestiune"
        hint="Opțional. Filtrează în Borg înainte de descărcare."
        error={invalid ? "Introduceți un număr întreg pozitiv." : null}
      >
        {(control) => (
          <div className="input-with-button">
            <input
              {...control}
              className="input"
              inputMode="numeric"
              placeholder="Oricare"
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
              Aplică
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
          Include transferurile
          <small>Mutări de stoc între depozite. Dezactivat implicit.</small>
        </span>
      </label>
    </form>
  );
}
