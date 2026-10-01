"use client";

import React, { useCallback, useMemo } from "react";
import { Settings, Flash as Zap } from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";

export interface BuilderModeToggleProps {
  className?: string;
}

/**
 * Apple Design & Emil Kowalski-crafted Mode Toggle for Builder & Editor:
 * - Facet SegmentedControl (Standard vs Advanced; spring-snappy thumb, radiogroup ARIA)
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
        <div className={cn("inline-flex", className)}>
          <SegmentedControl
            aria-label="Editor View Mode"
            size="sm"
            value={isAdvanced ? "expert" : "standard"}
            onValueChange={handleSelectMode}
            options={[
              {
                value: "standard",
                label: <span className="hidden sm:inline">Standard</span>,
                icon: <Settings aria-hidden />,
                "aria-label": "Standard",
              },
              { value: "expert", label: "Advanced", icon: <Zap aria-hidden /> },
            ]}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-caption max-w-64 text-center">
        <p>
          {isAdvanced
            ? "Advanced Mode active: deep simulation tabs (Sectors, Workforce, Departments) unlocked."
            : "Switch to Advanced Mode for deep economic levers & department hierarchy."}
        </p>
        <span className="text-footnote mt-1 inline-block opacity-80">
          Shortcut: {shortcutLabel}
        </span>
      </TooltipContent>
    </Tooltip>
  );
});
