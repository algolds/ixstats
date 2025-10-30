/**
 * Exemptions & Deductions Step for Tax Builder
 *
 * Handles tax exemptions and deductions configuration.
 * Currently shows placeholder as exemptions/deductions are managed
 * within category forms.
 */

"use client";

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { FileText } from "lucide-react";

interface ExemptionsDeductionsStepProps {
  isReadOnly: boolean;
}

/**
 * Exemptions & Deductions Step Component
 * ~300 lines extracted from main TaxBuilder
 */
export const ExemptionsDeductionsStep = React.memo<ExemptionsDeductionsStepProps>(
  ({ isReadOnly }) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-2xl font-semibold">Exemptions & Deductions</h2>
        </div>
        <Card className="border-2 border-dashed">
          <CardContent className="p-8 text-center">
            <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">Exemptions & Deductions</h3>
            <p className="text-muted-foreground mb-4">
              Configure tax exemptions and deductions in the category forms above
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
);

ExemptionsDeductionsStep.displayName = "ExemptionsDeductionsStep";
