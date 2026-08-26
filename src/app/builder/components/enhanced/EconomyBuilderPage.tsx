"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

// oxlint-disable-next-line eslint/no-unused-vars
import { Industry as Factory, Group as Users, WarningTriangle as AlertTriangle, Flash as Zap, Globe, SystemRestart as Loader2, HelpCircle, Page as Receipt } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { isEqual } from "~/lib/utils";

// Economy Builder Components
import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";
import { AtomicEconomicComponentSelector } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { EconomicWelcomeModal } from "~/components/mycountry/domains/economy/atomic";

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
import { GlassCard, GlassCardContent } from "../glass/GlassCard";
import { FiscalTab, TaxTab } from "./tabs";
import { ComponentErrorBoundary } from "~/components/ui/comprehensive-error-boundary";

// Tab Card Primitive
import { BuilderTabCard, type TabDefinition } from "../../primitives/BuilderTabCard";

// Cross-Builder Integration Components
import { EconomicArchetypeModal } from "./EconomicArchetypeModal";
import { EconomyBuilderHeader } from "./economy-builder/components/EconomyBuilderHeader";

// tRPC API
import { api } from "~/trpc/react";

// Government types
import type { RevenueSource } from "~/types/government";

// Autosave hook
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";

// Builder context
import { useBuilderContextOptional } from "./context/BuilderStateContext";
import { useArchetypes, mapLegacyGovernmentComponents } from "~/hooks/useArchetypes";

// Shared staleTime constants
import { STALE_TIME } from "~/hooks/useCountryGovernment";

const DEFAULT_TAX_BUILDER_STATE: TaxBuilderState = {
  taxSystem: {
    taxSystemName: "",
    fiscalYear: "Calendar Year",
    progressiveTax: true,
    alternativeMinTax: false,
  },
  categories: [],
  brackets: {},
  exemptions: [],
  deductions: {},
  selectedAtomicTaxComponents: [],
  isValid: false,
  errors: {},
};

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
  taxSystemData?: any;
  countryId?: string;
  className?: string;
  onSelectedComponentsChange?: (components: EconomicComponentType[]) => void;
  showAdvanced?: boolean;
  selectedComponents?: EconomicComponentType[];
  economicHealthMetrics?: EconomicHealthMetrics;
  persistedEconomyBuilder?: EconomyBuilderState | null;
  onPersistEconomyBuilder?: (builder: EconomyBuilderState) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  selectedArchetypeId?: string | null;
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
// Default demographics shape. Used to backfill stale localStorage blobs that
// predate newer fields, so the builder never reads undefined nested values.
const DEFAULT_DEMOGRAPHICS: EconomyBuilderState["demographics"] = {
  totalPopulation: 0,
  populationGrowthRate: 0,
  ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
  urbanRuralSplit: { urban: 50, rural: 50 },
  regions: [],
  lifeExpectancy: 75,
  literacyRate: 90,
  educationLevels: { noEducation: 5, primary: 25, secondary: 45, tertiary: 25 },
  netMigrationRate: 0,
  immigrationRate: 0,
  emigrationRate: 0,
  infantMortalityRate: 10,
  maternalMortalityRate: 50,
  healthExpenditureGDP: 5,
  youthDependencyRatio: 30,
  elderlyDependencyRatio: 23,
  totalDependencyRatio: 53,
};

// Deep-merge a possibly-stale persisted demographics object over the defaults,
// filling missing scalars and nested objects in one pass.
function mergeDemographics(
  d: Partial<EconomyBuilderState["demographics"]> | undefined
): EconomyBuilderState["demographics"] {
  return {
    ...DEFAULT_DEMOGRAPHICS,
    ...d,
    ageDistribution: { ...DEFAULT_DEMOGRAPHICS.ageDistribution, ...d?.ageDistribution },
    urbanRuralSplit: { ...DEFAULT_DEMOGRAPHICS.urbanRuralSplit, ...d?.urbanRuralSplit },
    educationLevels: { ...DEFAULT_DEMOGRAPHICS.educationLevels, ...d?.educationLevels },
    regions: d?.regions ?? [],
  };
}

interface EconomyTabHeaderProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  extra?: React.ReactNode;
}

function EconomyTabHeader({ title, icon: Icon, extra }: EconomyTabHeaderProps) {
  return (
    <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
      <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
        <Icon className="h-5 w-5 text-emerald-400" />
        {title}
      </h3>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}

export function EconomyBuilderPage({
  economicInputs,
  onEconomicInputsChange,
  governmentComponents = [],
  governmentBuilderData,
  countryId,
  className = "",
  onSelectedComponentsChange,
  showAdvanced = false,
  selectedComponents: propsSelectedComponents = [],
  economicHealthMetrics,
  persistedEconomyBuilder = null,
  onPersistEconomyBuilder,
  activeTab,
  onTabChange,
  selectedArchetypeId,
}: EconomyBuilderPageProps) {
  const notify = useNotify();

  // Load archetypes to map the selected archetype ID to its name
  const { archetypes } = useArchetypes("all");
  const selectedArchetype = useMemo(() => {
    if (!selectedArchetypeId) return null;
    return archetypes.find((a) => a.id === selectedArchetypeId);
  }, [selectedArchetypeId, archetypes]);

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const [isVerified, setIsVerified] = useState(false);
  // Local sub-tab for merged Labor & Demographics view
  // oxlint-disable-next-line eslint/no-unused-vars
  const [activeLaborSubTab, setActiveLaborSubTab] = useState<"demographics" | "labor">(
    "demographics"
  );
  // Removed auto-save state - using global builder autosave instead

  // State Management - Memoized to prevent unnecessary re-renders
  const [economyBuilder, setEconomyBuilder] = useState<EconomyBuilderState>(() => {
    const defaults: EconomyBuilderState = {
      structure: {
        economicModel: "Mixed Economy",
        primarySectors: [],
        secondarySectors: [],
        tertiarySectors: [],
        totalGDP: economicInputs.coreIndicators?.nominalGDP || 0,
        gdpCurrency: economicInputs.nationalIdentity?.currency || "USD",
        economicTier: "Developing" as const,
        growthStrategy: "Balanced",
      },
      sectors: [],
      laborMarket: {
        totalWorkforce: Math.round((economicInputs.coreIndicators?.totalPopulation || 0) * 0.65),
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

    if (!persistedEconomyBuilder) return defaults;

    // Deep-merge a possibly-stale persisted blob over the full defaults so missing
    // nested fields (older localStorage shapes) can never crash a tab/useMemo.
    const p = persistedEconomyBuilder;
    return {
      ...defaults,
      ...p,
      structure: { ...defaults.structure, ...p.structure },
      laborMarket: {
        ...defaults.laborMarket,
        ...p.laborMarket,
        sectorDistribution: {
          ...defaults.laborMarket.sectorDistribution,
          ...p.laborMarket?.sectorDistribution,
        },
        employmentType: {
          ...defaults.laborMarket.employmentType,
          ...p.laborMarket?.employmentType,
        },
        workerProtections: {
          ...defaults.laborMarket.workerProtections,
          ...p.laborMarket?.workerProtections,
        },
        averageAnnualIncome:
          typeof p.laborMarket?.averageAnnualIncome === "number"
            ? p.laborMarket.averageAnnualIncome
            : defaults.laborMarket.averageAnnualIncome,
      },
      demographics: mergeDemographics(p.demographics),
    };
  });

  const [selectedComponents, setSelectedComponents] = useState<EconomicComponentType[]>(() => {
    return persistedEconomyBuilder?.selectedAtomicComponents || propsSelectedComponents;
  });

  const { viewMode } = useBuilderFilter();

  // Resolve current tab with backward compatibility for legacy tab values
  const currentTab = useMemo(() => {
    const raw = activeTab || "components";
    if (viewMode === "standard" && (raw === "labor" || raw === "demographics" || raw === "tax")) {
      return "components";
    }
    if (
      ["components", "sectors", "labor", "demographics", "fiscal", "tax", "preview"].includes(raw)
    ) {
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
  }, [activeTab, viewMode]);

  // oxlint-disable-next-line eslint/no-unused-vars
  const [isSaving, setIsSaving] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Synchronize population and GDP changes from Core Indicators step into the economy builder's internal state
  useEffect(() => {
    const totalPopulation = economicInputs.coreIndicators?.totalPopulation;
    const nominalGDP = economicInputs.coreIndicators?.nominalGDP;

    setEconomyBuilder((prev) => {
      let changed = false;
      const next = { ...prev };

      if (totalPopulation !== undefined && totalPopulation !== prev.demographics?.totalPopulation) {
        const participationRate = prev.laborMarket?.laborForceParticipationRate ?? 65;
        const totalWorkforce = Math.round(totalPopulation * (participationRate / 100));
        next.demographics = {
          ...prev.demographics,
          totalPopulation,
        };
        next.laborMarket = {
          ...prev.laborMarket,
          totalWorkforce,
        };
        changed = true;
      }

      if (nominalGDP !== undefined && nominalGDP !== prev.structure?.totalGDP) {
        next.structure = {
          ...prev.structure,
          totalGDP: nominalGDP,
        };
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    economicInputs.coreIndicators?.totalPopulation,
    economicInputs.coreIndicators?.nominalGDP,
    setEconomyBuilder,
  ]);

  // Synchronize selectedComponents when database-loaded builder resolves or changes
  useEffect(() => {
    if (persistedEconomyBuilder?.selectedAtomicComponents) {
      setSelectedComponents((prev) => {
        if (isEqual(prev, persistedEconomyBuilder.selectedAtomicComponents)) {
          return prev;
        }
        return persistedEconomyBuilder.selectedAtomicComponents;
      });
    }
  }, [persistedEconomyBuilder?.selectedAtomicComponents]);

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
  const autosaveMutation = api.economics.autoSaveEconomyBuilder.useMutation();
  // oxlint-disable-next-line eslint/no-unused-vars
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const sync = useGenericAutoSync(economyDataForSync, {
    // Inside the unified builder, useBuilderState owns persistence (updateCountry
    // in edit mode, BuilderDraft in create mode). Disable this side-channel so it
    // can't race/clobber the Country row or fire against a template countryCode in
    // create mode (which FORBIDDEN-fails after flashing optimistic "Saved").
    // Only autosave when used standalone (no BuilderStateProvider).
    enabled: !!countryId && !builderContext,
    debounceMs: 15000,
    syncFn: async (data) => {
      if (!countryId) return;
      const res = await autosaveMutation.mutateAsync({
        countryId,
        changes: data as Record<string, string | number | boolean | Date | null>,
      });
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      return res;
    },
    onSyncSuccess: () => {
      console.log("[EconomyBuilder] Autosave successful");
      setLastSaved(new Date());
    },
    onSyncError: (error) => {
      console.error("[EconomyBuilder] Autosave failed:", error);
      notify.error("Failed to autosave economy data");
    },
  });

  // oxlint-disable-next-line eslint/no-unused-vars
  const autoSyncState = {
    isSyncing: sync.isSyncing,
    lastSyncTime: sync.lastSyncTime,
    pendingChanges: sync.pendingChanges,
    conflictWarnings: [] as string[],
    syncError: sync.syncError?.message ?? null,
    optimistic: sync.status === "saved",
  };
  const syncNow = sync.forceSync;

  // Register autosync with BuilderContext (if available)
  useEffect(() => {
    if (builderContext && countryId) {
      builderContext.registerAutoSync("economy", async () => {
        await syncNow();
      });
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

  const taxSystemData = builderContext?.builderState?.taxSystemData ?? null;

  // Track and sync tax state changes back to builder context.
  const lastTaxSystemRef = useRef<TaxBuilderState | null>(null);
  const handleTaxStateChange = useCallback(
    (state: TaxBuilderState) => {
      if (!isEqual(state, lastTaxSystemRef.current)) {
        lastTaxSystemRef.current = state;
        builderContext?.updateTaxSystem(state);
      }
    },
    [builderContext]
  );

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
    // Unified builder owns persistence — suppress cross-builder server syncs here.
    enabled: !builderContext,
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

  // Component Change Handler - Memoized
  const handleComponentChange = useCallback(
    (components: EconomicComponentType[]) => {
      setSelectedComponents(components);
      economyIntegrationService.updateEconomicComponents(components);

      // Update economyBuilder state and persist it
      const updatedBuilder = {
        ...economyBuilderRef.current,
        selectedAtomicComponents: components,
      };
      handleEconomyBuilderChange(updatedBuilder);

      // Notify parent component
      onSelectedComponentsChange?.(components);
    },
    [handleEconomyBuilderChange, onSelectedComponentsChange, economyBuilderRef]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (persistedEconomyBuilder) return;
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
                "Developing" | "Emerging" | "Developed" | "Advanced")
            : "Developing",
          growthStrategy: (
            ["Export-Led", "Import-Substitution", "Balanced", "Innovation-Driven"] as const
          ).includes(existingConfiguration.structure?.growthStrategy as any)
            ? (existingConfiguration.structure.growthStrategy as
                "Export-Led" | "Import-Substitution" | "Balanced" | "Innovation-Driven")
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
        demographics: mergeDemographics({
          ...economyBuilder.demographics,
          ...existingConfiguration.demographics,
        }),
        selectedAtomicComponents: existingConfiguration.selectedAtomicComponents || [],
        version: existingConfiguration.version ?? economyBuilder.version,
        isValid: true,
        errors: {},
      };

      handleEconomyBuilderChange(mergedBuilder);
      setSelectedComponents(existingConfiguration.selectedAtomicComponents || []);
      setLastSaved(existingConfiguration.lastUpdated || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingConfiguration]);

  // Save Handler - Memoized with tRPC
  const _handleSave = useCallback(async () => {
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
      // oxlint-disable-next-line eslint/no-unused-vars
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // oxlint-disable-next-line eslint/no-unused-vars
  const validation = useMemo(() => {
    return validateEconomyConfiguration();
  }, [validateEconomyConfiguration]);

  // Use prop economicHealthMetrics or create fallback
  // oxlint-disable-next-line eslint/no-unused-vars
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

  // Tab Definitions - Following GovernmentBuilder pattern with tab filtering in Standard Mode
  const tabs = useMemo<TabDefinition[]>(() => {
    const list = [
      { id: "components", label: "Components", icon: Zap },
      { id: "sectors", label: "Sectors", icon: Factory },
    ];
    if (viewMode === "expert") {
      list.push(
        { id: "labor", label: "Labor Market", icon: Users },
        { id: "demographics", label: "Demographics", icon: Globe },
        { id: "tax", label: "Tax System", icon: Receipt }
      );
    }
    return list;
  }, [viewMode]);

  return (
    <div className={`mx-auto max-w-7xl space-y-6 pb-12 ${className}`}>
      <EconomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Header */}
        <EconomyBuilderHeader
          isLoadingConfig={isLoadingConfig}
          validationStatus={validationStatus}
          onHelpClick={() => setWelcomeOpen(true)}
          selectedArchetypeName={selectedArchetype?.name || null}
        />

        {/* Step Content - Tab navigation handled by BuilderNotchBar */}
        <BuilderTabCard
          tabs={tabs}
          activeTab={currentTab}
          onTabChange={(tabId) => onTabChange?.(tabId)}
          sectionTheme="economics"
        >
          {currentTab === "components" && (
            <div className="space-y-6">
              <ComponentErrorBoundary context="Components Tab">
                <GlassCard
                  depth="base"
                  theme="emerald"
                  className="border-emerald-500/20"
                  texture="chevron"
                  textureOpacity={0.04}
                >
                  <EconomyTabHeader
                    title="Economic Components"
                    icon={Zap}
                    extra={
                      <>
                        <button
                          onClick={() => setWelcomeOpen(true)}
                          className="cursor-pointer rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-emerald-400"
                          title="Open Help Guide"
                          type="button"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                        <Badge variant="outline">{selectedComponents.length} / 15 selected</Badge>
                      </>
                    }
                  />
                  <GlassCardContent className="space-y-6 p-6">
                    <AtomicEconomicComponentSelector
                      selectedComponents={selectedComponents}
                      onComponentChange={handleComponentChange}
                      maxComponents={15}
                      governmentComponents={governmentComponents}
                      hideSelectedList={true}
                    />
                  </GlassCardContent>
                </GlassCard>
              </ComponentErrorBoundary>
            </div>
          )}

          {currentTab === "sectors" && (
            <div className="space-y-6">
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <EconomyTabHeader title="Economic Sectors" icon={Factory} />
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
            </div>
          )}

          {currentTab === "labor" && (
            <div className="space-y-6">
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <EconomyTabHeader title="Labor Market & Employment" icon={Users} />
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
            </div>
          )}

          {currentTab === "demographics" && (
            <div className="space-y-6">
              <GlassCard
                depth="base"
                theme="emerald"
                className="border-emerald-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <EconomyTabHeader title="Demographics & Population" icon={Globe} />
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
            </div>
          )}

          {currentTab === "fiscal" && (
            <Suspense fallback={<TabLoadingFallback />}>
              <ComponentErrorBoundary context="Fiscal Tab">
                <FiscalTab
                  revenueIntegration={revenueIntegration}
                  economicInputs={economicInputs}
                />
              </ComponentErrorBoundary>
            </Suspense>
          )}

          {currentTab === "tax" && (
            <div className="space-y-6">
              <Suspense fallback={<TabLoadingFallback />}>
                <ComponentErrorBoundary context="Tax Tab">
                  <GlassCard
                    depth="base"
                    theme="emerald"
                    className="border-emerald-500/20"
                    texture="chevron"
                    textureOpacity={0.04}
                  >
                    <EconomyTabHeader title="Tax System" icon={Receipt} />
                    <GlassCardContent className="p-6">
                      <TaxTab
                        countryId={countryId}
                        economicInputs={economicInputs}
                        economyBuilder={economyBuilder}
                        governmentBuilderData={builderContext?.builderState?.governmentStructure}
                        selectedComponents={selectedComponents}
                        activeTaxBuilderState={taxSystemData ?? DEFAULT_TAX_BUILDER_STATE}
                        onTaxStateChange={handleTaxStateChange}
                        flat={true}
                      />
                    </GlassCardContent>
                  </GlassCard>
                </ComponentErrorBoundary>
              </Suspense>
            </div>
          )}

          {/* Per-economy preview and verification moved to global BuilderPreviewStep */}
        </BuilderTabCard>
      </div>

      {/* Presets Modal (Economic Archetypes) */}
      <EconomicArchetypeModal
        open={isPresetsOpen}
        onOpenChange={setIsPresetsOpen}
        currentState={economyBuilder}
        onArchetypeApplied={(newState, archetypeId, archetype) => {
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

          // Wire government components, structure name/type, and tax categories to the parent state
          if (builderContext) {
            builderContext.setBuilderState((prev) => {
              const updatedState = { ...prev };

              if (archetypeId) {
                updatedState.selectedArchetypeId = archetypeId;
              }

              if (archetype) {
                // 1. Update government components
                if (archetype.governmentComponents) {
                  updatedState.governmentComponents = mapLegacyGovernmentComponents(
                    archetype.governmentComponents as string[]
                  );
                }

                // 2. Update government structure type
                if (archetype.name && updatedState.governmentStructure?.structure) {
                  updatedState.governmentStructure = {
                    ...updatedState.governmentStructure,
                    structure: {
                      ...updatedState.governmentStructure.structure,
                      governmentType: archetype.name as any,
                    },
                  };
                }

                // 3. Update tax system categories rates
                if (archetype.taxProfile && updatedState.taxSystemData) {
                  const updatedCategories = updatedState.taxSystemData.categories.map(
                    (cat: any) => {
                      if (cat.categoryName.toLowerCase().includes("corporate")) {
                        return { ...cat, baseRate: archetype.taxProfile.corporateRate };
                      }
                      if (
                        cat.categoryName.toLowerCase().includes("personal") ||
                        cat.categoryName.toLowerCase().includes("income")
                      ) {
                        return { ...cat, baseRate: archetype.taxProfile.incomeRate };
                      }
                      if (
                        cat.categoryName.toLowerCase().includes("consumption") ||
                        cat.categoryName.toLowerCase().includes("sales") ||
                        cat.categoryName.toLowerCase().includes("value added")
                      ) {
                        return { ...cat, baseRate: archetype.taxProfile.consumptionRate };
                      }
                      return cat;
                    }
                  );
                  updatedState.taxSystemData = {
                    ...updatedState.taxSystemData,
                    categories: updatedCategories,
                  };
                }
              }

              return updatedState;
            });
          }

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
