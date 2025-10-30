/**
 * Step Progress Component
 *
 * Visual progress indicator for government builder steps
 */

import React from "react";
import { CheckCircle, AlertTriangle, ArrowRight, type LucideIcon } from "lucide-react";
import type { ValidationErrors } from "~/lib/government-builder-validation";

export interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface StepProgressProps {
  steps: Step[];
  currentStep: string;
  onStepChange: (stepId: string) => void;
  validationErrors: ValidationErrors;
  isReadOnly?: boolean;
}

export const StepProgress = React.memo(function StepProgress({
  steps,
  currentStep,
  onStepChange,
  validationErrors,
  isReadOnly = false,
}: StepProgressProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-4">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = index < currentStepIndex;
        const hasErrors =
          validationErrors[step.id as keyof ValidationErrors] &&
          (Array.isArray(validationErrors[step.id as keyof ValidationErrors])
            ? (validationErrors[step.id as keyof ValidationErrors] as string[]).length > 0
            : Object.keys(validationErrors[step.id as keyof ValidationErrors] as object).length >
              0);

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => onStepChange(step.id)}
              disabled={isReadOnly}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted && !hasErrors
                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                    : hasErrors
                      ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                      : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <StepIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{step.label}</span>
              {isCompleted && !hasErrors && <CheckCircle className="h-4 w-4" />}
              {hasErrors && <AlertTriangle className="h-4 w-4" />}
            </button>
            {index < steps.length - 1 && (
              <ArrowRight className="text-muted-foreground mx-2 h-4 w-4" />
            )}
          </div>
        );
      })}
    </div>
  );
});
