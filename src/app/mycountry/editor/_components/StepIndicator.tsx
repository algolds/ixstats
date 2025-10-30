"use client";

import { CheckCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

export type EditorStep = "identity" | "core" | "government" | "economics" | "preview";

interface StepConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

interface StepIndicatorProps {
  steps: [EditorStep, StepConfig][];
  currentStep: EditorStep;
  onStepChange: (step: EditorStep) => void;
}

export function StepIndicator({ steps, currentStep, onStepChange }: StepIndicatorProps) {
  const currentStepIndex = steps.findIndex(([step]) => step === currentStep);

  return (
    <div className="mb-8 flex items-center justify-between">
      {steps.map(([step, config], index) => {
        const Icon = config.icon;
        const isCurrent = currentStep === step;
        const isPast = index < currentStepIndex;

        return (
          <div key={step} className="flex flex-1 items-center">
            <button
              onClick={() => onStepChange(step)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg p-3 transition-all",
                isCurrent && "bg-amber-100 dark:bg-amber-900/20",
                "hover:bg-muted"
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                  isCurrent && `bg-gradient-to-r ${config.color} border-transparent text-white`,
                  isPast && "border-green-500 bg-green-100 text-green-600",
                  !isCurrent && !isPast && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isPast ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    "text-xs font-semibold",
                    isCurrent && "text-amber-600",
                    isPast && "text-green-600"
                  )}
                >
                  {config.title}
                </div>
                <div className="text-muted-foreground hidden text-xs sm:block">
                  {config.description}
                </div>
              </div>
            </button>
            {index < steps.length - 1 && <div className="bg-muted mx-2 h-0.5 flex-1" />}
          </div>
        );
      })}
    </div>
  );
}
