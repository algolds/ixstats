export type AccentColor =
  "emerald" | "cyan" | "amber" | "indigo" | "red" | "blue" | "purple" | "rose" | "teal";

export interface CustomSector {
  id: string;
  key: string;
  label: string;
  shortLabel: string;
  defaultTariff: number;
  min: number;
  max: number;
  step: number;
  accent: AccentColor;
  defaultShare: number;
}

export const ACCENT_BORDER: Record<AccentColor, string> = {
  emerald: "border-emerald-500/30",
  cyan: "border-cyan-500/30",
  amber: "border-amber-500/30",
  indigo: "border-indigo-500/30",
  red: "border-red-500/30",
  blue: "border-blue-500/30",
  purple: "border-indigo-500/30",
  rose: "border-red-500/30",
  teal: "border-cyan-500/30",
};

export const ACCENT_BG: Record<AccentColor, string> = {
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  purple: "bg-indigo-500",
  rose: "bg-red-500",
  teal: "bg-cyan-500",
};

export const ACCENT_TEXT: Record<AccentColor, string> = {
  emerald: "text-emerald-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  indigo: "text-indigo-400",
  red: "text-red-400",
  blue: "text-blue-400",
  purple: "text-indigo-400",
  rose: "text-red-400",
  teal: "text-cyan-400",
};

import { formatCompact } from "~/lib/format/compact";
import type { RecordedSector } from "~/lib/economy/sector-breakdown";

export { formatCompact };

const SECTOR_ACCENTS: AccentColor[] = ["emerald", "cyan", "amber", "indigo", "red", "blue"];

/**
 * Seed the tariff planner from the nation's recorded sectors (`parseSectorBreakdown`), weighting
 * each by its recorded share of GDP. Every sector starts at `baseTariff` — the saved Fiscal Policy
 * tariff rate, or 0 when none is saved.
 */
export function sectorsFromRecorded(
  recorded: RecordedSector[],
  baseTariff: number
): CustomSector[] {
  return recorded.map((sector, idx) => {
    const key = sector.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `recorded-${idx}-${key}`,
      key,
      label: sector.name,
      shortLabel: sector.name.slice(0, 12),
      defaultTariff: baseTariff,
      min: 0,
      max: 50,
      step: 0.5,
      accent: SECTOR_ACCENTS[idx % SECTOR_ACCENTS.length]!,
      defaultShare: sector.share,
    };
  });
}
