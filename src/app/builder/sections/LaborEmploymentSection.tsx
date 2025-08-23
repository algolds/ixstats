"use client";

import React, { useState, useMemo, type ElementType } from 'react';
import { Briefcase, Users, Clock, DollarSign, TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedDial,
  EnhancedNumberInput,
  EnhancedToggle,
  EnhancedPieChart,
  EnhancedBarChart,
} from '../primitives/enhanced';
import type { EconomicInputs, LaborEmploymentData } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';
import { 
  SectionBase, 
  SectionLayout, 
  sectionConfigs, 
  sectionUtils,
  type ExtendedSectionProps 
} from '../components/glass/SectionBase';
import { FormGrid } from '../components/glass/ProgressiveViews';

interface LaborEmploymentSectionProps extends ExtendedSectionProps {
  onToggleAdvanced?: () => void;
}

interface Metric {
  label: string;
  value: string | number;
  unit?: string;
  icon: ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

export function LaborEmploymentSection({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: LaborEmploymentSectionProps) {
  const laborEmployment = inputs.laborEmployment;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  
  // Calculate metrics for overview
  const metrics: Metric[] = useMemo(() => {
    const workingAgePopulation = Math.round(totalPopulation * 0.65);
    const laborForce = Math.round(workingAgePopulation * (laborEmployment.laborForceParticipationRate / 100));
    const employed = Math.round(laborForce * ((100 - laborEmployment.unemploymentRate) / 100));
    const unemployed = laborForce - employed;
    
    return [
      {
        label: "Labor Force",
        value: sectionUtils.formatNumber(laborForce),
        unit: `(${laborEmployment.laborForceParticipationRate.toFixed(1)}%)`,
        icon: Users,
      },
      {
        label: "Unemployment Rate",
        value: `${laborEmployment.unemploymentRate.toFixed(1)}%`,
        icon: laborEmployment.unemploymentRate > 10 ? TrendingDown : TrendingUp,
        trend: laborEmployment.unemploymentRate > 10 ? 'down' : laborEmployment.unemploymentRate > 7 ? 'neutral' : 'up'
      },
      {
        label: "Average Income",
        value: sectionUtils.formatCurrency(laborEmployment.averageAnnualIncome, '$', 0),
        unit: "/year",
        icon: DollarSign,
      },
      {
        label: "Work Hours",
        value: `${laborEmployment.averageWorkweekHours}`,
        unit: "hrs/week",
        icon: Clock,
      }
    ];
  }, [laborEmployment, totalPopulation]);

  // Handle input changes with proper type safety
  const handleLaborChange = (field: keyof LaborEmploymentData, value: any) => {
    const newLaborEmployment = { ...laborEmployment, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'laborForceParticipationRate') {
      const workingAgePopulation = totalPopulation * 0.65;
      newLaborEmployment.totalWorkforce = Math.round(workingAgePopulation * (value / 100));
    } else if (field === 'unemploymentRate') {
      newLaborEmployment.employmentRate = 100 - value;
    } else if (field === 'employmentRate') {
      newLaborEmployment.unemploymentRate = 100 - value;
    }
    
    onInputsChange({ ...inputs, laborEmployment: newLaborEmployment });
  };

  // Prepare chart data
  const laborData = [
    { category: 'Employed', value: 100 - laborEmployment.unemploymentRate, color: 'emerald' },
    { category: 'Unemployed', value: laborEmployment.unemploymentRate, color: 'red' }
  ];

  const wageData = [
    { name: 'Minimum Wage', value: laborEmployment.minimumWage, color: 'red' },
    { name: 'Average Income', value: laborEmployment.averageAnnualIncome / 12, color: 'blue' }, // Monthly
    { name: 'Median Income', value: (laborEmployment.averageAnnualIncome * 0.85) / 12, color: 'emerald' } // Estimated monthly
  ];

  const workforceData = [
    { name: 'Labor Force Participation', value: laborEmployment.laborForceParticipationRate, color: 'blue' },
    { name: 'Employment Rate', value: 100 - laborEmployment.unemploymentRate, color: 'emerald' },
    { name: 'Youth Employment', value: Math.max(0, 100 - laborEmployment.unemploymentRate * 1.5), color: 'gold' },
    { name: 'Senior Employment', value: Math.max(0, 100 - laborEmployment.unemploymentRate * 0.8), color: 'purple' }
  ];

  // Basic view content - Essential labor metrics
  const basicContent = (
    <>
      <EnhancedSlider
        label="Unemployment Rate"
        description="Percentage of labor force without employment"
        value={Number(laborEmployment.unemploymentRate) || 0}
        onChange={(value) => handleLaborChange('unemploymentRate', Number(value))}
        min={0}
        max={25}
        step={0.1}
        precision={1}
        unit="%"
        sectionId="labor"
        icon={Briefcase}
        showTicks={true}
        tickCount={6}
        showValue={true}
        showRange={true}
        referenceValue={referenceCountry?.unemploymentRate}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Labor Force Participation"
        description="Percentage of working-age population in labor force"
        value={Number(laborEmployment.laborForceParticipationRate) || 0}
        onChange={(value) => handleLaborChange('laborForceParticipationRate', Number(value))}
        min={30}
        max={90}
        step={0.5}
        precision={1}
        unit="%"
        sectionId="labor"
        icon={Users}
        showTicks={true}
        tickCount={7}
        showValue={true}
        showRange={true}
      />

      <EnhancedNumberInput
        label="Average Annual Income"
        description="Mean yearly earnings across all employed workers"
        value={Number(laborEmployment.averageAnnualIncome) || 0}
        onChange={(value) => handleLaborChange('averageAnnualIncome', Number(value))}
        min={5000}
        max={120000}
        step={1000}
        unit=" $/year"
        sectionId="labor"
        icon={DollarSign}
        showButtons={true}
        format={(value) => `$${Number(value).toLocaleString()}`}
      />

      {/* Basic visualization */}
      <div className="md:col-span-2">
        <EnhancedPieChart
          data={laborData}
          dataKey="value"
          nameKey="category"
          title="Employment Status"
          description="Labor force distribution"
          height={250}
          sectionId="labor"
          showLegend={true}
          showPercentage={true}
          formatValue={(value) => `${value.toFixed(1)}%`}
        />
      </div>
    </>
  );

  // Advanced view content - Detailed labor controls
  const advancedContent = (
    <>
      {/* Detailed Controls */}
      <EnhancedNumberInput
        label="Minimum Wage"
        description="Legally mandated minimum hourly wage"
        value={Number(laborEmployment.minimumWage) || 0}
        onChange={(value) => handleLaborChange('minimumWage', Number(value))}
        min={500}
        max={4000}
        step={50}
        unit=" $/month"
        sectionId="labor"
        icon={DollarSign}
        showButtons={true}
        format={(value) => `$${Number(value).toLocaleString()}`}
      />

      <EnhancedSlider
        label="Average Work Week"
        description="Standard hours worked per week across all sectors"
        value={Number(laborEmployment.averageWorkweekHours) || 0}
        onChange={(value) => handleLaborChange('averageWorkweekHours', Number(value))}
        min={20}
        max={60}
        step={1}
        unit=" hours"
        sectionId="labor"
        icon={Clock}
        showTicks={true}
        tickCount={5}
        showValue={true}
        showRange={true}
      />

      <EnhancedNumberInput
        label="Total Workforce"
        description="Total number of people employed or seeking employment"
        value={Number(laborEmployment.totalWorkforce) || 0}
        onChange={(value) => handleLaborChange('totalWorkforce', Number(value))}
        min={Number(totalPopulation) * 0.3}
        max={Number(totalPopulation) * 0.8}
        step={1000}
        unit=" people"
        sectionId="labor"
        icon={Users}
        showButtons={true}
        format={(value) => {
          const num = Number(value);
          if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
          if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
          return num.toString();
        }}
      />

      <EnhancedSlider
        label="Employment Rate"
        description="Percentage of labor force that is employed"
        value={Number(laborEmployment.employmentRate) || 0}
        onChange={(value) => handleLaborChange('employmentRate', Number(value))}
        min={50}
        max={100}
        step={0.1}
        precision={1}
        unit="%"
        sectionId="labor"
        icon={TrendingUp}
        showTicks={true}
        tickCount={6}
        showValue={true}
        showRange={true}
      />

      {/* Labor Policy Toggles */}
      <div className="md:col-span-2 space-y-4">
        <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Labor Policies
        </h5>
        <FormGrid columns={2}>
          <EnhancedToggle
            label="Strong Labor Protections"
            description="Enhanced worker rights and job security"
            checked={laborEmployment.laborProtections}
            onChange={(checked) => handleLaborChange('laborProtections', checked)}
            sectionId="labor"
            variant="switch"
            showIcons={true}
          />
          <EnhancedToggle
            label="Collective Bargaining"
            description="Support for union organizing and negotiations"
            checked={false} // TODO: Add to data model
            onChange={(checked) => {/* TODO: Implement */}}
            sectionId="labor"
            variant="switch"
            showIcons={true}
          />
        </FormGrid>
      </div>

      {/* Advanced Visualizations */}
      <div className="md:col-span-2">
        <EnhancedBarChart
          data={wageData}
          xKey="name"
          yKey="value"
          title="Income Distribution"
          description="Monthly income levels across the economy"
          height={300}
          sectionId="labor"
          formatValue={(value) => `$${value.toLocaleString()}`}
          showTooltip={true}
          showGrid={true}
        />
      </div>

      <div className="md:col-span-2">
        <EnhancedBarChart
          data={workforceData}
          xKey="name"
          yKey="value"
          title="Employment Metrics"
          description="Labor market participation across demographics"
          height={250}
          sectionId="labor"
          formatValue={(value) => `${value.toFixed(1)}%`}
          showTooltip={true}
          showGrid={true}
        />
      </div>
    </>
  );

  // Calculate labor market health metrics
  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const laborForce = Math.round(workingAgePopulation * (laborEmployment.laborForceParticipationRate / 100));
  const employed = Math.round(laborForce * ((100 - laborEmployment.unemploymentRate) / 100));

  // Generate labor market insights
  const generateInsights = () => {
    const insights = [];
    
    if (laborEmployment.unemploymentRate > 15) {
      insights.push("Very high unemployment indicates severe labor market distress");
    } else if (laborEmployment.unemploymentRate > 10) {
      insights.push("High unemployment suggests need for job creation programs");
    } else if (laborEmployment.unemploymentRate < 3) {
      insights.push("Very low unemployment may indicate labor shortages and wage pressures");
    }
    
    if (laborEmployment.laborForceParticipationRate < 50) {
      insights.push("Low labor force participation limits economic potential");
    } else if (laborEmployment.laborForceParticipationRate > 80) {
      insights.push("High labor force participation supports strong economic growth");
    }
    
    const minToAvgRatio = (laborEmployment.minimumWage * 12) / laborEmployment.averageAnnualIncome;
    if (minToAvgRatio > 0.6) {
      insights.push("Minimum wage is high relative to average income");
    } else if (minToAvgRatio < 0.3) {
      insights.push("Significant income inequality - consider minimum wage adjustments");
    }
    
    if (laborEmployment.averageWorkweekHours > 50) {
      insights.push("Long work hours may impact productivity and worker wellbeing");
    } else if (laborEmployment.averageWorkweekHours < 30) {
      insights.push("Short work week may indicate part-time economy or work-life balance focus");
    }
    
    return insights;
  };

  const insights = generateInsights();

  return (
    <SectionBase
      config={sectionConfigs.labor!}
      inputs={inputs}
      onInputsChange={onInputsChange}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      referenceCountry={referenceCountry}
      metrics={metrics}
      validation={{
        errors: [],
        warnings: insights,
        info: [
          `Working Age Population: ${sectionUtils.formatNumber(workingAgePopulation)} (65% of total)`,
          `Employed Population: ${sectionUtils.formatNumber(employed)}`,
          `Average Monthly Income: ${sectionUtils.formatCurrency(laborEmployment.averageAnnualIncome / 12, '$', 0)}`
        ]
      }}
      className={className}
    >
      <SectionLayout
        basicContent={basicContent}
        advancedContent={advancedContent}
        showAdvanced={showAdvanced}
        basicColumns={2}
        advancedColumns={2}
      />
    </SectionBase>
  );
}