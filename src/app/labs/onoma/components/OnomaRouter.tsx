"use client";

// src/app/labs/onoma/components/OnomaRouter.tsx
// Onoma Lab — Unified Workspace & Master Single-Page Router (Product Model: CREATE · STUDIO · EXPLORE)
// Features: Spatial Workspace Transitions, Dynamic Facet Canvas Materials, and Fluid Apple Spring Physics

import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FacetMaterial } from "~/components/ui/facet";
import { useOnomaRouter } from "../hooks/useOnomaRouter";

import { OnomaHeader } from "./nav/OnomaHeader";
import { OnomaFooter } from "./nav/OnomaFooter";
import { PhysicsPullFooter } from "./nav/PhysicsPullFooter";
import { OnomaSectionRenderer } from "./OnomaSectionRenderer";
import { SECTION_COLORS } from "./nav/onoma-tabs";
import OnomaHelpModal from "./shared/OnomaHelpModal";
import type { OnomaProductPillar } from "~/lib/onoma/types";

export function OnomaRouter() {
  const {
    fontLink,
    activeSection,
    activeSubTab,
    activeExploreSubTab,
    lastActiveTab,
    lexiconCount,
    shouldAnimateStash,
    hasInteractedPronunciation,
    setHasInteractedPronunciation,
    playPronunciation,
    showHelpModal,
    setShowHelpModal,
    helpModalMode,
    openHelp,
    studioInitialWords,
    studioInitialTitle,
    handleNavigate,
    handleNavigateStudio,
    handleNavigateExplore,
    handleLoadToStudio,
    handleClearStudioInitial,
    setActiveSubTab,
    setActiveExploreSubTab,
  } = useOnomaRouter();

  const shouldReduceMotion = useReducedMotion();

  const activePillar: OnomaProductPillar =
    activeSection === "studio" ? "studio" : activeSection === "explore" ? "explore" : "create";

  // Dynamic canvas styling per pillar
  const pillarBorderColor =
    activePillar === "create"
      ? `${SECTION_COLORS[activeSection] || "#0091ff"}25`
      : activePillar === "studio"
        ? "rgba(0, 145, 255, 0.2)"
        : "rgba(99, 102, 241, 0.2)";

  return (
    <div className="bg-background text-foreground min-h-screen p-3.5 antialiased transition-colors duration-300 sm:p-6">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Apple-Style Header & Sliding Navigation Tabs */}
        <OnomaHeader
          activeSection={activeSection}
          activeSubTab={activeSubTab}
          activeExploreSubTab={activeExploreSubTab}
          lastActiveTab={lastActiveTab}
          lexiconCount={lexiconCount}
          shouldAnimateStash={shouldAnimateStash}
          hasInteractedPronunciation={hasInteractedPronunciation}
          setHasInteractedPronunciation={setHasInteractedPronunciation}
          playPronunciation={playPronunciation}
          onOpenHelp={() => openHelp("module")}
          onNavigate={handleNavigate}
          onNavigateStudio={handleNavigateStudio}
          onNavigateExplore={handleNavigateExplore}
        />

        {/* Workspace Canvas (Frosted glass with dynamic themed borders and clean elevation) */}
        <FacetMaterial
          material="satin"
          className="relative overflow-hidden rounded-2xl border border-border/50 p-4.5 shadow-sm transition-all duration-300 sm:p-6"
          style={{
            borderColor: pillarBorderColor,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${activeSection}-${activeSection === "studio" ? activeSubTab : activeSection === "explore" ? activeExploreSubTab : ""}`}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.995 }}
              transition={{
                duration: 0.2,
                ease: [0.23, 1, 0.32, 1], // Emil Kowalski strong ease-out
              }}
            >
              <OnomaSectionRenderer
                activeSection={activeSection}
                activeSubTab={activeSubTab}
                setActiveSubTab={setActiveSubTab}
                activeExploreSubTab={activeExploreSubTab}
                setActiveExploreSubTab={setActiveExploreSubTab}
                studioInitialWords={studioInitialWords}
                studioInitialTitle={studioInitialTitle}
                onClearStudioInitial={handleClearStudioInitial}
                onLoadToStudio={handleLoadToStudio}
                onNavigateExplore={handleNavigateExplore}
                onNavigateStudio={handleNavigateStudio}
              />
            </motion.div>
          </AnimatePresence>
        </FacetMaterial>
      </div>

      {/* Physics-Based Elastic Pull Footer */}
      <PhysicsPullFooter>
        <OnomaFooter
          onNavigate={handleNavigate}
          onNavigateStudio={handleNavigateStudio}
          onNavigateExplore={handleNavigateExplore}
          onOpenHelp={() => openHelp("walkthrough")}
        />
      </PhysicsPullFooter>

      {/* Contextual System Architecture & Walkthrough Guide Modal */}
      <OnomaHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        activeSection={activeSection}
        activeSubTab={activeSubTab}
        activeExploreSubTab={activeExploreSubTab}
        initialMode={helpModalMode}
      />
    </div>
  );
}

export default OnomaRouter;
