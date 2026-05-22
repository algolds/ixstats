"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { BUILDER_GOLD, BUILDER_GOLD_HOVER } from "../../builderConfig";

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
  onSave,
}: NavigationButtonsProps) {
  return (
    <div className="border-border flex items-center justify-between border-t pt-6">
      <Button variant="outline" onClick={onPrevious} disabled={currentStepIndex === 0}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>

      <div className="flex items-center gap-2">
        <Button
          onClick={onSave}
          disabled={isSaving || !countryId || !validationStatus.isValid}
          className={`bg-gradient-to-r ${BUILDER_GOLD} ${BUILDER_GOLD_HOVER} text-white`}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>

        {validationStatus.isValid ? (
          <Badge
            variant="default"
            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            Valid Configuration
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {validationStatus.errorCount} Issues
          </Badge>
        )}
      </div>

      <Button onClick={onNext} disabled={currentStepIndex === totalSteps - 1}>
        Next
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
