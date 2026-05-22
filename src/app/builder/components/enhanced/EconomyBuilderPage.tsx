"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Label } from "~/components/ui/label";
import {
  Factory,
  Users,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  Save,
  ArrowLeft,
  ArrowRight,
  Zap,
  BarChart3,
  Globe,
  DollarSign,
  Gauge,
  Eye,
  Loader2,
} from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";

// Economy Builder Components
import { AtomicEconomicComponentSelector } from "~/components/economy/atoms/AtomicEconomicComponents";


import { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";

// Types and Services
import type {
  EconomyBuilderState,
  EconomicHealthMetrics,
} from "~/types/economy-builder";
import type { EconomicInputs } from "../../lib/economy-data-service";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { economyIntegrationService } from "../../services/EconomyIntegrationService";
import { useEconomyBuilderSync } from "../../hooks/useEconomyBuilderSync";

// Tab Components (lazy-loaded)
import { Suspense } from "react";
import { EconomySectorsTab, LaborEmploymentTab, DemographicsPopulationTab } from "./tabs";
import { getRegionColor } from "./tabs/utils/demographicsCalculations";
import { TabLoadingFallback } from "../../components/LoadingFallback";

// Step Components
import { TaxSystemStep } from "./steps/TaxSystemStep";
import { PreviewStep } from "./steps/PreviewStep";

// Cross-Builder Integration Components
import { EconomicArchetypeModal } from "./EconomicArchetypeModal";
import { EconomyBuilderHeader } from "./economy-builder/components/EconomyBuilderHeader";
import { StepNavigation } from "./economy-builder/components/StepNavigation";
import { NavigationButtons } from "./economy-builder/components/NavigationButtons";
import { BUILDER_GOLD } from "./builderConfig";

// tRPC API
import { api } from "~/trpc/react";

// Format utilities
import { formatCurrency, formatPercent } from "~/lib/format-utils";

// Government types
import type { RevenueSource } from "~/types/government";

// Autosave hook
import { useEconomyBuilderAutoSync } from "~/hooks/useEconomyBuilderAutoSync";

// Builder context
import { useBuilderContextOptional } from "./context/BuilderStateContext";

// Shared staleTime constants
import { STALE_TIME } from "~/hooks/useCountryGovernment";

/**
 * Props for the EconomyBuilderPage component
 *
 * @interface EconomyBuilderPageProps
 * @property {EconomicInputs} economicInputs - Base economic data (GDP, population, currency, etc.)
 * @property {function} onEconomicInputsChange - Callback to update economic inputs when modified
 * @property {any[]} [governmentComponents] - Optional array of government atomic components for integration
 * @property {any} [governmentBuilderData] - Optional government builder state for cross-builder synchronization
 * @property {any} [taxSystemData] - Optional tax system configuration for integration
 * @property {string} [countryId] - Optional country ID for loading/saving existing configurations
 * @property {string} [className] - Optional CSS classes for styling
 * @property {function} [onSelectedComponentsChange] - Optional callback when atomic components change
 * @property {boolean} [showAdvanced=false] - Whether to display advanced configuration options
 * @property {EconomicComponentType[]} [selectedComponents] - Optional pre-selected atomic components
 * @property {EconomicHealthMetrics} [economicHealthMetrics] - Optional calculated economic health metrics
 */
interface EconomyBuilderPageProps {
  economicInputs: EconomicInputs;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  governmentComponents?: any[];
  governmentBuilderData?: any;
  taxSystemData?: TaxBuilderState | null;
  countryId?: string;
  className?: string;
  onSelectedComponentsChange?: (components: EconomicComponentType[]) => void;
  showAdvanced?: boolean;
  selectedComponents?: EconomicComponentType[];
  economicHealthMetrics?: EconomicHealthMetrics;
  persistedEconomyBuilder?: EconomyBuilderState | null;
  onPersistEconomyBuilder?: (builder: EconomyBuilderState) => void;
  onPersistTaxSystem?: (taxSystem: TaxBuilderState) => void;
}

/**
 * EconomyBuilderPage - Comprehensive multi-step economy configuration wizard with atomic components
 *
 * This component provides a complete economy building interface organized into six distinct steps,
 * allowing users to configure every aspect of their nation's economic system from atomic components
 * to detailed sector configurations, labor markets, demographics, and tax integration.
 *
 * The 6-step economy builder workflow:
 * 1. Components: Select atomic economic components (Free Market, Planned Economy, Export-Oriented, etc.)
 * 2. Sectors: Configure economic sectors (Agriculture, Manufacturing, Services) with GDP/employment shares
 * 3. Labor: Set up labor market (unemployment rates, workforce distribution, worker protections)
 * 4. Demographics: Configure population (total population, age distribution, urban/rural split)
 * 5. Taxes: Integrate tax system with automatic population based on economic data
 * 6. Preview: Review complete configuration with validation and effectiveness scores
 *
 * Key features:
 * - Atomic component system with synergy/conflict detection across 50+ economic components
 * - Template-based sector creation with real-time GDP and employment normalization
 * - Cross-builder integration with government and tax systems for unified effectiveness
 * - Auto-save functionality with tRPC mutations for persistent storage
 * - Real-time validation ensuring sector percentages sum to 100% and labor metrics are realistic
 * - Economic archetype presets (Capitalist, Socialist, Mixed Economy) for quick-start
 * - Component impact visualization showing how atomic components affect each configuration area
 * - Bidirectional synchronization with government departments and tax revenue sources
 *
 * @component
 * @param {EconomyBuilderPageProps} props - Component props
 * @param {EconomicInputs} props.economicInputs - Base economic data including GDP, population, and currency
 * @param {function} props.onEconomicInputsChange - Callback to update economic inputs with modifications
 * @param {any[]} [props.governmentComponents] - Government atomic components for cross-builder synergies
 * @param {any} [props.governmentBuilderData] - Government builder state for budget/department integration
 * @param {any} [props.taxSystemData] - Tax system data for revenue/expenditure synchronization
 * @param {string} [props.countryId] - Country ID for loading existing configurations or saving new ones
 * @param {string} [props.className] - Additional CSS classes for custom styling
 * @param {function} [props.onSelectedComponentsChange] - Callback when atomic component selection changes
 * @param {boolean} [props.showAdvanced=false] - Whether to show advanced configuration options
 * @param {EconomicComponentType[]} [props.selectedComponents] - Pre-selected atomic economic components
 * @param {EconomicHealthMetrics} [props.economicHealthMetrics] - Calculated health metrics for the economy
 *
 * @returns {JSX.Element} Rendered economy builder interface with step navigation and configuration forms
 *
 * @example
 * ```tsx
 * <EconomyBuilderPage
 *   economicInputs={economicInputsData}
 *   onEconomicInputsChange={handleEconomicInputsChange}
 *   governmentComponents={['DEMOCRACY', 'FEDERAL_SYSTEM']}
 *   countryId="country_123"
 *   showAdvanced={true}
 *   onSelectedComponentsChange={handleComponentsChange}
 * />
 * ```
 */
export function EconomyBuilderPage({
  economicInputs,
  onEconomicInputsChange,
  governmentComponents = [],
  governmentBuilderData,
  taxSystemData,
  countryId,
  className = "",
  onSelectedComponentsChange,
  showAdvanced = false,
  selectedComponents: propsSelectedComponents = [],
  economicHealthMetrics,
  persistedEconomyBuilder = null,
  onPersistEconomyBuilder,
  onPersistTaxSystem,
}: EconomyBuilderPageProps) {
  const notify = useNotify();
  // Removed auto-save state - using global builder autosave instead

  // State Management - Memoized to prevent unnecessary re-renders
  const [economyBuilder, setEconomyBuilder] = useState<EconomyBuilderState>(() => {
    if (persistedEconomyBuilder) {
      return {
        ...persistedEconomyBuilder,
        laborMarket: {
          ...persistedEconomyBuilder.laborMarket,
          averageAnnualIncome:
            typeof persistedEconomyBuilder.laborMarket?.averageAnnualIncome === "number"
              ? persistedEconomyBuilder.laborMarket.averageAnnualIncome
              : Math.round((economicInputs.coreIndicators?.gdpPerCapita || 0) * 0.8),
        },
      };
    }

    return {
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
        averageAnnualIncome:
          economicInputs.laborEmployment?.averageAnnualIncome ??
          Math.round((economicInputs.coreIndicators?.gdpPerCapita || 0) * 0.8),
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
    };
  });

  const [selectedComponents, setSelectedComponents] =
    useState<EconomicComponentType[]>(propsSelectedComponents);
  const [currentStep, setCurrentStep] = useState<
    "components" | "sectors" | "labor" | "demographics" | "taxes" | "preview"
  >("components");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Get builder context if available (returns null if used standalone, not within BuilderStateProvider)
  const builderContext = useBuilderContextOptional();

  // Prepare economy data for autosave
  const economyDataForSync = useMemo(() => {
    return {
      // Core economic indicators
      gdp: economyBuilder.structure.totalGDP,
      gdpPerCapita:
        economyBuilder.structure.totalGDP && economyBuilder.demographics.totalPopulation
          ? economyBuilder.structure.totalGDP / economyBuilder.demographics.totalPopulation
          : economicInputs.coreIndicators?.gdpPerCapita,
      population: economyBuilder.demographics.totalPopulation,
      unemploymentRate: economyBuilder.laborMarket.unemploymentRate,
      inflationRate: economicInputs.coreIndicators?.inflationRate,

      // Labor market
      laborForceParticipation: economyBuilder.laborMarket.laborForceParticipationRate,
      averageWorkingHours: economyBuilder.laborMarket.averageWorkweekHours,
      minimumWage: economyBuilder.laborMarket.minimumWageHourly,

      // Demographics
      literacyRate: economyBuilder.demographics.literacyRate,
      lifeExpectancy: economyBuilder.demographics.lifeExpectancy,
    };
  }, [economyBuilder, economicInputs]);

  // Autosave hook integration
  const { syncState: autoSyncState, syncNow, showSuccessAnimation } = useEconomyBuilderAutoSync(
    countryId,
    economyDataForSync,
    {
      enabled: !!countryId, // Only enable in edit mode
      onSyncSuccess: () => {
        console.log("[EconomyBuilder] Autosave successful");
        setLastSaved(new Date());
      },
      onSyncError: (error) => {
        console.error("[EconomyBuilder] Autosave failed:", error);
        notify.error("Failed to autosave economy data");
      },
    }
  );

  // Register autosync with BuilderContext (if available)
  useEffect(() => {
    if (builderContext && countryId) {
      builderContext.registerAutoSync("economy", syncNow);
      console.log("[EconomyBuilder] Registered autosync with BuilderContext");
      return () => {
        builderContext.unregisterAutoSync("economy");
        console.log("[EconomyBuilder] Unregistered autosync from BuilderContext");
      };
    }
  }, [countryId, syncNow, builderContext]);

  // Government Revenue Integration State
  const [revenueIntegration, setRevenueIntegration] = useState<{
    totalRevenue: number;
    taxRevenue: number;
    nonTaxRevenue: number;
    taxBurdenRatio: number;
    revenueToGDPRatio: number;
    governmentSizeIndicator: "Small" | "Medium" | "Large";
  }>({
    totalRevenue: 0,
    taxRevenue: 0,
    nonTaxRevenue: 0,
    taxBurdenRatio: 0,
    revenueToGDPRatio: 0,
    governmentSizeIndicator: "Medium",
  });

  // Tax System tRPC Queries
  const { data: fetchedTaxSystemData, refetch: refetchTaxSystem } =
    api.taxSystem.getByCountryId.useQuery(
      { countryId: countryId || "" },
      {
        enabled: !!countryId,
        staleTime: 30000,
      }
    );

  const createTaxSystemMutation = api.taxSystem.create.useMutation();
  const updateTaxSystemMutation = api.taxSystem.update.useMutation();

  // Use fetched tax data or prop tax data
  const activeTaxSystemData: TaxBuilderState | null =
    (fetchedTaxSystemData as TaxBuilderState | null) ??
    (taxSystemData as TaxBuilderState | null) ??
    null;

  useEffect(() => {
    if (activeTaxSystemData && onPersistTaxSystem) {
      onPersistTaxSystem(activeTaxSystemData as TaxBuilderState);
    }
  }, [activeTaxSystemData, onPersistTaxSystem]);

  // Track auto-selection to prevent loops
  const hasAutoSelectedRef = useRef(false);

  // Phase 2 optimization: Use consolidated sync hook for refs, integration service, and cross-builder sync
  const {
    economyBuilderRef,
    economicInputsRef,
    onEconomicInputsChangeRef: _onEconomicInputsChangeRef,
    persistEconomyBuilderRef: _persistEconomyBuilderRef,
    syncStatus,
    syncGovernmentMutation: _syncGovernmentMutation,
    syncTaxMutation: _syncTaxMutation,
  } = useEconomyBuilderSync({
    countryId,
    economyBuilder,
    economicInputs,
    governmentComponents,
    taxSystemData,
    onEconomicInputsChange,
    onPersistEconomyBuilder,
    setEconomyBuilder,
  });

  // Track last processed revenue sources to prevent re-trigger loop
  const lastProcessedRevenueSourcesRef = useRef<string | null>(null);

  // Auto-select economic components based on government components with comprehensive synergy scoring
  useEffect(() => {
    if (governmentComponents && governmentComponents.length > 0 && !hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true;

      // Extract government component types from various possible formats
      const govCompTypes = governmentComponents
        .map((comp) => {
          if (typeof comp === "string") return comp;
          if (comp.type) return comp.type;
          if (comp.id) return comp.id;
          return null;
        })
        .filter(Boolean) as string[];

      console.log("[EconomyBuilder] Government components detected:", govCompTypes);

      // Score each economic component based on synergies with government
      const componentScores = Object.entries(ATOMIC_ECONOMIC_COMPONENTS).map(([key, component]) => {
        if (!component) return { type: key as EconomicComponentType, score: 0 };

        // Calculate synergy score
        const synergyMatches =
          component.governmentSynergies?.filter((govType) =>
            govCompTypes.some(
              (gc) => gc === govType || gc.includes(govType) || govType.includes(gc)
            )
          ).length || 0;

        // Calculate conflict penalty
        const conflictMatches =
          component.governmentConflicts?.filter((govType) =>
            govCompTypes.some(
              (gc) => gc === govType || gc.includes(govType) || govType.includes(gc)
            )
          ).length || 0;

        // Base score = component effectiveness
        let score = component.effectiveness || 50;

        // Add synergy bonuses (+15 per synergy)
        score += synergyMatches * 15;

        // Subtract conflict penalties (-20 per conflict)
        score -= conflictMatches * 20;

        return {
          type: key as EconomicComponentType,
          score,
          synergyCount: synergyMatches,
          conflictCount: conflictMatches,
          component,
        };
      });

      // Sort by score (highest first) and select top 6-8 components with positive synergies
      const topComponents = componentScores
        .filter((item) => item.score > 60 && (item.synergyCount ?? 0) > 0) // Must have synergies and good score
        .sort((a, b) => b.score - a.score)
        .slice(0, 8) // Select top 6-8
        .map((item) => item.type);

      if (topComponents.length > 0) {
        const merged = Array.from(new Set([...selectedComponents, ...topComponents]));
        setSelectedComponents(merged);

        console.log(
          `[EconomyBuilder] Auto-selected ${topComponents.length} components with government synergies:`,
          {
            components: topComponents.map((type) => {
              const comp = ATOMIC_ECONOMIC_COMPONENTS[type];
              const item = componentScores.find((i) => i.type === type);
              return {
                type,
                name: comp?.name,
                score: item?.score,
                synergies: item?.synergyCount,
                conflicts: item?.conflictCount,
              };
            }),
          }
        );

        // User-friendly notification
        notify.success(
          `Auto-selected ${topComponents.length} economic components that synergize with your government structure`,
          { duration: 4000 }
        );
      } else {
        console.log("[EconomyBuilder] No strong synergies found with government components");
      }
    }
  }, [governmentComponents.length]); // Only trigger on count change

  // NOTE: Integration service subscription and cross-builder sync effects have been
  // moved to useEconomyBuilderSync hook (Phase 2 optimization)

  // Update integration service when governmentBuilderData changes
  useEffect(() => {
    if (governmentBuilderData) {
      economyIntegrationService.updateGovernmentBuilder(governmentBuilderData);
    }
  }, [governmentBuilderData]);

  // Component Change Handler - Memoized
  const handleComponentChange = useCallback(
    (components: EconomicComponentType[]) => {
      setSelectedComponents(components);
      economyIntegrationService.updateEconomicComponents(components);
      // Notify parent component
      onSelectedComponentsChange?.(components);
    },
    [onSelectedComponentsChange]
  );

  // Economy Builder Change Handler - Memoized
  const handleEconomyBuilderChange = useCallback(
    (builder: EconomyBuilderState) => {
      setEconomyBuilder(builder);
      economyIntegrationService.updateEconomyBuilder(builder);
      onPersistEconomyBuilder?.(builder);

      if (economicInputs) {
        const mergedInputs = mergeEconomyBuilderIntoInputs(economicInputs, builder);
        onEconomicInputsChange(mergedInputs);
      }
    },
    [economicInputs, onEconomicInputsChange, onPersistEconomyBuilder]
  );

  // Government Revenue Integration Effect (fixed to prevent re-trigger loop)
  useEffect(() => {
    if (
      !governmentBuilderData?.revenueSources ||
      governmentBuilderData.revenueSources.length === 0
    ) {
      return;
    }

    // Check if we've already processed these exact revenue sources
    const revenueSourcesKey = JSON.stringify(governmentBuilderData.revenueSources);
    if (revenueSourcesKey === lastProcessedRevenueSourcesRef.current) {
      return; // Skip if already processed
    }
    lastProcessedRevenueSourcesRef.current = revenueSourcesKey;

    const revenueSources = governmentBuilderData.revenueSources as RevenueSource[];

    // Calculate total government revenue from revenue sources
    const totalRevenue = revenueSources.reduce(
      (sum, source) => sum + (source.revenueAmount || 0),
      0
    );

    // Separate tax revenue from non-tax revenue
    const taxRevenue = revenueSources
      .filter((source) => source.category === "Direct Tax" || source.category === "Indirect Tax")
      .reduce((sum, source) => sum + (source.revenueAmount || 0), 0);

    const nonTaxRevenue = revenueSources
      .filter((source) => source.category !== "Direct Tax" && source.category !== "Indirect Tax")
      .reduce((sum, source) => sum + (source.revenueAmount || 0), 0);

    // Get GDP from economic inputs (use ref for current values)
    const currentEconomicInputs = economicInputsRef.current;
    const currentEconomyBuilder = economyBuilderRef.current;
    const gdp = currentEconomicInputs.coreIndicators?.nominalGDP || currentEconomyBuilder.structure.totalGDP || 1;

    // Calculate metrics
    const taxBurdenRatio = gdp > 0 ? (taxRevenue / gdp) * 100 : 0;
    const revenueToGDPRatio = gdp > 0 ? (totalRevenue / gdp) * 100 : 0;

    // Determine government size based on revenue-to-GDP ratio
    let governmentSizeIndicator: "Small" | "Medium" | "Large" = "Medium";
    if (revenueToGDPRatio < 25) {
      governmentSizeIndicator = "Small";
    } else if (revenueToGDPRatio > 40) {
      governmentSizeIndicator = "Large";
    }

    // Update revenue integration state
    setRevenueIntegration({
      totalRevenue,
      taxRevenue,
      nonTaxRevenue,
      taxBurdenRatio,
      revenueToGDPRatio,
      governmentSizeIndicator,
    });

    const adjustedBuilder = applyGovernmentRevenueAdjustments(currentEconomyBuilder, {
      taxBurdenRatio,
      revenueToGDPRatio,
      gdp,
    });

    if (adjustedBuilder !== currentEconomyBuilder) {
      handleEconomyBuilderChange(adjustedBuilder);
    }

    console.log("[EconomyBuilder] Government revenue integration applied:", {
      totalRevenue,
      taxRevenue,
      nonTaxRevenue,
      taxBurdenRatio: `${taxBurdenRatio.toFixed(1)}%`,
      revenueToGDPRatio: `${revenueToGDPRatio.toFixed(1)}%`,
      governmentSizeIndicator,
    });
  }, [governmentBuilderData?.revenueSources, handleEconomyBuilderChange]);

  // tRPC mutations for comprehensive economy builder management
  const saveEconomyMutation = api.economics.saveEconomyBuilderState.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
      notify.success("Economy configuration saved successfully!");
    },
    onError: (error: any) => {
      notify.error(error.message || "Failed to save economy configuration");
    },
  });

  // NOTE: syncGovernmentMutation and syncTaxMutation are now provided by useEconomyBuilderSync hook

  // Load existing economy builder state with standardized staleTime
  const { data: existingConfiguration, isLoading: isLoadingConfig } =
    api.economics.getEconomyBuilderState.useQuery(
      { countryId: countryId! },
      {
        enabled: !!countryId,
        staleTime: STALE_TIME.STANDARD,
      }
    );

  // Handle existing configuration when data loads
  React.useEffect(() => {
    if (existingConfiguration) {
      const existingLaborMarket = (existingConfiguration.laborMarket ?? {}) as Partial<
        EconomyBuilderState["laborMarket"]
      >;
      const mergedBuilder: EconomyBuilderState = {
        ...economyBuilder,
        structure: {
          ...economyBuilder.structure,
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
          ...economyBuilder.sectors,
          ...existingConfiguration.sectors,
        },
        laborMarket: {
          ...economyBuilder.laborMarket,
          ...existingLaborMarket,
          averageAnnualIncome:
            existingLaborMarket.averageAnnualIncome ??
            economyBuilder.laborMarket.averageAnnualIncome ??
            Math.round((economicInputs.coreIndicators?.gdpPerCapita || 0) * 0.8),
        },
        demographics: {
          ...economyBuilder.demographics,
          ...existingConfiguration.demographics,
        },
        version: existingConfiguration.version ?? economyBuilder.version,
        isValid: true,
        errors: {},
      };

      handleEconomyBuilderChange(mergedBuilder);
      setSelectedComponents(existingConfiguration.selectedAtomicComponents || []);
      setLastSaved(existingConfiguration.lastUpdated || null);
    }
  }, [existingConfiguration]);

  // Save Handler - Memoized with tRPC
  const handleSave = useCallback(async () => {
    if (!countryId) {
      notify.error("No country selected. Please select a country first.");
      return;
    }

    setIsSaving(true);
    try {
      // Validate before saving
      const validation = validateEconomyConfiguration();
      if (!validation.isValid) {
        notify.error(`Validation failed: ${validation.errors.join(", ")}`);
        setIsSaving(false);
        return;
      }

      // Prepare configuration for save
      const configuration = {
        structure: economyBuilder.structure,
        sectors: economyBuilder.sectors,
        laborMarket: economyBuilder.laborMarket,
        demographics: economyBuilder.demographics,
        selectedAtomicComponents: selectedComponents,
        lastUpdated: new Date(),
        version: economyBuilder.version || "1.0.0",
      };

      // Use tRPC mutation
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

      // Update integration service state
      economyIntegrationService.updateEconomyBuilder(economyBuilder);
      economyIntegrationService.updateEconomicComponents(selectedComponents);
    } catch (error) {
      console.error("Error saving economy configuration:", error);
      // Error toast handled by mutation onError
    } finally {
      setIsSaving(false);
    }
  }, [countryId, economyBuilder, selectedComponents, saveEconomyMutation]);

  // Validation helper
  const validateEconomyConfiguration = useCallback(() => {
    const errors: string[] = [];

    // Check sector contributions sum to 100%
    const sectorSum = economyBuilder.sectors.reduce(
      (sum, sector) => sum + sector.gdpContribution,
      0
    );
    if (Math.abs(sectorSum - 100) > 1) {
      errors.push(`Sector GDP contributions must sum to 100% (currently ${sectorSum.toFixed(1)}%)`);
    }

    // Check employment shares sum to 100%
    const employmentSum = economyBuilder.sectors.reduce(
      (sum, sector) => sum + sector.employmentShare,
      0
    );
    if (Math.abs(employmentSum - 100) > 1) {
      errors.push(`Employment shares must sum to 100% (currently ${employmentSum.toFixed(1)}%)`);
    }

    // Check labor force makes sense
    if (economyBuilder.laborMarket.laborForceParticipationRate > 90) {
      errors.push("Labor force participation rate seems too high (>90%)");
    }

    if (
      economyBuilder.laborMarket.unemploymentRate < 0 ||
      economyBuilder.laborMarket.unemploymentRate > 50
    ) {
      errors.push("Unemployment rate seems unrealistic");
    }

    // Check demographics
    const ageSum =
      (economyBuilder.demographics.ageDistribution?.under15 || 0) +
      (economyBuilder.demographics.ageDistribution?.age15to64 || 0) +
      (economyBuilder.demographics.ageDistribution?.over65 || 0);
    if (Math.abs(ageSum - 100) > 1) {
      errors.push(`Age distribution must sum to 100% (currently ${ageSum}%)`);
    }

    return { isValid: errors.length === 0, errors };
  }, [economyBuilder]);

  // NOTE: Cross-builder synchronization effects (government, tax) and sync status tracking
  // have been moved to useEconomyBuilderSync hook (Phase 2 optimization)
  // The syncStatus, syncGovernmentMutation, and syncTaxMutation are now provided by the hook

  // Extended sync status that includes saveEconomyMutation
  // TODO: Wire this to UI sync indicator when implementing sync status display
  const _extendedSyncStatus = useMemo(() => ({
    isSyncing: syncStatus.isSyncing || saveEconomyMutation.isPending,
    lastSync: syncStatus.lastSync,
    syncError: syncStatus.syncError,
  }), [syncStatus, saveEconomyMutation.isPending]);

  // Validation Status - Memoized
  const validationStatus = useMemo(() => {
    const errors = economyBuilder.validation?.errors || [];
    const warnings = economyBuilder.validation?.warnings || [];

    return {
      isValid: economyBuilder.isValid && errors.length === 0,
      hasWarnings: warnings.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length,
    };
  }, [economyBuilder.isValid, economyBuilder.validation]);

  // Use prop economicHealthMetrics or create fallback
  const healthMetrics: EconomicHealthMetrics = useMemo(() => {
    if (economicHealthMetrics) return economicHealthMetrics;

    return {
      // Overall Health
      economicHealthScore: 75,
      sustainabilityScore: 70,
      resilienceScore: 72,
      competitivenessScore: 78,

      // Growth Indicators
      gdpGrowthRate: 3.2,
      potentialGrowthRate: 3.5,
      growthSustainability: 68,

      // Stability Indicators
      inflationRate: 2.1,
      inflationVolatility: 0.8,
      exchangeRateStability: 82,
      fiscalStability: 75,

      // Labor Market Indicators
      unemploymentRate: economyBuilder.laborMarket?.unemploymentRate ?? 5.0,

      // Innovation Indicators
      innovationIndex: 65 + (selectedComponents?.length ?? 0) * 2,
      productivityIndex: 70 + (selectedComponents?.length ?? 0) * 1.5,

      // Risk Assessment
      economicRiskLevel: "Medium" as const,
      externalVulnerability: 25,
      domesticVulnerability: 35,
      systemicRisk: 30,
    };
  }, [economicHealthMetrics, economyBuilder.laborMarket, selectedComponents]);

  // Steps Configuration - Following GovernmentBuilder pattern
  const steps = [
    { id: "components", label: "Atomic Components", icon: Zap },
    { id: "sectors", label: "Economic Sectors", icon: Factory },
    { id: "labor", label: "Labor & Employment", icon: Users },
    { id: "demographics", label: "Demographics", icon: Globe },
    { id: "taxes", label: "Tax System", icon: DollarSign },
    { id: "preview", label: "Preview", icon: Eye },
  ] as const;

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Header */}
        <EconomyBuilderHeader
          isLoadingConfig={isLoadingConfig}
          isAutoSaveEnabled={!!countryId}
          hasUnsavedChanges={autoSyncState.pendingChanges}
          lastSaved={lastSaved}
          showSuccessAnimation={showSuccessAnimation}
          validationStatus={validationStatus}
          onPresetsClick={() => setIsPresetsOpen(true)}
        />

        {/* Progress Steps */}
        <StepNavigation
          steps={steps}
          currentStep={currentStep}
          onStepChange={(stepId) => setCurrentStep(stepId as any)}
        />

        {/* Validation Errors - Matching GovernmentBuilder pattern */}
        {!validationStatus.isValid && economyBuilder.validation?.errors && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please fix the following issues:
              <ul className="mt-2 list-inside list-disc space-y-1">
                {economyBuilder.validation.errors.map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Step Content - Matching GovernmentBuilder pattern */}
        <AnimatePresence mode="wait">
          {currentStep === "components" && (
            <motion.div
              key="components"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-foreground text-2xl font-semibold">
                  Economic Atomic Components
                </h2>
                <Badge variant="outline">{selectedComponents.length} / 12 selected</Badge>
              </div>

              {/* Government Revenue Integration Card */}
              {revenueIntegration.totalRevenue > 0 && (
                <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="text-amber-500 h-5 w-5" />
                      Government Revenue Integration
                    </CardTitle>
                    <CardDescription>
                      Economic indicators informed by government revenue sources
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Total Government Revenue */}
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-sm">
                          Total Government Revenue
                        </Label>
                        <div className="text-foreground text-2xl font-bold">
                          {formatCurrency(
                            revenueIntegration.totalRevenue,
                            economicInputs.nationalIdentity?.currency || "USD"
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              revenueIntegration.governmentSizeIndicator === "Large" &&
                                "border-blue-500/50 text-blue-500",
                              revenueIntegration.governmentSizeIndicator === "Medium" &&
                                "border-amber-500/50 text-amber-500",
                              revenueIntegration.governmentSizeIndicator === "Small" &&
                                "border-emerald-500/50 text-emerald-500"
                            )}
                          >
                            {revenueIntegration.governmentSizeIndicator} Government
                          </Badge>
                        </div>
                      </div>

                      {/* Tax Revenue Share */}
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-sm">
                          Tax Revenue Breakdown
                        </Label>
                        <div className="space-y-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Tax Revenue</span>
                              <span className="font-semibold">
                                {formatCurrency(
                                  revenueIntegration.taxRevenue,
                                  economicInputs.nationalIdentity?.currency || "USD"
                                )}
                              </span>
                            </div>
                            <Progress
                              value={
                                revenueIntegration.totalRevenue > 0
                                  ? (revenueIntegration.taxRevenue /
                                      revenueIntegration.totalRevenue) *
                                    100
                                  : 0
                              }
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Non-Tax Revenue</span>
                              <span className="font-semibold">
                                {formatCurrency(
                                  revenueIntegration.nonTaxRevenue,
                                  economicInputs.nationalIdentity?.currency || "USD"
                                )}
                              </span>
                            </div>
                            <Progress
                              value={
                                revenueIntegration.totalRevenue > 0
                                  ? (revenueIntegration.nonTaxRevenue /
                                      revenueIntegration.totalRevenue) *
                                    100
                                  : 0
                              }
                              className="bg-muted h-2 [&>div]:bg-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Revenue Ratios */}
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-sm">
                          Economic Impact Metrics
                        </Label>
                        <div className="space-y-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-muted-foreground text-sm">
                                Revenue as % of GDP
                              </span>
                              <Badge variant="outline" className="text-sm font-semibold">
                                {formatPercent(revenueIntegration.revenueToGDPRatio, 1)}
                              </Badge>
                            </div>
                            <Progress
                              value={Math.min(revenueIntegration.revenueToGDPRatio, 100)}
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-muted-foreground text-sm">
                                Tax Burden Ratio
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-sm font-semibold",
                                  revenueIntegration.taxBurdenRatio > 35 &&
                                    "border-red-500/50 text-red-500",
                                  revenueIntegration.taxBurdenRatio >= 20 &&
                                    revenueIntegration.taxBurdenRatio <= 35 &&
                                    "border-amber-500/50 text-amber-500",
                                  revenueIntegration.taxBurdenRatio < 20 &&
                                    "border-emerald-500/50 text-emerald-500"
                                )}
                              >
                                {formatPercent(revenueIntegration.taxBurdenRatio, 1)}
                              </Badge>
                            </div>
                            <Progress
                              value={Math.min(revenueIntegration.taxBurdenRatio, 100)}
                              className={cn(
                                "h-2",
                                revenueIntegration.taxBurdenRatio > 35 && "[&>div]:bg-red-500",
                                revenueIntegration.taxBurdenRatio >= 20 &&
                                  revenueIntegration.taxBurdenRatio <= 35 &&
                                  "[&>div]:bg-amber-500",
                                revenueIntegration.taxBurdenRatio < 20 && "[&>div]:bg-green-500"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Info Alert */}
                    {revenueIntegration.taxBurdenRatio > 35 && (
                      <Alert className="mt-4 border-amber-500/30 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <Info className="h-4 w-4 text-amber-500" />
                        <AlertDescription className="text-sm text-amber-700 dark:text-amber-200">
                          High tax burden ({formatPercent(revenueIntegration.taxBurdenRatio, 1)})
                          may reduce private sector GDP growth. Consider balancing with economic
                          components that promote business development.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              <AtomicEconomicComponentSelector
                selectedComponents={selectedComponents}
                onComponentChange={handleComponentChange}
                maxComponents={12}
                governmentComponents={governmentComponents?.map((c) => c.type || c.id) || []}
              />
            </motion.div>
          )}

          {currentStep === "sectors" && (
            <motion.div
              key="sectors"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-foreground text-2xl font-semibold">Economic Sectors</h2>
              </div>
              <Suspense fallback={<TabLoadingFallback />}>
                <EconomySectorsTab
                  economyBuilder={economyBuilder}
                  onEconomyBuilderChange={handleEconomyBuilderChange}
                  selectedComponents={selectedComponents}
                  showAdvanced={showAdvanced}
                />
              </Suspense>
            </motion.div>
          )}

          {currentStep === "labor" && (
            <motion.div
              key="labor"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-foreground text-2xl font-semibold">Labor & Employment</h2>
              </div>
              <Suspense fallback={<TabLoadingFallback />}>
                <LaborEmploymentTab
                  economyBuilder={economyBuilder}
                  onEconomyBuilderChange={handleEconomyBuilderChange}
                  selectedComponents={selectedComponents}
                />
              </Suspense>
            </motion.div>
          )}

          {currentStep === "demographics" && (
            <motion.div
              key="demographics"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-foreground text-2xl font-semibold">Demographics & Population</h2>
              </div>
              <Suspense fallback={<TabLoadingFallback />}>
                <DemographicsPopulationTab
                  economyBuilder={economyBuilder}
                  onEconomyBuilderChange={handleEconomyBuilderChange}
                  selectedComponents={selectedComponents}
                  showAdvanced={showAdvanced}
                />
              </Suspense>
            </motion.div>
          )}

          {currentStep === "taxes" && (
            <motion.div
              key="taxes"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
            <TaxSystemStep
              countryId={countryId ?? null}
              activeTaxSystemData={activeTaxSystemData}
              economicInputs={economicInputs}
              economyBuilder={economyBuilder}
              selectedComponents={selectedComponents}
              governmentBuilderData={governmentBuilderData}
              onDraftChange={(taxSystem) => {
                onPersistTaxSystem?.(taxSystem);
              }}
              onUpdate={async (taxSystem) => {
                await updateTaxSystemMutation.mutateAsync({
                  countryId: countryId!,
                  data: taxSystem,
                  skipConflictCheck: false,
                });
              }}
              onCreate={async (taxSystem) => {
                await createTaxSystemMutation.mutateAsync({
                  countryId: countryId!,
                  data: taxSystem,
                  skipConflictCheck: false,
                });
              }}
              onRefetch={async () => {
                await refetchTaxSystem();
              }}
            />
            </motion.div>
          )}

          {currentStep === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <PreviewStep
                economyBuilder={economyBuilder}
                economicInputs={economicInputs}
                selectedComponents={selectedComponents}
                economicHealthMetrics={healthMetrics}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <NavigationButtons
          currentStepIndex={currentStepIndex}
          totalSteps={steps.length}
          validationStatus={{
            isValid: validationStatus?.isValid ?? true,
            errorCount: validationStatus?.errorCount ?? 0,
          }}
          isSaving={saveEconomyMutation.isPending}
          countryId={countryId}
          onPrevious={() => {
            const prevIndex = Math.max(0, currentStepIndex - 1);
            setCurrentStep(steps[prevIndex].id as any);
          }}
          onNext={() => {
            const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
            setCurrentStep(steps[nextIndex].id as any);
          }}
          onSave={handleSave}
        />
      </div>

      {/* Presets Modal (Economic Archetypes) */}
      <EconomicArchetypeModal
        open={isPresetsOpen}
        onOpenChange={setIsPresetsOpen}
        currentState={economyBuilder}
        onArchetypeApplied={(newState) => {
          // Apply the archetype state to the economy builder
          console.log("[EconomyBuilder] Archetype applied:", newState);
          const nextState: EconomyBuilderState = {
            ...economyBuilder,
            ...newState,
            version: economyBuilder.version,
            lastUpdated: new Date(),
            isValid: true,
            errors: {},
          };

          handleEconomyBuilderChange(nextState);
          notify.success("Economic archetype applied successfully!");
        }}
      />
    </div>
  );
}

function mergeEconomyBuilderIntoInputs(
  baseInputs: EconomicInputs,
  builder: EconomyBuilderState
): EconomicInputs {
  const safeBase: EconomicInputs = {
    ...baseInputs,
    coreIndicators: { ...baseInputs.coreIndicators },
    laborEmployment: { ...baseInputs.laborEmployment },
    demographics: {
      ...baseInputs.demographics,
      ageDistribution: baseInputs.demographics?.ageDistribution
        ? baseInputs.demographics.ageDistribution.map((group) => ({ ...group }))
        : [],
      regions: baseInputs.demographics?.regions
        ? baseInputs.demographics.regions.map((region) => ({ ...region }))
        : [],
      educationLevels: baseInputs.demographics?.educationLevels
        ? baseInputs.demographics.educationLevels.map((level) => ({ ...level }))
        : [],
      citizenshipStatuses: baseInputs.demographics?.citizenshipStatuses
        ? baseInputs.demographics.citizenshipStatuses.map((status) => ({ ...status }))
        : [],
    },
  };

  const totalPopulation =
    builder.demographics.totalPopulation || safeBase.coreIndicators.totalPopulation;
  const totalGDP = builder.structure.totalGDP || safeBase.coreIndicators.nominalGDP;
  const inferredGdpPerCapita =
    totalPopulation > 0 && totalGDP > 0
      ? totalGDP / totalPopulation
      : safeBase.coreIndicators.gdpPerCapita;

  safeBase.coreIndicators = {
    ...safeBase.coreIndicators,
    totalPopulation,
    nominalGDP: totalGDP,
    gdpPerCapita: inferredGdpPerCapita,
  };

  const workerProtectionValues = builder.laborMarket.workerProtections
    ? Object.values(builder.laborMarket.workerProtections)
    : [];
  const averageProtectionScore =
    workerProtectionValues.length > 0
      ? workerProtectionValues.reduce((sum, value) => sum + value, 0) /
        workerProtectionValues.length
      : undefined;

  safeBase.laborEmployment = {
    ...safeBase.laborEmployment,
    laborForceParticipationRate: builder.laborMarket.laborForceParticipationRate,
    employmentRate: builder.laborMarket.employmentRate,
    unemploymentRate: builder.laborMarket.unemploymentRate,
    totalWorkforce: builder.laborMarket.totalWorkforce,
    averageWorkweekHours: builder.laborMarket.averageWorkweekHours,
    minimumWage: builder.laborMarket.minimumWageHourly,
    averageAnnualIncome:
      typeof builder.laborMarket.averageAnnualIncome === "number"
        ? builder.laborMarket.averageAnnualIncome
        : safeBase.laborEmployment.averageAnnualIncome,
    laborProtections:
      averageProtectionScore !== undefined
        ? averageProtectionScore >= 60
        : safeBase.laborEmployment.laborProtections,
  };

  const ageDistribution = [
    {
      group: "0-14",
      percent: builder.demographics.ageDistribution.under15,
      color: safeBase.demographics.ageDistribution?.[0]?.color || "#60a5fa",
    },
    {
      group: "15-64",
      percent: builder.demographics.ageDistribution.age15to64,
      color: safeBase.demographics.ageDistribution?.[1]?.color || "#34d399",
    },
    {
      group: "65+",
      percent: builder.demographics.ageDistribution.over65,
      color: safeBase.demographics.ageDistribution?.[2]?.color || "#f97316",
    },
  ];

  const educationLevels = builder.demographics.educationLevels
    ? [
        {
          level: "No Formal Education",
          percent: builder.demographics.educationLevels.noEducation,
          color: safeBase.demographics.educationLevels?.[0]?.color || "#ef4444",
        },
        {
          level: "Primary Education",
          percent: builder.demographics.educationLevels.primary,
          color: safeBase.demographics.educationLevels?.[1]?.color || "#f59e0b",
        },
        {
          level: "Secondary Education",
          percent: builder.demographics.educationLevels.secondary,
          color: safeBase.demographics.educationLevels?.[2]?.color || "#22c55e",
        },
        {
          level: "Tertiary Education",
          percent: builder.demographics.educationLevels.tertiary,
          color: safeBase.demographics.educationLevels?.[3]?.color || "#3b82f6",
        },
      ]
    : safeBase.demographics.educationLevels;

  const regions = builder.demographics.regions?.length
    ? builder.demographics.regions.map((region, index) => ({
        name: region.name,
        population:
          region.population ||
          Math.round((totalPopulation * (region.populationPercent ?? 0)) / 100),
        urbanPercent: region.urbanPercent,
        color: safeBase.demographics.regions?.[index]?.color || getRegionColor(index),
      }))
    : safeBase.demographics.regions;

  safeBase.demographics = {
    ...safeBase.demographics,
    ageDistribution,
    regions,
    educationLevels,
    lifeExpectancy: builder.demographics.lifeExpectancy,
    literacyRate: builder.demographics.literacyRate,
    urbanRuralSplit: {
      urban: builder.demographics.urbanRuralSplit.urban,
      rural: builder.demographics.urbanRuralSplit.rural,
    },
    populationGrowthRate: builder.demographics.populationGrowthRate,
  };

  return safeBase;
}

interface RevenueAdjustmentContext {
  taxBurdenRatio: number;
  revenueToGDPRatio: number;
  gdp: number;
}

function applyGovernmentRevenueAdjustments(
  builder: EconomyBuilderState,
  { taxBurdenRatio, revenueToGDPRatio, gdp }: RevenueAdjustmentContext
): EconomyBuilderState {
  let laborMarket = builder.laborMarket;
  let structure = builder.structure;
  let changed = false;

  if (laborMarket?.sectorDistribution) {
    const currentGovernmentShare = laborMarket.sectorDistribution.government ?? 8;

    if (taxBurdenRatio > 35) {
      const desiredShare = Math.min(currentGovernmentShare + 2, 15);
      if (desiredShare !== currentGovernmentShare) {
        laborMarket = {
          ...laborMarket,
          sectorDistribution: {
            ...laborMarket.sectorDistribution,
            government: desiredShare,
          },
        };
        changed = true;
      }
    } else if (taxBurdenRatio < 20) {
      const desiredShare = Math.max(currentGovernmentShare - 1, 5);
      if (desiredShare !== currentGovernmentShare) {
        laborMarket = {
          ...laborMarket,
          sectorDistribution: {
            ...laborMarket.sectorDistribution,
            government: desiredShare,
          },
        };
        changed = true;
      }
    }
  }

  if (revenueToGDPRatio > 35 && gdp > 1_000_000_000_000 && structure.economicTier !== "Advanced") {
    structure = {
      ...structure,
      economicTier: "Advanced",
    };
    changed = true;
  }

  if (!changed) {
    return builder;
  }

  return {
    ...builder,
    laborMarket,
    structure,
    lastUpdated: new Date(),
  };
}
