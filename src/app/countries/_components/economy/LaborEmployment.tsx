// src/app/countries/_components/economy/LaborEmployment.tsx
"use client";

import { useState } from "react";
import { Users, Briefcase, Clock, DollarSign, TrendingDown, BarChart2, Info, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { formatCurrency, formatPopulation, displayGrowthRate } from "~/lib/chart-utils";

export interface LaborEmploymentData {
  laborForceParticipationRate: number;
  employmentRate: number;
  unemploymentRate: number;
  totalWorkforce: number;
  averageWorkweekHours: number;
  minimumWage: number;
  averageAnnualIncome: number;
}

export interface RealCountryData {
  name: string;
  unemploymentRate: number;
}

interface LaborEmploymentProps {
  laborData: LaborEmploymentData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  onLaborDataChange: (laborData: LaborEmploymentData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function LaborEmployment({
  laborData,
  referenceCountry,
  totalPopulation,
  onLaborDataChange,
  isReadOnly = false,
  showComparison = true,
}: LaborEmploymentProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');

  const handleInputChange = (field: keyof LaborEmploymentData, value: number) => {
    const newLaborData = { ...laborData, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'laborForceParticipationRate') {
      const workingAgePopulation = totalPopulation * 0.65; // Assume 65% working age
      newLaborData.totalWorkforce = Math.round(workingAgePopulation * (value / 100));
    } else if (field === 'unemploymentRate') {
      newLaborData.employmentRate = 100 - value;
    } else if (field === 'employmentRate') {
      newLaborData.unemploymentRate = 100 - value;
    }
    
    onLaborDataChange(newLaborData);
  };

  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const laborForce = Math.round(workingAgePopulation * (laborData.laborForceParticipationRate / 100));
  const employed = Math.round(laborForce * (laborData.employmentRate / 100));
  const unemployed = laborForce - employed;

  const laborMetrics = [
    {
      label: "Labor Force Participation",
      value: laborData.laborForceParticipationRate,
      unit: "%",
      target: 65,
      color: "bg-blue-500",
      description: "% of working-age population in labor force"
    },
    {
      label: "Employment Rate",
      value: laborData.employmentRate,
      unit: "%",
      target: 95,
      color: "bg-green-500",
      description: "% of labor force employed"
    },
    {
      label: "Unemployment Rate",
      value: laborData.unemploymentRate,
      unit: "%",
      target: 5,
      color: "bg-red-500",
      description: "% of labor force seeking employment",
      reverse: true
    },
  ];

  const getEmploymentHealth = () => {
    if (laborData.unemploymentRate <= 4) return { color: "text-green-600", label: "Full Employment" };
    if (laborData.unemploymentRate <= 7) return { color: "text-blue-600", label: "Healthy" };
    if (laborData.unemploymentRate <= 12) return { color: "text-yellow-600", label: "Moderate Concern" };
    return { color: "text-red-600", label: "High Unemployment" };
  };

  const employmentHealth = getEmploymentHealth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Labor & Employment
          </h3>
          <p className="text-sm text-muted-foreground">
            Workforce participation, employment levels, and labor market dynamics
          </p>
        </div>
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as 'overview' | 'detailed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Labor Force Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Labor Force Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground">
                {formatPopulation(totalPopulation)}
              </div>
              <div className="text-xs text-muted-foreground">Total Population</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">
                {formatPopulation(workingAgePopulation)}
              </div>
              <div className="text-xs text-muted-foreground">Working Age (65%)</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-primary">
                {formatPopulation(laborForce)}
              </div>
              <div className="text-xs text-muted-foreground">Labor Force</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-lg font-bold text-green-600">
                  {formatPopulation(employed)}
                </div>
                <div className="text-xs text-muted-foreground">Employed</div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-red-600">
                  {formatPopulation(unemployed)}
                </div>
                <div className="text-xs text-muted-foreground">Unemployed</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TabsContent value="overview" className="space-y-4">
        {/* Labor Metrics with Progress Bars */}
        <div className="space-y-4">
          {laborMetrics.map((metric) => {
            const percentage = metric.reverse 
              ? Math.max(0, 100 - metric.value) 
              : Math.min(100, (metric.value / metric.target) * 100);
            
            return (
              <Card key={metric.label}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{metric.label}</Label>
                      <div className="text-sm font-semibold">
                        {metric.value.toFixed(1)}{metric.unit}
                      </div>
                    </div>
                    
                    {isReadOnly ? (
                      <Progress value={percentage} className="w-full" />
                    ) : (
                      <div className="space-y-2">
                        <div className="px-3">
                          <Slider
                            value={[metric.value]}
                            onValueChange={(value) => handleInputChange(
                              metric.label === "Labor Force Participation" ? 'laborForceParticipationRate' :
                              metric.label === "Employment Rate" ? 'employmentRate' : 'unemploymentRate',
                              value[0]!
                            )}
                            max={100}
                            min={0}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                        <Progress value={percentage} className="w-full" />
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      {metric.description}
                      {referenceCountry && metric.label === "Unemployment Rate" && (
                        <span className="ml-2 text-primary">
                          Ref: {referenceCountry.unemploymentRate.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="detailed" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Work Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workweekHours">Average Workweek Hours</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{laborData.averageWorkweekHours}h/week</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[laborData.averageWorkweekHours]}
                        onValueChange={(value) => handleInputChange('averageWorkweekHours', value[0]!)}
                        max={60}
                        min={20}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>20h</span>
                      <span className="font-medium text-foreground">
                        {laborData.averageWorkweekHours}h/week
                      </span>
                      <span>60h</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumWage">Minimum Wage ($/hour)</Label>
                {isReadOnly ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{formatCurrency(laborData.minimumWage)}/hr</div>
                    <div className="text-xs text-muted-foreground">
                      Annual: {formatCurrency(laborData.minimumWage * laborData.averageWorkweekHours * 52)}
                    </div>
                  </div>
                ) : (
                  <>
                    <Input
                      id="minimumWage"
                      type="number"
                      value={laborData.minimumWage}
                      onChange={(e) => handleInputChange('minimumWage', parseFloat(e.target.value) || 0)}
                      step="0.25"
                      min="0"
                    />
                    <div className="text-xs text-muted-foreground">
                      Annual: {formatCurrency(laborData.minimumWage * laborData.averageWorkweekHours * 52)}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Income & Workforce
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="averageIncome">Average Annual Income ($)</Label>
                {isReadOnly ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{formatCurrency(laborData.averageAnnualIncome)}</div>
                    <div className="text-xs text-muted-foreground">
                      Hourly equiv: {formatCurrency(laborData.averageAnnualIncome / (laborData.averageWorkweekHours * 52))}/hour
                    </div>
                  </div>
                ) : (
                  <>
                    <Input
                      id="averageIncome"
                      type="number"
                      value={laborData.averageAnnualIncome}
                      onChange={(e) => handleInputChange('averageAnnualIncome', parseFloat(e.target.value) || 0)}
                      step="1000"
                      min="0"
                    />
                    <div className="text-xs text-muted-foreground">
                      Hourly equiv: {formatCurrency(laborData.averageAnnualIncome / (laborData.averageWorkweekHours * 52))}/hour
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalWorkforce">Total Workforce</Label>
                {isReadOnly ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{formatPopulation(laborData.totalWorkforce)}</div>
                    <div className="text-xs text-muted-foreground">
                      {((laborData.totalWorkforce / totalPopulation) * 100).toFixed(1)}% of total population
                    </div>
                  </div>
                ) : (
                  <>
                    <Input
                      id="totalWorkforce"
                      type="number"
                      value={laborData.totalWorkforce}
                      onChange={(e) => handleInputChange('totalWorkforce', parseFloat(e.target.value) || 0)}
                      step="1000"
                      min="0"
                    />
                    <div className="text-xs text-muted-foreground">
                      {((laborData.totalWorkforce / totalPopulation) * 100).toFixed(1)}% of total population
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Labor Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Labor Market Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Participation Rate</div>
                <div className="text-2xl font-bold">{laborData.laborForceParticipationRate.toFixed(1)}%</div>
                <Badge variant={laborData.laborForceParticipationRate >= 60 ? "default" : "secondary"}>
                  {laborData.laborForceParticipationRate >= 60 ? "Good" : "Low"}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Employment-Population Ratio</div>
                <div className="text-2xl font-bold">
                  {((employed / totalPopulation) * 100).toFixed(1)}%
                </div>
                <Badge variant={employed / totalPopulation > 0.5 ? "default" : "secondary"}>
                  {employed / totalPopulation > 0.5 ? "Strong" : "Weak"}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Labor Productivity</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(laborData.averageAnnualIncome / laborData.averageWorkweekHours / 52)}
                </div>
                <div className="text-xs text-muted-foreground">per hour worked</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Employment Health: <span className={employmentHealth.color}>{employmentHealth.label}</span>
          </div>
          <div className="text-sm">
            {laborData.unemploymentRate <= 4 
              ? "Your economy is at full employment. Consider policies to avoid labor shortages."
              : laborData.unemploymentRate <= 7
              ? "Healthy employment levels with room for sustainable growth."
              : laborData.unemploymentRate <= 12
              ? "Moderate unemployment may require job creation programs."
              : "High unemployment requires significant economic intervention and job creation initiatives."
            }
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}