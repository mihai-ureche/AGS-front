import { useMemo, useState } from "react";
import { money, number } from "../../lib/format";
import { heatmap, metricOptions } from "../../lib/sales";
import type { MetricKey, SaleLine } from "../../lib/sales";

const STEPS = 6;
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Weekday × hour of day, one sequential hue (light → dark = less → more). */
export function Heatmap({
  lines,
  metric,
}: {
  lines: SaleLine[];
  metric: MetricKey;
}) {
  const map = useMemo(() => heatmap(lines, metric), [lines, metric]);
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(
    null,
  );
  const metricInfo = metricOptions.find((option) => option.key === metric)!;
  const format = (value: number) =>
    metricInfo.money ? money(value) : number(value);
  const step = (value: number) =>
    value <= 0 || map.max <= 0
      ? 0
      : Math.min(STEPS, Math.ceil((value / map.max) * STEPS));

  // Borg omits a document time for some sources; a single hour means no real time data.
  if (map.distinctHours < 2) return null;

  const peak = map.values
    .flatMap((row, day) => row.map((value, hour) => ({ value, day, hour })))
    .sort((a, b) => b.value - a.value)[0];
  const readout = hover ?? (peak ? { day: peak.day, hour: peak.hour } : null);

  return (
    <section className="panel" aria-labelledby="heatmap-title">
      <div className="panel-heading">
        <div>
          <h2 id="heatmap-title">When sales happen</h2>
          <p>
            {metricInfo.label} by weekday and hour the document was issued
            {map.timedShare < 0.99 &&
              ` · ${Math.round(map.timedShare * 100)}% of lines have a time`}
          </p>
        </div>
        {readout && (
          <p className="heatmap-readout" aria-live="polite">
            <span>
              {hover ? "" : "Peak · "}
              {map.weekdays[readout.day]} {hourLabel(readout.hour)}
            </span>
            <strong>{format(map.values[readout.day]![readout.hour]!)}</strong>
          </p>
        )}
      </div>
      <div className="heatmap-scroll">
        <div
          className="heatmap"
          role="table"
          aria-label="Sales by weekday and hour"
          onPointerLeave={() => setHover(null)}
        >
          <div role="row" className="heatmap-hours">
            <span role="columnheader" />
            {Array.from({ length: 24 }, (_, hour) => (
              <span role="columnheader" key={hour}>
                {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
              </span>
            ))}
          </div>
          {map.values.map((row, day) => (
            <div role="row" key={day}>
              <span role="rowheader">{map.weekdays[day]}</span>
              {row.map((value, hour) => (
                <span
                  role="cell"
                  key={hour}
                  className={`heat-cell heat-${step(value)} ${hover?.day === day && hover.hour === hour ? "is-hover" : ""}`}
                  aria-label={`${map.weekdays[day]} ${hourLabel(hour)}: ${format(value)}`}
                  onPointerEnter={() => setHover({ day, hour })}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>Less</span>
        {Array.from({ length: STEPS + 1 }, (_, index) => (
          <i key={index} className={`heat-cell heat-${index}`} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
