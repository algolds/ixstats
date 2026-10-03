"use client";

// src/app/labs/onoma/components/OnomaRouter.tsx
// Onoma Lab — Unified Workspace & Master Single-Page Router (Product Model: CREATE · STUDIO · EXPLORE)

import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { tweenFast } from "~/lib/design/motion";
import { useOnomaRouter } from "../hooks/useOnomaRouter";

import { OnomaHeader } from "./nav/OnomaHeader";
import { OnomaFooter } from "./nav/OnomaFooter";
import { PhysicsPullFooter } from "./nav/PhysicsPullFooter";
import { OnomaSectionRenderer } from "./OnomaSectionRenderer";
import OnomaHelpModal from "./shared/OnomaHelpModal";
import { Card } from "~/components/ui/card";

function OnomaRouter() {
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

  return (
    <div className="bg-grouped text-label min-h-screen px-4 py-4 antialiased sm:px-6 sm:py-6">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      <div className="mx-auto max-w-7xl space-y-5">
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

        <Card padding="lg" className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${activeSection}-${activeSection === "studio" ? activeSubTab : activeSection === "explore" ? activeExploreSubTab : ""}`}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={tweenFast}
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
        </Card>
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
