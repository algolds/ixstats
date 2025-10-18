"use client";

import React from 'react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { ValidationStatus } from '../utils/previewCalculations';

interface ValidationResultsProps {
  validationStatus: ValidationStatus;
}

export function ValidationResults({ validationStatus }: ValidationResultsProps) {
  return (
    <div className="space-y-4">
      {validationStatus.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Configuration Errors:</div>
              {validationStatus.errors.map((error, index) => (
                <div key={index} className="text-sm">• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {validationStatus.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Configuration Warnings:</div>
              {validationStatus.warnings.map((warning, index) => (
                <div key={index} className="text-sm">• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {validationStatus.isValid && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Configuration is valid and ready to save!</div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
