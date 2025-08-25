"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  Shield,
  Zap,
  Users,
  Globe,
  AlertTriangle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Button } from '~/components/ui/button';
import { IntegratedEconomicAnalysis } from '~/lib/enhanced-economic-calculations';
import { IntuitiveEconomicAnalysis } from '~/lib/intuitive-economic-analysis';
import { runGroupedAnalysis } from '~/lib/economic-calculation-groups';
import { getDefaultEconomicConfig } from '~/lib/config-service';
import type { CountryStats, HistoricalDataPoint } from '~/types/ixstats';
import type { EconomyData } from '~/types/economics';
import type { IntelligenceComponentProps } from '../types/intelligence';

interface EnhancedEconomicIntelligenceProps extends IntelligenceComponentProps {
  countryStats: CountryStats;
  economyData: EconomyData;
  historicalData?: HistoricalDataPoint[];
  onViewDetails?: (section: string) => void;
  onTakeAction?: (action: string) => void;
}

const gradeColors = {
  'A+': 'text-emerald-600 bg-emerald-100 border-emerald-300',
  'A': 'text-emerald-600 bg-emerald-100 border-emerald-300',
  'A-': 'text-emerald-600 bg-emerald-100 border-emerald-300',
  'B+': 'text-blue-600 bg-blue-100 border-blue-300',
  'B': 'text-blue-600 bg-blue-100 border-blue-300',
  'B-': 'text-blue-600 bg-blue-100 border-blue-300',
  'C+': 'text-yellow-600 bg-yellow-100 border-yellow-300',
  'C': 'text-yellow-600 bg-yellow-100 border-yellow-300',
  'C-': 'text-yellow-600 bg-yellow-100 border-yellow-300',
  'D': 'text-red-600 bg-red-100 border-red-300',
  'F': 'text-red-600 bg-red-100 border-red-300'
} as const;

const getGradeColor = (grade: string): string => {
  return gradeColors[grade as keyof typeof gradeColors] || 'text-gray-600 bg-gray-100 border-gray-300';
};

const statusIcons = {
  excellent: CheckCircle,
  strong: Shield,
  good: TrendingUp,
  fair: Shield,
  weak: AlertTriangle,
  critical: AlertTriangle
};

export function EnhancedEconomicIntelligence({
  countryStats,
  economyData,
  historicalData = [],
  onViewDetails,
  onTakeAction,
  className
}: EnhancedEconomicIntelligenceProps) {
  const analysis = useMemo(() => {
    try {
      const config = getDefaultEconomicConfig();
      
      // Run comprehensive analysis
      const integratedAnalyzer = new IntegratedEconomicAnalysis(config);
      const intuitiveAnalyzer = new IntuitiveEconomicAnalysis(config);
      const groupedAnalysis = runGroupedAnalysis(countryStats, economyData, historicalData, config);
      
      const comprehensive = integratedAnalyzer.analyzeCountry(countryStats, economyData, historicalData);
      const healthSummary = intuitiveAnalyzer.quickHealthCheck(countryStats, economyData);
      
      return {
        comprehensive,
        healthSummary,
        groupedAnalysis,
        isLoaded: true
      };
    } catch (error) {
      console.error('Enhanced economic analysis failed:', error);
      return { isLoaded: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [countryStats, economyData, historicalData]);

  if (!analysis.isLoaded) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Economic Analysis Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {analysis.error || 'Unable to load enhanced economic analysis'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { comprehensive, healthSummary, groupedAnalysis } = analysis;
  
  // Type guards
  if (!comprehensive || !healthSummary) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Incomplete Economic Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Economic analysis data is incomplete
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Executive Summary Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Economic Health Summary
            </div>
            <Badge 
              className={`${getGradeColor(healthSummary.overallGrade)} border`}
              variant="outline"
            >
              {healthSummary.overallGrade}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {React.createElement(statusIcons[healthSummary.status.toLowerCase() as keyof typeof statusIcons] || Shield, {
                  className: `h-4 w-4 ${healthSummary.status === 'Excellent' || healthSummary.status === 'Strong' ? 'text-green-600' : 
                    healthSummary.status === 'Good' || healthSummary.status === 'Fair' ? 'text-blue-600' : 'text-red-600'}`
                })}
                <span className="text-sm font-medium">Overall Status: {healthSummary.status}</span>
              </div>
              <Progress value={healthSummary.score} className="h-2" />
              <div className="text-xs text-gray-600 mt-1">{healthSummary.score}/100</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-gray-600">Health Indicators</div>
              <div className="flex gap-2">
                <Badge 
                  variant={healthSummary.healthIndicators.growth === 'strong' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  Growth: {healthSummary.healthIndicators.growth}
                </Badge>
                <Badge 
                  variant={healthSummary.healthIndicators.stability === 'high' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  Stability: {healthSummary.healthIndicators.stability}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {healthSummary.keyMessage}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Economic Resilience */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Resilience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 mb-2">
              {comprehensive.resilience.overallScore}%
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Fiscal:</span>
                <span className="font-medium">{comprehensive.resilience.components.fiscalStability}%</span>
              </div>
              <div className="flex justify-between">
                <span>Monetary:</span>
                <span className="font-medium">{comprehensive.resilience.components.monetaryStability}%</span>
              </div>
            </div>
            {comprehensive.resilience?.riskFactors?.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-xs">
                <div className="font-medium text-yellow-800 dark:text-yellow-200">
                  Risk: {comprehensive.resilience.riskFactors?.[0]?.factor}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Productivity & Innovation */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Productivity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {comprehensive.productivity.overallScore}%
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Labor:</span>
                <span className="font-medium">{comprehensive.productivity.components.laborProductivity}%</span>
              </div>
              <div className="flex justify-between">
                <span>Capital:</span>
                <span className="font-medium">{comprehensive.productivity.components.capitalEfficiency}%</span>
              </div>
            </div>
            {comprehensive.productivity.competitiveAdvantages.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs">
                <div className="font-medium text-blue-800 dark:text-blue-200">
                  Advantage: {comprehensive.productivity.competitiveAdvantages[0]}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Social Wellbeing */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Wellbeing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 mb-2">
              {comprehensive.wellbeing.overallScore}%
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Living Standards:</span>
                <span className="font-medium">{comprehensive.wellbeing.components.livingStandards}%</span>
              </div>
              <div className="flex justify-between">
                <span>Healthcare:</span>
                <span className="font-medium">{comprehensive.wellbeing.components.healthcareAccess}%</span>
              </div>
            </div>
            <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded text-xs">
              <div className="font-medium text-purple-800 dark:text-purple-200">
                Gini: {comprehensive.wellbeing.inequalityFactors.giniCoefficient.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Economic Complexity */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-orange-600" />
              Complexity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 mb-2">
              {comprehensive.complexity.overallScore}%
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Export Diversity:</span>
                <span className="font-medium">{comprehensive.complexity.components.exportDiversity}%</span>
              </div>
              <div className="flex justify-between">
                <span>Financial:</span>
                <span className="font-medium">{comprehensive.complexity.components.financialSophistication}%</span>
              </div>
            </div>
            {comprehensive.complexity.futureOpportunities.length > 0 && (
              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-xs">
                <div className="font-medium text-orange-800 dark:text-orange-200">
                  Opportunity: {comprehensive.complexity.futureOpportunities[0]}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Priority Recommendations */}
      {comprehensive.priorityRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-indigo-600" />
              Priority Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comprehensive.priorityRecommendations.slice(0, 3).map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <Badge 
                    variant={rec.impact === 'high' ? 'default' : 'secondary'}
                    className="text-xs mt-0.5"
                  >
                    {rec.impact.toUpperCase()}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{rec.area}</div>
                    <div className="text-xs text-gray-600 mt-1">{rec.action}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Timeline: {rec.timeframe.replace('_', ' ')}
                    </div>
                  </div>
                  {onTakeAction && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTakeAction(rec.action)}
                    >
                      Take Action
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Details Button */}
      {onViewDetails && (
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => onViewDetails('economic-analysis')}
            className="flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            View Detailed Economic Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

export default EnhancedEconomicIntelligence;