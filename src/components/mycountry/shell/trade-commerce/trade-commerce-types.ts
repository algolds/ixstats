export type AccentColor =
  | "emerald"
  | "cyan"
  | "amber"
  | "indigo"
  | "red"
  | "blue"
  | "purple"
  | "rose"
  | "teal";

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

export const CORE_SECTORS: CustomSector[] = [
  {
    id: "sec-tech",
    key: "technology",
    label: "High-Tech & Advanced Electronics",
    shortLabel: "Tech & Semi",
    defaultTariff: 2.0,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "cyan",
    defaultShare: 32.5,
  },
  {
    id: "sec-heavy",
    key: "heavy-machinery",
    label: "Industrial Machinery & Automotive",
    shortLabel: "Machinery",
    defaultTariff: 4.0,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "emerald",
    defaultShare: 31.1,
  },
  {
    id: "sec-raw",
    key: "raw-materials",
    label: "Raw Materials & Natural Resources",
    shortLabel: "Raw Mining",
    defaultTariff: 1.5,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "amber",
    defaultShare: 21.8,
  },
  {
    id: "sec-agri",
    key: "agriculture",
    label: "Agricultural & Food Goods",
    shortLabel: "Agri-Food",
    defaultTariff: 6.5,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "indigo",
    defaultShare: 14.6,
  },
];

export const DEFAULT_SECTORS = CORE_SECTORS;

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

export { formatCompact };

interface RawSectorItem {
  id?: string;
  key?: string;
  name?: string;
  label?: string;
  shortName?: string;
  shortLabel?: string;
  percentage?: number;
  gdpContribution?: number;
  defaultShare?: number;
  tariffRate?: number;
  defaultTariff?: number;
  accent?: AccentColor;
}

export function parseSectorBreakdownJson(raw: string | null | undefined): CustomSector[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const accents: AccentColor[] = ["emerald", "cyan", "amber", "indigo", "red", "blue"];
      return (parsed as RawSectorItem[]).map((item, idx) => {
        const label = item.name ?? item.label ?? `Sector ${idx + 1}`;
        const shortLabel = item.shortName ?? item.shortLabel ?? label.slice(0, 12);
        const defaultShare = item.percentage ?? item.gdpContribution ?? item.defaultShare ?? 25;
        const defaultTariff = item.tariffRate ?? item.defaultTariff ?? 4.0;
        const accent = item.accent ?? accents[idx % accents.length];

        return {
          id: item.id ?? `custom-sec-${idx}-${Date.now()}`,
          key: item.key ?? label.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          label,
          shortLabel,
          defaultTariff: Number(defaultTariff) || 4.0,
          min: 0,
          max: 50,
          step: 0.5,
          accent,
          defaultShare: Number(defaultShare) || 10,
        };
      });
    }
  } catch {
    // not valid JSON
  }
  return null;
}
