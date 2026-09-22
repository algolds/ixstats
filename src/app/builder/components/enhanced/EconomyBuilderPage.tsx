"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Industry as Factory,
  Group as Users,
  Flash as Zap,
} from "iconoir-react";
import { isEqual } from "~/lib/utils";

import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";
import { useBuilderGuide } from "~/app/builder/components/builder-guide-context";
import { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import type { ComponentType } from "~/lib/enums";

import type { EconomyBuilderState, EconomicHealthMetrics } from "~/types/economy-builder";
import type { EconomicInputs } from "../../lib/economy-data-service";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { GovernmentBuilderState, RevenueSource } from "~/types/government";
import { useEconomyBuilderSync } from "../../hooks/useEconomyBuilderSync";

import { Suspense } from "react";
import { EconomySectorsTab, WorkforceSocietyTab } from "./tabs";
import { TabLoadingFallback } from "../../components/GlobalBuilderLoading";

import { BuilderErrorBoundary } from "../../components/BuilderErrorBoundary";

import { BuilderTabCard, type TabDefinition } from "../../primitives/BuilderTabCard";

import { useBuilderContextOptional } from "./context/BuilderStateContext";
import { api } from "~/trpc/react";
import { STALE_TIME } from "~/hooks/useCountryGovernment";

import {
  mergeDemographics,
  mergeEconomyBuilderIntoInputs,
  applyGovernmentRevenueAdjustments,
  createDefaultEconomyBuilderState,
  DEFAULT_SECTORS,
} from "./economy-builder/economyStateUtils";
import { useEconomyAutoSync } from "./economy-builder/useEconomyAutoSync";
import { EconomyComponentPanel } from "./economy-builder/EconomyComponentPanel";
import { EconomyArchetypeHandler } from "./economy-builder/EconomyArchetypeHandler";

interface EconomyBuilderPageProps {
  economicInputs: EconomicInputs;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  governmentComponents?: ComponentType[];
  governmentBuilderData?: GovernmentBuilderState | null;
  taxSystemData?: TaxBuilderState | null;
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
  mode?: "create" | "edit";
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
  persistedEconomyBuilder = null,
  onPersistEconomyBuilder,
  activeTab,
  onTabChange,
  selectedArchetypeId: _selectedArchetypeId,
  mode: propMode,
}: EconomyBuilderPageProps) {
  const { openGuide, isSectionSeen } = useBuilderGuide();
  const builderCtx = useBuilderContextOptional();
  const effectiveMode = propMode ?? builderCtx?.mode ?? "create";

  // Auto-slide open the Companion Sheet on first visit
  useEffect(() => {
    if (!isSectionSeen("economics")) {
      openGuide({ tab: "rules", section: "economics" });
    }
  }, [isSectionSeen, openGuide]);

  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  const [economyBuilder, setEconomyBuilder] = useState<EconomyBuilderState>(() =>
    createDefaultEconomyBuilderState(economicInputs, persistedEconomyBuilder)
  );

  const [selectedComponents, setSelectedComponents] = useState<EconomicComponentType[]>(() => {
    return persistedEconomyBuilder?.selectedAtomicComponents || propsSelectedComponents;
  });

  const { viewMode } = useBuilderFilter();
  const isExpertOrEdit = effectiveMode === "edit" || viewMode === "expert";

  const currentTab = useMemo(() => {
    const raw = activeTab || "components";
    if (!isExpertOrEdit && (raw === "sectors" || raw === "workforce")) {
      return "components";
    }
    if (["components", "sectors", "workforce"].includes(raw)) {
      return raw;
    }
    const legacyMap: Record<string, string> = {
      structure: "sectors",
      labor: "workforce",
      demographics: "workforce",
      taxes: "workforce",
      tax: "workforce",
      fiscal: "workforce",
      preview: "workforce",
    };
    return legacyMap[raw] || "components";
  }, [activeTab, viewMode]);

  useEffect(() => {
    const totalPopulation = economicInputs.coreIndicators?.totalPopulation;
    const nominalGDP = economicInputs.coreIndicators?.nominalGDP;

    setEconomyBuilder((prev) => {
      let changed = false;
      const next = { ...prev };

      if (totalPopulation !== undefined && totalPopulation !== prev.demographics?.totalPopulation) {
        const participationRate = prev.laborMarket?.laborForceParticipationRate ?? 65;
        const totalWorkforce = Math.round(totalPopulation * (participationRate / 100));
        next.demographics = { ...prev.demographics, totalPopulation };
        next.laborMarket = { ...prev.laborMarket, totalWorkforce };
        changed = true;
      }

      if (nominalGDP !== undefined && nominalGDP !== prev.structure?.totalGDP) {
        next.structure = { ...prev.structure, totalGDP: nominalGDP };
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    economicInputs.coreIndicators?.totalPopulation,
    economicInputs.coreIndicators?.nominalGDP,
  ]);

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

  const builderContext = useBuilderContextOptional();

  useEconomyAutoSync({
    countryId,
    economyBuilder,
    economicInputs,
    builderContext,
  });

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



  const {
    economyBuilderRef,
    economicInputsRef,
  } = useEconomyBuilderSync({
    countryId,
    enabled: !builderContext,
    economyBuilder,
    economicInputs,
    governmentComponents,
    taxSystemData,
    onEconomicInputsChange,
    onPersistEconomyBuilder,
    setEconomyBuilder,
  });

  const lastProcessedRevenueSourcesRef = useRef<string | null>(null);

  const handleEconomyBuilderChange = useCallback(
    (builder: EconomyBuilderState) => {
      economyBuilderRef.current = builder;
      setEconomyBuilder(builder);
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

  const handleComponentChange = useCallback(
    (components: EconomicComponentType[]) => {
      setSelectedComponents(components);
      const updatedBuilder = {
        ...economyBuilderRef.current,
        selectedAtomicComponents: components,
      };
      handleEconomyBuilderChange(updatedBuilder);
      onSelectedComponentsChange?.(components);
    },
    [handleEconomyBuilderChange, onSelectedComponentsChange, economyBuilderRef]
  );

  const handleEconomyBuilderChangeRef = useRef(handleEconomyBuilderChange);
  useEffect(() => {
    handleEconomyBuilderChangeRef.current = handleEconomyBuilderChange;
  }, [handleEconomyBuilderChange]);

  // Auto-allocate standard default sectors if empty in standard mode
  useEffect(() => {
    if (
      viewMode === "standard" &&
      (!economyBuilder.sectors || economyBuilder.sectors.length === 0)
    ) {
      handleEconomyBuilderChangeRef.current({
        ...economyBuilderRef.current,
        sectors: DEFAULT_SECTORS,
      });
    }
  }, [viewMode, economyBuilder.sectors, economyBuilderRef]);

  useEffect(() => {
    if (
      !governmentBuilderData?.revenueSources ||
      governmentBuilderData.revenueSources.length === 0
    ) {
      return;
    }

    const revenueSourcesKey = JSON.stringify(governmentBuilderData.revenueSources);
    if (revenueSourcesKey === lastProcessedRevenueSourcesRef.current) {
      return;
    }
    lastProcessedRevenueSourcesRef.current = revenueSourcesKey;

    const revenueSources = governmentBuilderData.revenueSources as RevenueSource[];

    const totalRevenue = revenueSources.reduce(
      (sum, source) => sum + (source.revenueAmount || 0),
      0
    );

    const taxRevenue = revenueSources
      .filter((source) => source.category === "Direct Tax" || source.category === "Indirect Tax")
      .reduce((sum, source) => sum + (source.revenueAmount || 0), 0);

    const nonTaxRevenue = revenueSources
      .filter((source) => source.category !== "Direct Tax" && source.category !== "Indirect Tax")
      .reduce((sum, source) => sum + (source.revenueAmount || 0), 0);

    const currentEconomicInputs = economicInputsRef.current;
    const currentEconomyBuilder = economyBuilderRef.current;
    const gdp =
      currentEconomicInputs.coreIndicators?.nominalGDP ||
      currentEconomyBuilder.structure.totalGDP ||
      1;

    const taxBurdenRatio = gdp > 0 ? (taxRevenue / gdp) * 100 : 0;
    const revenueToGDPRatio = gdp > 0 ? (totalRevenue / gdp) * 100 : 0;

    let governmentSizeIndicator: "Small" | "Medium" | "Large" = "Medium";
    if (revenueToGDPRatio < 25) {
      governmentSizeIndicator = "Small";
    } else if (revenueToGDPRatio > 40) {
      governmentSizeIndicator = "Large";
    }

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
      handleEconomyBuilderChangeRef.current(adjustedBuilder);
    }
  }, [governmentBuilderData?.revenueSources, economicInputsRef, economyBuilderRef]);

  const { data: existingConfiguration } = api.economics.getEconomyBuilderState.useQuery(
    { countryId: countryId! },
    {
      enabled: !!countryId,
      staleTime: STALE_TIME.STANDARD,
    }
  );

  useEffect(() => {
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
            existingConfiguration.structure?.economicTier as "Developing" | "Emerging" | "Developed" | "Advanced"
          )
            ? (existingConfiguration.structure.economicTier as
                "Developing" | "Emerging" | "Developed" | "Advanced")
            : "Developing",
          growthStrategy: (
            ["Export-Led", "Import-Substitution", "Balanced", "Innovation-Driven"] as const
          ).includes(existingConfiguration.structure?.growthStrategy as "Export-Led" | "Import-Substitution" | "Balanced" | "Innovation-Driven")
            ? (existingConfiguration.structure.growthStrategy as
                "Export-Led" | "Import-Substitution" | "Balanced" | "Innovation-Driven")
            : "Balanced",
        },
        sectors: (existingConfiguration.sectors as typeof economyBuilder.sectors) || economyBuilder.sectors,
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingConfiguration]);

  const tabs = useMemo<TabDefinition[]>(() => {
    const list: TabDefinition[] = [{ id: "components", label: "Components", icon: Zap }];
    if (isExpertOrEdit) {
      list.push(
        { id: "sectors", label: "Sectors", icon: Factory },
        { id: "workforce", label: "Workforce", icon: Users }
      );
    }
    return list;
  }, [isExpertOrEdit]);

  return (
    <div className={`mx-auto max-w-7xl space-y-6 pb-12 ${className}`}>
      <BuilderTabCard
        tabs={tabs}
        activeTab={currentTab}
        onTabChange={(tabId) => onTabChange?.(tabId)}
        sectionTheme="economics"
        hideTabList={tabs.length <= 1}
      >
          {currentTab === "components" && (
            <EconomyComponentPanel
              selectedComponents={selectedComponents}
              onComponentChange={handleComponentChange}
              governmentComponents={governmentComponents}
            />
          )}

          {currentTab === "sectors" && (
            <Suspense fallback={<TabLoadingFallback />}>
              <EconomySectorsTab
                economyBuilder={economyBuilder}
                onEconomyBuilderChange={handleEconomyBuilderChange}
                selectedComponents={selectedComponents}
                showAdvanced={isExpertOrEdit || showAdvanced}
              />
            </Suspense>
          )}

          {currentTab === "workforce" && (
            <Suspense fallback={<TabLoadingFallback />}>
              <WorkforceSocietyTab
                economyBuilder={economyBuilder}
                onEconomyBuilderChange={handleEconomyBuilderChange}
                selectedComponents={selectedComponents}
                showAdvanced={isExpertOrEdit || showAdvanced}
              />
            </Suspense>
          )}
      </BuilderTabCard>

      <EconomyArchetypeHandler
        open={isPresetsOpen}
        onOpenChange={setIsPresetsOpen}
        economyBuilder={economyBuilder}
        handleEconomyBuilderChange={handleEconomyBuilderChange}
        builderContext={builderContext}
      />
    </div>
  );
}
