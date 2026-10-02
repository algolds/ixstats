"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { City as Building2 } from "iconoir-react";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicInputs } from "../../../../lib/economy-data-service";
import { Card, CardContent } from "~/components/ui/card";

interface ConfigurationSummaryProps {
  economyBuilder: EconomyBuilderState;
  economicInputs: EconomicInputs;
}

export function ConfigurationSummary({
  economyBuilder,
  // oxlint-disable-next-line eslint/no-unused-vars
  economicInputs,
}: ConfigurationSummaryProps) {
  const { structure } = economyBuilder;

  return (
    <>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-large-title mb-2">Economy Configuration Preview</h2>
        <p className="text-label-secondary">Review your complete economic system configuration</p>
      </div>

      {/* Economic Structure Card */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-headline text-green mb-4 flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Economic Structure</span>
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body font-medium">Economic Model:</span>
              <Badge variant="outline">{structure.economicModel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body font-medium">Growth Strategy:</span>
              <Badge variant="outline">{structure.growthStrategy}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body font-medium">Economic Tier:</span>
              <Badge variant="outline">{structure.economicTier}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body font-medium">Total GDP:</span>
              <span className="font-medium">${structure.totalGDP.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-body font-medium">Primary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.primarySectors.map((sector, index) => (
                <Badge key={index} variant="default">
                  {sector}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-body font-medium">Secondary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.secondarySectors.map((sector, index) => (
                <Badge key={index} variant="default">
                  {sector}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-body font-medium">Tertiary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.tertiarySectors.map((sector, index) => (
                <Badge key={index} variant="default">
                  {sector}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
