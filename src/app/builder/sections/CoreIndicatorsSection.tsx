"use client";

import React from 'react';
import {
  GlassNumberPicker,
  GlassDial,
  GlassSlider,
} from '~/components/charts';
import type { EconomicInputs, RealCountryData } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface CoreIndicatorsSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry: RealCountryData;
}

export function CoreIndicatorsSection({ 
  inputs, 
  onInputsChange,
  referenceCountry
}: CoreIndicatorsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Core Metrics with Advanced Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassNumberPicker
          label="Population"
          value={inputs.coreIndicators.totalPopulation}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              totalPopulation: value
            }
          })}
          min={100000}
          max={2000000000}
          step={100000}
          unit=" people"
          theme="blue"
        />
        
        <GlassNumberPicker
          label="GDP per Capita"
          value={inputs.coreIndicators.gdpPerCapita}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              gdpPerCapita: value
            }
          })}
          min={500}
          max={150000}
          step={1000}
          unit=" $"
          theme="emerald"
        />

        <GlassSlider
          label="Real GDP Growth Rate"
          value={inputs.coreIndicators.realGDPGrowthRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              realGDPGrowthRate: value
            }
          })}
          min={-10}
          max={15}
          step={0.1}
          unit="%"
          theme="gold"
          showTicks={true}
          tickCount={6}
        />

        <GlassDial
          label="Inflation Rate"
          value={inputs.coreIndicators.inflationRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              inflationRate: value
            }
          })}
          min={-5}
          max={20}
          step={0.1}
          unit="%"
          theme="purple"
        />
      </div>
    </div>
  );
}