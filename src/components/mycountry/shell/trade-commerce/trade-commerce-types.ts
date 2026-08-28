export type AccentColor = "emerald" | "cyan" | "amber" | "purple" | "rose" | "teal";

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

export const DEFAULT_SECTORS: CustomSector[] = [
  {
    id: "sec-hitech",
    key: "hitech",
    label: "High-Tech & Semiconductors",
    shortLabel: "High-Tech",
    defaultTariff: 2.5,
    min: 0,
    max: 30,
    step: 0.5,
    accent: "emerald",
    defaultShare: 35.4,
  },
  {
    id: "sec-machinery",
    key: "machinery",
    label: "Industrial Machinery & Capital Goods",
    shortLabel: "Machinery",
    defaultTariff: 4.0,
    min: 0,
    max: 35,
    step: 0.5,
    accent: "cyan",
    defaultShare: 28.2,
  },
  {
    id: "sec-energy",
    key: "energy",
    label: "Energy & Mineral Resources",
    shortLabel: "Energy",
    defaultTariff: 3.0,
    min: 0,
    max: 40,
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
    accent: "purple",
    defaultShare: 14.6,
  },
];

export const ACCENT_BORDER: Record<AccentColor, string> = {
  emerald: "border-emerald-500/30",
  cyan: "border-cyan-500/30",
  amber: "border-amber-500/30",
  purple: "border-purple-500/30",
  rose: "border-rose-500/30",
  teal: "border-teal-500/30",
};

export const ACCENT_BG: Record<AccentColor, string> = {
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  rose: "bg-rose-500",
  teal: "bg-teal-500",
};

export const ACCENT_TEXT: Record<AccentColor, string> = {
  emerald: "text-emerald-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  purple: "text-purple-400",
  rose: "text-rose-400",
  teal: "text-teal-400",
};

export function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

export function parseSectorBreakdownJson(raw: string | null | undefined): CustomSector[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const accents: AccentColor[] = ["emerald", "cyan", "amber", "purple", "rose", "teal"];
      return parsed.map((item: any, idx: number) => {
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
