"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { Lock, Unlock as UnlockIcon } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderStateProvider, useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { BuilderSidebarLayout } from "./BuilderSidebarLayout";
import { BuilderSectionHero } from "./BuilderSectionHero";
import { ImportSection } from "./sections/ImportSection";
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

// ─── URL helpers ───

function getSectionFromUrl(): BuilderSection {
  if (typeof window === "undefined") return "foundation";
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section && (section === "import" || SECTION_TITLES[section as BuilderSection])) {
    return section as BuilderSection;
  }
  // Default to foundation (no more welcome screen)
  return "foundation";
}

function buildSectionUrl(section: BuilderSection): string {
  if (section === "foundation") return "/builder";
  return `/builder?section=${section}`;
}

// ─── Inner Router (consumes BuilderStateContext) ───

function BuilderRouterInner() {
  const { user } = useUser();
  const router = useRouter();
  const { builderState, setBuilderState, clearDraft, lastSaved, isAutoSaving } =
    useBuilderContext();

  // Initialize section from URL - default to foundation
  const [activeSection, setActiveSection] = useState<BuilderSection>(getSectionFromUrl);

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
    if (mappedSection !== activeSection && BUILD_STEPS.includes(mappedSection)) {
      setActiveSection(mappedSection);
      window.history.pushState(null, "", withBasePath(buildSectionUrl(mappedSection)));
      document.title = `${SECTION_TITLES[mappedSection]} - MyCountry Builder - IxStats`;
    }
  }, [builderState.step, activeSection]);

  // Advanced mode state
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  // Manual save state
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Compute completed and accessible steps from builder state
  const completedSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    for (const step of builderState.completedSteps) {
      set.add(legacyStepToSection(step));
    }
    return set;
  }, [builderState.completedSteps]);

  const accessibleSteps = useMemo(() => {
    const set = new Set<BuilderSection>(["foundation"]);
    // Foundation is always accessible
    // Other steps accessible if previous steps completed
    const stepOrder = BUILD_STEPS;
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
  }, [completedSteps, builderState.economicInputs]);

  const completionPercent = useMemo(() => {
    const completed = BUILD_STEPS.filter((s) => completedSteps.has(s)).length;
    return Math.round((completed / BUILD_STEPS.length) * 100);
  }, [completedSteps]);

  // Navigate to a section
  const handleNavigate = useCallback(
    (section: BuilderSection) => {
      if (section === activeSection) return;

      setActiveSection(section);

      // Sync URL
      window.history.pushState(null, "", withBasePath(buildSectionUrl(section)));

      // Update document title
      document.title = `${SECTION_TITLES[section]} - MyCountry Builder - IxStats`;

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
    [activeSection, setBuilderState]
  );

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromUrl();
      setActiveSection(newSection);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Set initial page title
  useEffect(() => {
    document.title = `${SECTION_TITLES[activeSection]} - MyCountry Builder - IxStats`;
  }, [activeSection]);

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
      <div className="from-background via-background flex min-h-screen items-center justify-center bg-gradient-to-br to-amber-50/20 p-4 dark:to-amber-950/20">
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

    // All build steps use AtomicBuilderPage
    return (
      <AtomicBuilderInner
        onBackToIntro={() => {
          // Just navigate to foundation, no more welcome screen
          handleNavigate("foundation");
        }}
        mode="create"
      />
    );
  };

  // Always use sidebar layout now (no welcome screen)
  return (
    <>
      <BuilderSidebarLayout
        activeSection={activeSection}
        onNavigate={handleNavigate}
        completedSteps={completedSteps}
        accessibleSteps={accessibleSteps}
        heroSection={
          <BuilderSectionHero
            section={activeSection}
            countryName={countryName}
            lastSaved={lastSaved}
            isAutoSaving={isAutoSaving}
            onManualSave={handleManualSave}
            isSaving={isManualSaving}
            onClearDraft={clearDraft}
            onToggleAdvanced={handleToggleAdvanced}
            isAdvancedMode={isAdvancedMode}
            mode="create"
            onNavigate={handleNavigate}
            completedSteps={completedSteps}
            accessibleSteps={accessibleSteps}
          />
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
    </>
  );
}

// ─── Exported Router (provides BuilderStateContext) ───

export function BuilderRouter() {
  return (
    <BuilderErrorBoundary>
      <BuilderStateProvider mode="create">
        <BuilderRouterInner />
      </BuilderStateProvider>
    </BuilderErrorBoundary>
  );
}
