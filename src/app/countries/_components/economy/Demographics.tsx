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
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
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

interface DemographicsProps {
  demographicData: DemographicsData;
  totalPopulation: number;
  onDemographicDataChange?: (data: DemographicsData) => void;
  isReadOnly?: boolean;
  showAnalytics?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

export function Demographics({
  demographicData,
  totalPopulation,
  onDemographicDataChange,
  isReadOnly = true,
  showAnalytics = true,
}: DemographicsProps) {
  const [view, setView] = useState<"overview" | "age" | "geographic" | "social">("overview");

  const handleFieldChange = (field: keyof DemographicsData, value: any) => {
    if (isReadOnly || !onDemographicDataChange) return;
    
    onDemographicDataChange({
      ...demographicData,
      [field]: value,
    });
  };

  const handleUrbanRuralChange = (urbanPercent: number) => {
    if (isReadOnly || !onDemographicDataChange) return;
    
    onDemographicDataChange({
      ...demographicData,
      urbanRuralSplit: {
        urban: urbanPercent,
        rural: 100 - urbanPercent,
      },
    });
  };

  // Calculate derived metrics
  const calculatePopulationInGroup = (percent: number): number => {
    return Math.round(totalPopulation * (percent / 100));
  };

  const getUrbanizationLevel = (urbanPercent: number) => {
    if (urbanPercent >= 80) return { label: "Highly Urbanized", color: "text-purple-600" };
    if (urbanPercent >= 60) return { label: "Urbanized", color: "text-blue-600" };
    if (urbanPercent >= 40) return { label: "Moderately Urban", color: "text-green-600" };
    if (urbanPercent >= 20) return { label: "Rural Majority", color: "text-yellow-600" };
    return { label: "Highly Rural", color: "text-orange-600" };
  };

  const getLiteracyLevel = (rate: number) => {
    if (rate >= 99) return { label: "Universal", color: "text-green-600" };
    if (rate >= 90) return { label: "Very High", color: "text-blue-600" };
    if (rate >= 70) return { label: "High", color: "text-yellow-600" };
    if (rate >= 50) return { label: "Moderate", color: "text-orange-600" };
    return { label: "Low", color: "text-red-600" };
  };

  const urbanizationLevel = getUrbanizationLevel(demographicData.urbanRuralSplit.urban);
  const literacyLevel = getLiteracyLevel(demographicData.literacyRate);

  // Prepare data for visualizations
  const ageData = demographicData.ageDistribution.map((group, index) => ({
    ...group,
    value: group.percent,
    population: calculatePopulationInGroup(group.percent),
    color: group.color || COLORS[index % COLORS.length],
  }));

  const urbanRuralData = [
    { name: 'Urban', value: demographicData.urbanRuralSplit.urban, color: '#3b82f6' },
    { name: 'Rural', value: demographicData.urbanRuralSplit.rural, color: '#10b981' },
  ];

  const educationData = demographicData.educationLevels.map((level, index) => ({
    ...level,
    value: level.percent,
    population: calculatePopulationInGroup(level.percent),
    color: level.color || COLORS[index % COLORS.length],
  }));

  const regionData = demographicData.regions.map((region, index) => ({
    ...region,
    color: region.color || COLORS[index % COLORS.length],
    urbanPopulation: Math.round(region.population * (region.urbanPercent / 100)),
    ruralPopulation: Math.round(region.population * ((100 - region.urbanPercent) / 100)),
  }));

  // Calculate demographic health score
  const getDemographicHealth = () => {
    let score = 70;
    
    // Life expectancy factor
    if (demographicData.lifeExpectancy >= 80) score += 10;
    else if (demographicData.lifeExpectancy >= 70) score += 5;
    else if (demographicData.lifeExpectancy < 60) score -= 10;
    
    // Literacy factor
    if (demographicData.literacyRate >= 95) score += 10;
    else if (demographicData.literacyRate >= 85) score += 5;
    else if (demographicData.literacyRate < 70) score -= 10;
    
    // Age distribution balance
    const workingAge = demographicData.ageDistribution.find(g => g.group.includes('16-64') || g.group.includes('15-64'))?.percent || 0;
    if (workingAge >= 60 && workingAge <= 70) score += 5;
    else if (workingAge < 50 || workingAge > 75) score -= 5;
    
    // Education factor
    const higherEd = demographicData.educationLevels.find(l => l.level.toLowerCase().includes('higher'))?.percent || 0;
    if (higherEd >= 30) score += 5;
    else if (higherEd < 15) score -= 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const healthScore = getDemographicHealth();

  return (
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
        {showAnalytics && (
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="grid grid-cols-4 w-[400px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="age">Age Structure</TabsTrigger>
              <TabsTrigger value="geographic">Geographic</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-xs">Total</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatPopulation(totalPopulation)}</div>
              <div className="text-xs text-muted-foreground">Total Population</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Heart className="h-5 w-5 text-red-600" />
              <Badge variant="outline" className="text-xs">Years</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{demographicData.lifeExpectancy.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Life Expectancy</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <GraduationCap className="h-5 w-5 text-green-600" />
              <Badge className={`${literacyLevel.color} text-xs`}>
                {literacyLevel.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{demographicData.literacyRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Literacy Rate</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              <Badge className={`${urbanizationLevel.color} text-xs`}>
                {urbanizationLevel.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{demographicData.urbanRuralSplit.urban.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Urban Population</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Age Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Age Distribution</CardTitle>
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
                      label={({ group, percent }) => `${group}: ${percent.toFixed(1)}%`}
                    >
                      {ageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Urban/Rural Split */}
          <Card>
            <CardHeader>
              <CardTitle>Urban/Rural Distribution</CardTitle>
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
                      label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                    >
                      {urbanRuralData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demographic Health */}
        <Card>
          <CardHeader>
            <CardTitle>Demographic Health Score</CardTitle>
            <CardDescription>Overall assessment of demographic indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-3xl font-bold">{healthScore}/100</div>
                  <div className="text-sm text-muted-foreground">
                    {healthScore >= 85 ? "Excellent" :
                     healthScore >= 70 ? "Good" :
                     healthScore >= 55 ? "Fair" : "Needs Attention"}
                  </div>
                </div>
                <div className="h-32 w-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" data={[{ value: healthScore, fill: healthScore >= 70 ? '#10b981' : '#f59e0b' }]}>
                      <RadialBar dataKey="value" cornerRadius={10} fill="#8884d8" />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Life Expectancy:</span>
                  <span className="font-medium">{demographicData.lifeExpectancy >= 70 ? "✓" : "✗"} Good</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Literacy Rate:</span>
                  <span className="font-medium">{demographicData.literacyRate >= 85 ? "✓" : "✗"} High</span>
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="age" className="space-y-6">
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
                  {!isReadOnly && (
                    <Input
                      type="number"
                      value={group.percent}
                      onChange={(e) => {
                        const newAgeDistribution = [...demographicData.ageDistribution];
                        newAgeDistribution[index] = { ...group, percent: parseFloat(e.target.value) || 0 };
                        handleFieldChange('ageDistribution', newAgeDistribution);
                      }}
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
                  <div className="text-3xl font-bold">{demographicData.lifeExpectancy.toFixed(1)} years</div>
                  <div className="text-sm text-muted-foreground">Average life expectancy</div>
                </div>
                <Heart className="h-12 w-12 text-red-500 opacity-20" />
              </div>
              
              {!isReadOnly && (
                <div>
                  <Label>Life Expectancy (years)</Label>
                  <Input
                    type="number"
                    value={demographicData.lifeExpectancy}
                    onChange={(e) => handleFieldChange('lifeExpectancy', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="40"
                    max="100"
                  />
                </div>
              )}
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Life expectancy of {demographicData.lifeExpectancy.toFixed(1)} years indicates a 
                  {demographicData.lifeExpectancy >= 80 ? " highly developed healthcare system" :
                   demographicData.lifeExpectancy >= 70 ? " moderately developed healthcare system" :
                   demographicData.lifeExpectancy >= 60 ? " developing healthcare system" :
                   " healthcare system that needs significant investment"}.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="geographic" className="space-y-6">
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
                  <Tooltip formatter={(value: number) => formatPopulation(value)} />
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
        {!isReadOnly && (
          <Card>
            <CardHeader>
              <CardTitle>Urbanization Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Urban Population Percentage</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={demographicData.urbanRuralSplit.urban}
                      onChange={(e) => handleUrbanRuralChange(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-16 text-right font-medium">
                      {demographicData.urbanRuralSplit.urban.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="social" className="space-y-6">
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
                    label={({ level, percent }) => `${level}: ${percent.toFixed(1)}%`}
                  >
                    {educationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-3">
              {educationData.map((level) => (
                <div key={level.level} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: level.color }} />
                    <span className="text-sm">{level.level}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{level.percent.toFixed(1)}%</span>
                    <span className="text-muted-foreground ml-2">({formatPopulation(level.population)})</span>
                  </div>
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
                <Badge className={literacyLevel.color}>{literacyLevel.label}</Badge>
              </div>
              <Progress value={demographicData.literacyRate} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span className="font-medium">{demographicData.literacyRate.toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>

            {!isReadOnly && (
              <div>
                <Label>Adjust Literacy Rate</Label>
                <Input
                  type="number"
                  value={demographicData.literacyRate}
                  onChange={(e) => handleFieldChange('literacyRate', parseFloat(e.target.value) || 0)}
                  step="0.1"
                  min="0"
                  max="100"
                />
              </div>
            )}

            <Alert>
              <GraduationCap className="h-4 w-4" />
              <AlertDescription>
                {demographicData.literacyRate >= 95 
                  ? "Near-universal literacy indicates excellent educational infrastructure."
                  : demographicData.literacyRate >= 85
                  ? "High literacy rate shows good educational access for most citizens."
                  : demographicData.literacyRate >= 70
                  ? "Moderate literacy suggests room for educational improvement."
                  : "Low literacy rate indicates significant educational challenges."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

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

      {/* Summary Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">Demographic Summary</div>
          <p className="text-sm mt-1">
            Population of {formatPopulation(totalPopulation)} with {demographicData.lifeExpectancy.toFixed(1)} year life expectancy.
            {demographicData.urbanRuralSplit.urban > 70 
              ? " Highly urbanized society"
              : demographicData.urbanRuralSplit.urban > 50
              ? " Moderately urban society"
              : " Predominantly rural society"}
            with {demographicData.literacyRate.toFixed(1)}% literacy rate.
            {demographicData.educationLevels.find(l => l.level.toLowerCase().includes('higher'))?.percent || 0 > 25
              ? " Well-educated population."
              : " Educational development opportunities exist."}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}