/**
 * Mini Executive Dashboard Component
 * Expanded view for MyCountry card - executive-level overview and tools
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Progress } from './progress';
import { formatCurrency, formatPopulation } from '~/lib/chart-utils';
import { 
  Crown, 
  TrendingUp, 
  Users, 
  DollarSign, 
  MapPin, 
  BarChart3,
  PieChart,
  Building,
  Globe,
  Settings,
  Eye,
  Briefcase,
  Target,
  Activity,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { createUrl } from '~/lib/url-utils';

interface CountryData {
  id: string;
  name: string;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  currentPopulation: number;
  populationGrowthRate?: number;
  adjustedGdpGrowth?: number;
  economicTier: string;
  populationTier?: string;
  populationDensity?: number;
  landArea?: number;
}

interface MiniExecutiveDashboardProps {
  countryData: CountryData;
  className?: string;
}

export const MiniExecutiveDashboard: React.FC<MiniExecutiveDashboardProps> = ({
  countryData,
  className
}) => {
  // Calculate key metrics
  const economicHealth = Math.min(100, (countryData.currentGdpPerCapita / 50000) * 100);
  const populationHealth = Math.min(100, Math.max(0, ((countryData.populationGrowthRate || 0) * 100 + 2) * 25));
  const developmentIndex = countryData.economicTier === "Extravagant" ? 100 : 
                          countryData.economicTier === "Very Strong" ? 85 :
                          countryData.economicTier === "Strong" ? 70 :
                          countryData.economicTier === "Healthy" ? 55 :
                          countryData.economicTier === "Developed" ? 40 :
                          countryData.economicTier === "Developing" ? 25 : 10;

  const quickActions = [
    {
      title: "Executive Overview",
      description: "Comprehensive executive dashboard",
      icon: <Crown className="h-5 w-5" />,
      href: createUrl("/mycountry"),
      color: "text-yellow-500",
      bg: "bg-yellow-500/10"
    },
    {
      title: "Economic Analysis", 
      description: "Detailed economic metrics",
      icon: <BarChart3 className="h-5 w-5" />,
      href: createUrl(`/nation/${countryData.slug || countryData.id}`),
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Intelligence Hub",
      description: "Strategic intelligence center",
      icon: <Eye className="h-5 w-5" />,
      href: createUrl("/sdi"),
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
    {
      title: "Policy Center",
      description: "Executive command interface",
      icon: <Building className="h-5 w-5" />,
      href: createUrl("/eci"),
      color: "text-indigo-500", 
      bg: "bg-indigo-500/10"
    }
  ];

  const keyMetrics = [
    {
      label: "Economic Power",
      value: economicHealth,
      displayValue: formatCurrency(countryData.currentGdpPerCapita),
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-green-500",
      description: "GDP per capita performance"
    },
    {
      label: "Population Dynamics",
      value: populationHealth,
      displayValue: formatPopulation(countryData.currentPopulation),
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-500",
      description: "Population and growth metrics"
    },
    {
      label: "Development Index",
      value: developmentIndex,
      displayValue: countryData.economicTier,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-purple-500",
      description: "Overall development status"
    }
  ];

  const statusIndicators = [
    {
      label: "Economic Status",
      status: economicHealth > 70 ? "Excellent" : economicHealth > 50 ? "Good" : economicHealth > 30 ? "Fair" : "Developing",
      color: economicHealth > 70 ? "text-green-500" : economicHealth > 50 ? "text-blue-500" : economicHealth > 30 ? "text-yellow-500" : "text-red-500",
      icon: economicHealth > 70 ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />
    },
    {
      label: "Population Tier",
      status: countryData.populationTier || "Standard",
      color: "text-cyan-500",
      icon: <Users className="h-4 w-4" />
    },
    {
      label: "Land Efficiency",
      status: countryData.populationDensity ? `${Math.round(countryData.populationDensity)}/km²` : 'N/A',
      color: "text-purple-500",
      icon: <MapPin className="h-4 w-4" />
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("mycountry-executive space-y-6", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Executive Command Center</h3>
            <p className="text-sm text-muted-foreground">{countryData.name} • Strategic Overview</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-400/50">
          Premium Access
        </Badge>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {keyMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="themed-glass p-4 rounded-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2 rounded-lg themed-interactive", metric.color)}>
                {metric.icon}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">{metric.label}</h4>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className={cn("text-2xl font-bold", metric.color)}>
                {metric.displayValue}
              </div>
              <Progress value={metric.value} className="h-2" />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Performance</span>
                <span className={metric.color}>{Math.round(metric.value)}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Status Dashboard */}
      <div className="themed-glass p-6 rounded-lg">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-yellow-500" />
          Executive Status Board
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {statusIndicators.map((indicator, index) => (
            <div key={indicator.label} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={indicator.color}>
                  {indicator.icon}
                </div>
                <span className="text-sm text-muted-foreground">{indicator.label}</span>
              </div>
              <span className={cn("text-sm font-medium", indicator.color)}>
                {indicator.status}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border/50 my-4" />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(countryData.currentTotalGdp)}
            </div>
            <div className="text-xs text-muted-foreground">Total GDP</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-500">
              {((countryData.populationGrowthRate || 0) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Population Growth</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-500">
              {countryData.landArea ? `${(countryData.landArea / 1000).toFixed(0)}k` : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">Land Area (km²)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-500">
              {developmentIndex > 85 ? 'A+' : developmentIndex > 70 ? 'A' : developmentIndex > 55 ? 'B' : developmentIndex > 40 ? 'C' : 'D'}
            </div>
            <div className="text-xs text-muted-foreground">Development Grade</div>
          </div>
        </div>
      </div>

      {/* Executive Actions */}
      <div className="themed-glass p-6 rounded-lg">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-yellow-500" />
          Executive Command Actions
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Button
                variant="outline"
                className="w-full h-auto p-4 justify-start themed-interactive hover:themed-glow"
                onClick={() => window.open(action.href, '_blank')}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={cn("p-2 rounded-lg", action.bg, action.color)}>
                    {action.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{action.title}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </div>
                </div>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Access Footer */}
      <div className="flex items-center justify-between pt-4 border-t border/50">
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date().toLocaleString()}
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
          onClick={() => window.open(createUrl("/mycountry"), '_blank')}
        >
          <Crown className="h-4 w-4 mr-2" />
          Open Full Dashboard
        </Button>
      </div>
    </motion.div>
  );
};

export default MiniExecutiveDashboard;