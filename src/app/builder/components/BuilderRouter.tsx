"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
// oxlint-disable-next-line eslint/no-unused-vars
import { Lock, LockSlash as UnlockIcon, ArrowRight } from "iconoir-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderStateProvider, useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { BuilderFilterProvider, useBuilderFilter } from "./builder-filter-context";
import { BuilderSidebarLayout } from "./BuilderSidebarLayout";
// oxlint-disable-next-line eslint/no-unused-vars
import { PreText } from "~/components/ui/pretext";
import { BuilderWelcomeModal } from "./BuilderWelcomeModal";
import { BuilderHalo } from "~/components/halo/plugins/builder";
import { ImportSection } from "./sections/ImportSection";
import { BuilderGuideProvider } from "./builder-guide-context";
import { BuilderGuideSheet } from "./BuilderGuideSheet";
import { BuilderStudioHeader } from "./BuilderStudioHeader";
import { BuilderStepFooter } from "./BuilderStepFooter";
import { BuilderResetConfirmDialog } from "./BuilderResetConfirmDialog";
import { SectionAlerts } from "../primitives/SectionAlert";
import { useBuilderActions } from "../hooks/useBuilderActions";
import { useBuilderAlerts } from "../hooks/useBuilderAlerts";
import { useStepCompletion } from "../hooks/useStepCompletion";
import { useBuilderKeyboardShortcuts } from "../hooks/useBuilderKeyboardShortcuts";
import {
  type BuilderSection,
  BUILD_STEPS,
  legacyStepToSection,
  sectionToLegacyStep,
  isScratchOrImportOrigin,
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
    if (mode === "edit" && section === "foundation") {
      return "identity";
    }
    return section as BuilderSection;
  }
  return mode === "edit" ? "identity" : "foundation";
}

function buildSectionUrl(section: BuilderSection, mode?: "create" | "edit"): string {
  if (mode === "edit") {
    if (section === "identity") return "/mycountry/editor";
    return `/mycountry/editor?section=${section}`;
  }
  if (section === "foundation") return "/mycountry/builder";
  return `/mycountry/builder?section=${section}`;
}

function WelcomeModalWrapper() {
  const { welcomeModalOpen, setWelcomeModalOpen } = useBuilderFilter();
  return (
    <BuilderWelcomeModal
      open={welcomeModalOpen}
      onOpenChange={setWelcomeModalOpen}
    />
  );
}

// ─── Inner Router (consumes BuilderStateContext) ───

function BuilderRouterInner({ mode = "create", countryId }: BuilderRouterProps) {
  const { user } = useUser();
  const router = useRouter();
  const {
    builderState,
    setBuilderState,
    submitFn,
    isSubmittingGlobal,
    applyImportedData,
    clearDraft,
  } = useBuilderContext();

  // Initialize section from URL - default to foundation/identity
  const [activeSection, setActiveSection] = useState<BuilderSection>(() => getSectionFromUrl(mode));
  const filter = useBuilderFilter();
  const { viewMode } = filter;
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const handleOpenResetDialog = useCallback(() => {
    setIsResetDialogOpen(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    clearDraft();
    if (mode === "edit") {
      router.push(createUrl("/mycountry"));
    } else {
      filter.clearSelection();
      setActiveSection("foundation");
      window.history.pushState(null, "", withBasePath(buildSectionUrl("foundation", mode)));
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setIsResetDialogOpen(false);
  }, [clearDraft, mode, router, filter]);

  const { handleContinue, handlePreviousStep } = useBuilderActions({
    builderState,
    setBuilderState,
    mode,
    viewMode,
  });

  const handleToggleAdvanced = useCallback(() => {
    if (mode === "edit") return;
    const nextIsAdvanced = !(builderState.showAdvancedMode || filter.viewMode === "expert");
    filter.setViewMode(nextIsAdvanced ? "expert" : "standard");
    setBuilderState((prev) => ({
      ...prev,
      showAdvancedMode: nextIsAdvanced,
    }));
  }, [mode, builderState.showAdvancedMode, filter, setBuilderState]);

  useBuilderKeyboardShortcuts({
    onSave: submitFn,
    onReset: handleOpenResetDialog,
    onToggleAdvanced: handleToggleAdvanced,
    isSubmitting: isSubmittingGlobal,
  });

  const [heroCollapsed, setHeroCollapsed] = useState(false);

  // Ref to track current builderState.step for use in callbacks without stale closures
  const builderStepRef = useRef(builderState.step);
  const initialUrlSyncRef = useRef(false);
  const prevStepRef = useRef(builderState.step);

  useEffect(() => {
    builderStepRef.current = builderState.step;
  }, [builderState.step]);

  // Sync builder state with the URL on first load so deep links work correctly.
  useEffect(() => {
    if (initialUrlSyncRef.current) return;
    if (activeSection !== "import") {
      const targetStep = sectionToLegacyStep(activeSection);
      if (targetStep !== builderState.step) {
        prevStepRef.current = targetStep as BuilderStep;
        setBuilderState((prev) => ({ ...prev, step: targetStep as BuilderStep }));
      }
    }
    initialUrlSyncRef.current = true;
  }, [activeSection, builderState.step, setBuilderState]);

  // Sync activeSection when builderState.step changes (handles clear button, footer nav, etc.)
  useEffect(() => {
    if (!initialUrlSyncRef.current) return;
    if (prevStepRef.current !== builderState.step) {
      prevStepRef.current = builderState.step;
      const mappedSection = legacyStepToSection(builderState.step) as BuilderSection;
      if (
        activeSection !== "import" &&
        mappedSection !== activeSection &&
        BUILD_STEPS.includes(mappedSection)
      ) {
        setActiveSection(mappedSection);
        window.history.pushState(null, "", withBasePath(buildSectionUrl(mappedSection, mode)));
        document.title = `${SECTION_TITLES[mappedSection]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;
      }
    }
  }, [builderState.step, activeSection, mode]);

  const isScratchOrImport = useMemo(
    () => isScratchOrImportOrigin(builderState),
    [builderState]
  );

  // Compute completed and accessible steps from builder state
  const completedSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    for (const step of builderState.completedSteps) {
      if ((mode === "edit" || isScratchOrImport) && step === "foundation") continue;
      set.add(legacyStepToSection(step));
    }
    return set;
  }, [builderState.completedSteps, mode, isScratchOrImport]);

  useStepCompletion(completedSteps, SECTION_TITLES, BUILD_STEPS.length);

  const accessibleSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    if (mode === "edit") {
      // In edit mode, all sections except foundation are accessible
      for (const step of BUILD_STEPS) {
        if (step === "foundation") continue;
        set.add(step);
      }
      return set;
    }

    if (isScratchOrImport) {
      // In scratch/import mode, all sections except foundation are accessible
      set.add("identity");
      set.add("government");
      set.add("economics");
      set.add("preview");
      if (activeSection === "import") {
        set.add("import");
      }
      return set;
    }

    set.add("foundation");
    set.add(activeSection); // The current section is always accessible

    // In create mode:
    // 1. Any completed steps are accessible
    for (const completedSection of completedSteps) {
      set.add(completedSection);
    }

    // 2. Any step that comes before the active section in the order is always accessible
    const activeIndex = BUILD_STEPS.indexOf(activeSection);
    if (activeIndex !== -1) {
      for (let i = 0; i <= activeIndex; i++) {
        set.add(BUILD_STEPS[i]!);
      }
    }

    // 3. Once foundation is completed (unlocked), all other steps are freely accessible
    if (completedSteps.has("foundation")) {
      set.add("identity");
      set.add("government");
      set.add("economics");
      set.add("preview");
    }

    if (activeSection === "import") {
      set.add("import");
    }
    return set;
  }, [completedSteps, mode, activeSection, isScratchOrImport]);

  // Navigate to a section — also briefly flashes the section name in DI
  const handleNavigate = useCallback(
    (section: BuilderSection) => {
      if (mode === "edit" && section === "foundation") return;
      if (section === activeSection) return;

      setActiveSection(section);

      // Sync URL
      window.history.pushState(null, "", withBasePath(buildSectionUrl(section, mode)));

      // Update document title
      document.title = `${SECTION_TITLES[section]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });

      // Sync the legacy builder state using ref to avoid stale closure
      if (section !== "import") {
        const legacyStep = sectionToLegacyStep(section);
        if (BUILD_STEPS.includes(section) && legacyStep !== builderStepRef.current) {
          prevStepRef.current = legacyStep as BuilderStep;
          setBuilderState((prev) => ({
            ...prev,
            step: legacyStep as BuilderStep,
            completedSteps: [...new Set([...prev.completedSteps, builderStepRef.current])],
          }));
        }
      }
    },
    [activeSection, setBuilderState, mode]
  );

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromUrl(mode);
      setActiveSection(newSection);
      // Keep builderState.step in lockstep — otherwise the renderer sees a step
      // that doesn't match the section and can fall through to a blank (this was
      // the "Foundation is blank when going back" bug).
      if (newSection !== "import") {
        const legacyStep = sectionToLegacyStep(newSection);
        prevStepRef.current = legacyStep as BuilderStep;
        setBuilderState((prev) =>
          prev.step === legacyStep ? prev : { ...prev, step: legacyStep as BuilderStep }
        );
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [mode, setBuilderState]);

  // Set initial page title
  useEffect(() => {
    document.title = `${SECTION_TITLES[activeSection]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;
  }, [activeSection, mode]);

  // Guard against landing on foundation when in scratch or import mode
  useEffect(() => {
    if (isScratchOrImport && activeSection === "foundation") {
      setActiveSection("identity");
      prevStepRef.current = "core";
      setBuilderState((prev) => (prev.step === "core" ? prev : { ...prev, step: "core" }));
      window.history.pushState(null, "", withBasePath(buildSectionUrl("identity", mode)));
    }
  }, [isScratchOrImport, activeSection, mode, setBuilderState]);



  // Manual save now lives in the Dynamic Island (BuilderDIPlugin → triggerManualSave).

  // Unified alert system — pure derivation from builder state
  const alertResult = useBuilderAlerts({
    economyBuilderState: builderState.economyBuilderState ?? null,
    selectedEconomicComponents: builderState.economyBuilderState?.selectedAtomicComponents ?? [],
    governmentStructure: builderState.governmentStructure ?? null,
    nominalGDP: builderState.economicInputs?.coreIndicators?.nominalGDP ?? 0,
    taxSystemData: builderState.taxSystemData ?? null,
    nationalIdentity: builderState.economicInputs?.nationalIdentity
      ? {
          countryName: builderState.economicInputs.nationalIdentity.countryName,
          capitalCity: builderState.economicInputs.nationalIdentity.capitalCity,
        }
      : null,
  });

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

  // Render the active section
  const renderSection = () => {
    if (activeSection === "import") {
      return (
        <ImportSection
          onNavigate={handleNavigate}
          onImportComplete={(imported) => {
            if (imported) {
              applyImportedData(imported);
            }
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

    return mainContent;
  };

  // Always use sidebar layout now (no welcome screen)
  return (
    <BuilderGuideProvider currentSection={activeSection}>
      <BuilderHalo />
      <WelcomeModalWrapper />
      <BuilderGuideSheet />
      <div className="relative flex min-h-screen w-full flex-1 flex-col">
        {/* Tactile Paper Texture Background Overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 select-none opacity-[0.06] dark:opacity-[0.04]"
          style={{
            backgroundImage: `url(${withBasePath("/textures/groovepaper.png")})`,
            backgroundRepeat: "repeat",
          }}
        />
        <BuilderSidebarLayout
          activeSection={activeSection}
          onNavigate={handleNavigate}
          completedSteps={completedSteps}
          accessibleSteps={accessibleSteps}
          mode={mode}
          heroCollapsed={heroCollapsed}
          onHeroExpand={() => setHeroCollapsed(false)}
          heroSection={null}
          onReset={handleOpenResetDialog}
          alerts={
            alertResult.forSection(activeSection).length > 0 ? (
              <SectionAlerts alerts={alertResult.forSection(activeSection)} />
            ) : null
          }
          studioHeader={
            activeSection !== "foundation" &&
            activeSection !== "import" && (
              <BuilderStudioHeader
                activeSection={activeSection}
                completedSteps={completedSteps}
                accessibleSteps={accessibleSteps}
                mode={mode}
                onNavigate={handleNavigate}
                onBack={handlePreviousStep}
                onContinue={handleContinue}
                onSubmit={submitFn ?? undefined}
                isSubmitting={isSubmittingGlobal}
                alertResult={alertResult}
                onReset={handleOpenResetDialog}
              />
            )
          }
          stepFooter={
            activeSection !== "foundation" &&
            activeSection !== "import" && (
              <BuilderStepFooter
                activeSection={activeSection}
                mode={mode}
                onNavigate={handleNavigate}
                onBack={handlePreviousStep}
                onContinue={handleContinue}
                onSubmit={submitFn ?? undefined}
                isSubmitting={isSubmittingGlobal}
                onReset={handleOpenResetDialog}
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
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="flex h-full min-h-0 w-full flex-1 flex-col"
            >
              <Suspense fallback={<SectionSkeleton />}>{renderSection()}</Suspense>
            </motion.div>
          </AnimatePresence>
        </BuilderSidebarLayout>
      </div>
      <BuilderResetConfirmDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        mode={mode}
        onConfirm={handleConfirmReset}
      />
    </BuilderGuideProvider>
  );
}

// ─── Exported Router (provides BuilderStateContext) ───

export function BuilderRouter({ mode = "create", countryId }: BuilderRouterProps) {
  return (
    <BuilderErrorBoundary>
      <BuilderStateProvider mode={mode} countryId={countryId}>
        <BuilderFilterProvider>
          <BuilderRouterInner mode={mode} countryId={countryId} />
        </BuilderFilterProvider>
      </BuilderStateProvider>
    </BuilderErrorBoundary>
  );
}
