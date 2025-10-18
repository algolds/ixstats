"use client";

import React from 'react';
import { EnhancedNumberInput, EnhancedSlider } from '../../../../primitives/enhanced';
import { DollarSign, Users, Shield } from 'lucide-react';
import type { LaborConfiguration } from '~/types/economy-builder';

interface IncomeSectionProps {
  laborMarket: LaborConfiguration;
  onChange: (field: keyof LaborConfiguration, value: any) => void;
  showAdvanced: boolean;
}

export function IncomeSection({ laborMarket, onChange, showAdvanced }: IncomeSectionProps) {
  return (
    <div className="space-y-4">
      <EnhancedNumberInput
        label="Minimum Wage (Hourly)"
        description="Minimum hourly wage rate"
        value={laborMarket.minimumWageHourly}
        onChange={(value) => onChange('minimumWageHourly', value)}
        min={5}
        max={50}
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
        onChange={(value) => onChange('livingWageHourly', value)}
        min={10}
        max={100}
        step={0.50}
        sectionId="labor"
        icon={DollarSign}
        showButtons={true}
        format={(value) => `$${Number(value).toFixed(2)}`}
      />

      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t">
          <EnhancedSlider
            label="Unionization Rate"
            description="Percentage of workers in unions"
            value={laborMarket.unionizationRate}
            onChange={(value) => onChange('unionizationRate', value)}
            min={0}
            max={50}
            step={0.1}
            unit="%"
            sectionId="labor"
            icon={Users}
            showValue={true}
          />

          <EnhancedSlider
            label="Collective Bargaining Coverage"
            description="Percentage covered by collective agreements"
            value={laborMarket.collectiveBargainingCoverage}
            onChange={(value) => onChange('collectiveBargainingCoverage', value)}
            min={0}
            max={80}
            step={0.1}
            unit="%"
            sectionId="labor"
            icon={Shield}
            showValue={true}
          />
        </div>
      )}
    </div>
  );
}
