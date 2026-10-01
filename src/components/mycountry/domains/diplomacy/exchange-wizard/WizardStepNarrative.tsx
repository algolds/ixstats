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
        <h3 className="text-label text-title-3 mb-2">Exchange Narrative & Objectives</h3>
        <p className="text-label-secondary text-body">
          Craft the story and goals of this cultural exchange.
        </p>
      </div>

      {/* Narrative */}
      <div className="space-y-2">
        <Label htmlFor="narrative" className="text-label">
          Exchange Narrative *
        </Label>
        <Textarea
          id="narrative"
          placeholder={narrativePlaceholder}
          value={narrative}
          onChange={(e) => onNarrativeChange(e.target.value)}
          className="min-h-32"
        />
        <p className="text-label-secondary text-footnote">
          Describe the purpose, activities, and expected outcomes of this exchange.
        </p>
      </div>

      {/* Objectives */}
      <div className="space-y-2">
        <Label className="text-label">Objectives * (select at least one)</Label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {COMMON_OBJECTIVES.map((objective) => {
            const isSelected = objectives.includes(objective);
            return (
              <label
                key={objective}
                className={cn(
                  "bg-surface rounded-row flex cursor-pointer items-center gap-3 border p-3 text-left transition-[background-color,border-color] duration-150",
                  isSelected ? "border-tint bg-tint-fill" : "border-separator hover:bg-fill-4"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleObjective(objective)}
                />
                <span className="text-label text-body">{objective}</span>
              </label>
            );
          })}
        </div>
        <p className="text-label-secondary text-footnote mt-2">
          Selected: {objectives.length} objective{objectives.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
});
