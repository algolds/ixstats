"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Briefcase, Users, DollarSign, Clock, TrendingUp, Info } from 'lucide-react';
import { EnhancedSlider } from '~/app/builder/primitives/enhanced';
import type { EconomicInputs } from '~/app/builder/lib/economy-data-service';

interface LaborEmploymentSectionEnhancedProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  showAdvanced?: boolean;
}

export function LaborEmploymentSectionEnhanced({
  inputs,
  onInputsChange,
  showAdvanced = false
}: LaborEmploymentSectionEnhancedProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const labor = inputs.laborEmployment;
  const totalPopulation = inputs.coreIndicators.totalPopulation;

  // Calculate metrics
  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const laborForce = Math.round(workingAgePopulation * (labor.laborForceParticipationRate / 100));
  const employed = Math.round(laborForce * ((100 - labor.unemploymentRate) / 100));
  const unemployed = laborForce - employed;

  const handleLaborChange = (field: string, value: number) => {
    const newLabor = { ...labor };

    if (field === 'laborForceParticipationRate') {
      newLabor.laborForceParticipationRate = value;
      newLabor.totalWorkforce = Math.round(workingAgePopulation * (value / 100));
    } else if (field === 'unemploymentRate') {
      newLabor.unemploymentRate = value;
      newLabor.employmentRate = 100 - value;
    } else if (field === 'averageAnnualIncome') {
      newLabor.averageAnnualIncome = value;
    } else if (field === 'averageWorkweekHours') {
      newLabor.averageWorkweekHours = value;
    } else if (field === 'minimumWage') {
      newLabor.minimumWage = value;
    }

    onInputsChange({ ...inputs, laborEmployment: newLabor });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Labor & Employment Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure workforce participation, employment rates, and wages
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(laborForce)}</p>
                <p className="text-xs text-muted-foreground">Labor Force</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Briefcase className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(employed)}</p>
                <p className="text-xs text-muted-foreground">Employed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{labor.unemploymentRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Unemployment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(labor.averageAnnualIncome)}</p>
                <p className="text-xs text-muted-foreground">Avg Income</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Workforce</TabsTrigger>
          <TabsTrigger value="wages">Wages & Hours</TabsTrigger>
        </TabsList>

        {/* Workforce Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Labor Force Participation</CardTitle>
              <CardDescription>Percentage of working-age population in the labor force</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Labor Force Participation Rate"
                value={labor.laborForceParticipationRate}
                onChange={(value) => handleLaborChange('laborForceParticipationRate', value)}
                min={40}
                max={85}
                step={0.5}
                unit="%"
                description={`${formatNumber(laborForce)} workers in labor force`}
              />
            </CardContent>
          </Card>

          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Employment Rate</CardTitle>
              <CardDescription>Unemployment rate affects economic stability</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Unemployment Rate"
                value={labor.unemploymentRate}
                onChange={(value) => handleLaborChange('unemploymentRate', value)}
                min={0}
                max={25}
                step={0.1}
                unit="%"
                description={`${formatNumber(unemployed)} unemployed workers`}
              />
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {labor.unemploymentRate < 4 && "Very low unemployment - economy at full capacity"}
                  {labor.unemploymentRate >= 4 && labor.unemploymentRate < 7 && "Healthy unemployment rate"}
                  {labor.unemploymentRate >= 7 && labor.unemploymentRate < 10 && "Elevated unemployment - economic concerns"}
                  {labor.unemploymentRate >= 10 && "High unemployment - economic crisis"}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wages Tab */}
        <TabsContent value="wages" className="space-y-6 mt-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Average Annual Income</CardTitle>
              <CardDescription>Mean income across all workers</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Average Annual Income"
                value={labor.averageAnnualIncome}
                onChange={(value) => handleLaborChange('averageAnnualIncome', value)}
                min={5000}
                max={150000}
                step={1000}
                unit="$"
                description={formatCurrency(labor.averageAnnualIncome / 12) + "/month"}
              />
            </CardContent>
          </Card>

          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Minimum Wage</CardTitle>
              <CardDescription>Hourly minimum wage requirement</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Minimum Wage"
                value={labor.minimumWage}
                onChange={(value) => handleLaborChange('minimumWage', value)}
                min={0}
                max={30}
                step={0.25}
                unit="$/hr"
                description={`${formatCurrency(labor.minimumWage * labor.averageWorkweekHours * 52)}/year at ${labor.averageWorkweekHours} hrs/week`}
              />
            </CardContent>
          </Card>

          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Work Hours</CardTitle>
              <CardDescription>Average hours worked per week</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Average Workweek Hours"
                value={labor.averageWorkweekHours}
                onChange={(value) => handleLaborChange('averageWorkweekHours', value)}
                min={20}
                max={60}
                step={1}
                unit="hrs"
                description={`${(labor.averageWorkweekHours * 52).toFixed(0)} hours per year`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
