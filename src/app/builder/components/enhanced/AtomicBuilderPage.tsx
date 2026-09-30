"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import { isEqual } from "~/lib/utils";
import { motion } from "motion/react";
import { createUrl } from "~/lib/utils";
import type { RealCountryData } from "../../lib/economy-data-service";
import { parseEconomyData } from "../../lib/economy-data-service";
import type {
  DepartmentInput,
  BudgetAllocationInput,
  GovernmentBuilderState,
} from "~/types/government";
import { cn } from "~/lib/utils";
import { IntroDisclosure } from "~/components/ui/intro-disclosure";
import { ComponentType as PrismaComponentType } from "~/lib/enums";
import { computeGovernmentWarnings } from "./government-preview/governmentWarnings";

// Import modular architecture
import { useBuilderContext } from "./context/BuilderStateContext";
import { StepContent } from "./sections";
import { StepRenderer } from "./sections/StepRenderer";
import { BuilderStepLoading } from "../GlobalBuilderLoading";
import {
  useBuilderSubmit,
  BuilderConfirmModal,
  useBuilderTutorials,
} from "./atomic-builder";

export interface AtomicBuilderPageProps {
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

  // Track last processed government components to prevent loops
  const lastProcessedGovComponentsRef = useRef<PrismaComponentType[]>([]);

  // Update economic inputs when government components change
  useEffect(() => {
    if (builderState.governmentComponents === lastProcessedGovComponentsRef.current) return;
    if (builderState.economicInputs && builderState.governmentComponents.length > 0) {
      if (!isEqual(builderState.governmentComponents, lastProcessedGovComponentsRef.current)) {
        lastProcessedGovComponentsRef.current = builderState.governmentComponents;

        const updatedInputs = { ...builderState.economicInputs };

        if (builderState.governmentComponents.includes("SOCIAL_DEMOCRACY" as PrismaComponentType)) {
          updatedInputs.fiscalSystem.taxRevenueGDPPercent = Math.min(
            updatedInputs.fiscalSystem.taxRevenueGDPPercent * 1.2,
            60
          );
          updatedInputs.governmentSpending.totalSpending = Math.max(
            updatedInputs.governmentSpending.totalSpending,
            25
          );
        }

        if (
          builderState.governmentComponents.includes("FREE_MARKET_SYSTEM" as PrismaComponentType)
        ) {
          updatedInputs.fiscalSystem.taxRevenueGDPPercent = Math.max(
            updatedInputs.fiscalSystem.taxRevenueGDPPercent * 0.8,
            15
          );
        }

        setBuilderState((prev) => ({ ...prev, economicInputs: updatedInputs }));
      }
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

        const updatedInputs = { ...builderState.economicInputs };

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
      {/* Main Content Area */}
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

      {/* Tutorial Intro Disclosure Components */}
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
