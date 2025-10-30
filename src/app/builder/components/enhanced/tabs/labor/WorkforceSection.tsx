"use client";

import React from "react";
import { EnhancedSlider } from "../../../../primitives/enhanced";
import { Users } from "lucide-react";
import type { LaborConfiguration } from "~/types/economy-builder";

interface WorkforceSectionProps {
  laborMarket: LaborConfiguration;
  onChange: (field: keyof LaborConfiguration, value: any) => void;
  showAdvanced: boolean;
}

export function WorkforceSection({ laborMarket, onChange, showAdvanced }: WorkforceSectionProps) {
  return (
    <div className="space-y-4">
      <EnhancedSlider
        label="Labor Force Participation Rate"
        description="Percentage of working-age population in the labor force"
        value={laborMarket.laborForceParticipationRate}
        onChange={(value) => onChange("laborForceParticipationRate", value)}
        min={30}
        max={90}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={Users}
        showValue={true}
        showRange={true}
      />

      <EnhancedSlider
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
      />

      <EnhancedSlider
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
      />

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <EnhancedSlider
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
          />

          <EnhancedSlider
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
          />
        </div>
      )}
    </div>
  );
}
