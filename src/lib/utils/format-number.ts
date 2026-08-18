import { SPECIAL_NORMALIZATION } from "~/lib/cards";

export function formatCompactValue(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

export function normalizeSpecialStat(key: string, rawValue: number): number {
  const config = SPECIAL_NORMALIZATION[key];
  if (!config) return Math.min(Math.max(rawValue, 0), 100);

  switch (config.type) {
    case "linear":
      return Math.min(Math.max(Math.round(rawValue), 0), 100);

    case "log": {
      const ref = config.refMax ?? 100_000_000;
      if (rawValue <= 0) return 0;
      const normalized = (Math.log10(rawValue) / Math.log10(ref)) * 100;
      return Math.min(Math.max(Math.round(normalized), 0), 100);
    }

    case "rank": {
      const max = config.refMax ?? 1000;
      if (rawValue <= 0) return 100;
      const normalized = (1 - Math.min(rawValue, max) / max) * 100;
      return Math.min(Math.max(Math.round(normalized), 0), 100);
    }

    default:
      return Math.min(Math.max(Math.round(rawValue), 0), 100);
  }
}
