"use client";

import React from "react";
import { motion } from "motion/react";
import { Globe, ShieldCheck, CheckCircle, Download, Sparkles, Check } from "lucide-react";
import { cn } from "~/lib/utils";

export type WizardStep = "intro" | "verify" | "preview" | "importing" | "complete";

export const WIZARD_STEPS: { id: WizardStep; label: string; icon: typeof Globe }[] = [
  { id: "intro", label: "Nation", icon: Globe },
  { id: "verify", label: "Verify", icon: ShieldCheck },
  { id: "preview", label: "Confirm", icon: CheckCircle },
  { id: "importing", label: "Import", icon: Download },
  { id: "complete", label: "Done", icon: Sparkles },
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
                isComplete && "border-green-400 bg-green-500/20",
                isCurrent && "border-rose-400 bg-rose-500/20",
                !isComplete && !isCurrent && "border-white/10 bg-white/5"
              )}
              animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
              transition={isCurrent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
            >
              {isComplete ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isCurrent ? "text-rose-400" : "text-muted-foreground/50"
                  )}
                />
              )}
            </motion.div>

            {/* Label */}
            <span
              className={cn(
                "ml-1.5 hidden text-xs font-semibold sm:inline",
                isComplete && "text-green-400",
                isCurrent && "text-rose-400",
                !isComplete && !isCurrent && "text-muted-foreground/50"
              )}
            >
              {step.label}
            </span>

            {/* Connecting line */}
            {idx < WIZARD_STEPS.length - 1 && (
              <div className="mx-2 h-px flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-green-400 to-rose-400"
                  initial={{ width: "0%" }}
                  animate={{ width: isComplete ? "100%" : isCurrent ? "50%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
