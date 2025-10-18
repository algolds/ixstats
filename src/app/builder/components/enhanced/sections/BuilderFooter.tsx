"use client";

import React from 'react';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Crown } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/lib/utils';
import { BUILDER_GOLD, BUILDER_GOLD_HOVER, stepOrder } from '../builderConfig';
import { useBuilderContext } from '../context/BuilderStateContext';
import { useBuilderActions } from '../../../hooks/useBuilderActions';

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
  const { builderState, setBuilderState } = useBuilderContext();
  const { handleContinue, handlePreviousStep, progressPercentage } = useBuilderActions({
    builderState,
    setBuilderState,
  });

  const currentStepIndex = stepOrder.indexOf(builderState.step);
  const isPreviewStep = builderState.step === 'preview';
  const isFoundationStep = builderState.step === 'foundation';

  return (
    <div className="flex justify-between items-center pt-6">
      <Button
        variant="outline"
        onClick={handlePreviousStep}
        className="min-w-[120px]"
        disabled={isFoundationStep}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Progress value={progressPercentage} className="w-24 h-2" />
        <span>
          Step {currentStepIndex + 1} of {stepOrder.length}
        </span>
      </div>

      {isPreviewStep && onCreateCountry ? (
        <Button
          onClick={onCreateCountry}
          disabled={isCreating}
          size="lg"
          className="min-w-[200px] bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Nation...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Create My Nation
              <Crown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleContinue}
          className={cn('min-w-[120px] bg-gradient-to-r', BUILDER_GOLD, BUILDER_GOLD_HOVER)}
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
}
