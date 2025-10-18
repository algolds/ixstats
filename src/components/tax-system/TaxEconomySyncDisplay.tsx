"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  DollarSign,
  BarChart3,
  Target,
  Scale,
  Zap,
  Users,
  Building2,
  ShoppingCart,
  Lightbulb,
  AlertCircle,
  ArrowUpDown,
  Activity
} from 'lucide-react';

import type { TaxSystem, TaxCategory, TaxBracket } from '~/types/tax-system';
import type { CoreEconomicIndicatorsData, LaborEmploymentData } from '~/types/economics';

interface TaxEconomySyncProps {
  taxSystem?: TaxSystem;
  economicData?: {
    core?: CoreEconomicIndicatorsData;
    labor?: LaborEmploymentData;
  };
  onOptimize?: () => void;
  className?: string;
}

interface TaxBurdenAnalysis {
  incomeClass: string;
  averageIncome: number;
  effectiveTaxRate: number;
  taxBurden: number;
  disposableIncome: number;
  populationPercent: number;
  color: string;
  status: 'low' | 'moderate' | 'high' | 'excessive';
}

interface EconomicTierRecommendation {
  tier: 'Developing' | 'Emerging' | 'Developed' | 'Advanced';
  recommendedIncomeTaxRange: [number, number];
  recommendedCorporateTaxRange: [number, number];
  recommendedSalesTaxRange: [number, number];
  maxTaxBurden: number;
  currentAlignment: 'aligned' | 'undertaxed' | 'overtaxed';
  recommendations: string[];
  color: string;
}

interface EconomicImpact {
  gdpGrowthImpact: number;
  giniCoefficientChange: number;
  businessInvestmentImpact: 'positive' | 'neutral' | 'negative';
  consumerSpendingImpact: 'positive' | 'neutral' | 'negative';
  employmentImpact: 'positive' | 'neutral' | 'negative';
  overallScore: number;
}

export function TaxEconomySyncDisplay({
  taxSystem,
  economicData,
  onOptimize = () => {},
  className = ""
}: TaxEconomySyncProps) {

  // Determine economic tier based on GDP per capita
  const economicTier = useMemo((): EconomicTierRecommendation['tier'] => {
    if (!economicData?.core) return 'Emerging';
    const gdpPerCapita = economicData.core.gdpPerCapita;

    if (gdpPerCapita >= 40000) return 'Advanced';
    if (gdpPerCapita >= 20000) return 'Developed';
    if (gdpPerCapita >= 5000) return 'Emerging';
    return 'Developing';
  }, [economicData?.core]);

  // Calculate tax burden by income class
  const taxBurdenAnalysis = useMemo((): TaxBurdenAnalysis[] => {
    if (!taxSystem?.taxCategories || !economicData?.labor) {
      return [];
    }

    const averageIncome = economicData.labor.averageAnnualIncome || 50000;

    // Define income classes
    const incomeClasses = [
      {
        name: 'Low Income',
        multiplier: 0.5,
        populationPercent: 40,
        color: 'hsl(0, 84%, 60%)'
      },
      {
        name: 'Middle Income',
        multiplier: 1.0,
        populationPercent: 40,
        color: 'hsl(45, 93%, 58%)'
      },
      {
        name: 'Upper Middle Income',
        multiplier: 2.0,
        populationPercent: 15,
        color: 'hsl(160, 84%, 60%)'
      },
      {
        name: 'High Income',
        multiplier: 5.0,
        populationPercent: 5,
        color: 'hsl(217, 91%, 60%)'
      }
    ];

    return incomeClasses.map(incomeClass => {
      const income = averageIncome * incomeClass.multiplier;

      // Calculate effective tax rate from all categories
      const incomeTaxCategory = taxSystem.taxCategories?.find(
        cat => cat.categoryName.toLowerCase().includes('income') &&
               cat.categoryType.toLowerCase().includes('personal')
      );

      const salesTaxCategory = taxSystem.taxCategories?.find(
        cat => cat.categoryName.toLowerCase().includes('sales') ||
               cat.categoryName.toLowerCase().includes('vat')
      );

      // Progressive calculation based on brackets
      let incomeTaxRate = 0;
      if (incomeTaxCategory && taxSystem.taxBrackets) {
        const applicableBrackets = taxSystem.taxBrackets
          .filter(b => b.categoryId === incomeTaxCategory.id && b.isActive)
          .sort((a, b) => a.minIncome - b.minIncome);

        if (applicableBrackets.length > 0) {
          // Find highest bracket that applies
          const bracket = applicableBrackets
            .reverse()
            .find(b => income >= b.minIncome);
          incomeTaxRate = bracket?.rate || incomeTaxCategory.baseRate || 0;
        } else {
          incomeTaxRate = incomeTaxCategory.baseRate || 0;
        }
      }

      const salesTaxRate = salesTaxCategory?.baseRate || 0;

      // Total effective tax rate (income tax + sales tax on ~70% of income)
      const effectiveTaxRate = incomeTaxRate + (salesTaxRate * 0.7);
      const taxBurden = income * (effectiveTaxRate / 100);
      const disposableIncome = income - taxBurden;

      // Determine status
      let status: TaxBurdenAnalysis['status'] = 'moderate';
      if (effectiveTaxRate < 15) status = 'low';
      else if (effectiveTaxRate < 30) status = 'moderate';
      else if (effectiveTaxRate < 45) status = 'high';
      else status = 'excessive';

      return {
        incomeClass: incomeClass.name,
        averageIncome: income,
        effectiveTaxRate,
        taxBurden,
        disposableIncome,
        populationPercent: incomeClass.populationPercent,
        color: incomeClass.color,
        status
      };
    });
  }, [taxSystem, economicData?.labor]);

  // Calculate tier-based recommendations
  const tierRecommendation = useMemo((): EconomicTierRecommendation => {
    const tierConfig: Record<EconomicTierRecommendation['tier'], Omit<EconomicTierRecommendation, 'currentAlignment' | 'recommendations'>> = {
      'Developing': {
        tier: 'Developing',
        recommendedIncomeTaxRange: [10, 25],
        recommendedCorporateTaxRange: [15, 30],
        recommendedSalesTaxRange: [5, 12],
        maxTaxBurden: 25,
        color: 'hsl(0, 84%, 60%)'
      },
      'Emerging': {
        tier: 'Emerging',
        recommendedIncomeTaxRange: [15, 30],
        recommendedCorporateTaxRange: [20, 35],
        recommendedSalesTaxRange: [8, 15],
        maxTaxBurden: 35,
        color: 'hsl(45, 93%, 58%)'
      },
      'Developed': {
        tier: 'Developed',
        recommendedIncomeTaxRange: [20, 40],
        recommendedCorporateTaxRange: [20, 30],
        recommendedSalesTaxRange: [10, 20],
        maxTaxBurden: 45,
        color: 'hsl(160, 84%, 60%)'
      },
      'Advanced': {
        tier: 'Advanced',
        recommendedIncomeTaxRange: [25, 50],
        recommendedCorporateTaxRange: [18, 28],
        recommendedSalesTaxRange: [15, 25],
        maxTaxBurden: 50,
        color: 'hsl(217, 91%, 60%)'
      }
    };

    const config = tierConfig[economicTier];

    // Calculate current alignment
    let currentAlignment: EconomicTierRecommendation['currentAlignment'] = 'aligned';
    const recommendations: string[] = [];

    if (!taxSystem?.taxCategories) {
      return {
        ...config,
        currentAlignment: 'aligned',
        recommendations: ['Configure tax system to receive recommendations']
      };
    }

    const incomeTax = taxSystem.taxCategories.find(
      cat => cat.categoryName.toLowerCase().includes('income') &&
             cat.categoryType.toLowerCase().includes('personal')
    );
    const corporateTax = taxSystem.taxCategories.find(
      cat => cat.categoryName.toLowerCase().includes('corporate')
    );
    const salesTax = taxSystem.taxCategories.find(
      cat => cat.categoryName.toLowerCase().includes('sales') ||
             cat.categoryName.toLowerCase().includes('vat')
    );

    const incomeTaxRate = incomeTax?.baseRate || 0;
    const corporateTaxRate = corporateTax?.baseRate || 0;
    const salesTaxRate = salesTax?.baseRate || 0;

    // Check income tax alignment
    if (incomeTaxRate < config.recommendedIncomeTaxRange[0]) {
      currentAlignment = 'undertaxed';
      recommendations.push(
        `Consider increasing income tax from ${incomeTaxRate}% to ${config.recommendedIncomeTaxRange[0]}-${config.recommendedIncomeTaxRange[1]}% range for ${economicTier} economies`
      );
    } else if (incomeTaxRate > config.recommendedIncomeTaxRange[1]) {
      currentAlignment = 'overtaxed';
      recommendations.push(
        `Income tax rate of ${incomeTaxRate}% exceeds optimal range (${config.recommendedIncomeTaxRange[0]}-${config.recommendedIncomeTaxRange[1]}%) for ${economicTier} economies`
      );
    }

    // Check corporate tax alignment
    if (corporateTaxRate < config.recommendedCorporateTaxRange[0]) {
      recommendations.push(
        `Corporate tax rate of ${corporateTaxRate}% is below recommended range (${config.recommendedCorporateTaxRange[0]}-${config.recommendedCorporateTaxRange[1]}%)`
      );
    } else if (corporateTaxRate > config.recommendedCorporateTaxRange[1]) {
      currentAlignment = 'overtaxed';
      recommendations.push(
        `High corporate tax rate (${corporateTaxRate}%) may discourage business investment. Consider reducing to ${config.recommendedCorporateTaxRange[0]}-${config.recommendedCorporateTaxRange[1]}% range`
      );
    }

    // Check sales tax alignment
    if (salesTaxRate > config.recommendedSalesTaxRange[1]) {
      recommendations.push(
        `Sales tax rate of ${salesTaxRate}% is high. Consider reducing to ${config.recommendedSalesTaxRange[0]}-${config.recommendedSalesTaxRange[1]}% to stimulate consumer spending`
      );
    }

    // Check tax burden distribution
    const avgTaxBurden = taxBurdenAnalysis.reduce((sum, item) =>
      sum + (item.effectiveTaxRate * item.populationPercent / 100), 0
    );

    if (avgTaxBurden > config.maxTaxBurden) {
      currentAlignment = 'overtaxed';
      recommendations.push(
        `Average tax burden (${avgTaxBurden.toFixed(1)}%) exceeds recommended maximum (${config.maxTaxBurden}%) for ${economicTier} economies`
      );
    }

    // Check progressivity
    const lowIncomeBurden = taxBurdenAnalysis.find(t => t.incomeClass === 'Low Income');
    const highIncomeBurden = taxBurdenAnalysis.find(t => t.incomeClass === 'High Income');

    if (lowIncomeBurden && highIncomeBurden) {
      if (lowIncomeBurden.effectiveTaxRate >= highIncomeBurden.effectiveTaxRate) {
        recommendations.push(
          'WARNING: Tax system appears regressive. High earners should have higher effective tax rates than low earners'
        );
      } else if (highIncomeBurden.effectiveTaxRate - lowIncomeBurden.effectiveTaxRate < 10) {
        recommendations.push(
          'Consider making tax system more progressive by increasing rates for higher income brackets'
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Tax system is well-aligned with economic tier. Continue monitoring economic indicators.');
    }

    return {
      ...config,
      currentAlignment,
      recommendations
    };
  }, [economicTier, taxSystem, taxBurdenAnalysis]);

  // Calculate economic impacts
  const economicImpact = useMemo((): EconomicImpact => {
    if (!taxSystem?.taxCategories || !economicData?.core) {
      return {
        gdpGrowthImpact: 0,
        giniCoefficientChange: 0,
        businessInvestmentImpact: 'neutral',
        consumerSpendingImpact: 'neutral',
        employmentImpact: 'neutral',
        overallScore: 50
      };
    }

    const avgTaxBurden = taxBurdenAnalysis.reduce((sum, item) =>
      sum + (item.effectiveTaxRate * item.populationPercent / 100), 0
    );

    const corporateTax = taxSystem.taxCategories.find(
      cat => cat.categoryName.toLowerCase().includes('corporate')
    );
    const corporateTaxRate = corporateTax?.baseRate || 0;

    const salesTax = taxSystem.taxCategories.find(
      cat => cat.categoryName.toLowerCase().includes('sales') ||
             cat.categoryName.toLowerCase().includes('vat')
    );
    const salesTaxRate = salesTax?.baseRate || 0;

    // GDP growth impact (higher taxes = lower growth, but non-linear)
    const optimalTaxBurden = tierRecommendation.maxTaxBurden * 0.8;
    const taxBurdenDiff = avgTaxBurden - optimalTaxBurden;
    const gdpGrowthImpact = -taxBurdenDiff * 0.15; // -0.15% GDP growth per 1% excess tax

    // Gini coefficient change (progressive taxes reduce inequality)
    const progressivity = taxBurdenAnalysis.length >= 2
      ? taxBurdenAnalysis[taxBurdenAnalysis.length - 1].effectiveTaxRate - taxBurdenAnalysis[0].effectiveTaxRate
      : 0;
    const giniCoefficientChange = -progressivity * 0.05; // More progressive = lower Gini

    // Business investment impact
    let businessInvestmentImpact: EconomicImpact['businessInvestmentImpact'] = 'neutral';
    if (corporateTaxRate < tierRecommendation.recommendedCorporateTaxRange[0]) {
      businessInvestmentImpact = 'positive';
    } else if (corporateTaxRate > tierRecommendation.recommendedCorporateTaxRange[1]) {
      businessInvestmentImpact = 'negative';
    }

    // Consumer spending impact
    let consumerSpendingImpact: EconomicImpact['consumerSpendingImpact'] = 'neutral';
    if (salesTaxRate > tierRecommendation.recommendedSalesTaxRange[1] || avgTaxBurden > tierRecommendation.maxTaxBurden) {
      consumerSpendingImpact = 'negative';
    } else if (salesTaxRate < tierRecommendation.recommendedSalesTaxRange[0] && avgTaxBurden < optimalTaxBurden) {
      consumerSpendingImpact = 'positive';
    }

    // Employment impact
    let employmentImpact: EconomicImpact['employmentImpact'] = 'neutral';
    if (corporateTaxRate > tierRecommendation.recommendedCorporateTaxRange[1] + 5) {
      employmentImpact = 'negative';
    } else if (corporateTaxRate < tierRecommendation.recommendedCorporateTaxRange[0]) {
      employmentImpact = 'positive';
    }

    // Overall score (0-100)
    let overallScore = 50;
    if (tierRecommendation.currentAlignment === 'aligned') overallScore += 25;
    else if (tierRecommendation.currentAlignment === 'overtaxed') overallScore -= 15;
    else overallScore -= 10;

    if (businessInvestmentImpact === 'positive') overallScore += 10;
    else if (businessInvestmentImpact === 'negative') overallScore -= 10;

    if (consumerSpendingImpact === 'positive') overallScore += 10;
    else if (consumerSpendingImpact === 'negative') overallScore -= 10;

    if (progressivity > 15) overallScore += 5; // Bonus for progressive system

    return {
      gdpGrowthImpact,
      giniCoefficientChange,
      businessInvestmentImpact,
      consumerSpendingImpact,
      employmentImpact,
      overallScore: Math.max(0, Math.min(100, overallScore))
    };
  }, [taxSystem, economicData, taxBurdenAnalysis, tierRecommendation]);

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  const getImpactIcon = (impact: 'positive' | 'neutral' | 'negative') => {
    if (impact === 'positive') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (impact === 'negative') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getImpactColor = (impact: 'positive' | 'neutral' | 'negative') => {
    if (impact === 'positive') return 'text-green-600 dark:text-green-400';
    if (impact === 'negative') return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (!taxSystem || !economicData?.core) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Configure tax system and economic data to view economic impact analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Overall Score */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Scale className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">Tax System Economic Impact</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Analysis for {economicTier} economy (GDP/capita: {formatCurrency(economicData.core.gdpPerCapita)})
                </p>
              </div>
            </div>

            <Button
              onClick={onOptimize}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Optimize
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Economic Health Score</span>
                <span className="text-2xl font-bold" style={{ color: tierRecommendation.color }}>
                  {economicImpact.overallScore.toFixed(0)}/100
                </span>
              </div>
              <Progress
                value={economicImpact.overallScore}
                className="h-3"
                style={{
                  // @ts-ignore - Custom CSS variable
                  '--progress-background': tierRecommendation.color
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                <div className="text-xs text-muted-foreground mb-1">Economic Tier</div>
                <Badge style={{ backgroundColor: tierRecommendation.color }}>
                  {economicTier}
                </Badge>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                <div className="text-xs text-muted-foreground mb-1">Tax Alignment</div>
                <Badge variant={
                  tierRecommendation.currentAlignment === 'aligned' ? 'default' :
                  tierRecommendation.currentAlignment === 'overtaxed' ? 'destructive' : 'secondary'
                }>
                  {tierRecommendation.currentAlignment}
                </Badge>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                <div className="text-xs text-muted-foreground mb-1">GDP Impact</div>
                <div className={`font-semibold ${economicImpact.gdpGrowthImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {economicImpact.gdpGrowthImpact >= 0 ? '+' : ''}{formatPercentage(economicImpact.gdpGrowthImpact)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {tierRecommendation.currentAlignment === 'overtaxed' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>High Tax Burden Warning:</strong> Current tax rates exceed recommended levels for {economicTier} economies,
            potentially limiting economic growth and competitiveness.
          </AlertDescription>
        </Alert>
      )}

      {taxBurdenAnalysis.some(t => t.status === 'excessive') && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Excessive Tax Burden:</strong> Some income classes face tax rates above 45%, which may drive tax evasion
            and capital flight.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="burden" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="burden">Tax Burden</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="impacts">Economic Impacts</TabsTrigger>
          <TabsTrigger value="benchmarks">Tier Benchmarks</TabsTrigger>
        </TabsList>

        {/* Tax Burden by Income Class */}
        <TabsContent value="burden" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Tax Burden Distribution by Income Class
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {taxBurdenAnalysis.map((burden, index) => (
                <motion.div
                  key={burden.incomeClass}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-lg border bg-gradient-to-r from-white/50 to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-lg flex items-center gap-2">
                        {burden.incomeClass}
                        <Badge
                          variant={
                            burden.status === 'low' ? 'default' :
                            burden.status === 'moderate' ? 'secondary' :
                            burden.status === 'high' ? 'outline' : 'destructive'
                          }
                        >
                          {burden.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {burden.populationPercent}% of population
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: burden.color }}>
                        {formatPercentage(burden.effectiveTaxRate)}
                      </div>
                      <div className="text-xs text-muted-foreground">Effective Rate</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Progress value={burden.effectiveTaxRate} className="h-2" />

                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Average Income</div>
                        <div className="font-semibold">{formatCurrency(burden.averageIncome)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tax Burden</div>
                        <div className="font-semibold text-red-600">{formatCurrency(burden.taxBurden)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Disposable Income</div>
                        <div className="font-semibold text-green-600">{formatCurrency(burden.disposableIncome)}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Progressivity Analysis */}
              {taxBurdenAnalysis.length >= 2 && (
                <Alert>
                  <Scale className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Progressivity Analysis:</strong> Tax rate increases from{' '}
                    {formatPercentage(taxBurdenAnalysis[0].effectiveTaxRate)} (low income) to{' '}
                    {formatPercentage(taxBurdenAnalysis[taxBurdenAnalysis.length - 1].effectiveTaxRate)} (high income).
                    {taxBurdenAnalysis[0].effectiveTaxRate >= taxBurdenAnalysis[taxBurdenAnalysis.length - 1].effectiveTaxRate && (
                      <span className="text-red-600 font-semibold"> WARNING: System is regressive!</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Tier-Based Policy Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tierRecommendation.recommendations.map((rec, index) => (
                <Alert
                  key={index}
                  variant={rec.includes('WARNING') ? 'destructive' : 'default'}
                >
                  {rec.includes('WARNING') ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : tierRecommendation.currentAlignment === 'aligned' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  <AlertDescription>{rec}</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Economic Impacts */}
        <TabsContent value="impacts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GDP Impact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  GDP Growth Projection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${economicImpact.gdpGrowthImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {economicImpact.gdpGrowthImpact >= 0 ? '+' : ''}{formatPercentage(economicImpact.gdpGrowthImpact)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Estimated impact on annual GDP growth from current tax policy
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Inequality Impact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="h-4 w-4" />
                  Income Inequality Effect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${economicImpact.giniCoefficientChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {economicImpact.giniCoefficientChange >= 0 ? '+' : ''}{economicImpact.giniCoefficientChange.toFixed(1)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Change in Gini coefficient (lower is better)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Business Investment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Business Investment Climate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {getImpactIcon(economicImpact.businessInvestmentImpact)}
                    <span className={`text-2xl font-bold capitalize ${getImpactColor(economicImpact.businessInvestmentImpact)}`}>
                      {economicImpact.businessInvestmentImpact}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Impact on business investment and expansion
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Consumer Spending */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-4 w-4" />
                  Consumer Spending Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {getImpactIcon(economicImpact.consumerSpendingImpact)}
                    <span className={`text-2xl font-bold capitalize ${getImpactColor(economicImpact.consumerSpendingImpact)}`}>
                      {economicImpact.consumerSpendingImpact}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Impact on household consumption and demand
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employment Impact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employment Impact Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-white/50 to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
                <div>
                  <div className="font-semibold mb-1">Overall Employment Outlook</div>
                  <p className="text-sm text-muted-foreground">
                    Based on corporate tax rates and business climate
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {getImpactIcon(economicImpact.employmentImpact)}
                  <span className={`text-2xl font-bold capitalize ${getImpactColor(economicImpact.employmentImpact)}`}>
                    {economicImpact.employmentImpact}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tier Benchmarks */}
        <TabsContent value="benchmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {economicTier} Economy Benchmarks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Income Tax Benchmark */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Personal Income Tax</span>
                  <span className="text-sm text-muted-foreground">
                    Recommended: {formatPercentage(tierRecommendation.recommendedIncomeTaxRange[0])} - {formatPercentage(tierRecommendation.recommendedIncomeTaxRange[1])}
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={(tierRecommendation.recommendedIncomeTaxRange[0] + tierRecommendation.recommendedIncomeTaxRange[1]) / 2}
                    className="h-3"
                  />
                  {taxSystem.taxCategories?.find(cat => cat.categoryName.toLowerCase().includes('income')) && (
                    <div
                      className="absolute top-0 w-1 h-3 bg-red-500"
                      style={{
                        left: `${(taxSystem.taxCategories.find(cat => cat.categoryName.toLowerCase().includes('income'))?.baseRate || 0)}%`
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Corporate Tax Benchmark */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Corporate Income Tax</span>
                  <span className="text-sm text-muted-foreground">
                    Recommended: {formatPercentage(tierRecommendation.recommendedCorporateTaxRange[0])} - {formatPercentage(tierRecommendation.recommendedCorporateTaxRange[1])}
                  </span>
                </div>
                <Progress
                  value={(tierRecommendation.recommendedCorporateTaxRange[0] + tierRecommendation.recommendedCorporateTaxRange[1]) / 2}
                  className="h-3"
                />
              </div>

              {/* Sales Tax Benchmark */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Sales Tax / VAT</span>
                  <span className="text-sm text-muted-foreground">
                    Recommended: {formatPercentage(tierRecommendation.recommendedSalesTaxRange[0])} - {formatPercentage(tierRecommendation.recommendedSalesTaxRange[1])}
                  </span>
                </div>
                <Progress
                  value={(tierRecommendation.recommendedSalesTaxRange[0] + tierRecommendation.recommendedSalesTaxRange[1]) / 2}
                  className="h-3"
                />
              </div>

              {/* Max Tax Burden */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Maximum Recommended Tax Burden</span>
                  <span className="text-2xl font-bold" style={{ color: tierRecommendation.color }}>
                    {formatPercentage(tierRecommendation.maxTaxBurden)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total effective tax rate across all income levels should not exceed this threshold
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  These benchmarks are based on international best practices for {economicTier} economies.
                  Adjust based on your country's specific circumstances, social priorities, and development goals.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
