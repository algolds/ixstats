"use client";
// src/app/labs/onoma/components/shared/OnomaHelpModal.tsx
// ⟨ONOMA⟩ Linguistic Engine — Contextual Help & Interactive Brand Walkthrough
// Philosophy: Clean Typography × Apple Interactive Inspector × Focused Walkthrough

import React, { useState, useEffect, useMemo } from "react";
import {
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  OpenBook as BookOpen,
} from "iconoir-react";
import { OnomaBrandLogo } from "~/components/onoma/OnomaBrandLogo";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import type { OnomaSection, StudioSubTab, ExploreSubTab } from "~/lib/onoma/types";
import {
  WALKTHROUGH_STEPS,
  SYSTEM_GUIDES,
  // oxlint-disable-next-line eslint/no-unused-vars
  type SystemGuideItem,
} from "./onoma-help-data";

interface OnomaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection?: OnomaSection;
  activeSubTab?: StudioSubTab;
  activeExploreSubTab?: ExploreSubTab;
  initialMode?: "walkthrough" | "module";
}

function OnomaHelpModal({
  isOpen,
  onClose,
  activeSection = "overview",
  activeSubTab,
  activeExploreSubTab,
  initialMode,
}: OnomaHelpModalProps) {
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

  // Arrow keys step through the walkthrough (Escape is handled by the Dialog).
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isOpen, selectedGuideId]);

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

  const isWalkthrough = selectedGuideId === "walkthrough";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isWalkthrough
            ? "max-h-[min(620px,90vh)] sm:max-w-xl"
            : "h-[90vh] max-h-[700px] sm:max-w-3xl"
        )}
      >
        {/* Header */}
        <div className="border-separator flex items-center gap-3 border-b py-3 pr-14 pl-5">
          <OnomaBrandLogo variant="wordmark" className="text-label h-5 w-auto" aria-hidden />
          <span className="text-label-tertiary" aria-hidden="true">
            ·
          </span>
          <DialogTitle className="text-headline">
            {isWalkthrough ? "Welcome to Onoma" : "System help & reference"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isWalkthrough
              ? "A short walkthrough of the Onoma linguistic engine."
              : "Reference guides for each Onoma module."}
          </DialogDescription>
        </div>

        {/* Main Modal Body */}
        {isWalkthrough ? (
          /* --- FOCUSED INTERACTIVE 4-STEP WALKTHROUGH VIEW (NO MODULE REFERENCES) --- */
          <div className="flex flex-1 scrollbar-thin flex-col justify-between overflow-y-auto p-6 sm:p-7">
            <div className="mx-auto w-full max-w-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-label text-title-3 sm:text-title-2">
                    {currentWalkthrough.title}
                  </h3>
                  <p className="text-label-secondary text-footnote font-medium">
                    {currentWalkthrough.subtitle}
                  </p>
                </div>

                <div className="bg-tint-fill text-tint rounded-row flex h-10 w-10 shrink-0 items-center justify-center">
                  <OnomaBrandLogo variant="symbol" className="text-tint h-6 w-6" />
                </div>
              </div>

              {currentWalkthrough.quote && (
                <div className="border-tint/20 bg-tint/5 rounded-row space-y-1 border p-3 text-center">
                  <p className="text-label text-footnote font-medium italic">
                    “{currentWalkthrough.quote}”
                  </p>
                  {currentWalkthrough.progression && (
                    <p className="text-tint text-caption font-mono font-semibold">
                      {currentWalkthrough.progression}
                    </p>
                  )}
                </div>
              )}

              <p className="text-label text-footnote leading-relaxed">
                {currentWalkthrough.description}
              </p>

              <div className="bg-surface-secondary rounded-row space-y-2 p-4">
                {currentWalkthrough.features.map((feat, idx) => (
                  <div key={idx} className="text-footnote flex items-start gap-2">
                    <span className="text-tint shrink-0 font-semibold">›</span>
                    <span className="text-label leading-relaxed font-medium">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Walkthrough Navigation Bar */}
            <div className="border-separator mx-auto mt-6 flex w-full max-w-lg items-center justify-between border-t pt-4">
              <Button variant="ghost" size="sm" onClick={handleDismissWalkthrough}>
                Don&apos;t show on startup
              </Button>

              {/* Step Dots */}
              <div className="flex items-center gap-2">
                {WALKTHROUGH_STEPS.map((_, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveWalkthroughStep(idx)}
                    aria-label={`Step ${idx + 1} of ${WALKTHROUGH_STEPS.length}`}
                    aria-current={idx === activeWalkthroughStep ? "step" : undefined}
                    className="group w-auto px-1 hover:bg-transparent"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 rounded-full transition-[width,background-color] duration-300",
                        idx === activeWalkthroughStep
                          ? "bg-tint w-5"
                          : "bg-separator-opaque group-hover:bg-label-secondary w-1.5"
                      )}
                    />
                  </Button>
                ))}
              </div>

              {/* Back & Next / Begin Buttons */}
              <div className="flex items-center gap-2">
                {activeWalkthroughStep > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveWalkthroughStep((prev) => prev - 1)}
                  >
                    <ChevronLeft />
                    <span>Back</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => {
                    if (activeWalkthroughStep < WALKTHROUGH_STEPS.length - 1) {
                      setActiveWalkthroughStep((prev) => prev + 1);
                    } else {
                      handleDismissWalkthrough();
                    }
                  }}
                >
                  <span>
                    {activeWalkthroughStep === WALKTHROUGH_STEPS.length - 1 ? "Begin" : "Next"}
                  </span>
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* --- SPLIT-PANE MODULE REFERENCES VIEW --- */
          <div className="grid flex-1 grid-cols-1 overflow-hidden sm:grid-cols-12">
            {/* Left System Switcher Column (4 cols) */}
            <div className="border-separator bg-surface-secondary flex scrollbar-thin flex-row gap-1 overflow-x-auto border-b p-2 sm:col-span-4 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
              <Button
                variant="ghost"
                onClick={() => setSelectedGuideId("walkthrough")}
                className="text-label-secondary hover:text-label rounded-row text-caption mb-1 shrink-0 justify-start gap-2 px-3 text-left sm:shrink"
              >
                <BookOpen className="text-tint h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Welcome to Onoma</span>
              </Button>

              <span className="text-label-secondary text-subhead mt-1 hidden px-2 py-1 sm:block">
                Module references
              </span>
              {SYSTEM_GUIDES.map((g) => {
                const Icon = g.icon;
                const isSelected = g.id === selectedGuideId;

                return (
                  <Button
                    key={g.id}
                    variant="ghost"
                    onClick={() => setSelectedGuideId(g.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "rounded-row text-caption shrink-0 justify-start gap-2 px-3 text-left sm:shrink",
                      isSelected
                        ? "bg-tint-fill text-tint hover:bg-tint/20"
                        : "text-label-secondary hover:text-label"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{g.title}</span>
                  </Button>
                );
              })}
            </div>

            {/* Right System Inspector Details (8 cols) */}
            <div className="flex scrollbar-thin flex-col justify-between overflow-y-auto p-5 sm:col-span-8">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-label text-title-3">{currentGuide.title}</h3>
                    <p className="text-label-secondary text-footnote font-medium">
                      {currentGuide.subtitle}
                    </p>
                  </div>

                  <div className="bg-tint-fill text-tint rounded-row flex h-10 w-10 shrink-0 items-center justify-center">
                    {React.createElement(currentGuide.icon, { className: "h-5 w-5" })}
                  </div>
                </div>

                {currentGuide.formula && (
                  <div className="border-tint/20 bg-tint/5 rounded-row border p-3 text-center">
                    <span className="text-tint text-caption font-mono font-semibold">
                      {currentGuide.formula}
                    </span>
                  </div>
                )}

                <p className="text-label text-footnote leading-relaxed">
                  {currentGuide.description}
                </p>

                <div className="space-y-2">
                  <h4 className="text-subhead text-label-secondary">Core mechanics</h4>
                  <div className="bg-surface-secondary rounded-row space-y-2 p-3">
                    {currentGuide.mechanics.map((m, idx) => (
                      <div key={idx} className="text-footnote space-y-0.5">
                        <span className="text-label font-semibold">{m.label}: </span>
                        <span className="text-label-secondary text-caption leading-relaxed">
                          {m.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {currentGuide.proTips.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-subhead text-label-secondary">Worldbuilding tips</h4>
                    <div className="space-y-2">
                      {currentGuide.proTips.map((tip, idx) => (
                        <div
                          key={idx}
                          className="border-separator bg-fill-4 rounded-row text-footnote flex items-start gap-2 border p-3"
                        >
                          <span className="text-tint mt-0.5 shrink-0 font-semibold">›</span>
                          <span className="text-label text-caption leading-relaxed">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-separator mt-6 flex items-center justify-end border-t pt-4">
                <Button size="sm" onClick={onClose}>
                  Got it
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default OnomaHelpModal;
