/**
 * Navigation Buttons Component
 *
 * Previous/Next navigation with validation status
 */

import React from 'react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ValidationResult } from '~/lib/government-builder-validation';

export interface NavigationButtonsProps {
  currentStepIndex: number;
  totalSteps: number;
  validation: ValidationResult;
  onPrevious: () => void;
  onNext: () => void;
  isReadOnly?: boolean;
}

export const NavigationButtons = React.memo(function NavigationButtons({
  currentStepIndex,
  totalSteps,
  validation,
  onPrevious,
  onNext,
  isReadOnly = false,
}: NavigationButtonsProps) {
  const errorCount = Object.keys(validation.errors).length;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-border">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={currentStepIndex === 0 || isReadOnly}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <div className="flex items-center gap-2">
        {validation.isValid ? (
          <Badge
            variant="default"
            className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          >
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
        onClick={onNext}
        disabled={currentStepIndex === totalSteps - 1 || isReadOnly}
      >
        Next
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
});
