"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { EnhancedSlider } from "../../../../primitives/enhanced";
import { Users, TrendingUp, TrendingDown, Globe } from "lucide-react";
import type { DemographicsConfiguration } from "~/types/economy-builder";

interface PopulationSectionProps {
  demographics: DemographicsConfiguration;
  onChange: (field: keyof DemographicsConfiguration, value: any) => void;
  showAdvanced: boolean;
}

export function PopulationSection({
  demographics,
  onChange,
  showAdvanced,
}: PopulationSectionProps) {
  return (
    <div className="space-y-4">
      {/* Total Population - Read Only */}
      <div className="bg-muted/50 border-border rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground h-4 w-4" />
            <span className="font-medium">Total Population</span>
          </div>
          <Badge variant="outline">From Core Indicators</Badge>
        </div>
        <p className="text-2xl font-bold">{demographics.totalPopulation.toLocaleString()}</p>
        <p className="text-muted-foreground mt-1 text-sm">Set in the National Identity section</p>
      </div>

      {/* Population Growth Rate - Read Only */}
      <div className="bg-muted/50 border-border rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-muted-foreground h-4 w-4" />
            <span className="font-medium">Population Growth Rate</span>
          </div>
          <Badge variant="outline">Calculated</Badge>
        </div>
        <p className="text-2xl font-bold">{demographics.populationGrowthRate.toFixed(2)}%</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Based on birth/death rates and migration
        </p>
      </div>

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <EnhancedSlider
            label="Net Migration Rate"
            description="Net migration per 1000 population"
            value={demographics.netMigrationRate}
            onChange={(value) => onChange("netMigrationRate", value)}
            min={-20}
            max={20}
            step={0.1}
            unit="per 1000"
            sectionId="demographics"
            icon={Globe}
            showValue={true}
          />

          <EnhancedSlider
            label="Immigration Rate"
            description="Immigration per 1000 population"
            value={demographics.immigrationRate}
            onChange={(value) => onChange("immigrationRate", value)}
            min={0}
            max={50}
            step={0.1}
            unit="per 1000"
            sectionId="demographics"
            icon={TrendingUp}
            showValue={true}
          />

          <EnhancedSlider
            label="Emigration Rate"
            description="Emigration per 1000 population"
            value={demographics.emigrationRate}
            onChange={(value) => onChange("emigrationRate", value)}
            min={0}
            max={50}
            step={0.1}
            unit="per 1000"
            sectionId="demographics"
            icon={TrendingDown}
            showValue={true}
          />
        </div>
      )}
    </div>
  );
}
