"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TOUR_STEPS } from "./HaloTourContext";
import { Button } from "~/components/ui/button";
import {
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Xmark as X,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { overlayScrimClassName } from "~/components/ui/dialog";
import { PopoverDescription, PopoverTitle, VirtualAnchorPopover } from "~/components/ui/popover";
import { tweenFast } from "~/lib/design/motion";
import { useHydrated } from "~/hooks/useHydrated";

/** Initial completed status from localStorage; false on the server. */
function readTourCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("ixstats:halo-tour-completed") === "true";
  } catch {
    return false; // storage unavailable (private mode): tour treated as not completed
  }
}

export function HaloTourTooltip() {
  // Nothing renders before hydration (`mounted`), so reading storage here cannot mismatch.
  const [tourState, setTourState] = useState<{
    isActive: boolean;
    currentStep: number;
    completed: boolean;
  }>(() => ({
    isActive: false,
    currentStep: 1,
    completed: readTourCompleted(),
  }));

  const mounted = useHydrated();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
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

  // Halo can remount between steps, so the anchor is looked up again whenever the step changes.
  useEffect(() => {
    // oxlint-disable-next-line
    setAnchor(isActive ? document.getElementById("command-palette") : null);
  }, [isActive, currentStep]);

  if (!mounted || !isActive) return null;

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
    <>
      <AnimatePresence>
        <motion.div
          key="tour-backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tweenFast}
          // The shared dialog scrim, kept inside Halo's own stacking context (below the walkthrough).
          className={cn(overlayScrimClassName, "z-raised pointer-events-none")}
        />
      </AnimatePresence>

      <VirtualAnchorPopover
        anchor={anchor}
        open={isActive}
        onOpenChange={(open) => {
          if (!open) skipTour();
        }}
        // The user works in Halo during the tour, so a press outside must not end it.
        onInteractOutside={(e) => e.preventDefault()}
        // Always below: expanded Halo fills a phone's width, so a side placement flips off-screen and traps the user.
        side="bottom"
        align="center"
        sideOffset={12}
        collisionPadding={16}
        autoFocus
        aria-label="Halo walkthrough"
        className="w-80"
      >
        <div className="flex flex-col gap-3">
          {/* Header & Close */}
          <div className="flex items-center justify-between">
            <p className="text-footnote text-label-secondary">Step {currentStep} of 5</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={skipTour}
              className="text-label-secondary hover:text-label rounded-full"
              aria-label="Close tour"
            >
              <X aria-hidden />
            </Button>
          </div>

          {/* Title & Description */}
          <div className="flex flex-col gap-1">
            <PopoverTitle>{step.title}</PopoverTitle>
            <PopoverDescription>{step.description}</PopoverDescription>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center gap-2 py-1">
            {TOUR_STEPS.map((s) => (
              <div
                key={s.id}
                aria-hidden="true"
                className={`duration-fast h-1.5 rounded-full transition-[width,background-color] ${
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
            <Button variant="ghost" size="sm" onClick={skipTour} className="text-label-secondary">
              Skip
            </Button>

            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" size="sm" onClick={prevStep}>
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
      </VirtualAnchorPopover>
    </>
  );
}
