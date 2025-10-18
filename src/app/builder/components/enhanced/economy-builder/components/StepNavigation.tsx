"use client";

import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, type LucideIcon } from 'lucide-react';

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
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border overflow-x-auto">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = index < currentStepIndex;

        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <button
              onClick={() => onStepChange(step.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isCompleted
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <StepIcon className="h-4 w-4" />
              <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
              {isCompleted && <CheckCircle className="h-4 w-4" />}
            </button>
            {index < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
