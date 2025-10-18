"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { 
  Factory, 
  Leaf, 
  Users, 
  Zap, 
  DollarSign, 
  Building2,
  TrendingUp,
  TrendingDown,
  Target,
  Settings,
  Plus,
  Minus,
  BarChart3,
  PieChart,
  Globe,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

// Enhanced Components
import {
  EnhancedSlider,
  EnhancedNumberInput,
  EnhancedToggle,
  MetricCard
} from '../../../primitives/enhanced';
import { GlassBarChart, GlassPieChart } from '~/components/charts/RechartsIntegration';
import { getColorsFromData } from '~/lib/chart-colors';

// Types
import type { 
  EconomyBuilderState, 
  SectorConfiguration 
} from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

interface EconomySectorsTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

const SECTOR_TEMPLATES = {
  agriculture: {
    name: 'Agriculture',
    icon: Leaf,
    color: 'green',
    baseContribution: 5,
    description: 'Farming, forestry, fishing, and related activities',
    characteristics: ['Labor-intensive', 'Weather-dependent', 'Export potential']
  },
  manufacturing: {
    name: 'Manufacturing',
    icon: Factory,
    color: 'blue',
    baseContribution: 20,
    description: 'Production of goods and industrial processing',
    characteristics: ['Capital-intensive', 'Export-oriented', 'Technology-driven']
  },
  services: {
    name: 'Services',
    icon: Users,
    color: 'purple',
    baseContribution: 60,
    description: 'Professional, business, and consumer services',
    characteristics: ['Knowledge-based', 'Domestic-focused', 'High-value']
  },
  technology: {
    name: 'Technology',
    icon: Zap,
    color: 'cyan',
    baseContribution: 8,
    description: 'Information technology and digital services',
    characteristics: ['Innovation-driven', 'High-growth', 'Export potential']
  },
  finance: {
    name: 'Finance',
    icon: DollarSign,
    color: 'yellow',
    baseContribution: 5,
    description: 'Banking, insurance, and financial services',
    characteristics: ['Capital-intensive', 'Regulated', 'High-profit']
  },
  government: {
    name: 'Government',
    icon: Building2,
    color: 'gray',
    baseContribution: 2,
    description: 'Public administration and government services',
    characteristics: ['Public sector', 'Stable', 'Service-oriented']
  }
};

export function EconomySectorsTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false
}: EconomySectorsTabProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  // Calculate sector impacts from atomic components
  const sectorImpacts = useMemo(() => {
    const impacts: Record<string, number> = {};
    Object.keys(SECTOR_TEMPLATES).forEach(sectorId => {
      impacts[sectorId] = selectedComponents.reduce((sum, compType) => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        return sum + (component?.sectorImpact[sectorId] || 1);
      }, 0) / selectedComponents.length || 1;
    });
    return impacts;
  }, [selectedComponents]);

  // Calculate total GDP contribution
  const totalGDPContribution = useMemo(() => {
    return economyBuilder.sectors.reduce((sum, sector) => sum + sector.gdpContribution, 0);
  }, [economyBuilder.sectors]);

  // Calculate total employment share
  const totalEmploymentShare = useMemo(() => {
    return economyBuilder.sectors.reduce((sum, sector) => sum + sector.employmentShare, 0);
  }, [economyBuilder.sectors]);

  // Handle sector changes
  const handleSectorChange = (sectorId: string, field: keyof SectorConfiguration, value: any) => {
    const updatedSectors = economyBuilder.sectors.map(sector => {
      if (sector.id === sectorId) {
        return { ...sector, [field]: value };
      }
      return sector;
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors
    });
  };

  // Normalize sectors to sum to 100%
  const normalizeSectors = () => {
    const updatedSectors = economyBuilder.sectors.map(sector => {
      const normalizedContribution = (sector.gdpContribution / totalGDPContribution) * 100;
      const normalizedEmployment = (sector.employmentShare / totalEmploymentShare) * 100;
      
      return {
        ...sector,
        gdpContribution: normalizedContribution,
        employmentShare: normalizedEmployment
      };
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors
    });
  };

  // Add new sector
  const addSector = (sectorType: string) => {
    const template = SECTOR_TEMPLATES[sectorType as keyof typeof SECTOR_TEMPLATES];
    const newSector: SectorConfiguration = {
      id: `${sectorType}_${Date.now()}`,
      name: template.name,
      category: getSectorCategory(sectorType),
      gdpContribution: template.baseContribution,
      employmentShare: template.baseContribution,
      productivity: 75,
      growthRate: 2.0,
      exports: sectorType === 'manufacturing' ? 30 : sectorType === 'agriculture' ? 20 : 10,
      imports: sectorType === 'technology' ? 25 : 15,
      technologyLevel: 'Modern',
      automation: 20,
      regulation: 'Moderate',
      subsidy: sectorType === 'agriculture' ? 15 : 5,
      innovation: 50,
      sustainability: 70,
      competitiveness: 60
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: [...economyBuilder.sectors, newSector]
    });
  };

  // Remove sector
  const removeSector = (sectorId: string) => {
    const updatedSectors = economyBuilder.sectors.filter(sector => sector.id !== sectorId);
    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors
    });
  };

  const getSectorCategory = (sectorType: string): 'Primary' | 'Secondary' | 'Tertiary' => {
    if (['agriculture'].includes(sectorType)) return 'Primary';
    if (['manufacturing'].includes(sectorType)) return 'Secondary';
    return 'Tertiary';
  };

  // Prepare chart data
  const sectorChartData = useMemo(() => {
    return economyBuilder.sectors.map(sector => {
      // Extract base sector type from ID (e.g., "manufacturing_123456" -> "manufacturing")
      const sectorType = sector.id.split('_')[0] as keyof typeof SECTOR_TEMPLATES;
      return {
        name: sector.name,
        value: sector.gdpContribution,
        color: SECTOR_TEMPLATES[sectorType]?.color || 'gray'
      };
    });
  }, [economyBuilder.sectors]);

  const employmentChartData = useMemo(() => {
    return economyBuilder.sectors.map(sector => {
      // Extract base sector type from ID (e.g., "manufacturing_123456" -> "manufacturing")
      const sectorType = sector.id.split('_')[0] as keyof typeof SECTOR_TEMPLATES;
      return {
        name: sector.name,
        value: sector.employmentShare,
        color: SECTOR_TEMPLATES[sectorType]?.color || 'gray'
      };
    });
  }, [economyBuilder.sectors]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Economic Sectors Configuration</h2>
          <p className="text-muted-foreground">
            Configure your economy's sector composition and characteristics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={normalizeSectors}
            disabled={Math.abs(totalGDPContribution - 100) < 1}
          >
            <Target className="h-4 w-4 mr-2" />
            Normalize
          </Button>
        </div>
      </div>

      {/* Validation Alerts */}
      {Math.abs(totalGDPContribution - 100) > 1 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sector GDP contributions must sum to 100%. Currently: {totalGDPContribution.toFixed(1)}%
          </AlertDescription>
        </Alert>
      )}

      {Math.abs(totalEmploymentShare - 100) > 1 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Employment shares must sum to 100%. Currently: {totalEmploymentShare.toFixed(1)}%
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="GDP Distribution"
          value={`${totalGDPContribution.toFixed(1)}%`}
          icon={PieChart}
          sectionId="sectors"
          trend={Math.abs(totalGDPContribution - 100) < 1 ? 'up' : 'down'}
        />
        <MetricCard
          label="Employment Distribution"
          value={`${totalEmploymentShare.toFixed(1)}%`}
          icon={Users}
          sectionId="sectors"
          trend={Math.abs(totalEmploymentShare - 100) < 1 ? 'up' : 'down'}
        />
        <MetricCard
          label="Active Sectors"
          value={economyBuilder.sectors.length}
          icon={Factory}
          sectionId="sectors"
          trend="neutral"
        />
        <MetricCard
          label="Avg Productivity"
          value={economyBuilder.sectors.length > 0 ? 
            (economyBuilder.sectors.reduce((sum, s) => sum + s.productivity, 0) / economyBuilder.sectors.length).toFixed(0) : 
            '0'
          }
          icon={TrendingUp}
          sectionId="sectors"
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Factory className="h-5 w-5" />
                <span>Sector Configuration</span>
              </span>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedSector(null)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {economyBuilder.sectors.map((sector, index) => {
              // Extract base sector type from ID (e.g., "manufacturing_123456" -> "manufacturing")
              const sectorType = sector.id.split('_')[0] as keyof typeof SECTOR_TEMPLATES;
              const template = SECTOR_TEMPLATES[sectorType];
              const Icon = template?.icon || Factory;
              const impact = sectorImpacts[sectorType] || 1;
              
              return (
                <motion.div
                  key={sector.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedSector === sector.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-${template?.color || 'gray'}-100 dark:bg-${template?.color || 'gray'}-900/20`}>
                        <Icon className={`h-5 w-5 text-${template?.color || 'gray'}-600 dark:text-${template?.color || 'gray'}-400`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{sector.name}</h3>
                        <p className="text-sm text-muted-foreground">{template?.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{sector.category}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedSector(selectedSector === sector.id ? null : sector.id)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSector(sector.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Component Impact Indicator */}
                  {impact !== 1 && (
                    <div className="mb-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center space-x-2 text-sm">
                        <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span>Component Impact: {((impact - 1) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <EnhancedSlider
                      label="GDP Contribution"
                      value={sector.gdpContribution}
                      onChange={(value) => handleSectorChange(sector.id, 'gdpContribution', value)}
                      min={0}
                      max={50}
                      step={0.1}
                      unit="%"
                      sectionId="sectors"
                      icon={DollarSign}
                      showValue={true}
                      showRange={true}
                    />
                    
                    <EnhancedSlider
                      label="Employment Share"
                      value={sector.employmentShare}
                      onChange={(value) => handleSectorChange(sector.id, 'employmentShare', value)}
                      min={0}
                      max={50}
                      step={0.1}
                      unit="%"
                      sectionId="sectors"
                      icon={Users}
                      showValue={true}
                      showRange={true}
                    />
                  </div>

                  {selectedSector === sector.id && showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <EnhancedSlider
                          label="Productivity"
                          value={sector.productivity}
                          onChange={(value) => handleSectorChange(sector.id, 'productivity', value)}
                          min={0}
                          max={100}
                          step={1}
                          unit="index"
                          sectionId="sectors"
                          icon={TrendingUp}
                          showValue={true}
                        />
                        
                        <EnhancedSlider
                          label="Growth Rate"
                          value={sector.growthRate}
                          onChange={(value) => handleSectorChange(sector.id, 'growthRate', value)}
                          min={-5}
                          max={15}
                          step={0.1}
                          unit="%"
                          sectionId="sectors"
                          icon={TrendingUp}
                          showValue={true}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <EnhancedSlider
                          label="Export Ratio"
                          value={sector.exports}
                          onChange={(value) => handleSectorChange(sector.id, 'exports', value)}
                          min={0}
                          max={80}
                          step={1}
                          unit="%"
                          sectionId="sectors"
                          icon={Globe}
                          showValue={true}
                        />
                        
                        <EnhancedSlider
                          label="Automation Level"
                          value={sector.automation}
                          onChange={(value) => handleSectorChange(sector.id, 'automation', value)}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          sectionId="sectors"
                          icon={Zap}
                          showValue={true}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <EnhancedSlider
                          label="Innovation"
                          value={sector.innovation}
                          onChange={(value) => handleSectorChange(sector.id, 'innovation', value)}
                          min={0}
                          max={100}
                          step={1}
                          unit="index"
                          sectionId="sectors"
                          icon={Zap}
                          showValue={true}
                        />

                        <EnhancedSlider
                          label="Sustainability"
                          value={sector.sustainability}
                          onChange={(value) => handleSectorChange(sector.id, 'sustainability', value)}
                          min={0}
                          max={100}
                          step={1}
                          unit="index"
                          sectionId="sectors"
                          icon={Leaf}
                          showValue={true}
                        />

                        <EnhancedSlider
                          label="Competitiveness"
                          value={sector.competitiveness}
                          onChange={(value) => handleSectorChange(sector.id, 'competitiveness', value)}
                          min={0}
                          max={100}
                          step={1}
                          unit="index"
                          sectionId="sectors"
                          icon={Target}
                          showValue={true}
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}

            {/* Add Sector Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(SECTOR_TEMPLATES).map(([sectorType, template]) => {
                const Icon = template.icon;
                const isAlreadyAdded = economyBuilder.sectors.some(s => s.id === sectorType);
                
                return (
                  <Button
                    key={sectorType}
                    variant="outline"
                    size="sm"
                    onClick={() => addSector(sectorType)}
                    disabled={isAlreadyAdded}
                    className="justify-start"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    Add {template.name}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Visualizations */}
        <div className="space-y-6">
          {/* GDP Composition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>GDP Composition</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sectorChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Add sectors to see GDP composition
                </div>
              ) : (
                <GlassPieChart
                  data={sectorChartData}
                  dataKey="value"
                  nameKey="name"
                  height={300}
                  colors={getColorsFromData(sectorChartData)}
                />
              )}
            </CardContent>
          </Card>

          {/* Employment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Employment Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employmentChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  Add sectors to see employment distribution
                </div>
              ) : (
                <GlassBarChart
                  data={employmentChartData}
                  xKey="name"
                  yKey="value"
                  height={250}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                  colors={getColorsFromData(employmentChartData)}
                />
              )}
            </CardContent>
          </Card>

          {/* Component Impact Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Atomic Component Impact</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(sectorImpacts).map(([sectorId, impact]) => {
                  const template = SECTOR_TEMPLATES[sectorId as keyof typeof SECTOR_TEMPLATES];
                  if (!template || impact === 1) return null;
                  
                  return (
                    <div key={sectorId} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center space-x-2">
                        <template.icon className="h-4 w-4" />
                        <span className="text-sm">{template.name}</span>
                      </div>
                      <Badge variant={impact > 1 ? "default" : "secondary"}>
                        {impact > 1 ? '+' : ''}{((impact - 1) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
