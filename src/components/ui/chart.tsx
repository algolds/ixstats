"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "~/lib/utils/cn";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ':is(.dark, [data-theme="dark"])' } as const;

export const FACET_CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
] as const;

export const FACET_CHART_BG_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
] as const;

export const FACET_AXIS_TICK = {
  fill: "var(--color-label-secondary)",
  fontSize: 12,
} as const;

type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-label-secondary [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-separator [&_.recharts-curve.recharts-tooltip-cursor]:stroke-separator [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-separator [&_.recharts-radial-bar-background-sector]:fill-fill-3 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-fill-3 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-separator text-caption flex aspect-video justify-center [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = Tooltip;

import type { ChartPayloadEntry } from "~/types/charts";

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: {
  active?: boolean;
  payload?: ChartPayloadEntry[];
  label?: string | number | React.ReactNode;
  className?: string;
  indicator?: "line" | "dot" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  labelFormatter?: (label: React.ReactNode, payload: ChartPayloadEntry[]) => React.ReactNode;
  labelClassName?: string;
  formatter?: (
    value: unknown,
    name: string | number,
    item: ChartPayloadEntry,
    index: number,
    payload: Record<string, unknown>
  ) => React.ReactNode;
  color?: string;
  nameKey?: string;
  labelKey?: string;
}) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string" ? config[label]?.label || label : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "facet-overlay text-label rounded-control text-caption grid min-w-[8rem] items-start gap-1.5 px-3 py-2 tabular-nums",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1">
        {payload?.map((item: ChartPayloadEntry, index: number) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const payloadFill =
            typeof item.payload?.fill === "string" ? item.payload.fill : undefined;
          const indicatorColor = color || payloadFill || item.color;

          return (
            <div
              key={`${item.dataKey}-${index}`}
              className={cn(
                "[&>svg]:text-label-secondary flex w-full flex-wrap items-stretch gap-2 [:where(&)>svg]:h-2.5 [:where(&)>svg]:w-2.5",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-full border-(--color-border) bg-(--color-bg)",
                          {
                            "h-2 w-2": indicator === "dot",
                            "w-1 rounded-[2px]": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          }
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between gap-3 leading-none",
                      nestLabel ? "items-end" : "items-center"
                    )}
                  >
                    <div className="grid gap-1">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-label-secondary">{itemConfig?.label || item.name}</span>
                    </div>
                    {item.value !== undefined && item.value !== null && (
                      <span className="text-label font-semibold tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StandaloneTooltipItem {
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  fill?: string;
  stroke?: string;
  payload?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Facet glass overlay tooltip for standalone Recharts charts (without `<ChartContainer>`).
 */
function FacetChartTooltip({
  active,
  payload,
  label,
  hideLabel = false,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly StandaloneTooltipItem[];
  label?: string | number;
  hideLabel?: boolean;
  labelFormatter?: (
    label: string | number,
    payload: readonly StandaloneTooltipItem[]
  ) => React.ReactNode;
  valueFormatter?: (value: number, name: string, item: StandaloneTooltipItem) => React.ReactNode;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const headerText =
    hideLabel || label === undefined || label === ""
      ? null
      : labelFormatter
        ? labelFormatter(label, payload)
        : String(label);

  return (
    <div className="facet-overlay text-label rounded-control text-caption grid min-w-32 gap-1.5 px-3 py-2 tabular-nums">
      {headerText && <div className="text-label-secondary font-medium">{headerText}</div>}
      <div className="grid gap-1">
        {payload.map((item, idx) => {
          const rawName = String(item.name ?? item.payload?.name ?? item.dataKey ?? "");
          const swatch =
            item.color ||
            item.stroke ||
            item.fill ||
            (typeof item.payload?.color === "string" ? item.payload.color : undefined) ||
            (typeof item.payload?.fill === "string" ? item.payload.fill : undefined) ||
            "var(--color-chart-1)";
          const numVal = typeof item.value === "number" ? item.value : Number(item.value ?? 0);
          const renderedValue = valueFormatter
            ? valueFormatter(numVal, rawName, item)
            : Number.isFinite(numVal)
              ? numVal.toLocaleString()
              : String(item.value ?? "");

          return (
            <div
              key={`${String(item.dataKey ?? rawName)}-${idx}`}
              className="flex items-center justify-between gap-3 leading-none"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: swatch }}
                />
                <span className="text-label-secondary">{rawName}</span>
              </div>
              <span className="text-label font-semibold tabular-nums">{renderedValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, FacetChartTooltip };
