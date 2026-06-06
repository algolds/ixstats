import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import type { EconomicHealthMetrics } from "~/types/economy-builder";

export interface CalculatedEconMetrics {
  overallEffectiveness: number;
  crossBuilderScore: number;
  economicHealth: number;
  synergyCount: number;
  conflictCount: number;
  taxImpact: {
    corporateRate: number;
    incomeRate: number;
    vatRate: number;
  };
  employmentImpact: {
    unemployment: number;
    participation: number;
    wageGrowth: number;
  };
  componentUtilization: number;
  gdpGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
}

export function computeEconomyImpact(
  selectedComponents: EconomicComponentType[],
  economicHealthMetrics?: EconomicHealthMetrics,
  governmentComponents: string[] = [],
  maxComponents: number = 12
): CalculatedEconMetrics {
  const components = selectedComponents
    .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type]!)
    .filter(Boolean);

  // Overall Effectiveness (average of all component effectiveness)
  const overallEffectiveness =
    components.length > 0
      ? components.reduce((sum, c) => sum + c.effectiveness, 0) / components.length
      : 0;

  // Use real economic health metrics if available
  const realEconomicHealth = economicHealthMetrics
    ? (economicHealthMetrics.competitivenessScore +
        economicHealthMetrics.innovationIndex +
        economicHealthMetrics.productivityIndex) /
      3
    : 0;

  // Economic Impact (tax recommendations, employment, etc.)
  const taxImpact = components.reduce(
    (acc, c) => ({
      corporateRate: acc.corporateRate + c.taxImpact.optimalCorporateRate,
      incomeRate: acc.incomeRate + c.taxImpact.optimalIncomeRate,
      vatRate: acc.vatRate + 15,
    }),
    { corporateRate: 0, incomeRate: 0, vatRate: 0 }
  );

  const avgTaxImpact =
    components.length > 0
      ? {
          corporateRate: taxImpact.corporateRate / components.length,
          incomeRate: taxImpact.incomeRate / components.length,
          vatRate: taxImpact.vatRate / components.length,
        }
      : { corporateRate: 0, incomeRate: 0, vatRate: 0 };

  const employmentImpact = components.reduce(
    (acc, c) => ({
      unemployment: acc.unemployment + c.employmentImpact.unemploymentModifier,
      participation: acc.participation + c.employmentImpact.participationModifier,
      wageGrowth: acc.wageGrowth + c.employmentImpact.wageGrowthModifier,
    }),
    { unemployment: 0, participation: 1, wageGrowth: 1 }
  );

  // Synergy Detection (including cross-builder with government components)
  const allSynergies = new Set<string>();
  const allConflicts = new Set<string>();

  components.forEach((comp) => {
    comp.synergies.forEach((syn) => {
      if (selectedComponents.includes(syn)) {
        allSynergies.add(`${comp.id}-${syn}`);
      }
    });
    comp.conflicts.forEach((conf) => {
      if (selectedComponents.includes(conf)) {
        allConflicts.add(`${comp.id}-${conf}`);
      }
    });

    // Cross-builder synergies with government components
    if (governmentComponents && governmentComponents.length > 0) {
      governmentComponents.forEach((govComp) => {
        if (comp.governmentSynergies?.includes(govComp)) {
          allSynergies.add(`${comp.id}-${govComp}`);
        }
        if (comp.governmentConflicts?.includes(govComp)) {
          allConflicts.add(`${comp.id}-${govComp}`);
        }
      });
    }
  });

  const synergyBonus = allSynergies.size * 2;
  const conflictPenalty = allConflicts.size * 3;

  // Calculate cross-builder integration score based on actual synergies
  const governmentAlignment =
    governmentComponents.length > 0 ? 70 + allSynergies.size * 5 - allConflicts.size * 5 : 0;
  const taxAlignment = 82;
  const crossBuilderScore =
    governmentComponents.length > 0
      ? Math.max(0, Math.min(100, (governmentAlignment + taxAlignment) / 2))
      : 0;

  const calculatedScore = Math.max(
    0,
    Math.min(100, overallEffectiveness + synergyBonus - conflictPenalty)
  );
  const finalScore = realEconomicHealth > 0 ? realEconomicHealth : calculatedScore;

  return {
    overallEffectiveness,
    crossBuilderScore,
    economicHealth: finalScore,
    synergyCount: allSynergies.size,
    conflictCount: allConflicts.size,
    taxImpact: avgTaxImpact,
    employmentImpact,
    componentUtilization: (selectedComponents.length / maxComponents) * 100,
    gdpGrowthRate: economicHealthMetrics?.gdpGrowthRate || 0,
    inflationRate: economicHealthMetrics?.inflationRate || 0,
    unemploymentRate: economicHealthMetrics?.unemploymentRate || 0,
  };
}
