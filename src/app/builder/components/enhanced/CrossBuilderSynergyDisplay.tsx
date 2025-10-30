"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  DollarSign,
  Building2,
  Users,
  BarChart3,
  PieChart,
  Lightbulb,
  AlertCircle,
} from "lucide-react";

import type {
  CrossBuilderAnalysis,
  CrossBuilderSynergy,
} from "../../services/CrossBuilderSynergyService";

interface CrossBuilderSynergyDisplayProps {
  analysis?: CrossBuilderAnalysis;
  className?: string;
}

const DEFAULT_ANALYSIS: CrossBuilderAnalysis = {
  synergies: [],
  conflicts: [],
  overallScore: 0,
  optimizationOpportunities: [],
  riskFactors: [],
  unifiedEffectiveness: 0,
  // Additional required properties from CrossBuilderAnalysis type
  overallCrossBuilderScore: 0,
  recommendations: [],
};

export function CrossBuilderSynergyDisplay({
  analysis = DEFAULT_ANALYSIS,
  className = "",
}: CrossBuilderSynergyDisplayProps) {
  const {
    synergies,
    conflicts,
    overallScore,
    optimizationOpportunities,
    riskFactors,
    unifiedEffectiveness,
  } = analysis || DEFAULT_ANALYSIS;

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

  const getSynergyIcon = (synergy: CrossBuilderSynergy) => {
    switch (synergy.type) {
      case "economy-government":
      case "government-economy":
        return Building2;
      case "economy-tax":
      case "tax-economy":
        return DollarSign;
      default:
        return Zap;
    }
  };

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return TrendingUp;
    if (impact < 0) return TrendingDown;
    return Target;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return "text-green-600 dark:text-green-400";
    if (impact < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Score Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Cross-Builder Integration Score</span>
            </div>
            <Badge variant={getScoreBadgeVariant(overallScore)} className="px-3 py-1 text-lg">
              {overallScore.toFixed(0)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Overall Score */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Integration Score</span>
                <span className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore.toFixed(0)}%
                </span>
              </div>
              <Progress value={overallScore} className="h-2" />
            </div>

            {/* Unified Effectiveness */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Unified Effectiveness</span>
                <span className={`text-lg font-bold ${getScoreColor(unifiedEffectiveness)}`}>
                  {unifiedEffectiveness.toFixed(0)}%
                </span>
              </div>
              <Progress value={unifiedEffectiveness} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Synergies Section */}
      {synergies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Synergies ({synergies.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {synergies.map((synergy) => {
                const SynergyIcon = getSynergyIcon(synergy);
                return (
                  <motion.div
                    key={synergy.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <SynergyIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {synergy.description}
                        </span>
                      </div>
                      <Badge variant="default" className="bg-green-600 text-white">
                        +{synergy.strength.toFixed(0)}%
                      </Badge>
                    </div>

                    {/* Impact Metrics */}
                    <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Target className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Effectiveness
                          </span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(synergy.impact.effectiveness)}`}
                        >
                          {synergy.impact.effectiveness > 0 ? "+" : ""}
                          {synergy.impact.effectiveness.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Growth</span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(synergy.impact.economicGrowth)}`}
                        >
                          {synergy.impact.economicGrowth > 0 ? "+" : ""}
                          {synergy.impact.economicGrowth.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Tax Efficiency
                          </span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(synergy.impact.taxEfficiency)}`}
                        >
                          {synergy.impact.taxEfficiency > 0 ? "+" : ""}
                          {synergy.impact.taxEfficiency.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Building2 className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Capacity</span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(synergy.impact.governmentCapacity)}`}
                        >
                          {synergy.impact.governmentCapacity > 0 ? "+" : ""}
                          {synergy.impact.governmentCapacity.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Recommendations */}
                    {synergy.recommendations.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                          Recommendations:
                        </div>
                        <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          {synergy.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start space-x-1">
                              <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-500" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conflicts Section */}
      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span>Conflicts ({conflicts.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conflicts.map((conflict) => {
                const ConflictIcon = getSynergyIcon(conflict);
                return (
                  <motion.div
                    key={conflict.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <ConflictIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="font-medium text-red-900 dark:text-red-100">
                          {conflict.description}
                        </span>
                      </div>
                      <Badge variant="destructive">-{conflict.strength.toFixed(0)}%</Badge>
                    </div>

                    {/* Impact Metrics */}
                    <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Target className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Effectiveness
                          </span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(conflict.impact.effectiveness)}`}
                        >
                          {conflict.impact.effectiveness.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <TrendingDown className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Growth</span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(conflict.impact.economicGrowth)}`}
                        >
                          {conflict.impact.economicGrowth.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Tax Efficiency
                          </span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(conflict.impact.taxEfficiency)}`}
                        >
                          {conflict.impact.taxEfficiency.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Building2 className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Capacity</span>
                        </div>
                        <div
                          className={`text-sm font-medium ${getImpactColor(conflict.impact.governmentCapacity)}`}
                        >
                          {conflict.impact.governmentCapacity.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Resolution Recommendations */}
                    {conflict.recommendations.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                          Resolution Options:
                        </div>
                        <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          {conflict.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start space-x-1">
                              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-500" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization Opportunities */}
      {optimizationOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span>Optimization Opportunities</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {optimizationOpportunities.map((opportunity, index) => (
                <Alert key={index}>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">{opportunity}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Factors */}
      {riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <span>Risk Factors</span>
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
