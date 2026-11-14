"use client";

import React from "react";
import { Globe, ShieldCheck, CheckCircle, Download, Check } from "iconoir-react";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

export type WizardStep = "intro" | "verify" | "preview" | "importing" | "complete";

const WIZARD_STEPS: { id: WizardStep; label: string; icon: typeof Globe }[] = [
  { id: "intro", label: "Nation", icon: Globe },
  { id: "verify", label: "Verify", icon: ShieldCheck },
  { id: "preview", label: "Confirm", icon: CheckCircle },
  { id: "importing", label: "Import", icon: Download },
  { id: "complete", label: "Done", icon: Check },
];

export function ImportStepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = Math.max(
    0,
    WIZARD_STEPS.findIndex((s) => s.id === currentStep)
  );
  const activeStep = WIZARD_STEPS[currentIdx];

  return (
    <div className="space-y-3">
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

      <div className="flex items-center justify-between gap-2">
        {WIZARD_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div key={step.id} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isComplete && "border-green/35 bg-green/15 text-green-ink",
                  isCurrent && "border-tint/40 bg-tint-fill text-tint-ink",
                  !isComplete && !isCurrent && "border-separator bg-fill-4 text-label-tertiary"
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  "text-footnote hidden font-medium sm:inline",
                  isComplete && "text-green-ink",
                  isCurrent && "text-label",
                  !isComplete && !isCurrent && "text-label-tertiary"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
