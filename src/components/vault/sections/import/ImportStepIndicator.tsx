"use client";

import React from "react";
import { Check } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

export type WizardStep = "intro" | "verify" | "preview" | "importing" | "complete";

const WIZARD_STEPS: readonly { id: WizardStep; label: string }[] = [
  { id: "intro", label: "Nation" },
  { id: "verify", label: "Verify" },
  { id: "preview", label: "Confirm" },
  { id: "importing", label: "Import" },
  { id: "complete", label: "Done" },
];

export function ImportStepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = Math.max(
    0,
    WIZARD_STEPS.findIndex((s) => s.id === currentStep)
  );
  const activeStep = WIZARD_STEPS[currentIdx];

  return (
    <FacetMaterial
      layer="chrome"
      as="nav"
      aria-label="Import steps"
      data-slot="import-step-indicator"
      className="space-y-3 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-subhead text-label">{activeStep?.label}</span>
        <span className="text-footnote text-label-secondary tabular-nums">
          Step {currentIdx + 1} of {WIZARD_STEPS.length}
        </span>
      </div>

      <Progress
        value={currentIdx + 1}
        max={WIZARD_STEPS.length}
        aria-label="Import progress"
        className="h-1.5"
      />

      <ol className="flex items-center justify-between gap-2">
        {WIZARD_STEPS.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-center gap-1.5"
            >
              <span
                className={cn(
                  "text-caption duration-fast ease-out-facet flex size-7 shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums transition-colors",
                  (isComplete || isCurrent) && "facet-gold border-transparent",
                  !isComplete && !isCurrent && "border-separator bg-fill-4 text-label-tertiary"
                )}
              >
                {isComplete ? <Check aria-hidden className="size-3.5" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "text-footnote hidden font-medium sm:inline",
                  isCurrent && "text-label",
                  isComplete && "text-label-secondary",
                  !isComplete && !isCurrent && "text-label-tertiary"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </FacetMaterial>
  );
}
