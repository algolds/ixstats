import type { CardType } from "./enums";

export interface CardStatDef {
  key: string;
  label: string;
  color: string;
  description: string;
}

export interface StatProgression {
  boostPerLevel: number;
  cap: number;
}

export interface SpecialStatNormalization {
  type: "log" | "rank" | "linear";
  refMax?: number;
}

const BASE: CardStatDef[] = [
  { key: "force", label: "Force", color: "#E24B4A", description: "Military reach & hard power" },
  { key: "wealth", label: "Wealth", color: "#EF9F27", description: "Economic output & prosperity" },
  {
    key: "influence",
    label: "Influence",
    color: "#378ADD",
    description: "Diplomacy & international standing",
  },
  {
    key: "legacy",
    label: "Legacy",
    color: "#7F77DD",
    description: "Cultural depth & historical weight",
  },
];

const SPECIALS: Record<string, CardStatDef[]> = {
  NATION: [
    {
      key: "population",
      label: "Population",
      color: "#84CC16",
      description: "Total citizen count",
    },
    {
      key: "gdpPerCapita",
      label: "GDP per capita",
      color: "#84CC16",
      description: "Economic output per person",
    },
    {
      key: "tradeVolume",
      label: "Trade volume",
      color: "#84CC16",
      description: "International trade activity",
    },
    {
      key: "stabilityIndex",
      label: "Stability",
      color: "#84CC16",
      description: "Political & social stability",
    },
  ],
  LORE: [
    {
      key: "historicalWeight",
      label: "Historical weight",
      color: "#38BDF8",
      description: "Depth of historical significance",
    },
    {
      key: "culturalReach",
      label: "Cultural reach",
      color: "#38BDF8",
      description: "Spread of cultural influence",
    },
    {
      key: "temporalSpan",
      label: "Temporal span",
      color: "#38BDF8",
      description: "Length of historical relevance",
    },
    {
      key: "scholarlyDepth",
      label: "Scholarly depth",
      color: "#38BDF8",
      description: "Academic & research importance",
    },
  ],
  NS_IMPORT: [
    {
      key: "nsRarityRank",
      label: "NS rarity rank",
      color: "#A78BFA",
      description: "Rarity rank within NationStates",
    },
    {
      key: "collectionPullRate",
      label: "Collection pull rate",
      color: "#A78BFA",
      description: "How often this card appears in packs",
    },
    {
      key: "marketVelocity",
      label: "Market velocity",
      color: "#A78BFA",
      description: "How quickly this card trades",
    },
  ],
  SPECIAL: [
    {
      key: "editionNumber",
      label: "Edition number",
      color: "#F472B6",
      description: "Limited edition identifier",
    },
    {
      key: "eventSignificance",
      label: "Event significance",
      color: "#F472B6",
      description: "Importance of associated event",
    },
    {
      key: "scarcityIndex",
      label: "Scarcity index",
      color: "#F472B6",
      description: "How rare this card is",
    },
  ],
  COMMUNITY: [
    {
      key: "contributorRank",
      label: "Contributor rank",
      color: "#FB923C",
      description: "Community contributor standing",
    },
    {
      key: "communityVotes",
      label: "Community votes",
      color: "#FB923C",
      description: "Total community endorsements",
    },
    {
      key: "engagementScore",
      label: "Engagement score",
      color: "#FB923C",
      description: "Community interaction level",
    },
  ],
};

export const STAT_PROGRESSION: StatProgression = {
  boostPerLevel: 5,
  cap: 100,
};

export const LEGACY_KEY_MAP: Record<string, string> = {
  military: "force",
  economic: "wealth",
  diplomatic: "influence",
  social: "legacy",
};

export const SPECIAL_NORMALIZATION: Record<string, SpecialStatNormalization> = {
  population: { type: "log", refMax: 100_000_000 },
  gdpPerCapita: { type: "log", refMax: 200_000 },
  tradeVolume: { type: "log", refMax: 10_000_000_000_000 },
  stabilityIndex: { type: "linear" },
  historicalWeight: { type: "linear" },
  culturalReach: { type: "linear" },
  temporalSpan: { type: "linear" },
  scholarlyDepth: { type: "linear" },
  nsRarityRank: { type: "rank", refMax: 5000 },
  collectionPullRate: { type: "linear" },
  marketVelocity: { type: "linear" },
  editionNumber: { type: "rank", refMax: 500 },
  eventSignificance: { type: "linear" },
  scarcityIndex: { type: "linear" },
  contributorRank: { type: "rank", refMax: 1000 },
  communityVotes: { type: "log", refMax: 1_000_000 },
  engagementScore: { type: "linear" },
};

export function getBaseStatDefs(): CardStatDef[] {
  return BASE;
}

export function getBaseStatDef(key: string): CardStatDef | undefined {
  return BASE.find((s) => s.key === key);
}

export function getSpecialStatsForType(cardType: CardType): CardStatDef[] {
  return SPECIALS[cardType] ?? [];
}

export function getStatDefByKey(key: string): CardStatDef | undefined {
  return (
    BASE.find((s) => s.key === key) ??
    Object.values(SPECIALS)
      .flat()
      .find((s) => s.key === key)
  );
}

export function getBaseStatKeys(): string[] {
  return BASE.map((s) => s.key);
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

export function formatCompactValue(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

export const STAT_CONFIG = { BASE, SPECIALS, PROGRESSION: STAT_PROGRESSION, LEGACY_KEY_MAP };
