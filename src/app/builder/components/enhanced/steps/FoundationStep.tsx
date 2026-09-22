"use client";
// Foundation Step - Country and Faction selection for Atomic Builder

import React, { useState } from "react";
import { motion } from "motion/react";
import { Globe } from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import type { RealCountryData } from "~/app/builder/lib/economy-types";
import { createDefaultEconomicInputs } from "~/app/builder/lib/default-economic-inputs";
import { createDefaultEconomyBuilderState } from "~/app/builder/components/enhanced/economy-builder/economyStateUtils";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import { ArchetypeDetailsModal } from "../archetypes/ArchetypeDetailsModal";
import { useArchetypes } from "~/hooks/useArchetypes";
import type { GovernmentType } from "~/types/government";
import { withBasePath } from "~/lib/base-path";
import { useBuilderContext } from "../context/BuilderStateContext";
import { useBuilderFilter } from "../../builder-filter-context";
import { FoundationHero } from "../../FoundationHero";
import { useNotify } from "~/hooks/useNotify";
import { safeGetItemSync } from "~/lib/system/local-storage-mutex";
import type { BuilderStep } from "../builderConfig";
import { HISTORICAL_ARCHETYPE_IDS } from "./foundation/foundationUtils";
import { FoundationPathSelector } from "./foundation/FoundationPathSelector";
import { ArchetypeGrid } from "./foundation/ArchetypeGrid";
import { ArchetypeConfirmationPanel } from "./foundation/ArchetypeConfirmationPanel";

interface FoundationStepProps {
  countries: RealCountryData[];
  isLoadingCountries: boolean;
  countryLoadError?: string | null;
  onCountrySelect: (country: RealCountryData) => void;
  onBackToIntro?: () => void;
  onCreateFromScratch: () => void;
  onNavigate?: (section: string) => void;
}

export function FoundationStep({
  countries,
  isLoadingCountries,
  countryLoadError,
  onCountrySelect,
  onBackToIntro,
  onCreateFromScratch,
  onNavigate,
}: FoundationStepProps) {
  const { builderState, setBuilderState, updateStep, updateArchetypeId } = useBuilderContext();
  const { selectedTemplate, setSelectedTemplate } = useBuilderFilter();
  const notify = useNotify();

  // Navigation path within foundation: hero selection vs. direct flow
  const [selectedPath, setSelectedPath] = useState<string>(
    selectedTemplate || builderState.selectedArchetypeId ? "template" : "hero"
  );

  // Flow State: 1 = Benchmark Country Selector, 2 = Archetype Grid
  const [subStep, setSubStep] = useState<1 | 2>(
    builderState.selectedArchetypeId ? 2 : 1
  );
  const [transitionDirection, setTransitionDirection] = useState<number>(1);


  // Archetype Grid Filters
  const [activeEra, setActiveEra] = useState<"modern" | "historical">("modern");
  const [searchQuery, setSearchQuery] = useState("");
  const [complexityFilter, setComplexityFilter] = useState<"all" | "Low" | "Medium" | "High">("all");

  // Selection & Details Modal State
  const [localSelectedArchetype, setLocalSelectedArchetype] = useState<EconomicArchetype | null>(null);
  const [detailsModalArchetype, setDetailsModalArchetype] = useState<EconomicArchetype | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Archetype Data Fetching via hook
  const { archetypes: allArchetypes, isLoading: isLoadingArchetypes } = useArchetypes();

  // Sync state archetype on mount
  React.useEffect(() => {
    if (builderState.selectedArchetypeId && allArchetypes.length > 0) {
      const match = allArchetypes.find((a) => a.id === builderState.selectedArchetypeId);
      if (match) setLocalSelectedArchetype(match);
    }
  }, [builderState.selectedArchetypeId, allArchetypes]);

  // Filter archetypes by era, query, and complexity
  const archetypes = React.useMemo(() => {
    if (!allArchetypes) return [];
    if (activeEra === "historical") {
      return allArchetypes.filter((arch) =>
        (HISTORICAL_ARCHETYPE_IDS as readonly string[]).includes(arch.id)
      );
    }
    return allArchetypes.filter(
      (arch) => !(HISTORICAL_ARCHETYPE_IDS as readonly string[]).includes(arch.id)
    );
  }, [allArchetypes, activeEra]);

  const filteredArchetypes = React.useMemo(() => {
    return archetypes.filter((arch) => {
      const matchesSearch =
        searchQuery === "" ||
        arch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        arch.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (arch.region && arch.region.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (arch.characteristics &&
          arch.characteristics.some((c: string) =>
            c.toLowerCase().includes(searchQuery.toLowerCase())
          ));

      const matchesComplexity =
        complexityFilter === "all" ||
        (arch.implementationComplexity || "Medium").toLowerCase() ===
          complexityFilter.toLowerCase();

      return matchesSearch && matchesComplexity;
    });
  }, [archetypes, searchQuery, complexityFilter]);

  // Infinite Scroll Pagination
  const [visibleCount, setVisibleCount] = React.useState(12);
  const visibleArchetypes = React.useMemo(() => {
    return filteredArchetypes.slice(0, visibleCount);
  }, [filteredArchetypes, visibleCount]);

  React.useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, complexityFilter, activeEra]);

  const handleLoadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + 12, filteredArchetypes.length));
  }, [filteredArchetypes.length]);

  const loaderRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = loaderRef.current;
    if (!el || visibleCount >= filteredArchetypes.length || isLoadingArchetypes) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore, visibleCount, filteredArchetypes.length, isLoadingArchetypes]);

  // Apply archetype to builder state
  const applyArchetypeToState = React.useCallback(
    (archetype: EconomicArchetype) => {
      updateArchetypeId(archetype.id);

      setBuilderState((prev) => {
        const nextState = { ...prev };
        nextState.selectedArchetypeId = archetype.id;

        const totalPopulation = selectedTemplate?.population || 10_000_000;
        const totalGDP = selectedTemplate?.gdp || 250_000_000_000;
        const totalWorkforce = Math.round(totalPopulation * 0.65);

        const baseInputs = nextState.economicInputs || createDefaultEconomicInputs();

        const defaultEconomicState = createDefaultEconomyBuilderState(
          baseInputs,
          nextState.economyBuilderState
        );
        nextState.economyBuilderState = {
          ...defaultEconomicState,
          ...nextState.economyBuilderState,
          selectedAtomicComponents:
            archetype.economicComponents ||
            nextState.economyBuilderState?.selectedAtomicComponents ||
            [],
        };

        if (archetype.governmentComponents && archetype.governmentComponents.length > 0) {
          nextState.governmentComponents = archetype.governmentComponents;
        }

        const govType = (archetype.name || selectedTemplate?.governmentType || "Republic") as GovernmentType;
        nextState.governmentStructure = {
          structure: {
            governmentName: `Government of ${selectedTemplate?.name || "the Nation"}`,
            governmentType: govType,
            headOfState: nextState.governmentStructure?.structure?.headOfState || "",
            headOfGovernment: nextState.governmentStructure?.structure?.headOfGovernment || "",
            legislatureName: nextState.governmentStructure?.structure?.legislatureName || "",
            executiveName: nextState.governmentStructure?.structure?.executiveName || "",
            judicialName: nextState.governmentStructure?.structure?.judicialName || "",
            totalBudget: Math.round(totalGDP * 0.35),
            fiscalYear: "Calendar Year",
            budgetCurrency: "USD",
          },
          departments: nextState.governmentStructure?.departments || [],
          budgetAllocations: nextState.governmentStructure?.budgetAllocations || [],
          revenueSources: nextState.governmentStructure?.revenueSources || [],
          isValid: true,
          errors: { structure: [], departments: {}, budget: [], revenue: [] },
        };

        if (archetype.taxProfile) {
          nextState.taxSystemData = {
            taxSystem: {
              taxSystemName: `${selectedTemplate?.name || "National"} Tax System`,
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

        nextState.economicInputs = {
          ...baseInputs,
          ...(baseInputs.nationalIdentity
            ? {
                nationalIdentity: {
                  ...baseInputs.nationalIdentity,
                  countryName:
                    selectedTemplate?.name ||
                    baseInputs.nationalIdentity.countryName ||
                    archetype.name,
                  officialName: selectedTemplate?.name
                    ? `The Commonwealth of ${selectedTemplate.name}`
                    : baseInputs.nationalIdentity.officialName ||
                      `The Commonwealth of ${archetype.name}`,
                },
              }
            : {}),
          coreIndicators: {
            ...baseInputs.coreIndicators,
            realGDPGrowthRate:
              archetype.growthMetrics?.gdpGrowth ?? baseInputs.coreIndicators.realGDPGrowthRate,
            nominalGDP: selectedTemplate?.gdp || baseInputs.coreIndicators.nominalGDP || totalGDP,
            totalPopulation:
              selectedTemplate?.population || baseInputs.coreIndicators.totalPopulation || totalPopulation,
          },
          laborEmployment: {
            ...baseInputs.laborEmployment,
            unemploymentRate:
              archetype.employmentProfile?.unemploymentRate ??
              baseInputs.laborEmployment.unemploymentRate,
            laborForceParticipationRate:
              archetype.employmentProfile?.laborParticipation ??
              baseInputs.laborEmployment.laborForceParticipationRate,
            totalWorkforce,
          },
        };

        return nextState;
      });
    },
    [selectedTemplate, setBuilderState, updateArchetypeId]
  );

  const handleConfirmFaction = React.useCallback(
    (archetypeToApply?: EconomicArchetype) => {
      const target = archetypeToApply || localSelectedArchetype;
      if (!target) return;

      applyArchetypeToState(target);
      notify.success(`Applied ${target.name} archetype profile.`);

      if (selectedTemplate) {
        onCountrySelect(selectedTemplate);
      } else {
        onCreateFromScratch();
      }
    },
    [localSelectedArchetype, applyArchetypeToState, notify, selectedTemplate, onCountrySelect, onCreateFromScratch]
  );

  const handleBackToBenchmark = React.useCallback(() => {
    setTransitionDirection(-1);
    setSubStep(1);
  }, []);

  const handleSkipBenchmark = React.useCallback(() => {
    setSelectedTemplate(null);
    setTransitionDirection(1);
    setSubStep(2);
  }, [setSelectedTemplate]);

  const handleSkipArchetype = React.useCallback(() => {
    updateArchetypeId(null);
    if (selectedTemplate) {
      notify.info(`Baseline applied from ${selectedTemplate.name}.`);
      onCountrySelect(selectedTemplate);
    } else {
      onCreateFromScratch();
    }
  }, [updateArchetypeId, selectedTemplate, notify, onCountrySelect, onCreateFromScratch]);

  const handleResume = React.useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const rawSaved = safeGetItemSync("builder_state") || sessionStorage.getItem("builder_state");
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved);
          const targetStep = (parsed.step && parsed.step !== "foundation" ? parsed.step : "core") as BuilderStep;
          setBuilderState((prev) => ({
            ...prev,
            ...parsed,
            step: targetStep,
          }));
          return;
        }
      } catch {
        // ignore
      }
    }

    const targetStep = (builderState.step && builderState.step !== "foundation" ? builderState.step : "core") as BuilderStep;
    setBuilderState((prev) => ({
      ...prev,
      step: targetStep,
    }));
  }, [builderState.step, setBuilderState]);

  if (isLoadingCountries) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="space-y-4 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto h-16 w-16"
          >
            <Globe className="h-16 w-16 text-amber-500" />
          </motion.div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">Loading country templates...</p>
            <p className="text-sm text-muted-foreground">Preparing your foundation options</p>
          </div>
        </div>
      </div>
    );
  }

  if (countryLoadError) {
    return (
      <Alert className="mx-auto max-w-2xl border-red-500/30 bg-red-950/20 backdrop-blur-md">
        <AlertDescription className="text-red-400">
          <strong>Error loading country templates:</strong> {countryLoadError}
          <br />
          Please refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  // Part 0: Foundation Hero Pathway Selection
  if (selectedPath === "hero" && !selectedTemplate && !builderState.selectedArchetypeId && subStep === 1) {
    return (
      <FoundationHero
        onResume={handleResume}
        onSelectPath={(path) => {
          if (path === "scratch") {
            onCreateFromScratch();
          } else if (path === "template" || path === "country" || path === "archetype") {
            setTransitionDirection(1);
            setSelectedPath("template");
            if (path === "archetype") {
              setSelectedTemplate(null);
              setSubStep(2);
            } else {
              setSubStep(1);
            }
          } else if (path === "import") {
            if (onNavigate) {
              onNavigate("import");
            } else {
              window.history.pushState(null, "", withBasePath("/builder?section=import"));
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
          }
        }}
      />
    );
  }

  // Part 1: Real country benchmark selection pathway (Sub-Step 1 of 2)
  if (subStep === 1) {
    return (
      <FoundationPathSelector
        countries={countries}
        transitionDirection={transitionDirection}
        onBackToHero={() => {
          setTransitionDirection(-1);
          setSelectedPath("hero");
          setSubStep(1);
        }}
        onSkipBenchmark={handleSkipBenchmark}
        onCountrySelect={(country) => {
          setTransitionDirection(1);
          setSelectedTemplate(country);
          setSubStep(2);
        }}
        onBackToIntro={onBackToIntro}
        onCreateFromScratch={onCreateFromScratch}
      />
    );
  }

  // Part 2: Archetype Grid & Confirmation
  return (
    <>
      <ArchetypeGrid
        transitionDirection={transitionDirection}
        selectedTemplate={selectedTemplate}
        activeEra={activeEra}
        setActiveEra={setActiveEra}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        complexityFilter={complexityFilter}
        setComplexityFilter={setComplexityFilter}
        archetypes={archetypes}
        filteredArchetypes={filteredArchetypes}
        visibleArchetypes={visibleArchetypes}
        isLoadingArchetypes={isLoadingArchetypes}
        visibleCount={visibleCount}
        loaderRef={loaderRef}
        localSelectedArchetype={localSelectedArchetype}
        setLocalSelectedArchetype={setLocalSelectedArchetype}
        onBackToBenchmark={handleBackToBenchmark}
        onSkipArchetype={handleSkipArchetype}
        onOpenDetailsModal={(arch) => {
          setDetailsModalArchetype(arch);
          setIsDetailsOpen(true);
        }}
        onConfirmFaction={handleConfirmFaction}
      />

      {/* Selected Archetype Drawer */}
      <ArchetypeConfirmationPanel
        selectedArchetype={localSelectedArchetype}
        onClearSelection={() => setLocalSelectedArchetype(null)}
        onConfirmFaction={() => handleConfirmFaction()}
      />

      {/* Full Archetype Details Modal */}
      <ArchetypeDetailsModal
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        archetype={detailsModalArchetype}
        isGloballySelected={builderState.selectedArchetypeId === detailsModalArchetype?.id}
        isLoading={false}
        onApply={(arch) => {
          setLocalSelectedArchetype(arch);
          setIsDetailsOpen(false);
          handleConfirmFaction(arch);
        }}
      />
    </>
  );
}
