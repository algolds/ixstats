"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import { isEqual } from "~/lib/utils";
import type { RealCountryData } from "../../lib/economy-data-service";
import { parseEconomyData } from "../../lib/economy-data-service";
import type {
  DepartmentInput,
  BudgetAllocationInput,
  GovernmentBuilderState,
} from "~/types/government";
import { IntroDisclosure } from "~/components/ui/intro-disclosure";
import { ComponentType as PrismaComponentType } from "~/lib/enums";
import { computeGovernmentWarnings } from "./government-preview/governmentWarnings";
import { applyGovernmentComponentNudges } from "../../lib/government-component-nudges";

// Import modular architecture
import { useBuilderContext } from "./context/BuilderStateContext";
import { StepContent } from "./sections";
import { StepRenderer } from "./sections/StepRenderer";
import { BuilderStepLoading } from "../GlobalBuilderLoading";
import { useBuilderSubmit, BuilderConfirmModal, useBuilderTutorials } from "./atomic-builder";

interface AtomicBuilderPageProps {
  onBackToIntro?: () => void;
  mode?: "create" | "edit";
  countryId?: string;
}

function AtomicBuilderPageInner({
  onBackToIntro,
  mode = "create",
  countryId,
}: AtomicBuilderPageProps) {
  const { builderState, setBuilderState } = useBuilderContext();
  const isEditMode = mode === "edit";

  // Country data state
  const [countries, setCountries] = useState<RealCountryData[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [countryLoadError, setCountryLoadError] = useState<string | null>(null);

  // Capture initial budget values on mount to detect changes
  const initialBudgetRef = useRef<number | null>(null);
  const initialCurrencyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      builderState.governmentStructure?.structure?.totalBudget &&
      initialBudgetRef.current === null
    ) {
      initialBudgetRef.current = builderState.governmentStructure.structure.totalBudget;
    }
    if (
      builderState.governmentStructure?.structure?.budgetCurrency &&
      initialCurrencyRef.current === null
    ) {
      initialCurrencyRef.current = builderState.governmentStructure.structure.budgetCurrency;
    }
  }, [builderState.governmentStructure]);

  // Compute warnings using the shared helper
  const warnings = useMemo(() => {
    return computeGovernmentWarnings(
      builderState.governmentStructure,
      builderState.economicInputs?.coreIndicators?.nominalGDP || 0,
      initialBudgetRef.current,
      initialCurrencyRef.current
    );
  }, [builderState.governmentStructure, builderState.economicInputs]);

  // Submission hook
  const {
    isSubmitting,
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    isVerified,
    setIsVerified,
    executeSubmitCountry,
  } = useBuilderSubmit({
    isEditMode,
    countryId,
    warnings,
  });

  // Tutorials hook
  const {
    showTutorial,
    setShowTutorial,
    showQuickStart,
    setShowQuickStart,
    handleCompleteTutorial,
    handleQuickStartNavigation,
    handleCompleteQuickStart,
    enhancedTutorialSteps,
    enhancedQuickStartSteps,
  } = useBuilderTutorials({
    setBuilderState,
  });

  // Government structure handlers
  const handleGovernmentStructureChange = useCallback(
    (structure: GovernmentBuilderState) => {
      setBuilderState((prev) => ({ ...prev, governmentStructure: structure }));
    },
    [setBuilderState]
  );

  const handleGovernmentStructureSave = useCallback(
    async (structure: GovernmentBuilderState) => {
      setBuilderState((prev) => ({ ...prev, governmentStructure: structure }));
    },
    [setBuilderState]
  );

  // Load countries data on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setIsLoadingCountries(true);
        setCountryLoadError(null);
        const countryData = await parseEconomyData();
        setCountries(countryData);
      } catch (err) {
        setCountryLoadError(err instanceof Error ? err.message : "Failed to load countries");
      } finally {
        setIsLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  // Government components seen last; null until the first list with economic inputs is seen.
  const lastProcessedGovComponentsRef = useRef<PrismaComponentType[] | null>(null);

  // Apply the fiscal nudge of a government component when the player adds it. The first list
  // observed (on mount, after a section switch, or the editor's loaded country) is only recorded:
  // re-applying it there compounded the tax rate on every visit.
  useEffect(() => {
    const components = builderState.governmentComponents;
    const inputs = builderState.economicInputs;
    if (!inputs) return;
    const previous = lastProcessedGovComponentsRef.current;
    if (previous === components) return;
    lastProcessedGovComponentsRef.current = components;
    if (previous === null || isEqual(previous, components)) return;

    const nudged = applyGovernmentComponentNudges(inputs, previous, components);
    if (nudged) {
      setBuilderState((prev) => ({ ...prev, economicInputs: nudged }));
    }
  }, [builderState.governmentComponents, builderState.economicInputs, setBuilderState]);

  // Track last processed government structure to prevent loops
  const lastProcessedGovStructureRef = useRef<GovernmentBuilderState | null>(null);

  // Sync government structure to economic inputs
  useEffect(() => {
    const govStructure = builderState.governmentStructure;
    if (govStructure === lastProcessedGovStructureRef.current) return;
    if (govStructure && builderState.economicInputs) {
      if (!isEqual(govStructure, lastProcessedGovStructureRef.current)) {
        lastProcessedGovStructureRef.current = govStructure;

        // Copy the nested object too: builder state must never be mutated in place.
        const updatedInputs = {
          ...builderState.economicInputs,
          governmentSpending: { ...builderState.economicInputs.governmentSpending },
        };

        if (govStructure.structure?.totalBudget) {
          const totalBudget = govStructure.structure.totalBudget;
          const gdp = builderState.economicInputs.coreIndicators.nominalGDP;

          updatedInputs.governmentSpending = {
            ...updatedInputs.governmentSpending,
            totalSpending: totalBudget,
            spendingGDPPercent: gdp > 0 ? (totalBudget / gdp) * 100 : 35,
          };
        }

        if (govStructure.departments && govStructure.budgetAllocations) {
          updatedInputs.governmentSpending.spendingCategories = govStructure.departments.map(
            (dept: DepartmentInput, index: number) => {
              const allocation = govStructure.budgetAllocations.find(
                (a: BudgetAllocationInput) => a.departmentId === index.toString()
              );
              return {
                category: dept.name,
                amount: allocation?.allocatedAmount || 0,
                percent: allocation?.allocatedPercent || 0,
                icon: dept.icon,
                color: dept.color,
                description: dept.description,
              };
            }
          );
        }

        setBuilderState((prev) => ({ ...prev, economicInputs: updatedInputs }));
      }
    }
  }, [builderState.governmentStructure, builderState.economicInputs, setBuilderState]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      {builderState.step === "foundation" && !isEditMode ? (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
          <Suspense fallback={<BuilderStepLoading message="Loading builder step..." />}>
            <StepRenderer
              countries={countries}
              isLoadingCountries={isLoadingCountries}
              countryLoadError={countryLoadError}
              onBackToIntro={onBackToIntro}
              onGovernmentStructureChange={handleGovernmentStructureChange}
              onGovernmentStructureSave={handleGovernmentStructureSave}
            />
          </Suspense>
        </div>
      ) : (
        <StepContent>
          <Suspense fallback={<BuilderStepLoading message="Loading builder step..." />}>
            <StepRenderer
              countries={countries}
              isLoadingCountries={isLoadingCountries}
              countryLoadError={countryLoadError}
              onBackToIntro={onBackToIntro}
              onGovernmentStructureChange={handleGovernmentStructureChange}
              onGovernmentStructureSave={handleGovernmentStructureSave}
            />
          </Suspense>
        </StepContent>
      )}

      <IntroDisclosure
        steps={enhancedTutorialSteps}
        featureId="builder-complete-tutorial"
        open={showTutorial}
        setOpen={setShowTutorial}
        onComplete={handleCompleteTutorial}
        onSkip={handleCompleteTutorial}
        showProgressBar={true}
      />

      <IntroDisclosure
        steps={enhancedQuickStartSteps}
        featureId="builder-quick-start"
        open={showQuickStart}
        setOpen={setShowQuickStart}
        onComplete={handleQuickStartNavigation}
        onSkip={handleCompleteQuickStart}
        showProgressBar={true}
      />

      {/* Save/Create Final Confirmation Modal with Verification Checkpoint */}
      <BuilderConfirmModal
        isOpen={isConfirmModalOpen}
        onOpenChange={setIsConfirmModalOpen}
        isEditMode={isEditMode}
        isSubmitting={isSubmitting}
        isVerified={isVerified}
        onVerifiedChange={setIsVerified}
        onSubmit={executeSubmitCountry}
        warnings={warnings}
      />
    </div>
  );
}

export function AtomicBuilderPage({
  onBackToIntro,
  mode = "create",
  countryId,
}: AtomicBuilderPageProps) {
  return <AtomicBuilderPageInner onBackToIntro={onBackToIntro} mode={mode} countryId={countryId} />;
}
