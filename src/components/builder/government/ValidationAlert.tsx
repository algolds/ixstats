/**
 * Validation Alert Component
 *
 * Displays validation errors in a structured format
 */

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { ValidationErrors } from "~/lib/government-builder-validation";

export interface ValidationAlertProps {
  errors: ValidationErrors;
}

export const ValidationAlert = React.memo(function ValidationAlert({
  errors,
}: ValidationAlertProps) {
  if (Object.keys(errors).length === 0) return null;

  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Please fix the following issues:
        <ul className="mt-2 list-inside list-disc space-y-1">
          {Object.entries(errors).map(([key, errorList]) =>
            Array.isArray(errorList)
              ? errorList.map((error, index) => (
                  <li key={`${key}-${index}`} className="text-sm">
                    {error}
                  </li>
                ))
              : Object.entries(errorList as Record<string, string[]>).map(([subKey, subErrors]) => (
                  <li key={`${key}-${subKey}`} className="text-sm">
                    {key === "departments"
                      ? `Department ${parseInt(subKey) + 1}: `
                      : key === "revenue"
                        ? `Revenue ${parseInt(subKey) + 1}: `
                        : ""}
                    {Array.isArray(subErrors) ? subErrors.join(", ") : String(subErrors)}
                  </li>
                ))
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
});
