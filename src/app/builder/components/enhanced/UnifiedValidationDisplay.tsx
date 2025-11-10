"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  Target,
  BarChart3,
  PieChart,
  Zap,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { UnifiedValidationService } from "~/app/builder/services/UnifiedValidationService";
import type {
  ValidationReport,
  ValidationResult,
  ValidationContext,
} from "~/app/builder/services/UnifiedValidationService";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentStructure } from "~/types/government";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import type { TaxSystem } from "~/types/tax-system";

interface UnifiedValidationDisplayProps {
  className?: string;
  economyBuilder?: EconomyBuilderState | null;
  governmentBuilder?: GovernmentStructure | null;
  governmentComponents?: ComponentType[];
  taxSystem?: TaxSystem | null;
  userPreferences?: {
    growthFocus?: boolean;
    stabilityFocus?: boolean;
    innovationFocus?: boolean;
    equityFocus?: boolean;
    complexity?: "low" | "medium" | "high";
  };
}

export function UnifiedValidationDisplay({
  className,
  economyBuilder,
  governmentBuilder,
  governmentComponents,
  taxSystem,
  userPreferences,
}: UnifiedValidationDisplayProps) {
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [showDetails, setShowDetails] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const validationService = new UnifiedValidationService();

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const context: ValidationContext = {
        economyBuilder: economyBuilder ?? null,
        governmentBuilder: (governmentBuilder ?? null) as any,
        governmentComponents: governmentComponents || [],
        taxSystem: taxSystem ?? null,
        userPreferences,
      };

      const report = await validationService.validateAll(context);
      setValidationReport(report);
    } catch (error) {
      console.error("Validation failed:", error);
    } finally {
      setIsValidating(false);
    }
  };

  const getSeverityColor = (severity: "low" | "medium" | "high" | "critical") => {
    switch (severity) {
      case "low":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSeverityIcon = (severity: "low" | "medium" | "high" | "critical") => {
    switch (severity) {
      case "low":
        return <CheckCircle2 className="h-4 w-4" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4" />;
      case "high":
        return <AlertCircle className="h-4 w-4" />;
      case "critical":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const toggleResultExpansion = (resultId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const filteredResults =
    validationReport?.results.filter((result) => {
      if (selectedCategory !== "all" && !result.ruleId.includes(selectedCategory)) {
        return false;
      }
      if (selectedSeverity !== "all" && result.severity !== selectedSeverity) {
        return false;
      }
      return true;
    }) || [];

  const renderValidationResult = (result: ValidationResult) => {
    const isExpanded = expandedResults.has(result.ruleId);

    return (
      <Card key={result.ruleId} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {result.passed ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <CardTitle className="text-lg">{result.ruleId.replace(/-/g, " ")}</CardTitle>
                <p className="text-sm text-gray-600">{result.message}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getSeverityColor(result.severity)}>
                {getSeverityIcon(result.severity)}
                <span className="ml-1">{result.severity}</span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleResultExpansion(result.ruleId)}
              >
                {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Impact Scores */}
            {Object.entries(result.impact).some(
              ([_, score]) => score !== undefined && score !== 0
            ) && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Impact Scores</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(result.impact).map(([system, score]) => {
                    if (score === undefined || score === 0) return null;
                    return (
                      <div key={system} className="text-center">
                        <div
                          className={`text-lg font-bold ${score > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {score > 0 ? "+" : ""}
                          {score.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600 capitalize">{system}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Details */}
            {result.details.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Details</h4>
                <ul className="space-y-1">
                  {result.details.map((detail, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="mt-1 text-blue-600">•</span>
                      <span className="text-sm">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Suggestions</h4>
                <ul className="space-y-1">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="mt-1 text-green-600">•</span>
                      <span className="text-sm">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <span>Unified System Validation</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Comprehensive validation of consistency, feasibility, and compatibility across economy,
            government, and tax systems.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={runValidation}
                disabled={isValidating}
                className="flex items-center space-x-2"
              >
                {isValidating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span>{isValidating ? "Validating..." : "Run Validation"}</span>
              </Button>

              {validationReport && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      Last run: {new Date(validationReport.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-1">{showDetails ? "Hide Details" : "Show Details"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {validationReport && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overall Pass Rate</p>
                    <p
                      className={`text-2xl font-bold ${getHealthScoreColor(validationReport.passRate)}`}
                    >
                      {validationReport.passRate.toFixed(1)}%
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <Progress value={validationReport.passRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Health</p>
                    <p
                      className={`text-2xl font-bold ${getHealthScoreColor(validationReport.systemHealth.overall)}`}
                    >
                      {validationReport.systemHealth.overall.toFixed(0)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
                <Progress value={validationReport.systemHealth.overall} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Consistency</p>
                    <p
                      className={`text-2xl font-bold ${getHealthScoreColor(validationReport.consistencyScore)}`}
                    >
                      {validationReport.consistencyScore.toFixed(0)}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
                <Progress value={validationReport.consistencyScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Feasibility</p>
                    <p
                      className={`text-2xl font-bold ${getHealthScoreColor(validationReport.feasibilityScore)}`}
                    >
                      {validationReport.feasibilityScore.toFixed(0)}
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-600" />
                </div>
                <Progress value={validationReport.feasibilityScore} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* System Health Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>System Health Breakdown</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Economy</span>
                    <span
                      className={`font-bold ${getHealthScoreColor(validationReport.systemHealth.economy)}`}
                    >
                      {validationReport.systemHealth.economy.toFixed(0)}
                    </span>
                  </div>
                  <Progress value={validationReport.systemHealth.economy} className="h-2" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Government</span>
                    <span
                      className={`font-bold ${getHealthScoreColor(validationReport.systemHealth.government)}`}
                    >
                      {validationReport.systemHealth.government.toFixed(0)}
                    </span>
                  </div>
                  <Progress value={validationReport.systemHealth.government} className="h-2" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Tax</span>
                    <span
                      className={`font-bold ${getHealthScoreColor(validationReport.systemHealth.tax)}`}
                    >
                      {validationReport.systemHealth.tax.toFixed(0)}
                    </span>
                  </div>
                  <Progress value={validationReport.systemHealth.tax} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {validationReport.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Validation Warnings:</strong>
                <ul className="mt-2 space-y-1">
                  {validationReport.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Validation Results</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Category:</span>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="consistency">Consistency</SelectItem>
                      <SelectItem value="feasibility">Feasibility</SelectItem>
                      <SelectItem value="compatibility">Compatibility</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="policy">Policy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Severity:</span>
                  <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Validation Results */}
              <div className="space-y-4">{filteredResults.map(renderValidationResult)}</div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {validationReport.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="mt-1 text-blue-600">•</span>
                    <span className="text-sm">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
