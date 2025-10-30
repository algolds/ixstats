"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Users, Heart, GraduationCap, Building2, UserCheck, Info, Baby, MapPin } from 'lucide-react';
import { MetricCard } from '../../../primitives/enhanced';
import type { EconomyBuilderState, DemographicsConfiguration, RegionDistribution } from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/lib/atomic-economic-data';
import { calculateDerivedDemographics, getRegionColor } from './utils/demographicsCalculations';
import { PopulationSection } from './demographics/PopulationSection';
import { AgeDistributionSection } from './demographics/AgeDistributionSection';
import { GeographicSection } from './demographics/GeographicSection';
import { SocialIndicatorsSection } from './demographics/SocialIndicatorsSection';
import { DemographicsVisualizations } from './demographics/DemographicsVisualizations';

const determineRegionDevelopmentLevel = (region: RegionDistribution): RegionDistribution['developmentLevel'] => {
  const activity = region.economicActivity ?? 0;
  const urban = region.urbanPercent ?? 0;

  if (activity >= 35 || urban >= 80) {
    return 'Advanced';
  }
  if (activity >= 25 || urban >= 70) {
    return 'Developed';
  }
  if (activity >= 15 || urban >= 55) {
    return 'Developing';
  }
  return 'Underdeveloped';
};

const clampToRange = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

/**
 * Props for the DemographicsPopulationTab component
 *
 * @interface DemographicsPopulationTabProps
 * @property {EconomyBuilderState} economyBuilder - Current state of the economy builder containing all demographic configurations
 * @property {function} onEconomyBuilderChange - Callback to update the economy builder state when demographic values change
 * @property {EconomicComponentType[]} selectedComponents - Array of selected atomic economic components that may affect demographics
 * @property {boolean} [showAdvanced=false] - Optional flag to show advanced demographic configuration options
 */
interface DemographicsPopulationTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

/**
 * DemographicsPopulationTab - Comprehensive demographic and population configuration interface for the economy builder
 *
 * This component provides a tabbed interface for configuring all aspects of a nation's demographic profile,
 * including population structure, age distribution, geographic distribution, and social indicators. It displays
 * real-time metrics, visualizations, and impact assessments from selected atomic economic components.
 *
 * The tab organizes demographic configuration into four main sections:
 * - Population: Total population, growth rates, and basic demographic structure
 * - Age Structure: Age distribution breakdowns (under 15, 15-64, 65+) with dependency ratios
 * - Geographic: Regional distribution, urban/rural split, and geographic population patterns
 * - Social Indicators: Life expectancy, literacy rates, education levels, and health metrics
 *
 * @component
 * @param {DemographicsPopulationTabProps} props - Component props
 * @param {EconomyBuilderState} props.economyBuilder - The current economy builder state containing demographic data
 * @param {function} props.onEconomyBuilderChange - Callback function to update economy builder state with demographic changes
 * @param {EconomicComponentType[]} props.selectedComponents - Array of selected atomic economic components that may impact demographics
 * @param {boolean} [props.showAdvanced=false] - Whether to display advanced configuration options
 *
 * @returns {JSX.Element} Rendered demographics configuration tab with metrics, forms, and visualizations
 *
 * @example
 * ```tsx
 * <DemographicsPopulationTab
 *   economyBuilder={economyBuilderState}
 *   onEconomyBuilderChange={handleEconomyChange}
 *   selectedComponents={['UNIVERSAL_HEALTHCARE', 'PUBLIC_EDUCATION']}
 *   showAdvanced={true}
 * />
 * ```
 */
export function DemographicsPopulationTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false
}: DemographicsPopulationTabProps) {
  const [activeSection, setActiveSection] = useState<'population' | 'age' | 'geographic' | 'social'>('population');

  // Calculate demographic impacts from atomic components
  const demographicImpacts = useMemo(() => {
    return selectedComponents.reduce((sum, compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      return {
        populationGrowth: sum.populationGrowth * 1.0,
        lifeExpectancy: sum.lifeExpectancy * 1.0,
        literacyRate: sum.literacyRate * 1.0,
        urbanization: sum.urbanization * 1.0
      };
    }, { populationGrowth: 1.0, lifeExpectancy: 1.0, literacyRate: 1.0, urbanization: 1.0 });
  }, [selectedComponents]);

  const handleDemographicsChange = (field: keyof DemographicsConfiguration, value: any) => {
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, [field]: value }
    });
  };

  const handleNestedDemographicsChange = (parentField: keyof DemographicsConfiguration, field: string, value: any) => {
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: {
        ...economyBuilder.demographics,
        [parentField]: { ...(economyBuilder.demographics[parentField] as any), [field]: value }
      }
    });
  };

  const handleRegionChange = (regionIndex: number, field: keyof RegionDistribution, value: any) => {
    const regionsCopy = economyBuilder.demographics.regions.map((region) => ({ ...region }));
    const targetRegion = regionsCopy[regionIndex];

    if (!targetRegion) {
      return;
    }

    let nextRegion = { ...targetRegion };

    switch (field) {
      case 'populationPercent': {
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
        const rounded = Math.round(clampToRange(Number.isNaN(numericValue) ? 0 : numericValue, 0, 100) * 10) / 10;

        const otherTotal = regionsCopy.reduce((sum, region, index) => (
          index === regionIndex ? sum : sum + (region.populationPercent ?? 0)
        ), 0);

        let adjusted = rounded;
        if (otherTotal + adjusted > 100) {
          adjusted = Math.max(0, 100 - otherTotal);
        }

        if (Math.abs(otherTotal + adjusted - 100) <= 0.5) {
          adjusted = Math.max(0, 100 - otherTotal);
        }

        adjusted = Math.round(adjusted * 10) / 10;
        if (otherTotal + adjusted > 100) {
          adjusted = Math.max(0, Math.round((100 - otherTotal) * 10) / 10);
        }

        nextRegion.populationPercent = adjusted;
        nextRegion.population = Math.round((economyBuilder.demographics.totalPopulation || 0) * (adjusted / 100));
        break;
      }
      case 'urbanPercent': {
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
        nextRegion.urbanPercent = Math.round(clampToRange(Number.isNaN(numericValue) ? 0 : numericValue, 0, 100));
        break;
      }
      case 'economicActivity': {
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
        nextRegion.economicActivity = Math.round(clampToRange(Number.isNaN(numericValue) ? 0 : numericValue, 0, 50));
        break;
      }
      default: {
        nextRegion = { ...nextRegion, [field]: value };
      }
    }

    regionsCopy[regionIndex] = {
      ...nextRegion,
      developmentLevel: determineRegionDevelopmentLevel(nextRegion),
    };

    const normalizedRegions = regionsCopy.map((region) => ({
      ...region,
      developmentLevel: determineRegionDevelopmentLevel(region),
    }));

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, regions: normalizedRegions }
    });
  };

  const addRegion = () => {
    const regionNumber = economyBuilder.demographics.regions.length + 1;
    const existingTotalPercent = economyBuilder.demographics.regions.reduce((sum, region) =>
      sum + (region.populationPercent ?? 0), 0);
    const remainingPercent = Math.max(0, 100 - existingTotalPercent);
    const allocatedPercent = remainingPercent > 0 ? Math.min(remainingPercent, 15) : 5;
    const populationPercent = Number(allocatedPercent.toFixed(1));
    const population = Math.round((economyBuilder.demographics.totalPopulation || 0) * (populationPercent / 100));

    const newRegion: RegionDistribution = {
      name: `New Region ${regionNumber}`,
      population,
      populationPercent,
      urbanPercent: 60,
      economicActivity: 18,
      developmentLevel: 'Developing'
    };
    newRegion.developmentLevel = determineRegionDevelopmentLevel(newRegion);
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, regions: [...economyBuilder.demographics.regions, newRegion] }
    });
  };

  const removeRegion = (index: number) => {
    const updatedRegions = economyBuilder.demographics.regions.filter((_, i) => i !== index);
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, regions: updatedRegions }
    });
  };

  const derivedMetrics = useMemo(() => calculateDerivedDemographics(economyBuilder.demographics), [economyBuilder.demographics]);

  const chartData = useMemo(() => ({
    ageDistributionData: [
      { name: 'Under 15', value: economyBuilder.demographics.ageDistribution.under15, color: 'blue' },
      { name: '15-64', value: economyBuilder.demographics.ageDistribution.age15to64, color: 'green' },
      { name: '65+', value: economyBuilder.demographics.ageDistribution.over65, color: 'orange' }
    ],
    urbanRuralData: [
      { name: 'Urban', value: economyBuilder.demographics.urbanRuralSplit.urban, color: 'blue' },
      { name: 'Rural', value: economyBuilder.demographics.urbanRuralSplit.rural, color: 'green' }
    ],
    educationLevelData: Object.entries(economyBuilder.demographics.educationLevels).map(([key, value]) => ({
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value,
      color: ['red', 'orange', 'yellow', 'green'][['noEducation', 'primary', 'secondary', 'tertiary'].indexOf(key)]
    })),
    regionData: economyBuilder.demographics.regions.map((region, index) => ({
      name: region.name,
      value: region.population,
      color: getRegionColor(index)
    }))
  }), [economyBuilder.demographics]);

  const hasComponentImpact = Object.values(demographicImpacts).some(v => v !== 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Demographics & Population Configuration</h2>
          <p className="text-muted-foreground">Configure population structure, geographic distribution, and social indicators</p>
        </div>
      </div>

      {hasComponentImpact && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center space-x-4">
              <span>Atomic Component Impact:</span>
              {Object.entries(demographicImpacts).map(([key, value]) => value !== 1 && (
                <Badge key={key} variant={value > 1 ? "default" : "secondary"}>
                  {key}: {((value - 1) * 100).toFixed(1)}%
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Total Population" value={derivedMetrics.workingAge + derivedMetrics.youthPop + derivedMetrics.elderlyPop} icon={Users} sectionId="demographics" trend="neutral" />
        <MetricCard label="Working Age (15-64)" value={`${derivedMetrics.workingAgeShare.toFixed(1)}%`} icon={UserCheck} sectionId="demographics" trend={derivedMetrics.workingAgeShare > 65 ? 'up' : 'neutral'} />
        <MetricCard label="Life Expectancy" value={`${economyBuilder.demographics.lifeExpectancy.toFixed(1)} years`} icon={Heart} sectionId="demographics" trend={economyBuilder.demographics.lifeExpectancy > 75 ? 'up' : 'neutral'} />
        <MetricCard label="Urban Population" value={`${derivedMetrics.urbanShare.toFixed(1)}%`} icon={Building2} sectionId="demographics" trend={derivedMetrics.urbanShare > 70 ? 'up' : 'neutral'} />
      </div>

      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {[
          { id: 'population', label: 'Population', icon: Users },
          { id: 'age', label: 'Age Structure', icon: Baby },
          { id: 'geographic', label: 'Geographic', icon: MapPin },
          { id: 'social', label: 'Social Indicators', icon: GraduationCap }
        ].map((section) => {
          const Icon = section.icon;
          return (
            <Button key={section.id} variant={activeSection === section.id ? "default" : "ghost"} size="sm" onClick={() => setActiveSection(section.id as any)} className="flex-1">
              <Icon className="h-4 w-4 mr-2" />
              {section.label}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            {activeSection === 'population' && <PopulationSection demographics={economyBuilder.demographics} onChange={handleDemographicsChange} showAdvanced={showAdvanced} />}
            {activeSection === 'age' && <AgeDistributionSection demographics={economyBuilder.demographics} onChange={handleNestedDemographicsChange} showAdvanced={showAdvanced} />}
            {activeSection === 'geographic' && <GeographicSection demographics={economyBuilder.demographics} onChange={handleNestedDemographicsChange} onRegionChange={handleRegionChange} onAddRegion={addRegion} onRemoveRegion={removeRegion} />}
            {activeSection === 'social' && <SocialIndicatorsSection demographics={economyBuilder.demographics} onChange={handleDemographicsChange} onNestedChange={handleNestedDemographicsChange} showAdvanced={showAdvanced} />}
          </CardContent>
        </Card>

        <DemographicsVisualizations demographics={economyBuilder.demographics} {...chartData} />
      </div>
    </div>
  );
}
