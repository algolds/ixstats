"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Play,
  RefreshCw,
  BarChart3,
  Shield,
  Target,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Timer,
  Zap,
} from "lucide-react";
import { SynergyValidationService } from "~/app/builder/services/SynergyValidationService";
import type {
  ComprehensiveValidationReport,
  ValidationTestSuite,
  SynergyValidationResult,
  ConflictValidationResult,
} from "~/app/builder/services/SynergyValidationService";

interface SynergyValidationDisplayProps {
  className?: string;
}

export function SynergyValidationDisplay({ className }: SynergyValidationDisplayProps) {
  const [validationReport, setValidationReport] = useState<ComprehensiveValidationReport | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const validationService = new SynergyValidationService();

  const runValidation = async () => {
    setIsRunning(true);
    try {
      const report = await validationService.runComprehensiveValidation();
      setValidationReport(report);
    } catch (error) {
      console.error("Validation failed:", error);
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
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const renderTestResult = (
    result: SynergyValidationResult | ConflictValidationResult,
    index: number
  ) => {
    const isSynergyResult = "expectedSynergy" in result;

    return (
      <div key={result.id} className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {result.validationPassed ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium">{result.componentA}</span>
            <span className="text-gray-500">+</span>
            <span className="font-medium">{result.componentB}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getSeverityColor(result.severity)}>
              {getSeverityIcon(result.severity)}
              <span className="ml-1">{result.severity}</span>
            </Badge>
            <Badge variant={result.validationPassed ? "default" : "destructive"}>
              {result.validationPassed ? "PASS" : "FAIL"}
            </Badge>
          </div>
        </div>

        <p className="text-sm text-gray-600">{result.description}</p>

        {isSynergyResult && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Expected Synergy:</span>
              <span
                className={`ml-2 ${result.expectedSynergy ? "text-green-600" : "text-gray-600"}`}
              >
                {result.expectedSynergy ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="font-medium">Actual Synergy:</span>
              <span className={`ml-2 ${result.actualSynergy ? "text-green-600" : "text-gray-600"}`}>
                {result.actualSynergy ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="font-medium">Expected Conflict:</span>
              <span
                className={`ml-2 ${result.expectedConflict ? "text-red-600" : "text-gray-600"}`}
              >
                {result.expectedConflict ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="font-medium">Actual Conflict:</span>
              <span className={`ml-2 ${result.actualConflict ? "text-red-600" : "text-gray-600"}`}>
                {result.actualConflict ? "Yes" : "No"}
              </span>
            </div>
          </div>
        )}

        {!isSynergyResult && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Expected Conflict:</span>
              <span
                className={`ml-2 ${result.expectedConflict ? "text-red-600" : "text-gray-600"}`}
              >
                {result.expectedConflict ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="font-medium">Actual Conflict:</span>
              <span className={`ml-2 ${result.actualConflict ? "text-red-600" : "text-gray-600"}`}>
                {result.actualConflict ? "Yes" : "No"}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recommendations:</h4>
          <ul className="space-y-1 text-sm">
            {(isSynergyResult ? result.recommendations : result.mitigationStrategies).map(
              (rec, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="mt-1 text-blue-600">•</span>
                  <span>{rec}</span>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    );
  };

  const renderTestSuite = (suite: ValidationTestSuite) => (
    <Card key={suite.id} className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
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
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {suite.testCases.length + suite.conflictCases.length}
            </div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{suite.criticalFailures}</div>
            <div className="text-sm text-gray-600">Critical Failures</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{suite.warnings}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </div>
        </div>

        <Progress value={suite.overallPassRate} className="mb-4" />

        {showDetails && (
          <div className="space-y-4">
            {suite.testCases.length > 0 && (
              <div>
                <h3 className="mb-3 font-medium">Synergy Tests ({suite.testCases.length})</h3>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {suite.testCases.map((test, index) => renderTestResult(test, index))}
                </div>
              </div>
            )}

            {suite.conflictCases.length > 0 && (
              <div>
                <h3 className="mb-3 font-medium">Conflict Tests ({suite.conflictCases.length})</h3>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {suite.conflictCases.map((test, index) => renderTestResult(test, index))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 font-medium">Recommendations</h3>
              <ul className="space-y-2">
                {suite.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="mt-1 text-blue-600">•</span>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Hide Details" : "Show Details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <span>Synergy & Conflict Validation Testing</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Comprehensive testing system for atomic component interactions across economy,
            government, and tax systems.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button
              onClick={runValidation}
              disabled={isRunning}
              className="flex items-center space-x-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>{isRunning ? "Running Tests..." : "Run Validation Tests"}</span>
            </Button>

            {validationReport && (
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <Timer className="h-4 w-4" />
                  <span>Last run: {new Date(validationReport.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="h-4 w-4" />
                  <span>Avg: {formatDuration(validationReport.performance.averageTestTime)}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {validationReport && (
        <>
          {/* Overall Results Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Validation Results Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {validationReport.totalTests}
                  </div>
                  <div className="text-sm text-gray-600">Total Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {validationReport.passedTests}
                  </div>
                  <div className="text-sm text-gray-600">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {validationReport.failedTests}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-3xl font-bold ${getPassRateColor(validationReport.passRate)}`}
                  >
                    {validationReport.passRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Pass Rate</div>
                </div>
              </div>

              <Progress value={validationReport.passRate} className="mb-6" />

              {validationReport.criticalIssues.length > 0 && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Critical Issues Found:</strong>
                    <ul className="mt-2 space-y-1">
                      {validationReport.criticalIssues.map((issue, index) => (
                        <li key={index} className="text-sm">
                          • {issue}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationReport.warnings.length > 0 && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warnings:</strong>
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

              <div>
                <h3 className="mb-3 font-medium">Overall Recommendations</h3>
                <ul className="space-y-2">
                  {validationReport.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="mt-1 text-blue-600">•</span>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Test Suite Results */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">Test Suite Results</h2>
            {validationReport.testSuites.map(renderTestSuite)}
          </div>
        </>
      )}
    </div>
  );
}
