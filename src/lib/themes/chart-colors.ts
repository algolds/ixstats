/**
 * Standard chart color palette for all GlassCharts
 */
export const CHART_COLOR_MAP: Record<string, string> = {
  blue: "hsl(217, 91%, 60%)",
  emerald: "hsl(160, 84%, 60%)",
  green: "hsl(142, 71%, 45%)",
  yellow: "hsl(45, 93%, 58%)",
  orange: "hsl(25, 95%, 53%)",
  red: "hsl(0, 84%, 60%)",
  purple: "hsl(262, 83%, 58%)",
  pink: "hsl(330, 81%, 60%)",
  indigo: "hsl(239, 84%, 67%)",
  cyan: "hsl(189, 94%, 43%)",
  gray: "hsl(215, 14%, 34%)",
  teal: "hsl(173, 80%, 40%)",
  lime: "hsl(84, 81%, 44%)",
  amber: "hsl(38, 92%, 50%)",
  rose: "hsl(350, 89%, 60%)",
};

/**
 * Default chart color sequence for charts without specific colors
 */
export const DEFAULT_CHART_COLORS = [
  "hsl(217, 91%, 60%)", // blue
  "hsl(160, 84%, 60%)", // emerald
  "hsl(262, 83%, 58%)", // purple
  "hsl(25, 95%, 53%)", // orange
  "hsl(330, 81%, 60%)", // pink
  "hsl(45, 93%, 58%)", // yellow
  "hsl(189, 94%, 43%)", // cyan
  "hsl(142, 71%, 45%)", // green
  "hsl(0, 84%, 60%)", // red
  "hsl(239, 84%, 67%)", // indigo
];

/**
 * Helper to get colors from data items that have a 'color' property
 */
export function getColorsFromData(data: Array<{ color?: string }>, fallback = "blue"): string[] {
  return data.map((item) => CHART_COLOR_MAP[item.color || fallback] || CHART_COLOR_MAP[fallback]);
}
