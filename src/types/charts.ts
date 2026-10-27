import type React from "react";

/**
 * Generic Recharts data item payload entry inside tooltips and legends
 */
export interface ChartPayloadEntry<T = number, P = Record<string, unknown>> {
  name: string;
  value: T;
  dataKey: string;
  color?: string;
  fill?: string;
  stroke?: string;
  unit?: string;
  payload: P;
  hide?: boolean;
}

/**
 * Props passed to custom Recharts Tooltip components
 */
export interface ChartTooltipProps<T = number, P = Record<string, unknown>> {
  active?: boolean;
  payload?: ChartPayloadEntry<T, P>[];
  label?: string | number;
  labelFormatter?: (label: string | number, payload: ChartPayloadEntry<T, P>[]) => React.ReactNode;
  formatter?: (
    value: T,
    name: string,
    item: ChartPayloadEntry<T, P>,
    index: number,
    payload: ChartPayloadEntry<T, P>[]
  ) => React.ReactNode;
  className?: string;
}
