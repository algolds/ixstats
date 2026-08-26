"use client";

import React, { useState, useEffect } from "react";
import { Sparks as Sparkles, Page as ScrollText, EyeClosed as EyeOff, SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";

interface ParadoxFlavorCardProps {
  id: string;
  type: "issue" | "policy" | "decision";
  title: string;
  description: string;
  countryId?: string;
}

export function ParadoxFlavorCard({
  id,
  type,
  title,
  description,
  countryId,
}: ParadoxFlavorCardProps) {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  // Read user preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("narrator:flavor:enabled");
      if (stored !== null) {
        setIsEnabled(stored === "true");
      }
    } catch  {
      // Ignore localStorage errors
    }
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const nextVal = !isEnabled;
    setIsEnabled(nextVal);
    try {
      localStorage.setItem("narrator:flavor:enabled", String(nextVal));
    } catch  {
      // Ignore
    }
  };

  const { data, isLoading, isError } = api.narrator.getFlavorText.useQuery(
    {
      id,
      type,
      title,
      description,
      countryId,
    },
    {
      enabled: mounted && isEnabled,
      staleTime: Infinity, // Strongly cache in react-query to prevent unnecessary fetches
      retry: false, // Don't spam retries on LLM fail
    }
  );

  // Prevent SSR class name hydration mismatch
  if (!mounted) return null;

  // User preference: disabled. Render an option to re-enable
  if (!isEnabled) {
    return (
      <div className="mt-1 flex justify-end pr-1">
        <button
          onClick={handleToggle}
          className="text-muted-foreground flex items-center gap-1 text-[10px] transition-colors hover:text-amber-400 focus:outline-none"
          title="Enable Paradox Interactive-style AI flavor cards"
        >
          <Sparkles className="h-3 w-3" />
          <span>Show AI Chronicle</span>
        </button>
      </div>
    );
  }

  // Shimmering loading state
  if (isLoading) {
    return (
      <div className="relative my-2 animate-pulse overflow-hidden rounded-lg border border-amber-500/15 bg-amber-500/5 p-4">
        <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500/35" />
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-500/60 uppercase">
            <ScrollText className="h-3.5 w-3.5" />
            <span>The Chronicle</span>
          </div>
          <Loader2 className="h-3 w-3 animate-spin text-amber-500/40" />
        </div>
        <span className="block font-serif text-sm leading-relaxed text-slate-500 italic">
          Drafting Chronicle...
        </span>
      </div>
    );
  }

  // Graceful degradation: if query fails, system setting is disabled, or no flavor text is returned
  if (isError || !data?.flavorText) {
    return null;
  }

  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
      {/* Paradox gold trim bar */}
      <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500/70" />

      {/* Title & Hide button */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-500/80 uppercase">
          <ScrollText className="h-3.5 w-3.5 animate-pulse" />
          <span>The Chronicle</span>
        </div>
        <button
          onClick={handleToggle}
          className="text-muted-foreground/30 p-0.5 transition-colors hover:text-red-400 focus:outline-none"
          title="Hide AI flavor cards"
        >
          <EyeOff className="h-3 w-3" />
        </button>
      </div>

      {/* Flavor Narrative text */}
      <span className="block font-serif text-sm leading-relaxed text-slate-200 italic">
        {data.flavorText}
      </span>
    </div>
  );
}
