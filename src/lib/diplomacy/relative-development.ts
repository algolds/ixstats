/**
 * Relative-Development Asymmetry in Diplomacy (v2 Bible §6)
 *
 * "Free trade with a developing nation ≠ super-economy"
 * Calculates GDP-per-capita / economic tier ratios between partner nations and
 * derives asymmetric trade, tax, and diplomatic standing multipliers.
 */

export interface AsymmetryAnalysis {
  ratio: number; // Partner tier / Self tier (>1 = partner higher development)
  tierDiff: number;
  label: "Symmetrical Partner" | "Capital Imbalance" | "Resource Synergist" | "Superpower Influence";
  asymmetricMultiplier: number;
  tariffMultiplier: number;
  capitalFlowBonus: number;
  badgeColor: string;
}

const TIER_WEIGHTS: Record<string, number> = {
  DEVELOPING: 1,
  EMERGING: 2,
  DEVELOPED: 3,
  ADVANCED: 4,
  SUPERPOWER: 5,
};

export function calculateRelativeDevelopment(
  selfTier: string = "DEVELOPED",
  partnerTier: string = "DEVELOPED"
): AsymmetryAnalysis {
  const selfWeight = TIER_WEIGHTS[selfTier.toUpperCase()] ?? 3;
  const partnerWeight = TIER_WEIGHTS[partnerTier.toUpperCase()] ?? 3;
  const tierDiff = partnerWeight - selfWeight;
  const ratio = Number((partnerWeight / Math.max(1, selfWeight)).toFixed(2));

  let label: AsymmetryAnalysis["label"] = "Symmetrical Partner";
  let badgeColor = "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
  let asymmetricMultiplier = 1.0;
  let tariffMultiplier = 1.0;
  let capitalFlowBonus = 0;

  if (tierDiff >= 2) {
    label = "Superpower Influence";
    badgeColor = "border-purple-500/30 bg-purple-500/10 text-purple-400";
    asymmetricMultiplier = 1.4;
    tariffMultiplier = 0.7;
    capitalFlowBonus = 0.25;
  } else if (tierDiff === 1) {
    label = "Capital Imbalance";
    badgeColor = "border-amber-500/30 bg-amber-500/10 text-amber-400";
    asymmetricMultiplier = 1.2;
    tariffMultiplier = 0.85;
    capitalFlowBonus = 0.15;
  } else if (tierDiff <= -1) {
    label = "Resource Synergist";
    badgeColor = "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
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
