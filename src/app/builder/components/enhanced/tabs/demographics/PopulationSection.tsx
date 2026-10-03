"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { SliderWithDirectInput } from "../../../../primitives/enhanced";
import { AdvancedFieldsDisclosure } from "../../../../primitives/AdvancedFieldsDisclosure";
import { BASELINE_ECONOMY_BUILDER } from "../../economy-builder/economyStateUtils";
import {
  Group as Users,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Globe,
} from "iconoir-react";
import type { DemographicsConfiguration } from "~/types/economy-builder";

interface PopulationSectionProps {
  demographics: DemographicsConfiguration;
  onChange: <K extends keyof DemographicsConfiguration>(
    field: K,
    value: DemographicsConfiguration[K]
  ) => void;
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
      <div className="rounded-control border-separator bg-surface border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-label-secondary h-4 w-4" />
            <span className="font-medium">Total population</span>
          </div>
          <Badge variant="outline">From core indicators</Badge>
        </div>
        <p className="text-title-1">{demographics.totalPopulation.toLocaleString()}</p>
        <p className="text-label-secondary text-body mt-1">Set in the national identity section</p>
      </div>

      {/* Population Growth Rate - Read Only */}
      <div className="rounded-control border-separator bg-surface border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-label-secondary h-4 w-4" />
            <span className="font-medium">Population growth rate</span>
          </div>
          <Badge variant="outline">Calculated</Badge>
        </div>
        <p className="text-title-1">{demographics.populationGrowthRate.toFixed(2)}%</p>
        <p className="text-label-secondary text-body mt-1">
          Based on birth/death rates and migration
        </p>
      </div>

      <AdvancedFieldsDisclosure
        section="economics"
        id="demographics-population"
        values={{
          netMigrationRate: demographics.netMigrationRate,
          immigrationRate: demographics.immigrationRate,
          emigrationRate: demographics.emigrationRate,
        }}
        defaults={BASELINE_ECONOMY_BUILDER.demographics}
        defaultOpen={showAdvanced}
        className="border-t pt-4"
      >
        <SliderWithDirectInput
          label="Net migration rate"
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
          defaultMode="slider"
        />

        <SliderWithDirectInput
          label="Immigration rate"
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
          defaultMode="slider"
        />

        <SliderWithDirectInput
          label="Emigration rate"
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
          defaultMode="slider"
        />
      </AdvancedFieldsDisclosure>
    </div>
  );
}
