"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock,
  Shield,
  Briefcase,
  GraduationCap,
  Heart,
  Target,
  BarChart3,
  PieChart,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Zap
} from 'lucide-react';

// Enhanced Components
import {
  EnhancedSlider,
  EnhancedNumberInput,
  EnhancedToggle,
  MetricCard
} from '../../../primitives/enhanced';
import { GlassBarChart, GlassPieChart } from '~/components/charts/RechartsIntegration';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';

// Types
import type { 
  EconomyBuilderState, 
  LaborConfiguration 
} from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

interface LaborEmploymentTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
}

export function LaborEmploymentTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents
}: LaborEmploymentTabProps) {
  const [activeSection, setActiveSection] = useState<'workforce' | 'employment' | 'income' | 'protections'>('workforce');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate employment impacts from atomic components
  const employmentImpacts = useMemo(() => {
    return selectedComponents.reduce((acc, compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (!component?.employmentImpact) return acc;

      return {
        unemployment: acc.unemployment + (component.employmentImpact.unemploymentModifier || 0),
        participation: acc.participation * (component.employmentImpact.participationModifier || 1),
        wageGrowth: acc.wageGrowth * (component.employmentImpact.wageGrowthModifier || 1)
      };
    }, { unemployment: 0, participation: 1, wageGrowth: 1 });
  }, [selectedComponents]);

  // Handle labor market changes
  const handleLaborChange = (field: keyof LaborConfiguration, value: any) => {
    const updatedLabor = {
      ...economyBuilder.laborMarket,
      [field]: value
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      laborMarket: updatedLabor
    });
  };

  // Handle nested object changes
  const handleNestedLaborChange = (parentField: keyof LaborConfiguration, field: string, value: any) => {
    const updatedLabor = {
      ...economyBuilder.laborMarket,
      [parentField]: {
        ...(economyBuilder.laborMarket[parentField] as any),
        [field]: value
      }
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      laborMarket: updatedLabor
    });
  };

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const labor = economyBuilder.laborMarket;
    const totalWorkforce = labor.totalWorkforce;
    const employed = Math.round(totalWorkforce * (labor.employmentRate / 100));
    const unemployed = totalWorkforce - employed;
    const underemployed = Math.round(totalWorkforce * (labor.underemploymentRate / 100));
    
    return {
      employed,
      unemployed,
      underemployed,
      workingAgePopulation: Math.round(totalWorkforce / (labor.laborForceParticipationRate / 100)),
      laborForceSize: totalWorkforce,
      effectiveUnemployment: ((unemployed + underemployed) / totalWorkforce) * 100
    };
  }, [economyBuilder.laborMarket]);

  // Prepare chart data
  const employmentTypeData = useMemo(() => {
    const types = economyBuilder.laborMarket.employmentType;
    return Object.entries(types).map(([type, value]) => ({
      name: type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value,
      color: getEmploymentTypeColor(type)
    }));
  }, [economyBuilder.laborMarket.employmentType]);

  const sectorDistributionData = useMemo(() => {
    const sectors = economyBuilder.laborMarket.sectorDistribution;
    return Object.entries(sectors).map(([sector, value]) => ({
      name: sector.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value,
      color: getSectorColor(sector)
    }));
  }, [economyBuilder.laborMarket.sectorDistribution]);

  const workerProtectionsData = useMemo(() => {
    const protections = economyBuilder.laborMarket.workerProtections;
    return Object.entries(protections).map(([protection, value]) => ({
      name: protection.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value,
      color: getProtectionColor(protection)
    }));
  }, [economyBuilder.laborMarket.workerProtections]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Labor & Employment Configuration</h2>
          <p className="text-muted-foreground">
            Configure workforce dynamics, employment rates, and worker protections
          </p>
        </div>
      </div>

      {/* Component Impact Display */}
      {(employmentImpacts.unemployment !== 0 || employmentImpacts.participation !== 1 || employmentImpacts.wageGrowth !== 1) && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center space-x-4">
              <span>Atomic Component Impact:</span>
              {employmentImpacts.unemployment !== 0 && (
                <Badge variant={employmentImpacts.unemployment < 0 ? "default" : "secondary"}>
                  Unemployment: {employmentImpacts.unemployment > 0 ? '+' : ''}{employmentImpacts.unemployment.toFixed(1)}%
                </Badge>
              )}
              {employmentImpacts.participation !== 1 && (
                <Badge variant={employmentImpacts.participation > 1 ? "default" : "secondary"}>
                  Participation: {((employmentImpacts.participation - 1) * 100).toFixed(1)}%
                </Badge>
              )}
              {employmentImpacts.wageGrowth !== 1 && (
                <Badge variant={employmentImpacts.wageGrowth > 1 ? "default" : "secondary"}>
                  Wage Growth: {((employmentImpacts.wageGrowth - 1) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Workforce"
          value={derivedMetrics.laborForceSize.toLocaleString()}
          icon={Users}
          sectionId="labor"
          trend="neutral"
        />
        <MetricCard
          label="Unemployment Rate"
          value={`${economyBuilder.laborMarket.unemploymentRate.toFixed(1)}%`}
          icon={economyBuilder.laborMarket.unemploymentRate < 5 ? TrendingUp : TrendingDown}
          sectionId="labor"
          trend={economyBuilder.laborMarket.unemploymentRate < 5 ? 'up' : 'down'}
        />
        <MetricCard
          label="Participation Rate"
          value={`${economyBuilder.laborMarket.laborForceParticipationRate.toFixed(1)}%`}
          icon={Users}
          sectionId="labor"
          trend={economyBuilder.laborMarket.laborForceParticipationRate > 65 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Avg Workweek"
          value={`${economyBuilder.laborMarket.averageWorkweekHours.toFixed(1)} hrs`}
          icon={Clock}
          sectionId="labor"
          trend="neutral"
        />
      </div>

      {/* Section Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {[
          { id: 'workforce', label: 'Workforce', icon: Users },
          { id: 'employment', label: 'Employment', icon: Briefcase },
          { id: 'income', label: 'Income & Wages', icon: DollarSign },
          { id: 'protections', label: 'Worker Rights', icon: Shield }
        ].map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSection(section.id as any)}
              className="flex-1"
            >
              <Icon className="h-4 w-4 mr-2" />
              {section.label}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeSection === 'workforce' && 'Workforce Structure'}
              {activeSection === 'employment' && 'Employment Configuration'}
              {activeSection === 'income' && 'Income & Wage Settings'}
              {activeSection === 'protections' && 'Worker Protections'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeSection === 'workforce' && (
              <div className="space-y-4">
                <EnhancedSlider
                  label="Labor Force Participation Rate"
                  description="Percentage of working-age population in the labor force"
                  value={economyBuilder.laborMarket.laborForceParticipationRate}
                  onChange={(value) => handleLaborChange('laborForceParticipationRate', value)}
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
                  value={economyBuilder.laborMarket.femaleParticipationRate}
                  onChange={(value) => handleLaborChange('femaleParticipationRate', value)}
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
                  value={economyBuilder.laborMarket.maleParticipationRate}
                  onChange={(value) => handleLaborChange('maleParticipationRate', value)}
                  min={40}
                  max={95}
                  step={0.1}
                  unit="%"
                  sectionId="labor"
                  icon={Users}
                  showValue={true}
                />

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t">
                    <EnhancedSlider
                      label="Youth Unemployment Rate"
                      description="Unemployment rate for ages 15-24"
                      value={economyBuilder.laborMarket.youthUnemploymentRate}
                      onChange={(value) => handleLaborChange('youthUnemploymentRate', value)}
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
                      value={economyBuilder.laborMarket.seniorEmploymentRate}
                      onChange={(value) => handleLaborChange('seniorEmploymentRate', value)}
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
            )}

            {activeSection === 'employment' && (
              <div className="space-y-4">
                <EnhancedSlider
                  label="Unemployment Rate"
                  description="Overall unemployment rate"
                  value={economyBuilder.laborMarket.unemploymentRate}
                  onChange={(value) => handleLaborChange('unemploymentRate', value)}
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
                  value={economyBuilder.laborMarket.underemploymentRate}
                  onChange={(value) => handleLaborChange('underemploymentRate', value)}
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
                  value={economyBuilder.laborMarket.averageWorkweekHours}
                  onChange={(value) => handleLaborChange('averageWorkweekHours', value)}
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
                  value={economyBuilder.laborMarket.averageOvertimeHours}
                  onChange={(value) => handleLaborChange('averageOvertimeHours', value)}
                  min={0}
                  max={20}
                  step={0.1}
                  unit="hours"
                  sectionId="labor"
                  icon={Clock}
                  showValue={true}
                />

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-3">
                      <h4 className="font-medium">Employment Type Distribution</h4>
                      {Object.entries(economyBuilder.laborMarket.employmentType).map(([type, value]) => (
                        <EnhancedSlider
                          key={type}
                          label={type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          value={value}
                          onChange={(newValue) => handleNestedLaborChange('employmentType', type, newValue)}
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
            )}

            {activeSection === 'income' && (
              <div className="space-y-4">
                <EnhancedNumberInput
                  label="Minimum Wage (Hourly)"
                  description="Minimum hourly wage rate"
                  value={economyBuilder.laborMarket.minimumWageHourly}
                  onChange={(value) => handleLaborChange('minimumWageHourly', value)}
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
                  value={economyBuilder.laborMarket.livingWageHourly}
                  onChange={(value) => handleLaborChange('livingWageHourly', value)}
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
                      value={economyBuilder.laborMarket.unionizationRate}
                      onChange={(value) => handleLaborChange('unionizationRate', value)}
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
                      value={economyBuilder.laborMarket.collectiveBargainingCoverage}
                      onChange={(value) => handleLaborChange('collectiveBargainingCoverage', value)}
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
            )}

            {activeSection === 'protections' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Worker Protection Scores</h4>
                  {Object.entries(economyBuilder.laborMarket.workerProtections).map(([protection, value]) => (
                    <EnhancedSlider
                      key={protection}
                      label={protection.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      value={value}
                      onChange={(newValue) => handleNestedLaborChange('workerProtections', protection, newValue)}
                      min={0}
                      max={100}
                      step={1}
                      unit="score"
                      sectionId="labor"
                      icon={Shield}
                      showValue={true}
                      showRange={true}
                    />
                  ))}
                </div>

                <EnhancedSlider
                  label="Workplace Safety Index"
                  description="Overall workplace safety rating"
                  value={economyBuilder.laborMarket.workplaceSafetyIndex}
                  onChange={(value) => handleLaborChange('workplaceSafetyIndex', value)}
                  min={0}
                  max={100}
                  step={1}
                  unit="index"
                  sectionId="labor"
                  icon={Shield}
                  showValue={true}
                  showRange={true}
                />

                <EnhancedSlider
                  label="Labor Rights Score"
                  description="Overall labor rights and freedoms rating"
                  value={economyBuilder.laborMarket.laborRightsScore}
                  onChange={(value) => handleLaborChange('laborRightsScore', value)}
                  min={0}
                  max={100}
                  step={1}
                  unit="score"
                  sectionId="labor"
                  icon={Shield}
                  showValue={true}
                  showRange={true}
                />

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t">
                    <EnhancedNumberInput
                      label="Paid Vacation Days"
                      description="Average annual paid vacation days"
                      value={economyBuilder.laborMarket.paidVacationDays}
                      onChange={(value) => handleLaborChange('paidVacationDays', value)}
                      min={0}
                      max={50}
                      step={1}
                      sectionId="labor"
                      icon={Heart}
                      showButtons={true}
                    />

                    <EnhancedNumberInput
                      label="Paid Sick Leave Days"
                      description="Average annual paid sick leave days"
                      value={economyBuilder.laborMarket.paidSickLeaveDays}
                      onChange={(value) => handleLaborChange('paidSickLeaveDays', value)}
                      min={0}
                      max={30}
                      step={1}
                      sectionId="labor"
                      icon={Heart}
                      showButtons={true}
                    />

                    <EnhancedNumberInput
                      label="Parental Leave Weeks"
                      description="Paid parental leave duration"
                      value={economyBuilder.laborMarket.parentalLeaveWeeks}
                      onChange={(value) => handleLaborChange('parentalLeaveWeeks', value)}
                      min={0}
                      max={52}
                      step={1}
                      sectionId="labor"
                      icon={Heart}
                      showButtons={true}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visualizations */}
        <div className="space-y-6">
          {/* Employment Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>Employment Type Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassPieChart
                data={employmentTypeData}
                dataKey="value"
                nameKey="name"
                height={300}
              colors={DEFAULT_CHART_COLORS}
              />
            </CardContent>
          </Card>

          {/* Sector Employment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Employment by Sector</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassBarChart
                data={sectorDistributionData}
                xKey="name"
                yKey="value"
                height={250}
              colors={DEFAULT_CHART_COLORS}
                valueFormatter={(value) => `${value.toFixed(1)}%`}
              />
            </CardContent>
          </Card>

          {/* Worker Protections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Worker Protection Scores</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassBarChart
                data={workerProtectionsData}
                xKey="name"
                yKey="value"
                height={250}
              colors={DEFAULT_CHART_COLORS}
                valueFormatter={(value) => `${value.toFixed(0)}`}
              />
            </CardContent>
          </Card>

          {/* Labor Market Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gauge className="h-5 w-5" />
                <span>Labor Market Health</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Employment Rate</span>
                    <span className="font-medium">{economyBuilder.laborMarket.employmentRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={economyBuilder.laborMarket.employmentRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Labor Force Participation</span>
                    <span className="font-medium">{economyBuilder.laborMarket.laborForceParticipationRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={economyBuilder.laborMarket.laborForceParticipationRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Workplace Safety</span>
                    <span className="font-medium">{economyBuilder.laborMarket.workplaceSafetyIndex.toFixed(0)}</span>
                  </div>
                  <Progress value={economyBuilder.laborMarket.workplaceSafetyIndex} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Labor Rights Score</span>
                    <span className="font-medium">{economyBuilder.laborMarket.laborRightsScore.toFixed(0)}</span>
                  </div>
                  <Progress value={economyBuilder.laborMarket.laborRightsScore} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper functions for colors
function getEmploymentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    fullTime: 'blue',
    partTime: 'green',
    temporary: 'yellow',
    seasonal: 'orange',
    selfEmployed: 'purple',
    gig: 'pink',
    informal: 'red'
  };
  return colors[type] || 'gray';
}

function getSectorColor(sector: string): string {
  const colors: Record<string, string> = {
    agriculture: 'green',
    mining: 'orange',
    manufacturing: 'blue',
    construction: 'yellow',
    utilities: 'purple',
    wholesale: 'cyan',
    retail: 'pink',
    transportation: 'indigo',
    information: 'teal',
    finance: 'amber',
    professional: 'emerald',
    education: 'violet',
    healthcare: 'red',
    hospitality: 'lime',
    government: 'gray',
    other: 'slate'
  };
  return colors[sector] || 'gray';
}

function getProtectionColor(protection: string): string {
  const colors: Record<string, string> = {
    jobSecurity: 'blue',
    wageProtection: 'green',
    healthSafety: 'red',
    discriminationProtection: 'purple',
    collectiveRights: 'orange'
  };
  return colors[protection] || 'gray';
}
