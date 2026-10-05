/**
 * Relative-Development Asymmetry in Diplomacy (v2 Bible §6)
 *
 * "Free trade with a developing nation ≠ super-economy"
 * Calculates GDP-per-capita / economic tier ratios between partner nations and
 * derives asymmetric trade, tax, and diplomatic standing multipliers.
 */
import { ECONOMIC_TIERS } from "~/lib/economic-tier-filter";

interface AsymmetryAnalysis {
  ratio: number; // Partner tier / Self tier (>1 = partner higher development)
  tierDiff: number;
  label:
    "Symmetrical Partner" | "Capital Imbalance" | "Resource Synergist" | "Superpower Influence";
  asymmetricMultiplier: number;
  tariffMultiplier: number;
  capitalFlowBonus: number;
  /** Semantic text colour for an outline `<Badge>` (reads in both themes). */
  badgeColor: string;
}

/** A country's economic tier (`Country.economicTier`) as a 1-based rank, lowest GDP per capita first. */
function tierRank(tier: string | null | undefined): number | null {
  if (!tier) return null;
  const index = ECONOMIC_TIERS.findIndex((t) => t.toLowerCase() === tier.toLowerCase());
  return index === -1 ? null : index + 1;
}

/**
 * The asymmetry between two nations' economic tiers, seen from `selfTier`. Null when either
 * tier is missing or not a real economic tier, so callers show nothing rather than a guess.
 */
export function calculateRelativeDevelopment(
  selfTier: string | null | undefined,
  partnerTier: string | null | undefined
): AsymmetryAnalysis | null {
  const selfWeight = tierRank(selfTier);
  const partnerWeight = tierRank(partnerTier);
  if (selfWeight === null || partnerWeight === null) return null;
  const tierDiff = partnerWeight - selfWeight;
  const ratio = Number((partnerWeight / Math.max(1, selfWeight)).toFixed(2));

  let label: AsymmetryAnalysis["label"] = "Symmetrical Partner";
  let badgeColor = "text-muted-foreground";
  let asymmetricMultiplier = 1.0;
  let tariffMultiplier = 1.0;
  let capitalFlowBonus = 0;

  if (tierDiff >= 2) {
    label = "Superpower Influence";
    badgeColor = "text-orange-600";
    asymmetricMultiplier = 1.4;
    tariffMultiplier = 0.7;
    capitalFlowBonus = 0.25;
  } else if (tierDiff === 1) {
    label = "Capital Imbalance";
    badgeColor = "text-foreground";
    asymmetricMultiplier = 1.2;
    tariffMultiplier = 0.85;
    capitalFlowBonus = 0.15;
  } else if (tierDiff <= -1) {
    label = "Resource Synergist";
    badgeColor = "text-emerald-600";
    asymmetricMultiplier = 1.15;
    tariffMultiplier = 1.1;
    capitalFlowBonus = 0.1;
  }

  return {
    ratio,
    tierDiff,
    label,
    asymmetricMultiplier,
    tariffMultiplier,
    capitalFlowBonus,
    badgeColor,
  };
}
