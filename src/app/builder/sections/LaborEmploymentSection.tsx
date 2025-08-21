"use client";

import React, { useState, useMemo } from 'react';
import { Briefcase, Users, Clock, DollarSign, TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react';
import {
  GlassSlider,
  GlassDial,
  GlassNumberPicker,
  GlassToggle,
  GlassPieChart,
  GlassBarChart,
} from '~/components/charts';
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
  const metrics = useMemo(() => {
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
        theme: 'indigo' as const
      },
      {
        label: "Unemployment Rate",
        value: `${laborEmployment.unemploymentRate.toFixed(1)}%`,
        icon: laborEmployment.unemploymentRate > 10 ? TrendingDown : TrendingUp,
        theme: laborEmployment.unemploymentRate > 10 ? 'red' : laborEmployment.unemploymentRate > 7 ? 'gold' : 'emerald' as const,
        trend: laborEmployment.unemploymentRate > 10 ? 'down' : laborEmployment.unemploymentRate > 7 ? 'neutral' : 'up' as const
      },
      {
        label: "Average Income",
        value: sectionUtils.formatCurrency(laborEmployment.averageAnnualIncome, '$', 0),
        unit: "/year",
        icon: DollarSign,
        theme: 'indigo' as const
      },
      {
        label: "Work Hours",
        value: `${laborEmployment.averageWorkweekHours}`,
        unit: "hrs/week",
        icon: Clock,
        theme: 'indigo' as const
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
    { name: 'Minimum Wage', value: laborEmployment.minimumWage },
    { name: 'Average Income', value: laborEmployment.averageAnnualIncome / 12 }, // Monthly
    { name: 'Median Income', value: (laborEmployment.averageAnnualIncome * 0.85) / 12 } // Estimated monthly
  ];

  const workforceData = [
    { name: 'Labor Force Participation', value: laborEmployment.laborForceParticipationRate },
    { name: 'Employment Rate', value: 100 - laborEmployment.unemploymentRate },
    { name: 'Youth Employment', value: Math.max(0, 100 - laborEmployment.unemploymentRate * 1.5) },
    { name: 'Senior Employment', value: Math.max(0, 100 - laborEmployment.unemploymentRate * 0.8) }
  ];

  // Basic view content - Essential labor metrics
  const basicContent = (
    <>
      <GlassSlider
        label="Unemployment Rate"
        value={laborEmployment.unemploymentRate}
        onChange={(value) => handleLaborChange('unemploymentRate', value)}
        min={0}
        max={25}
        step={0.1}
        unit="%"
        theme="indigo"
        showTicks={true}
        tickCount={6}
        referenceValue={referenceCountry?.unemploymentRate}
        referenceLabel={referenceCountry?.name}
      />

      <GlassDial
        label="Labor Force Participation"
        value={laborEmployment.laborForceParticipationRate}
        onChange={(value) => handleLaborChange('laborForceParticipationRate', value)}
        min={30}
        max={90}
        step={0.5}
        unit="%"
        theme="indigo"
      />

      <GlassNumberPicker
        label="Average Annual Income"
        value={laborEmployment.averageAnnualIncome}
        onChange={(value) => handleLaborChange('averageAnnualIncome', value)}
        min={5000}
        max={120000}
        step={1000}
        unit=" $/year"
        theme="indigo"
      />

      {/* Basic visualization */}
      <div className="md:col-span-2">
        <GlassPieChart
          data={laborData}
          dataKey="value"
          nameKey="category"
          title="Employment Status"
          description="Labor force distribution"
          height={250}
          theme="indigo"
        />
      </div>
    </>
  );

  // Advanced view content - Detailed labor controls
  const advancedContent = (
    <>
      {/* Detailed Controls */}
      <GlassNumberPicker
        label="Minimum Wage"
        value={laborEmployment.minimumWage}
        onChange={(value) => handleLaborChange('minimumWage', value)}
        min={500}
        max={4000}
        step={50}
        unit=" $/month"
        theme="indigo"
      />

      <GlassSlider
        label="Average Work Week"
        value={laborEmployment.averageWorkweekHours}
        onChange={(value) => handleLaborChange('averageWorkweekHours', value)}
        min={20}
        max={60}
        step={1}
        unit=" hours"
        theme="indigo"
        showTicks={true}
        tickCount={5}
      />

      <GlassNumberPicker
        label="Total Workforce"
        value={laborEmployment.totalWorkforce}
        onChange={(value) => handleLaborChange('totalWorkforce', value)}
        min={totalPopulation * 0.3}
        max={totalPopulation * 0.8}
        step={1000}
        unit=" people"
        theme="indigo"
      />

      <GlassSlider
        label="Employment Rate"
        value={laborEmployment.employmentRate}
        onChange={(value) => handleLaborChange('employmentRate', value)}
        min={50}
        max={100}
        step={0.1}
        unit="%"
        theme="indigo"
        showTicks={true}
        tickCount={6}
      />

      {/* Labor Policy Toggles */}
      <div className="md:col-span-2 space-y-4">
        <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Labor Policies
        </h5>
        <FormGrid columns={2}>
          <GlassToggle
            label="Strong Labor Protections"
            description="Enhanced worker rights and job security"
            checked={laborEmployment.laborProtections}
            onChange={(checked) => handleLaborChange('laborProtections', checked)}
            theme="indigo"
          />
          <GlassToggle
            label="Collective Bargaining"
            description="Support for union organizing and negotiations"
            checked={false} // TODO: Add to data model
            onChange={(checked) => {/* TODO: Implement */}}
            theme="indigo"
          />
        </FormGrid>
      </div>

      {/* Advanced Visualizations */}
      <div className="md:col-span-2">
        <GlassBarChart
          data={wageData}
          xKey="name"
          yKey="value"
          title="Income Distribution"
          description="Monthly income levels across the economy"
          height={300}
          theme="indigo"
        />
      </div>

      <div className="md:col-span-2">
        <GlassBarChart
          data={workforceData}
          xKey="name"
          yKey="value"
          title="Employment Metrics"
          description="Labor market participation across demographics"
          height={250}
          theme="indigo"
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
      config={sectionConfigs.labor}
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