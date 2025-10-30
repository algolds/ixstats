"use client";

import React from "react";
import { ArrowLeft, ArrowRight, CheckCircle, type LucideIcon } from "lucide-react";

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface StepNavigationProps {
  steps: readonly Step[];
  currentStep: string;
  onStepChange: (stepId: string) => void;
}

export function StepNavigation({ steps, currentStep, onStepChange }: StepNavigationProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="bg-muted/50 border-border flex items-center justify-between overflow-x-auto rounded-lg border p-4">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = index < currentStepIndex;

        return (
          <div key={step.id} className="flex flex-shrink-0 items-center">
            <button
              onClick={() => onStepChange(step.id)}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                    : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <StepIcon className="h-4 w-4" />
              <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
              {isCompleted && <CheckCircle className="h-4 w-4" />}
            </button>
            {index < steps.length - 1 && (
              <ArrowRight className="text-muted-foreground mx-2 h-4 w-4 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
