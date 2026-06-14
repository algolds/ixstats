"use client";

import React from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Badge } from "~/components/ui/badge";
import { Building2 } from "lucide-react";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicInputs } from "../../../../lib/economy-data-service";

interface ConfigurationSummaryProps {
  economyBuilder: EconomyBuilderState;
  economicInputs: EconomicInputs;
}

export function ConfigurationSummary({
  economyBuilder,
  // eslint-disable-next-line unused-imports/no-unused-vars
  economicInputs,
}: ConfigurationSummaryProps) {
  const { structure } = economyBuilder;

  return (
    <>
      {/* Header */}
      <div className="text-center">
        <h2 className="mb-2 text-3xl font-bold">Economy Configuration Preview</h2>
        <p className="text-muted-foreground">Review your complete economic system configuration</p>
      </div>

      {/* Economic Structure Card */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="space-y-4 p-6">
          <h3 className="mb-4 flex items-center space-x-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <Building2 className="h-5 w-5" />
            <span>Economic Structure</span>
          </h3>
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
            <h4 className="text-sm font-medium">Primary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.primarySectors.map((sector, index) => (
                <Badge key={index} variant="secondary">
                  {sector}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Secondary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.secondarySectors.map((sector, index) => (
                <Badge key={index} variant="secondary">
                  {sector}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tertiary Sectors:</h4>
            <div className="flex flex-wrap gap-1">
              {structure.tertiarySectors.map((sector, index) => (
                <Badge key={index} variant="secondary">
                  {sector}
                </Badge>
              ))}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </>
  );
}
