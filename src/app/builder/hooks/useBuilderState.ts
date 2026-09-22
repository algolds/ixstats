/**
 * Shared state management hook for the Atomic Country Builder.
 * Composed of focused sub-hooks: useBuilderPersistence, useBuilderEditMode, useBuilderSync.
 */

import { useState, useCallback, useRef } from "react";
import { type BuilderStep, getStepsForMode } from "../components/enhanced/builderConfig";
import type { RealCountryData, EconomicInputs } from "../lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { ComponentType } from "~/lib/enums";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type {
  GovernmentBuilderState,
  GovernmentType,
} from "~/types/government";
import { createDefaultEconomicInputs } from "../lib/economy-data-service";
import { modernArchetypes } from "~/lib/economy/archetypes/modern";
import { historicalArchetypes } from "~/lib/economy/archetypes/historical";
import { mapLegacyGovernmentComponents } from "~/hooks/useArchetypes";
import { registerCustomCurrency } from "~/lib/utils";
import {
  type BuilderState,
  type UseBuilderStateReturn,
  baseInitialState,
  getInitialState,
  sanitizeEconomicInputs,
} from "./builderStateTypes";
import { useBuilderEditMode } from "./useBuilderEditMode";
import { useBuilderPersistence } from "./useBuilderPersistence";
import { useBuilderSync } from "./useBuilderSync";
import { isScratchOrImportOrigin } from "../lib/builder-theme";

export type { BuilderState, UseBuilderStateReturn };
export { baseInitialState, getInitialState, sanitizeEconomicInputs };

/**
 * Main builder state management hook for the Atomic Country Builder.
 */
export function useBuilderState(
  mode: "create" | "edit" = "create",
  countryId?: string
): UseBuilderStateReturn {
  const [builderState, setBuilderState] = useState<BuilderState>(() => getInitialState(mode));
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const localHadDataRef = useRef(false);

  // Edit mode hydration from database and local crash recovery
  const {
    isLoadingCountry,
    editModeInitialized,
  } = useBuilderEditMode({
    mode,
    countryId,
    setBuilderState,
    setHasRestoredState,
    setLastSaved,
  });

  // Create mode synchronization (quick-start, wiki imports, and draft restore)
  useBuilderSync({
    mode,
    setBuilderState,
    setHasRestoredState,
    setLastSaved,
    localHadDataRef,
  });

  // Persistence to localStorage, server draft, and DB
  const {
    isAutoSaving,
    isSyncing,
    syncError,
    triggerManualSave,
    clearDraft,
  } = useBuilderPersistence({
    mode,
    countryId,
    builderState,
    setBuilderState,
    isLoadingCountry,
    editModeInitialized,
    localHadDataRef,
    hasRestoredState,
    setHasRestoredState,
    lastSaved,
    setLastSaved,
  });

  // Update handlers
  const updateEconomicInputs = useCallback((inputs: EconomicInputs) => {
    setBuilderState((prev) => {
      const sanitized = sanitizeEconomicInputs(inputs);
      const nextState = { ...prev, economicInputs: sanitized };

      if (nextState.economyBuilderState) {
        const totalPopulation = sanitized.coreIndicators?.totalPopulation;
        if (totalPopulation !== undefined) {
          const participationRate =
            nextState.economyBuilderState.laborMarket?.laborForceParticipationRate ?? 65;
          const totalWorkforce =
            sanitized.laborEmployment?.totalWorkforce ||
            Math.round(totalPopulation * (participationRate / 100));
          nextState.economyBuilderState = {
            ...nextState.economyBuilderState,
            demographics: {
              ...nextState.economyBuilderState.demographics,
              totalPopulation,
            },
            laborMarket: {
              ...nextState.economyBuilderState.laborMarket,
              totalWorkforce,
            },
          };
        }
      }

      const currency = sanitized.nationalIdentity?.currency;
      if (currency) {
        const symbol = sanitized.nationalIdentity?.currencySymbol || "$";
        registerCustomCurrency(currency, symbol);

        if (nextState.governmentStructure?.structure) {
          nextState.governmentStructure = {
            ...nextState.governmentStructure,
            structure: {
              ...nextState.governmentStructure.structure,
              budgetCurrency: currency,
            },
          };
        }
      }
      return nextState;
    });
  }, []);

  const updateGovernmentComponents = useCallback((components: ComponentType[]) => {
    setBuilderState((prev) => ({ ...prev, governmentComponents: components }));
  }, []);

  const updateGovernmentStructure = useCallback((structure: GovernmentBuilderState) => {
    setBuilderState((prev) => ({ ...prev, governmentStructure: structure }));
  }, []);

  const updateTaxSystem = useCallback((taxData: TaxBuilderState) => {
    setBuilderState((prev) => ({ ...prev, taxSystemData: taxData }));
  }, []);

  const updateEconomyBuilderState = useCallback((economyState: EconomyBuilderState | null) => {
    setBuilderState((prev) => ({ ...prev, economyBuilderState: economyState }));
  }, []);

  const updateArchetypeId = useCallback((id: string | null) => {
    setBuilderState((prev) => ({ ...prev, selectedArchetypeId: id }));
  }, []);

  const updateStep = useCallback(
    (
      step: BuilderStep,
      data?: Partial<BuilderState> | EconomicInputs | RealCountryData | ComponentType[]
    ) => {
      setBuilderState((prev) => {
        const newState = { ...prev };

        if (!prev.completedSteps.includes(step)) {
          newState.completedSteps = [...prev.completedSteps, step];
        }

        switch (step) {
          case "foundation": {
            const countryData = data as RealCountryData | null;
            newState.selectedCountry = countryData;
            newState.economyBuilderState = null;
            if ((data as Partial<BuilderState>)?.creationOrigin) {
              newState.creationOrigin = (data as Partial<BuilderState>).creationOrigin;
            } else if (
              countryData?.countryCode === "custom" ||
              countryData?.name === "Custom Nation"
            ) {
              newState.creationOrigin = "scratch";
            } else if (countryData) {
              newState.creationOrigin = "template";
            }
            if (countryData) {
              newState.economicInputs = sanitizeEconomicInputs(
                createDefaultEconomicInputs(countryData)
              );

              const archetype = newState.selectedArchetypeId
                ? modernArchetypes.get(newState.selectedArchetypeId) ||
                  historicalArchetypes.get(newState.selectedArchetypeId)
                : null;

              if (archetype) {
                if (archetype.governmentComponents) {
                  newState.governmentComponents = mapLegacyGovernmentComponents(
                    archetype.governmentComponents as string[]
                  );
                }

                // Seed national identity defaults from archetype
                if (newState.economicInputs?.nationalIdentity) {
                  const currentName = newState.economicInputs.nationalIdentity.countryName;
                  if (!currentName || currentName === "Custom Nation") {
                    newState.economicInputs.nationalIdentity.countryName =
                      countryData.name || archetype.name;
                    newState.economicInputs.nationalIdentity.officialName = `The Commonwealth of ${countryData.name || archetype.name}`;
                  }
                }

                // Overlay growth metrics and employment profile from archetype
                if (newState.economicInputs) {
                  if (archetype.growthMetrics?.gdpGrowth !== undefined) {
                    newState.economicInputs.coreIndicators = {
                      ...newState.economicInputs.coreIndicators,
                      realGDPGrowthRate: archetype.growthMetrics.gdpGrowth,
                    };
                  }
                  if (archetype.employmentProfile) {
                    newState.economicInputs.laborEmployment = {
                      ...newState.economicInputs.laborEmployment,
                      unemploymentRate: archetype.employmentProfile.unemploymentRate,
                      laborForceParticipationRate: archetype.employmentProfile.laborParticipation,
                    };
                  }
                }

                // Seed government structure defaults
                if (!newState.governmentStructure?.structure?.governmentType) {
                  newState.governmentStructure = {
                    structure: {
                      governmentName: `Government of ${countryData.name || archetype.name}`,
                      governmentType: "Republic" as GovernmentType,
                      headOfState: "President",
                      headOfGovernment: "Prime Minister",
                      legislatureName: "National Assembly",
                      executiveName: "Council of Ministers",
                      judicialName: "Supreme Court",
                      totalBudget: Math.round((countryData.gdp || 100000000000) * 0.35),
                      fiscalYear: "Calendar Year",
                      budgetCurrency: "USD",
                    },
                    departments: newState.governmentStructure?.departments || [],
                    budgetAllocations: newState.governmentStructure?.budgetAllocations || [],
                    revenueSources: newState.governmentStructure?.revenueSources || [],
                    isValid: true,
                    errors: { structure: [], departments: {}, budget: [], revenue: [] },
                  };
                }

                if (archetype.economicComponents) {
                  newState.economyBuilderState = {
                    selectedAtomicComponents: archetype.economicComponents,
                    structure: {
                      economicModel: "Mixed Economy",
                      primarySectors: [],
                      secondarySectors: [],
                      tertiarySectors: [],
                      totalGDP: countryData.gdp || 1000000000,
                      gdpCurrency: "USD",
                      economicTier: "Developing",
                      growthStrategy: "Balanced",
                    },
                    sectors: [],
                    laborMarket: {
                      totalWorkforce: Math.round(
                        (countryData.population || 10000000) *
                          ((archetype.employmentProfile?.laborParticipation ?? 65.0) / 100)
                      ),
                      laborForceParticipationRate:
                        archetype.employmentProfile?.laborParticipation ?? 65.0,
                      employmentRate: 95.0,
                      unemploymentRate: archetype.employmentProfile?.unemploymentRate ?? 5.0,
                      underemploymentRate: 5.0,
                      youthUnemploymentRate: 10.0,
                      seniorEmploymentRate: 20.0,
                      femaleParticipationRate: 60.0,
                      maleParticipationRate: 70.0,
                      sectorDistribution: {
                        agriculture: 5,
                        mining: 2,
                        manufacturing: 15,
                        construction: 8,
                        utilities: 2,
                        wholesale: 5,
                        retail: 10,
                        transportation: 5,
                        information: 3,
                        finance: 5,
                        professional: 10,
                        education: 6,
                        healthcare: 8,
                        hospitality: 5,
                        government: 8,
                        other: 3,
                      },
                      employmentType: {
                        fullTime: 70,
                        partTime: 15,
                        temporary: 8,
                        seasonal: 0,
                        selfEmployed: 5,
                        gig: 2,
                        informal: 0,
                      },
                      averageWorkweekHours: 40,
                      averageOvertimeHours: 2,
                      averageAnnualIncome: 30000,
                      paidVacationDays: 20,
                      paidSickLeaveDays: 10,
                      parentalLeaveWeeks: 12,
                      unionizationRate: 15,
                      collectiveBargainingCoverage: 20,
                      minimumWageHourly: 15,
                      livingWageHourly: 20,
                      workplaceSafetyIndex: 75,
                      laborRightsScore: 70,
                      workerProtections: {
                        jobSecurity: 70,
                        wageProtection: 75,
                        healthSafety: 80,
                        discriminationProtection: 75,
                        collectiveRights: 70,
                      },
                    },
                    demographics: {
                      totalPopulation: countryData.population || 10000000,
                      populationGrowthRate: 1.0,
                      ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
                      urbanRuralSplit: { urban: 65, rural: 35 },
                      regions: [],
                      lifeExpectancy: 75,
                      literacyRate: 95,
                      educationLevels: { noEducation: 2, primary: 18, secondary: 55, tertiary: 25 },
                      netMigrationRate: 0,
                      immigrationRate: 2,
                      emigrationRate: 2,
                      infantMortalityRate: 5,
                      maternalMortalityRate: 10,
                      healthExpenditureGDP: 8,
                      youthDependencyRatio: 30,
                      elderlyDependencyRatio: 23,
                      totalDependencyRatio: 53,
                    },
                    isValid: true,
                    errors: {},
                    lastUpdated: new Date(),
                    version: "1.0.0",
                  };
                }

                if (archetype.taxProfile) {
                  newState.taxSystemData = {
                    taxSystem: {
                      taxSystemName: `${countryData.name} Tax System`,
                      fiscalYear: "Calendar Year",
                      progressiveTax: true,
                      alternativeMinTax: false,
                    },
                    categories: [
                      {
                        categoryName: "Personal Income Tax",
                        categoryType: "Direct Tax",
                        description: "Tax on personal earnings",
                        isActive: true,
                        calculationMethod: "percentage",
                        baseRate: archetype.taxProfile.incomeRate,
                        deductionAllowed: true,
                        priority: 10,
                        color: "#3b82f6",
                      },
                      {
                        categoryName: "Corporate Income Tax",
                        categoryType: "Direct Tax",
                        description: "Tax on corporate profits",
                        isActive: true,
                        calculationMethod: "percentage",
                        baseRate: archetype.taxProfile.corporateRate,
                        deductionAllowed: true,
                        priority: 20,
                        color: "#10b981",
                      },
                      {
                        categoryName: "Consumption/Sales Tax",
                        categoryType: "Indirect Tax",
                        description: "Tax on goods and services",
                        isActive: true,
                        calculationMethod: "percentage",
                        baseRate: archetype.taxProfile.consumptionRate,
                        deductionAllowed: false,
                        priority: 30,
                        color: "#f59e0b",
                      },
                    ],
                    brackets: {},
                    exemptions: [],
                    deductions: {},
                    isValid: true,
                    errors: {},
                  };
                }
              }

              if (
                !newState.governmentStructure ||
                !newState.governmentStructure.structure ||
                newState.governmentStructure.structure.governmentName === "Government of the Nation"
              ) {
                newState.governmentStructure = {
                  structure: {
                    governmentName: `Government of ${countryData.name}`,
                    governmentType: (archetype?.name || countryData.governmentType || "Other") as GovernmentType,
                    headOfState: "",
                    headOfGovernment: "",
                    legislatureName: "",
                    executiveName: "",
                    judicialName: "",
                    totalBudget: (countryData.gdp || 1000000000) * 0.35,
                    fiscalYear: "Calendar Year",
                    budgetCurrency: "USD",
                  },
                  departments: [],
                  budgetAllocations: [],
                  revenueSources: [],
                  isValid: true,
                  errors: { structure: [], departments: {}, budget: [], revenue: [] },
                };
              }
            }
            break;
          }
          case "core": {
            const inputs = data as EconomicInputs;
            newState.economicInputs = sanitizeEconomicInputs(inputs);
            if (inputs) {
              const hasCustomizedStructure =
                newState.governmentStructure &&
                newState.governmentStructure.structure &&
                newState.governmentStructure.structure.governmentName !==
                  "Government of the Nation" &&
                !newState.governmentStructure.structure.governmentName.startsWith(
                  "Government of Custom Nation"
                ) &&
                (!newState.selectedCountry ||
                  newState.governmentStructure.structure.governmentName !==
                    `Government of ${newState.selectedCountry.name}`);

              if (
                !newState.governmentStructure ||
                !newState.governmentStructure.structure ||
                !hasCustomizedStructure
              ) {
                const countryName =
                  inputs.countryName || newState.selectedCountry?.name || "the Nation";
                const govType = inputs.nationalIdentity?.governmentType || "Other";
                const nominalGDP = inputs.coreIndicators?.nominalGDP || 1000000000;
                const currency = inputs.nationalIdentity?.currency || "USD";

                newState.governmentStructure = {
                  ...newState.governmentStructure,
                  structure: {
                    governmentName: `Government of ${countryName}`,
                    governmentType: govType as GovernmentType,
                    headOfState: newState.governmentStructure?.structure?.headOfState || "",
                    headOfGovernment:
                      newState.governmentStructure?.structure?.headOfGovernment || "",
                    legislatureName: newState.governmentStructure?.structure?.legislatureName || "",
                    executiveName: newState.governmentStructure?.structure?.executiveName || "",
                    judicialName: newState.governmentStructure?.structure?.judicialName || "",
                    totalBudget: nominalGDP * 0.35,
                    fiscalYear:
                      newState.governmentStructure?.structure?.fiscalYear || "Calendar Year",
                    budgetCurrency: currency,
                  },
                  departments: newState.governmentStructure?.departments || [],
                  budgetAllocations: newState.governmentStructure?.budgetAllocations || [],
                  revenueSources: newState.governmentStructure?.revenueSources || [],
                  isValid: true,
                  errors: newState.governmentStructure?.errors || {
                    structure: [],
                    departments: {},
                    budget: [],
                    revenue: [],
                  },
                };
              }
            }
            break;
          }
          case "government":
            newState.governmentComponents = data as ComponentType[];
            break;
          case "economics":
            newState.economicInputs = sanitizeEconomicInputs(data as EconomicInputs);
            break;
        }

        const steps = getStepsForMode(mode, isScratchOrImportOrigin(newState));
        const currentIndex = steps.indexOf(step);
        if (currentIndex !== -1 && currentIndex < steps.length - 1) {
          newState.step = steps[currentIndex + 1]!;
        }

        return newState;
      });
    },
    [mode]
  );

  const canAccessStep = useCallback(
    (step: BuilderStep): boolean => {
      const steps = getStepsForMode(mode, isScratchOrImportOrigin(builderState));
      if (!steps.includes(step)) return false;
      const currentIndex = steps.indexOf(builderState.step);
      const targetIndex = steps.indexOf(step);
      return targetIndex <= currentIndex || builderState.completedSteps.includes(step);
    },
    [builderState, mode]
  );

  const applyImportedData = useCallback((imported: Partial<BuilderState>) => {
    setBuilderState((prev) => ({
      ...prev,
      ...imported,
      creationOrigin: "import",
      step: "core",
      completedSteps: Array.from(new Set([...prev.completedSteps, "foundation" as BuilderStep])),
      activeCoreTab: "identity",
    }));
  }, []);

  return {
    builderState,
    setBuilderState,
    lastSaved,
    isAutoSaving,
    isLoadingCountry,
    countryId,
    mode,
    enabledSteps: getStepsForMode(mode, isScratchOrImportOrigin(builderState)),
    isSyncing,
    syncError,
    selectedArchetypeId: builderState.selectedArchetypeId,
    updateArchetypeId,
    updateEconomicInputs,
    updateGovernmentComponents,
    updateGovernmentStructure,
    updateTaxSystem,
    updateEconomyBuilderState,
    updateStep,
    clearDraft,
    applyImportedData,
    canAccessStep,
    triggerManualSave,
    hasRestoredState,
  };
}
