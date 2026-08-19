"use client";

// src/app/labs/onoma/components/OnomaRouter.tsx
// Onoma Lab — Unified Workspace & Master Single-Page Router (Facet Rebuild)

import React from "react";
import { FacetMaterial } from "~/components/ui/facet";
import { useOnomaRouter } from "../hooks/useOnomaRouter";
import { OnomaHeader } from "./nav/OnomaHeader";
import { OnomaSectionRenderer } from "./OnomaSectionRenderer";
import { SECTION_COLORS } from "./nav/onoma-tabs";
import OnomaHelpModal from "./shared/OnomaHelpModal";

export function OnomaRouter() {
  const {
    fontLink,
    activeSection,
    activeSubTab,
    lastActiveTab,
    lexiconCount,
    shouldAnimateStash,
    hasInteractedPronunciation,
    setHasInteractedPronunciation,
    playPronunciation,
    showHelpModal,
    setShowHelpModal,
    studioInitialWords,
    studioInitialTitle,
    handleNavigate,
    handleNavigateStudio,
    handleLoadToStudio,
    handleClearStudioInitial,
    setActiveSubTab,
  } = useOnomaRouter();

  return (
    <div className="bg-background text-foreground min-h-screen p-4 antialiased transition-colors duration-300 sm:p-6">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Apple-Style Header & Sliding Navigation Tabs */}
        <OnomaHeader
          activeSection={activeSection}
          activeSubTab={activeSubTab}
          lastActiveTab={lastActiveTab}
          lexiconCount={lexiconCount}
          shouldAnimateStash={shouldAnimateStash}
          hasInteractedPronunciation={hasInteractedPronunciation}
          setHasInteractedPronunciation={setHasInteractedPronunciation}
          playPronunciation={playPronunciation}
          onOpenHelp={() => setShowHelpModal(true)}
          onNavigate={handleNavigate}
          onNavigateStudio={handleNavigateStudio}
        />

        {/* Workspace Canvas (Frosted glass with dynamic themed borders & shadow transitions) */}
        <FacetMaterial
          material="satin"
          className="border p-5 shadow-xl transition-all duration-500 sm:p-6"
          style={{
            borderColor: `${SECTION_COLORS[activeSection]}20`,
            boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 0 15px 0px ${SECTION_COLORS[activeSection]}08`,
          }}
        >
          <OnomaSectionRenderer
            activeSection={activeSection}
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
            studioInitialWords={studioInitialWords}
            studioInitialTitle={studioInitialTitle}
            onClearStudioInitial={handleClearStudioInitial}
            onLoadToStudio={handleLoadToStudio}
          />
        </FacetMaterial>
      </div>

      {/* Help Walkthrough Guide Modal */}
      <OnomaHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}

export default OnomaRouter;
