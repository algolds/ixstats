"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { Lock, LockSlash as UnlockIcon } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/utils";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderStateProvider, useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { BuilderFilterProvider, useBuilderFilter } from "./builder-filter-context";
import { BuilderSidebarLayout } from "./BuilderSidebarLayout";
import { BuilderWelcomeModal } from "./BuilderWelcomeModal";
import { BuilderHalo } from "~/components/halo/plugins/builder";
import { ImportSection } from "./sections/ImportSection";
import { BuilderGuideProvider } from "./builder-guide-context";
import { BuilderGuideSheet } from "./BuilderGuideSheet";
import { BuilderStudioHeader } from "./BuilderStudioHeader";
import { BuilderStepFooter } from "./BuilderStepFooter";
import { BuilderResetConfirmDialog } from "./BuilderResetConfirmDialog";
import { EditorSaveBar } from "./EditorSaveBar";
import { EditorHeader } from "./editor/EditorHeader";
import { EditorSkeleton } from "./editor/EditorSkeleton";
import { EditorLeaveGuard } from "./editor/EditorLeaveGuard";
import { EditorDraftBanner } from "./editor/EditorDraftBanner";
import { EditorChangeSummary } from "./editor/EditorChangeSummary";
import { EditorSectionFooter } from "./editor/EditorSectionFooter";
import type { EditorSaveStatus } from "./editor/editor-sections";
import { EditChangesProvider } from "../primitives/ChangedFieldDot";
import { SectionAlerts } from "../primitives/SectionAlert";
import { useBuilderActions } from "../hooks/useBuilderActions";
import { useBuilderAlerts } from "../hooks/useBuilderAlerts";
import { useStepCompletion } from "../hooks/useStepCompletion";
import { useBuilderKeyboardShortcuts } from "../hooks/useBuilderKeyboardShortcuts";
import { useEditChanges } from "../hooks/useEditChanges";
import { countChangesBySection } from "../lib/edit-changes";
import { mergeRecoveredDraft } from "../lib/recovered-draft";
import { useNotify } from "~/hooks/useNotify";
import { Skeleton } from "~/components/ui/skeleton";
import { WarningTriangle, NavArrowLeft, Refresh } from "iconoir-react";
import {
  type BuilderSection,
  BUILD_STEPS,
  legacyStepToSection,
  sectionToLegacyStep,
  isScratchOrImportOrigin,
} from "../lib/builder-theme";
import type { BuilderStep } from "./enhanced/builderConfig";
import { withBasePath } from "~/lib/base-path";
import { Card } from "~/components/ui/card";

function SectionSkeleton() {
  return (
    <div className="space-y-4 p-6" role="status" aria-label="Loading section">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="rounded-row h-64" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="rounded-control h-32" />
        <Skeleton className="rounded-control h-32" />
      </div>
    </div>
  );
}

// The existing AtomicBuilderPage inner content will be rendered for build steps
const AtomicBuilderInner = dynamic(
  () => import("./enhanced/AtomicBuilderPage").then((m) => ({ default: m.AtomicBuilderPage })),
  { loading: () => <SectionSkeleton /> }
);

const SECTION_TITLES: Record<BuilderSection, string> = {
  foundation: "Foundation",
  identity: "National identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview and create",
  import: "Import from wiki",
};

/** Section names in the page title; the editor's final section reviews rather than creates. */
function pageTitle(section: BuilderSection, mode: "create" | "edit"): string {
  const title = mode === "edit" && section === "preview" ? "Review" : SECTION_TITLES[section];
  return `${title} - ${mode === "edit" ? "Country Editor" : "MyCountry Builder"} - IxStats`;
}

const NO_SECTIONS = new Set<BuilderSection>();

interface BuilderRouterProps {
  mode?: "create" | "edit";
  countryId?: string;
}

function getSectionFromUrl(mode?: "create" | "edit"): BuilderSection {
  if (typeof window === "undefined") return mode === "edit" ? "identity" : "foundation";
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section && (section === "import" || SECTION_TITLES[section as BuilderSection])) {
    // Foundation and wiki import only exist while creating a country.
    if (mode === "edit" && (section === "foundation" || section === "import")) {
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
  return <BuilderWelcomeModal open={welcomeModalOpen} onOpenChange={setWelcomeModalOpen} />;
}

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
    isLoadingCountry,
    triggerManualSave,
    isSyncing,
    syncError,
    hasUnsyncedChanges,
    lastSyncedAt,
    countryLoadError,
    retryCountryLoad,
    recoveredDraft,
    applyRecoveredDraft,
    dismissRecoveredDraft,
  } = useBuilderContext();
  const isEdit = mode === "edit";
  const notify = useNotify();

  const editChanges = useEditChanges({
    enabled: mode === "edit",
    isLoadingCountry,
    builderState,
    setBuilderState,
  });

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
    const nextIsAdvanced = !(builderState.showAdvancedMode || filter.viewMode === "expert");
    filter.setViewMode(nextIsAdvanced ? "expert" : "standard");
    setBuilderState((prev) => ({
      ...prev,
      showAdvancedMode: nextIsAdvanced,
    }));
  }, [builderState.showAdvancedMode, filter, setBuilderState]);

  const [isEditorSaving, setIsEditorSaving] = useState(false);
  const isEditorSavingRef = useRef(false);

  const handleEditorSave = useCallback(async () => {
    if (isEditorSavingRef.current) return;
    isEditorSavingRef.current = true;
    setIsEditorSaving(true);
    try {
      await editChanges.save(triggerManualSave);
      notify.success("Changes saved");
    } catch (error) {
      notify.error(
        "Couldn't save your changes",
        error instanceof Error ? error.message : "Check your connection and try again."
      );
    } finally {
      isEditorSavingRef.current = false;
      setIsEditorSaving(false);
    }
  }, [editChanges, triggerManualSave, notify]);

  const handleRetrySync = useCallback(async () => {
    try {
      await triggerManualSave();
    } catch (error) {
      notify.error(
        "Still couldn't save",
        error instanceof Error ? error.message : "Check your connection and try again."
      );
    }
  }, [triggerManualSave, notify]);

  const handleEditorDiscard = useCallback(() => {
    const count = editChanges.changes.length;
    if (count === 0) return;
    editChanges.discard();
    notify.info(
      count === 1 ? "1 change discarded" : `${count} changes discarded`,
      "Use Undo to bring them back."
    );
  }, [editChanges, notify]);

  const saveStatus: EditorSaveStatus = isSyncing
    ? "saving"
    : hasUnsyncedChanges
      ? syncError
        ? "error"
        : "pending"
      : "saved";

  const changeCounts = useMemo(
    () => countChangesBySection(editChanges.changes),
    [editChanges.changes]
  );

  // An unsaved copy from an earlier visit: offer it only if it differs from the loaded country.
  const [draftChangeCount, setDraftChangeCount] = useState(0);
  const evaluatedDraftRef = useRef<typeof recoveredDraft>(null);
  useEffect(() => {
    if (!recoveredDraft || !editChanges.isReady) return;
    if (evaluatedDraftRef.current === recoveredDraft) return;
    evaluatedDraftRef.current = recoveredDraft;
    const diff = editChanges.diffFromBaseline(
      mergeRecoveredDraft(builderState, recoveredDraft.state)
    );
    if (!diff || diff.length === 0) {
      dismissRecoveredDraft();
      return;
    }
    setDraftChangeCount(diff.length);
  }, [recoveredDraft, editChanges, builderState, dismissRecoveredDraft]);
  const showDraftBanner = isEdit && recoveredDraft !== null && draftChangeCount > 0;

  useBuilderKeyboardShortcuts({
    onSave: isEdit ? handleEditorSave : submitFn,
    onReset: isEdit ? handleEditorDiscard : handleOpenResetDialog,
    onToggleAdvanced: handleToggleAdvanced,
    isSubmitting: isSubmittingGlobal || isEditorSaving,
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
        document.title = pageTitle(mappedSection, mode);
      }
    }
  }, [builderState.step, activeSection, mode]);

  const isScratchOrImport = useMemo(() => isScratchOrImportOrigin(builderState), [builderState]);

  // Compute completed and accessible steps from builder state
  const completedSteps = useMemo(() => {
    const set = new Set<BuilderSection>();
    for (const step of builderState.completedSteps) {
      if ((mode === "edit" || isScratchOrImport) && step === "foundation") continue;
      set.add(legacyStepToSection(step));
    }
    return set;
  }, [builderState.completedSteps, mode, isScratchOrImport]);

  // Step-completion toasts belong to the creation wizard; the editor has nothing to complete.
  useStepCompletion(isEdit ? NO_SECTIONS : completedSteps, SECTION_TITLES, BUILD_STEPS.length);

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
      if (mode === "edit" && (section === "foundation" || section === "import")) return;
      if (section === activeSection) return;

      setActiveSection(section);

      // Sync URL
      window.history.pushState(null, "", withBasePath(buildSectionUrl(section, mode)));

      // Update document title
      document.title = pageTitle(section, mode);

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
    document.title = pageTitle(activeSection, mode);
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

  // Auth guard
  if (!user) {
    return (
      <div className="flex h-full items-center justify-center px-4 pt-(--shell-top-offset) pb-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <Card className="rounded-card mx-auto max-w-md space-y-6 p-8 text-center">
            <Lock aria-hidden="true" className="text-label-secondary mx-auto h-10 w-10" />
            <div className="space-y-2">
              <h1 className="text-label text-title-1">Authentication required</h1>
              <p className="text-label-secondary">Sign in to use the MyCountry builder.</p>
            </div>
            <Button onClick={() => router.push(createUrl("/sign-in"))} size="lg" className="w-full">
              <UnlockIcon aria-hidden="true" className="h-4 w-4" />
              Sign in
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Editor: the country is loading, or could not be loaded.
  if (isEdit && isLoadingCountry) {
    return <EditorSkeleton />;
  }
  if (isEdit && countryLoadError) {
    return (
      <div className="flex w-full flex-1 items-start justify-center px-4 pt-(--shell-top-offset)">
        <Card role="alert" className="rounded-card w-full max-w-md space-y-4 p-6 text-center">
          <WarningTriangle aria-hidden="true" className="text-destructive mx-auto h-6 w-6" />
          <div className="space-y-1">
            <h1 className="text-label text-title-3">Couldn't open your country</h1>
            <p className="text-label-secondary text-body">{countryLoadError}</p>
          </div>
          <div className="flex flex-col-reverse justify-center gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => router.push(createUrl("/mycountry"))}>
              <NavArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back to MyCountry
            </Button>
            <Button onClick={retryCountryLoad}>
              <Refresh aria-hidden="true" className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const sectionAlerts = alertResult.forSection(activeSection);
  const editorCountryName =
    builderState.economicInputs?.nationalIdentity?.countryName ||
    builderState.economicInputs?.countryName ||
    "";

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

    const mainContent = <AtomicBuilderInner mode={mode} countryId={countryId} />;

    return mainContent;
  };

  // Always use sidebar layout now (no welcome screen)
  return (
    <BuilderGuideProvider currentSection={activeSection}>
      <BuilderHalo />
      <WelcomeModalWrapper />
      <BuilderGuideSheet />
      <div className="relative flex min-h-screen w-full flex-1 flex-col">
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
            showDraftBanner || sectionAlerts.length > 0 ? (
              <>
                {showDraftBanner && recoveredDraft && (
                  <EditorDraftBanner
                    changeCount={draftChangeCount}
                    savedAt={recoveredDraft.savedAt}
                    onRestore={applyRecoveredDraft}
                    onDismiss={dismissRecoveredDraft}
                  />
                )}
                {sectionAlerts.length > 0 && <SectionAlerts alerts={sectionAlerts} />}
              </>
            ) : null
          }
          studioHeader={
            isEdit ? (
              <EditorHeader
                countryName={editorCountryName}
                flagUrl={builderState.economicInputs?.flagUrl}
                activeSection={activeSection}
                onNavigate={handleNavigate}
                changeCounts={changeCounts}
                alertResult={alertResult}
                saveStatus={saveStatus}
                lastSyncedAt={lastSyncedAt}
              />
            ) : (
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
            )
          }
          stepFooter={
            isEdit ? (
              <EditorSectionFooter
                activeSection={activeSection}
                onNavigate={handleNavigate}
                onFinish={submitFn ?? undefined}
                isFinishing={isSubmittingGlobal}
              />
            ) : (
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
              <Suspense fallback={<SectionSkeleton />}>
                <EditChangesProvider changes={editChanges.changes}>
                  {isEdit && activeSection === "preview" && (
                    <div className="mb-6">
                      <EditorChangeSummary
                        changes={editChanges.changes}
                        onNavigate={handleNavigate}
                      />
                    </div>
                  )}
                  {renderSection()}
                </EditChangesProvider>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </BuilderSidebarLayout>
        {isEdit && (
          <>
            <EditorSaveBar
              changeCount={editChanges.changes.length}
              canUndo={editChanges.canUndo}
              onUndo={editChanges.undo}
              onDiscard={handleEditorDiscard}
              onSave={() => void handleEditorSave()}
              isSaving={isEditorSaving}
              status={saveStatus}
              lastSyncedAt={lastSyncedAt}
              onRetry={() => void handleRetrySync()}
            />
            <EditorLeaveGuard hasUnsavedChanges={hasUnsyncedChanges} onSave={triggerManualSave} />
          </>
        )}
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

export function BuilderRouter({ mode = "create", countryId }: BuilderRouterProps) {
  return (
    <BuilderErrorBoundary>
      <BuilderStateProvider mode={mode} countryId={countryId}>
        <BuilderFilterProvider defaultViewMode={mode === "edit" ? "expert" : "standard"}>
          <BuilderRouterInner mode={mode} countryId={countryId} />
        </BuilderFilterProvider>
      </BuilderStateProvider>
    </BuilderErrorBoundary>
  );
}
