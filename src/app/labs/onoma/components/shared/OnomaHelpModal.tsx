// src/app/labs/onoma/components/shared/OnomaHelpModal.tsx
// ⟨ONOMA⟩ Linguistic Engine — Contextual Help & Interactive Brand Walkthrough
// Philosophy: Clean Typography × Apple Interactive Inspector × Focused Walkthrough

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Xmark as X, NavArrowRight as ChevronRight, NavArrowLeft as ChevronLeft, OpenBook as BookOpen } from "iconoir-react";
import { OnomaBrandLogo } from "./OnomaBrandLogo";
import { cn } from "~/lib/utils";
import type { OnomaSection, StudioSubTab, ExploreSubTab } from "~/lib/onoma/types";
import {
  WALKTHROUGH_STEPS,
  SYSTEM_GUIDES,
  type SystemGuideItem,
} from "./onoma-help-data";

export interface OnomaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection?: OnomaSection;
  activeSubTab?: StudioSubTab;
  activeExploreSubTab?: ExploreSubTab;
  initialMode?: "walkthrough" | "module";
}


export function OnomaHelpModal({
  isOpen,
  onClose,
  activeSection = "overview",
  activeSubTab,
  activeExploreSubTab,
  initialMode,
}: OnomaHelpModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [activeWalkthroughStep, setActiveWalkthroughStep] = useState(0);

  // Resolve initial contextual guide ID from router state
  const contextId = useMemo(() => {
    if (activeSection === "explore") {
      return activeExploreSubTab || "phonology";
    }
    if (activeSection === "studio") {
      return activeSubTab || "workshop";
    }
    if (
      activeSection === "overview" ||
      activeSection === "places" ||
      activeSection === "people" ||
      activeSection === "organizations" ||
      activeSection === "culture"
    ) {
      return "create";
    }
    if (activeSection === "bank") {
      return "bank";
    }
    return "create";
  }, [activeSection, activeSubTab, activeExploreSubTab]);

  const [selectedGuideId, setSelectedGuideId] = useState<string>("walkthrough");

  // When modal opens, auto-focus depending on initialMode
  useEffect(() => {
    if (isOpen) {
      if (initialMode === "walkthrough") {
        setSelectedGuideId("walkthrough");
        setActiveWalkthroughStep(0);
      } else {
        setSelectedGuideId(contextId);
      }
    }
  }, [isOpen, contextId, initialMode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (selectedGuideId === "walkthrough") {
        if (e.key === "ArrowRight") {
          setActiveWalkthroughStep((prev) => Math.min(prev + 1, WALKTHROUGH_STEPS.length - 1));
        }
        if (e.key === "ArrowLeft") {
          setActiveWalkthroughStep((prev) => Math.max(prev - 1, 0));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedGuideId]);

  const currentGuide = useMemo(
    () => SYSTEM_GUIDES.find((g) => g.id === selectedGuideId) || SYSTEM_GUIDES[0],
    [selectedGuideId]
  );

  const currentWalkthrough = WALKTHROUGH_STEPS[activeWalkthroughStep];

  const handleDismissWalkthrough = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("onoma-welcome-seen", "true");
    }
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6">
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bg-background/70 absolute inset-0 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "border-border/40 bg-card/95 relative z-10 flex flex-col overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-2xl transition-all duration-300",
              selectedGuideId === "walkthrough"
                ? "h-auto max-h-[620px] w-full max-w-xl"
                : "h-[90vh] max-h-[700px] w-full max-w-3xl"
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/35 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <OnomaBrandLogo variant="wordmark" className="h-5.5 w-auto text-foreground" />
                <span className="text-muted-foreground/50 font-mono text-xs">·</span>
                <span className="text-foreground text-xs font-semibold tracking-tight">
                  {selectedGuideId === "walkthrough" ? "Welcome to Onoma" : "System Help & Reference"}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded-xl p-1.5 transition-colors cursor-pointer active:scale-95"
                title="Close Help (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Main Modal Body */}
            {selectedGuideId === "walkthrough" ? (
              /* --- FOCUSED INTERACTIVE 4-STEP WALKTHROUGH VIEW (NO MODULE REFERENCES) --- */
              <div className="flex flex-col justify-between overflow-y-auto p-6 sm:p-7 flex-1 scrollbar-thin">
                <div className="space-y-4 max-w-lg mx-auto w-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-foreground text-lg sm:text-xl font-bold tracking-tight">
                        {currentWalkthrough.title}
                      </h3>
                      <p className="text-muted-foreground text-xs font-medium">
                        {currentWalkthrough.subtitle}
                      </p>
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-onoma-primary/10 text-onoma-primary shadow-xs">
                      <OnomaBrandLogo variant="symbol" className="h-6 w-6 text-onoma-primary" />
                    </div>
                  </div>

                  {currentWalkthrough.quote && (
                    <div className="border-onoma-primary/20 bg-onoma-primary/5 rounded-xl border p-3 text-center space-y-1">
                      <p className="text-foreground text-xs italic font-medium">
                        “{currentWalkthrough.quote}”
                      </p>
                      {currentWalkthrough.progression && (
                        <p className="text-onoma-primary font-mono text-[10px] font-semibold">
                          {currentWalkthrough.progression}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-foreground/90 text-xs leading-relaxed">
                    {currentWalkthrough.description}
                  </p>

                  <div className="border-border/30 bg-secondary/15 space-y-2 rounded-2xl border p-3.5">
                    {currentWalkthrough.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="text-onoma-primary font-bold shrink-0">›</span>
                        <span className="text-foreground/90 leading-relaxed font-medium">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Walkthrough Navigation Bar */}
                <div className="border-border/30 mt-6 flex items-center justify-between border-t pt-4 max-w-lg mx-auto w-full">
                  <button
                    type="button"
                    onClick={handleDismissWalkthrough}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
                  >
                    Don't show on startup
                  </button>

                  {/* Step Dots */}
                  <div className="flex items-center gap-1.5">
                    {WALKTHROUGH_STEPS.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveWalkthroughStep(idx)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                          idx === activeWalkthroughStep
                            ? "w-5 bg-onoma-primary"
                            : "bg-border/80 hover:bg-muted-foreground w-1.5"
                        )}
                      />
                    ))}
                  </div>

                  {/* Back & Next / Begin Buttons */}
                  <div className="flex items-center gap-2">
                    {activeWalkthroughStep > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveWalkthroughStep((prev) => prev - 1)}
                        className="border-border/40 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Back</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (activeWalkthroughStep < WALKTHROUGH_STEPS.length - 1) {
                          setActiveWalkthroughStep((prev) => prev + 1);
                        } else {
                          handleDismissWalkthrough();
                        }
                      }}
                      className="bg-onoma-primary hover:bg-onoma-primary-hover flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <span>
                        {activeWalkthroughStep === WALKTHROUGH_STEPS.length - 1 ? "Begin" : "Next"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* --- SPLIT-PANE MODULE REFERENCES VIEW --- */
              <div className="grid flex-1 grid-cols-1 overflow-hidden sm:grid-cols-12">
                {/* Left System Switcher Column (4 cols) */}
                <div className="border-border/30 bg-secondary/10 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto border-b p-2.5 sm:border-r sm:border-b-0 sm:col-span-4 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setSelectedGuideId("walkthrough")}
                    className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-all cursor-pointer select-none active:scale-[0.98] shrink-0 sm:shrink mb-1 text-muted-foreground hover:text-foreground hover:bg-secondary/20 border border-transparent"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-onoma-primary" />
                      <span className="truncate text-[11px] font-medium">Welcome to Onoma</span>
                    </div>
                  </button>

                  <span className="text-muted-foreground hidden sm:block px-2 py-1 text-[9px] font-bold tracking-wider uppercase mt-1">
                    Module References
                  </span>
                  {SYSTEM_GUIDES.map((g) => {
                    const Icon = g.icon;
                    const isSelected = g.id === selectedGuideId;

                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGuideId(g.id)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-all cursor-pointer select-none active:scale-[0.98] shrink-0 sm:shrink",
                          isSelected
                            ? "border-onoma-primary/40 bg-onoma-primary/10 text-onoma-primary border shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/20 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-[11px] font-medium">{g.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right System Inspector Details (8 cols) */}
                <div className="flex flex-col justify-between overflow-y-auto p-5 sm:col-span-8 scrollbar-thin">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-foreground text-lg font-bold tracking-tight">
                          {currentGuide.title}
                        </h3>
                        <p className="text-muted-foreground text-xs font-medium">
                          {currentGuide.subtitle}
                        </p>
                      </div>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-onoma-primary/10 text-onoma-primary shadow-xs">
                        {React.createElement(currentGuide.icon, { className: "h-5 w-5" })}
                      </div>
                    </div>

                    {currentGuide.formula && (
                      <div className="border-onoma-primary/20 bg-onoma-primary/5 rounded-xl border p-2.5 text-center">
                        <span className="text-onoma-primary font-mono text-[10px] font-semibold tracking-tight">
                          {currentGuide.formula}
                        </span>
                      </div>
                    )}

                    <p className="text-foreground/90 text-xs leading-relaxed">
                      {currentGuide.description}
                    </p>

                    <div className="space-y-2">
                      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Core Mechanics
                      </span>
                      <div className="border-border/30 bg-secondary/15 space-y-2 rounded-2xl border p-3">
                        {currentGuide.mechanics.map((m, idx) => (
                          <div key={idx} className="space-y-0.5 text-xs">
                            <span className="text-foreground font-bold">{m.label}: </span>
                            <span className="text-muted-foreground text-[11px] leading-relaxed">
                              {m.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {currentGuide.proTips.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                          Worldbuilding Pro Tips
                        </span>
                        <div className="space-y-2">
                          {currentGuide.proTips.map((tip, idx) => (
                            <div
                              key={idx}
                              className="border-border/30 bg-secondary/10 flex items-start gap-2.5 rounded-xl border p-2.5 text-xs"
                            >
                              <span className="text-onoma-primary mt-0.5 font-bold shrink-0">›</span>
                              <span className="text-foreground/90 text-[11px] leading-relaxed">
                                {tip}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-border/30 mt-6 flex items-center justify-end border-t pt-3.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="bg-onoma-primary hover:bg-onoma-primary-hover flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Got it</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default OnomaHelpModal;
