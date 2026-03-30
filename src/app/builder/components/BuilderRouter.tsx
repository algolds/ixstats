"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
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
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="h-64 rounded-xl bg-white/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 rounded-lg bg-white/5" />
        <div className="h-32 rounded-lg bg-white/5" />
      </div>
    </div>
  );
}

// ─── Eagerly imported sections (most common path) ───

import { BuilderOnboardingWizard } from "./BuilderOnboardingWizard";

// ─── Lazy-loaded sections ───

const ImportSection = dynamic(
  () => import("./sections/ImportSection").then((m) => ({ default: m.ImportSection })),
  { loading: () => <SectionSkeleton /> }
);

// The existing AtomicBuilderPage inner content will be rendered for build steps
// We import the step renderer and related components
const AtomicBuilderInner = dynamic(
  () => import("./enhanced/AtomicBuilderPage").then((m) => ({ default: m.AtomicBuilderPage })),
  { loading: () => <SectionSkeleton /> }
);

// ─── Section title map ───

const SECTION_TITLES: Record<BuilderSection, string> = {
  welcome: "Nation Builder",
  import: "Import from Wiki",
  foundation: "Foundation",
  identity: "National Identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview & Create",
};

// ─── URL helpers ───

function getSectionFromUrl(): BuilderSection {
  if (typeof window === "undefined") return "welcome";
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section && SECTION_TITLES[section as BuilderSection]) {
    return section as BuilderSection;
  }
  // Legacy support: ?import=true
  if (params.get("import") === "true") return "import";
  return "welcome";
}

function buildSectionUrl(section: BuilderSection): string {
  if (section === "welcome") return "/builder";
  return `/builder?section=${section}`;
}

// ─── Inner Router (consumes BuilderStateContext) ───

function BuilderRouterInner() {
  const { user } = useUser();
  const router = useRouter();
  const {
    builderState,
    setBuilderState,
  } = useBuilderContext();

  // Initialize section from URL
  const [activeSection, setActiveSection] = useState<BuilderSection>(getSectionFromUrl);

  // Compute completed and accessible steps from builder state
  const completedSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    for (const step of builderState.completedSteps) {
      set.add(legacyStepToSection(step));
    }
    return set;
  }, [builderState.completedSteps]);

  const accessibleSteps = useMemo(() => {
    const set = new Set<BuilderSection>(["welcome", "import", "foundation"]);
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
      document.title = `${SECTION_TITLES[section]} - Nation Builder - IxStats`;

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });

      // If navigating to a build step, sync the legacy builder state
      const legacyStep = sectionToLegacyStep(section);
      if (BUILD_STEPS.includes(section) && legacyStep !== builderState.step) {
        setBuilderState((prev) => ({ ...prev, step: legacyStep as BuilderStep }));
      }
    },
    [activeSection, builderState.step, setBuilderState]
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
    document.title = `${SECTION_TITLES[activeSection]} - Nation Builder - IxStats`;
  }, [activeSection]);

  // Auth guard
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
                  Sign in to access the Nation Builder and create your custom nation
                </p>
              </div>
              <Button
                onClick={() => router.push(createUrl("/sign-in"))}
                size="lg"
                className={cn("w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700")}
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

  // Determine if we should show sidebar layout (not on welcome)
  const showSidebar = activeSection !== "welcome";

  // Render the active section
  const renderSection = () => {
    switch (activeSection) {
      case "welcome":
        return (
          <BuilderOnboardingWizard
            onStartBuilding={() => handleNavigate("foundation")}
            onSkipToImport={() => handleNavigate("import")}
          />
        );

      case "import":
        return (
          <ImportSection
            onNavigate={handleNavigate}
            onImportComplete={() => {
              // Import data stored in localStorage by ImportSection
              // Navigate to foundation to continue
              handleNavigate("foundation");
            }}
          />
        );

      // For all build steps, render the existing AtomicBuilderPage which handles
      // the step-specific content via StepRenderer and BuilderStateContext
      case "foundation":
      case "identity":
      case "government":
      case "economics":
      case "preview":
        return (
          <AtomicBuilderInner
            onBackToIntro={() => handleNavigate("welcome")}
            mode="create"
          />
        );

      default:
        return null;
    }
  };

  if (!showSidebar) {
    // Welcome section: full-width, no sidebar
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Build steps and import: sidebar layout
  return (
    <BuilderSidebarLayout
      activeSection={activeSection}
      onNavigate={handleNavigate}
      completedSteps={completedSteps}
      accessibleSteps={accessibleSteps}
      heroSection={
        <BuilderSectionHero
          section={activeSection}
          countryName={countryName}
          completionPercent={completionPercent}
          completedCount={BUILD_STEPS.filter((s) => completedSteps.has(s)).length}
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
          <Suspense fallback={<SectionSkeleton />}>
            {renderSection()}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </BuilderSidebarLayout>
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
