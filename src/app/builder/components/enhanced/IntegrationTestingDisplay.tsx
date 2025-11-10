"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  TestTube,
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
  Clock,
  Play,
  Square,
  Download,
  AlertCircle,
  CheckCircle2,
  Timer,
  Activity,
  Layers,
  Shield,
} from "lucide-react";
import { IntegrationTestingService } from "~/app/builder/services/IntegrationTestingService";
import type {
  ComprehensiveIntegrationReport,
  IntegrationTestSuite,
  IntegrationTestResult,
  IntegrationTestContext,
} from "~/app/builder/services/IntegrationTestingService";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentStructure } from "~/types/government";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import type { TaxSystem } from "~/types/tax-system";

interface IntegrationTestingDisplayProps {
  className?: string;
  economyBuilder?: EconomyBuilderState | null;
  governmentBuilder?: GovernmentStructure | null;
  governmentComponents?: ComponentType[];
  taxSystem?: TaxSystem | null;
}

export function IntegrationTestingDisplay({
  className,
  economyBuilder,
  governmentBuilder,
  governmentComponents,
  taxSystem,
}: IntegrationTestingDisplayProps) {
  const [integrationReport, setIntegrationReport] = useState<ComprehensiveIntegrationReport | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");

  const testingService = new IntegrationTestingService();

  const runIntegrationTests = async () => {
    if (!economyBuilder || !governmentBuilder || !taxSystem) {
      alert(
        "Please configure all systems (economy, government, tax) before running integration tests"
      );
      return;
    }

    setIsRunning(true);
    try {
      const context: IntegrationTestContext = {
        economyBuilder: economyBuilder!,
        governmentBuilder: governmentBuilder! as any,
        governmentComponents: governmentComponents || [],
        taxSystem: taxSystem!,
      };

      const report = await testingService.runComprehensiveTesting(context);
      setIntegrationReport(report);
      setActiveTab("overview");
    } catch (error) {
      console.error("Integration testing failed:", error);
    } finally {
      setIsRunning(false);
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

  const getPassRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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

  const renderTestResult = (result: IntegrationTestResult) => {
    const isExpanded = expandedResults.has(result.testId);

    return (
      <Card key={result.testId} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {result.passed ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <CardTitle className="text-lg">{result.testId.replace(/-/g, " ")}</CardTitle>
                <p className="text-sm text-gray-600">{result.message}</p>
                <div className="mt-1 flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    <Timer className="mr-1 inline h-3 w-3" />
                    {formatDuration(result.executionTime)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {result.errors.length > 0 && (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  {result.errors.length} errors
                </Badge>
              )}
              {result.warnings.length > 0 && (
                <Badge variant="outline" className="border-orange-600 text-orange-600">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {result.warnings.length} warnings
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleResultExpansion(result.testId)}
              >
                {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Metrics */}
            {Object.keys(result.metrics).length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Test Metrics</h4>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {Object.entries(result.metrics).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-lg font-bold">
                        {typeof value === "number" ? value.toFixed(1) : value}
                      </div>
                      <div className="text-xs text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, " $1")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            {result.details.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Test Details</h4>
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

            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-600">Errors</h4>
                <ul className="space-y-1">
                  {result.errors.map((error, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                      <span className="text-sm text-red-600">{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-orange-600">Warnings</h4>
                <ul className="space-y-1">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                      <span className="text-sm text-orange-600">{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Recommendations</h4>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="mt-1 text-green-600">•</span>
                      <span className="text-sm">{rec}</span>
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

  const renderTestSuite = (suite: IntegrationTestSuite) => (
    <Card key={suite.id} className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Layers className="h-5 w-5" />
              <span>{suite.name}</span>
            </CardTitle>
            <p className="mt-1 text-sm text-gray-600">{suite.description}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getPassRateColor(suite.overallPassRate)}`}>
              {suite.overallPassRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Pass Rate</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{suite.tests.length}</div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{suite.summary.passed}</div>
            <div className="text-sm text-gray-600">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{suite.summary.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{suite.summary.critical}</div>
            <div className="text-sm text-gray-600">Critical</div>
          </div>
        </div>

        <Progress value={suite.overallPassRate} className="mb-4" />

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Execution Time: {formatDuration(suite.executionTime)}</span>
          <span>
            Tests: {suite.summary.passed}/{suite.tests.length} passed
          </span>
        </div>

        {showDetails && (
          <div className="mt-6 space-y-4">
            <h3 className="font-medium">Test Results</h3>
            {suite.results.map(renderTestResult)}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-6 w-6" />
            <span>Integration Testing</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Comprehensive integration testing of all cross-builder functionality including synergy
            detection, bidirectional synchronization, effectiveness calculations, and validation
            systems.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={runIntegrationTests}
                disabled={isRunning || !economyBuilder || !governmentBuilder || !taxSystem}
                className="flex items-center space-x-2"
              >
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>{isRunning ? "Running Tests..." : "Run Integration Tests"}</span>
              </Button>

              {integrationReport && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      Last run: {new Date(integrationReport.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Timer className="h-4 w-4" />
                    <span>Duration: {formatDuration(integrationReport.totalExecutionTime)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                disabled={!integrationReport}
              >
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-1">{showDetails ? "Hide Details" : "Show Details"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!economyBuilder || !governmentBuilder || !taxSystem ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Configuration Required:</strong> Please configure economy, government, and tax
            systems before running integration tests.
          </AlertDescription>
        </Alert>
      ) : null}

      {integrationReport && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="suites">Test Suites</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overall Summary */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Overall Pass Rate</p>
                      <p
                        className={`text-2xl font-bold ${getPassRateColor(integrationReport.overallPassRate)}`}
                      >
                        {integrationReport.overallPassRate.toFixed(1)}%
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <Progress value={integrationReport.overallPassRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Tests</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {integrationReport.totalTests}
                      </p>
                    </div>
                    <TestTube className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {integrationReport.passedTests} passed, {integrationReport.failedTests} failed
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">System Integration</p>
                      <p
                        className={`text-2xl font-bold ${getPassRateColor(integrationReport.systemIntegration.overall)}`}
                      >
                        {integrationReport.systemIntegration.overall.toFixed(0)}
                      </p>
                    </div>
                    <Shield className="h-8 w-8 text-purple-600" />
                  </div>
                  <Progress value={integrationReport.systemIntegration.overall} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Execution Time</p>
                      <p className="text-2xl font-bold text-gray-600">
                        {formatDuration(integrationReport.totalExecutionTime)}
                      </p>
                    </div>
                    <Timer className="h-8 w-8 text-gray-600" />
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Avg: {formatDuration(integrationReport.performanceMetrics.averageTestTime)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Integration Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>System Integration Scores</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Economy-Government</span>
                      <span
                        className={`font-bold ${getPassRateColor(integrationReport.systemIntegration.economyGovernment)}`}
                      >
                        {integrationReport.systemIntegration.economyGovernment.toFixed(0)}
                      </span>
                    </div>
                    <Progress
                      value={integrationReport.systemIntegration.economyGovernment}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Economy-Tax</span>
                      <span
                        className={`font-bold ${getPassRateColor(integrationReport.systemIntegration.economyTax)}`}
                      >
                        {integrationReport.systemIntegration.economyTax.toFixed(0)}
                      </span>
                    </div>
                    <Progress
                      value={integrationReport.systemIntegration.economyTax}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Government-Tax</span>
                      <span
                        className={`font-bold ${getPassRateColor(integrationReport.systemIntegration.governmentTax)}`}
                      >
                        {integrationReport.systemIntegration.governmentTax.toFixed(0)}
                      </span>
                    </div>
                    <Progress
                      value={integrationReport.systemIntegration.governmentTax}
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues */}
            {integrationReport.criticalIssues.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Critical Issues Found:</strong>
                  <ul className="mt-2 space-y-1">
                    {integrationReport.criticalIssues.map((issue, index) => (
                      <li key={index} className="text-sm">
                        • {issue}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="suites">
            <div className="space-y-6">{integrationReport.testSuites.map(renderTestSuite)}</div>
          </TabsContent>

          <TabsContent value="performance">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Performance Metrics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatDuration(integrationReport.performanceMetrics.averageTestTime)}
                      </div>
                      <div className="text-sm text-gray-600">Average Test Time</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {integrationReport.performanceMetrics.slowestTest.replace(/-/g, " ")}
                      </div>
                      <div className="text-sm text-gray-600">Slowest Test</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {integrationReport.performanceMetrics.fastestTest.replace(/-/g, " ")}
                      </div>
                      <div className="text-sm text-gray-600">Fastest Test</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Recommendations</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {integrationReport.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="mt-1 text-blue-600">•</span>
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Next Steps</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {integrationReport.nextSteps.map((step, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="mt-1 text-green-600">•</span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
