/**
 * useEconomicModel Hook
 *
 * Custom React hook for managing economic model state, calculations, and persistence.
 * Encapsulates all business logic interaction and provides a clean interface for
 * components to interact with economic modeling functionality.
 *
 * @module useEconomicModel
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { Country, EconomicYearData, DMInputs, EconomicModel } from "~/server/db/schema";
import {
  type ModelParameters,
  type SectorData,
  type PolicyData,
  type YearProjection,
  type ModelHealth,
  type ValidationResult,
  calculateModelHealth,
  validateModelParameters,
  generateYearlyProjectionData,
} from "~/lib/economic-modeling-engine";

/**
 * Country data with related economic information
 */
interface CountryWithEconomicData extends Country {
  economicYears: EconomicYearData[];
  dmInputs?: DMInputs | null;
  economicModel?: EconomicModel | null;
}

/**
 * Return type for useEconomicModel hook
 */
export interface UseEconomicModelReturn {
  // State
  parameters: ModelParameters;
  sectoralOutputs: SectorData[];
  policyEffects: PolicyData[];
  isLoading: boolean;
  isSimulating: boolean;
  editMode: boolean;

  // Computed values
  projectedData: YearProjection[];
  modelHealth: ModelHealth;
  validation: ValidationResult;

  // Actions
  updateParameter: <K extends keyof ModelParameters>(field: K, value: number) => void;
  updateSectoralOutput: (index: number, field: keyof SectorData, value: string | number) => void;
  addSectoralOutputYear: () => void;
  removeSectoralOutputYear: (index: number) => void;
  updatePolicyEffect: (index: number, field: keyof PolicyData, value: string | number) => void;
  addPolicyEffect: () => void;
  removePolicyEffect: (index: number) => void;
  resetParameters: () => void;
  runSimulation: () => void;
  saveModel: () => void;
  setEditMode: (mode: boolean) => void;
}

// Use a fixed default year for SSR safety
const DEFAULT_YEAR = 2020;

const initialSectorData: SectorData = {
  year: DEFAULT_YEAR,
  agriculture: 0,
  industry: 0,
  services: 0,
  government: 0,
  totalGDP: 0,
};

const initialPolicyData: Omit<PolicyData, 'id' | 'economicModelId'> = {
  name: "New Policy",
  description: "Details about the policy",
  gdpEffectPercentage: 0,
  inflationEffectPercentage: 0,
  employmentEffectPercentage: 0,
  yearImplemented: DEFAULT_YEAR,
  durationYears: 1,
};

/**
 * Custom hook for economic model management
 *
 * Manages all state and logic for the Economic Modeling Engine, including:
 * - Model parameters (growth rates, base year, etc.)
 * - Sectoral outputs (agriculture, industry, services, government)
 * - Policy effects (fiscal policies, reforms, shocks)
 * - Projections (calculated GDP, inflation, unemployment forecasts)
 * - Validation and health assessment
 * - Persistence to database
 *
 * @param country - Country data with economic information
 * @param onModelUpdate - Optional callback when model is successfully updated
 * @returns Complete interface for economic model management
 *
 * @example
 * ```tsx
 * const model = useEconomicModel(country, (updated) => {
 *   console.log('Model updated:', updated);
 * });
 *
 * // Update a parameter
 * model.updateParameter('gdpGrowthRate', 3.5);
 *
 * // Access computed projections
 * console.log(model.projectedData);
 *
 * // Save to database
 * model.saveModel();
 * ```
 */
export function useEconomicModel(
  country: CountryWithEconomicData,
  onModelUpdate?: (updatedModel: EconomicModel) => void
): UseEconomicModelReturn {
  const utils = api.useUtils();

  // UI State
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Model Parameters State
  const [parameters, setParameters] = useState<ModelParameters>({
    baseYear: country.economicModel?.baseYear ?? DEFAULT_YEAR,
    projectionYears: country.economicModel?.projectionYears ?? 5,
    gdpGrowthRate: country.economicModel?.gdpGrowthRate ?? 3.0,
    inflationRate: country.economicModel?.inflationRate ?? 2.0,
    unemploymentRate: country.economicModel?.unemploymentRate ?? 5.0,
    interestRate: country.economicModel?.interestRate ?? 3.0,
    exchangeRate: country.economicModel?.exchangeRate ?? 1.0,
    populationGrowthRate: country.economicModel?.populationGrowthRate ?? 1.0,
    investmentRate: country.economicModel?.investmentRate ?? 20.0,
    fiscalBalance: country.economicModel?.fiscalBalance ?? 0.0,
    tradeBalance: country.economicModel?.tradeBalance ?? 0.0,
  });

  const [sectoralOutputs, setSectoralOutputs] = useState<SectorData[]>(
    (country.economicModel?.sectoralOutputs as SectorData[]) ?? [
      { ...initialSectorData, year: parameters.baseYear },
    ]
  );

  const [policyEffects, setPolicyEffects] = useState<PolicyData[]>(
    (country.economicModel?.policyEffects as PolicyData[]) ?? []
  );

  // On client, update year to real current year if needed
  useEffect(() => {
    const realYear = new Date().getFullYear();
    setParameters((prev) => ({
      ...prev,
      baseYear: country.economicModel?.baseYear ?? realYear,
    }));
    setSectoralOutputs((outputs) =>
      outputs.map((s, i) => (i === 0 ? { ...s, year: realYear } : s))
    );
    setPolicyEffects((effects) =>
      effects.map((p, i) => (i === 0 ? { ...p, yearImplemented: realYear } : p))
    );
  }, [country.economicModel?.baseYear]);

  // Mutation for saving model to database
  const updateEconomicModelMutation = api.countries.updateEconomicData.useMutation({
    onSuccess: (data) => {
      toast.success("Economic model updated successfully!");
      if (data.success && onModelUpdate) {
        void utils.countries.getByIdWithEconomicData.invalidate({ id: country.id });
      }
      setIsLoading(false);
    },
    onError: (error) => {
      toast.error(`Error updating model: ${error.message}`);
      setIsLoading(false);
    },
  });

  // Computed: Projected Data
  const projectedData = useMemo(() => {
    return generateYearlyProjectionData(
      parameters,
      {
        gdp: country.economicData?.gdp ?? 1000,
        population: country.population ?? 1000000,
        sectoralOutputs,
      },
      policyEffects
    );
  }, [parameters, sectoralOutputs, policyEffects, country.economicData?.gdp, country.population]);

  // Computed: Model Health
  const modelHealth = useMemo(() => {
    return calculateModelHealth(parameters);
  }, [parameters]);

  // Computed: Validation
  const validation = useMemo(() => {
    return validateModelParameters(parameters);
  }, [parameters]);

  // Action: Update Parameter
  const updateParameter = useCallback(<K extends keyof ModelParameters>(
    field: K,
    value: number
  ) => {
    setParameters((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Action: Update Sectoral Output
  const updateSectoralOutput = useCallback((
    index: number,
    field: keyof SectorData,
    value: string | number
  ) => {
    const updatedOutputs = [...sectoralOutputs];
    const numericValue = typeof value === "string" ? parseFloat(value) : value;

    if (!isNaN(numericValue) && updatedOutputs[index]) {
      (updatedOutputs[index] as any)[field] = numericValue;

      // Recalculate totalGDP for the changed sector
      if (field !== "year" && field !== "totalGDP") {
        updatedOutputs[index]!.totalGDP =
          (updatedOutputs[index]?.agriculture ?? 0) +
          (updatedOutputs[index]?.industry ?? 0) +
          (updatedOutputs[index]?.services ?? 0) +
          (updatedOutputs[index]?.government ?? 0);
      }

      setSectoralOutputs(updatedOutputs);
    }
  }, [sectoralOutputs]);

  // Action: Add Sectoral Output Year
  const addSectoralOutputYear = useCallback(() => {
    const lastYearOutput = sectoralOutputs[sectoralOutputs.length - 1];
    const nextYear = (lastYearOutput?.year ?? parameters.baseYear) + 1;
    setSectoralOutputs([...sectoralOutputs, { ...initialSectorData, year: nextYear }]);
  }, [sectoralOutputs, parameters.baseYear]);

  // Action: Remove Sectoral Output Year
  const removeSectoralOutputYear = useCallback((index: number) => {
    if (sectoralOutputs.length > 1) {
      const updatedOutputs = sectoralOutputs.filter((_, i) => i !== index);
      setSectoralOutputs(updatedOutputs);
    } else {
      toast.error("Cannot remove the last sectoral output year.");
    }
  }, [sectoralOutputs]);

  // Action: Update Policy Effect
  const updatePolicyEffect = useCallback((
    index: number,
    field: keyof PolicyData,
    value: string | number
  ) => {
    const updatedPolicies = [...policyEffects];
    if (field === "name" || field === "description" || field === "id" || field === "economicModelId") {
      (updatedPolicies[index] as any)[field] = value as string;
    } else {
      const numericValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numericValue)) {
        (updatedPolicies[index] as any)[field] = numericValue;
      }
    }
    setPolicyEffects(updatedPolicies);
  }, [policyEffects]);

  // Use a deterministic counter for temp IDs
  const tempIdRef = useRef(0);

  // Action: Add Policy Effect
  const addPolicyEffect = useCallback(() => {
    setPolicyEffects([
      ...policyEffects,
      {
        ...initialPolicyData,
        id: `temp-${tempIdRef.current++}`,
        economicModelId: country.economicModel?.id ?? "",
      } as PolicyData,
    ]);
  }, [policyEffects, country.economicModel?.id]);

  // Action: Remove Policy Effect
  const removePolicyEffect = useCallback((index: number) => {
    const updatedPolicies = policyEffects.filter((_, i) => i !== index);
    setPolicyEffects(updatedPolicies);
  }, [policyEffects]);

  // Action: Reset Parameters
  const resetParameters = useCallback(() => {
    setParameters({
      baseYear: new Date().getFullYear(),
      projectionYears: 5,
      gdpGrowthRate: 3.0,
      inflationRate: 2.0,
      unemploymentRate: 5.0,
      interestRate: 3.0,
      exchangeRate: 1.0,
      populationGrowthRate: 1.0,
      investmentRate: 20.0,
      fiscalBalance: 0.0,
      tradeBalance: 0.0,
    });
  }, []);

  // Action: Run Simulation
  const runSimulation = useCallback(() => {
    setIsSimulating(true);
    // Simulate for a moment to show loading state
    setTimeout(() => {
      setIsSimulating(false);
      toast.success("Economic simulation completed!");
    }, 2000);
  }, []);

  // Action: Save Model
  const saveModel = useCallback(() => {
    setIsLoading(true);
    const population = country.population ?? 0;
    const totalGDP = sectoralOutputs[0]?.totalGDP ?? 0;

    // --- ADVANCED MODELING: Send full model to backend ---
    const modelData = {
      countryId: country.id,
      economicData: {
        nominalGDP: totalGDP,
        realGDPGrowthRate: parameters.gdpGrowthRate,
        inflationRate: parameters.inflationRate,
        currencyExchangeRate: parameters.exchangeRate,
        unemploymentRate: parameters.unemploymentRate,
        interestRates: parameters.interestRate,
        populationGrowthRate: parameters.populationGrowthRate,
        taxRevenueGDPPercent: parameters.fiscalBalance,
        tradeBalance: parameters.tradeBalance,
        // Add other required fields with default values
        laborForceParticipationRate: 65,
        employmentRate: 95,
        totalWorkforce: Math.round(population * 0.65),
        averageWorkweekHours: 40,
        minimumWage: 12,
        averageAnnualIncome: 35000,
        governmentBudgetGDPPercent: parameters.fiscalBalance + 2,
        budgetDeficitSurplus: 0,
        internalDebtGDPPercent: 45,
        externalDebtGDPPercent: 25,
        totalDebtGDPRatio: 70,
        debtPerCapita: (totalGDP * 0.7) / (population || 1),
        debtServiceCosts: totalGDP * 0.7 * 0.035,
        povertyRate: 15,
        incomeInequalityGini: 0.38,
        socialMobilityIndex: 60,
        totalGovernmentSpending: (totalGDP * (parameters.fiscalBalance + 2)) / 100,
        spendingGDPPercent: parameters.fiscalBalance + 2,
        spendingPerCapita:
          (totalGDP * (parameters.fiscalBalance + 2)) / 100 / (population || 1),
        lifeExpectancy: 75,
        urbanPopulationPercent: 60,
        ruralPopulationPercent: 40,
        literacyRate: 90,
        // --- ADVANCED MODELING ---
        economicModel: {
          baseYear: parameters.baseYear,
          projectionYears: parameters.projectionYears,
          gdpGrowthRate: parameters.gdpGrowthRate,
          inflationRate: parameters.inflationRate,
          unemploymentRate: parameters.unemploymentRate,
          interestRate: parameters.interestRate,
          exchangeRate: parameters.exchangeRate,
          populationGrowthRate: parameters.populationGrowthRate,
          investmentRate: parameters.investmentRate,
          fiscalBalance: parameters.fiscalBalance,
          tradeBalance: parameters.tradeBalance,
          sectoralOutputs: sectoralOutputs.map((s) => ({
            year: s.year,
            agriculture: s.agriculture,
            industry: s.industry,
            services: s.services,
            government: s.government,
            totalGDP: s.totalGDP,
          })),
          policyEffects: policyEffects.map((p) => ({
            name: p.name,
            description: p.description,
            gdpEffectPercentage: p.gdpEffectPercentage,
            inflationEffectPercentage: p.inflationEffectPercentage,
            employmentEffectPercentage: p.employmentEffectPercentage,
            yearImplemented: p.yearImplemented,
            durationYears: p.durationYears,
          })),
        },
      },
    };

    updateEconomicModelMutation.mutate(modelData);
  }, [
    country.id,
    country.population,
    parameters,
    sectoralOutputs,
    policyEffects,
    updateEconomicModelMutation,
  ]);

  return {
    // State
    parameters,
    sectoralOutputs,
    policyEffects,
    isLoading,
    isSimulating,
    editMode,

    // Computed values
    projectedData,
    modelHealth,
    validation,

    // Actions
    updateParameter,
    updateSectoralOutput,
    addSectoralOutputYear,
    removeSectoralOutputYear,
    updatePolicyEffect,
    addPolicyEffect,
    removePolicyEffect,
    resetParameters,
    runSimulation,
    saveModel,
    setEditMode,
  };
}
