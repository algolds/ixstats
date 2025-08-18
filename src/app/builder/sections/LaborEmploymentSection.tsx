"use client";

import React from 'react';
import {
  GlassSlider,
  GlassDial,
  GlassNumberPicker,
  GlassToggle,
  GlassPieChart,
  GlassBarChart,
} from '~/components/charts';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface LaborEmploymentSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
}

export function LaborEmploymentSection({ 
  inputs, 
  onInputsChange 
}: LaborEmploymentSectionProps) {
  // Labor market data for visualization
  const laborData = [
    { category: 'Employed', value: 100 - inputs.laborEmployment.unemploymentRate, color: 'emerald' },
    { category: 'Unemployed', value: inputs.laborEmployment.unemploymentRate, color: 'red' }
  ];

  const wageData = [
    { name: 'Minimum Wage', value: inputs.laborEmployment.minimumWage },
    { name: 'Average Wage', value: inputs.laborEmployment.averageAnnualIncome },
    { name: 'Median Wage', value: inputs.laborEmployment.averageAnnualIncome * 0.85 }
  ];

  const workforceData = [
    { name: 'Active Labor Force', value: inputs.laborEmployment.laborForceParticipationRate },
    { name: 'Youth Employment', value: Math.max(0, 100 - inputs.laborEmployment.unemploymentRate * 1.5) },
    { name: 'Senior Employment', value: Math.max(0, 100 - inputs.laborEmployment.unemploymentRate * 0.8) }
  ];

  return (
    <div className="space-y-6">
      {/* Employment Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassSlider
          label="Unemployment Rate"
          value={inputs.laborEmployment.unemploymentRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              unemploymentRate: value
            }
          })}
          min={0}
          max={25}
          step={0.1}
          unit="%"
          theme="default"
          showTicks={true}
          tickCount={6}
        />

        <GlassDial
          label="Labor Force Participation"
          value={inputs.laborEmployment.laborForceParticipationRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              laborForceParticipationRate: value
            }
          })}
          min={30}
          max={90}
          step={0.5}
          unit="%"
          theme="blue"
        />

        <GlassNumberPicker
          label="Average Wage"
          value={inputs.laborEmployment.averageAnnualIncome}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              averageAnnualIncome: value
            }
          })}
          min={500}
          max={10000}
          step={50}
          unit=" $/month"
          theme="emerald"
        />

        <GlassNumberPicker
          label="Minimum Wage"
          value={inputs.laborEmployment.minimumWage}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              minimumWage: value
            }
          })}
          min={100}
          max={3000}
          step={25}
          unit=" $/month"
          theme="gold"
        />

        <GlassSlider
          label="Working Hours per Week"
          value={inputs.laborEmployment.averageWorkweekHours}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              averageWorkweekHours: value
            }
          })}
          min={20}
          max={60}
          step={1}
          unit=" hours"
          theme="purple"
          showTicks={true}
          tickCount={5}
        />

        <GlassToggle
          label="Strong Labor Protections"
          description="Enhanced worker rights and job security"
          checked={inputs.laborEmployment.laborProtections}
          onChange={(checked) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              laborProtections: checked
            }
          })}
          theme="blue"
        />
      </div>

      {/* Labor Market Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPieChart
          data={laborData}
          dataKey="value"
          nameKey="category"
          title="Employment Status"
          description="Labor force distribution"
          height={300}
          theme="emerald"
        />

        <GlassBarChart
          data={wageData}
          xKey="name"
          yKey="value"
          title="Wage Structure"
          description="Income levels across the economy"
          height={300}
          theme="gold"
        />
      </div>

      <div className="w-full">
        <GlassBarChart
          data={workforceData}
          xKey="name"
          yKey="value"
          title="Workforce Participation by Demographics"
          description="Employment rates across different age groups"
          height={250}
          theme="blue"
        />
      </div>
    </div>
  );
}