"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Crown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { BUILDER_GOLD, BUILDER_GOLD_HOVER, stepOrder } from "../builderConfig";
import { useBuilderContext } from "../context/BuilderStateContext";
import { useBuilderActions } from "../../../hooks/useBuilderActions";

interface BuilderFooterProps {
  onCreateCountry?: () => Promise<void>;
  isCreating?: boolean;
}

/**
 * BuilderFooter - Navigation footer for builder steps
 *
 * Displays:
 * - Back button
 * - Progress indicator
 * - Continue/Create button
 * - Step counter
 */
export function BuilderFooter({ onCreateCountry, isCreating = false }: BuilderFooterProps) {
  const { builderState, setBuilderState, mode } = useBuilderContext();
  const { handleContinue, handlePreviousStep, progressPercentage } = useBuilderActions({
    builderState,
    setBuilderState,
    mode,
  });

  const isEditMode = mode === "edit";
  const steps = isEditMode
    ? ["core", "government", "economics", "preview"]
    : ["foundation", "core", "preview"];

  const currentStepIndex = steps.indexOf(builderState.step);
  const totalSteps = steps.length;
  const isPreviewStep = builderState.step === "preview";
  const isFoundationStep = builderState.step === "foundation";
  const isCoreStep = builderState.step === "core";

  // In edit mode, disable back button on core step (can't go to foundation)
  const isBackDisabled = isFoundationStep || (isEditMode && isCoreStep);

  return (
    <div className="flex items-center justify-between pt-6">
      <Button
        variant="outline"
        onClick={handlePreviousStep}
        className="min-w-[120px]"
        disabled={isBackDisabled}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Progress value={progressPercentage} className="h-2 w-24" />
        <span>
          Step {currentStepIndex + 1} of {totalSteps}
        </span>
      </div>

      {isPreviewStep && onCreateCountry ? (
        <Button
          onClick={onCreateCountry}
          disabled={isCreating}
          size="lg"
          className={cn(
            "min-w-[200px] bg-gradient-to-r shadow-lg transition-all",
            isCreating
              ? "cursor-not-allowed from-gray-400 to-gray-500 opacity-90"
              : isEditMode
                ? "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl"
                : "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:shadow-xl"
          )}
          aria-busy={isCreating}
          aria-label={
            isCreating
              ? isEditMode
                ? "Updating your country, please wait"
                : "Creating your nation, please wait"
              : isEditMode
                ? "Update country"
                : "Create your nation"
          }
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditMode ? "Updating Country..." : "Creating Nation..."}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {isEditMode ? "Update Country" : "Create My Nation"}
              <Crown className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleContinue}
          className={cn("min-w-[120px] bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
