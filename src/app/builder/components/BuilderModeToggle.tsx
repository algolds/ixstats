"use client";

import React, { useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { Settings, Flash as Zap } from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";

export interface BuilderModeToggleProps {
  className?: string;
}

/**
 * Apple Design & Emil Kowalski-crafted Mode Toggle for Builder & Editor:
 * - Segmented tactile switcher (Standard vs Advanced)
 * - Spring-driven sliding pill indicator (layoutId)
 * - Tactile pointer-down compression (`active:scale-[0.97]`)
 * - Audio-tactile binding (`soundEffects.toggle()`)
 * - Bidirectional synchronization of `showAdvancedMode` & `viewMode`
 * - Keyboard shortcut cue: ⌘⇧A / Ctrl+Shift+A
 */
export const BuilderModeToggle = React.memo(function BuilderModeToggle({
  className,
}: BuilderModeToggleProps) {
  const { builderState, setBuilderState } = useBuilderContext();
  const { viewMode, setViewMode } = useBuilderFilter();

  const isAdvanced = useMemo(
    () => builderState.showAdvancedMode || viewMode === "expert",
    [builderState.showAdvancedMode, viewMode]
  );

  const handleSelectMode = useCallback(
    (mode: "standard" | "expert") => {
      const willBeAdvanced = mode === "expert";
      if (willBeAdvanced === isAdvanced) return;

      soundEffects.toggle();
      setViewMode(mode);
      setBuilderState((prev) => ({
        ...prev,
        showAdvancedMode: willBeAdvanced,
      }));
    },
    [isAdvanced, setViewMode, setBuilderState]
  );

  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘⇧A" : "Ctrl+Shift+A";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="radiogroup"
          aria-label="Editor View Mode"
          className={cn(
            "relative flex h-8 items-center rounded-xl border border-border/50 bg-muted/40 p-0.5 shadow-xs backdrop-blur-md",
            className
          )}
        >
          {/* Standard Segment */}
          <button
            type="button"
            role="radio"
            aria-checked={!isAdvanced}
            onClick={() => handleSelectMode("standard")}
            data-cuelume-press
            className={cn(
              "relative z-10 flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.97]",
              !isAdvanced
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {!isAdvanced && (
              <motion.span
                layoutId="builder-mode-pill"
                className="absolute inset-0 z-[-1] rounded-lg border border-border/60 bg-card shadow-xs"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Standard</span>
          </button>

          {/* Advanced / Power Segment */}
          <button
            type="button"
            role="radio"
            aria-checked={isAdvanced}
            onClick={() => handleSelectMode("expert")}
            data-cuelume-press
            className={cn(
              "relative z-10 flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.97]",
              isAdvanced
                ? "text-amber-500 dark:text-amber-400"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {isAdvanced && (
              <motion.span
                layoutId="builder-mode-pill"
                className="absolute inset-0 z-[-1] rounded-lg border border-amber-500/30 bg-amber-500/10 shadow-xs dark:bg-amber-500/15"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <Zap className="h-3.5 w-3.5" />
            <span>Advanced</span>
            {isAdvanced && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
            )}
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-medium max-w-[260px] text-center">
        <p>
          {isAdvanced
            ? "Advanced Mode active: deep simulation tabs (Sectors, Workforce, Departments) unlocked."
            : "Switch to Advanced Mode for deep economic levers & department hierarchy."}
        </p>
        <span className="mt-1 inline-block text-[10px] font-mono text-muted-foreground opacity-80">
          Shortcut: {shortcutLabel}
        </span>
      </TooltipContent>
    </Tooltip>
  );
});
