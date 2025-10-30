"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { EconomyBuilderState, EconomicHealthMetrics } from "~/types/economy-builder";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import { economyIntegrationService } from "~/app/builder/services/EconomyIntegrationService";
import { api } from "~/trpc/react";

export function useEconomyBuilderState(
  economicInputs: EconomicInputs,
  onEconomicInputsChange: (inputs: EconomicInputs) => void,
  countryId?: string,
  propsSelectedComponents: EconomicComponentType[] = []
) {
  const [economyBuilder, setEconomyBuilder] = useState<EconomyBuilderState>(() => ({
    structure: {
      economicModel: "Mixed Economy",
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: 0,
      gdpCurrency: economicInputs.nationalIdentity?.currency || "USD",
      economicTier: "Developing" as const,
      growthStrategy: "Balanced",
    },
    sectors: [],
    laborMarket: {
      totalWorkforce: 0,
      laborForceParticipationRate: 65,
      employmentRate: 95,
      unemploymentRate: 5,
      underemploymentRate: 3,
      youthUnemploymentRate: 10,
      seniorEmploymentRate: 30,
      femaleParticipationRate: 60,
      maleParticipationRate: 70,
      sectorDistribution: {
        agriculture: 5,
        mining: 2,
        manufacturing: 15,
        construction: 8,
        utilities: 2,
        wholesale: 5,
        retail: 12,
        transportation: 6,
        information: 5,
        finance: 8,
        professional: 10,
        education: 8,
        healthcare: 10,
        hospitality: 6,
        government: 8,
        other: 5,
      },
      employmentType: {
        fullTime: 70,
        partTime: 15,
        temporary: 5,
        seasonal: 3,
        selfEmployed: 10,
        gig: 3,
        informal: 4,
      },
      averageAnnualIncome: 40000,
      averageWorkweekHours: 40,
      averageOvertimeHours: 3,
      paidVacationDays: 15,
      paidSickLeaveDays: 10,
      parentalLeaveWeeks: 12,
      unionizationRate: 20,
      collectiveBargainingCoverage: 25,
      minimumWageHourly: 12,
      livingWageHourly: 18,
      workplaceSafetyIndex: 70,
      laborRightsScore: 65,
      workerProtections: {
        jobSecurity: 60,
        wageProtection: 65,
        healthSafety: 70,
        discriminationProtection: 75,
        collectiveRights: 55,
      },
    },
    demographics: {
      totalPopulation: economicInputs.coreIndicators?.totalPopulation || 0,
      populationGrowthRate: 0,
      ageDistribution: {
        under15: 20,
        age15to64: 65,
        over65: 15,
      },
      urbanRuralSplit: {
        urban: 50,
        rural: 50,
      },
      regions: [],
      lifeExpectancy: 75,
      literacyRate: 90,
      educationLevels: {
        noEducation: 5,
        primary: 25,
        secondary: 45,
        tertiary: 25,
      },
      netMigrationRate: 0,
      immigrationRate: 0,
      emigrationRate: 0,
      infantMortalityRate: 10,
      maternalMortalityRate: 50,
      healthExpenditureGDP: 5,
      youthDependencyRatio: 30,
      elderlyDependencyRatio: 23,
      totalDependencyRatio: 53,
    },
    selectedAtomicComponents: [],
    isValid: true,
    errors: {
      structure: [],
      sectors: {},
      labor: [],
      demographics: [],
      atomicComponents: [],
      validation: [],
    },
    lastUpdated: new Date(),
    version: "1.0.0",
  }));

  const [selectedComponents, setSelectedComponents] =
    useState<EconomicComponentType[]>(propsSelectedComponents);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // tRPC queries and mutations
  const { data: existingConfiguration, isLoading: isLoadingConfig } =
    api.economics.getEconomyBuilderState.useQuery(
      { countryId: countryId! },
      { enabled: !!countryId }
    );

  const saveEconomyMutation = api.economics.saveEconomyBuilderState.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast.success("Economy configuration saved successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save economy configuration");
    },
  });

  const autoSaveMutation = api.economics.autoSaveEconomyBuilder.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
    },
    onError: (error: any) => {
      console.warn("Auto-save failed:", error.message);
    },
  });

  // Load existing configuration
  useEffect(() => {
    if (existingConfiguration) {
      setEconomyBuilder((prev) => ({
        ...prev,
        structure: {
          ...prev.structure,
          ...existingConfiguration.structure,
          economicTier: (["Developing", "Emerging", "Developed", "Advanced"] as const).includes(
            existingConfiguration.structure?.economicTier as any
          )
            ? (existingConfiguration.structure.economicTier as
                | "Developing"
                | "Emerging"
                | "Developed"
                | "Advanced")
            : "Developing",
          growthStrategy: (
            ["Export-Led", "Import-Substitution", "Balanced", "Innovation-Driven"] as const
          ).includes(existingConfiguration.structure?.growthStrategy as any)
            ? (existingConfiguration.structure.growthStrategy as
                | "Export-Led"
                | "Import-Substitution"
                | "Balanced"
                | "Innovation-Driven")
            : "Balanced",
        },
        sectors: {
          ...prev.sectors,
          ...existingConfiguration.sectors,
        },
        laborMarket: {
          ...prev.laborMarket,
          ...existingConfiguration.laborMarket,
        },
        demographics: {
          ...prev.demographics,
          ...existingConfiguration.demographics,
        },
        version: existingConfiguration.version ?? prev.version,
        isValid: true,
        errors: {},
      }));
      setSelectedComponents(existingConfiguration.selectedAtomicComponents || []);
      setLastSaved(existingConfiguration.lastUpdated || null);
      setHasUnsavedChanges(false);
    }
  }, [existingConfiguration]);

  // Subscribe to integration service once (no dependencies to prevent loops)
  useEffect(() => {
    const unsubscribe = economyIntegrationService.subscribe((state) => {
      if (state.economyBuilder && state.economyBuilder !== economyBuilder) {
        setEconomyBuilder(state.economyBuilder);
      }
      // Only call parent callback if truly different (deep equality check)
      if (
        state.economicInputs &&
        JSON.stringify(state.economicInputs) !== JSON.stringify(economicInputs)
      ) {
        onEconomicInputsChange(state.economicInputs);
      }
    });

    return () => unsubscribe();
  }, []); // Empty deps - subscribe once

  // Separate effect for updating service when economicInputs change from parent
  useEffect(() => {
    if (economicInputs) {
      economyIntegrationService.updateEconomicInputs(economicInputs);
    }
  }, [economicInputs]);

  // Auto-save functionality
  useEffect(() => {
    if (!isAutoSaveEnabled || !countryId || !hasUnsavedChanges) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const changes = {
          economicComponents: selectedComponents.join(","),
          gdpNominal: economyBuilder.structure.totalGDP,
          gdpPerCapita:
            economyBuilder.structure.totalGDP / economyBuilder.demographics.totalPopulation,
          gdpGrowthRate: economyBuilder.sectors.reduce(
            (sum, s) => sum + (s.growthRate * s.gdpContribution) / 100,
            0
          ),
          population: economyBuilder.demographics.totalPopulation,
          populationGrowthRate: economyBuilder.demographics.populationGrowthRate,
          unemploymentRate: economyBuilder.laborMarket.unemploymentRate,
          laborForceParticipationRate: economyBuilder.laborMarket.laborForceParticipationRate,
          urbanPopulationPercent: economyBuilder.demographics.urbanRuralSplit.urban,
          lifeExpectancy: economyBuilder.demographics.lifeExpectancy,
          literacyRate: economyBuilder.demographics.literacyRate,
          economicTier: economyBuilder.structure.economicTier,
          economicModel: economyBuilder.structure.economicModel,
        };

        await autoSaveMutation.mutateAsync({ countryId, changes });
        setHasUnsavedChanges(false);
      } catch (error) {
        console.warn("Auto-save failed:", error);
      }
    }, 15000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    economyBuilder,
    selectedComponents,
    isAutoSaveEnabled,
    countryId,
    hasUnsavedChanges,
    autoSaveMutation,
  ]);

  // Mark unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [economyBuilder, selectedComponents]);

  useEffect(() => {
    if (lastSaved) {
      setHasUnsavedChanges(false);
    }
  }, [lastSaved]);

  const handleComponentChange = useCallback((components: EconomicComponentType[]) => {
    setSelectedComponents(components);
    economyIntegrationService.updateEconomicComponents(components);
  }, []);

  const handleEconomyBuilderChange = useCallback((builder: EconomyBuilderState) => {
    setEconomyBuilder(builder);
    economyIntegrationService.updateEconomyBuilder(builder);
  }, []);

  const validateEconomyConfiguration = useCallback(() => {
    const errors: string[] = [];

    const sectorSum = economyBuilder.sectors.reduce(
      (sum, sector) => sum + sector.gdpContribution,
      0
    );
    if (Math.abs(sectorSum - 100) > 1) {
      errors.push(`Sector GDP contributions must sum to 100% (currently ${sectorSum.toFixed(1)}%)`);
    }

    const employmentSum = economyBuilder.sectors.reduce(
      (sum, sector) => sum + sector.employmentShare,
      0
    );
    if (Math.abs(employmentSum - 100) > 1) {
      errors.push(`Employment shares must sum to 100% (currently ${employmentSum.toFixed(1)}%)`);
    }

    if (economyBuilder.laborMarket.laborForceParticipationRate > 90) {
      errors.push("Labor force participation rate seems too high (>90%)");
    }

    if (
      economyBuilder.laborMarket.unemploymentRate < 0 ||
      economyBuilder.laborMarket.unemploymentRate > 50
    ) {
      errors.push("Unemployment rate seems unrealistic");
    }

    const ageSum =
      (economyBuilder.demographics.ageDistribution?.under15 || 0) +
      (economyBuilder.demographics.ageDistribution?.age15to64 || 0) +
      (economyBuilder.demographics.ageDistribution?.over65 || 0);
    if (Math.abs(ageSum - 100) > 1) {
      errors.push(`Age distribution must sum to 100% (currently ${ageSum}%)`);
    }

    return { isValid: errors.length === 0, errors };
  }, [economyBuilder]);

  const handleSave = useCallback(async () => {
    if (!countryId) {
      toast.error("No country selected. Please select a country first.");
      return;
    }

    const validation = validateEconomyConfiguration();
    if (!validation.isValid) {
      toast.error(`Validation failed: ${validation.errors.join(", ")}`);
      return;
    }

    try {
      await saveEconomyMutation.mutateAsync({
        countryId,
        economyBuilder: {
          structure: economyBuilder.structure,
          sectors: economyBuilder.sectors as any,
          laborMarket: economyBuilder.laborMarket,
          demographics: economyBuilder.demographics,
          selectedAtomicComponents: selectedComponents,
          lastUpdated: new Date(),
          version: economyBuilder.version || "1.0.0",
        },
      });

      economyIntegrationService.updateEconomyBuilder(economyBuilder);
      economyIntegrationService.updateEconomicComponents(selectedComponents);
    } catch (error) {
      console.error("Error saving economy configuration:", error);
    }
  }, [
    countryId,
    economyBuilder,
    selectedComponents,
    saveEconomyMutation,
    validateEconomyConfiguration,
  ]);

  return {
    economyBuilder,
    selectedComponents,
    isLoadingConfig,
    isAutoSaveEnabled,
    hasUnsavedChanges,
    lastSaved,
    isSaving: saveEconomyMutation.isPending,
    handleComponentChange,
    handleEconomyBuilderChange,
    handleSave,
    validateEconomyConfiguration,
    setIsAutoSaveEnabled,
  };
}
