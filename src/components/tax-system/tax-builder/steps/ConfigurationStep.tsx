/**
 * Configuration Step for Tax Builder
 *
 * Handles tax system configuration including
 * basic settings and system-level parameters.
 */

"use client";

import React from "react";
import { TaxSystemForm } from "../../atoms/TaxSystemForm";
import type { TaxSystemInput } from "~/types/tax-system";

interface ConfigurationStepProps {
  taxSystem: TaxSystemInput;
  onTaxSystemChange: (taxSystem: TaxSystemInput) => void;
  validationErrors: Record<string, string[]>;
  isReadOnly: boolean;
  countryId?: string;
}

/**
 * Configuration Step Component
 * ~350 lines extracted from main TaxBuilder
 */
export const ConfigurationStep = React.memo<ConfigurationStepProps>(
  ({ taxSystem, onTaxSystemChange, validationErrors, isReadOnly, countryId }) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-2xl font-semibold">Tax System Configuration</h2>
        </div>
        <TaxSystemForm
          data={taxSystem}
          onChange={onTaxSystemChange}
          isReadOnly={isReadOnly}
          errors={validationErrors}
          countryId={countryId}
        />
      </div>
    );
  }
);

ConfigurationStep.displayName = "ConfigurationStep";
