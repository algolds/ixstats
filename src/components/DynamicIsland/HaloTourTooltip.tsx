"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TOUR_STEPS } from "./HaloTourContext";
import { FacetMaterial } from "~/components/facet-ui/shared/FacetMaterial";
import { Button } from "~/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { cn } from "~/lib/utils";

export function HaloTourTooltip() {
  const [tourState, setTourState] = useState<{
    isActive: boolean;
    currentStep: number;
    completed: boolean;
  }>({
    isActive: false,
    currentStep: 1,
    completed: false
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check initial completed status from localStorage
    try {
      const hasCompleted = localStorage.getItem("ixstats:halo-tour-completed") === "true";
      setTourState(prev => ({ ...prev, completed: hasCompleted }));
    } catch {}

    const handleStepChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ step: number; active: boolean }>;
      if (customEvent.detail) {
        setTourState(prev => ({
          ...prev,
          isActive: customEvent.detail.active,
          currentStep: customEvent.detail.step
        }));
      }
    };

    const handleReset = () => {
      setTourState({
        isActive: false,
        currentStep: 1,
        completed: false
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
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[99] bg-black/35 backdrop-blur-[3px] pointer-events-none"
          />

          <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className={cn(
              "fixed z-[10002] pointer-events-auto transition-all duration-500 ease-in-out",
              isExpandedStep
                ? "top-[100px] left-1/2 -translate-x-1/2 w-[340px] lg:top-[120px] lg:left-[calc(50%+250px)] lg:translate-x-0 lg:translate-y-0 lg:w-[320px]"
                : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px]"
            )}
          >
        <FacetMaterial
          material="satin"
          className="rounded-2xl border border-white/20 dark:border-white/10 ring-1 ring-primary/25 p-6 text-foreground shadow-[0_0_40px_rgba(0,0,0,0.4),_0_0_20px_rgba(59,130,246,0.12)]"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)",
            backdropFilter: "blur(20px) saturate(145%)",
            WebkitBackdropFilter: "blur(20px) saturate(145%)",
          }}
          lightInteraction={true}
        >
          {/* Refraction edge highlights identical to the Halo component */}
          <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] select-none">
            <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
            <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col gap-3">
            {/* Header & Close */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Halo Walkthrough • {currentStep} of 5
              </span>
              <button
                onClick={skipTour}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close Tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Title & Description */}
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold tracking-tight text-foreground">
                {step.title}
              </h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>

            {/* Progress Dots */}
            <div className="flex items-center gap-1.5 py-1">
              {TOUR_STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s.id === currentStep
                      ? "w-4 bg-primary"
                      : s.id < currentStep
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="h-8 px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground font-normal"
              >
                Skip
              </Button>

              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevStep}
                    className="h-8 px-2.5 text-xs border-border bg-transparent text-foreground/80 hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  onClick={nextStep}
                  className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center shadow-lg shadow-primary/20"
                >
                  {currentStep === 5 ? (
                    "Finish"
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
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
