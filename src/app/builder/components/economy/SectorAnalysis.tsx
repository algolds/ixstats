"use client";

import React from 'react';
import { Factory, Tractor, Building2, Cpu, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import type { SectorData } from '../../types/economy';
import { MetricCard } from '../../primitives/enhanced';

interface SectorAnalysisProps {
  data: SectorData;
  nominalGDP: number;
  showAdvanced?: boolean;
  className?: string;
}

export function SectorAnalysis({
  data,
  nominalGDP,
  showAdvanced = false,
  className = ''
}: SectorAnalysisProps) {
  
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toFixed(0)}`;
  };

  const topSectors = Object.entries(data.sectorGDPContribution)
    .map(([sector, percent]) => ({
      sector,
      percent,
      value: nominalGDP * (percent / 100)
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8);

  const economicStructure = [
    { name: 'Primary Sector', value: data.economicStructure.primarySector, icon: Tractor, color: 'green' },
    { name: 'Secondary Sector', value: data.economicStructure.secondarySector, icon: Factory, color: 'blue' },
    { name: 'Tertiary Sector', value: data.economicStructure.tertiarySector, icon: Building2, color: 'purple' },
    { name: 'Quaternary Sector', value: data.economicStructure.quaternarySector, icon: Cpu, color: 'emerald' },
  ];

  const getEconomyType = () => {
    const { primarySector, secondarySector, tertiarySector, quaternarySector } = data.economicStructure;
    if (primarySector > 40) return { type: 'Agricultural Economy', color: 'green' };
    if (secondarySector > 35) return { type: 'Industrial Economy', color: 'blue' };
    if (quaternarySector > 25) return { type: 'Knowledge Economy', color: 'emerald' };
    if (tertiarySector > 60) return { type: 'Service Economy', color: 'purple' };
    return { type: 'Mixed Economy', color: 'gray' };
  };

  const economyType = getEconomyType();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Economy Type"
          value={economyType.type}
          icon={Building2}
          className={`text-${economyType.color}-600 bg-${economyType.color}-50`}
        />
        
        <MetricCard
          label="R&D Investment"
          value={`${data.researchDevelopmentGDPPercent.toFixed(2)}%`}
          icon={Cpu}
          description={formatCurrency(nominalGDP * (data.researchDevelopmentGDPPercent / 100))}
          trend={data.researchDevelopmentGDPPercent > 2 ? 'up' : 'neutral'}
        />
        
        <MetricCard
          label="Tech Adoption"
          value={`${data.techAdoptionIndex}/100`}
          icon={Zap}
          description="Innovation readiness"
          trend={data.techAdoptionIndex > 70 ? 'up' : 'neutral'}
        />
        
        <MetricCard
          label="Digital Economy"
          value={`${data.digitalEconomyShare.toFixed(1)}%`}
          icon={Cpu}
          description="Of total GDP"
          trend="up"
        />
      </div>

      {/* Economic Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Economic Structure
            </span>
            <Badge variant="secondary">{economyType.type}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {economicStructure.map(({ name, value, icon: Icon, color }) => (
              <div key={name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{value.toFixed(1)}%</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatCurrency(nominalGDP * (value / 100))}
                    </span>
                  </div>
                </div>
                <Progress value={value} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Contributing Sectors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            GDP Contribution by Sector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topSectors.map(({ sector, percent, value }) => (
              <div key={sector} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm capitalize">
                    {sector.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-medium">{percent.toFixed(1)}%</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatCurrency(value)}
                    </span>
                  </div>
                </div>
                <Progress value={percent} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced: Sector Growth Rates */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sector Growth Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.sectorGrowthRates).map(([sector, rate]) => (
                <div key={sector} className={`text-center p-3 rounded-lg ${
                  rate > 5 ? 'bg-green-50' :
                  rate > 2 ? 'bg-blue-50' :
                  rate > 0 ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <div className={`text-xl font-bold ${
                    rate > 5 ? 'text-green-600' :
                    rate > 2 ? 'text-blue-600' :
                    rate > 0 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {rate > 0 ? '+' : ''}{rate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize">
                    {sector.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Innovation Metrics */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Innovation Indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">R&D Spending</span>
                <Badge variant={data.researchDevelopmentGDPPercent > 2 ? 'default' : 'secondary'}>
                  {data.researchDevelopmentGDPPercent.toFixed(2)}% of GDP
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Patents per Capita</span>
                <Badge variant="secondary">
                  {data.patentsPerCapita.toFixed(2)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Tech Adoption Index</span>
                <Badge variant={data.techAdoptionIndex > 70 ? 'default' : 'secondary'}>
                  {data.techAdoptionIndex}/100
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Digital Economy Share</span>
                <Badge variant={data.digitalEconomyShare > 15 ? 'default' : 'secondary'}>
                  {data.digitalEconomyShare.toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sector Productivity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Overall Productivity</span>
                <Badge variant={data.sectorProductivity.overall > 100 ? 'default' : 'secondary'}>
                  {data.sectorProductivity.overall.toFixed(0)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Agriculture</span>
                <span className="text-sm font-medium">{data.sectorProductivity.agriculture.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Manufacturing</span>
                <span className="text-sm font-medium">{data.sectorProductivity.manufacturing.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Services</span>
                <span className="text-sm font-medium">{data.sectorProductivity.services.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Technology</span>
                <span className="text-sm font-medium">{data.sectorProductivity.technology.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

