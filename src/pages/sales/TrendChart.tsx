import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DateRange } from "../../lib/dates";
import { compact, money, number } from "../../lib/format";
import {
  bucketFor,
  dimensions,
  groupLines,
  metricOptions,
  timeSeries,
} from "../../lib/sales";
import type { Dimension, MetricKey, SaleLine } from "../../lib/sales";

export type SplitBy =
  "none" | Extract<Dimension, "docType" | "warehouse" | "category" | "channel">;
export const splitOptions: { value: SplitBy; label: string }[] = [
  { value: "none", label: "No split" },
  { value: "docType", label: "Document type" },
  { value: "warehouse", label: "Warehouse" },
  { value: "category", label: "Category" },
  { value: "channel", label: "Channel" },
];

// Categorical slots 1–3 (validated all-pairs, light and dark); the tail folds into gray "Other".
const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
const OTHER_COLOR = "var(--series-other)";

type Series = { key: string; name: string; color: string };

export function TrendChart({
  lines,
  paletteLines,
  range,
  metric,
  split,
  previous,
}: {
  lines: SaleLine[];
  /** Unrefined lines: the split's top values (and so their colors) stay put while refining. */
  paletteLines: SaleLine[];
  range: DateRange;
  metric: MetricKey;
  split: SplitBy;
  previous?: { lines: SaleLine[]; range: DateRange };
}) {
  const metricInfo = metricOptions.find((option) => option.key === metric)!;
  const format = (value: number) =>
    metricInfo.money ? money(value) : number(value);

  const series = useMemo<Series[]>(() => {
    if (split === "none")
      return [{ key: "value", name: "This period", color: SERIES_COLORS[0]! }];
    const groups = groupLines(paletteLines, split, metric);
    const top = groups.slice(0, 3).map((group, index) => ({
      key: `s:${group.key}`,
      name: group.name,
      color: SERIES_COLORS[index]!,
    }));
    return groups.length > 3
      ? [...top, { key: "other", name: "Other", color: OTHER_COLOR }]
      : top;
  }, [paletteLines, split, metric]);

  const data = useMemo(
    () =>
      timeSeries(lines, range, metric, {
        split: split === "none" ? undefined : split,
        splitKeys: series
          .filter((item) => item.key.startsWith("s:"))
          .map((item) => item.key.slice(2)),
        previous: split === "none" ? previous : undefined,
      }),
    [lines, range, metric, split, series, previous],
  );

  const showPrevious = split === "none" && Boolean(previous);
  const legend: (Series & { dashed?: boolean })[] = showPrevious
    ? [
        ...series,
        {
          key: "previous",
          name: "Previous period",
          color: "var(--series-previous)",
        },
      ]
    : split === "none"
      ? []
      : series;
  const bucket = bucketFor(range);

  return (
    <figure className="chart-figure">
      {legend.length > 1 && (
        <ul className="legend" aria-label="Legend">
          {legend.map((item) => (
            <li key={item.key}>
              <i
                className={split === "none" ? "legend-line" : "legend-swatch"}
                style={{ background: item.color }}
              />
              {item.name}
            </li>
          ))}
        </ul>
      )}
      <div
        className="trend-chart"
        role="img"
        aria-label={`${metricInfo.label} per ${bucket}${split === "none" ? "" : `, split by ${dimensions[split].label.toLowerCase()}`}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: "var(--axis)" }}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={52}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(value: number) => compact(value)}
            />
            <Tooltip
              cursor={
                split === "none"
                  ? { stroke: "var(--axis)", strokeWidth: 1 }
                  : { fill: "var(--hover-wash)" }
              }
              content={(props) => (
                <ChartTooltip
                  {...props}
                  series={legend.length ? legend : series}
                  format={format}
                />
              )}
            />
            {split === "none" ? (
              <>
                {showPrevious && (
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke="var(--series-previous)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "var(--surface)",
                    }}
                    isAnimationActive={false}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  fill="var(--series-1)"
                  fillOpacity={0.1}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                  isAnimationActive={false}
                />
              </>
            ) : (
              series.map((item, index) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.name}
                  stackId="split"
                  fill={item.color}
                  stroke="var(--surface)"
                  strokeWidth={1}
                  maxBarSize={24}
                  radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  series,
  format,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  series: Series[];
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Record<
    string,
    number | string | undefined
  >;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-title">{point.label}</span>
      {series.map((item) => {
        const value = point[item.key];
        if (typeof value !== "number") return null;
        return (
          <div key={item.key} className="chart-tooltip-row">
            <i style={{ background: item.color }} />
            <strong>{format(value)}</strong>
            <span>
              {item.key === "previous" && point.previousLabel
                ? `${item.name} (${point.previousLabel})`
                : item.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
