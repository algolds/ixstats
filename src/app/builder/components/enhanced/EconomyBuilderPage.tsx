"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

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
  Zap,
  BarChart3,
  Globe,
  DollarSign,
  Gauge,
  Eye,
  Loader2,
  Shield,
  HelpCircle,
  Landmark,
  Receipt,
} from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { isEqual } from "lodash";

// Economy Builder Components
import { AtomicEconomicComponentSelector } from "~/components/economy/atoms/AtomicEconomicComponents";
import { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import { EconomicWelcomeModal } from "~/components/economy/atomic";
import { Checkbox } from "~/components/ui/checkbox";

// Types and Services
import type { EconomyBuilderState, EconomicHealthMetrics } from "~/types/economy-builder";
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
import { PreviewStep } from "./steps/PreviewStep";
import { useTaxBuilderState } from "~/hooks/useTaxBuilderState";
import { useTaxBuilderAutoSync } from "~/hooks/useBuilderAutoSync";
import { AtomicComponentsStep } from "~/components/tax-system/tax-builder/steps/AtomicComponentsStep";
import { ExemptionsDeductionsStep } from "~/components/tax-system/tax-builder/steps/ExemptionsDeductionsStep";
import { CalculatorPreviewStep } from "~/components/tax-system/tax-builder/steps/CalculatorPreviewStep";
import { taxSystemTemplates } from "~/components/tax-system/TaxSystemTemplates";
import { GlassCard, GlassCardContent } from "../glass/GlassCard";
import { Sparkles, Coins, Calculator } from "lucide-react";
import { getTaxOptimization, type TaxOptimization } from "./tabs/utils/sectorCalculations";

// Tab Card Primitive
import { BuilderTabCard, type TabDefinition } from "../../primitives/BuilderTabCard";

// Cross-Builder Integration Components
import { EconomicArchetypeModal } from "./EconomicArchetypeModal";
import { EconomyBuilderHeader } from "./economy-builder/components/EconomyBuilderHeader";

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
  activeTab?: string;
  onTabChange?: (tab: string) => void;
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
  activeTab,
  onTabChange,
}: EconomyBuilderPageProps) {
  const notify = useNotify();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
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

  // Resolve current tab with backward compatibility for legacy tab values
  const currentTab = useMemo(() => {
    const raw = activeTab || "components";
    if (["components", "sectors", "labor", "demographics", "fiscal", "tax", "preview"].includes(raw)) {
      return raw;
    }
    // Legacy mapping: old tab names → new tab names
    const legacyMap: Record<string, string> = {
      structure: "sectors",
      taxes: "tax",
      calculator: "tax",
      exemptions: "tax",
    };
    return legacyMap[raw] || "components";
  }, [activeTab]);


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
  const {
    syncState: autoSyncState,
    syncNow,
    showSuccessAnimation,
  } = useEconomyBuilderAutoSync(countryId, economyDataForSync, {
    enabled: !!countryId, // Only enable in edit mode
    onSyncSuccess: () => {
      console.log("[EconomyBuilder] Autosave successful");
      setLastSaved(new Date());
    },
    onSyncError: (error) => {
      console.error("[EconomyBuilder] Autosave failed:", error);
      notify.error("Failed to autosave economy data");
    },
  });

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
    return;
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

  const [selectedAtomicTaxComponents, setSelectedAtomicTaxComponents] = useState<string[]>([]);

  // State management hook
  const taxBuilder = useTaxBuilderState({
    initialData: activeTaxSystemData || undefined,
    countryId: countryId || undefined,
  });

  // Sync loaded tax system data into taxBuilder state when it arrives
  const hasInitializedTaxDataRef = useRef(false);
  useEffect(() => {
    if (activeTaxSystemData && !hasInitializedTaxDataRef.current) {
      taxBuilder.setBuilderState({
        taxSystem: {
          taxSystemName: activeTaxSystemData.taxSystem?.taxSystemName || "",
          fiscalYear: activeTaxSystemData.taxSystem?.fiscalYear || "calendar",
          progressiveTax: activeTaxSystemData.taxSystem?.progressiveTax ?? true,
          alternativeMinTax: activeTaxSystemData.taxSystem?.alternativeMinTax ?? false,
          complianceRate: activeTaxSystemData.taxSystem?.complianceRate ?? 85,
          collectionEfficiency: activeTaxSystemData.taxSystem?.collectionEfficiency ?? 90,
        },
        categories: activeTaxSystemData.categories || [],
        brackets: activeTaxSystemData.brackets || {},
        exemptions: activeTaxSystemData.exemptions || [],
        deductions: activeTaxSystemData.deductions || {},
        isValid: activeTaxSystemData.isValid ?? false,
        errors: activeTaxSystemData.errors || {},
      });
      hasInitializedTaxDataRef.current = true;
    }
  }, [activeTaxSystemData]);

  // Auto-sync hook
  const {
    builderState: autoSyncTaxState,
    setBuilderState: setAutoSyncTaxState,
    syncState: taxSyncState,
    triggerSync: triggerTaxSync,
    clearConflicts: _clearTaxConflicts,
  } = useTaxBuilderAutoSync(countryId || undefined, taxBuilder.builderState, {
    enabled: !!countryId,
    showConflictWarnings: true,
    onSyncSuccess: () => {
      console.log("[EconomyBuilder] Tax autosave successful");
      setLastSaved(new Date());
    },
    onSyncError: (error) => {
      console.error("[EconomyBuilder] Tax autosave failed:", error);
      notify.error("Failed to autosave tax system");
    },
  });

  // Use auto-sync state if enabled, otherwise use local state
  const activeTaxBuilderState = countryId ? autoSyncTaxState : taxBuilder.builderState;
  const setActiveTaxBuilderState = useCallback(
    (update: React.SetStateAction<TaxBuilderState>) => {
      if (countryId) {
        setAutoSyncTaxState(update);
      } else {
        taxBuilder.setBuilderState(update);
      }
    },
    [countryId, setAutoSyncTaxState, taxBuilder.setBuilderState]
  );

  // Sync tax changes back to parent
  const lastPersistedTaxSystemRef = useRef<TaxBuilderState | null>(null);
  useEffect(() => {
    if (activeTaxBuilderState && onPersistTaxSystem) {
      if (!isEqual(activeTaxBuilderState, lastPersistedTaxSystemRef.current)) {
        lastPersistedTaxSystemRef.current = activeTaxBuilderState;
        onPersistTaxSystem(activeTaxBuilderState);
      }
    }
  }, [activeTaxBuilderState, onPersistTaxSystem]);

  // Register tax autosync with BuilderContext
  useEffect(() => {
    if (builderContext && countryId && triggerTaxSync) {
      builderContext.registerAutoSync("taxSystem", triggerTaxSync);
    }
    return () => {
      if (builderContext) {
        builderContext.unregisterAutoSync("taxSystem");
      }
    };
  }, [countryId, triggerTaxSync, builderContext]);

  // Preview data transformations
  const previewTaxSystem = useMemo(
    () => ({
      id: "builder-preview",
      countryId: countryId || "preview",
      ...activeTaxBuilderState.taxSystem,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    [activeTaxBuilderState.taxSystem, countryId]
  );

  const previewCategories = useMemo(
    () =>
      activeTaxBuilderState.categories.map((cat, index) => ({
        id: `category-${index}`,
        taxSystemId: "builder-preview",
        ...cat,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    [activeTaxBuilderState.categories]
  );

  const previewBrackets = useMemo(() => {
    const brackets: any[] = [];
    Object.entries(activeTaxBuilderState.brackets).forEach(([categoryIndex, categoryBrackets]) => {
      categoryBrackets.forEach((bracket, bracketIndex) => {
        brackets.push({
          id: `bracket-${categoryIndex}-${bracketIndex}`,
          taxSystemId: "builder-preview",
          categoryId: `category-${categoryIndex}`,
          ...bracket,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });
    return brackets;
  }, [activeTaxBuilderState.brackets]);

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
      // Update refs synchronously to prevent pub/sub loop triggers
      economyBuilderRef.current = builder;

      setEconomyBuilder(builder);
      economyIntegrationService.updateEconomyBuilder(builder);
      onPersistEconomyBuilder?.(builder);

      if (economicInputs) {
        const mergedInputs = mergeEconomyBuilderIntoInputs(economicInputs, builder);
        economicInputsRef.current = mergedInputs;
        onEconomicInputsChange(mergedInputs);
      }
    },
    [
      economicInputs,
      onEconomicInputsChange,
      onPersistEconomyBuilder,
      economyBuilderRef,
      economicInputsRef,
    ]
  );

  // Track handler in a ref to avoid infinite loops in government sync effects
  const handleEconomyBuilderChangeRef = useRef(handleEconomyBuilderChange);
  useEffect(() => {
    handleEconomyBuilderChangeRef.current = handleEconomyBuilderChange;
  }, [handleEconomyBuilderChange]);

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
    const gdp =
      currentEconomicInputs.coreIndicators?.nominalGDP ||
      currentEconomyBuilder.structure.totalGDP ||
      1;

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

    // Update revenue integration state using functional state update to prevent redundant loops
    setRevenueIntegration((prev) => {
      if (
        prev.totalRevenue === totalRevenue &&
        prev.taxRevenue === taxRevenue &&
        prev.nonTaxRevenue === nonTaxRevenue &&
        prev.taxBurdenRatio === taxBurdenRatio &&
        prev.revenueToGDPRatio === revenueToGDPRatio &&
        prev.governmentSizeIndicator === governmentSizeIndicator
      ) {
        return prev;
      }
      return {
        totalRevenue,
        taxRevenue,
        nonTaxRevenue,
        taxBurdenRatio,
        revenueToGDPRatio,
        governmentSizeIndicator,
      };
    });

    const adjustedBuilder = applyGovernmentRevenueAdjustments(currentEconomyBuilder, {
      taxBurdenRatio,
      revenueToGDPRatio,
      gdp,
    });

    if (adjustedBuilder !== currentEconomyBuilder) {
      handleEconomyBuilderChangeRef.current(adjustedBuilder);
    }

    console.log("[EconomyBuilder] Government revenue integration applied:", {
      totalRevenue,
      taxRevenue,
      nonTaxRevenue,
      taxBurdenRatio: `${taxBurdenRatio.toFixed(1)}%`,
      revenueToGDPRatio: `${revenueToGDPRatio.toFixed(1)}%`,
      governmentSizeIndicator,
    });
  }, [governmentBuilderData?.revenueSources]);

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
  const _extendedSyncStatus = useMemo(
    () => ({
      isSyncing: syncStatus.isSyncing || saveEconomyMutation.isPending,
      lastSync: syncStatus.lastSync,
      syncError: syncStatus.syncError,
    }),
    [syncStatus, saveEconomyMutation.isPending]
  );

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

  const validation = useMemo(() => {
    return validateEconomyConfiguration();
  }, [validateEconomyConfiguration]);

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

  // Tab Definitions - Following GovernmentBuilder pattern with granular tabs
  const tabs: TabDefinition[] = [
    { id: "components", label: "Components", icon: Zap },
    { id: "sectors", label: "Sectors", icon: Factory },
    { id: "labor", label: "Labor", icon: Users },
    { id: "demographics", label: "Demographics", icon: Globe },
    { id: "fiscal", label: "Fiscal Policy", icon: Landmark },
    { id: "tax", label: "Tax System", icon: Receipt },
    { id: "preview", label: "Preview", icon: Eye },
  ];

  return (
    <div className={`mx-auto max-w-7xl space-y-6 pb-12 ${className}`}>
      <EconomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
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
          onHelpClick={() => setWelcomeOpen(true)}
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

        {/* Step Content - Tab navigation handled by BuilderNotchBar */}
        <BuilderTabCard
          tabs={tabs}
          activeTab={currentTab}
          onTabChange={(tabId) => onTabChange?.(tabId)}
          sectionTheme="economics"
          hideTabList
        >
          {currentTab === "components" && (
            <motion.div
              key="components"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Zap className="h-5 w-5 text-emerald-400" />
                    Economic Components
                    <button
                      onClick={() => setWelcomeOpen(true)}
                      className="cursor-pointer rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-emerald-400"
                      title="Open Help Guide"
                      type="button"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </h3>
                  <Badge variant="outline">{selectedComponents.length} / 12 selected</Badge>
                </div>
                <GlassCardContent className="space-y-6 p-6">
                  <AtomicEconomicComponentSelector
                    selectedComponents={selectedComponents}
                    onComponentChange={handleComponentChange}
                    maxComponents={12}
                    governmentComponents={governmentComponents?.map((c) => c.type || c.id) || []}
                    hideSelectedList={true}
                  />
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {currentTab === "sectors" && (
            <motion.div
              key="sectors"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Factory className="h-5 w-5 text-emerald-400" />
                    Economic Sectors
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <EconomySectorsTab
                      economyBuilder={economyBuilder}
                      onEconomyBuilderChange={handleEconomyBuilderChange}
                      selectedComponents={selectedComponents}
                      showAdvanced={showAdvanced}
                    />
                  </Suspense>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {currentTab === "labor" && (
            <motion.div
              key="labor"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Users className="h-5 w-5 text-emerald-400" />
                    Labor & Employment
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <LaborEmploymentTab
                      economyBuilder={economyBuilder}
                      onEconomyBuilderChange={handleEconomyBuilderChange}
                      selectedComponents={selectedComponents}
                    />
                  </Suspense>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {currentTab === "demographics" && (
            <motion.div
              key="demographics"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Globe className="h-5 w-5 text-emerald-400" />
                    Demographics & Population
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <DemographicsPopulationTab
                      economyBuilder={economyBuilder}
                      onEconomyBuilderChange={handleEconomyBuilderChange}
                      selectedComponents={selectedComponents}
                      showAdvanced={showAdvanced}
                    />
                  </Suspense>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {currentTab === "fiscal" && (
            <motion.div
              key="fiscal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Fiscal Policy Configuration */}
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Landmark className="h-5 w-5 text-emerald-400" />
                    Fiscal Policy Configuration
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  {/* Budget Stance */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Budget Stance</Label>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground text-xs">High Deficit</span>
                        <input
                          type="range"
                          min={-10}
                          max={10}
                          step={1}
                          defaultValue={0}
                          className="h-2 w-full max-w-md cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
                        />
                        <span className="text-muted-foreground text-xs">High Surplus</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Balanced budget target: deficit/surplus as % of GDP
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Fiscal Strategy</Label>
                      <select className="border-border/40 bg-background w-full max-w-xs rounded-lg border px-3 py-2 text-sm">
                        <option>Neutral</option>
                        <option>Austerity</option>
                        <option>Expansionary</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Debt-to-GDP Target</Label>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground text-xs">0%</span>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={5}
                          defaultValue={60}
                          className="h-2 w-full max-w-md cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
                        />
                        <span className="text-muted-foreground text-xs">200%</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Target debt-to-GDP ratio ceiling
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Reserve Fund (% of Budget)</Label>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground text-xs">0%</span>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          step={1}
                          defaultValue={5}
                          className="h-2 w-full max-w-md cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
                        />
                        <span className="text-muted-foreground text-xs">30%</span>
                      </div>
                    </div>
                  </div>
                </GlassCardContent>
              </GlassCard>

              {/* Government Revenue Integration Card */}
              {revenueIntegration.totalRevenue > 0 && (
                <GlassCard
                  depth="base"
                  theme="emerald"
                  className="border-emerald-500/20"
                  texture="chevron"
                  textureOpacity={0.04}
                >
                  <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                    <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                      <DollarSign className="h-5 w-5 text-emerald-400" />
                      Government Revenue Integration
                    </h3>
                  </div>
                  <GlassCardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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

                    {revenueIntegration.taxBurdenRatio > 35 && (
                      <Alert className="mt-4 border-amber-500/30 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <Info className="h-4 w-4 text-amber-500" />
                        <AlertDescription className="text-sm text-amber-700 dark:text-amber-200">
                          High tax burden ({formatPercent(revenueIntegration.taxBurdenRatio, 1)}
                          ) may reduce private sector GDP growth. Consider balancing with
                          economic components that promote business development.
                        </AlertDescription>
                      </Alert>
                    )}
                  </GlassCardContent>
                </GlassCard>
              )}

              {/* Fiscal Verification Checkpoint */}
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Shield className="h-5 w-5 text-emerald-400" />
                    Fiscal Verification
                  </h3>
                </div>
                <GlassCardContent className="space-y-4 p-6">
                  {revenueIntegration.revenueToGDPRatio > 40 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span>
                        Revenue-to-GDP ratio ({formatPercent(revenueIntegration.revenueToGDPRatio, 1)}
                        ) exceeds 40%. Consider adjusting fiscal policy.
                      </span>
                    </div>
                  )}
                  {revenueIntegration.revenueToGDPRatio <= 40 && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>Fiscal metrics within safe boundaries.</span>
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {currentTab === "tax" && (
            <motion.div
              key="tax"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Component Tax Optimization */}
              {(() => {
                const taxOpt = getTaxOptimization(selectedComponents);
                if (!taxOpt || taxOpt.componentCount === 0) return null;
                return (
                  <GlassCard
                    depth="base"
                    theme="emerald"
                    className="border-emerald-500/20"
                    texture="chevron"
                    textureOpacity={0.04}
                  >
                    <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                      <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                        Component Tax Optimization
                      </h3>
                    </div>
                    <GlassCardContent className="p-6">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                          <div className="text-muted-foreground text-xs">Recommended Corporate</div>
                          <div className="text-2xl font-bold text-emerald-400">
                            {taxOpt.optimalCorporateRate}%
                          </div>
                          <div className="text-muted-foreground text-xs">rate</div>
                        </div>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                          <div className="text-muted-foreground text-xs">Recommended Income</div>
                          <div className="text-2xl font-bold text-emerald-400">
                            {taxOpt.optimalIncomeRate}%
                          </div>
                          <div className="text-muted-foreground text-xs">rate</div>
                        </div>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                          <div className="text-muted-foreground text-xs">Revenue Efficiency</div>
                          <div className="text-2xl font-bold text-emerald-400">
                            {Math.round(taxOpt.revenueEfficiency * 100)}%
                          </div>
                          <div className="text-muted-foreground text-xs">
                            across {taxOpt.componentCount} components
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-600 dark:text-blue-400">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Optimal tax rates are derived from your selected atomic components. Setting
                          rates near these recommendations maximizes synergy effectiveness.
                        </span>
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                );
              })()}

              {/* Card 1: Fiscal Blueprint Templates */}
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20 bg-emerald-500/5"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    Tax Blueprint Templates
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <p className="text-muted-foreground mb-4 text-sm">
                    Select a pre-designed tax blueprint model to instantly configure your
                    nation's tax system. You can customize it further below.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {taxSystemTemplates.map((template) => (
                      <Button
                        key={template.name}
                        variant="outline"
                        className="hover:text-foreground flex h-auto flex-col items-start gap-1 border-zinc-800 bg-zinc-950/40 p-4 text-left hover:border-emerald-500/50 hover:bg-emerald-500/5"
                        onClick={() => {
                          taxBuilder.applyTemplate(template);
                          notify.success(`Applied ${template.name}`);
                        }}
                      >
                        <span className="text-sm font-bold">{template.name}</span>
                        <span className="text-muted-foreground line-clamp-2 text-xs">
                          {template.description}
                        </span>
                      </Button>
                    ))}
                  </div>
                </GlassCardContent>
              </GlassCard>

              {/* Card 2: Tax Rates & Brackets */}
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                    Tax Rates & Brackets
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <AtomicComponentsStep
                    taxSystem={activeTaxBuilderState.taxSystem}
                    onTaxSystemChange={(taxSystem) => {
                      setActiveTaxBuilderState((prev) => ({ ...prev, taxSystem }));
                    }}
                    selectedAtomicTaxComponents={selectedAtomicTaxComponents}
                    onAtomicComponentsChange={setSelectedAtomicTaxComponents}
                    activeGovernmentComponents={governmentComponents}
                    economicData={{
                      gdp: economicInputs.coreIndicators?.nominalGDP || 0,
                      sectors: economyBuilder.structure.sectors ?? economyBuilder.sectors,
                      population: economicInputs.coreIndicators?.totalPopulation || 1000000,
                    }}
                    validationErrors={activeTaxBuilderState.errors}
                    isReadOnly={false}
                    showAtomicIntegration={true}
                    countryId={countryId || undefined}
                    previewTaxSystem={previewTaxSystem}
                  />
                </GlassCardContent>
              </GlassCard>

              {/* Card 3: Tax Exemptions & Deductions */}
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Coins className="h-5 w-5 text-emerald-400" />
                    Tax Exemptions & Deductions
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <ExemptionsDeductionsStep isReadOnly={false} />
                </GlassCardContent>
              </GlassCard>

              {/* Card 4: Tax Revenue Calculator */}
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Calculator className="h-5 w-5 text-emerald-400" />
                    Tax Revenue Calculator
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <CalculatorPreviewStep
                    previewTaxSystem={previewTaxSystem}
                    previewCategories={previewCategories}
                    previewBrackets={previewBrackets}
                    onCalculationChange={() => {}}
                    economicData={{
                      gdp: economicInputs.coreIndicators?.nominalGDP || 0,
                      sectors: economyBuilder.structure.sectors ?? economyBuilder.sectors,
                      population: economicInputs.coreIndicators?.totalPopulation || 1000000,
                    }}
                    governmentData={governmentBuilderData}
                  />
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}

          {currentTab === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              {/* Preview content left 7 cols */}
              <div className="space-y-6 lg:col-span-7">
                <GlassCard
                  depth="base"
                  theme="emerald"
                  className="border-emerald-500/20"
                  texture="chevron"
                  textureOpacity={0.04}
                >
                  <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                    <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                      <Eye className="h-5 w-5 text-emerald-400" />
                      Economy Configuration Preview
                    </h3>
                  </div>
                  <GlassCardContent className="p-6">
                    <PreviewStep
                      economyBuilder={economyBuilder}
                      economicInputs={economicInputs}
                      selectedComponents={selectedComponents}
                      economicHealthMetrics={healthMetrics}
                    />
                  </GlassCardContent>
                </GlassCard>
              </div>

              {/* Verification checkpoint right 5 cols */}
              <div className="space-y-6 lg:col-span-5">
                <GlassCard
                  depth="base"
                  theme="emerald"
                  className="border-emerald-500/20 shadow-xl"
                  texture="chevron"
                  textureOpacity={0.04}
                >
                  <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                    <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                      <Shield className="h-5 w-5 text-emerald-400" />
                      Verification Checkpoint
                    </h3>
                  </div>
                  <GlassCardContent className="space-y-4 p-6">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Review critical adjustments and resolve any validation issues before authorization
                    </p>

                    <div className="space-y-2.5">
                      {validation.errors.length > 0 ? (
                        validation.errors.map((err, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-500 dark:text-amber-400" />
                            <span>{err}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
                          <CheckCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            No high-risk adjustments detected. Structural variables are within safe boundaries.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-2.5 pt-2 select-none">
                      <Checkbox
                        id="verify-checkbox"
                        checked={isVerified}
                        onCheckedChange={(checked) => setIsVerified(checked === true)}
                        className="mt-0.5 border-zinc-300 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 dark:border-zinc-700"
                      />
                      <Label
                        htmlFor="verify-checkbox"
                        className="cursor-pointer text-xs leading-normal text-zinc-600 dark:text-zinc-400"
                      >
                        I verify these economic adjustments are intentional and authorization should be finalized.
                      </Label>
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={async () => {
                          if (!isVerified || validation.errors.length > 0) return;
                          await handleSave();
                        }}
                        disabled={!isVerified || validation.errors.length > 0 || isSaving}
                        className="h-9 w-full rounded-lg bg-emerald-500 text-xs font-semibold text-zinc-950 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                      >
                        {isSaving ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                          </span>
                        ) : (
                          "Save & Finalize Economy"
                        )}
                      </Button>
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </BuilderTabCard>
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
