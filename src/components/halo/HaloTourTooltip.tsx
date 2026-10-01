"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TOUR_STEPS } from "./HaloTourContext";
import { FacetMaterial } from "~/components/ui/facet";
import { Button } from "~/components/ui/button";
import {
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Xmark as X,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { overlayScrimClassName } from "~/components/ui/dialog";
import { springSmooth, tweenExit, tweenFast } from "~/lib/design/motion";

export function HaloTourTooltip() {
  const [tourState, setTourState] = useState<{
    isActive: boolean;
    currentStep: number;
    completed: boolean;
  }>({
    isActive: false,
    currentStep: 1,
    completed: false,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);

    // Check initial completed status from localStorage
    try {
      const hasCompleted = localStorage.getItem("ixstats:halo-tour-completed") === "true";
      setTourState((prev) => ({ ...prev, completed: hasCompleted }));
    } catch {
      // storage unavailable (private mode) — tour treated as not completed
    }

    const handleStepChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ step: number; active: boolean }>;
      if (customEvent.detail) {
        setTourState((prev) => ({
          ...prev,
          isActive: customEvent.detail.active,
          currentStep: customEvent.detail.step,
        }));
      }
    };

    const handleReset = () => {
      setTourState({
        isActive: false,
        currentStep: 1,
        completed: false,
      });
    };

    window.addEventListener("ix:halo-tour-step", handleStepChange);
    window.addEventListener("ix:tour-reset", handleReset);
    return () => {
      window.removeEventListener("ix:halo-tour-step", handleStepChange);
      window.removeEventListener("ix:tour-reset", handleReset);
    };
  }, []);

  const { isActive, currentStep } = tourState;

  if (!mounted || !isActive) return null;

  const isExpandedStep = currentStep === 2 || currentStep === 4 || currentStep === 5;
  const step = TOUR_STEPS[currentStep - 1];
  if (!step) return null;

  const nextStep = () => {
    window.dispatchEvent(new CustomEvent("ix:tour-next"));
  };

  const prevStep = () => {
    window.dispatchEvent(new CustomEvent("ix:tour-prev"));
  };

  const skipTour = () => {
    window.dispatchEvent(new CustomEvent("ix:tour-skip"));
  };

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Page backdrop blur focus overlay */}
          <motion.div
            key="tour-backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tweenFast}
            // The shared dialog scrim, kept inside Halo's own stacking context (below the tooltip).
            className={cn(overlayScrimClassName, "pointer-events-none z-10")}
          />

          <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96, transition: tweenExit }}
            transition={springSmooth}
            className={cn(
              "pointer-events-auto fixed z-40",
              isExpandedStep
                ? "top-[320px] left-1/2 w-[340px] -translate-x-1/2 lg:top-[220px] lg:left-[calc(50%+250px)] lg:w-[320px] lg:translate-x-0 lg:translate-y-0"
                : "top-1/2 left-1/2 w-[350px] -translate-x-1/2 -translate-y-1/2"
            )}
          >
            {/* v2: the island's acrylic with its four refraction edges, a tint ring and a soft
                tint glow around the card. */}
            <FacetMaterial
              material="acrylic"
              role="dialog"
              aria-label="Halo walkthrough"
              className="text-label rounded-card ring-tint/25 facet-glow p-6 ring-1"
            >
              <div className="relative z-10 flex flex-col gap-3">
                {/* Header & Close */}
                <div className="flex items-center justify-between">
                  <span className="text-tint text-eyebrow">
                    Halo Walkthrough • {currentStep} of 5
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={skipTour}
                    className="text-label-secondary hover:text-label rounded-full"
                    aria-label="Close Tour"
                  >
                    <X aria-hidden />
                  </Button>
                </div>

                {/* Title & Description */}
                <div className="flex flex-col gap-1">
                  <h4 className="text-headline text-label">{step.title}</h4>
                  <p className="text-callout text-label-secondary">{step.description}</p>
                </div>

                {/* Progress Dots */}
                <div className="flex items-center gap-2 py-1">
                  {TOUR_STEPS.map((s) => (
                    <div
                      key={s.id}
                      aria-hidden="true"
                      className={`h-1.5 rounded-full transition-[width,background-color] duration-150 ${
                        s.id === currentStep
                          ? "bg-tint w-4"
                          : s.id < currentStep
                            ? "bg-tint/40 w-1.5"
                            : "bg-fill-3 w-1.5"
                      }`}
                    />
                  ))}
                </div>

                {/* Action buttons */}
                <div className="border-separator mt-1 flex items-center justify-between border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipTour}
                    className="text-label-secondary"
                  >
                    Skip
                  </Button>

                  <div className="flex gap-2">
                    {currentStep > 1 && (
                      <Button variant="bordered" size="sm" onClick={prevStep}>
                        <ChevronLeft />
                        Back
                      </Button>
                    )}

                    <Button size="sm" onClick={nextStep}>
                      {currentStep === 5 ? (
                        "Finish"
                      ) : (
                        <>
                          Next
                          <ChevronRight />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </FacetMaterial>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
