"use client";

import React, { useMemo } from 'react';
import { Briefcase, Users, Clock, DollarSign, TrendingUp, TrendingDown, Shield, AlertTriangle, UserCheck } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedNumberInput,
  GlassProgressIndicator,
  MetricCard,
  ViewTransition
} from '../primitives/enhanced';
import { StandardSectionTemplate, SECTION_THEMES } from '../primitives/StandardSectionTemplate';
import type { StandardSectionProps } from '../primitives/StandardSectionTemplate';
import type { LaborEmploymentData } from '../lib/economy-data-service';

export function LaborEmploymentSectionModern({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: StandardSectionProps) {
  const laborEmployment = inputs.laborEmployment;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  const nominalGDP = inputs.coreIndicators.nominalGDP;
  
  // Handle input changes with proper type safety
  const handleLaborChange = (field: keyof LaborEmploymentData, value: any) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newLaborEmployment = { ...laborEmployment, [field]: safeValue };
    
    // Auto-calculate related fields
    if (field === 'minimumWage' || field === 'averageWorkweekHours') {
      // Recalculate productivity if needed
    }
    
    onInputsChange({ ...inputs, laborEmployment: newLaborEmployment });
  };

  // Calculate labor market metrics
  const laborMetrics = useMemo(() => {
    // Safely extract and validate all input values
    const safePopulation = typeof totalPopulation === 'number' && !isNaN(totalPopulation) ? totalPopulation : 0;
    const safeGDP = typeof nominalGDP === 'number' && !isNaN(nominalGDP) ? nominalGDP : 0;
    const safeParticipationRate = typeof laborEmployment.laborForceParticipationRate === 'number' && !isNaN(laborEmployment.laborForceParticipationRate) 
      ? laborEmployment.laborForceParticipationRate : 65;
    const safeUnemploymentRate = typeof laborEmployment.unemploymentRate === 'number' && !isNaN(laborEmployment.unemploymentRate) 
      ? laborEmployment.unemploymentRate : 5;
    
    const workingAgePopulation = Math.round(safePopulation * 0.65); // Assuming 65% working age
    const laborForce = Math.round(workingAgePopulation * (safeParticipationRate / 100));
    const employed = Math.round(laborForce * ((100 - safeUnemploymentRate) / 100));
    const unemployed = Math.max(0, laborForce - employed);
    
    // Calculate productivity metrics with safe division
    const gdpPerWorker = employed > 0 ? safeGDP / employed : 0;
    const employmentRate = workingAgePopulation > 0 ? (employed / workingAgePopulation) * 100 : 0;
    
    // Labor market health assessment using safe values
    const laborHealth = safeUnemploymentRate < 4 ? 'excellent' :
                       safeUnemploymentRate < 7 ? 'good' :
                       safeUnemploymentRate < 12 ? 'concerning' : 'critical';
    
    return {
      workingAgePopulation,
      laborForce,
      employed,
      unemployed,
      gdpPerWorker,
      employmentRate,
      laborHealth,
      participationGap: 80 - safeParticipationRate // Gap from target 80%
    };
  }, [laborEmployment, totalPopulation, nominalGDP]);

  // Basic view content - Essential labor indicators
  const basicContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview Metrics */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Unemployment Rate"
          value={`${laborEmployment.unemploymentRate.toFixed(1)}%`}
          icon={Users}
          sectionId="labor"
        />
        <MetricCard
          label="Labor Force"
          value={laborMetrics.laborForce.toLocaleString()}
          unit="people"
          icon={Briefcase}
          sectionId="labor"
        />
        <MetricCard
          label="Participation Rate"
          value={`${laborEmployment.laborForceParticipationRate.toFixed(1)}%`}
          icon={UserCheck}
          sectionId="labor"
        />
        <MetricCard
          label="Employment Rate"
          value={`${laborMetrics.employmentRate.toFixed(1)}%`}
          icon={TrendingUp}
          sectionId="labor"
        />
      </div>

      {/* Essential Controls */}
      <EnhancedSlider
        label="Unemployment Rate"
        description="Percentage of labor force that is unemployed"
        value={Number(laborEmployment.unemploymentRate) || 0}
        onChange={(value) => handleLaborChange('unemploymentRate', Number(value))}
        min={0.5}
        max={25}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={Users}
        showTicks={true}
        tickCount={6}
        referenceValue={referenceCountry?.unemploymentRate}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Labor Force Participation Rate"
        description="Percentage of working-age population in labor force"
        value={Number(laborEmployment.laborForceParticipationRate) || 0}
        onChange={(value) => handleLaborChange('laborForceParticipationRate', Number(value))}
        min={45}
        max={85}
        step={0.1}
        unit="%"
        sectionId="labor"
        icon={Briefcase}
        showTicks={true}
        tickCount={5}
        showComparison={true}
      />

      <EnhancedNumberInput
        label="Average Income"
        description="Average worker income per year"
        value={Number(laborEmployment.averageAnnualIncome) || 0}
        onChange={(value) => handleLaborChange('averageAnnualIncome', Number(value))}
        min={5000}
        max={100000}
        step={100}
        unit=""
        sectionId="labor"
        icon={DollarSign}
        format={(value) => `$${Number(value).toLocaleString()}`}
        showComparison={true}
      />

      {/* Labor Market Health Indicator */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Labor Market Health
        </h4>
        
        <GlassProgressIndicator
          label="Labor Market Health"
          value={laborMetrics.laborHealth === 'excellent' ? 100 : 
                 laborMetrics.laborHealth === 'good' ? 75 : 
                 laborMetrics.laborHealth === 'concerning' ? 50 : 25}
          max={100}
          variant="circular"
          showPercentage={false}
          showValue={false}
          sectionId="labor"
          color={laborMetrics.laborHealth === 'excellent' ? '#10b981' : 
                 laborMetrics.laborHealth === 'good' ? '#f59e0b' : 
                 laborMetrics.laborHealth === 'concerning' ? '#f97316' : '#ef4444'}
        />
        
        <div className="text-center">
          <p className="text-sm font-medium text-foreground capitalize">
            {laborMetrics.laborHealth}
          </p>
          <p className="text-xs text-muted-foreground">
            {laborEmployment.unemploymentRate.toFixed(1)}% unemployment
          </p>
        </div>
      </div>
    </div>
  );

  // Advanced view content - Detailed labor system
  const advancedContent = (
    <div className="space-y-8">
      {/* Employment Details Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Employment Details
        </h4>
        
        {/* Employment Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Employed"
            value={laborMetrics.employed.toLocaleString()}
            unit="people"
            icon={TrendingUp}
            sectionId="labor"
          />
          <MetricCard
            label="Unemployed"
            value={laborMetrics.unemployed.toLocaleString()}
            unit="people"
            icon={TrendingDown}
            sectionId="labor"
          />
          <MetricCard
            label="GDP per Worker"
            value={`$${laborMetrics.gdpPerWorker.toLocaleString()}`}
            icon={DollarSign}
            sectionId="labor"
          />
          <MetricCard
            label="Working Age Pop."
            value={laborMetrics.workingAgePopulation.toLocaleString()}
            unit="people"
            icon={Users}
            sectionId="labor"
          />
        </div>

        {/* Detailed Employment Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-foreground">Employment Rates</h5>
            
            <EnhancedSlider
              label="Youth Unemployment (15-24)"
              value={laborEmployment.unemploymentRate * 2}
              onChange={(value) => handleLaborChange('unemploymentRate', Number(value) / 2)}
              min={laborEmployment.unemploymentRate}
              max={50}
              step={0.1}
              unit="%"
              sectionId="labor"
              icon={Users}
            />
            
            <EnhancedSlider
              label="Long-term Unemployment"
              value={laborEmployment.unemploymentRate * 0.4}
              onChange={(value) => handleLaborChange('unemploymentRate', Number(value) / 0.4)}
              min={0}
              max={laborEmployment.unemploymentRate}
              step={0.1}
              unit="%"
              sectionId="labor"
              icon={Clock}
            />
          </div>

          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-foreground">Participation Analysis</h5>
            
            <div className="p-4 rounded-lg bg-secondary border border-border">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Current Participation</span>
                  <span className="text-sm font-medium text-foreground">
                    {laborEmployment.laborForceParticipationRate.toFixed(1)}%
                  </span>
                </div>
                
                <GlassProgressIndicator
                  value={laborEmployment.laborForceParticipationRate}
                  max={85}
                  variant="linear"
                  height={6}
                  showPercentage={false}
                  sectionId="labor"
                />
                
                <p className="text-xs text-muted-foreground">
                  {laborMetrics.participationGap > 0 ? 
                    `${laborMetrics.participationGap.toFixed(1)}% below target (80%)` :
                    'Above target participation rate'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wages & Working Conditions Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Wages & Working Conditions
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnhancedNumberInput
            label="Minimum Wage (Annual)"
            description="Minimum wage per year"
            value={Number(laborEmployment.minimumWage) || 0}
            onChange={(value) => handleLaborChange('minimumWage', Number(value))}
            min={1000}
            max={50000}
            step={100}
            unit=""
            sectionId="labor"
            icon={DollarSign}
            format={(value) => `$${Number(value).toLocaleString()}`}
          />
          
          <EnhancedSlider
            label="Average Work Week"
            description="Average hours worked per week"
            value={Number(laborEmployment.averageWorkweekHours) || 40}
            onChange={(value) => handleLaborChange('averageWorkweekHours', Number(value))}
            min={32}
            max={60}
            step={0.5}
            unit=" hours"
            sectionId="labor"
            icon={Clock}
            showTicks={true}
            tickCount={5}
          />
        </div>

        {/* Wage Distribution Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-foreground">Income Distribution</h5>
            
            <div className="space-y-3">
              <MetricCard
                label="Median Income"
                value={`$${((laborEmployment.averageAnnualIncome || 0) * 0.85).toLocaleString()}`}
                description="Estimated median worker income"
                icon={DollarSign}
                sectionId="labor"
                size="sm"
              />
              
              <MetricCard
                label="Income Inequality"
                value="Medium"
                description="Based on wage distribution"
                icon={TrendingUp}
                sectionId="labor"
                size="sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-foreground">Productivity Metrics</h5>
            
            <div className="space-y-3">
              <MetricCard
                label="Output per Hour"
                value={`$${((laborMetrics.gdpPerWorker || 0) / ((laborEmployment.averageWorkweekHours || 40) * 52)).toFixed(0)}`}
                description="GDP per hour worked"
                icon={TrendingUp}
                sectionId="labor"
                size="sm"
              />
              
              <MetricCard
                label="Annual Output per Worker"
                value={`$${(laborMetrics.gdpPerWorker || 0).toLocaleString()}`}
                description="GDP per employed person"
                icon={Briefcase}
                sectionId="labor"
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Labor Market Policies Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Labor Market Health Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health Indicators */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary border border-border">
              <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Labor Market Alerts
              </h5>
              
              <div className="space-y-2">
                {laborEmployment.unemploymentRate > 10 && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    High unemployment rate
                  </div>
                )}
                
                {laborEmployment.laborForceParticipationRate < 60 && (
                  <div className="flex items-center gap-2 text-orange-500 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Low labor force participation
                  </div>
                )}
                
                {laborEmployment.averageAnnualIncome < 20000 && (
                  <div className="flex items-center gap-2 text-yellow-500 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Low average income levels
                  </div>
                )}
                
                {laborEmployment.unemploymentRate <= 6 && 
                 laborEmployment.laborForceParticipationRate >= 70 && 
                 laborEmployment.averageAnnualIncome >= 25000 && (
                  <div className="flex items-center gap-2 text-green-500 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Healthy labor market indicators
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary border border-border">
              <h5 className="text-sm font-semibold text-foreground mb-3">Policy Recommendations</h5>
              
              <div className="space-y-2 text-xs text-muted-foreground">
                {laborEmployment.unemploymentRate > 8 && (
                  <p>• Consider job creation programs and skills training</p>
                )}
                
                {laborEmployment.laborForceParticipationRate < 65 && (
                  <p>• Review barriers to workforce participation</p>
                )}
                
                {laborEmployment.averageAnnualIncome < 30000 && (
                  <p>• Focus on productivity improvements and education</p>
                )}
                
                {laborEmployment.averageWorkweekHours > 45 && (
                  <p>• Consider work-life balance policies</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <StandardSectionTemplate
      title="Labor & Employment"
      description="Employment rates, wages, and working conditions"
      icon={Briefcase}
      basicContent={basicContent}
      advancedContent={advancedContent}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      theme={SECTION_THEMES.labor}
      depth="elevated"
      blur="medium"
      className={className}
      inputs={inputs}
      onInputsChange={onInputsChange}
      referenceCountry={referenceCountry}
    />
  );
}