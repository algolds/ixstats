// Builder Navigation Component - Handles step navigation and progress
// Extracted from AtomicBuilderPage.tsx for modularity

"use client";

import React, { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { stepOrder, type BuilderStep, BUILDER_GOLD, BUILDER_GOLD_HOVER } from "./builderConfig";

interface BuilderNavigationProps {
  currentStep: BuilderStep;
  activeCoreTab?: string;
  activeGovernmentTab?: string;
  activeEconomicsTab?: string;
  canContinue?: boolean;
  onPrevious: () => void;
  onContinue: () => void;
  className?: string;
}

export function BuilderNavigation({
  currentStep,
  activeCoreTab = "identity",
  activeGovernmentTab = "components",
  activeEconomicsTab = "economy",
  canContinue = true,
  onPrevious,
  onContinue,
  className,
}: BuilderNavigationProps) {
  const progressPercentage = useMemo(() => {
    const currentIndex = stepOrder.indexOf(currentStep);
    return ((currentIndex + 1) / stepOrder.length) * 100;
  }, [currentStep]);

  const stepNumber = useMemo(() => {
    return stepOrder.indexOf(currentStep) + 1;
  }, [currentStep]);

  // Determine if we're on a preview step (which shouldn't show continue)
  const isPreviewStep = currentStep === "preview";

  // Determine the continue button text based on current tab/step
  const continueText = useMemo(() => {
    if (currentStep === "economics") {
      if (activeEconomicsTab === "taxes") {
        return "Review";
      }
      return "Continue";
    }
    return "Continue";
  }, [currentStep, activeEconomicsTab]);

  return (
    <div className={cn("flex items-center justify-between pt-6", className)}>
      <Button variant="outline" onClick={onPrevious} className="min-w-[120px]">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Progress value={progressPercentage} className="h-2 w-24" />
        <span>
          Step {stepNumber} of {stepOrder.length}
        </span>
      </div>
      {!isPreviewStep && (
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          className={cn("min-w-[120px] bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
        >
          {continueText}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
      {isPreviewStep && (
        <div className="min-w-[120px]" /> // Spacer to maintain layout
      )}
    </div>
  );
}

// Separate navigation component for the preview step (different styling)
export function PreviewNavigation({
  onPrevious,
  className,
}: {
  onPrevious: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between pt-6", className)}>
      <Button variant="outline" onClick={onPrevious} size="lg" className="min-w-[140px]">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
    </div>
  );
}
