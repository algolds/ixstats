"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { Lock, Unlock as UnlockIcon, Globe, Flag, Building2, TrendingUp, CheckCircle, Check, X, ChevronRight, Download, Loader2, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderStateProvider, useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { BuilderFilterProvider } from "./builder-filter-context";
import { BuilderSidebarLayout } from "./BuilderSidebarLayout";
import { useDIPlugin } from "~/components/DynamicIsland";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { PreText } from "~/components/ui/pretext";
import { BuilderSectionHero } from "./BuilderSectionHero";
import { ImportSection } from "./sections/ImportSection";
import { BuilderIntegrationSidebar } from "./enhanced/BuilderIntegrationSidebar";
import { useBuilderActions } from "../hooks/useBuilderActions";
import {
  type BuilderSection,
  BUILD_STEPS,
  legacyStepToSection,
  sectionToLegacyStep,
} from "../lib/builder-theme";
import type { BuilderStep } from "./enhanced/builderConfig";
import { withBasePath } from "~/lib/base-path";

// ─── Section loading skeleton ───

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 rounded bg-emerald-500/5" />
      <div className="h-64 rounded-xl bg-emerald-500/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 rounded-lg bg-emerald-500/5" />
        <div className="h-32 rounded-lg bg-emerald-500/5" />
      </div>
    </div>
  );
}

// ─── Lazy-loaded sections ───

// The existing AtomicBuilderPage inner content will be rendered for build steps
const AtomicBuilderInner = dynamic(
  () => import("./enhanced/AtomicBuilderPage").then((m) => ({ default: m.AtomicBuilderPage })),
  { loading: () => <SectionSkeleton /> }
);

// ─── Section title map ───

const SECTION_TITLES: Record<BuilderSection, string> = {
  foundation: "Foundation",
  identity: "National Identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview & Create",
  import: "Import from Wiki",
};

interface BuilderRouterProps {
  mode?: "create" | "edit";
  countryId?: string;
}

// ─── URL helpers ───

function getSectionFromUrl(mode?: "create" | "edit"): BuilderSection {
  if (typeof window === "undefined") return mode === "edit" ? "identity" : "foundation";
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section && (section === "import" || SECTION_TITLES[section as BuilderSection])) {
    return section as BuilderSection;
  }
  return mode === "edit" ? "identity" : "foundation";
}

function buildSectionUrl(section: BuilderSection, mode?: "create" | "edit"): string {
  if (mode === "edit") {
    if (section === "identity") return "/mycountry/editor";
    return `/mycountry/editor?section=${section}`;
  }
  if (section === "foundation") return "/builder";
  return `/builder?section=${section}`;
}

// ─── Inner Router (consumes BuilderStateContext) ───

function BuilderRouterInner({ mode = "create", countryId }: BuilderRouterProps) {
  const { user } = useUser();
  const router = useRouter();
  const {
    builderState,
    setBuilderState,
    clearDraft,
    lastSaved,
    isAutoSaving,
    foundationPreviewCountry,
    submitFn,
    isSubmittingGlobal,
  } = useBuilderContext();

  // Initialize section from URL - default to foundation/identity
  const [activeSection, setActiveSection] = useState<BuilderSection>(() => getSectionFromUrl(mode));

  const { handleContinue, handlePreviousStep } = useBuilderActions({
    builderState,
    setBuilderState,
    mode,
  });

  const previewFlag = foundationPreviewCountry?.flag || foundationPreviewCountry?.flagUrl;
  const rawFlagUrl = activeSection === "foundation"
    ? previewFlag || builderState.economicInputs?.flagUrl || builderState.selectedCountry?.flag
    : builderState.economicInputs?.flagUrl || builderState.selectedCountry?.flag;
  const countryFlagUrl = rawFlagUrl?.replace("flagcdn.com/w320/", "flagcdn.com/w1280/");
  const [heroCollapsed, setHeroCollapsed] = useState(false);

  // Ref to track current builderState.step for use in callbacks without stale closures
  const builderStepRef = useRef(builderState.step);
  const initialUrlSyncRef = useRef(false);

  useEffect(() => {
    builderStepRef.current = builderState.step;
  }, [builderState.step]);

  // Sync builder state with the URL on first load so deep links work correctly.
  useEffect(() => {
    if (initialUrlSyncRef.current) return;
    if (activeSection !== "import") {
      const targetStep = sectionToLegacyStep(activeSection);
      if (targetStep !== builderState.step) {
        setBuilderState((prev) => ({ ...prev, step: targetStep as BuilderStep }));
      }
    }
    initialUrlSyncRef.current = true;
  }, [activeSection, builderState.step, setBuilderState]);

  // Sync activeSection when builderState.step changes (handles clear button, footer nav, etc.)
  useEffect(() => {
    if (!initialUrlSyncRef.current) return;
    const mappedSection = legacyStepToSection(builderState.step) as BuilderSection;
    if (activeSection !== "import" && mappedSection !== activeSection && BUILD_STEPS.includes(mappedSection)) {
      setActiveSection(mappedSection);
      window.history.pushState(null, "", withBasePath(buildSectionUrl(mappedSection, mode)));
      document.title = `${SECTION_TITLES[mappedSection]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;
    }
  }, [builderState.step, activeSection, mode]);

  // Advanced mode state
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  // Manual save state
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Compute completed and accessible steps from builder state
  const completedSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    for (const step of builderState.completedSteps) {
      if (mode === "edit" && step === "foundation") continue;
      set.add(legacyStepToSection(step));
    }
    return set;
  }, [builderState.completedSteps, mode]);

  const accessibleSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    if (mode !== "edit") {
      set.add("foundation");
    }
    // Other steps accessible if previous steps completed
    const stepOrder = mode === "edit" ? BUILD_STEPS.filter((s) => s !== "foundation") : BUILD_STEPS;
    for (let i = 0; i < stepOrder.length; i++) {
      set.add(stepOrder[i]!);
      // If this step isn't completed, stop making further steps accessible
      // UNLESS we're in a more permissive mode
      if (i > 0 && !completedSteps.has(stepOrder[i - 1]!)) {
        // Allow the current step but not beyond
        break;
      }
    }
    // Also allow preview if we have economic inputs (user has started building)
    if (builderState.economicInputs) {
      set.add("preview");
    }
    return set;
  }, [completedSteps, builderState.economicInputs, mode]);

  const activeStepsCount = mode === "edit" ? BUILD_STEPS.length - 1 : BUILD_STEPS.length;
  const completionPercent = useMemo(() => {
    const activeSteps = BUILD_STEPS.filter((s) => mode !== "edit" || s !== "foundation");
    const completed = activeSteps.filter((s) => completedSteps.has(s)).length;
    return Math.round((completed / activeSteps.length) * 100);
  }, [completedSteps, mode]);

  // Navigate to a section
  const handleNavigate = useCallback(
    (section: BuilderSection) => {
      if (section === activeSection) return;

      setActiveSection(section);

      // Sync URL
      window.history.pushState(null, "", withBasePath(buildSectionUrl(section, mode)));

      // Update document title
      document.title = `${SECTION_TITLES[section]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });

      // Sync the legacy builder state using ref to avoid stale closure
      // Skip for import section since it's not a builder step
      if (section !== "import") {
        const legacyStep = sectionToLegacyStep(section);
        if (BUILD_STEPS.includes(section) && legacyStep !== builderStepRef.current) {
          setBuilderState((prev) => ({ ...prev, step: legacyStep as BuilderStep }));
        }
      }
    },
    [activeSection, setBuilderState, mode]
  );

  // Step navigation expanded view for Dynamic Island
  const StepNavView = useMemo(() => {
    return function StepNavView({ onClose }: { onClose: () => void }) {
      const steps = mode === "edit"
        ? (["identity", "government", "economics", "preview"] as BuilderSection[])
        : (["foundation", "identity", "government", "economics", "preview"] as BuilderSection[]);

      const stepIcons: Record<BuilderSection, any> = {
        foundation: Globe,
        identity: Flag,
        government: Building2,
        economics: TrendingUp,
        preview: CheckCircle,
        import: Download,
      };

      const stepLabels: Record<BuilderSection, string> = {
        foundation: "Foundation",
        identity: "Identity",
        government: "Government",
        economics: "Economics",
        preview: "Preview",
        import: "Import",
      };

      const subStepsConfig: Record<BuilderSection, Array<{ id: string; label: string }>> = {
        foundation: [],
        identity: [
          { id: "basic", label: "Basic Info" },
          { id: "culture", label: "Culture" },
          { id: "technical", label: "Technical" },
          { id: "indicators", label: "Indicators" }
        ],
        government: [
          { id: "components", label: "Gov Components" },
          { id: "structure", label: "Gov Builder" },
          { id: "spending", label: "Policies" },
          { id: "preview", label: "Preview" }
        ],
        economics: [
          { id: "taxes", label: "Tax System" },
          { id: "sectors", label: "Economy Sectors" },
          { id: "labor", label: "Labor" },
          { id: "demographics", label: "Demographics" }
        ],
        preview: [],
        import: []
      };

      const isSubStepActive = (stepKey: BuilderSection, subId: string) => {
        if (stepKey === "identity") {
          if (subId === "indicators") return builderState.activeCoreTab === "indicators";
          return builderState.activeCoreTab === "identity" && (builderState.activeIdentitySubTab || "basic") === subId;
        }
        if (stepKey === "government") {
          return (builderState.activeGovernmentTab || "components") === subId;
        }
        if (stepKey === "economics") {
          if (subId === "taxes") return builderState.activeEconomicsTab === "taxes" || builderState.activeEconomicsTab === "tax";
          if (subId === "sectors") return builderState.activeEconomicsTab === "sectors" || builderState.activeEconomicsTab === "economy";
          return builderState.activeEconomicsTab === subId;
        }
        return false;
      };

      const handleSubStepClick = (stepKey: BuilderSection, subId: string) => {
        setBuilderState((prev) => {
          const updates: any = {};
          if (stepKey === "identity") {
            if (subId === "indicators") {
              updates.activeCoreTab = "indicators";
            } else {
              updates.activeCoreTab = "identity";
              updates.activeIdentitySubTab = subId;
            }
          } else if (stepKey === "government") {
            updates.activeGovernmentTab = subId;
          } else if (stepKey === "economics") {
            updates.activeEconomicsTab = subId;
          }
          return { ...prev, ...updates };
        });
        handleNavigate(stepKey);
        onClose();
      };

      const currentSubSteps = subStepsConfig[activeSection] || [];
      const isBackDisabled = activeSection === "foundation" || (mode === "edit" && activeSection === "identity");

      return (
        <div className="p-4 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MyCountryLogo size="md" mode={mode} animated={false} />
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>


          {/* Steps List */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {steps.map((stepKey) => {
              const isActive = stepKey === activeSection;
              const isCompleted = completedSteps.has(stepKey);
              const isAccessible = accessibleSteps.has(stepKey);
              const StepIcon = stepIcons[stepKey];
              const label = stepLabels[stepKey];

              const handleClick = () => {
                if (!isAccessible) return;
                
                if (stepKey === "identity") {
                  setBuilderState((prev) => ({
                    ...prev,
                    activeCoreTab: prev.activeCoreTab || "identity",
                    activeIdentitySubTab: prev.activeIdentitySubTab || "basic",
                  }));
                } else if (stepKey === "government") {
                  setBuilderState((prev) => ({
                    ...prev,
                    activeGovernmentTab: prev.activeGovernmentTab || "components",
                  }));
                } else if (stepKey === "economics") {
                  setBuilderState((prev) => ({
                    ...prev,
                    activeEconomicsTab: prev.activeEconomicsTab || "tax",
                  }));
                }

                handleNavigate(stepKey);
                onClose();
              };

              return (
                <button
                  key={stepKey}
                  disabled={!isAccessible}
                  onClick={handleClick}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 gap-1.5 relative overflow-hidden group select-none cursor-pointer",
                    isActive
                      ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5 text-amber-400 font-bold"
                      : isCompleted
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                        : isAccessible
                          ? "bg-white/5 border-white/10 text-foreground/80 hover:bg-white/10 hover:border-white/20 hover:text-foreground"
                          : "bg-black/20 border-white/5 text-muted-foreground/45 cursor-not-allowed opacity-50"
                  )}
                >
                  <div className="relative">
                    <StepIcon className={cn("h-5 w-5 shrink-0", isActive ? "text-amber-400" : isCompleted ? "text-emerald-400" : "text-foreground/60")} />
                    {isCompleted && !isActive && (
                      <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border border-black shadow">
                        <Check className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <PreText className="text-[10px] tracking-wide font-semibold mt-1" whiteSpace="nowrap">
                    {label}
                  </PreText>

                  {!isAccessible && (
                    <div className="absolute top-1.5 right-1.5">
                      <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-steps Horizontally Scrollable Bar */}
          {currentSubSteps.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
             
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" style={{ scrollbarWidth: "none" }}>
                {currentSubSteps.map((sub) => {
                  const isActive = isSubStepActive(activeSection, sub.id);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleSubStepClick(activeSection, sub.id)}
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer",
                        isActive
                          ? activeSection === "identity"
                            ? "bg-teal-500/10 border-teal-500/40 text-teal-400 shadow-sm"
                            : activeSection === "government"
                              ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-sm"
                              : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20 hover:text-foreground"
                      )}
                    >
                      <PreText whiteSpace="nowrap">{sub.label}</PreText>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
            <button
              onClick={handlePreviousStep}
              disabled={isBackDisabled}
              className="hover:bg-white/10 bg-white/5 border border-white/10 text-foreground flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <PreText whiteSpace="nowrap">Back</PreText>
            </button>

            {activeSection === "preview" && submitFn ? (
              <button
                onClick={submitFn}
                disabled={isSubmittingGlobal}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-5 text-xs font-bold text-white shadow-sm transition-all border border-transparent",
                  isSubmittingGlobal
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-400"
                    : mode === "edit"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                )}
              >
                {isSubmittingGlobal ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <PreText whiteSpace="nowrap">{mode === "edit" ? "Updating..." : "Creating..."}</PreText>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <PreText whiteSpace="nowrap">{mode === "edit" ? "Update Country" : "Create My Nation"}</PreText>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleContinue}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-4.5 text-xs font-bold text-zinc-950 transition-all hover:from-amber-600 hover:to-yellow-600 border border-transparent"
              >
                <PreText whiteSpace="nowrap" className="text-zinc-950">Continue</PreText>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-950" />
              </button>
            )}
          </div>
        </div>
      );
    };
  }, [activeSection, completionPercent, completedSteps, accessibleSteps, handleNavigate, mode, setBuilderState, builderState, handlePreviousStep, handleContinue, submitFn, isSubmittingGlobal]);

  // Register Dynamic Island plugin for builder page
  const diPlugin = useMemo(
    () => ({
      id: "builder",
      priority: 100, // override other plugins
      center: (
        <span className="flex items-center gap-1.5">
          <MyCountryLogo size="sm" mode={mode} animated={false} />
        </span>
      ),
      expandedViews: {
        stepNav: StepNavView,
      },
      accentColor: mode === "edit" ? "#f59e0b" : "#10b981",
      stickyLabel: mode === "edit" ? "Country Editor" : "Country Builder",
    }),
    [mode, StepNavView]
  );

  useDIPlugin(diPlugin);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromUrl(mode);
      setActiveSection(newSection);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [mode]);

  // Set initial page title
  useEffect(() => {
    document.title = `${SECTION_TITLES[activeSection]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;
  }, [activeSection, mode]);

  // Handle import completion
  const handleImportComplete = useCallback(
    (data: any) => {
      // Import data is stored in localStorage by ImportSection
      // Navigate to identity to continue building
      handleNavigate("identity");
    },
    [handleNavigate]
  );

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    setIsManualSaving(true);
    try {
      // Trigger a sync - the context handles the actual save
      // For now just wait a bit to show the save indicator
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsManualSaving(false);
    }
  }, []);

  // Toggle advanced mode
  const handleToggleAdvanced = useCallback(() => {
    setIsAdvancedMode((prev) => !prev);
    setBuilderState((prev) => ({ ...prev, showAdvancedMode: !prev.showAdvancedMode }));
  }, [setBuilderState]);

  // Auth guard - using MyCountry gold theme
  if (!user) {
    return (
      <div className="from-background via-background flex h-full items-center justify-center bg-gradient-to-br to-amber-50/20 p-4 dark:to-amber-950/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mx-auto max-w-md border-2 border-amber-500/20 shadow-xl">
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
                  "w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
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

  // Country name from builder state
  const countryName = builderState.economicInputs?.countryName;

  // Render the active section
  const renderSection = () => {
    if (activeSection === "import") {
      return (
        <ImportSection
          onNavigate={handleNavigate}
          onImportComplete={(data) => {
            handleNavigate("identity");
          }}
        />
      );
    }

    const mainContent = (
      <AtomicBuilderInner
        onBackToIntro={() => {
          if (mode === "edit") {
            router.push(createUrl("/mycountry"));
          } else {
            handleNavigate("foundation");
          }
        }}
        mode={mode}
        countryId={countryId}
      />
    );

    const isComplex = activeSection === "government" || activeSection === "economics";

    if (isComplex) {
      return (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main content forms (2/3 width) */}
          <div className="space-y-4 lg:col-span-2">{mainContent}</div>

          {/* Right Integration Sidebar widget (1/3 width) */}
          <div className="space-y-4 md:sticky md:top-6 md:self-start lg:col-span-1">
            <BuilderIntegrationSidebar
              selectedComponents={builderState.economyBuilderState?.selectedAtomicComponents || []}
              governmentComponents={
                builderState.governmentComponents?.map((c: any) =>
                  typeof c === "string" ? c : c.id || c.name || ""
                ) || []
              }
            />
          </div>
        </div>
      );
    }

    return mainContent;
  };

  // Always use sidebar layout now (no welcome screen)
  return (
    <BuilderFilterProvider onNavigate={handleNavigate}>
      <div className="relative w-full min-h-screen">
        {/* Dynamic Background Flag for non-foundation steps */}
        {activeSection !== "foundation" && countryFlagUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
            <div
              className="absolute inset-x-0 top-0 h-[60vh] bg-center bg-no-repeat bg-cover saturate-50 opacity-[0.08] blur-[2px]"
              style={{
                backgroundImage: `url(${countryFlagUrl})`,
                maskImage: "linear-gradient(to bottom, black 20%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 20%, transparent 100%)",
              }}
            />
          </div>
        )}
        <BuilderSidebarLayout
          activeSection={activeSection}
          onNavigate={handleNavigate}
          completedSteps={completedSteps}
          accessibleSteps={accessibleSteps}
          mode={mode}
          heroCollapsed={heroCollapsed}
          onHeroExpand={() => setHeroCollapsed(false)}
          heroSection={
            !heroCollapsed && activeSection === "foundation" && (
              <BuilderSectionHero
                section={activeSection}
                mode={mode}
                countryId={countryId}
                onNavigate={handleNavigate}
              />
            )
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<SectionSkeleton />}>{renderSection()}</Suspense>
            </motion.div>
          </AnimatePresence>
        </BuilderSidebarLayout>
      </div>
    </BuilderFilterProvider>
  );
}

// ─── Exported Router (provides BuilderStateContext) ───

export function BuilderRouter({ mode = "create", countryId }: BuilderRouterProps) {
  return (
    <BuilderErrorBoundary>
      <BuilderStateProvider mode={mode} countryId={countryId}>
        <BuilderRouterInner mode={mode} countryId={countryId} />
      </BuilderStateProvider>
    </BuilderErrorBoundary>
  );
}
