"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Lock, Unlock as UnlockIcon, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderStateProvider, useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { BuilderFilterProvider, useBuilderFilter } from "./builder-filter-context";
import { BuilderSidebarLayout } from "./BuilderSidebarLayout";
import { BuilderHalo } from "~/components/halo/plugins";
// eslint-disable-next-line unused-imports/no-unused-imports
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
// eslint-disable-next-line unused-imports/no-unused-imports
import { PreText } from "~/components/ui/pretext";
import { BuilderWelcomeModal } from "./BuilderWelcomeModal";
import { ImportSection } from "./sections/ImportSection";
import { BuilderNotchBar } from "./BuilderNotchBar";
import { useBuilderActions } from "../hooks/useBuilderActions";
import { useBuilderAlerts } from "../hooks/useBuilderAlerts";
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
  if (section === "foundation") return "/builder";
  return `/builder?section=${section}`;
}

function WelcomeModalWrapper() {
  const { welcomeModalOpen, setWelcomeModalOpen, triggerDIExpansion } = useBuilderFilter();
  return (
    <BuilderWelcomeModal
      open={welcomeModalOpen}
      onOpenChange={(open) => {
        setWelcomeModalOpen(open);
        if (!open) {
          triggerDIExpansion();
        }
      }}
    />
  );
}

// ─── Inner Router (consumes BuilderStateContext) ───

/**
 * Upgrades a flag URL to a high-resolution or SVG version if it is from FlagCDN or Wikimedia Commons.
 */
function getHighResFlagUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;

  // 1. Upgrade flagcdn.com thumbnail to SVG
  // e.g., https://flagcdn.com/w320/us.png -> https://flagcdn.com/us.svg
  if (url.includes("flagcdn.com")) {
    return url.replace(/\/w\d+\/([a-z0-9_-]+)\.(png|jpg|jpeg|gif|webp)$/i, "/$1.svg");
  }

  // 2. Upgrade Wikimedia Commons thumbnail to original (SVG if it is one, or original high-res image)
  // e.g., https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/320px-Flag_of_the_United_States.svg.png
  // -> https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg
  if (url.includes("upload.wikimedia.org/wikipedia/commons/thumb/")) {
    const parts = url.split("/");
    if (parts[5] === "thumb") {
      parts.splice(5, 1); // remove "thumb"
      parts.pop(); // remove trailing thumbnail size filename
      return parts.join("/");
    }
  }

  return url;
}

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

  const rawFlagUrl =
    foundationPreviewCountry?.flag ||
    builderState.selectedCountry?.flag ||
    builderState.economicInputs?.flagUrl;

  const flagUrl = getHighResFlagUrl(rawFlagUrl);

  // Initialize section from URL - default to foundation/identity
  const [activeSection, setActiveSection] = useState<BuilderSection>(() => getSectionFromUrl(mode));

  const { handleContinue, handlePreviousStep } = useBuilderActions({
    builderState,
    setBuilderState,
    mode,
  });

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
    if (
      activeSection !== "import" &&
      mappedSection !== activeSection &&
      BUILD_STEPS.includes(mappedSection)
    ) {
      setActiveSection(mappedSection);
      window.history.pushState(null, "", withBasePath(buildSectionUrl(mappedSection, mode)));
      document.title = `${SECTION_TITLES[mappedSection]} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;
    }
  }, [builderState.step, activeSection, mode]);

  // Advanced mode state
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  // Flash label: briefly shows section name in DI center on navigation, then clears
  const [navFlashLabel, setNavFlashLabel] = useState<string | null>(null);
  const navFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (mode === "edit") {
      // In edit mode, all sections except foundation are accessible
      for (const step of BUILD_STEPS) {
        if (step === "foundation") continue;
        set.add(step);
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
  }, [completedSteps, mode, activeSection]);

  // Navigate to a section — also briefly flashes the section name in DI
  const handleNavigate = useCallback(
    (section: BuilderSection) => {
      if (mode === "edit" && section === "foundation") return;
      if (section === activeSection) return;

      setActiveSection(section);

      // Flash section name in DI compact center for 1.8s
      if (navFlashTimerRef.current) clearTimeout(navFlashTimerRef.current);
      setNavFlashLabel(SECTION_TITLES[section] ?? null);
      navFlashTimerRef.current = setTimeout(() => setNavFlashLabel(null), 1800);

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

  // Cleanup flash timer on unmount
  useEffect(() => {
    return () => {
      if (navFlashTimerRef.current) clearTimeout(navFlashTimerRef.current);
    };
  }, []);

  // Step labels for Dynamic Island display
  const currentStepLabel = useMemo(() => {
    const shortLabels: Record<BuilderSection, string> = {
      foundation: "Foundation",
      identity: "Identity",
      government: "Government",
      economics: "Economics",
      preview: "Preview",
      import: "Import",
    };
    return shortLabels[activeSection] || activeSection;
  }, [activeSection]);

  const currentSubStepLabel = useMemo(() => {
    if (activeSection === "identity") {
      const tab = builderState.activeIdentitySubTab || (mode === "edit" ? "basic" : "archetype");
      const labels: Record<string, string> = {
        archetype: "Archetype/Preset",
        basic: "Basic Info",
        culture: "Culture",
        technical: "Technical",
      };
      return labels[tab] || tab;
    }
    if (activeSection === "government") {
      const tab = builderState.activeGovernmentTab || "components";
      const labels: Record<string, string> = {
        components: "Core Setup",
        structure: "Departments",
        spending: "Budget & Revenue",
        preview: "Verify & Preview",
      };
      return labels[tab] || tab;
    }
    if (activeSection === "economics") {
      const tab = builderState.activeEconomicsTab || "components";
      const labels: Record<string, string> = {
        components: "Econ Components",
        sectors: "Sectors",
        labor: "Labor Market",
        demographics: "Demographics",
        tax: "Tax System",
      };
      return labels[tab] || tab;
    }
    return null;
  }, [
    activeSection,
    builderState.activeIdentitySubTab,
    builderState.activeGovernmentTab,
    builderState.activeEconomicsTab,
  ]);
  const themeTextColor = useMemo(() => {
    const colors: Record<BuilderSection, string> = {
      foundation: "text-amber-400",
      identity: "text-teal-400",
      government: "text-cyan-400",
      economics: "text-emerald-400",
      preview: "text-amber-400",
      import: "text-blue-400",
    };
    return colors[activeSection] || "text-amber-400";
  }, [activeSection]);

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

  // Handle import completion
  const handleImportComplete = useCallback(
    (data: any) => {
      // Import data is stored in localStorage by ImportSection
      // Navigate to identity to continue building
      handleNavigate("identity");
    },
    [handleNavigate]
  );

  // Manual save now lives in the Dynamic Island (BuilderDIPlugin → triggerManualSave).

  // Toggle advanced mode
  const handleToggleAdvanced = useCallback(() => {
    setIsAdvancedMode((prev) => !prev);
    setBuilderState((prev) => ({ ...prev, showAdvancedMode: !prev.showAdvancedMode }));
  }, [setBuilderState]);

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

    return mainContent;
  };

  // Always use sidebar layout now (no welcome screen)
  return (
    <BuilderFilterProvider onNavigate={handleNavigate}>
      <BuilderHalo />
      <WelcomeModalWrapper />
      <div className="relative min-h-screen w-full">
        {/* Page-wide Background Flag Watermark */}
        {flagUrl && (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.09] blur-[8px] saturate-[85%] transition-all duration-700 dark:opacity-[0.08] dark:saturate-[60%]"
              style={{ backgroundImage: `url(${flagUrl})` }}
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
          heroSection={null}
          notchBar={
            activeSection !== "foundation" && (
              <BuilderNotchBar
                activeSection={activeSection}
                completedSteps={completedSteps}
                accessibleSteps={accessibleSteps}
                mode={mode}
                onNavigate={handleNavigate}
                onBack={() => {
                  if (activeSection === "import") {
                    handleNavigate("foundation");
                  } else {
                    handlePreviousStep();
                  }
                }}
                onContinue={handleContinue}
                onSubmit={submitFn ?? undefined}
                isSubmitting={isSubmittingGlobal}
                alertResult={alertResult}
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
