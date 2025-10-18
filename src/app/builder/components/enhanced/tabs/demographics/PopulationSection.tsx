"use client";

import React from 'react';
import { Badge } from '~/components/ui/badge';
import { EnhancedSlider } from '../../../../primitives/enhanced';
import { Users, TrendingUp, TrendingDown, Globe } from 'lucide-react';
import type { DemographicsConfiguration } from '~/types/economy-builder';

interface PopulationSectionProps {
  demographics: DemographicsConfiguration;
  onChange: (field: keyof DemographicsConfiguration, value: any) => void;
  showAdvanced: boolean;
}

export function PopulationSection({
  demographics,
  onChange,
  showAdvanced
}: PopulationSectionProps) {
  return (
    <div className="space-y-4">
      {/* Total Population - Read Only */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Total Population</span>
          </div>
          <Badge variant="outline">From Core Indicators</Badge>
        </div>
        <p className="text-2xl font-bold">{demographics.totalPopulation.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground mt-1">Set in the National Identity section</p>
      </div>

      {/* Population Growth Rate - Read Only */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Population Growth Rate</span>
          </div>
          <Badge variant="outline">Calculated</Badge>
        </div>
        <p className="text-2xl font-bold">{demographics.populationGrowthRate.toFixed(2)}%</p>
        <p className="text-sm text-muted-foreground mt-1">Based on birth/death rates and migration</p>
      </div>

      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t">
          <EnhancedSlider
            label="Net Migration Rate"
            description="Net migration per 1000 population"
            value={demographics.netMigrationRate}
            onChange={(value) => onChange('netMigrationRate', value)}
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
            onChange={(value) => onChange('immigrationRate', value)}
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
            onChange={(value) => onChange('emigrationRate', value)}
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
