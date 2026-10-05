import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OTHER_CLIENTS } from "../../lib/clients";
import type { clientComposition } from "../../lib/clients";
import { useCurrency } from "../../lib/currency";
import { percent } from "../../lib/format";

const COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "#7955a3",
  "#197c87",
];
type Composition = ReturnType<typeof clientComposition>;

export function ClientPieChart({
  data,
  onSelect,
}: {
  data: Composition;
  onSelect: (key: string) => void;
}) {
  const { money } = useCurrency();
  const slices = data.segments.map((segment, index) => ({
    ...segment,
    fill:
      segment.key === OTHER_CLIENTS
        ? "var(--series-other)"
        : COLORS[index % COLORS.length],
  }));
  return (
    <div className="client-composition">
      <div className="panel-heading">
        <div>
          <h3>Ponderea clienților în vânzări</h3>
          <p>
            Fără TVA · total reprezentat: {money(data.total)}. Căutarea
            păstrează totalul depozitelor selectate.
          </p>
        </div>
      </div>
      {data.negative < 0 && (
        <p className="field-hint">
          Clienți cu retururi nete: {money(data.negative)}, neincluși în
          diagramă. Procentele se raportează la clienții cu vânzări pozitive.
        </p>
      )}
      {data.total <= 0 ? (
        <p className="muted">
          Nu există vânzări pozitive pentru diagrama circulară.
        </p>
      ) : (
        <div className="client-composition-body">
          <div
            className="client-pie"
            role="img"
            aria-label={`Ponderea clienților în vânzări: ${slices.map((slice) => `${slice.name} ${percent(slice.share)}`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="48%"
                  outerRadius="85%"
                  stroke="var(--surface)"
                  strokeWidth={3}
                  isAnimationActive={false}
                  onClick={(slice) => {
                    const key = slice.payload?.key;
                    if (typeof key === "string" && key !== OTHER_CLIENTS)
                      onSelect(key);
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const slice = payload?.[0]?.payload as
                      (typeof slices)[number] | undefined;
                    return active && slice ? (
                      <div className="chart-tooltip">
                        <span className="chart-tooltip-title">
                          {slice.name}
                        </span>
                        <strong>
                          {money(slice.value)} · {percent(slice.share)}
                        </strong>
                      </div>
                    ) : null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul
            className="client-pie-legend"
            aria-label="Ponderea fiecărui client"
          >
            {slices.map((slice) => (
              <li key={slice.key}>
                <button
                  className="client-share-button"
                  disabled={slice.key === OTHER_CLIENTS}
                  onClick={() => onSelect(slice.key)}
                >
                  <i
                    className="legend-swatch"
                    style={{ background: slice.fill }}
                    aria-hidden="true"
                  />
                  <span>{slice.name}</span>
                  <strong>{percent(slice.share)}</strong>
                  <small>{money(slice.value)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
