"use client";

import React from 'react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BuilderStep {
  id: string;
  label: string;
  icon: LucideIcon;
  internalTabs?: {
    id: string;
    label: string;
  }[];
}

export interface GlobalBuilderNavigationProps {
  steps: BuilderStep[];
  currentStep: string;
  currentInternalTab?: string; // For tracking sub-tabs within a step
  onStepChange: (stepId: string) => void;
  onInternalTabChange?: (tabId: string) => void;
  isValid?: boolean;
  validationErrors?: Record<string, any>;
  isReadOnly?: boolean;
  className?: string;
}

/**
 * Global Builder Navigation Component
 *
 * Provides unified navigation across all builders (Economy, Government, Tax)
 * with support for:
 * - Main step navigation
 * - Internal tab tracking within steps
 * - Dynamic step detection
 * - Validation status
 */
export function GlobalBuilderNavigation({
  steps,
  currentStep,
  currentInternalTab,
  onStepChange,
  onInternalTabChange,
  isValid = true,
  validationErrors = {},
  isReadOnly = false,
  className = ''
}: GlobalBuilderNavigationProps) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const currentStepData = steps[currentStepIndex];

  // Calculate if we're on the last internal tab (if tabs exist)
  const hasInternalTabs = currentStepData?.internalTabs && currentStepData.internalTabs.length > 0;
  const currentInternalTabIndex = hasInternalTabs && currentInternalTab
    ? currentStepData!.internalTabs!.findIndex(tab => tab.id === currentInternalTab)
    : -1;
  const isOnLastInternalTab = !hasInternalTabs ||
    currentInternalTabIndex === currentStepData!.internalTabs!.length - 1;
  const isOnFirstInternalTab = !hasInternalTabs || currentInternalTabIndex === 0;

  // Handle Previous navigation
  const handlePrevious = () => {
    if (isReadOnly) return;

    // If we have internal tabs and we're not on the first one, go to previous tab
    if (hasInternalTabs && !isOnFirstInternalTab && onInternalTabChange) {
      const prevTab = currentStepData!.internalTabs![currentInternalTabIndex - 1];
      onInternalTabChange(prevTab!.id);
    }
    // Otherwise go to previous step
    else if (currentStepIndex > 0) {
      const prevStep = steps[currentStepIndex - 1]!;
      onStepChange(prevStep.id);

      // If previous step has internal tabs, go to its last tab
      if (prevStep.internalTabs && prevStep.internalTabs.length > 0 && onInternalTabChange) {
        const lastTab = prevStep.internalTabs[prevStep.internalTabs.length - 1]!;
        onInternalTabChange(lastTab.id);
      }
    }
  };

  // Handle Next navigation
  const handleNext = () => {
    if (isReadOnly) return;

    // If we have internal tabs and we're not on the last one, go to next tab
    if (hasInternalTabs && !isOnLastInternalTab && onInternalTabChange) {
      const nextTab = currentStepData!.internalTabs![currentInternalTabIndex + 1];
      onInternalTabChange(nextTab!.id);
    }
    // Otherwise go to next step
    else if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1]!;
      onStepChange(nextStep.id);

      // If next step has internal tabs, go to its first tab
      if (nextStep.internalTabs && nextStep.internalTabs.length > 0 && onInternalTabChange) {
        const firstTab = nextStep.internalTabs[0]!;
        onInternalTabChange(firstTab.id);
      }
    }
  };

  const isOnFirstStep = currentStepIndex === 0 && isOnFirstInternalTab;
  const isOnLastStep = currentStepIndex === steps.length - 1 && isOnLastInternalTab;

  const errorCount = Object.keys(validationErrors).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Steps */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const hasErrors = validationErrors[step.id];

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => {
                  onStepChange(step.id);
                  // Reset to first internal tab when clicking a step
                  if (step.internalTabs && step.internalTabs.length > 0 && onInternalTabChange) {
                    onInternalTabChange(step.internalTabs[0]!.id);
                  }
                }}
                disabled={isReadOnly}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted && !hasErrors
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : hasErrors
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{step.label}</span>
                {isCompleted && !hasErrors && <CheckCircle className="h-4 w-4" />}
                {hasErrors && <AlertTriangle className="h-4 w-4" />}

                {/* Internal tab indicator */}
                {step.internalTabs && step.internalTabs.length > 0 && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs">
                    {step.internalTabs.length}
                  </Badge>
                )}
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {/* Internal Tab Progress (if applicable) */}
      {hasInternalTabs && currentStepData && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
          <span className="text-sm text-muted-foreground mr-2">
            {currentStepData.label} Section:
          </span>
          {currentStepData.internalTabs!.map((tab, index) => {
            const isActiveTab = tab.id === currentInternalTab;
            const isCompletedTab = currentInternalTab && index < currentInternalTabIndex;

            return (
              <React.Fragment key={tab.id}>
                <button
                  onClick={() => onInternalTabChange?.(tab.id)}
                  disabled={isReadOnly}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isActiveTab
                      ? 'bg-primary text-primary-foreground'
                      : isCompletedTab
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </button>
                {index < currentStepData.internalTabs!.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isOnFirstStep || isReadOnly}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {isValid ? (
            <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid Configuration
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {errorCount} {errorCount === 1 ? 'Issue' : 'Issues'}
            </Badge>
          )}
        </div>

        <Button
          onClick={handleNext}
          disabled={isOnLastStep || isReadOnly}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
