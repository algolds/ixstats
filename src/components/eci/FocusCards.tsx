"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { GlassCard } from "~/components/ui/enhanced-card";

interface FocusArea {
  id: string;
  title: string;
  icon: string;
  description: string;
  status: 'active' | 'planning' | 'monitoring';
  priority: 'high' | 'medium' | 'low';
  progress: number;
  metrics: {
    label: string;
    value: string;
    trend: 'up' | 'down' | 'stable';
  }[];
}

interface CountryData {
  id: string;
  name: string;
  currentTotalGdp?: number;
  currentGdpPerCapita?: number;
  currentPopulation?: number;
  economicTier?: string;
  populationTier?: number;
  adjustedGdpGrowth?: number;
  populationGrowthRate?: number;
  actualGdpGrowth?: number;
  analytics?: {
    growthTrends: {
      avgPopGrowth: number;
      avgGdpGrowth: number;
    };
    volatility: {
      popVolatility: number;
      gdpVolatility: number;
    };
    riskFlags: string[];
    vulnerabilities: string[];
  };
}

interface FocusCardsProps {
  countryData?: CountryData;
  selectedFocus: string | null;
  setSelectedFocus: (focus: string | null) => void;
}

const generateFocusAreas = (countryData?: CountryData): FocusArea[] => {
  if (!countryData) {
    return [];
  }

  const economicGrowth = (countryData.adjustedGdpGrowth || 0) * 100;
  const populationGrowth = (countryData.populationGrowthRate || 0) * 100;
  const gdpPerCapita = countryData.currentGdpPerCapita || 0;

  // Economic status assessment
  const economicStatus = economicGrowth > 3 ? 'active' : economicGrowth > 0 ? 'monitoring' : 'planning';
  const economicPriority = economicGrowth < 2 ? 'high' : 'medium';
  const economicProgress = Math.min(Math.max((economicGrowth + 5) * 10, 0), 100);

  // Demographics status
  const demographicsStatus = populationGrowth > 1 ? 'active' : populationGrowth > 0 ? 'monitoring' : 'planning';
  const demographicsProgress = Math.min(Math.max(populationGrowth * 30 + 50, 0), 100);

  // Government efficiency based on tier
  const getTierScore = (tier: string): number => {
    const scores = {
      'Impoverished': 20,
      'Developing': 35,
      'Developed': 55,
      'Healthy': 70,
      'Strong': 85,
      'Very Strong': 95,
      'Extravagant': 100
    };
    return scores[tier as keyof typeof scores] || 50;
  };

  const govEfficiency = getTierScore(countryData.economicTier || 'Developing');

  return [
    {
      id: 'economic',
      title: 'Economic Development',
      icon: '💰',
      description: 'GDP growth, trade policies, and fiscal management',
      status: economicStatus,
      priority: economicPriority,
      progress: economicProgress,
      metrics: [
        { 
          label: 'GDP Growth', 
          value: `${economicGrowth.toFixed(1)}%`, 
          trend: economicGrowth > 2 ? 'up' : economicGrowth > 0 ? 'stable' : 'down' 
        },
        { 
          label: 'GDP per Capita', 
          value: `$${(gdpPerCapita / 1000).toFixed(0)}k`, 
          trend: (countryData.analytics?.growthTrends?.avgGdpGrowth ?? 0) > 0 ? 'up' : 'stable' 
        },
        { 
          label: 'Economic Tier', 
          value: countryData.economicTier || 'Unknown', 
          trend: 'stable' 
        }
      ]
    },
    {
      id: 'government',
      title: 'Government Operations',
      icon: '🏛️',
      description: 'Administrative efficiency and public services',
      status: 'monitoring',
      priority: govEfficiency < 60 ? 'high' : 'medium',
      progress: govEfficiency,
      metrics: [
        { label: 'Efficiency Index', value: `${(govEfficiency / 10).toFixed(1)}/10`, trend: 'up' },
        { label: 'Economic Tier', value: countryData.economicTier || 'Unknown', trend: 'stable' },
        { label: 'Population Tier', value: `Tier ${countryData.populationTier || 1}`, trend: 'stable' }
      ]
    },
    {
      id: 'diplomatic',
      title: 'Foreign Relations',
      icon: '🤝',
      description: 'International partnerships and diplomatic initiatives',
      status: 'active',
      priority: 'medium',
      progress: Math.min(getTierScore(countryData.economicTier || 'Developing') + 10, 100),
      metrics: [
        { label: 'Economic Position', value: countryData.economicTier || 'Unknown', trend: 'stable' },
        { label: 'Regional Standing', value: `Tier ${countryData.populationTier || 1}`, trend: 'stable' },
        { label: 'Trade Capacity', value: `$${((countryData.currentTotalGdp || 0) / 1e12).toFixed(1)}T`, trend: 'up' }
      ]
    },
    {
      id: 'demographics',
      title: 'Social Development',
      icon: '👥',
      description: 'Population welfare and social programs',
      status: demographicsStatus,
      priority: populationGrowth < 0.5 ? 'high' : 'medium',
      progress: demographicsProgress,
      metrics: [
        { 
          label: 'Population Growth', 
          value: `${populationGrowth.toFixed(1)}%`, 
          trend: populationGrowth > 1 ? 'up' : populationGrowth > 0 ? 'stable' : 'down' 
        },
        { 
          label: 'Population', 
          value: `${((countryData.currentPopulation || 0) / 1e6).toFixed(1)}M`, 
          trend: populationGrowth > 0 ? 'up' : 'stable' 
        },
        { 
          label: 'Living Standards', 
          value: countryData.economicTier || 'Unknown', 
          trend: (countryData.analytics?.growthTrends?.avgGdpGrowth ?? 0) > 0 ? 'up' : 'stable' 
        }
      ]
    }
  ];
};

export function FocusCards({ countryData, selectedFocus, setSelectedFocus }: FocusCardsProps) {
  const focusAreas = generateFocusAreas(countryData);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500',
      planning: 'bg-yellow-500',
      monitoring: 'bg-blue-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-red-400',
      medium: 'text-yellow-400',
      low: 'text-green-400'
    };
    return colors[priority as keyof typeof colors] || 'text-gray-400';
  };

  const getTrendIcon = (trend: string) => {
    const icons = {
      up: '↗️',
      down: '↘️',
      stable: '→'
    };
    return icons[trend as keyof typeof icons] || '→';
  };

  const getTrendColor = (trend: string) => {
    const colors = {
      up: 'text-green-400',
      down: 'text-red-400',
      stable: 'text-yellow-400'
    };
    return colors[trend as keyof typeof colors] || 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Focus Areas</h2>
          <p className="text-gray-400">
            Strategic priority areas for {countryData?.name || 'your nation'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedFocus ? "outline" : "default"}
            onClick={() => setSelectedFocus(null)}
            className="bg-gray-700/20 text-gray-300"
          >
            All Areas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {focusAreas.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-400">No country data available.</p>
          </div>
        ) : (
          focusAreas.map((area) => (
            <GlassCard
              key={area.id}
              variant="glass"
              glow="hover"
              hover="lift"
              className={`cursor-pointer transition-all duration-300 ${selectedFocus === area.id ? 'ring-2 ring-orange-500/50' : ''}`}
              onClick={() => setSelectedFocus(selectedFocus === area.id ? null : area.id)}
            >
              <Card className="bg-transparent border-none">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{area.icon}</div>
                      <div>
                        <CardTitle className="text-white text-xl">{area.title}</CardTitle>
                        <p className="text-gray-400 text-sm mt-1">{area.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={`${getStatusColor(area.status)} text-white text-xs`}>
                        {area.status}
                      </Badge>
                      <span className={`text-xs font-medium ${getPriorityColor(area.priority)}`}>
                        {area.priority.toUpperCase()} PRIORITY
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-300">Progress</span>
                      <span className="text-sm text-gray-200 font-medium">{area.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${area.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-white font-medium">Key Metrics</h4>
                    {area.metrics.map((metric, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">{metric.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{metric.value}</span>
                          <span className={getTrendColor(metric.trend)}>
                            {getTrendIcon(metric.trend)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedFocus === area.id && (
                    <div className="mt-6 pt-4 border-t border-gray-700">
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700">
                          Manage
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                          Analytics
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                          Reports
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}