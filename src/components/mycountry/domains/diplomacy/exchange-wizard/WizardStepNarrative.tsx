"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { COMMON_OBJECTIVES } from "./exchange-wizard-config";

interface WizardStepNarrativeProps {
  narrative: string;
  onNarrativeChange: (value: string) => void;
  narrativePlaceholder: string;
  objectives: string[];
  onToggleObjective: (objective: string) => void;
}

/** Step 3 — narrative and objectives. */
export const WizardStepNarrative = React.memo(function WizardStepNarrative({
  narrative,
  onNarrativeChange,
  narrativePlaceholder,
  objectives,
  onToggleObjective,
}: WizardStepNarrativeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground mb-2 text-lg font-bold">Exchange Narrative & Objectives</h3>
        <p className="text-muted-foreground text-sm">
          Craft the story and goals of this cultural exchange.
        </p>
      </div>

      {/* Narrative */}
      <div className="space-y-2">
        <Label htmlFor="narrative" className="text-foreground">
          Exchange Narrative *
        </Label>
        <Textarea
          id="narrative"
          placeholder={narrativePlaceholder}
          value={narrative}
          onChange={(e) => onNarrativeChange(e.target.value)}
          className="bg-input min-h-32 border-border focus:border-amber-500/50"
        />
        <p className="text-muted-foreground text-xs">
          Describe the purpose, activities, and expected outcomes of this exchange.
        </p>
      </div>

      {/* Objectives */}
      <div className="space-y-2">
        <Label className="text-foreground">Objectives * (select at least one)</Label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {COMMON_OBJECTIVES.map((objective) => {
            const isSelected = objectives.includes(objective);
            return (
              <div
                key={objective}
                onClick={() => onToggleObjective(objective)}
                className={cn(
                  "facet-hierarchy-child rounded-lg p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
                  "cursor-pointer border text-left hover:border-amber-500/40",
                  isSelected ? "border-amber-500/50 ring-2 ring-amber-500/50" : "border-border/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  <span className="text-foreground text-sm">{objective}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Selected: {objectives.length} objective{objectives.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
});
