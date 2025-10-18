"use client";

import React from 'react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface NavigationButtonsProps {
  currentStepIndex: number;
  totalSteps: number;
  validationStatus: {
    isValid: boolean;
    errorCount: number;
  };
  isSaving: boolean;
  countryId?: string;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
}

export function NavigationButtons({
  currentStepIndex,
  totalSteps,
  validationStatus,
  isSaving,
  countryId,
  onPrevious,
  onNext,
  onSave
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-border">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={currentStepIndex === 0}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <div className="flex items-center gap-2">
        <Button
          onClick={onSave}
          disabled={isSaving || !countryId || !validationStatus.isValid}
          className="bg-gold-600 hover:bg-gold-700 text-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>

        {validationStatus.isValid ? (
          <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Valid Configuration
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {validationStatus.errorCount} Issues
          </Badge>
        )}
      </div>

      <Button
        onClick={onNext}
        disabled={currentStepIndex === totalSteps - 1}
      >
        Next
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
