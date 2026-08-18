"use client";

/**
 * Policy Analytics Hook
 *
 * Encapsulates all data fetching, simulation state, and computed values
 * for the PolicyAnalytics component. Extracted from PolicyAnalytics.tsx
 * as part of the modular refactoring pattern.
 *
 * @module usePolicyAnalytics
 */

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { COMPONENT_CATEGORIES } from "~/lib/statecraft/synergy-calculator";

// ----- Types -----

interface UsePolicyAnalyticsParams {
  countryId: string;
  userId?: string;
}

export interface PolicyEffectivenessData {
  overall: number;
  components: number;
  tax: number;
  spending: number;
}

export interface SynergyRadarPoint {
  category: string;
  score: number;
  fullMark: number;
}

export interface SynergyItem {
  component1: string;
  component2: string;
  bonus: number;
}

export interface ConflictItem {
  component1: string;
  component2: string;
  penalty: number;
}

export interface SynergyAnalysisData {
  radarData: SynergyRadarPoint[];
  synergies: SynergyItem[];
  conflicts: ConflictItem[];
  categoryScores: Record<string, number[]>;
}

export interface SimulatedImpactData {
  taxRevenue: number;
  gdpGrowth: number;
  budgetBalance: number;
  efficiency: number;
}

export interface ComparativeCountryData {
  name: string;
  taxBurden: number;
  govSpending: number;
  efficiency: number;
  gdpGrowth: number;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
}

// ----- Scenarios Constant -----

const scenarios: ScenarioDefinition[] = [
  {
    id: "baseline",
    name: "Current Baseline",
    description: "Your current policy configuration",
  },
  {
    id: "high_growth",
    name: "High Growth",
    description: "Lower taxes, increased education/innovation spending",
  },
  {
    id: "fiscal_consolidation",
    name: "Fiscal Consolidation",
    description: "Balanced budget through spending cuts",
  },
  {
    id: "welfare_state",
    name: "Welfare State",
    description: "Higher taxes, increased social spending",
  },
];

// ----- Hook -----

export function usePolicyAnalytics({ countryId }: UsePolicyAnalyticsParams) {
  // Simulation state
  const [simulatedTaxRate, setSimulatedTaxRate] = useState(25);
  const [simulatedEducationSpending, setSimulatedEducationSpending] = useState(15);
  const [simulatedHealthSpending, setSimulatedHealthSpending] = useState(12);
  const [simulatedDefenseSpending, setSimulatedDefenseSpending] = useState(10);

  // Scenario planning state
  const [selectedScenario, setSelectedScenario] = useState<string>("baseline");

  // Fetch government data
  const { data: governmentData, isLoading: govLoading } = api.government.getByCountryId.useQuery({
    countryId,
  });

  // Fetch atomic components
  const { data: components, isLoading: componentsLoading } = api.government.getComponents.useQuery({
    countryId,
  });

  // Fetch country data for baseline
  const { data: countryData } = api.countries.getByIdBasic.useQuery({ id: countryId });

  // Fetch all countries for comparison
  const { data: allCountries } = api.countries.getAll.useQuery(
    { limit: 200 },
    { staleTime: 5 * 60 * 1000 }
  );

  // Loading state
  const isLoading = govLoading || componentsLoading;

  // Calculate current policy effectiveness
  const policyEffectiveness = useMemo((): PolicyEffectivenessData | null => {
    if (!governmentData || !components) return null;

    const avgComponentEffectiveness =
      components.length > 0
        ? components.reduce((sum, c) => sum + c.effectivenessScore, 0) / components.length
        : 0;

    const taxEfficiency = governmentData.totalBudget > 0 ? 75 : 50;
    const spendingEfficiency = 70;

    return {
      overall: Math.round((avgComponentEffectiveness + taxEfficiency + spendingEfficiency) / 3),
      components: avgComponentEffectiveness,
      tax: taxEfficiency,
      spending: spendingEfficiency,
    };
  }, [governmentData, components]);

  // Analyze component synergies
  const synergyAnalysis = useMemo((): SynergyAnalysisData | null => {
    if (!components || components.length === 0) return null;

    const categoryScores: Record<string, number[]> = {};

    Object.entries(COMPONENT_CATEGORIES).forEach(([category, categoryComponents]) => {
      const matchingComponents = components.filter((c) =>
        categoryComponents.includes(c.componentType)
      );

      if (matchingComponents.length > 0) {
        categoryScores[category] = matchingComponents.map((c) => c.effectivenessScore);
      }
    });

    // Calculate average for radar chart
    const radarData: SynergyRadarPoint[] = Object.entries(categoryScores).map(
      ([category, scores]) => ({
        category,
        score: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        fullMark: 100,
      })
    );

    // Detect synergies and conflicts
    const synergies: SynergyItem[] = [];
    const conflicts: ConflictItem[] = [];

    components.forEach((comp1, i) => {
      components.slice(i + 1).forEach((comp2) => {
        const avgEffectiveness = (comp1.effectivenessScore + comp2.effectivenessScore) / 2;

        if (avgEffectiveness > 75) {
          synergies.push({
            component1: comp1.componentType,
            component2: comp2.componentType,
            bonus: Math.round((avgEffectiveness - 75) * 0.4),
          });
        } else if (avgEffectiveness < 40) {
          conflicts.push({
            component1: comp1.componentType,
            component2: comp2.componentType,
            penalty: Math.round((40 - avgEffectiveness) * 0.3),
          });
        }
      });
    });

    return {
      radarData,
      synergies: synergies.slice(0, 5),
      conflicts: conflicts.slice(0, 3),
      categoryScores,
    };
  }, [components]);

  // Simulate policy impact
  const simulatedImpact = useMemo((): SimulatedImpactData => {
    const baseGDP = countryData?.currentTotalGdp || 1000000000;
    const baseTaxRate = 25;
    const baseGrowth = 3.0;

    // Calculate revenue impact
    const taxRevenueDelta = ((simulatedTaxRate - baseTaxRate) / baseTaxRate) * 100;

    // Calculate growth impact (higher taxes = lower growth, more spending = higher growth)
    const taxGrowthImpact = ((baseTaxRate - simulatedTaxRate) / 10) * 0.5;
    const spendingGrowthImpact =
      ((simulatedEducationSpending + simulatedHealthSpending - 27) / 10) * 0.3;

    const projectedGrowth = baseGrowth + taxGrowthImpact + spendingGrowthImpact;

    // Calculate budget balance
    const revenue = baseGDP * (simulatedTaxRate / 100);
    const spending =
      baseGDP *
      ((simulatedEducationSpending + simulatedHealthSpending + simulatedDefenseSpending) / 100);
    const balance = revenue - spending;

    return {
      taxRevenue: taxRevenueDelta,
      gdpGrowth: projectedGrowth,
      budgetBalance: balance,
      efficiency: 75 + (baseGrowth - projectedGrowth) * 5,
    };
  }, [
    simulatedTaxRate,
    simulatedEducationSpending,
    simulatedHealthSpending,
    simulatedDefenseSpending,
    countryData,
  ]);

  // Comparative analysis
  const comparativeData = useMemo((): ComparativeCountryData[] | null => {
    if (!countryData || !allCountries) return null;

    const countryGdpPerCapita = countryData.currentGdpPerCapita || 0;

    const similarCountries = allCountries.countries
      .filter((c: any) => {
        const otherGdpPerCapita = c.currentGdpPerCapita || 0;
        return (
          Math.abs(otherGdpPerCapita - countryGdpPerCapita) < countryGdpPerCapita * 0.3 &&
          c.id !== countryId
        );
      })
      .slice(0, 5);

    return similarCountries.map((c: any) => ({
      name: c.name,
      taxBurden: c.taxRevenueGDPPercent || 25,
      govSpending: c.governmentSpendingGDPPercent || 30,
      efficiency: c.governmentalEfficiency || 50,
      gdpGrowth: c.realGDPGrowthRate || 3,
    }));
  }, [countryData, allCountries, countryId]);

  return {
    // Loading
    isLoading,

    // Raw data
    components,
    policyEffectiveness,
    synergyAnalysis,
    comparativeData,

    // Simulation state + setters
    simulatedTaxRate,
    setSimulatedTaxRate,
    simulatedEducationSpending,
    setSimulatedEducationSpending,
    simulatedHealthSpending,
    setSimulatedHealthSpending,
    simulatedDefenseSpending,
    setSimulatedDefenseSpending,
    simulatedImpact,

    // Scenario state
    selectedScenario,
    setSelectedScenario,
    scenarios,
  };
}
