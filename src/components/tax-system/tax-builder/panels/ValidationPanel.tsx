/**
 * Validation Panel for Tax Builder
 *
 * Displays unified validation errors and warnings
 * across all builder steps.
 */

"use client";

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ValidationPanelProps {
  isValid: boolean;
  errors: Record<string, any>;
}

/**
 * Validation Panel Component
 * ~150 lines extracted from main TaxBuilder
 */
export const ValidationPanel = React.memo<ValidationPanelProps>(({ isValid, errors }) => {
  // Don't show if valid or no errors
  if (isValid || Object.keys(errors).length === 0) {
    return null;
  }

  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Please fix the following issues:
        <ul className="mt-2 list-inside list-disc space-y-1">
          {Object.entries(errors).map(([key, errorValue]) =>
            Array.isArray(errorValue)
              ? errorValue.map((error, index) => (
                  <li key={`${key}-${index}`} className="text-sm">
                    {error}
                  </li>
                ))
              : Object.entries(errorValue as Record<string, unknown>).map(([subKey, subErrors]) => (
                  <li key={`${key}-${subKey}`} className="text-sm">
                    {key === "categories" ? `Category ${parseInt(subKey) + 1}: ` : ""}
                    {Array.isArray(subErrors) ? subErrors.join(", ") : (subErrors as string)}
                  </li>
                ))
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
});

ValidationPanel.displayName = "ValidationPanel";
