"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Users,
  Clock,
  BarChart2,
  Info,
  Factory,
  Wheat,
  Building2,
  TrendingUp,
  GraduationCap,
  ShieldCheck,
  MapPin,
  Heart,
  Calendar,
  Eye,
  Pencil,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatPopulation, formatPercentage, formatCurrency } from "./utils";
import type { LaborEmploymentData } from "~/types/economics";

export interface RealCountryData {
  name: string;
  unemploymentRate: number;
}

interface LaborEmploymentProps {
  laborData: LaborEmploymentData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  /** SERVER ACTION */
  onLaborDataChangeAction: (d: LaborEmploymentData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function LaborEmployment({
  laborData,
  referenceCountry,
  totalPopulation,
  onLaborDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: LaborEmploymentProps) {
  const [view, setView] = useState<"overview" | "detailed">("overview");
  const [editMode, setEditMode] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("sectors");

  function handleField<K extends keyof LaborEmploymentData>(
    field: K,
    value: number | any
  ) {
    const next = { ...laborData, [field]: value };
    if (field === "laborForceParticipationRate") {
      const wap = totalPopulation * 0.65;
      next.totalWorkforce = Math.round((value / 100) * wap);
    } else if (field === "unemploymentRate") {
      next.employmentRate = 100 - value;
    } else if (field === "employmentRate") {
      next.unemploymentRate = 100 - value;
    }
    onLaborDataChangeAction(next);
  }

  function handleNestedField(
    section: keyof LaborEmploymentData,
    field: string,
    value: number
  ) {
    const next = { ...laborData };
    if (typeof next[section] === 'object' && next[section] !== null) {
      (next[section] as any)[field] = value;
    }
    onLaborDataChangeAction(next);
  }

  // Derived calculations
  const wap = Math.round(totalPopulation * 0.65); // Working age population
  const lf = Math.round((laborData.laborForceParticipationRate / 100) * wap);
  const employed = Math.round((laborData.employmentRate / 100) * lf);
  const unemployed = lf - employed;

  function getEmploymentHealth() {
    if (laborData.unemploymentRate <= 4) {
      return { label: "Full Employment", color: "text-green-600", variant: "default" as const };
    }
    if (laborData.unemploymentRate <= 7) {
      return { label: "Healthy", color: "text-blue-600", variant: "secondary" as const };
    }
    if (laborData.unemploymentRate <= 12) {
      return { label: "Moderate Concern", color: "text-yellow-600", variant: "destructive" as const };
    }
    return { label: "High Unemployment", color: "text-red-600", variant: "destructive" as const };
  }

  function getLaborProductivityHealth() {
    const index = laborData.skillsAndProductivity?.laborProductivityIndex || 100;
    if (index >= 120) return { label: "Excellent", color: "text-green-600" };
    if (index >= 105) return { label: "Good", color: "text-blue-600" };
    if (index >= 95) return { label: "Average", color: "text-yellow-600" };
    return { label: "Below Average", color: "text-red-600" };
  }

  const health = getEmploymentHealth();
  const productivityHealth = getLaborProductivityHealth();

  // Chart data
  const sectorData = laborData.employmentBySector ? [
    { name: "Agriculture", value: laborData.employmentBySector.agriculture, fill: "#10b981" },
    { name: "Industry", value: laborData.employmentBySector.industry, fill: "#3b82f6" },
    { name: "Services", value: laborData.employmentBySector.services, fill: "#8b5cf6" },
  ] : [];

  const employmentTypeData = laborData.employmentByType ? [
    { name: "Full-time", value: laborData.employmentByType.fullTime, fill: "#059669" },
    { name: "Part-time", value: laborData.employmentByType.partTime, fill: "#0891b2" },
    { name: "Temporary", value: laborData.employmentByType.temporary, fill: "#7c3aed" },
    { name: "Self-employed", value: laborData.employmentByType.selfEmployed, fill: "#dc2626" },
    { name: "Informal", value: laborData.employmentByType.informal, fill: "#ea580c" },
  ] : [];

  const regionalComparisonData = laborData.regionalEmployment ? [
    {
      region: "Urban",
      participation: laborData.regionalEmployment.urban.participationRate,
      unemployment: laborData.regionalEmployment.urban.unemploymentRate,
      income: laborData.regionalEmployment.urban.averageIncome / 1000,
    },
    {
      region: "Rural", 
      participation: laborData.regionalEmployment.rural.participationRate,
      unemployment: laborData.regionalEmployment.rural.unemploymentRate,
      income: laborData.regionalEmployment.rural.averageIncome / 1000,
    },
  ] : [];

  const basicMetrics = [
    {
      label: "Participation Rate",
      field: "laborForceParticipationRate" as const,
      value: laborData.laborForceParticipationRate,
      target: 65,
      reverse: false,
      description: "% of working-age population",
      icon: Users,
    },
    {
      label: "Employment Rate",
      field: "employmentRate" as const,
      value: laborData.employmentRate,
      target: 95,
      reverse: false,
      description: "% of labor force employed",
      icon: Briefcase,
    },
    {
      label: "Unemployment Rate",
      field: "unemploymentRate" as const,
      value: laborData.unemploymentRate,
      target: 5,
      reverse: true,
      description: "% seeking work",
      icon: AlertTriangle,
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Labor & Employment
            </h3>
            <p className="text-sm text-muted-foreground">
              Comprehensive workforce and employment analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Eye className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="grid grid-cols-2 w-[200px]">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="detailed">Detailed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Health Status */}
        <Alert className={`border-l-4 ${health.color === 'text-green-600' ? 'border-l-green-500' : 
                                      health.color === 'text-blue-600' ? 'border-l-blue-500' :
                                      health.color === 'text-yellow-600' ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
          <Briefcase className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Labor Market Health: <span className={`font-semibold ${health.color}`}>{health.label}</span>
              {laborData.skillsAndProductivity && (
                <span className="ml-4">
                  Productivity: <span className={`font-semibold ${productivityHealth.color}`}>{productivityHealth.label}</span>
                </span>
              )}
            </span>
            <Badge variant={health.variant}>{formatPercentage(laborData.unemploymentRate)} Unemployed</Badge>
          </AlertDescription>
        </Alert>

        {/* Labor Force Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Labor Force Breakdown
            </CardTitle>
            <CardDescription>Population and workforce distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 text-center gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {formatPopulation(totalPopulation)}
                </div>
                <div className="text-xs text-muted-foreground">Total Population</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPopulation(wap)}
                </div>
                <div className="text-xs text-muted-foreground">Working Age (65%)</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">
                  {formatPopulation(lf)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Labor Force ({formatPercentage(laborData.laborForceParticipationRate)})
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
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

        {/* Overview Tab */}
        {view === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {basicMetrics.map((metric) => {
                const Icon = metric.icon;
                const progress = metric.reverse
                  ? Math.max(0, 100 - (metric.value / metric.target) * 100)
                  : Math.min(100, (metric.value / metric.target) * 100);
                
                return (
                  <Card key={metric.field}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{metric.label}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{metric.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">
                            {formatPercentage(metric.value)}
                          </span>
                          {editMode ? (
                            <Input
                              type="number"
                              value={metric.value}
                              onChange={(e) => handleField(metric.field, parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 text-right"
                              step="0.1"
                              min="0"
                              max="100"
                            />
                          ) : (
                            <Badge variant={progress >= 80 ? "default" : progress >= 60 ? "secondary" : "destructive"}>
                              {progress >= 80 ? "Good" : progress >= 60 ? "Fair" : "Poor"}
                            </Badge>
                          )}
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          Target: {formatPercentage(metric.target)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Additional Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                  <div className="text-lg font-bold">
                    {laborData.averageWorkweekHours}h
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Work Week</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <div className="text-lg font-bold">
                    {formatCurrency(laborData.minimumWage)}
                  </div>
                  <div className="text-xs text-muted-foreground">Minimum Wage</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-lg font-bold">
                    {formatCurrency(laborData.averageAnnualIncome)}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Annual Income</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <div className="text-lg font-bold">
                    {formatPopulation(laborData.totalWorkforce)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Workforce</div>
                </CardContent>
              </Card>
            </div>

            {showComparison && referenceCountry && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Comparison with {referenceCountry.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Unemployment Rate:</span>
                      <div className="space-x-2">
                        <span className="font-medium">{formatPercentage(laborData.unemploymentRate)}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span>{formatPercentage(referenceCountry.unemploymentRate)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Detailed Tab */}
        {view === "detailed" && (
          <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
            <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
              <TabsTrigger value="sectors">Sectors</TabsTrigger>
              <TabsTrigger value="types">Employment</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="regional">Regional</TabsTrigger>
              <TabsTrigger value="benefits">Benefits</TabsTrigger>
            </TabsList>

            {/* Employment by Sector */}
            <TabsContent value="sectors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="h-5 w-5 text-primary" />
                    Employment by Economic Sector
                  </CardTitle>
                  <CardDescription>
                    Distribution of workforce across major economic sectors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {sectorData.length > 0 && sectorData.map((sector, idx) => (
                        <div key={sector.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {sector.name === "Agriculture" && <Wheat className="h-4 w-4 text-green-600" />}
                              {sector.name === "Industry" && <Factory className="h-4 w-4 text-blue-600" />}
                              {sector.name === "Services" && <Building2 className="h-4 w-4 text-purple-600" />}
                              <span className="text-sm font-medium">{sector.name}</span>
                            </div>
                            {editMode ? (
                              <Input
                                type="number"
                                value={sector.value}
                                onChange={(e) => {
                                  const field = sector.name.toLowerCase() as keyof typeof laborData.employmentBySector;
                                  handleNestedField('employmentBySector', field, parseFloat(e.target.value) || 0);
                                }}
                                className="w-20 h-8 text-right"
                                step="0.1"
                                min="0"
                                max="100"
                              />
                            ) : (
                              <span className="text-sm font-bold">{formatPercentage(sector.value)}</span>
                            )}
                          </div>
                          <Progress value={sector.value} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {formatPopulation((sector.value / 100) * employed)} workers
                          </div>
                        </div>
                      ))}
                    </div>
                    {sectorData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={sectorData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}%`}
                            >
                              {sectorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Employment Types */}
            <TabsContent value="types" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Employment Types
                  </CardTitle>
                  <CardDescription>
                    Breakdown by employment arrangement and contract type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {employmentTypeData.length > 0 && employmentTypeData.map((type) => (
                        <div key={type.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{type.name}</span>
                            {editMode ? (
                              <Input
                                type="number"
                                value={type.value}
                                onChange={(e) => {
                                  const field = type.name.toLowerCase().replace('-', '') as keyof typeof laborData.employmentByType;
                                  handleNestedField('employmentByType', field, parseFloat(e.target.value) || 0);
                                }}
                                className="w-20 h-8 text-right"
                                step="0.1"
                                min="0"
                                max="100"
                              />
                            ) : (
                              <span className="text-sm font-bold">{formatPercentage(type.value)}</span>
                            )}
                          </div>
                          <Progress value={type.value} className="h-2" />
                        </div>
                      ))}
                    </div>
                    {employmentTypeData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={employmentTypeData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}%`}
                            >
                              {employmentTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Skills & Productivity */}
            <TabsContent value="skills" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Skills & Productivity
                  </CardTitle>
                  <CardDescription>
                    Education levels, skills development, and productivity metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {laborData.skillsAndProductivity && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Average Education Years</Label>
                        <div className="text-2xl font-bold">
                          {laborData.skillsAndProductivity.averageEducationYears} years
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Tertiary Education Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.skillsAndProductivity.tertiaryEducationRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Vocational Training Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.skillsAndProductivity.vocationalTrainingRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Skills Gap Index</Label>
                        <div className="text-2xl font-bold">
                          {laborData.skillsAndProductivity.skillsGapIndex}/100
                        </div>
                        <Progress value={laborData.skillsAndProductivity.skillsGapIndex} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <Label>Labor Productivity Index</Label>
                        <div className="text-2xl font-bold">
                          {laborData.skillsAndProductivity.laborProductivityIndex}
                        </div>
                        <div className="text-xs text-muted-foreground">Base: 100</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Productivity Growth</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.skillsAndProductivity.productivityGrowthRate)}
                        </div>
                        <div className="text-xs text-muted-foreground">Annual</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Demographics & Conditions */}
            <TabsContent value="demographics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Demographics & Working Conditions
                  </CardTitle>
                  <CardDescription>
                    Workforce demographics and workplace conditions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {laborData.demographicsAndConditions && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Youth Unemployment (15-24)</Label>
                        <div className="text-2xl font-bold text-red-600">
                          {formatPercentage(laborData.demographicsAndConditions.youthUnemploymentRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Female Participation Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.demographicsAndConditions.femaleParticipationRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Gender Pay Gap</Label>
                        <div className="text-2xl font-bold text-orange-600">
                          {formatPercentage(laborData.demographicsAndConditions.genderPayGap)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Unionization Rate</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.demographicsAndConditions.unionizationRate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Workplace Safety Index</Label>
                        <div className="text-2xl font-bold">
                          {laborData.demographicsAndConditions.workplaceSafetyIndex}/100
                        </div>
                        <Progress value={laborData.demographicsAndConditions.workplaceSafetyIndex} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <Label>Avg Commuting Time</Label>
                        <div className="text-2xl font-bold">
                          {laborData.demographicsAndConditions.averageCommutingTime} min
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Regional Analysis */}
            <TabsContent value="regional" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Regional Employment Analysis
                  </CardTitle>
                  <CardDescription>
                    Urban vs rural employment patterns and income distribution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {laborData.regionalEmployment && (
                    <div className="space-y-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={regionalComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="region" />
                            <YAxis />
                            <Bar dataKey="participation" name="Participation Rate %" fill="#3b82f6" />
                            <Bar dataKey="unemployment" name="Unemployment Rate %" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Urban Employment</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span>Participation Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(laborData.regionalEmployment.urban.participationRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Unemployment Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(laborData.regionalEmployment.urban.unemploymentRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Income:</span>
                              <span className="font-bold">
                                {formatCurrency(laborData.regionalEmployment.urban.averageIncome)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Rural Employment</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between">
                              <span>Participation Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(laborData.regionalEmployment.rural.participationRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Unemployment Rate:</span>
                              <span className="font-bold">
                                {formatPercentage(laborData.regionalEmployment.rural.unemploymentRate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Income:</span>
                              <span className="font-bold">
                                {formatCurrency(laborData.regionalEmployment.rural.averageIncome)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Protection & Benefits */}
            <TabsContent value="benefits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Social Protection & Benefits
                  </CardTitle>
                  <CardDescription>
                    Worker benefits, social insurance, and protection coverage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {laborData.socialProtection && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Unemployment Benefit Coverage</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.socialProtection.unemploymentBenefitCoverage)}
                        </div>
                        <div className="text-xs text-muted-foreground">of unemployed</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Pension Coverage</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.socialProtection.pensionCoverage)}
                        </div>
                        <div className="text-xs text-muted-foreground">of workforce</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Health Insurance Coverage</Label>
                        <div className="text-2xl font-bold">
                          {formatPercentage(laborData.socialProtection.healthInsuranceCoverage)}
                        </div>
                        <div className="text-xs text-muted-foreground">of workforce</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Sick Leave</Label>
                        <div className="text-2xl font-bold">
                          {laborData.socialProtection.paidSickLeaveDays} days
                        </div>
                        <div className="text-xs text-muted-foreground">average per year</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Vacation</Label>
                        <div className="text-2xl font-bold">
                          {laborData.socialProtection.paidVacationDays} days
                        </div>
                        <div className="text-xs text-muted-foreground">average per year</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Parental Leave</Label>
                        <div className="text-2xl font-bold">
                          {laborData.socialProtection.parentalLeaveWeeks} weeks
                        </div>
                        <div className="text-xs text-muted-foreground">available</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  );
}