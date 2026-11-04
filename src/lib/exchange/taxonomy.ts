/**
 * Exchange phase 3 taxonomy: 12 sub-industries under the 4 macro sectors, the realm
 * supply-chain multiplier, the credit rating ladder and the derived company ratios.
 * Pure by design: the tick, the UI and the tests share one table without a database.
 */
import type { SectorKey } from "./companies";

export const SUB_INDUSTRY_KEYS = [
  "agribusiness",
  "forestry_fisheries",
  "biotech_food",
  "energy_mining",
  "heavy_manufacturing",
  "chemicals",
  "finance_insurance",
  "logistics",
  "software_media",
  "civic_utilities",
  "defense_aerospace",
  "pharma_biotech",
] as const;

export type SubIndustryKey = (typeof SUB_INDUSTRY_KEYS)[number];

export interface SubIndustry {
  key: SubIndustryKey;
  label: string;
  sectorKey: SectorKey;
  baseMargin: number;
  upkeepRate: number;
  upstream: ReadonlyArray<SubIndustryKey>;
}

// semiconductors_rd is named as an input in the design table but has no sub-industry
// of its own, so it is left out of the links rather than left to never be satisfied.
export const SUB_INDUSTRIES: ReadonlyArray<SubIndustry> = [
  {
    key: "agribusiness",
    label: "Agribusiness & Crops",
    sectorKey: "agriculture",
    baseMargin: 0.08,
    upkeepRate: 0.015,
    upstream: ["logistics", "chemicals"],
  },
  {
    key: "forestry_fisheries",
    label: "Forestry & Fisheries",
    sectorKey: "agriculture",
    baseMargin: 0.07,
    upkeepRate: 0.012,
    upstream: ["logistics"],
  },
  {
    key: "biotech_food",
    label: "Agri-Biotech & Food Processing",
    sectorKey: "agriculture",
    baseMargin: 0.11,
    upkeepRate: 0.025,
    upstream: ["agribusiness", "pharma_biotech"],
  },
  {
    key: "energy_mining",
    label: "Energy & Resource Extraction",
    sectorKey: "industry",
    baseMargin: 0.1,
    upkeepRate: 0.032,
    upstream: ["heavy_manufacturing", "logistics"],
  },
  {
    key: "heavy_manufacturing",
    label: "Heavy Manufacturing & Defense",
    sectorKey: "industry",
    baseMargin: 0.11,
    upkeepRate: 0.03,
    upstream: ["energy_mining", "chemicals"],
  },
  {
    key: "chemicals",
    label: "Chemicals & Advanced Materials",
    sectorKey: "industry",
    baseMargin: 0.1,
    upkeepRate: 0.025,
    upstream: ["energy_mining"],
  },
  {
    key: "finance_insurance",
    label: "Banking, Finance & Insurance",
    sectorKey: "services",
    baseMargin: 0.12,
    upkeepRate: 0.018,
    upstream: ["software_media", "civic_utilities"],
  },
  {
    key: "logistics",
    label: "Global Logistics & Shipping",
    sectorKey: "services",
    baseMargin: 0.09,
    upkeepRate: 0.024,
    upstream: ["energy_mining", "heavy_manufacturing"],
  },
  {
    key: "software_media",
    label: "Technology, Media & Telecom",
    sectorKey: "services",
    baseMargin: 0.14,
    upkeepRate: 0.026,
    upstream: ["finance_insurance"],
  },
  {
    key: "civic_utilities",
    label: "Public Utilities & Grid",
    sectorKey: "government",
    baseMargin: 0.07,
    upkeepRate: 0.014,
    upstream: ["energy_mining", "defense_aerospace"],
  },
  {
    key: "defense_aerospace",
    label: "Defense & Aerospace",
    sectorKey: "government",
    baseMargin: 0.12,
    upkeepRate: 0.032,
    upstream: ["heavy_manufacturing", "software_media"],
  },
  {
    key: "pharma_biotech",
    label: "Healthcare & Pharmaceuticals",
    sectorKey: "government",
    baseMargin: 0.13,
    upkeepRate: 0.028,
    upstream: ["chemicals", "biotech_food"],
  },
];

export function subIndustriesOf(sectorKey: SectorKey): SubIndustry[] {
  return SUB_INDUSTRIES.filter((sub) => sub.sectorKey === sectorKey);
}

export function isSubIndustryKey(key: string): key is SubIndustryKey {
  return SUB_INDUSTRIES.some((sub) => sub.key === key);
}

const SUPPLY_FLOOR = 0.9;
const SUPPLY_CEILING = 1.15;
const SUPPLY_LINK_BONUS = 0.05;
const SUPPLY_LINK_CAP = 0.1;
const RECENT_CONTRACT_BONUS = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function supplyChainFactor(
  subIndustryKey: string,
  realmSubIndustryKeys: ReadonlyArray<string>,
  options: { recentUpstreamContract?: boolean } = {}
): number {
  const upstream = SUB_INDUSTRIES.find((sub) => sub.key === subIndustryKey)?.upstream ?? [];
  if (upstream.length === 0) return 1;
  const satisfied = upstream.filter((key) => realmSubIndustryKeys.includes(key)).length;
  if (satisfied === 0) return SUPPLY_FLOOR;
  const base = 1 + Math.min(SUPPLY_LINK_CAP, SUPPLY_LINK_BONUS * satisfied);
  const withContract = base + (options.recentUpstreamContract ? RECENT_CONTRACT_BONUS : 0);
  return clamp(withContract, SUPPLY_FLOOR, SUPPLY_CEILING);
}

export const CREDIT_RATINGS = ["AAA", "AA", "A", "BBB", "B", "CCC", "D"] as const;
export type CreditRating = (typeof CREDIT_RATINGS)[number];

export const CREDIT_SPREADS: Record<CreditRating, number | null> = {
  AAA: 0.005,
  AA: 0.01,
  A: 0.02,
  BBB: 0.035,
  B: 0.06,
  CCC: 0.1,
  D: null,
};

export interface CreditRatingInput {
  standing: number;
  debtToEquity: number;
  lastTickNetIncome: number;
}

export function creditRatingFor({
  standing,
  debtToEquity,
  lastTickNetIncome,
}: CreditRatingInput): CreditRating {
  if (standing >= 10 && debtToEquity <= 0.1 && lastTickNetIncome > 0) return "AAA";
  if (standing >= 6 && debtToEquity <= 0.3) return "AA";
  if (standing >= 3 && debtToEquity <= 0.6) return "A";
  if (standing >= 1 && debtToEquity <= 1.0) return "BBB";
  if (standing >= -1) return "B";
  if (standing >= -3) return "CCC";
  return "D";
}

export function creditSpreadFor(rating: CreditRating): number | null {
  return CREDIT_SPREADS[rating];
}

const DEFAULT_HQ_INTEREST_RATE = 0.05;
const HQ_RATE_FLOOR = 0.02;
const HQ_RATE_CEILING = 0.2;

export function borrowRateFor(hqInterestRate: number | null, rating: CreditRating): number | null {
  const spread = creditSpreadFor(rating);
  if (spread === null) return null;
  const baseRate = clamp(
    hqInterestRate ?? DEFAULT_HQ_INTEREST_RATE,
    HQ_RATE_FLOOR,
    HQ_RATE_CEILING
  );
  return baseRate + spread;
}

export interface CompanyMetricsInput {
  capital: number;
  decisionValue: number;
  creditDrawn: number;
  standing: number;
  sharesOutstanding: number;
  lastTradePrice: number | null;
  fairValue: number;
  lastTickNetIncome: number;
  trailing30dDividends: number;
}

export interface CompanyMetrics {
  marketCap: number;
  bookValue: number;
  eps: number;
  peRatio: number | null;
  dividendYield: number | null;
  debtToEquity: number;
  creditRating: CreditRating;
  sharePrice: number;
}

// Four 6-hour ticks a day over a 365-day year, so EPS annualises the last tick.
const TICKS_PER_YEAR = 4 * 365;

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function roundOrNull(value: number | null, places: number): number | null {
  return value === null ? null : round(value, places);
}

export function computeCompanyMetrics(input: CompanyMetricsInput): CompanyMetrics {
  const {
    capital,
    decisionValue,
    creditDrawn,
    standing,
    sharesOutstanding,
    lastTradePrice,
    fairValue,
    lastTickNetIncome,
    trailing30dDividends,
  } = input;
  const hasShares = sharesOutstanding > 0;
  const sharePrice = lastTradePrice ?? (hasShares ? fairValue / sharesOutstanding : 0);
  const marketCap = sharePrice * sharesOutstanding;
  const bookValue = Math.max(0, capital + decisionValue - creditDrawn);
  const eps = hasShares ? (lastTickNetIncome * TICKS_PER_YEAR) / sharesOutstanding : 0;
  const peRatio = eps > 0 ? sharePrice / eps : null;
  const debtToEquity = creditDrawn / Math.max(1, capital + decisionValue);
  const dividendYield = marketCap > 0 ? trailing30dDividends / marketCap : null;
  const creditRating = creditRatingFor({ standing, debtToEquity, lastTickNetIncome });

  return {
    marketCap: round(marketCap, 2),
    bookValue: round(bookValue, 2),
    eps: round(eps, 2),
    peRatio: roundOrNull(peRatio, 4),
    dividendYield: roundOrNull(dividendYield, 4),
    debtToEquity: round(debtToEquity, 4),
    creditRating,
    sharePrice: round(sharePrice, 2),
  };
}
