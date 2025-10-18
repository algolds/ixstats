"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Separator } from '~/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  Shield,
  DollarSign,
  BarChart3,
  Users,
  Building2,
  ArrowUpDown,
  Lightbulb,
  Eye,
  AlertCircle,
  Sparkles,
  Activity,
  PieChart,
  Scale
} from 'lucide-react';

import type { TaxSystem, TaxCategory } from '~/types/tax-system';
import type { ComponentType } from '~/types/government';
import type { CoreEconomicIndicatorsData } from '~/types/economics';
import {
  calculateAtomicTaxEffectiveness,
  getAtomicTaxRecommendations,
  TAX_EFFECTIVENESS_MODIFIERS
} from '~/lib/atomic-tax-integration';

interface TaxComponent {
  id: string;
  type: string;
  name: string;
  effectiveness: number;
}

interface GovernmentComponent {
  id: string;
  type: ComponentType;
  name: string;
  effectiveness: number;
}

interface UnifiedTaxEffectivenessDisplayProps {
  taxComponents?: TaxComponent[];
  governmentComponents?: GovernmentComponent[];
  economicData?: CoreEconomicIndicatorsData;
  taxSystem?: TaxSystem;
  onViewDetails?: () => void;
  className?: string;
}

interface EconomicImpact {
  gdpGrowthEffect: number;
  inequalityEffect: number;
  investmentEffect: number;
  spendingEffect: number;
}

interface UnifiedEffectiveness {
  overallScore: number;
  collectionEfficiency: number;
  complianceRate: number;
  auditCapacity: number;
  synergies: string[];
  conflicts: string[];
  economicImpact: EconomicImpact;
  governmentIntegration: {
    digitalInfrastructure: boolean;
    enforcementCapacity: number;
    institutionalQuality: number;
    administrativeEfficiency: number;
  };
}

export function UnifiedTaxEffectivenessDisplay({
  taxComponents = [],
  governmentComponents = [],
  economicData,
  taxSystem,
  onViewDetails,
  className = ""
}: UnifiedTaxEffectivenessDisplayProps) {

  // Calculate unified effectiveness from all three builders
  const unifiedEffectiveness = React.useMemo<UnifiedEffectiveness>(() => {
    // Base tax system metrics
    const baseTaxSystem = {
      collectionEfficiency: taxSystem?.collectionEfficiency || 65,
      complianceRate: taxSystem?.complianceRate || 70,
      auditCapacity: 50
    };

    // Get atomic tax effectiveness from government components
    const componentTypes = governmentComponents.map(c => c.type);
    const atomicEffectiveness = calculateAtomicTaxEffectiveness(componentTypes, baseTaxSystem);
    const recommendations = getAtomicTaxRecommendations(componentTypes);

    // Calculate tax component contribution
    const taxComponentBonus = taxComponents.length > 0
      ? (taxComponents.reduce((sum, c) => sum + c.effectiveness, 0) / taxComponents.length) * 0.1
      : 0;

    // Calculate economic impact
    const baseGDP = economicData?.nominalGDP || 1000000000;
    const baseGrowth = economicData?.realGDPGrowthRate || 0.03;
    const baseInequality = economicData?.giniCoefficient || 40;

    const economicImpact: EconomicImpact = {
      gdpGrowthEffect: baseGrowth * (atomicEffectiveness.effectivenessScore / 100) * 1.2,
      inequalityEffect: baseInequality - (atomicEffectiveness.complianceRate / 100) * 5,
      investmentEffect: (atomicEffectiveness.collectionEfficiency / 100) * 15,
      spendingEffect: (atomicEffectiveness.effectivenessScore / 100) * 20
    };

    // Check for government integration benefits
    const hasDigitalInfrastructure = componentTypes.includes('DIGITAL_GOVERNMENT' as ComponentType) ||
                                      componentTypes.includes('DIGITAL_INFRASTRUCTURE' as ComponentType);
    const hasProfessionalBureaucracy = componentTypes.includes('PROFESSIONAL_BUREAUCRACY' as ComponentType);
    const hasTechnocraticAgencies = componentTypes.includes('TECHNOCRATIC_AGENCIES' as ComponentType);
    const hasRuleOfLaw = componentTypes.includes('RULE_OF_LAW' as ComponentType);

    const governmentIntegration = {
      digitalInfrastructure: hasDigitalInfrastructure,
      enforcementCapacity: (hasProfessionalBureaucracy ? 30 : 0) + (hasRuleOfLaw ? 25 : 0) + 45,
      institutionalQuality: (hasProfessionalBureaucracy ? 25 : 0) + (hasTechnocraticAgencies ? 30 : 0) + 45,
      administrativeEfficiency: (hasDigitalInfrastructure ? 35 : 0) + (hasProfessionalBureaucracy ? 20 : 0) + 45
    };

    return {
      overallScore: Math.min(100, atomicEffectiveness.effectivenessScore + taxComponentBonus),
      collectionEfficiency: atomicEffectiveness.collectionEfficiency,
      complianceRate: atomicEffectiveness.complianceRate,
      auditCapacity: atomicEffectiveness.auditCapacity,
      synergies: atomicEffectiveness.synergies,
      conflicts: atomicEffectiveness.conflicts,
      economicImpact,
      governmentIntegration
    };
  }, [taxComponents, governmentComponents, economicData, taxSystem]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Helper functions
  const getEffectivenessColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getEffectivenessBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (score >= 60) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const getEffectivenessLabel = (score: number) => {
    if (score >= 90) return 'Exceptional';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 50) return 'Needs Work';
    return 'Critical';
  };

  const getTrendIcon = (value: number, threshold: number = 0) => {
    if (value > threshold) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < threshold) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
  };

  return (
    <TooltipProvider>
      <motion.div
        className={`space-y-6 ${className}`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Overall Effectiveness Gauge */}
        <motion.div variants={itemVariants}>
          <Card className={`border-2 ${getEffectivenessBgColor(unifiedEffectiveness.overallScore)}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                    <Target className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold">Unified Tax Effectiveness</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cross-builder synergy analysis with economic impact
                    </p>
                  </div>
                </div>
                {onViewDetails && (
                  <Button onClick={onViewDetails} variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Overall Score - Prominent Display */}
                <div className="md:col-span-2 flex flex-col items-center justify-center space-y-3 p-6 rounded-xl bg-gradient-to-br from-white/50 to-transparent dark:from-gray-800/50 backdrop-blur-sm">
                  <div className="relative">
                    <svg className="w-40 h-40 transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 70}`}
                        strokeDashoffset={`${2 * Math.PI * 70 * (1 - unifiedEffectiveness.overallScore / 100)}`}
                        className={getEffectivenessColor(unifiedEffectiveness.overallScore)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <div className={`text-5xl font-bold ${getEffectivenessColor(unifiedEffectiveness.overallScore)}`}>
                        {Math.round(unifiedEffectiveness.overallScore)}
                      </div>
                      <div className="text-sm text-muted-foreground">out of 100</div>
                    </div>
                  </div>
                  <Badge
                    variant={unifiedEffectiveness.overallScore >= 80 ? "default" : unifiedEffectiveness.overallScore >= 60 ? "secondary" : "destructive"}
                    className="text-lg px-4 py-1"
                  >
                    {getEffectivenessLabel(unifiedEffectiveness.overallScore)}
                  </Badge>
                </div>

                {/* Key Metrics Grid */}
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Collection Efficiency */}
                  <motion.div
                    className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      {getTrendIcon(unifiedEffectiveness.collectionEfficiency, 70)}
                    </div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {Math.round(unifiedEffectiveness.collectionEfficiency)}%
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                      Collection Efficiency
                    </div>
                    <Progress
                      value={unifiedEffectiveness.collectionEfficiency}
                      className="h-2 bg-blue-100 dark:bg-blue-950"
                    />
                  </motion.div>

                  {/* Compliance Rate */}
                  <motion.div
                    className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      {getTrendIcon(unifiedEffectiveness.complianceRate, 70)}
                    </div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                      {Math.round(unifiedEffectiveness.complianceRate)}%
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">
                      Compliance Rate
                    </div>
                    <Progress
                      value={unifiedEffectiveness.complianceRate}
                      className="h-2 bg-green-100 dark:bg-green-950"
                    />
                  </motion.div>

                  {/* Audit Capacity */}
                  <motion.div
                    className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      {getTrendIcon(unifiedEffectiveness.auditCapacity, 60)}
                    </div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                      {Math.round(unifiedEffectiveness.auditCapacity)}%
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-2">
                      Audit Capacity
                    </div>
                    <Progress
                      value={unifiedEffectiveness.auditCapacity}
                      className="h-2 bg-purple-100 dark:bg-purple-950"
                    />
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Synergies and Conflicts */}
        {(unifiedEffectiveness.synergies.length > 0 || unifiedEffectiveness.conflicts.length > 0) && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  <span>Active Synergies & Conflicts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Synergies */}
                  {unifiedEffectiveness.synergies.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="flex items-center space-x-2 text-sm font-semibold text-green-700 dark:text-green-400">
                        <TrendingUp className="h-4 w-4" />
                        <span>Positive Synergies ({unifiedEffectiveness.synergies.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {unifiedEffectiveness.synergies.map((synergy, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start space-x-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-green-800 dark:text-green-300">{synergy}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {unifiedEffectiveness.conflicts.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="flex items-center space-x-2 text-sm font-semibold text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Detected Conflicts ({unifiedEffectiveness.conflicts.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {unifiedEffectiveness.conflicts.map((conflict, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start space-x-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                          >
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-red-800 dark:text-red-300">{conflict}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommended Fixes */}
                {unifiedEffectiveness.conflicts.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <Alert>
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Recommendation:</strong> Review conflicting government components and consider adjusting your system
                        to maximize synergies. Components like Professional Bureaucracy + Rule of Law create optimal tax administration.
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabbed Content: Economic Impact & Government Integration */}
        <motion.div variants={itemVariants}>
          <Card>
            <Tabs defaultValue="economic" className="w-full">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="economic" className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Economic Impact</span>
                  </TabsTrigger>
                  <TabsTrigger value="government" className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4" />
                    <span>Government Integration</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                {/* Economic Impact Tab */}
                <TabsContent value="economic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GDP Growth Effect */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 cursor-help">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <span className="font-medium text-blue-900 dark:text-blue-100">GDP Growth</span>
                            </div>
                            <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                              {unifiedEffectiveness.economicImpact.gdpGrowthEffect > 0 ? '+' : ''}
                              {(unifiedEffectiveness.economicImpact.gdpGrowthEffect * 100).toFixed(2)}%
                            </Badge>
                          </div>
                          <Progress
                            value={Math.min(100, Math.abs(unifiedEffectiveness.economicImpact.gdpGrowthEffect * 100 / 0.05))}
                            className="h-2"
                          />
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                            Tax effectiveness contributes to economic growth
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Effective tax collection enables government investment in infrastructure and services, promoting GDP growth.</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Inequality Effect */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 cursor-help">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Scale className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <span className="font-medium text-green-900 dark:text-green-100">Inequality (Gini)</span>
                            </div>
                            <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                              {unifiedEffectiveness.economicImpact.inequalityEffect.toFixed(1)}
                            </Badge>
                          </div>
                          <Progress
                            value={Math.min(100, (100 - unifiedEffectiveness.economicImpact.inequalityEffect))}
                            className="h-2"
                          />
                          <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                            High compliance reduces inequality through redistribution
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Progressive taxation with high compliance reduces income inequality (lower Gini coefficient is better).</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Investment Effect */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 cursor-help">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              <span className="font-medium text-purple-900 dark:text-purple-100">Investment Climate</span>
                            </div>
                            <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                              {unifiedEffectiveness.economicImpact.investmentEffect.toFixed(1)}%
                            </Badge>
                          </div>
                          <Progress
                            value={Math.min(100, unifiedEffectiveness.economicImpact.investmentEffect * 5)}
                            className="h-2"
                          />
                          <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
                            Efficient tax collection improves investor confidence
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Predictable and efficient tax systems attract domestic and foreign investment.</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Spending Capacity */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 cursor-help">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <PieChart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                              <span className="font-medium text-amber-900 dark:text-amber-100">Spending Capacity</span>
                            </div>
                            <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50">
                              {unifiedEffectiveness.economicImpact.spendingEffect.toFixed(1)}%
                            </Badge>
                          </div>
                          <Progress
                            value={Math.min(100, unifiedEffectiveness.economicImpact.spendingEffect * 5)}
                            className="h-2"
                          />
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                            Revenue enables government service delivery
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Higher tax effectiveness directly increases government spending capacity for public services.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TabsContent>

                {/* Government Integration Tab */}
                <TabsContent value="government" className="space-y-4">
                  <div className="space-y-4">
                    {/* Digital Infrastructure */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${unifiedEffectiveness.governmentIntegration.digitalInfrastructure ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-gray-800'}`}>
                          <Zap className={`h-5 w-5 ${unifiedEffectiveness.governmentIntegration.digitalInfrastructure ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <div className="font-medium">Digital Infrastructure</div>
                          <div className="text-sm text-muted-foreground">
                            Automated tax filing and payment systems
                          </div>
                        </div>
                      </div>
                      {unifiedEffectiveness.governmentIntegration.digitalInfrastructure ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not Active
                        </Badge>
                      )}
                    </div>

                    {/* Enforcement Capacity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-medium">Enforcement Capacity</span>
                        </div>
                        <Badge variant="outline">
                          {Math.round(unifiedEffectiveness.governmentIntegration.enforcementCapacity)}%
                        </Badge>
                      </div>
                      <Progress
                        value={unifiedEffectiveness.governmentIntegration.enforcementCapacity}
                        className="h-3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Government's ability to enforce tax compliance and prosecute evasion
                      </p>
                    </div>

                    {/* Institutional Quality */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <span className="font-medium">Institutional Quality</span>
                        </div>
                        <Badge variant="outline">
                          {Math.round(unifiedEffectiveness.governmentIntegration.institutionalQuality)}%
                        </Badge>
                      </div>
                      <Progress
                        value={unifiedEffectiveness.governmentIntegration.institutionalQuality}
                        className="h-3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Quality and professionalism of tax administration institutions
                      </p>
                    </div>

                    {/* Administrative Efficiency */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <span className="font-medium">Administrative Efficiency</span>
                        </div>
                        <Badge variant="outline">
                          {Math.round(unifiedEffectiveness.governmentIntegration.administrativeEfficiency)}%
                        </Badge>
                      </div>
                      <Progress
                        value={unifiedEffectiveness.governmentIntegration.administrativeEfficiency}
                        className="h-3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Speed and cost-effectiveness of tax administration processes
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Integration Benefits:</strong> Government components directly impact tax system effectiveness.
                      Add Digital Infrastructure or Professional Bureaucracy to maximize collection efficiency.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </motion.div>

        {/* Summary Alerts */}
        {unifiedEffectiveness.overallScore < 60 && (
          <motion.div variants={itemVariants}>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical Tax Effectiveness:</strong> Your tax system effectiveness is below 60%.
                Consider adding government components like Professional Bureaucracy or Rule of Law to improve collection and compliance.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {unifiedEffectiveness.overallScore >= 80 && (
          <motion.div variants={itemVariants}>
            <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                <strong>Excellent Tax System:</strong> Your unified tax effectiveness is {Math.round(unifiedEffectiveness.overallScore)}%.
                This configuration maximizes revenue collection while maintaining high compliance.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* No Components Warning */}
        {governmentComponents.length === 0 && taxComponents.length === 0 && (
          <motion.div variants={itemVariants}>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No government or tax components detected. Build your government structure and tax system to see unified effectiveness metrics.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
