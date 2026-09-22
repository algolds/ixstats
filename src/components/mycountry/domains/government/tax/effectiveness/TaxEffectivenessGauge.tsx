"use client";

import React from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
  Archery as Target,
  Eye,
  Flash as Zap,
  CheckCircle,
  Shield,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  ArrowSeparateVertical as ArrowUpDown,
} from "iconoir-react";
import {
  type UnifiedEffectiveness,
  itemVariants,
  getEffectivenessColor,
  getEffectivenessBgColor,
  getEffectivenessLabel,
} from "./taxEffectivenessTypes";

interface TaxEffectivenessGaugeProps {
  unifiedEffectiveness: UnifiedEffectiveness;
  onViewDetails?: () => void;
}

function getTrendIcon(value: number, threshold: number = 0) {
  if (value > threshold) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (value < threshold) return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
}

export function TaxEffectivenessGauge({
  unifiedEffectiveness,
  onViewDetails,
}: TaxEffectivenessGaugeProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card
        className={`border-2 ${getEffectivenessBgColor(unifiedEffectiveness.overallScore)}`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-xl bg-indigo-500 p-3 shadow-sm">
                <Target className="h-7 w-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Unified Tax Effectiveness</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Cross-builder synergy analysis with economic impact
                </p>
              </div>
            </div>
            {onViewDetails && (
              <Button onClick={onViewDetails} variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            {/* Overall Score - Prominent Display */}
            <div className="flex flex-col items-center justify-center space-y-3 rounded-xl bg-gradient-to-br from-white/50 to-transparent p-6 backdrop-blur-sm md:col-span-2 dark:from-gray-800/50">
              <div className="relative">
                <svg className="h-40 w-40 -rotate-90 transform">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div
                    className={`text-5xl font-bold ${getEffectivenessColor(unifiedEffectiveness.overallScore)}`}
                  >
                    {Math.round(unifiedEffectiveness.overallScore)}
                  </div>
                  <div className="text-muted-foreground text-sm">out of 100</div>
                </div>
              </div>
              <Badge
                variant={
                  unifiedEffectiveness.overallScore >= 80
                    ? "default"
                    : unifiedEffectiveness.overallScore >= 60
                      ? "secondary"
                      : "destructive"
                }
                className="px-4 py-1 text-lg"
              >
                {getEffectivenessLabel(unifiedEffectiveness.overallScore)}
              </Badge>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:col-span-3">
              {/* Collection Efficiency */}
              <motion.div
                className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  {getTrendIcon(unifiedEffectiveness.collectionEfficiency, 70)}
                </div>
                <div className="mb-1 text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(unifiedEffectiveness.collectionEfficiency)}%
                </div>
                <div className="mb-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  Collection Efficiency
                </div>
                <Progress
                  value={unifiedEffectiveness.collectionEfficiency}
                  className="h-2 bg-blue-100 dark:bg-blue-950"
                />
              </motion.div>

              {/* Compliance Rate */}
              <motion.div
                className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  {getTrendIcon(unifiedEffectiveness.complianceRate, 70)}
                </div>
                <div className="mb-1 text-3xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(unifiedEffectiveness.complianceRate)}%
                </div>
                <div className="mb-2 text-sm font-medium text-green-700 dark:text-green-300">
                  Compliance Rate
                </div>
                <Progress
                  value={unifiedEffectiveness.complianceRate}
                  className="h-2 bg-green-100 dark:bg-green-950"
                />
              </motion.div>

              {/* Audit Capacity */}
              <motion.div
                className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  {getTrendIcon(unifiedEffectiveness.auditCapacity, 60)}
                </div>
                <div className="mb-1 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.round(unifiedEffectiveness.auditCapacity)}%
                </div>
                <div className="mb-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  Audit Capacity
                </div>
                <Progress
                  value={unifiedEffectiveness.auditCapacity}
                  className="h-2 bg-indigo-500/20"
                />
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
