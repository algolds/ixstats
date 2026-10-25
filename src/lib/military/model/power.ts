/**
 * Layer (d): combat power per branch (research §7.4):
 *   CP_b = R × CEV × Q̄ × A × (K / k_ref)^α × N^(1−α)
 * K is real capital (a volume), so inflation never inflates power; k_ref (the domain's capital per equipped member)
 * normalises the volume so a fully equipped branch scores about its headcount.
 */
import {
  CEV_EXPONENT,
  CEV_MAX,
  CEV_MIN,
  DOCTRINE_CEV,
  DOMAIN_PARAMS,
  ENABLER_COVERAGE_SHARE,
  ENABLER_FLOOR,
  GENERIC_CAPITAL_QUALITY,
  MAX_FRONTIER_LAG_YEARS,
  QUALITY_DECAY_PER_YEAR,
  RD_REFERENCE_GDP_SHARE,
  type BranchDomain,
  type Doctrine,
} from "./constants";
import type { AssetState } from "./types";

const clamp = (min: number, max: number, value: number) => Math.min(max, Math.max(min, value));

/** Years the country's accessible frontier lags the realm's: max(0, 10 − 10 × H_RD / H_ref), H_ref = 0.0067 Y. */
export function frontierLag(rdStock: number, gdp: number): number {
  const reference = RD_REFERENCE_GDP_SHARE * Math.max(0, gdp);
  if (reference <= 0) return MAX_FRONTIER_LAG_YEARS;
  return Math.max(0, MAX_FRONTIER_LAG_YEARS * (1 - Math.max(0, rdStock) / reference));
}

/** A design's quality against the realm frontier: exp(−0.03 × age), never above 1 for designs from the future. */
export function designQuality(designYear: number, frontierYear: number): number {
  return Math.exp(-QUALITY_DECAY_PER_YEAR * Math.max(0, frontierYear - designYear));
}

/** Uncatalogued capital: 0.8 at the country's frontier, decaying with its lag behind the realm's. */
export const genericQuality = (lagYears: number) =>
  GENERIC_CAPITAL_QUALITY * Math.exp(-QUALITY_DECAY_PER_YEAR * lagYears);

/**
 * Q̄_b: the value-weighted quality of the branch's capital. Catalog assets count at their replacement value (up to
 * the branch's K), the rest of K is uncatalogued.
 */
export function branchQuality(input: {
  capital: number;
  assets: readonly Pick<AssetState, "quantity" | "unitRealValue" | "designYear">[];
  frontierYear: number;
  lagYears: number;
}): number {
  const generic = genericQuality(input.lagYears);
  let value = 0;
  let weighted = 0;
  for (const asset of input.assets) {
    const v = Math.max(0, asset.quantity) * Math.max(0, asset.unitRealValue);
    value += v;
    weighted += v * designQuality(asset.designYear ?? input.frontierYear, input.frontierYear);
  }
  if (input.capital <= 0) return value > 0 ? weighted / value : generic;
  const catalogued = Math.min(input.capital, value);
  const catalogQuality = value > 0 ? weighted / value : generic;
  return (catalogued * catalogQuality + (input.capital - catalogued) * generic) / input.capital;
}

type AssetMatch = Pick<AssetState, "subcategory" | "role">;

interface EnablerRule {
  /** The factor without the enabler (army without air defense ×0.85 …). */
  without: number;
  matches: (asset: AssetMatch) => boolean;
}

/** Combined-arms enablers per domain (designer; research §7.4): AD for land, ASW for sea, tankers for air. */
const ENABLERS: Partial<Record<BranchDomain, EnablerRule>> = {
  land: { without: 0.85, matches: (a) => a.subcategory === "air_defense" },
  sea: {
    without: 0.85,
    matches: (a) =>
      a.subcategory === "submarine" || a.subcategory === "frigate" || a.role === "anti_submarine",
  },
  air: { without: 0.9, matches: (a) => a.role === "tanker" },
  marines: { without: 0.85, matches: (a) => a.subcategory === "amphibious" },
};

const valueOf = (assets: readonly Pick<AssetState, "quantity" | "unitRealValue">[]) =>
  assets.reduce((sum, a) => sum + Math.max(0, a.quantity) * Math.max(0, a.unitRealValue), 0);

/**
 * A_b: the enabler factor. Coverage is enabler value against 5% of the branch's capital, so one token system does
 * not lift a large force. Uncatalogued capital is a balanced mix that carries its own 5%; catalog capital needs
 * catalog enablers: A = max(0.7, 1 − (1 − without) × (1 − coverage)).
 */
export function enablerFactor(input: {
  domain: BranchDomain;
  capital: number;
  branchAssets: readonly Pick<AssetState, "quantity" | "unitRealValue">[];
  nationAssets: readonly (AssetMatch & Pick<AssetState, "quantity" | "unitRealValue">)[];
}): number {
  const rule = ENABLERS[input.domain];
  if (!rule) return 1;
  const capital = Math.max(0, input.capital);
  const generic = capital - Math.min(capital, valueOf(input.branchAssets));
  const value = valueOf(input.nationAssets.filter(rule.matches)) + ENABLER_COVERAGE_SHARE * generic;
  const needed = ENABLER_COVERAGE_SHARE * capital;
  const coverage = needed > 0 ? Math.min(1, value / needed) : 1;
  return Math.max(ENABLER_FLOOR, 1 - (1 - rule.without) * (1 - coverage));
}

/** CEV = clamp(0.6, 1.5, (GDPpc / realm median)^0.12 × doctrine). */
export function combatEffectiveness(
  gdpPerCapita: number,
  realmMedianGdpPerCapita: number,
  doctrine: Doctrine
): number {
  if (gdpPerCapita <= 0 || realmMedianGdpPerCapita <= 0) return clamp(CEV_MIN, CEV_MAX, 1);
  const ratio = gdpPerCapita / realmMedianGdpPerCapita;
  return clamp(CEV_MIN, CEV_MAX, Math.pow(ratio, CEV_EXPONENT) * DOCTRINE_CEV[doctrine]);
}

/** CP_b = R × CEV × Q̄ × A × (K / k_ref)^α × N^(1−α). */
export function combatPower(input: {
  domain: BranchDomain;
  readiness: number;
  cev: number;
  quality: number;
  enabler: number;
  capital: number;
  personnel: number;
}): number {
  const { alpha, capitalPerMemberRef } = DOMAIN_PARAMS[input.domain];
  const volume = Math.max(0, input.capital) / capitalPerMemberRef;
  const people = Math.max(0, input.personnel);
  if (volume <= 0 || people <= 0) return 0;
  return (
    input.readiness *
    input.cev *
    input.quality *
    input.enabler *
    Math.pow(volume, alpha) *
    Math.pow(people, 1 - alpha)
  );
}
