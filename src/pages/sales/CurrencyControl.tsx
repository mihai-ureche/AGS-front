import { useState } from "react";
import { Field, Popover, Segmented } from "../../components/ui";
import {
  DEFAULT_EUR_RATE,
  formatRate,
  parseRate,
  useCurrency,
} from "../../lib/currency";
import type { Currency } from "../../lib/currency";

const currencyOptions: { value: Currency; label: string }[] = [
  { value: "RON", label: "Lei" },
  { value: "EUR", label: "Euro" },
];

/** Display currency for every amount and CSV export; Borg values stay in lei. */
export function CurrencyControl() {
  const { currency, eurRate, setCurrency } = useCurrency();
  return (
    <div className="currency-control">
      <Segmented
        label="Monedă"
        value={currency}
        options={currencyOptions}
        onChange={setCurrency}
      />
      {currency === "EUR" && (
        <Popover label={`1 € = ${formatRate(eurRate)} lei`} align="end">
          {(close) => <RateForm onDone={close} />}
        </Popover>
      )}
    </div>
  );
}

function RateForm({ onDone }: { onDone: () => void }) {
  const { eurRate, isDefaultRate, setEurRate } = useCurrency();
  const [text, setText] = useState(formatRate(eurRate));
  const rate = parseRate(text);
  return (
    <form
      className="options-menu stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (rate === null) return;
        setEurRate(rate);
        onDone();
      }}
    >
      <Field
        label="Curs de schimb (lei pentru 1 euro)"
        hint={`Implicit ${formatRate(DEFAULT_EUR_RATE)}. Valorile din Borg sunt în lei și se împart la acest curs, inclusiv în exporturile CSV.`}
        error={rate === null ? "Introduceți un curs între 0,01 și 100." : null}
      >
        {(control) => (
          <div className="input-with-button">
            <input
              {...control}
              className="input"
              inputMode="decimal"
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button
              className="button button-secondary"
              type="submit"
              disabled={rate === null || rate === eurRate}
            >
              Aplică
            </button>
          </div>
        )}
      </Field>
      {!isDefaultRate && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setEurRate(DEFAULT_EUR_RATE);
            onDone();
          }}
        >
          Revino la cursul implicit ({formatRate(DEFAULT_EUR_RATE)})
        </button>
      )}
    </form>
  );
}
