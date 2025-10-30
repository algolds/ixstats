"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { Lock, Unlock as UnlockIcon } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import type { RealCountryData } from "../../lib/economy-data-service";
import { parseEconomyData, createDefaultEconomicInputs } from "../../lib/economy-data-service";
import type { DepartmentInput, BudgetAllocationInput } from "~/types/government";
import { cn } from "~/lib/utils";
import { IntroDisclosure } from "~/components/ui/intro-disclosure";
import { builderTutorialSteps, quickStartSteps } from "../../data/onboarding-tutorial";
import { safeGetItemSync, safeRemoveItemSync } from "~/lib/localStorageMutex";
import { unifiedBuilderService } from "../../services/UnifiedBuilderIntegrationService";
import type { ComponentType as GovComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { ComponentType as PrismaComponentType } from "@prisma/client";

// Import modular architecture
import { BuilderStateProvider, useBuilderContext } from "./context/BuilderStateContext";
import { BuilderHeader, StepContent, BuilderFooter } from "./sections";
import { StepRenderer } from "./sections/StepRenderer";
import { StepIndicator } from "./StepIndicator";
import { SectionLoadingFallback } from "../LoadingFallback";
import { GlobalBuilderLoading, BuilderStepLoading } from "../GlobalBuilderLoading";
import { BUILDER_GOLD, BUILDER_GOLD_HOVER } from "./builderConfig";
import type { BuilderStep } from "./builderConfig";

/**
 * Props for the AtomicBuilderPage component
 *
 * @interface AtomicBuilderPageProps
 * @property {function} [onBackToIntro] - Optional callback to return to the intro/welcome screen
 * @property {'create' | 'edit'} [mode] - Builder mode: 'create' for new countries, 'edit' for existing
 * @property {string} [countryId] - Required when mode='edit' - ID of country to edit
 */
interface AtomicBuilderPageProps {
  onBackToIntro?: () => void;
  mode?: "create" | "edit";
  countryId?: string;
}

/**
 * AtomicBuilderPageInner - Core implementation of the multi-step country builder wizard
 *
 * This is the inner component that consumes the BuilderStateContext to access and manage
 * the builder state throughout the wizard flow. It handles step navigation, data loading,
 * tutorial management, country creation, and integration with government/tax subsystems.
 *
 * The builder follows a 7-step wizard flow:
 * 1. Foundation: Choose starting point (from scratch, from template, import from wiki)
 * 2. Core: Configure national identity, symbols, geography, and culture
 * 3. Component Selection: Select atomic economic and government components
 * 4. Economics: Configure economy sectors, labor market, demographics
 * 5. Government: Build government structure, departments, and budget
 * 6. Tax System: Design taxation structure with brackets and categories
 * 7. Preview: Review complete configuration before submission
 *
 * Key features:
 * - Context-based state management for seamless data sharing across steps
 * - Real-time synchronization between builder subsystems (economy, government, tax)
 * - Tutorial and quick-start guidance modes for new users
 * - Auto-save functionality with draft persistence in localStorage
 * - Authentication guard requiring Clerk login to access builder
 * - tRPC mutation for country creation with full data validation
 * - Unified builder service integration for cross-system synergies
 *
 * @component
 * @param {AtomicBuilderPageProps} props - Component props
 * @param {function} [props.onBackToIntro] - Callback to navigate back to the intro screen
 *
 * @returns {JSX.Element} Rendered builder wizard or authentication prompt
 */
function AtomicBuilderPageInner({
  onBackToIntro,
  mode = "create",
  countryId,
}: AtomicBuilderPageProps) {
  const { user } = useUser();
  const router = useRouter();
  const { builderState, setBuilderState, clearDraft } = useBuilderContext();
  const isEditMode = mode === "edit";

  // Country data state
  const [countries, setCountries] = useState<RealCountryData[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [countryLoadError, setCountryLoadError] = useState<string | null>(null);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [tutorialMode, setTutorialMode] = useState<string | null>(null);
  const quickStartProcessed = useRef(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Government structure handlers
  const handleGovernmentStructureChange = useCallback(
    (structure: any) => {
      setBuilderState((prev) => ({ ...prev, governmentStructure: structure }));
    },
    [setBuilderState]
  );

  const handleGovernmentStructureSave = useCallback(
    async (structure: any) => {
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
      } catch (error) {
        setCountryLoadError(error instanceof Error ? error.message : "Failed to load countries");
      } finally {
        setIsLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  // Track last processed government components to prevent loops
  const lastProcessedGovComponentsRef = useRef<string>("");

  // Update economic inputs when government components change
  useEffect(() => {
    if (builderState.economicInputs && builderState.governmentComponents.length > 0) {
      const componentsKey = JSON.stringify(builderState.governmentComponents);

      // Only update if government components actually changed
      if (componentsKey !== lastProcessedGovComponentsRef.current) {
        lastProcessedGovComponentsRef.current = componentsKey;

        const updatedInputs = { ...builderState.economicInputs };

        // Adjust tax rates based on government type
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
  }, [builderState.governmentComponents, setBuilderState]);

  // Track last processed government structure to prevent loops
  const lastProcessedGovStructureRef = useRef<string>("");

  // Sync government structure to economic inputs
  useEffect(() => {
    if (builderState.governmentStructure && builderState.economicInputs) {
      const structureKey = JSON.stringify(builderState.governmentStructure);

      // Only update if government structure actually changed
      if (structureKey !== lastProcessedGovStructureRef.current) {
        lastProcessedGovStructureRef.current = structureKey;

        const updatedInputs = { ...builderState.economicInputs };

        if (builderState.governmentStructure.structure?.totalBudget) {
          const totalBudget = builderState.governmentStructure.structure.totalBudget;
          const gdp = builderState.economicInputs.coreIndicators.nominalGDP;

          updatedInputs.governmentSpending = {
            ...updatedInputs.governmentSpending,
            totalSpending: totalBudget,
            spendingGDPPercent: gdp > 0 ? (totalBudget / gdp) * 100 : 35,
          };
        }

        if (
          builderState.governmentStructure.departments &&
          builderState.governmentStructure.budgetAllocations
        ) {
          updatedInputs.governmentSpending.spendingCategories =
            builderState.governmentStructure.departments.map(
              (dept: DepartmentInput, index: number) => {
                const allocation = builderState.governmentStructure.budgetAllocations.find(
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
  }, [builderState.governmentStructure, setBuilderState]);

  // Note: Unified Builder Integration is handled by useBuilderState hook
  // This prevents duplicate service updates and ensures consistent state management

  // Check for tutorial mode on mount
  useEffect(() => {
    const tutorialMode = safeGetItemSync("builder_tutorial_mode");
    if (tutorialMode) {
      setTutorialMode(tutorialMode);
      setTimeout(() => {
        if (tutorialMode === "full") {
          setShowTutorial(true);
        } else if (tutorialMode === "quick") {
          setShowQuickStart(true);
        }
        safeRemoveItemSync("builder_tutorial_mode");
      }, 1000);
    }
  }, []);

  // Create country mutation
  const createCountryMutation = (api.countries as any).createCountry?.useMutation({
    onSuccess: (country: any) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("builder_state");
          localStorage.removeItem("builder_last_saved");
        }
      } catch (error) {
        // Failed to clear saved state
      }
      router.push(createUrl(`/mycountry`));
    },
    onError: (error: any) => {
      setError(error instanceof Error ? error.message : "Failed to create country");
    },
  }) || {
    mutateAsync: async () => {
      throw new Error("Country creation is not available");
    },
    isLoading: false,
  };

  const handleCreateCountry = useCallback(async () => {
    if (!builderState.economicInputs || !user) {
      setError("Missing required data for country creation");
      return;
    }

    try {
      await createCountryMutation.mutateAsync({
        name: builderState.economicInputs.countryName || "New Nation",
        foundationCountry:
          builderState.selectedCountry?.name || builderState.selectedCountry?.countryCode || null,
        economicInputs: builderState.economicInputs,
        governmentComponents: builderState.governmentComponents,
        taxSystemData: builderState.taxSystemData,
        governmentStructure: builderState.governmentStructure,
        economyBuilderState: builderState.economyBuilderState || undefined,
      });
    } catch (error) {
      // Error handled by mutation's onError callback
    }
  }, [builderState, user, createCountryMutation]);

  // Tutorial handlers
  const handleCompleteTutorial = useCallback(() => {
    setShowTutorial(false);
    setTutorialMode(null);
  }, []);

  const handleCompleteQuickStart = useCallback(() => {
    setShowQuickStart(false);
    setTutorialMode(null);
  }, []);

  const handleQuickStartNavigation = useCallback(() => {
    setShowQuickStart(false);
    setTutorialMode(null);

    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("builder_state");
        localStorage.removeItem("builder_last_saved");
      }
    } catch (error) {
      // Failed to clear saved state
    }

    setBuilderState((prev) => ({
      ...prev,
      step: "core",
      activeCoreTab: "identity",
      economicInputs: prev.economicInputs || createDefaultEconomicInputs(),
      completedSteps: [...new Set([...prev.completedSteps, "foundation" as BuilderStep])],
    }));
  }, [setBuilderState]);

  // Enhanced tutorial steps
  const enhancedTutorialSteps = useMemo(
    () =>
      builderTutorialSteps.map((step, index) => ({
        ...step,
        action: step.action
          ? {
              ...step.action,
              onClick:
                index === builderTutorialSteps.length - 1
                  ? handleCompleteTutorial
                  : step.action.onClick,
            }
          : undefined,
      })),
    [handleCompleteTutorial]
  );

  const enhancedQuickStartSteps = useMemo(
    () =>
      quickStartSteps.map((step, index) => ({
        ...step,
        action: step.action
          ? {
              ...step.action,
              onClick:
                index === quickStartSteps.length - 1
                  ? handleQuickStartNavigation
                  : step.action.onClick,
            }
          : undefined,
      })),
    [handleQuickStartNavigation]
  );

  // Authentication guard
  if (!user) {
    return (
      <div className="from-background via-background flex min-h-screen items-center justify-center bg-gradient-to-br to-amber-50/20 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mx-auto max-w-md border-2 shadow-xl">
            <CardContent className="space-y-6 p-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
                <Lock className="h-10 w-10 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Authentication Required</h2>
                <p className="text-muted-foreground">
                  Sign in to access the MyCountry Builder and create your custom nation
                </p>
              </div>
              <Button
                onClick={() => router.push(createUrl("/sign-in"))}
                size="lg"
                className={cn("w-full bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
              >
                <UnlockIcon className="mr-2 h-4 w-4" />
                Sign In to Continue
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="from-background via-background min-h-screen bg-gradient-to-br to-amber-50/10">
      {/* Header */}
      <BuilderHeader onBackToIntro={onBackToIntro} onClearDraft={clearDraft} mode={mode} />

      <div className="container mx-auto px-4 py-8">
        {/* Step Progress Indicator */}
        <StepIndicator
          currentStep={builderState.step}
          completedSteps={builderState.completedSteps}
          onStepClick={(step) => setBuilderState((prev) => ({ ...prev, step }))}
        />

        {/* Main Content Area with Animations */}
        {builderState.step === "foundation" ? (
          // Foundation step is rendered without StepContent wrapper
          <motion.div
            key="foundation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
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
          </motion.div>
        ) : (
          // All other steps are wrapped in StepContent
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

            {/* Footer with navigation */}
            <BuilderFooter
              onCreateCountry={handleCreateCountry}
              isCreating={createCountryMutation?.isLoading}
            />
          </StepContent>
        )}
      </div>

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
    </div>
  );
}

/**
 * AtomicBuilderPage - Main country builder wizard component with state provider
 *
 * This is the top-level component for the MyCountry Builder wizard that wraps the entire
 * builder flow with the BuilderStateProvider context. It serves as the entry point for
 * both creating new countries and editing existing ones.
 *
 * The BuilderStateProvider handles:
 * - Centralized state for all builder steps (foundation, core, components, economics, government, tax, preview)
 * - Draft persistence and auto-save functionality in localStorage
 * - State synchronization across all builder subsystems
 * - Completed step tracking for progress indicators
 *
 * @component
 * @param {AtomicBuilderPageProps} props - Component props
 * @param {function} [props.onBackToIntro] - Optional callback to return to the welcome/intro screen
 * @param {'create' | 'edit'} [props.mode='create'] - Builder mode for creating or editing
 * @param {string} [props.countryId] - Country ID when editing (required if mode='edit')
 *
 * @returns {JSX.Element} Rendered builder wizard wrapped in BuilderStateProvider context
 *
 * @example
 * ```tsx
 * // Create mode
 * <AtomicBuilderPage
 *   mode="create"
 *   onBackToIntro={() => router.push('/builder')}
 * />
 *
 * // Edit mode
 * <AtomicBuilderPage
 *   mode="edit"
 *   countryId="country-123"
 *   onBackToIntro={() => router.push('/mycountry')}
 * />
 * ```
 */
export function AtomicBuilderPage({
  onBackToIntro,
  mode = "create",
  countryId,
}: AtomicBuilderPageProps) {
  return (
    <BuilderStateProvider mode={mode} countryId={countryId}>
      <AtomicBuilderPageInner onBackToIntro={onBackToIntro} mode={mode} countryId={countryId} />
    </BuilderStateProvider>
  );
}
