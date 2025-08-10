/**
 * Public Executive Overview Component
 * Public-facing version of Executive Command Center with appropriate data visibility
 */

"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { 
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  BarChart3,
  Globe,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Eye,
  Shield,
  Zap
} from 'lucide-react';
import { formatCurrency, formatPopulation } from '~/lib/chart-utils';
import { getFlagColors } from '~/lib/flag-color-extractor';
import { IxTime } from '~/lib/ixtime';
import { cn } from '~/lib/utils';

interface CountryData {
  id: string;
  name: string;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  currentPopulation: number;
  populationGrowthRate?: number | null;
  adjustedGdpGrowth?: number | null;
  economicTier: string;
  populationTier?: string | null;
  populationDensity?: number | null;
  landArea?: number | null;
  analytics?: {
    riskFlags?: string[];
    stabilityScore?: number;
    economicMomentum?: number;
  };
}

interface PublicExecutiveOverviewProps {
  country: CountryData;
  currentIxTime: number;
  className?: string;
}

export const PublicExecutiveOverview: React.FC<PublicExecutiveOverviewProps> = ({
  country,
  currentIxTime,
  className
}) => {
  const flagColors = getFlagColors(country.name);

  // Calculate public-safe metrics
  const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
  const populationGrowth = Math.min(100, Math.max(0, (((country.populationGrowthRate ?? 0) * 100) + 2) * 25));
  const developmentIndex = country.economicTier === "Extravagant" ? 100 : 
                          country.economicTier === "Very Strong" ? 85 :
                          country.economicTier === "Strong" ? 70 :
                          country.economicTier === "Healthy" ? 55 :
                          country.economicTier === "Developed" ? 40 :
                          country.economicTier === "Developing" ? 25 : 10;

  const stabilityScore = country.analytics?.stabilityScore ?? (80 + Math.random() * 20);
  const economicMomentum = country.analytics?.economicMomentum ?? economicHealth;

  // Key performance indicators
  const kpis = [
    {
      label: 'Economic Strength',
      value: economicHealth,
      change: ((country.adjustedGdpGrowth ?? 0) * 100),
      icon: DollarSign,
      color: flagColors.primary,
      format: 'percentage',
      description: 'Overall economic performance indicator'
    },
    {
      label: 'Population Dynamics',
      value: country.currentPopulation,
      change: ((country.populationGrowthRate ?? 0) * 100),
      icon: Users,
      color: flagColors.secondary,
      format: 'population',
      description: 'Demographic trends and population health'
    },
    {
      label: 'Development Level',
      value: developmentIndex,
      change: 0, // Development tier changes are rare
      icon: TrendingUp,
      color: flagColors.accent,
      format: 'percentage',
      description: 'Infrastructure and development quality'
    },
    {
      label: 'National Stability',
      value: stabilityScore,
      change: Math.random() * 4 - 2, // Simulated stability change
      icon: Shield,
      color: '#10b981',
      format: 'percentage',
      description: 'Political and economic stability index'
    }
  ];

  // Public-safe recent developments
  const publicDevelopments = [
    {
      type: 'economic',
      message: `GDP per capita: ${formatCurrency(country.currentGdpPerCapita)}`,
      severity: 'info',
      timestamp: currentIxTime - 1000 * 60 * 60 * 24 // 1 day ago
    },
    {
      type: 'demographic',
      message: `Population growth: ${((country.populationGrowthRate ?? 0) * 100).toFixed(2)}% annually`,
      severity: (country.populationGrowthRate ?? 0) > 0.01 ? 'positive' : 'neutral',
      timestamp: currentIxTime - 1000 * 60 * 60 * 12 // 12 hours ago
    },
    {
      type: 'development',
      message: `Maintaining ${country.economicTier.toLowerCase()} economic tier status`,
      severity: 'positive',
      timestamp: currentIxTime - 1000 * 60 * 60 * 6 // 6 hours ago
    }
  ];

  // Risk assessment (public version)
  const publicRisks = country.analytics?.riskFlags?.slice(0, 3).map(flag => ({
    level: 'moderate',
    category: flag.replace(/_/g, ' ').toLowerCase(),
    impact: 'Economic planning consideration',
    timeframe: 'Medium-term'
  })) || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'positive': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'negative': return 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'positive': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'negative': return <TrendingDown className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" style={{ color: flagColors.primary }} />
            Public Overview
          </h2>
          <p className="text-muted-foreground">
            General insights into {country.name}'s national performance
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          Last updated: {IxTime.formatIxTime(currentIxTime, true)}
        </Badge>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="glass-hierarchy-child hover:glass-depth-2 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${kpi.color}20` }}
                  >
                    <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{kpi.label}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold" style={{ color: kpi.color }}>
                        {kpi.format === 'population' 
                          ? formatPopulation(kpi.value)
                          : kpi.format === 'currency'
                          ? formatCurrency(kpi.value)
                          : `${Math.round(kpi.value)}%`
                        }
                      </span>
                      {kpi.change !== 0 && (
                        <div className={`flex items-center gap-1 text-xs ${
                          kpi.change > 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {kpi.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(kpi.change).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{kpi.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="society">Society</TabsTrigger>
          <TabsTrigger value="development">Development</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Developments */}
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" style={{ color: flagColors.primary }} />
                  Recent Developments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {publicDevelopments.map((dev, index) => (
                    <motion.div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg glass-hierarchy-interactive"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div className={getSeverityColor(dev.severity)}>
                        {getSeverityIcon(dev.severity)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{dev.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {IxTime.formatIxTime(dev.timestamp, true)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {dev.type}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* National Status */}
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5" style={{ color: flagColors.secondary }} />
                  National Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Economic Tier</span>
                    <Badge style={{ backgroundColor: `${flagColors.primary}20`, color: flagColors.primary }}>
                      {country.economicTier}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Population Tier</span>
                    <Badge variant="outline">
                      {country.populationTier || 'Standard'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Stability Index</span>
                    <span className="font-semibold text-green-500">
                      {Math.round(stabilityScore)}% Stable
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Economic Momentum</span>
                    <span className={`font-semibold ${economicMomentum > 50 ? 'text-green-500' : 'text-yellow-500'}`}>
                      {economicMomentum > 75 ? 'High' : economicMomentum > 50 ? 'Moderate' : 'Building'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="economy" className="space-y-4">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: flagColors.accent }} />
                Economic Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg glass-hierarchy-interactive">
                  <DollarSign className="h-8 w-8 mx-auto mb-2" style={{ color: flagColors.primary }} />
                  <div className="text-2xl font-bold" style={{ color: flagColors.primary }}>
                    {formatCurrency(country.currentGdpPerCapita)}
                  </div>
                  <p className="text-sm text-muted-foreground">GDP per Capita</p>
                </div>
                <div className="text-center p-4 rounded-lg glass-hierarchy-interactive">
                  <Globe className="h-8 w-8 mx-auto mb-2" style={{ color: flagColors.secondary }} />
                  <div className="text-2xl font-bold" style={{ color: flagColors.secondary }}>
                    {formatCurrency(country.currentTotalGdp)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total GDP</p>
                </div>
                <div className="text-center p-4 rounded-lg glass-hierarchy-interactive">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2" style={{ color: flagColors.accent }} />
                  <div className="text-2xl font-bold" style={{ color: flagColors.accent }}>
                    {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Growth Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="society" className="space-y-4">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: flagColors.primary }} />
                Demographics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Population:</span>
                    <span className="font-semibold">{formatPopulation(country.currentPopulation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Growth Rate:</span>
                    <span className={`font-semibold ${
                      (country.populationGrowthRate ?? 0) > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {((country.populationGrowthRate ?? 0) * 100).toFixed(2)}% annually
                    </span>
                  </div>
                  {country.populationDensity && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Population Density:</span>
                      <span className="font-semibold">{country.populationDensity.toFixed(1)}/km²</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Population Tier:</span>
                    <span className="font-semibold">{country.populationTier || 'Standard'}</span>
                  </div>
                  {country.landArea && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Land Area:</span>
                      <span className="font-semibold">{country.landArea.toLocaleString()} km²</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="development" className="space-y-4">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" style={{ color: flagColors.accent }} />
                Development Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                       style={{ backgroundColor: flagColors.primary }}>
                    {Math.round(developmentIndex)}%
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{country.economicTier} Tier</h3>
                    <p className="text-muted-foreground">Development classification based on economic indicators</p>
                  </div>
                </div>
                
                {publicRisks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Development Considerations</h4>
                    <div className="space-y-2">
                      {publicRisks.map((risk, index) => (
                        <div key={index} className="p-3 rounded-lg glass-hierarchy-interactive">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium capitalize">{risk.category}</p>
                              <p className="text-xs text-muted-foreground">{risk.impact} • {risk.timeframe}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disclaimer */}
      <Card className="glass-hierarchy-child border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>
              This is a public overview showing general performance indicators. 
              Detailed strategic data is available to authorized country management.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicExecutiveOverview;