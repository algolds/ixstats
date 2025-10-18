// src/app/countries/_components/economy/Demographics.tsx
"use client";

import React, { useState } from "react";
import {
  Users,
  MapPin,
  GraduationCap,
  Heart,
  Baby,
  UserCheck,
  Building2,
  Home,
  Info,
  BarChart3,
  Globe,
  Layers,
  Eye,
  Pencil,
  HelpCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
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
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { formatPopulation, formatPercentage } from "./utils";
import type { DemographicsData } from "~/types/economics";

export interface RealCountryData {
  name: string;
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanizationRate?: number;
  populationGrowthRate?: number;
}

interface DemographicsProps {
  demographicData: DemographicsData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  /** SERVER ACTION */
  onDemographicDataChangeAction: (data: DemographicsData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

export function Demographics({
  demographicData,
  referenceCountry,
  totalPopulation,
  onDemographicDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: DemographicsProps) {
  const [view, setView] = useState<"overview" | "detailed">("overview");
  const [editMode, setEditMode] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("age");

  // Handler functions following Labor module pattern
  function handleField<K extends keyof DemographicsData>(
    field: K,
    value: number | any
  ) {
    const next = { ...demographicData, [field]: value };
    onDemographicDataChangeAction(next);
  }

  function handleNestedField(
    section: keyof DemographicsData,
    field: string,
    value: number
  ) {
    const next = { ...demographicData };
    if (typeof next[section] === 'object' && next[section] !== null) {
      (next[section] as any)[field] = value;
    }
    onDemographicDataChangeAction(next);
  }

  function handleUrbanRuralChange(urbanPercent: number) {
    const next = {
      ...demographicData,
      urbanRuralSplit: {
        urban: urbanPercent,
        rural: 100 - urbanPercent,
      },
    };
    onDemographicDataChangeAction(next);
  }

  function handleAgeDistributionChange(index: number, percent: number) {
    const newAgeDistribution = [...(demographicData.ageDistribution ?? [])];
    if (newAgeDistribution[index]) {
      newAgeDistribution[index] = { ...newAgeDistribution[index], percent };

      // Normalize percentages to ensure they add up to 100
      const total = newAgeDistribution.reduce((sum, group) => sum + group.percent, 0);
      if (total !== 100 && total > 0) {
        const factor = 100 / total;
        newAgeDistribution.forEach(group => {
          group.percent = group.percent * factor;
        });
      }

      handleField('ageDistribution', newAgeDistribution);
    }
  }

  function handleEducationLevelChange(index: number, percent: number) {
    const newEducationLevels = [...(demographicData.educationLevels ?? [])];
    if (newEducationLevels[index]) {
      newEducationLevels[index] = { ...newEducationLevels[index], percent };
      
      // Normalize percentages
      const total = newEducationLevels.reduce((sum, level) => sum + level.percent, 0);
      if (total !== 100 && total > 0) {
        const factor = 100 / total;
        newEducationLevels.forEach(level => {
          level.percent = level.percent * factor;
        });
      }
      
      handleField('educationLevels', newEducationLevels);
    }
  }

  // Health assessment functions
  function getUrbanizationHealth() {
    const urbanPercent = demographicData.urbanRuralSplit?.urban ?? 0;
    if (urbanPercent >= 80) return { label: "Highly Urbanized", color: "text-purple-600", variant: "default" as const };
    if (urbanPercent >= 60) return { label: "Urbanized", color: "text-blue-600", variant: "secondary" as const };
    if (urbanPercent >= 40) return { label: "Moderately Urban", color: "text-green-600", variant: "default" as const };
    if (urbanPercent >= 20) return { label: "Rural Majority", color: "text-yellow-600", variant: "destructive" as const };
    return { label: "Highly Rural", color: "text-orange-600", variant: "destructive" as const };
  }

  function getLiteracyHealth() {
    const rate = demographicData.literacyRate ?? 0;
    if (rate >= 99) return { label: "Universal", color: "text-green-600", variant: "default" as const };
    if (rate >= 90) return { label: "Very High", color: "text-blue-600", variant: "secondary" as const };
    if (rate >= 70) return { label: "High", color: "text-yellow-600", variant: "default" as const };
    if (rate >= 50) return { label: "Moderate", color: "text-orange-600", variant: "destructive" as const };
    return { label: "Low", color: "text-red-600", variant: "destructive" as const };
  }

  function getLifeExpectancyHealth() {
    const expectancy = demographicData.lifeExpectancy ?? 0;
    if (expectancy >= 80) return { label: "Excellent", color: "text-green-600" };
    if (expectancy >= 75) return { label: "Good", color: "text-blue-600" };
    if (expectancy >= 70) return { label: "Fair", color: "text-yellow-600" };
    if (expectancy >= 60) return { label: "Poor", color: "text-orange-600" };
    return { label: "Critical", color: "text-red-600" };
  }

  function getDemographicHealth() {
    let score = 70;

    // Life expectancy factor
    const lifeExpectancy = demographicData.lifeExpectancy ?? 0;
    if (lifeExpectancy >= 80) score += 10;
    else if (lifeExpectancy >= 70) score += 5;
    else if (lifeExpectancy < 60) score -= 10;

    // Literacy factor
    const literacyRate = demographicData.literacyRate ?? 0;
    if (literacyRate >= 95) score += 10;
    else if (literacyRate >= 85) score += 5;
    else if (literacyRate < 70) score -= 10;

    // Age distribution balance
    const workingAge = demographicData.ageDistribution?.find(g => g.group.includes('16-64') || g.group.includes('15-64'))?.percent || 0;
    if (workingAge >= 60 && workingAge <= 70) score += 5;
    else if (workingAge < 50 || workingAge > 75) score -= 5;

    // Education factor
    const higherEd = demographicData.educationLevels?.find(l => l.level.toLowerCase().includes('higher'))?.percent || 0;
    if (higherEd >= 30) score += 5;
    else if (higherEd < 15) score -= 5;

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      label: score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 55 ? "Fair" : "Needs Attention",
      color: score >= 85 ? "text-green-600" : score >= 70 ? "text-blue-600" : score >= 55 ? "text-yellow-600" : "text-red-600"
    };
  }

  const urbanizationHealth = getUrbanizationHealth();
  const literacyHealth = getLiteracyHealth();
  const lifeExpectancyHealth = getLifeExpectancyHealth();
  const healthScore = getDemographicHealth();

  // Calculate derived metrics
  const calculatePopulationInGroup = (percent: number): number => {
    return Math.round(totalPopulation * (percent / 100));
  };

  // Prepare data for visualizations
  const ageData = (demographicData.ageDistribution ?? []).map((group, index) => ({
    ...group,
    value: group.percent,
    population: calculatePopulationInGroup(group.percent),
    color: group.color || COLORS[index % COLORS.length],
  }));

  const urbanRuralData = [
    { name: 'Urban', value: demographicData.urbanRuralSplit?.urban ?? 0, color: '#3b82f6' },
    { name: 'Rural', value: demographicData.urbanRuralSplit?.rural ?? 0, color: '#10b981' },
  ];

  const educationData = (demographicData.educationLevels ?? []).map((level, index) => ({
    ...level,
    value: level.percent,
    population: calculatePopulationInGroup(level.percent),
    color: level.color || COLORS[index % COLORS.length],
  }));

  const regionData = (demographicData.regions ?? []).map((region, index) => ({
    ...region,
    color: region.color || COLORS[index % COLORS.length],
    urbanPopulation: Math.round(region.population * (region.urbanPercent / 100)),
    ruralPopulation: Math.round(region.population * ((100 - region.urbanPercent) / 100)),
  }));

  const basicMetrics = [
    {
      label: "Life Expectancy",
      field: "lifeExpectancy" as const,
      value: demographicData.lifeExpectancy,
      target: 80,
      reverse: false,
      description: "Average life span in years",
      icon: Heart,
      format: (v: number | null) => v != null ? `${v.toFixed(1)} years` : 'N/A',
    },
    {
      label: "Literacy Rate",
      field: "literacyRate" as const,
      value: demographicData.literacyRate,
      target: 95,
      reverse: false,
      description: "% of population that can read/write",
      icon: GraduationCap,
      format: (v: number | null) => v != null ? formatPercentage(v) : 'N/A',
    },
    {
      label: "Urbanization",
      field: "urbanRuralSplit" as const,
      value: demographicData.urbanRuralSplit?.urban,
      target: 70,
      reverse: false,
      description: "% living in urban areas",
      icon: Building2,
      format: (v: number | null) => v != null ? formatPercentage(v) : 'N/A',
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Demographics
            </h3>
            <p className="text-sm text-muted-foreground">
              Population structure, education, and regional distribution
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
        <Alert className={`border-l-4 ${healthScore.color === 'text-green-600' ? 'border-l-green-500' : 
                                      healthScore.color === 'text-blue-600' ? 'border-l-blue-500' :
                                      healthScore.color === 'text-yellow-600' ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
          <Users className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Demographic Health: <span className={`font-semibold ${healthScore.color}`}>{healthScore.label}</span>
              <span className="ml-4">
                Life Expectancy: <span className={`font-semibold ${lifeExpectancyHealth.color}`}>{lifeExpectancyHealth.label}</span>
              </span>
            </span>
            <Badge variant={literacyHealth.variant}>
              {formatPercentage(demographicData.literacyRate ?? 0)} Literacy
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Population Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Population Overview
            </CardTitle>
            <CardDescription>Key demographic indicators and population structure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold">{formatPopulation(totalPopulation)}</div>
                <div className="text-xs text-muted-foreground">Total Population</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-red-600">{demographicData.lifeExpectancy?.toFixed(1) ?? 'N/A'}</div>
                <div className="text-xs text-muted-foreground">Life Expectancy</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-green-600">{demographicData.literacyRate?.toFixed(1) ?? 'N/A'}%</div>
                <div className="text-xs text-muted-foreground">Literacy Rate</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-purple-600">{demographicData.urbanRuralSplit?.urban?.toFixed(0) ?? 'N/A'}%</div>
                <div className="text-xs text-muted-foreground">Urban Population</div>
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
                const metricValue = metric.value ?? 0;
                const progress = metric.reverse
                  ? Math.max(0, 100 - (metricValue / metric.target) * 100)
                  : Math.min(100, (metricValue / metric.target) * 100);

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
                            {metric.format(metric.value)}
                          </span>
                          {editMode ? (
                            <Input
                              type="number"
                              value={metricValue}
                              onChange={(e) => {
                                if (metric.field === "urbanRuralSplit") {
                                  handleUrbanRuralChange(parseFloat(e.target.value) || 0);
                                } else {
                                  handleField(metric.field, parseFloat(e.target.value) || 0);
                                }
                              }}
                              className="w-20 h-8 text-right"
                              step={metric.field === "lifeExpectancy" ? "0.1" : "1"}
                              min="0"
                              max={metric.field === "lifeExpectancy" ? "120" : "100"}
                            />
                          ) : (
                            <Badge variant={progress >= 80 ? "default" : progress >= 60 ? "secondary" : "destructive"}>
                              {progress >= 80 ? "Good" : progress >= 60 ? "Fair" : "Poor"}
                            </Badge>
                          )}
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          Target: {metric.format(metric.target)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Age Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Age Distribution</CardTitle>
                  <CardDescription>Population breakdown by age groups</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ageData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ group, percent }: any) => `${group}: ${percent ? percent.toFixed(1) : '0'}%`}
                        >
                          {ageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Urban/Rural Split */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Urban/Rural Distribution</CardTitle>
                  <CardDescription>Population settlement patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={urbanRuralData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }: any) => `${name}: ${value ? value.toFixed(0) : '0'}%`}
                        >
                          {urbanRuralData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Demographic Health Score */}
            <Card>
              <CardHeader>
                <CardTitle>Demographic Health Score</CardTitle>
                <CardDescription>Overall assessment of demographic indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-3xl font-bold">{healthScore.score}/100</div>
                    <div className="text-sm text-muted-foreground">{healthScore.label}</div>
                  </div>
                  <div className="h-32 w-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" data={[{ value: healthScore.score, fill: healthScore.score >= 70 ? '#10b981' : '#f59e0b' }]}>
                        <RadialBar dataKey="value" cornerRadius={10} fill="#8884d8" />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Life Expectancy:</span>
                    <span className="font-medium">{(demographicData.lifeExpectancy ?? 0) >= 70 ? "✓" : "✗"} Good</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Literacy Rate:</span>
                    <span className="font-medium">{(demographicData.literacyRate ?? 0) >= 85 ? "✓" : "✗"} High</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Working Age Pop:</span>
                    <span className="font-medium">{ageData.find(a => a.group.includes('64'))?.percent || 0 >= 60 ? "✓" : "✗"} Balanced</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Higher Education:</span>
                    <span className="font-medium">{educationData.find(e => e.level.toLowerCase().includes('higher'))?.percent || 0 >= 20 ? "✓" : "✗"} Adequate</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparison with Reference Country */}
            {showComparison && referenceCountry && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Comparison with {referenceCountry.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {referenceCountry.lifeExpectancy && (
                      <div className="flex justify-between items-center text-sm">
                        <span>Life Expectancy:</span>
                        <div className="space-x-2">
                          <Badge variant="outline">{referenceCountry.lifeExpectancy?.toFixed(1) ?? 'N/A'} years</Badge>
                          <span>vs</span>
                          <Badge variant={(demographicData.lifeExpectancy ?? 0) >= (referenceCountry.lifeExpectancy ?? 0) ? "default" : "secondary"}>
                            {demographicData.lifeExpectancy?.toFixed(1) ?? 'N/A'} years
                          </Badge>
                        </div>
                      </div>
                    )}
                    {referenceCountry.literacyRate && (
                      <div className="flex justify-between items-center text-sm">
                        <span>Literacy Rate:</span>
                        <div className="space-x-2">
                          <Badge variant="outline">{formatPercentage(referenceCountry.literacyRate)}</Badge>
                          <span>vs</span>
                          <Badge variant={(demographicData.literacyRate ?? 0) >= (referenceCountry.literacyRate ?? 0) ? "default" : "secondary"}>
                            {formatPercentage(demographicData.literacyRate ?? 0)}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {referenceCountry.urbanizationRate && (
                      <div className="flex justify-between items-center text-sm">
                        <span>Urbanization Rate:</span>
                        <div className="space-x-2">
                          <Badge variant="outline">{formatPercentage(referenceCountry.urbanizationRate)}</Badge>
                          <span>vs</span>
                          <Badge variant={(demographicData.urbanRuralSplit?.urban ?? 0) >= (referenceCountry.urbanizationRate ?? 0) ? "default" : "secondary"}>
                            {formatPercentage(demographicData.urbanRuralSplit?.urban ?? 0)}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Detailed Tab */}
        {view === "detailed" && (
          <div className="space-y-6">
            <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="age">Age Structure</TabsTrigger>
                <TabsTrigger value="education">Education</TabsTrigger>
                <TabsTrigger value="geographic">Geographic</TabsTrigger>
                <TabsTrigger value="social">Social</TabsTrigger>
              </TabsList>

              <TabsContent value="age" className="space-y-4">
                {/* Detailed Age Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Age Structure Analysis</CardTitle>
                    <CardDescription>Detailed breakdown of population by age groups</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {ageData.map((group, index) => (
                        <div key={group.group} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }} />
                              <Label className="text-sm font-medium">{group.group} years</Label>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatPopulation(group.population)} people
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={group.percent} className="flex-1" />
                            <span className="text-sm font-medium w-12 text-right">{group.percent.toFixed(1)}%</span>
                          </div>
                          {editMode && (
                            <Input
                              type="number"
                              value={group.percent}
                              onChange={(e) => handleAgeDistributionChange(index, parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0"
                              max="100"
                              className="w-24"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Dependency Ratios */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <h5 className="text-sm font-semibold mb-3">Dependency Ratios</h5>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Youth Dependency</div>
                          <div className="font-medium">{(ageData.find(g => g.group.includes('0-15'))?.percent || 0).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Elderly Dependency</div>
                          <div className="font-medium">{(ageData.find(g => g.group.includes('65+'))?.percent || 0).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Dependency</div>
                          <div className="font-medium">
                            {((ageData.find(g => g.group.includes('0-15'))?.percent || 0) + 
                              (ageData.find(g => g.group.includes('65+'))?.percent || 0)).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Life Expectancy */}
                <Card>
                  <CardHeader>
                    <CardTitle>Life Expectancy</CardTitle>
                    <CardDescription>Average life span and health indicators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold">{demographicData.lifeExpectancy?.toFixed(1) ?? 'N/A'} years</div>
                          <div className="text-sm text-muted-foreground">Average life expectancy</div>
                        </div>
                        <Heart className="h-12 w-12 text-red-500 opacity-20" />
                      </div>

                      {editMode && (
                        <div>
                          <Label>Life Expectancy (years)</Label>
                          <Input
                            type="number"
                            value={demographicData.lifeExpectancy ?? 0}
                            onChange={(e) => handleField('lifeExpectancy', parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="40"
                            max="100"
                          />
                        </div>
                      )}

                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Life expectancy of {demographicData.lifeExpectancy?.toFixed(1) ?? 'N/A'} years indicates a
                          {(demographicData.lifeExpectancy ?? 0) >= 80 ? " highly developed healthcare system" :
                           (demographicData.lifeExpectancy ?? 0) >= 70 ? " moderately developed healthcare system" :
                           (demographicData.lifeExpectancy ?? 0) >= 60 ? " developing healthcare system" :
                           " healthcare system that needs significant investment"}.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="education" className="space-y-4">
                {/* Education Levels */}
                <Card>
                  <CardHeader>
                    <CardTitle>Education Levels</CardTitle>
                    <CardDescription>Population distribution by educational attainment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={educationData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ level, percent }: any) => `${level}: ${percent ? percent.toFixed(1) : '0'}%`}
                          >
                            {educationData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 space-y-3">
                      {educationData.map((level, index) => (
                        <div key={level.level} className="p-2 rounded bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: level.color }} />
                              <span className="text-sm">{level.level}</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">{level.percent.toFixed(1)}%</span>
                              <span className="text-muted-foreground ml-2">({formatPopulation(level.population)})</span>
                            </div>
                          </div>
                          {editMode && (
                            <Input
                              type="number"
                              value={level.percent}
                              onChange={(e) => handleEducationLevelChange(index, parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0"
                              max="100"
                              className="w-24"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Literacy Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle>Literacy & Education Access</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Literacy Rate</Label>
                        <Badge className={literacyHealth.color}>{literacyHealth.label}</Badge>
                      </div>
                      <Progress value={demographicData.literacyRate ?? 0} className="h-3" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0%</span>
                        <span className="font-medium">{demographicData.literacyRate?.toFixed(1) ?? 'N/A'}%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {editMode && (
                      <div>
                        <Label>Adjust Literacy Rate</Label>
                        <Input
                          type="number"
                          value={demographicData.literacyRate ?? 0}
                          onChange={(e) => handleField('literacyRate', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          min="0"
                          max="100"
                        />
                      </div>
                    )}

                    <Alert>
                      <GraduationCap className="h-4 w-4" />
                      <AlertDescription>
                        {(demographicData.literacyRate ?? 0) >= 95
                          ? "Near-universal literacy indicates excellent educational infrastructure."
                          : (demographicData.literacyRate ?? 0) >= 85
                          ? "High literacy rate shows good educational access for most citizens."
                          : (demographicData.literacyRate ?? 0) >= 70
                          ? "Moderate literacy suggests room for educational improvement."
                          : "Low literacy rate indicates significant educational challenges."}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="geographic" className="space-y-4">
                {/* Regional Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Regional Population Distribution</CardTitle>
                    <CardDescription>Population spread across different regions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={regionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip formatter={(value: number) => formatPopulation(value)} />
                          <Legend />
                          <Bar dataKey="population" name="Total Population" fill="#3b82f6" />
                          <Bar dataKey="urbanPopulation" name="Urban Population" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Regional Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {regionData.map((region, index) => (
                    <Card key={region.name}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <MapPin className="h-4 w-4" style={{ color: region.color }} />
                          {region.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Population</div>
                            <div className="font-medium">{formatPopulation(region.population)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Urban %</div>
                            <div className="font-medium">{region.urbanPercent.toFixed(0)}%</div>
                          </div>
                        </div>
                        <Progress value={(region.population / totalPopulation) * 100} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {((region.population / totalPopulation) * 100).toFixed(1)}% of total population
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Urban/Rural Controls */}
                {editMode && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Urbanization Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label>Urban Population Percentage</Label>
                          <div className="flex items-center gap-4">
                            <Slider
                              value={[demographicData.urbanRuralSplit?.urban ?? 50]}
                              onValueChange={([value]) => handleUrbanRuralChange(value ?? 0)}
                              max={100}
                              step={1}
                              className="flex-1"
                            />
                            <span className="w-16 text-right font-medium">
                              {demographicData.urbanRuralSplit?.urban?.toFixed(0) ?? 'N/A'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="social" className="space-y-4">
                {/* Citizenship Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Citizenship Status</CardTitle>
                    <CardDescription>Population by citizenship and residency status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {demographicData.citizenshipStatuses.map((status, index) => (
                        <div key={status.status} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" style={{ color: status.color || COLORS[index % COLORS.length] }} />
                              <span className="font-medium">{status.status}</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">{status.percent.toFixed(1)}%</span>
                              <span className="text-muted-foreground ml-2">
                                ({formatPopulation(calculatePopulationInGroup(status.percent))})
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Summary Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Demographic Summary</div>
            <p className="text-sm mt-1">
              Population of {formatPopulation(totalPopulation)} with {demographicData.lifeExpectancy?.toFixed(1) ?? 'N/A'} year life expectancy.
              {(demographicData.urbanRuralSplit?.urban ?? 0) > 70
                ? " Highly urbanized society"
                : (demographicData.urbanRuralSplit?.urban ?? 0) > 50
                ? " Moderately urban society"
                : " Predominantly rural society"}
              with {demographicData.literacyRate?.toFixed(1) ?? 'N/A'}% literacy rate.
              {(demographicData.educationLevels?.find(l => l.level.toLowerCase().includes('higher'))?.percent || 0) > 25
                ? " Well-educated population."
                : " Educational development opportunities exist."}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}