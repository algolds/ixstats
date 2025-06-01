// src/app/countries/_components/economy/Demographics.tsx
"use client";

import { useState } from "react";
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
  Globe,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export interface AgeGroup {
  group: string;
  percent: number;
  color: string;
}

export interface Region {
  name: string;
  population: number;
  urbanPercent: number;
  color: string;
}

export interface EducationLevel {
  level: string;
  percent: number;
  color: string;
}

export interface CitizenshipStatus {
  status: string;
  percent: number;
  color: string;
}

export interface DemographicData {
  ageDistribution: AgeGroup[];
  lifeExpectancy: number;
  urbanPopulationPercent: number;
  ruralPopulationPercent: number;
  regions: Region[];
  educationLevels: EducationLevel[];
  literacyRate: number;
  citizenshipStatuses: CitizenshipStatus[];
}

export interface RealCountryDemographicData {
  name: string;
  lifeExpectancy: number;
  urbanPercent: number;
  literacyRate: number;
}

interface DemographicsProps {
  demographicData: DemographicData;
  referenceCountry?: RealCountryDemographicData;
  totalPopulation: number;
  onDemographicDataChangeAction: (demographicData: DemographicData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function Demographics({
  demographicData,
  referenceCountry,
  totalPopulation,
  onDemographicDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: DemographicsProps) {
  const [selectedView, setSelectedView] = useState<'age' | 'geographic' | 'social'>('age');

  const handleAgeDistributionChange = (index: number, value: number) => {
    const newAgeGroups = [...demographicData.ageDistribution];
    
    // Calculate the total of all other percentages
    const totalOthers = newAgeGroups.reduce((sum, group, idx) => 
      idx !== index ? sum + group.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newAgeGroups[index]) {
      newAgeGroups[index] = {
        ...newAgeGroups[index],
        percent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedGroups = newAgeGroups.map((group, idx) => {
        if (idx === index) return group;
        
        const normalizedPercent = (group.percent / totalOthers) * remainingPercent;
        return {
          ...group,
          percent: normalizedPercent
        };
      });
      
      onDemographicDataChangeAction({
        ...demographicData,
        ageDistribution: normalizedGroups
      });
    }
  };

  const handleUrbanRuralSplitChange = (urbanPercent: number) => {
    onDemographicDataChangeAction({
      ...demographicData,
      urbanPopulationPercent: urbanPercent,
      ruralPopulationPercent: 100 - urbanPercent
    });
  };

  const handleEducationLevelChange = (index: number, value: number) => {
    const newLevels = [...demographicData.educationLevels];
    
    // Calculate the total of all other percentages
    const totalOthers = newLevels.reduce((sum, level, idx) => 
      idx !== index ? sum + level.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newLevels[index]) {
      newLevels[index] = {
        ...newLevels[index],
        percent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedLevels = newLevels.map((level, idx) => {
        if (idx === index) return level;
        
        const normalizedPercent = (level.percent / totalOthers) * remainingPercent;
        return {
          ...level,
          percent: normalizedPercent
        };
      });
      
      onDemographicDataChangeAction({
        ...demographicData,
        educationLevels: normalizedLevels
      });
    }
  };

  const handleInputChange = (field: keyof DemographicData, value: number) => {
    if (typeof value !== 'number') return;
    
    onDemographicDataChangeAction({
      ...demographicData,
      [field]: value
    });
  };

  const calculatePopulationInGroup = (percent: number): number => {
    return Math.round(totalPopulation * (percent / 100));
  };

  // Data for age distribution pie chart
  const ageData = demographicData.ageDistribution.map(group => ({
    name: group.group,
    value: group.percent,
    color: group.color,
    population: calculatePopulationInGroup(group.percent)
  }));

  // Data for urban/rural pie chart
  const urbanRuralData = [
    { name: 'Urban', value: demographicData.urbanPopulationPercent, color: '#4C51BF' },
    { name: 'Rural', value: demographicData.ruralPopulationPercent, color: '#68D391' }
  ];

  // Data for education levels pie chart
  const educationData = demographicData.educationLevels.map(level => ({
    name: level.level,
    value: level.percent,
    color: level.color
  }));

  // Population pyramid data (simplified)
  const generatePopulationPyramid = () => {
    const ageGroups = [
      { age: '0-14', male: 5, female: 5 },
      { age: '15-24', male: 6, female: 6 },
      { age: '25-34', male: 8, female: 8 },
      { age: '35-44', male: 7, female: 7 },
      { age: '45-54', male: 6, female: 6 },
      { age: '55-64', male: 5, female: 5 },
      { age: '65+', male: 3, female: 4 }
    ];
    
    // Adjust based on youth/elderly percentages
    const youthPercent = demographicData.ageDistribution.find(g => g.group === '0-15' || g.group === '0-14')?.percent || 20;
    const elderlyPercent = demographicData.ageDistribution.find(g => g.group === '65+')?.percent || 15;
    
    // Simple adjustment
    const youthFactor = youthPercent / 20;
    const elderlyFactor = elderlyPercent / 15;
    
    if (ageGroups[0]) {
      ageGroups[0].male *= youthFactor;
      ageGroups[0].female *= youthFactor;
    }
    if (ageGroups[6]) {
      ageGroups[6].male *= elderlyFactor;
      ageGroups[6].female *= elderlyFactor;
    }
    
    return ageGroups;
  };

  const populationPyramidData = generatePopulationPyramid();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Demographics
          </h3>
          <p className="text-sm text-muted-foreground">
            Population structure, education levels, and regional distribution
          </p>
        </div>
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="age">Age</TabsTrigger>
            <TabsTrigger value="geographic">Geographic</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Demographics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Population</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPopulation(totalPopulation)}</div>
            <p className="text-xs text-muted-foreground">
              Total population
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Life Expectancy</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographicData.lifeExpectancy.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Years
            </p>
            {referenceCountry && showComparison && (
              <p className="text-xs text-muted-foreground">
                Ref: {referenceCountry.lifeExpectancy.toFixed(1)} years
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Literacy Rate</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographicData.literacyRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Adult literacy
            </p>
            {referenceCountry && showComparison && (
              <p className="text-xs text-muted-foreground">
                Ref: {referenceCountry.literacyRate.toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <TabsContent value="age" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold mb-4">Age Distribution</h4>
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
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {ageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-semibold mb-4">Population Pyramid</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="horizontal"
                  data={populationPyramidData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="age" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="male" name="Male" fill="#3182CE" />
                  <Bar dataKey="female" name="Female" fill="#D53F8C" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {demographicData.ageDistribution.map((group, index) => (
                <Card key={group.group}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }}></div>
                        {group.group} Age Group
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        ~{formatPopulation(calculatePopulationInGroup(group.percent))}
                      </div>
                    </div>
                    {!isReadOnly && (
                      <>
                        <div className="px-3">
                          <Slider
                            value={[group.percent]}
                            onValueChange={(value) => handleAgeDistributionChange(index, value[0]!)}
                            max={50}
                            min={5}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>5%</span>
                          <span className="font-medium text-foreground">
                            {group.percent.toFixed(1)}%
                          </span>
                          <span>50%</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    Life Expectancy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isReadOnly && (
                    <div className="space-y-2">
                      <div className="px-3">
                        <Slider
                          value={[demographicData.lifeExpectancy]}
                          onValueChange={(value) => handleInputChange('lifeExpectancy', value[0]!)}
                          max={95}
                          min={50}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>50 years</span>
                        <span className="font-medium text-foreground">
                          {demographicData.lifeExpectancy.toFixed(1)} years
                        </span>
                        <span>95 years</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Dependency Ratios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Youth Dependency</div>
                      <div className="text-sm font-medium">
                        {(demographicData.ageDistribution.find(g => g.group === '0-15' || g.group === '0-14')?.percent || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Elderly Dependency</div>
                      <div className="text-sm font-medium">
                        {(demographicData.ageDistribution.find(g => g.group === '65+')?.percent || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Total Dependency Ratio</div>
                      <div className="text-sm font-medium">
                        {((demographicData.ageDistribution.find(g => g.group === '0-15' || g.group === '0-14')?.percent || 0) + 
                          (demographicData.ageDistribution.find(g => g.group === '65+')?.percent || 0)).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="geographic" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold mb-4">Urban/Rural Split</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={urbanRuralData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {urbanRuralData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Urbanization
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isReadOnly && (
                  <div className="space-y-2">
                    <Label>Urban Population (%)</Label>
                    <div className="px-3">
                      <Slider
                        value={[demographicData.urbanPopulationPercent]}
                        onValueChange={(value) => handleUrbanRuralSplitChange(value[0]!)}
                        max={100}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0% (Fully Rural)</span>
                      <span className="font-medium text-foreground">
                        {demographicData.urbanPopulationPercent.toFixed(1)}% Urban
                      </span>
                      <span>100% (Fully Urban)</span>
                    </div>
                  </div>
                )}
                {referenceCountry && showComparison && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Ref: {referenceCountry.urbanPercent.toFixed(1)}% urban
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Geographic Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Urban Areas:</span>
                    <span className="text-sm font-medium">
                      {formatPopulation(totalPopulation * (demographicData.urbanPopulationPercent / 100))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Rural Areas:</span>
                    <span className="text-sm font-medium">
                      {formatPopulation(totalPopulation * (demographicData.ruralPopulationPercent / 100))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="social" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold mb-4">Education Levels</h4>
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
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {educationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Literacy Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isReadOnly && (
                  <div className="space-y-2">
                    <div className="px-3">
                      <Slider
                        value={[demographicData.literacyRate]}
                        onValueChange={(value) => handleInputChange('literacyRate', value[0]!)}
                        max={100}
                        min={50}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50%</span>
                      <span className="font-medium text-foreground">
                        {demographicData.literacyRate.toFixed(1)}%
                      </span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Education Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {demographicData.educationLevels.map((level, index) => (
                    <div key={level.level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: level.color }}></div>
                        <span className="text-sm">{level.level}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {level.percent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <h5 className="text-md font-semibold">Education Level Distribution</h5>
          {demographicData.educationLevels.map((level, index) => (
            <Card key={level.level}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: level.color }}></div>
                    {level.level}
                  </Label>
                  <div className="text-sm text-muted-foreground">
                    ~{formatPopulation(calculatePopulationInGroup(level.percent))} people
                  </div>
                </div>
                {!isReadOnly && (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[level.percent]}
                        onValueChange={(value) => handleEducationLevelChange(index, value[0]!)}
                        max={60}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {level.percent.toFixed(1)}%
                      </span>
                      <span>60%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Demographic Analysis
          </div>
          <div className="text-sm">
            Your nation has a population of {formatPopulation(totalPopulation)} with a life expectancy of {demographicData.lifeExpectancy.toFixed(1)} years. 
            {demographicData.urbanPopulationPercent > 70 
              ? " It is highly urbanized"
              : demographicData.urbanPopulationPercent > 50
              ? " It has a moderate urban majority"
              : " It has a predominantly rural population"
            }, with {demographicData.urbanPopulationPercent.toFixed(1)}% of people living in urban areas. 
            The literacy rate is {demographicData.literacyRate.toFixed(1)}%, and 
            {demographicData.educationLevels.find(l => l.level === "Higher Education" || l.level === "University")?.percent || 0 > 25
              ? " a significant portion of the population has higher education."
              : " a smaller portion of the population has access to higher education."
            }
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}