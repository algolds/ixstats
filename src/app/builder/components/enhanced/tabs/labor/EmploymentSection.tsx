"use client";

import React from "react";
import { EnhancedSlider } from "../../../../primitives/enhanced";
import { TrendingDown, Clock, Briefcase } from "lucide-react";
import type { LaborConfiguration } from "~/types/economy-builder";

interface EmploymentSectionProps {
  laborMarket: LaborConfiguration;
  onChange: (field: keyof LaborConfiguration, value: any) => void;
  onNestedChange: (parentField: keyof LaborConfiguration, field: string, value: any) => void;
  showAdvanced: boolean;
}

export function EmploymentSection({
  laborMarket,
  onChange,
  onNestedChange,
  showAdvanced,
}: EmploymentSectionProps) {
  return (
    <div className="space-y-4">
      <EnhancedSlider
        label="Unemployment Rate"
        description="Overall unemployment rate"
        value={laborMarket.unemploymentRate}
        onChange={(value) => onChange("unemploymentRate", value)}
        min={0}
        max={30}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={TrendingDown}
        showValue={true}
        showRange={true}
      />

      <EnhancedSlider
        label="Underemployment Rate"
        description="Rate of underemployed workers"
        value={laborMarket.underemploymentRate}
        onChange={(value) => onChange("underemploymentRate", value)}
        min={0}
        max={20}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={TrendingDown}
        showValue={true}
      />

      <EnhancedSlider
        label="Average Workweek Hours"
        description="Average hours worked per week"
        value={laborMarket.averageWorkweekHours}
        onChange={(value) => onChange("averageWorkweekHours", value)}
        min={20}
        max={60}
        step={0.5}
        unit="hours"
        sectionId="labor"
        icon={Clock}
        showValue={true}
      />

      <EnhancedSlider
        label="Average Overtime Hours"
        description="Average overtime hours per week"
        value={laborMarket.averageOvertimeHours}
        onChange={(value) => onChange("averageOvertimeHours", value)}
        min={0}
        max={20}
        step={0.1}
        unit="hours"
        sectionId="labor"
        icon={Clock}
        showValue={true}
      />

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-3">
            <h4 className="font-medium">Employment Type Distribution</h4>
            {Object.entries(laborMarket.employmentType).map(([type, value]) => (
              <EnhancedSlider
                key={type}
                label={type.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                value={value}
                onChange={(newValue) => onNestedChange("employmentType", type, newValue)}
                min={0}
                max={100}
                step={0.1}
                unit="%"
                sectionId="labor"
                icon={Briefcase}
                showValue={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
