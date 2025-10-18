"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Building2, DollarSign, TrendingUp } from 'lucide-react';
import type { EconomyBuilderState } from '~/types/economy-builder';
import type { EconomicInputs } from '../../../../lib/economy-data-service';

interface ConfigurationSummaryProps {
  economyBuilder: EconomyBuilderState;
  economicInputs: EconomicInputs;
}

export function ConfigurationSummary({
  economyBuilder,
  economicInputs
}: ConfigurationSummaryProps) {
  const { structure } = economyBuilder;

  return (
    <>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Economy Configuration Preview</h2>
        <p className="text-muted-foreground">
          Review your complete economic system configuration
        </p>
      </div>

      {/* Economic Structure Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Economic Structure</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Economic Model:</span>
              <Badge variant="outline">{structure.economicModel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Growth Strategy:</span>
              <Badge variant="outline">{structure.growthStrategy}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Economic Tier:</span>
              <Badge variant="outline">{structure.economicTier}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Total GDP:</span>
              <span className="font-medium">${structure.totalGDP.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Primary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.primarySectors.map((sector, index) => (
                <Badge key={index} variant="secondary">{sector}</Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Secondary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.secondarySectors.map((sector, index) => (
                <Badge key={index} variant="secondary">{sector}</Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Tertiary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.tertiarySectors.map((sector, index) => (
                <Badge key={index} variant="secondary">{sector}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
