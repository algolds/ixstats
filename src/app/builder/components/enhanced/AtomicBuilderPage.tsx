"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import { isEqual } from "lodash";
import { motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { Lock, Unlock as UnlockIcon } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import type { RealCountryData } from "../../lib/economy-data-service";
import { parseEconomyData, createDefaultEconomicInputs } from "../../lib/economy-data-service";
import type {
  DepartmentInput,
  BudgetAllocationInput,
  GovernmentBuilderState,
} from "~/types/government";
import { cn } from "~/lib/utils";
import { IntroDisclosure } from "~/components/ui/intro-disclosure";
import { builderTutorialSteps, quickStartSteps } from "../../data/onboarding-tutorial";
import { safeGetItemSync, safeRemoveItemSync } from "~/lib/localStorageMutex";
import { ComponentType as PrismaComponentType } from "~/lib/enums";
import { useNotify } from "~/hooks/useNotify";

// Import modular architecture
import { useBuilderContext } from "./context/BuilderStateContext";
import { sanitizeEconomicInputs } from "../../hooks/useBuilderState";
import { StepContent } from "./sections";
import { StepRenderer } from "./sections/StepRenderer";
import { BuilderStepLoading } from "../GlobalBuilderLoading";
import type { BuilderStep } from "./builderConfig";
import { BuilderStepNav } from "../BuilderStepNav";
import type { BuilderSection } from "../../lib/builder-theme";

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
  const notify = useNotify();
  const { builderState, setBuilderState, registerSubmit, unregisterSubmit } = useBuilderContext();
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

  // Submission lock to prevent double-submits
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLockRef = useRef(false);

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
  const lastProcessedGovComponentsRef = useRef<PrismaComponentType[]>([]);

  // Update economic inputs when government components change
  // Phase 2 fix: Replaced JSON.stringify with isEqual for performance
  useEffect(() => {
    if (builderState.economicInputs && builderState.governmentComponents.length > 0) {
      // Only update if government components actually changed (using deep comparison)
      if (!isEqual(builderState.governmentComponents, lastProcessedGovComponentsRef.current)) {
        lastProcessedGovComponentsRef.current = [...builderState.governmentComponents];

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
  const lastProcessedGovStructureRef = useRef<GovernmentBuilderState | null>(null);

  // Sync government structure to economic inputs
  // Phase 2 fix: Replaced JSON.stringify with isEqual for performance
  useEffect(() => {
    const govStructure = builderState.governmentStructure;
    if (govStructure && builderState.economicInputs) {
      // Only update if government structure actually changed (using deep comparison)
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

      console.log("[Builder] Country created successfully:", country.name);

      // Show success toast
      notify.success(
        "Nation Created Successfully!",
        `Welcome to ${country.name}! Redirecting to your country dashboard...`
      );

      // Keep submission lock active during navigation to prevent double-clicks
      setTimeout(() => {
        router.push(createUrl(`/mycountry`));
      }, 1000);
    },
    onError: (error: any) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create country";
      setError(errorMessage);
      console.error("[Builder] Country creation failed:", errorMessage);

      // Show error toast with helpful guidance
      if (errorMessage.includes("already exists")) {
        notify.error(
          "Country Already Exists",
          "A country with this name already exists. Please choose a different name."
        );
      } else if (errorMessage.includes("no assigned role")) {
        notify.error(
          "Account Setup Required",
          "Your account needs to be configured. Please sign out and sign in again, or contact support."
        );
      } else {
        notify.error("Failed to Create Nation", errorMessage);
      }

      // Release submission lock on error
      submissionLockRef.current = false;
      setIsSubmitting(false);
    },
  }) || {
    mutateAsync: async () => {
      throw new Error("Country creation is not available");
    },
    isLoading: false,
  };

  // Update country mutation
  const updateCountryMutation = (api.countries as any).updateCountry?.useMutation({
    onSuccess: (country: any) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`builder_state_${countryId}`);
          localStorage.removeItem(`builder_last_saved_${countryId}`);
        }
      } catch (error) {
        // Failed to clear saved state
      }

      console.log("[Builder] Country updated successfully:", country.name);

      notify.success(
        "Country Updated Successfully!",
        `${country.name} has been updated. Redirecting to your dashboard...`
      );

      setTimeout(() => {
        router.push(createUrl(`/mycountry`));
      }, 1000);
    },
    onError: (error: any) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update country";
      setError(errorMessage);
      console.error("[Builder] Country update failed:", errorMessage);
      notify.error("Failed to Update Country", errorMessage);

      // Release submission lock on error
      submissionLockRef.current = false;
      setIsSubmitting(false);
    },
  }) || {
    mutateAsync: async () => {
      throw new Error("Country update is not available");
    },
    isLoading: false,
  };

  const handleCreateCountry = useCallback(async () => {
    // Prevent double-submit with ref-based lock
    if (submissionLockRef.current || isSubmitting) {
      console.warn(
        isEditMode
          ? "[Builder] Country update already in progress, ignoring duplicate request"
          : "[Builder] Country creation already in progress, ignoring duplicate request"
      );
      notify.warning(
        isEditMode ? "Update In Progress" : "Creation In Progress",
        isEditMode
          ? "Please wait while your country is being updated..."
          : "Please wait while your nation is being created..."
      );
      return;
    }

    if (!builderState.economicInputs || !user) {
      const errorMsg = "Missing required data for country " + (isEditMode ? "update" : "creation");
      setError(errorMsg);
      notify.error(
        "Incomplete Data",
        isEditMode
          ? "Please complete all required fields before updating your country."
          : "Please complete all required fields before creating your nation."
      );
      return;
    }

    try {
      // Set submission lock BEFORE any async operations
      submissionLockRef.current = true;
      setIsSubmitting(true);

      const formattedGovComps = builderState.governmentComponents.map((comp) => ({
        componentType: comp,
      }));

      if (isEditMode) {
        if (!countryId) {
          throw new Error("Missing country ID for update");
        }

        console.log("[Builder] Updating country:", builderState.economicInputs.countryName);

        notify.info(
          "Updating Your Country",
          "Applying your changes to the country, government, and economic systems..."
        );

        await updateCountryMutation.mutateAsync({
          id: countryId,
          name: builderState.economicInputs.countryName || "Updated Nation",
          economicInputs: sanitizeEconomicInputs(builderState.economicInputs),
          governmentComponents: formattedGovComps,
          taxSystemData: builderState.taxSystemData,
          governmentStructure: builderState.governmentStructure,
          economyBuilderState: builderState.economyBuilderState || undefined,
        });
      } else {
        console.log("[Builder] Creating country:", builderState.economicInputs.countryName);

        // Show initial progress toast
        notify.info(
          "Creating Your Nation",
          "Setting up your country, government, and economic systems..."
        );

        await createCountryMutation.mutateAsync({
          name: builderState.economicInputs.countryName || "New Nation",
          foundationCountry:
            builderState.selectedCountry?.name || builderState.selectedCountry?.countryCode || null,
          economicInputs: sanitizeEconomicInputs(builderState.economicInputs),
          governmentComponents: formattedGovComps,
          taxSystemData: builderState.taxSystemData,
          governmentStructure: builderState.governmentStructure,
          economyBuilderState: builderState.economyBuilderState || undefined,
          archetypeId: builderState.selectedArchetypeId || undefined,
        });
      }
    } catch (error) {
      // Error handled by mutation's onError callback
      // Release lock on error
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    builderState,
    user,
    createCountryMutation,
    updateCountryMutation,
    isSubmitting,
    isEditMode,
    countryId,
  ]);
  // Register the submit function and loading state with context
  useEffect(() => {
    const isMutating =
      createCountryMutation?.isLoading || updateCountryMutation?.isLoading || isSubmitting;
    registerSubmit(handleCreateCountry, !!isMutating);
    return () => {
      unregisterSubmit();
    };
  }, [
    handleCreateCountry,
    createCountryMutation?.isLoading,
    updateCountryMutation?.isLoading,
    isSubmitting,
    registerSubmit,
    unregisterSubmit,
  ]);
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
      activeIdentitySubTab: "symbols",
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
                className={cn(
                  "w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700"
                )}
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

  // Map BuilderStep to BuilderSection for step nav
  const stepToSection: Record<BuilderStep, BuilderSection> = {
    foundation: "foundation",
    core: "identity",
    government: "government",
    economics: "economics",
    preview: "preview",
  };

  const currentSection = stepToSection[builderState.step];

  const handleNavigateSection = useCallback(
    (section: BuilderSection) => {
      const sectionToStep: Record<BuilderSection, BuilderStep | undefined> = {
        foundation: "foundation",
        identity: "core",
        government: "government",
        economics: "economics",
        preview: "preview",
        import: undefined,
      };
      const targetStep = sectionToStep[section];
      if (targetStep) {
        setBuilderState((prev) => ({ ...prev, step: targetStep }));
      }
    },
    [setBuilderState]
  );

  const allSections = new Set<BuilderSection>([
    "foundation",
    "identity",
    "government",
    "economics",
    "preview",
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6">
      {/* Main Content Area with Animations */}
      {builderState.step === "foundation" && !isEditMode ? (
        // Foundation step is rendered without StepContent wrapper (only in create mode)
        <motion.div
          key="foundation"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex min-h-0 flex-1 flex-col"
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
  return <AtomicBuilderPageInner onBackToIntro={onBackToIntro} mode={mode} countryId={countryId} />;
}
