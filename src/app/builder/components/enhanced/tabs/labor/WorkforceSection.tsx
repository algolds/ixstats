"use client";

import React from "react";
import { SliderWithDirectInput } from "../../../../primitives/enhanced";
import { Group as Users } from "iconoir-react";
import type { LaborConfiguration } from "~/types/economy-builder";
import type { LaborBounds } from "../utils/laborCalculations";

interface WorkforceSectionProps {
  laborMarket: LaborConfiguration;
  onChange: (field: keyof LaborConfiguration, value: any) => void;
  showAdvanced: boolean;
  componentBounds?: LaborBounds;
}

export function WorkforceSection({
  laborMarket,
  onChange,
  showAdvanced,
  componentBounds,
}: WorkforceSectionProps) {
  return (
    <div className="space-y-4">
      <SliderWithDirectInput
        label="Labor Force Participation Rate"
        description="Percentage of working-age population in the labor force"
        value={laborMarket.laborForceParticipationRate}
        onChange={(value) => onChange("laborForceParticipationRate", value)}
        min={componentBounds?.participationRate?.min ?? 30}
        max={componentBounds?.participationRate?.max ?? 90}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={Users}
        showValue={true}
        showRange={true}
        defaultMode="slider"
      />

      <SliderWithDirectInput
        label="Female Participation Rate"
        description="Female labor force participation rate"
        value={laborMarket.femaleParticipationRate}
        onChange={(value) => onChange("femaleParticipationRate", value)}
        min={20}
        max={80}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={Users}
        showValue={true}
        defaultMode="slider"
      />

      <SliderWithDirectInput
        label="Male Participation Rate"
        description="Male labor force participation rate"
        value={laborMarket.maleParticipationRate}
        onChange={(value) => onChange("maleParticipationRate", value)}
        min={40}
        max={95}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={Users}
        showValue={true}
        defaultMode="slider"
      />

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <SliderWithDirectInput
            label="Youth Unemployment Rate"
            description="Unemployment rate for ages 15-24"
            value={laborMarket.youthUnemploymentRate}
            onChange={(value) => onChange("youthUnemploymentRate", value)}
            min={5}
            max={50}
            step={0.1}
            unit="%"
            sectionId="labor"
            icon={Users}
            showValue={true}
            defaultMode="slider"
          />

          <SliderWithDirectInput
            label="Senior Employment Rate"
            description="Employment rate for ages 55+"
            value={laborMarket.seniorEmploymentRate}
            onChange={(value) => onChange("seniorEmploymentRate", value)}
            min={20}
            max={80}
            step={0.1}
            unit="%"
            sectionId="labor"
            icon={Users}
            showValue={true}
            defaultMode="slider"
          />
        </div>
      )}
    </div>
  );
}
