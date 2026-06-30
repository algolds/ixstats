"use client";

import React, { useEffect, useState } from "react";
import { FacetMaterial } from "~/components/facet-ui/shared/FacetMaterial";
import { HelpCircle } from "lucide-react";
import { cn } from "~/lib/utils";

interface HaloTourTriggerProps {
  className?: string;
}

export function HaloTourTrigger({ className }: HaloTourTriggerProps) {
  const [isActive, setIsActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check initial completed status from localStorage
    try {
      setCompleted(localStorage.getItem("ixstats:halo-tour-completed") === "true");
    } catch (e) {
      console.error(e);
    }

    // Listen to tour step changes to synchronize active state
    const handleStepChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ step: number; active: boolean }>;
      if (customEvent.detail) {
        setIsActive(customEvent.detail.active);

        // Also update completed status dynamically if the tour just completed
        if (!customEvent.detail.active) {
          try {
            setCompleted(localStorage.getItem("ixstats:halo-tour-completed") === "true");
          } catch {}
        }
      }
    };

    // Listen for reset events
    const handleReset = () => {
      setCompleted(false);
      setIsActive(false);
    };

    window.addEventListener("ix:halo-tour-step", handleStepChange);
    window.addEventListener("ix:tour-reset", handleReset);
    return () => {
      window.removeEventListener("ix:halo-tour-step", handleStepChange);
      window.removeEventListener("ix:tour-reset", handleReset);
    };
  }, []);

  const handleStart = () => {
    window.dispatchEvent(new CustomEvent("ix:tour-start"));
  };

  if (!mounted || isActive) return null;

  return (
    <button
      onClick={handleStart}
      className={cn(
        "group focus:ring-primary pointer-events-auto rounded-full transition-transform hover:scale-105 focus:ring-1 focus:outline-none active:scale-95",
        className
      )}
      aria-label="Start Halo Onboarding Tour"
    >
      <FacetMaterial
        material="satin"
        className="border-border bg-card/60 flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-lg backdrop-blur-md"
      >
        <div className="relative flex items-center justify-center">
          <HelpCircle className="text-primary group-hover:text-primary/80 h-4 w-4 transition-colors" />

          {/* Pulsing notification dot to show they haven't run it yet */}
          {!completed && (
            <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
              <span className="bg-primary relative inline-flex h-2 w-2 rounded-full"></span>
            </span>
          )}
        </div>
        <span className="text-foreground/90 group-hover:text-foreground text-xs font-semibold transition-colors">
          Halo Tour
        </span>
      </FacetMaterial>
    </button>
  );
}
