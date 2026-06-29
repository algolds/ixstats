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
        "pointer-events-auto transition-transform hover:scale-105 active:scale-95 group focus:outline-none focus:ring-1 focus:ring-primary rounded-full",
        className
      )}
      aria-label="Start Halo Onboarding Tour"
    >
      <FacetMaterial
        material="satin"
        className="flex items-center gap-2 border border-border bg-card/60 px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-lg"
      >
        <div className="relative flex items-center justify-center">
          <HelpCircle className="h-4 w-4 text-primary group-hover:text-primary/80 transition-colors" />
          
          {/* Pulsing notification dot to show they haven't run it yet */}
          {!completed && (
            <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
          Halo Tour
        </span>
      </FacetMaterial>
    </button>
  );
}
