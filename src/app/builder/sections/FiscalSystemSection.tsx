"use client";

import React from 'react';
import { Coins, TrendingUp } from 'lucide-react';
import {
  GlassSlider,
  GlassDial,
  GlassNumberPicker,
  GlassToggle,
  GlassBarChart,
  GoogleGaugeChart,
  GoogleLineChart,
} from '~/components/charts';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface FiscalSystemSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
}

export function FiscalSystemSection({ 
  inputs, 
  onInputsChange 
}: FiscalSystemSectionProps) {
  // Fiscal data for visualization
  const taxData = [
    { name: 'Income Tax', rate: inputs.fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0, revenue: inputs.fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0 * 0.8 },
    { name: 'Corporate Tax', rate: inputs.fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0, revenue: inputs.fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0 * 0.6 },
    { name: 'VAT/Sales Tax', rate: inputs.fiscalSystem.taxRates.salesTaxRate, revenue: inputs.fiscalSystem.taxRates.salesTaxRate * 1.2 }
  ];

  const budgetBalanceData = [
    ['Year', 'Budget Balance'],
    ['2020', -3.2],
    ['2021', -4.1],
    ['2022', -2.8],
    ['2023', -1.5],
    ['2024', (inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || -2.0],
    ['2025', ((inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || -2.0) * 0.8],
    ['2026', ((inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || -2.0) * 0.6]
  ];

  const fiscalHealthScore = Math.max(0, Math.min(100, 
    100 - (inputs.fiscalSystem.totalDebtGDPRatio * 0.5) - (Math.abs((inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || 0) * 10)
  ));

  const fiscalGaugeData = [
    ['Label', 'Value'],
    ['Fiscal Health', fiscalHealthScore]
  ];

  return (
    <div className="space-y-6">
      {/* Tax Controls */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Coins className="h-5 w-5 text-[var(--color-warning)]" />
          Tax Policy
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassSlider
            label="Income Tax Rate"
            value={inputs.fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRates: {
                  ...inputs.fiscalSystem.taxRates,
                  personalIncomeTaxRates: inputs.fiscalSystem.taxRates.personalIncomeTaxRates.map((rate, index) =>
                    index === 1 ? { ...rate, rate: value } : rate
                  )
                }
              }
            })}
            min={0}
            max={70}
            step={0.5}
            unit="%"
            theme="gold"
            showTicks={true}
            tickCount={8}
          />

          <GlassSlider
            label="Corporate Tax Rate"
            value={inputs.fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRates: {
                  ...inputs.fiscalSystem.taxRates,
                  corporateTaxRates: inputs.fiscalSystem.taxRates.corporateTaxRates.map((rate, index) =>
                    index === 1 ? { ...rate, rate: value } : rate
                  )
                }
              }
            })}
            min={0}
            max={50}
            step={0.5}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="VAT/Sales Tax Rate"
            value={inputs.fiscalSystem.taxRates.salesTaxRate}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRates: {
                  ...inputs.fiscalSystem.taxRates,
                  salesTaxRate: value
                }
              }
            })}
            min={0}
            max={30}
            step={0.5}
            unit="%"
            theme="emerald"
            showTicks={true}
            tickCount={7}
          />
        </div>
      </div>

      {/* Debt and Budget Controls */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--color-error)]" />
          Debt & Budget Management
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <GlassDial
            label="Total Debt to GDP"
            value={inputs.fiscalSystem.totalDebtGDPRatio}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                totalDebtGDPRatio: value
              }
            })}
            min={0}
            max={200}
            step={1}
            unit="%"
            theme="default"
          />

          <GlassSlider
            label="Budget Deficit/Surplus"
            value={(inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                budgetDeficitSurplus: (value / 100) * inputs.coreIndicators.nominalGDP
              }
            })}
            min={-15}
            max={5}
            step={0.1}
            unit="% of GDP"
            theme="purple"
            showTicks={true}
            tickCount={5}
          />

          <GlassNumberPicker
            label="Tax Revenue Efficiency"
            value={inputs.fiscalSystem.taxRevenueGDPPercent || 25}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRevenueGDPPercent: value
              }
            })}
            min={5}
            max={50}
            step={0.5}
            unit="% of GDP"
            theme="gold"
          />
        </div>
      </div>

      {/* Fiscal Policy Toggles */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Policy Options</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassToggle
            label="Progressive Tax System"
            description="Higher rates for higher income brackets"
            checked={inputs.fiscalSystem.progressiveTaxation}
            onChange={(checked) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                progressiveTaxation: checked
              }
            })}
            theme="blue"
          />

          <GlassToggle
            label="Balanced Budget Rule"
            description="Constitutional requirement for balanced budgets"
            checked={inputs.fiscalSystem.balancedBudgetRule}
            onChange={(checked) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                balancedBudgetRule: checked
              }
            })}
            theme="emerald"
          />

          <GlassNumberPicker
            label="Debt Ceiling"
            value={inputs.fiscalSystem.debtCeiling}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                debtCeiling: value
              }
            })}
            min={0}
            max={500}
            step={10}
            unit="%"
            theme="gold"
          />

          <GlassToggle
            label="Anti-Tax Avoidance Measures"
            description="Strong enforcement against tax evasion"
            checked={inputs.fiscalSystem.antiAvoidance}
            onChange={(checked) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                antiAvoidance: checked
              }
            })}
            theme="purple"
          />
        </div>
      </div>

      {/* Fiscal Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassBarChart
          data={taxData}
          xKey="name"
          yKey={['rate', 'revenue']}
          title="Tax Rates vs Revenue Generation"
          description="Tax policy effectiveness"
          height={300}
          theme="gold"
        />

        <GoogleGaugeChart
          data={fiscalGaugeData}
          title="Fiscal Health Score"
          description="Overall fiscal sustainability"
          height={300}
          theme="gold"
          min={0}
          max={100}
          yellowFrom={30}
          yellowTo={70}
          redFrom={0}
          redTo={30}
        />
      </div>

      <div className="w-full">
        <GoogleLineChart
          data={budgetBalanceData}
          title="Budget Balance Projection"
          description="Historical and projected budget balance as % of GDP"
          height={250}
          theme="purple"
          curveType="function"
        />
      </div>
    </div>
  );
}