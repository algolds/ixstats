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
    activeSection === "studio"
      ? "studio"
      : activeSection === "explore"
        ? "explore"
        : "create";

  // Dynamic canvas styling per pillar
  const pillarBorderColor =
    activePillar === "create"
      ? `${SECTION_COLORS[activeSection] || "#0091ff"}25`
      : activePillar === "studio"
        ? "#ec489930"
        : "#8b5cf630";

  const pillarGlow =
    activePillar === "create"
      ? `0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 0 20px 0px ${SECTION_COLORS[activeSection] || "#0091ff"}10`
      : activePillar === "studio"
        ? "0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 0 20px 0px rgba(236, 72, 153, 0.12)"
        : "0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 0 20px 0px rgba(139, 92, 246, 0.12)";

  const activePillarAccent =
    activePillar === "create"
      ? SECTION_COLORS[activeSection] || "#0091ff"
      : activePillar === "studio"
        ? "#ec4899"
        : "#8b5cf6";

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
          onOpenHelp={() => setShowHelpModal(true)}
          onNavigate={handleNavigate}
          onNavigateStudio={handleNavigateStudio}
          onNavigateExplore={handleNavigateExplore}
        />

        {/* Workspace Canvas (Frosted glass with dynamic themed borders and shadow transitions) */}
        <FacetMaterial
          material="satin"
          className="relative overflow-hidden border p-4.5 shadow-xl transition-all duration-300 sm:p-6 rounded-2xl"
          style={{
            borderColor: pillarBorderColor,
            boxShadow: pillarGlow,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>


            <motion.div
              key={`${activeSection}-${activeSection === "studio" ? activeSubTab : activeSection === "explore" ? activeExploreSubTab : ""}`}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 6, scale: 0.995 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, scale: 0.995 }
              }
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
              />
            </motion.div>
          </AnimatePresence>
        </FacetMaterial>
      </div>

      {/* Gradual Feathered Bridge & 1/3 Wider Footer (max-w-[1720px]) */}
      <div className="relative mx-auto mt-14 w-full max-w-[1720px] px-1 sm:px-3 lg:px-5">
        {/* Subtle feathered gradient fade from bottom of main container */}
        <div className="pointer-events-none absolute -top-12 inset-x-0 h-16 bg-gradient-to-b from-transparent via-background/40 to-background/90" />

        <OnomaFooter
          onNavigate={handleNavigate}
          onNavigateStudio={handleNavigateStudio}
          onNavigateExplore={handleNavigateExplore}
          onOpenHelp={() => setShowHelpModal(true)}
        />
      </div>

      {/* Help Walkthrough Guide Modal */}
      <OnomaHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}

export default OnomaRouter;
