"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import { Globe, ShieldCheck, CheckCircle, Download, Check } from "iconoir-react";
import { cn } from "~/lib/utils";

export type WizardStep = "intro" | "verify" | "preview" | "importing" | "complete";

export const WIZARD_STEPS: { id: WizardStep; label: string; icon: typeof Globe }[] = [
  { id: "intro", label: "Nation", icon: Globe },
  { id: "verify", label: "Verify", icon: ShieldCheck },
  { id: "preview", label: "Confirm", icon: CheckCircle },
  { id: "importing", label: "Import", icon: Download },
  { id: "complete", label: "Done", icon: Check },
];

export function ImportStepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between gap-1 px-2">
      {WIZARD_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.id} className="flex flex-1 items-center gap-0">
            {/* Step circle */}
            <motion.div
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isComplete && "border-green bg-green/20",
                isCurrent && "border-tint bg-tint-fill",
                !isComplete && !isCurrent && "border-separator bg-fill-4"
              )}
            >
              {isComplete ? (
                <Check className="text-green h-4 w-4" />
              ) : (
                <Icon className={cn("h-4 w-4", isCurrent ? "text-tint" : "text-label-tertiary")} />
              )}
            </motion.div>

            {/* Label */}
            <span
              className={cn(
                "text-footnote ml-2 hidden font-semibold sm:inline",
                isComplete && "text-green",
                isCurrent && "text-tint",
                !isComplete && !isCurrent && "text-label-tertiary"
              )}
            >
              {step.label}
            </span>

            {/* Connecting line */}
            {idx < WIZARD_STEPS.length - 1 && (
              <div className="bg-fill-3 mx-2 h-px flex-1 overflow-hidden rounded-full">
                <motion.div
                  className="bg-green h-full rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: isComplete ? "100%" : isCurrent ? "50%" : "0%" }}
                  transition={springSmooth}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
