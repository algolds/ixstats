"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Button } from "~/components/ui/button";
import {
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Users,
  DollarSign,
  Building2,
  Shield,
  Zap,
  Lightbulb,
  AlertCircle,
  Clock,
  Star,
  Activity,
  Globe,
  Crown,
  Scale,
} from "lucide-react";

import type {
  UnifiedEffectivenessAnalysis,
  UnifiedEffectivenessMetrics,
  EffectivenessBreakdown,
  OptimizationRecommendation,
} from "../../services/UnifiedEffectivenessCalculator";

interface UnifiedEffectivenessDisplayProps {
  analysis?: UnifiedEffectivenessAnalysis;
  onRecalculate?: () => void;
  className?: string;
}

const DEFAULT_ANALYSIS: UnifiedEffectivenessAnalysis = {
  metrics: {
    overallScore: 0,
    economyScore: 0,
    governmentScore: 0,
    taxScore: 0,
    synergyBonus: 0,
    conflictPenalty: 0,
    optimizationPotential: 0,
    stabilityIndex: 0,
    growthPotential: 0,
    competitivenessIndex: 0,
  },
  breakdown: {
    baseEffectiveness: 0,
    componentSynergies: 0,
    crossBuilderSynergies: 0,
    conflictPenalties: 0,
    optimizationBonuses: 0,
    stabilityFactors: 0,
    growthFactors: 0,
    competitivenessFactors: 0,
  },
  recommendations: [],
  riskFactors: [],
  strengths: [],
  weaknesses: [],
  lastCalculated: Date.now(),
  confidence: 0,
  // Additional required properties from UnifiedEffectivenessAnalysis type
  overallEffectivenessScore: 0,
  economyEffectiveness: 0,
  governmentEffectiveness: 0,
  taxEffectiveness: 0,
  crossBuilderSynergyScore: 0,
  optimizationRecommendations: [],
};

export function UnifiedEffectivenessDisplay({
  analysis = DEFAULT_ANALYSIS,
  onRecalculate = () => {},
  className = "",
}: UnifiedEffectivenessDisplayProps) {
  const { metrics, breakdown, recommendations, riskFactors, strengths, weaknesses, confidence } =
    analysis || DEFAULT_ANALYSIS;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default" as const;
    if (score >= 60) return "secondary" as const;
    if (score >= 40) return "outline" as const;
    return "destructive" as const;
  };

  const getPriorityColor = (priority: "critical" | "high" | "medium" | "low") => {
    switch (priority) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "low":
        return "text-green-600 dark:text-green-400";
    }
  };

  const getPriorityBadgeVariant = (priority: "critical" | "high" | "medium" | "low") => {
    switch (priority) {
      case "critical":
        return "destructive" as const;
      case "high":
        return "destructive" as const;
      case "medium":
        return "secondary" as const;
      case "low":
        return "default" as const;
    }
  };

  const getTimeToImplementColor = (timeToImplement: string) => {
    switch (timeToImplement) {
      case "immediate":
        return "text-red-600 dark:text-red-400";
      case "short_term":
        return "text-orange-600 dark:text-orange-400";
      case "medium_term":
        return "text-yellow-600 dark:text-yellow-400";
      case "long_term":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const formatTimeToImplement = (timeToImplement: string) => {
    switch (timeToImplement) {
      case "immediate":
        return "Immediate";
      case "short_term":
        return "1-3 months";
      case "medium_term":
        return "3-12 months";
      case "long_term":
        return "1+ years";
      default:
        return "Unknown";
    }
  };

  const getSystemIcon = (system: string) => {
    switch (system) {
      case "economy":
        return DollarSign;
      case "government":
        return Building2;
      case "tax":
        return Scale;
      case "cross_builder":
        return Zap;
      default:
        return Target;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Overall Score */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/20">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">
                  Unified Effectiveness Analysis
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Comprehensive cross-builder effectiveness scoring
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {metrics.overallScore.toFixed(0)}%
                </div>
                <div className="text-muted-foreground text-sm">Overall Effectiveness</div>
                <div className="text-muted-foreground text-xs">{confidence}% confidence</div>
              </div>

              <Button onClick={onRecalculate} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalculate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={metrics.overallScore} className="h-3" />
        </CardContent>
      </Card>

      {/* System Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>System Effectiveness Scores</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Economy Score */}
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium">Economy</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(metrics.economyScore)}`}>
                {metrics.economyScore.toFixed(0)}%
              </div>
              <Progress value={metrics.economyScore} className="mt-2 h-2" />
            </div>

            {/* Government Score */}
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center space-x-2">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">Government</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(metrics.governmentScore)}`}>
                {metrics.governmentScore.toFixed(0)}%
              </div>
              <Progress value={metrics.governmentScore} className="mt-2 h-2" />
            </div>

            {/* Tax Score */}
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center space-x-2">
                <Scale className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="font-medium">Tax System</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(metrics.taxScore)}`}>
                {metrics.taxScore.toFixed(0)}%
              </div>
              <Progress value={metrics.taxScore} className="mt-2 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Advanced Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center space-x-1">
                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Growth Potential</span>
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.growthPotential)}`}>
                {metrics.growthPotential.toFixed(0)}%
              </div>
            </div>
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center space-x-1">
                <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Stability Index</span>
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.stabilityIndex)}`}>
                {metrics.stabilityIndex.toFixed(0)}%
              </div>
            </div>
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center space-x-1">
                <Globe className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Competitiveness</span>
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.competitivenessIndex)}`}>
                {metrics.competitivenessIndex.toFixed(0)}%
              </div>
            </div>
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center space-x-1">
                <Lightbulb className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Optimization</span>
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.optimizationPotential)}`}>
                {metrics.optimizationPotential.toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Effectiveness Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>Effectiveness Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                  Base Effectiveness
                </div>
                <div className="text-lg font-bold">{breakdown.baseEffectiveness.toFixed(0)}%</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                  Component Synergies
                </div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  +{breakdown.componentSynergies.toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                  Cross-Builder Synergies
                </div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  +{breakdown.crossBuilderSynergies.toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                  Conflict Penalties
                </div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  -{breakdown.conflictPenalties.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span>Optimization Recommendations ({recommendations.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((recommendation) => {
                const SystemIcon = getSystemIcon(recommendation.type);

                return (
                  <motion.div
                    key={recommendation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <SystemIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="font-medium text-yellow-900 dark:text-yellow-100">
                          {recommendation.title}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getPriorityBadgeVariant(recommendation.priority)}>
                          {recommendation.priority} priority
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="mr-1 h-3 w-3" />
                          {formatTimeToImplement(recommendation.timeToImplement)}
                        </Badge>
                        <Badge variant="outline">
                          +{recommendation.expectedImprovement}% improvement
                        </Badge>
                      </div>
                    </div>

                    <p className="mb-3 text-sm text-yellow-800 dark:text-yellow-200">
                      {recommendation.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 md:grid-cols-4 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Implementation Cost:</span>
                        <div>₡{recommendation.implementationCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="font-medium">Affected Systems:</span>
                        <div>{recommendation.affectedSystems.join(", ")}</div>
                      </div>
                      <div>
                        <span className="font-medium">Requirements:</span>
                        <div>{recommendation.requirements.length} items</div>
                      </div>
                      <div>
                        <span className="font-medium">Expected ROI:</span>
                        <div className="text-green-600 dark:text-green-400">
                          {(
                            (recommendation.expectedImprovement /
                              (recommendation.implementationCost / 100000)) *
                            100
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Strengths */}
        {strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>Strengths ({strengths.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {strengths.map((strength, index) => (
                  <Alert key={index}>
                    <Star className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-sm">{strength}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <span>Areas for Improvement ({weaknesses.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {weaknesses.map((weakness, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{weakness}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Risk Factors */}
      {riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span>Risk Factors ({riskFactors.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskFactors.map((risk, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{risk}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
