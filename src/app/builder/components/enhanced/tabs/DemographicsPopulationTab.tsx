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
  Heart, 
  GraduationCap, 
  Building2, 
  Globe,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  PieChart,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Plus,
  Minus,
  MapPin,
  Baby,
  UserCheck
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
  DemographicsConfiguration,
  RegionDistribution
} from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

interface DemographicsPopulationTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

export function DemographicsPopulationTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false
}: DemographicsPopulationTabProps) {
  const [activeSection, setActiveSection] = useState<'population' | 'age' | 'geographic' | 'social'>('population');
  const [editingRegion, setEditingRegion] = useState<string | null>(null);

  // Calculate demographic impacts from atomic components
  const demographicImpacts = useMemo(() => {
    return selectedComponents.reduce((sum, compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      // For now, return neutral impacts - this could be expanded
      return {
        populationGrowth: sum.populationGrowth * 1.0,
        lifeExpectancy: sum.lifeExpectancy * 1.0,
        literacyRate: sum.literacyRate * 1.0,
        urbanization: sum.urbanization * 1.0
      };
    }, { populationGrowth: 1.0, lifeExpectancy: 1.0, literacyRate: 1.0, urbanization: 1.0 });
  }, [selectedComponents]);

  // Handle demographics changes
  const handleDemographicsChange = (field: keyof DemographicsConfiguration, value: any) => {
    const updatedDemographics = {
      ...economyBuilder.demographics,
      [field]: value
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: updatedDemographics
    });
  };

  // Handle nested object changes
  const handleNestedDemographicsChange = (parentField: keyof DemographicsConfiguration, field: string, value: any) => {
    const updatedDemographics = {
      ...economyBuilder.demographics,
      [parentField]: {
        ...(economyBuilder.demographics[parentField] as any),
        [field]: value
      }
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: updatedDemographics
    });
  };

  // Handle region changes
  const handleRegionChange = (regionIndex: number, field: keyof RegionDistribution, value: any) => {
    const updatedRegions = economyBuilder.demographics.regions.map((region, index) => {
      if (index === regionIndex) {
        return { ...region, [field]: value };
      }
      return region;
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: {
        ...economyBuilder.demographics,
        regions: updatedRegions
      }
    });
  };

  // Add new region
  const addRegion = () => {
    const regionNumber = economyBuilder.demographics.regions.length + 1;
    const newRegion: RegionDistribution = {
      name: `New Region ${regionNumber}`,
      population: Math.round(economyBuilder.demographics.totalPopulation * 0.1),
      populationPercent: 10,
      urbanPercent: 60,
      economicActivity: 10,
      developmentLevel: 'Developing'
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: {
        ...economyBuilder.demographics,
        regions: [...economyBuilder.demographics.regions, newRegion]
      }
    });
    // Automatically select the newly added region for editing
    setEditingRegion(economyBuilder.demographics.regions.length.toString());
  };

  // Remove region
  const removeRegion = (index: number) => {
    const updatedRegions = economyBuilder.demographics.regions.filter((_, i) => i !== index);
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: {
        ...economyBuilder.demographics,
        regions: updatedRegions
      }
    });
  };

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const demo = economyBuilder.demographics;
    const totalPop = demo.totalPopulation;
    const workingAge = Math.round(totalPop * (demo.ageDistribution.age15to64 / 100));
    const youthPop = Math.round(totalPop * (demo.ageDistribution.under15 / 100));
    const elderlyPop = Math.round(totalPop * (demo.ageDistribution.over65 / 100));
    const urbanPop = Math.round(totalPop * (demo.urbanRuralSplit.urban / 100));
    const ruralPop = totalPop - urbanPop;
    
    return {
      workingAge,
      youthPop,
      elderlyPop,
      urbanPop,
      ruralPop,
      dependencyRatio: demo.totalDependencyRatio,
      workingAgeShare: demo.ageDistribution.age15to64,
      urbanShare: demo.urbanRuralSplit.urban
    };
  }, [economyBuilder.demographics]);

  // Prepare chart data
  const ageDistributionData = useMemo(() => {
    const ageDist = economyBuilder.demographics.ageDistribution;
    return [
      { name: 'Under 15', value: ageDist.under15, color: 'blue' },
      { name: '15-64', value: ageDist.age15to64, color: 'green' },
      { name: '65+', value: ageDist.over65, color: 'orange' }
    ];
  }, [economyBuilder.demographics.ageDistribution]);

  const urbanRuralData = useMemo(() => {
    const urbanRural = economyBuilder.demographics.urbanRuralSplit;
    return [
      { name: 'Urban', value: urbanRural.urban, color: 'blue' },
      { name: 'Rural', value: urbanRural.rural, color: 'green' }
    ];
  }, [economyBuilder.demographics.urbanRuralSplit]);

  const educationLevelData = useMemo(() => {
    const education = economyBuilder.demographics.educationLevels;
    return [
      { name: 'No Education', value: education.noEducation, color: 'red' },
      { name: 'Primary', value: education.primary, color: 'orange' },
      { name: 'Secondary', value: education.secondary, color: 'yellow' },
      { name: 'Tertiary', value: education.tertiary, color: 'green' }
    ];
  }, [economyBuilder.demographics.educationLevels]);

  const regionData = useMemo(() => {
    return economyBuilder.demographics.regions.map((region, index) => ({
      name: region.name,
      value: region.population,
      color: getRegionColor(index)
    }));
  }, [economyBuilder.demographics.regions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Demographics & Population Configuration</h2>
          <p className="text-muted-foreground">
            Configure population structure, geographic distribution, and social indicators
          </p>
        </div>
      </div>

      {/* Component Impact Display */}
      {(demographicImpacts.populationGrowth !== 1 || demographicImpacts.lifeExpectancy !== 1 || 
        demographicImpacts.literacyRate !== 1 || demographicImpacts.urbanization !== 1) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center space-x-4">
              <span>Atomic Component Impact:</span>
              {demographicImpacts.populationGrowth !== 1 && (
                <Badge variant={demographicImpacts.populationGrowth > 1 ? "default" : "secondary"}>
                  Population Growth: {((demographicImpacts.populationGrowth - 1) * 100).toFixed(1)}%
                </Badge>
              )}
              {demographicImpacts.lifeExpectancy !== 1 && (
                <Badge variant={demographicImpacts.lifeExpectancy > 1 ? "default" : "secondary"}>
                  Life Expectancy: {((demographicImpacts.lifeExpectancy - 1) * 100).toFixed(1)}%
                </Badge>
              )}
              {demographicImpacts.literacyRate !== 1 && (
                <Badge variant={demographicImpacts.literacyRate > 1 ? "default" : "secondary"}>
                  Literacy: {((demographicImpacts.literacyRate - 1) * 100).toFixed(1)}%
                </Badge>
              )}
              {demographicImpacts.urbanization !== 1 && (
                <Badge variant={demographicImpacts.urbanization > 1 ? "default" : "secondary"}>
                  Urbanization: {((demographicImpacts.urbanization - 1) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Population"
          value={derivedMetrics.workingAge + derivedMetrics.youthPop + derivedMetrics.elderlyPop}
          icon={Users}
          sectionId="demographics"
          trend="neutral"
        />
        <MetricCard
          label="Working Age (15-64)"
          value={`${derivedMetrics.workingAgeShare.toFixed(1)}%`}
          icon={UserCheck}
          sectionId="demographics"
          trend={derivedMetrics.workingAgeShare > 65 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Life Expectancy"
          value={`${economyBuilder.demographics.lifeExpectancy.toFixed(1)} years`}
          icon={Heart}
          sectionId="demographics"
          trend={economyBuilder.demographics.lifeExpectancy > 75 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Urban Population"
          value={`${derivedMetrics.urbanShare.toFixed(1)}%`}
          icon={Building2}
          sectionId="demographics"
          trend={derivedMetrics.urbanShare > 70 ? 'up' : 'neutral'}
        />
      </div>

      {/* Section Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {[
          { id: 'population', label: 'Population', icon: Users },
          { id: 'age', label: 'Age Structure', icon: Baby },
          { id: 'geographic', label: 'Geographic', icon: MapPin },
          { id: 'social', label: 'Social Indicators', icon: GraduationCap }
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
              {activeSection === 'population' && 'Population Structure'}
              {activeSection === 'age' && 'Age Distribution'}
              {activeSection === 'geographic' && 'Geographic Distribution'}
              {activeSection === 'social' && 'Social Indicators'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeSection === 'population' && (
              <div className="space-y-4">
                {/* Total Population - Read Only (set in National Symbols) */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Total Population</span>
                    </div>
                    <Badge variant="outline">From National Symbols</Badge>
                  </div>
                  <p className="text-2xl font-bold">{economyBuilder.demographics.totalPopulation.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Set in the National Symbols section</p>
                </div>

                {/* Population Growth Rate - Read Only (calculated) */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Population Growth Rate</span>
                    </div>
                    <Badge variant="outline">Calculated</Badge>
                  </div>
                  <p className="text-2xl font-bold">{economyBuilder.demographics.populationGrowthRate.toFixed(2)}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Based on birth/death rates and migration</p>
                </div>

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t">
                    <EnhancedSlider
                      label="Net Migration Rate"
                      description="Net migration per 1000 population"
                      value={economyBuilder.demographics.netMigrationRate}
                      onChange={(value) => handleDemographicsChange('netMigrationRate', value)}
                      min={-20}
                      max={20}
                      step={0.1}
                      unit="per 1000"
                      sectionId="demographics"
                      icon={Globe}
                      showValue={true}
                    />

                    <EnhancedSlider
                      label="Immigration Rate"
                      description="Immigration per 1000 population"
                      value={economyBuilder.demographics.immigrationRate}
                      onChange={(value) => handleDemographicsChange('immigrationRate', value)}
                      min={0}
                      max={50}
                      step={0.1}
                      unit="per 1000"
                      sectionId="demographics"
                      icon={TrendingUp}
                      showValue={true}
                    />

                    <EnhancedSlider
                      label="Emigration Rate"
                      description="Emigration per 1000 population"
                      value={economyBuilder.demographics.emigrationRate}
                      onChange={(value) => handleDemographicsChange('emigrationRate', value)}
                      min={0}
                      max={50}
                      step={0.1}
                      unit="per 1000"
                      sectionId="demographics"
                      icon={TrendingDown}
                      showValue={true}
                    />
                  </div>
                )}
              </div>
            )}

            {activeSection === 'age' && (
              <div className="space-y-4">
                <EnhancedSlider
                  label="Under 15 Years"
                  description="Percentage of population under 15"
                  value={economyBuilder.demographics.ageDistribution.under15}
                  onChange={(value) => handleNestedDemographicsChange('ageDistribution', 'under15', value)}
                  min={10}
                  max={50}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Baby}
                  showValue={true}
                />

                <EnhancedSlider
                  label="Working Age (15-64)"
                  description="Percentage of population aged 15-64"
                  value={economyBuilder.demographics.ageDistribution.age15to64}
                  onChange={(value) => handleNestedDemographicsChange('ageDistribution', 'age15to64', value)}
                  min={40}
                  max={80}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={UserCheck}
                  showValue={true}
                />

                <EnhancedSlider
                  label="Over 65 Years"
                  description="Percentage of population over 65"
                  value={economyBuilder.demographics.ageDistribution.over65}
                  onChange={(value) => handleNestedDemographicsChange('ageDistribution', 'over65', value)}
                  min={5}
                  max={35}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Heart}
                  showValue={true}
                />

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Youth Dependency Ratio</span>
                          <span className="font-medium">{economyBuilder.demographics.youthDependencyRatio.toFixed(1)}</span>
                        </div>
                        <Progress value={economyBuilder.demographics.youthDependencyRatio / 100} className="h-2" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Elderly Dependency Ratio</span>
                          <span className="font-medium">{economyBuilder.demographics.elderlyDependencyRatio.toFixed(1)}</span>
                        </div>
                        <Progress value={economyBuilder.demographics.elderlyDependencyRatio / 100} className="h-2" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'geographic' && (
              <div className="space-y-4">
                <EnhancedSlider
                  label="Urban Population"
                  description="Percentage living in urban areas"
                  value={economyBuilder.demographics.urbanRuralSplit.urban}
                  onChange={(value) => handleNestedDemographicsChange('urbanRuralSplit', 'urban', value)}
                  min={20}
                  max={95}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Building2}
                  showValue={true}
                />

                <EnhancedSlider
                  label="Rural Population"
                  description="Percentage living in rural areas"
                  value={economyBuilder.demographics.urbanRuralSplit.rural}
                  onChange={(value) => handleNestedDemographicsChange('urbanRuralSplit', 'rural', value)}
                  min={5}
                  max={80}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={MapPin}
                  showValue={true}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Regional Distribution</h4>
                    <Button size="sm" variant="outline" onClick={addRegion}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Region
                    </Button>
                  </div>

                  {economyBuilder.demographics.regions.map((region, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg border ${
                        editingRegion === index.toString() ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{region.developmentLevel}</Badge>
                          <span className="font-medium">{region.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRegion(editingRegion === index.toString() ? null : index.toString())}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRegion(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Population: {region.population.toLocaleString()}</div>
                        <div>Urban: {region.urbanPercent}%</div>
                        <div>Economic Activity: {region.economicActivity}%</div>
                        <div>Share: {region.populationPercent}%</div>
                      </div>

                      {editingRegion === index.toString() && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t space-y-2"
                        >
                          {/* Region Name Input */}
                          <div className="space-y-1">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Region Name
                            </label>
                            <input
                              type="text"
                              value={region.name}
                              onChange={(e) => handleRegionChange(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Enter region name"
                            />
                          </div>

                          <EnhancedSlider
                            label="Population Percent"
                            value={region.populationPercent}
                            onChange={(value) => handleRegionChange(index, 'populationPercent', value)}
                            min={1}
                            max={80}
                            step={0.1}
                            unit="%"
                            sectionId="demographics"
                            icon={Users}
                            showValue={true}
                          />
                          <EnhancedSlider
                            label="Urban Percent"
                            value={region.urbanPercent}
                            onChange={(value) => handleRegionChange(index, 'urbanPercent', value)}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            sectionId="demographics"
                            icon={Building2}
                            showValue={true}
                          />
                          <EnhancedSlider
                            label="Economic Activity"
                            value={region.economicActivity}
                            onChange={(value) => handleRegionChange(index, 'economicActivity', value)}
                            min={1}
                            max={50}
                            step={0.1}
                            unit="%"
                            sectionId="demographics"
                            icon={Target}
                            showValue={true}
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'social' && (
              <div className="space-y-4">
                <EnhancedSlider
                  label="Life Expectancy"
                  description="Average life expectancy at birth"
                  value={economyBuilder.demographics.lifeExpectancy}
                  onChange={(value) => handleDemographicsChange('lifeExpectancy', value)}
                  min={40}
                  max={90}
                  step={0.1}
                  unit="years"
                  sectionId="demographics"
                  icon={Heart}
                  showValue={true}
                />

                <EnhancedSlider
                  label="Literacy Rate"
                  description="Percentage of literate adults"
                  value={economyBuilder.demographics.literacyRate}
                  onChange={(value) => handleDemographicsChange('literacyRate', value)}
                  min={30}
                  max={100}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={GraduationCap}
                  showValue={true}
                />

                <div className="space-y-3">
                  <h4 className="font-medium">Education Levels</h4>
                  <EnhancedSlider
                    label="No Education"
                    value={economyBuilder.demographics.educationLevels.noEducation}
                    onChange={(value) => handleNestedDemographicsChange('educationLevels', 'noEducation', value)}
                    min={0}
                    max={50}
                    step={0.1}
                    unit="%"
                    sectionId="demographics"
                    icon={GraduationCap}
                    showValue={true}
                  />
                  <EnhancedSlider
                    label="Primary Education"
                    value={economyBuilder.demographics.educationLevels.primary}
                    onChange={(value) => handleNestedDemographicsChange('educationLevels', 'primary', value)}
                    min={0}
                    max={60}
                    step={0.1}
                    unit="%"
                    sectionId="demographics"
                    icon={GraduationCap}
                    showValue={true}
                  />
                  <EnhancedSlider
                    label="Secondary Education"
                    value={economyBuilder.demographics.educationLevels.secondary}
                    onChange={(value) => handleNestedDemographicsChange('educationLevels', 'secondary', value)}
                    min={0}
                    max={70}
                    step={0.1}
                    unit="%"
                    sectionId="demographics"
                    icon={GraduationCap}
                    showValue={true}
                  />
                  <EnhancedSlider
                    label="Tertiary Education"
                    value={economyBuilder.demographics.educationLevels.tertiary}
                    onChange={(value) => handleNestedDemographicsChange('educationLevels', 'tertiary', value)}
                    min={0}
                    max={50}
                    step={0.1}
                    unit="%"
                    sectionId="demographics"
                    icon={GraduationCap}
                    showValue={true}
                  />
                </div>

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t">
                    <EnhancedNumberInput
                      label="Infant Mortality Rate"
                      description="Deaths per 1000 live births"
                      value={economyBuilder.demographics.infantMortalityRate}
                      onChange={(value) => handleDemographicsChange('infantMortalityRate', value)}
                      min={0}
                      max={100}
                      step={0.1}
                      sectionId="demographics"
                      icon={Baby}
                      showButtons={true}
                    />

                    <EnhancedNumberInput
                      label="Maternal Mortality Rate"
                      description="Deaths per 100,000 live births"
                      value={economyBuilder.demographics.maternalMortalityRate}
                      onChange={(value) => handleDemographicsChange('maternalMortalityRate', value)}
                      min={0}
                      max={1000}
                      step={1}
                      sectionId="demographics"
                      icon={Heart}
                      showButtons={true}
                    />

                    <EnhancedSlider
                      label="Health Expenditure (GDP %)"
                      description="Health spending as percentage of GDP"
                      value={economyBuilder.demographics.healthExpenditureGDP}
                      onChange={(value) => handleDemographicsChange('healthExpenditureGDP', value)}
                      min={1}
                      max={20}
                      step={0.1}
                      unit="%"
                      sectionId="demographics"
                      icon={Heart}
                      showValue={true}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visualizations */}
        <div className="space-y-6">
          {/* Age Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>Age Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassPieChart
                data={ageDistributionData}
                dataKey="value"
                nameKey="name"
                height={300}
              colors={DEFAULT_CHART_COLORS}
              />
            </CardContent>
          </Card>

          {/* Urban-Rural Split */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Urban-Rural Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassBarChart
                data={urbanRuralData}
                xKey="name"
                yKey="value"
                height={200}
              colors={DEFAULT_CHART_COLORS}
                valueFormatter={(value) => `${value.toFixed(1)}%`}
              />
            </CardContent>
          </Card>

          {/* Education Levels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Education Levels</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassBarChart
                data={educationLevelData}
                xKey="name"
                yKey="value"
                height={250}
              colors={DEFAULT_CHART_COLORS}
                valueFormatter={(value) => `${value.toFixed(1)}%`}
              />
            </CardContent>
          </Card>

          {/* Regional Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Regional Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GlassPieChart
                data={regionData}
                dataKey="value"
                nameKey="name"
                height={250}
              colors={DEFAULT_CHART_COLORS}
              />
            </CardContent>
          </Card>

          {/* Demographics Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gauge className="h-5 w-5" />
                <span>Demographics Health</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Life Expectancy</span>
                    <span className="font-medium">{economyBuilder.demographics.lifeExpectancy.toFixed(1)} years</span>
                  </div>
                  <Progress value={economyBuilder.demographics.lifeExpectancy / 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Literacy Rate</span>
                    <span className="font-medium">{economyBuilder.demographics.literacyRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={economyBuilder.demographics.literacyRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Urbanization</span>
                    <span className="font-medium">{economyBuilder.demographics.urbanRuralSplit.urban.toFixed(1)}%</span>
                  </div>
                  <Progress value={economyBuilder.demographics.urbanRuralSplit.urban} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Working Age Share</span>
                    <span className="font-medium">{economyBuilder.demographics.ageDistribution.age15to64.toFixed(1)}%</span>
                  </div>
                  <Progress value={economyBuilder.demographics.ageDistribution.age15to64} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper function for region colors
function getRegionColor(index: number): string {
  const colors = ['blue', 'green', 'orange', 'purple', 'cyan', 'pink', 'yellow', 'red', 'indigo', 'teal'];
  return colors[index % colors.length];
}
