"use client";

import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, PieChart, BarChart3, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import type { IncomeData } from '../../types/economy';
import { MetricCard } from '../../primitives/enhanced';
import { GlassBarChart, GlassPieChart } from '~/components/charts/RechartsIntegration';
import { 
  SectionBase, 
  sectionUtils,
  type ExtendedSectionProps 
} from '../glass/SectionBase';

interface IncomeDistributionProps {
  data: IncomeData;
  totalPopulation: number;
  showAdvanced?: boolean;
  className?: string;
}

export function IncomeDistribution({
  data,
  totalPopulation,
  showAdvanced = false,
  className = ''
}: IncomeDistributionProps) {
  
  // Calculate inequality assessment
  const getInequalityLevel = (gini: number) => {
    if (gini < 0.3) return { level: 'Low', color: 'green', status: 'Relatively Equal' };
    if (gini < 0.4) return { level: 'Moderate', color: 'blue', status: 'Typical for Developed Nations' };
    if (gini < 0.5) return { level: 'High', color: 'yellow', status: 'Significant Inequality' };
    return { level: 'Very High', color: 'red', status: 'Extreme Inequality' };
  };

  const inequalityAssessment = getInequalityLevel(data.giniCoefficient);
  
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const incomeClasses = [
    { name: 'Lower Class', ...data.incomeClasses.lowerClass, color: 'red' },
    { name: 'Lower Middle', ...data.incomeClasses.lowerMiddleClass, color: 'orange' },
    { name: 'Middle Class', ...data.incomeClasses.middleClass, color: 'yellow' },
    { name: 'Upper Middle', ...data.incomeClasses.upperMiddleClass, color: 'blue' },
    { name: 'Upper Class', ...data.incomeClasses.upperClass, color: 'purple' },
    { name: 'Wealthy', ...data.incomeClasses.wealthyClass, color: 'emerald' },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Median Income"
          value={formatCurrency(data.nationalMedianIncome)}
          icon={DollarSign}
          description="50th percentile"
          trend="neutral"
        />
        
        <MetricCard
          label="Mean Income"
          value={formatCurrency(data.nationalMeanIncome)}
          icon={TrendingUp}
          description={`${((data.nationalMeanIncome / data.nationalMedianIncome - 1) * 100).toFixed(0)}% above median`}
        />
        
        <MetricCard
          label="Gini Coefficient"
          value={(data.giniCoefficient * 100).toFixed(1)}
          icon={BarChart3}
          description={inequalityAssessment.status}
          className={`text-${inequalityAssessment.color}-600 bg-${inequalityAssessment.color}-50`}
        />
        
        <MetricCard
          label="Poverty Rate"
          value={`${data.povertyRate.toFixed(1)}%`}
          icon={data.povertyRate > 15 ? AlertCircle : Users}
          description={`${Math.round(totalPopulation * (data.povertyRate / 100)).toLocaleString()} people`}
          trend={data.povertyRate > 15 ? 'down' : data.povertyRate > 10 ? 'neutral' : 'up'}
        />
      </div>

      {/* Inequality Assessment */}
      <Alert className={`border-${inequalityAssessment.color}-200 bg-${inequalityAssessment.color}-50`}>
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          <strong>Income Inequality: {inequalityAssessment.level}</strong>
          <br />
          {inequalityAssessment.status} (Gini: {(data.giniCoefficient * 100).toFixed(1)})
          <br />
          {data.palmRatio && `Top 10% earn ${data.palmRatio.toFixed(1)}x more than bottom 40%`}
        </AlertDescription>
      </Alert>

      {/* Income Distribution by Class */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Income Distribution by Class
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {incomeClasses.map((incomeClass) => (
              <div key={incomeClass.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full bg-${incomeClass.color}-500`} />
                    <span className="text-sm font-medium">{incomeClass.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{incomeClass.percent.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(incomeClass.averageIncome)}/yr</div>
                  </div>
                </div>
                <Progress value={incomeClass.percent} className="h-2" />
                {showAdvanced && (
                  <div className="text-xs text-muted-foreground pl-5">
                    Threshold: {formatCurrency(incomeClass.threshold)} • 
                    Population: {Math.round(totalPopulation * (incomeClass.percent / 100)).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Income Share Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income Share by Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{data.incomeShare.bottom50.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">Bottom 50%</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{data.incomeShare.middle40.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">Middle 40%</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{data.incomeShare.top10.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">Top 10%</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">{data.incomeShare.top1.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">Top 1%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced: Income Percentiles */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income Percentiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-lg font-bold">{formatCurrency(data.incomePercentiles.p10)}</div>
                <div className="text-xs text-muted-foreground">10th percentile</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-lg font-bold">{formatCurrency(data.incomePercentiles.p25)}</div>
                <div className="text-xs text-muted-foreground">25th percentile</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-lg font-bold text-blue-600">{formatCurrency(data.incomePercentiles.p50)}</div>
                <div className="text-xs text-muted-foreground">Median (50th)</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-lg font-bold">{formatCurrency(data.incomePercentiles.p75)}</div>
                <div className="text-xs text-muted-foreground">75th percentile</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-lg font-bold text-purple-600">{formatCurrency(data.incomePercentiles.p90)}</div>
                <div className="text-xs text-muted-foreground">90th percentile</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-lg font-bold text-purple-600">{formatCurrency(data.incomePercentiles.p95)}</div>
                <div className="text-xs text-muted-foreground">95th percentile</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded">
                <div className="text-lg font-bold text-emerald-600">{formatCurrency(data.incomePercentiles.p99)}</div>
                <div className="text-xs text-muted-foreground">99th percentile</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded">
                <div className="text-lg font-bold text-emerald-600">{formatCurrency(data.incomePercentiles.p99_9)}</div>
                <div className="text-xs text-muted-foreground">99.9th percentile</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Poverty Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Poverty Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Poverty Line</span>
              <Badge variant="secondary">{formatCurrency(data.povertyLine)}/yr</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Overall Poverty Rate</span>
              <Badge variant={data.povertyRate > 15 ? 'destructive' : 'secondary'}>
                {data.povertyRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Extreme Poverty</span>
              <Badge variant={data.extremePovertyRate > 5 ? 'destructive' : 'secondary'}>
                {data.extremePovertyRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Child Poverty</span>
              <Badge variant={data.childPovertyRate > 20 ? 'destructive' : 'secondary'}>
                {data.childPovertyRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Senior Poverty</span>
              <Badge variant={data.seniorPovertyRate > 15 ? 'destructive' : 'secondary'}>
                {data.seniorPovertyRate.toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social Mobility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Social Mobility Index</span>
              <Badge variant={data.socialMobilityIndex > 70 ? 'default' : 'secondary'}>
                {data.socialMobilityIndex.toFixed(0)}/100
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Intergenerational Elasticity</span>
              <Badge variant={data.interGenerationalElasticity < 0.3 ? 'default' : 'secondary'}>
                {data.interGenerationalElasticity.toFixed(2)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Economic Mobility Rate</span>
              <Badge variant={data.economicMobilityRate > 15 ? 'default' : 'secondary'}>
                {data.economicMobilityRate.toFixed(1)}%
              </Badge>
            </div>
            {showAdvanced && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Gender Pay Gap</span>
                  <Badge variant={data.genderPayGap < 10 ? 'default' : 'destructive'}>
                    {data.genderPayGap.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Urban-Rural Gap</span>
                  <Badge variant="secondary">
                    {data.urbanRuralIncomeGap.toFixed(1)}%
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

