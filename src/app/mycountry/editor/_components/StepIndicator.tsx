"use client";

import { CheckCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

export type EditorStep = 'identity' | 'core' | 'government' | 'economics' | 'preview';

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
    <div className="flex justify-between items-center mb-8">
      {steps.map(([step, config], index) => {
        const Icon = config.icon;
        const isCurrent = currentStep === step;
        const isPast = index < currentStepIndex;

        return (
          <div key={step} className="flex items-center flex-1">
            <button
              onClick={() => onStepChange(step)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                isCurrent && "bg-amber-100 dark:bg-amber-900/20",
                "hover:bg-muted"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                isCurrent && `bg-gradient-to-r ${config.color} text-white border-transparent`,
                isPast && "bg-green-100 border-green-500 text-green-600",
                !isCurrent && !isPast && "border-muted-foreground/30 text-muted-foreground"
              )}>
                {isPast ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="text-center">
                <div className={cn(
                  "text-xs font-semibold",
                  isCurrent && "text-amber-600",
                  isPast && "text-green-600"
                )}>
                  {config.title}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {config.description}
                </div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-muted mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}
