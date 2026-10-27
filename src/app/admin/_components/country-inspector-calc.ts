/**
 * The Country Inspector sandbox's projection: the growth pipeline (base rates -> global, local and
 * tier factors -> storyteller effects -> diminishing returns -> tier cap and floor -> compounding ->
 * direct modifiers) and the secondary indicators, computed client-side from the sliders and effects.
 * Split out of CountryInspector.tsx.
 */

import type { RouterOutputs } from "~/trpc/react";
import { ECONOMIC_TIER_INFO } from "~/lib/tier-utils";
import { EconomicTier, PopulationTier } from "~/types/ixstats";

export interface MockEffect {
  id: string;
  type: string;
  value: number; // decimal form, e.g. 0.05
  description: string;
  duration: number; // years
}

const ECONOMIC_TIERS_DESCENDING = Object.entries(ECONOMIC_TIER_INFO).reverse() as Array<
  [EconomicTier, (typeof ECONOMIC_TIER_INFO)[EconomicTier]]
>;

const POPULATION_TIER_FLOORS: Array<[number, PopulationTier]> = [
  [500_000_000, PopulationTier.TIER_X],
  [350_000_000, PopulationTier.TIER_7],
  [120_000_000, PopulationTier.TIER_6],
  [80_000_000, PopulationTier.TIER_5],
  [50_000_000, PopulationTier.TIER_4],
  [30_000_000, PopulationTier.TIER_3],
  [10_000_000, PopulationTier.TIER_2],
];

const getEconTier = (gdpPerCapita: number): EconomicTier =>
  ECONOMIC_TIERS_DESCENDING.find(([, { min }]) => gdpPerCapita >= min)?.[0] ??
  EconomicTier.IMPOVERISHED;

const getPopTier = (population: number): PopulationTier =>
  POPULATION_TIER_FLOORS.find(([floor]) => population >= floor)?.[1] ?? PopulationTier.TIER_1;

export interface SandboxProjectionInput {
  countryData: RouterOutputs["countries"]["getByIdWithEconomicData"] | undefined;
  globalConfig: RouterOutputs["admin"]["getConfig"] | undefined;
  localMultiplier: number;
  mockEffects: MockEffect[];
  disabledEffects: Record<string, boolean>;
  yearsElapsed: number;
}

/** The sandbox projection for the selected country; null until its data has loaded. */
export function computeSandboxProjection({
  countryData,
  globalConfig,
  localMultiplier,
  mockEffects,
  disabledEffects,
  yearsElapsed,
}: SandboxProjectionInput) {
  if (!countryData) return null;

  const basePop = countryData.baselinePopulation || 1000000;
  const baseGdpPerCapita = countryData.baselineGdpPerCapita || 5000;
  const baseGdp = basePop * baseGdpPerCapita;
  const landArea = countryData.landArea || 100000;

  // Settings
  const cfgGlobalGrowthFactor = globalConfig?.globalGrowthFactor || 1.0321;
  const cfgDiminishingThreshold = globalConfig?.diminishingReturnsThreshold || 60000;
  const cfgDiminishingFactor = globalConfig?.diminishingReturnsFactor || 0.5;
  const cfgMinGrowthFloor = globalConfig?.minGrowthFloor || -0.1;

  const popBaseRate = countryData.populationGrowthRate || 0.01;
  const gdpBaseRate = countryData.adjustedGdpGrowth || 0.02;

  const currentEconTier = getEconTier(baseGdpPerCapita);
  const tierModifier = globalConfig?.tierGrowthModifiers?.[currentEconTier] || 1.0;

  // Process storyteller effects (DB + mock)
  const activeDbEffects = (countryData.storytellerEffects || [])
    .filter((eff: any) => !disabledEffects[eff.id])
    .map((eff: any) => ({
      id: eff.id,
      name: eff.description || `${eff.inputType} effect`,
      type: eff.inputType,
      value: eff.value,
      duration: eff.duration || 99,
      mock: false,
    }));

  const activeMockEffects = mockEffects.map((eff) => ({
    id: eff.id,
    name: eff.description,
    type: eff.type,
    value: eff.value,
    duration: eff.duration,
    mock: true,
  }));

  const allEffects = [...activeDbEffects, ...activeMockEffects];

  // Calculate Pop Growth Modifier
  let popAdjustVal = 0;
  allEffects.forEach((eff) => {
    if (eff.type === "population_adjustment") {
      popAdjustVal += eff.value;
    }
  });

  const finalPopGrowthRate = popBaseRate + popAdjustVal;

  // Calculate GDP GDPPC growth rate modifiers
  let gdpAdjustVal = 0;
  let gdpMultiplierVal = 1.0;

  allEffects.forEach((eff) => {
    if (eff.type === "gdp_adjustment") {
      gdpAdjustVal += eff.value;
    } else if (eff.type === "growth_rate_modifier") {
      gdpMultiplierVal *= 1.0 + eff.value;
    }
  });

  // Compute effective GDP growth rate before cap and floor
  let rawGdpGrowth = gdpBaseRate;
  rawGdpGrowth *= cfgGlobalGrowthFactor;
  rawGdpGrowth *= localMultiplier;
  rawGdpGrowth *= tierModifier;
  rawGdpGrowth += gdpAdjustVal;
  rawGdpGrowth *= gdpMultiplierVal;

  // Check Diminishing Returns
  let drReducedVal = rawGdpGrowth;
  const isDrActive = baseGdpPerCapita > cfgDiminishingThreshold;
  if (isDrActive) {
    const diminishingFactor =
      Math.log(baseGdpPerCapita / cfgDiminishingThreshold + 1) / Math.log(2);
    drReducedVal = rawGdpGrowth / (1.0 + diminishingFactor * cfgDiminishingFactor);
  }

  // Apply Tier Cap Check
  const tierMaxCap = ECONOMIC_TIER_INFO[currentEconTier].maxGrowth;
  const isCapped = drReducedVal > tierMaxCap;
  let finalGdpGrowthRate = isCapped ? tierMaxCap : drReducedVal;

  // Apply floor
  finalGdpGrowthRate = Math.max(finalGdpGrowthRate, cfgMinGrowthFloor);

  // Apply progression calculations over years elapsed
  let finalPop = basePop * Math.pow(1.0 + finalPopGrowthRate, yearsElapsed);
  let finalGdpPerCapita = baseGdpPerCapita * Math.pow(1.0 + finalGdpGrowthRate, yearsElapsed);

  // Apply special direct multipliers to outputs
  let directPopMult = 1.0;
  let directGdpMult = 1.0;

  allEffects.forEach((eff) => {
    if (eff.type === "natural_disaster") {
      // Disasters reduce population and GDP
      directPopMult *= 1.0 + eff.value;
      directGdpMult *= 1.0 + eff.value * 1.5;
    } else if (eff.type === "trade_agreement") {
      directGdpMult *= 1.0 + eff.value;
    } else if (eff.type === "special_event") {
      directPopMult *= 1.0 + eff.value * 0.5;
      directGdpMult *= 1.0 + eff.value * 0.8;
    }
  });

  finalPop *= directPopMult;
  finalGdpPerCapita *= directGdpMult;
  const finalGdpVal = finalPop * finalGdpPerCapita;

  const finalEconTier = getEconTier(finalGdpPerCapita);
  const finalPopTier = getPopTier(finalPop);

  // Secondary indicators formulas
  const gdpScore = Math.min(100, (finalGdpPerCapita / 50000) * 100);
  const growthBonus = Math.min(20, Math.max(-20, finalGdpGrowthRate * 400));
  const vitalityVal = Math.min(100, Math.max(0, gdpScore * 0.7 + growthBonus + 30));

  const growthHealth = finalPopGrowthRate > 0 ? 70 : 40;
  const finalPopDensity = landArea > 0 ? finalPop / landArea : 0;
  const densityFactor = finalPopDensity > 0 ? Math.max(50, 100 - finalPopDensity / 500) : 60;
  const wellbeingVal = (growthHealth + densityFactor) / 2;

  const tierScores: Record<EconomicTier, number> = {
    [EconomicTier.EXTRAVAGANT]: 95,
    [EconomicTier.VERY_STRONG]: 85,
    [EconomicTier.STRONG]: 75,
    [EconomicTier.HEALTHY]: 65,
    [EconomicTier.DEVELOPED]: 50,
    [EconomicTier.DEVELOPING]: 35,
    [EconomicTier.IMPOVERISHED]: 25,
  };
  const economicTierScore = tierScores[finalEconTier] || 25;
  const efficiencyVal = economicTierScore * 0.8;

  const influence = (countryData as any).globalDiplomaticInfluence ?? 50;
  const tradeStrength = (countryData as any).tradeRelationshipStrength ?? 25;
  const allianceStrength = (countryData as any).allianceStrength ?? 15;
  const tensions = (countryData as any).diplomaticTensions ?? 5;
  const diplomaticVal = Math.min(
    100,
    Math.max(40, influence + tradeStrength + allianceStrength - tensions)
  );

  return {
    baseline: {
      pop: basePop,
      gdppc: baseGdpPerCapita,
      gdp: baseGdp,
      date: countryData.baselineDate ? new Date(countryData.baselineDate) : new Date(),
      tier: currentEconTier,
      popTier: getPopTier(basePop),
      landArea,
    },
    settings: {
      globalGrowthFactor: cfgGlobalGrowthFactor,
      localGrowthFactor: localMultiplier,
      tierModifier,
    },
    effects: {
      active: allEffects,
      popAdjust: popAdjustVal,
      gdpAdjust: gdpAdjustVal,
      gdpMultiplier: gdpMultiplierVal - 1.0,
    },
    popGrowth: {
      baseRate: popBaseRate,
      storytellerAdjust: popAdjustVal,
      finalRate: finalPopGrowthRate,
    },
    gdpGrowth: {
      baseRate: gdpBaseRate,
      withGlobalFactor: gdpBaseRate * cfgGlobalGrowthFactor,
      withLocalFactor: gdpBaseRate * cfgGlobalGrowthFactor * localMultiplier,
      withTierModifier: gdpBaseRate * cfgGlobalGrowthFactor * localMultiplier * tierModifier,
      withStorytellerAdjust: rawGdpGrowth,
      beforeCap: drReducedVal,
      finalRate: finalGdpGrowthRate,
      isCapped,
      tierMax: tierMaxCap,
      diminishingReturns: {
        active: isDrActive,
        originalRate: rawGdpGrowth,
        factor: cfgDiminishingFactor,
        reducedRate: drReducedVal,
      },
    },
    progression: {
      years: yearsElapsed,
      popGrowthCompound: Math.pow(1.0 + finalPopGrowthRate, yearsElapsed),
      gdpGrowthCompound: Math.pow(1.0 + finalGdpGrowthRate, yearsElapsed),
      directPopModifier: directPopMult - 1.0,
      directGdpModifier: directGdpMult - 1.0,
    },
    output: {
      pop: finalPop,
      gdppc: finalGdpPerCapita,
      gdp: finalGdpVal,
      tier: finalEconTier,
      popTier: finalPopTier,
      popDensity: landArea > 0 ? finalPop / landArea : undefined,
      gdpDensity: landArea > 0 ? finalGdpVal / landArea : undefined,
    },
    secondary: {
      vitality: vitalityVal,
      wellbeing: wellbeingVal,
      efficiency: efficiencyVal,
      diplomatic: diplomaticVal,
      details: {
        gdpScore,
        growthBonus,
        densityFactor,
        growthHealth,
        influence,
        tradeStrength,
        allianceStrength,
        tensions,
      },
    },
  };
}
