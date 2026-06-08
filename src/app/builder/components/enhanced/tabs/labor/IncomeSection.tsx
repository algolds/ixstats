"use client";

import React from "react";
import { EnhancedNumberInput, SliderWithDirectInput } from "../../../../primitives/enhanced";
import { DollarSign, Users, Shield } from "lucide-react";
import type { LaborConfiguration } from "~/types/economy-builder";
import type { LaborBounds } from "../utils/laborCalculations";

interface IncomeSectionProps {
  laborMarket: LaborConfiguration;
  onChange: (field: keyof LaborConfiguration, value: any) => void;
  showAdvanced: boolean;
  componentBounds?: LaborBounds;
}

export function IncomeSection({
  laborMarket,
  onChange,
  showAdvanced,
  componentBounds,
}: IncomeSectionProps) {
  return (
    <div className="space-y-4">
      <EnhancedNumberInput
        label="Minimum Wage (Hourly)"
        description="Minimum hourly wage rate"
        value={laborMarket.minimumWageHourly}
        onChange={(value) => onChange("minimumWageHourly", value)}
        min={componentBounds?.minimumWage?.min ?? 5}
        max={componentBounds?.minimumWage?.max ?? 50}
        step={0.25}
        sectionId="labor"
        icon={DollarSign}
        showButtons={true}
        format={(value) => `$${Number(value).toFixed(2)}`}
      />

      <EnhancedNumberInput
        label="Living Wage (Hourly)"
        description="Living wage for basic needs"
        value={laborMarket.livingWageHourly}
        onChange={(value) => onChange("livingWageHourly", value)}
        min={componentBounds?.livingWage?.min ?? 10}
        max={componentBounds?.livingWage?.max ?? 100}
        step={0.5}
        sectionId="labor"
        icon={DollarSign}
        showButtons={true}
        format={(value) => `$${Number(value).toFixed(2)}`}
      />

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          <SliderWithDirectInput
            label="Unionization Rate"
            description="Percentage of workers in unions"
            value={laborMarket.unionizationRate}
            onChange={(value) => onChange("unionizationRate", value)}
            min={0}
            max={50}
            step={0.1}
            unit="%"
            sectionId="labor"
            icon={Users}
            showValue={true}
            defaultMode="slider"
          />

          <SliderWithDirectInput
            label="Collective Bargaining Coverage"
            description="Percentage covered by collective agreements"
            value={laborMarket.collectiveBargainingCoverage}
            onChange={(value) => onChange("collectiveBargainingCoverage", value)}
            min={0}
            max={80}
            step={0.1}
            unit="%"
            sectionId="labor"
            icon={Shield}
            showValue={true}
            defaultMode="slider"
          />
        </div>
      )}
    </div>
  );
}
